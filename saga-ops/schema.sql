-- saga-ops 스키마(W-0326) — server.mjs 가 부팅 때 그대로 실행한다(IF NOT EXISTS · 되풀이 안전). SQLite(node:sqlite).
-- 개인정보 최소: 계정은 익명 기기 id 가 전부, 이메일은 선택(복구용). 세이브는 판이 올린 JSON 그대로(서버는 해석하지 않는다).

CREATE TABLE IF NOT EXISTS account (
  uid       TEXT PRIMARY KEY,          -- 서버가 준 계정 id(공개 가능)
  device    TEXT UNIQUE NOT NULL,      -- 판 ops-client 가 만든 기기 id(localStorage)
  email     TEXT,                      -- 선택
  created   INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  games     TEXT NOT NULL DEFAULT '[]' -- 들어온 판 id 목록(JSON)
);
CREATE TABLE IF NOT EXISTS session (
  token   TEXT PRIMARY KEY,
  uid     TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_uid ON session(uid);

CREATE TABLE IF NOT EXISTS save (                 -- 판별 세이브 한 벌(동기화 — 판의 localStorage 가 정본, 서버는 사본·복구용)
  uid     TEXT NOT NULL,
  game    TEXT NOT NULL,
  rev     INTEGER NOT NULL DEFAULT 1,
  data    TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (uid, game)
);

CREATE TABLE IF NOT EXISTS event (                -- DG.ops.track 수집(boot·error·구매·퍼널…)
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  uid  TEXT NOT NULL,
  game TEXT NOT NULL,
  t    INTEGER NOT NULL,                          -- 클라이언트 시각(ms)
  day  TEXT NOT NULL,                             -- 서버 기준 YYYY-MM-DD(UTC) — 지표 집계 키
  ev   TEXT NOT NULL,
  d    TEXT                                       -- JSON(≤2KB)
);
CREATE INDEX IF NOT EXISTS idx_event_game_day ON event(game, day);
CREATE INDEX IF NOT EXISTS idx_event_ev ON event(ev, day);
CREATE INDEX IF NOT EXISTS idx_event_uid ON event(uid, t);

CREATE TABLE IF NOT EXISTS mail (                 -- 보상 우편: 지급은 전부 여기로(운영 보상·결제 지급·일괄 보정)
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  uid     TEXT NOT NULL,
  game    TEXT NOT NULL,
  title   TEXT NOT NULL,
  body    TEXT NOT NULL DEFAULT '',
  items   TEXT NOT NULL DEFAULT '[]',             -- [{kind,id,n}] — 뜻은 판이 안다(DG.ops.onMail)
  source  TEXT NOT NULL DEFAULT 'admin',          -- admin | receipt:<id> | system
  created INTEGER NOT NULL,
  expires INTEGER,                                -- 없으면 무기한
  claimed INTEGER                                 -- 받은 시각(없으면 미수령)
);
CREATE INDEX IF NOT EXISTS idx_mail_uid ON mail(uid, game, claimed);

CREATE TABLE IF NOT EXISTS ban (
  uid     TEXT PRIMARY KEY,
  until   INTEGER,                                -- 없으면 영구
  reason  TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  by      TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS flag (                 -- 서버 플래그 한 벌(key='live': 공지·점검·최소 버전·이벤트(tunes)·기능 플래그·A/B) — live.json 과 같은 꼴 + flags{}
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL,
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS product (              -- 캐시템 상품 표 — 콘솔이 만든다. 결제는 플랫폼별 영수증 → receipt → mail
  id        TEXT PRIMARY KEY,                     -- 예: go_gem_100
  game      TEXT NOT NULL,
  name      TEXT NOT NULL,
  price     INTEGER NOT NULL,                     -- 최소 단위(KRW 원 · USD 센트)
  currency  TEXT NOT NULL DEFAULT 'KRW',
  items     TEXT NOT NULL DEFAULT '[]',           -- 지급물 [{kind,id,n}]
  store_ids TEXT NOT NULL DEFAULT '{}',           -- {google:'sku', apple:'sku'} — PC 는 id 그대로
  on_sale   INTEGER NOT NULL DEFAULT 1,
  updated   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt (              -- 영수증 — 서버가 플랫폼에 확인한 뒤에만 ok. (provider, order_id) 유일 = 같은 영수증 두 번 지급 안 됨
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL,
  game       TEXT NOT NULL,
  provider   TEXT NOT NULL,                       -- toss | google | apple | mock(OPS_PAY_MOCK=1 일 때만)
  order_id   TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL,                       -- ok | fail:<이유>
  raw        TEXT,                                -- 플랫폼 응답(요약)
  mail_id    INTEGER,
  created    INTEGER NOT NULL,
  UNIQUE (provider, order_id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_uid ON receipt(uid, created);

CREATE TABLE IF NOT EXISTS audit (                -- 운영자 행위 전부(전후 기록) — 지우지 않는다
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  t      INTEGER NOT NULL,
  who    TEXT NOT NULL,                           -- 운영자 이름(X-Admin-Who, 없으면 admin)
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  before TEXT,
  after  TEXT
);

-- W-0334 ① 제재 종류 — (uid, kind) 마다 한 줄. kind: login(접속 차단) · chat · trade · purchase(영수증 거절). 옛 ban 줄은 부팅 때 login 으로 옮긴다
CREATE TABLE IF NOT EXISTS sanction (
  uid     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  until   INTEGER,                                -- 없으면 영구
  reason  TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  by      TEXT NOT NULL DEFAULT 'admin',
  PRIMARY KEY (uid, kind)
);

-- W-0334 ② 운영자 — 열쇠는 sha256 해시만(원문은 만들 때 한 번만 보여 준다). role: viewer(읽기) · operator(우편·제재·세이브 수정) · owner(상품·플래그·운영자)
CREATE TABLE IF NOT EXISTS admin (
  who      TEXT PRIMARY KEY,
  role     TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created  INTEGER NOT NULL,
  last_use INTEGER
);

-- W-0334 ④ 치트 의심 — 기록만(자동 제재 없음). 콘솔 플레이어 탭이 보여 준다
CREATE TABLE IF NOT EXISTS suspect (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  uid    TEXT NOT NULL,
  game   TEXT NOT NULL,
  t      INTEGER NOT NULL,
  rule   TEXT NOT NULL,                           -- save.jump(값 급증) · events.rate(분당 과다)
  detail TEXT                                     -- JSON
);
CREATE INDEX IF NOT EXISTS idx_suspect_uid ON suspect(uid, t);
