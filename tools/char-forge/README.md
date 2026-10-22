# char-forge — 자체 인물 공방 (VRoid·Mixamo 대체)

> 상태: **saga-godot 몸 = VRoid 직접 디자인** — 이 도구는 VRoid 주역에 CC0 동작·얼굴 굽기·게임 배선을 맡는다(§10 `vroid_intake.sh`). **saga-unity(사실풍) = 단계 3 `build_real.py`** 공방 후보를 갖췄고 사람 판정을 기다린다. 이력·세션 일지·상세 설명은 `HISTORY.md`(grep 전용). `SAGA-DESIGN.md` 는 여기를 가리키기만 한다. `tools/asset-forge` 처럼 **빌드 도구는 공유**(게임 코드 공유 금지와는 별개).

**몸 생성(`build_real.py`·MakeHuman·의상 3D)은 동결(2026-09-30, SAGA-ARCH §4.5).** 남는 일 = 들이기(`vroid_intake.sh`)·옷 변형·무늬·렌더 점검·출처 검사, 그리고 2D 모드용 스프라이트 굽기(`gear_sprites.py`·`bake_sprite_batch.py`, 티켓 K-0015).

## 1. 왜

사용자(2026-09-24): "자동화가 문제가 많기도 하고 저작권 때문에 자체적으로 만들고 싶어" · "상용하게 되면 꼭 필요해".

사실관계(정직하게):

- **Mixamo** — 게임에 넣어 파는 건 약관상 허용된다. 하지만 ① 원본 재배포가 금지라 공개 저장소에 못 올린다
  (지금 `.gitignore` 로 로컬 전용이고, 다른 PC 는 다시 받아야 한다) ② Adobe 계정·로그인·웹 화면에 기대고 있어
  `tools/mixamo_automation` 이 사이트 개편마다 깨진다 ③ 약관·서비스가 바뀌면 우리가 막을 길이 없다.
- **VRoid Studio** — 결과물 권리는 만든 사람에게 있고 **개인·법인 상업 사용이 된다**(Unity 등 앱에 넣어 파는 것도 명시 허용).
  금지는 "VRoid 결과물로 메시 변형·메시/텍스처 조합 기능이 있는 **앱을 만드는 것**"(사용자에게 꾸미기 도구를 배포하는 경우)이다.
  완성한 몸을 게임에 넣고, 엔진에서 색만 바꾸고, 동작을 입히는 건 여기 안 걸린다(2026-09-25 다시 확인 — 이전 판의 "105명을 코드로 뽑으면 닿는다"는 지나쳤다).
  한계는 GUI 전용이라 **조형은 사람 몫**이라는 것뿐이다(`saga-godot/docs/ASSET_GUIDE.md` 09-13).
- 결론: 상용을 생각하면 **입력은 전부 CC0 이거나 우리가 코드로 만든 것**만 쓰고, 명령 한 번에 끝까지 도는 도구가 필요하다.

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

| 입력 | 쓰임 | 라이선스(확인한 곳) |
|---|---|---|
| MakeHuman/MPFB 몸·CC0 옷 팩 14 | (폐기 — 10-08 용량 정리로 몸 지움) | CC0 확인 기록은 `HISTORY.md` H3 |
| **Quaternius Universal Base Characters** | 이미 뼈가 심긴 기본 몸 6(보통·10대·영웅 비율 × 남녀) + 머리 모양 20 | CC0(quaternius.com). 무료판은 60~70%만 들어 있다 |
| **Quaternius Universal Animation Library 1·2** | 동작 120+·130+(걷기 여러 방향·전투·총·감정 표현). 위 몸과 같은 뼈 | CC0(quaternius.com, Godot Asset Store 에도 올라와 있다). 무료판은 일부만 들어 있다 |
| **Quaternius Modular Character Outfits - Fantasy** | 옷(무료판 넷: 여자·남자 × 순찰자·농부, 색 두 벌씩). 위 몸·동작과 같은 뼈 | CC0(quaternius.com·itch). 옷은 **Regular 비율**로 재단돼 있고 "머리만 쓰라"(팩 Readme) |
| Blender Rigify | 괴물·비인간형 뼈 | Blender 안에 들어 있다. 만든 뼈에는 제약이 없다 |
| 자체 키프레임 | 원하는 동작이 팩에 없을 때 bpy 로 직접 짠다(등반·활공·방패 도발 등) | 우리 것 |

