import {
  DomainError,
  type Gender,
  type Person,
  type PersonFields,
  parseDateInput,
} from '@familytree/domain'
import { type FormEvent, useRef, useState } from 'react'
import { Button, Field, Segmented, Switch, TextArea, TextInput } from '../ui/controls.tsx'
import { Icon } from '../ui/Icon.tsx'

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

export function DateField({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const parsed = parseDateInput(value)
  return (
    <Field
      label={label}
      className={className}
      error={parsed === null ? 'Use a date like 1952, Mar 1952, 14/03/1952 or about 1900' : null}
    >
      {(id) => (
        <TextInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 14 Mar 1952"
          inputMode="text"
        />
      )}
    </Field>
  )
}

type Draft = Omit<PersonFields, 'photo'>

export function toDraft(p?: Partial<Person>): Draft {
  return {
    firstNames: p?.firstNames ?? '',
    surname: p?.surname ?? '',
    birthSurname: p?.birthSurname ?? '',
    gender: p?.gender ?? 'unknown',
    bornDate: p?.bornDate ?? '',
    bornPlace: p?.bornPlace ?? '',
    died: p?.died ?? false,
    diedDate: p?.diedDate ?? '',
    diedPlace: p?.diedPlace ?? '',
    story: p?.story ?? '',
  }
}

export function PersonFieldsEditor({
  draft,
  setDraft,
  compact = false,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  compact?: boolean
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value })
  return (
    <div className="grid gap-4">
      <Field label="First names">
        {(id) => (
          <TextInput
            id={id}
            required
            autoFocus
            value={draft.firstNames}
            onChange={(e) => set('firstNames', e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Surname">
          {(id) => (
            <TextInput
              id={id}
              value={draft.surname}
              onChange={(e) => set('surname', e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Birth surname" hint="If different">
          {(id) => (
            <TextInput
              id={id}
              value={draft.birthSurname}
              onChange={(e) => set('birthSurname', e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-muted">Gender</span>
        <Segmented
          label="Gender"
          value={draft.gender}
          options={GENDER_OPTIONS}
          onChange={(v) => set('gender', v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Born" value={draft.bornDate} onChange={(v) => set('bornDate', v)} />
        <Field label="Place of birth">
          {(id) => (
            <TextInput
              id={id}
              value={draft.bornPlace}
              onChange={(e) => set('bornPlace', e.target.value)}
            />
          )}
        </Field>
      </div>
      <Switch label="Died" checked={draft.died} onChange={(v) => set('died', v)} />
      {draft.died && (
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Date of death"
            value={draft.diedDate}
            onChange={(v) => set('diedDate', v)}
          />
          <Field label="Place of death">
            {(id) => (
              <TextInput
                id={id}
                value={draft.diedPlace}
                onChange={(e) => set('diedPlace', e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
      {!compact && <StoryEditor value={draft.story} onChange={(v) => set('story', v)} />}
    </div>
  )
}

export function StoryEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const wrap = (before: string, after = before) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const next = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, b + before.length)
    })
  }
  const list = () => {
    const el = ref.current
    if (!el) return
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    onChange(`${value.slice(0, start)}- ${value.slice(start)}`)
  }
  return (
    <Field label="Story" hint="Achievements, memories, anything worth keeping.">
      {(id) => (
        <div>
          <div className="mb-1.5 flex gap-1">
            <ToolButton label="Bold" icon="bold" onClick={() => wrap('**')} />
            <ToolButton label="Italic" icon="italic" onClick={() => wrap('*')} />
            <ToolButton label="List" icon="list" onClick={list} />
            <ToolButton label="Link" icon="link" onClick={() => wrap('[', '](https://)')} />
          </div>
          <TextArea
            id={id}
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={7}
            className="font-serif text-[16px]"
          />
        </div>
      )}
    </Field>
  )
}

function ToolButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: 'bold' | 'italic' | 'list' | 'link'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

export function PersonEditForm({
  person,
  onSave,
  onCancel,
}: {
  person: Person
  onSave: (patch: Draft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => toDraft(person))
  const [error, setError] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      onSave(draft.died ? draft : { ...draft, diedDate: '', diedPlace: '' })
    } catch (err) {
      setError(err instanceof DomainError || err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      <PersonFieldsEditor draft={draft} setDraft={setDraft} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 bg-surface/95 px-6 py-3 backdrop-blur">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save changes
        </Button>
      </div>
    </form>
  )
}
