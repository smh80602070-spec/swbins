#!/usr/bin/env node
/**
 * saga-ops 서버(W-0326, 사용자 결정 (c) 자체 Node) — 의존 없는 node 한 파일 + SQLite(node:sqlite, Node 22.13+).
 * 다섯 판(정적 웹)이 선택적으로 붙는 "서버 한 층": 계정·세이브 동기화·이벤트 수집·서버 플래그·우편·영수증 검증·운영 API.
 * 서버가 없어도 판은 지금 그대로 돈다(오프라인 우선) — ops-client.js 는 live.json 의 `server` 가 비면 아무것도 안 보낸다.
 *
 *   node saga-ops/server.mjs [--port 8810] [--host 127.0.0.1] [--db saga-ops/data/ops.db]
 *   환경(.dev.vars, 저장소에 안 담는다): OPS_ADMIN_KEY(운영 API 열쇠 — 없으면 부팅 때 임시 열쇠를 찍는다) · OPS_ORIGINS(CORS 허용, 기본 *)
 *     · OPS_PAY_MOCK=1(mock 결제 허용 — 시험·QC 만) · TOSS_SECRET_KEY(토스페이먼츠 시크릿, test_sk_… 면 샌드박스)
 *     · GOOGLE_PLAY_SA_JSON(서비스 계정 json 경로) · GOOGLE_PLAY_PACKAGE
 *
 * 엔드포인트는 API.md 가 정본. 요약: 판 쪽 /v1/account/login · /v1/save/:game · /v1/events · /v1/flags · /v1/mail(/claim) · /v1/products · /v1/receipt
 *   운영 쪽(X-Admin-Key) /v1/admin/players · /v1/admin/players/:uid(save·events·mails) · /v1/admin/mail · /v1/admin/ban · /v1/admin/flags
 *   · /v1/admin/products · /v1/admin/receipts · /v1/admin/metrics · /v1/admin/errors · /v1/admin/audit
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
loadDevVars(path.join(HERE, '.dev.vars'));
const PORT = +arg('--port', process.env.OPS_PORT || 8810);
const HOST = arg('--host', process.env.OPS_HOST || '127.0.0.1');
const DBP = arg('--db', process.env.OPS_DB || path.join(HERE, 'data', 'ops.db'));
const ADMIN_KEY = process.env.OPS_ADMIN_KEY || crypto.randomBytes(12).toString('hex');
const ORIGINS = (process.env.OPS_ORIGINS || '*').split(',').map((s) => s.trim());
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const SESSION_DAYS = 90, EVENT_D_MAX = 2048, EVENTS_BATCH = 200, SAVE_MAX = 2e6, BODY_MAX = 2.5e6;

function loadDevVars(p) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) { process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
    }
  } catch (e) { /* 없으면 환경 변수만 */ }
}

/* ── DB ── */
if (DBP !== ':memory:') { fs.mkdirSync(path.dirname(DBP), { recursive: true }); }
const db = new DatabaseSync(DBP);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8'));
const q = (sql) => db.prepare(sql);
const now = () => Date.now();
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const J = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } };
const rid = (n) => crypto.randomBytes(n || 16).toString('base64url');
const flagsDoc = () => J((q('SELECT value FROM flag WHERE key=?').get('live') || {}).value, null) || { notices: [], maintenance: { on: false, msg: '', games: [] }, minVersion: {}, events: [], flags: {} };
const audit = (who, action, target, before, after) => q('INSERT INTO audit(t,who,action,target,before,after) VALUES(?,?,?,?,?,?)').run(now(), who || 'admin', action, String(target || ''), before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));

/* ── 오류 ── */
class Http extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
const bad = (msg, extra) => new Http(400, msg, extra);

