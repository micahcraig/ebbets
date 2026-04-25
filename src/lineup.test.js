import { describe, it, expect } from 'vitest'
import {
  applyPlayerUpdate,
  reorderPlayers,
  swapFieldPositions,
  assignToPosition,
  cleanAfterCountChange,
  addPlayer,
  removePlayer,
  applyOutfieldToggle,
  applyEHToggle,
} from './lineup.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const p = (id, position = '') => ({ id, name: `Player ${id}`, position, color: '#000' })

// ─── applyPlayerUpdate ────────────────────────────────────────────────────────

describe('applyPlayerUpdate', () => {
  it('updates a non-position field directly', () => {
    const players = [p(1), p(2)]
    const result = applyPlayerUpdate(players, 1, 'name', 'Alice')
    expect(result.find(x => x.id === 1).name).toBe('Alice')
    expect(result.find(x => x.id === 2).name).toBe('Player 2')
  })

  it('clearing a position just clears it', () => {
    const players = [p(1, 'P'), p(2)]
    const result = applyPlayerUpdate(players, 1, 'position', '')
    expect(result.find(x => x.id === 1).position).toBe('')
  })

  it('assigns an unoccupied position', () => {
    const players = [p(1), p(2)]
    const result = applyPlayerUpdate(players, 1, 'position', 'SS')
    expect(result.find(x => x.id === 1).position).toBe('SS')
    expect(result.find(x => x.id === 2).position).toBe('')
  })

  it('swaps when assigning an occupied position', () => {
    const players = [p(1, 'P'), p(2, '')]
    const result = applyPlayerUpdate(players, 2, 'position', 'P')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 1).position).toBe('')
  })

  it('swaps both positions when both players are assigned', () => {
    const players = [p(1, 'P'), p(2, 'SS')]
    const result = applyPlayerUpdate(players, 2, 'position', 'P')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 1).position).toBe('SS')
  })

  it('does not affect other players', () => {
    const players = [p(1, 'P'), p(2, 'C'), p(3, 'SS')]
    const result = applyPlayerUpdate(players, 3, 'position', 'P')
    expect(result.find(x => x.id === 3).position).toBe('P')
    expect(result.find(x => x.id === 1).position).toBe('SS')
    expect(result.find(x => x.id === 2).position).toBe('C')
  })
})

// ─── reorderPlayers ───────────────────────────────────────────────────────────

describe('reorderPlayers', () => {
  it('moves a player forward in the order', () => {
    const players = [p(1), p(2), p(3)]
    const result = reorderPlayers(players, 0, 2)
    expect(result.map(x => x.id)).toEqual([2, 3, 1])
  })

  it('moves a player backward in the order', () => {
    const players = [p(1), p(2), p(3)]
    const result = reorderPlayers(players, 2, 0)
    expect(result.map(x => x.id)).toEqual([3, 1, 2])
  })

  it('preserves positions when reordering', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = reorderPlayers(players, 0, 1)
    expect(result[0]).toMatchObject({ id: 2, position: 'C' })
    expect(result[1]).toMatchObject({ id: 1, position: 'P' })
  })
})

// ─── swapFieldPositions ───────────────────────────────────────────────────────

describe('swapFieldPositions', () => {
  it('swaps two occupied positions', () => {
    const players = [p(1, 'P'), p(2, 'C'), p(3, 'SS')]
    const result = swapFieldPositions(players, 'P', 'C')
    expect(result.find(x => x.id === 1).position).toBe('C')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 3).position).toBe('SS')
  })

  it('moves the assigned player when the other position is empty', () => {
    const players = [p(1, 'P'), p(2, '')]
    const result = swapFieldPositions(players, 'P', 'C')
    expect(result.find(x => x.id === 1).position).toBe('C')
    expect(result.find(x => x.id === 2).position).toBe('')
  })
})

// ─── assignToPosition ─────────────────────────────────────────────────────────

describe('assignToPosition', () => {
  it('assigns player to an empty position', () => {
    const players = [p(1, ''), p(2, 'C')]
    const result = assignToPosition(players, 1, 'P')
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 2).position).toBe('C')
  })

  it('displaces the existing occupant to the dragged player\'s old position', () => {
    const players = [p(1, 'P'), p(2, 'SS')]
    const result = assignToPosition(players, 2, 'P')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 1).position).toBe('SS')
  })

  it('unassigns the occupant when dragged player was unassigned', () => {
    const players = [p(1, 'P'), p(2, '')]
    const result = assignToPosition(players, 2, 'P')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 1).position).toBe('')
  })
})

