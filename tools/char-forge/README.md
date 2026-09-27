# char-forge — 자체 인물 공방 (VRoid·Mixamo 대체)

> 상태(2026-09-25 저녁): **saga-godot 몸 = VRoid 직접 디자인(D4)** — 이 도구는 VRoid 주역에 CC0 동작·얼굴 굽기·게임 배선을 맡는다(§10 `vroid_intake.sh`, 사람이 `.vrm` 을 Downloads 에 둘 때). **saga-unity(사실풍) = 단계 3 `build_real.py`** — Mixamo 괴물 자리 전부(Goblin·Brute·Warrok·Parasite·Nightshade·Hulk·Jolleen·Skeleton)와 동행 셋(Paladin·PeasantGirl·Archer)에 공방 후보가 있고, 두목 여섯(Maw·Ganfaul·Ninja·Demon·AlienSoldier·Morak)·GO 세 시대 아홉(들판 적 GasMask·Copzombie·ExoRed, 역참 사람 Remy·Megan·SwatGuy·ExoGray·Vanguard·Crypto)·DUNGEON 세 시대 여덟(잡졸 Brian·XBot·Swat·YBot·Boss·Zlorp, 행상 Leonard·Astra)·STORY 세 시대 열(Racer·Dummy·Warzombie·Mremireh·Jody·Yaku·Steve·Mannequin, 사람 Olivia·Ely)·STORY 정찰병 PeasantMan·FOREST 마을 사람 여섯(CastleGuard·Pelegrini·Pete·Sophie·Uriel·Jennifer)·GO 인물 105 몸 여덟(Dreyar·CastleGuard02·Heraklios·Brady·Joe·Kachujin·Arissa·Eve)·맨몸 잡졸 Abe 도 공방 후보가 있다 — **unity Mixamo 몸 61 전부**(출처 검사 `tools/asset-audit` 로 대조). 비교 장면 `Saga/Char Forge/Build Compare Real Scene` 짝 예순하나 `CMP_RESULT OK`, **사람 판정 전**(saga-unity `docs/HOW_TO_PLAYTEST.md` §9). **새 세션 다음 일**: ① 판정이 나온 짝부터 게임 몸 교체(`SetupNpcCharacterImports`·`SetupForestCreatureModels` 가 공방 FBX 를 받게) · ② 판정이 없으면 다른 세션이 새 Mixamo 몸을 더했는지 출처 검사로 본다(후보 없는 몸이 생기면 §3 순서로 짝을 더한다) · ③ 자체 동작은 게임이 쓰는 종류 전부 끝(09-25 밤 치유 시전·무릎 꿇기) — 새 동작이 필요해지면 `keyframes.py` 에 자세를 더한다(쇄골 방향 `dirs.clavicle_*` 도 받는다: 바탕 `Idle_Loop` 은 오른어깨를 12cm 뒤로 뺀 짝다리라 두 손 자세는 쇄골을 좌우 같게 편다). 출처 수치는 `tools/asset-audit` 요약 "출처(인물·동작)". 실기 확인은 재촉하지 않는다.
> `SAGA-DESIGN.md` 는 여기를 가리키기만 한다. `tools/asset-forge` 처럼 **빌드 도구는 공유**(게임 코드 공유 금지와는 별개).

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
| `sources.json` | 입력 장부(팩·URL·라이선스·sha256). 여기 없는 파일은 안 쓴다 |
| `fetch_sources.py` | `_src/`(gitignore)에 받고 푼다. itch.io 무료 팩은 csrf → download_url → 파일 id(**key 없이** — 붙이면 "invalid key")로 받는다 |
| `bonemap.json` | 표준 뼈 53개 → Godot `SkeletonProfileHumanoid`·Unity `HumanBodyBones` 이름 |
| `build.py` | 레시피 → 몸·머리·눈썹·비율(머리 크기·키)·재질 이름(`skin`·`hair`·`eye`)·동작 굽기 → `.glb`(+`.fbx`) + `*.license.json` |
| `verify.py` | 내보낸 **파일을 다시 열어** 원본 동작과 맞댄다: 팔다리 방향 ≤ 5° · 땅 닿음 ≤ 1cm · 걷기 손목이 움직이나 |
| `recipes/` | 인물 레시피. `_test_*` 는 시험용, `_cmp_*` 는 단계 2 비교용(게임 인물 아님). 옷: `outfit`·`outfit_color`·`outfit_drop`(예: `Head_Hood`) |
| `bake_for_rig.py` | 이미 있는 몸(VRoid 등)의 뼈대에 동작만 굽는다 → 뼈대+동작 `.glb`. `--map vroid --clips 게임이름=UAL이름,…` |
| `rigmaps.py` | 표준 뼈 목록·기준 자식 표(뼈 방향)·뼈 이름 표(`identity`·`vroid`·`mpfb`) |
| `skeleton.py` | 해골 부품(`kitbash` `skeleton`, 레시피 마지막) — 뼈대 자리·살 단면 → 뼈 조각·두개골, 살·눈·눈썹은 걷고 이만 남긴다 |
| `build_real.py` | **단계 3 사실 몸** — 레시피 → MPFB 몸(모프 `macro`)·`game_engine` 뼈·피부·눈·눈썹·속눈썹·이·머리·옷(MakeHuman system assets) → 모프 굳히기·옷 아래 살·도우미 지우기 → 재질 칸 이름 → UAL 동작 → `.fbx`(Unity Humanoid)+`.glb`. `BLENDER_USER_RESOURCES=tools/char-forge/_blender` 필요 |
| `keyframes.py` | **자체 키프레임 동작**(`CF_*`) — UAL 무료판에 없는 동작을 동작 팩 뼈대 위에 코드로 짓는다. 자세 = 골반 이동·돌기(`yaw`)·등뼈·손발 방향(`dirs`) + 손목·발목 자리(`ik`, 두 마디 IK·팔꿈치/무릎 `pole`). `retarget`·`verify.py` 가 UAL 동작과 똑같이 받는다(레시피 `"climb": "CF_Climb_Loop"`). 지금: 등반·활공·방패 막기·막기 중 피격·활 대기·활 쏘기·치유 시전·무릎 꿇기(포로)·**칼 쥐고 좁게 서기**(`CF_Guard_Idle_Loop` — 긴 옷자락·갑옷 치마가 `Sword_Idle` 의 넓은 다리를 따라 부풀어 쪼그려 앉은 꼴이 돼서, 진짜 옷을 입은 무장 28명의 대기) |
| `measure_shape.py` | 모양 점검(스크린샷 대신) — `.glb` 를 다시 열어 복면·바이저 띠 속 남은 살, 띠·모자·배낭 둘레(°), 옷자락 뚫림(서기·걷기·달리기), 모자 밖 머리카락을 찍는다 |
| `gen_hero_recipes.py` | **단계 4** — saga-unity GO 도감 105(`GoHeroes.cs` 를 그대로 읽는다) → `recipes/hero/hero_<id>.json`. 역할(`ROLE`, id 로만)마다 옷·머리·키·체격 선호, 앞사람 모두와 실루엣 네 축(키 다섯 칸·체격 넷·머리·옷 틀) 중 **둘 이상** 다른 조합 중 벌점이 가장 작은 것. 색은 세력 색일 뿐 축이 아니다. `--check` = 다시 읽어 축 검사만. 레시피는 손으로 고치지 말고 생성기를 고친다 |
| `calib_height.py` | 레시피 `height_target_m`(맨몸 키, 살 메시) → `macro.height` 이분 탐색(몸만 만들어 여덟 번, ±0.5%)해 레시피에 적는다. 105명 7분 |
| `garments.py` | **옷 짓기(09-26)** — 공방이 옷 메시를 지어 MakeHuman 옷(`.mhclo`)으로 쓴다: 기본 몸 살을 재서 몸통~단 통(단은 치마 도우미 `helper-skirt` 에 붙어 다리 사이가 안 갈라진다)·처지는 넓은 소매·허리띠·두께 + 천 그림(교령 깃·단·끝동·띠). MPFB MakeClothes 순서(`mesh_is_valid_as_clothes` → `create_mhclo_from_clothes_matching` → `write_mhclo`)라 어느 체형에나 맞는다. 옷 정점은 옷 지을 때만 만드는 맞춤 무리(`cf_torso`·`cf_arm_l/r`)에만 붙인다 — `body` 전체면 A 자세 손(허리 옆)에 띠가 붙어 튄다. 옷 = 부품 조합(`tube` 겹쳐 입기 `over`·가슴 치마 `mono` / `sleeves` 길이·처짐·넓힘 / `band` / 머리 `mangeon`·`topknot`·`gat`·`helmet`·`neckguard`(앞 트임)) + 천 무늬(평직·찰갑 비늘·누비·판)와 **노멀 그림**. 결과는 MPFB 사용자 데이터 `clothes/cf_<id>/`(gitignore, 생성기가 정본 — 기본 한 벌 1분 남짓). **옷 서른셋(09-26)**: 한국 `dopo`(도포)·`hanbok_f`(저고리·치마)·`chalgap`(찰갑)·`dallyeong`(단령·흉배·각대)·`gonryongpo`(곤룡포·둥근 금빛 보·옥대) · 일본 `kimono`(자루 소매·오비·등 매듭)·`hakama`(고소데·주름 하카마)·`gusoku`(오도시 동·쿠사즈리·소데·정강이 가리개) · 삼국 `samguk_armor`(발목 전포·어린갑·호심경 둘) · 머리 `gat`(망건·상투·갓)·`helmet_east`·`helmet_general`(붉은 술)·`kabuto`(골 사발·시코로·쿠와가타)·`samo`(사모)·`ikseongwan`(익선관)·`boktu`(복두)·`myeollyugwan`(면류관·구슬 줄)·`eboshi`(에보시). **서쪽·세계 열하나(09-26 둘째)**: `toga`(비스듬한 띠 `sash`)·`chiton_armor`(청동 흉갑·가죽 띠 치마·정강이)·`hauberk`(사슬 갑옷·민소매 겉옷)·`officer_coat`(단추 두 줄·견장·흰 바지)·`gown`(퍼지는 금란 치마)·`kaftan`(앞 가운데 띠)·`deel`(유목 긴 옷)·`turban` · 동쪽 `baji_jeogori`·`warrior_robe`(가죽 조끼 무사복)·`shinobi`(닌자복). **셋째(09-26)**: `baeja`·`kamishimo`·`doublet`·`qaba` · 머리 `sangtu`·`sangtu_bun`·`chonmage`(부품 `hairdome`·`mage` — §7 단계 4). 부품: `tube`·`sleeves`(`arc` 바깥 판 = 소데, `bag` 네모 자루 = 기모노, 세로 주름)·`band`·`leggings`(다리 통)·`discs`(호심경)·`bow`(등 매듭)·머리 `helmet`(`visor` 앞챙·`knob`)·`neckguard`(`flare`·`drop`·`open`)·`kuwagata`·`tassel`·`samo`(`wing`·`tilt`)·`boktu`·`myeollyu`+`beads`·`eboshi`. 무늬: 평직·찰갑·**오도시**(옻칠 판 + 색 끈)·**어린**(물고기 비늘)·금란·줄무늬·골·판·징·구슬 + 단·깃·**판 틈**(`panels`)·**흉배**(`patch`)·**둥근 보**(`roundel`). **색 변형**: 틀의 색 칸 `C1`·`C2` 를 `<id>@<헥스>[,<헥스>]` 로 바꾸면 `cf_<id>_<헥스>…` — 메시·맞춤(.obj·.mhclo)은 기본 옷을 베끼고 그림만 새로 굽는다(한 벌 5초). 09-26 렌더(`render/render_turn.py` 네 방향): 사무라이·장수·관리·임금·기모노 여인 모두 알아볼 만하다. 남은 흠 — 긴 옷 뒤 엉덩이 아래 불룩: 옷 메시의 뒤 윤곽은 곧게 넓어지니(측정) 입힌 뒤 한쪽 허벅지 뼈를 따라 밀리는 몫이다. 옷자락 정점의 좌우 다리 무게를 평균해 봤더니 반대쪽 고관절을 축으로 돌아 연필 치마처럼 오므라들었다(천 시뮬레이션 없이는 못 없앤다) · 느슨한 소매가 매끈한 통이라 두툼해 보인다 |
| `render/` | **눈으로 보기**(09-26) — 공방 몸을 Mixamo 와 같은 빛·키로 나란히 렌더(`render_pairs.py`·`render_heads.py`), 한 몸 네 방향(`render_turn.py`). 사용자가 확인을 부탁했을 때만(루트 CLAUDE.md). 쓰는 법·함정은 `render/README.md` |

