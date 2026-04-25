import { useState, useRef } from 'react'
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './LineupManager.module.css'
import {
  applyPlayerUpdate, reorderPlayers, swapFieldPositions, assignToPosition,
  cleanAfterCountChange, addPlayer, removePlayer,
  applyOutfieldToggle, applyEHToggle,
} from '../lineup.js'

// ─── Collision detection ──────────────────────────────────────────────────────
// Use the pointer position directly so a wide dragged element (e.g. a full-
// width lineup row) doesn't skew the detected drop target to the right.
function pointerCollision({ collisionRect, droppableRects, droppableContainers, pointerCoordinates }) {
  const pt = pointerCoordinates ?? {
    x: collisionRect.left + collisionRect.width  / 2,
    y: collisionRect.top  + collisionRect.height / 2,
  }
  const collisions = []
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id)
    if (!rect) continue
    const cx   = rect.left + rect.width  / 2
    const cy   = rect.top  + rect.height / 2
    const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2)
    collisions.push({ id: container.id, data: { droppableContainer: container, value: dist } })
  }
  collisions.sort((a, b) => a.data.value - b.data.value)
  return collisions
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'RF']

const FIELD_COORDS = { // [cx, cy] in 500 × 480 SVG viewBox
  P:    [250, 270],
  C:    [250, 452],
  '1B': [372, 304],
  '2B': [312, 216],
  SS:   [188, 216],
  '3B': [132, 304],
  LF:   [82,  115],
  CF:   [250,  82],
  RF:   [418, 115],
  CL:   [162,  98],
  CR:   [338,  98],
}

const PLAYER_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#0d9488', '#65a30d', '#9333ea', '#c2410c',
]

const getInitials = name => {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

let _nextId = 10
const mkPlayer = () => {
  const id = _nextId++
  return { id, name: '', position: '', color: PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length] }
}
const defaultRoster = () =>
  Array.from({ length: 9 }, (_, i) => ({
    id: i + 1, name: '', position: '',
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
  }))

// ─── Root component ───────────────────────────────────────────────────────────

