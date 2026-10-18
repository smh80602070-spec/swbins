# saga-ops API v1 (W-0326) — 정본

서버 `saga-ops/server.mjs`(자체 Node + SQLite, 사용자 결정 (c) 10-19). 기본 `http://127.0.0.1:8810`. 모든 응답은 JSON, 실패는 `{ok:false, why}` + HTTP 코드. CORS 는 `OPS_ORIGINS`(기본 `*`, 쿠키 안 씀).

**판이 붙는 법**: 배포물 `shared/ops/live.json` 의 `server` 에 이 서버 URL 을 적으면 다섯 판 `ops-client.js` 가 부팅 뒤 로그인→플래그→이벤트 전송→우편 확인을 한다. 비어 있으면 아무것도 안 보낸다(오프라인 우선 — 서버가 죽어도 판은 그대로).

## 인증

| 누가 | 어떻게 | 비고 |
|---|---|---|
| 판(플레이어) | `POST /v1/account/login` 이 준 토큰을 `X-Session` 헤더(또는 `sendBeacon` 용 본문 `token`) | 토큰 90일, 정지되면 401/403 |
| 운영 콘솔 | `X-Admin-Key: <OPS_ADMIN_KEY>` + 선택 `X-Admin-Who: <운영자 이름>` | 열쇠는 `.dev.vars`(저장소 금지). 모든 쓰기는 audit 에 전후 기록 |

## 표 (schema.sql)

account(uid·device·email?) · session · save(uid,game → rev,data) · event(uid,game,t,day,ev,d) · mail(지급은 전부 우편) · ban · flag(key='live' 한 벌) · product(캐시템 표) · receipt((provider,order_id) 유일) · audit

## 판 쪽

| 길 | 몸 | 답 |
|---|---|---|
| `POST /v1/account/login` | `{device(8~64 [A-Za-z0-9_-]), game, email?}` | `{uid, token, expires}` · 정지면 403 `{banned:{until,reason}}` |
| `GET /v1/account/me` | | `{uid,email,created,last_seen,games}` |
| `PUT /v1/account/email` | `{email}` | `{ok}` (복구용 선택 — 비우면 지움) |
| `POST /v1/events` | `{game, events:[{t,ev,d}] ≤200, token?}` | `{ok,n}` · `d` 는 2KB 로 자름 · `ev` 48자 · 예약 ev: `boot`(DAU)·`error`(오류 수집) |
| `GET /v1/flags?game=` | (인증 없음) | `{server:true, notices[], maintenance, minVersion, events[](tunes), flags{}, products[], pay{mock,toss,google}}` — 판 필터 적용, `flags` 는 `flags[game]` 없으면 `flags['*']` |
| `GET /v1/products?game=` | (인증 없음) | `{products:[{id,name,price,currency,items,store}]}` 판매 중만 |
| `GET /v1/save/:game` | | `{rev, updated, data}` (없으면 rev 0) |
| `PUT /v1/save/:game` | `{data, rev?}` ≤2MB | `{ok, rev}` · `rev` 를 주면 서버와 다를 때 409 `{rev}` (다른 기기 충돌 — 받아서 고른다) |
| `GET /v1/mail?game=` | | `{mails:[{id,title,body,items,created,expires,source}]}` 미수령·기한 안만 |
| `POST /v1/mail/:id/claim` | | `{ok, items, title}` · 두 번이면 `{ok, already:true, items}` · 기한 지나면 410 |
| `POST /v1/receipt` | `{game, provider:'toss'|'google'|'apple'|'mock', productId, payload}` | `{ok, receiptId, mailId}` · 거절 `{ok:false, receiptId, why}` · 같은 `(provider, orderId)` 두 번이면 `{already:true}` (이중 지급 없음) |

**영수증 payload**: toss `{paymentKey, orderId, amount}` → 서버가 `/v1/payments/confirm` 호출(시크릿은 서버만, `test_sk_` 면 샌드박스) · google `{purchaseToken, packageName?}` → Play Developer API(서비스 계정, `purchaseState 0`) · mock `{orderId, amount}` (`OPS_PAY_MOCK=1` 일 때만 — 시험·QC) · apple 은 후속 티켓(네이티브 포장 뒤). 금액은 **상품 표 가격**과 같아야 한다 — 클라이언트 값은 믿지 않는다. 성공하면 상품 `items` 를 우편으로(`source: receipt:<id>`), 지급은 판이 우편을 받을 때.

## 운영 쪽 (`X-Admin-Key`)

| 길 | 몸 / 질의 | 답 |
|---|---|---|
| `GET /v1/admin/players?q=&limit=` | uid·device·email 부분 일치 | `{players:[{…, games, ban}], total}` |
| `GET /v1/admin/players/:uid` | | `{account, ban, saves[{game,rev,updated,bytes}], mails, receipts, events(100)}` |
| `GET /v1/admin/players/:uid/save/:game` | | `{rev, data, updated}` |
| `PUT /v1/admin/players/:uid/save/:game` | `{data}` | `{ok, rev}` · audit `save.edit` 에 전·후 |
| `POST /v1/admin/mail` | `{game, uids:[]|all:true, title, body, items:[{kind,id,n}], expires?}` | `{ok, n, ids}` · audit `mail.send` |
| `POST /v1/admin/ban` | `{uid, days?|until?, reason}` / `{uid, lift:true}` | `{ok, ban}` · 세션 전부 끊음 · audit `ban.set`/`ban.lift` |
| `GET/PUT /v1/admin/flags` | live.json 과 같은 꼴 + `flags:{'<game>'|'*': {...}}` | `{flags}` · audit `flags.set` — **즉시 적용**(판은 부팅·5분마다 받음) |
| `GET/PUT /v1/admin/products` | `{id([a-z0-9_]), game, name, price(최소 단위), currency, items, store_ids:{google,apple}, on_sale}` | `{products}` / `{ok, product}` · audit `product.set` |
| `GET /v1/admin/receipts?limit=` | | `{receipts}` |
| `GET /v1/admin/metrics?days=&game=` | | `{days:[{day,dau,boots,errors,newUsers,revenue,purchases,d1}], totals}` — DAU = 그날 이벤트 보낸 uid 수, d1 = 전날 가입자 중 오늘 돌아온 % |
| `GET /v1/admin/errors?q=&limit=` | `ev='error'` 본문 검색 | `{errors}` |
| `GET /v1/admin/events?ev=&game=&limit=` | | `{events}` (퍼널은 ev 이름으로 — 판이 `track('tutorial_done')` 식으로 보낸다) |
| `GET /v1/admin/audit?limit=` | | `{audit:[{t,who,action,target,before,after}]}` |
| `GET /v1/health` | (인증 없음) | `{ok, at, version, db, pay}` |

## 아직 없는 것(후속 티켓 R-0 — 티켓 ⑦)

제재 종류(채팅 금지 등)·권한 등급(운영자별)·A/B 배정 기록·치트 감지 규칙(지금은 `event` 에 자리만)·iOS 포장·세이브 자동 동기화(지금은 `DG.ops.saveUp/saveDown` 수동)·백업·HTTPS 종단(앞에 reverse proxy 두기).
