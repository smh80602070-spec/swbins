#!/usr/bin/env node
/**
 * saga-ops 한 바퀴 시험(W-0326) — 서버를 메모리 DB·mock 결제로 띄워 판→서버→콘솔 길을 전부 밟는다. QC "운영 서버" 줄이 이걸 돈다.
 *   node saga-ops/test.mjs            → 마지막 줄 "OPS-SERVER OK n/n"(실패면 FAIL 줄과 종료 코드 1)
 * 바깥 네트워크 안 씀(toss·google 은 열쇠 없으면 '없음' 으로 거절되는 것만 확인).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const KEY = 'test-admin-key';
const child = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', String(port), '--db', ':memory:'], { env: { ...process.env, OPS_ADMIN_KEY: KEY, OPS_PAY_MOCK: '1', TOSS_SECRET_KEY: '', GOOGLE_PLAY_SA_JSON: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; child.stdout.on('data', (c) => { log += c; }); child.stderr.on('data', (c) => { log += c; });
const B = `http://127.0.0.1:${port}`;
let n = 0, fail = 0;
const t = (name, ok, detail) => { n++; if (!ok) { fail++; } console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
async function call(method, p, body, headers) {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: body == null ? undefined : JSON.stringify(body) });
  return { code: r.status, j: await r.json().catch(() => null) };
}
const adm = { 'X-Admin-Key': KEY, 'X-Admin-Who': 'tester' };
try {
  let up = false;
  for (let i = 0; i < 50 && !up; i++) { try { up = (await fetch(B + '/v1/health')).ok; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  t('health', up, up ? '' : log.slice(-300));

  // 상품(운영) — 열쇠 없이는 401
  t('admin 열쇠 없이 401', (await call('GET', '/v1/admin/products')).code === 401);
  let r = await call('PUT', '/v1/admin/products', { id: 'go_gem_100', game: 'saga-go', name: '보주 100', price: 1200, items: [{ kind: 'gem', n: 100 }] }, adm);
  t('상품 등록', r.code === 200 && r.j.product.id === 'go_gem_100', JSON.stringify(r.j).slice(0, 120));

  // 계정
  r = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' });
  t('login', r.code === 200 && r.j.token && r.j.uid, JSON.stringify(r.j).slice(0, 120));
  const uid = r.j.uid, S = { 'X-Session': r.j.token };
  const r2 = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-dungeon' });
  t('같은 기기 다시 login = 같은 uid', r2.j && r2.j.uid === uid);
  t('이상한 device 400', (await call('POST', '/v1/account/login', { device: 'x', game: 'saga-go' })).code === 400);
  t('세션 없이 events 401', (await call('POST', '/v1/events', { game: 'saga-go', events: [{ ev: 'boot' }] })).code === 401);

  // 이벤트 10
  const evs = []; for (let i = 0; i < 9; i++) { evs.push({ t: Date.now() - i * 1000, ev: 'boot', d: { v: 'test-v1.0.' + i } }); }
  evs.push({ t: Date.now(), ev: 'error', d: { msg: 'TypeError: 시험', src: 'x.js', line: 1 } });
  r = await call('POST', '/v1/events', { game: 'saga-go', events: evs }, S);
  t('events 10 수집', r.code === 200 && r.j.n === 10, JSON.stringify(r.j));
  r = await call('POST', '/v1/events', { game: 'saga-go', token: S['X-Session'], events: [{ ev: 'beacon' }] });
  t('events 본문 token(sendBeacon 길)', r.code === 200 && r.j.n === 1);

  // 플래그
  r = await call('PUT', '/v1/admin/flags', { notices: [{ id: 'n1', title: '시험 공지', body: '본문', games: ['saga-go'] }], maintenance: { on: false }, minVersion: { 'saga-go': 'go-v9.9.9' }, events: [{ id: 'e1', name: '2배', tunes: { xp: 2 }, games: [] }], flags: { 'saga-go': { newShop: true }, '*': { ab: 'A' } } }, adm);
  t('flags 저장', r.code === 200);
  r = await call('GET', '/v1/flags?game=saga-go');
  t('flags 받기(판 필터·상품·플래그)', r.code === 200 && r.j.notices.length === 1 && r.j.minVersion['saga-go'] === 'go-v9.9.9' && r.j.products.length === 1 && r.j.flags.newShop === true && r.j.events.length === 1, JSON.stringify(r.j).slice(0, 160));
  r = await call('GET', '/v1/flags?game=saga-realm');
  t('다른 판은 공지 0·공용 플래그', r.j.notices.length === 0 && r.j.flags.ab === 'A' && r.j.products.length === 0);

  // 세이브 동기화
  r = await call('PUT', '/v1/save/saga-go', { data: { gold: 10 } }, S); t('save 올리기 rev1', r.j && r.j.rev === 1);
  r = await call('PUT', '/v1/save/saga-go', { data: { gold: 11 }, rev: 0 }, S); t('save rev 충돌 409', r.code === 409);
  r = await call('GET', '/v1/save/saga-go', null, S); t('save 받기', r.j && r.j.rev === 1 && r.j.data.gold === 10);

  // 우편(운영 → 판)
  r = await call('POST', '/v1/admin/mail', { uids: [uid], game: 'saga-go', title: '보상', body: '고맙습니다', items: [{ kind: 'gold', n: 500 }] }, adm);
  t('운영 우편 보내기', r.code === 200 && r.j.n === 1, JSON.stringify(r.j));
  r = await call('GET', '/v1/mail?game=saga-go', null, S);
  t('판에서 우편 1', r.j && r.j.mails.length === 1 && r.j.mails[0].items[0].n === 500);
  const mid = r.j.mails[0].id;
  r = await call('POST', `/v1/mail/${mid}/claim`, {}, S); t('우편 받기 → items', r.j && r.j.ok && r.j.items[0].kind === 'gold');
  r = await call('POST', `/v1/mail/${mid}/claim`, {}, S); t('두 번 받기 = already', r.j && r.j.already === true);
  r = await call('GET', '/v1/mail?game=saga-go', null, S); t('받은 뒤 우편 0', r.j.mails.length === 0);

  // 결제(mock 샌드박스) → 영수증 검증 → 우편 지급
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'mock', productId: 'go_gem_100', payload: { orderId: 'ord_1', amount: 1200 } }, S);
  t('mock 결제 ok → mailId', r.code === 200 && r.j.ok && r.j.mailId, JSON.stringify(r.j));
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'mock', productId: 'go_gem_100', payload: { orderId: 'ord_1', amount: 1200 } }, S);
  t('같은 영수증 두 번 = already(이중 지급 없음)', r.j && r.j.already === true);
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'mock', productId: 'go_gem_100', payload: { orderId: 'ord_2', amount: 100 } }, S);
  t('금액 다른 결제 거절', r.j && r.j.ok === false && /금액/.test(r.j.why));
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'toss', productId: 'go_gem_100', payload: { orderId: 'ord_3', paymentKey: 'pk', amount: 1200 } }, S);
  t('toss 열쇠 없으면 거절(네트워크 안 감)', r.j && r.j.ok === false && /TOSS_SECRET_KEY/.test(r.j.why), r.j && r.j.why);
  r = await call('GET', '/v1/mail?game=saga-go', null, S);
  t('구매 우편 도착', r.j.mails.length === 1 && r.j.mails[0].items[0].kind === 'gem' && /^receipt:/.test(r.j.mails[0].source));
  r = await call('POST', `/v1/mail/${r.j.mails[0].id}/claim`, {}, S); t('구매 우편 받기', r.j.ok && r.j.items[0].n === 100);

  // 운영 조회
  r = await call('GET', '/v1/admin/players?q=dev_test', null, adm); t('플레이어 검색', r.j && r.j.players.length === 1 && r.j.players[0].uid === uid);
  r = await call('GET', `/v1/admin/players/${uid}`, null, adm);
  t('플레이어 상세(세이브·우편·영수증·이벤트)', r.j && r.j.saves.length === 1 && r.j.mails.length === 2 && r.j.receipts.length === 3 && r.j.events.length === 11);
  r = await call('PUT', `/v1/admin/players/${uid}/save/saga-go`, { data: { gold: 999 } }, adm); t('운영 세이브 수정 rev2', r.j && r.j.rev === 2);
  r = await call('GET', '/v1/save/saga-go', null, S); t('판에서 수정된 세이브', r.j.rev === 2 && r.j.data.gold === 999);
  r = await call('GET', '/v1/admin/errors?q=TypeError', null, adm); t('오류 검색', r.j && r.j.errors.length === 1);
  r = await call('GET', '/v1/admin/metrics?days=2&game=saga-go', null, adm);
  t('지표 DAU·매출', r.j && r.j.days[1].dau === 1 && r.j.days[1].revenue === 1200 && r.j.days[1].errors === 1 && r.j.totals.accounts === 1, JSON.stringify(r.j && r.j.days[1]));
  r = await call('GET', '/v1/admin/receipts', null, adm); t('영수증 목록', r.j && r.j.receipts.length === 3);

  // 제재
  r = await call('POST', '/v1/admin/ban', { uid, days: 1, reason: '시험' }, adm); t('정지', r.j && r.j.ban && r.j.ban.reason === '시험');
  r = await call('GET', '/v1/mail?game=saga-go', null, S); t('정지되면 세션 끊김 401', r.code === 401);
  r = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' }); t('정지 중 login 403 + 사유', r.code === 403 && r.j.banned && r.j.banned.reason === '시험');
  r = await call('POST', '/v1/admin/ban', { uid, lift: true }, adm); t('해제', r.j && r.j.ok && r.j.ban === null);
  r = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' }); t('해제 뒤 login', r.code === 200);

  // 감사 로그 — 운영 행위 전부(상품·플래그·우편·세이브 수정·정지·해제 = 6)
  r = await call('GET', '/v1/admin/audit', null, adm);
  const acts = r.j ? r.j.audit.map((a) => a.action) : [];
  t('감사 로그 6 + 전후 기록', ['product.set', 'flags.set', 'mail.send', 'save.edit', 'ban.set', 'ban.lift'].every((a) => acts.includes(a)) && r.j.audit.find((a) => a.action === 'save.edit').before.gold === 10 && r.j.audit.every((a) => a.who === 'tester'), acts.join(','));
  t('없는 길 404', (await call('GET', '/v1/nope')).code === 404);

  /* ── W-0334 ① 제재 종류 ── */
  r = await call('POST', '/v1/admin/ban', { uid, kind: 'chat', days: 1, reason: '욕설' }, adm); t('채팅 제재', r.j && r.j.sanctions && r.j.sanctions.chat && r.j.ban === null);
  r = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' }); t('채팅 제재는 login 됨 + 응답에 sanctions.chat', r.code === 200 && r.j.sanctions && r.j.sanctions.chat && r.j.sanctions.chat.reason === '욕설');
  const S2 = { 'X-Session': r.j.token };
  r = await call('POST', '/v1/admin/ban', { uid, kind: 'purchase', reason: '환불 악용' }, adm); t('구매 제재', r.j && r.j.sanctions.purchase);
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'mock', productId: 'go_gem_100', payload: { orderId: 'ord_9', amount: 1200 } }, S2); t('구매 제재면 영수증 403', r.code === 403 && r.j.sanction && r.j.sanction.kind === 'purchase');
  r = await call('POST', '/v1/admin/ban', { uid, kind: 'purchase', lift: true }, adm); t('구매 제재 해제(채팅은 남음)', r.j && !r.j.sanctions.purchase && r.j.sanctions.chat);
  r = await call('POST', '/v1/receipt', { game: 'saga-go', provider: 'mock', productId: 'go_gem_100', payload: { orderId: 'ord_9', amount: 1200 } }, S2); t('해제 뒤 영수증 ok', r.j && r.j.ok);
  t('없는 제재 종류 400', (await call('POST', '/v1/admin/ban', { uid, kind: 'nope' }, adm)).code === 400);

  /* ── W-0334 ② 권한 등급 ── */
  r = await call('PUT', '/v1/admin/admins', { who: 'viewer1', role: 'viewer' }, adm); const vk = r.j && r.j.key; t('owner 가 viewer 만듦 → 열쇠 한 번', r.code === 200 && /^ak_/.test(vk || ''));
  r = await call('PUT', '/v1/admin/admins', { who: 'op1', role: 'operator' }, adm); const ok1 = r.j && r.j.key;
  const V = { 'X-Admin-Key': vk }, O = { 'X-Admin-Key': ok1 };
  r = await call('GET', '/v1/admin/whoami', null, V); t('whoami = viewer1·viewer(이름은 표에서 — 머리 이름 무시)', r.j && r.j.who === 'viewer1' && r.j.role === 'viewer');
  t('viewer 읽기 200', (await call('GET', '/v1/admin/players', null, V)).code === 200);
  t('viewer 쓰기(우편) 403', (await call('POST', '/v1/admin/mail', { uids: [uid], game: 'saga-go', title: 'x' }, V)).code === 403);
  r = await call('POST', '/v1/admin/mail', { uids: [uid], game: 'saga-go', title: '운영자 우편' }, O); t('operator 우편 200', r.code === 200);
  t('operator 플래그 쓰기 403(owner 만)', (await call('PUT', '/v1/admin/flags', { notices: [] }, O)).code === 403);
  t('operator 운영자 표 403', (await call('GET', '/v1/admin/admins', null, O)).code === 403);
  r = await call('GET', '/v1/admin/admins', null, adm); t('운영자 표엔 해시 없음', r.j && r.j.admins.length === 2 && r.j.admins.every((a) => !('key_hash' in a)));
  r = await call('PUT', '/v1/admin/admins', { who: 'viewer1', remove: true }, adm); t('지운 열쇠 401', (await call('GET', '/v1/admin/players', null, V)).code === 401);
  r = await call('GET', '/v1/admin/audit', null, adm); t('감사 로그 행위자 = 운영자 이름', r.j && r.j.audit.some((a) => a.action === 'mail.send' && a.who === 'op1'));

  /* ── W-0334 ③ A/B ── */
  const fl = (await call('GET', '/v1/admin/flags', null, adm)).j.flags;
  r = await call('PUT', '/v1/admin/flags', { ...fl, ab: { shop: { buckets: ['A', 'B'], ratio: [50, 50] } } }, adm); t('A/B 실험 저장', r.code === 200 && r.j.flags.ab.shop);
  r = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' }); const b1 = r.j.ab && r.j.ab.shop;
  const r3 = await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' }); t('login 에 ab — 같은 uid 는 늘 같은 칸', ['A', 'B'].includes(b1) && r3.j.ab.shop === b1, b1);
  const S3 = { 'X-Session': r.j.token };
  const bs = new Set(); for (let i = 0; i < 12; i++) { const x = await call('POST', '/v1/account/login', { device: 'dev_ab_' + String(i).padStart(4, '0'), game: 'saga-go' }); bs.add(x.j.ab.shop); }
  t('여러 계정이면 두 칸 다 나옴', bs.size === 2, [...bs].join(','));
  await call('POST', '/v1/events', { game: 'saga-go', events: [{ ev: 'boot' }] }, S3);
  r = await call('GET', '/v1/admin/metrics?days=1&exp=shop', null, adm); t('지표 bucket 별(DAU·매출)', r.j && r.j.ab && r.j.ab[b1] && r.j.ab[b1].users >= 1 && r.j.ab[b1].revenue >= 1200, JSON.stringify(r.j && r.j.ab));

  /* ── W-0334 ④ 치트 의심(기록만) ── */
  const sv = (await call('GET', '/v1/save/saga-go', null, S3)).j;
  r = await call('PUT', '/v1/save/saga-go', { data: { player: { gold: 9999999, level: 99 } }, rev: sv.rev }, S3); t('세이브 금·레벨 급증도 올라간다(막지 않음)', r.j && r.j.ok);
  const many = []; for (let i = 0; i < 199; i++) { many.push({ ev: 'tick' }); }
  await call('POST', '/v1/events', { game: 'saga-go', events: many }, S3); await call('POST', '/v1/events', { game: 'saga-go', events: many }, S3);
  r = await call('GET', '/v1/admin/suspects', null, adm); const rules = r.j ? r.j.suspects.map((x) => x.rule) : [];
  t('의심 기록 save.jump·events.rate', rules.includes('save.jump') && rules.includes('events.rate') && r.j.suspects.find((x) => x.rule === 'save.jump').detail.hits.length === 2, rules.join(','));
  r = await call('GET', `/v1/admin/players/${uid}`, null, adm); t('플레이어 상세에 의심·제재·ab', r.j && r.j.suspects.length >= 2 && r.j.sanctions.chat && r.j.ab.shop === b1);
  t('자동 제재 없음(의심이어도 login)', (await call('POST', '/v1/account/login', { device: 'dev_test_0001', game: 'saga-go' })).code === 200);

  /* ── W-0334 ⑥ 백업 — 임시 파일 DB 에 표를 세우고 backup.mjs 를 돌려 사본이 열리는지 ── */
  {
    const os = await import('node:os'), fs = await import('node:fs'), { DatabaseSync } = await import('node:sqlite'), { execFileSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsbk-')), dbp = path.join(dir, 'ops.db');
    const d = new DatabaseSync(dbp); d.exec(fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8')); d.prepare('INSERT INTO account(uid,device,created,last_seen) VALUES(?,?,?,?)').run('u_bk', 'dev_backup_01', 1, 1); d.close();
    const o = execFileSync(process.execPath, [path.join(HERE, 'backup.mjs'), '--db', dbp], { encoding: 'utf8' });
    const f = (/OPS-BACKUP OK (.+) \d+/.exec(o) || [])[1], ok = !!f && fs.existsSync(f.trim()) && /계정 1/.test(o);
    t('백업 사본(VACUUM INTO)이 열리고 계정이 있다', ok, o.trim().split('\n').pop());
    fs.rmSync(dir, { recursive: true, force: true });
  }
} catch (e) {
  t('예외 없음', false, String(e && e.stack || e).slice(0, 300) + '\n' + log.slice(-300));
} finally {
  child.kill();
}
console.log(`OPS-SERVER ${fail ? 'FAIL' : 'OK'} ${n - fail}/${n}`);
process.exit(fail ? 1 : 0);
