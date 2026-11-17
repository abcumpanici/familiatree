import {
  type Command,
  displayName,
  newId,
  PARENT_KINDS,
  type ParentKind,
  partnersOf,
  type TreeIndex,
} from '@familytree/domain'
import { type FormEvent, useMemo, useState } from 'react'
import type { TreeSession } from '../data/session.ts'
import { lifespan } from '../lib/people.ts'
import type { AddKind } from '../tree/PersonCard.tsx'
import { Portrait } from '../tree/Portrait.tsx'
import { Button, Field, Segmented, Switch, TextInput } from '../ui/controls.tsx'
import { Dialog } from '../ui/Overlay.tsx'
import { DateField, PersonFieldsEditor, toDraft } from './PersonForm.tsx'

export const KIND_LABEL: Record<ParentKind, string> = {
  birth: 'Birth',
  adopted: 'Adopted',
  step: 'Step',
  foster: 'Foster',
}

const TITLES: Record<AddKind | 'first', (name: string) => string> = {
  first: () => 'Who do you want to start with?',
  parent: (n) => `Add a parent of ${n}`,
  partner: (n) => `Add a partner of ${n}`,
  child: (n) => `Add a child of ${n}`,
}

export function AddRelativeDialog({
  session,
  index,
  kind,
  anchorId,
  onClose,
  onAdded,
}: {
  session: TreeSession
  index: TreeIndex
  kind: AddKind | 'first'
  anchorId: string | null
  onClose: () => void
  onAdded: (personId: string) => void
}) {
  const anchor = anchorId ? index.people.get(anchorId) : undefined
  const partners = useMemo(() => (anchorId ? partnersOf(index, anchorId) : []), [index, anchorId])
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [draft, setDraft] = useState(() =>
    toDraft({ surname: kind === 'child' ? (anchor?.surname ?? '') : '' }),
  )
  const [existingId, setExistingId] = useState<string | null>(null)
  const [parentKind, setParentKind] = useState<ParentKind>('birth')
  const [otherParent, setOtherParent] = useState<string>(partners[0]?.partnerId ?? '')
  const [married, setMarried] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const commands: Command[] = []
    let personId = existingId
    if (mode === 'new' || kind === 'first') {
      personId = newId()
      commands.push({
        type: 'addPerson',
        person: { ...draft, id: personId, ...(draft.died ? {} : { diedDate: '', diedPlace: '' }) },
      })
    }
    if (!personId) {
      setError('Choose a person from the list.')
      return
    }
    if (anchorId && kind === 'parent') {
      commands.push({
        type: 'addParentLink',
        link: { childId: anchorId, parentId: personId, kind: parentKind },
      })
    }
    if (anchorId && kind === 'child') {
      commands.push({
        type: 'addParentLink',
        link: { childId: personId, parentId: anchorId, kind: parentKind },
      })
      if (otherParent) {
        commands.push({
          type: 'addParentLink',
          link: { childId: personId, parentId: otherParent, kind: parentKind },
        })
      }
    }
    if (anchorId && kind === 'partner') {
      commands.push({
        type: 'addPartnership',
        partnership: { personAId: anchorId, personBId: personId, married, startDate },
      })
    }
    try {
      session.apply(commands)
      onAdded(personId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const title = TITLES[kind](anchor ? anchor.firstNames : '')

  return (
    <Dialog open onClose={onClose} label={title}>
      <form onSubmit={submit} className="grid gap-5">
        <h2 className="display pr-8 text-[26px] leading-tight">{title}</h2>
        {kind !== 'first' && index.people.size > 1 && (
          <Segmented
            label="New or existing person"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'new', label: 'New person' },
              { value: 'existing', label: 'Already in the tree' },
            ]}
          />
        )}
        {mode === 'new' || kind === 'first' ? (
          <PersonFieldsEditor draft={draft} setDraft={setDraft} compact />
        ) : (
          <PersonPicker
            index={index}
            excludeId={anchorId}
            value={existingId}
            onChange={setExistingId}
          />
        )}
        {(kind === 'parent' || kind === 'child') && (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-muted">Relationship</span>
            <Segmented
              label="Relationship"
              value={parentKind}
              onChange={setParentKind}
              options={PARENT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            />
          </div>
        )}
        {kind === 'child' && partners.length > 0 && (
          <Field label="Other parent">
            {(id) => (
              <select
                id={id}
                value={otherParent}
                onChange={(e) => setOtherParent(e.target.value)}
                className="w-full rounded-xl bg-surface px-3 py-2.5 text-[15px] ring-1 ring-line focus:ring-2 focus:ring-accent focus:outline-none"
              >
                {partners.map((p) => {
                  const person = index.people.get(p.partnerId)
                  return (
                    <option key={p.partnerId} value={p.partnerId}>
                      {person ? displayName(person) : p.partnerId}
                    </option>
                  )
                })}
                <option value="">Nobody / not known</option>
              </select>
            )}
          </Field>
        )}
        {kind === 'partner' && (
          <div className="grid gap-3">
            <Switch label="Married" checked={married} onChange={setMarried} />
            <DateField
              label={married ? 'Wedding date' : 'Together since'}
              value={startDate}
              onChange={setStartDate}
            />
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {kind === 'first' ? 'Add to the tree' : 'Add'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function PersonPicker({
  index,
  excludeId,
  value,
  onChange,
  onPick,
}: {
  index: TreeIndex
  excludeId?: string | null
  value?: string | null
  onChange?: (id: string) => void
  onPick?: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => searchPeople(index, query).filter((p) => p.id !== excludeId),
    [index, query, excludeId],
  )
  return (
    <div className="grid gap-3">
      <TextInput
        autoFocus
        type="search"
        placeholder="Search by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          const first = results[0]
          if (e.key === 'Enter' && first && onPick) {
            e.preventDefault()
            onPick(first.id)
          }
        }}
        aria-label="Search by name"
      />
      <ul className="-mx-2 max-h-72 overflow-y-auto">
        {results.slice(0, 60).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => (onPick ? onPick(p.id) : onChange?.(p.id))}
              className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-sunken ${value === p.id ? 'bg-accent-soft' : ''}`}
            >
              <Portrait person={p} size={36} />
              <span className="min-w-0">
                <span className="block truncate font-serif text-[15px]">{displayName(p)}</span>
                <span className="tabular block text-xs text-faint">{lifespan(p)}</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted">Nobody with that name.</li>
        )}
      </ul>
    </div>
  )
}

export function searchPeople(index: TreeIndex, query: string) {
  const terms = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  const people = [...index.people.values()]
  const matches = terms.length
    ? people.filter((p) => {
        const hay = `${p.firstNames} ${p.surname} ${p.birthSurname}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
        return terms.every((t) => hay.includes(t))
      })
    : people
  return matches.sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

export function SearchDialog({
  index,
  onClose,
  onPick,
}: {
  index: TreeIndex
  onClose: () => void
  onPick: (id: string) => void
}) {
  return (
    <Dialog open onClose={onClose} label="Find a person">
      <h2 className="display mb-4 text-[26px]">Find a person</h2>
      <PersonPicker
        index={index}
        onPick={(id) => {
          onPick(id)
          onClose()
        }}
      />
    </Dialog>
  )
}

export function PartnershipDialog({
  session,
  partnershipId,
  onClose,
}: {
  session: TreeSession
  partnershipId: string
  onClose: () => void
}) {
  const current = session.data.partnerships.find((p) => p.id === partnershipId)
  const [draft, setDraft] = useState(() => ({
    married: current?.married ?? false,
    startDate: current?.startDate ?? '',
    startPlace: current?.startPlace ?? '',
    ended: current?.ended ?? false,
    endDate: current?.endDate ?? '',
    endPlace: current?.endPlace ?? '',
  }))
  const [error, setError] = useState<string | null>(null)
  if (!current) return null
  const a = session.person(current.personAId)
  const b = session.person(current.personBId)
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft({ ...draft, [k]: v })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      session.apply([
        {
          type: 'updatePartnership',
          id: partnershipId,
          patch: draft.ended ? draft : { ...draft, endDate: '', endPlace: '' },
        },
      ])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  const remove = () => {
    session.apply([{ type: 'removePartnership', id: partnershipId }])
    onClose()
  }
  return (
    <Dialog open onClose={onClose} label="Partnership">
      <form onSubmit={submit} className="grid gap-4">
        <h2 className="display pr-8 text-[26px] leading-tight">
          {a?.firstNames} and {b?.firstNames}
        </h2>
        <Switch label="Married" checked={draft.married} onChange={(v) => set('married', v)} />
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={draft.married ? 'Wedding date' : 'Together since'}
            value={draft.startDate}
            onChange={(v) => set('startDate', v)}
          />
          <Field label="Place">
            {(id) => (
              <TextInput
                id={id}
                value={draft.startPlace}
                onChange={(e) => set('startPlace', e.target.value)}
              />
            )}
          </Field>
        </div>
        <Switch
          label={draft.married ? 'Divorced or separated' : 'Separated'}
          checked={draft.ended}
          onChange={(v) => set('ended', v)}
        />
        {draft.ended && (
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Date" value={draft.endDate} onChange={(v) => set('endDate', v)} />
            <Field label="Place">
              {(id) => (
                <TextInput
                  id={id}
                  value={draft.endPlace}
                  onChange={(e) => set('endPlace', e.target.value)}
                />
              )}
            </Field>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="danger" icon="trash" onClick={remove}>
            Remove link
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
