import type { Person } from '@familytree/domain'
import { initials, tintFor } from '../lib/people.ts'

export function Portrait({ person, size }: { person: Person; size: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${tintFor(person)} 28%, var(--surface))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${tintFor(person)} 70%, transparent), 0 0 0 3px var(--surface)`,
      }}
    >
      {person.photo ? (
        <img
          src={person.photo}
          alt=""
          draggable={false}
          className={`h-full w-full object-cover ${person.died ? 'saturate-[0.6] sepia-[0.15]' : ''}`}
        />
      ) : (
        <span
          className="display italic text-ink/75"
          style={{
            fontSize: size * 0.38,
            fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72',
          }}
        >
          {initials(person)}
        </span>
      )}
    </span>
  )
}
