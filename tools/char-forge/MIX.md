# 12. 조합 변형 (K-0072, 사람 디자인 0)

샘플 VRM 의 머리카락·체형을 코드로 섞는다(얼굴은 안 만든다, 고르기는 판정기). 몸 5(D·E·F·G·Base_Male)×머리 donor 4(D·E·F·G)×뼈 비율 4 = 64벌.

```bash
py tools/char-forge/vrm_mix_batch.py plan|build|render
blender -b --factory-startup -P tools/char-forge/vrm_mix.py -- <target.vrm> <donor.vrm> <out.glb> [head=1.05,arm=0.97,leg=1.1]  # 절대 경로
```

- donor 의 Hair 메시+`HairJoint` 뼈를 target 머리에 이식, 뒷머리는 Body 의 HairBack 면(Base_* 는 얇은 한 판이라 donor 불가). 출력 .glb(스프링본 데이터 없음).
- 고르기 `judge.sh score --spec portrait --per-group 2` → dHash 가까운 쌍 제거 → `data/vrm_mix_pick20.json`. 렌더 `render/render_bodies.py`.

### 얼굴 레이어(단계 3, 얼굴 생성 0)

```bash
blender -b --factory-startup -P tools/char-forge/face_layers.py -- <in.glb> <밑몸.vrm> <out.glb> eye=1,brow=2,mouth=0,iris=3,skin=2,deco=1
py tools/char-forge/face_layers_batch.py plan|build|render   # 20명 × 후보 3 → _out/face_mix, 렌더는 CPU(render/render_heads_cpu.py)
```

- 칸: 눈매 4·눈썹 3·입 3 = 샘플 표정 셰이프키(`Fcl_EYE_Angry` 등)를 0.1~0.4 섞어 기본 얼굴로 굳힘(모든 키에 같은 변위 → 깜빡임 등은 그대로) · 눈동자 8 = 색상·채도만 바꿈 · 피부 5 = 얼굴 피부 중앙값 → 목표색 비율을 얼굴·몸 피부에 같이 · 장식 4 = 볼 홍조·주근깨·점(볼 위치는 눈동자 메시에서 찾아 UV 분포로).
- 덤: vrm_mix 출력의 `target_N` 셰이프키 이름을 원본 VRM 의 `Fcl_*` 로 되살린다(게임이 눈 깜빡임·입모양을 이름으로 찾음).
- 고르기: 판정기 portrait 는 회색 배경 오탐·dHash 가 색을 못 봐서 보조, 같은 몸·머리 묶음끼리 피부·눈동자가 갈리게 눈으로 → `data/face_layers_pick20.json`.