/* ── 계정·세션 ── */
function banOf(uid) {
  const b = q('SELECT until, reason FROM ban WHERE uid=?').get(uid);
  if (!b) { return null; }
  if (b.until && b.until < now()) { q('DELETE FROM ban WHERE uid=?').run(uid); return null; }
  return { until: b.until, reason: b.reason };
}
function login(body) {
  const device = String(body.device || '').trim(), game = String(body.game || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(device)) { throw bad('device 는 8~64자 [A-Za-z0-9_-]'); }
  if (!GAMES.includes(game)) { throw bad('game 이 다섯 판이 아님'); }
  const email = body.email ? String(body.email).slice(0, 120) : null;
  let a = q('SELECT * FROM account WHERE device=?').get(device);
  const t = now();
  if (!a) {
    a = { uid: 'u_' + rid(9), device, email, created: t, last_seen: t, games: JSON.stringify([game]) };
    q('INSERT INTO account(uid,device,email,created,last_seen,games) VALUES(?,?,?,?,?,?)').run(a.uid, device, email, t, t, a.games);
  } else {
    const games = J(a.games, []); if (!games.includes(game)) { games.push(game); }
    q('UPDATE account SET last_seen=?, games=?, email=COALESCE(?, email) WHERE uid=?').run(t, JSON.stringify(games), email, a.uid);
  }
  const ban = banOf(a.uid);
  if (ban) { throw new Http(403, '정지된 계정', { banned: ban }); }
  const token = 's_' + rid(24);
  q('INSERT INTO session(token,uid,created,expires) VALUES(?,?,?,?)').run(token, a.uid, t, t + SESSION_DAYS * 864e5);
  q('DELETE FROM session WHERE uid=? AND expires<?').run(a.uid, t);
  return { uid: a.uid, token, expires: t + SESSION_DAYS * 864e5 };
}
function auth(req, body) {
  const token = req.headers['x-session'] || (body && body.token) || '';
  const s = token && q('SELECT uid, expires FROM session WHERE token=?').get(String(token));
  if (!s || s.expires < now()) { throw new Http(401, '세션 없음·만료 — 다시 login'); }
  const ban = banOf(s.uid);
  if (ban) { throw new Http(403, '정지된 계정', { banned: ban }); }
  q('UPDATE account SET last_seen=? WHERE uid=?').run(now(), s.uid);
  return s.uid;
}
function admin(req) {
  const k = req.headers['x-admin-key'] || '';
  if (!k || !safeEq(String(k), ADMIN_KEY)) { throw new Http(401, '운영 열쇠(X-Admin-Key) 틀림'); }
  return String(req.headers['x-admin-who'] || 'admin').slice(0, 40);
}
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const gameOf = (s) => { if (!GAMES.includes(s)) { throw bad('game 이 다섯 판이 아님'); } return s; };

