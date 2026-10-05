# world-forge — 세계 자산 공방 (지형·지물·건물·탈것)

char-forge(인물)의 짝. **레시피(JSON) 한 벌 = 자산 하나**, 형태는 전부 코드가 만들고 재질만 Poly Haven CC0 사진(`sources.json` 24종)을 쓴다.
Blender 헤드리스 — 사람 클릭 0회. 결과는 `tools/world-forge/_out/`(gitignore), 게임에 넣는 파일만 각 트랙 폴더로 복사.

## 범위 (2026-09-29 사용자 "프로젝트마다 다섯 판 다 추가")
세 트랙 × 다섯 판 = 15칸. **한 레시피에서 트랙별 결과**를 뽑는다: Unity = 사실 PBR GLB · Godot = 툰 GLB(바탕색 한 장) · 웹 = 2D 스프라이트 렌더.

| 판 | 건물 성격 |
|---|---|
| 사가고 | 시대 혼합 마을(과거·현대·미래 한 자리) |
| 사가블로 | 성채·신전·던전 입구 |
| 사가의숲 | 마을 집·가게·오두막 |
| 사가스토리 | 횡스크롤 배경 건물 |
| 사가국지 | 성벽·성문·궁·서역 도시 |

## 지금 있는 것 (첫 조각, 2026-09-29)
- `fetch_sources.py` — 재질 24종 받기(md5 검사). `py tools/world-forge/fetch_sources.py`
- `wf_common.py` — PBR 재질(Poly Haven 세트)·bmesh 도우미·GLB 내보내기
- `build_building.py` — 건물 레시피 → `.glb`(벽 패널 구멍·창·문·층 띠·기둥·박공/모임/평 지붕·굴뚝)
- `preview.py` — 세 방향 미리보기 렌더
- **트랙별 출력** — 같은 레시피에서: `--style real`(기본, Unity 사실 PBR GLB) · `--style toon`(Godot cel_toon: 노멀·거칠기 없이 바탕색 256px·채도 +18%, GLB 0.5MB) · `render_sprite.py`(웹: 등각 투명 PNG, `--az`·`--el`·`--size`)
- `data/set_plan.json`(K-0017, 판 5 × 건물3·지물3·지형2·탈것1 = 45칸·산출 42) + `check_plan.py`(점검 · `--out DIR --strict` 로 산출 수 대조)
- `build_prop.py`(K-0017) — 지물 15종(우물·가로등·미래 기둥·횃불·제단·쇠울타리·나무울타리·우체통·건초·대나무·비석·돌등롱·깃대·성벽 토막·화로)을 코드로. `--all --out-dir DIR --style toon` 한 번에 15개, 산출마다 `.license.json`
- `build_terrain.py`(K-0017) — 16×16m 높이맵 조각 10종(하천 굽이·능선·동굴 바닥·바위 노두·풀밭·연못·절벽 턱·언덕 비탈·모래 언덕·길 있는 평원). 값 잡음 + 모양 함수 + 간단한 침식, 32×32칸 = 삼각형 2430, 경사·높이·물로 재질을 나눈 닫힌 덩어리
- `build_vehicle.py`(K-0017) — 탈것 5종(돛단배·광차·뗏목·소달구지·대상 수레). 선체는 단면 이어붙이기, 수레는 바퀴·살·테 조립. 새 건물 레시피 3(`future_dome_01` 은 새 지붕 `dome`)
- 판별 세트 전체: `build_*.py --all --out-dir <절대경로> --style toon` 네 번 + 건물 레시피별 `build_building.py` → `check_plan.py --out <그 폴더> --strict` 가 42/42 를 센다
- `build_set.sh <절대 출력 폴더>`(K-0017) — 판별 세트 한 벌을 한 번에: 툰 GLB 42 → 웹 압축본(`glb-compress`) → 웹 2D 스프라이트 → `check_plan.py` 대조 → `set_sheet.py` 판정 시트(그림 한 장 + 표). 약 5분
  (미리보기 주의: `preview.py` 의 출력 경로는 **절대 경로**로 — 상대 경로는 드라이브 루트 `C:	ools\…` 로 샌다)
