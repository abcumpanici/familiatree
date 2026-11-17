import { api } from '../lib/api.ts'
import { readBrowserTrees } from '../lib/idb.ts'
import { toast } from '../lib/toast.ts'

let moving: Promise<void> | null = null

export function moveBrowserTrees(): Promise<void> {
  moving ??= move().catch(() => {})
  return moving
}

async function move() {
  const browser = await readBrowserTrees()
  if (!browser) return
  try {
    if (browser.trees.length === 0) return
    const { toExportFile } = await import('@familytree/domain/schema')
    let moved = 0
    let failed = 0
    for (const data of browser.trees) {
      try {
        await api('/api/trees/import', { method: 'POST', body: toExportFile(data) })
      } catch {
        failed++
        continue
      }
      await browser.remove(data.tree.id)
      moved++
    }
    const trees = (n: number) => (n === 1 ? '1 tree' : `${n} trees`)
    if (moved > 0) toast(`Moved ${trees(moved)} from this browser to the server`)
    if (failed > 0) {
      toast(
        `Could not move ${trees(failed)} from this browser to the server. We will try again next time.`,
        'error',
      )
    }
  } finally {
    browser.close()
  }
}
