#!/usr/bin/env node
/**
 * 판 번들 — `js/manifest.json` 의 index 목록 순서대로 스크립트를 이어 붙여 `dist/app.js` 로 만든다(W-0065).
 *
 *   node saga-web/shared/build/bundle.mjs <판>          예: saga-go  → saga-web/saga-go/dist/app.js
 *   node saga-web/shared/build/bundle.mjs <판> --check  쓰지 않고 dist 번들이 지금 원본들과 맞는지만(낡으면 종료 1)
 *
 * manifest 의 `bundle` 은 문자열 하나(index 가 한 묶음) 또는 묶음 수만큼의 배열(사이에 async 태그가 낀 사가종횡).
 * 규칙: 코드는 전역(DG·THREE) 스크립트라 **파일마다 따로 압축(esbuild transform, 이름·구조 보존)한 걸 순서대로 이어 붙이기**만 한다.
 *   vendor/ 는 이미 압축본이라 그대로 넣는다. 원본이 하나라도 바뀌면 첫 줄 해시가 달라져 `--check`(precheck·gen-index)가 낡음을 알린다.
 *   sourcemap 은 없다(이어 붙인 지도는 파일 경계 계산이 필요해 뺐다) — 디버깅은 원본 js/ 와 `_test.html` 로.
 * W-0123 파일 격리 — 낱개 <script> 일 땐 한 파일이 던져도 그 파일만 빠졌는데, 이어 붙인 뒤엔 뒤 파일 전부가 멈췄다. 그래서 IIFE 꼴 파일은
 *   `try{…}catch` 로 감싸고 던진 오류는 errlog 에 **원본 파일 이름**과 함께 남긴다(스택이 압축 위치만 가리키던 것 보완). 감싸면 뜻이 바뀌는 파일
 *   (맨 앞 'use strict' · 최상위 let/const/class/function 선언 — 블록 안에 들면 범위가 바뀐다)과 vendor/ 는 그대로 둔다. 파일 앞마다 "@ 경로" 표시 주석.
 * esbuild 는 `saga-web/shared/build` 에서 `npm install` 한 것(node_modules 는 git 무시). --check 는 esbuild 없이 돈다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');
const HEAD = /^\/\*bundle ([0-9a-f]{40}) (\d+) files\*\/\r?\n/;   // 윈도 체크아웃(CRLF)에서도 맞게
const NUL = String.fromCharCode(0);
const FORMAT = 'wrap1';   // 번들 꼴 — 바꾸면 원본이 그대로여도 해시가 달라져 --check 가 낡음을 알린다

/** 감싸도 뜻이 안 바뀌는 꼴인가 — 압축본이 IIFE 하나(들)로 시작하고 맨 앞 지시문('use strict')이 없을 때만 */
export function wrappable(code) {
  return /^(?:\(function\b|\(\(\)=>|\(\([a-zA-Z_$][\w$]*\)=>|!function\b|\(\(function\b)/.test(code) && !/^["']use strict["']/.test(code);
}
/** 파일 하나를 감싼다 — 오류는 errlog(있으면)와 콘솔에. 다음 파일은 계속 돈다 */
export function wrap(code, file) {
  const f = JSON.stringify(file);
  return `try{${code}\n}catch(e){try{var E=window.DG&&window.DG.errlog;E&&E.record&&E.record({kind:"error",msg:(e&&e.message)||String(e),src:${f},stack:(e&&e.stack)||""})}catch(_){}console.error("[bundle] "+${f},e)}`;
}

/** 번들 명세 — manifest.bundle 과 manifest.index 의 묶음을 짝지은 [{ out, files }] */
export function specs(game) {
  const m = JSON.parse(fs.readFileSync(path.join(WEB, game, 'js', 'manifest.json'), 'utf8'));
  const outs = [].concat(m.bundle || []);
  if (!outs.length || outs.length !== m.index.length) { throw new Error(`${game}: manifest.bundle(${outs.length}) 와 index 묶음(${m.index.length}) 수가 같아야 한다`); }
  return outs.map((out, i) => ({ out, files: m.index[i] }));
}

/** 한 묶음 원본들의 내용 해시 — 줄바꿈(CRLF/LF)에 영향받지 않게 CR 을 뺀다 */
export function sourceHash(game, spec) {
  const h = crypto.createHash('sha1');
  h.update(FORMAT + NUL);
  for (const f of spec.files) {
    h.update(f + NUL);
    h.update(fs.readFileSync(path.join(WEB, game, f), 'latin1').split('\r').join('') + NUL, 'latin1');
  }
  return { hash: h.digest('hex'), n: spec.files.length };
}

/** dist 번들들의 첫 줄 해시가 지금 원본 해시와 같은가 — { ok, why } */
export function fresh(game) {
  for (const sp of specs(game)) {
    const out = path.join(WEB, game, sp.out);
    if (!fs.existsSync(out)) { return { ok: false, why: `${game}/${sp.out} 없음` }; }
    const m = HEAD.exec(fs.readFileSync(out, 'latin1').slice(0, 120));
    if (!m) { return { ok: false, why: `${game}/${sp.out} 첫 줄에 번들 해시가 없다` }; }
    if (m[1] !== sourceHash(game, sp).hash) { return { ok: false, why: `${game}/${sp.out} 이 원본보다 낡았다` }; }
  }
  return { ok: true, why: '' };
}

async function build(game) {
  const { transform } = await import(pathToFileURL(path.join(HERE, 'node_modules', 'esbuild', 'lib', 'main.js')).href).catch(() => { throw new Error('esbuild 가 없다 — cd saga-web/shared/build && npm install'); });
  const res = [];
  for (const sp of specs(game)) {
    const parts = [], plain = [];
    let wrapped = 0;
    for (const f of sp.files) {
      const code = fs.readFileSync(path.join(WEB, game, f), 'utf8');
      if (/(^|\/)vendor\//.test(f)) { parts.push(code); continue; }
      const r = await transform(code, { loader: 'js', minify: true, target: 'es2018', legalComments: 'none', sourcefile: f });
      const c = r.code.replace(/\s+$/, '');
      if (wrappable(c)) { parts.push(`/*@ ${f}*/` + wrap(c, f)); wrapped++; } else { parts.push(`/*@ ${f} 안 감쌈*/` + c); plain.push(f); }
    }
    const { hash, n } = sourceHash(game, sp);
    const body = `/*bundle ${hash} ${n} files*/\n` + parts.map((p) => p.replace(/\s+$/, '')).join('\n;\n') + '\n';
    const out = path.join(WEB, game, sp.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, body);
    res.push({ out, bytes: Buffer.byteLength(body), n, wrapped, plain });
  }
  return res;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const game = process.argv[2];
  if (!game || game.startsWith('--')) { console.error('사용: node saga-web/shared/build/bundle.mjs <판> [--check]'); process.exit(1); }
  if (process.argv.includes('--check')) {
    const r = fresh(game); console.log(r.ok ? `OK ${game} 번들 최신` : `FAIL ${r.why} — node saga-web/shared/build/bundle.mjs ${game}`); process.exit(r.ok ? 0 : 1);
  }
  for (const r of await build(game)) { console.log(`BUNDLE_OK ${game} ${r.n}개 → ${path.relative(WEB, r.out).split(path.sep).join('/')} ${(r.bytes / 1024).toFixed(0)}KB · 감쌈 ${r.wrapped}` + (r.plain.length ? ` · 안 감쌈 ${r.plain.length}(${r.plain.filter((f) => !/vendor\//.test(f)).join(' ') || 'vendor 만'})` : '')); }
}
