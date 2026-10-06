extends Label

## fruit_label.gd(나무 하나짜리 첫 슬라이스)를 대체 — ForestSaveState.items가
## 여러 채집물(과일·솔방울·광석·꽃·물고기)을 담게 되면서 이름도 맞춰
## 바꿨다. GO party_label.gd와 같은 폴링 패턴(값이 바뀌는 곳이 여럿이라도
## — gatherable_builder.gd·fishing_spot.gd·villager_builder.gd — 폴링이
## 신호 배선보다 단순하다, master.md 33장). 제외 목록 3번(부탁 보상 골드)
## 추가로 골드도 같이 보여준다. 제외 목록 6번(계절행사 8일) 추가로
## 오늘이 그 여덟 날 중 하나면 이름도 같이 보여준다.

func _process(_delta: float) -> void:
	var line := "🎒 채집물 %d개 · 💰 %d" % [ForestSaveState.total_items(), ForestSaveState.gold]
	var e := ForestFestival.event_of_today()
	if not e.is_empty():
		line += " · 🎊 %s" % e.name
	text = line
