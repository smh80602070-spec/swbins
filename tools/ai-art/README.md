# ai-art — 로컬 AI 그림 만들기 (swbins3 ComfyUI)

웹 다섯 판(원신급 2D)의 초상·카드·배경, 재질 무늬를 **상업 허용 모델**로 만든다. 결과 그림마다 `.license.json`(모델·라이선스·프롬프트·씨앗)을 남긴다.
정책·모델 판정 정본 = `C:\swbins3\COMMERCIAL_SWAP_TODO.md`. 3D 는 이 도구가 못 한다(char-forge·world-forge·VRoid 몫).

```powershell
powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.ps1     # 낮은 우선순위로 ComfyUI(8188) 켜기(8GB RAM 여유 없으면 거부, 5분 안에 안 뜨면 자동 종료)
py tools/ai-art/gen.py tools/ai-art/batches/<배치>.json                # 한 장씩(--dry 로 검사만, --only 아이디)
powershell -ExecutionPolicy Bypass -File tools\ai-art\stop_sd.ps1      # 끝나면 반드시 끈다(VRAM·RAM 반환, 이 도구가 켠 프로세스만)
```

## GeForce 실행 기준 (2026-10-30 확인)

이 절은 **NVIDIA GeForce RTX 4060 8GB PC 전용**이다. Radeon은 다른 PC에서 작업하며 기존 Radeon 설정·실행 안내는 그대로 유지한다. 두 PC는 공통 지침과 `tasks/tools/QUEUE.md`의 분담에 따라 자체툴 생성을 병행한다. 같은 티켓·배치를 두 PC에서 동시에 실행하지 않는다.

- 읽기 전용 확인: `nvidia-smi`에서 RTX 4060·8188MiB·드라이버 610.88, 실행 중 ComfyUI `/system_stats`에서 0.43.0·PyTorch `2.11.0+cu128`·장치 `cuda:0 NVIDIA GeForce RTX 4060`을 확인했다. CUDA 백엔드 인식은 정상이다.
- `/object_info`에서 `gen.py`가 지정한 세 모델과 부속 파일이 모두 인식된다: `z-image-turbo-Q6_K.gguf`, `Qwen3-4B-Q8_0.gguf`, `ae.safetensors`, `animagine-xl-4.0-opt.safetensors`, `Illustrious-XL-v2.0.safetensors`, `sdxl-vae-fp16-fix.safetensors`. 파일 해시·생성 품질 검증을 뜻하지 않는다. 추가 조회에서 `SagaSeamlessTiling`, `ModelSamplingAuraFlow`, `EmptySD3LatentImage`, GGUF 로더, `CheckpointLoaderSimple`, `VAELoader`, `KSampler`, `SaveImage` 등록도 확인했다. 노드 등록만으로 그래프 실행 호환성을 통과 처리하지 않는다.
- 실제 실행 옵션은 `--listen 127.0.0.1 --port 8188 --disable-auto-launch --use-pytorch-cross-attention --output-directory <ComfyUI 출력 폴더>`다. API는 `gen.py` 기본값 `http://127.0.0.1:8188`과 일치한다.
- **상단 `start_sd.ps1` 안내와 아래 ROCm 최적화 기록은 RX 7600 기준이다.** 이 스크립트는 ROCm 환경 변수와 lowvram·fp32 VAE 옵션을 고정하며 현재 GeForce 실행 옵션과 다르다. GeForce 자동 감지·최적화가 구현된 것으로 간주하지 않는다. 실행 중 서버에 생성 작업을 추가하기 전 아래 단일 세션 소유권을 확인하고, 재기동이 필요하면 해당 PC의 기존 CUDA 실행 절차·인터프리터를 확인한다. 이번 점검에서는 소스·실행 설정을 바꾸지 않았다.
- **이 PC 로컬 실행기(git 제외, `.git/info/exclude`)**: ComfyUI 는 `powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.geforce.ps1`(ROCm 변수·lowvram·fp32 VAE 를 뺀 사본, PID 파일이 같아 끄기는 `stop_sd.ps1` 그대로). 음성·효과음은 `C:\swbins3\voice-gen\{qwen3_trial,asr_check}.geforce.py`·`sfx-gen\moss_trial.geforce.py`(cudnn 켬·AOTriton 뺌). `saga_voice_batch.py` 는 사본이 없어 cudnn 이 꺼진 채 돈다. 사본이 없는 PC 에서 원본 `start_sd.ps1` 로 켜도 돌지만 느리다.
- 생성은 기존 한도(순차 1장, 기본 최대 24항목, 1.1MP, 시작 여유 RAM은 실행기 8GB/생성기 6GB)를 지킨다. Radeon 측정 시간을 GeForce 예상 시간으로 쓰거나 8GB GPU를 16GB 원격 GPU처럼 취급하지 않는다. GPU 작업·Unity·Blender 배치를 중복 기동하지 않는다.
- 서버의 소유 세션과 실행 상태를 확인한다. 다른 세션이 사용하는 ComfyUI에 중단·종료 명령을 보내지 않는다. 이번에는 이미 GPU 작업이 진행 중이어서 추가 생성·재시작·종료를 하지 않았다.
- 판정: **CUDA 연결·등록 모델 확인 완료 / 세 모델별 생성·속도·메모리 안정성·시각 품질은 이번 점검에서 미검증**. 다음 생성 티켓에서 필요한 모델의 대표 자산부터 검증한다. CUDA가 있다는 이유로 새 모델·원격 서비스·동결된 3D 인체 생성을 도입하거나 재개하지 않는다.
- 10-31 실측(서버 로그, 10-30 10:19~23:37): SDXL 계열 28단계 1,043회, 장당 중앙값 14.3초·p90 18.2초, OOM·오류 0. **Z-Image 는 이 PC 에서 아직 안 돌렸다**(Lumina2 적재 0) — 처음 쓸 때 대표 몇 장으로 시간·최대 메모리부터. Blender 는 5.2.3 LTS(라데온 산출은 5.2.1).

