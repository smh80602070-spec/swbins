#!/bin/bash
# 배치 하나를 끝까지. 안전 멈춤: tools/ai-art/_out/STOP 파일을 만들면 다음 묶음 전에 멈춘다. 사용: bash tools/ai-art/run_all.sh <배치.json> <상태파일>
#  · sd-webui 가 이미 떠 있으면(사용자가 쓰는 중) **끄지도 재시작하지도 않고** 그대로 계속 쓴다 — 끝나도 그대로 둔다.
#  · 내가 띄운 경우에만: 메모리(파이썬 작업 집합)가 RSS_LIMIT_GB 를 넘겼을 때만 껐다 켠다(누적 방지). 넘기 전엔 한 번 띄운 것을 계속 쓴다 → 창이 자주 안 뜬다.
#  · 창은 start_sd.ps1 이 숨겨서 띄운다.
cd /c/swbins
B="$1"; S="$2"; rm -f "$S" tools/ai-art/_out/STOP; echo $$ > tools/ai-art/_out/run_all.pid
export AI_ART_MAX=8
RSS_LIMIT_GB=${RSS_LIMIT_GB:-10}
up() { curl -s -m 5 http://127.0.0.1:7860/sdapi/v1/options > /dev/null; }
WAS_UP=0; up && WAS_UP=1
[ $WAS_UP = 1 ] && echo "sd-webui 가 이미 떠 있음 — 그대로 쓴다(끄지 않는다)" >> "$S"
sd_rss_gb() {   # sd-webui 파이썬(launch.py)의 작업 집합, GB (정수)
  powershell -NoProfile -Command "\$m=0; Get-CimInstance Win32_Process -Filter \"name='python.exe'\" | Where-Object { \$_.CommandLine -like '*launch.py*' } | ForEach-Object { \$w=(Get-Process -Id \$_.ProcessId -ErrorAction SilentlyContinue).WorkingSet64; if (\$w -gt \$m) { \$m=\$w } }; [math]::Floor(\$m/1GB)" 2>/dev/null | tr -d '\r'
}
for i in $(seq 1 16); do
  [ -f tools/ai-art/_out/STOP ] && { echo "STOP 파일 — 멈춤" >> "$S"; break; }
  if ! up; then
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai-art/start_sd.ps1 >> "$S" 2>&1
    if ! up; then echo "sd-webui 안 뜸 — 멈춤" >> "$S"; break; fi
  fi
  PYTHONIOENCODING=utf-8 py tools/ai-art/gen.py "$B" > tools/ai-art/_out/run_$i.log 2>&1
  echo "chunk $i: $(grep -c '^ok ' tools/ai-art/_out/run_$i.log) ok, $(grep -c '^실패' tools/ai-art/_out/run_$i.log) fail" >> "$S"
  if ! grep -q "^ok " tools/ai-art/_out/run_$i.log; then break; fi
  if [ $WAS_UP = 0 ]; then
    R=$(sd_rss_gb); R=${R:-0}
    if [ "$R" -ge "$RSS_LIMIT_GB" ]; then
      echo "sd-webui ${R}GB — 재시작" >> "$S"
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$S" 2>&1
      sleep 20
    fi
  fi
  sleep 5
done
# 내가 띄운 것만 끝에 끈다(사용 중이던 것은 그대로)
if [ $WAS_UP = 0 ]; then powershell -NoProfile -ExecutionPolicy Bypass -File tools/ai-art/stop_sd.ps1 >> "$S" 2>&1; fi
echo done >> "$S"
