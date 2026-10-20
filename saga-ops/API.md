# saga-ops API v1 (W-0326 · W-0334) — 정본

서버 `saga-ops/server.mjs`(자체 Node + SQLite, 사용자 결정 (c) 10-19). 기본 `http://127.0.0.1:8810`. 모든 응답은 JSON, 실패는 `{ok:false, why}` + HTTP 코드. CORS 는 `OPS_ORIGINS`(기본 `*`, 쿠키 안 씀).

**판이 붙는 법**: 배포물 `shared/ops/live.json` 의 `server` 에 이 서버 URL 을 적으면 다섯 판 `ops-client.js` 가 부팅 뒤 로그인→플래그→이벤트 전송→우편 확인을 한다. 비어 있으면 아무것도 안 보낸다(오프라인 우선 — 서버가 죽어도 판은 그대로).

## 인증

| 누가 | 어떻게 | 비고 |
|---|---|---|
| 판(플레이어) | `POST /v1/account/login` 이 준 토큰을 `X-Session` 헤더(또는 `sendBeacon` 용 본문 `token`) | 토큰 90일, 정지되면 401/403 |
| 운영 콘솔 | `X-Admin-Key: <운영자 열쇠>` — **admin 표**의 열쇠(이름·등급은 표에서) 또는 처음 시작용 `OPS_ADMIN_KEY`(owner, 이름은 `X-Admin-Who`, 한글은 `encodeURIComponent`) | 등급: **viewer** 읽기(GET) · **operator** 우편·제재·세이브 수정 · **owner** 상품·플래그·운영자. 모자라면 403. 열쇠는 sha256 해시만 저장. 모든 쓰기는 audit 에 전후 기록 |

## 표 (schema.sql)

account(uid·device·email?) · session · save(uid,game → rev,data) · event(uid,game,t,day,ev,d,ab) · mail(지급은 전부 우편) · sanction((uid,kind) — 옛 ban 은 부팅 때 login 으로 옮김) · admin(who·role·key_hash) · suspect(uid,game,t,rule,detail) · flag(key='live' 한 벌) · product(캐시템 표) · receipt((provider,order_id) 유일) · audit

## 판 쪽

| 길 | 몸 | 답 |
|---|---|---|
| `POST /v1/account/login` | `{device(8~64 [A-Za-z0-9_-]), game, email?}` | `{uid, token, expires, sanctions:{chat?,trade?,purchase?}, ab:{실험:칸}}` · 접속 제재면 403 `{banned:{until,reason}}` — chat·trade 는 판이 따른다(`DG.ops.sanctions()`), purchase 는 영수증 403 |
| `GET /v1/account/me` | | `{uid,email,created,last_seen,games}` |
| `PUT /v1/account/email` | `{email}` | `{ok}` (복구용 선택 — 비우면 지움) |
| `POST /v1/events` | `{game, events:[{t,ev,d}] ≤200, token?}` | `{ok,n}` · `d` 는 2KB 로 자름 · `ev` 48자 · 예약 ev: `boot`(DAU)·`error`(오류 수집) |
| `GET /v1/flags?game=` | (인증 없음) | `{server:true, notices[], maintenance, minVersion, events[](tunes), flags{}, products[], pay{mock,toss,google}}` — 판 필터 적용, `flags` 는 `flags[game]` 없으면 `flags['*']` |
| `GET /v1/products?game=` | (인증 없음) | `{products:[{id,name,price,currency,items,store}]}` 판매 중만 |
| `GET /v1/save/:game` | | `{rev, updated, data}` (없으면 rev 0) |
| `PUT /v1/save/:game` | `{data, rev?}` ≤2MB | `{ok, rev}` · `rev` 를 주면 서버와 다를 때 409 `{rev}` (다른 기기 충돌 — 받아서 고른다) · 이전 rev 와 견줘 금류·레벨 급증이면 suspect `save.jump` 기록(막지 않음) |
| `GET /v1/mail?game=` | | `{mails:[{id,title,body,items,created,expires,source}]}` 미수령·기한 안만 |
| `POST /v1/mail/:id/claim` | | `{ok, items, title}` · 두 번이면 `{ok, already:true, items}` · 기한 지나면 410 |
| `POST /v1/receipt` | `{game, provider:'toss'|'google'|'apple'|'mock', productId, payload}` | `{ok, receiptId, mailId}` · 거절 `{ok:false, receiptId, why}` · 같은 `(provider, orderId)` 두 번이면 `{already:true}` (이중 지급 없음) |

**영수증 payload**: toss `{paymentKey, orderId, amount}` → 서버가 `/v1/payments/confirm` 호출(시크릿은 서버만, `test_sk_` 면 샌드박스) · google `{purchaseToken, packageName?}` → Play Developer API(서비스 계정, `purchaseState 0`) · mock `{orderId, amount}` (`OPS_PAY_MOCK=1` 일 때만 — 시험·QC) · apple 은 후속 티켓(네이티브 포장 뒤). 금액은 **상품 표 가격**과 같아야 한다 — 클라이언트 값은 믿지 않는다. 성공하면 상품 `items` 를 우편으로(`source: receipt:<id>`), 지급은 판이 우편을 받을 때.