동작 굽기 요점(`build.py` `retarget`): 몸 팩과 동작 팩의 쉼 자세가 목 14°·발 9° 쯤 달라, 곡선을 그대로 베끼면 자세가 기운다(측정: 칼 휘두르기 15.6°).
verify 함정(09-25 고침): FBX 를 다시 열면 동작이 1 프레임부터 선다(glb·원본은 0) — 첫 프레임끼리 맞추지 않으면 한 프레임 밀린 채 재서 옛 fbx 오차 0.5° 대부분이 이 밀림이었다. 또 한 장면이라 frame_set 이 두 뼈대를 다 옮기니 원본 값을 먼저 읽고 과녁 프레임으로 넘어간다. 샘플은 아홉 프레임(다섯이면 열쇠 사이 튐을 놓친다).
그래서 ① 뼈마다 쉼 방향을 원본 쪽으로 맞추는 최소 회전을 먼저 곱하고 ② 골반 이동은 **다리 길이 비**로 늘리고
③ 원본 발이 땅(±1cm)에 있으면 낮은 발이 땅에 닿게 골반 아래를 올리고 내린다(1~3cm 사이는 서서히 풀어 이륙·착지에서 튀지 않게).
MPFB(MakeHuman 확장)는 `fetch_sources.py` 가 `_blender/`(gitignore)에 설치하고 system assets 를 그 사용자 데이터에 푼다 — 사용자 Blender 설정과 따로다. 사실 몸 빌드:

```bash
export BLENDER_USER_RESOURCES="$PWD/tools/char-forge/_blender"
"$B" -b --factory-startup -P tools/char-forge/build_real.py -- --recipe tools/char-forge/recipes/_cmp_real_hero_f_01.json \
    --out tools/char-forge/_out/_cmp_real_hero_f_01.glb --fbx tools/char-forge/_out/_cmp_real_hero_f_01.fbx --check
"$B" -b --factory-startup -P tools/char-forge/verify.py -- --glb tools/char-forge/_out/_cmp_real_hero_f_01.fbx --map mpfb --clips idle=Sword_Idle,…
```

**사람 NPC 짝 하나 더하는 순서(saga-unity, 09-25 굳힘)**: ① 비슷한 `_cmp_real_*` 레시피를 본떠 새 레시피(자리 이름·역할을 `_note` 에, 이름은 가명·실명 금지) → ② `build_real.py --check` → ③ `verify.py`(fbx·glb, `--map mpfb --clips` 는 레시피 anims) → ④ `measure_shape.py` → ⑤ 두 번 빌드해 glb sha256 같은지 → ⑥ `.fbx`+`.license.json` 을 `saga-unity/Assets/Art/CharactersForge/` 에(**FBX 는 로컬 전용** — 09-27 사용자 결정, 진짜 옷 그림이 든 61벌이 1.4GB 라 `saga-unity/.gitignore` 가 FBX·꺼낸 그림·재질·`Animators/CharForge`·`CharCompareReal` 장면을 막는다, 커밋은 `.license.json` 만) → ⑦ `BuildCharCompareRealScene.Pairs` 에 짝(지금 몸 상태 수에 맞춰 `BossPair` 다섯 상태 · `FolkPair` 서기·걷기 · `IdlePair` 서기만) → ⑧ **다른 세션 Unity 가 안 돌 때**(`Get-CimInstance Win32_Process` 로 saga-unity 배치 확인 — 도는 중에 FBX 를 넣으면 그 진단에 섞인다, 남의 커밋 전 파일 컴파일 오류면 고치지 말고 그쪽 커밋을 기다린다) `-executeMethod Saga.EditorTools.BuildCharCompareRealScene.BuildAndVerifyBatch` → `CMP_RESULT OK` → ⑨ 배치가 올린 `ProjectSettings/ProjectVersion.txt`·`Packages/` 되돌리기 → ⑩ HOW_TO_PLAYTEST §9 짝 목록·saga-unity HISTORY·이 README, `git commit -- <경로>`(레시피·도구·`.license.json`). **새 PC**: `fetch_sources.py` → 레시피의 `_garments` 를 모아 `garments.py` → `recipes/_cmp_real_*.json` 을 모두 `build_real.py --fbx`(한 벌 1~2분) → ⑥ 복사 → ⑧ 배치. 껍데기 색이 다르면 칸 이름을 달리한다(같은 칸은 첫 색으로 합친다). 셸 heredoc 에 한글과 작은따옴표가 섞이면 파싱이 깨지니 레시피·생성기는 Write 로 쓴다. **키는 `macro.height` 로 맞춘다(09-25 겪음 — 사람형 옛 몸 스물둘도 이때 다시 맞췄다: 술사 1.36m·택배 기사 1.44m·무사 2.03m·능묘지기 2.17m 가 짝 키 ±1.5% 로, 괴물 열하나는 비율이 설계라 그대로)**: MakeHuman 키 값은 가파르고 나이·성별에 따라 달라(어른 남자 0.6 → 1.89m · 0.75 → 2.11m, 여자 0.55 → 1.56m) 감으로 넣으면 20~30% 빗나간다. 비교 장면이 짝 키로 늘려 줄이니 틀린 키는 다리 비율(`leg_ratio`)이 늘어난 몸으로 보인다 — 빌드 로그 `height_m` 이 짝 키 ±1.5% 안이 될 때까지 키 값을 선형 보정해 레시피에 적는다(두세 번이면 된다). `age` 0.5 가 스물다섯 어른이고 0.3 이면 열여섯 쯤 청소년 비율이다 — 어른 사람은 0.4 이상.

사실 몸 요점: 뼈를 부위보다 먼저 단다(붙이는 순간 가중치를 옮긴다 — MPFB `characterbuilder` 와 같은 순서). 재질은 `GAMEENGINE`(바탕색·노멀 그림을 원리 BSDF 에 바로 — FBX 로 그대로 간다). `bake_modifiers_remove_helpers(bake_masks=True)` 로 옷 아래 가려진 살을 실제로 지운다(운동복이면 허리 아래 몸이 빠진다). 세분화는 안 건다(폰 예산). 레시피 `macro` = MakeHuman 0~1 값(gender 0 여 · 1 남, race asian·caucasian·african).

