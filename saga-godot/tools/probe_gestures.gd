extends SceneTree

## GO 대화 몸짓(106장 ㉙: world/talk_face.gd 의 한글 모음 → 입 모양·표정·깜박임·손짓 세기) 자동 점검 — 화면 없는 순수 규칙.
##   godot --headless --path saga-godot --script res://tools/probe_gestures.gd
## ① 표 길이·값 범위(VISEMES 5·VOWEL_VISEME 21·VISEME_KIND 5·MOODS 5) ② viseme_of: 대표 음절·한글 첫·끝 글자·한글 아닌 글자는 -1·한글 11172 자 전부 0~4
## ③ 상수 앞뒤(입 문턱<열림·표정 세기≤1·깜박임 간격·글자 흘리기 속도) ④ 뼈대·블렌드셰이프를 흉내 낸 몸에 attach: 두 번째는 같은 노드·뼈대 없으면 null·앞(+Z/-Z) 판별
## ⑤ speak → 입 모양 번호·세기·set_talking 끄면 닫힘 ⑥ set_mood: 모르는 이름은 ""·표정이 천천히 오름 ⑦ 눈 깜박임이 BLINK_MAX 안에 한 번 일어남 ⑧ 손짓 influence 가 켜지면 1 쪽·끄면 0 쪽.
## 끝에 "PROBE gestures OK" 또는 "PROBE gestures FAIL n".

const TalkFace := preload("res://games/saga_go/world/talk_face.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 몸 하나를 흉내 낸다 — Skeleton3D(머리·오른팔·발목·발끝) + 입·표정·깜박임 블렌드셰이프가 있는 메시. toe_z: 발끝이 발목보다 +Z 면 양수.
func _make_body(toe_z: float) -> Node3D:
	var body := Node3D.new()
	var skel := Skeleton3D.new()
	body.add_child(skel)
	for n in ["J_Bip_C_Head", "J_Bip_R_UpperArm", "J_Bip_R_LowerArm", "J_Bip_R_Foot", "J_Bip_R_ToeBase"]:
		skel.add_bone(n)
	skel.set_bone_rest(3, Transform3D(Basis(), Vector3(0, 0.1, 0)))
	skel.set_bone_parent(4, 3)
	skel.set_bone_rest(4, Transform3D(Basis(), Vector3(0, 0, toe_z)))
	var mesh := ArrayMesh.new()
	var shapes: Array = TalkFace.VISEMES + TalkFace.MOODS.values() + [TalkFace.BLINK_SHAPE]
	for s in shapes:
		mesh.add_blend_shape(s)
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0, 0, 0), Vector3(1, 0, 0), Vector3(0, 1, 0)])
	var bs: Array = []
	for s in shapes:
		var t: Array = []
		t.resize(Mesh.ARRAY_MAX)
		t[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3.ZERO, Vector3.ZERO, Vector3.ZERO])
		bs.append(t)
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, bs)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	body.add_child(mi)
	return body


## 소스 글자에서 `const <이름> := 숫자` 를 읽는다.
func _const_float(path: String, name: String) -> float:
	var re := RegEx.create_from_string("const %s\\s*:?=\\s*([0-9.]+)" % name)
	var m := re.search(FileAccess.get_file_as_string(path))
	return m.get_string(1).to_float() if m else -1.0


