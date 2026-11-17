# Familiatree

Open the app with the **Open web UI** button, or go to `http://homeassistant.local:3000`.

## Your data

The add-on keeps all trees in one SQLite file in its `/data` folder. Home Assistant backups include this folder. The add-on stops for a short time during each backup, so the copy is always complete.

## Warning

Do not open port 3000 to the internet. The app has no login. Each person who can reach the port can change and delete each tree.

## Agents

Give your AI agent this guide: `http://homeassistant.local:3000/llms.txt`.