/* ── 판 쪽 ── */
function flagsFor(game) {
  const d = flagsDoc(), mine = (x) => !x.games || !x.games.length || x.games.includes(game);
  const products = q('SELECT id,name,price,currency,items,store_ids FROM product WHERE game=? AND on_sale=1 ORDER BY price').all(game)
    .map((p) => ({ ...p, items: J(p.items, []), store: J(p.store_ids, {}) , store_ids: undefined }));
  return {
    server: true, at: now(),
    notices: (d.notices || []).filter(mine), maintenance: mine(d.maintenance || {}) ? d.maintenance : { on: false },
    minVersion: d.minVersion || {}, events: (d.events || []).filter(mine), flags: (d.flags || {})[game] || (d.flags || {})['*'] || {},
    products, pay: { mock: process.env.OPS_PAY_MOCK === '1', toss: !!process.env.TOSS_SECRET_KEY, google: !!process.env.GOOGLE_PLAY_SA_JSON }
  };
}
function postEvents(uid, body) {
  const list = Array.isArray(body.events) ? body.events.slice(0, EVENTS_BATCH) : [];
  const game = gameOf(String(body.game || ''));
  const ins = q('INSERT INTO event(uid,game,t,day,ev,d) VALUES(?,?,?,?,?,?)');
  let n = 0; const t0 = now();
  for (const e of list) {
    if (!e || !e.ev) { continue; }
    const t = (typeof e.t === 'number' && e.t > 0 && e.t < t0 + 864e5) ? e.t : t0;
    let d = e.d == null ? null : JSON.stringify(e.d); if (d && d.length > EVENT_D_MAX) { d = d.slice(0, EVENT_D_MAX); }
    ins.run(uid, game, t, day(t0), String(e.ev).slice(0, 48), d); n++;
  }
  return { ok: true, n };
}
function mailList(uid, game) {
  const t = now();
  return q('SELECT id,title,body,items,created,expires,source FROM mail WHERE uid=? AND game=? AND claimed IS NULL AND (expires IS NULL OR expires>?) ORDER BY id').all(uid, game, t)
    .map((m) => ({ ...m, items: J(m.items, []) }));
}
function mailClaim(uid, id) {
  const m = q('SELECT * FROM mail WHERE id=? AND uid=?').get(id, uid);
  if (!m) { throw new Http(404, '우편 없음'); }
  if (m.claimed) { return { ok: true, already: true, items: J(m.items, []) }; }
  if (m.expires && m.expires < now()) { throw new Http(410, '기한 지남'); }
  q('UPDATE mail SET claimed=? WHERE id=?').run(now(), id);
  return { ok: true, items: J(m.items, []), title: m.title };
}
function sendMail(uid, game, title, body, items, expires, source) {
  const r = q('INSERT INTO mail(uid,game,title,body,items,source,created,expires) VALUES(?,?,?,?,?,?,?,?)')
    .run(uid, game, String(title).slice(0, 80), String(body || '').slice(0, 1000), JSON.stringify(Array.isArray(items) ? items : []), source || 'admin', now(), expires || null);
  return Number(r.lastInsertRowid);
}

