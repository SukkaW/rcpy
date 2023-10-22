import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { checkParentPaths, checkPaths, isSrcSubdir } from './util';
import { Sema } from 'async-sema';

// const COPYFILE_EXCL = fs.constants.COPYFILE_EXCL;

type FilterFn = (src: string, dest: string) => boolean | Promise<boolean>;

export interface RcpyOption {
  filter?: FilterFn,
  overwrite?: boolean,
  errorOnExist?: boolean,
  concurrency?: number
}

const rcpy = async (src: string, dest: string, opt: RcpyOption = {}): Promise<void> => {
  const _opt: Required<RcpyOption> = Object.assign({
    filter: (_src: string, _dest: string) => true,
    overwrite: true,
    errorOnExist: false,
    concurrency: 32
  }, opt);
  const filter = _opt.filter;

  if (!(await filter(src, dest))) {
    return;
  }

  const sema = new Sema(_opt.concurrency);

  const checkResult = await checkPaths(src, dest);
  const srcStat = checkResult[0];

  const destParent = path.resolve(path.dirname(dest));
  const destParentExists = fs.existsSync(destParent);

  await checkParentPaths(src, srcStat, dest);

  if (!destParentExists) {
    await fsp.mkdir(destParent, { recursive: true });
  }

  async function performCopy(src: string, dest: string, [srcStat, destStat, srcIsDir]: readonly [fs.Stats, fs.Stats | null, boolean]) {
    if (srcIsDir) {
      await sema.acquire();
      await onDir(srcStat, destStat, src, dest);
      return sema.release();
    }
    if (
      srcStat.isFile()
      || srcStat.isCharacterDevice()
      || srcStat.isBlockDevice()
    ) {
      await sema.acquire();
      await onFile(srcStat, destStat, src, dest);
      return sema.release();
    }
    if (srcStat.isSymbolicLink()) {
      await sema.acquire();
      await onLink(src, dest, destStat);
      return sema.release();
    }

    throw new Error(`Can not copy '${src}', incompatible file type`);
  }

  async function copyFile(srcStat: fs.Stats, src: string, dest: string) {
    await fsp.copyFile(src, dest);
    return fsp.chmod(dest, srcStat.mode);
  }

  async function onFile(srcStat: fs.Stats, destStat: fs.Stats | null, src: string, dest: string) {
    if (!destStat) return copyFile(srcStat, src, dest);

    if (_opt.overwrite) {
      await fsp.unlink(dest);
      return copyFile(srcStat, src, dest);
    }
    if (_opt.errorOnExist) {
      throw new Error(`'${dest}' already exists`);
    }
  }

  async function onDir(srcStat: fs.Stats, destStat: fs.Stats | null, src: string, dest: string) {
    // the dest direcotry might not exist, create it
    if (!destStat) {
      await fsp.mkdir(dest);
    }

    const items = await fsp.readdir(src);

    const promises: Array<Promise<void>> = [];

    // loop through the files in the current directory to copy everything
    for (let i = 0, len = items.length; i < len; i++) {
      const item = items[i];

      const srcItem = path.join(src, item);
      const destItem = path.join(dest, item);

      promises.push(
        Promise.resolve(filter(srcItem, destItem))
          .then(shouldCopy => {
            if (!shouldCopy) return;

            // If the item is a copyable file, `getStatsAndPerformCopy` will copy it
            // If the item is a directory, `getStatsAndPerformCopy` will call `onDir` recursively
            return checkPaths(srcItem, destItem).then(result => performCopy(srcItem, destItem, result));
          })
      );
    }

    await Promise.all(promises);

    if (!destStat) {
      await fsp.chmod(dest, srcStat.mode);
    }
  }

  async function onLink(src: string, dest: string, destStat: fs.Stats | null) {
    const resolvedSrc = await fsp.readlink(src);

    if (!destStat) {
      return fsp.symlink(resolvedSrc, dest);
    }

    let resolvedDest: string;
    try {
      resolvedDest = await fsp.readlink(dest);
    } catch (e: any) {
      const err: NodeJS.ErrnoException = e;
      // dest exists and is a regular file or directory,
      // Windows may throw UNKNOWN error. If dest already exists,
      // fs throws error anyway, so no need to guard against it here.
      if (err.code === 'EINVAL' || err.code === 'UNKNOWN') return fsp.symlink(resolvedSrc, dest);
      throw e;
    }

    if (isSrcSubdir(resolvedSrc, resolvedDest)) {
      throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
    }
    // do not copy if src is a subdir of dest since unlinking
    // dest in this case would result in removing src contents
    // and therefore a broken symlink would be created.
    if (isSrcSubdir(resolvedDest, resolvedSrc)) {
      throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
    }

    await fsp.unlink(dest);
    return fsp.symlink(resolvedSrc, dest);
  }

  return performCopy(src, dest, checkResult);
};

export { rcpy, rcpy as copy };
