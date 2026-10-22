# 크레딧·라이선스

> `tools/asset-audit/credits.py` 가 자동 생성한다. 손으로 고치지 않는다.

## 필수 표기 (저작자 표시)

- AvatarSample_A — pixiv VRoid Project (VRM `creditNotation: required`)
- © Poly by Google, CC-BY 3.0 <https://creativecommons.org/licenses/by/3.0/> — Bear.glb("Black bear"), Boar.glb, Crane.glb("Sandhill crane"), Elephant, Elephant (`models/standin/Elephant.glb`), Elephant.glb, Mesh_Crow.gltf+.bin, Tex_Crow.webp, Monkey.glb, Owl.glb, Paint Brush, Panda.glb, Tiger.glb
- © CreativeTechLab, CC-BY 3.0 — Helmet, helmet
- © Michael Fuchs, CC-BY 3.0 — Viking Helmet, gapju(대역: Viking Helmet)
- © (개인 업로더, poly.pizza), CC-BY 3.0 — cape
- © Charlie, CC-BY — Slime Enemy, community/SlimeEnemy.glb
- © Quaternius, CC-BY 3.0 — Animated Wizard, Soldier(2번째 개체)
- © Charlie, CC-BY 3.0 — Hazmat Man

### 사람이 확인할 표기 줄(자동으로 이름·라이선스를 못 가름)