// ─── cleanAfterCountChange ────────────────────────────────────────────────────

describe('cleanAfterCountChange', () => {
  it('migrates CF to CL when roster reaches 10 (auto 4OF)', () => {
    const players = [...Array(9).keys()].map(i => p(i + 1)).concat([p(10)])
    players[7].position = 'CF'
    const result = cleanAfterCountChange(players, 10, '3', false)
    expect(result.find(x => x.id === 8).position).toBe('CL')
  })

  it('migrates CL to CF and clears CR when both are assigned on drop to 3OF', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[6].position = 'CL'
    players[7].position = 'CR'
    const result = cleanAfterCountChange(players, 9, '3', false)
    expect(result.find(x => x.id === 7).position).toBe('CF')
    expect(result.find(x => x.id === 8).position).toBe('')
  })

  it('migrates CL to CF when only CL is assigned on drop to 3OF', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[6].position = 'CL'
    const result = cleanAfterCountChange(players, 9, '3', false)
    expect(result.find(x => x.id === 7).position).toBe('CF')
  })

  it('migrates CR to CF when only CR is assigned on drop to 3OF', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[7].position = 'CR'
    const result = cleanAfterCountChange(players, 9, '3', false)
    expect(result.find(x => x.id === 8).position).toBe('CF')
  })

  it('preserves CL and CR when outfield is manually set to 4', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[6].position = 'CL'
    const result = cleanAfterCountChange(players, 9, '4', false)
    expect(result.find(x => x.id === 7).position).toBe('CL')
  })

  it('clears EH when dropping below the auto-EH threshold with manualEH off', () => {
    const players = Array(10).fill(null).map((_, i) => p(i + 1))
    players[9].position = 'EH'
    // Removing a player so count becomes 9 and manualEH is false
    const result = cleanAfterCountChange(players.slice(0, 9), 9, '3', false)
    expect(result.every(x => x.position !== 'EH')).toBe(true)
  })

  it('keeps EH when manualEH is true and count is 9', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[8].position = 'EH'
    const result = cleanAfterCountChange(players, 9, '3', true)
    expect(result.find(x => x.id === 9).position).toBe('EH')
  })

  it('clears EH2 when count drops from 12 to 11', () => {
    const players = Array(11).fill(null).map((_, i) => p(i + 1))
    players[10].position = 'EH2'
    const result = cleanAfterCountChange(players, 11, '3', false)
    expect(result.find(x => x.id === 11).position).toBe('')
  })

  it('keeps EH and EH2 at count 12', () => {
    const players = Array(12).fill(null).map((_, i) => p(i + 1))
    players[10].position = 'EH'
    players[11].position = 'EH2'
    const result = cleanAfterCountChange(players, 12, '3', false)
    expect(result.find(x => x.id === 11).position).toBe('EH')
    expect(result.find(x => x.id === 12).position).toBe('EH2')
  })
})

// ─── addPlayer / removePlayer ─────────────────────────────────────────────────

describe('addPlayer', () => {
  it('appends the new player', () => {
    const players = [p(1), p(2)]
    const result = addPlayer(players, p(3), '3', false)
    expect(result).toHaveLength(3)
    expect(result[2].id).toBe(3)
  })

  it('migrates CF to CL when 10th player is added', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[7].position = 'CF'
    const result = addPlayer(players, p(10), '3', false)
    expect(result).toHaveLength(10)
    expect(result.find(x => x.id === 8).position).toBe('CL')
  })
})

describe('removePlayer', () => {
  it('removes the correct player', () => {
    const players = [p(1), p(2), p(3)]
    const result = removePlayer(players, 2, '3', false)
    expect(result).toHaveLength(2)
    expect(result.find(x => x.id === 2)).toBeUndefined()
  })

  it('migrates CL to CF and clears CR when roster drops to 9', () => {
    const players = Array(10).fill(null).map((_, i) => p(i + 1))
    players[6].position = 'CL'
    players[7].position = 'CR'
    // Remove player 10 → count 9, auto-outfield reverts to '3'
    const result = removePlayer(players, 10, '3', false)
    expect(result.find(x => x.id === 7).position).toBe('CF')
    expect(result.find(x => x.id === 8).position).toBe('')
  })
})

// ─── applyOutfieldToggle ──────────────────────────────────────────────────────

