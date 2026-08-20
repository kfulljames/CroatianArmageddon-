/**
 * Render the Android adaptive icon the way a launcher will.
 *
 * Adaptive icons are two layers the launcher masks to whatever shape it likes, so
 * what you see in the res/ folder is not what lands on a home screen. This composites
 * them and applies a circular mask, which is how the double-inset bug — a square
 * background leaving black wedges in the corners — was caught without a device.
 *
 *   node scripts/preview-adaptive-icon.mjs out.png
 */

import sharp from 'sharp'
/** Simulate a launcher: both layers fill the canvas, then a circular mask is applied. */
const SIZE = 432
const dir = 'android/app/src/main/res/mipmap-xxxhdpi'
const bg = await sharp(`${dir}/ic_launcher_background.png`).resize(SIZE, SIZE).toBuffer()
const fg = await sharp(`${dir}/ic_launcher_foreground.png`).resize(SIZE, SIZE).toBuffer()
const layered = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: bg }, { input: fg }]).png().toBuffer()
const mask = await sharp(Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="#fff"/></svg>`))
  .resize(SIZE, SIZE, { fit: 'fill' }).png().toBuffer()
await sharp(layered).composite([{ input: mask, blend: 'dest-in' }])
  .flatten({ background: '#101010' }).png().toFile(process.argv[2])
console.log('wrote', process.argv[2])
