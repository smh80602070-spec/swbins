#!/usr/bin/env bash
# Kimi Code CLI install for this PC (idempotent).
#   bash tools/install-kimi.sh
# Windows (Git Bash): downloads the official installer, then runs it with PowerShell
#   (checksum-verified binary -> ~/.kimi-code/bin, user PATH updated, old Python
#   `kimi` renamed to kimi-legacy). Read the downloaded file first if you like.
# macOS/Linux: prints the official install page; read the script before running it.
# Login is manual and per PC: run `kimi`, then `/login`. Never commit keys.
set -e
export PATH="$HOME/.kimi-code/bin:$PATH"
if command -v kimi >/dev/null 2>&1 && kimi --version 2>&1 | head -1 | grep -qE '^[2-9]\.'; then
  echo "Kimi Code CLI already installed: $(kimi --version 2>&1 | head -1)"
  exit 0
fi
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    T="$(mktemp -d)"
    curl -fsSL -o "$T/install.ps1" https://code.kimi.com/kimi-code/install.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$T/install.ps1")"
    rm -rf "$T"
    echo "next: open a NEW terminal, run 'kimi --version', then 'kimi' and '/login' (per PC)."
    ;;
  *)
    echo "Install Kimi Code CLI from the official page (read the script first): https://code.kimi.com" >&2
    echo "then run 'kimi' and '/login' (per PC)." >&2
    exit 1
    ;;
esac
