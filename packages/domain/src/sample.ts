import { applyCommand, emptyTree } from './ops.ts'
import type { Command, Gender, ParentKind, TreeData } from './types.ts'

type P = [
  id: string,
  firstNames: string,
  surname: string,
  gender: Gender,
  born: string,
  bornPlace: string,
  died?: string,
  story?: string,
  birthSurname?: string,
]

const PEOPLE: P[] = [
  [
    'arthur',
    'Arthur',
    'Hale',
    'male',
    '1921-04-02',
    'Cork',
    '1994-11-20',
    'Ran the village bakery for 41 years. Up at **4 every morning**, and he never missed a day.',
  ],
  [
    'rose',
    'Rose',
    'Hale',
    'female',
    '1924',
    'Galway',
    '2009-02-14',
    'Taught piano to half the town. Her *Clair de Lune* could stop a room.',
    'Byrne',
  ],
  [
    'walter',
    'Walter',
    'Quinn',
    'male',
    '~1918',
    'Belfast',
    '1980',
    'Shipwright at Harland & Wolff.',
  ],
  ['edith', 'Edith', 'Quinn', 'female', '1922-09', 'Belfast', '2015-06-01', '', 'Shaw'],
  [
    'thomas',
    'Thomas Arthur',
    'Hale',
    'male',
    '1950-06-18',
    'Cork',
    '',
    'Engineer. Built bridges in three countries.\n\n- First in the family to go to university\n- Ran the Dublin marathon at 60',
  ],
  ['margaret', 'Margaret', 'Doyle', 'female', '1952-01-30', 'Limerick'],
  [
    'helen',
    'Helen',
    'Hale',
    'female',
    '1954-11-03',
    'Belfast',
    '',
    'Nurse for 35 years. Loves sea swimming, all year round.',
    'Quinn',
  ],
  [
    'clare',
    'Clare',
    'Hale',
    'female',
    '1955-03-12',
    'Cork',
    '',
    'Painter. Lives by the sea in Kinsale.',
  ],
  ['sean', 'Seán', 'Murphy', 'male', '1953', 'Kerry', '2020-03'],
  [
    'daniel',
    'Daniel',
    'Hale',
    'male',
    '1976-08-09',
    'Dublin',
    '',
    'Chef. Opened his own restaurant in 2012.',
  ],
  [
    'sarah',
    'Sarah',
    'Hale',
    'female',
    '1984-02-21',
    'Dublin',
    '',
    'Marine biologist. Has dived on every continent.',
  ],
  [
    'james',
    'James',
    'Hale',
    'male',
    '1987-07-15',
    'Dublin',
    '',
    'Adopted at age two. Music teacher, like his great-grandmother Rose.',
  ],
  ['aoife', 'Aoife', 'Murphy', 'female', '1980-05-05', 'Cork', '', 'Architect.'],
  ['lena', 'Lena', 'Hale', 'female', '1979', 'Berlin', ''],
  [
    'noah',
    'Noah',
    'Hale',
    'male',
    '2008-10-01',
    'Dublin',
    '',
    'Plays hurling for the county under-18s.',
  ],
  ['mia', 'Mia', 'Hale', 'female', '2011-12-24', 'Dublin', '', 'Born on Christmas Eve.'],
  ['ella', 'Ella', 'Brennan', 'female', '2014-04-04', 'Cork'],
]

const LINKS: [child: string, parent: string, kind?: ParentKind][] = [
  ['thomas', 'arthur'],
  ['thomas', 'rose'],
  ['clare', 'arthur'],
  ['clare', 'rose'],
  ['helen', 'walter'],
  ['helen', 'edith'],
  ['daniel', 'thomas'],
  ['daniel', 'margaret'],
  ['sarah', 'thomas'],
  ['sarah', 'helen'],
  ['james', 'thomas', 'adopted'],
  ['james', 'helen', 'adopted'],
  ['aoife', 'clare'],
  ['aoife', 'sean'],
  ['noah', 'daniel'],
  ['noah', 'lena'],
  ['mia', 'daniel'],
  ['mia', 'lena'],
  ['ella', 'aoife'],
]

const PARTNERS: [a: string, b: string, married: boolean, start: string, end?: string][] = [
  ['arthur', 'rose', true, '1948-05-22'],
  ['walter', 'edith', true, '1946'],
  ['thomas', 'margaret', true, '1974-09-07', '1981'],
  ['thomas', 'helen', true, '1983-06-11'],
  ['clare', 'sean', false, '1978'],
  ['daniel', 'lena', true, '2006-07-01'],
]

export function sampleFamily(): TreeData {
  const commands: Command[] = [
    ...PEOPLE.map(
      ([id, firstNames, surname, gender, bornDate, bornPlace, diedDate, story, birthSurname]) =>
        ({
          type: 'addPerson',
          person: {
            id,
            firstNames,
            surname,
            gender,
            bornDate,
            bornPlace,
            diedDate: diedDate ?? '',
            story: story ?? '',
            birthSurname: birthSurname ?? '',
          },
        }) satisfies Command,
    ),
    ...LINKS.map(
      ([childId, parentId, kind]) =>
        ({
          type: 'addParentLink',
          link: { childId, parentId, kind: kind ?? 'birth' },
        }) satisfies Command,
    ),
    ...PARTNERS.map(
      ([personAId, personBId, married, startDate, endDate]) =>
        ({
          type: 'addPartnership',
          partnership: { personAId, personBId, married, startDate, endDate: endDate ?? '' },
        }) satisfies Command,
    ),
    { type: 'updateTree', patch: { homePersonId: 'daniel' } },
  ]
  return commands.reduce(
    (data, command) => applyCommand(data, command).data,
    emptyTree({ name: 'The Hale family' }),
  )
}
