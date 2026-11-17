---

name: familytree-api
description: Read and change a family tree on a Family Tree server through its REST API. Use when asked to add, find, link or update relatives (parents, children, partners, marriages, deaths, stories) in a tree.
---

# Family Tree REST API

Base URL: `{{BASE_URL}}`. Full OpenAPI spec: `{{BASE_URL}}/api/openapi.json`. Interactive docs: `{{BASE_URL}}/api/docs`.

## Access

The API is open: send requests with no key and no extra header. Every tree on this server is reachable. The person who runs the server protects it with their own network, VPN or reverse proxy.

```sh
export BASE={{BASE_URL}}
curl -s $BASE/api/trees
```

## Words

- **Tree**: one family. `GET /api/trees` lists them; each has an `id` and a `homePersonId`.
- **Person**: `firstNames` (required), `surname`, `birthSurname` (surname at birth, if different), `gender` (`male` | `female` | `other` | `unknown`), `bornDate`, `bornPlace`, `died` (true/false), `diedDate`, `diedPlace`, `story` (Markdown).
- **Parent link**: `childId` → `parentId`, with `kind` = `birth` (default) | `adopted` | `step` | `foster`.
- **Partnership**: `personAId` + `personBId`, `married` (true/false), `startDate`/`startPlace` (e.g. wedding), `ended` (true/false), `endDate`/`endPlace` (e.g. divorce). A person can have many.

## Dates

Stored as `1952-03-14`, `1952-03`, `1952`, or `~1900` (about 1900). Input also accepts `14 March 1952`, `14/03/1952` (day first), `March 1952`, `about 1900`, `c. 1900`. Leave a date empty (`""`) when unknown. A death with no known date: `"died": true`.

## Rules

- A child has at most **2 birth parents** (any number of adopted, step or foster parents).
- No cycles: a person cannot be their own parent or ancestor.
- The same parent link cannot exist twice.
- Errors look like `{"error":{"code":"too_many_birth_parents","message":"..."}}`. Codes: `invalid` (400), `limit` (403), `not_found` (404), `duplicate`, `cycle`, `too_many_birth_parents` (409).

## Endpoints

| Method           | Path                                               | Does                                                        |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| GET              | `/api/trees`                                       | List trees                                                  |
| POST             | `/api/trees`                                       | Create a tree `{name}`                                      |
| GET              | `/api/trees/{treeId}`                              | Whole tree: `tree`, `people`, `parentLinks`, `partnerships` |
| PATCH            | `/api/trees/{treeId}`                              | `{name?, homePersonId?}`                                    |
| POST             | `/api/trees/{treeId}/commands`                     | Many changes at once, all or nothing (best for agents)      |
| GET              | `/api/trees/{treeId}/people?q=maria`               | Search persons by name                                      |
| POST             | `/api/trees/{treeId}/people`                       | Add a person                                                |
| GET/PATCH/DELETE | `/api/trees/{treeId}/people/{personId}`            | Read, change, delete a person                               |
| GET              | `/api/trees/{treeId}/people/{personId}/relatives`  | Parents, children, partners, siblings                       |
| PUT/DELETE       | `/api/trees/{treeId}/people/{personId}/photo`      | Upload (raw JPEG/PNG/WebP, ≤ 300 KB) or remove a photo      |
| POST             | `/api/trees/{treeId}/parent-links`                 | `{childId, parentId, kind?}`                                |
| PATCH/DELETE     | `/api/trees/{treeId}/parent-links/{linkId}`        | Change kind, or remove                                      |
| POST             | `/api/trees/{treeId}/partnerships`                 | `{personAId, personBId, married?, startDate?, ...}`         |
| PATCH/DELETE     | `/api/trees/{treeId}/partnerships/{partnershipId}` | Change or remove                                            |
| GET              | `/api/trees/{treeId}/export`                       | Full JSON export (photos included)                          |
| GET              | `/api/trees/{treeId}/export.ged`                   | GEDCOM 5.5.1                                                |
| POST             | `/api/trees/import`                                | New tree from a JSON export                                 |
| POST             | `/api/trees/import/gedcom?name=...`                | New tree from GEDCOM text                                   |

## The `/commands` batch

Body: `{"commands": [ ... ]}` (1–500). Commands run in order in one transaction. You can choose ids for new things (letters, digits, `-`, `_`) and use them in later commands of the same batch. The response is the whole tree after the change: `{"data": {...}}`.

Command types: `addPerson {person}`, `updatePerson {id, patch}`, `deletePerson {id}`, `addParentLink {link}`, `updateParentLink {id, kind}`, `removeParentLink {id}`, `addPartnership {partnership}`, `updatePartnership {id, patch}`, `removePartnership {id}`, `updateTree {patch: {name?, homePersonId?}}`.

## Recipes

Always look first, so you do not add a person twice:

```sh
curl -s "$BASE/api/trees/$TREE/people?q=ion"
```

### Add a grandmother, married to an existing grandfather, as a parent of an existing person

"Add my grandmother Maria, born about 1931, married to Ion (`ion-id`) in 1952; she is the mother of Elena (`elena-id`)."

```sh
curl -s -X POST "$BASE/api/trees/$TREE/commands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"type":"addPerson","person":{"id":"maria-popa","firstNames":"Maria","surname":"Popa","gender":"female","bornDate":"about 1931"}},
    {"type":"addPartnership","partnership":{"personAId":"ion-id","personBId":"maria-popa","married":true,"startDate":"1952"}},
    {"type":"addParentLink","link":{"childId":"elena-id","parentId":"maria-popa"}}
  ]}'
```

### Record a divorce and a second marriage

```sh
curl -s -X POST "$BASE/api/trees/$TREE/commands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"type":"updatePartnership","id":"first-marriage-id","patch":{"ended":true,"endDate":"1980"}},
    {"type":"addPerson","person":{"id":"elena-b","firstNames":"Elena","gender":"female"}},
    {"type":"addPartnership","partnership":{"personAId":"ion-id","personBId":"elena-b","married":true,"startDate":"1982-06-11"}}
  ]}'
```

### Record a death and add to the story

```sh
curl -s -X PATCH "$BASE/api/trees/$TREE/people/ion-id" \
  -H "Content-Type: application/json" \
  -d '{"diedDate":"3 May 2001","diedPlace":"Cluj","story":"Carpenter. Built the family house by hand in 1960."}'
```

`story` replaces the old text, so read the person first and append to the old story.

### Add an adopted child to a couple

```sh
curl -s -X POST "$BASE/api/trees/$TREE/commands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"type":"addPerson","person":{"id":"james","firstNames":"James","bornDate":"1987"}},
    {"type":"addParentLink","link":{"childId":"james","parentId":"mum-id","kind":"adopted"}},
    {"type":"addParentLink","link":{"childId":"james","parentId":"dad-id","kind":"adopted"}}
  ]}'
```
