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
