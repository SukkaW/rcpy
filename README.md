## rcpy

> **r**ecursive **c**o**py**

Copy a file or directory. The directory can have contents.

`rcpy` serves as a drop-in replacement of `ncp` and `fs-extra`'s `copy` function (`rcpy` passes most of `fs-extra`'s test cases). It can also be used as a polyfill for Node.js `fs.cp` API.

## Installation

```bash
# npm
npm i rcpy
# yarn
yarn add rcpy
# pnpm
pnpm i rcpy
```

## Usage

```js
// CommonJS
const { rcpy } = require('rcpy');
// or
const { copy } = require('rcpy'); // "copy" is an alias of "rcpy"

// ES Module
import { rcpy } from 'rcpy';
// or
import { copy } from 'rcpy'; // "copy" is an alias of "rcpy"

(async () => {
  await copy(src, dest, options);
})();
```

- `src`: `string` the path of the file/directory to copy. Note that if `src` is a directory it will copy everything inside of this directory, not the entire directory itself.
- `dest`: `string` the destination of the copied file/directory. Note that currently if `src` is a file, `dest` cannot be a directory. This behavior might be changed in the future.
- `option`: `RcpyOption` optional.
  - `dereference`: `boolean` optional. whether to dereference symbolic links, default to `false`.
  - `force`: `boolean` optional. whether to overwrite existing file/directory, default to `true`. Note that the copy operation will silently fail if you set this to false and the destination exists. Use the `errorOnExist` option to change this behavior.
  - `overwrite`: `boolean` optional. The alias of `force`, serves as a compatibility option for `fs-extra`.
  - `errorOnExist`: `boolean` optional. whether to throw an error if `dest` already exists, default to `false`.
  - `filter`: `(src: string, dest: string) => boolean | Promise<boolean>` optional. filter copied files/directories, return `true` to copy, `false` to skip.
  - `preserveTimestamps`: `boolean` optional. whether to preserve file timestamps, default to `false`, where the behavior is OS-dependent.
  - `concurrency`: `number` optional. the number of concurrent copy operations, default to `32`.

## Differences between `rcpy` and `fs-extra`

- Doesn't use `graceful-fs` to prevent `EMFILE` error.
  - `rcpy` instead provides a `concurrency` option to limit the number of concurrent copy operations.
- Asynchronous and Promise-based API only. No synchronous API, no Node.js callback style API.
  - Use `require('util').callbackify` to convert `rcpy` to Node.js callback style API.P

## License

[MIT](./LICENSE)

----

**rcpy** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.<br>
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/rcpy/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · Keybase [@sukka](https://keybase.io/sukka)
