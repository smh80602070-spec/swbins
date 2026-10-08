# 고돗 소넷 5.5 구간 감사 (G-0118, 10-09)

구간 09-29~10-06 `saga-godot` 커밋 약 250(`Co-Authored-By: Claude Sonnet 5.5`). 날짜 여섯 묶음을 에이전트가 diff 로 읽고, Claude 가 HEAD 에서 다시 확인. 리팩터(파일 쪼개기 7건)는 함수·줄 대조로 빠진 것 0.

| 묶음 | 커밋 | 확인된 것 |
|---|---|---|
| A 09-29 | 37 | 탈것 키 겹침(높음) · 눈 감기 살색 매번 GPU 읽기 · 평탄 자리 Vector2i 버림 · 주석 셋 |
| B 09-30 | 30 | 떠날 때 저장 빠짐 · 쉼터 매 틱 계산 · 알 굴림 날짜 열쇠 · 사진첩 옛 이름 · 도움말·주간 점검 느슨 |
| C 10-01 오전 | 38 | 세이브 "왕복" 점검이 save()/try_load() 안 부름 · saga_core 가 판 세이브 직접 · 참조 게이트 구멍 · layout_walk 점검 안 돎 |
| D 10-01 오후 | 46 | 대시 점검 check(true) · 천하 유지비·경험치 점검 "또는" · 동료 편성 정답 둘 |
| E 10-02~03 | 33 | 사가나락 배경음 늘 전투곡 · 적 옆걸음 몸 방향 · 손맛 종류 먼저 바꿈 · 배경음 헤드리스 분기 · 죽은 검사 |
| F 10-04~06 | 66 | 몸 교체 뒤 카메라 흐림 옛 몸 · 타격 당김+겨누기 시야각 누적 · SAGA_MOVE 기본 꺼짐 · 숲 소품 복제 · 하늘 밤 경계 |

## 처방

| 심각 | 무엇 | HEAD 자리 | 처방 |
|---|---|---|---|
| 높음 | 탈것 V·B 가 나락 기술 4·5, 종횡 직업 기술, 만리 시야·가방과 같은 키 | saga_core/player/mount.gd:37-38 | **G-0119**(키 고르기 사용자 결정) |
| 중간 | 앱 떠날 때 서명 같으면 저장 안 함 — 위치·알 걸음 최대 5분 손실 | games/saga_go/world/autosave.gd | G-0118 고침(1초 넘으면 저장) + probe_autosave walk_only |
| 중간 | 사가나락 배경음: 3·6층 보스가 처음부터 서 있어 늘 전투곡 | games/saga_dungeon/world/test_room.gd bgm_key | G-0118 고침(보스 10m 안·난입만) + probe_dungeon_world |
| 중간 | 몸 교체 뒤 카메라 가까이 흐림이 해제된 옛 몸을 붙듦 | camera_rig.gd·dungeon_camera_rig.gd·player.gd swap_body | G-0118 고침(refresh_visual_meshes) + probe_traversal near_fade_swap |
| 중간 | 타격 당김 중 겨누기 → 기본 시야각 어긋남 누적 | games/saga_go/player/camera_rig.gd | G-0118 고침(_punch_applied 빼고 잼) |
| 중간 | 세이브 점검이 진짜 save()/try_load() 안 봄 | tools/probe_save_base.gd | **G-0120** |
| 중간 | 대시 점검: 입력 안 읽히면 check(true) | tools/probe_story_player.gd | G-0118 고침(_do_dash 로 무조건 검사) |
| 중간 | 눈 감기 살색을 몸 지을 때마다 GPU 에서 통째로 읽음 | saga_core/anime_eye.gd skin_average | G-0118 고침(텍스처별 캐시) |
| 중간 | 평탄 자리 모으기가 Vector2i 버림(마을·포구·폐허 54 자리) | games/saga_go/world/terrain_builder.gd _walk_sites | **G-0122**(지형 넓게 바뀜 — 촬영) · 폐허 잔해 넷은 G-0118 에서 실제 땅에 앉힘 |
| 중간 | 이동 느낌 SAGA_MOVE 기본 0 — 가속·착지 경직 코드가 보통 플레이에서 안 돎 | games/saga_go/combat/feel_tuning.gd:55 | **사용자 결정**(G-0018 단계 4 "판정 대기") |
| 낮음 | 강공격·스킬·폭발이 실패해도 손맛 종류를 먼저 바꿈 | field_combat.gd | G-0118 고침 |
| 낮음 | 쉼터 단추 매 틱 pending() | homestead.gd | G-0118 고침(보일 때 0.25초) |
| 낮음 | 사진첩이 찍은 때 이름(세이브)을 보여 줌 | photo_album.gd | G-0118 고침(지금 표 이름) |
| 낮음 | 천하 유지비·대련 경험치·동료 편성·도움말 키·주간 도전 점검이 "또는"으로 느슨 | probe_realm_state·story_members·help·weekly_goals | G-0118 고침(정답 하나) |
| 낮음 | 참조 게이트: 자기 판 경로가 있는 줄 통째 제외 | tools/check_refs.sh | G-0118 고침(경로마다) |
| 낮음 | saga_core mount.gd 가 판 autoload 직접 | mount.gd game_progress | **G-0121** |
| 낮음 | layout_walk 점검이 probe_all 에 안 들어감(region_showcase 는 감싸져 있어 해당 없음) | tools/probe_all.sh | G-0118 고침(scene 항목) |
| 낮음 | 하늘 밤 경계·숲 소품 복제·알 굴림 날짜 열쇠·배경음 헤드리스 분기 | — | **G-0123** |
| 낮음 | 적 쉬는 동안 옆걸음: 플레이어를 보다가 끝에서 옆 방향으로 되돌림 | field_enemy.gd RECOVER | 메모만(눈에 띄면 G-0123 에) |
| 낮음 | 주석 틀림 셋(orientation_scale·mount) | — | G-0118 고침 |
| 이력 | e98b58c7e 메시지가 다른 커밋 것 복사(내용은 G-0017 식생) · field_combat `fresh` 늘 참(해 없음) | — | 기록만 |

문제 아님으로 확인: probe_mount 0.5→0.2(안장 방식 변경에 맞춤) · probe_crossing 허용치(기복) · probe_kits 개수 · 골든 md5 · BGM 키 · 세이브 키·저장 슬롯 · 실명 표시 글자 없음.