괴물 레시피 칸(`_cmp_real_goblin_01`·`_cmp_real_brute_01`·`_cmp_real_warrok_01`·`_cmp_real_parasite_01`·`_cmp_real_nightshade_01`):
- `targets` {모프: 값} — MPFB 기본 모프(귀·코·턱·머리·목·몸통 수백 개, `_blender/…/mpfb/data/targets/`)와 animal01 팩(`elvs_piggy_nose1` 돼지 코·`culturalibre_faun_face` 등, CC0)을 **뼈를 달기 전에** 건다. 좌우 짝은 `l-`/`r-` 를 떼고 쓰면 둘 다(`"ear-shape-pointed": 1`).
- `tints` {재질 칸 또는 옷 폴더 이름: 헥스} — 바탕 그림에 색을 곱해 **새 그림으로 굽는다**(`_out/<id>_tex/`). 옷은 폴더 이름으로 준다(`"toigo_wool_pants": "#7d97c8"` — `cloth_a…` 글자는 옷 물체 이름 차례라 레시피에서 알기 어렵다). 노드로 곱하면 FBX 가 그림을 못 옮긴다. **염색 `"=#헥스"`(09-26)** — 곱하기는 검은 몸 옷(SF bodysuit·skinsuit 평균 0~15)에 안 먹어서, 밝기 결(쓰는 칸 평균·편차 대비 치우침 ±18%)만 남기고 색을 새로 입힌다(`"matcreator_mc-bodysuit-2021": "=#4f86b8"`, 판금은 `"=#2e3238"`). MPFB 재질은 같은 그림을 두 노드가 읽으니 둘 다 바꾼다(한쪽만 바꾸면 원본이 FBX 에 딸려 간다).
- `tuck` [옷 폴더 이름](09-27) — 그 옷 밖으로 비어져 나온 살을 쉼 자세에서 옷 면 4mm 아래로 눌러 넣는다(얼굴·목·손은 빼고, 판정은 살 법선 앞 3cm·뒤 1.2cm 광선). `toigo_fisherman_sweater` 가 여자 몸에서 체형을 바꿔도 가슴·어깨뼈 살이 뚫어 넣었다 — 앞가슴은 잡히고 어깨 뒤 두 점은 동작 휨이라 남는다(더 깊게 8mm 는 앞에 새 점이 생겨 되돌림). 안 주면 몸은 예전과 바이트까지 같다.
- `kitbash` [부품] — 몸을 다 지은 뒤 실제 살을 재서 붙이는 자체 생성 부품. `horns`(머리 뼈, `length`·`radius`·`curl`·`color`) · `loincloth`(허리 → 허벅지 `length`, 위는 골반·아래로 갈수록 허벅지 무게 — 단면은 몸통·다리 살만 재야 한다: A 자세 손이 엉덩이 높이라 손까지 두르던 적이 있다). `horns` 에 `count: 1` 이면 정수리 외뿔(뿌리 = 머리 가운데 줄에서 실제로 가장 높은 살) · `tusks`(입술 살 `lips` 무리 좌우 끝에서 위·앞으로, `length`·`radius`) · `spores`(등·어깨 살에 65% 묻힌 혹 무리, `count`·`radius: [작게, 크게]`, 자리·크기는 id 씨앗 — 혹마다 그 자리 살의 뼈 무게를 그대로 받는다) · `robe`(쇄골 아래 → 발목 옷자락, `top`·`hem`·`flare`·`jag` 톱니 끝단, 단면은 **점을 모두 품는 타원** — 네모 내접 타원은 두 다리 단면 모서리를 놓쳐 37% 가 뚫고 나왔다). `robe` 의 `hide_legs: true` 는 옷자락 속 다리 살을 지운다(떠 있는 유령 — 옷자락이 허벅지를 70% 만 따라가 서기 29%·걷기 38% 뚫리던 것이 1.4%·1.6%). 그때 발·발끝 뼈에 묶인 정점이 0 이 되면 Unity Humanoid 가 `LeftFoot` 을 못 찾으니 끝단에 1% 씩 걸어 둔다. `rocks`(어깨·팔·등·정강이 바깥 살에 반쯤 묻힌 모난 판 — 면을 안 쪼갠 이십면체를 살 법선 쪽으로 `flat` 만큼 눌러 돌림, 모난 면 그대로) · `robe` 의 `length`(골반→발목 몫, 짧은 옷)·`teeth`(끝단 톱니 수)·`weights: "skin"`(골반 아래 정점이 가장 가까운 살의 뼈 무게를 받는다 — 다리가 남는 옷, `center` = 두 다리 사이 가운데 줄을 골반으로 되돌리는 몫 0.5). 옷자락 뚫림은 **그 방향 끝단보다 위의 다리만** 센다(끝단 아래 다리는 원래 보인다 — 처음엔 이걸 섞어 옷을 넓힐수록 수치가 나빠졌다). `shell`(옷·갑옷 껍데기 — `src` = 옷 폴더 이름이면 살 대신 **그 옷 면**을 본뜬다(진짜 옷 아래 살은 빌드가 지워 배낭·조끼가 사라진다, 09-26) · `groups` fnmatch 무늬의 살 면(무게 합 ≥ `minw`, `z` = 키 몫 [아래, 위])을 복제해 법선 쪽으로 `offset` 띄우고 `thick` 두께로 닫는다. 정점마다 그 살 정점의 뼈 무게라 동작에서 살과 같이 움직인다. `slot`(cloth·leather·metal …)이 같으면 한 물체. `open_face` = 눈 앞·눈썹 아래 얼굴 창을 뺀다(투구·두건). `z_eye` [아래, 위] = 눈 높이에서 m 로 잰 띠(복면·머리띠·바이저 — 키 몫은 머리 모프마다 어긋난다, 띠가 좁으면 큰 뒤통수 면이 통째로 안 들어 고리가 끊긴다: 3cm 는 뒤 40° 가 비었고 5.5cm 면 360°) · `facing` = 살 법선 앞(-Y) 성분이 그 값 이상인 면만(앞 바이저·앞가슴판). `facing_back` = 뒤(+Y) 쪽만(배낭·짐틀 — 크게 띄운 두께 판). 얼굴 앞 전부를 덮는 방독면은 `facing` 없이 띠로 한 바퀴 두른다(앞면만 고르면 코 밑·턱 아래를 향한 면이 빠져 살이 388점 비쳤다 → 26점, 뒤는 두건 위 끈). 칸 이름이 다르면 다른 색 물체다(`cloth_band`·`cloth_turban`·`metal_visor` — 같은 칸은 첫 색 하나로 합친다). 땅 아래로 안 내려간다. 덮인 살 면은 지우고(`hide_under`, 투구 속 귀도 빠진다), 안쪽 겹은 가장자리에서 세 줄까지만, 더 멀리 띄운 껍데기에 덮인 안쪽 껍데기 면은 가장자리 두 줄 안쪽부터 지운다 — 안 보이는 면만 덜어 6.9만 → 4.5만) · 재질 칸 이름은 부품 이름(`horn`·`tusk`·`cloth`·`spore`·`rock`·`robe`, 껍데기는 slot — Unity 빌더는 `metal` 에 금속감 0.85·매끈함 0.62, `leather` 에 0.35), 그림 없이 바탕색 — Unity 빌더가 색을 옮긴다.
- 다리 길이 모프(`upperlegs-height-decr` 등)는 발을 띄운다 — `make_human` 이 모프 뒤에 땅을 다시 맞춘다(MPFB 는 `abs(최저점)` 으로 올리기만 해서 워록이 8cm 떠 있었다).
- 같은 사이트의 animal02~04(곰·고양이·개 머리 등)는 CC-BY 라 안 쓴다.

옷 입히기 요점(`build.py` `dress`·`tuck_under_cloth`): 옷 팩은 Regular 비율이라 **옷 뼈대를 인물 뼈대로** 삼고, 몸 팩(Superhero)에서 머리·목·윗가슴(`HEAD_GROUPS`)만 떼어 Head 뼈 자리로 옮긴다. 머리·목만 남기면 트인 옷깃으로 잘린 자리가 30~40% 드러났다. 비어져 나온 살은 옷 면 6mm 아래로 눌러 넣고, 완전히 덮인 가슴 살은 지운다(목은 남긴다 — 벌어진 옷깃 속이 구멍으로 보이지 않게). 빌드가 `seam.covered`(잘린 가장자리에서 바깥으로 쏜 광선이 옷에 막히는 비율, UV 이음매 짝은 뺌)를 찍는다. `face: toon` 이면 노멀·거칠기 텍스처를 뗀다(saga-godot cel_toon 은 바탕색만 읽는다 — 39.5MB → 6~10MB). 텍스처는 2048² 까지.

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

> **무료판에 실제로 든 것(2026-09-24 풀어 봄)**: 몸 = Superhero 남·여 둘(피부 밝음·어두움 두 장), 머리 6(`Hair_Long`·`Buns`·`SimpleParted`·`Buzzed`·`BuzzedFemale`·`Beard`)·눈썹 2.
> 동작 45: 서기·걷기·조깅·질주·웅크려 걷기·뛰기(시작·공중·착지)·구르기·헤엄(앞·제자리)·칼(대기·베기)·주먹·권총·주문(시작·유지·쏘기·끝)·맞기(가슴·머리)·쓰러짐·줍기·앉기·말하기·춤·밀기·운전·고치기.
> 없는 것(자체 키프레임 몫): 벽 오르기·활공·방패 막기·도발·활 쏘기 — **09-25 `keyframes.py` 로 지었다**(`CF_Climb_Loop`·`CF_Glide_Loop`·`CF_Shield_Block`·`CF_Shield_Block_Hit`·`CF_Bow_Idle_Loop`·`CF_Bow_Shoot`, 09-25 밤 `CF_Heal`·`CF_Kneel_Loop` — 술사 PeasantGirl 의 Mixamo `Heal`·`Kneel` 자리. 도발 `Taunt` 는 Mixamo 원본이 `Sword And Shield Idle To Block` 이라 `CF_Shield_Block` 이 맡는다 → **게임이 쓰는 Mixamo 동작 종류는 전부 공방 후보가 있다**). 헤엄·물 위·점프는 UAL(`Swim_Fwd_Loop`·`Swim_Idle_Loop`·`Jump_Start`). 함정 둘: ① 열쇠 사이는 쿼터니언 성분별 보간이라 앞 열쇠와 부호가 반대면 사이 프레임이 먼 길로 돈다(활 쏘기 한 프레임 84°) — 열쇠마다 부호를 맞춘다 ② 팔(0.547m)·다리 길이 밖 목표는 IK 가 곧게 펴 멈춘다 — 점검이 목표 오차를 찍는다. Regular·Teen 몸은 무료판에 없다 → 비율은 셰이프·뼈 길이로 만든다.

> 유료판(Pro·Source)도 CC0 이다. 무료판에 빠진 동작이 필요하면 사는 게 가장 싸다 — **결정은 사용자 몫**(§8).

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

## 7. 교체 순서

