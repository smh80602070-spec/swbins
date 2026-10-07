# ai-art — 로컬 AI 그림 만들기 (swbins3 ComfyUI)

웹 다섯 판(원신급 2D)의 초상·카드·배경, 재질 무늬를 **상업 허용 모델**로 만든다. 결과 그림마다 `.license.json`(모델·라이선스·프롬프트·씨앗)을 남긴다.
정책·모델 판정 정본 = `C:\swbins3\COMMERCIAL_SWAP_TODO.md`. 3D 는 이 도구가 못 한다(char-forge·world-forge·VRoid 몫).

```powershell
powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.ps1     # 낮은 우선순위로 ComfyUI(8188) 켜기(8GB RAM 여유 없으면 거부, 5분 안에 안 뜨면 자동 종료)
py tools/ai-art/gen.py tools/ai-art/batches/<배치>.json                # 한 장씩(--dry 로 검사만, --only 아이디)
powershell -ExecutionPolicy Bypass -File tools\ai-art\stop_sd.ps1      # 끝나면 반드시 끈다(VRAM·RAM 반환, 이 도구가 켠 프로세스만)
```

## ComfyUI 이사 (2026-10-07, 사용자 "용량 대비 위력" 지적)
A1111 1.10.1(2025-02 멈춤) → **ComfyUI**(Windows ROCm 공식, 포트 8188). `gen.py` 는 배치 JSON 형식을 그대로 받고 뒤에서 ComfyUI 그래프(`/prompt`→`/history`→`/view`)를 짠다.
- 모델 두 계열: **`z-image-turbo`**(Apache-2.0, GGUF Q6_K, 8단계·CFG 1 고정, 부정 프롬프트 없음, **문장형** 프롬프트 — 범용·사실풍·글자·초상 밑그림) /
  **sdxl**(`animagine-xl-4.0-opt`·`Illustrious-XL-v2.0`, 태그형 + 품질 꼬리표 + 부정 프롬프트). SDXL base·SD1.5·NoobAI 는 지웠다(밀리거나 NC).
- 이음매 타일(`tiling`)은 **sdxl 에서만** 된다(합성곱 순환 패딩, swbins3 `comfyui-saga/saga_seamless.py`). DiT(Z-Image)는 타일이 안 된다 → 타일 배치는 Illustrious.
- sampler 는 A1111 이름("Euler a")을 그대로 써도 된다(`SAMPLERS` 로 옮김). hires(`hr`)는 잠재 공간 확대 + 둘째 KSampler.
- 켜기 플래그(`start_sd.ps1`): `--use-pytorch-cross-attention --disable-dynamic-vram --lowvram --disable-pinned-memory --fp32-vae`(실측으로 고름 — 동적 VRAM 은 모델을 프롬프트마다 갈아 끼우고, fp16 VAE 는 Z-Image 가 깨진다), `TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1`. MIOpen 은 ComfyUI 가 RDNA3 에서 스스로 끈다. 기동 5~6분.
- 판정기(`asset-audit/judge/judge.sh`)도 `C:\swbins3\comfyui\venv` 파이썬으로 돈다.
- 측정(RX 7600, 10-08): Z-Image 1024² 184초·768² 101초(샘플링은 40·19초, 나머지가 CPU 인코딩) · Illustrious 832×1216 86~150초·768² 64초. 상세·다음 최적화 후보는 swbins3 `SETUP_GUIDE.md` §6. 첫 그림 품질: Z-Image 아이콘(청동 호랑이 부적)은 사진급, Illustrious 초상은 애니 정상 — 사용자 눈 판정은 K-0082.

