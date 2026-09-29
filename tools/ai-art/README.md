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

## 다음 세션 순서 (2026-09-29 밤 인계 2 — 사용자 "초상과 실제 모델을 맞추기")
**끝난 것(푸시)**: 웹 다섯 판 도감 인물 105·펫 105·사가블로 30 초상 = AI 그림. 사가국지 장수 194 는 56/194 까지 생성(`_out/web_realm_194`, 아직 안 구움).
**새 방식(모델에 맞춘 초상)**: 도감 인물 초상이 공방 몸(`tools/char-forge/_out/hero/hero_*.glb`, 로컬 전용)과 안 맞았다 → ① `render_busts.py`(Blender)로 몸 가슴 위 렌더 → `_out/busts/hero_<id>.png` ② `make_hero_batch.py --i2i` → `batches/web_heroes_105_i2i.json`(밑그림 `init_image` + `denoise` 0.55) ③ `gen.py` 이미지→이미지(`/sdapi/v1/img2img`) → `_out/web_heroes_105_i2i/`. 시험 6장: 머리색·옷 색·실루엣이 모델과 맞고 그림체만 원신풍 — 옛 초상(글만으로 생성)은 모델과 달랐다.
**이어 하기**:
```bash
cd /c/swbins && rm -f tools/ai-art/_out/STOP
# 밑그림이 없으면(105장, 약 5분, Unity·다른 Blender·sd-webui 가 꺼져 있을 때):
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; H=$PWD/tools/char-forge/_out/hero; O=$(cygpath -m $PWD/tools/ai-art/_out/busts)
"$B" -b --factory-startup -P tools/ai-art/render_busts.py -- $O $(ls $H/hero_*.glb)      # 출력 폴더는 절대 경로(Blender 작업 폴더가 다르다)
nohup bash tools/ai-art/run_chain.sh /tmp/chain.status tools/ai-art/batches/web_heroes_105_i2i.json > /dev/null 2>&1 &   # 있는 그림은 건너뛴다, 105장 약 90분
```
**끝난 뒤**: `py tools/ai-art/pack_web_portraits.py --src web_heroes_105_i2i` 로 다섯 판에 굽기(파일명 `hero_<id>.png`) → 눈으로 몇 장 확인(어색한 손·마스크 얼굴은 `--only` 로 씨앗을 바꿔 재생성) → ASSET_LICENSES 항목에 "밑그림 = 공방 몸 렌더(img2img)" 한 줄 → 커밋·푸시. 사가블로 30·사가국지 194 는 공방 몸이 없다(모델 맞추기 대상 아님).
**함정**: `start_sd.ps1 | tail` 처럼 파이프로 받으면 sd-webui 가 파이프를 붙잡아 명령이 안 끝난다 — `run_chain.sh`(파일로 보냄)를 쓰거나 파일로 리다이렉트. 이전 체인이 살아 있으면 sd-webui 를 같이 써 충돌한다 — `_out/STOP` 으로 먼저 멈출 것. 금지어 검사가 `by ` 로 시작하는 구절을 거부한다("chubby yellow" 등).
**사가국지 194 이어 하기**: `bash tools/ai-art/run_chain.sh /tmp/chain.status tools/ai-art/batches/web_realm_194.json` (139장 남음, 약 2시간) → 굽기는 `pack_web_portraits.py --src web_realm_194 --games saga-realm`.

