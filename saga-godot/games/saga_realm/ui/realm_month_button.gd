extends Button

## "다음 달" 버튼 — RealmSaveState.next_month()(정산) 실행 후 결과를 보여준다.
##
## **2026-09-12 고침 — `RealmSaveState.food`는 "여러 성" 확장(commit d41c687)
## 때 `cities[city_id].food`로 옮겨졌는데 이 스크립트가 안 따라와, 없는
## 최상위 `food` 프로퍼티를 읽으려다 파싱 자체가 실패하고 있었다(헤드리스
## 검증에서 "exit 0"만 보고 로그의 SCRIPT ERROR는 그때 안 훑어서 놓쳤던
## 것 — 이번 세션에서 발견). 정산은 성마다 따로 나니 `current_city`(HUD가
## "지금 조망 중인 성"으로 쓰는 것과 같은 관점) 기준으로 고쳤다.
##
## **2026-09-17 — PLAN.md 101-2 REALM ①후보 "월간 요약 카드".** 이 판은
## 달(月)이 다른 네 판의 "세션"에 해당하는 자연스러운 매듭이라(달마다
## 정산이 한 번씩 확정된다), 기존 3초 토스트를 GO save_button.gd 등과
## 같은 SessionCard로 올렸다 — 버튼을 누를 때마다 뜬다(DUNGEON처럼 "마지막"
## 이벤트로 좁힐 이유가 없다, 이건 애초에 사용자가 직접 누르는 동작이다).

const Toast := preload("res://saga_core/ui/toast.gd")
const SessionCard := preload("res://saga_core/ui/session_card.gd")
const TOAST_SEC := 3.0


func _ready() -> void:
	text = "다음 달"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	## rtk.js endMonth() "if (!st.started || st.result) return null;" —
	## 승패가 정해지면 다음 달로 안 넘어간다(2026-09-14, check_result()).
	## 여기서 미리 걸러 잘못된 "💰 +0" 안내가 뜨지 않게 한다.
	if not RealmSaveState.result.is_empty():
		Toast.show(self, "이미 승부가 났습니다 — %s" % RealmSaveState.result, TOAST_SEC)
		return
	var city_id := RealmSaveState.current_city
	var before_gold := RealmSaveState.gold
	var before_food := int(RealmSaveState.cities[city_id].food)
	RealmSaveState.next_month()

	var gold_diff := RealmSaveState.gold - before_gold
	var food_diff := int(RealmSaveState.cities[city_id].food) - before_food
	SessionCard.show(get_tree().current_scene, "%d년 %d월 정산" % [RealmSaveState.year, RealmSaveState.month], [
		"💰 %s%d" % ["+" if gold_diff >= 0 else "", gold_diff],
		"🌾 %s%d" % ["+" if food_diff >= 0 else "", food_diff],
		"성 %d개 보유" % RealmSaveState.cities.size(),
	])
