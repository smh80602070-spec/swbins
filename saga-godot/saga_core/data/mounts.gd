extends RefCounted

## 2026-09-30 탈것 — 신수(saga_core/data/pets.gd) 가운데 말·호랑이는 땅 탈것, 새·용은 나는 탈것.
## id 는 도감 id 그대로(가명은 도감 name 을 따른다). 쓰는 곳: player/mount.gd.
##   kind "ground" — 달리기 배율 · 스태미나 안 씀 · 점프 배율 · 등반 못 함 · 전투 못 함(공격을 누르면 내림)
##   kind "fly"    — 타는 순간 떠오른다. 점프 = 오르기, 손 떼면 떠 있기, 달리기(Shift) = 내려가기, 고도 상한. 땅에 내리면 땅 탈것(느리게)으로 걷는다.
## req_ch — 이야기 장(PartyState.story.ch)이 이 값 이상이면 부른다. SAGA_MOUNT_ALL 환경변수가 있으면 전부(시험용).
## height — 몸 높이 m, ride — 탄 사람 발이 올라가는 높이 m, len — 몸 길이 m(앞뒤 흔들림 기준).
## seat_y/seat_z — 안장 자리(모델 좌표, +z 가 머리 쪽): 등 윗면 높이와 등 한가운데 앞뒤 위치(G-0024 후속 실측 — 목 시작점에 앉던 것을 등 가운데로).
##   기수 엉덩이를 seat_y 에 앉히고, 탈것 몸을 -seat_z 만큼 옮겨 안장이 기수 아래에 오게 한다(mount.gd). 없으면 예전 ride 방식.

const MOUNTS := [
	{"id": "pt_jeolyeong", "kind": "ground", "req_ch": 2, "speed": 1.9, "jump": 1.15, "height": 1.9, "ride": 1.3, "yaw": 0.0, "seat_y": 1.21, "seat_z": -0.4},
	{"id": "pt_jeoktoma", "kind": "ground", "req_ch": 5, "speed": 2.2, "jump": 1.25, "height": 2, "ride": 1.35, "yaw": 0.0, "seat_y": 1.28, "seat_z": -0.4},
	{"id": "pt_baekho", "kind": "ground", "req_ch": 8, "speed": 2.0, "jump": 1.4, "height": 1.7, "ride": 1.1, "yaw": 0.0, "seat_y": 1.12, "seat_z": -0.1},
	{"id": "pt_samjogo", "kind": "fly", "req_ch": 10, "speed": 1.4, "fly_speed": 15.0, "height": 2.3, "ride": 1.4, "yaw": 0.0, "seat_y": 1.38, "seat_z": -0.4},
	{"id": "pt_jujak", "kind": "fly", "req_ch": 16, "speed": 1.4, "fly_speed": 19.0, "height": 2.8, "ride": 1.6, "yaw": 0.0, "seat_y": 1.62, "seat_z": -0.5},
	{"id": "pt_cheongryong", "kind": "fly", "req_ch": 26, "speed": 1.4, "fly_speed": 24.0, "height": 3.4, "ride": 1.9, "yaw": 0.0, "seat_y": 0.93, "seat_z": -0.2},
]

static func find(id: String) -> Variant:
	for m in MOUNTS:
		if m.id == id:
			return m
	return null

## 이 장까지 왔다면 부를 수 있는 탈것 id 들(도감 순서).
static func unlocked(ch: int) -> Array:
	var all := OS.get_environment("SAGA_MOUNT_ALL") != ""
	var out: Array = []
	for m in MOUNTS:
		if all or ch >= int(m.req_ch):
			out.append(m.id)
	return out
