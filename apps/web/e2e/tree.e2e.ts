import { sampleFamily } from '@familytree/domain'
import { expect, type Page, test } from '@playwright/test'

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function newTree(page: Page, options: { name?: string; example?: boolean } = {}) {
  await page.goto('/trees')
  await expect(page.getByRole('heading', { name: 'Your families' })).toBeVisible()
  await page.getByRole('button', { name: 'New tree' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(options.name ?? `Family ${unique()}`)
  if (options.example) await dialog.getByText('Start with the example family').click()
  await dialog.getByRole('button', { name: 'Create tree' }).click()
  await expect(page).toHaveURL(/\/t\/[A-Za-z0-9_-]+/)
}

const person = (page: Page, name: string) => page.locator('[data-person]').filter({ hasText: name })

async function expectShown(page: Page, name: string) {
  const card = person(page, name).locator('xpath=ancestor::*[@data-card][1]')
  await expect
    .poll(() => card.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 4000 })
    .toBe(1)
}

async function addFirstPerson(page: Page, firstNames: string, surname: string) {
  await page.getByRole('button', { name: 'Add the first person' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('First names').fill(firstNames)
  await dialog.getByLabel('Surname', { exact: true }).fill(surname)
  await dialog.getByLabel('Born').fill('about 1931')
  await dialog.getByRole('button', { name: 'Add to the tree' }).click()
  await expectShown(page, firstNames)
}

async function addRelative(page: Page, kind: 'Parent' | 'Partner' | 'Child', firstNames: string) {
  await page.locator('[data-add]').click()
  await page.getByRole('menuitem', { name: kind }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('First names').fill(firstNames)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expectShown(page, firstNames)
}

test('a tree keeps people after a reload', async ({ page }) => {
  await newTree(page)
  await addFirstPerson(page, 'Maria', 'Popa')
  await expect(page.locator('[data-person]').first()).toContainText('c. 1931')
  await addRelative(page, 'Partner', 'Ion')
  await addRelative(page, 'Parent', 'Ana')
  await addRelative(page, 'Child', 'Elena')
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Math.min(
            ...[...document.querySelectorAll('[data-edge]')].map((el) =>
              Number(getComputedStyle(el).opacity),
            ),
          ),
        ),
      { timeout: 4000 },
    )
    .toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'Saving' })).toHaveCount(0)
  await page.reload()
  for (const name of ['Maria', 'Ion', 'Ana', 'Elena']) {
    await expect(page.locator('[data-person]').filter({ hasText: name })).toBeVisible()
  }
})

test('a story shows in the panel', async ({ page }) => {
  await newTree(page)
  await addFirstPerson(page, 'Rose', 'Hale')
  await page.locator('[data-person]').filter({ hasText: 'Rose' }).click()
  const panel = page.getByRole('complementary')
  await panel.getByRole('button', { name: 'Edit' }).click()
  await panel.getByLabel('Story').fill('Taught **piano** for 40 years.')
  await panel.getByRole('button', { name: 'Save changes' }).click()
  await expect(panel.locator('strong', { hasText: 'piano' })).toBeVisible()
})

test('a tap opens a person and Show in tree moves the tree', async ({ page }) => {
  await newTree(page, { example: true })
  const thomas = person(page, 'Thomas')
  await expect(thomas).toBeVisible()
  await thomas.click()
  const panel = page.getByRole('complementary')
  await expect(panel).toContainText('Built bridges')
  await expect(thomas).not.toHaveAttribute('aria-current', 'true')
  await panel.getByRole('button', { name: 'Show in tree' }).click()
  await expect(thomas).toHaveAttribute('aria-current', 'true')
  await expect(panel).toContainText('Built bridges')
})

test('Back closes the panel, then goes to the person before', async ({ page }) => {
  await newTree(page, { example: true })
  const daniel = person(page, 'Daniel')
  const thomas = person(page, 'Thomas')
  await expect(daniel).toHaveAttribute('aria-current', 'true')
  await thomas.click()
  const panel = page.getByRole('complementary')
  await panel.getByRole('button', { name: 'Show in tree' }).click()
  await expect(thomas).toHaveAttribute('aria-current', 'true')
  await page.goBack()
  await expect(daniel).toHaveAttribute('aria-current', 'true')
  await expect(panel).toContainText('Built bridges')
  await page.goBack()
  await expect(panel).toHaveCount(0)
  await expect(daniel).toHaveAttribute('aria-current', 'true')
})