export default function LineupManager({
  players = [],
  lineup = {},
  onLineupChange = () => {},
  initialView = 'lineup',
  showTitle = true,
  showViewToggle = false,
  showOutfieldToggle = false,
  showEHToggle = false,
}) {
  const { outfield = '3', manualEH = false } = lineup
  const [view, setView]         = useState(initialView)
  const [activeId, setActiveId] = useState(null)
  const [activeType, setActiveType] = useState(null) // 'player' | 'fieldPos'
  const [activePos, setActivePos] = useState(null)   // position string when dragging a fieldPos

  // ── Derived config from player count ─────────────────────────────────────
  // ≥10 players → force 4 outfielders; >10 → one EH slot per extra player
  const autoOutfield  = players.length >= 10
  const effectiveOutfield = autoOutfield ? '4' : outfield

  const autoEhCount   = Math.max(0, players.length - 10)
  const ehCount       = autoEhCount > 0 ? autoEhCount : (manualEH ? 1 : 0)
  // Position IDs: EH, EH2, EH3, …
  const ehSlots       = Array.from({ length: ehCount }, (_, i) => i === 0 ? 'EH' : `EH${i + 1}`)

  const positions = [
    ...BASE_POSITIONS,
    ...(effectiveOutfield === '4' ? ['CL', 'CR'] : ['CF']),
    ...ehSlots,
  ]

  // posMap: position string → { name, color }
  const posMap = {}
  players.forEach(p => { if (p.position) posMap[p.position] = { name: p.name, color: p.color } })

  // Emit updated state to the parent.
  const emit = (newPlayers, lineupOverrides = {}) =>
    onLineupChange({ players: newPlayers, lineup: { outfield, manualEH, ...lineupOverrides } })

  // ── Player mutations ──────────────────────────────────────────────────────
  const updatePlayer = (id, field, val) =>
    emit(applyPlayerUpdate(players, id, field, val))

  const reorder = (oldIdx, newIdx) =>
    emit(reorderPlayers(players, oldIdx, newIdx))

  const swapPositions = (posA, posB) =>
    emit(swapFieldPositions(players, posA, posB))

  const assignPlayerToPosition = (playerId, targetPos) =>
    emit(assignToPosition(players, playerId, targetPos))

  const handleAddPlayer = () =>
    emit(addPlayer(players, mkPlayer(), outfield, manualEH))

  const handleRemovePlayer = id =>
    emit(removePlayer(players, id, outfield, manualEH))

  // Manual toggles — only meaningful when not auto-forced
  const toggleOutfield = () => {
    if (autoOutfield) return
    const { players: p, outfield: o } = applyOutfieldToggle(players, outfield)
    emit(p, { outfield: o })
  }

  const toggleEH = () => {
    if (autoEhCount > 0) return
    const { players: p, manualEH: m } = applyEHToggle(players, manualEH)
    emit(p, { manualEH: m })
  }

  // ── Unified DnD ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
    setActiveType(active.data.current?.type ?? null)
    setActivePos(active.data.current?.pos ?? null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null); setActiveType(null); setActivePos(null)
    if (!over) return

    const aType = active.data.current?.type
    const oType = over.data.current?.type
    const aPos  = active.data.current?.pos
    const oPos  = over.data.current?.pos

    if (aType === 'player' && oType === 'fieldPos') {
      // Cross-panel: lineup player dropped onto a field position
      assignPlayerToPosition(active.id, oPos)
    } else if (aType === 'fieldPos' && oType === 'fieldPos') {
      // Field-to-field swap (compare positions, not element IDs)
      if (aPos !== oPos) swapPositions(aPos, oPos)
    } else if (aType === 'player' && oType === 'player' && active.id !== over.id) {
      // Within-lineup reorder
      const oi = players.findIndex(p => p.id === active.id)
      const ni = players.findIndex(p => p.id === over.id)
      if (oi !== -1 && ni !== -1) reorder(oi, ni)
    }
  }

  const handleDragCancel = () => { setActiveId(null); setActiveType(null); setActivePos(null) }

  const activePlayer = activeType === 'player' ? players.find(p => p.id === activeId) : null

  // ── Swipe to switch panels (narrow viewport only) ─────────────────────────
  const swipeStart = useRef(null)

  const handleTouchStart = e => {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = e => {
    if (!swipeStart.current || activeId !== null) return
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return
    if (dx < 0) setView(v => v === 'lineup' ? 'field'  : v)
    else        setView(v => v === 'field'  ? 'lineup' : v)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.app}>
        {(showTitle || showViewToggle || showOutfieldToggle || showEHToggle) && (
        <header className={styles.header}>
          {showTitle && <h1 className={styles.title}>Lineup</h1>}
          {(showViewToggle || showOutfieldToggle || showEHToggle) && (
            <div className={styles.controls}>
              {showViewToggle && (
                <div className={styles.viewToggle}>
                  <button className={view === 'lineup' ? styles.tabActive : styles.tab} onClick={() => setView('lineup')}>List</button>
                  <button className={view === 'field'  ? styles.tabActive : styles.tab} onClick={() => setView('field')}>Field</button>
                </div>
              )}
              {showOutfieldToggle && (
                <Toggle label="4 Outfielders" checked={effectiveOutfield === '4'} onChange={toggleOutfield} auto={autoOutfield} />
              )}
              {showEHToggle && (
                <Toggle label="Extra Hitter" checked={ehCount > 0} onChange={toggleEH} auto={autoEhCount > 0} />
              )}
            </div>
          )}
        </header>
        )}

        <div className={styles.body} data-testid="panel-body" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className={`${styles.panelTrack} ${view === 'field' ? styles.panelTrackField : ''}`}>
            <div className={styles.panel}>
              <LineupView
                players={players}
                positions={positions}
                posMap={posMap}
                updatePlayer={updatePlayer}
                activeId={activeId}
                activePos={activePos}
                isPlayerDragging={activeType === 'player'}
                add={handleAddPlayer}
                remove={handleRemovePlayer}
              />
            </div>
            <div className={styles.panel}>
              <FieldView
                players={players}
                posMap={posMap}
                outfield={effectiveOutfield}
                ehSlots={ehSlots}
                activeFieldPos={activePos}
                isPlayerDragging={activeType === 'player'}
              />
            </div>
          </div>
        </div>

        {/* Single DragOverlay for the unified context */}
        <DragOverlay dropAnimation={null}>
          {activePlayer && <PlayerDragPreview player={activePlayer} />}
          {activePos && (
            <ChipVisual
              pos={activePos}
              name={posMap[activePos]?.name ?? ''}
              color={posMap[activePos]?.color ?? ''}
              isOverlay
            />
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

// ─── Small shared components ──────────────────────────────────────────────────

function Toggle({ label, checked, onChange, auto }) {
  return (
    <label className={`${styles.toggle} ${auto ? styles.toggleAuto : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} readOnly={auto} />
      <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
      {label}
      {auto && <span className={styles.autoBadge}>auto</span>}
    </label>
  )
}

function Avatar({ player }) {
  return (
    <div
      className={styles.avatar}
      style={{ background: player.name ? player.color : '#94a3b8' }}
    >
      {getInitials(player.name)}
    </div>
  )
}

// Floating preview shown under the cursor when dragging a lineup row
function PlayerDragPreview({ player }) {
  return (
    <div className={styles.playerPreview}>
      <Avatar player={player} />
      <span className={styles.playerPreviewName}>{player.name || 'Player'}</span>
    </div>
  )
}

// ─── Lineup view ──────────────────────────────────────────────────────────────

function LineupView({ players, positions, posMap, updatePlayer, activeId, activePos, isPlayerDragging, add, remove }) {
  return (
    <div className={styles.lineupWrap}>
      <div className={styles.positionStrip} data-testid="position-strip">
        {positions.map(pos => (
          <StripPositionChip
            key={pos}
            pos={pos}
            name={posMap[pos]?.name ?? ''}
            color={posMap[pos]?.color ?? ''}
            isActiveSource={activePos === pos}
            isPlayerDragging={isPlayerDragging}
          />
        ))}
      </div>
      <SortableContext items={players.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <ol className={styles.lineup}>
          {players.map((p, i) => (
            <SortableRow
              key={p.id}
              player={p}
              index={i}
              positions={positions}
              updatePlayer={updatePlayer}
              remove={remove}
              isGhost={p.id === activeId}
            />
          ))}
        </ol>
      </SortableContext>
      <button className={styles.addBtn} onClick={add}>+ Add Player</button>
    </div>
  )
}

function StripPositionChip({ pos, name, color, isActiveSource, isPlayerDragging }) {
  const {
    attributes, listeners,
    setNodeRef: setDragRef,
    transform, isDragging,
  } = useDraggable({
    id: `strip:${pos}`,
    data: { type: 'fieldPos', pos },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `strip:${pos}`,
    data: { type: 'fieldPos', pos },
  })

  return (
    <div ref={setDropRef} className={styles.stripChipAnchor}>
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        style={{ transform: CSS.Transform.toString(transform) }}
        className={[
          styles.chipDragWrap,
          isDragging     ? styles.chipDragging : '',
          isActiveSource ? styles.chipSource   : '',
        ].join(' ')}
      >
        <ChipVisual
          pos={pos}
          name={name}
          color={color}
          isOver={isOver && !isDragging}
          isPlayerDragging={isPlayerDragging}
        />
      </div>
    </div>
  )
}

function SortableRow({ player, index, positions, updatePlayer, remove, isGhost }) {
  const [confirming, setConfirming] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: player.id,
      data: { type: 'player', id: player.id },
    })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        styles.rowWrap,
        isDragging ? styles.rowDragging : '',
        isGhost    ? styles.rowGhost    : '',
      ].join(' ')}
    >
      <div className={[
        styles.row,
        player.position === 'EH' ? styles.ehRow : '',
      ].join(' ')}>
        {/* Drag handle — listeners here make the whole drag originate from the handle */}
        <span className={styles.dragHandle} {...attributes} {...listeners} title="Drag to reorder or drop on field">⠿</span>
        <span className={styles.order}>{index + 1}</span>
        <Avatar player={player} />
        <input
          className={styles.nameInput}
          placeholder="Player name"
          value={player.name}
          onChange={e => updatePlayer(player.id, 'name', e.target.value)}
        />
        <select
          className={styles.posSelect}
          value={player.position}
          onChange={e => updatePlayer(player.id, 'position', e.target.value)}
        >
          <option value="">—</option>
          {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
        </select>
        {confirming ? (
          <div className={styles.removeConfirm}>
            <span className={styles.removeConfirmLabel}>Remove?</span>
            <button className={styles.removeConfirmYes} onClick={() => remove(player.id)}>Yes</button>
            <button className={styles.removeConfirmNo}  onClick={() => setConfirming(false)}>No</button>
          </div>
        ) : (
          <button className={styles.removeBtn} onClick={() => setConfirming(true)} title="Remove">✕</button>
        )}
        <span className={styles.dragHandle} {...attributes} {...listeners} title="Drag to reorder or drop on field">⠿</span>
      </div>
    </li>
  )
}

// ─── Field view ───────────────────────────────────────────────────────────────

function FieldView({ players, posMap, outfield, ehSlots, activeFieldPos, isPlayerDragging }) {
  const outfieldSlots = outfield === '4' ? ['LF', 'CL', 'CR', 'RF'] : ['LF', 'CF', 'RF']
  const fieldSlots    = ['P', 'C', '1B', '2B', 'SS', '3B', ...outfieldSlots]

  return (
    <div className={styles.fieldWrap}>
      <div className={styles.fieldContainer}>
        <svg viewBox="0 0 500 480" className={styles.fieldSvg} aria-label="Softball field diagram">
          <FieldBackground />
        </svg>

        <div className={styles.fieldOverlay}>
          {fieldSlots.map(pos => {
            const [cx, cy] = FIELD_COORDS[pos]
            const entry = posMap[pos]
            return (
              <PositionChip
                key={pos}
                pos={pos}
                name={entry?.name ?? ''}
                color={entry?.color ?? ''}
                pctX={(cx / 500) * 100}
                pctY={(cy / 480) * 100}
                isActiveSource={activeFieldPos === pos}
                isPlayerDragging={isPlayerDragging}
              />
            )
          })}
        </div>
      </div>

      {ehSlots.length > 0 && (
        <div className={styles.ehSection}>
          {ehSlots.map((slot, i) => {
            const occupant = players.find(pl => pl.position === slot)
            return (
              <EHBox
                key={slot}
                slot={slot}
                label={`EH${ehSlots.length > 1 ? ` ${i + 1}` : ''}`}
                player={occupant ?? null}
                isActiveSource={activeFieldPos === slot}
                isPlayerDragging={isPlayerDragging}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── EH box (draggable + droppable) ──────────────────────────────────────────

function EHBox({ slot, label, player, isActiveSource, isPlayerDragging }) {
  const {
    attributes, listeners,
    setNodeRef: setDragRef,
    transform, isDragging,
  } = useDraggable({ id: slot, data: { type: 'fieldPos', pos: slot } })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slot,
    data: { type: 'fieldPos', pos: slot },
  })

  const setRef = el => { setDragRef(el); setDropRef(el) }

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={[
        styles.ehBox,
        isDragging                         ? styles.ehBoxDragging  : '',
        isActiveSource && !isDragging      ? styles.ehBoxSource    : '',
        isOver && !isDragging              ? styles.ehBoxOver      : '',
        isPlayerDragging && !player        ? styles.ehBoxReceiver  : '',
      ].join(' ')}
    >
      <div className={styles.avatar} style={{ background: player ? player.color : '#94a3b8', flexShrink: 0 }}>
        {player ? getInitials(player.name) : '?'}
      </div>
      <span className={styles.ehBadge}>{label}</span>
      <span className={styles.ehName}>{player?.name || <em>Unassigned</em>}</span>
      <span className={styles.ehDesc}>Extra Hitter — bats, does not field</span>
    </div>
  )
}

// ─── Field SVG background ─────────────────────────────────────────────────────

function FieldBackground() {
  const bases = [[250, 430], [390, 290], [250, 150], [110, 290]]
  return (
    <>
      <rect width="500" height="480" fill="#6b7c61" />
      <path d="M 250 430 L -19 161 A 380 380 0 0 1 519 161 Z" fill="#3d7a52" />
      <defs>
        <clipPath id="dirtClip">
          <rect x="0" y="0" width="500" height="290" />
        </clipPath>
      </defs>
      <ellipse cx="250" cy="280" rx="148" ry="175" fill="#c2955a" clipPath="url(#dirtClip)" />
      <polygon points="250,430 390,290 250,150 110,290" fill="#3d7a52" />
      <path d="M -19 161 A 380 380 0 0 1 519 161"
        fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="8 5" />
      <line x1="250" y1="430" x2="-19" y2="161" stroke="white" strokeWidth="1.5" opacity=".7" />
      <line x1="250" y1="430" x2="519" y2="161" stroke="white" strokeWidth="1.5" opacity=".7" />
      <polygon points="250,430 390,290 250,150 110,290" fill="none" stroke="white" strokeWidth="2" />
      {bases.map(([x, y], i) => (
        <rect key={i} x={x - 7} y={y - 7} width="14" height="14"
          fill={i === 0 ? '#ccc' : 'white'}
          transform={`rotate(45 ${x} ${y})`} />
      ))}
      <circle cx="250" cy="270" r="11" fill="#b87c3a" stroke="#9a6730" strokeWidth="1" />
    </>
  )
}

// ─── Position chip ────────────────────────────────────────────────────────────

function PositionChip({ pos, name, color, pctX, pctY, isActiveSource, isPlayerDragging }) {
  const {
    attributes, listeners,
    setNodeRef: setDragRef,
    transform, isDragging,
  } = useDraggable({
    id: pos,
    data: { type: 'fieldPos', pos },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: pos,
    data: { type: 'fieldPos', pos },
  })

  return (
    <div
      ref={setDropRef}
      className={styles.chipAnchor}
      style={{ left: `${pctX}%`, top: `${pctY}%` }}
    >
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        style={{ transform: CSS.Transform.toString(transform) }}
        className={[
          styles.chipDragWrap,
          isDragging     ? styles.chipDragging : '',
          isActiveSource ? styles.chipSource   : '',
        ].join(' ')}
      >
        <ChipVisual
          pos={pos}
          name={name}
          color={color}
          isOver={isOver && !isDragging}
          isPlayerDragging={isPlayerDragging}
        />
      </div>
    </div>
  )
}

function ChipVisual({ pos, name, color, isOver, isOverlay, isPlayerDragging }) {
  const filled = Boolean(name)
  return (
    <div
      className={[
        styles.chip,
        filled           ? styles.chipFilled   : styles.chipEmpty,
        isOver           ? styles.chipOver     : '',
        isOverlay        ? styles.chipOverlay  : '',
        isPlayerDragging ? styles.chipReceiver : '',
      ].join(' ')}
      style={filled ? { background: color, borderColor: 'rgba(255,255,255,0.45)' } : {}}
    >
      <span className={styles.chipPos}>{pos}</span>
      {filled && <span className={styles.chipInitials}>{getInitials(name)}</span>}
    </div>
  )
}
