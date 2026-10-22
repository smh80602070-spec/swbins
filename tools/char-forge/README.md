# char-forge — 자체 인물 공방 (VRoid·Mixamo 대체)

> 상태: **saga-godot 몸 = VRoid 직접 디자인** — 이 도구는 VRoid 주역에 CC0 동작·얼굴 굽기·게임 배선을 맡는다(§10 `vroid_intake.sh`). **saga-unity(사실풍) = 단계 3 `build_real.py`** 공방 후보를 갖췄고 사람 판정을 기다린다. 이력·세션 일지·상세 설명은 `HISTORY.md`(grep 전용). `SAGA-DESIGN.md` 는 여기를 가리키기만 한다. `tools/asset-forge` 처럼 **빌드 도구는 공유**(게임 코드 공유 금지와는 별개).

**몸 생성(`build_real.py`·MakeHuman·의상 3D)은 동결(2026-09-30, SAGA-ARCH §4.5).** 남는 일 = 들이기(`vroid_intake.sh`)·옷 변형·무늬·렌더 점검·출처 검사, 그리고 2D 모드용 스프라이트 굽기(`gear_sprites.py`·`bake_sprite_batch.py`, 티켓 K-0015).

## 1. 왜

사용자(2026-09-24) "저작권 때문에 자체적으로" · "상용하게 되면 꼭 필요해" → 입력은 전부 CC0·자체 생성·VRoid(상업 허용, 꾸미기 앱 배포만 금지)만, 명령 한 번에 끝까지(Mixamo 는 재배포 금지·계정 의존이라 뺐다). 사실관계 전문은 `git log -p -- tools/char-forge/README.md`(10-23 R-6 접음).

## 2. 원칙

1. **입력 = CC0 또는 자체 생성만.** 받은 팩마다 `sources.json` 에 이름·URL·라이선스·받은 날짜를 적는다. 라이선스를 확인 못 한 파일은 들이지 않는다.
2. **출력은 공개 저장소에 커밋할 수 있어야 한다.** 캐릭터 `.glb` 마다 `*.license.json`(쓴 입력 목록)을 옆에 둔다.
3. **창 없이 명령 한 번.** `blender -b --factory-startup -P tools/char-forge/build.py -- --recipe <인물.json> --style toon|pbr --out <경로>`. 사람 클릭 0회.
4. **같은 레시피는 늘 같은 결과.** 씨앗은 레시피 안의 인물 `id` 해시로 정한다(진단 씨앗 규칙과 같은 정신).
5. **이름 정책을 지킨다.** 레시피 파일 이름·키는 `id` 만 쓰고, 표시 이름은 게임 데이터가 갖는다.
6. **화질을 깎아서 맞추지 않는다**(메모리 `feedback_optimize_without_lowering_graphics`). 줄일 건 안 보이는 면·뼈·모프뿐이다.

## 3. 쓰는 법

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"      # Blender 5.2.1 LTS, Rigify 기본 탑재
py tools/char-forge/fetch_sources.py                                 # 입력 팩 받기(sha256·CC0 확인, 사람 클릭 없음)
"$B" -b --factory-startup -P tools/char-forge/build.py -- \
    --recipe tools/char-forge/recipes/<id>.json --out tools/char-forge/_out/<id>.glb [--fbx tools/char-forge/_out/<id>.fbx] [--check]
