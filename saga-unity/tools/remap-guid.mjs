#!/usr/bin/env node
// 스크립트를 옮기거나 합칠 때 씬·프리팹이 가리키던 옛 스크립트 GUID 를 새 GUID 로 바꾼다 (tasks U-0003).
//
//   node tools/remap-guid.mjs [--delete] <옛.meta>... <새.meta>   옛 .meta 의 guid → 새 .meta 의 guid
//   node tools/remap-guid.mjs --check                              지금까지 바꾼 옛 guid 가 Assets 에 남았나(0 이어야 OK)
//
// - 대상: Assets/**/*.{unity,prefab,asset} 의 `guid: <옛>` (바이너리 모드라 줄바꿈 그대로). *.playable 은 안 건드린다.
// - --delete 면 치환이 끝난 뒤 옛 .cs 와 .meta 를 지운다(새 .meta 는 그대로).
// - 바꾼 옛 guid 는 tools/remap-guid.done.txt 에 "옛 새 이름" 으로 쌓아 --check 가 읽는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "Assets");
const doneFile = path.join(root, "tools", "remap-guid.done.txt");
const EXT = new Set([".unity", ".prefab", ".asset"]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(e.name))) yield p;
  }
}

function guidOf(metaPath) {
  const m = /^guid: ([0-9a-f]{32})/m.exec(fs.readFileSync(metaPath, "latin1"));
  if (!m) throw new Error(`guid 없음: ${metaPath}`);
  return m[1];
}

function readDone() {
  if (!fs.existsSync(doneFile)) return [];
  return fs.readFileSync(doneFile, "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split(" ")[0]);
}

function count(guids) {
  // 파일별로 남은 guid 줄 수를 센다(guid: 뒤에 붙은 것만 — 다른 32hex 와 안 헷갈리게).
  const hits = [];
  for (const f of walk(assets)) {
    const text = fs.readFileSync(f, "latin1");
    for (const g of guids) if (text.includes(`guid: ${g}`)) hits.push(`${path.relative(root, f)} ${g}`);
  }
  return hits;
}

const args = process.argv.slice(2);
if (args[0] === "--check") {
  const old = readDone();
  const hits = count(old);
  hits.forEach((h) => console.log("잔존", h));
  console.log(`옛 guid ${old.length}개 · 잔존 ${hits.length}건`);
  process.exit(hits.length ? 1 : 0);
}

const del = args[0] === "--delete";
const metas = (del ? args.slice(1) : args).map((p) => path.resolve(p));
if (metas.length < 2) {
  console.error("사용: node tools/remap-guid.mjs [--delete] <옛.meta>... <새.meta>");
  process.exit(2);
}
const newMeta = metas.pop();
const newGuid = guidOf(newMeta);
const olds = metas.map((m) => [guidOf(m), m]).filter(([g]) => g !== newGuid);

let changed = 0;
const log = [];
for (const f of walk(assets)) {
  const buf = fs.readFileSync(f);
  let text = buf.toString("latin1");
  let hit = false;
  for (const [g] of olds) {
    const needle = `guid: ${g}`;
    if (text.includes(needle)) { text = text.split(needle).join(`guid: ${newGuid}`); hit = true; }
  }
  if (hit) { fs.writeFileSync(f, Buffer.from(text, "latin1")); changed++; }
}
for (const [g, m] of olds) log.push(`${g} ${newGuid} ${path.basename(m, ".meta")}`);
if (log.length) fs.appendFileSync(doneFile, log.join("\n") + "\n");
console.log(`바꾼 파일 ${changed}개 · 옛 guid ${olds.length}개 → ${newGuid}`);

if (del) {
  for (const [, m] of olds) {
    const cs = m.replace(/\.meta$/, "");
    for (const p of [cs, m]) if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("삭제", path.relative(root, p)); }
  }
}