## 새 배치는 키트로만 (K-0070, 2026-10-05)
프롬프트는 손으로 쓰지 않는다. 소넷은 **주제(영어 태그 5~8개)** 만 적고 구도·배경·그림체·부정어·크기·씨앗은 `prompt_kit.py` 가 채운다. 입력은 `batches/_in/<이름>.json`:
```json
{"name": "icons_food", "spec": "icon", "style": "B", "model": "animagine-xl-4.0-opt", "variants": 4,
 "items": [{"id": "fo_pine", "subject": "pine tree, snow on branches, wooden pot", "subject_ko": "눈 쌓인 소나무 분재"}]}
```
```bash
py tools/ai-art/prompt_kit.py build tools/ai-art/batches/_in/<이름>.json      # → batches/<이름>.json (끝 줄 LINT_OK 여야)
py tools/ai-art/gen.py tools/ai-art/batches/<이름>.json --variants 4 --judge  # 후보 4장씩 뽑고 판정기가 묶음마다 1등
bash tools/asset-audit/judge/judge.sh pick tools/ai-art/_out/<이름>/_judge/report.json --dest <정본 후보 폴더>
```
`subject_ko → subject` 옮기기: 명사 태그로, 가장 중요한 것부터(첫 태그에만 가중치가 붙는다), 형용사 나열·문장 금지, 원작·작가·실존 인물 이름 금지(`BLOCK` 이 막는다), "no humans"·"scenery"·그림자 금지는 규격이 넣으니 쓰지 않는다. 항목에 `spec` 을 주면 그 항목만 다른 규격(건물 sprite·짐승 creature·사람 character 를 한 배치에). 규격·그림체(`SPECS`·`STYLES`) 추가·수정은 페이블 세션 — 그림체를 바꾸면 그 그림체 산출을 전부 다시 뽑는다.

## PC 가 멈추지 않게 (2026-09-29 사용자 지시)
순차 1장 · 장당 8분 넘으면 interrupt · 시작 전 여유 RAM 6GB · 1.1MP(1024²·832×1216) 이내 — ComfyUI 는 넘치는 층을 스스로 내려 8GB 에서 1MP 가 돈다(A1111 땐 0.8MP 가 한계였다) · 장 사이 8초 쉼 · 연속 실패 2번이면 멈춤 · 한 번에 24장 ·
Unity·Blender 배치와 동시에 돌리지 않는다. **끝나면 stop_sd.ps1**.
함정: 이 셸은 `NoDefaultCurrentDirectoryInExePath` 를 상속해 `call webui.bat`(상대 경로)을 못 찾는다 → start_sd.ps1 이 그 변수를 지우고 켠다.

## 정책
- 프롬프트에 원작·실존 인물·작가 이름을 쓰지 않는다(SAGA 이름 정책) — `gen.py` 의 `BLOCK` 정규식이 막는다. "○○ 화풍" 도 금지.
- 모델은 `MODELS` 목록(z-image-turbo · Animagine XL 4.0 Opt · Illustrious XL v2.0)만. 장부는 `C:\swbins3\COMMERCIAL_SWAP_TODO.md`.
- AI 그림은 저작권 보호가 약하다(사람의 창작 기여가 적으면) — 팔 수는 있으나 남이 베끼는 걸 막기 어렵다. 게임에 넣기 전 사람이 고르고 다듬은 것만.
- **`SAGA-DESIGN.md` §7 "그림은 CC0 또는 코드" 규칙과 충돌** — 웹 판에 AI 그림을 넣으려면 그 절에 "상업 허용 모델 + 출처 기록" 항목을 사용자 승인으로 더할 것(이 도구 결과는 그 전까지 게임에 넣지 않는다).

## 첫 시험 (2026-09-29, RX 7600 8GB)
Animagine XL 4.0 Opt · 768×1024 · 28단계 · 초상 3장 = 68초(모델 로딩 포함)·40초·35초, RAM 여유 13GB 이상·CPU 30% 안쪽 유지. 품질은 원신풍 일러스트 수준.
함정: `1boy` 프롬프트가 여성스럽게 나온다 → `male focus, masculine, strong jaw` 를 더하고 네거티브에 `1girl, feminine` 을 둔다.