> 무료판에 실제로 든 것·자체 키프레임(`CF_*`)과 그 함정은 `HISTORY.md` H3.

## 5. 파이프라인 (한 명 = 레시피 하나 → `.glb` 한 벌)

| 단계 | 하는 일 | 방법 |
|---|---|---|
| A 몸 | 기본 몸을 불러 비율 모프를 섞는다 | MPFB 모프 **또는** Quaternius 몸 + 셰이프키. 툰은 머리 비율을 키우고 눈을 크게 한다 |
| B 뼈 | **표준 뼈 하나**(§6)에 묶는다 | 기본 몸의 가중치를 옮겨 오고(`DATA_TRANSFER`), 새 부품만 자동 가중치(`ARMATURE_AUTO`)를 쓴다 |
| C 머리카락 | 스타일 id → 메시 | 툰: 곡선 다발을 메시로 만든다(VRoid 식 덩어리 머리). PBR: 헤어카드 띠(unity ⑪ 에서 막혔던 "분리된 헤어 메시"를 이 단계가 만든다) |
| D 옷·장신구 | 부위 버텍스 그룹을 복제해 부풀린 껍데기 + kitbash 부품(갓·갑옷·기계 팔 — §13 세 시대를 섞는다) | `asset-forge/kitbash.py` 의 부품 규칙을 그대로 쓴다 |
| E 얼굴 | 툰: 눈·눈썹·입 **텍스처 데칼**을 코드로 그린다 + 눈 깜박임·아이우에오 셰이프키. PBR: MPFB 얼굴 모프 + CC0 스킨 | 대화 몸짓(saga-godot 106 ㉙)이 이 셰이프키를 쓴다 |
| F 재질 | 슬롯 이름을 표준으로 맞춘다(`skin`·`hair`·`cloth_a`·`cloth_b`·`metal`·`eye`) | Godot `cel_shader_apply.gd`·Unity `CharacterVisual` 이 이름으로 받는다. 색은 `asset-forge/palette.py` 로 팔레트에 맞춘다 |
| G 동작 | 표준 뼈 동작 묶음을 **따로** 한 파일로(`anim_lib_<트랙>.glb`) | 모든 인물이 뼈 하나를 같이 쓰니 재타겟은 한 번이다 |
| H 내보내기 | Godot: `.glb`. Unity: `.fbx`(Humanoid) 또는 glTFast `.glb` | 트랙마다 0단계에서 하나로 정한다 |

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

샘플 25벌(T 제외) 의 옷 조각을 다른 샘플 몸에 비율 맞춰 입혀 명단 인물마다 다른 GLB 를 만든다. 얼굴·머리는 25종이 반복된다(사용자 "약간 다르게만").

