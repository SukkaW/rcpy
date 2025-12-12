import { defineConfig } from 'rollup';
import { swc } from 'rollup-plugin-swc3';
import { dts } from 'rollup-plugin-dts';
import { builtinModules, createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const external = builtinModules
  .concat(builtinModules.map(m => `node:${m}`))
  .concat(Object.keys(require('./package.json').dependencies));

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs' },
      { file: 'dist/index.cjs', format: 'cjs' },
      { file: 'dist/index.mjs', format: 'es' }
    ],
    plugins: [
      swc({
        minify: true,
        isModule: true,
        jsc: {
          minify: {
            compress: true,
            mangle: true,
            module: true
          }
        }
      })
    ],
    external
  },
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.d.ts', format: 'es' }
    ],
    plugins: [
      dts()
    ],
    external
  }
]);
