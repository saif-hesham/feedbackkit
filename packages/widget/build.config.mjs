// packages/widget/build.config.mjs
// esbuild config as specified in the technical plan

import { build, context } from 'esbuild'
import { argv } from 'process'

const isWatch = argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: !isWatch,
  format: 'iife',
  target: 'es2018',
  outfile: 'dist/widget.js',
  // Map Preact to the JSX factory
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  inject: ['src/preact-shim.js'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    'process.env.API_URL': '"https://api.feedbackkit.io"',
  },
  metafile: true,
}

if (isWatch) {
  const ctx = await context(buildOptions)
  await ctx.watch()
  console.warn('Watching for changes...')
} else {
  const result = await build(buildOptions)

  // Bundle size check — fail if > 30KB gzipped (CI guard)
  const { execSync } = await import('child_process')
  const gzipSize = execSync(`gzip -c dist/widget.js | wc -c`).toString().trim()
  const sizeKB = (parseInt(gzipSize, 10) / 1024).toFixed(1)
  console.warn(`Widget bundle: ${sizeKB}KB gzipped`)
  if (parseInt(gzipSize, 10) > 30 * 1024) {
    console.error(`❌ Bundle size exceeds 30KB limit: ${sizeKB}KB`)
    process.exit(1)
  } else {
    console.warn(`✅ Bundle size OK: ${sizeKB}KB / 30KB`)
  }
}
