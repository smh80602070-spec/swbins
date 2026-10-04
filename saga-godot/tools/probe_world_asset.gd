extends SceneTree
## G-0014 WorldAsset 자동 점검 — 옛 props 경로 → assets/world 새 GLB 대응이 열리고 배율이 맞는지.
##   godot --headless --path saga-godot --script res://tools/probe_world_asset.gd   → "PROBE world_asset OK" / "PROBE world_asset FAIL n"
## ① 표의 모든 행: 새 경로로 바뀌고, PackedScene 으로 열리고, 배율 ≠ 1 ② 짝 없는 경로·props 밖 경로는 그대로, 배율 1
## ③ 새 GLB 높이 × 배율 ≈ 옛 GLB 높이(집·탑 제외 — 집은 바닥 면적 쪽으로 절충, 바위는 높이 비 0.5~1.1)  ④ load_scene() 이 null 을 돌려주지 않음

const TOL := 0.12   # 높이 오차 12% 안

func _aabb_h(n: Node, xf: Transform3D = Transform3D.IDENTITY) -> Array:
	var lo := INF
	var hi := -INF
	var t := xf
	if n is Node3D:
		t = xf * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		var b := t * (n as MeshInstance3D).mesh.get_aabb()
		lo = minf(lo, b.position.y)
		hi = maxf(hi, b.end.y)
	for c in n.get_children():
		var r := _aabb_h(c, t)
		lo = minf(lo, float(r[0]))
		hi = maxf(hi, float(r[1]))
	return [lo, hi]

func _height(path: String) -> float:
	var ps := load(path) as PackedScene
	if ps == null:
		return -1.0
	var n := ps.instantiate()
	var r := _aabb_h(n)
	n.free()
	return float(r[1]) - float(r[0])

func _init() -> void:
	var fails := 0
	for f: String in WorldAsset.MAP.keys():
		var old := WorldAsset.PROPS_DIR + f
		var p := WorldAsset.path(old)
		var k := WorldAsset.k(old)
		var ok := p != old and p.begins_with(WorldAsset.WORLD_DIR) and WorldAsset.load_scene(old) != null and not is_equal_approx(k, 1.0)
		if not ok:
			fails += 1
			print("  ① 실패 ", f, " → ", p, " k=", k)
			continue
		if not f.begins_with("house_") and not f.begins_with("tower_"):
			var ho := _height(old)
			var hn := _height(p) * k
			## 바위는 옛 것이 1.1m 정육면체, 새 것은 납작해서 높이는 못 맞추고 바닥 면적 쪽으로 절충한 값(G-0021) — 높이 비 0.5~1.1.
			var is_rock := f.begins_with("rock_")
			if ho <= 0.0 or (is_rock and (hn / ho < 0.5 or hn / ho > 1.1)) or (not is_rock and absf(hn - ho) / ho > TOL):
				fails += 1
				print("  ③ 높이 어긋남 ", f, " 옛 ", snappedf(ho, 0.01), " 새×k ", snappedf(hn, 0.01))
	for q in ["res://assets/generated/props/market_s9_09.glb", "res://assets/generated/variants/CommonTree_1__go_village.glb", "res://other/foo.glb"]:
		if WorldAsset.path(q) != q or not is_equal_approx(WorldAsset.k(q), 1.0):
			fails += 1
			print("  ② 짝 없는 경로가 바뀜 ", q)
	print("PROBE world_asset ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
