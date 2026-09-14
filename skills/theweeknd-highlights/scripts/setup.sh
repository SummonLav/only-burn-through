#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
for binary in python3 node npm ffmpeg ffprobe; do
  command -v "$binary" >/dev/null || { echo "Missing dependency: $binary" >&2; exit 1; }
done
python3 -m venv "$skill_dir/.venv"
"$skill_dir/.venv/bin/python" -m pip install --disable-pip-version-check 'numpy>=2,<3'
npm install --prefix "$skill_dir" --no-audit --no-fund
echo 'Ready. Uses installed Chrome by default; set CONCERT_BROWSER=chromium to use Playwright Chromium.'
