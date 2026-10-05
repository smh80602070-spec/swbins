# 12. 조합 변형 (K-0072, 사람 디자인 0)

샘플 VRM 의 머리카락·체형을 코드로 섞는다(얼굴은 안 만든다, 고르기는 판정기). 몸 5(D·E·F·G·Base_Male)×머리 donor 4(D·E·F·G)×뼈 비율 4 = 64벌.

```bash
py tools/char-forge/vrm_mix_batch.py plan|build|render
blender -b --factory-startup -P tools/char-forge/vrm_mix.py -- <target.vrm> <donor.vrm> <out.glb> [head=1.05,arm=0.97,leg=1.1]  # 절대 경로
```

- donor 의 Hair 메시+`HairJoint` 뼈를 target 머리에 이식, 뒷머리는 Body 의 HairBack 면(Base_* 는 얇은 한 판이라 donor 불가). 출력 .glb(스프링본 데이터 없음).
- 고르기 `judge.sh score --spec portrait --per-group 2` → dHash 가까운 쌍 제거 → `data/vrm_mix_pick20.json`. 렌더 `render/render_bodies.py`.