### GeForce 세션 시작 전 확인

아래 명령은 실행 중인 서버의 상태만 조회한다. 서버 시작·종료나 생성 요청을 보내지 않는다.

```powershell
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
$assetApi = if ($env:AI_ART_API) { $env:AI_ART_API.TrimEnd('/') } else { 'http://127.0.0.1:8188' }
$assetStats = Invoke-RestMethod "$assetApi/system_stats" -TimeoutSec 10
$assetStats.devices | Select-Object name,type,vram_total,vram_free
$assetStats.system | Select-Object comfyui_version,pytorch_version
$assetQueue = Invoke-RestMethod "$assetApi/queue" -TimeoutSec 10
[pscustomobject]@{ Running = @($assetQueue.queue_running).Count; Pending = @($assetQueue.queue_pending).Count }
```

1. 장치가 해당 GeForce이고 백엔드가 `cuda`인지 확인한다. `AI_ART_API`가 지정돼 있으면 기본 로컬 주소를 검사한 결과로 대신하지 않는다.
2. API 연결 실패는 생성 불가 상태로 기록하고 기존 실행 절차부터 확인한다. 다른 세션의 서버를 재시작하거나 새 서버를 중복 실행하지 않는다.
3. **ComfyUI 인스턴스마다 생성 세션 하나만** 사용한다. 실행·대기 작업과 해당 서버를 쓰는 사슬·세션의 소유 티켓을 확인하고, 기존 소유 세션의 종료 또는 인계를 확인한 뒤 실행한다. `gen.py`는 시작 시 서버에 `/free`를 보내고 시간 초과 시 전역 `/interrupt`를 보내므로 다른 세션과 함께 실행하면 그 작업에 영향을 줄 수 있다. 현재 자동 잠금이 보장된 것으로 취급하지 않는다. 큐가 잠깐 비었어도 사슬의 장 사이 대기일 수 있다.
4. 큐의 담당 PC, 기존 출력·라이선스, 배치의 모델·해상도·입력 경로를 확인한다. `py -X utf8 tools/ai-art/gen.py <배치.json> --dry --only <id>`는 선택·variants 확장 후 **모든 후보**의 그래프·입력 파일 해시·기존 PNG/출처 쌍을 검사한다(K-0213). 생성·업로드·서버 접속은 하지 않는다. `GEN_RESULT`의 `checked/failed/pending/legacy`로 검사 범위를 확인한다. `dry`·대상 0건(`empty`)은 생성/품질 통과가 아니며 서버 노드 호환성·실제 추론·메모리·화질과 입력 이미지 디코드는 별도 검증한다. 검사 수를 늘리려고 기존 PNG를 지우거나 옮기지 않는다.
5. `AI_ART_API`·`AI_ART_COMFY_OUT`·`AI_ART_MAX`·`AI_ART_MAX_PIXELS`·`GEN_TIMEOUT`에 기존 세션의 override가 있는지 확인하고 적용값을 기록한다. `AI_ART_COMFY_OUT`은 생성기가 결과를 받은 뒤 복사본을 지우는 서버 출력 경로이므로 실제 접속 인스턴스와 일치해야 한다. 이 점검에서 환경 변수나 실행 설정을 변경하지 않는다.
6. 다음 생성 작업의 증거는 [GeForce 검증 기록](../../tasks/gameplay/asset-tool-validation.md#8-geforce-실행-검증-기록)을 사용한다. 이번 문서 점검을 근거로 대량 생성을 시작하지 않는다.

## 생성 재개·실패 계약 (K-0213)

- 새 PNG의 `.license.json`에 `request_sha256`(그래프·요청 seed·입력 이미지/마스크 바이트·meta)와 `output_sha256`를 남긴다. 입력 경로 이름이 바뀌어도 바이트가 같으면 같은 입력으로 비교한다. 모델 파일 자체의 해시 검사는 아니다.
- 기존 PNG를 디코드하고 출처 JSON의 필수 항목·id를 검사한다. 한쪽 누락·손상·해시 불일치는 오류로 끝내며 원본을 수정하거나 자동 재생성하지 않는다. 정상 옛 쌍에 해시가 없으면 `legacy`로 보존하고 입력 일치 미검증 경고를 낸다.
- 다른 설정으로 다시 만들려면 배치 `out`을 **새 버전 폴더**로 지정한다. 원래 PNG/JSON을 삭제해서 강제 재생성하지 않는다. 입력 그림이 로컬에 없으면 먼저 원래 입력을 확보해야 한다.
- 항목별 `<id>.png.lock`을 배타적으로 만든다. 실행 중단 후 남은 잠금은 소유 프로세스·티켓을 확인한 뒤 처리하며 자동으로 지우지 않는다. 같은 ComfyUI 서버의 다른 작업까지 이 잠금이 조정하지는 않으므로 한 서버 한 세션 원칙은 유지한다.
- PNG 검증과 출처 직렬화 뒤 새 파일만 생성한다. 두 파일 저장은 트랜잭션이 아니며 중간 종료로 한쪽만 남으면 재개 검사가 차단한다.
- 마지막 `GEN_RESULT`는 `requested/checked/generated/reused/legacy/failed/pending/judge/status`를 JSON으로 출력한다. `pending`은 이번에 시도하지 않은 생성 대상 수, `failed`는 검사 또는 생성 실패 항목 수다. 서버/RAM 중단과 판정기 실패는 `status`·`judge` 및 종료 코드로 확인한다.
- `partial`은 `AI_ART_MAX` 한도 때문에 다음 묶음이 남은 정상 종료(0), `complete`는 선택한 생성 작업을 마친 상태다. 모두 시각 품질 승인과 다르다. `dry`·`empty`도 0으로 끝나지만 생성 통과가 아니다. 실패·RAM 중단·판정기 실패는 비영(1) 종료한다. `--judge`는 남은 생성과 실패가 없을 때만 실행한다.
- 로컬 `run_all.sh`는 실패·정지·반복 한도 소진 시 `failed`와 비영 종료를 남긴다. **원격 `push_batch.py`·`sd_kaggle.py`의 완료 판단은 이번 변경 범위 밖**이며 원격 완료를 이 계약으로 보장하지 않는다.
- 검사: `py -X utf8 -m unittest discover -s tools/ai-art -p test_gen.py -v` — 임시 파일·모의 API/러너만 사용. Pillow는 기존 파이프라인 의존성이며 Git Bash가 없으면 러너 검사는 SKIP이다.

## 원격 GPU(Kaggle) — K-0140 (2026-10-18)

로컬 AMD 8GB 사슬(장당 84~112초)이 막힐 때 같은 배치를 Kaggle 무료 GPU(T4 ×2)로 돌린다. 결과는 로컬과 같은 `_out/<배치 out>/`.

```bash
bash tools/ai-art/run_all.sh --remote tools/ai-art/batches/<배치>.json tools/ai-art/_out/<상태>.st     # 배치 하나
py tools/ai-art/remote/push_batch.py <배치1>.json <배치2>.json --state <상태>                       # 여럿 한 번에
py tools/ai-art/remote/push_batch.py <배치>.json --no-push --state <상태>                            # 끊긴 뒤 받기만
```

- **같은 그림**: 이 PC 와 같은 ComfyUI 커밋·GGUF 커밋 + 이 PC 의 saga 고친 GGUF `ops.py` + `saga_seamless.py` 를 싣고, 모델은 HF 에서 **로컬 파일과 바이트 크기가 같은 것만** 받아 **같은 gen.py** 로(그래프·씨앗·license 같음, license 에 `remote` 칸).
- **멱등**: 로컬에 다 있는 항목은 안 올리고, 받을 때 없는 그림만 놓는다. img2img 출처 칸은 이 PC 경로로 다시 쓴다.
- 판정·고르기·포장은 그대로 로컬(`judge.sh` 는 `CUDA_VISIBLE_DEVICES= HIP_VISIBLE_DEVICES=-1` 이면 CPU — 사슬 중에도).
- 실측(10-18): 설치 30초·모델 40초 · SDXL txt2img 26초/장 · img2img 28초/장(T4 한 장) · 80/80 ok.
- 함정: Kaggle 이 QUEUED 로 수십 분~한 시간 세워 둘 때 있음 · 무료 GPU 주 30h(사용자 계정) · 토큰은 `%USERPROFILE%\.kaggle`(커밋 금지) · 같은 배치를 로컬 사슬과 동시에 돌리면 헛일(파일은 안 겹침 — 있는 그림은 서로 건너뜀).

## ComfyUI 이사 (2026-10-07, 사용자 "용량 대비 위력" 지적)
A1111 1.10.1(2025-02 멈춤) → **ComfyUI**(Windows ROCm 공식, 포트 8188). `gen.py` 는 배치 JSON 형식을 그대로 받고 뒤에서 ComfyUI 그래프(`/prompt`→`/history`→`/view`)를 짠다.
- 모델 두 계열: **`z-image-turbo`**(Apache-2.0, GGUF Q6_K, 8단계·CFG 1 고정, 부정 프롬프트 없음, **문장형** 프롬프트 — 범용·사실풍·글자·초상 밑그림) /
  **sdxl**(`animagine-xl-4.0-opt`·`Illustrious-XL-v2.0`, 태그형 + 품질 꼬리표 + 부정 프롬프트). SDXL base·SD1.5·NoobAI 는 지웠다(밀리거나 NC).
- 이음매 타일(`tiling`): **10-09 실측 — ComfyUI 에서 Illustrious + 순환 패딩은 그림이 원색 파편으로 깨진다**(같은 항목 tiling 끄면 정상, K-0088). DiT(Z-Image)는 원래 안 된다. → 타일은 평범하게 뽑고 `make_seamless.seamless()`(4판 띠 섞기, 십자 이음매 없음)로 만든다. 노드(swbins3 `comfyui-saga/saga_seamless.py`) 고치기 전엔 `tiling` 쓰지 말 것.
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
- **AI 적용 근거**: `SAGA-DESIGN.md` §7.4에 09-29 승인 기록이 있다. 상업 허용 모델·이름 정책·출처 기록을 지키며, 새 모델·서비스 도입은 별도 결정 사항이다. 생성 성공만으로 시각·게임 적용 검증을 대신하지 않는다.

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
