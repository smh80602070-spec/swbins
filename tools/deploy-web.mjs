#!/usr/bin/env node
/**
 * 확인용 웹 배포 — saga-web 의 git 추적 파일 중 게임이 쓰는 것만 임시 폴더에 모아 Cloudflare Pages 로 올린다.
 * (GitHub Pages 를 대신한다 — 2026-10-06 GitHub 계정 정지. 코드 저장소와는 별개: 여기는 화면 확인용 사이트만)
 *
 *   node tools/deploy-web.mjs --dry        모으기만 하고 파일 수·크기를 센다(로그인 필요 없음)
 *   node tools/deploy-web.mjs              모은 뒤 `npx wrangler pages deploy` 로 올린다
 *
 * 처음 한 번(사람 몫): Cloudflare 가입 → 프롬프트에 `! npx wrangler login`(브라우저 로그인).
 * 프로젝트가 없으면 이 스크립트가 `wrangler pages project create` 로 만든다. 이름은 환경변수 CF_PAGES_PROJECT(기본 swbins-saga).
 * 주소: https://<프로젝트>.pages.dev/saga-web/saga-go/ — 폴더 구조를 GitHub Pages 때(…/swbins/saga-web/…)와 같게 둬
 * 게임 안의 상대 경로(../shared/…)가 그대로 맞는다. 맨 앞 index.html 은 다섯 판 링크만.
 *
 * 빼는 것: 소스 조각(src/)·도구(saga-web/tools/)·번들 도구(shared/build/)·문서(*.md). 무료 한도: 파일 2만·파일당 25MiB·월 배포 500
 * — 세션마다 올리지 말고 하루 한두 번.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = process.env.CF_PAGES_PROJECT || 'swbins-saga';
const STAGE = path.join(os.tmpdir(), 'swbins-deploy');
const DRY = process.argv.includes('--dry');
const LIMIT_FILES = 20000, LIMIT_BYTES = 25 * 1024 * 1024;
const GAMES = [['saga-go', '사가만리'], ['saga-dungeon', '사가나락'], ['saga-forest', '사가마을'], ['saga-story', '사가종횡'], ['saga-realm', '사가천하']];

const skip = (p) => /\/src\//.test(p) || p.startsWith('saga-web/tools/') || p.startsWith('saga-web/shared/build/') || /\.md$/i.test(p);
const files = execFileSync('git', ['ls-files', '-z', 'saga-web'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter((p) => p && !skip(p));

fs.rmSync(STAGE, { recursive: true, force: true });
let bytes = 0, n = 0;
const big = [];
for (const rel of files) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) { continue; }              // 지워진 채 아직 커밋 안 된 파일
  const st = fs.statSync(src);
  if (st.size > LIMIT_BYTES) { big.push(rel + ' ' + (st.size / 1e6).toFixed(1) + 'MB'); continue; }
  const dst = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += st.size; n++;
}
const links = GAMES.map(([d, name]) => `<li><a href="saga-web/${d}/">${name}</a></li>`).join('');
fs.writeFileSync(path.join(STAGE, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>saga 확인용</title><body style="font:18px sans-serif;background:#111;color:#eee;padding:24px"><h1>saga 확인용</h1><ul style="line-height:2.2">${links}</ul><p style="color:#888">배포 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p></body>\n`);
n++;

console.log(`모음 ${n}개 · ${(bytes / 1e6).toFixed(0)}MB → ${STAGE}`);
if (big.length) { console.log('25MiB 넘어 뺀 파일:', big.join(', ')); }
if (n > LIMIT_FILES) { console.log(`FAIL 무료 한도 파일 ${LIMIT_FILES} 초과 — 안 쓰는 에셋·판별 중복부터 줄일 것`); process.exit(1); }
if (DRY) { process.exit(0); }

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => spawnSync(npx, ['--yes', 'wrangler', ...args], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
const list = spawnSync(npx, ['--yes', 'wrangler', 'pages', 'project', 'list'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
if (list.status !== 0) { console.log('wrangler 로그인이 안 돼 있다 — 프롬프트에 `! npx wrangler login` 후 다시'); process.exit(1); }
/* --force = 옛 Pages 로 직접 만든다(wrangler 4.147 은 Workers 로 넘기다 실패, 10-06) */
if (!new RegExp('\\b' + PROJECT + '\\b').test(list.stdout || '')) {
  if (run(['pages', 'project', 'create', PROJECT, '--production-branch', 'main', '--force']).status !== 0) { process.exit(1); }
}
const r = run(['pages', 'deploy', STAGE, '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true']);
if (r.status === 0) { console.log(`주소: https://${PROJECT}.pages.dev/saga-web/saga-go/`); }
process.exit(r.status || 0);