| 단계 | 할 일 | 끝났다는 기준 |
|---|---|---|
| 0 ✅ | 도구 뼈대: `build.py` · `verify.py` · `bonemap.json` · `sources.json` · `fetch_sources.py`, 무료판 팩 받기 | **통과(2026-09-24)** `_test_toon_01`: 뼈 65·삼각형 17,966·동작 44·빌드 41초. verify(파일 기준) glb 팔다리 0.0°·땅 0cm, fbx 0.7°·2.7mm. `.glb` 는 두 번 뽑아 sha256 이 같다. `.fbx` 는 Blender FBX 익스포터가 메모리 주소 순서로 돌아 바이트가 매번 달라 내용 검증(verify)으로 갈음한다. Godot 4.7 빈 프로젝트 임포트 오류·경고 0(`_Loop` 는 Godot 가 떼고 반복으로 표시 → `Idle`·`Walk`). Unity 6000.3 빈 프로젝트 FBX Humanoid 아바타 valid·human, 클립 44, 스킨 메시 4 |
| 1 ✅ | **동작 먼저 바꾼다**(로컬 전용이라 다른 PC 가 막혔다) | **통과(2026-09-24, saga-godot)** `bake_for_rig.py` → VRoid 셋 `J_Bip_*` 52뼈 × 여덟 동작, verify 0.0°·0cm(뒤돌아 있는 saga_forest_avatar_01 은 원본을 180° 돌려 굽는다) → `saga-godot/tools/ual_lib_build.gd` → `anim_cc0/*_lib.res`(커밋, 자체 확인 ≤ 0.10°) → `probe_anim_cc0.gd` 3/3 · godot_regress 통과. saga-unity 동작은 몸과 함께 단계 3 에서(Mixamo 인물마다 몸·동작이 한 벌) |
| 2 ⏳ | saga-godot 몸: VRoid 셋(`AvatarSample_A`·`saga_forest_avatar_01`·`dungeon_hero_01`) → 툰 레시피 | **판정 대기(2026-09-25)** `_cmp_go_01`(순찰자 여)·`_cmp_forest_01`(농부 여)·`_cmp_dungeon_01`(순찰자 남) → `saga-godot/assets/characters_cf/`. verify 0.0°·0cm, 목 가림 0.957·1.0·0.988, 6~10MB. 비교 장면 `tools/compare/CharCompare.tscn`(같은 해·env_pc·cel_toon·키 1.70m). 기준 = 사람이 "못하지 않다"고 한 짝만 게임에 넣는다(§8-1) |
| 3 ⏳ | saga-unity 몸: Mixamo 인물·괴물(§9) → PBR 레시피. **첫 짝 판정 대기(2026-09-25)**: `_cmp_real_hero_f_01`(주역 여 — 동양 0.8·운동복·말총머리) → `saga-unity/Assets/Art/CharactersForge/`. 13초 빌드·뼈 53·삼각형 4만·텍스처 ≤2048, verify fbx 0.7°·2.6mm · glb 0.0°·0mm, 두 번 빌드 glb 같은 바이트. 빈 Unity 6000.3 프로젝트: Humanoid 아바타 valid(뼈 52 자동), 클립 8 전부 Humanoid, 정점당 뼈 ≤4. 비교 장면 빌더 `Saga/Char Forge/Build Compare Real Scene`(지금 Maria | 공방, 같은 빛·키 1.70m·동작 저절로) — 빈 URP 프로젝트와 saga-unity 배치 둘 다 통과(검사 `BuildAndVerifyBatch` → `CMP_RESULT`). **괴물 첫 짝 둘(09-25)**: `_cmp_real_goblin_01`(키 1.32m·뾰족 큰 귀·큰 코·파우누스 얼굴·초록 피부·허리 천) · `_cmp_real_brute_01`(2.55m·근육 최대·돼지 코·튀어나온 턱·붉은 잿빛·굽은 뿔·허리 천), verify fbx 0.27°·0.55° · glb 0.0°, 결정성 같은 바이트. 비교 장면이 짝 셋(Maria·Goblin·Brute, 짝마다 키 1.70·1.25·2.40m)으로 늘었고 saga-unity 배치 `CMP_RESULT OK`. **숲 괴물 셋(09-25)**: `_cmp_real_warrok_01`(무쇠도깨비·STORY 소환 자리 — 정수리 외뿔·엄니·긴 팔·짧은 다리·구부정한 목·잿빛 푸른 피부) · `_cmp_real_parasite_01`(포자괴물 — 마른 몸·긴 손가락·꺼진 배·민머리·누런 초록·등 포자 혹 16) · `_cmp_real_nightshade_01`(안개유령 — 마른 여자·긴 머리·창백한 푸른 피부·해진 옷자락, 옷자락 속 다리 없음). verify fbx ≤ 0.31° · glb 0.0°, 두 번 빌드 같은 바이트, 부품 뿌리가 살에 0.3~2.3mm, 유령 옷자락 뚫림 서기 1.4%(쓰러짐 36% — 게임은 서기만 쓴다). 비교 장면 짝 여섯(키 1.75·1.60·1.60m, 지금 Nightshade 는 서기 하나뿐) saga-unity 배치 `CMP_RESULT OK`. 정직한 예상: 괴물은 사람 몸 비틀기라 Mixamo 의 조각한 괴물보다 못할 수 있다(§8-1) — 특히 Warrok 의 털·Parasite 의 찢긴 살 결은 없다. **바위도깨비·잎 옷 요정(09-25)**: `_cmp_real_rockgiant_01`(Hulk 자리 — 땅딸막한 거구·무거운 눈두덩·주름진 잿빛 돌 피부·모난 바위 판 26·이끼빛 허리 천, 뿔 없음) · `_cmp_real_fairy_01`(Jolleen 자리 — 숲 정령 셋·STORY 전직관이 같은 몸: 가는 젊은 여자·길고 뾰족한 귀·큰 눈·단발·옅은 풀빛·허벅지까지 톱니 잎 옷, 옷 무게 = 가장 가까운 살). 잎 옷 뚫림(그 방향 끝단 위만 셈) 서기 0.8%·걷기 9%·달리기 31% — 달리기에 두 허벅지가 앞뒤로 벌어지면 한쪽만 따라가 찢기는 몫이라 천 시뮬레이션 없이는 못 없앤다. 비교 장면 짝 여덟 `CMP_RESULT OK`. **해골(09-25)**: `_cmp_real_skeleton_01`(Skeleton 자리 — GO 들판·던전·마을 무리) — 사람 몸 비틀기가 아니라 `skeleton.py` 가 MPFB 뼈대 자리와 살 단면을 재서 **뼈를 코드로 짓는다**: 팔다리 긴뼈(양 끝 굵은 관, 아래팔·종아리 두 가닥)·손목·손바닥·손가락·발목·발허리·발가락뼈 · 척추(등 살에서 허리 6.5·가슴 5.8·목 4.8cm 안, 가시·가로돌기) · 갈비 열둘 짝(빗장뼈 높이부터, 몸통 단면을 줄인 타원·앞으로 내려가 복장뼈에) · 골반(엉덩뼈 날개 판·엉치뼈·두덩 고리·절구·넙다리뼈 머리·큰돌기) · 어깨뼈 판 · 두개골(머리 살을 떼어 목 구멍을 메우고 귀를 눌러 붙이고 눈구멍을 2.7cm 파고 코를 눌러 코구멍, 입술을 이 뒤로 — 판 곳은 어두운 `socket` 칸, 이가 앞에서 69% 보인다). 조각마다 뼈 하나에 무게 1(굳은 뼈라 늘어남이 없다), 난수 없음. 점검(원래 살 안에 드는가, 뼈별): 밖 2.6~3.6% 는 새끼손가락 끝·정강이·발가락뿐, 좌우 대칭 평균 0.08mm. 마른 몸에서 살 밖으로 나오는 골반 날개·어깨뼈·큰돌기는 그 높이 몸 단면(좌우 접은 각도 18칸)의 안쪽으로 끌어들인다(`into`). 함정: 가운데 줄 정점이 성긴 높이가 있어(가슴 1.28m 는 가운데 3cm 안에 등 정점이 없었다) 좁은 창으로 재면 척추뼈가 가슴 앞에 선다 — 앞뒤가 다 잡힐 때까지 창을 키운다. verify fbx 0.53°·glb 0.0°, 두 번 빌드 같은 바이트. 정직한 예상: 뼈 결·관절 모양은 조각한 Mixamo 해골보다 단순하다(판정 몫).
**사람 동행 셋(09-25) — 껍데기 옷 `shell`**: `_cmp_real_paladin_01`(동행 무사 Paladin 자리 — 붉은 누비옷·가죽 장갑·장화·쇠 가슴판·어깨판·팔·정강이 가리개·허벅지 드림·얼굴 트인 투구) · `_cmp_real_mage_f_01`(동행 술사 PeasantGirl 자리 — 땋은 머리·흰 저고리·가슴 위에서 발목까지 쪽빛 치마·가죽 신) · `_cmp_real_archer_f_01`(STORY 유격 Archer 자리 — 풀빛 몸 옷·가죽 조끼·팔 가리개·장갑·장화·두건). 삼각형 4.3~4.5만(다른 공방 몸 4.0만), verify fbx ≤ 0.54°, 두 번 빌드 같은 바이트, 치마 뚫림 서기 0.2%·걷기 6%·달리기 34%. 지금 Archer 는 활·화살 메시가 붙어 있고 공방 유격은 맨손이다(무기는 따로). 비교 장면 짝 열둘 `CMP_RESULT OK`. 피부는 Maria 와 같은 FakeSSS — `BuildMariaSssShaderGraph.BuildGraph(path, "_BaseMap")` 로 피부 그림을 바탕색에 이은 `Assets/Art/CharactersForge/Generated/ForgeSkin.shadergraph`(09-25). saga-unity 배치에서 `CMP_RESULT OK`(두 몸 1.700m·발 y=0·동작 8·공방 피부 ForgeSkin+그림). 괴물은 같은 몸에 비율 극단값 + kitbash(뿔·갑옷·버섯갓) **두목 여섯(09-25)**: `_cmp_real_ninja_01`(황건 살수 Ninja — 먹빛 몸 옷·감발·두건 위 복면·누런 머리띠) · `_cmp_real_morak_01`(황건 두목 Morak — 우람한 맨팔·누런 두건·허리띠·가죽 조끼·흙빛 바지·청동 팔찌) · `_cmp_real_ganfaul_01`(능묘지기 Ganfaul — 크고 마른 늙은 몸·잿빛 피부·두건·발목 도포·검은 쇠 어깨판) · `_cmp_real_demon_01`(층 주인 Demon — 검붉은 거구·길게 말린 뿔·뾰족 귀·작은 엄니·검은 쇠판·허리 천, Brute 와 안 겹치게) · `_cmp_real_aliensoldier_01`(기계화 정찰병 Alien Soldier — 먹빛 몸 옷·잿빛 쇠판 온몸·닫힌 투구·앞 청록 바이저, 투구 속 눈썹·속눈썹·이는 빼고 눈은 저폴리 — 4.9만 → 3.9만) · `_cmp_real_maw_01`(망루 수호장 Maw — 가장 큰 살찐 몸·잿빛 보라·아래로 튀어나온 큰 턱·긴 엄니·녹슨 가슴판·어깨판). 삼각형 3.8만~4.6만, verify fbx ≤ 0.7°·2.7mm · glb 0.0°, 두 번 빌드 같은 바이트(무사·술사도 그대로). 복면 띠 안 앞 살 정점 = 윗가장자리 53 뿐, 머리띠·복면 360°, 바이저 앞 반. 도포 뚫림(끝단 위 다리 살 중 옷자락 밖, 동작마다 6 프레임) 서기 7.6%·걷기 32%·달리기 66% — **같은 잣대로 잰 술사 치마 20%·28%·70%** 와 같거나 낫다(09-25 이전 기록 0.2%·6%·34% 는 측정 스크립트가 안 남아 정의를 못 맞춘다; glTF 로 다시 열면 동작이 NLA 트랙에 다 켜져 겹쳐 도니 트랙을 떼고 잴 것). 가로 줄 14 → 28 은 나아지지 않았다(서기 12.7%). 비교 장면 짝 열여덟 saga-unity 배치 `CMP_RESULT OK`(몸 서른여섯). **GO 세 시대 아홉(09-25)**: 들판 적 `_cmp_real_gasmask_01`(방독면 약탈자 — 국방색 윗옷·두건·검은 고무 방독면·유리 눈알·등 짐) · `_cmp_real_copzombie_01`(떠도는 망자 — 꺼진 볼·잿빛 초록 피부·반소매 남색 제복·챙 모자) · `_cmp_real_exored_01`(강철 경비병 — 붉은 쇠판·넓은 어깨판·얼굴 트인 투구, 정찰병과 안 겹치게), 역참 사람 `_cmp_real_tourist_01`(여행자 — 흰 반소매·청바지·주황 배낭) · `_cmp_real_courier_f_01`(택배 기사 — 말총머리·누런 챙 모자·밤빛 겉옷) · `_cmp_real_patrol_01`(순찰 대원 — 남색 제복·검은 조끼·챙 모자) · `_cmp_real_surveyor_01`(탐사 대원 — 흰 판·흰 투구·청록 눈 띠·등 짐틀) · `_cmp_real_mechanic_01`(수리 기사 — 땅딸막·주황 작업복·연장 띠·이마 보안경) · `_cmp_real_chrononaut_f_01`(시간 여행자 — 긴 머리·쪽빛 긴 겉옷자락·놋쇠 팔 가리개·이마 놋쇠 띠). 삼각형 4.0만~4.9만, verify fbx ≤ 0.55° · glb 0.0°, 두 번 빌드 같은 바이트. 모자 높이 머리카락이 모자 밖 0%(말총머리 251 중 1), 이마 띠 350~360°, 겉옷자락 뚫림 서기 6.8%·걷기 28%·달리기 71%(다리 살이 옷 껍데기에 덮여 지워진 몸은 그 껍데기를 다리로 잰다). 비교 장면 짝 스물일곱 saga-unity 배치 `CMP_RESULT OK`(몸 쉰넷). **DUNGEON 세 시대 여덟(09-25)**: 잡졸 `_cmp_real_rioter_01`(폭주 청년 — 붉은 두건 윗옷·검은 복면·청바지) · `_cmp_real_testbot_01`(시험 기동 인형 — 온몸 흰 쇠·얼굴 없는 투구·주황 눈 띠 한 바퀴) · `_cmp_real_riotswat_01`(진압 특공대 — 먹빛 전투복·두꺼운 조끼·어깨·무릎 받이·투구·어두운 가리개) · `_cmp_real_steelbot_01`(강철 인형 병정 — 검은 쇠 온몸·덧판·붉은 눈 띠) · `_cmp_real_enforcer_01`(암흑가 해결사 — 검은 양복·흰 셔츠 앞섶·검은 안경) · `_cmp_real_visitor_01`(별 너머 방문자 — 큰 머리·큰 눈·잿빛 초록 피부·더듬이 둘·은빛 몸 옷), 행상 `_cmp_real_junkpeddler_01`(고물 행상 — 늙은 남자·납작 모자·목도리·등에 큰 짐) · `_cmp_real_timepeddler_f_01`(시간 행상 — 단발·보랏빛 긴 겉옷자락·은빛 띠·등 짐틀). 삼각형 3.2만~4.5만, verify fbx ≤ 0.55° · glb 0.0°, 두 번 빌드 같은 바이트. 두 쇠 인형은 껍데기가 살을 다 덮어 살 메시가 없다 — 비교 검사는 해골(뼈 칸)처럼 쇠 칸으로 통과시킨다. 복면 앞 남은 살 63점(윗가장자리), 긴 겉옷자락 뚫림 서기 20%·걷기 39%(술사 치마와 같은 몫). 짝 서른다섯 saga-unity 배치 `CMP_RESULT OK`(몸 일흔). **남은 사람 NPC 열일곱(09-25) — Mixamo 사람 자리 끝**: STORY 적 `_cmp_real_rider_01`(폭주 라이더 — 검은 가죽 재킷·붉은 풀페이스 헬멧·검은 가리개) · `_cmp_real_crashdummy_01`(충돌 시험 인형 — 온몸 노란 합성수지·검은 마디 띠, 얼굴 없음) · `_cmp_real_warzombie_01`(전장 망자 — 잿빛 보라 피부·국방색 전투복·녹슨 철모) · `_cmp_real_starguest_01`(별바다 손님 — 쪽빛 피부·뾰족 귀·뒤로 누운 뿔·금빛 판) · `_cmp_real_punk_f_01`(뒷골목 불량배 — 여·단발·자홍 비니·가죽 조끼·맨팔) · `_cmp_real_plasma_01`(플라즈마 변이체 — 자줏빛 우람한 몸·청록 혹 22) · `_cmp_real_merc_01`(용병 — 모래빛 전투복·국방 방탄 조끼·검은 모자) · `_cmp_real_colossus_01`(강철 거신 2.27m — 푸른 무쇠·놋쇠 판·호박빛 눈 띠), STORY 사람 `_cmp_real_phototourist_f_01`(민트 바람막이·흰 반바지·선글라스) · `_cmp_real_chrononaut_02`(남·곱슬 머리·연보라 몸 옷·은 목 고리·청록 빛 띠) · 정찰병 `_cmp_real_scout_01`(삼베 저고리·감발·검은 머리띠), FOREST `_cmp_real_sentry_01`(사슬 갑옷·쪽빛 겉옷판·둥근 투구) · `_cmp_real_pilgrim_01`(붉은 두건·흰 긴 옷자락·붉은 망토깃) · `_cmp_real_courier_02`(땅딸막·풀빛 제복·반바지·등 짐) · `_cmp_real_photographer_f_02`(검은 목폴라·모래빛 긴 코트 자락·검붉은 베레모) · `_cmp_real_goldexo_f_01`(먹빛 몸 옷·금빛 외골격·이마 금 띠) · `_cmp_real_castaway_f_01`(하늘빛 비행복·흰 가슴판·등 생존 짐). 이미 있는 공방 몸과 역할이 겹치는 자리(떠도는 망자·시험 인형·시간 여행자·택배 기사·사진사)는 색만 아니라 실루엣·옷·머리·성별로 가른다. 삼각형 3.0만~5.2만, verify fbx ≤ 0.55° · glb 0.0°, 두 번 빌드 같은 바이트, 키는 짝 키 ±1.5%(위 §3 키 맞추기). 충돌 시험 인형은 살이 다 덮여(밖에서 보이는 살 0점) 비교 검사가 합성수지 칸(`_plastic`, Unity 매끈함 0.5)을 받는다. 옷자락 뚫림(끝단 위 다리) 순례 기사 서기 0%·걷기 16% · 사진작가 코트 2.6%·23% — `measure_shape.py` 가 발목 몇 점만 남은 살 대신 다리 정점이 가장 많은 옷 껍데기(바지)로 재게 고쳤다(전엔 0/0 으로 헛돌았다). 모자 밖 머리카락 2~6%, 이마 띠·머리띠 360°. 짝 쉰둘 saga-unity 배치 `CMP_RESULT OK`(몸 104). **GO 인물 105 몸 여덟 + Abe(09-25)**: `_cmp_real_blackknight_01`(Dreyar — 검게 칠한 판금·얼굴 트인 투구·검붉은 등 망토 판) · `_cmp_real_castleguard_02`(밤빛 가죽 갑옷·국방 누비·목 사슬·쇠 투구) · `_cmp_real_furchief_01`(Heraklios — 두꺼운 털 망토·두건·가죽 조끼) · `_cmp_real_martialist_01`(Brady — 흰 무도복·검은 띠·맨발) · `_cmp_real_suit_01`(Joe — MakeHuman 정장·중절모·구두, 껍데기 아닌 system assets 옷) · `_cmp_real_swordmaiden_f_01`(Kachujin — 다홍 민소매·톱니 짧은 치마·이마 금 띠) · `_cmp_real_hoodedcloak_f_01`(Arissa — 청록 두건·발목 옷자락·놋쇠 목 고리) · `_cmp_real_leatherknight_f_01`(Eve — 가죽 갑옷·은 어깨판·상아빛 겉옷판) · `_cmp_real_brawler_01`(Abe — 맨상체·붉은 허리띠·손에 감은 천). verify fbx ≤ 0.55° · glb 0.0°, 두 번 빌드 같은 바이트, 키 짝 ±1.5%, 옷자락 뚫림 두건 망토 22%·39%(시간 행상과 같은 몫)·무희 치마 16%·13%. 짝 예순하나 saga-unity 배치 `CMP_RESULT OK`(몸 122). | `CharactersRealistic/` 에 기대는 코드가 0 이 되고, 없는 PC 용 도형 대체도 필요 없어진다 |
| 4 ⏸ | 인물 명단 → 레시피 대량 생성(도감 `id` 마다) | 인물마다 실루엣이 다르다(키·체격·머리·옷 네 축 중 둘 이상) — **도구만 끝·보류(2026-09-26)**: `gen_hero_recipes.py`(saga-unity GO 도감 105, 두 축 미만 쌍 0 · 키 5칸·체격 4·머리 18·옷 22) + `calib_height.py`(목표 키 ±0.3%) → 105벌 빌드 실패 0(로컬 `_out/hero/`, 커밋 안 함). 눈으로 보니 옷이 문턱 미달(§8-1 09-26)이라 게임엔 안 넣는다. 옷 방식이 바뀌면 생성기의 `outfit_parts` 만 갈아 다시 뽑는다 · **다음 세션 순서(09-26)**: ① ✅ `garments.py` 옷 스물둘(일본 기모노·하카마·구소쿠·가부토·에보시, 삼국 장수 갑옷·투구·면류관, 단령·곤룡포·사모·익선관·복두) ② ✅ 세력 색 변형(`<id>@<헥스>`) ③ ✅ `gen_hero_recipes.py` 의 `real_outfit`·`real_head` — 동쪽 세 나라는 옷 틀·머리를 공방 옷(세력 색)으로, 서쪽은 CC0 가 맞는 틀만(가죽 = 바이킹 윗옷·바지·장화, 윗옷 = 미케네 튜닉, 승려 = 수도복), 나머지는 껍데기 그대로 — 105 중 몸 껍데기 없는 사람 64 → 서쪽·세계 옷 열하나를 더해 **99**(남은 여섯 = 부족 전사 허리 천 둘·동쪽 윗옷 둘·서쪽 짧은 옷 둘), 서쪽 투구는 CC0(코린트·템플러). `py gen_hero_recipes.py --garments` 가 지을 옷 인자를 모아 준다(`garments.py -- all $(…)`). 결과(09-26): 공방 옷 63벌(기본 22 + 세력 색 41, 14분) → 105벌 빌드 실패 0(39분, 로컬 `_out/hero/`). 비교 렌더에서 무장이 `Sword_Idle` 로 서면 옷자락이 무너져 무장 대기를 `CF_Guard_Idle_Loop` 로 바꿨다. ④ ⏳ **사용자 판정 대기** — `render/render_pairs.py` 로 Mixamo 와 나란히(09-26 그림은 그 세션 스크래치패드라 새 세션은 다시 뽑는다: 짝 예 CastleGuard02↔hero_kr_yisunsin · Uriel↔hero_wd_suleiman · Pelegrini↔hero_eu_caesar · Kachujin↔hero_jp_murasaki). 판정에서 통과한 옷 틀만 게임 몸 교체 후보로(D5 — 지금은 Mixamo 유지). **새 PC·새 세션에서 다시 뽑기**: 공방 옷·`_out/hero/` 는 gitignore 라 `garments.py -- all $(py tools/char-forge/gen_hero_recipes.py --garments | tr ' ' '
' | grep @)` (26분) → 105벌 `build_real.py` 루프(50분). **09-26 셋째(껍데기 넷·맨머리 열다섯)**: 옷 틀 일곱 더해 **옷 마흔** — 한국 `tunic` = `baeja`(바지저고리 위 민소매 배자) · 일본 `tunic` = `kamishimo`(어깨 날개 견의 + 같은 빛 하카마) · 서유럽 `robe_short` = `doublet`(허벅지 윗옷·부푼 어깨 소매·긴 양말바지) · 서역 `robe_short` = `qaba`(무릎 겉옷·헐렁한 바지) → **105 중 103 진짜 옷**(남은 둘 = 부족 허리 천, 그대로). 동쪽 옛 남자의 짧은 머리(short01~04, 근대 옷·부족 빼고 열다섯)는 머리카락 메시 대신 `sangtu`(빗어 올린 머리·망건·상투, 한국) · `sangtu_bun`(속발, 삼국) · `chonmage`(사카야키·존마게, 일본), 나이 0.75 이상은 센머리 `@77736c`. 새 부품 `hairdome`(머리 속 한 점에서 쏜 광선이 맞은 살 + 법선 여유, 머리선 높이 둘레마다, `open` = 민 자리) · `mage` · 망건 `tight` · 무늬 `sleek`. 렌더로 다섯 번 고친 함정: ① `head_cy` 는 얼굴 점이 많아 앞으로 4.5cm 쏠린다 — 머리 부품 중심은 머리 앞뒤 한가운데로(존마게가 이마 위에 뿔로 섰고, 정수리 가까이 앞 광선이 머리를 비껴 접시가 생겼다) ② 뒤통수 정점은 1.5cm 넘게 성겨 **점으로 반지름을 재면** 면 사이를 놓쳐 살 속으로 든다 — 면에 광선(BVH, 헬퍼 뺀 `body` 면) ③ 높이마다 수평 고리 + 타원 뚜껑은 넓은 뒤 정수리를 파고든다 → 구면 광선 ④ 입힌 몸은 나이·몸무게 모프로 뒤통수가 불룩해져 맞춤이 7mm 까지 못 따라간다 → 덮개 밑 두피를 지움 무리(`cf_delete`, 머리선에서 0.1 rad 안쪽·귀 남김)에 ⑤ 'hair' 무늬는 뜨개 모자처럼 보인다 → `sleek`. 도감 105 레시피 두 축 미만 쌍 0 그대로(19명 바뀜) · **그다음 할 수 있는 일**: ④ 판정(위) · 긴 옷 뒤 불룩(천 시뮬레이션 없이는 어렵다 — 가랑이 아래 좌우 무게 평균은 실패) · 가미시모 어깨 날개가 몸통에서 떠 보인다 · 존마게 옆머리 앞 끝이 모나다 |
| 5 ✅ | **상용 문턱**: `tools/asset-audit` 에 출처 검사를 추가한다. 빌드에 들어가는 파일 중 `*.license.json` 이 없거나 Mixamo·VRoid 출처가 있으면 🔴 — **도구 끝(09-25)**: 종류 `origin`(🔴)·`origin_left`(🟡). VRoid 는 D4 로 godot 몸 정본이 돼 VRM 메타의 상업·재배포 허가로 판정한다. `PYTHONIOENCODING=utf-8 py -3 tools/asset-audit/audit.py --track godot --track unity --no-md5` 요약 줄 "출처(인물·동작)". **09-25 수치**: godot 🔴 0(통과 — Mixamo 는 `_mixamo_src/`·`characters_vroid/anim/` 에 로컬로만 남고 게임은 `anim_cc0/` 를 쓴다, VRoid 셋은 상업·재배포 허가지만 저작자 표시 필요 🟡) · unity 🔴 282(Mixamo 몸 61 — 같은 날 공방 후보 없던 아홉 Abe·GO 인물 105 몸 여덟도 지어 **61 전부 후보 있음**, 🔴 는 판정 뒤 게임 몸 교체로 준다) | **D5(2026-09-26) 기준으로 통과**: 🔴 = 공개 저장소에 오른(또는 .gitignore 가 안 막는) Mixamo·막힌 VRoid·license 없는 공방 몸. Mixamo 로컬 전용은 🟡`origin_local`(게임 판매 OK). 09-26 수치: godot 🔴0 · unity 🔴0(🟡local 282) · web 🔴public 0 |

