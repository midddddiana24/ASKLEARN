import { settleEntry } from './entry'
import { test, expect } from '@playwright/test'

test('modern study layouts retain readable typography across themes and viewport sizes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/register')
  await page.getByLabel('Your name').fill('Sam')
  await page.getByLabel('Email address').fill(`retro-${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('retro-study-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await settleEntry(page)
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Use dark theme' }).click()
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['dashboard', 'library', 'workspace', 'profile']) {
        await page.goto(`/${route}`)
        await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
        await expect(page.locator('main')).toBeVisible()
        await expect(page.locator('.loading, .history-loading')).toHaveCount(0)
        await page.evaluate(() => document.fonts.ready)
        await expect.poll(() => page.locator('.brand-symbol img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
        expect(await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).toContain('DM Sans Variable')
        expect(await page.locator('h1').first().evaluate(node => getComputedStyle(node).fontFamily)).toContain('Manrope Variable')
        expect(await page.evaluate(() => document.fonts.check('16px \"DM Sans Variable\"'))).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const dock = page.getByRole('navigation', { name: 'Main navigation' })
        const rect = await dock.boundingBox()
        expect(rect!.height).toBeLessThan(90)
        expect(rect!.y).toBeGreaterThan(750)
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(900)
        await expect(dock.locator('[aria-current="page"]')).toHaveCount(1)
        for (const artwork of await page.locator('main img[src^=\"/brand/\"]').all()) {
          if (!(await artwork.isVisible())) continue
          await artwork.scrollIntoViewIfNeeded()
          await expect.poll(() => artwork.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
        }
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: `../artifacts/modern-${route}-${theme}-${width}.png`, fullPage: true })
      }
    }
  }
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('button', { name: 'Minimize companion help' }).click()
  await expect(page.getByText('Bring a lesson. Ask a question. Find your next connection.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Expand companion help' }).click()
  await expect(page.getByText('Bring a lesson. Ask a question. Find your next connection.')).toBeVisible()
})
