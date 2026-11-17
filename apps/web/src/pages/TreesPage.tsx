import { type FormEvent, type ReactNode, useState } from 'react'
import {
  createTree,
  deleteTree,
  exportFile,
  exportGedcom,
  importFile,
  renameTree,
  type TreeSummary,
  treePath,
  useTreeList,
} from '../data/trees.ts'
import { download, pickFile, safeFileName } from '../lib/download.ts'
import { navigate } from '../lib/router.ts'
import { toast, toastError } from '../lib/toast.ts'
import { Button, Field, IconButton, Switch, TextInput } from '../ui/controls.tsx'
import { Icon } from '../ui/Icon.tsx'
import { LoadError } from '../ui/LoadError.tsx'
import { Dialog } from '../ui/Overlay.tsx'

export function TreesPage() {
  const { trees, error, reload } = useTreeList()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  if (error && !trees) return <LoadError message={error} onRetry={reload} />

  return (
    <main className="paper-grain min-h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 pt-6 pb-16 md:px-8">
        <nav className="flex items-center justify-between">
          <span className="display text-[22px]">My trees</span>
          <IconButton icon="settings" label="Settings" onClick={() => navigate('/settings')} />
        </nav>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-[clamp(36px,6vw,56px)] leading-none">Your families</h1>
          <div className="flex gap-2">
            <Button icon="upload" onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              New tree
            </Button>
          </div>
        </div>
        {error && <p className="mt-6 text-danger">{error}</p>}
        {trees === null ? null : trees.length === 0 ? (
          <div className="mt-12 rounded-3xl border-2 border-dashed border-line p-10 text-center">
            <p className="display text-[24px]">No trees yet</p>
            <p className="mt-2 text-muted">Start a new tree or import a file from another app.</p>
            <Button
              className="mt-6"
              variant="primary"
              icon="plus"
              onClick={() => setCreating(true)}
            >
              New tree
            </Button>
          </div>
        ) : (
          <ul className="mt-10 grid gap-3">
            {trees.map((t) => (
              <TreeRow key={t.id} tree={t} />
            ))}
          </ul>
        )}
      </div>
      {creating && <NewTreeDialog onClose={() => setCreating(false)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </main>
  )
}

function NewTreeDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [example, setExample] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const id = await createTree(name.trim() || 'My family', example)
      navigate(treePath(id))
    } catch (error) {
      toastError(error)
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} label="New tree">
      <form onSubmit={submit} className="grid gap-5">
        <h2 className="display text-[26px]">New tree</h2>
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              autoFocus
              placeholder="e.g. The Popa family"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Switch label="Start with the example family" checked={example} onChange={setExample} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Create tree
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const choose = async () => {
    const file = await pickFile('.json,.ged,application/json,text/plain')
    if (!file) return
    setBusy(true)
    try {
      const id = await importFile(file)
      toast('Tree imported')
      navigate(treePath(id))
    } catch (error) {
      toastError(
        error instanceof SyntaxError ? new Error('This file is not a family tree file') : error,
      )
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} label="Import a tree">
      <div className="grid gap-5">
        <h2 className="display text-[26px]">Import a tree</h2>
        <p className="text-[15px] text-muted">
          Choose a file exported from this app (.json), or a GEDCOM file (.ged) from another family
          tree app. The import makes a new tree.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="upload" disabled={busy} onClick={choose}>
            Choose a file
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function TreeRow({ tree }: { tree: TreeSummary }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState(tree.name)
  const run = async (fn: () => Promise<unknown>) => {
    setMenu(false)
    try {
      await fn()
    } catch (error) {
      toastError(error)
    }
  }
  const updated = new Date(tree.updatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (
    <li className="group relative flex items-center gap-2 rounded-3xl bg-surface pr-2 shadow-lift ring-1 ring-line/60 transition-shadow hover:shadow-float">
      <button
        type="button"
        onClick={() => navigate(treePath(tree.id))}
        className="flex min-w-0 flex-1 items-center gap-4 p-5 text-left"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="tree" size={22} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-[20px] font-medium">{tree.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {tree.peopleCount} {tree.peopleCount === 1 ? 'person' : 'people'}, changed {updated}
          </span>
        </span>
      </button>
      <IconButton
        icon="more"
        label={`Options for ${tree.name}`}
        onClick={() => setMenu((m) => !m)}
        aria-expanded={menu}
      />
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute top-14 right-2 z-20 w-60 rounded-2xl bg-surface p-1.5 shadow-float ring-1 ring-line">
            <MenuItem
              icon="edit"
              onClick={() => {
                setMenu(false)
                setRenaming(true)
              }}
            >
              Rename
            </MenuItem>
            <MenuItem
              icon="download"
              onClick={() =>
                run(async () => {
                  const file = await exportFile(tree.id)
                  download(
                    `${safeFileName(tree.name)}.json`,
                    JSON.stringify(file, null, 2),
                    'application/json',
                  )
                })
              }
            >
              Download a copy (.json)
            </MenuItem>
            <MenuItem
              icon="download"
              onClick={() =>
                run(async () => {
                  const { name: n, text } = await exportGedcom(tree.id, tree.name)
                  download(`${safeFileName(n)}.ged`, text, 'text/plain')
                })
              }
            >
              Export GEDCOM (.ged)
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            <MenuItem
              icon="trash"
              danger
              onClick={() => {
                setMenu(false)
                setDeleting(true)
              }}
            >
              Delete
            </MenuItem>
          </div>
        </>
      )}
      <Dialog open={renaming} onClose={() => setRenaming(false)} label="Rename tree">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            setRenaming(false)
            void run(() => renameTree(tree.id, name.trim() || tree.name))
          }}
        >
          <h2 className="display text-[26px]">Rename tree</h2>
          <Field label="Name">
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={deleting} onClose={() => setDeleting(false)} label="Delete tree">
        <h2 className="display text-[26px]">Delete {tree.name}?</h2>
        <p className="mt-2 text-[15px] text-muted">
          This deletes the tree and all {tree.peopleCount} people in it. You cannot undo this.
          Download a copy first if you want to keep it.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-danger"
            onClick={() => {
              setDeleting(false)
              void run(async () => {
                await deleteTree(tree.id)
                toast('Tree deleted')
              })
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </li>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: 'edit' | 'download' | 'trash'
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm ${danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-sunken'}`}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  )
}