test('Home goes to the Home person and closes the panel', async ({ page, isMobile }) => {
  await newTree(page, { example: true })
  await person(page, 'Thomas').click()
  const panel = page.getByRole('complementary')
  await panel.getByRole('button', { name: 'Show in tree' }).click()
  if (isMobile) await panel.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Go to the Home person' }).click()
  await expect(person(page, 'Daniel')).toHaveAttribute('aria-current', 'true')
  await expect(panel).toHaveCount(0)
})

test('the close button closes the panel', async ({ page }) => {
  await newTree(page, { example: true })
  await person(page, 'Thomas').click()
  const panel = page.getByRole('complementary')
  const close = panel.getByRole('button', { name: 'Close' })
  await expect(panel).toContainText('Built bridges')
  const hit = await close.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return (
      document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el
    )
  })
  expect(hit).toBe(true)
  await close.click()
  await expect(panel).toHaveCount(0)
})

test('a tree is stored on the server @dev', async ({ page }) => {
  const name = `Server family ${unique()}`
  await newTree(page, { name })
  await addFirstPerson(page, 'Ana', 'Pop')
  await expect(page.getByRole('status').filter({ hasText: 'Saving' })).toHaveCount(0)
  await expect
    .poll(async () => {
      const trees = (await page.evaluate(() => fetch('/api/trees').then((r) => r.json()))) as {
        name: string
        peopleCount: number
      }[]
      return trees.find((t) => t.name === name)?.peopleCount
    })
    .toBe(1)
  await page.reload()
  await expect(person(page, 'Ana')).toBeVisible()
})

test('trees kept in this browser move to the server', async ({ page }) => {
  const data = sampleFamily()
  const name = `Browser family ${unique()}`
  data.tree.name = name
  await page.goto('/llms.txt')
  await page.evaluate(
    (tree) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('familytree', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('trees')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const tx = request.result.transaction('trees', 'readwrite')
          tx.objectStore('trees').put(tree, tree.tree.id)
          tx.oncomplete = () => {
            request.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    data,
  )
  await page.goto('/trees')
  await expect(page.getByText('Moved 1 tree from this browser to the server')).toBeVisible()
  const row = page.getByRole('button', { name: new RegExp(`^${name} `) })
  await expect(row).toBeVisible()
  const left = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('familytree')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const get = request.result.transaction('trees').objectStore('trees').count()
          get.onsuccess = () => {
            request.result.close()
            resolve(get.result)
          }
        }
      }),
  )
  expect(left).toBe(0)
  await row.click()
  await expect(person(page, 'Daniel')).toBeVisible()
})

test('old tree links still open', async ({ page }) => {
  const name = `Old link ${unique()}`
  await newTree(page, { name })
  const id = new URL(page.url()).pathname.split('/').pop()
  await page.goto(`/t/synced/${id}`)
  await expect(page).toHaveURL(new RegExp(`/t/${id}$`))
  await expect(page.getByRole('banner').getByText(name)).toBeVisible()
  await page.goto('/t/device/abc')
  await expect(page).toHaveURL(/\/trees$/)
})

test('Start my tree on the welcome page makes a tree on the server', async ({ page }) => {
  await page.route('**/api/trees', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback(),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Start my tree' }).click()
  await expect(page.getByRole('button', { name: 'Add the first person' })).toBeVisible()
  const id = new URL(page.url()).pathname.split('/').pop()
  await page.unrouteAll()
  expect(await page.evaluate((path) => fetch(path).then((r) => r.status), `/api/trees/${id}`)).toBe(
    200,
  )
})

test('a clear error shows when the server cannot be reached', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort())
  await page.goto('/trees')
  await expect(page.getByRole('heading', { name: 'Cannot reach the server' })).toBeVisible()
  await page.goto('/t/abc')
  await expect(page.getByRole('heading', { name: 'The tree did not load' })).toBeVisible()
  await expect(page.getByText('Cannot reach the server')).toBeVisible()
})

test('every card and line is visible after the animations @dev', async ({ page }) => {
  await newTree(page, { example: true })
  const opacities = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-card], [data-edge]')].map((el) =>
        Number(getComputedStyle(el).opacity),
      ),
    )
  await expect.poll(async () => Math.min(...(await opacities())), { timeout: 5000 }).toBe(1)
  await person(page, 'Thomas').click()
  await page.getByRole('complementary').getByRole('button', { name: 'Show in tree' }).click()
  await expect(person(page, 'Thomas')).toHaveAttribute('aria-current', 'true')
  await expect.poll(async () => Math.min(...(await opacities())), { timeout: 5000 }).toBe(1)
})
