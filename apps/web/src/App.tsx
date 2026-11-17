import { type ReactNode, useEffect } from 'react'
import { treePath, useTreeList } from './data/trees.ts'
import { getPrefs } from './lib/prefs.ts'
import { navigate, useLocation } from './lib/router.ts'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { TreePage } from './pages/TreePage.tsx'
import { TreesPage } from './pages/TreesPage.tsx'
import { Welcome } from './pages/Welcome.tsx'
import { LoadError } from './ui/LoadError.tsx'
import { Toaster } from './ui/Toaster.tsx'

const OLD_TREE_PATH = /^\/t\/(synced|device)\/([A-Za-z0-9_-]+)$/

export function App() {
  const location = useLocation()
  const url = new URL(location, window.location.origin)
  const path = url.pathname
  const search = url.search
  const tree = /^\/t\/([A-Za-z0-9_-]+)$/.exec(path)
  const old = OLD_TREE_PATH.test(path)
  useEffect(() => {
    const match = OLD_TREE_PATH.exec(path)
    if (!match) return
    const to = match[1] === 'synced' ? `${treePath(match[2] as string)}${search}` : '/trees'
    navigate(to, { replace: true, transition: false })
  }, [path, search])
  let page: ReactNode
  if (tree) page = <TreePage key={path} id={tree[1] as string} search={url.searchParams} />
  else if (old) page = <div className="paper-grain h-full" />
  else if (path === '/trees') page = <TreesPage />
  else if (path === '/settings') page = <SettingsPage />
  else page = <Home />
  return (
    <>
      {page}
      <Toaster />
    </>
  )
}

function Home() {
  const { trees, error, reload } = useTreeList()
  useEffect(() => {
    if (!trees) return
    const last = getPrefs().lastTree
    const target = trees.find((t) => t.id === last) ?? trees[0]
    if (target) navigate(treePath(target.id), { replace: true, transition: false })
  }, [trees])
  if (error && !trees) return <LoadError message={error} onRetry={reload} />
  if (!trees || trees.length > 0) return <div className="paper-grain h-full" />
  return <Welcome />
}
