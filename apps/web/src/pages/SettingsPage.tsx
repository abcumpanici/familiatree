import type { ReactNode } from 'react'
import { PALETTES, setPrefs, type ThemePref, usePrefs } from '../lib/prefs.ts'
import { navigate } from '../lib/router.ts'
import { IconButton, Segmented } from '../ui/controls.tsx'

export function SettingsPage() {
  const prefs = usePrefs()
  return (
    <main className="paper-grain min-h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-16 md:px-8">
        <IconButton
          icon="back"
          label="Back"
          onClick={() => (history.length > 1 ? history.back() : navigate('/trees'))}
          className="-ml-2"
        />
        <h1 className="display mt-6 text-[clamp(36px,6vw,52px)] leading-none">Settings</h1>

        <Group title="Look">
          <div className="grid grid-cols-3 gap-3">
            {PALETTES.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPrefs({ palette: p.id })}
                aria-pressed={prefs.palette === p.id}
                className={`rounded-2xl p-3 text-left ring-1 transition-shadow ${prefs.palette === p.id ? 'ring-2 ring-accent' : 'ring-line hover:ring-faint'}`}
                style={{ background: p.swatch[0] }}
              >
                <span className="flex gap-1">
                  <span className="h-6 w-6 rounded-full" style={{ background: p.swatch[1] }} />
                  <span className="h-6 w-6 rounded-full" style={{ background: p.swatch[2] }} />
                </span>
                <span className="mt-3 block font-serif text-[15px]" style={{ color: p.swatch[2] }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Segmented<ThemePref>
              label="Theme"
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: 'system', label: 'Match device' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </Group>

        <Group title="For agents">
          <p className="text-[15px] leading-relaxed text-muted">
            AI agents and scripts can read and change your trees through the API. They need no key.
            Give your agent the{' '}
            <a className="text-accent underline underline-offset-2" href="/llms.txt">
              agent guide
            </a>
            . The full{' '}
            <a className="text-accent underline underline-offset-2" href="/api/docs">
              API reference
            </a>{' '}
            is also here.
          </p>
        </Group>

        <Group title="About">
          <p className="text-[15px] leading-relaxed text-muted">
            Free and open source under the AGPL-3.0 licence. This copy is open to everyone who can
            reach it. Anyone who can open this site can see and change every tree in it.
          </p>
        </Group>
      </div>
    </main>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-[22px] font-medium">{title}</h2>
      <div className="rounded-3xl bg-surface p-5 shadow-lift ring-1 ring-line/60">{children}</div>
    </section>
  )
}
