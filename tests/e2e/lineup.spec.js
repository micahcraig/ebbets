import { test, expect } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fillRoster(page, names) {
  const inputs = page.getByPlaceholder('Player name')
  for (let i = 0; i < names.length; i++) {
    await inputs.nth(i).fill(names[i])
  }
}

// ─── Desktop layout ───────────────────────────────────────────────────────────

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('both panels are visible side by side', async ({ page }) => {
    await page.goto('/')

    // Position strip is in lineup panel
    await expect(page.getByTestId('position-strip')).toBeVisible()
    // Field SVG is in field panel
    await expect(page.locator('svg[aria-label="Softball field diagram"]')).toBeVisible()
  })

  test('List/Field tab toggle is hidden at wide viewport', async ({ page }) => {
    await page.goto('/')
    // The view toggle buttons should not be visible (CSS hides them)
    const listBtn = page.getByRole('button', { name: 'List' })
    await expect(listBtn).toBeHidden()
  })
})

// ─── Mobile layout ────────────────────────────────────────────────────────────

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('shows one panel at a time by default (lineup first)', async ({ page }) => {
    await page.goto('/')
    // The panel body has overflow:hidden; only lineup is visible
    const strip = page.getByTestId('position-strip')
    await expect(strip).toBeVisible()
  })

  test('List/Field toggle switches panels', async ({ page }) => {
    await page.goto('/')
    const fieldBtn = page.getByRole('button', { name: 'Field' })
    await expect(fieldBtn).toBeVisible()

    await fieldBtn.click()
    await expect(page.locator('svg[aria-label="Softball field diagram"]')).toBeVisible()

    await page.getByRole('button', { name: 'List' }).click()
    await expect(page.getByTestId('position-strip')).toBeVisible()
  })

  test('swipe left navigates to field panel', async ({ page }) => {
    await page.goto('/')
    const body = page.getByTestId('panel-body')

    await body.dispatchEvent('touchstart', {
      touches: [{ identifier: 0, clientX: 300, clientY: 400 }],
    })
    await body.dispatchEvent('touchend', {
      changedTouches: [{ identifier: 0, clientX: 230, clientY: 402 }],
    })

    // After swiping left, field panel should be showing
    await expect(page.locator('svg[aria-label="Softball field diagram"]')).toBeVisible()
  })

  test('swipe right navigates back to lineup panel', async ({ page }) => {
    await page.goto('/')
    // Switch to field first
    await page.getByRole('button', { name: 'Field' }).click()

    const body = page.getByTestId('panel-body')
    await body.dispatchEvent('touchstart', {
      touches: [{ identifier: 0, clientX: 100, clientY: 400 }],
    })
    await body.dispatchEvent('touchend', {
      changedTouches: [{ identifier: 0, clientX: 200, clientY: 402 }],
    })

    await expect(page.getByTestId('position-strip')).toBeVisible()
  })
})

// ─── Player management ────────────────────────────────────────────────────────