/* ── 영수증 검증 — 플랫폼별 어댑터. 성공 조건: 플랫폼이 "결제 끝" + 금액(또는 sku) 이 상품 표와 같음 ── */
const PAY = {
  async mock(p, product) {
    if (process.env.OPS_PAY_MOCK !== '1') { return { ok: false, why: 'mock 결제 꺼짐(OPS_PAY_MOCK=1 일 때만)' }; }
    if (+p.amount !== product.price) { return { ok: false, why: '금액 다름' }; }
    return { ok: true, amount: product.price, raw: { mock: true } };
  },
  async toss(p, product) {
    const key = process.env.TOSS_SECRET_KEY; if (!key) { return { ok: false, why: 'TOSS_SECRET_KEY 없음' }; }
    if (!p.paymentKey || !p.orderId) { return { ok: false, why: 'paymentKey·orderId 필요' }; }
    if (+p.amount !== product.price) { return { ok: false, why: '금액 다름(클라이언트 ≠ 상품 표)' }; }
    const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey: p.paymentKey, orderId: p.orderId, amount: product.price })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status !== 'DONE' || +j.totalAmount !== product.price) { return { ok: false, why: 'toss ' + (j.code || r.status) + ' ' + (j.message || j.status || ''), raw: j }; }
    return { ok: true, amount: j.totalAmount, raw: { status: j.status, method: j.method, approvedAt: j.approvedAt, currency: j.currency } };
  },
  async google(p, product) {
    const saPath = process.env.GOOGLE_PLAY_SA_JSON; if (!saPath) { return { ok: false, why: 'GOOGLE_PLAY_SA_JSON 없음' }; }
    const sku = (J(product.store_ids, {}) || {}).google || product.id, pkg = p.packageName || process.env.GOOGLE_PLAY_PACKAGE;
    if (!p.purchaseToken || !pkg) { return { ok: false, why: 'purchaseToken·packageName 필요' }; }
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    const tok = await googleToken(sa);
    const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(p.purchaseToken)}`, { headers: { Authorization: 'Bearer ' + tok } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.purchaseState !== 0) { return { ok: false, why: 'google ' + r.status + ' ' + (j.error ? j.error.message : 'purchaseState ' + j.purchaseState), raw: j }; }
    return { ok: true, amount: product.price, raw: { orderId: j.orderId, purchaseTimeMillis: j.purchaseTimeMillis, acknowledgementState: j.acknowledgementState } };
  },
  async apple() { return { ok: false, why: 'App Store 는 네이티브 포장 뒤(후속 티켓)' }; }
};
async function googleToken(sa) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  const c = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: sa.token_uri, iat: t, exp: t + 3600 })).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + c), sa.private_key).toString('base64url');
  const r = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + h + '.' + c + '.' + sig });
  const j = await r.json(); if (!j.access_token) { throw new Http(502, 'google token 실패 ' + JSON.stringify(j).slice(0, 200)); }
  return j.access_token;
}
async function receipt(uid, body) {
  const game = gameOf(String(body.game || '')), provider = String(body.provider || ''), p = body.payload || {};
  if (!PAY[provider]) { throw bad('provider 는 toss|google|apple|mock'); }
  const orderId = String(p.orderId || p.purchaseToken || '').slice(0, 200); if (!orderId) { throw bad('orderId(또는 purchaseToken) 필요'); }
  const dup = q('SELECT id,status,mail_id FROM receipt WHERE provider=? AND order_id=?').get(provider, orderId);
  if (dup) { return { ok: dup.status === 'ok', already: true, receiptId: dup.id, mailId: dup.mail_id, why: dup.status === 'ok' ? null : dup.status }; }
  const product = q('SELECT * FROM product WHERE id=? AND game=?').get(String(body.productId || ''), game);
  if (!product) { throw bad('상품 없음'); }
  if (!product.on_sale) { throw bad('판매 중이 아님'); }
  const v = await PAY[provider](p, product);
  const r = q('INSERT INTO receipt(uid,game,provider,order_id,product_id,amount,status,raw,created) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(uid, game, provider, orderId, product.id, v.amount || 0, v.ok ? 'ok' : 'fail:' + v.why, JSON.stringify(v.raw || null).slice(0, 4000), now());
  const receiptId = Number(r.lastInsertRowid);
  if (!v.ok) { return { ok: false, receiptId, why: v.why }; }
  const mailId = sendMail(uid, game, product.name, '구매해 주셔서 고맙습니다', J(product.items, []), null, 'receipt:' + receiptId);
  q('UPDATE receipt SET mail_id=? WHERE id=?').run(mailId, receiptId);
  return { ok: true, receiptId, mailId };
}

/* ── 운영 쪽 ── */
const A = {
  players(u) {
    const s = (u.searchParams.get('q') || '').trim(), lim = Math.min(+u.searchParams.get('limit') || 50, 200);
    const rows = s ? q('SELECT * FROM account WHERE uid LIKE ? OR device LIKE ? OR email LIKE ? ORDER BY last_seen DESC LIMIT ?').all('%' + s + '%', '%' + s + '%', '%' + s + '%', lim)
      : q('SELECT * FROM account ORDER BY last_seen DESC LIMIT ?').all(lim);
    return { players: rows.map((a) => ({ ...a, games: J(a.games, []), ban: banOf(a.uid) })), total: q('SELECT COUNT(*) n FROM account').get().n };
  },
  player(uid) {
    const a = q('SELECT * FROM account WHERE uid=?').get(uid); if (!a) { throw new Http(404, '계정 없음'); }
    return {
      account: { ...a, games: J(a.games, []) }, ban: banOf(uid),
      saves: q('SELECT game,rev,updated,length(data) bytes FROM save WHERE uid=?').all(uid),
      mails: q('SELECT * FROM mail WHERE uid=? ORDER BY id DESC LIMIT 50').all(uid).map((m) => ({ ...m, items: J(m.items, []) })),
      receipts: q('SELECT id,game,provider,order_id,product_id,amount,status,created FROM receipt WHERE uid=? ORDER BY id DESC LIMIT 50').all(uid),
      events: q('SELECT t,game,ev,d FROM event WHERE uid=? ORDER BY t DESC LIMIT 100').all(uid).map((e) => ({ ...e, d: J(e.d, null) }))
    };
  },
  save(uid, game) { const s = q('SELECT * FROM save WHERE uid=? AND game=?').get(uid, gameOf(game)); if (!s) { throw new Http(404, '세이브 없음'); } return { ...s, data: J(s.data, null) }; },
  saveSet(who, uid, game, body) {
    gameOf(game); const cur = q('SELECT rev,data FROM save WHERE uid=? AND game=?').get(uid, game);
    const data = JSON.stringify(body.data); if (data.length > SAVE_MAX) { throw bad('세이브 너무 큼'); }
    const rev = (cur ? cur.rev : 0) + 1;
    q('INSERT INTO save(uid,game,rev,data,updated) VALUES(?,?,?,?,?) ON CONFLICT(uid,game) DO UPDATE SET rev=excluded.rev, data=excluded.data, updated=excluded.updated').run(uid, game, rev, data, now());
    audit(who, 'save.edit', uid + '/' + game, cur ? J(cur.data, null) : null, body.data);
    return { ok: true, rev };
  },
  mail(who, body) {
    const game = gameOf(String(body.game || '')), items = Array.isArray(body.items) ? body.items : [];
    if (!body.title) { throw bad('title 필요'); }
    let uids = Array.isArray(body.uids) ? body.uids.map(String) : [];
    if (body.all) { uids = q('SELECT uid FROM account WHERE games LIKE ?').all('%"' + game + '"%').map((r) => r.uid); }
    if (!uids.length) { throw bad('uids 또는 all'); }
    const out = [];
    for (const uid of uids) { out.push(sendMail(uid, game, body.title, body.body, items, body.expires || null, 'admin')); }
    audit(who, 'mail.send', game, null, { n: out.length, title: body.title, items, all: !!body.all });
    return { ok: true, n: out.length, ids: out.slice(0, 20) };
  },
  ban(who, body) {
    const uid = String(body.uid || ''); if (!q('SELECT 1 FROM account WHERE uid=?').get(uid)) { throw new Http(404, '계정 없음'); }
    const before = banOf(uid);
    if (body.lift) { q('DELETE FROM ban WHERE uid=?').run(uid); audit(who, 'ban.lift', uid, before, null); return { ok: true, ban: null }; }
    const until = body.days ? now() + (+body.days) * 864e5 : (body.until || null);
    q('INSERT INTO ban(uid,until,reason,created,by) VALUES(?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET until=excluded.until, reason=excluded.reason, created=excluded.created, by=excluded.by').run(uid, until, String(body.reason || '').slice(0, 200), now(), who);
    q('DELETE FROM session WHERE uid=?').run(uid);
    const after = banOf(uid); audit(who, 'ban.set', uid, before, after); return { ok: true, ban: after };
  },
  flagsSet(who, body) {
    const d = body && typeof body === 'object' ? body : null; if (!d) { throw bad('객체가 아님'); }
    if (!Array.isArray(d.notices || [])) { throw bad('notices 배열'); }
    for (const n of d.notices || []) { if (!n || !n.id || !n.title) { throw bad('공지엔 id·title'); } }
    const doc = { notices: d.notices || [], maintenance: d.maintenance || { on: false, msg: '', games: [] }, minVersion: d.minVersion || {}, events: d.events || [], flags: d.flags || {} };
    const before = flagsDoc();
    q('INSERT INTO flag(key,value,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated').run('live', JSON.stringify(doc), now());
    audit(who, 'flags.set', 'live', before, doc); return { ok: true, flags: doc };
  },
  products() { return { products: q('SELECT * FROM product ORDER BY game, price').all().map((p) => ({ ...p, items: J(p.items, []), store_ids: J(p.store_ids, {}) })) }; },
  productSet(who, body) {
    const id = String(body.id || ''); if (!/^[a-z0-9_]{3,40}$/.test(id)) { throw bad('id 는 [a-z0-9_] 3~40'); }
    const game = gameOf(String(body.game || '')); const price = Math.floor(+body.price); if (!(price >= 0)) { throw bad('price'); }
    const before = q('SELECT * FROM product WHERE id=?').get(id) || null;
    const row = { id, game, name: String(body.name || id).slice(0, 60), price, currency: String(body.currency || 'KRW').slice(0, 3), items: JSON.stringify(Array.isArray(body.items) ? body.items : []), store_ids: JSON.stringify(body.store_ids || body.store || {}), on_sale: body.on_sale === false || body.on_sale === 0 ? 0 : 1, updated: now() };
    q('INSERT INTO product(id,game,name,price,currency,items,store_ids,on_sale,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET game=excluded.game,name=excluded.name,price=excluded.price,currency=excluded.currency,items=excluded.items,store_ids=excluded.store_ids,on_sale=excluded.on_sale,updated=excluded.updated')
      .run(row.id, row.game, row.name, row.price, row.currency, row.items, row.store_ids, row.on_sale, row.updated);
    audit(who, 'product.set', id, before, row); return { ok: true, product: row };
  },
  receipts(u) { const lim = Math.min(+u.searchParams.get('limit') || 100, 500); return { receipts: q('SELECT id,uid,game,provider,order_id,product_id,amount,status,mail_id,created FROM receipt ORDER BY id DESC LIMIT ?').all(lim) }; },
  metrics(u) {
    const days = Math.min(+u.searchParams.get('days') || 14, 90), game = u.searchParams.get('game') || null, out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = day(now() - i * 864e5), gw = game ? ' AND game=?' : '', ga = game ? [game] : [];
      const dau = q('SELECT COUNT(DISTINCT uid) n FROM event WHERE day=?' + gw).get(d, ...ga).n;
      const boots = q("SELECT COUNT(*) n FROM event WHERE day=? AND ev='boot'" + gw).get(d, ...ga).n;
      const errors = q("SELECT COUNT(*) n FROM event WHERE day=? AND ev='error'" + gw).get(d, ...ga).n;
      const newU = q('SELECT COUNT(*) n FROM account WHERE created>=? AND created<?').get(Date.parse(d), Date.parse(d) + 864e5).n;
      const rev = q("SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM receipt WHERE status='ok' AND created>=? AND created<?" + gw).get(Date.parse(d), Date.parse(d) + 864e5, ...ga);
      const prev = day(now() - (i + 1) * 864e5);
      const cohort = q('SELECT COUNT(*) n FROM account WHERE created>=? AND created<?').get(Date.parse(prev), Date.parse(prev) + 864e5).n;
      const back = cohort ? q('SELECT COUNT(DISTINCT e.uid) n FROM event e JOIN account a ON a.uid=e.uid WHERE e.day=? AND a.created>=? AND a.created<?').get(d, Date.parse(prev), Date.parse(prev) + 864e5).n : 0;
      out.push({ day: d, dau, boots, errors, newUsers: newU, revenue: rev.s, purchases: rev.n, d1: cohort ? Math.round(100 * back / cohort) : null });
    }
    return { days: out, totals: { accounts: q('SELECT COUNT(*) n FROM account').get().n, revenue: q("SELECT COALESCE(SUM(amount),0) s FROM receipt WHERE status='ok'").get().s } };
  },
  errors(u) {
    const s = (u.searchParams.get('q') || '').trim(), lim = Math.min(+u.searchParams.get('limit') || 100, 500);
    return { errors: q("SELECT id,uid,game,t,d FROM event WHERE ev='error' AND (?='' OR d LIKE ?) ORDER BY id DESC LIMIT ?").all(s, '%' + s + '%', lim).map((e) => ({ ...e, d: J(e.d, null) })) };
  },
  events(u) {
    const ev = u.searchParams.get('ev') || '', game = u.searchParams.get('game') || '', lim = Math.min(+u.searchParams.get('limit') || 100, 500);
    return { events: q("SELECT id,uid,game,t,ev,d FROM event WHERE (?='' OR ev=?) AND (?='' OR game=?) ORDER BY id DESC LIMIT ?").all(ev, ev, game, game, lim).map((e) => ({ ...e, d: J(e.d, null) })) };
  },
  audit(u) { const lim = Math.min(+u.searchParams.get('limit') || 100, 500); return { audit: q('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(lim).map((a) => ({ ...a, before: J(a.before, null), after: J(a.after, null) })) }; }
};

/* ── HTTP ── */
const readBody = (req) => new Promise((resolve, reject) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > BODY_MAX) { reject(new Http(413, '본문 너무 큼')); req.destroy(); } }); req.on('end', () => resolve(s)); req.on('error', reject); });
function cors(req, res) {
  const o = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ORIGINS.includes('*') ? '*' : (ORIGINS.includes(o) ? o : ORIGINS[0]));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session, X-Admin-Key, X-Admin-Who');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
}
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };

async function route(req, res) {
  const u = new URL(req.url, 'http://x'), p = u.pathname, m = req.method;
  const seg = p.split('/').filter(Boolean);                     // ['v1', ...]
  let body = null;
  if (m === 'POST' || m === 'PUT') { const s = await readBody(req); try { body = s ? JSON.parse(s) : {}; } catch (e) { throw bad('JSON 아님'); } }
  if (p === '/v1/health') { return json(res, 200, { ok: true, at: now(), version: 1, db: DBP === ':memory:' ? 'memory' : 'file', pay: { mock: process.env.OPS_PAY_MOCK === '1', toss: !!process.env.TOSS_SECRET_KEY, google: !!process.env.GOOGLE_PLAY_SA_JSON } }); }
  if (seg[0] !== 'v1') { throw new Http(404, '없는 길'); }
  if (seg[1] === 'admin') {
    const who = admin(req), k = seg[2], id = seg[3] ? decodeURIComponent(seg[3]) : null;
    if (k === 'players' && m === 'GET' && !id) { return json(res, 200, A.players(u)); }
    if (k === 'players' && id && !seg[4] && m === 'GET') { return json(res, 200, A.player(id)); }
    if (k === 'players' && id && seg[4] === 'save' && seg[5] && m === 'GET') { return json(res, 200, A.save(id, seg[5])); }
    if (k === 'players' && id && seg[4] === 'save' && seg[5] && m === 'PUT') { return json(res, 200, A.saveSet(who, id, seg[5], body)); }
    if (k === 'mail' && m === 'POST') { return json(res, 200, A.mail(who, body)); }
    if (k === 'ban' && m === 'POST') { return json(res, 200, A.ban(who, body)); }
    if (k === 'flags' && m === 'GET') { return json(res, 200, { flags: flagsDoc() }); }
    if (k === 'flags' && m === 'PUT') { return json(res, 200, A.flagsSet(who, body)); }
    if (k === 'products' && m === 'GET') { return json(res, 200, A.products()); }
    if (k === 'products' && m === 'PUT') { return json(res, 200, A.productSet(who, body)); }
    if (k === 'receipts' && m === 'GET') { return json(res, 200, A.receipts(u)); }
    if (k === 'metrics' && m === 'GET') { return json(res, 200, A.metrics(u)); }
    if (k === 'errors' && m === 'GET') { return json(res, 200, A.errors(u)); }
    if (k === 'events' && m === 'GET') { return json(res, 200, A.events(u)); }
    if (k === 'audit' && m === 'GET') { return json(res, 200, A.audit(u)); }
    throw new Http(404, '없는 운영 길');
  }
  if (seg[1] === 'account' && seg[2] === 'login' && m === 'POST') { return json(res, 200, login(body)); }
  if (seg[1] === 'flags' && m === 'GET') { return json(res, 200, flagsFor(gameOf(u.searchParams.get('game') || ''))); }
  if (seg[1] === 'products' && m === 'GET') { return json(res, 200, { products: flagsFor(gameOf(u.searchParams.get('game') || '')).products }); }
  if (!['account', 'events', 'save', 'mail', 'receipt'].includes(seg[1])) { throw new Http(404, '없는 길'); }
  const uid = auth(req, body);
  if (seg[1] === 'account' && seg[2] === 'me' && m === 'GET') { const a = q('SELECT uid,email,created,last_seen,games FROM account WHERE uid=?').get(uid); return json(res, 200, { ...a, games: J(a.games, []) }); }
  if (seg[1] === 'account' && seg[2] === 'email' && m === 'PUT') { q('UPDATE account SET email=? WHERE uid=?').run(String(body.email || '').slice(0, 120) || null, uid); return json(res, 200, { ok: true }); }
  if (seg[1] === 'events' && m === 'POST') { return json(res, 200, postEvents(uid, body)); }
  if (seg[1] === 'save' && seg[2] && m === 'GET') { const s = q('SELECT rev,data,updated FROM save WHERE uid=? AND game=?').get(uid, gameOf(seg[2])); return json(res, 200, s ? { rev: s.rev, updated: s.updated, data: J(s.data, null) } : { rev: 0, data: null }); }
  if (seg[1] === 'save' && seg[2] && m === 'PUT') {
    const game = gameOf(seg[2]), cur = q('SELECT rev FROM save WHERE uid=? AND game=?').get(uid, game), rev = cur ? cur.rev : 0;
    if (body.rev != null && +body.rev !== rev) { return json(res, 409, { ok: false, why: '서버 rev 가 다름(다른 기기가 올림) — GET 으로 받아 고르기', rev }); }
    const data = JSON.stringify(body.data == null ? null : body.data); if (data.length > SAVE_MAX) { throw bad('세이브 너무 큼'); }
    q('INSERT INTO save(uid,game,rev,data,updated) VALUES(?,?,?,?,?) ON CONFLICT(uid,game) DO UPDATE SET rev=excluded.rev, data=excluded.data, updated=excluded.updated').run(uid, game, rev + 1, data, now());
    return json(res, 200, { ok: true, rev: rev + 1 });
  }
  if (seg[1] === 'mail' && !seg[2] && m === 'GET') { return json(res, 200, { mails: mailList(uid, gameOf(u.searchParams.get('game') || '')) }); }
  if (seg[1] === 'mail' && seg[2] && seg[3] === 'claim' && m === 'POST') { return json(res, 200, mailClaim(uid, +seg[2])); }
  if (seg[1] === 'receipt' && m === 'POST') { return json(res, 200, await receipt(uid, body)); }
  throw new Http(404, '없는 길');
}

export const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try { await route(req, res); }
  catch (e) {
    if (e instanceof Http) { return json(res, e.code, { ok: false, why: e.message, ...(e.extra || {}) }); }
    console.error('[ops]', e); json(res, 500, { ok: false, why: '서버 오류' });
  }
});
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log(`saga-ops http://${HOST}:${PORT}/v1/health  db=${DBP}  pay(mock ${process.env.OPS_PAY_MOCK === '1' ? '켬' : '끔'} · toss ${process.env.TOSS_SECRET_KEY ? '있음' : '없음'} · google ${process.env.GOOGLE_PLAY_SA_JSON ? '있음' : '없음'})`);
    if (!process.env.OPS_ADMIN_KEY) { console.log(`운영 열쇠(임시 — .dev.vars 에 OPS_ADMIN_KEY 로 고정하라): ${ADMIN_KEY}`); }
  });
}
export { ADMIN_KEY };
