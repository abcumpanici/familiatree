# Familiatree

Familiatree is a simple and private app for your family tree. You add people, show how they are related, and keep their stories.

- You host it yourself. All trees are in one SQLite file on your server.
- It has no accounts and no passwords.
- It has no DNA tools, no research tools and no social features.
- It imports and exports JSON (with photos) and GEDCOM (for other family tree apps).
- AI agents can read and change the trees through a REST API.

It is free and open source (AGPL-3.0).

> **Warning: do not put this app on the public internet.** The app has no login. Each person who can reach the server can see, change and delete each tree. Keep the app on your home network or on a VPN, for example Tailscale or WireGuard. If you must open it to the internet, put a reverse proxy with a login and HTTPS in front of it.

## Choose how to run it

| You have                          | Use this section                                |
| --------------------------------- | ----------------------------------------------- |
| Home Assistant OS or Supervised   | [Home Assistant add-on](#home-assistant-add-on) |
| A server or NAS with Docker       | [Docker](#docker)                               |
| Home Assistant Container (Docker) | [Docker](#docker)                               |
| Only your own computer            | [Your computer](#your-computer)                 |

## Home Assistant add-on

Home Assistant runs the app as a local add-on. Home Assistant backups then include your family data.

```
your computer                        Home Assistant
-------------                        --------------
bun run ha-addon  --copy folder-->   addons/familytree
                                     Settings > Add-ons > Install
                                     http://homeassistant.local:3000
```

You need:

- Home Assistant OS or Home Assistant Supervised, on a 64-bit system (`aarch64` or `amd64`). A Raspberry Pi 4 or 5 with a 64-bit system is good. A 32-bit system does not work, because Bun does not support it.
- [Bun](https://bun.sh) 1.3 or newer, and `git`, on your computer.
- A way to copy files to Home Assistant. The **Samba share** add-on is the easiest.

### Install the add-on

1. On your computer, get the code:

   ```sh
   git clone https://github.com/abcumpanici/familiatree.git familytree
   cd familytree
   ```

2. Make the add-on folder:

   ```sh
   bun run ha-addon
   ```

   The script puts the add-on in `build/ha-addon/familytree`.

3. In Home Assistant, install and start the **Samba share** add-on. Go to **Settings > Add-ons > Add-on store** to find it.
4. On your computer, open the `addons` share of Home Assistant. On a Mac, use `smb://homeassistant.local/addons`. On Windows, use `\\homeassistant.local\addons`.
5. Copy the `familytree` folder from `build/ha-addon` into the `addons` share.
6. In Home Assistant, go to **Settings > Add-ons > Add-on store**.
7. Open the menu (three dots, top right) and select **Check for updates**.
8. Find **Familiatree** under **Local add-ons**, and select **Install**. The first build takes 5 to 15 minutes on a Raspberry Pi.
9. Select **Start**. Turn on **Start on boot** and **Watchdog**.
10. Select **Open web UI**, or go to `http://homeassistant.local:3000`.

### Update the add-on

1. On your computer, get the new code with `git pull`.
2. Run `bun run ha-addon` again.
3. In the `addons` share, replace the `familytree` folder with the new folder.
4. In Home Assistant, select **Check for updates**, open the add-on, and select **Rebuild**.

The rebuild keeps your trees. The trees are in the add-on `/data` folder, and the rebuild does not touch that folder.

### Back up the add-on

You do not need to do more. Each Home Assistant backup includes the add-on and its trees. The add-on stops for a short time during each backup, so the copy is always complete.

To get the trees back, restore the backup in **Settings > System > Backups**.

## Docker

Use this on a server, a NAS or Home Assistant Container.

1. Get the code:

   ```sh
   git clone https://github.com/abcumpanici/familiatree.git familytree
   cd familytree
   ```

2. Start the app:

   ```sh
   docker compose up -d
   ```

3. Go to `http://<server address>:3000`.

Docker keeps the trees in the `familytree-data` volume. To update the app, run `git pull`, and then run `docker compose up -d --build`.

### Back up with Docker

All trees are in one file, `familytree.sqlite`. The app also writes recent changes to `familytree.sqlite-wal`. Do not copy only the main file while the app runs, because the copy can be incomplete.

Use one of these methods:

- Stop the app with `docker compose stop`. Copy the whole data volume. Start the app again with `docker compose start`.
- Make a safe copy while the app runs:

  ```sh
  docker compose exec familytree bun -e "new (require('bun:sqlite').Database)('/data/familytree.sqlite').run(\"VACUUM INTO '/data/backup.sqlite'\")"
  ```

  Then copy `backup.sqlite` out of the volume.

## Your computer

1. Install [Bun](https://bun.sh) 1.3 or newer.
2. Get the code, and go into its folder.
3. Install the packages:

   ```sh
   bun install
   ```

4. Build the web app:

   ```sh
   bun run build
   ```

5. Start the app:

   ```sh
   bun run start
   ```

6. Go to `http://localhost:3000`.

The app keeps the trees in `apps/server/data/familytree.sqlite`.

## Export one tree

You can also keep a copy of each tree as a file.

1. Go to **My trees**.
2. Open the menu of the tree.
3. Select JSON or GEDCOM.

A JSON file has all the data, with photos. To get the tree back, import the JSON file. Use GEDCOM to move a tree to other family tree apps.

## Settings

Set these environment variables in `docker-compose.yml`, or before `bun run start`.

| Variable              | Default | What it does                                                                                 |
| --------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `PORT`                | `3000`  | The HTTP port                                                                                |
| `DATA_DIR`            | `/data` | The folder for the SQLite file (`./data` when you use `bun run start`)                       |
| `MAX_PEOPLE_PER_TREE` | `2000`  | The maximum number of people in one tree                                                     |
| `MAX_TREES`           | `100`   | The maximum number of trees on the server                                                    |
| `TRUST_PROXY`         | `false` | Set to `true` behind a reverse proxy. Links in the API docs then use `X-Forwarded-*` headers |

If an older version kept trees in your browser, open the app one time in that browser. The app moves those trees to the server.

## AI agents

Give your agent the guide at `http://<server address>:3000/llms.txt`. The API does not need a key, so the agent can read and change each tree.

- Full API: `/api/openapi.json`
- Interactive API docs: `/api/docs`
- The same guide as a Claude Code skill: [`skills/familytree-api`](skills/familytree-api/SKILL.md)

## Develop

You need [Bun](https://bun.sh) 1.3 or newer.

```sh
bun install
bun run dev      # API on :3000, web app with hot reload on :5173
bun run check    # lint, types and unit tests
bun run e2e      # browser tests, desktop and phone
```

```
apps/web         the UI (React, Vite, Tailwind, GSAP)
apps/server      the REST API and storage (Hono, Drizzle, bun:sqlite)
packages/domain  tree rules, dates, layout, JSON and GEDCOM
homeassistant    the Home Assistant add-on files
```

Read [GLOSSARY.md](GLOSSARY.md) for the words, [docs/PLAN.md](docs/PLAN.md) for the scope, and [docs/adr](docs/adr) for the decisions.

## Licence

The licence is [AGPL-3.0](LICENSE). You can use, change and share the app. If you run a changed version as a public service, you must share your changes.
