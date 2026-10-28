#!/usr/bin/env bash
# Kimi CLI install for this PC (idempotent). Windows Git Bash / macOS / Linux.
#   bash tools/install-kimi.sh
# Login is manual and per PC: run `kimi`, then `/login`. Never commit keys.
set -e
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install uv first (https://docs.astral.sh/uv/getting-started/installation/), then rerun." >&2
  exit 1
fi
if command -v kimi >/dev/null 2>&1; then
  echo "kimi already installed: $(kimi --version 2>&1 | head -1)"
else
  uv tool install --python 3.13 kimi-cli
  echo "installed: $(kimi --version 2>&1 | head -1)"
fi
echo "next: run 'kimi' then '/login' (per PC). If 'kimi' is not found, add ~/.local/bin to PATH."
