extends RefCounted
## G-0018 단계 2 — 사가고 공격 종류별 타격감 강도 표(손잡이). 값은 전부 여기 한 곳. 사용자가 해 보고 고친다.
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

## 지금 처리 중인 피해의 종류. field_combat 가 공격을 시작할 때 정하고 매 물리 프레임 처음에 "normal" 로 되돌린다.
static var kind := "normal"
static var old_style := OS.get_environment("SAGA_FEEL_OLD") != ""


## CombatFeel.hit 의 마지막 인자. 옛 방식이면 {} (= 기본 상수).
static func tune() -> Dictionary:
	if old_style:
		return {}
	return KINDS.get(kind, KINDS.normal)
