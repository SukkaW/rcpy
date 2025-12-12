import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { checkParentPaths, checkPaths, isSrcSubdir, utimesMillis } from './util';
import process from 'node:process';
import { Sema } from 'async-sema';

// const COPYFILE_EXCL = fs.constants.COPYFILE_EXCL;

type FilterFn = (src: string, dest: string) => boolean | Promise<boolean>;

export interface RcpyOption {
  /** @default false */
  dereference?: boolean,
  filter?: FilterFn,
  /** @default true */
  force?: boolean,
  /**
   * @deprecated
   * @default true
   */
  overwrite?: boolean,
  /** @default 0 */
  mode?: number,
  /** @default false */
  preserveTimestamps?: boolean,
  /** @default false */
  errorOnExist?: boolean,
  /** @default 32 */
  concurrency?: number
}

async function rcpy(src: string, dest: string, opt: RcpyOption = {}): Promise<void> {
  const _opt: Required<RcpyOption> = Object.assign({
    dereference: false,
    filter: (_src: string, _dest: string) => true,
    force: opt.overwrite ?? true,
    overwrite: true,
    errorOnExist: false,
    mode: 0,
    preserveTimestamps: false,
    concurrency: 32
  }, opt);
  const filter = _opt.filter;

  // Warn about using preserveTimestamps on 32-bit node
  if (_opt.preserveTimestamps && process.arch === 'ia32') {
    process.emitWarning(
      'Using the preserveTimestamps option in 32-bit node is not recommended;\n\n'
      + '\tsee https://github.com/jprichardson/node-fs-extra/issues/269',
      'Warning', 'rcpy-WARN0001'
    );
  }

  if (!(await filter(src, dest))) {
    return;
  }

  const sema = new Sema(_opt.concurrency);

  const checkResult = await checkPaths(src, dest, _opt.dereference);
  const srcStat = checkResult[0];

  const destParent = path.resolve(path.dirname(dest));
  const destParentExists = fs.existsSync(destParent);

  await checkParentPaths(src, srcStat, dest, _opt.dereference);

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
    await fsp.copyFile(src, dest, _opt.mode);

    if (_opt.preserveTimestamps) {
      // Make sure the file is writable before setting the timestamp
      // otherwise open fails with EPERM when invoked with 'r+'
      // (through utimes call)
      if (fileIsNotWritable(srcStat.mode)) {
        await makeFileWritable(dest, srcStat.mode);
      }

      // Set timestamps and mode correspondingly

      // Note that The initial srcStat.atime cannot be trusted
      // because it is modified by the read(2) system call
      // (See https://nodejs.org/api/fs.html#fs_stat_time_values)
      const updatedSrcStat = await fsp.stat(src);
      await utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
    }

    return fsp.chmod(dest, srcStat.mode);
  }

  async function onFile(srcStat: fs.Stats, destStat: fs.Stats | null, src: string, dest: string) {
    if (!destStat) return copyFile(srcStat, src, dest);

    if (_opt.force) {
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

    const promises: Array<Promise<void>> = [];

    for await (const item of await fsp.opendir(src)) {
      const srcItem = path.join(src, item.name);
      const destItem = path.join(dest, item.name);

      if (!(await filter(srcItem, destItem))) {
        continue;
      }

      promises.push(performCopy(srcItem, destItem, await checkPaths(srcItem, destItem, _opt.dereference)));
    }

    await Promise.all(promises);

    if (!destStat) {
      await fsp.chmod(dest, srcStat.mode);
    }
  }

  async function onLink(src: string, dest: string, destStat: fs.Stats | null) {
    let resolvedSrc = await fsp.readlink(src);

    if (_opt.dereference) {
      resolvedSrc = path.resolve(process.cwd(), resolvedSrc);
    }

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

    if (_opt.dereference) {
      resolvedDest = path.resolve(process.cwd(), resolvedDest);
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
}

function fileIsNotWritable(srcMode: number) {
  return (srcMode & 0o200) === 0;
}

function makeFileWritable(dest: string, srcMode: number) {
  return fsp.chmod(dest, srcMode | 0o200);
}

export { rcpy, rcpy as copy };
