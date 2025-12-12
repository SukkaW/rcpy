import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function emptyDir(dir: string) {
  let items;
  try {
    items = await fsp.readdir(dir);
  } catch {
    return fsp.mkdir(dir, { recursive: true });
  }

  return Promise.all(items.map(item => fsp.unlink(path.join(dir, item))));
}

export function ensureFileSync(file: string) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
}