## 8. 사람 몫 · 결정

- **팩 받기**: Quaternius 무료판은 itch.io 에서 받는데, 페이지가 JS 로 그리는 SPA 라 받기 버튼을 사람이 눌러야 할 수 있다
  (`ASSET_GUIDE.md` 09-13 에 같은 일이 있었다). 받으면 `Downloads` 에 두면 된다 — 세션이 먼저 거기부터 찾는다.
결정(2026-09-24 사용자):

- **D1 무료판만 쓴다.** 무료판에 빠진 동작은 자체 키프레임(§4 마지막 줄)으로 채운다.
- **D2 얼굴 = 툰 얼굴·실제 얼굴 둘 다.** 레시피에 `face: toon|real` 축을 둔다. 트랙마다 한 스타일 규칙(`SAGA-DESIGN.md` §6.0-1)은 그대로다 —
  saga-godot 는 `toon`, saga-unity 는 `real`. 한 화면에 두 얼굴을 섞지 않는다.
- **D3 Unity 는 FBX(Humanoid) 로 간다**(사용자가 "좋은 쪽으로" 맡김). 까닭: 지금 코드(`MixamoRigUtil`·`CharacterVisual`·Humanoid Avatar)가
  그대로 받아서 바꿀 코드가 가장 적다. Humanoid 리타겟은 Unity 에서 FBX 쪽이 가장 오래 검증됐다. Blender FBX 내보내기로 셰이프키·뼈를 둘 다 옮길 수 있다.
  glTFast 는 셰이프키·재질은 좋지만 Humanoid Avatar 를 따로 만들어 줘야 한다. Godot 은 `.glb` 그대로.

