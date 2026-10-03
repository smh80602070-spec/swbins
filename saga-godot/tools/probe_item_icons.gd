extends SceneTree
## G-0016 아이콘 배선 자동 점검 — godot --headless --path saga-godot --script res://tools/probe_item_icons.gd → "PROBE item_icons OK" / "FAIL n"
## ① 무기 16종(weapons.gd WEAPONS) 전부 그림이 있다 ② 채집 재료 9 + 고기 전부 ③ 성유물 세트 다섯 전부 ④ 표의 모든 항목이 실제 파일로 열린다
## ⑤ 모르는 id·모르는 종류는 null(화면은 글자만) ⑥ apply() 가 null 이면 숨김, 있으면 보임 ⑦ 표가 정본 map.json 과 같다(tools/gen_item_icons.mjs 를 다시 돌린 결과와 어긋나지 않음)

const ItemIcons := preload("res://games/saga_go/data/item_icons.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Artifacts := preload("res://games/saga_go/data/artifacts.gd")
const Cooking := preload("res://games/saga_go/data/cooking.gd")

func _init() -> void:
	var fails := 0
	for wid: String in Weapons.WEAPONS:
		if ItemIcons.icon_for("weapon", wid) == null:
			fails += 1
			print("  ① 무기 그림 없음 ", wid)
	var mats: Array = Cooking.GATHER.keys()
	mats.append(Cooking.MEAT)
	for m: String in mats:
		if ItemIcons.icon_for("material", m) == null:
			fails += 1
			print("  ② 재료 그림 없음 ", m)
	for sid: String in Artifacts.SET_IDS:
		if ItemIcons.icon_for("artifact_set", sid) == null:
			fails += 1
			print("  ③ 성유물 세트 그림 없음 ", sid)
	for kind in ["weapon", "material", "consumable", "artifact_set"]:
		var tbl: Dictionary = {"weapon": ItemIcons.WEAPON, "material": ItemIcons.MATERIAL, "consumable": ItemIcons.CONSUMABLE, "artifact_set": ItemIcons.ARTIFACT_SET}[kind]
		for id: String in tbl:
			if ItemIcons.icon_for(kind, id) == null:
				fails += 1
				print("  ④ 표에 있는데 파일이 안 열림 ", kind, ":", id)
	if ItemIcons.icon_for("weapon", "w_nope") != null or ItemIcons.icon_for("nope", "x") != null or ItemIcons.make_rect("material", "zzz", 40) != null:
		fails += 1
		print("  ⑤ 모르는 id 가 그림을 돌려줌")
	var r := ItemIcons.blank_rect(40)
	ItemIcons.apply(r, "material", "mint")
	var shown := r.visible and r.texture != null
	ItemIcons.apply(r, "material", "zzz")
	if not shown or r.visible or r.texture != null:
		fails += 1
		print("  ⑥ apply 보임/숨김이 틀림")
	r.free()
	# ⑦ 표 개수가 정본 map.json 과 같다
	var f := FileAccess.open("res://assets/icons/map.json", FileAccess.READ)
	if f == null:
		fails += 1
		print("  ⑦ map.json 없음")
	else:
		var e: Dictionary = (JSON.parse_string(f.get_as_text()) as Dictionary).entries
		var n_w := 0
		for k: String in e:
			if k.begins_with("saga_go-godot:equip:") and e[k] is Dictionary and (e[k] as Dictionary).has("key"):
				n_w += 1
		if n_w != ItemIcons.WEAPON.size():
			fails += 1
			print("  ⑦ 무기 표 ", ItemIcons.WEAPON.size(), " ≠ map.json ", n_w, " — gen_item_icons.mjs 를 다시 돌릴 것")
	print("PROBE item_icons ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
