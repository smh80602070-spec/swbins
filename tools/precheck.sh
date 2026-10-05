#!/usr/bin/env bash
# 커밋 전 자동 점검 (SAGA-DESIGN.md §8-5·§9) — Git Bash 에서 `bash tools/precheck.sh [폴더...]`
#   1) 웹 다섯 판 js 구문 (node -c, vendor 제외)
#   2) 바뀐 에셋 🔴 점검(tools/asset-audit --quick)
#   3) 문서 크기 상한 (CLAUDE.md 6KB · PLAN 70KB(사가블로 90KB) · PROJECT_STATE 15KB · ARCH·BACKLOG·STATE·티켓 4KB …)
#   4) features.json 스키마 · WIP 상한(tools/wip.json, 새기능 티켓) · js/gd/cs 1500줄 넘김(tools/big-files.txt 는 봐줌) · 진단 수 감소 WARN · Godot 참조 방향
#   (--full 이면 웹 다섯 판 _test.html 진단까지)
# 서버·브라우저는 띄우지 않는다. _test.html 진단은 사용자가 실기 확인할 때 따로 돈다.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

echo "== js 구문"
targets=(); for a in "$@"; do [ "$a" = "--full" ] || targets+=("$a"); done; [ ${#targets[@]} -eq 0 ] && targets=(saga-web/saga-go saga-web/saga-dungeon saga-web/saga-forest saga-web/saga-story saga-web/saga-realm)
# node 한 번으로 전부 파싱하고 걸린 파일만 node --check 로 재판정(파일마다 띄우면 5분 → 수 초)
jsdirs=(); for d in "${targets[@]}"; do [ -d "$d/js" ] && jsdirs+=("$d/js"); done
[ ${#jsdirs[@]} -gt 0 ] && { node tools/hooks/syntax-check.js "${jsdirs[@]}" || fail=1; }

echo "== 도감 data.js 다섯 벌 md5 (루트 CLAUDE.md: 도감은 다섯 벌 함께 고치고 md5 로 확인)"
sums=""; for g in saga-go saga-dungeon saga-forest saga-story saga-realm; do
  p="saga-web/$g/js/data.js"; [ -f "$p" ] || continue
  s=$(md5sum "$p" | cut -c1-8); echo "$s $g"; sums="$sums $s"
done
distinct=$(echo "$sums" | tr ' ' '\n' | sed '/^$/d' | sort -u | wc -l)
if [ "$distinct" -gt 1 ]; then
  if git status --porcelain -- 'saga-web/*/js/data.js' | grep -q .; then
    echo "MISMATCH data.js 가 다섯 벌 다르고 지금 data.js 를 고치는 중이다 — 다섯 벌 함께 맞춘 뒤 커밋"; fail=1
  else
    echo "WARN data.js 다섯 벌이 이미 다르다(기존 어긋남, 이번 커밋과 무관). 도감을 손댈 때 함께 맞출 것"
  fi
fi

echo "== shared 정본 (saga-web/shared → 다섯 판 사본 md5, tools/sync-shared.mjs)"
node tools/sync-shared.mjs --check || fail=1

echo "== script 순서 manifest (판별 js/manifest.json ↔ index·_test 의 script 줄, tools/gen-index.mjs)"
node tools/gen-index.mjs --check || fail=1
node tools/gen-itemicon-ids.mjs --check || fail=1   # 아이템 아이콘 이름 표(W-0025)
node tools/gen-assets3d-ids.mjs --check || fail=1   # shared/assets GLB 이름 표(W-0021)

echo "== world3d 조립 (saga-go/src/world3d 조각 → js/world3d.js, tools/build-parts.mjs)"
node tools/build-parts.mjs --check || fail=1

echo "== sw.js 캐시 버전 (판별 PLAN §7 함정: js/ 고치고 VERSION 안 올리면 옛 캐시를 계속 본다)"
for d in "${targets[@]}"; do
  [ -f "$d/sw.js" ] || continue
  if git status --porcelain -- "$d/js" 2>/dev/null | grep -q . && ! git status --porcelain -- "$d/sw.js" 2>/dev/null | grep -q .; then
    echo "WARN $d/js 를 고쳤는데 $d/sw.js VERSION 은 그대로다 — 서비스워커 옛 캐시로 남을 수 있다"
  fi
done

echo "== 에셋 빠른 점검 (tools/asset-audit --quick: 바뀐 에셋만 — 공개 저장소 유출·압축 GLB 디코더 누락·GitHub 100MB)"
PY=""; for c in "py -3" python3 python; do $c -c "import sys" >/dev/null 2>&1 && { PY=$c; break; }; done
if [ -n "$PY" ]; then
  PYTHONIOENCODING=utf-8 $PY tools/asset-audit/audit.py --quick || fail=1
else
  echo "WARN 파이썬이 없어 에셋 빠른 점검을 건너뛴다"
fi

echo "== 크레딧 필수 표기 (tools/asset-audit/credits.py --check: 크레딧 필수 출처가 credits.json 에 한 줄이라도 빠지면 FAIL, K-0038)"
if [ -n "$PY" ]; then
  PYTHONIOENCODING=utf-8 $PY tools/asset-audit/credits.py --check || fail=1
fi

echo "== 문서 크기"
limit() { # 파일 상한(바이트)
  local f=$1 max=$2; [ -f "$f" ] || return 0
  local n; n=$(tr -d '\r' <"$f" | wc -c)   # 작업본이 CRLF 여도 저장소(LF) 크기로 잰다
  if [ "$n" -gt "$max" ]; then echo "OVER $f ${n}B > ${max}B"; fail=1; else echo "ok   $f ${n}B"; fi
}
limit CLAUDE.md 6144
for f in saga-web/*/CLAUDE.md saga-godot/CLAUDE.md saga-unity/CLAUDE.md; do limit "$f" 6144; done
limit SAGA-DESIGN.md 40960
for g in saga-go saga-forest saga-story saga-realm; do limit "saga-web/$g/PLAN.md" 71680; done
limit saga-web/saga-dungeon/PLAN.md 92160
limit saga-godot/docs/PROJECT_STATE.md 15360
limit saga-unity/docs/PROJECT_STATE.md 15360
warnlimit() { # 지금 넘는 문서 — 정리(K-0002·archive) 뒤 FAIL 로 올린다
  local f=$1 max=$2; [ -f "$f" ] || return 0
  local n; n=$(tr -d '\r' <"$f" | wc -c)   # 작업본이 CRLF 여도 저장소(LF) 크기로 잰다
  if [ "$n" -gt "$max" ]; then echo "WARN $f ${n}B > ${max}B (정리 뒤 FAIL 로)"; else echo "ok   $f ${n}B"; fi
}
warnlimit saga-godot/PLAN.md 102400
warnlimit saga-unity/PLAN.md 102400
warnlimit tools/char-forge/README.md 16384
limit SAGA-ARCH.md 40960
limit SAGA-BACKLOG.md 30720
for f in saga-web/STATE.md saga-godot/docs/STATE.md saga-unity/docs/STATE.md; do limit "$f" 8192; done
over=''   # CRLF 로 체크아웃된 작업본이 저장소(LF) 크기보다 줄 수만큼 커 보이지 않게 CR 을 빼고 잰다
while read -r f; do [ "$(tr -d '\r' <"$f" | wc -c)" -gt 6144 ] && over="$over$f"$'\n'; done < <(find tasks -name '*.md' -size +5000c 2>/dev/null)
if [ -n "$over" ]; then printf '%s' "$over" | while read -r f; do echo "OVER $f > 6144B"; done; fail=1; else echo "ok   tasks/**/*.md 전부 6144B 이하"; fi

echo "== 정본 범주 반영 (tools/asset-audit/reflect.py --categories · K-0073, WARN 만)"
if [ -d saga-assets ]; then PYTHONIOENCODING=utf-8 py tools/asset-audit/reflect.py --categories 2>/dev/null || echo "WARN reflect.py --categories 실행 실패(py 없음?)"; fi

echo "== features.json 스키마 (saga-web/*/features.json · tools/features-schema.json)"
if ls saga-web/*/features.json >/dev/null 2>&1; then
  node - <<'NODE' || fail=1
const fs = require('fs'), path = require('path');
const req = ['id', 'name', 'files', 'tests', 'level', 'verified', 'fun', 'ticket', 'since'];
let bad = 0;
for (const g of fs.readdirSync('saga-web')) {
  const p = path.join('saga-web', g, 'features.json');
  if (!fs.existsSync(p)) continue;
  let a; try { a = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log('FAIL ' + p + ' JSON 오류 ' + e.message); bad++; continue; }
  const ids = new Set();
  for (const x of a) {
    const miss = req.filter(k => !(k in x));
    if (miss.length) { console.log('FAIL ' + p + ' ' + x.id + ' 키 없음 ' + miss.join(',')); bad++; }
    if (!/^D[0-4]$/.test(x.level)) { console.log('FAIL ' + p + ' ' + x.id + ' level ' + x.level); bad++; }
    if (ids.has(x.id)) { console.log('FAIL ' + p + ' id 중복 ' + x.id); bad++; }
    ids.add(x.id);
  }
  console.log('ok   ' + p + ' ' + a.length);
}
process.exit(bad ? 1 : 0);
NODE
fi

echo "== WIP 상한 (tools/wip.json · SAGA-ARCH §8-2: 새기능 티켓은 그 판의 D0+D1 이 상한 아래일 때만)"
node - <<'NODE' || fail=1
const fs = require('fs'), { execSync } = require('child_process');
const cfg = JSON.parse(fs.readFileSync('tools/wip.json', 'utf8'));
const git = a => { try { return execSync('git ' + a, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean); } catch (e) { return []; } };
const added = git('diff --cached --name-only --diff-filter=A').filter(f => /^tasks\/(web|godot|unity|tools)\/[WGUK]-\d+\.md$/.test(f));
if (!added.length) { console.log('ok   새 티켓 없음'); process.exit(0); }
const NAMES = { '사가고': 'go', '사가블로': 'dungeon', '사가의숲': 'forest', '사가스토리': 'story', '사가국지': 'realm', 'GO': 'go', 'DUNGEON': 'dungeon', 'FOREST': 'forest', 'STORY': 'story', 'REALM': 'realm' };
const PRE = { go: 'go.', dungeon: 'dg.', forest: 'fs.', story: 'st.', realm: 'rk.' };
const readJ = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return []; } };
function wip(track, game) {
  if (track === 'web') { const a = readJ(`saga-web/saga-${game}/features.json`); return a.filter(x => /^D[01]$/.test(x.level)).length; }
  const a = readJ(track === 'godot' ? 'saga-godot/features.json' : 'saga-unity/features.json');
  const pre = (track === 'godot' ? 'gd.' : 'un.') + PRE[game];
  return a.filter(x => x.id.startsWith(pre) && /^D[01]$/.test(x.level)).length;
}
let bad = 0;
const today = new Date().toISOString().slice(0, 10);
const frozen = cfg.frozen_until && today <= cfg.frozen_until;
for (const f of added) {
  const txt = fs.readFileSync(f, 'utf8');
  const head = txt.split(/\r?\n/).slice(0, 3).join(' ');
  const kind = (/종류\s*[:：]\s*([^\n]*?)(상태|$)/.exec(head) || [])[1] || '';
  const isNew = /새\s*기능/.test(kind) && !/닫기|통합|버그|측정|도구|설계|게이트/.test(kind);
  const track = f.split('/')[1];
  const exempt = /WIP 예외\s*[:：]/.test(txt);
  if (!isNew) { console.log('ok   ' + f + ' (' + kind.trim().slice(0, 30) + ')'); continue; }
  if (frozen && !exempt) { console.log(`FAIL ${f} 새기능 — 발행 동결 중(~${cfg.frozen_until}): ${cfg.frozen_note}`); bad++; continue; }
  if (track === 'tools') {
    const open = fs.readdirSync('tasks/tools').filter(x => /^K-\d+\.md$/.test(x)).length;
    if (open > cfg.tools_open && !exempt) { console.log(`FAIL ${f} K 열린 티켓 ${open} > ${cfg.tools_open} — 판정·배치로 먼저 닫는다`); bad++; } else console.log('ok   ' + f + ` (K 열린 ${open})`);
    continue;
  }
  const games = [...new Set(Object.keys(NAMES).filter(n => head.includes(n) || (txt.match(new RegExp(n, 'g')) || []).length >= 3).map(n => NAMES[n]))];
  if (!games.length) { console.log(`FAIL ${f} 어느 판인지 둘째 줄에 없음 — '종류: 새기능 · 웹(사가국지)' 처럼 판 이름을 적는다`); bad++; continue; }
  for (const g of games) {
    const n = wip(track, g), lim = cfg.flagship.includes(`${track}:${g}`) ? cfg.limit_flagship : cfg.limit;
    if (n > lim && !exempt) { console.log(`FAIL ${f} ${track}/${g} D0+D1 ${n} > ${lim} — 닫기(D1→D2→D3) 티켓이 먼저`); bad++; }
    else console.log(`${exempt && n > lim ? 'WARN' : 'ok  '} ${f} ${track}/${g} D0+D1 ${n}/${lim}${exempt ? ' (WIP 예외 표기)' : ''}`);
  }
}
process.exit(bad ? 1 : 0);
NODE

echo "== 파일 크기 (바뀐 js/gd/cs 가 새로 1500줄을 넘거나, 이미 넘던 목록 tools/big-files.txt 보다 늘면 FAIL)"
node - "${targets[@]}" <<'NODE' || fail=1
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const LIM = 1500;
const big = {};
try { fs.readFileSync('tools/big-files.txt', 'utf8').split(/\r?\n/).forEach(l => { const m = /^(\d+)\s+(\S+)/.exec(l); if (m) big[m[2]] = +m[1]; }); } catch (e) { /* 목록 없음 */ }
const isSrc = f => /^saga-web\/[^/]+\/js\/[^/]+\.js$/.test(f) || /^saga-godot\/.*\.gd$/.test(f) || /^saga-unity\/Assets\/.*\.cs$/.test(f);
const files = new Set();
const git = a => { try { return execSync('git ' + a, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean); } catch (e) { return []; } };
git('diff --cached --name-only').forEach(f => files.add(f));
git('diff --name-only').forEach(f => files.add(f));
git('ls-files --others --exclude-standard').forEach(f => files.add(f));
for (const d of process.argv.slice(2)) { if (fs.existsSync(path.join(d, 'js'))) fs.readdirSync(path.join(d, 'js')).forEach(f => files.add(d.replace(/\\/g, '/') + '/js/' + f)); }
let bad = 0, n = 0;
for (const f of files) {
  if (!isSrc(f) || !fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
  n++;
  const b = fs.readFileSync(f); let lines = 0; for (const c of b) if (c === 10) lines++;
  if (b.length && b[b.length - 1] !== 10) lines++;
  if (lines <= LIM) continue;
  if (!(f in big)) { console.log('FAIL ' + f + ' ' + lines + '줄 — 새로 ' + LIM + '줄을 넘었다(쪼갤 것)'); bad++; }
  else if (lines > big[f]) { console.log('FAIL ' + f + ' ' + lines + '줄 > 목록 ' + big[f] + '줄 — 이미 큰 파일이 더 커졌다'); bad++; }
}
console.log((bad ? '' : 'ok   ') + '확인 ' + n + '개');
process.exit(bad ? 1 : 0);
NODE

echo "== 진단 수 (_test.html 의 t(' 줄 수가 tools/_out/testcount.json 보다 줄면 WARN)"
node - <<'NODE'
const fs = require('fs'), path = require('path');
const file = 'tools/_out/testcount.json';
let old = {}; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 처음 */ }
const now = {};
for (const g of fs.readdirSync('saga-web')) {
  const p = path.join('saga-web', g, '_test.html');
  if (!fs.existsSync(p)) continue;
  now[g] = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.includes("t('")).length;
  if (old[g] > now[g]) console.log('WARN ' + g + ' 진단 ' + old[g] + ' → ' + now[g] + ' (줄었다)');
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(Object.assign(old, now), null, 1));
console.log('ok   진단 수 ' + Object.entries(now).map(([g, n]) => g.replace('saga-', '') + ' ' + n).join(' · '));
NODE

if [ -f saga-godot/tools/check_refs.sh ]; then
  echo "== Godot 참조 방향 (saga-godot/tools/check_refs.sh)"
  bash saga-godot/tools/check_refs.sh || { echo "FAIL Godot 참조 방향 위반(위 줄)"; fail=1; }
fi


echo "== 웹 진단 (--full 일 때만: tools/test-web.mjs all)"
for a in "$@"; do [ "$a" = "--full" ] && { node tools/test-web.mjs all || fail=1; break; }; done

[ $fail -eq 0 ] && echo "PRECHECK OK" || { echo "PRECHECK FAIL"; exit 1; }