- **D4 saga-godot 몸 = VRoid 직접 디자인(2026-09-25 사용자)**. 공방 툰 몸 셋을 비교해 보니 "얼굴이 원신 같은 애니 캐릭터가 아니다" · "구시대 서양인 캐릭터" —
  무료 CC0 팩 얼굴의 한계라 옷·머리를 바꿔도 안 된다. 선택지(외주·구매·AI 3D·코드 애니 얼굴) 중 VRoid 직접 디자인을 골랐다.
  AI 3D 는 애니 얼굴이 아직 뭉개지고, Hunyuan3D 라이선스는 **한국이 적용 지역에서 빠져 있어** 못 쓴다.
  `_cmp_*` 몸·`CharCompare.tscn` 은 남겨 둔다(새 VRoid 주역을 지금 몸과 나란히 볼 때 다시 쓴다).

- **D5 unity 몸 = Mixamo 유지, 공개 저장소 밖(2026-09-26 사용자 "1번으로")**. Mixamo 약관은 게임에 넣어 파는 것은 허용하고 **재배포만** 막는다 —
  걸림돌은 Mixamo 가 아니라 공개 저장소였다. 원본은 처음부터 `saga-unity/.gitignore`(`Assets/Art/CharactersRealistic/`)·웹 `.gitignore` 로 막혀 있어 이력에도 없다.
  그래서 상용 문턱(§7 단계 5)은 "게임이 Mixamo 를 쓰지 않는다"가 아니라 "공개 저장소에 없다"다. 다른 PC 는 `tools/mixamo_automation` 으로 다시 받는다(로그인만 사람 몫).
  저장소 전체를 비공개로 돌리지 않는 까닭: 웹 다섯 판이 이 저장소의 GitHub Pages 라 비공개면 유료 요금제가 든다. 유료 인물 팩도 재배포 금지라 같은 벽이다.
  공방 unity 몸(`_cmp_real_*` 61 짝·도감 105)은 후보로 남기되 **교체하지 않는다** — 09-26 눈으로 본 결과(§8-1).

