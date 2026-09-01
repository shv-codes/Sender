const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/popup/popup.ts'],
  bundle: true,
  outfile: 'dist/popup/popup.js',
  minify: false,
  sourcemap: true,
  target: ['es2022']
}).catch(() => process.exit(1));
