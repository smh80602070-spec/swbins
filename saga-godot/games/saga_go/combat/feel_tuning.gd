extends RefCounted
## G-0018 단계 2 — 사가만리 공격 종류별 타격감 강도 표(손잡이). 값은 전부 여기 한 곳. 사용자가 해 보고 고친다.
## CombatFeel.hit(대상, 피해, 치명, 이 표의 한 줄)로 넘어가 히트스톱 길이·화면 흔들림·숫자 크기를 바꾼다.
## 기준선 "normal" 은 CombatFeel 의 옛 상수(히트스톱 70ms·흔들림 1배·팝 1배)와 같다 → 기본 공격 느낌은 그대로고 센 기술만 묵직해진다.
##   전/후 비교: 환경변수 SAGA_FEEL_OLD=1 로 띄우면 이 표를 끄고 옛 방식(전부 같은 강도)으로 돌아간다.
## stop_ms: 히트스톱(치명이면 +50ms) · shake_mul: 화면 흔들림 배율(0=없음) · pop_mul: 피해 숫자 크기 배율 · quiet: 타격음 끔

const KINDS := {
	"normal": {"stop_ms": 70, "shake_mul": 1.0, "pop_mul": 1.0},      # 기본 공격 1·2타(옛 값 그대로)
	"finisher": {"stop_ms": 100, "shake_mul": 1.5, "pop_mul": 1.15},  # 기본 공격 마지막 타
	"heavy": {"stop_ms": 130, "shake_mul": 2.0, "pop_mul": 1.3},      # 강공격(길게 누름)
	"plunge": {"stop_ms": 150, "shake_mul": 2.5, "pop_mul": 1.4},     # 낙하 공격
	"skill": {"stop_ms": 90, "shake_mul": 1.5, "pop_mul": 1.1},       # 원소 스킬(고유 스킬 포함)
	"burst": {"stop_ms": 160, "shake_mul": 2.5, "pop_mul": 1.5},      # 원소 폭발
	"reaction": {"stop_ms": 40, "shake_mul": 0.6, "pop_mul": 0.9},    # 반응이 둘레 적에게 옮겨 입히는 피해
	"dot": {"stop_ms": 0, "shake_mul": 0.0, "pop_mul": 0.7, "quiet": true}, # 지속 피해 틱(연소·감전·중독) — 틱마다 멈추면 연타가 끊긴다
}

## 입력 선행(G-0018 단계 3) — 공격 후딜 중에 누른 단추를 이 시간(초) 안이면 기억했다가 후딜이 끝나는 즉시 낸다. 마지막 입력 하나만 보존. 0 이면 끔.
const INPUT_BUFFER_SEC := 0.15

## 이동 느낌(G-0018 단계 4) — 환경변수 SAGA_MOVE=0|1|2 로 고른다. 기본은 1 산뜻(G-0124, 사용자 10-09 결정 — 예전 기본 0 이라 평소 플레이에서 안 돌았다).
## 0 = 옛 방식(속도가 즉시 바뀌고 착지 경직 없음). SAGA_FEEL_OLD=1 이면 0.
const DEFAULT_MOVE := 1
##   accel/decel: 땅에서 목표 속도로 가고/멈출 때 초당 m/s 변화 · air: 공중에서 방향을 바꾸는 속도 · land_sec/land_mul: 높은 데서 떨어져 착지하면 그 시간 동안 이동 속도 배율
const MOVE_PRESETS := [
	{}, # 0 옛 방식
	{"accel": 60.0, "decel": 80.0, "air": 25.0, "land_sec": 0.0, "land_mul": 1.0},   # 1 산뜻 — 0.1초 안에 최고 속도, 공중 방향 전환은 약간 느리게
	{"accel": 30.0, "decel": 40.0, "air": 14.0, "land_sec": 0.12, "land_mul": 0.5},  # 2 묵직 — 출발·정지에 몸무게, 공중 제어 약함, 높은 착지 때 잠깐 주춤
]
const HARD_LAND_VY := 9.0 # 착지 직전 낙하 속도(m/s)가 이보다 빠르면 "높은 착지"(점프 정점에서 내려오는 속도는 약 7.5)

