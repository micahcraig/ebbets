import { arrayMove } from '@dnd-kit/sortable'

// ─── Player update (name, position, etc.) ────────────────────────────────────
// Position assignments swap instead of overwrite when the target is occupied.

export function applyPlayerUpdate(players, id, field, val) {
  if (field !== 'position' || !val) {
    return players.map(p => p.id === id ? { ...p, [field]: val } : p)
  }
  const displaced = players.find(p => p.position === val && p.id !== id)
  const oldPos    = players.find(p => p.id === id)?.position ?? ''
  return players.map(p => {
    if (p.id === id)                        return { ...p, position: val }
    if (displaced && p.id === displaced.id) return { ...p, position: oldPos }
    return p
  })
}

// ─── Batting order reorder ────────────────────────────────────────────────────

export function reorderPlayers(players, oldIdx, newIdx) {
  return arrayMove(players, oldIdx, newIdx)
}

// ─── Field chip swap (drag field→field) ──────────────────────────────────────

export function swapFieldPositions(players, posA, posB) {
  return players.map(p => {
    if (p.position === posA) return { ...p, position: posB }
    if (p.position === posB) return { ...p, position: posA }
    return p
  })
}

// ─── Lineup→field drag assignment ────────────────────────────────────────────
// The dragged player takes targetPos; whoever held targetPos inherits the
// dragged player's old position (which may be '', i.e. unassigned).

export function assignToPosition(players, playerId, targetPos) {
  const dragged   = players.find(p => p.id === playerId)
  const displaced = players.find(p => p.position === targetPos)
  const oldPos    = dragged?.position ?? ''
  return players.map(p => {
    if (p.id === playerId)                        return { ...p, position: targetPos }
    if (displaced && p.id === displaced.id)       return { ...p, position: oldPos }
    return p
  })
}

// ─── 4OF → 3OF migration ─────────────────────────────────────────────────────
// CL takes the CF slot; CR is unassigned. If only CR was assigned, CR gets CF.

function migrateCLCRtoCF(players) {
  const clTaken = players.some(p => p.position === 'CL')
  return players.map(p => {
    if (p.position === 'CL') return { ...p, position: 'CF' }
    if (p.position === 'CR') return { ...p, position: clTaken ? '' : 'CF' }
    return p
  })
}

// ─── Roster-size cleanup ──────────────────────────────────────────────────────
// Called after any add/remove so positions invalidated by the new count are
// cleared (or migrated).

export function cleanAfterCountChange(players, newCount, outfield, manualEH) {
  const newAutoOutfield = newCount >= 10 ? '4' : outfield
  const newAutoEhCount  = Math.max(0, newCount - 10)
  const newEhCount      = newAutoEhCount > 0 ? newAutoEhCount : (manualEH ? 1 : 0)
  const validEh         = new Set(Array.from({ length: newEhCount }, (_, i) => i === 0 ? 'EH' : `EH${i + 1}`))

  let result = players
  if (newAutoOutfield === '3') result = migrateCLCRtoCF(result)
  if (newAutoOutfield === '4') result = result.map(p => p.position === 'CF' ? { ...p, position: 'CL' } : p)
  result = result.map(p => p.position.startsWith('EH') && !validEh.has(p.position) ? { ...p, position: '' } : p)
  return result
}

// ─── Add / remove player ──────────────────────────────────────────────────────
// newPlayer is passed in so callers (and tests) control ID/color generation.

export function addPlayer(players, newPlayer, outfield, manualEH) {
  const next = [...players, newPlayer]
  return cleanAfterCountChange(next, next.length, outfield, manualEH)
}

export function removePlayer(players, id, outfield, manualEH) {
  const next = players.filter(p => p.id !== id)
  return cleanAfterCountChange(next, next.length, outfield, manualEH)
}

// ─── Toggle outfield configuration ───────────────────────────────────────────
// Returns { players, outfield } — both must be emitted together.
// CF migrates to CL when switching to 4OF; CL/CR migrate via migrateCLCRtoCF on 3OF.

export function applyOutfieldToggle(players, currentOutfield) {
  const next = currentOutfield === '3' ? '4' : '3'
  return {
    players: next === '3'
      ? migrateCLCRtoCF(players)
      : players.map(p => p.position === 'CF' ? { ...p, position: 'CL' } : p),
    outfield: next,
  }
}

// ─── Toggle Extra Hitter ──────────────────────────────────────────────────────
// Returns { players, manualEH } — both must be emitted together.

export function applyEHToggle(players, currentManualEH) {
  const manualEH = !currentManualEH
  return {
    players: manualEH
      ? players
      : players.map(p => p.position === 'EH' ? { ...p, position: '' } : p),
    manualEH,
  }
}
