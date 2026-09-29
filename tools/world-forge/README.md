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
- `recipes/eu_house_01.json` — 서유럽 2층 집(삼각형 약 1900)
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
