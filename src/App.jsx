import { useState } from 'react'
import LineupManager from './components/LineupManager'

const PLAYER_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#0d9488', '#65a30d', '#9333ea', '#c2410c',
]

const defaultRoster = () =>
  Array.from({ length: 9 }, (_, i) => ({
    id: i + 1, name: '', position: '',
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
  }))

export default function App() {
  const [players, setPlayers] = useState(defaultRoster)
  const [lineup, setLineup]   = useState({ outfield: '3', manualEH: false })

  const handleLineupChange = ({ players: p, lineup: l }) => {
    setPlayers(p)
    setLineup(l)
  }

  return (
    <LineupManager
      players={players}
      lineup={lineup}
      onLineupChange={handleLineupChange}
      showViewToggle
      showOutfieldToggle
      showEHToggle
    />
  )
}
