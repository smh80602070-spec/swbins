# saga — 역사 인물로 노는 게임 다섯 판(웹 + 3D 두 트랙)

개인 취미 저장소. 회사 일은 `C:\link` 세션, 개인 도구·대시보드는 `C:\swbins2` 세션으로 되짚어 준다.
이 파일은 **길잡이**다 — 규칙·수치·이력은 여기 겹쳐 쓰지 않는다.

- 공통 설계: `SAGA-DESIGN.md`(일곱 PLAN 의 상위) · 다섯 판 이야기 정본: `scenario/`
- 웹 다섯 판: `saga-web/<폴더>/PLAN.md` 가 정본, 이력은 각 폴더 `HANDOFF.md`
- 3D 두 트랙(코드 공유 없음): `saga-godot/`(Godot 4)·`saga-unity/`(Unity 6) — 각 폴더 `CLAUDE.md` 부터
- 규칙·방향·함정: `SAGA-HANDOFF.md`(≤80KB) · 이력: `SAGA-HISTORY.md`(grep 으로만, 아래 "토큰" 절)
- 도구: `tools/README.md` · `git commit` 때 훅이 `tools/precheck.sh` 를 돌린다(막히면 원인을 고친다)

## 다섯 판 — 완전히 별개인 프로젝트

| 게임 | 폴더 | 포트 | 원작 | 세이브 키 |
|---|---|---|---|---|
| 사가고 | `saga-web/saga-go` | 8791 | 포켓몬GO | `deungyong-go/save/<프로필>` |
| 사가블로 | `saga-web/saga-dungeon` | 8792 | 디아블로 | `yeoksa-dungeon/save/<프로필>` |
| 사가의숲 | `saga-web/saga-forest` | 8793 | 동물의숲 | `yeoksa-village/save/<프로필>` |
| 사가스토리 | `saga-web/saga-story` | 8794 | 메이플스토리 | `yeoksa-side/save/<프로필>` |
| 사가국지 | `saga-web/saga-realm` | 8795 | 코에이 삼국지 | `saga-realm/save/<프로필>` |

판별 `build-pc.bat` 가 파일 하나(`dist/<게임>.html`)로 묶는다.

- 세이브 키·앱 id 는 폴더 이름과 **다르다**. 맞추려고 바꾸면 진행이 사라진다.
- `data.js`·`sprite.js`·`core.js`·`hero.js` 는 다섯 벌 복사본이다. 합치자고 제안하지 않는다.
  도감(`data.js`)을 고치면 **다섯 벌 함께** 고치고 md5 로 같은지 확인한다.

## 어디서 도는가

- 로컬: 각 폴더 `run.bat`(브라우저 열림) · `start_server.bat`(허브용) · 사가고 폰용 `run-phone.bat`(HTTPS)
- 제작 도구: `saga-web/tools/run-tools.bat`(편집기·엔진 :8799~8801)
- 허브 카드 경로: `C:\swbins2\services.json`(별개 저장소) — 경로를 옮기면 그쪽도 고친다
- 공개: <https://smh8627-jpg.github.io/swbins/saga-web/saga-go/> 식 하위 경로(GitHub Pages)

## git

`origin` = <https://github.com/smh8627-jpg/swbins> (**공개**).

- `saga-web/saga-go/server/certs/` 절대 커밋 금지(자체 서명 CA 개인키). `.gitignore` 풀지 말 것
- `.nojekyll` 지우지 말 것(`_test.html`·`js/_expansion/` 등 `_` 파일이 Pages 에서 빠진다)
- 새 파일에 키·토큰·회사 도메인·PC 이름·개인 경로 금지. 푸시 전 한 번 훑는다
- **다른 세션이 같은 트리에서 동시에 돈다.** `git add` 해 두고 뜸 들이지 말고
  `git commit -F <메시지파일> -- <손댄 경로>` 로 곧바로 커밋한다. "커밋해" = 푸시까지