## 운영 쪽 (`X-Admin-Key`)

| 길 | 몸 / 질의 | 답 |
|---|---|---|
| `GET /v1/admin/players?q=&limit=` | uid·device·email 부분 일치 | `{players:[{…, games, ban, sanctions, suspects(수)}], total}` |
| `GET /v1/admin/players/:uid` | | `{account, ban, sanctions, ab, suspects(50), saves[{game,rev,updated,bytes}], mails, receipts, events(100)}` |
| `GET /v1/admin/players/:uid/save/:game` | | `{rev, data, updated}` |
| `PUT /v1/admin/players/:uid/save/:game` | `{data}` | `{ok, rev}` · audit `save.edit` 에 전·후 |
| `POST /v1/admin/mail` | `{game, uids:[]|all:true, title, body, items:[{kind,id,n}], expires?}` | `{ok, n, ids}` · audit `mail.send` |
| `POST /v1/admin/ban` | `{uid, kind?:'login'(기본)|'chat'|'trade'|'purchase', days?|until?, reason}` / `{uid, kind?, lift:true}` | `{ok, ban(접속 제재), sanctions}` · login 만 세션을 끊음 · audit `ban.set`/`ban.lift` · `sanction.<kind>.set/.lift` |
| `GET/PUT /v1/admin/admins` (owner) | `{who, role:'viewer'|'operator'|'owner', rotate?}` / `{who, remove:true}` | `{admins:[{who,role,created,last_use}]}` / `{ok, who, role, key}` — **key 는 만들거나 rotate 때 한 번만** · audit `admin.set`/`admin.remove` |
| `GET /v1/admin/whoami` | | `{who, role}` |
| `GET /v1/admin/suspects?limit=` | | `{suspects:[{uid,game,t,rule,detail}]}` — 규칙 `save.jump`(금류 max(10만,10배)·레벨 30 넘게 한 번에) · `events.rate`(분당 300 넘음). 자동 제재 없음 |
| `GET/PUT /v1/admin/flags` | live.json 과 같은 꼴 + `flags:{'<game>'|'*': {...}}` + `ab:{실험:{buckets:['A','B'], ratio:[50,50]}}`(uid+실험 해시로 칸 고정) | `{flags}` · audit `flags.set` — **즉시 적용**(판은 부팅·5분마다 받음) |
| `GET/PUT /v1/admin/products` | `{id([a-z0-9_]), game, name, price(최소 단위), currency, items, store_ids:{google,apple}, on_sale}` | `{products}` / `{ok, product}` · audit `product.set` |
| `GET /v1/admin/receipts?limit=` | | `{receipts}` |
| `GET /v1/admin/metrics?days=&game=&exp=` | | `{days:[{day,dau,boots,errors,newUsers,revenue,purchases,d1}], ab:{칸:{users,purchases,revenue}}|null, totals}` — `exp` 를 주면 칸별(사용자는 이벤트에 찍힌 그때 칸, 매출은 지금 배정) — DAU = 그날 이벤트 보낸 uid 수, d1 = 전날 가입자 중 오늘 돌아온 % |
| `GET /v1/admin/errors?q=&limit=` | `ev='error'` 본문 검색 | `{errors}` |
| `GET /v1/admin/events?ev=&game=&limit=` | | `{events}` (퍼널은 ev 이름으로 — 판이 `track('tutorial_done')` 식으로 보낸다) |
| `GET /v1/admin/audit?limit=` | | `{audit:[{t,who,action,target,before,after}]}` |
| `GET /v1/health` | (인증 없음) | `{ok, at, version, db, pay}` |

## 판 쪽 세이브 자동 동기화(W-0334 ⑤ — `ops-client.js`, 판 코드 수정 없음)

서버에 붙으면 `DG.core.persist` 를 감싸 저장 뒤 30초 묶음으로 `PUT /v1/save/:game {data:{k:세이브 키, s:세이브}, rev}`. 부팅 때 서버 rev 가 이 기기가 아는 rev(localStorage `saga-ops/rev/<판>`)보다 크고 같은 프로필 키면 "서버 세이브로 이어할까" 카드(서버 것 → 메모리·localStorage 를 바꾸고 새로 고침 / 이 기기 것 → 서버를 덮음). 409 도 같은 카드. 판이 직접 주려면 `DG.ops.onSave(fn)`. 끄기 `window.DG_NO_OPS_SYNC = true`.

## 백업·공개 배포 — README.md

## 아직 없는 것

iOS 포장·Stripe 어댑터·App Store 영수증(네이티브 포장 뒤) · 채팅·거래 기능 자체(제재 칸만 있다 — 판에 생기면 `DG.ops.sanctions()` 를 본다) · 치트 자동 제재(의도적으로 없음).
