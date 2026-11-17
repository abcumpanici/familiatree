import { displayName } from '@familytree/domain'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { type TreeSession, useSaving, useTreeIndex, useTreeSession } from '../data/session.ts'
import { setPrefs } from '../lib/prefs.ts'
import { navigate, setSearchParams } from '../lib/router.ts'
import { AddRelativeDialog, SearchDialog } from '../person/AddRelative.tsx'
import { PersonPanel } from '../person/PersonPanel.tsx'
import type { AddKind } from '../tree/PersonCard.tsx'
import { type CanvasHandle, TreeCanvas } from '../tree/TreeCanvas.tsx'
import { Button, IconButton } from '../ui/controls.tsx'
import { Icon } from '../ui/Icon.tsx'
import { LoadError } from '../ui/LoadError.tsx'

export function TreePage({ id, search }: { id: string; search: URLSearchParams }) {
  const state = useTreeSession(id)
  useEffect(() => {
    setPrefs({ lastTree: id })
  }, [id])
  if (state.status === 'loading') return <div className="paper-grain h-full" />
  if (state.status !== 'ready') {
    const missing = state.status === 'missing'
    return (
      <LoadError
        title={missing ? 'This tree is not here' : 'The tree did not load'}
        message={missing ? 'It may have been deleted.' : state.message}
        onRetry={missing ? undefined : () => location.reload()}
        action={
          <Button
            variant={missing ? 'primary' : 'secondary'}
            onClick={() => {
              setPrefs({ lastTree: null })
              navigate('/trees')
            }}
          >
            See my trees
          </Button>
        }
      />
    )
  }
  return <TreeView session={state.session} search={search} />
}

function TreeView({ session, search }: { session: TreeSession; search: URLSearchParams }) {
  const index = useTreeIndex(session)
  const saving = useSaving(session)
  const tree = index.data.tree
  const canvas = useRef<CanvasHandle>(null)
  const requested = search.get('p')
  const focusId =
    requested && index.people.has(requested)
      ? requested
      : (tree.homePersonId ?? index.data.people[0]?.id ?? null)
  const selected = search.get('open')
  const selectedId = selected && index.people.has(selected) ? selected : null
  const [adding, setAdding] = useState<{ kind: AddKind | 'first'; anchorId: string | null } | null>(
    null,
  )
  const [searching, setSearching] = useState(false)

  const focus = useCallback(
    (personId: string) => setSearchParams({ p: personId }, { push: true }),
    [],
  )
  const goTo = useCallback(
    (personId: string) => setSearchParams({ p: personId, open: personId }, { push: true }),
    [],
  )
  const open = useCallback(
    (personId: string) => {
      if (selectedId) setSearchParams({ open: personId })
      else setSearchParams({ open: personId }, { push: true, state: { panel: true } })
    },
    [selectedId],
  )
  const close = useCallback(() => {
    if ((history.state as { panel?: boolean } | null)?.panel) history.back()
    else setSearchParams({ open: null })
  }, [])
  const wide = useMedia('(min-width: 768px)')
  const onAdd = useCallback((kind: AddKind, anchorId: string) => setAdding({ kind, anchorId }), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative h-full overflow-hidden">
      {focusId ? (
        <TreeCanvas
          ref={canvas}
          index={index}
          focusId={focusId}
          selectedId={selectedId}
          homeId={tree.homePersonId}
          onOpen={open}
          insetRight={selectedId && wide ? 444 : 0}
        />
      ) : (
        <EmptyTree name={tree.name} onStart={() => setAdding({ kind: 'first', anchorId: null })} />
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-1 rounded-full bg-surface/90 py-1 pr-4 pl-1 shadow-lift ring-1 ring-line/60 backdrop-blur">
          <IconButton icon="back" label="My trees" onClick={() => navigate('/trees')} />
          <span className="min-w-0">
            <span className="block truncate font-serif text-[16px] leading-tight font-semibold">
              {tree.name}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-muted">
              {index.people.size} {index.people.size === 1 ? 'person' : 'people'}
              {saving && (
                <span role="status" className="ml-1 text-accent">
                  Saving…
                </span>
              )}
            </span>
          </span>
        </div>
        <div
          className={`pointer-events-auto flex gap-1 rounded-full bg-surface/90 p-1 shadow-lift ring-1 ring-line/60 backdrop-blur transition-[margin] duration-300 ${selectedId ? 'md:mr-[428px]' : ''}`}
        >
          <IconButton
            icon="search"
            label="Find a person (Ctrl K)"
            onClick={() => setSearching(true)}
            disabled={!focusId}
          />
          <IconButton icon="settings" label="Settings" onClick={() => navigate('/settings')} />
        </div>
      </header>

      {focusId && (
        <div className="absolute bottom-4 left-3 z-20 flex flex-col gap-1 rounded-full bg-surface/90 p-1 shadow-lift ring-1 ring-line/60 backdrop-blur sm:left-4">
          <IconButton icon="zoomIn" label="Zoom in" onClick={() => canvas.current?.zoomIn()} />
          <IconButton icon="zoomOut" label="Zoom out" onClick={() => canvas.current?.zoomOut()} />
          <IconButton icon="focus" label="Show everyone" onClick={() => canvas.current?.fit()} />
          <IconButton
            icon="home"
            label="Go to the Home person"
            onClick={() => {
              if (tree.homePersonId && tree.homePersonId !== focusId) {
                setSearchParams({ p: tree.homePersonId, open: null }, { push: true })
              } else {
                if (selectedId) close()
                canvas.current?.recenter()
              }
            }}
          />
        </div>
      )}

      {selectedId && (
        <PersonPanel
          key="panel"
          session={session}
          index={index}
          personId={selectedId}
          homeId={tree.homePersonId}
          focusId={focusId}
          onClose={close}
          onFocus={focus}
          onGo={goTo}
          onAdd={onAdd}
        />
      )}

      {adding && (
        <AddRelativeDialog
          session={session}
          index={index}
          kind={adding.kind}
          anchorId={adding.anchorId}
          onClose={() => setAdding(null)}
          onAdded={(pid) => {
            if (adding.kind === 'first') setSearchParams({ p: pid })
          }}
        />
      )}

      {searching && (
        <SearchDialog index={index} onClose={() => setSearching(false)} onPick={goTo} />
      )}
      <span className="sr-only" aria-live="polite">
        {focusId
          ? `Showing the family of ${displayName(index.people.get(focusId) ?? { firstNames: '', surname: '' })}`
          : ''}
      </span>
    </div>
  )
}

function EmptyTree({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <div className="paper-grain flex h-full flex-col items-center justify-center px-6 text-center">
      <button
        type="button"
        onClick={onStart}
        className="group flex h-[88px] w-[220px] items-center gap-3 rounded-[24px] border-2 border-dashed border-line bg-surface/60 px-3 text-left transition-colors hover:border-accent"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink transition-transform group-hover:scale-105">
          <Icon name="plus" size={24} />
        </span>
        <span className="font-serif text-[17px] leading-tight">Add the first person</span>
      </button>
      <h1 className="display mt-10 max-w-md text-[30px] leading-tight">{name}</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">
        Start with yourself, or with the oldest person you know about. Then add parents, partners
        and children around them.
      </p>
    </div>
  )
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    },
    () => window.matchMedia(query).matches,
  )
}
