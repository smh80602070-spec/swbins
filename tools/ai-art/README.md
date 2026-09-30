# ai-art — 로컬 AI 그림 만들기 (swbins3 sd-webui)

웹 다섯 판(원신급 2D)의 초상·카드·배경, 재질 무늬를 **상업 허용 모델**로 만든다. 결과 그림마다 `.license.json`(모델·라이선스·프롬프트·씨앗)을 남긴다.
정책·모델 판정 정본 = `C:\swbins3\COMMERCIAL_SWAP_TODO.md`. 3D 는 이 도구가 못 한다(char-forge·world-forge·VRoid 몫).

```powershell
powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.ps1     # 낮은 우선순위로 sd-webui 켜기(8GB RAM 여유 없으면 거부, 8분 안에 안 뜨면 자동 종료)
py tools/ai-art/gen.py tools/ai-art/batches/<배치>.json                # 한 장씩(--dry 로 검사만, --only 아이디)
powershell -ExecutionPolicy Bypass -File tools\ai-art\stop_sd.ps1      # 끝나면 반드시 끈다(VRAM·RAM 반환, 이 도구가 켠 프로세스만)
```

## PC 가 멈추지 않게 (2026-09-29 사용자 지시)
순차 1장 · 장당 8분 넘으면 interrupt · 시작 전 여유 RAM 6GB · SDXL 768×1024(0.8MP) 이내(1024px 은 공유 메모리로 넘쳐 한 장 5분 이상) · 장 사이 8초 쉼 · 연속 실패 2번이면 멈춤 · 한 번에 24장 ·
Unity·Blender 배치와 동시에 돌리지 않는다. **끝나면 stop_sd.ps1**.
함정: 이 셸은 `NoDefaultCurrentDirectoryInExePath` 를 상속해 `call webui.bat`(상대 경로)을 못 찾는다 → start_sd.ps1 이 그 변수를 지우고 켠다.

## 정책
- 프롬프트에 원작·실존 인물·작가 이름을 쓰지 않는다(SAGA 이름 정책) — `gen.py` 의 `BLOCK` 정규식이 막는다. "○○ 화풍" 도 금지.
- 모델은 `MODELS` 목록(SDXL base·Animagine XL 4.0 Opt·SD 1.5)만.
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
**끝난 것(푸시)**: 웹 다섯 판 도감 인물 105 초상 = 공방 몸 렌더 밑그림 img2img(`web_heroes_105_i2i`, 105장 실패 0)로 교체·굽기·ASSET_LICENSES 밑그림 줄. 펫 105·사가블로 30 도 AI 그림. 웹 초상 실기 확인은 사용자 몫.
**사가국지 장수 194 (09-30 끝)**: 공방 몸 194(`tools/char-forge/gen_realm_recipes.py` → `run_realm_bodies.sh`, 도감 105 축까지 299명 둘 이상 다름) → 몸 렌더 `_out/busts_realm/` → `make_realm_i2i_batch.py` → `run_chain.sh …web_realm_194_i2i.json`(체인은 묶음 16개=128장에서 멈추니 다시 돌려 이어감) → `pack_web_portraits.py --src web_realm_194_i2i --games saga-realm`. Blender 렌더가 100+장에서 메모리를 물고 멈출 수 있다 — PID 만 종료하고 없는 것만 다시.
**동물 펫 105 몸 맞추기 시도(09-30) — 채택 안 함**: `render_pets.py`(종별 대역 모델 102종 전신 렌더 → `_out/pets_v3`) + `make_pet_i2i_batch.py`(`web_pets_105_i2i.json`, denoise 0.62, CC-BY 인 `standin/Elephant` 는 제외) 로 24장을 시험했다. 결과: 대역 모델 모양은 따르지만 **기존 글만으로 만든 그림보다 확연히 밋밋**하고, 대역이 콘셉트와 다른 펫(도깨비=누운 오크·현무=뱀·청룡=박쥐 용)은 오히려 나빠졌다 → 펫 초상은 기존 그림 유지. 펫에 맞는 3D 몸(초상 → 3D 방향)이 생기기 전엔 하지 않는다. 도구·배치는 남겨 둔다(`gen.py` 배치 항목의 `meta` 로 출처를 직접 준다).
**남은 일**: 웹 초상 실기 확인은 사용자 몫.