```bash
bash tools/char-forge/export_parts_all.sh                 # 샘플 VRM → _out/parts/<글자>/ (base + 조각)
py tools/char-forge/outfit_swap_plan.py                   # data/outfit_swap_plan.json (299 조합, 겹침 0)
blender -b --factory-startup -P tools/char-forge/outfit_swap.py -- --plan tools/char-forge/data/outfit_swap_plan.json tools/char-forge/_out/parts tools/char-forge/_out/outfit_swap --render
cp tools/char-forge/_out/outfit_swap/*.glb tools/char-forge/_in/vroid/ && bash tools/char-forge/vroid_batch.sh   # glb 입력도 받는다
```
- 성별·원피스·알려진 흠(살 비침·발목 퍼짐)은 `tasks/tools/done/K-0024.md`·`K-0101`.

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
- **처리량(10-21, 이 PC)**: 사람 풀 380칸 굽기 108초(0.29초/칸) + 그림체 55초 ≈ 2.8분, 짐승 260칸 65초 + 41초 ≈ 1.8분. GPU 는 Blender EEVEE 만(SD 없음).
- **still 과 같은 사람(K-0159)**: `still_match.py <풀>` 이 500 몸을 still 과 띠 색으로 순위 → 머리 모양·옷 꼴이 닮은 몸을 고르고 계획 `human.kinds` 로 `gear_sprites` KIND_JSON(`hair_ramp`·`cloth_by`·`cape:wrap`·갑주·`pal`)을 맞춘다. 배율 ortho 2.2(몸 ~80%, still 94%), 창·지팡이 풀은 `px` 256(px/m 같음). 판정 6째 줄 `still`. style_pass 는 채도 > 0.10 인 곳 색상을 되살린다(`keep_hue`). 배포 `deploy` = {판 sprites2d_sheets: [풀…]}.
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

- **굽기 손잡이(표 줄)**: `range` 구간 고정 · `search` 자동 구간 범위 · `active`(수 = 문턱 배율) 반복 구간은 움직이는 곳만 · `reverse` · `inplace`/`inplace_z`(사다리) · `cf` = 자체 키프레임(build.retarget). 표 머리 `lock_feet` = 디딘 발 고정(발목·발끝 시간 순 한 번에, 두 마디 IK, 들릴 때 4프레임 풀기, 발바닥 다 닿으면 발 방향도 못박음) · `clean_feet` = CMU 발 마커 뒤집힘 막기(제 축 비틀림 빼기·75° 넘는 꺾임은 앞 프레임·프레임당 40° 제한 — 138_01·80_09 에 170° 뒤집힘이 있음).
- **점검 다섯**(`mocap_pose_check.py <폴더>`): 디딘 점(발목·발끝 따로) 미끄러짐 ≤ `slip_max`(기본 3cm, locomotion·no_ground 는 재기만) · 손목 ≤ 80° · 땅 뚫림 ≥ −5cm · 튐 ≤ 90°/프레임 · 표 `expect`(어느 프레임이든). 줄 `CLIP 이름 PASS|FAIL {slip_at·jump_at…}`.
- **공장 동작 표**: 계획에 `motion_table`(+ `anim_extra` 'm=…;c=…' 여럿 가능) → 표 이름이 역할 이름·동작 `c.<이름>`. 표 `sprite.ground`(each 칸마다 / row0 그 줄 첫 칸 — 쪼그림·눕기·뛰기·매달리기·말 위), `sprite.center`(칸 밖이면 카메라 밈), `sprite.spiky`(한 칸 정점이 정상) 를 style_pass·sheet_judge·factory 가 읽는다. 대조판이 idle 없는 풀이면 역할마다 가운데 칸.
- **눈 판정(10-21)**: ○25 · △5(fish_wait·water·sweep·hammer·flag_wave — 손에 든 소품이 붙어야 읽힘). 판정기 PASS(같은 사람·발·깜빡임·잘림·테두리). 판 배포는 안 함 — 웹·고돗·유니티가 고른 동작만 배선(수신함).
- **함정**: glTF 가져오기 전 장면 fps 를 30 으로(기본 24 면 구간이 0.8~29.6 으로 줄어 끝이 멈춘 것처럼 보임) · 반복 구간 고르기는 '가장 닮은 두 프레임'이라 가만히 선 머리·꼬리를 뽑는다(`active`) · 발목만 고정하면 발이 제자리에서 돌아 발끝이 미끄러진다 · 이 PC 에서 urllib 받기가 멈춘 일 → curl.
