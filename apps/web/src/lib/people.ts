import { ageOf, dateParts, formatDate, type Person } from '@familytree/domain'

function yearLabel(date: string) {
  const parts = dateParts(date)
  if (!parts) return ''
  return `${parts.approx ? 'c. ' : ''}${parts.year}`
}

export function lifespan(p: Person): string {
  const born = yearLabel(p.bornDate)
  const died = yearLabel(p.diedDate)
  if (p.died) return `${born || '?'} – ${died || '?'}`
  return born ? `Born ${born}` : ''
}

export function initials(p: Pick<Person, 'firstNames' | 'surname'>): string {
  const first = p.firstNames.trim()[0] ?? ''
  const last = p.surname.trim()[0] ?? p.firstNames.trim().split(/\s+/)[1]?.[0] ?? ''
  return (first + last).toUpperCase()
}

export function lifeLine(date: string, place: string): string {
  return [formatDate(date), place].filter(Boolean).join(', ')
}

export function tintFor(p: Person): string {
  if (p.gender === 'female') return 'var(--tint-a)'
  if (p.gender === 'male') return 'var(--tint-b)'
  return 'var(--tint-c)'
}

export function shortPlace(place: string): string {
  return place.split(',')[0]?.trim() ?? ''
}

export function birthLine(p: Person): string {
  const born = yearLabel(p.bornDate)
  const place = shortPlace(p.bornPlace)
  if (!born && !place) return ''
  return [born ? `Born ${born}` : 'Born', place].filter(Boolean).join(', ')
}

export function ageLabel(p: Person): string {
  const age = ageOf(p.bornDate, p.died ? p.diedDate || null : '')
  const known = age && age.years >= 0 ? age : null
  const years = known ? `${known.approx ? 'about ' : ''}${known.years}` : ''
  if (p.died) {
    const died = yearLabel(p.diedDate)
    if (died && known) return `Died ${died}, ${known.approx ? 'about' : 'aged'} ${known.years}`
    return died ? `Died ${died}` : 'Died'
  }
  return years ? `Age ${years}` : ''
}
