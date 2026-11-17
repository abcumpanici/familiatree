import {
  childGroups,
  displayName,
  PARENT_KINDS,
  type ParentKind,
  type Person,
  parentLinksOf,
  partnersOf,
  relationLabel,
  siblingsOf,
  type TreeIndex,
} from '@familytree/domain'
import gsap from 'gsap'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { TreeSession } from '../data/session.ts'
import { pickFile } from '../lib/download.ts'
import { renderMarkdown } from '../lib/markdown.ts'
import { lifeLine, lifespan } from '../lib/people.ts'
import { resizePhoto } from '../lib/photo.ts'
import { prefersReducedMotion } from '../lib/prefs.ts'
import { toastError } from '../lib/toast.ts'
import type { AddKind } from '../tree/PersonCard.tsx'
import { Portrait } from '../tree/Portrait.tsx'
import { Button, IconButton } from '../ui/controls.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Dialog } from '../ui/Overlay.tsx'
import { KIND_LABEL, PartnershipDialog } from './AddRelative.tsx'
import { PersonEditForm } from './PersonForm.tsx'

const narrow = () => window.matchMedia('(max-width: 767px)').matches

export function PersonPanel({
  session,
  index,
  personId,
  homeId,
  focusId,
  onClose,
  onFocus,
  onGo,
  onAdd,
}: {
  session: TreeSession
  index: TreeIndex
  personId: string
  homeId: string | null
  focusId: string | null
  onClose: () => void
  onFocus: (id: string) => void
  onGo: (id: string) => void
  onAdd: (kind: AddKind, personId: string) => void
}) {
  const person = index.people.get(personId)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [partnershipId, setPartnershipId] = useState<string | null>(null)
  const panel = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  useLayoutEffect(() => {
    if (!panel.current || prefersReducedMotion()) return
    gsap.fromTo(panel.current, narrow() ? { yPercent: 100 } : { x: 40, opacity: 0 }, {
      yPercent: 0,
      x: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'expo.out',
    })
  }, [])

  useEffect(() => {
    if (!body.current || !personId) return
    body.current.scrollTop = 0
    setEditing(false)
    if (!prefersReducedMotion()) {
      gsap.fromTo(
        body.current.children,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' },
      )
    }
  }, [personId])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    if (!panel.current || prefersReducedMotion()) {
      onClose()
      return
    }
    gsap.to(panel.current, {
      ...(narrow() ? { yPercent: 100 } : { x: 40, opacity: 0 }),
      duration: 0.3,
      ease: 'power2.in',
      onComplete: onClose,
    })
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing && !document.querySelector('[role="dialog"]')) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, editing])

  const family = useMemo(() => {
    if (!person) return null
    const parents = parentLinksOf(index, person.id)
    const partners = partnersOf(index, person.id)
    const children = childGroups(index, person.id).flatMap((g) => g.children)
    const siblings = siblingsOf(index, person.id)
    return { parents, partners, children, siblings }
  }, [index, person])

  if (!person || !family) return null

  const changePhoto = async () => {
    const file = await pickFile('image/*')
    if (!file) return
    try {
      await session.setPhoto(person.id, await resizePhoto(file))
    } catch (error) {
      toastError(error)
    }
  }

  const born = lifeLine(person.bornDate, person.bornPlace)
  const died = lifeLine(person.diedDate, person.diedPlace)

  return (
    <aside
      ref={panel}
      aria-label={displayName(person)}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[86dvh] flex-col rounded-t-[28px] bg-surface shadow-float md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[420px] md:rounded-[28px]"
    >
      <div className="flex items-center justify-between px-4 pt-3 md:pt-4">
        <span className="mx-auto h-1 w-10 rounded-full bg-line md:hidden" />
        <IconButton
          icon="close"
          label="Close"
          onClick={close}
          className="absolute top-2 right-3 z-10 md:top-3"
        />
      </div>
      <div ref={body} className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
        {editing ? (
          <div>
            <h2 className="display mb-5 text-[26px]">Edit {person.firstNames}</h2>
            <PersonEditForm
              person={person}
              onCancel={() => setEditing(false)}
              onSave={(patch) => {
                session.apply([{ type: 'updatePerson', id: person.id, patch }])
                setEditing(false)
              }}
            />
          </div>
        ) : (
          <>
            <header className="flex flex-col items-center pt-2 text-center">
              <button
                type="button"
                onClick={changePhoto}
                className="group relative rounded-full"
                aria-label={person.photo ? 'Change photo' : 'Add a photo'}
              >
                <Portrait person={person} size={104} />
                <span className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper shadow-lift transition-transform group-hover:scale-110">
                  <Icon name="camera" size={15} />
                </span>
              </button>
              <h2 className="display mt-4 text-[32px] leading-[1.1] text-balance">
                {displayName(person)}
              </h2>
              {focusId && focusId !== person.id && relationLabel(index, focusId, person.id) && (
                <p className="mt-2 rounded-full bg-accent-soft px-3 py-0.5 text-[13px] font-medium text-accent">
                  {index.people.get(focusId)?.firstNames}'s{' '}
                  {relationLabel(index, focusId, person.id)?.toLowerCase()}
                </p>
              )}
              {person.birthSurname && person.birthSurname !== person.surname && (
                <p className="mt-1 font-serif text-[15px] text-muted italic">
                  born {person.birthSurname}
                </p>
              )}
              <dl className="mt-3 grid gap-0.5 text-[14px] text-muted">
                {born && (
                  <div>
                    <dt className="inline">Born </dt>
                    <dd className="tabular inline text-ink">{born}</dd>
                  </div>
                )}
                {person.died && (
                  <div>
                    <dt className="inline">Died </dt>
                    <dd className="tabular inline text-ink">{died || 'date not known'}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" icon="edit" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {focusId !== person.id && (
                  <Button size="sm" icon="tree" onClick={() => onFocus(person.id)}>
                    Show in tree
                  </Button>
                )}
                {homeId !== person.id && (
                  <Button
                    size="sm"
                    icon="star"
                    onClick={() =>
                      session.apply([{ type: 'updateTree', patch: { homePersonId: person.id } }])
                    }
                  >
                    Make Home person
                  </Button>
                )}
              </div>
            </header>

            <section className="mt-8">
              {person.story ? (
                <div
                  className="story font-serif text-[17px] leading-[1.65] text-ink"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown escapes all HTML
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(person.story) }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full rounded-2xl border border-dashed border-line px-5 py-6 text-center text-[15px] text-muted transition-colors hover:border-accent hover:text-ink"
                >
                  <span className="display block text-[19px] text-ink">
                    Write {person.firstNames}'s story
                  </span>
                  <span className="mt-1 block">
                    Achievements, memories, anything worth keeping.
                  </span>
                </button>
              )}
            </section>

            <Section
              title="Parents"
              onAdd={() => onAdd('parent', person.id)}
              addLabel="Add a parent"
            >
              {family.parents.map((link) => (
                <RelativeRow
                  key={link.id}
                  person={index.people.get(link.parentId)}
                  onFocus={onGo}
                  note={link.kind !== 'birth' ? KIND_LABEL[link.kind] : undefined}
                  menu={
                    <LinkMenu
                      kind={link.kind}
                      onKind={(kind) =>
                        session.apply([{ type: 'updateParentLink', id: link.id, kind }])
                      }
                      onRemove={() => session.apply([{ type: 'removeParentLink', id: link.id }])}
                    />
                  }
                />
              ))}
            </Section>

            <Section
              title="Partners"
              onAdd={() => onAdd('partner', person.id)}
              addLabel="Add a partner"
            >
              {family.partners.map((entry) => {
                const p = entry.partnership
                const detail = p
                  ? [
                      p.married ? 'Married' : 'Partners',
                      lifeLine(p.startDate, p.startPlace),
                      p.ended
                        ? p.married
                          ? `divorced ${lifeLine(p.endDate, '')}`.trim()
                          : `separated ${lifeLine(p.endDate, '')}`.trim()
                        : '',
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : 'Parent of a child together'
                return (
                  <RelativeRow
                    key={entry.partnerId}
                    person={index.people.get(entry.partnerId)}
                    onFocus={onGo}
                    note={detail}
                    noteOnly
                    menu={
                      p ? (
                        <IconButton
                          icon="edit"
                          label="Edit partnership"
                          size={32}
                          onClick={() => setPartnershipId(p.id)}
                        />
                      ) : (
                        <IconButton
                          icon="link"
                          label="Record as partners"
                          size={32}
                          onClick={() =>
                            session.apply([
                              {
                                type: 'addPartnership',
                                partnership: { personAId: person.id, personBId: entry.partnerId },
                              },
                            ])
                          }
                        />
                      )
                    }
                  />
                )
              })}
            </Section>

            <Section
              title="Children"
              onAdd={() => onAdd('child', person.id)}
              addLabel="Add a child"
            >
              {family.children.map((link) => (
                <RelativeRow
                  key={link.id}
                  person={index.people.get(link.childId)}
                  onFocus={onGo}
                  note={link.kind !== 'birth' ? KIND_LABEL[link.kind] : undefined}
                  menu={
                    <LinkMenu
                      kind={link.kind}
                      onKind={(kind) =>
                        session.apply([{ type: 'updateParentLink', id: link.id, kind }])
                      }
                      onRemove={() => session.apply([{ type: 'removeParentLink', id: link.id }])}
                    />
                  }
                />
              ))}
            </Section>

            {family.siblings.length > 0 && (
              <Section title="Siblings">
                {family.siblings.map((s) => (
                  <RelativeRow
                    key={s.id}
                    person={index.people.get(s.id)}
                    onFocus={onGo}
                    note={
                      s.sharedParentIds.length < family.parents.length ? 'Half sibling' : undefined
                    }
                  />
                ))}
              </Section>
            )}

            <div className="mt-10 border-t border-line pt-5">
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
              >
                Delete {person.firstNames}
              </Button>
            </div>
          </>
        )}
      </div>

      {partnershipId && (
        <PartnershipDialog
          session={session}
          partnershipId={partnershipId}
          onClose={() => setPartnershipId(null)}
        />
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} label="Delete person">
        <h2 className="display text-[26px]">Delete {displayName(person)}?</h2>
        <p className="mt-2 text-[15px] text-muted">
          This removes {person.firstNames} and every link to their parents, partners and children.
          You cannot undo this.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button
            variant="primary"
            className="!bg-danger"
            onClick={() => {
              setConfirmDelete(false)
              session.apply([{ type: 'deletePerson', id: person.id }])
              onClose()
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </aside>
  )
}

function Section({
  title,
  children,
  onAdd,
  addLabel,
}: {
  title: string
  children: ReactNode
  onAdd?: () => void
  addLabel?: string
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-[19px] font-medium">{title}</h3>
        {onAdd && <IconButton icon="plus" label={addLabel ?? 'Add'} size={32} onClick={onAdd} />}
      </div>
      {items.length ? (
        <ul className="-mx-2">{children}</ul>
      ) : (
        <p className="text-[14px] text-faint">Nobody added yet.</p>
      )}
    </section>
  )
}

function RelativeRow({
  person,
  note,
  menu,
  noteOnly = false,
  onFocus,
}: {
  person: Person | undefined
  note?: string | undefined
  menu?: ReactNode
  noteOnly?: boolean
  onFocus: (id: string) => void
}) {
  if (!person) return null
  return (
    <li className="flex items-center gap-1 rounded-2xl pr-1 hover:bg-sunken">
      <button
        type="button"
        onClick={() => onFocus(person.id)}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
      >
        <Portrait person={person} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-serif text-[15.5px]">{displayName(person)}</span>
          <span className="block truncate text-[12.5px] text-faint">
            {noteOnly ? note : [note, lifespan(person)].filter(Boolean).join(', ')}
          </span>
        </span>
      </button>
      {menu}
    </li>
  )
}

function LinkMenu({
  kind,
  onKind,
  onRemove,
}: {
  kind: ParentKind
  onKind: (kind: ParentKind) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <IconButton
        icon="more"
        label="Change link"
        size={32}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-2xl bg-surface p-1.5 shadow-float ring-1 ring-line">
            {PARENT_KINDS.map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => {
                  setOpen(false)
                  try {
                    onKind(k)
                  } catch (error) {
                    toastError(error)
                  }
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-sunken"
              >
                {KIND_LABEL[k]}
                {k === kind && <Icon name="check" size={15} className="text-accent" />}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              Remove link
            </button>
          </div>
        </>
      )}
    </div>
  )
}
