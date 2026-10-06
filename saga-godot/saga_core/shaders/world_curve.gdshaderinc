// 사가의숲 "구면 투영" — 웹판 saga-forest/js/village-view.js의
// project()/unproject()(2D 캔버스 화면 왜곡, SAGA-HANDOFF.md가 "되돌리지
// 말라"고 못박은 이 판의 정체성)를 3D 정점 셰이더로 재설계한 것.
// 2026-09-12 결정: 정점 셰이더 쪽으로 간다(진짜로 휜 지형/구가 아니라
// 순수 시각 효과).
//
// 웹은 화면축 기준 비등방(가로는 d²·BEND, 세로는 R·ZOOM·TILT·sin(a))이었다
// — 오블리크 2D 카메라 트릭이 만든 형태다. 3D는 실제 카메라 원근이 이미
// "멀수록 낮아 보이는" 효과를 주므로, 정점 단계에서는 중심(플레이어) 기준
// **등방(원형) 포물면** 하나로 통일했다 — 사방 어디를 봐도 같은 규칙으로
// 휘어야 이음매가 안 생긴다("그릇 안에 서 있다"는 느낌). 웹의 비등방
// 공식을 그대로 옮기지 않는다 — 그건 특정 오블리크 카메라의 근사였지
// 지켜야 할 규칙 자체가 아니다.
//
// 세계 좌표(x·z)·걷기·타일 판정은 이 파일 밖(GDScript)에서 평면 그리드로
// 그대로 계산한다 — 이 휘어짐은 순수하게 "그림만" 담당한다(웹의
// project/unproject가 village.js의 타일 좌표를 안 건드리는 것과 같은
// 경계). **집 안·동굴 안은 이 include를 아예 안 쓰는 머티리얼로 남긴다**
// (루트 CLAUDE.md "구면 투영을 평평한 탑다운으로 되돌리지 않는다 — 집
// 안만은 일부러 안 휜다").
//
// 전제 — 이 프로젝트의 월드 오브젝트는 Y축 회전(요)만 쓴다(GO/DUNGEON
// 어디에도 피치·롤이 없다, player.gd도 이동 방향으로 Y축만 돈다). Y축
// 회전은 로컬 Y 성분을 안 바꾸므로, 월드 XZ로 굽힘량만 구해 로컬
// VERTEX.y에서 바로 빼는 것으로 충분했다 — G-0030 부터는 배율이 걸린 물체도 맞게 모델 역행렬로 되돌린다.
// 나중에 피치·롤이 있는 오브젝트에 이 include를 쓸 일이 생기면 이 전제부터
// 다시 볼 것.
//
// 쓰는 법 — 이 include를 쓰는 머티리얼의 vertex()에서:
//   VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
// `curve_amount`는 머티리얼별 uniform으로 각자 선언한다(같은 세기를 쓰되
// 나중에 게임별로 다르게 튜닝할 수 있게 이 파일에 상수로 안 박는다).
//
// 중심 갱신 — 이 값을 쓰는 게임의 월드 스크립트가 매 프레임(또는 플레이어가
// 움직일 때) 한 번, 아래처럼 전역으로 맞춘다:
//   RenderingServer.global_shader_parameter_set("saga_world_curve_center", player.global_position)

global uniform vec3 saga_world_curve_center;

vec3 saga_apply_world_curve(vec3 vertex_local, mat4 model_matrix, float curve_amount) {
	vec2 world_xz = (model_matrix * vec4(vertex_local, 1.0)).xz;
	vec2 delta = world_xz - saga_world_curve_center.xz;
	// G-0030 — 굽힘은 월드 아래로 내리고, 물체 배율·회전을 되돌려 로컬로 뺀다. 배율 1·Y축 회전만인 물체는 전과 같고,
	// 배율이 걸린 소품(바위 ×0.225 등)·키 맞춤 배율이 걸린 인물 몸은 이제 땅과 같은 만큼 휜다(전엔 배율만큼 덜 휘어 멀리서 떴다).
	vertex_local -= inverse(mat3(model_matrix)) * vec3(0.0, dot(delta, delta) * curve_amount, 0.0);
	return vertex_local;
}