"$B" -b --factory-startup -P tools/char-forge/verify.py -- --glb tools/char-forge/_out/<id>.glb   # .fbx 도 받는다
```

| 파일 | 하는 일 |
|---|---|
| `sources.json` · `fetch_sources.py` | 입력 장부(팩·URL·라이선스·sha256) · 받아서 `_src/`(gitignore)에 푼다 |
| `bonemap.json` · `rigmaps.py` | 표준 뼈 53개 → Godot·Unity 이름 대응 · 뼈 목록·이름 표(`identity`·`vroid`·`mpfb`) |
| `build.py` · `verify.py` | 레시피 → 몸·머리·재질·동작 굽기 → `.glb`/`.fbx` + `*.license.json` · 내보낸 **파일을 다시 열어** 원본 동작과 맞댄다 |
| `bake_for_rig.py` | 이미 있는 몸(VRoid 등) 뼈대에 CC0 동작만 굽는다 (`--map vroid --clips 이름=UAL이름,…`) |
| `vroid_intake.sh` | VRoid `.vrm` 한 개 들이기(§10) |
| `gear_sprites.py` | VRM 몸 → 괴물·연령·장비 변형 + 방향·동작 스프라이트 시트(머리말에 사용법) |
| `bake_sprite_batch.py` | 계획 JSON(`data/sprite_plan_*.json`) → 벌·동작별 WebP 시트(이어하기, 낮은 우선순위) |
| `build_real.py` · `keyframes.py` · `garments.py` | (동결) 사실 몸·자체 키프레임 동작·옷 짓기 |
| `export_vrm_parts.py` · `export_parts.py` · `render_wardrobe.py` | 옷 조각 내보내기·무늬 변형(`COSTUME-SYSTEM.md`) |
| `render/` · `measure_shape.py` | 눈으로 보기(Mixamo 와 나란히 렌더)·모양 점검 |
| `recipes/` · `gen_*_recipes.py` | 인물 레시피와 그 대량 생성(`_test_*`·`_cmp_*` 는 비교용) |

도구별 상세 설명·레시피 칸·함정은 `HISTORY.md` H2.

## 4. 입력 후보 — 라이선스 확인분

모두 CC0 또는 우리 것: Quaternius Universal Base Characters(뼈 심긴 몸 6·머리 20) · Universal Animation Library 1·2(동작 250+, 같은 뼈) · Modular Character Outfits - Fantasy(옷 넷, Regular 비율) · Blender Rigify(괴물 뼈) · 자체 키프레임(`CF_*`). MakeHuman/MPFB 는 폐기(10-08). 장부 = `sources.json`, 무료판에 든 것·함정은 `HISTORY.md` H3.

## 5. 파이프라인 (한 명 = 레시피 하나 → `.glb` 한 벌, 동결)

A 몸(모프) → B 표준 뼈(§6, 가중치 옮김) → C 머리카락 → D 옷·장신구(kitbash) → E 얼굴 데칼·셰이프키 → F 재질 슬롯(`skin`·`hair`·`cloth_a`·`cloth_b`·`metal`·`eye`) → G 동작 묶음 따로 → H 내보내기(Godot `.glb`·Unity `.fbx`). 몸 생성은 동결(09-30)이라 단계 표 전문은 접었다(`git log -p`, 10-23 R-6).

## 6. 표준 뼈

- **Quaternius Universal 뼈대의 UE 마네킹 이름 판**(`root·pelvis·spine_01~03·neck_01·Head·clavicle_l…`, 65개 중 끝 뼈를 뺀 53개)으로 정했다.
  몸 팩(glTF)과 동작 팩 **Unreal 판 FBX** 가 같은 이름이다. 동작 팩의 Godot·Unity 판은 Rigify `DEF-*` 이름이라 쓰지 않는다.
  Godot `SkeletonProfileHumanoid` · Unity Humanoid 이름 대응표는 `bonemap.json` **하나만** 둔다(Unity 는 이 이름을 스스로 52개 잡았다).
- MPFB 몸을 쓸 때는 MPFB 의 "game engine" 뼈 → 이 표준 뼈로 가중치를 옮긴다.
- 지금 있는 `saga-godot/tools/mixamo_retarget.gd`(Mixamo → VRM `J_Bip_*`)는 "부모 체인 1:1 대조 + FK 발 높이 확인"
  **검증 방식**을 그대로 다시 쓴다. 대응표만 바뀐다.

## 7. 교체 순서 (요약)

단계 0 도구 뼈대 ✅ · 1 동작 먼저 교체(saga-godot) ✅ · 2 saga-godot 몸 = VRoid ✅ · 3 saga-unity 몸 공방 후보(사람 판정 대기) ⏳ · 4 도감 레시피 ⏸ · 5 출처 검사 ✅ (전체 `HISTORY.md` H4).

## 8. 사람 몫 · 결정 (요약)

D1 무료판만 · D2 얼굴 toon|real 축(godot=toon, unity=real, 한 화면에 섞지 않는다) · D3 Unity 는 FBX(Humanoid), Godot 은 `.glb` · D4 saga-godot 몸 = VRoid 직접 디자인 · D5 unity 몸 = Mixamo 유지·공개 저장소 밖(출처 검사로 대조). 팩 받기는 사람이 itch.io 버튼을 눌러 `Downloads` 에 둔다. 까닭·전문은 `HISTORY.md` H5, 그래픽 예상은 H6.

## 9·10. Mixamo·VRoid 자리 · VRoid 주역 들이기 (접음, K-0159)

교체 자리 표는 끝난 일이라 접었다(유니티 Mixamo 제거 10-05, 예전 표·절차 전문은 `git log -p -- tools/char-forge/README.md`). VRoid 주역 들이기: 사람이 VRoid 기본 부품만으로 만든 VRM(상업·재배포·개변 허가, 실존·원작 인물 본뜨기 금지)을 id 이름으로 Downloads 에 두면 `bash tools/char-forge/vroid_intake.sh ~/Downloads/<id>.vrm <id>` 한 번(얼굴 데칼·CC0 동작·Godot 묶음·점검, 메타가 허가 아니면 안 들임).

## 11. VRoid 대량 들이기 (K-0022, 2026-10-02)

인물 에셋은 전부 VRoid(사용자 결정). VRM 이 쌓이면 새 것만 골라 처리하고 진행표를 낸다.

```bash
py tools/char-forge/vroid_samples.py <VRM 폴더>           # 이용 조건 표(상업·개작+재배포 허용만 "사용 O"), --copy 면 O 인 것만 _in/vroid 로 복사
bash tools/char-forge/vroid_batch.sh [--only id,…] [--dry]  # 새 VRM → GLB·CC0 동작 8·웹 경량 GLB·2D 시트(이어하기·멱등, 3회 실패면 건너뜀)
py tools/char-forge/vroid_status.py [--all|--missing|--json]  # 인물 id × 단계(vrm·glb·anim·web·2d) 표
```

- id = 명단(`data/roster.json`) id 를 쓰면 진행표가 그 인물 줄을 채운다. VRM 원본·산출은 git 밖(`_in/`·`_out/`).
- 산출 `_out/vroid/<id>/{<id>.glb, <id>_anims.glb, verify.ok, web/<id>.glb, log_*.txt}` + `_out/sprites/<id>/`. 게임 폴더에 놓기는 K-0019(`asset-place`).
- Godot 부(얼굴 데칼·`anim_cc0/<id>_lib.res`)는 분리: Godot 세션에서 `vroid_intake.sh`. 한 명 처리 약 5분(시험: 동작 굽기 <1분 · 웹 경량 · 2D 시트 렌더가 대부분).
- 웹 경량 GLB 벌당 0.6~0.8MB(모프 제거+Meshopt·WebP 1024px), 한 판에만. 사람 몸 삼각형은 줄이지 않는다.

### 11-b. 옷 이식으로 인물 299명 (K-0024, 2026-10-02)

샘플 25벌 옷 조각을 다른 샘플 몸에 비율 맞춰 입혀 인물마다 다른 GLB(얼굴·머리는 25종 반복 — 사용자 "약간 다르게만"): `bash tools/char-forge/export_parts_all.sh` → `py tools/char-forge/outfit_swap_plan.py`(299 조합) → `blender -b --factory-startup -P tools/char-forge/outfit_swap.py -- --plan tools/char-forge/data/outfit_swap_plan.json tools/char-forge/_out/parts tools/char-forge/_out/outfit_swap --render` → `_in/vroid/` 로 복사 뒤 `vroid_batch.sh`. 흠·성별은 `tasks/tools/done/K-0024.md`·`K-0101`.

## 12. 조합 변형 (K-0072)

샘플 VRM 머리카락·체형 조합 = `MIX.md`.

## 13. 2D 에셋 공장 (K-0158, 2026-10-21)

한 명령으로 계획 → 굽기 → 그림체 통일 → 자동 판정 → 정본·판별 배포.

```
py tools/char-forge/factory.py tools/char-forge/recipes/factory/k158_trial.json [--only id] [--dry] [--stage bake,style,judge,place] [--force-style]
py tools/char-forge/sheet_judge.py            # _out/factory/styled 의 풀 전부 판정 → _out/factory/judge.json
```

- **규격(웹 W-0370 이 읽음)**: 192px 칸 · 방향 5(0 정면·1 앞대각·2 옆(오른쪽)·3 뒤대각·4 뒤, 반대쪽은 뒤집기) · 동작 10(idle·walk·run·attack·attack2·cast·hit·death·sit·talk, 몸에 없는 것은 manifest `missing`) · 8프레임(hit·death 6) · 발 = 위에서 0.88 · `<역할>.webp` 가로 프레임·세로 방향 · `manifest.json` {px, dirs, clips{역할:{frames,fps,loop,file}}, missing, foot, style:"C-toon-1", source, license, ortho_m, px_per_m, anchor_x_px(누운 몸 때문에 카메라를 민 줄의 발 x)}.
- **굽기**: 사람은 `bake_sprite_batch.py` → `gear_sprites.py`(NDIR=8·DIR_LIST=0..4, 동작은 몸 `_anims` + `m.` 모캡), 짐승은 `creature_sprites.py`(DIR_STEP=45·CLIPS·NFR_MAP — 짐승은 칸 배율이 동작 묶음으로 정해져 늘 전 동작을 함께 굽는다). 쓰러짐·앉기는 `CENTER_CLIPS` 로 칸 밖에 누우면 그 방향 줄만 카메라를 최소로 민다.
- **그림체 C-toon-1**(`style_pass.py`): 발 맞춤(딛는 동작은 칸마다, run·death 는 줄 기준) → 명도 4단 툰 → 그림자 보랏빛·밝은 면 크림 → 판 배경 k-means 32색(`data/style_palette_<판>.json`)으로 22% 끌어당김 → 바깥 1px 짙은 밤색 부드러운 선. 대조판 `_out/factory/compare_<풀>.png`(배경 그림 위 원본/통일 + 판의 한 장 그림).
- **판정 다섯 줄**(`sheet_judge.py`): 같은 사람(색 분포 ≥ 0.45) · 발 ±2px · 깜빡임(한 칸만 튀었다 돌아옴) · 잘림(가장자리 1px) · 투명 테두리(가장자리 2px·떨어진 반투명). FAIL 풀은 배포 안 함.
- **정본·배포**: `saga-assets/sprites2d_factory/<풀>/` + `<풀>.license.json` → `asset-place.json` 항목 `sprites2d_factory` 와 같은 내용으로 판 `assets/sprites2d_sheets/<풀>/` + `index.json` 의 `factory` 목록. 새 판·풀은 계획 json 의 `pools`·`deploy` 와 asset-place `only` 를 같이 늘린다.
- **이어하기**: 역할 webp 가 있으면 건너뜀(manifest 만 보지 않는다). Blender 낮은 우선순위.
- **병렬(K-0175)**: 굽기 Blender·그림체 프로세스를 풀 단위로 동시에 — 엔진(Unity·Godot) 떠 있으면 1·2, 아니면 RAM 여유 12GB↑ 3·5(30초마다 다시 잼). `FACTORY_BAKE=1 FACTORY_STYLE=1` = 옛 한 줄(SD·MOSS 와 겹칠 때). 눈 판정 면제 = 풀 `waive: {줄: 이유}`(판정기 경계 오판만, place 가 로그에 남김).
- 처리량·still 맞춤(K-0159)·동작 표 손잡이·점검 다섯·공장 동작 표 상세 = `HISTORY.md` H8(10-23 R-6 옮김).
- **함정**: K-0015 풀 몸(`cc0_basem`)에 모캡을 걸면 팔이 들리고 `rand:` 장비가 날개·꼬리를 붙인다 — 사람은 옷 이식 몸(`_out/vroid/<id>`) + 그 몸 `_anims` 를 쓴다. 뼈 표시 공(Icosphere)이 bbox 를 ±1m 로 부풀린다(보이는 메시만).

## 14. 모션 30 — 생활·전투 동작 표 (K-0161, 2026-10-21)

표 `data/clips30.json`(이름·출처·라이선스·판별 쓰임·루프·2D 칸 수·판정·눈 판정) → 팩 하나 `saga-assets/characters/anim-src/mocap/vroid_clips30_anims.glb`(+license, VRoid 뼈대 J_Bip·30fps, 3.1MB) — CMU 모캡 24 + 자체 키프레임 6(`keyframes.py` CF_Water_Pour·Sleep·Flag_Wave·Hang·Ride_Idle·Ride_Charge).

```
py tools/char-forge/mocap_fetch.py --table tools/char-forge/data/clips30.json        # BVH 받기(curl)
blender -b --factory-startup -P tools/char-forge/mocap_retarget.py -- --target <VRoid .glb 절대> --bvh <_in/mocap 절대> \
    --table <clips30.json 절대> --out <_out/clips/clips30_anims.glb 절대>                # 굽기 50초
py tools/char-forge/mocap_pose_check.py tools/char-forge/_out/clips/                 # 점검 → CLIPS_CHECK 30/30
py tools/char-forge/factory.py tools/char-forge/recipes/factory/k161_clips30.json --stage bake,style,judge   # 2D 견본(5방향·1190칸 ≈ 5분)
```

- **눈 판정(10-21)**: ○25 · △5(fish_wait·water·sweep·hammer·flag_wave — 손에 든 소품이 붙어야 읽힘). 판정기 PASS(같은 사람·발·깜빡임·잘림·테두리). 판 배포는 안 함 — 웹·고돗·유니티가 고른 동작만 배선(수신함).
- **함정**: glTF 가져오기 전 장면 fps 를 30 으로(기본 24 면 구간이 0.8~29.6 으로 줄어 끝이 멈춘 것처럼 보임) · 반복 구간 고르기는 '가장 닮은 두 프레임'이라 가만히 선 머리·꼬리를 뽑는다(`active`) · 발목만 고정하면 발이 제자리에서 돌아 발끝이 미끄러진다 · 이 PC 에서 urllib 받기가 멈춘 일 → curl.
