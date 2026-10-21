extends RefCounted

## G-0286 3마을 「내 정보」 model(웹 saga-forest/js/me-adapter.js 짝) — 전투가 없어 입은 것 = 옷 넷(forest_wear PARTS),
## 능력치 = 생활 수치(돈·솜씨도 찍은 점·걸음) · 솜씨도.

const Workshop := preload("res://games/saga_forest/data/forest_workshop.gd")


static func model(hud: Node) -> Dictionary:
	var slots: Array = []
	var owned := 0
	for p: Dictionary in ForestWear.PARTS:
		var key := ForestSaveState.wearing(String(p.key))
		var it: Dictionary = ForestWear.item(String(p.key), key)
		slots.append({"label": String(p.name), "item": String(it.get("name", ""))})
		for o: Dictionary in (p.list as Array):
			if ForestSaveState.owns_wear(String(p.key), String(o.key)):
				owned += 1
	var api: RefCounted = ForestSaveState.passive_api()
	var stats: Array = [
		{"label": "돈", "value": "%d" % ForestSaveState.gold},
		{"label": "솜씨도", "value": "%d / %d" % [api.call("used"), api.call("points")], "detail": "남은 점 %d" % int(api.call("left"))},
		{"label": "걸음", "value": "×%.2f" % float(Workshop.walk())},
		{"label": "가진 옷", "value": "%d" % owned},
	]
	var wb := hud.get_node_or_null("WorkshopButton") if hud != null else null
	var grow := {}
	if wb != null and wb.has_method("open_screen"):
		grow = {"label": "🌿 솜씨도 (F2)", "open": Callable(wb, "open_screen")}
	return {"name": "나", "sub": "마을 살림", "slots": slots, "stats": stats, "grow": grow}
