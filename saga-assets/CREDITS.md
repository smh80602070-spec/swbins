# 크레딧·라이선스

> `tools/asset-audit/credits.py` 가 자동 생성한다. 손으로 고치지 않는다.

## 필수 표기 (저작자 표시)

- AvatarSample_A — pixiv VRoid Project (VRM `creditNotation: required`)
- © Poly by Google, CC-BY 3.0 <https://creativecommons.org/licenses/by/3.0/> — Bear.glb("Black bear"), Boar.glb, Crane.glb("Sandhill crane"), Elephant, Elephant (`models/standin/Elephant.glb`), Elephant.glb, Mesh_Crow.gltf+.bin, Tex_Crow.webp, Monkey.glb, Owl.glb, Paint Brush, Panda.glb, Pond, Tiger.glb, fan · brush(공유), rabbit.png · duck.png
- © CreativeTechLab, CC-BY 3.0 — Helmet, helmet
- © Michael Fuchs, CC-BY 3.0 — Viking Helmet, gapju(대역: Viking Helmet)
- © (개인 업로더, poly.pizza), CC-BY 3.0 — cape
- © Charlie, CC-BY — Slime Enemy, community/SlimeEnemy.glb
- © Quaternius, CC-BY 3.0 — Animated Wizard, Soldier(2번째 개체)
- © Charlie, CC-BY 3.0 — Hazmat Man

### 사람이 확인할 표기 줄(자동으로 이름·라이선스를 못 가름)

