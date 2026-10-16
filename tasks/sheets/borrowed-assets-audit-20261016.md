# 빌린 에셋 남은 것 — 재고 조사 2026-10-16 (자체툴 세션, 사용자 "에셋 생성은 다한거임? 완벽하지 않아서 더 확인해줘")

방법: `git ls-files` 세 트랙 에셋 전부 → ① 옆 `license.json`·`saga-assets/credits.json` 묶음 자리·정본과 md5 같음 = 자체 ② 이름·폴더에 팩 이름(kenney·quaternius·kaykit·polyhaven·oga·polypizza·mixamo·standin…) = 빌림 ③ 웹은 파일 이름이 코드(js·html·json)에 나오는지로 쓰임/안 쓰임. 이름 일치라 "쓰임"엔 대체용(fallback)도 섞인다.

## 끝난 것(자체 생성)
2D 인물·초상·표정·움직이는 초상·아이콘·지도 아이콘·UI·VFX·하늘·BGM 160·효과음 368·목소리 2356·몬스터 3D(TRELLIS 225)·VRoid 조합 인물·2D 대역 14풀(K-0112)·자체 PBR 12(K-0093). 세계 GLB(장비·괴물·실내·들·무기·자연·마을·소품·건물·탈것 ≈1800 파일)는 **형태는 코드지만 재질이 Poly Haven 사진** → 아래 1.

## 남은 빌린 것
| # | 무엇 | 어디 | 규모 | 상태 |
|---|---|---|---|---|
| 1 | Poly Haven 재질 사진 29종(세계 GLB 의 결) | 정본 world·regions ≈940 · 고돗 ≈810 · 유니티 ≈400 · 웹 shared ≈530 파일 | 큼 | **끝 K-0113 10-16**(polyhaven 0) |
| 2 | 웹 3D 사람 — OpenGameArt `oga_ultimate`·`oga_knight` 43 · poly.pizza `polypizza_*` 47 · KayKit 모험가 5 · `universal_base` 2 | 2나락 `models/people` | 97 GLB, **쓰임** | 티켓 없음 |
| 3 | 웹 3D 사람 — Quaternius RPG 6 | 다섯 판 `models/people/quaternius_rpg` | 30 GLB, 쓰임 | 티켓 없음 |
| 4 | 웹 3D 괴물 — Quaternius·cute·2 · KayKit 해골 | 2나락 40 · 5천하 14 | 54 GLB, 쓰임 | 티켓 없음 |
| 5 | 웹 3D 건물·나무·바위·소품·산(Quaternius 저폴리 묶음) | 다섯 판 `models/{buildings,nature,props}` | ≈190 GLB, 쓰임 | 수신함 10-14(2나락 킷 소품) 일부 |
| 6 | 웹 사진측량 스캔 — Poly Haven 나무·바위·통나무·탑, Sketchfab 우물·장터·사당·굴·폐허·청더 사원·탑 폐허 | `models/*/realistic` | ≈45 GLB, 쓰임 | 티켓 없음 |
| 7 | CC-BY 표기 필요 7건(Poly by Google 동물, 헬멧 둘, 망토, 슬라임, Quaternius 마법사·병사, Hazmat) + 그 모델로 구운 2D | 2나락·3마을·5천하 ASSET_LICENSES | 7 | 수신함 10-11 |
| 8 | 1만리 효과음 7(OpenGameArt RPG Sound Pack·100 CC0 SFX) | `saga-go/assets/audio/sfx` | 7, 쓰임(이름) — 자체 효과음과 md5 다름 | 티켓 없음 |
| 9 | 안 쓰는 옛 파일 — Kenney 사람 30(2나락)·Kenney 집 조각 13(3마을)·`people/regular` 9×5·`people/anime` 대부분·`sprites2d` 대부분(Kenney·EverFace·nonemo 초상) | 웹 다섯 판 | ≈500 | **지우기만** — 티켓 없음 |
| 10 | 유니티 — Poly Haven 스캔 소품 `Art/Props/PolyHaven` 181 · 재질 `Art/Environment/PBR` 27 · Quaternius 식물 9 · Kenney 효과음 6 · 짐승 Fox·Snake·Birb(출처 확인 필요) · LiberationSans | `saga-unity/Assets` | ≈230 | Kenney 소리는 수신함 10-12 |
| 11 | 고돗 — **Quaternius Stylized Nature 68(`assets/vegetation`·`rocks`, 씬 배치됨)** · **KayKit 무기 4(`assets/weapons`)** · 옷장 VRoid `AvatarSample_A` 96(공식 샘플, 허용판 교체는 K-0088 사람 몫) · 던전 문틀 Kenney 모양(K-0089) · 나무 정육면체 잎·괴물 다면체·섬·방(수신함 10-13) | `saga-godot/assets` | — | 수신함 |
| 12 | 글꼴(OFL Noto·Nanum·Liberation)·Lucide 아이콘(1만리 `js/icon.js`) | 웹·유니티 | — | 수신함 10-10 남은 몫 |
| 13 | 옛 몸 렌더 밑그림 AI 그림 49 — 몬스터 초상 32·탈것 용 1·RTS 건물 7·도시 9 | portraits-monster·mount·web2d/rts·world/sprite | 49 | **끝 10-16**(+ 5천하 성 3) |
| 14 | char-forge 옷 결 사진(Poly Haven, `tools/char-forge/sources.json` "polyhaven") | 인물 공방 | 출하물 0(유니티 `Art/CharactersForge` 는 license 166 만 남고 몸은 이미 지움) | 도구만 — 남은 license 정리 |

## 추천 순서(R-0 가 티켓으로)
① K-0113(재질 — 세 트랙 공통, 가장 큼) ② 9 지우기(W, 위험 0) ③ 2·3·4 웹 사람·괴물 → 자체 몸(VRoid 조합·world-forge 괴물·TRELLIS 몸 이미 있음, W 배선) ④ 5·6 웹 건물·자연 → world-forge 세트(K-0113 뒤) ⑤ 10 유니티 ⑥ 8·12.