- © Quaternius. 한 번들 안에 CC0 5종·CC-BY 5종이 섞여 있다(페이지에서
- | `models/weapons/brush.glb` | **CC-BY 3.0**(Poly by Google) | `assets/models/weapons/brush.glb` |
- | `models/gear/viking_helmet.glb`(`gapju` 대역) | **CC-BY 3.0**(Michael Fuchs) | `assets/models/gear/viking_helmet.glb` |
- Slime Enemy — © Charlie, CC-BY(`poly.pizza/m/6O6XUMssAW`). 이

## 만든 방식·모델별 묶음

| 도구 | 모델 | 라이선스 | 개수 |
|---|---|---|---|
| music-gen | ACE-Step/Ace-Step1.5 (acestep-v15-turbo) | MIT (code and model weights) | 160 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 forest-field.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 story-battle.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 story-field.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 story-town.ogg 를 mp3 로 옮김) | 1 |
| bake_for_rig.py --map vroid (vroid_batch.sh anim 단계, 2026-10-07) | - | CC0-1.0 (뼈대+동작만 — 메시·그림 없음. 동작 원본 Quaternius Universal Animation Library CC0 + 자체 키프레임 too | 1 |
| mocap_retarget.py (K-0139·K-0161) + keyframes.py | - | CMU Graphics Lab Motion Capture Database — 복사·수정·재배포 허가 불요(상업 포함, mocap.cs.cmu.edu FAQ) ·  | 1 |
| mocap_retarget.py (K-0139) | - | CMU Graphics Lab Motion Capture Database — "may be copied, modified, or redistributed with | 3 |
| outfit_swap.py + vroid_batch.sh + web_share_textures.py (K-0024) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 2000 |
| sprite_plan_16.json) + gear_sprites.py + weapon_attach.py (K-0138 16방향, 몸·무기는 8방향과 같음) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 20 |
| outfit_swap.py + vroid_batch.sh + web_share_textures.py (K-0024)) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 1000 |
|  에서 옮긴 같은 파일(K-0078, 유니티 vroid-bodies 원본 자리) | - | VRoid Studio 공식 샘플 이용 조건: 상업 사용·개작본 재배포 허용, 크레딧 불필요(VRM 메타 확인) | 26 |
|  에서 옮긴 같은 파일(K-0078, 유니티 vroid-bodies 원본 자리) | - | VRoid Studio 로 만든 VRM — 출처·조건은 고돗 원 자리와 같다(K-0018 배치, saga-assets/CREDITS.md VRoid 절) | 2 |
| gen.py | Illustrious-XL-v2.0 | CreativeML OpenRAIL-M — 상업 사용 가능(저자 HF 토론 2025-04, 2026-10-07 확인), 폐쇄 파생 모델 수익화만 금지 | 589 |
| competitiongen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 21 |
| gen.py | animagine-xl-4.0-opt | CreativeML OpenRAIL++-M | 1699 |
| remote3d | microsoft/TRELLIS-image-large | MIT | 502 |
| icon_pack.py | none | CC0-1.0 (코드 생성 — 글꼴 글리프·색 견본, 외부 그림 없음) | 76 |
| gen.py (ComfyUI) | animagine-xl-4.0-opt | CreativeML OpenRAIL++-M | 1839 |
| make_ui_icons.py | none | CC0-1.0 (코드 생성 — 24격자 기하 도형, 외부 그림·Lucide 경로 없음) | 112 |
| k163_illust.py + gen.py (ComfyUI, Kaggle 원격) | animagine-xl-4.0-opt | saga 자체 생성 — 상업 허용 모델(animagine-xl-4.0-opt, CreativeML OpenRAIL++-M) · 밑그림 = 자체 3D 몸 렌더(VR | 30 |
| gen.py (ComfyUI) | z-image-turbo | Apache-2.0 | 141 |
| make_map.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 195 |
| build_monster.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 346 |
| raritygen.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 60 |
| region_hero.py | - | CC0-1.0 (자체 생성 형태, 재질은 단색·CC0) | 12 |
| region_hero.py | - | CC0-1.0 (배치표 — 자체 생성 데이터, 조각·재질은 각각 CC0) | 12 |
| region_hero.py (HERO_SKY 파노라마 굽기) | - | CC0-1.0 (자체 생성) | 30 |
| region_hero.py(자료 정리) | - | 자체 생성 — Z-Image-Turbo(Apache-2.0) 견본 → pbr_from_albedo.py (K-0093·K-0113), 남의 사진 0 | 36 |
| build_prop.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 108 |
| build_building.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0)) | 105 |
| build_vehicle.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 37 |
| region_hero.py village | - | CC0-1.0 (배치표 — 자체 생성 데이터, 조각·재질은 각각 CC0) | 3 |
| sfxset.py | - | CC0-1.0 (코드 합성 — 외부 입력 없음) | 280 |
| sfxmoss.py(시작점·길이 맞춘 판으로 채점) | OpenMOSS-Team/MOSS-SoundEffect-v2.0 | Apache-2.0 (모델·코드) — AI 생성, 원작 효과음 모사 없음 | 88 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_ui_notify.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_victory.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_sword_hit_1.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_levelup.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_ui_open.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 자체 소리 sfx_coin_big.ogg 를 mp3 로 옮김) | 1 |
| k117_audio.py | - | CC0-1.0 (자체 — 코드 합성 천둥, 외부 입력 없음) | 1 |
| make_sky.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 30 |
| make_ibl.py | Illustrious-XL-v2.0 | 자체 하늘 그림(saga-assets/sky/sky_noon_present.webp)에서 코드로 — 그 그림의 라이선스를 따른다 | 3 |
| beast2d_rebake.py --sheets (Blender render_sheet.py, Idle·Run 4컷) | - | CC0-1.0 (자체 3D 몸 렌더 — 외부 입력 없음, 몸 출처는 creatures3d license) | 11 |
| beast2d_rebake.py (Blender render_sprite.py) | - | CC0-1.0 (자체 3D 몸 렌더 — 외부 입력 없음, 몸 출처는 creatures3d license) | 103 |
| pet2d_k120.py (Blender render_sprite.py 옆모습, K-0114 맞춤) | - | CC0-1.0 (자체 3D 몸 렌더 — 몸 출처는 pets3d license) | 17 |
| factory.py (K-0158 2D 공장, Blender + style_pass) | - | MIT(TRELLIS)·자체 뼈대 동작 — 자체 렌더 | 1 |
| factory.py (K-0158 2D 공장, Blender + style_pass) | - | VRoid 샘플 이용 조건(상업·개작 허용)·CC0 동작 — 자체 렌더 | 9 |
| gen.py (ComfyUI) | Illustrious-XL-v2.0 | CreativeML OpenRAIL-M (저자 HF 토론 2025-04: 상업 가능, 폐쇄 파생 모델 수익화만 금지) | 10 |
| face_sdf_bake.py (K-0151 — Blender, VRoid 얼굴 살갗 UV 위 원신식 그림자 문턱 계산 굽기) | - | MIT | 2 |
| compress.mjs | - | CC0-1.0 (형태·뼈·동작 전부 코드, 외부 입력 없음) | 1 |
| uigen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 285 |
| k130_unity_pbr.py | - | self-pbr: rock (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0) | 2 |
| k130_unity_pbr.py | - | self-pbr: stonewall (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0 | 1 |
| k130_unity_pbr.py | - | self-pbr: paving (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0) | 1 |
| k130_unity_pbr.py | - | self-pbr: planks (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0) | 1 |
| k130_unity_pbr.py | - | self-pbr: dirt (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0) | 1 |
| k130_unity_pbr.py | - | self-pbr: grass (자체 생성 PBR — Z-Image-Turbo Apache-2.0 견본 → pbr_from_albedo.py, 남의 사진 0) | 1 |
| vfxgen.py | - | CC0-1.0 (코드 생성 — 외부 입력 없음) | 120 |
| voiceplan.py | Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign · Qwen/Qwen3-TTS-12Hz-1.7B-Base | Apache-2.0 (모델·코드) — 목소리는 글 설명으로 만든 것, 실존 인물·배우 목소리 모사 없음 | 2356 |
| cutout_parts.py (Blender 옆모습 부위 렌더 + 무기 부위) | - | MIT | 4 |
| make_realm_ui.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 12 |
| make_realm_ui.py | - | CC0-1.0 코드 배치 + 글꼴 SIL OFL-1.1 (Nanum Brush Script·Noto Serif KR) | 56 |
| make_realm_ui.py woff2 | - | SIL Open Font License 1.1 (OFL-NotoSerif.txt) | 2 |
| gen.py | sd_xl_base_1.0 | CreativeML OpenRAIL++-M | 50 |
| rtsgen.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 36 |
| rtsai.py transitions | - | CreativeML OpenRAIL++-M — 코드 합성(경계 마스크) + 고른 AI 타일 rts_forest_floor_1 (sd_xl_base_1.0) | 24 |
| rtsai.py transitions | - | CreativeML OpenRAIL++-M — 코드 합성(경계 마스크) + 고른 AI 타일 rts_hill_1 (sd_xl_base_1.0) | 24 |
| rtsai.py transitions | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) — 코드 합성(경계 마스크) + 고른 AI 타일 rts_water_1 (-) | 24 |
| edge_tiles.py --pairs (코드 합성 — 새 그림 없음, GPU 안 씀) | z-image-turbo | 원본 두 장의 라이선스를 따른다(자체 AI 생성 — 상업 허용 모델) · 합성 코드는 이 저장소 것 | 7 |
| edge_tiles.py --pairs (코드 합성 — 새 그림 없음, GPU 안 씀) | sd_xl_base_1.0, z-image-turbo | 원본 두 장의 라이선스를 따른다(자체 AI 생성 — 상업 허용 모델) · 합성 코드는 이 저장소 것 | 1 |
| edge_tiles.py --pairs (코드 합성 — 새 그림 없음, GPU 안 씀) | - | 원본 두 장의 라이선스를 따른다(자체 AI 생성 — 상업 허용 모델) · 합성 코드는 이 저장소 것 | 3 |
| edge_tiles.py --pairs (코드 합성 — 새 그림 없음, GPU 안 씀) | sd_xl_base_1.0 | 원본 두 장의 라이선스를 따른다(자체 AI 생성 — 상업 허용 모델) · 합성 코드는 이 저장소 것 | 7 |
| ground_tile.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 8 |
| water_tile.py | - | CC0-1.0 (코드로 그린 그림 — 외부 입력 없음) | 4 |
| retile_uv.py --unit 4.4 (K-0089) | - | CC0-1.0 (Kenney Modular Cave Kit gate.glb 모양 그대로 + 자체 상자 투영 UV) | 2 |
| foliage_atlas.py | - | 자체 생성(Z-Image-Turbo Apache-2.0 출력, 상업 허용) — 남의 사진·스캔 0 | 1 |
| build_foliage.py | - | 자체 생성 — 형태는 전부 코드, 결은 자체 아틀라스(Z-Image-Turbo 출력 · foliage_atlas.py) | 14 |
| build_nature_real.py | - | CC0-1.0 자체 생성 — 형태는 코드, 잎은 자체 아틀라스(foliage_atlas.py), 줄기·바위는 자체 PBR(K-0093·K-0113) | 28 |
| build_field.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 242 |
| build_kit.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 48 |
| build_village.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 552 |
| build_isle_real.py | - | CC0-1.0 (형태는 코드, 결은 자체 PBR K-0093·K-0113) | 4 |
| build_terrain.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 높이맵은 전부 코드 — 값 잡음 fbm + 모양 함수 + 간단한 침식) | 70 |
| build_equip.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 435 |
| build_interior.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 260 |
| build_nature.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 150 |
| build_weapon.py | - | CC0-1.0 (재질 전부 자체 PBR(K-0093·K-0113, 남의 사진 0), 형태는 전부 코드) | 155 |
| build_real.py | - | CC0-1.0 (입력 전부 CC0 — MPFB 코드는 GPL 이지만 만든 모델에는 걸리지 않는다) | 166 |
| make_k167_marks.py | none | CC0-1.0 (코드 생성 — 24격자 기하 도형, 외부 그림·이모지 그림 없음) | 25 |
| gen.py | Illustrious-XL-v2.0 | CreativeML OpenRAIL-M (HF 태그, 버전별 재확인 필요) | 5 |

## VRoid 샘플

35벌 사용(개작본 재배포 허용·상업 허용). VRM 이용 조건상 상업·개작본 재배포 허용인 샘플(대부분 pixiv VRoid Project). 직접 만든 모델은 표에 있어도 만든 이 본인 것. restricted = 배치된 VRM 메타가 개작본 재배포를 허용하지 않음 — 원본 그대로만 쓴다(조합·변주 재료 금지).
- 원본 그대로만: AvatarSample_A (`AvatarSample_A.glb`, modification `allowModification`)
- 원본 그대로만: AvatarSample_T (`avatar_sample_t.glb`, modification `allowModification`)

## 출처 문서(ASSET_LICENSES·ASSET_GUIDE) 요약

절 232개 — 라이선스 낱말별: CC0 159, Kenney(CC0) 37, CC-BY 26, OpenRAIL 15, MIT 14, Mixamo 9, Apache-2.0 3, GPL 2, OFL 2
낱말을 못 찾은 절(미상) 47개 — `credits.json` 의 `doc_sections.unknown` 참고.

