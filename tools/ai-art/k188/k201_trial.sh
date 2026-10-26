#!/bin/bash
# K-0201 ① 넓히기 시험 — 정본 기준 detach(지금 팩) → 116명 관절에 far copyall·fill smear 를 얹은 시험 자름(trialW) → detach → k201_pick 비교
#   bash tools/ai-art/k188/k201_trial.sh [id,id…]   → tools/char-forge/_out/k199/{base_w,trial_w}.json · K201_TRIAL_DONE
cd /c/swbins
T=tools/char-forge/_out/k199
ids=${1:-$(py -c "import json;print(','.join(sorted(set(json.load(open('saga-assets/web2d/cutout/index.json'))['pools'].values()))))")}
rm -rf $T/_rig_* $T/trialW $T/_jW; mkdir -p $T/trialW $T/_jW
PYTHONIOENCODING=utf-8 py tools/ai-art/k188/detach_check.py $ids > $T/base_w.log 2>&1; cp $T/detach.json $T/base_w.json
for id in ${ids//,/ }; do
  D=tools/ai-art/_out/k188/p/$id
  py -c "import json;j=json.load(open('$D/joints.json'));j.setdefault('far','copyall');j.setdefault('fill','smear');json.dump(j,open('$T/_jW/$id.json','w'))"
  PYTHONIOENCODING=utf-8 py tools/ai-art/k188_cutout.py cut $D/side.png $T/_jW/$id.json $T/trialW/$id >/dev/null 2>&1
done
rm -rf $T/_rig_*_t
PYTHONIOENCODING=utf-8 py tools/ai-art/k188/detach_check.py $ids --cut $T/trialW > $T/trial_w.log 2>&1; cp $T/detach.json $T/trial_w.json
echo K201_TRIAL_DONE
