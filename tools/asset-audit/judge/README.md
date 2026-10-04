# 에셋 판정기 (K-0069) — 사람 없이 고르기

AI 가 뽑은 그림 묶음에서 **치명 결함을 떨어뜨리고, 같은 id 후보 중 1등만 남긴다.** 사용자는 결과 모음표 한 장(`sheet_accept.jpg`)만 보고 거부권을 쓴다. "100장 뽑아 1장 고르기"의 고르기 자동화다.

## 명령 (소넷은 이것만)

```
bash tools/asset-audit/judge/judge.sh selftest                                   # 합성 그림 여섯 — SELFTEST_OK
bash tools/asset-audit/judge/judge.sh score <폴더> [--per-group 1] [--keep 0.3] [--spec icon|sprite|portrait|bg|tile] [--refs <기준 폴더>]
bash tools/asset-audit/judge/judge.sh pick  <폴더>/_judge/report.json --dest <정본 후보 폴더> [--move]
py tools/ai-art/gen.py <배치.json> --variants 4 --judge                         # 뽑기 + 판정을 한 번에
```

- 끝 줄 `JUDGE_OK 통과/전체`(종료 0) · 통과 0 이면 `JUDGE_FAIL`(종료 1). 보고는 `<폴더>/_judge/report.csv`·`report.json`·`sheet_accept.jpg`·`sheet_reject.jpg`.
- 실행 파이썬은 `C:\swbins3\sd-webui\venv`(토치·CLIP·GPU). 없는 PC 에선 `--no-clip` 으로 기술 결함만 본다(판정 품질 낮음, 보고에 `clip:false`).
- 속도: RX 7600 에서 아이콘 306장 32초.

## 점수 다섯 축

| 축 | 재는 것 | 치명(바로 탈락) |
|---|---|---|
| tech | 빈 그림 · 가장자리 잘림(알파는 그대로, RGB 는 배경색과 뚜렷이 다른 픽셀만) · 흰 테(알파 그림만, 안쪽 2px 띠의 흰 비율) · 배경 조각(64px 넘는 조각 4개↑ **그리고** 비율↑) · 흐림·대비 | 빈 · 잘림 > 규격 문턱 · 흰 테 > 0.3 · 조각 · 중복(dHash ≤ 6) |
| quality | CLIP 제로샷: "깨끗·선명·주제 하나" vs "흐림·글자·잘림·잡동사니". `judge-models/sac+logos+ava1-l14-linearMSE.pth` 가 있으면 LAION 미적 점수를 절반 섞음 | 글자·워터마크 확률 > 0.45 |
| fidelity | `.license.json` 프롬프트에서 품질·스타일 꼬리표를 뺀 **내용어**와 그림의 CLIP 유사도("나무를 시켰는데 나무인가") | < 0.08(온돌·장판 같은 낯선 단어는 낮게 나와 문턱이 낮다) |
| style | `--refs` 가 있으면 기준 그림체 중심과의 유사도, 없으면 묶음 중심(이탈 그림) | — |
| group | id 에서 `_v01`·`_02` 꼬리를 뗀 묶음 안에서 종합 점수 순위 | `--per-group N` 밖 |

종합 = 규격별 가중 평균 × 100. 가중치·문턱은 `judge.py` 의 `SPEC` 표 한 곳.

## 규격(`--spec`, 기본 auto = 경로·크기·알파로 짐작)

icon(아이콘·장비) · sprite(2D 지물·움직이는 것, 알파) · portrait(초상·흉상) · bg(배경·하늘·컷신·실내, 가로 2.5배↑) · tile(이음매). bg·tile 은 잘림·흰 테·조각을 안 잰다.

## 기준 그림체(`--refs`)

**지금은 비워 둔다.** 사용자가 현재 2D 그림체를 "다 별로"라 했으니(K-0068) 지금 그림을 기준으로 삼으면 안 된다. K-0068 에서 그림체가 정해지면 그 통과 그림 10~30장을 `saga-assets/web2d/_style_ref/` 에 두고 `--refs` 로 넘긴다. 그때부터 style 축이 "정한 그림체와 같은가"가 된다.

## 보정 이력·함정

- 첫판은 흰 바탕 아이콘의 꽃잎·반짝임을 "배경 조각"으로, 흰 바탕과 맞닿은 안티앨리어싱을 "흰 테"로 세어 306장 중 142장을 떨어뜨렸다 → 조각은 64px·4개·비율 셋 다, 흰 테는 알파 그림만. 보정 뒤 66장(진짜 틀에 잘린 것 45).
- 제로샷 quality 는 초상에서 흔들린다(0.02~0.9). 미적 예측기 파일을 넣으면 안정된다 — 사용자가 직접 받아 둘 것(자동 모드가 외부 가중치 내려받기를 막는다): <https://github.com/christophschuhmann/improved-aesthetic-predictor> 의 `sac+logos+ava1-l14-linearMSE.pth` → `C:\swbins3\judge-models\`.
- HF 캐시에 `preprocessor_config.json` 이 없어 전처리 상수를 코드에 직접 적었다(ViT-L/14 224·CLIP 평균/표준편차).
- 3D(GLB) 는 그림이 아니라 못 잰다 — 렌더(`tools/char-forge/render`·`world-forge`)로 찍은 PNG 를 넘긴다.
- 판정은 **고르기**다. 그림체가 나쁘면 100장 중 1등도 나쁘다. 그림체는 K-0068, 프롬프트는 `tools/ai-art/prompt_kit.py`.
