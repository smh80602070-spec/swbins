#!/bin/bash
# K-0202 ④ 아이콘 300 일괄: plan 전체를 24항목씩 변주 1 로 만든다(gen.py 는 한 번에 24장). 이미 있는 건 건너뛴다. 불량은 sheet 로 보고 --seed 바꿔 다시.
cd /c/swbins/tools/ai-art
IDS=$(PYTHONIOENCODING=utf-8 py -c "
import json;d=json.load(open('batches/k202_icons.json',encoding='utf-8'));ids=[i['id'] for i in d['items']]
print(' '.join(','.join(ids[k:k+24]) for k in range(0,len(ids),24)))")
n=0; for G in $IDS; do n=$((n+1)); PYTHONIOENCODING=utf-8 py gen.py batches/k202_icons.json --only "$G" --variants 1 > _out/k202/run_$n.log 2>&1; done
echo K202_ICONS_DONE
