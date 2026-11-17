import type { LayoutNode, Person } from '@familytree/domain'
import { memo } from 'react'
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
  paired,
  onOpen,
}: {
  node: LayoutNode
  person: Person
  focused: boolean
  selected: boolean
  home: boolean
  relation: string | null
  paired: boolean
  onOpen: (personId: string) => void
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
            : focused || paired
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
        <span className="pointer-events-none absolute -top-2.5 left-1/2 max-w-[196px] -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] leading-tight font-medium text-accent ring-[3px] ring-paper">
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
    </div>
  )
})
