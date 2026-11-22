import { test, expect } from '@playwright/test'

async function createAccount(page) {
  const email = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Jordan')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('strong-guide-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.waitForURL('**/dashboard')
  return email
}

test('Skip Intro works from the first splash frame', async ({ page }) => {
  const time = new Date('2026-11-22T00:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await createAccount(page)
  await expect(page.locator('.signin-intro')).toHaveClass(/intro-splash/)
  await expect(page.getByRole('button', { name: 'Skip Intro' })).toHaveCSS('pointer-events', 'auto')
  await page.getByRole('button', { name: 'Skip Intro' }).click()
  await expect(page.locator('.signin-intro')).toHaveCount(0)
})

test('intro skips immediately, restores focus, and plays after manual login only', async ({ page }) => {
  const email = await createAccount(page)
  const intro = page.getByRole('dialog', { name: 'Welcome, Jordan.' })
  await expect(intro).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Intro' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(intro).toHaveCount(0)
  await expect(page.locator('main h1')).toBeFocused()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  await expect(page.locator('.signin-intro')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('strong-guide-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Skip Intro' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip Intro' }).click()
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expect(page.locator('.guide-dialog .student-guide-2d')).toHaveAttribute('data-pose', 'point')
  await expect(page.locator('canvas')).toHaveCount(0)
  const target = await page.locator('.continue-card').boundingBox(), panel = await page.locator('.guide-panel').boundingBox()
  expect(panel!.x + panel!.width <= target!.x || panel!.x >= target!.x + target!.width || panel!.y + panel!.height <= target!.y || panel!.y >= target!.y + target!.height).toBe(true)
  await page.screenshot({ path: '../artifacts/cobalt-desktop-2d-guide.png' })
  await page.getByRole('button', { name: 'Close guide' }).click()
})

test('intro completes on its ten second timeline', async ({ page }) => {
  await page.clock.install()
  await createAccount(page)
  await expect(page.locator('.signin-intro')).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page.locator('.signin-intro')).toHaveClass(/intro-book/)
  await expect(page.locator('.signin-intro .student-guide-2d')).toHaveAttribute('data-pose', 'wave')
  await page.screenshot({ path: '../artifacts/cobalt-intro-book.png' })
  await page.clock.runFor(3100)
  await expect(page.locator('.signin-intro')).toHaveClass(/intro-cards/)
  await expect(page.locator('.signin-intro .student-guide-2d')).toHaveAttribute('data-pose', 'point')
  await page.screenshot({ path: '../artifacts/cobalt-intro-cards.png' })
  await page.clock.runFor(3100)
  await expect(page.locator('.signin-intro')).toHaveClass(/intro-settle/)
  await expect(page.locator('.signin-intro .student-guide-2d')).toHaveAttribute('data-pose', 'success')
  await page.clock.runFor(3000)
  await expect(page.locator('.signin-intro')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
})

test('late progress initialization cannot reopen a skipped guide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let first = true
  await page.route('**/api/onboarding', async route => {
    if (route.request().method() !== 'GET' || !first) return route.continue()
    first = false
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  await createAccount(page)
  await page.getByRole('button', { name: 'Help and study guide' }).click()
  const saved = page.waitForResponse(async response => response.url().endsWith('/api/onboarding') && response.request().method() === 'PATCH' && (await response.json()).dashboard?.status === 'skipped')
  await page.getByRole('dialog').getByRole('button', { name: 'Skip tour', exact: true }).click()
  await saved
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/onboarding') && response.request().method() === 'GET')
  release()
  await (await loaded).finished()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(page.locator('.guide-invitation')).toHaveCount(0)
})

test('an older save response cannot undo a newer Skip action', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createAccount(page)
  await expect(page.locator('.guide-invitation')).toBeVisible()
  let releaseFirst!: () => void, releaseLast!: () => void, started!: () => void, reachedLast!: () => void
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
  const lastGate = new Promise<void>(resolve => { releaseLast = resolve })
  const firstStarted = new Promise<void>(resolve => { started = resolve })
  const lastStarted = new Promise<void>(resolve => { reachedLast = resolve })
  await page.route('**/api/onboarding', async route => {
    if (route.request().method() !== 'PATCH') return route.continue()
    if (route.request().postDataJSON().status === 'in_progress') {
      const response = await route.fetch(); started(); await firstGate; await route.fulfill({ response })
    } else { reachedLast(); await lastGate; await route.continue() }
  })
  await page.getByRole('button', { name: 'Show me around' }).click()
  await firstStarted
  await page.getByRole('dialog').getByRole('button', { name: 'Skip tour', exact: true }).click()
  releaseFirst()
  await lastStarted
  try {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('.guide-invitation')).toHaveCount(0)
  } finally { releaseLast() }
})

test('delayed 3D loading joins the current intro phase', async ({ page }) => {
  await page.clock.install()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/assets/taskScene-*.js', async route => { await gate; await route.continue() })
  await createAccount(page)
  await expect(page.locator('.signin-intro')).toBeVisible()
  await page.clock.runFor(4400)
  await expect(page.locator('.signin-intro')).toHaveClass(/intro-cards/)
  await expect(page.locator('.signin-intro .student-guide-2d')).toHaveAttribute('data-pose', 'point')
  release()
  await expect(page.locator('.signin-intro canvas')).toHaveAttribute('data-intro-phase', 'cards')
  await expect(page.locator('.signin-intro .student-guide-2d')).toHaveAttribute('data-pose', 'point')
  await page.getByRole('button', { name: 'Skip Intro' }).click()
})

test('session expiry cancels the intro and failed login does not replay it', async ({ page }) => {
  const email = await createAccount(page)
  await expect(page.locator('.signin-intro')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('asklearn-session-expired')))
  await expect(page.locator('.signin-intro')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.auth-error')).toBeVisible()
  await expect(page.locator('.signin-intro')).toHaveCount(0)
})

test('guide save failure is recoverable and does not block studying', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createAccount(page)
  await expect(page.locator('.guide-invitation')).toBeVisible()
  await page.route('**/api/onboarding', async route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Try again"}' }) : route.continue())
  await page.locator('.guide-invitation').getByRole('button', { name: 'Skip tour' }).click()
  await expect(page.getByRole('alert')).toContainText('Guide progress could not be saved')
  await expect(page.getByRole('link', { name: 'My library', exact: true })).toBeEnabled()
  await page.unroute('**/api/onboarding')
  const saved = page.waitForResponse(response => response.url().endsWith('/api/onboarding') && response.request().method() === 'PATCH' && response.status() === 200)
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await saved
  await page.reload()
  await expect(page.getByRole('button', { name: 'Help and study guide' })).toBeVisible()
  await expect(page.locator('.guide-invitation')).toHaveCount(0)
})

test('account tour highlights steps, skips safely and replays with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createAccount(page)
  await expect(page.locator('.signin-intro')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expect(page.getByRole('dialog')).toContainText('Pick up where you left off')
  await expect(page.locator('.guide-spotlight')).toBeVisible()
  await expect(page.locator('.guide-dialog canvas')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Your learning stays with you')
  await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Pick up where you left off')
  const skipped = page.waitForResponse(async response => response.url().endsWith('/api/onboarding') && response.request().method() === 'PATCH' && (await response.json()).dashboard?.status === 'skipped')
  await page.keyboard.press('Escape')
  await expect(page.locator('.guide-dialog')).toHaveCount(0)
  await skipped
  await page.reload()
  await expect(page.getByRole('button', { name: 'Help and study guide' })).toBeVisible()
  await expect(page.locator('.guide-invitation')).toHaveCount(0)
  await page.getByRole('button', { name: 'Help and study guide' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('link', { name: 'My library', exact: true }).click()
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expect(page.getByRole('dialog')).toContainText('Start with a study material')
  await expect(page.locator('.guide-dialog .student-guide-2d')).toHaveAttribute('data-pose', 'upload')
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.guide-dialog .student-guide-2d')).toHaveAttribute('data-pose', 'think')
  await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Open your study space')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.locator('.document-card')).toHaveCount(0)
})

test('mobile workspace guide handles empty materials, graphic failure and focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: any, ...args: any[]) { return String(type).includes('webgl') ? null : original.apply(this, [type, ...args] as any) } as any
  })
  await createAccount(page)
  await page.getByRole('button', { name: 'Skip Intro' }).click()
  await page.locator('.guide-invitation').getByRole('button', { name: 'Skip tour' }).click()
  await page.getByRole('link', { name: 'Workspace', exact: true }).click()
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expect(page.locator('.guide-dialog .student-guide-2d')).toHaveAttribute('data-pose', 'read')
  await expect(page.locator('.guide-dialog canvas')).toHaveCount(0)
  await expect(page.locator('.workspace-sidebar')).toHaveClass(/guide-open/)
  await page.screenshot({ path: '../artifacts/cobalt-mobile-guide.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('.guide-dialog'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.workspace-sidebar')).not.toHaveClass(/guide-open/)
  await expect(page.getByRole('button', { name: 'Help and study guide' })).toBeFocused()
})
