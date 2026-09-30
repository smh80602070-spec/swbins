# saga-unity

다섯 게임을 Unity 6 3D 로 재구축하는 **완전히 새 프로젝트**. 정본은 이 폴더 `PLAN.md`.
`saga-godot/` 과 나란히 가는 **병행 트랙**이다 — 대체가 아니고, saga-godot 의 "Godot 유지" 결정을 뒤집는 것도 아니다(관계는 `PLAN.md` 0장).
`saga-web/*`(웹 판)·`saga-godot/` 은 건드리지 않는다. 코드 공유 없음.

- 현재 상태 `docs/PROJECT_STATE.md`(≤15KB, 세션 끝에 **덮어쓴다**) · 세션 이력 `docs/HISTORY.md`(append-only, 날짜·게임명 grep 으로만) · 실기 조작법 `docs/HOW_TO_PLAYTEST.md`(saga-godot 의 같은 이름 문서와 짝, 내용은 안 섞는다)
- **`PLAN.md`(372KB — ≤100KB 로 줄이는 중, U-0008)·`HISTORY.md`·`ASSET_GUIDE.md`·`VERTICAL_SLICE_*.md` 는 통째로 읽지 않는다.** 목차 grep 후 필요한 장·날짜만 `sed -n` 으로 읽는다. PLAN 은 0장(읽는 법)부터. 장 번호는 바꾸지 않는다.
- 세션 기록은 `HISTORY.md` 에만 append, `PROJECT_STATE.md` 는 덮어쓰기, `PLAN.md` 는 결정이 바뀔 때만. 아트 방향은 **사실적 PBR**(PLAN 66-2·102장) — 공통 문서 `../SAGA-DESIGN.md` §6 의 툰 항목은 이 트랙에 적용하지 않는다.
- 레거시 기획 감사는 새로 하지 않는다 — `saga-godot/docs/LEGACY_FEATURE_AUDIT.md` 를 그대로 참고(`PLAN.md` 4장).
- 사용자가 실기 테스트 방법을 물으면 `HOW_TO_PLAYTEST.md` 를 가리키고, 새 키 배선이 생기면 거기에 반영한다.

## Unity 에디터 — PC 마다 다르다

기록상 이 PC 에는 Unity Hub 경유 **6000.3.23f1** 이 있다(`C:\Program Files\Unity\Hub\Editor\6000.3.23f1`). 다른 PC 일 수 있으니 새 세션은 먼저 확인한다:

```bash
find "/c/Program Files/Unity/Hub/Editor" -maxdepth 1 2>/dev/null
```

## 검증

배치 모드로 컴파일 오류·씬 로드만 확인한다:

```
Unity.exe -batchmode -nographics -quit -projectPath <경로> -logFile <경로>
```

- **배치 모드도 프로젝트 설정을 조용히 고쳐 쓴다.** 설치된 Unity 가 프로젝트 저장 버전보다 새로우면 `ProjectSettings/ProjectVersion.txt` 와 `Packages/manifest.json`·`packages-lock.json` 을 자동으로 올린다.
  돌린 뒤 커밋 전에 반드시 `git diff -- ProjectSettings/ Packages/` 를 훑고, 의도치 않은 변경은 `git checkout` 으로 되돌린 뒤 고친 파일만 add 한다.
- **`.gitignore` 유지**: `Library/`·`Temp/`·`Obj/`·`Build/`·`Logs/`·`UserSettings/`·`*.csproj`·`*.sln` 은 절대 커밋하지 않는다.

## GUI 화면 확인

- **개발 중 습관적으로 GUI 를 띄워 스크린샷을 찍지 않는다**(루트 CLAUDE.md 와 같은 원칙). 기능을 다 완성한 뒤 사용자가 직접 보거나, 명시적으로 요청할 때만.
- GUI 를 띄웠으면 그 turn 안에 `taskkill //F //IM Unity.exe`. 다른 세션의 Godot 프로세스까지 잡지 않도록 정확한 이름만.

## git

루트 CLAUDE.md 의 git 규칙 그대로. saga-godot 세션과 파일이 겹칠 일은 없고, 겹칠 수 있는 건 루트 `SAGA-HANDOFF.md`·루트 `CLAUDE.md` 뿐이니 그 둘을 고칠 때만 특히 조심한다.
