#!/bin/sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/build/ha-addon/familytree"

rm -rf "$out"
mkdir -p "$out"
cd "$root"

git ls-files --cached --others --exclude-standard \
  | grep -v -e '^homeassistant/' -e '^build/' \
  | while IFS= read -r file; do [ -f "$file" ] && printf '%s\n' "$file"; done \
  | tar -cf - -T - | tar -xf - -C "$out"

cp homeassistant/config.yaml homeassistant/build.yaml homeassistant/DOCS.md "$out/"
cp apps/web/public/icon-192.png "$out/icon.png"
cp apps/web/public/icon-512.png "$out/logo.png"

echo "Add-on folder ready: $out"
echo "Copy this folder into the 'addons' folder of Home Assistant."
