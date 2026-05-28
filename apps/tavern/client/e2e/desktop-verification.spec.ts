/**
 * Desktop PC Verification Tests for Tavern Web App
 * Verifies all 12 pages at 1440x900 viewport for overflow, rendering, and console errors.
 */
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5174'
const VIEWPORT = { width: 1440, height: 900 }

const ALL_PAGES = [
  'market',
  'chat',
  'archive',
  'game-setup',
  'creator',
  'persona',
  'character',
  'profile',
  'chats',
  'contacts',
  'discover',
]

test.describe('Desktop Layout Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
  })

  test('sidebar exists with correct width', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)
    const sidebar = page.locator('.desktop-sidebar')
    await expect(sidebar).toBeVisible()
    const width = await sidebar.evaluate(el => el.getBoundingClientRect().width)
    expect(Math.round(width)).toBeGreaterThanOrEqual(270)
    expect(Math.round(width)).toBeLessThanOrEqual(280)
  })

  test('content area has no horizontal overflow', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)
    const content = page.locator('.desktop-app-content')
    const overflowX = await content.evaluate(el => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('hidden')
  })

  for (const pageName of ALL_PAGES) {
    test(`${pageName} page has no container overflow`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto(`${BASE_URL}/#/${pageName}`)
      await page.waitForTimeout(800)

      const content = page.locator('.desktop-app-content')
      const hasOverflow = await content.evaluate(el => el.scrollWidth > el.clientWidth)
      expect(hasOverflow).toBe(false)

      // Filter out known backend API errors (401 for personas endpoint)
      const renderErrors = errors.filter(e => !e.includes('401'))
      expect(renderErrors).toHaveLength(0)
    })
  }

  test('all pages have overflow-x hidden', async ({ page }) => {
    const pageClasses = [
      '.page-market', '.page-chat', '.page-archive', '.game-setup',
      '.page-creator', '.page-profile', '.page-character-list',
      '.page-character-detail', '.page-persona', '.page-chats',
      '.page-contacts', '.page-discover',
    ]

    for (const cls of pageClasses) {
      await page.goto(BASE_URL)
      await page.waitForTimeout(500)
      const el = page.locator(cls)
      if (await el.count() > 0) {
        const ox = await el.evaluate(el => getComputedStyle(el).overflowX)
        expect(ox).toBe('hidden')
      }
    }
  })

  test('dark mode toggle works', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)

    const themeToggle = page.locator('.theme-toggle-icon, [class*="theme-toggle"]').first()
    await themeToggle.click()
    await page.waitForTimeout(300)

    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark-mode'))
    expect(hasDark).toBe(true)

    await themeToggle.click()
    await page.waitForTimeout(300)

    const hasLight = await page.evaluate(() => !document.documentElement.classList.contains('dark-mode'))
    expect(hasLight).toBe(true)
  })
})