## 8-1. 그래픽 — 지금과 같나 (정직한 예상)

| 트랙 | 지금 | 공방 첫판 | 따라잡으려면 |
|---|---|---|---|
| godot 툰 | VRoid(삼각형 약 3만, 사람이 다듬은 머리·얼굴 그림) | 셰이더·빛·외곽선은 **같다**(`cel_toon` 그대로). 몸 비율도 비슷하게 된다. **머리카락·얼굴 그림은 첫판이 VRoid 보다 못하다** — VRoid 가 가장 잘하는 두 가지다 | 머리 다발 모양 수를 늘리고, 얼굴 데칼을 VRoid 급 선(눈 하이라이트·속눈썹 겹)으로 다듬는다 |
| unity 실사 | Mixamo 인물(오래된 게임 급 텍스처) | MPFB 사실 몸·CC0 스킨이라 **피부·몸은 같거나 낫다**(Maria 에 쓴 `FakeSSS` 를 그대로 붙인다). 헤어카드는 지금 없던 걸 새로 얻는다. **괴물(Warrok·Goblin 류)은 첫판이 못하다** — 조각한 모델을 비율 조정 + 부품으로 따라가기 어렵다 | 괴물은 Rigify 뼈 + 전용 조형(뿔·피부 결 노멀)을 따로 짠다 |

**09-26 처음 눈으로 봄**(사용자 "직접 확인해봐" — Blender Eevee, Mixamo | 공방 같은 빛·같은 키 1.70m): 얼굴(MakeHuman)은 사실적이고 괜찮다 · MakeHuman 양복(clothes)도 괜찮다. 그러나 **껍데기 옷(`shell`)은 몸에 붙은 쫄쫄이·플라스틱**(가장자리 톱니, 쇠 투구는 수영모, 금관은 머리 위 접시) · **`robe` 는 울퉁불퉁한 통에 살이 뚫고 나온다** · 괴물(Goblin·Warrok)은 초록·갈색 맨몸 사람이다 — 모두 Mixamo 보다 확연히 못하다. 그동안 통과한 수치(CMP_RESULT OK·verify 각도·땅·measure)는 이것을 못 잡았다. → 옷을 진짜 옷 메시로 바꾸기 전엔 짝을 더 찍지 않는다. 함정: Blender glTF 가져오기는 피부를 BLEND 로 둬서 이·눈이 얼굴 위에 그려진다(피부·옷 알파를 끊고 머리카락·눈썹·속눈썹·눈만 알파).

**09-26 진짜 옷 메시 시험**(같은 렌더): 바이킹 사슬 윗옷·바지·장화·수염, 긴 드레스, 수도복·두건은 Mixamo 마을 사람과 견줄 만하다 — 껍데기보다 확연히 낫다. 못한 것: 기모노(분홍 목욕가운), 전사 투구(붉은 가시). **빈칸 = 동양 역사 옷(한복·한푸·사무라이 갑옷)** — CC0 에 없다(도감 105 중 동양 68). → 다음 = 공방이 옷 메시를 지어 MPFB `create_mhclo_from_clothes_matching`·`write_mhclo` 로 `.mhclo` 를 만들어 입힌다(어느 체형에나 맞는다).

**09-26 셋째 — 현대 NPC 껍데기 15 → CC0 진짜 옷**(`_cmp_real_*` 61 중 껍데기 51, 그 가운데 현대 사람부터): 여행자·택배 기사 둘·순찰 대원·떠도는 망자·해결사·고물 행상·용병·폭주 청년·사진 여행자·불량배·수리 기사·방독면 약탈자·전장 망자·폭주 라이더. 흰 티·청바지·스웨터·폴로·양복·멜빵 작업복·겉옷 캐주얼·카고 바지·장화·장갑·M1 철모·풀페이스 헬멧(옷장 126 썸네일로 골랐다). 머리 껍데기(모자·복면·가리개·안경)는 그대로, 몸통 부품(배낭·조끼·연장 띠·목도리·무릎 받이)은 **옷 면을 본뜬 껍데기**(`src`). Mixamo 짝과 나란히 렌더: 청바지·티·양복·털깃 겉옷은 Mixamo 와 견줄 만하다 — 껍데기 쫄쫄이와 다른 물건이다. 함정: `male_casualsuit02·04·06` 티셔츠 그림에 **MAKEHUMAN 로고**(무늬 없는 `elvs_crude_t-shirt_male` 로) · `cortu_jeans_shorts` 는 남자 몸에서 속옷처럼 짧다 · `jujube_newsboy_cap` 은 `.mhclo` 에 `material` 줄이 없어 재질이 안 붙는다 · `male_casualsuit03` 줄무늬 셔츠는 사무직으로 보인다 · 색은 곱하기라 **회색·흰 바탕 옷에만** 먹는다(빨간 스웨터·파란 작업복은 그 색) · 티 밑단과 바지 허리가 같은 깊이라 얼룩 띠(남은 흠). 변환 스크립트는 스크래치패드 몫이었고 결과 레시피가 정본. **saga-unity `Assets/Art/CharactersForge/` 의 FBX 는 아직 옛 껍데기 판**이다 — 다른 세션 Unity 가 안 돌 때 §3 "짝 하나 더하는 순서" ⑥~⑧ 로 바꿔 넣는다. 다음 = 남은 껍데기 36(갑옷·미래 판·옛 옷 — 판금은 CC0 SF 갑옷 셋·사슬, 옛 옷은 garments.py).

**09-26 넷째 — 옛 옷 사람 열 → 공방 옷**(남은 껍데기 36 가운데 옛 옷 사람): 정찰병 = 삼베빛 바지저고리 · 무도 수행자 = 흰 바지저고리·검은 띠 · 술사 = 쪽빛 치마·흰 저고리(`hanbok_f`, 옛 `robe` 통 치마 대신) · 황건 살수 = `shinobi` · 동행 무사 = 붉은 찰갑·둥근 투구 · 황건 두목 = 새 틀 `baji_vest`(바지·맨팔 가죽 조끼·허리 천) + 누런 `turban` · 성 경비 = 국방 `warrior_robe`·둥근 투구 · 성 파수병 = 쪽빛 `hauberk` + 새 틀 `helmet_round`(둥근 쇠 투구·사슬 목가리개) · 순례 기사 = 흰 `hauberk`·붉은 단 · 맨몸 잡졸 = 새 틀 `baji`(바지·허리 천). `garments.py` 틀 서른여섯 → 서른아홉. 빌드 열 실패 0 · verify fbx·glb 실패 0(팔다리 ≤ 0.7°·땅 ≤ 2.7mm) · 두 번 빌드 sha256 같음. 렌더로 고친 함정: ① **넓은 옷 위 옷 면 껍데기(`src`)는 그 옷을 본떠 흰 통으로 부푼다** — 넓은 바지 위 감발, 소매 위 팔 가리개, 장화 위 쇠 정강이 모두 지웠다(허리띠처럼 몸에 붙은 옷 위만 쓸 것) ② 치마·자락 있는 무장(찰갑·전포·사슬 겉옷)과 맨상체 바지도 `Sword_Idle` 넓은 다리에선 자락이 벌어지고 가랑이가 처져 대기를 `CF_Guard_Idle_Loop` 로 ③ 맨살 위 바지는 통 윗단이 턱으로 보인다 → 허리 천을 윗단 높이에 넓게 ④ 공방 천 두건(투구 사발 + 목가리개 틀)은 깃을 벌리면 양동이 모자, 좁히면 얼굴 옆에 판이 선 상자 — 살 껍데기 두건(사슬 두건 모양)보다 못해 틀을 지웠다. 두건·후드는 빈칸(Mixamo 망토 두건이 확연히 낫다). 남은 흠: 찰갑·전포 어깨 뒤 살 비침 한 점 · 치마저고리 치마가 넓은 삼각(틀 그대로) · 닌자 팔 감발이 네모. saga-unity FBX 는 아직 옛 판(§3 ⑥~⑧, Unity 쉴 때). 다음 = 남은 껍데기 26 — 미래 판금·몸 옷(외계 병사·강철 경비·금빛 외골격·탐사 대원·불시착 탐사원·시간 여행자 둘·시간 행상·진압 특공대 → CC0 SF 갑옷 셋·bodysuit·skinsuit·galactic uniform), 옛 가죽·털(유격·가죽 기사·털 대장·검은 판금 기사·두건 망토·여무사·사진작가), 인형·괴물(강철 인형·시험 인형·충돌 인형·거신·해골·변이체·별 손님·방문자 — 살이 없는 몸이라 껍데기가 맞을 수 있다).

