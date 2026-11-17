import type { LayoutNode, Person } from '@familytree/domain'
import { memo, useEffect, useRef, useState } from 'react'
import { ageLabel, birthLine, lifespan } from '../lib/people.ts'
import { Icon } from '../ui/Icon.tsx'
import { Portrait } from './Portrait.tsx'

export const CARD_W = 212
export const CARD_H = 92

export type AddKind = 'parent' | 'partner' | 'child'

export const PersonCard = memo(function PersonCard({
  node,
  person,
  focused,
  selected,
  home,
  relation,
  canAddParent,
  onOpen,
  onAdd,
}: {
  node: LayoutNode
  person: Person
  focused: boolean
  selected: boolean
  home: boolean
  relation: string | null
  canAddParent: boolean
  onOpen: (personId: string) => void
  onAdd: (kind: AddKind, personId: string) => void
}) {
  const years = lifespan(person)
  const line = birthLine(person)
  const age = ageLabel(person)
  return (
    <div
      data-card
      data-flip-id={node.key}
      data-generation={node.generation}
      className="absolute"
      style={{
        left: node.x - CARD_W / 2,
        top: node.y,
        width: CARD_W,
        height: CARD_H,
        zIndex: focused ? 5 : selected ? 4 : undefined,
      }}
    >
      <button
        type="button"
        data-person={person.id}
        onClick={() => onOpen(person.id)}
        aria-label={[`${person.firstNames} ${person.surname}`.trim(), relation, years]
          .filter(Boolean)
          .join(', ')}
        aria-current={focused ? 'true' : undefined}
        className={`group flex h-full w-full items-center gap-3 rounded-[22px] bg-surface pr-3 pl-2.5 text-left transition-[box-shadow,transform] duration-300 ease-out-soft ${
          selected
            ? '-translate-y-1 shadow-float ring-2 ring-accent ring-offset-4 ring-offset-accent-soft'
            : focused
              ? 'shadow-float ring-2 ring-accent hover:-translate-y-0.5'
              : 'shadow-lift ring-1 ring-line/70 hover:-translate-y-0.5 hover:ring-line'
        }`}
      >
        <Portrait person={person} size={50} />
        <span className={`min-w-0 flex-1 pr-3 ${relation ? 'pt-2' : ''}`}>
          <span className="block truncate font-serif text-[15px] leading-tight font-semibold text-ink">
            {person.firstNames}
          </span>
          {person.surname && (
            <span className="block truncate font-serif text-[13.5px] leading-tight text-muted">
              {person.surname}
            </span>
          )}
          {line && (
            <span className="tabular mt-1 block truncate text-[11.5px] text-muted">{line}</span>
          )}
          {age && <span className="tabular block truncate text-[11.5px] text-faint">{age}</span>}
        </span>
        {home && !focused && (
          <span title="Home person" className="absolute top-2.5 right-2.5 text-accent">
            <Icon name="star" size={12} />
          </span>
        )}
        {person.story && (
          <span title="Has a story" className="absolute right-2.5 bottom-2.5 text-faint">
            <Icon name="feather" size={13} />
          </span>
        )}
      </button>
      {relation && (
        <span className="pointer-events-none absolute -top-2.5 left-[70px] max-w-[130px] truncate rounded-full bg-accent-soft px-2 py-0.5 text-[11px] leading-tight font-medium text-accent ring-[3px] ring-paper">
          {relation}
        </span>
      )}
      {node.moreUp && !focused && (
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 h-2 w-px -translate-x-1/2 bg-faint/60"
        />
      )}
      {node.moreDown && !focused && (
        <span
          aria-hidden="true"
          className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5"
        >
          <span className="h-1 w-1 rounded-full bg-faint" />
          <span className="h-1 w-1 rounded-full bg-faint" />
          <span className="h-1 w-1 rounded-full bg-faint" />
        </span>
      )}
      {focused && <AddMenu canAddParent={canAddParent} onPick={(kind) => onAdd(kind, person.id)} />}
    </div>
  )
})

function AddMenu({
  canAddParent,
  onPick,
}: {
  canAddParent: boolean
  onPick: (kind: AddKind) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const items: { kind: AddKind; label: string }[] = [
    ...(canAddParent ? [{ kind: 'parent' as const, label: 'Parent' }] : []),
    { kind: 'partner', label: 'Partner' },
    { kind: 'child', label: 'Child' },
  ]
  return (
    <div ref={root} className="absolute -top-3 -right-3 z-10">
      <button
        type="button"
        data-add
        aria-label="Add a relative"
        aria-expanded={open}
        title="Add a relative"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lift ring-[3px] ring-paper transition-transform duration-300 ease-out-soft hover:scale-110 ${open ? 'rotate-45' : ''}`}
      >
        <Icon name="plus" size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-10 left-1/2 flex -translate-x-1/2 flex-col gap-1 rounded-2xl bg-surface p-1.5 shadow-float ring-1 ring-line animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.kind}
              onClick={() => {
                setOpen(false)
                onPick(item.kind)
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap hover:bg-sunken"
            >
              <Icon name="plus" size={14} className="text-accent" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
