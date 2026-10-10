# creatures3d — 자체 동물·탈것·괴물 3D (K-0096)

TRELLIS(Kaggle, MIT) 원격 생성 → `tools/ai-art/remote3d/finish.py`(얼굴 +Z·발 밑 원점·실제 키) → `creature_fill.mjs --forward-z`(뼈 없는 동작 7) → `compress.mjs`.
입력 그림은 **txt2img 만**(빌린 모델 렌더를 밑그림으로 쓰면 그 모양을 물려받는다 — 10-10 묶음 A 철회 사유). 파일마다 `<id>.license.json`.
배포: `asset-place.json` 항목 `creatures3d` → `saga-web/shared/assets/creatures3d`.