**09-26 다섯째 — 미래 사람 아홉 → CC0 SF 옷**: 외계 병사 = 먹빛 skinsuit·잿빛 염색 헬리오스 판금·닫힌 헬멧 · 강철 경비 = bodysuit·붉게 곱한 헬리오스 · 금빛 외골격 = skinsuit·금빛 주피터 · 탐사 대원 = 흰 우주 제복(galactic uniform)·가디언 팔 가리개·장화 · 불시착 탐사원 = 하늘빛 염색 bodysuit·가디언 · 시간 여행자(남) = 연보라 염색 skinsuit·가디언 · 시간 여행자(여) = 쪽빛 `kaftan`·놋쇠 단 · 시간 행상 = 보랏빛 `qaba` · 진압 특공대 = bodysuit·검게 염색한 주피터(가슴·허리·어깨·무릎·장화) — 판금 셋은 CC0(matcreator), 장갑·장화 culturalibre·toigo. 빌드 아홉·verify fbx·glb 실패 0 · sha256 같음. 렌더로 고친 함정: ① `joachip_cyborg_suit` 는 각진 회색 상자로 보여 안 쓴다 ② 몸 옷 위 조끼·받이 껍데기(`src`)는 고무 덩어리 — 판금 옷으로 ③ 몸 옷 위 흰 가슴판 껍데기는 가장자리 톱니(지움) ④ 은빛 단 `#b8bec6` 은 흰 털처럼 보인다(`#7a8088`). 남은 흠: 판금 셋은 같은 틀이라 외계 병사·강철 경비·진압 특공대 실루엣이 비슷하다(색·머리로 가름, Mixamo 원본 셋도 닮았다) · 닫힌 헬멧 아래 목 앞 살 · 시간 여행자(여) 긴 옷이 옛 옷처럼 보인다(설계대로). 다음 = 남은 껍데기 17 — 옛 가죽·털(유격·가죽 기사·털 대장·검은 판금 기사·두건 망토·여무사·사진작가), 인형·괴물(강철 인형·시험 인형·충돌 인형·거신·변이체·별 손님·방문자·두목 셋) — 살이 없는 인형은 판금 염색으로 시험해 볼 수 있다.

**09-27 여섯째 — 남은 껍데기 17 → 진짜 옷(몸 껍데기 0)**: 유격 = 짙은 풀빛 염색 skinsuit·가죽 장갑·밤빛 무릎 장화(heroine 장화) · 가죽 기사 = 밤빛 염색 heroine 몸 옷·긴 장갑·허벅지 장화 · 털 대장 = 바이킹 사슬 윗옷·가죽 치마·바지·털 장화 · 검은 판금 기사 = 검게 염색한 바이킹 사슬 윗옷·바지·가디언 판·장화 · 두건 망토 = 청록 염색 수도복·**진짜 두건 메시**(donitz hood) · 여무사 = 다홍 염색 민소매·층 치마·검은 바지·긴 장갑 · 사진작가 = 모래빛 염색 더블 정장 · 강철 인형 = 먹빛 skinsuit·잿빛으로 곱한 헬리오스 · 시험 인형 = 흰 skinsuit · 충돌 인형 = 노란 skinsuit·마디 띠(`src`) · 강철 거신 = 푸른 무쇠 skinsuit·놋쇠빛으로 곱한 주피터 · 변이체 = 먹빛 가죽 바지 · 별바다 손님 = 먹보라 skinsuit·금빛 가디언 · 방문자 = 은빛 skinsuit · 층 주인 = 새 틀 `guards`(어깨판·팔 가리개·정강이) · 능묘지기 = 보랏빛 `dopo` · 망루 수호장 = 새 틀 `breastplate`(가슴판·어깨판). 인형 머리·눈 띠·투구·두건·띠·베레모 껍데기는 그대로. `garments.py` 틀 +2(`breastplate`·`guards`) + 소매 `start`(팔 가리개, 없으면 칸 수 예전 그대로 — 찰갑 다시 지어 .obj·.mhclo md5 같음). 렌더로 버린 것(함정): ① **공방 틀은 몸에 붙는 옷을 못 짓는다** — 새로 지은 판금 온몸·유격복·가죽 기사·몸 옷 위 가슴판·다리 판·무릎 외투(officer_coat 트렌치)가 모두 자루·상자처럼 부풀었다(통 둘레가 볼록하게 메워진다). 넓은 옷·맨몸 위 판(guards·breastplate)만 쓸 만하다 ② 짙은 색 `=#` 염색은 결이 거친 그림(bodysuit·헬리오스·털 단 장화)을 털처럼 만든다 → 몸 옷은 skinsuit, 금속은 곱하기 색 ③ `culturalibre_male_boots` 는 털 단이 있다(인형은 `culturalibre_hero_boots_2`) ④ `toigo_fisherman_sweater` 는 여자 몸에서 체형(근육·비율)을 바꿔도 가슴·어깨뼈 살이 뚫는다(같은 옷의 `_cmp_real_courier_f_01` 도 볼 것) ⑤ skinsuit 발은 해적 장화를 뚫는다(heroine·hero 장화는 된다) ⑥ 바지 위에 무릎 장화면 장화 끝이 무릎으로 비친다 ⑦ 털 망토처럼 윗옷 면 껍데기(`src`)로 부피 있는 걸 만들면 풍선. 남은 흠(빈칸): 가죽 기사 은 어깨판·상아빛 겉옷판, 검은 기사 등 망토, 유격 가죽 조끼, 사진작가 목폴라, 별바다 손님 금빛 가슴판 · 가죽 기사 몸 옷이 레오타드 선처럼 보인다 · 판금 옷이 SF 셋뿐이라 인형·판금 사람 실루엣이 겹친다. 빌드 17·verify fbx·glb·sha256 은 saga-unity HISTORY 09-27 절.

**09-27 일곱째 — 빈칸 채우기(tube `arc`)**: `garments.py` 통에 `arc`(가운데 도, 폭 도) — 앞(270°)·뒤(90°) 한쪽만 두르는 판, 판 옆으로 살이 보여 안 지운다(기존 옷은 그대로 — 찰갑 md5 같음). 새 틀 `cape`(어깨~종아리 뒤 170°, 아래로 넓어짐)·`pauldrons`(쇠 어깨판만) → 검은 판금 기사 등 망토 · 가죽 기사 은 어깨판. 앞뒤 겉옷판(tabard)은 앞치마처럼 보이고 가슴에 홈이 패여 틀을 지웠다. 남은 빈칸: 가죽 기사 겉옷판·유격 가죽 조끼·사진작가 목폴라·별바다 손님 가슴판.

**새 세션 순서 — 껍데기 → 진짜 옷(09-26 넘김, 09-27 몸 껍데기 0 — ①~⑥ 은 새 짝을 더할 때의 순서로 남긴다)**: "vroid 자체툴 이어해" = 이 일. ① 남은 껍데기 찾기: `recipes/_cmp_real_*.json` 중 `clothes` 가 없거나 kitbash `shell` 이 `src` 없이 몸 무리(`pelvis`·`spine_0*`·`thigh_*`·`calf_*`·`upperarm_*`·`lowerarm_*`)를 덮는 것 — 09-27 에 0. 괴물 열하나(brute·goblin 등)는 몸 껍데기가 없어 대상 아님 ② 옷 고르기: CC0 옷장(`_blender/.../mpfb/data/clothes/<이름>/<이름>.thumb` 을 한 장에 모아 본다) + `garments.py` 틀(없으면 틀을 더한다, 색 변형 `<id>@<헥스>,…`) — 검은 옷은 `tints` 염색 `=#헥스` ③ 레시피 바꾸기: 몸 껍데기 지우고 `clothes`·`_garments`·`tints`, 머리 껍데기(투구·띠·복면)는 그대로, 몸통 부품은 **몸에 붙은 옷 위에서만** `src`(넓은 옷 위면 흰 통으로 부푼다), `_note` 끝에 "09-26 진짜 옷(…)" — 스크립트는 스크래치패드, 결과 레시피가 정본 ④ `garments.py -- <인자들>` → `build_real.py --check` → `render/render_pairs.py`(Mixamo 짝)·`render_turn.py`(네 방향)·`render_heads.py` 로 보고 고치기 — 치마·자락·맨상체 바지는 대기 `CF_Guard_Idle_Loop` ⑤ `verify.py`(fbx·glb, `--map mpfb --clips` = 레시피 anims)·`measure_shape.py`·두 번 빌드 sha256 ⑥ 이 절(§8-1)과 saga-unity HISTORY 에 한 절, `git commit -F <메시지> -- <경로>`. 공방 옷·`_out/` 은 gitignore 라 새 PC 는 레시피의 `_garments` 를 모아 `garments.py` 를 먼저 돌린다. 그 뒤: saga-unity `CharactersForge` FBX 를 새 판으로(§3 ⑥~⑧) — **09-27 끝**(61벌 로컬 전용·`CMP_RESULT OK`) → HOW_TO_PLAYTEST §9 사용자 판정(대기).

**교체 문턱(규칙)**: 새 모델은 **지금 것보다 못하지 않을 때만** 자리를 바꾼다. 같은 장면·같은 빛에서 둘을 나란히 두고, 그 판정은 실기 확인 때 사용자가 한다.
그때까지 지금 모델이 남는다. 그래서 화질이 떨어지는 구간은 생기지 않는다. 동작(§7 단계 1)은 모양이 아니라 움직임이라 이 문턱이 가볍다.

## 9. 지금 Mixamo·VRoid 가 쓰이는 자리 (2026-09-24 조사, 교체 대상)

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
