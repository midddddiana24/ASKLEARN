import { expect, type Page } from '@playwright/test'

/** Existing workflow tests opt out of the new presentation and tutorials. */
export async function settleEntry(page: Page) {
  await page.waitForURL('**/dashboard')
  const skip = page.getByRole('button', { name: 'Skip Intro' })
  if (await skip.isVisible()) await skip.click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  await page.evaluate(async () => {
    const me = await (await fetch('/api/auth/me')).json()
    for (const section of ['dashboard', 'library', 'workspace']) {
      const response = await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf }, body: JSON.stringify({ section, guide_version: 1, step: 0, status: 'skipped' }) })
      if (!response.ok) throw new Error('Cannot dismiss test walkthrough')
    }
  })
  // Refresh reads server-side preferences, and proves session restoration skips the intro.
  await page.reload()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
}
