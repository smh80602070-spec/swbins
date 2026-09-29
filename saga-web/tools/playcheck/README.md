# playcheck — 사가 판을 직접 띄워 조작·촬영해 확인

2026-09-27 사용자: "내가 꼭 실기로 해야 해?" — 조작·화면·전투는 Claude 가 이걸로 직접 확인한다.

```
node serve.mjs C:/swbins/saga-web 8871        # 정적 서버(백그라운드로)
node go-move-click.mjs                         # 사가고: 새 계정 → 이어하기 → W·시점 돌린 W·클릭 이동·조명 값 + shots/
node go-house-walls.mjs                        # 사가고: 가까운 집 넷에 네 방향으로 걸어 들어가 멈춘 거리 / 벽 끝 거리
node go-house-perf.mjs                         # 사가고: 성능 등급을 내려도 보이는 집의 벽이 그대로인가(멀리 갔다 오면 새 밀도)
node go-story-walls.mjs                        # 사가고: 이야기 인물 자리가 집 벽 안에 들어 말을 못 거는 곳이 없나
node go-combat.mjs auto [short] [prof]         # 사가고: 가까운 무리와 싸워 적 거리·몸 반지름·체력·GL 수·프레임 + shots/go_combat_* (prof = CPU 자기 시간 상위)
node go-combat-time.mjs [plain elite boss] [tune=field.x:v]  # 사가고: 판정만 1/30초씩 — 무리별 처치 시간(게임 초)·피해/초·휘두름·체력
node fs-move-click.mjs                         # 사가의숲: 3D 켜고 W(시점 0°·90°)·왼쪽 클릭 이동·목표 고리 + shots/fs_*
node go-ch-auto.mjs <장> [초] [nofield] [trace] [defend] [members]  # 사가고: 그 장 첫 단계(defend 면 첫 지키기 단계, members 면 이야기 동료 다 지급)부터 🤖📖 자동 — 단계마다 걸린 초·doing·사진(shots/go_ch<N>_s<i>), trace 면 곁 적 체력·층
node go-probe-eval.mjs "<js>"                      # 사가고: 새 계정으로 들어가 그 자바스크립트를 게임 안에서 돌려 결과를 찍는다(진단용, 새 프로필로)
node go-aftermath.mjs [shot]                    # 사가고 ⑲-56: 결말 뒤 밤의 잔불(3D·14m 잔당 셋)·메아리 입구 넷이 예외 없이 서나(shot 을 줄 때만 shots/go_after_*, 새 프로필로)
node go-amber.mjs [shot]                        # 사가고 ⑲-57: 굳은 거리(amber.js)가 3D 로 예외 없이 서나·명소 자리(지형 칸)·부양탑 기둥(shot 을 줄 때만 shots/go_amber_*, 새 프로필로)
node go-mount.mjs [shot]                        # 사가고 T1: 말을 타면 같은 시간에 더 멀리 가나(속도 배율)·3D 예외 없나(shot 을 줄 때만 shots/go_mount_*, 새 프로필로)
node go-stormeye.mjs [shot]                     # 사가고 ⑲-52: 8부 매듭 여섯·먹구름 눈이 3D 로 예외 없이 서나 + 눈 곁 발판·기둥 목록(shot 을 줄 때만 shots/go_eye_*, 새 프로필로)
node go-skyroute.mjs                           # 사가고 ⑲-48: 구름 위 항로 섬 셋 — 땅에서·사당 섬 위에서 + shots/go_sky_* (새 프로필로)
node go-ch23.mjs [초] [field]                  # 사가고 ⑲-47: 🤖📖 가 등대를 타고 올라 난간 판에서 등롱을 켜나 + shots/go_ch23_* (PC_PROF=tmp/… 새 프로필로)
node rk-battle.mjs [초] [press] [phone] [nosim]  # 사가국지: 새 판 → 이웃 적 성 출진 → 실시간 전장이 저절로 흐르나·병사 붙음/쓰러짐(armyView) + shots/rk_live_*
```

- 헤드리스 크롬은 이 폴더 `chrome-prof/` 전용 프로필·포트 9351. 끝나면 스크립트가 닫는다 — 남으면 그 프로필이 든 PID 만 끈다.
- 3D 는 `document.hasFocus` 를 참으로 박아야 그려진다(cdp.mjs 가 해 둔다). 서비스 워커·캐시는 끈다.
- 게임 안 값은 `c.ev('...')` 로 읽고 바꾼다(`DG.world.wallAt(x,y)`·`DG.world3d.pickGround(cx,cy)`·`DG.world3d.lightingAt()`).
