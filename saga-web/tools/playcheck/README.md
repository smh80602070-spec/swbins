# playcheck — 사가 판을 직접 띄워 조작·촬영해 확인

2026-09-27 사용자: "내가 꼭 실기로 해야 해?" — 조작·화면·전투는 Claude 가 이걸로 직접 확인한다.

```
node serve.mjs C:/swbins/saga-web 8871        # 정적 서버(백그라운드로)
node go-move-click.mjs                         # 사가고: 새 계정 → 이어하기 → W·시점 돌린 W·클릭 이동·조명 값 + shots/
node go-house-walls.mjs                        # 사가고: 가까운 집 넷에 네 방향으로 걸어 들어가 멈춘 거리 / 벽 끝 거리
```

- 헤드리스 크롬은 이 폴더 `chrome-prof/` 전용 프로필·포트 9351. 끝나면 스크립트가 닫는다 — 남으면 그 프로필이 든 PID 만 끈다.
- 3D 는 `document.hasFocus` 를 참으로 박아야 그려진다(cdp.mjs 가 해 둔다). 서비스 워커·캐시는 끈다.
- 게임 안 값은 `c.ev('...')` 로 읽고 바꾼다(`DG.world.wallAt(x,y)`·`DG.world3d.pickGround(cx,cy)`·`DG.world3d.lightingAt()`).
