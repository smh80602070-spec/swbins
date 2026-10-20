# saga-ops — 다섯 판 운영 서버(W-0326 2단계 · W-0334 3단계)

운영툴 1단계(`saga-web/tools/ops`, 정적 `live.json`)가 못 하던 것 — 계정·세이브 동기화·이벤트 수집·즉시 플래그·보상 우편·제재·지표·오류 검색·캐시템 영수증 검증·감사 로그 — 을 **의존 없는 Node 한 파일 + SQLite** 로 둔다. 사용자 결정(10-19): (c) 자체 Node(공개 저장소엔 코드만, 서버는 사용자 PC·VPS 에서). 판은 서버 없이도 지금 그대로 돈다.

```
node saga-ops/server.mjs                  # http://127.0.0.1:8810/v1/health · DB saga-ops/data/ops.db(.gitignore)
node saga-ops/test.mjs                    # 한 바퀴 시험(메모리 DB·mock 결제) → OPS-SERVER OK n/n  — QC "운영 서버" 줄이 돈다
node saga-ops/backup.mjs                  # DB 사본 data/backup/ops-YYYY-MM-DD.db(서버 도는 중에도 안전 — VACUUM INTO), 7일 지난 것 지움
```

- 설정은 `saga-ops/.dev.vars`(저장소 금지, 본보기 `.dev.vars.example`): `OPS_ADMIN_KEY`(운영 열쇠 — 없으면 부팅마다 임시 열쇠를 찍는다) · `OPS_ORIGINS` · `OPS_PAY_MOCK` · `TOSS_SECRET_KEY` · `GOOGLE_PLAY_SA_JSON`/`GOOGLE_PLAY_PACKAGE`.
- **판 연결**: `saga-web/shared/ops/live.json` 의 `"server": "http://<호스트>:8810"` 한 줄(공개 파일 — 비밀 없음). 다섯 판 `ops-client.js` 가 부팅 뒤 로그인(익명 기기 id)→플래그→`DG.ops.track` 버퍼 전송(30초·숨길 때 beacon)→우편 확인. 서버 플래그는 `live.json` 보다 우선(즉시 적용).
- **콘솔**: `saga-web/tools/ops`(:8802) 의 서버 탭(플레이어·우편·상품·지표·감사) 이 브라우저에서 이 서버로 직접 간다 — 서버 URL·운영 열쇠는 그 브라우저 localStorage 에만.
- **결제**: 상품 표는 콘솔에서. 영수증은 반드시 서버가 플랫폼에 확인한 뒤 우편으로 지급(`API.md` 영수증 절). 실결제는 사용자 사업자·스토어 계정 몫 — 이 티켓은 샌드박스(토스 `test_sk_`·Play 테스트 트랙·mock)까지.
- **운영자(W-0334)**: 처음엔 `OPS_ADMIN_KEY`(owner)로 콘솔에 붙어 운영자 표에서 사람마다 열쇠를 만든다(viewer·operator·owner — 열쇠는 한 번만 보이고 서버엔 해시만). 그 뒤 환경 열쇠는 금고에.
- **제재 종류·A/B·치트 의심**: 콘솔 서버 탭 — 제재는 접속·채팅·거래·구매 중 고름, A/B 는 서버 플래그 `ab` + 지표의 실험 칸, 의심(세이브 값 급증·이벤트 과다)은 기록·표시만(자동 제재 없음).

### 공개 배포(HTTPS)

판(GitHub Pages)은 https 라 서버도 https 여야 한다(섞인 내용 차단). 서버는 127.0.0.1 에만 묶고 앞에 역방향 프록시를 둔다:

```caddy
# Caddyfile — 도메인만 맞으면 인증서는 Caddy 가 알아서 받는다
ops.예시도메인.kr {
  reverse_proxy 127.0.0.1:8810
}
```

```nginx
# nginx — 인증서는 certbot 등으로
server {
  listen 443 ssl; server_name ops.예시도메인.kr;
  ssl_certificate /etc/letsencrypt/live/ops.예시도메인.kr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ops.예시도메인.kr/privkey.pem;
  client_max_body_size 3m;   # 세이브 2MB
  location / { proxy_pass http://127.0.0.1:8810; proxy_set_header Host $host; }
}
```

- `.dev.vars`: `OPS_ORIGINS=https://<계정>.github.io`(쉼표로 여럿) · `OPS_ADMIN_KEY`=긴 무작위 · `OPS_PAY_MOCK` 은 빼기.
- 판 연결: `saga-web/shared/ops/live.json` 의 `"server": "https://ops.예시도메인.kr"`.
- 백업: `backup.mjs` 를 매일(작업 스케줄러·cron — 스크립트 머리 설명), 사본은 다른 디스크로. 되살리기는 서버를 멈추고 사본을 `data/ops.db` 로.
- 개인정보는 기기 id·선택 이메일뿐.

문서: `API.md`(엔드포인트·표 정본) · `schema.sql` · 티켓 `tasks/web/W-0326.md` · 체제 `SAGA-ARCH.md` §4.2 "서버 층".
