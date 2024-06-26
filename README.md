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

- `src`: `string` The path of the file/directory to copy. Note that if `src` is a directory it will copy everything inside of this directory, not the entire directory itself.
- `dest`: `string` The destination of the copied file/directory. Note that currently if `src` is a file, `dest` cannot be a directory. This behavior might be changed in the future.
- `option`: `RcpyOption` optional.
  - `dereference`: `boolean` optional. Whether to dereference symbolic links, default to `false`.
  - `force`: `boolean` optional. Whether to overwrite existing file/directory, default to `true`. Note that the copy operation will silently fail if you set this to false and the destination exists. Use the `errorOnExist` option to change this behavior.
  - `overwrite`: `boolean` optional. Deprecated, now is the alias of `force`. Serves as a compatibility option for `fs-extra`.
  - `errorOnExist`: `boolean` optional. Whether to throw an error if `dest` already exists, default to `false`.
  - `filter`: `(src: string, dest: string) => boolean | Promise<boolean>` optional. Filter copied files/directories, return `true` to copy, `false` to skip. When a directory is skipped, all of its contents will be skipped as well.
  - `mode`: `number` optional. Modifiers for copy operation, default to `0`. See `mode` flag of [`fs.copyFile()`](https://nodejs.org/api/fs.html#fscopyfilesrc-dest-mode-callback)
  - `preserveTimestamps`: `boolean` optional. Whether to preserve file timestamps, default to `false`, where the behavior is OS-dependent.
  - `concurrency`: `number` optional. The number of concurrent copy operations, default to `32`.

## Differences between `rcpy` and `fs-extra`

- Doesn't use `graceful-fs` to prevent `EMFILE` error.
  - `rcpy` instead provides a `concurrency` option to limit the number of concurrent copy operations.
- Asynchronous and Promise-based API only. No synchronous API, no Node.js callback style API.
  - Use `require('util').callbackify` to convert `rcpy` to Node.js callback style API.P

## Differences between `rcpy` and Node.js `fs.cp()`

- Doesn't support `URL` for `src` and `dest`.
  - PR is welcome to add `file://` support.
- Doesn't support `recursive` option.
  - `rcpy` will always copy directories' content recursively.
  - PR is welcome to add this option.
- Doesn't support `verbatimSymlinks` option.
  - `rcpy` will always perform path resolution for symlinks if `dereference` option is enabled.
  - PR is welcome to add this option.
- Extra `concurrency` option.
  - `rcpy` will use this option to limit the number of concurrent copy operations to prevent `EMFILE` error.

## License

[MIT](./LICENSE)

----

**rcpy** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.<br>
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/rcpy/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · Keybase [@sukka](https://keybase.io/sukka)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
