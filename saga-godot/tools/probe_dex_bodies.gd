extends SceneTree
## G-0022 dex 인물 몸(assets/characters_dex, 저장소 밖 로컬 설치) 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dex_bodies.gd   → "PROBE dex_bodies OK" / "FAIL n"
## 폴더가 없으면 ① 물러서기만 본다(build(use_dex=true) 가 BODIES 몸을 돌려주고 "SKIP dex 없음").
## 있으면 표본 24개 id: ② 스켈레톤 하나·idle 있음 ③ idle 트랙 전부가 AnimationPlayer 기준 노드에서 뼈에 닿음(T포즈 방지)
## ④ 머리뼈 높이×배율이 1.30~1.60m(키 정규화) ⑤ 같은 id 두 번은 같은 몸·다른 id 는 여러 몸(8종 이상) ⑥ 인물 id·"self" 는 그 id 의 몸(build_hero) ⑦ 동작 라이브러리 18클립·루프

const VroidBody := preload("res://saga_core/world/vroid_body.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	var fb := VroidBody.build("probe_fallback", 2, null, true)
	if fb == null or fb.find_children("*", "Skeleton3D", true, false).is_empty():
		_fail("① use_dex 로 불렀는데 몸이 비었다")
	if fb != null:
		fb.free()
	if not VroidBody.dex_available():
		print("PROBE dex_bodies SKIP dex 없음(물러서기 ", "OK" if fails == 0 else "FAIL", ")")
		quit(1 if fails > 0 else 0)
		return
	var seen := {}
	for i in 24:
		var id := "probe_npc_%d" % i
		var v := VroidBody.build(id, 2, null, true)
		var v2 := VroidBody.build(id, 2, null, true)
		if v == null or v2 == null:
			_fail("몸 없음 " + id)
			continue
		seen[v.name] = true
		if v.name != v2.name:
			_fail("⑤ 같은 id 가 다른 몸 " + id)
		var skels := v.find_children("*", "Skeleton3D", true, false)
		var ap := v.get_node_or_null("AnimationPlayer") as AnimationPlayer
		if skels.size() != 1 or ap == null or not ap.has_animation("idle"):
			_fail("② 스켈레톤·idle " + id)
		else:
			var sk := skels[0] as Skeleton3D
			var anim := ap.get_animation("idle")
			var base := ap.get_node(ap.root_node)
			var hit := 0
			for t in anim.get_track_count():
				var p := String(anim.track_get_path(t))
				if base != null and base.has_node(NodePath(p.get_slice(":", 0))) and sk.find_bone(p.get_slice(":", 1)) >= 0:
					hit += 1
			if hit != anim.get_track_count():
				_fail("③ idle 트랙 %d/%d 만 닿음 %s" % [hit, anim.get_track_count(), id])
			var hb := VroidBody.find_bone_of(sk, VroidBody.HEAD_BONES)
			var hy := sk.get_bone_global_rest(hb).origin.y * v.scale.y
			if hy < 1.30 or hy > 1.60:
				_fail("④ 머리뼈 높이 %.2fm %s" % [hy, id])
		v.free()
		v2.free()
	## ⑥ G-0024 도감 인물 id 와 같은 이름의 몸(어린이 체형이어도 그 몸)·주인공 몸
	for hid in ["sg_zhugeliang", "jp_yukimura", "sg_liubei"]:
		var hb := VroidBody.build_hero(hid, 5)
		if hb == null or hb.name != hid:
			_fail("⑥ 인물 id 몸이 아니다 " + hid)
		if hb != null:
			hb.free()
	## ⑦ G-0025 동작 라이브러리 18클립(기본 8 + 이동·시전 10)·반복 클립은 루프
	var lib := load(VroidBody.DEX_LIB) as AnimationLibrary
	for c in ["idle", "walk", "sprint", "attack", "hit", "dodge", "death", "pickup", "jump", "fall", "land", "climb", "glide", "swim", "mantle", "skill", "burst", "plunge"]:
		if lib == null or not lib.has_animation(c):
			_fail("⑦ 동작 라이브러리에 클립 없음 " + c)
	for c in ["idle", "walk", "sprint", "fall", "climb", "glide", "swim", "plunge"]:
		if lib != null and lib.has_animation(c) and lib.get_animation(c).loop_mode != Animation.LOOP_LINEAR:
			_fail("⑦ 반복 클립이 루프가 아님 " + c)
	var sb := VroidBody.build_hero("self", 3)
	if sb == null or sb.name != VroidBody.DEX_SELF_ID:
		_fail("⑥ 주인공 몸이 DEX_SELF_ID 가 아니다")
	if sb != null:
		sb.free()
	if seen.size() < 8:
		_fail("⑤ 다른 id 24개가 %d 종 몸뿐" % seen.size())
	print("PROBE dex_bodies ", "OK" if fails == 0 else "FAIL %d" % fails, " (몸 ", seen.size(), "종)")
	quit(1 if fails > 0 else 0)
