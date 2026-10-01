# archive/ — 이력 보관

이력 보관. append 하지 않는다. grep 으로만 읽는다(`grep -n "^## \|^### "` 로 절을 찾아 `sed -n`).
세션 기록은 `tasks/<갈래>/done` 메모와 커밋 메시지에 남긴다. char-forge 이력은 `tools/char-forge/HISTORY.md`.
