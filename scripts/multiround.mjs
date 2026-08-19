/** Plays several rounds and verifies a game survives the app being closed. */
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()) })

const btn = (name) => page.getByRole('button', { name })
const canClick = async (name) =>
  (await btn(name).count()) > 0 && (await btn(name).first().isVisible())

// Speed the bots right up so a whole seven-round game fits in a test run.
await page.addInitScript(() => {
  window.localStorage.setItem(
    'croatian-armageddon:settings:v1',
    JSON.stringify({ playerName: 'You', opponents: 3, difficulty: 'normal', alwaysAsk: false, botSpeed: 25 }),
  )
})

await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })
await btn('New game').click()
await page.waitForTimeout(200)
await btn('Deal round 1').click()

let roundsSeen = new Set()
let reloaded = false

for (let step = 0; step < 12000; step++) {
  await page.waitForTimeout(15)
  try {
    const heading = await page.textContent('body')
    const match = heading.match(/Round (\d)/)
    if (match) roundsSeen.add(match[1])

    // Halfway through round 2, close and reopen the app.
    if (!reloaded && roundsSeen.has('2')) {
      reloaded = true
      await page.reload({ waitUntil: 'networkidle' })
      if (await canClick('Resume game')) {
        await btn('Resume game').click()
        console.log('resumed after reload: OK')
      } else {
        console.log('resumed after reload: FAILED — no Resume button')
      }
      continue
    }

    if (await canClick('Take it')) {
      const penalty = (await page.getByText('penalty card').count()) > 0
      await btn(penalty ? 'Pass' : 'Take it').click(); continue
    }
    if (await page.getByText('Lay down your opening').count() > 0) {
      await page.locator('button:has-text("Leaves")').first().click({ timeout: 2000 }); continue
    }
    if (await canClick('Final standings')) { await btn('Final standings').click(); continue }
    if (await canClick(/^Deal round/)) { await btn(/^Deal round/).click(); continue }
    if (await canClick('Back to the menu')) {
      console.log('reached the end of the game')
      break
    }
    if (await canClick('Open')) { await btn('Open').click(); continue }
    if (await canClick('Draw')) { await btn('Draw').click(); continue }
    if (await canClick('Take')) { await btn('Take').click(); continue }

    const discard = page.getByRole('button', { name: /^Discard / })
    if ((await discard.count()) > 0 && (await discard.first().isVisible())) {
      await discard.first().click(); continue
    }
    const cards = page.locator('.relative.mx-auto > div > button:not([disabled])')
    const count = await cards.count()
    if (count > 0) await cards.nth(count - 1).click({ timeout: 1500 }).catch(() => {})
  } catch {
    // transient element churn while bots move
  }
}

await page.screenshot({ path: '/tmp/shots/8-gameend.png' })
console.log('rounds reached:', [...roundsSeen].sort().join(', '))
console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()