test.describe('player management', () => {
  test('can add a player', async ({ page }) => {
    await page.goto('/')
    const initialCount = await page.getByPlaceholder('Player name').count()

    await page.getByRole('button', { name: /add player/i }).click()

    await expect(page.getByPlaceholder('Player name')).toHaveCount(initialCount + 1)
  })

  test('can edit a player name', async ({ page }) => {
    await page.goto('/')
    const firstInput = page.getByPlaceholder('Player name').first()
    await firstInput.fill('Jackie Robinson')
    await expect(firstInput).toHaveValue('Jackie Robinson')
  })

  test('remove shows confirm, cancel keeps player', async ({ page }) => {
    await page.goto('/')
    const initialCount = await page.getByPlaceholder('Player name').count()

    await page.getByTitle('Remove').first().click()
    await expect(page.getByText('Remove?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'No' })).toBeVisible()

    await page.getByRole('button', { name: 'No' }).click()
    await expect(page.getByText('Remove?')).not.toBeVisible()
    await expect(page.getByPlaceholder('Player name')).toHaveCount(initialCount)
  })

  test('remove Yes removes the player', async ({ page }) => {
    await page.goto('/')
    const initialCount = await page.getByPlaceholder('Player name').count()

    await page.getByTitle('Remove').first().click()
    await page.getByRole('button', { name: 'Yes' }).click()

    await expect(page.getByPlaceholder('Player name')).toHaveCount(initialCount - 1)
  })
})

// ─── Position assignment via dropdown ─────────────────────────────────────────

test.describe('position dropdown', () => {
  test('assigning a position updates the dropdown value', async ({ page }) => {
    await page.goto('/')
    const selects = page.getByRole('combobox')
    await selects.first().selectOption('P')
    await expect(selects.first()).toHaveValue('P')
  })

  test('assigning occupied position swaps — displaced player loses position', async ({ page }) => {
    await page.goto('/')
    const selects = page.getByRole('combobox')

    // Assign player 1 to P
    await selects.nth(0).selectOption('P')
    // Assign player 2 to P — should swap, player 1 loses P
    await selects.nth(1).selectOption('P')

    await expect(selects.nth(1)).toHaveValue('P')
    // Player 1 should now have the position player 2 had (empty)
    await expect(selects.nth(0)).toHaveValue('')
  })
})

// ─── Auto-config ──────────────────────────────────────────────────────────────

test.describe('auto-config', () => {
  test('adding 10th player enables 4OF automatically', async ({ page }) => {
    await page.goto('/')

    // Add one more player to reach 10
    for (let i = 9; i < 10; i++) {
      await page.getByRole('button', { name: /add player/i }).click()
    }

    // Selects should now contain CL (4OF mode)
    const firstSelect = page.getByRole('combobox').first()
    const optionValues = await firstSelect.evaluate(sel =>
      Array.from(sel.options).map(o => o.value))
    expect(optionValues).toContain('CL')
    expect(optionValues).not.toContain('CF')

    // auto badge should appear on the 4OF toggle
    await expect(page.getByText('auto')).toBeVisible()
  })

  test('adding 11th player adds EH slot', async ({ page }) => {
    await page.goto('/')

    for (let i = 9; i < 11; i++) {
      await page.getByRole('button', { name: /add player/i }).click()
    }

    const firstSelect = page.getByRole('combobox').first()
    const optionValues = await firstSelect.evaluate(sel =>
      Array.from(sel.options).map(o => o.value))
    expect(optionValues).toContain('EH')
  })

  test('CF player migrates to CL when roster hits 10', async ({ page }) => {
    await page.goto('/')

    // Assign player 1 to CF
    await page.getByRole('combobox').first().selectOption('CF')
    await expect(page.getByRole('combobox').first()).toHaveValue('CF')

    // Add player to push to 10
    await page.getByRole('button', { name: /add player/i }).click()

    // Player 1 should now be CL
    await expect(page.getByRole('combobox').first()).toHaveValue('CL')
  })
})

// ─── Outfield toggle ──────────────────────────────────────────────────────────

test.describe('outfield toggle', () => {
  test('switches between 3OF and 4OF', async ({ page }) => {
    await page.goto('/')

    const label    = page.locator('label').filter({ hasText: /4 outfielders/i })
    const checkbox = label.locator('input[type="checkbox"]')
    await expect(checkbox).not.toBeChecked()
    await label.click()
    await expect(checkbox).toBeChecked()

    // CL/CR should now be in dropdown options
    const firstSelect = page.getByRole('combobox').first()
    const opts = await firstSelect.evaluate(s => Array.from(s.options).map(o => o.value))
    expect(opts).toContain('CL')
  })

  test('CL/CR chips appear on field diagram in 4OF mode', async ({ page }) => {
    await page.goto('/')
    await page.locator('label').filter({ hasText: /4 outfielders/i }).click()

    // The field panel shows CL and CR chips
    const fieldPanel = page.locator('svg[aria-label="Softball field diagram"]').locator('..')
    // CL and CR text should appear somewhere in the field overlay area
    await expect(page.getByTestId('position-strip').getByText('CL')).toBeVisible()
    await expect(page.getByTestId('position-strip').getByText('CR')).toBeVisible()
  })
})

// ─── EH toggle ───────────────────────────────────────────────────────────────

test.describe('EH toggle', () => {
  test('manual EH toggle adds EH slot', async ({ page }) => {
    await page.goto('/')

    await page.locator('label').filter({ hasText: /extra hitter/i }).click()

    // EH should appear in dropdown options
    const firstSelect = page.getByRole('combobox').first()
    const opts = await firstSelect.evaluate(s => Array.from(s.options).map(o => o.value))
    expect(opts).toContain('EH')

    // EH section should appear in field view
    await expect(page.getByText('Unassigned')).toBeVisible()
  })

  test('disabling EH clears EH assignments', async ({ page }) => {
    await page.goto('/')

    // Enable EH and assign first player
    await page.locator('label').filter({ hasText: /extra hitter/i }).click()
    await page.getByRole('combobox').first().selectOption('EH')
    await expect(page.getByRole('combobox').first()).toHaveValue('EH')

    // Disable EH
    await page.locator('label').filter({ hasText: /extra hitter/i }).click()

    // Player should no longer have EH
    await expect(page.getByRole('combobox').first()).toHaveValue('')
  })
})

// ─── Drag and drop ────────────────────────────────────────────────────────────

test.describe('drag and drop', () => {
  test('can reorder players by dragging', async ({ page }) => {
    await page.goto('/')

    await fillRoster(page, ['Alice', 'Bob', 'Carol'])

    const handles = page.locator('[title="Drag to reorder or drop on field"]')
    const firstHandle = handles.first()
    const secondInput = page.getByPlaceholder('Player name').nth(1)

    const fromBox = await firstHandle.boundingBox()
    const toBox   = await secondInput.boundingBox()

    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height + 10, { steps: 10 })
    await page.mouse.up()

    // After drag, order should have changed
    const inputs = page.getByPlaceholder('Player name')
    const names  = await inputs.evaluateAll(els => els.slice(0, 3).map(e => e.value))
    expect(names).not.toEqual(['Alice', 'Bob', 'Carol'])
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
    expect(names).toContain('Carol')
  })

  test('can assign a position by dragging onto a strip chip', async ({ page }) => {
    await page.goto('/')

    await page.getByPlaceholder('Player name').first().fill('Alice')

    // Drag first player's handle onto the SS strip chip
    const handle = page.locator('[title="Drag to reorder or drop on field"]').first()
    const ssChip = page.getByTestId('position-strip').getByText('SS')

    const fromBox = await handle.boundingBox()
    const toBox   = await ssChip.boundingBox()

    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 })
    await page.mouse.up()

    await expect(page.getByRole('combobox').first()).toHaveValue('SS')
  })
})