- 푸시가 거부되면 `git pull --rebase --autostash` 뒤 다시 푸시(남의 안 올린 파일은 건드리지 않는다)

## 하지 말 것

- 세이브 키·앱 id·도감 펫 `id` 바꾸기(표시 `name` 만 바꿀 수 있다)
- **이름 정책(다섯 판·3D 공통)**: 원작 인물·장수·펫·시리즈·실존 역사 인물의 실명을 표시 글자에 쓰지 않는다.
  가명은 임의로 정하고, id·세이브 키는 안 건드린다. `HEROES` 의 `name`·`hanja` 뿐 아니라
  `BIOS`·`PETS` 의 `desc` 도 "표시 글자"다. 새 인물·괴물도 실명 금지.
- 원작 개체값(IV)·CP 도입 — 이 판의 펫은 개체가 아니라 **종**
- 경영·문답을 `saga-realm` 밖으로 퍼뜨리기
- 사가의숲 구면 투영을 평평한 탑다운으로 되돌리기(집 안만 일부러 안 휜다)
- 원작사의 실제 에셋(그림·소리·데이터) 넣기 — 문법만 따른다. 그림은 CC0·코드·상업 허용 로컬 AI(`tools/ai-art`, §7.4)

## 검증

```
구문        node -c <파일>
진단        chrome --headless=new --disable-gpu --virtual-time-budget=45000 --dump-dom \
              http://127.0.0.1:<포트>/_test.html   → RESULT n/n  (세 번 돌려 한 줄도 안 다른지)
어드민      _admin.html  (세이브·균형 손잡이·QA 프리셋)  /  데모  _demo.html#<장면>
```

- **작업 중 스크린샷(헤드리스·CDP) 금지** — 사용자가 요청할 때만(3D 는 `--use-angle=swiftshader
  --enable-unsafe-swiftshader --disable-gpu-sandbox`). 실기기 확인은 사용자 몫.
- 헤드리스 크롬은 전용 `--user-data-dir` 로 띄우고 그 turn 안에 **그 PID 만** `taskkill //F //T //PID`.
  `//IM chrome.exe`(사용자 크롬)·`//IM node.exe`(다른 세션 서버) 금지.
- 진단 씨앗은 mulberry32(20260824) 고정. 시각 의존 축(날씨·떠돌이 등)은 진단에서 붙든다 — 방법은 그 판 PLAN §9.
- 서버(`run.bat` 등)는 사용자가 실기 테스트를 요청할 때만 띄운다.
- 큰 파일은 **Write 툴**로 쓴다. 파이썬은 `py`(`python` 은 스토어 껍데기). 치환은 바이너리(`'rb'`/`'wb'`) — 텍스트 모드는 CRLF 로 뒤집힌다.
  긴 치환은 heredoc 말고 스크래치패드 `.py` 로(셸이 따옴표·백슬래시를 깬다).
- 한글 `.ps1` 은 UTF-8 BOM 필수.

## 토큰

- **`SAGA-HISTORY.md`(400KB+)·각 `HANDOFF.md`·판별 `README.md` 는 통째로 읽지 않는다** —
  목차(`grep -n "^## \|^### "`)·날짜·게임명 grep 으로 필요한 절만 `sed -n`.
- `sprite.js`(100KB)·`data.js`(75KB) 도 전체 Read 금지 — 심볼·id 로 grep 해 그 자리만 읽는다.
- 진단 출력은 `grep -o "RESULT [0-9/]*"`·실패 줄만(`--dump-dom` 통째 금지).
- **문서 3층**(`SAGA-DESIGN.md` §9): 규칙(CLAUDE.md ≤6KB) / 설계(PLAN ≤70KB, 날짜 세션 기록 금지) / 이력(HANDOFF·HISTORY, append-only, grep 으로만).
  상태(3D `docs/PROJECT_STATE.md`·루트 README "현재" 절)는 **덮어쓴다**. 세션 기록은 HANDOFF·HISTORY 에만.
- 이 파일엔 **규칙만** — 이력·"이전엔 ~였다" 문장 금지.
