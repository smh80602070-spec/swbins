#!/bin/bash
cd /c/swbins
while read id v f; do
  [ -f tools/ai-art/_out/k188/p/$id/auto.jpg ] && continue
  bash tools/ai-art/k188/person.sh $id $v $f >> tools/ai-art/_out/k188/auto86.log 2>&1 || echo "FAIL $id" >> tools/ai-art/_out/k188/auto86.log
done < tools/ai-art/k188/picks86.txt
echo AUTO86_DONE >> tools/ai-art/_out/k188/auto86.log