describe('applyOutfieldToggle', () => {
  it('switches from 3 to 4', () => {
    const players = [p(1, 'CF'), p(2, 'LF')]
    const { players: result, outfield } = applyOutfieldToggle(players, '3')
    expect(outfield).toBe('4')
    expect(result.find(x => x.id === 1).position).toBe('CL')
    expect(result.find(x => x.id === 2).position).toBe('LF')
  })

  it('switches 4→3, migrating CL to CF and clearing CR when both assigned', () => {
    const players = [p(1, 'CL'), p(2, 'CR'), p(3, 'LF')]
    const { players: result, outfield } = applyOutfieldToggle(players, '4')
    expect(outfield).toBe('3')
    expect(result.find(x => x.id === 1).position).toBe('CF')
    expect(result.find(x => x.id === 2).position).toBe('')
    expect(result.find(x => x.id === 3).position).toBe('LF')
  })

  it('switches 4→3, migrating CR to CF when only CR is assigned', () => {
    const players = [p(1, ''), p(2, 'CR'), p(3, 'LF')]
    const { players: result } = applyOutfieldToggle(players, '4')
    expect(result.find(x => x.id === 2).position).toBe('CF')
  })

  it('switches 4→3, migrating CL to CF when only CL is assigned', () => {
    const players = [p(1, 'CL'), p(2, ''), p(3, 'LF')]
    const { players: result } = applyOutfieldToggle(players, '4')
    expect(result.find(x => x.id === 1).position).toBe('CF')
    expect(result.find(x => x.id === 2).position).toBe('')
  })

  it('leaves unaffected positions alone when switching to 4', () => {
    const players = [p(1, 'P'), p(2, 'SS')]
    const { players: result } = applyOutfieldToggle(players, '3')
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 2).position).toBe('SS')
  })
})

// ─── applyEHToggle ────────────────────────────────────────────────────────────

describe('applyEHToggle', () => {
  it('enables EH without changing any positions', () => {
    const players = [p(1, 'P'), p(2, '')]
    const { players: result, manualEH } = applyEHToggle(players, false)
    expect(manualEH).toBe(true)
    expect(result).toEqual(players)
  })

  it('disables EH and clears the EH position', () => {
    const players = [p(1, 'P'), p(2, 'EH')]
    const { players: result, manualEH } = applyEHToggle(players, true)
    expect(manualEH).toBe(false)
    expect(result.find(x => x.id === 2).position).toBe('')
  })

  it('does not clear EH2 or other slots when disabling', () => {
    const players = [p(1, 'EH'), p(2, 'EH2')]
    const { players: result } = applyEHToggle(players, true)
    expect(result.find(x => x.id === 1).position).toBe('')
    expect(result.find(x => x.id === 2).position).toBe('EH2')
  })
})

// ─── applyPlayerUpdate edge cases ────────────────────────────────────────────

describe('applyPlayerUpdate — edge cases', () => {
  it('assigning a player to their own current position is a no-op', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = applyPlayerUpdate(players, 1, 'position', 'P')
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 2).position).toBe('C')
  })

  it('clearing a position when another player holds it does not displace that player', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = applyPlayerUpdate(players, 1, 'position', '')
    expect(result.find(x => x.id === 1).position).toBe('')
    expect(result.find(x => x.id === 2).position).toBe('C')
  })

  it('updates non-position fields for a player not in the list gracefully', () => {
    const players = [p(1, 'P')]
    const result = applyPlayerUpdate(players, 99, 'name', 'Ghost')
    expect(result).toEqual(players)
  })

  it('swaps across three players leaving the third unaffected', () => {
    const players = [p(1, 'P'), p(2, 'C'), p(3, 'SS')]
    const result = applyPlayerUpdate(players, 2, 'position', 'P')
    expect(result.find(x => x.id === 1).position).toBe('C')
    expect(result.find(x => x.id === 2).position).toBe('P')
    expect(result.find(x => x.id === 3).position).toBe('SS')
  })
})

// ─── swapFieldPositions edge cases ───────────────────────────────────────────

describe('swapFieldPositions — edge cases', () => {
  it('both positions unoccupied — no change', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = swapFieldPositions(players, 'LF', 'RF')
    expect(result).toEqual(players)
  })

  it('swapping a position with itself is a no-op', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = swapFieldPositions(players, 'P', 'P')
    expect(result.find(x => x.id === 1).position).toBe('P')
  })
})

// ─── assignToPosition edge cases ─────────────────────────────────────────────

