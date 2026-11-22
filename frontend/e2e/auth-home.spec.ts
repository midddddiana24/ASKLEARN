import { test, expect } from '@playwright/test'

test('sign-in and registration layouts stay readable in both themes at all widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  for (const theme of ['light', 'dark']) {
    await page.goto('/login')
    if (theme === 'dark') await page.getByRole('button', { name: 'Use dark theme' }).click()
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['login', 'register']) {
        await page.goto(`/${route}`)
        await expect(page.getByLabel('Email address')).toBeVisible()
        await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (width <= 900) await expect(page.locator('.auth-mobile-brand .brand')).toBeVisible()
        await page.screenshot({ path: `../artifacts/auth-${route}-${theme}-${width}.png`, fullPage: true })
      }
    }
  }
})

test('password visibility, pending sign-in, and accessible failure recovery preserve entered values', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('student@example.com')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let calls = 0
  await page.route('**/api/auth/login', async route => { calls++; await gate; await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Email or password is incorrect.' }) }) })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  await expect(page.getByLabel('Email address')).toBeDisabled()
  release()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('example-password')
  expect(calls).toBe(1)
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
})

test('leaving sign-in cancels the pending request without a late redirect', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('student@example.com')
  await page.getByLabel('Password', { exact: true }).fill('example-password')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/login', async route => { await gate; await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Late failure' }) }).catch(() => {}) })
  const aborted = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  await page.getByRole('link', { name: 'Back to ASKLearn' }).click()
  await aborted
  release()
  await expect(page.locator('.welcome-hero')).toBeVisible()
  await expect(page.locator('.auth-error')).toHaveCount(0)
})

test('home effects respond to scrolling and reduced-motion changes without blocking content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    Reflect.set(window, '__revealCount', 0)
    const original = Element.prototype.animate
    Element.prototype.animate = function(this: Element, ...args: Parameters<Element['animate']>) {
      if (this.matches('.how-list article, .tour-images figure')) Reflect.set(window, '__revealCount', Reflect.get(window, '__revealCount') + 1)
      return original.apply(this, args)
    }
  })
  await page.goto('/')
  await expect(page.locator('.welcome-hero')).toBeVisible()
  await page.locator('.how-list').scrollIntoViewIfNeeded()
  await expect(page.locator('.public-header')).toHaveClass(/is-scrolled/)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__revealCount'))).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.lesson-stage').evaluate(node => getComputedStyle(node).transform)).not.toBe('none')
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
  await page.screenshot({ path: '../artifacts/home-scroll-effects.png' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.home-scroll-progress')).toBeHidden()
  await expect(page.locator('.lesson-stage')).toHaveCSS('transform', 'none')
  await page.locator('.tour-section').scrollIntoViewIfNeeded()
  await expect(page.locator('.tour-section h2')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: '../artifacts/home-refined.png', fullPage: true })
})
