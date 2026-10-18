# saga-ops — 다섯 판 운영 서버(W-0326, 2단계)

운영툴 1단계(`saga-web/tools/ops`, 정적 `live.json`)가 못 하던 것 — 계정·세이브 동기화·이벤트 수집·즉시 플래그·보상 우편·제재·지표·오류 검색·캐시템 영수증 검증·감사 로그 — 을 **의존 없는 Node 한 파일 + SQLite** 로 둔다. 사용자 결정(10-19): (c) 자체 Node(공개 저장소엔 코드만, 서버는 사용자 PC·VPS 에서). 판은 서버 없이도 지금 그대로 돈다.

```
node saga-ops/server.mjs                  # http://127.0.0.1:8810/v1/health · DB saga-ops/data/ops.db(.gitignore)
node saga-ops/test.mjs                    # 한 바퀴 시험(메모리 DB·mock 결제) → OPS-SERVER OK 40/40  — QC "운영 서버" 줄이 돈다
```

- 설정은 `saga-ops/.dev.vars`(저장소 금지, 본보기 `.dev.vars.example`): `OPS_ADMIN_KEY`(운영 열쇠 — 없으면 부팅마다 임시 열쇠를 찍는다) · `OPS_ORIGINS` · `OPS_PAY_MOCK` · `TOSS_SECRET_KEY` · `GOOGLE_PLAY_SA_JSON`/`GOOGLE_PLAY_PACKAGE`.
- **판 연결**: `saga-web/shared/ops/live.json` 의 `"server": "http://<호스트>:8810"` 한 줄(공개 파일 — 비밀 없음). 다섯 판 `ops-client.js` 가 부팅 뒤 로그인(익명 기기 id)→플래그→`DG.ops.track` 버퍼 전송(30초·숨길 때 beacon)→우편 확인. 서버 플래그는 `live.json` 보다 우선(즉시 적용).
- **콘솔**: `saga-web/tools/ops`(:8802) 의 서버 탭(플레이어·우편·상품·지표·감사) 이 브라우저에서 이 서버로 직접 간다 — 서버 URL·운영 열쇠는 그 브라우저 localStorage 에만.
- **결제**: 상품 표는 콘솔에서. 영수증은 반드시 서버가 플랫폼에 확인한 뒤 우편으로 지급(`API.md` 영수증 절). 실결제는 사용자 사업자·스토어 계정 몫 — 이 티켓은 샌드박스(토스 `test_sk_`·Play 테스트 트랙·mock)까지.
- **공개 배포 때**: HTTPS 종단(reverse proxy)·`OPS_ORIGINS` 를 Pages 주소로·DB 백업(`data/` 복사)·`OPS_ADMIN_KEY` 긴 무작위. 개인정보는 기기 id·선택 이메일뿐.

문서: `API.md`(엔드포인트·표 정본) · `schema.sql` · 티켓 `tasks/web/W-0326.md` · 체제 `SAGA-ARCH.md` §4.2 "서버 층".
