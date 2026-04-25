import { useState } from 'react'
import LineupManager from '../components/LineupManager'

// ─── Shared player-data helpers ───────────────────────────────────────────────

const COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#0d9488', '#65a30d', '#9333ea', '#c2410c',
]

const player = (id, name, position = '') => ({
  id,
  name,
  position,
  color: COLORS[(id - 1) % COLORS.length],
})

const defaultRoster = () =>
  Array.from({ length: 9 }, (_, i) => ({
    id: i + 1, name: '', position: '',
    color: COLORS[i % COLORS.length],
  }))

// Standard 9-player roster, every position filled (3OF)
const FULL_9 = [
  player(1, 'Alex Rivera',    'P'),
  player(2, 'Jordan Kim',     'C'),
  player(3, 'Sam Patel',      '1B'),
  player(4, 'Casey Morgan',   '2B'),
  player(5, 'Taylor Brooks',  '3B'),
  player(6, 'Jamie Torres',   'SS'),
  player(7, 'Morgan Walsh',   'LF'),
  player(8, 'Riley Chen',     'CF'),
  player(9, 'Drew Nguyen',    'RF'),
]

// 10-player roster — auto-triggers 4OF; no EH yet
const FULL_10 = [
  player(1,  'Alex Rivera',    'P'),
  player(2,  'Jordan Kim',     'C'),
  player(3,  'Sam Patel',      '1B'),
  player(4,  'Casey Morgan',   '2B'),
  player(5,  'Taylor Brooks',  '3B'),
  player(6,  'Jamie Torres',   'SS'),
  player(7,  'Morgan Walsh',   'LF'),
  player(8,  'Riley Chen',     'CL'),
  player(9,  'Drew Nguyen',    'CR'),
  player(10, 'Quinn Alvarez',  'RF'),
]

// 11-player roster — 4OF + 1 auto EH
const FULL_11 = [
  ...FULL_10,
  player(11, 'Skyler Okafor', 'EH'),
]

// 12-player roster — 4OF + 2 auto EH slots
const FULL_12 = [
  ...FULL_11,
  player(12, 'Blake Hernandez', 'EH2'),
]

// ─── Stateful wrapper ─────────────────────────────────────────────────────────

