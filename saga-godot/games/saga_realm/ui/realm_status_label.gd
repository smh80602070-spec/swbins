extends Label

## FOREST gather_label.gd와 같은 폴링 패턴 — 값이 바뀌는 곳이 여럿이라도
## (명령 버튼·다음 달 버튼·성 버튼) 폴링이 신호 배선보다 단순하다.
##
## 2026-09-12 — 여러 성 추가로 agri/comm/sec/troops가 이제 current_city
## 안에 있다. 성 이름을 맨 앞에 붙여 "지금 어느 성을 보고 있는지"부터
## 보이게 했다(성 버튼으로 바꿀 수 있다).
##
## **2026-09-13 추가 — 성벽 파손율 + 재해 상시 표시.** VERTICAL_SLICE_REALM.md
## 13절이 "성벽 파손율(비율 표시값)은 보여줄 UI가 없어 뺐다"고 남긴 것을
## 채운다 — wall/wall_cap 백분율을 여기 더한다. 재해도 지금까지는
## next_month() 토스트(3초, 시작/해제 순간만)로만 보였는데, 그 사이
## 지속되는 동안엔 확인할 곳이 없었다 — disaster가 걸려 있으면 남은
## 개월과 함께 상시 표시한다.
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmOrders := preload("res://games/saga_realm/data/realm_orders.gd")
const NumberFormat := preload("res://saga_core/ui/number_format.gd")


func _process(_delta: float) -> void:
	var c: Dictionary = RealmSaveState.cities.get(RealmSaveState.current_city, {})
	var city_def := RealmCities.any_by_id(RealmSaveState.current_city)

	var wall_cap := RealmCities.wall_cap(RealmSaveState.current_city)
	var wall_pct := roundi(float(c.get("wall", 0)) / float(maxi(1, wall_cap)) * 100.0)

	var disaster_text := ""
	var disaster_key := String(c.get("disaster", ""))
	if not disaster_key.is_empty():
		var d := RealmOrders.disaster_by_key(disaster_key)
		disaster_text = " · %s %s(%d개월)" % [String(d.get("emoji", "")), String(d.get("name", "")), int(c.get("d_left", 0))]

	text = "%s · %d년 %d월 · 💰 %s · 🌾 %d · 🏪 %d · ⚖️ %d · 🛡️ %d · 🧱 %d%%%s · 재야 %d" % [
		String(city_def.get("name", "")),
		RealmSaveState.year, RealmSaveState.month,
		NumberFormat.comma(RealmSaveState.gold),
		int(c.get("agri", 0)), int(c.get("comm", 0)), int(c.get("sec", 0)), int(c.get("troops", 0)),
		wall_pct, disaster_text,
		RealmSaveState.found.size(),
	]
