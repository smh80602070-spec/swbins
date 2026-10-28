# saga — Codex 지침

작업 전 `SAGA_AI_COMMON.md` 를 **먼저 읽는다**(정본). 아래는 그 요약이며, 충돌하면 정본을 따른다.

- 역할: Claude = 오케스트레이터, **Codex = 개발자**(Unity/Godot 코드·도구 스크립트·파이프라인 연결·검증 가능한 수정), Kimi = 보조(알맞은 업무에만 배정, 없으면 막지 말고 진행). 터미널은 `kimi`(Kimi CLI).
- 머신: iMac(RX570) = 웹·Godot 만 / Windows PC(RX7600) = Unity·2D/3D 에셋 생성 / GeForce = 보류(전제로 삼지 않는다).
- 에셋: 기존 것 재사용이 먼저. GPU 재생성은 꼭 필요한 대상만 좁혀서. 원본 덮어쓰기·대량 재생성·폴더 대이동 금지. 새 모델·외부 서비스 도입 금지(`tools/ai-art` 의 세 모델만).
- 2D 모션: 컷아웃(`tools/ai-art/k188_cutout.py`) 기준, 피벗=실제 관절, 발 미끄러짐 금지, idle·walk·run·attack 네 모션을 **GIF/영상 프리뷰로 눈 확인**, 대표 캐릭터 1명 검증 뒤에만 확장. 검증 안 한 건 통과라고 쓰지 않는다.
- 3D 인체 생성(char-forge)은 동결 — 승인 없이 재개 금지.
- 저장소 규칙·검증·git 은 `CLAUDE.md` 가 정본(같은 규칙). 다음 일 = `tasks/QUEUE.md` 갈래 큐 맨 위 티켓.
- 커밋 `git commit -F <메시지파일> -- <손댄 경로>`(cd 없이), 푸시 `bash tools/push.sh`. `git pull`·`stash`·`amend` 금지.