func _initialize() -> void:
	# ① 표
	check(TalkFace.VISEMES.size() == 5 and TalkFace.VISEME_KIND.size() == 5 and TalkFace.MOODS.size() == 5, "입 모양·입 그림 종류 각 5 · 표정 5")
	var table_ok: bool = TalkFace.VOWEL_VISEME.size() == 21
	for v in TalkFace.VOWEL_VISEME:
		table_ok = table_ok and int(v) >= 0 and int(v) <= 4
	var used := {}
	for v in TalkFace.VOWEL_VISEME:
		used[int(v)] = true
	check(table_ok and used.size() == 5, "VOWEL_VISEME: 가운뎃소리 21개 · 값 0~4 · 다섯 입 모양이 모두 쓰임")

	# ② viseme_of
	var A := TalkFace.viseme_of
	check(A.call("가") == 0 and A.call("개") == 3 and A.call("거") == 4 and A.call("구") == 2 and A.call("기") == 1 and A.call("고") == 4, "대표 음절: 가 A·개 E·거 O·구 U·기 I·고 O")
	check(A.call("으") == 2 and A.call("의") == 1 and A.call("와") == 0 and A.call("워") == 4 and A.call("위") == 1 and A.call("요") == 4, "겹모음: 으 U · 의 I · 와 A · 워 O · 위 I · 요 O")
	check(A.call("각") == A.call("가") and A.call("힣") == 1 and A.call("가나다") == 0, "받침은 입 모양을 안 바꿈 · 한글 끝 글자(힣 → I) · 여러 글자면 첫 글자")
	check(A.call("") == -1 and A.call(" ") == -1 and A.call("!") == -1 and A.call("a") == -1 and A.call("ㄱ") == -1 and A.call("1") == -1, "빈 글자·빈칸·문장부호·영문·자모·숫자는 닫는다(-1)")
	var all_ok := true
	for c in range(0xAC00, 0xD7A4):
		var v: int = A.call(char(c))
		if v < 0 or v > 4:
			all_ok = false
			break
	check(all_ok, "한글 음절 11172 자 전부 입 모양 0~4")

	# ③ 상수
	check(TalkFace.MOUTH_SHOW < TalkFace.MOUTH_OPEN and TalkFace.MOUTH_OPEN <= 1.0 and TalkFace.MOOD_W <= 1.0 and TalkFace.MOOD_W > 0.0, "입 문턱 < 열림 ≤ 1 · 표정 세기 0~1")
	check(TalkFace.BLINK_MIN > 0.0 and TalkFace.BLINK_MIN < TalkFace.BLINK_MAX and TalkFace.BLINK_SEC < TalkFace.BLINK_MIN, "깜박임: 간격 MIN<MAX · 감은 시간이 간격보다 짧음")
	var cps := _const_float("res://games/saga_go/world/story_quest.gd", "REVEAL_CPS")  # story_quest 는 autoload 를 불러 --script 로는 컴파일이 안 된다 — 글자에서 읽는다
	check(cps > 5.0 and cps < 120.0, "글자 흘리기 초당 %.0f 자(읽을 만한 속도)" % cps)

	# ④ attach
	var none := Node3D.new()
	root.add_child(none)
	check(TalkFace.attach(none) == null, "뼈대 없는 몸엔 안 붙고 null")
	var body := _make_body(0.2)
	root.add_child(body)
	var tf: Node = TalkFace.attach(body)
	check(tf != null and TalkFace.attach(body) == tf and tf.get_parent() is Skeleton3D and tf.name == "TalkFace", "attach: 뼈대 아래 TalkFace · 두 번째는 같은 노드")
	check(bool(tf.call("has_mouth")) and float(tf.call("front_sign")) == 1.0 and float(tf.get("influence")) == 0.0, "블렌드셰이프를 찾음 · 발끝이 +Z 면 앞 +1 · 처음엔 손짓 0")
	var back := _make_body(-0.2)
	root.add_child(back)
	var tb: Node = TalkFace.attach(back)
	check(float(tb.call("front_sign")) == -1.0, "발끝이 -Z 면 앞 -1(몸마다 뼈 방향이 달라도 앞을 잰다)")
	var bare := Node3D.new()
	var bskel := Skeleton3D.new()
	bare.add_child(bskel)
	root.add_child(bare)
	var tbare: Node = TalkFace.attach(bare)
	check(tbare != null and not bool(tbare.call("has_mouth")), "블렌드셰이프·뼈가 없어도 조용히 붙음(has_mouth false)")
	tbare.call("speak", "가")
	tbare.call("_process", 0.1)

	# ⑤ speak
	tf.call("set_talking", true)
	tf.call("speak", "구")
	for i in 4:
		tf.call("_process", 0.02)
	var st: Array = tf.call("mouth_state")
	check(int(st[0]) == 2 and float(st[1]) > 0.3, "speak(구) → U 입이 열림 %s" % str(st))
	tf.call("speak", "!")
	for i in 40:
		tf.call("_process", 0.02)
	check(float((tf.call("mouth_state") as Array)[1]) < 0.05, "문장부호를 말하면 입이 닫힘(세기 → 0)")
	tf.call("speak", "가")
	tf.call("set_talking", false)
	for i in 40:
		tf.call("_process", 0.02)
	check(float((tf.call("mouth_state") as Array)[1]) < 0.05 and not bool(tf.call("is_talking")), "말을 끝내면 입이 닫히고 is_talking false")

	# ⑥ 표정
	tf.call("set_mood", "joy")
	tf.call("_process", 0.02)
	var first := float(tf.call("mood_weight", "joy"))
	for i in 100:
		tf.call("_process", 0.02)
	var settled := float(tf.call("mood_weight", "joy"))
	tf.call("set_mood", "엉뚱")
	for i in 150:
		tf.call("_process", 0.02)
	check(first > 0.0 and first < settled and absf(settled - TalkFace.MOOD_W) < 0.02 and float(tf.call("mood_weight", "joy")) < 0.02, "표정: 천천히 올라 MOOD_W(%.2f)에 닿고 · 모르는 이름은 \"\"(= 풀림) %.2f→%.2f" % [TalkFace.MOOD_W, first, settled])
	for m in TalkFace.MOODS:
		tf.call("set_mood", m)
		tf.call("_process", 0.02)
	check(float(tf.call("mood_weight", "fun")) > 0.0 and float(tf.call("mood_weight", "nope")) == 0.0, "다섯 표정 이름을 다 받음 · 없는 표정 세기 0")
	tf.call("set_mood", "")

	# ⑦ 깜박임
	var blinked := false
	var t := 0.0
	while t < TalkFace.BLINK_MAX + TalkFace.BLINK_SEC * 3.0:
		tf.call("_process", 0.02)
		t += 0.02
		if float(tf.call("blink_weight")) > 0.99:
			blinked = true
	check(blinked, "눈 깜박임이 BLINK_MAX(%.1f초) 안에 한 번 일어남" % TalkFace.BLINK_MAX)

	# ⑧ 손짓 세기
	tf.call("set_talking", true)
	for i in 100:
		tf.call("_process", 0.02)
	var on := float(tf.get("influence"))
	tf.call("set_talking", false)
	for i in 100:
		tf.call("_process", 0.02)
	var off := float(tf.get("influence"))
	check(on > 0.95 and off < 0.05, "손짓 influence: 말하면 1 쪽(%.2f) · 끝나면 0 쪽(%.2f)" % [on, off])

	for n in [none, body, back, bare]:
		n.queue_free()
	print("PROBE gestures ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
