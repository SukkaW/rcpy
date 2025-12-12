import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { copy } from '../../src';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureFileSync } from '../test-utils';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

const { expect } = chai;

const SIZE = 16 * 64 * 1024 + 7;

const wait = (ms: number) => new Promise(resolve => { setTimeout(resolve, ms); });

describe('rcpy', () => {
  let TEST_DIR = '';

  beforeEach(() => {
    TEST_DIR = path.join(os.tmpdir(), 'fs-extra', 'copy');
    return fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('+ copy()', () => {
    it('should return an error if src and dest are the same', async () => {
      const fileSrc = path.join(TEST_DIR, 'TEST_fs-extra_copy');
      const fileDest = path.join(TEST_DIR, 'TEST_fs-extra_copy');
      ensureFileSync(fileSrc);

      await expect(copy(fileSrc, fileDest)).to.be.rejectedWith('Source and destination must not be the same.');
    });

    it('should error when overwrite=false and file exists', async () => {
      const src = path.join(TEST_DIR, 'src.txt');
      const dest = path.join(TEST_DIR, 'dest.txt');

      ensureFileSync(src);
      ensureFileSync(dest);

      await expect(copy(src, dest, { overwrite: false, errorOnExist: true })).to.be.rejected;
    });

    it('should error when overwrite=false and file exists in a dir', async () => {
      const src = path.join(TEST_DIR, 'src', 'sfile.txt');
      const dest = path.join(TEST_DIR, 'dest', 'dfile.txt');

      ensureFileSync(src);
      ensureFileSync(dest);

      await expect(copy(src, dest, { overwrite: false, errorOnExist: true })).to.be.rejected;
    });

    describe('> when src is a file', () => {
      it('should copy the file asynchronously', async () => {
        const fileSrc = path.join(TEST_DIR, 'TEST_fs-extra_src');
        const fileDest = path.join(TEST_DIR, 'TEST_fs-extra_copy');
        fs.writeFileSync(fileSrc, crypto.randomBytes(SIZE));

        const srcMd5 = crypto.createHash('md5').update(fs.readFileSync(fileSrc)).digest('hex');
        await copy(fileSrc, fileDest);
        expect(fs.existsSync(fileDest)).to.equal(true, fileDest);
        const destMd5 = crypto.createHash('md5').update(fs.readFileSync(fileDest)).digest('hex');

        expect(srcMd5).to.equal(destMd5, `src: ${srcMd5} dest: ${destMd5}`);
      });

      it('should work with promises', async () => {
        const fileSrc = path.join(TEST_DIR, 'TEST_fs-extra_src');
        const fileDest = path.join(TEST_DIR, 'TEST_fs-extra_copy');
        fs.writeFileSync(fileSrc, crypto.randomBytes(SIZE));
        const srcMd5 = crypto.createHash('md5').update(fs.readFileSync(fileSrc)).digest('hex');
        let destMd5 = '';

        await copy(fileSrc, fileDest);
        destMd5 = crypto.createHash('md5').update(fs.readFileSync(fileDest)).digest('hex');

        expect(srcMd5).to.equal(destMd5);
      });

      it('should return an error if src file does not exist', async () => {
        const fileSrc = 'we-simply-assume-this-file-does-not-exist.bin';
        const fileDest = path.join(TEST_DIR, 'TEST_fs-extra_copy');

        await expect(copy(fileSrc, fileDest)).to.be.rejected;
      });

      it('should copy to a destination file with two \'$\' characters in name (eg: TEST_fs-extra_$$_copy)', async () => {
        const fileSrc = path.join(TEST_DIR, 'TEST_fs-extra_src');
        const fileDest = path.join(TEST_DIR, 'TEST_fs-extra_$$_copy');

        fs.writeFileSync(fileSrc, '');

        await copy(fileSrc, fileDest);
        fs.statSync(fileDest);
      });

      describe('> when the destination dir does not exist', () => {
        it('should create the destination directory and copy the file', async () => {
          const src = path.join(TEST_DIR, 'file.txt');
          const dest = path.join(TEST_DIR, 'this/path/does/not/exist/copied.txt');
          const data = 'did it copy?\n';

          fs.writeFileSync(src, data, 'utf8');

          try {
            await copy(src, dest);
          } catch { }

          const data2 = fs.readFileSync(dest, 'utf8');
          expect(data).to.equal(data2);
        });
      });

      describe('> when dest exists and is a directory', () => {
        it('should return an error', async () => {
          const src = path.join(TEST_DIR, 'file.txt');
          const dest = path.join(TEST_DIR, 'dir');
          ensureFileSync(src);
          fs.mkdirSync(dest, { recursive: true });

          await expect(copy(src, dest)).to.be.rejectedWith(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
        });
      });
    });

    describe('> when src is a directory', () => {
      describe('> when src directory does not exist', () => {
        it('should return an error', async () => {
          const ts = path.join(TEST_DIR, 'this_dir_does_not_exist');
          const td = path.join(TEST_DIR, 'this_dir_really_does_not_matter');
          await expect(copy(ts, td)).to.be.rejected;
        });
      });

      describe('> when dest exists and is a file', () => {
        it('should return an error', async () => {
          const src = path.join(TEST_DIR, 'src');
          const dest = path.join(TEST_DIR, 'file.txt');
          fs.mkdirSync(src);
          fs.writeFileSync(path.join(src, 'index.txt'), '');
          fs.writeFileSync(dest, '');

          await expect(copy(src, dest)).to.be.rejectedWith(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
        });
      });

      it('should preserve symbolic links', async () => {
        const src = path.join(TEST_DIR, 'src');
        const dest = path.join(TEST_DIR, 'dest');
        const srcTarget = path.join(TEST_DIR, 'destination');
        fs.mkdirSync(src);
        fs.mkdirSync(srcTarget);
        // symlink type is only used for Windows and the default is 'file'.
        // https://nodejs.org/api/fs.html#fs_fs_symlink_target_path_type_callback
        fs.symlinkSync(srcTarget, path.join(src, 'symlink'), 'dir');

        await copy(src, dest);

        const link = fs.readlinkSync(path.join(dest, 'symlink'));
        expect(link).to.equal(srcTarget);
      });

      it('should copy the directory asynchronously', async () => {
        const FILES = 2;
        const src = path.join(TEST_DIR, 'src');
        const dest = path.join(TEST_DIR, 'dest');

        await fsp.mkdir(src);
        for (let i = 0; i < FILES; ++i) {
          fs.writeFileSync(path.join(src, i.toString()), crypto.randomBytes(SIZE));
        }
        const subdir = path.join(src, 'subdir');
        await fsp.mkdir(subdir);
        for (let i = 0; i < FILES; ++i) {
          fs.writeFileSync(path.join(subdir, i.toString()), crypto.randomBytes(SIZE));
        }

        await copy(src, dest);

        expect(fs.existsSync(dest)).to.equal(true, dest);

        for (let i = 0; i < FILES; ++i) {
          const p = path.join(subdir, i.toString());
          expect(fs.existsSync(p)).to.equal(true, p);
        }

        const destSub = path.join(dest, 'subdir');

        await copy(src, dest);
        for (let j = 0; j < FILES; ++j) {
          expect(fs.existsSync(path.join(destSub, j.toString()))).to.equal(true);
        }
      });

      describe('> when the destination dir does not exist', () => {
        it('should create the destination dir and copy the file', async () => {
          const src = path.join(TEST_DIR, 'data/');
          fs.mkdirSync(src, { recursive: true });
          const d1 = 'file1';
          const d2 = 'file2';

          fs.writeFileSync(path.join(src, 'f1.txt'), d1);
          fs.writeFileSync(path.join(src, 'f2.txt'), d2);

          const dest = path.join(TEST_DIR, 'this/path/does/not/exist/outputDir');

          await copy(src, dest);

          const o1 = fs.readFileSync(path.join(dest, 'f1.txt'), 'utf8');
          const o2 = fs.readFileSync(path.join(dest, 'f2.txt'), 'utf8');

          expect(d1).to.equal(o1);
          expect(d2).to.equal(o2);
        });
      });

      describe('> when src dir does not exist', () => {
        it('should return an error', async () => {
          await expect(copy('/does/not/exist', '/something/else')).to.be.rejected;
        });
      });
    });

    describe('> when filter is used', () => {
      it('should do nothing if filter fails', async () => {
        const srcDir = path.join(TEST_DIR, 'src');
        const srcFile = path.join(srcDir, 'srcfile.css');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(srcFile, 'src contents');
        const destDir = path.join(TEST_DIR, 'dest');
        const destFile = path.join(destDir, 'destfile.css');
        const filter = (s: string) => path.extname(s) !== '.css' && !fs.statSync(s).isDirectory();

        await copy(srcFile, destFile, { filter });
        expect(fs.existsSync(destDir)).to.equal(false, destDir);
      });

      it('should only copy files allowed by filter fn', async () => {
        const srcFile1 = path.join(TEST_DIR, '1.css');
        fs.writeFileSync(srcFile1, '');
        const destFile1 = path.join(TEST_DIR, 'dest1.css');
        const filter = (s: string) => s.split('.').pop() !== 'css';

        await copy(srcFile1, destFile1, { filter });
        expect(fs.existsSync(destFile1)).to.equal(false);
      });

      it('should not call filter fn more than needed', async () => {
        const src = path.join(TEST_DIR, 'foo');
        fs.writeFileSync(src, '');
        const dest = path.join(TEST_DIR, 'bar');

        let filterCallCount = 0;
        const filter = () => {
          filterCallCount++;
          return true;
        };

        await copy(src, dest, { filter });
        expect(filterCallCount).to.equal(1);
        expect(fs.existsSync(dest)).to.equal(true);
      });

      it('accepts options object in place of filter', async () => {
        const srcFile1 = path.join(TEST_DIR, '1.jade');
        fs.writeFileSync(srcFile1, '');
        const destFile1 = path.join(TEST_DIR, 'dest1.jade');

        await copy(srcFile1, destFile1, { filter: (s: string) => /.html$|.css$/i.test(s) });
        expect(fs.existsSync(destFile1)).to.equal(false);
      });

      it('allows filter fn to return a promise', async () => {
        const srcFile1 = path.join(TEST_DIR, '1.css');
        fs.writeFileSync(srcFile1, '');
        const destFile1 = path.join(TEST_DIR, 'dest1.css');
        const filter = (s: string) => Promise.resolve(s.split('.').pop() !== 'css');
        // TODO: filter return promise
        await copy(srcFile1, destFile1, { filter });

        expect(fs.existsSync(destFile1)).to.equal(false);
      });

      it('should apply filter recursively', async () => {
        const FILES = 2;
        const src = path.join(TEST_DIR, 'src');
        fs.mkdirSync(src);

        for (let i = 0; i < FILES; ++i) {
          fs.writeFileSync(path.join(src, i.toString()), crypto.randomBytes(SIZE));
        }

        const subdir = path.join(src, 'subdir');
        fs.mkdirSync(subdir);

        for (let i = 0; i < FILES; ++i) {
          fs.writeFileSync(path.join(subdir, i.toString()), crypto.randomBytes(SIZE));
        }

        const dest = path.join(TEST_DIR, 'dest');

        // Don't match anything that ends with a digit higher than 0:
        await copy(src, dest, { filter: (s: string) => /[\D0]$/.test(s) });

        expect(fs.existsSync(dest)).to.equal(true, dest);

        for (let i = 0; i < FILES; ++i) {
          const p = path.join(dest, i.toString());
          expect(fs.existsSync(p)).to.equal(i === 0, p);
        }

        const destSub = path.join(dest, 'subdir');

        for (let j = 0; j < FILES; ++j) {
          const p = path.join(destSub, j.toString());
          expect(fs.existsSync(p)).to.equal(j === 0, p);
        }
      });
    });

    it('should apply filter to directory names', async () => {
      const IGNORE = 'ignore';
      const filter = (p: string) => !p.includes(IGNORE);

      const src = path.join(TEST_DIR, 'src');
      fs.mkdirSync(src);

      const ignoreDir = path.join(src, IGNORE);
      fs.mkdirSync(ignoreDir);

      fs.writeFileSync(path.join(ignoreDir, 'file'), crypto.randomBytes(SIZE));

      const dest = path.join(TEST_DIR, 'dest');

      await copy(src, dest, { filter });
      expect(fs.existsSync(path.join(dest, IGNORE))).to.equal(false);
      expect(fs.existsSync(path.join(dest, IGNORE, 'file'))).to.equal(false);
    });

    it('should apply filter when it is applied only to dest', async () => {
      const timeCond = Date.now();

      const filter = (s: string, d: string) => fs.statSync(d).mtime.getTime() < timeCond;

      const src = path.join(TEST_DIR, 'src');
      fs.mkdirSync(src);
      const subdir = path.join(src, 'subdir');
      fs.mkdirSync(subdir);

      await wait(500);
      const dest = path.join(TEST_DIR, 'dest');
      fs.mkdirSync(dest);

      await copy(src, dest, { filter });

      expect(fs.existsSync(path.join(dest, 'subdir'))).to.equal(false);
    });

    it('should apply filter when it is applied to both src and dest', async () => {
      const timeCond = Date.now();
      const filter = (s: string, d: string) => s.split('.').pop() !== 'css' && fs.statSync(path.dirname(d)).mtime.getTime() > timeCond;

      await wait(500);
      const dest = path.join(TEST_DIR, 'dest');
      fs.mkdirSync(dest);

      const srcFile1 = path.join(TEST_DIR, '1.html');
      const srcFile2 = path.join(TEST_DIR, '2.css');
      const srcFile3 = path.join(TEST_DIR, '3.jade');

      fs.writeFileSync(srcFile1, '');
      fs.writeFileSync(srcFile2, '');
      fs.writeFileSync(srcFile3, '');

      const destFile1 = path.join(dest, 'dest1.html');
      const destFile2 = path.join(dest, 'dest2.css');
      const destFile3 = path.join(dest, 'dest3.jade');

      await copy(srcFile1, destFile1);
      expect(fs.existsSync(destFile1)).to.equal(true, destFile1);

      await copy(srcFile2, destFile2, { filter });
      expect(fs.existsSync(destFile2)).to.equal(false, destFile2);

      await copy(srcFile3, destFile3, { filter });
      expect(fs.existsSync(destFile3)).to.equal(true, destFile3);
    });
  });
});
