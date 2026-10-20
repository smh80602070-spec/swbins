# 게임성 장부 · 그래픽 기준선

쓰는 법·상태 표기는 [README](README.md). (10-20 README 6KB 상한 넘김으로 README 에서 옮김 — 내용 그대로)

## 그래픽 기준선(다섯 판 같게 — 사용자 10-17 "좋은 것만 골라서 다 맞추어줘 · 최고의 그래픽 근처")

기준은 원신급. 다섯 판 중 가장 좋은 쪽을 기준선으로 맞추고, QC(W-0291 pw-gfx)가 매번 확인한다. 칸: 웹 판 다섯은 ○ 다 됨 · 숫자 = 빠진 판 수.

| 기능 | 기준(본뜰 판) | 웹 | 고돗 | 유니티 |
|---|---|---|---|---|
| 툰 외곽선·림·얼굴 그림자·VRoid 몸 | 다섯 판 같음 | ○ | 툰 띠·림·외곽선·dex 몸 ○(공용 cel_toon·cel_outline·vroid_body — 다섯 판 다 거침) · 얼굴 그림자 끝 G-0248(머리 앞 기준 반쪽 · SDF 텍스처·앞머리 그림자는 K 대기) | ? |
| 기준선 자동 점검(QC) | — | 끝 W-0291(10-17 측정: 1만리 8/8 · 2나락 하늘·PBR × · 3마을 후처리·SSAO·하늘 × · 4종횡 PBR × · 5천하 후처리·SSAO·그림자 ×) | 끝 G-0249(값 점검 다섯 ok · 네 판 기준 PNG 는 사용자 승인 뒤 graphics/baseline/<판>/) | ? |
| 후처리(블룸·톤매핑·색보정)·SSAO | 1만리·2나락 | W-0292(3마을·5천하) | ○(공용 env_pc.tres glow·tonemap 3·adjustment·SSAO·SSIL·SDFGI + environment_profile 을 다섯 판 씬이 다 닮 · 2나락 SDFGI 끔은 의도 G-0224) | ? |
| 해 그림자(품질별 지도) | 2나락 | 끝 W-0293(5천하 realm-shadow3d · 3마을·4종횡은 측정에서 이미 ○) | ○(네 판 Sun shadow_enabled · 2나락 횃불 그림자 test_room 338 · 품질별 그림자 거리 render_budget 은 1만리만 △) | ? |
| 하늘 셰이더·시간대 빛 | 1만리 | 끝 W-0294(공용 shared/js/skydome3d.js — 1만리·5천하 갈아끼움, 3마을 실제 시각·2나락 마을 연결, 4종횡 na) | 끝 G-0250(공용 day_light.gd — 3마을·5천하·4종횡 바깥 씬 새벽·낮·노을·밤 해·주변광·sky_real 노을/별, 1만리는 sky_panorama·night_visual 그대로 · 남은 것: 밤 창·등롱 불빛 1만리만, 2나락 na) | ? |
| PBR 사진 땅 | 1만리·2나락·3마을 | 끝 W-0295(공용 shared/js/pbrground3d.js + shared/assets/ground 법선·거칠기 — 2나락 마을·방 바닥·벽·들판, 4종횡 바닥·발판, 5천하 지도 땅. 그래픽 기준선 다섯 판 8/8) | G-0252(2나락 방 = 자체 굽기 toon jpg·법선 없음 · 5천하 지도·도읍 땅 vertex_color — 1만리 G-0143·3마을 G-0225·4종횡 G-0222·5천하 전술판 G-0223 ○) | ? |
| 2D 16방향·동작별 프레임 | 디아블로 2 | 끝 W-0311 코드분(sheetspec·mode2d 16방향 길 — 그림은 K 시트 뒤) | na(3D) | ? |
| 2D 그림체(HD-2D 쪽) | 옥토패스 | 없음 — 3D 기준선 뒤 R-0 | na(3D) | ? |
| **4종횡 2D 판(메이플식 2D 화면)** | 메이플스토리 | 끝 W-0296(코드분 — 타일 조각 발판·밧줄·바닥·앞 층·공중 몸짓·픽셀 카메라·시간대 색, 그림이 오면 그대로 꽂힘 · 그림 K-0135 대기) | na(고돗 종횡 = 3D 2.5D 고정 카메라 옆보기 story_field.gd 6) | ? |
| 모션(상황·전투·생활 몸짓, 발 고정 걷기) | 원신·동물의숲 | 끝 W-0303(공용 pose3d 열둘·IK 걷기·쉬면 앉기) — 다음 W-0306·모캡 K | 4(발 고정 IK 다섯 판 없음 SkeletonIK3D 0 · 앉기 seat_pose 는 1만리·탈것만 · 몸짓 gestures 1만리만) — 모캡 K 뒤 R-0 | ? |
| 페이블 추천 다섯(타격 VFX·날씨·물·카메라·얼굴) | 원신 등 | [proposals.md](proposals.md) — 타격 VFX·날씨 우선 1 | 타격 VFX G-0253(5천하 전술판 tween 뿐 — combat_fx slash·spark 1만리·2나락·4종횡 ○, 3마을 na) · 날씨 G-0251(3마을·4종횡·5천하 — season_weather_visual 1만리만, 2나락 na) | ? |
| 최적화(폰 FPS·받는 용량) | — | W-0302 측정·고침 셋(용량·그리기 상한 안, FPS 폰 흉내 7~18 — 남은 손 시트 web-phone-budget-20261018) | 4(PERF 측정 probe_perf·render_budget 칸 LOD·그림자 거리는 1만리만 · 화질/성능 설정 graphics_settings 은 다섯 판 ○) | ? |
