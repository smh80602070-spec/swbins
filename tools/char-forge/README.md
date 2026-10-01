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
| **MakeHuman / MPFB 기본 몸·모프·스킨** | 몸 비율(키·체격·나이·얼굴형)을 수치로 조절 | 기본 에셋 CC0, 내보낸 모델 CC0 — 닫힌 소스 상용 게임 OK. GPL 은 애드온 **코드**에만 걸린다(makehumancommunity.org FAQ "use in closed source"·"can I sell models"). **제3자 에셋은 따로 확인** |
| **MakeHuman 커뮤니티 CC0 옷 팩 14**(09-26, `mh_*`) | 진짜 옷 메시 126벌·머리카락 34·수염 5(드레스·기모노·윗옷·바지·치마·신·장갑·모자·투구·정장·수도복·바이킹 셋, 기본 양복·머리 색 바꿈) | 팩 목록 json 의 항목마다 CC0(`fetch_sources.py` 가 검사). 뺀 것(`exclude`): CC-BY 장화 하나 · 원작 캐릭터 옷 셋 · 정치 문구 모자 · 원작 이름 머리. 가면 팩(masks01)은 슈퍼히어로풍이라 안 들인다 |
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

단계 0 도구 뼈대 ✅ · 1 동작 먼저 교체(saga-godot) ✅ · 2 saga-godot 몸 = VRoid ✅ · 3 saga-unity 몸 공방 후보(사람 판정 대기) ⏳ · 4 도감 대량 레시피(도구만 끝, 보류) ⏸ · 5 상용 문턱 = `tools/asset-audit` 출처 검사 ✅. 기준·측정·세션 일지 전체는 `HISTORY.md` H4.

## 8. 사람 몫 · 결정 (요약)

D1 무료판만 · D2 얼굴 toon|real 축(godot=toon, unity=real, 한 화면에 섞지 않는다) · D3 Unity 는 FBX(Humanoid), Godot 은 `.glb` · D4 saga-godot 몸 = VRoid 직접 디자인 · D5 unity 몸 = Mixamo 유지·공개 저장소 밖(출처 검사로 대조). 팩 받기는 사람이 itch.io 버튼을 눌러 `Downloads` 에 둔다. 까닭·전문은 `HISTORY.md` H5, 그래픽 예상은 H6.

## 9. 지금 Mixamo·VRoid 가 쓰이는 자리 (교체 대상)

| 트랙 | 자리 | 지금 | 대체 |
|---|---|---|---|
| godot | GO·FOREST 플레이어 몸 | VRoid `AvatarSample_A` · `saga_forest_avatar_01` | 툰 레시피 |
| godot | DUNGEON 영웅 | VRoid `dungeon_hero_01` | 툰 레시피 |
| unity | 주역·적 Maria·Abe·Brute | Mixamo 몸 + 클립 | PBR 레시피 + UAL |
| unity | 동행 무사(Paladin)·술사(Peasant Girl)·유격(Erika Archer)·마을 사람 | Mixamo | PBR 레시피 + 장비 소켓 |
| unity | 짐승·괴물(Goblin·Pumpkinhulk·Warrok·Parasite·Nightshade·Jolleen·Skeletonzombie) | Mixamo | 같은 몸의 비율 극단값 + kitbash, 떠 있는 것은 Rigify 뼈 |
| unity | 이동 기술(등반·활공·수영·물 위·점프)·방패 도발·막기 피격·활 | Mixamo 클립 | **공방 후보 있음(09-25)** — 주역·무사·유격 레시피에 `CF_*`·UAL 동작, 비교 장면 순환에 상태 추가. 게임 교체는 판정 뒤 |

클립 문구의 원래 목록은 `tools/mixamo_automation/README.md` 레시피 표에 있다. 교체가 끝난 줄은 이 표에서 **지운다**(상태 표).

## 10. VRoid 주역 들이기 (사람 몫 → 도구 몫)

**사람 몫 — VRoid Studio 에서**
1. 새 모델을 만들어 얼굴·머리·옷을 디자인한다. **원신 등 실제 게임 캐릭터를 베끼지 않는다**(화풍은 따라가도 되지만 특정 캐릭터 디자인은 저작권 대상). 이름 정책대로 실존·원작 인물을 본뜨지 않는다.
2. 부품은 **VRoid 기본 제공 것**만. BOOTH 등에서 받은 텍스처·의상은 판매자 약관이 따로 있어 쓰기 전에 알려 준다.
3. 내보내기 → VRM(0.0·1.0 둘 다 된다). 라이선스 칸: 아바타 사용 = **모든 사람** · 상업 이용 = **개인·법인 허가** · 재배포 = **허가** · 개변 = **허가**
   (공개 저장소에 올리고 게임에 넣어 팔 수 있게 — 지금 VRoid 셋과 같은 설정).
4. 파일 이름을 id 로(영문 소문자·숫자·_, 예 `hero_go_02.vrm`) 저장해 **다운로드 폴더**에 두고, "어느 자리(GO 플레이어·FOREST·DUNGEON·STORY·NPC 등)에 쓸지"만 알려 준다.

**도구 몫 — 명령 한 번**

```bash
bash tools/char-forge/vroid_intake.sh ~/Downloads/hero_go_02.vrm hero_go_02
```

사본(.vrm+.glb) → 얼굴 데칼 굽기 → CC0 동작 여덟 굽기·파일 검증 → Godot 동작 묶음(`anim_cc0/<id>_lib.res`) → 셀 셰이더 얼굴 표 등록 → 실제 몸 점검(`probe_anim_cc0.gd`).
VRM 메타의 라이선스 칸을 찍어 준다 — 상업·재배포가 허가가 아니면 들이지 않는다. 게임 씬에 물리는 건 자리가 정해진 뒤 따로 한다.
