# remote3d — 그림 → 3D(GLB) 를 Kaggle 무료 GPU 에서 (K-0095 시험)

이 PC(RX 7600)는 CUDA 가 없어 TRELLIS 를 못 돌린다 → Kaggle 노트북(T4 16GB)에서 돌리고 결과만 받는다. 결제·카드 없음.

## 사람 몫 (한 번)
Kaggle 가입 → Settings 에서 전화 인증(GPU·인터넷 켜기에 필요) → API 토큰을 `%USERPROFILE%\.kaggle\access_token`(새 형식 `KGAT_…`) 또는 `kaggle.json` 에.
토큰은 **커밋 금지**(홈에만). 명령줄 도구: `py -m pip install --user kaggle`.

## 명령
```
py tools/ai-art/remote3d/run_kaggle.py --in <그림 폴더> --out tools/ai-art/_out/remote3d [--poll 300]
py tools/ai-art/remote3d/run_kaggle.py --no-push --out tools/ai-art/_out/remote3d     # 끊긴 뒤 지켜보기·받기만
```
- `--in` 폴더: `<id>.png`(한 장 = 한 종, 밝은 단색 배경·전신·3/4 측면이 좋다) + 같은 이름 `.license.json`(입력 출처, 결과 license 에 옮겨 적는다).
- 하는 일: 비공개 데이터셋 `<계정>/saga-k95-input` 올림(있으면 새 판) → `trellis_batch.py` 를 비공개 노트북 `<계정>/saga-k95-trellis`(GPU T4·인터넷)로 push
  → 상태 폴링 → 끝나면 `out/<id>.glb`·`times.json` 받기 → GLB 마다 `.license.json`(TRELLIS-image-large · MIT · 입력 출처).
- 계정 이름은 `kaggle config view` 에서 읽는다 — 저장소엔 안 적는다.

## Kaggle 쪽(trellis_batch.py)
torch 2.4.0 cu121 → `TRELLIS/setup.sh` 플래그 하나씩(--basic·--xformers·--spconv·--kaolin·--nvdiffrast·--mipgaussian, 실패해도 계속) →
kaolin 바퀴가 없으면 FlexiCubes 가 쓰는 `check_tensor` 만 대역 → `TrellisImageTo3DPipeline('microsoft/TRELLIS-image-large')` →
`to_glb(simplify=0.95, texture_size=1024)`. T4 는 flash-attn 불가라 `ATTN_BACKEND=xformers`·`SPCONV_ALGO=native`. 설치·클론은 `/tmp`(결과 받기가 가볍게).

## 한도·금지
- Kaggle GPU 무료 한도 주당 약 30시간 · 세션 최대 12시간. 한 번에 설치가 매번 다시 돈다(시간 표는 K-0095 메모).
- Hunyuan3D(한국 제외 라이선스)·NC 모델 금지 · 이 PC 에 TRELLIS 설치 시도 금지 · 시험 결과는 게임 폴더에 넣지 않는다.
