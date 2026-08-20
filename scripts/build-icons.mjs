/**
 * Builds every icon and splash image from the one piece of artwork.
 *
 * The source is already composed as an app icon: the medallion nearly filling a
 * square, on a near-black plate. That serves the full-bleed icons directly. Android's
 * adaptive icons need more — two layers the launcher masks to whatever shape it
 * likes — so the medallion is cut out of the plate and placed on its own background.
 *
 * Run with `npm run icons`. It regenerates the sources, fans them out into the native
 * projects, and then repairs two things the generator gets wrong for this artwork.
 */

import sharp from 'sharp'
import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'

const SOURCE = 'assets/source/emblem.png'

/**
 * Where the medallion sits, measured rather than eyeballed. It is very slightly
 * taller than it is wide — the top rim catches more light — so it is cut with an
 * ellipse. A circle would shave the top and bottom off the rim.
 */
const MEDALLION = { cx: 626, cy: 570, rx: 520, ry: 535 }

/** The app's own felt colour, so the splash matches the table you land on. */
const FELT = { r: 11, g: 32, b: 24 }
/** The plate the medallion is mounted on, sampled from the artwork. */
const PLATE = { r: 16, g: 15, b: 15 }

/**
 * Android only guarantees the middle 66% of an adaptive icon is visible; the launcher
 * crops the rest to whatever shape it fancies — circle, squircle, teardrop. The
 * medallion is kept just inside that so it survives any of them. This maps straight
 * onto the canvas because the adaptive-icon definition is rewritten below to stop
 * insetting the layers a second time.
 */
const ADAPTIVE_SCALE = 0.62
const SPLASH_SCALE = 0.26

/** The medallion cut from its plate, on transparency. */
async function medallion(height) {
  const { cx, cy, rx, ry } = MEDALLION
  const w = rx * 2
  const h = ry * 2
  const cut = await sharp(SOURCE)
    .extract({ left: cx - rx, top: cy - ry, width: w, height: h })
    .toBuffer()

  // Rendered SVG does not always land on the exact pixel size asked for, and a
  // composite mask must match its base exactly, so it is resized to be certain.
  const mask = await sharp(
    Buffer.from(
      `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 2}" ry="${h / 2 - 2}" fill="#fff"/></svg>`,
    ),
  )
    .resize(w, h, { fit: 'fill' })
    .png()
    .toBuffer()

  // Masking and resizing happen in separate passes on purpose: sharp runs a resize
  // before a composite no matter which order they are chained in, which would shrink
  // the medallion out from under a mask still cut for the original size.
  const masked = await sharp(cut)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const width = Math.round((height * w) / h)
  return { buffer: await sharp(masked).resize(width, height, { fit: 'fill' }).png().toBuffer(), width }
}

/** A flat field with a barely-there lift in the middle, so it is not dead black. */
async function backdrop(size, colour) {
  const glow = Buffer.from(
    `<svg width="${size}" height="${size}">
      <defs><radialGradient id="g" cx="50%" cy="46%" r="62%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient></defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`,
  )
  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...colour, alpha: 1 } },
  })
    .composite([{ input: await sharp(glow).resize(size, size, { fit: 'fill' }).png().toBuffer() }])
    .png()
    .toBuffer()
}

/** Centre the medallion on a background at the given fraction of the canvas. */
async function centred(size, scale, background) {
  const height = Math.round(size * scale)
  const { buffer, width } = await medallion(height)
  return sharp(background)
    .composite([
      { input: buffer, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) },
    ])
    .png()
    .toBuffer()
}

async function main() {
  await mkdir('assets', { recursive: true })
  await mkdir('public', { recursive: true })

  // The artwork is already an icon, so full-bleed icons are just the artwork.
  await sharp(SOURCE).resize(1024, 1024, { fit: 'cover' }).png().toFile('assets/icon-only.png')

  await sharp(await backdrop(1024, PLATE)).toFile('assets/icon-background.png')

  const height = Math.round(1024 * ADAPTIVE_SCALE)
  const { buffer, width } = await medallion(height)
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: buffer, left: Math.round((1024 - width) / 2), top: Math.round((1024 - height) / 2) },
    ])
    .png()
    .toFile('assets/icon-foreground.png')

  // Splash screens are cropped hard on tall and wide screens alike, so the medallion
  // stays small and centred on the app's own felt.
  const splash = await centred(2732, SPLASH_SCALE, await backdrop(2732, FELT))
  for (const name of ['splash.png', 'splash-dark.png']) {
    await sharp(splash).toFile(`assets/${name}`)
  }

  // The web build's favicon, which is also what a home-screen shortcut picks up.
  for (const size of [32, 180, 192, 512]) {
    await sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toFile(`public/icon-${size}.png`)
  }

  console.log('icons and splash screens written to assets/ and public/')

  execFileSync('npx', ['capacitor-assets', 'generate'], { stdio: 'inherit' })
  await writeAdaptiveIcon()
  await writeWebManifest()
  await rm('icons', { recursive: true, force: true })
}

/**
 * Rewrite Android's adaptive icon definition.
 *
 * The generator insets *both* layers by 16.7%, which is wrong for this artwork in two
 * ways. The background stops short of the edges, so a round launcher mask cuts
 * corners out of it and leaves black wedges. And the foreground is shrunk a second
 * time on top of the margin already built into it, leaving the medallion adrift in
 * the middle of its own icon.
 *
 * Both layers should fill the whole 108dp canvas, with the sizing decided where the
 * pixels are drawn — which is what ADAPTIVE_SCALE does.
 */
async function writeAdaptiveIcon() {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
  const dir = 'android/app/src/main/res/mipmap-anydpi-v26'
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    await writeFile(`${dir}/${name}`, xml)
  }
  console.log('adaptive icon layers set to fill the canvas')
}

/**
 * Write the web manifest by hand.
 *
 * The generator emits one that points at `../icons/*.webp` — a path that climbs out
 * of the web root and does not resolve — labels those webp files as PNG, and carries
 * no name, start URL or colours. Since the fastest way for anyone to play this is a
 * link they add to their home screen, that file has to actually be right.
 */
async function writeWebManifest() {
  const manifest = {
    name: 'Croatian Armageddon',
    short_name: 'Armageddon',
    description: 'The seven-round card game, against three opponents.',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b2018',
    theme_color: '#0b2018',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      // A maskable copy, so Android does not draw a white plate behind the icon.
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  await writeFile('public/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`)
  console.log('web manifest written')
}

await main()
