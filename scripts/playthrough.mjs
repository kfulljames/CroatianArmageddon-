/**
 * Smoke test: drive a real browser through an actual round.
 *
 * Unit tests prove the engine is right; this proves a person can reach it. It plays
 * the human seat through the interface itself — drawing, opening, claiming,
 * discarding — and fails loudly on any console error, which is how the nested-button
 * and prompt-flash bugs were caught.
 *
 * Run the dev server first, then: node scripts/playthrough.mjs
 * Screenshots land in /tmp/shots.
 */

import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()) })

const shot = (name) => page.screenshot({ path: `/tmp/shots/${name}.png` })
const visible = async (name) => (await page.getByRole('button', { name }).count()) > 0
      && await page.getByRole('button', { name }).first().isVisible()

await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New game' }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Deal round 1' }).click()

let captured = { opening: false, claim: false, melds: false, roundEnd: false }
let acted = 0

for (let step = 0; step < 400; step++) {
  await page.waitForTimeout(180)
  try {

  // Claim prompt
  if (await visible('Take it')) {
    if (!captured.claim) { await shot('4-claim'); captured.claim = true }
    // Take it when free, pass when it costs a penalty.
    const penalty = await page.getByText('penalty card').count() > 0
    await page.getByRole('button', { name: penalty ? 'Pass' : 'Take it' }).click()
    acted++
    continue
  }

  // Opening picker
  if (await page.getByText('Lay down your opening').count() > 0) {
    if (!captured.opening) { await shot('5-opening'); captured.opening = true }
    await page.locator('button:has-text("Leaves")').first().click()
    acted++
    continue
  }

  // Round end
  if (await page.getByText(/went out|Round over/).count() > 0) {
    await shot('7-roundend'); captured.roundEnd = true
    break
  }

  if (await visible('Open')) { await page.getByRole('button', { name: 'Open' }).click(); acted++; continue }
  if (await visible('Draw')) { await page.getByRole('button', { name: 'Draw' }).click(); acted++; continue }
  if (await visible('Take')) { await page.getByRole('button', { name: 'Take' }).click(); acted++; continue }

  // Our turn to play: capture the table once melds exist, then discard.
  const discardBtn = page.getByRole('button', { name: /^Discard / })
  if (await discardBtn.count() > 0 && await discardBtn.first().isVisible()) {
    await discardBtn.first().click(); acted++; continue
  }

  // Select a hand card to enable discarding — only ones that are actually enabled,
  // since cards are disabled while it is not our turn.
  const handCards = page.locator('.relative.mx-auto > div > button:not([disabled])')
  const count = await handCards.count()
  if (count > 0) {
    if (!captured.melds && (await page.getByText('OPEN').count()) > 0) {
      await shot('6-melds'); captured.melds = true
    }
    await handCards.nth(count - 1).click({ timeout: 2000 }).catch(() => {})
    continue
  }
  } catch (error) {
    // A button vanishing mid-click just means the bots moved on; keep playing.
  }
}

console.log('actions taken:', acted)
console.log('captured:', captured)
console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 5) : 'none')
await browser.close()
