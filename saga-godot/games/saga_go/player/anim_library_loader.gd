extends AnimationPlayer
## 103-4 — .tscn 텍스트에 `libraries = {"": ExtResource(...)}` 를 직접 써넣으면
## 파싱은 되지만 실제로 라이브러리가 등록 안 된다(2026-09-19, 실기 스크린샷에서
## VRoid 플레이어가 idle 대신 T포즈로 서 있는 걸 보고 발견 — `get_animation_library_list()`
## 가 빈 배열, `add_animation_library()` 를 코드로 부르면 정상 동작함을 헤드리스로 확인).
## 그래서 스크립트로 런타임에 등록한다. Player(부모)의 _ready() 가 idle 을 걸기 전에
## 이 노드의 _ready() 가 먼저 끝나야 한다 — Godot 은 자식의 _ready() 를 부모보다
## 먼저 호출하므로(AnimationPlayer 가 Player 의 자손) 순서는 항상 보장된다.

@export var library_path: String = ""

## 2026-09-29 — 공방 몸(char-forge)은 동작이 glb 안에 있어 library_path 가 비고, 임포트된 동작은 반복이 꺼져 있다.
const LOOP_CLIPS := ["idle", "walk", "sprint"]

func _ready() -> void:
	if library_path != "":
		add_animation_library("", load(library_path))
	for c in LOOP_CLIPS:
		if has_animation(c):
			get_animation(c).loop_mode = Animation.LOOP_LINEAR