## 도감 인물 105 초상 (2026-09-29)
`make_hero_batch.py` 가 공방 레시피(지역·역할·성별·나이·머리색·눈 색)에서 프롬프트를 짜 `batches/web_heroes_105.json` 을 쓴다(인물 이름은 프롬프트에 안 쓴다, 씨앗 = id 해시). `run_all.sh` 가 **8장마다 sd-webui 를 껐다 켜며** 끝까지 돈다 —
sd-webui 파이썬이 시작하자마자 RAM 13GB 를 쥐고 장수가 늘수록 더 쥔다(12장에서 여유 6GB 까지, 껐다 켜니 회복). 105장 약 100분(장당 35초 + 재시작), 실패 0, RAM 여유 4.6~25GB, CPU 30% 안쪽.
결과 = `_out/web_heroes_105/hero_<id>.png` + `.license.json`(gitignore). 눈으로 본 결과: 문화·역할·성별 모두 맞음. 결함: 얼굴 반쯤 가린 역할(첩자·병사)이 이빨 무늬 마스크로 나오는 것이 몇 장 — `face covered` 표현을 바꿔 재생성.
안전 멈춤: `tools/ai-art/_out/STOP` 파일. 러너를 강제로 끌 땐 process 이름으로 넓게 죽이지 말고 `_out/run_all.pid` 로만(이름으로 죽였다가 작업 셸이 함께 죽었다).

## 다음 세션 순서 (2026-09-30)
**끝난 것(푸시)**: 웹 다섯 판 도감 인물 105 초상 = 공방 몸 렌더 밑그림 img2img(`web_heroes_105_i2i`, 105장 실패 0)로 교체·굽기·ASSET_LICENSES 밑그림 줄. 펫 105·사가나락 30 도 AI 그림. 웹 초상 실기 확인은 사용자 몫.
**사가천하 장수 194 (09-30 끝)**: 공방 몸 194(`tools/char-forge/gen_realm_recipes.py` → `run_realm_bodies.sh`, 도감 105 축까지 299명 둘 이상 다름) → 몸 렌더 `_out/busts_realm/` → `make_realm_i2i_batch.py` → `run_chain.sh …web_realm_194_i2i.json`(체인은 묶음 16개=128장에서 멈추니 다시 돌려 이어감) → `pack_web_portraits.py --src web_realm_194_i2i --games saga-realm`. Blender 렌더가 100+장에서 메모리를 물고 멈출 수 있다 — PID 만 종료하고 없는 것만 다시.
**동물 펫 105 몸 맞추기 시도(09-30) — 채택 안 함**: `render_pets.py`(종별 대역 모델 102종 전신 렌더 → `_out/pets_v3`) + `make_pet_i2i_batch.py`(`web_pets_105_i2i.json`, denoise 0.62, CC-BY 인 `standin/Elephant` 는 제외) 로 24장을 시험했다. 결과: 대역 모델 모양은 따르지만 **기존 글만으로 만든 그림보다 확연히 밋밋**하고, 대역이 콘셉트와 다른 펫(도깨비=누운 오크·현무=뱀·청룡=박쥐 용)은 오히려 나빠졌다 → 펫 초상은 기존 그림 유지. 펫에 맞는 3D 몸(초상 → 3D 방향)이 생기기 전엔 하지 않는다. 도구·배치는 남겨 둔다(`gen.py` 배치 항목의 `meta` 로 출처를 직접 준다).
**이미지→3D 시험(09-30, TripoSR)**: 이 PC(RX 7600, swbins3 sd-webui 의 ROCm 파이썬) 에서 **돈다** — MIT, 한 장 6~15초, 가중치 1.7GB(HF). `torchmcubes` 는 skimage 로 바꿔 끼우고(컴파일 불필요) `rembg`·`trimesh` 는 `pip --target` 으로 스크래치에 설치(swbins3 는 안 건드림), 출력은 `to_gradio_3d_orientation` 변환 필요. **품질은 미달**: 도감 인물·펫 초상(AI 일러스트) 3장으로 시험했더니 얼굴이 뭉개지고(피부 조각만 흩어짐) 옷은 회색 덩어리·뒤가 뚫린 반신, 호랑이는 줄무늬 덩어리, 뼈대 없음 → 게임 몸으로 못 쓴다. 반신·소품 초안 이상은 어렵다. (Hunyuan3D 는 한국이 라이선스 적용 지역에서 빠져 있고 TRELLIS 는 CUDA 필요 — swbins3 `COMMERCIAL_SWAP_TODO.md`.)
**남은 일**: 웹 초상 실기 확인은 사용자 몫.
