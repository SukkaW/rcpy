import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export const emptyDir = async (dir: string) => {
  let items;
  try {
    items = await fsp.readdir(dir);
  } catch {
    return fsp.mkdir(dir, { recursive: true });
  }

  return Promise.all(items.map(item => fsp.unlink(path.join(dir, item))));
};

export const ensureFileSync = (file: string) => {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
};
