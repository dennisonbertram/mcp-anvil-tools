// esbuild.bundle.config.js
// Configuration for bundling the MCP Anvil Tools server into a single file for easy distribution

import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/mcp-anvil-tools.bundle.mjs',
  minify: true,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node\n'
  },
  // better-sqlite3 is a native module and cannot be bundled
  external: ['better-sqlite3'],
  treeShaking: true,
  legalComments: 'none',
  logLevel: 'info',
}).then(() => {
  console.log('Bundle created: dist/mcp-anvil-tools.bundle.mjs');
  console.log('Note: better-sqlite3 must be installed separately (native module)');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
