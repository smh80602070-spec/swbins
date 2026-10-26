#!/bin/bash
# K-0199 떨어짐 줄이기 시험 — 정본 70명을 지금 k188_cutout 규칙으로 시험 자름(A: 지금 관절 · B: 옷자락 인물 skirt_cut 켬) → detach_check 둘 → 사람마다 수 비교표
#   bash tools/ai-art/k188/k199_trial.sh [id,id…]   → (먼저 detach_check 같은 id 로 돌려 detach_all_base.json 에 복사) tools/char-forge/_out/k199/trial_{A,B}.json · 비교는 k199_pick.py
cd /c/swbins
T=tools/char-forge/_out/k199; rm -rf $T/trialA $T/trialB; mkdir -p $T/trialA $T/trialB $T/_jB
ids=${1:-$(py -c "import json;print(' '.join(sorted(set(json.load(open('saga-assets/web2d/cutout/index.json'))['pools'].values()))))")}; ids=${ids//,/ }   # 인자 = id,id… (없으면 정본 전부)
for id in $ids; do
  D=tools/ai-art/_out/k188/p/$id; [ -f $D/joints.json ] || continue
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $D/joints.json $T/trialA/$id --fill sd >/dev/null 2>&1
  if py -c "import json,sys;j=json.load(open('$D/joints.json'));sys.exit(0 if j.get('skirt') and not j.get('skirt_cut') else 1)"; then
    py -c "import json;j=json.load(open('$D/joints.json'));j['skirt_cut']=1;json.dump(j,open('$T/_jB/$id.json','w'))"
    PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $T/_jB/$id.json $T/trialB/$id --fill sd >/dev/null 2>&1
  fi
done
rm -rf $T/_rig_*_t
L=$(ls $T/trialA | paste -sd,); PYTHONIOENCODING=utf-8 py tools/ai-art/k188/detach_check.py $L --cut $T/trialA > $T/trialA.log 2>&1; cp $T/detach.json $T/trial_A.json
rm -rf $T/_rig_*_t
L=$(ls $T/trialB | paste -sd,); PYTHONIOENCODING=utf-8 py tools/ai-art/k188/detach_check.py $L --cut $T/trialB > $T/trialB.log 2>&1; cp $T/detach.json $T/trial_B.json
echo TRIAL_DONE
