import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const futimes = promisify(fs.futimes);
const open = promisify(fs.open);
const close = promisify(fs.close);

export const areIdentical = (srcStat: fs.Stats, destStat: fs.Stats) => destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;

// return true if dest is a subdir of src, otherwise false.
// It only checks the path strings.
export function isSrcSubdir(src: string, dest: string) {
  // const srcArr = path.resolve(src).split(path.sep).filter(Boolean);
  // const destArr = path.resolve(dest).split(path.sep).filter(Boolean);

  // return srcArr.every((cur, i) => destArr[i] === cur);
  return dest.startsWith(src);
}

export async function checkPaths(src: string, dest: string, dereference: boolean) {
  const statFn = dereference ? fsp.lstat : fsp.stat;
  const srcStat = await statFn(src);
  const destStat: fs.Stats | null = fs.existsSync(dest) ? await statFn(dest) : null;

  const srcIsDir = srcStat.isDirectory();

  if (destStat) {
    if (areIdentical(srcStat, destStat)) {
      throw new Error('Source and destination must not be the same.');
    }

    const dstIsDir = destStat.isDirectory();
    if (srcIsDir && !dstIsDir) {
      throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
    }
    if (!srcIsDir && dstIsDir) {
      throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
    }
  }
  if (srcIsDir && isSrcSubdir(src, dest)) {
    throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
  }

  return [srcStat, destStat, srcIsDir] as const;
}

// recursively check if dest parent is a subdirectory of src.
// It works for all file types including symlinks since it
// checks the src and dest inodes. It starts from the deepest
// parent and stops once it reaches the src parent or the root path.
export async function checkParentPaths(src: string, srcStat: fs.Stats, dest: string, dereference: boolean) {
  const srcParent = path.resolve(path.dirname(src));
  const destParent = path.resolve(path.dirname(dest));
  if (destParent === srcParent || destParent === path.parse(destParent).root) return;

  if (!fs.existsSync(destParent)) return;

  const statFn = dereference ? fsp.lstat : fsp.stat;
  const destParentStat = await statFn(destParent);
  if (areIdentical(srcStat, destParentStat)) {
    throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
  }

  return checkParentPaths(src, srcStat, destParent, dereference);
}

export async function utimesMillis(path: string, atime: fs.TimeLike, mtime: fs.TimeLike) {
  // if (!HAS_MILLIS_RES) return fs.utimes(path, atime, mtime, callback)
  const fd = await open(path, 'r+');

  let futimesErr = null;
  try {
    await futimes(fd, atime, mtime);
  } catch (e) {
    futimesErr = e;
  }

  let closeErr = null;

  try {
    await close(fd);
  } catch (e) {
    closeErr = e;
  }

  if (futimesErr) {
    throw futimesErr;
  }
  if (closeErr) {
    throw closeErr;
  }
}