- | **라이선스** | **CC-BY 3.0** — 저작자 표시 필요 |
- © Quaternius. 한 번들 안에 CC0 5종·CC-BY 5종이 섞여 있다(페이지에서
- | `models/weapons/brush.glb` | **CC-BY 3.0**(Poly by Google) | `assets/models/weapons/brush.glb` |
- | `models/gear/viking_helmet.glb`(`gapju` 대역) | **CC-BY 3.0**(Michael Fuchs) | `assets/models/gear/viking_helmet.glb` |
- Slime Enemy — © Charlie, CC-BY(`poly.pizza/m/6O6XUMssAW`). 이

## 만든 방식·모델별 묶음

| 도구 | 모델 | 라이선스 | 개수 |
|---|---|---|---|
| music-gen | ACE-Step/Ace-Step1.5 (acestep-v15-turbo) | MIT (code and model weights) | 160 |
| bake_for_rig.py --map vroid (vroid_batch.sh anim 단계, 2026-10-07) | - | CC0-1.0 (뼈대+동작만 — 메시·그림 없음. 동작 원본 Quaternius Universal Animation Library CC0 + 자체 키프레임 too | 1 |
| outfit_swap.py + vroid_batch.sh + web_share_textures.py (K-0024) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 2000 |
| outfit_swap.py + vroid_batch.sh + web_share_textures.py (K-0024)) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 799 |
|  에서 옮긴 같은 파일(K-0078, 유니티 vroid-bodies 원본 자리) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 26 |
|  에서 옮긴 같은 파일(K-0078, 유니티 vroid-bodies 원본 자리) | - | VRoid Studio 로 만든 VRM — 출처·조건은 고돗 원 자리와 같다(K-0018 배치, saga-assets/CREDITS.md VRoid 절) | 2 |
| gen.py | Illustrious-XL-v2.0 | CreativeML OpenRAIL-M — 상업 사용 가능(저자 HF 토론 2025-04, 2026-10-07 확인), 폐쇄 파생 모델 수익화만 금지 | 594 |
| competitiongen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 21 |
| gen.py | animagine-xl-4.0-opt | CreativeML OpenRAIL++-M | 1755 |
| remote3d | microsoft/TRELLIS-image-large | MIT | 8 |
| icon_pack.py | none | CC0-1.0 (코드 생성 — 글꼴 글리프·색 견본, 외부 그림 없음) | 76 |
| gen.py (ComfyUI) | z-image-turbo | Apache-2.0 | 36 |
| make_map.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 195 |
| build_monster.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 335 |
| gen.py (ComfyUI) | animagine-xl-4.0-opt | CreativeML OpenRAIL++-M | 42 |
| raritygen.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 60 |
| region_hero.py | - | CC0-1.0 (자체 생성 형태, 재질은 단색·CC0) | 12 |
| region_hero.py | - | CC0-1.0 (배치표 — 자체 생성 데이터, 조각·재질은 각각 CC0) | 12 |
| region_hero.py (HERO_SKY 파노라마 굽기) | - | CC0-1.0 (자체 생성) | 30 |
| region_hero.py(자료 정리) | - | CC0-1.0 (Poly Haven, https://polyhaven.com/license) | 36 |
| build_prop.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 108 |
| build_building.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0) | 105 |
| build_vehicle.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 37 |
| region_hero.py village | - | CC0-1.0 (배치표 — 자체 생성 데이터, 조각·재질은 각각 CC0) | 3 |
| sfxset.py | - | CC0-1.0 (코드 합성 — 외부 입력 없음) | 280 |
| sfxmoss.py(시작점·길이 맞춘 판으로 채점) | OpenMOSS-Team/MOSS-SoundEffect-v2.0 | Apache-2.0 (모델·코드) — AI 생성, 원작 효과음 모사 없음 | 88 |
| make_sky.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 30 |
| make_ibl.py | Illustrious-XL-v2.0 | 자체 하늘 그림(saga-assets/sky/sky_noon_present.webp)에서 코드로 — 그 그림의 라이선스를 따른다 | 3 |
| uigen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 285 |
| vfxgen.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 120 |
| voiceplan.py | Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign · Qwen/Qwen3-TTS-12Hz-1.7B-Base | Apache-2.0 (모델·코드) — 목소리는 글 설명으로 만든 것, 실존 인물·배우 목소리 모사 없음 | 2356 |
| make_realm_ui.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 12 |
| make_realm_ui.py | - | CC0-1.0 코드 배치 + 글꼴 SIL OFL-1.1 (Nanum Brush Script·Noto Serif KR) | 56 |
| make_realm_ui.py woff2 | - | SIL Open Font License 1.1 (OFL-NotoSerif.txt) | 2 |
| gen.py | sd_xl_base_1.0 | CreativeML OpenRAIL++-M | 72 |
| rtsgen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 36 |
| rtsai.py transitions | - | CreativeML OpenRAIL++-M — 코드 합성(경계 마스크) + 고른 AI 타일 rts_forest_floor_1 (sd_xl_base_1.0) | 24 |
| rtsai.py transitions | - | CreativeML OpenRAIL++-M — 코드 합성(경계 마스크) + 고른 AI 타일 rts_hill_1 (sd_xl_base_1.0) | 24 |
| rtsai.py transitions | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) — 코드 합성(경계 마스크) + 고른 AI 타일 rts_water_1 (-) | 24 |
| retile_uv.py --unit 4.4 (K-0089) | - | CC0-1.0 (Kenney Modular Cave Kit gate.glb 모양 그대로 + 자체 상자 투영 UV) | 2 |
| build_terrain.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 높이맵은 전부 코드 — 값 잡음 fbm + 모양 함수 + 간단한 침식) | 70 |
| build_equip.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 435 |
| build_village.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 90 |
| build_interior.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 260 |
| build_nature.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 120 |
| build_field.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 240 |
| build_kit.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 30 |
| build_weapon.py | - | CC0-1.0 (재질 사진 전부 Poly Haven CC0, 형태는 전부 코드) | 135 |
| build_real.py | - | CC0-1.0 (입력 전부 CC0 — MPFB 코드는 GPL 이지만 만든 모델에는 걸리지 않는다) | 166 |
| gen.py | Illustrious-XL-v2.0 | CreativeML OpenRAIL-M (HF 태그, 버전별 재확인 필요) | 10 |

## VRoid 샘플

35벌 사용(개작본 재배포 허용·상업 허용). VRM 이용 조건상 상업·개작본 재배포 허용인 샘플(대부분 pixiv VRoid Project). 직접 만든 모델은 표에 있어도 만든 이 본인 것. restricted = 배치된 VRM 메타가 개작본 재배포를 허용하지 않음 — 원본 그대로만 쓴다(조합·변주 재료 금지).
- 원본 그대로만: AvatarSample_A (`AvatarSample_A.glb`, modification `allowModification`)
- 원본 그대로만: AvatarSample_T (`avatar_sample_t.glb`, modification `allowModification`)

## 출처 문서(ASSET_LICENSES·ASSET_GUIDE) 요약

절 261개 — 라이선스 낱말별: CC0 190, Kenney(CC0) 39, CC-BY 29, Mixamo 11, OpenRAIL 10, MIT 8, GPL 2, OFL 1
낱말을 못 찾은 절(미상) 48개 — `credits.json` 의 `doc_sections.unknown` 참고.

