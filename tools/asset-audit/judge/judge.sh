#!/usr/bin/env bash
# 판정기 실행 — 토치가 든 swbins3 sd-webui 파이썬이 있으면 그걸로(CLIP 켬), 없으면 py 로 tech 만(--no-clip).
export PYTHONIOENCODING=utf-8
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="/c/swbins3/sd-webui/venv/Scripts/python.exe"
if [ -x "$PY" ]; then exec "$PY" "$HERE/judge.py" "$@"; fi
echo "WARN swbins3 sd-webui 파이썬 없음 → CLIP 없이 기술 결함만 판정한다" >&2
if [ "$1" = "score" ]; then shift; exec py "$HERE/judge.py" score --no-clip "$@"; fi
exec py "$HERE/judge.py" "$@"