function Scenario({
  initialPlayers,
  initialLineup = {},
  initialView,
  showViewToggle = false,
  showOutfieldToggle = false,
  showEHToggle = false,
}) {
  const [players, setPlayers] = useState(initialPlayers ?? defaultRoster())
  const [lineup, setLineup]   = useState({
    outfield: initialLineup.outfield ?? '3',
    manualEH: initialLineup.manualEH ?? false,
  })

  const handleLineupChange = ({ players: p, lineup: l }) => {
    setPlayers(p)
    setLineup(l)
  }

  return (
    <LineupManager
      players={players}
      lineup={lineup}
      onLineupChange={handleLineupChange}
      initialView={initialView ?? 'lineup'}
      showViewToggle={showViewToggle}
      showOutfieldToggle={showOutfieldToggle}
      showEHToggle={showEHToggle}
    />
  )
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export default {
  title: 'LineupManager',
  component: Scenario,
  tags: ['autodocs'],
}

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Starting point: nine empty batting slots, 3-outfielder configuration.
 * All controls are interactive — add players, assign positions, and drag to
 * reorder or place on the field.
 */
export const EmptyRoster = {
  name: 'Empty Roster (default)',
  render: () => <Scenario />,
}

/**
 * All three header toggles enabled — useful for testing toggle behaviour and
 * verifying accessibility. Toggles are hidden by default in production use.
 */
export const AllTogglesVisible = {
  name: 'All Toggles Visible',
  render: () => (
    <Scenario
      initialPlayers={FULL_9}
      showViewToggle
      showOutfieldToggle
      showEHToggle
    />
  ),
}

/**
 * All nine players named and assigned to their positions.
 * The lineup and field views are fully populated; drag any chip on the field
 * to swap positions or drag a row handle to reorder the batting order.
 */
export const FullRoster_3OF = {
  name: 'Full Roster — 3 Outfielders',
  render: () => <Scenario initialPlayers={FULL_9} />,
}

/**
 * Same roster shown with the Field tab active so the diamond is the first
 * thing visible. Useful for validating chip placement and outfield arc.
 */
export const FullRoster_3OF_FieldView = {
  name: 'Full Roster — 3 Outfielders (Field view)',
  render: () => <Scenario initialPlayers={FULL_9} initialView="field" />,
}

/**
 * Ten players automatically switch the app into 4-Outfielder mode (LF, CL,
 * CR, RF). The "4 Outfielders" toggle shows the AUTO badge and cannot be
 * manually disabled.
 */
export const TenPlayers_Auto4OF = {
  name: '10 Players — Auto 4 Outfielders',
  render: () => <Scenario initialPlayers={FULL_10} />,
}

/**
 * Field view with 10 players so the four outfield chips and auto badge are
 * clearly visible.
 */
export const TenPlayers_Auto4OF_FieldView = {
  name: '10 Players — Auto 4 Outfielders (Field view)',
  render: () => <Scenario initialPlayers={FULL_10} initialView="field" />,
}

/**
 * Eleven players add an automatic Extra Hitter slot. The EH box appears
 * below the field diagram and the "Extra Hitter" toggle shows AUTO.
 */
export const ElevenPlayers_AutoEH = {
  name: '11 Players — Auto Extra Hitter',
  render: () => <Scenario initialPlayers={FULL_11} />,
}

/**
 * Twelve players produce two separate EH slots ("EH 1" and "EH 2") shown as
 * stacked boxes below the field diagram.
 */
export const TwelvePlayers_MultiEH = {
  name: '12 Players — Two EH Slots',
  render: () => <Scenario initialPlayers={FULL_12} />,
}

/**
 * Field view for the 12-player roster so the full diamond and the two EH
 * boxes can be reviewed together.
 */
export const TwelvePlayers_MultiEH_FieldView = {
  name: '12 Players — Two EH Slots (Field view)',
  render: () => <Scenario initialPlayers={FULL_12} initialView="field" />,
}

/**
 * Nine players with the Extra Hitter toggle manually enabled. The EH
 * position appears in the dropdown and the EH box is shown below the field,
 * but neither toggle shows AUTO because the roster size does not require it.
 */
export const ManualEH = {
  name: 'Manual Extra Hitter (9 players)',
  render: () => <Scenario initialPlayers={FULL_9} initialLineup={{ manualEH: true }} />,
}

/**
 * Nine players with 4-Outfielder mode manually enabled. CL and CR appear on
 * the field and in the position dropdown; CF is removed. Neither toggle is
 * auto-driven.
 */
export const Manual4OF = {
  name: 'Manual 4 Outfielders (9 players)',
  render: () => (
    <Scenario
      initialLineup={{ outfield: '4' }}
      initialPlayers={[
        player(1, 'Alex Rivera',   'P'),
        player(2, 'Jordan Kim',    'C'),
        player(3, 'Sam Patel',     '1B'),
        player(4, 'Casey Morgan',  '2B'),
        player(5, 'Taylor Brooks', '3B'),
        player(6, 'Jamie Torres',  'SS'),
        player(7, 'Morgan Walsh',  'LF'),
        player(8, 'Riley Chen',    'CL'),
        player(9, 'Drew Nguyen',   'RF'),
        // CR is intentionally unassigned
      ]}
    />
  ),
}

/**
 * Mixed state: some players have positions assigned, others do not.
 * Demonstrates dragging from the lineup to open field chips, and the
 * pulsing blue highlight on empty positions during a drag.
 */
export const PartialAssignments = {
  name: 'Partial Assignments',
  render: () => (
    <Scenario
      initialPlayers={[
        player(1, 'Alex Rivera',   'P'),
        player(2, 'Jordan Kim',    'C'),
        player(3, 'Sam Patel',     '1B'),
        player(4, 'Casey Morgan',  ''),
        player(5, 'Taylor Brooks', '3B'),
        player(6, 'Jamie Torres',  ''),
        player(7, 'Morgan Walsh',  'LF'),
        player(8, 'Riley Chen',    ''),
        player(9, 'Drew Nguyen',   'RF'),
      ]}
    />
  ),
}

/**
 * Three players with no names or positions — represents a brand-new session
 * before the coach has entered any data. Avatar initials show "?" and
 * position chips remain in their empty/dashed state.
 */
export const SparseRoster = {
  name: 'Sparse Roster (3 unnamed players)',
  render: () => (
    <Scenario
      initialPlayers={[
        player(1, '', ''),
        player(2, '', ''),
        player(3, '', ''),
      ]}
    />
  ),
}
