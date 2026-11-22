import { settleEntry } from './entry'
import { test, expect } from '@playwright/test'

async function register(page) {
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Jordan')
  await page.getByLabel('Email address').fill(`motion-${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('study-motion-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await settleEntry(page)
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  await page.getByRole('link', { name: 'My library', exact: true }).click()
}

test('opening is skippable, once per tab, and never holds a ready screen', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/health', async route => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Skip animation' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip animation' }).click()
  await expect(page.locator('.opening-panel .task-visual')).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'Your lesson. Understood.' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.opening-panel')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('unavailable WebGL falls back to visible artwork without blocking startup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__webglAttempts', { value: 0, writable: true })
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: any, ...args: any[]) {
      if (String(type).includes('webgl')) { Reflect.set(window, '__webglAttempts', Reflect.get(window, '__webglAttempts') + 1); return null }
      return original.apply(this, [type, ...args] as any)
    } as any
  })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/health', async route => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__webglAttempts'))).toBeGreaterThan(0)
  await expect(page.locator('.opening-panel .task-object')).toHaveAttribute('data-renderer', 'svg')
  await expect(page.locator('.opening-panel .task-artwork')).toBeVisible()
  await page.screenshot({ path: '../artifacts/studio-opening-fallback.png' })
  release()
  await expect(page.locator('.welcome-hero')).toBeVisible()
})

test('3D startup renders when supported and releases its canvas on navigation', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/health', async route => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const supported = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const okay = !!gl; gl?.getExtension('WEBGL_lose_context')?.loseContext(); return okay
  })
  if (supported) {
    await expect(page.locator('.task-object')).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator('canvas')).toHaveCount(1)
    await page.screenshot({ path: '../artifacts/studio-opening-3d.png' })
    await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    await expect(page.locator('.task-object')).toHaveAttribute('data-renderer', 'svg')
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.locator('.task-artwork')).toBeVisible()
  } else await expect(page.locator('.task-artwork')).toBeVisible()
  release()
  await expect(page.locator('.welcome-hero')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('processing and save visuals follow acknowledgements, with static reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await register(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'Unsupported.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('unsupported material') })
  await expect(page.locator('.companion .student-guide-2d')).toHaveAttribute('data-pose', 'error')
  await page.locator('input[type=file]').setInputFiles({ name: 'Motion.txt', mimeType: 'text/plain', buffer: Buffer.from('UPLOAD_DELAY_TEST Photosynthesis converts light energy into chemical energy stored in glucose.') })
  await expect(page.locator('.upload-zone .task-visual')).toHaveAttribute('data-phase', 'processing')
  await expect(page.locator('.companion .student-guide-2d')).toHaveAttribute('data-pose', 'think')
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.locator('.upload-zone .task-visual')).toHaveAttribute('data-phase', 'saved')
  await expect(page.locator('.companion .student-guide-2d')).toHaveAttribute('data-pose', 'success')
  await page.getByLabel('Select Motion.txt').check()
  await page.getByRole('button', { name: /Open workspace/ }).click()
  await expect(page.locator('.companion .student-guide-2d')).toHaveAttribute('data-pose', 'read')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/workspace', async route => { if (route.request().method() === 'PUT') await gate; await route.continue() })
  await page.getByRole('tab', { name: 'Summary', exact: true }).click()
  const visual = page.locator('.workspace-title .save-status .task-visual')
  await expect(visual).toHaveAttribute('data-phase', 'saving')
  await expect(page.locator('.workspace-title .save-status')).not.toContainText('Saved')
  release()
  await expect(visual).toHaveAttribute('data-phase', 'saved')
  await page.unroute('**/api/workspace')
  await page.route('**/api/workspace', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Connection interrupted' }) }) : route.continue())
  await page.getByRole('tab', { name: 'Reviewer', exact: true }).click()
  await expect(visual).toHaveAttribute('data-phase', 'error')
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible()
})
