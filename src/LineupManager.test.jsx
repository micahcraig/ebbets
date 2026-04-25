import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LineupManager from './components/LineupManager.jsx'

// dnd-kit uses pointer events; stub them in happy-dom
if (!global.PointerEvent) {
  global.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePlayer = (id, name = '', position = '', color = '#dc2626') =>
  ({ id, name, position, color })

const defaultLineup = { outfield: '3', manualEH: false }

function renderManager(propOverrides = {}) {
  const players = propOverrides.players ?? [
    makePlayer(1, 'Alice', 'P'),
    makePlayer(2, 'Bob',   'C'),
    makePlayer(3, 'Carol', '1B'),
    makePlayer(4, 'Dave',  ''),
  ]
  const lineup        = propOverrides.lineup   ?? defaultLineup
  const onLineupChange = vi.fn()

  const utils = render(
    <LineupManager
      players={players}
      lineup={lineup}
      onLineupChange={onLineupChange}
      {...propOverrides}
    />,
  )
  return { ...utils, onLineupChange }
}

// ─── Toggle visibility ────────────────────────────────────────────────────────

describe('showTitle prop', () => {
  it('renders the Lineup heading by default', () => {
    renderManager()
    expect(screen.getByRole('heading', { name: 'Lineup' })).toBeInTheDocument()
  })

  it('hides the heading when showTitle=false', () => {
    renderManager({ showTitle: false })
    expect(screen.queryByRole('heading', { name: 'Lineup' })).toBeNull()
  })

  it('omits the header element entirely when showTitle=false and no toggles are enabled', () => {
    const { container } = renderManager({ showTitle: false })
    expect(container.querySelector('header')).toBeNull()
  })

  it('keeps the header when showTitle=false but a toggle is enabled', () => {
    const { container } = renderManager({ showTitle: false, showOutfieldToggle: true })
    expect(container.querySelector('header')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Lineup' })).toBeNull()
  })
})

describe('toggle prop visibility', () => {
  it('hides controls bar when no toggle props are passed', () => {
    renderManager()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('List')).toBeNull()
    expect(screen.queryByText('Field')).toBeNull()
  })

  it('shows List/Field buttons when showViewToggle=true', () => {
    renderManager({ showViewToggle: true })
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Field' })).toBeInTheDocument()
  })

  it('does not show List/Field buttons when showViewToggle is absent', () => {
    renderManager({ showOutfieldToggle: true })
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull()
  })

  it('shows 4 Outfielders toggle when showOutfieldToggle=true', () => {
    renderManager({ showOutfieldToggle: true })
    expect(screen.getByLabelText(/4 outfielders/i)).toBeInTheDocument()
  })

  it('shows Extra Hitter toggle when showEHToggle=true', () => {
    renderManager({ showEHToggle: true })
    expect(screen.getByLabelText(/extra hitter/i)).toBeInTheDocument()
  })

  it('shows all three controls when all toggle props are true', () => {
    renderManager({ showViewToggle: true, showOutfieldToggle: true, showEHToggle: true })
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument()
    expect(screen.getByLabelText(/4 outfielders/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/extra hitter/i)).toBeInTheDocument()
  })
})

// ─── Player rendering ─────────────────────────────────────────────────────────

describe('player rendering', () => {
  it('renders all players in batting order', () => {
    renderManager()
    const inputs = screen.getAllByPlaceholderText('Player name')
    expect(inputs).toHaveLength(4)
    expect(inputs[0]).toHaveValue('Alice')
    expect(inputs[1]).toHaveValue('Bob')
    expect(inputs[2]).toHaveValue('Carol')
    expect(inputs[3]).toHaveValue('Dave')
  })

  it('shows batting order numbers', () => {
    renderManager()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows position values in position selects', () => {
    renderManager()
    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveValue('P')
    expect(selects[1]).toHaveValue('C')
    expect(selects[3]).toHaveValue('')
  })
})

// ─── Name editing ─────────────────────────────────────────────────────────────

describe('name editing', () => {
  it('calls onLineupChange when a name is edited', () => {
    const { onLineupChange } = renderManager()

    const inputs = screen.getAllByPlaceholderText('Player name')
    fireEvent.change(inputs[3], { target: { value: 'Erin' } })

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { players } = onLineupChange.mock.calls[0][0]
    expect(players.find(p => p.id === 4).name).toBe('Erin')
  })
})

// ─── Position dropdown ────────────────────────────────────────────────────────

describe('position dropdown', () => {
  it('calls onLineupChange with new position when dropdown changes', () => {
    const { onLineupChange } = renderManager()
    const selects = screen.getAllByRole('combobox')

    // Dave (id=4) currently has no position — assign SS
    fireEvent.change(selects[3], { target: { value: 'SS' } })

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { players } = onLineupChange.mock.calls[0][0]
    expect(players.find(p => p.id === 4).position).toBe('SS')
  })

  it('swaps positions when assigning a position already occupied', () => {
    // Alice has P; assign Dave to P — Alice should lose P
    const { onLineupChange } = renderManager()
    const selects = screen.getAllByRole('combobox')

    fireEvent.change(selects[3], { target: { value: 'P' } })

    const { players } = onLineupChange.mock.calls[0][0]
    expect(players.find(p => p.id === 4).position).toBe('P')
    expect(players.find(p => p.id === 1).position).toBe('')  // Alice displaced
  })

  it('includes CF option in 3-outfielder mode', () => {
    renderManager()
    const selects = screen.getAllByRole('combobox')
    const opts = Array.from(selects[0].options).map(o => o.value)
    expect(opts).toContain('CF')
    expect(opts).not.toContain('CL')
    expect(opts).not.toContain('CR')
  })

  it('includes CL/CR but not CF in 4-outfielder mode', () => {
    renderManager({ lineup: { outfield: '4', manualEH: false } })
    const selects = screen.getAllByRole('combobox')
    const opts = Array.from(selects[0].options).map(o => o.value)
    expect(opts).toContain('CL')
    expect(opts).toContain('CR')
    expect(opts).not.toContain('CF')
  })
})

// ─── Add player ───────────────────────────────────────────────────────────────

describe('add player', () => {
  it('calls onLineupChange with one more player when Add Player is clicked', () => {
    const { onLineupChange } = renderManager()
    fireEvent.click(screen.getByRole('button', { name: /add player/i }))

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { players } = onLineupChange.mock.calls[0][0]
    expect(players).toHaveLength(5)
  })
})

// ─── Remove confirm flow ──────────────────────────────────────────────────────

describe('remove confirm flow', () => {
  it('shows Remove? confirmation after clicking ✕', () => {
    renderManager()
    const removeBtns = screen.getAllByTitle('Remove')
    fireEvent.click(removeBtns[0])

    expect(screen.getByText('Remove?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('cancels remove when No is clicked', () => {
    renderManager()
    const removeBtns = screen.getAllByTitle('Remove')
    fireEvent.click(removeBtns[0])
    fireEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(screen.queryByText('Remove?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull()
  })

  it('calls onLineupChange with player removed when Yes is clicked', () => {
    const { onLineupChange } = renderManager()
    const removeBtns = screen.getAllByTitle('Remove')
    fireEvent.click(removeBtns[0])  // Alice's remove button
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { players } = onLineupChange.mock.calls[0][0]
    expect(players.find(p => p.id === 1)).toBeUndefined()  // Alice gone
    expect(players).toHaveLength(3)
  })
})

// ─── Auto-config ──────────────────────────────────────────────────────────────

describe('auto-config', () => {
  it('forces 4OF and shows auto badge when roster has 10 players', () => {
    const tenPlayers = Array.from({ length: 10 }, (_, i) =>
      makePlayer(i + 1, `P${i + 1}`, ''))
    renderManager({
      players: tenPlayers,
      lineup: { outfield: '3', manualEH: false },
      showOutfieldToggle: true,
    })
    // CL and CR should appear in the dropdown options (4OF mode)
    const selects = screen.getAllByRole('combobox')
    const opts = Array.from(selects[0].options).map(o => o.value)
    expect(opts).toContain('CL')

    // The auto badge should be visible
    expect(screen.getByText('auto')).toBeInTheDocument()
  })

  it('adds EH slot when 11 players are present', () => {
    const elevenPlayers = Array.from({ length: 11 }, (_, i) =>
      makePlayer(i + 1, `P${i + 1}`, ''))
    renderManager({ players: elevenPlayers, lineup: defaultLineup })

    // EH should appear in dropdown options
    const selects = screen.getAllByRole('combobox')
    const opts = Array.from(selects[0].options).map(o => o.value)
    expect(opts).toContain('EH')
  })

  it('adds manual EH slot when manualEH=true', () => {
    renderManager({ lineup: { outfield: '3', manualEH: true } })
    const selects = screen.getAllByRole('combobox')
    const opts = Array.from(selects[0].options).map(o => o.value)
    expect(opts).toContain('EH')
  })
})

// ─── Position strip ───────────────────────────────────────────────────────────

describe('position strip', () => {
  it('renders position chips for all active positions', () => {
    renderManager()
    const strip = screen.getByTestId('position-strip')
    expect(within(strip).getByText('CF')).toBeInTheDocument()
    expect(within(strip).getByText('SS')).toBeInTheDocument()
    expect(within(strip).getByText('P')).toBeInTheDocument()
  })

  it('renders CL/CR chips in 4OF mode', () => {
    renderManager({ lineup: { outfield: '4', manualEH: false } })
    const strip = screen.getByTestId('position-strip')
    expect(within(strip).getByText('CL')).toBeInTheDocument()
    expect(within(strip).getByText('CR')).toBeInTheDocument()
    expect(within(strip).queryByText('CF')).toBeNull()
  })
})

// ─── View toggle behavior ─────────────────────────────────────────────────────

describe('view toggle', () => {
  it('List button is active by default', () => {
    renderManager({ showViewToggle: true })
    // The List button should have the active class styling
    const listBtn = screen.getByRole('button', { name: 'List' })
    expect(listBtn.className).toMatch(/tabActive/)
  })

  it('Field button becomes active after clicking Field', () => {
    renderManager({ showViewToggle: true })
    fireEvent.click(screen.getByRole('button', { name: 'Field' }))
    const fieldBtn = screen.getByRole('button', { name: 'Field' })
    expect(fieldBtn.className).toMatch(/tabActive/)
  })

  it('initialView=field starts on field tab', () => {
    renderManager({ showViewToggle: true, initialView: 'field' })
    const fieldBtn = screen.getByRole('button', { name: 'Field' })
    expect(fieldBtn.className).toMatch(/tabActive/)
  })
})

// ─── Outfield toggle ──────────────────────────────────────────────────────────

describe('outfield toggle', () => {
  it('switches from 3OF to 4OF when toggled', () => {
    const { onLineupChange } = renderManager({
      showOutfieldToggle: true,
      lineup: { outfield: '3', manualEH: false },
    })
    const checkbox = screen.getByLabelText(/4 outfielders/i)
    fireEvent.click(checkbox)

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { lineup } = onLineupChange.mock.calls[0][0]
    expect(lineup.outfield).toBe('4')
  })

  it('switches from 4OF to 3OF when toggled', () => {
    const { onLineupChange } = renderManager({
      showOutfieldToggle: true,
      lineup: { outfield: '4', manualEH: false },
    })
    const checkbox = screen.getByLabelText(/4 outfielders/i)
    fireEvent.click(checkbox)

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { lineup } = onLineupChange.mock.calls[0][0]
    expect(lineup.outfield).toBe('3')
  })

  it('migrates CF player to CL when switching to 4OF', () => {
    const players = [
      makePlayer(1, 'Alice', 'CF'),
      makePlayer(2, 'Bob',   ''),
    ]
    const { onLineupChange } = renderManager({
      players,
      showOutfieldToggle: true,
      lineup: { outfield: '3', manualEH: false },
    })
    fireEvent.click(screen.getByLabelText(/4 outfielders/i))

    const { players: result } = onLineupChange.mock.calls[0][0]
    expect(result.find(p => p.id === 1).position).toBe('CL')
  })

  it('does not allow toggle when auto-forced at 10 players', () => {
    const tenPlayers = Array.from({ length: 10 }, (_, i) =>
      makePlayer(i + 1, `P${i + 1}`, ''))
    const { onLineupChange } = renderManager({
      players: tenPlayers,
      showOutfieldToggle: true,
      lineup: { outfield: '3', manualEH: false },
    })
    const checkbox = screen.getByLabelText(/4 outfielders/i)
    fireEvent.click(checkbox)

    // toggleOutfield returns early when autoOutfield — no call
    expect(onLineupChange).not.toHaveBeenCalled()
  })
})

// ─── EH toggle ────────────────────────────────────────────────────────────────

describe('EH toggle', () => {
  it('enables EH when toggled on', () => {
    const { onLineupChange } = renderManager({
      showEHToggle: true,
      lineup: { outfield: '3', manualEH: false },
    })
    fireEvent.click(screen.getByLabelText(/extra hitter/i))

    expect(onLineupChange).toHaveBeenCalledOnce()
    const { lineup } = onLineupChange.mock.calls[0][0]
    expect(lineup.manualEH).toBe(true)
  })

  it('disables EH and clears EH positions when toggled off', () => {
    const players = [
      makePlayer(1, 'Alice', 'EH'),
      makePlayer(2, 'Bob',   'P'),
    ]
    const { onLineupChange } = renderManager({
      players,
      showEHToggle: true,
      lineup: { outfield: '3', manualEH: true },
    })
    fireEvent.click(screen.getByLabelText(/extra hitter/i))

    const { players: result, lineup } = onLineupChange.mock.calls[0][0]
    expect(lineup.manualEH).toBe(false)
    expect(result.find(p => p.id === 1).position).toBe('')
  })
})