describe('assignToPosition — edge cases', () => {
  it('player already at targetPos — position unchanged', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = assignToPosition(players, 1, 'P')
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 2).position).toBe('C')
  })

  it('unknown playerId — no change', () => {
    const players = [p(1, 'P')]
    const result = assignToPosition(players, 99, 'SS')
    expect(result).toEqual(players)
  })
})

// ─── cleanAfterCountChange edge cases ────────────────────────────────────────

describe('cleanAfterCountChange — edge cases', () => {
  it('empty roster — returns empty array', () => {
    expect(cleanAfterCountChange([], 0, '3', false)).toEqual([])
  })

  it('13 players — three EH slots all preserved', () => {
    const players = Array(13).fill(null).map((_, i) => p(i + 1))
    players[10].position = 'EH'
    players[11].position = 'EH2'
    players[12].position = 'EH3'
    const result = cleanAfterCountChange(players, 13, '3', false)
    expect(result.find(x => x.id === 11).position).toBe('EH')
    expect(result.find(x => x.id === 12).position).toBe('EH2')
    expect(result.find(x => x.id === 13).position).toBe('EH3')
  })

  it('going from 12 to 11 removes EH2 but preserves EH', () => {
    const players = Array(11).fill(null).map((_, i) => p(i + 1))
    players[9].position  = 'EH'
    players[10].position = 'EH2'
    const result = cleanAfterCountChange(players, 11, '3', false)
    expect(result.find(x => x.id === 10).position).toBe('EH')
    expect(result.find(x => x.id === 11).position).toBe('')
  })

  it('4OF with manualEH preserves both CL and EH', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    players[6].position = 'CL'
    players[8].position = 'EH'
    const result = cleanAfterCountChange(players, 9, '4', true)
    expect(result.find(x => x.id === 7).position).toBe('CL')
    expect(result.find(x => x.id === 9).position).toBe('EH')
  })

  it('unassigned players remain unassigned through cleanup', () => {
    const players = Array(9).fill(null).map((_, i) => p(i + 1))
    // no positions assigned
    const result = cleanAfterCountChange(players, 9, '3', false)
    expect(result.every(x => x.position === '')).toBe(true)
  })
})

// ─── addPlayer edge cases ─────────────────────────────────────────────────────

describe('addPlayer — edge cases', () => {
  it('adding the 11th player creates auto EH slot (existing EH position kept)', () => {
    const players = Array(10).fill(null).map((_, i) => p(i + 1))
    players[9].position = 'EH'  // manually assigned to EH before add
    const result = addPlayer(players, p(11), '3', false)
    expect(result).toHaveLength(11)
    // EH is now a valid auto slot at count 11 (autoEhCount = 1)
    expect(result.find(x => x.id === 10).position).toBe('EH')
  })

  it('preserves all unrelated positions when adding', () => {
    const players = [p(1, 'P'), p(2, 'C'), p(3, 'SS')]
    const result = addPlayer(players, p(4), '3', false)
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 2).position).toBe('C')
    expect(result.find(x => x.id === 3).position).toBe('SS')
    expect(result.find(x => x.id === 4).position).toBe('')
  })
})

// ─── removePlayer edge cases ──────────────────────────────────────────────────

describe('removePlayer — edge cases', () => {
  it('removing a non-existent id leaves roster unchanged', () => {
    const players = [p(1, 'P'), p(2, 'C')]
    const result = removePlayer(players, 99, '3', false)
    expect(result).toHaveLength(2)
  })

  it('removing a player clears only their position, not others', () => {
    const players = [p(1, 'P'), p(2, 'C'), p(3, 'SS')]
    const result = removePlayer(players, 2, '3', false)
    expect(result.find(x => x.id === 1).position).toBe('P')
    expect(result.find(x => x.id === 3).position).toBe('SS')
  })
})

// ─── applyOutfieldToggle edge cases ──────────────────────────────────────────

describe('applyOutfieldToggle — edge cases', () => {
  it('3→4 with no CF assigned — no player position changes', () => {
    const players = [p(1, 'P'), p(2, 'LF')]
    const { players: result, outfield } = applyOutfieldToggle(players, '3')
    expect(outfield).toBe('4')
    expect(result).toEqual(players)
  })

  it('4→3 with neither CL nor CR assigned — no player position changes', () => {
    const players = [p(1, 'P'), p(2, 'LF')]
    const { players: result, outfield } = applyOutfieldToggle(players, '4')
    expect(outfield).toBe('3')
    expect(result).toEqual(players)
  })
})
