import {
  applyCommand,
  buildIndex,
  type Command,
  type Person,
  type TreeData,
  type TreeIndex,
} from '@familytree/domain'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '../lib/api.ts'
import { toastError } from '../lib/toast.ts'
import { loadTree, treesChanged } from './trees.ts'

export class TreeSession {
  data: TreeData
  index: TreeIndex
  private listeners = new Set<() => void>()
  private queue: Promise<unknown> = Promise.resolve()
  private pending = 0
  saving = false

  constructor(data: TreeData) {
    this.data = data
    this.index = buildIndex(data)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.index

  getSaving = () => this.saving

  private track(delta: number) {
    this.pending += delta
    const saving = this.pending > 0
    if (saving !== this.saving) {
      this.saving = saving
      for (const l of this.listeners) l()
    }
  }

  private set(data: TreeData) {
    this.data = data
    this.index = buildIndex(data)
    for (const l of this.listeners) l()
  }

  person(id: string): Person | undefined {
    return this.index.people.get(id)
  }

  apply(commands: Command[]): TreeData {
    const before = this.data
    const next = commands.reduce((d, c) => applyCommand(d, c).data, before)
    this.set(next)
    const persist = () =>
      api<{ data: TreeData }>(`/api/trees/${next.tree.id}/commands`, {
        method: 'POST',
        body: { commands },
      }).then(({ data }) => {
        if (this.data === next) this.set(data)
      })
    this.track(1)
    this.queue = this.queue
      .then(persist)
      .then(treesChanged)
      .catch((error: unknown) => {
        toastError(error)
        if (this.data === next) this.set(before)
      })
      .finally(() => this.track(-1))
    return next
  }

  async setPhoto(personId: string, blob: Blob | null) {
    const path = `/api/trees/${this.data.tree.id}/people/${personId}/photo`
    await this.queue
    const person = blob
      ? await api<Person>(path, { method: 'PUT', body: blob })
      : await api<Person>(path, { method: 'DELETE' })
    this.set({
      ...this.data,
      people: this.data.people.map((p) => (p.id === person.id ? person : p)),
    })
  }
}

export function useTreeSession(id: string) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'missing' }
    | { status: 'error'; message: string }
    | { status: 'ready'; session: TreeSession }
  >({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    loadTree(id)
      .then((data) => {
        if (alive) setState({ status: 'ready', session: new TreeSession(data) })
      })
      .catch((error: unknown) => {
        if (!alive) return
        const status = (error as { status?: number }).status
        if (status === 404) setState({ status: 'missing' })
        else
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      alive = false
    }
  }, [id])
  return state
}

export function useTreeIndex(session: TreeSession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}

export function useSaving(session: TreeSession) {
  return useSyncExternalStore(session.subscribe, session.getSaving)
}
