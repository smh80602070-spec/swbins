# new-game — 새 판 뼈대 생성기

saga-web 에 여섯 번째(일곱 번째…) 웹 게임의 빈 틀을 **바로 도는 상태로** 만든다.

```
node saga-web/tools/new-game/new-game.mjs --folder saga-arena --title 사가아레나 --port 8796 \
     [--save-base saga-arena/save] [--origin "투기장 오마주"] [--three] [--dry]
```

- `--dry` 는 만들 파일 목록만 보여 준다. `--out <폴더>` 는 시험용(다른 곳에 만들어 보기).
- **막는 것**: 이미 있는 폴더 · 다른 판 `run.bat` 의 포트(편집기 8799·맵 편집기 8800·사가 엔진 8801 포함) · 다른 판 `core.js` 의 `SAVE_BASE` ·
  `manifest.json` id · `saga-소문자` 가 아닌 폴더 이름.
- **만드는 것**: `index.html`·`css/style.css`·`js/core.js`(세이브 스키마 v1·migrate·프로필·mulberry32)·`js/game.js`
  (들판을 걸으며 도감 인물을 만나 등용하는 최소 놀이, 방향키/WASD·터치 끌기)·`sw.js`(네트워크 먼저+no-store)·`manifest.json`·
  `run.bat`/`start_server.bat`·`_test.html`(8항목, `RESULT n/n`, 씨앗 20260824, 진짜 세이브·프로필 목록을 건드리지 않고 되돌림)·
  `CLAUDE.md`·`PLAN.md`(SAGA-DESIGN §9.3 틀)·`HANDOFF.md`·`README.md`·`assets/ASSET_LICENSES.md`.
- **복사해 오는 것**: `js/data.js`(도감, saga-go 정본) · `js/errlog.js`(오류 기록 키만 새 판 것으로) · `icons/`(사가마을 것, 임시) ·
  `--three` 면 `js/vendor/three.iife.js`(MeshoptDecoder 든 번들).
- 다섯 판의 `core.js`·`account.js` 는 복사하지 않는다 — 판마다 얽힌 곳이 많아 떼어 오면 깨진다. 새 판은 자기 core 로 시작한다.
- **다른 파일은 건드리지 않는다.** 끝에 "손으로 등록할 곳"(루트 CLAUDE.md 표·precheck·asset-audit·콘텐츠 편집기 GAMES·허브·아이콘)을
  출력하고 새 판 `HANDOFF.md` 에 체크리스트로 남긴다.

## 등록 — `register.mjs`

새 판을 만든 뒤, 위 체크리스트 중 기계적인 네 곳(CLAUDE.md 표·precheck·asset-audit·콘텐츠 편집기 GAMES)을 한 번에 채운다:

```
node saga-web/tools/new-game/register.mjs --folder saga-xxx --title 사가무엇 --port 8796 \
     --save-base saga-xxx/save --origin "원작 오마주 한 줄" [--dry]
```

- 이미 등록된 판(폴더 이름이 그 파일에 이미 있음)은 건드리지 않는다 — 다시 돌려도 안전하다(멱등).
- **안 건드리는 것**(계속 손으로): `C:\swbins2\services.json` 허브 카드(별개 저장소) · `icons/` 를 이 판 것으로 바꾸기 ·
  `PLAN.md` §1 정체성·원작 오마주 채우기.
- `--dry` 는 바뀔 파일만 보여 준다(내용은 안 씀).