## 적 행동·난이도(G-0018 단계 5) — 기본 1.0 = 옛 밸런스 그대로. 환경변수로 바꿔 해 본다(결정은 사용자).
##   SAGA_ENEMY_DMG: 적이 플레이어에게 주는 피해 배율(보스 기술 포함) · SAGA_ENEMY_TELL: 일반 적 공격 예고 시간 배율(1.5 = 더 길게 보여 줌)
##   SAGA_ENEMY_STRAFE=0: 적이 공격 뒤 쉬는 동안 옆으로 돌며 간격을 지키는 동작 끔(옛 방식은 제자리). SAGA_FEEL_OLD=1 이면 이 셋 다 옛 방식.
static var enemy_dmg_mul := _env_mul("SAGA_ENEMY_DMG")
static var enemy_tell_mul := _env_mul("SAGA_ENEMY_TELL")
static var enemy_strafe := OS.get_environment("SAGA_FEEL_OLD") == "" and OS.get_environment("SAGA_ENEMY_STRAFE") != "0"
const STRAFE_SPEED_MUL := 0.45 # 쉬는 동안 옆걸음 속도(적 속도 배)
const STRAFE_KEEP_M := 1.4     # 이보다 가까우면 뒤로 물러난다

static func _env_mul(name: String) -> float:
	var v := OS.get_environment(name)
	if v == "" or OS.get_environment("SAGA_FEEL_OLD") != "":
		return 1.0
	return clampf(v.to_float(), 0.25, 4.0) if v.is_valid_float() else 1.0

## 카메라 타격 당김(G-0018 단계 4) — camera_rig.shake(흔들림 m)마다 시야각을 흔들림 × CAM_PUNCH_DEG_PER_M 도(최대 CAM_PUNCH_MAX_DEG) 좁혔다가 초당 CAM_PUNCH_RECOVER_DEG_PER_SEC 도로 되돌린다.
## 기본 공격(0.06m)은 약 0.9°, 강공격(0.12m)은 1.8°, 낙하·폭발(0.15m)은 2.25°. SAGA_CAM_PUNCH=0 이면 끔(배율, 기본 1), SAGA_FEEL_OLD=1 이면 끔.
const CAM_PUNCH_DEG_PER_M := 15.0
const CAM_PUNCH_MAX_DEG := 3.0
const CAM_PUNCH_RECOVER_DEG_PER_SEC := 14.0
static var cam_punch_mul := 0.0 if OS.get_environment("SAGA_FEEL_OLD") != "" else (OS.get_environment("SAGA_CAM_PUNCH").to_float() if OS.get_environment("SAGA_CAM_PUNCH").is_valid_float() else 1.0)

## 지금 처리 중인 피해의 종류. field_combat 가 공격을 시작할 때 정하고 매 물리 프레임 처음에 "normal" 로 되돌린다.
static var kind := "normal"
static var move_preset: Dictionary = {} if OS.get_environment("SAGA_FEEL_OLD") != "" else MOVE_PRESETS[move_index()]

## 고른 이동 프리셋 번호 — SAGA_MOVE 가 비면 DEFAULT_MOVE.
static func move_index() -> int:
	var e := OS.get_environment("SAGA_MOVE")
	return clampi(int(e) if e != "" else DEFAULT_MOVE, 0, MOVE_PRESETS.size() - 1)
static var old_style := OS.get_environment("SAGA_FEEL_OLD") != ""


## CombatFeel.hit 의 마지막 인자. 옛 방식이면 {} (= 기본 상수).
## 입력 선행 시간(초). 옛 방식(SAGA_FEEL_OLD)이면 0 = 후딜 중 입력은 버려진다.
static func input_buffer_sec() -> float:
	return 0.0 if old_style else INPUT_BUFFER_SEC


static func tune() -> Dictionary:
	if old_style:
		return {}
	return KINDS.get(kind, KINDS.normal)