- `build_kit.py`(K-0063) — 치수 맞춤 키트 10종: 다리 널판 `plank_deck_01`(6×1×0.12, 길이 이음) · 사가블로 방 `dungeon_room_12_<mood>`(12×4.4×12, 남북 개구부 4.4) · 문틀 `dungeon_gate_44_<mood>` · 복도 `dungeon_corridor_4_<mood>`(mood dirt·limestone·lava). 고돗 G-0020 이 Kenney 원본을 걷어내며 요청
- `build_monster.py`(K-0043 재작업) — 몬스터·보스 몸 32종: 계통 5(네발·날개·뱀형·기계·정령) × 변형 4(번호마다 다른 몸: 늑대·멧돼지·고양이·황소 / 새·박쥐·올빼미·비룡 / 독사·코브라·뿔 지렁이·방울뱀 / 골렘·거미·궤도 포대·떠 있는 구 / 불꽃·유령·결정·해파리) + 보스 12(×1.8~2, 왕관·등판·룬 띠). 유기체 = Skin 모디파이어(뼈대 그래프→이어진 매끈한 몸, 삼각형 2.3k 예산) + 면 법선·위치로 무늬 칸 배정, 기계 = 모따기 상자. 동작은 뼈 없이 `tools/glb-compress/creature_fill.mjs --forward-z` 로 7칸
- `recipes/eu_house_01.json` — 서유럽 2층 집(삼각형 약 1900)
- 종류 늘림(09-29): `chinese_hall_01`(전각·붉은 기둥·큰 처마) · `jp_minka_01`(초가 모임지붕) · `stone_tower_01`(4층 성탑) · `forest_cottage_01`(초가 오두막) · `barn_01`(헛간) · `inn_01`(3층 여관) — 재질 칸 `{mat, tile_m, tint, gain, sat}`: **원본 사진 재질은 어둡다**(회반죽 #72593b·초가 #544f49) — `tint`(곱하기)로는 못 밝히니 `gain`·`sat` 를 그림 픽셀에 구워 쓴다(glTF 는 1 보다 큰 배율을 못 싣는다).
- `recipes/hanok_01.json` — 한옥(모임지붕·큰 처마·검은 기둥 사이 창·돌 기단, 삼각형 약 1300) · `recipes/modern_block_01.json` — 현대 3층 블록(띠창·평지붕 난간, 약 2900)

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" -b --factory-startup -P tools/world-forge/build_building.py -- --recipe tools/world-forge/recipes/eu_house_01.json --out tools/world-forge/_out/eu_house_01.glb
"$B" -b --factory-startup -P tools/world-forge/preview.py -- out.png tools/world-forge/_out/eu_house_01.glb
```

## 순서 (건물 → 지물 → 지형 → 탈것)
1. 건물: 서유럽 ✅(첫 집) → 한옥·일본식·중국식 → 현대 블록 → 미래 → 성벽·성문·탑·궁 → 판별 레시피 묶음
2. 지물: 우물·시장·다리·비석·등롱·울타리·수레(기존 `tools/asset-forge/procgen.py` 를 사실 재질로 확장)
3. 지형: 높이맵 + 침식 노이즈 + CC0 지면 재질 → 판별 지역(사가고 강·산맥·바이옴 등은 기존 설계 그대로)
4. 탈것: 수레·배·뗏목(코드) → 탑승 생물(char-forge 몸 파이프라인 재사용, 마지막)

## 알려진 한계 / 다음
- GLB 가 재질 텍스처를 품는다 — 텍스처 최대 1024 로 줄여 집 하나 20~30MB(127MB 에서). 게임 트랙에서는 같은 그림이 여러 건물에 겹치니 가져온 뒤 중복 합치기(`dedupe_forge_textures` 방식)를 쓴다.
- 툰·스프라이트 출력은 됐다(09-29). 아직 없는 것: 각 트랙 프로젝트로 가져오기(Unity 프리팹+콜라이더·Godot .tscn·웹 이미지 등록), 판별 레시피 묶음.
