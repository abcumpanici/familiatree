import { sampleFamily, type Tree, type TreeData } from '@familytree/domain'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.ts'
import { moveBrowserTrees } from './browserTrees.ts'

export interface TreeSummary {
  id: string
  name: string
  peopleCount: number
  updatedAt: string
}

export const treePath = (id: string) => `/t/${id}`

const schema = () => import('@familytree/domain/schema')

const changeListeners = new Set<() => void>()
export function treesChanged() {
  for (const l of changeListeners) l()
}

async function loadSummaries(): Promise<TreeSummary[]> {
  await moveBrowserTrees()
  const trees = await api<(Tree & { peopleCount: number })[]>('/api/trees')
  return trees
    .map((t) => ({ id: t.id, name: t.name, peopleCount: t.peopleCount, updatedAt: t.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function useTreeList() {
  const [trees, setTrees] = useState<TreeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    loadSummaries()
      .then((list) => {
        setTrees(list)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(() => {
    reload()
    changeListeners.add(reload)
    return () => {
      changeListeners.delete(reload)
    }
  }, [reload])
  return { trees, error, reload }
}

export async function importExportFile(file: unknown): Promise<string> {
  const data = await api<TreeData>('/api/trees/import', { method: 'POST', body: file })
  treesChanged()
  return data.tree.id
}

export async function createTree(name: string, example = false): Promise<string> {
  if (example) {
    const { toExportFile } = await schema()
    return importExportFile(toExportFile(sampleFamily()))
  }
  const tree = await api<Tree>('/api/trees', { method: 'POST', body: { name } })
  treesChanged()
  return tree.id
}

export function loadTree(id: string): Promise<TreeData> {
  return api<TreeData>(`/api/trees/${id}`)
}

export async function deleteTree(id: string) {
  await api(`/api/trees/${id}`, { method: 'DELETE' })
  treesChanged()
}

export async function renameTree(id: string, name: string) {
  await api(`/api/trees/${id}`, { method: 'PATCH', body: { name } })
  treesChanged()
}

export function exportFile(id: string) {
  return api<unknown>(`/api/trees/${id}/export`)
}

export async function exportGedcom(id: string, name: string) {
  const text = await api<string>(`/api/trees/${id}/export.ged`, { raw: true })
  return { name, text }
}

export async function importFile(file: File): Promise<string> {
  const text = await file.text()
  const isGedcom = /\.ged$/i.test(file.name) || /^﻿?\s*0\s+HEAD/.test(text)
  if (isGedcom) {
    const name = file.name.replace(/\.[^.]+$/, '')
    const result = await api<{ data: TreeData }>(
      `/api/trees/import/gedcom?name=${encodeURIComponent(name)}`,
      { method: 'POST', body: text },
    )
    treesChanged()
    return result.data.tree.id
  }
  return importExportFile(JSON.parse(text))
}
