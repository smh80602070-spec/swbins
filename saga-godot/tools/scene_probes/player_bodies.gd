extends Node
## G-0065 [R-3] 세 판 플레이어 몸 — scene_probe_host 로 돈다(오토로드 필요). features gd.fs/st.player-vroid · gd.dg.hero-vroid.
## 판마다 플레이어 씬을 띄워 ① body_id 가 표대로 ② Visual 아래 Skeleton3D·머리 뼈(J_Bip_C_Head 또는 head) ③ AnimationPlayer 에 idle.
## dex 몸 폴더(assets/characters_dex, 저장소 밖 로컬 설치)가 없으면 SKIP 줄만 찍고 통과.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const PLAYERS := {
	"forest": ["res://games/saga_forest/player/ForestPlayer.tscn", "dj_yuri"],
	"story": ["res://games/saga_story/player/StoryPlayer.tscn", "self"],
	"dungeon": ["res://games/saga_dungeon/player/DungeonPlayer.tscn", "dj_gapju"],
}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func run() -> int:
	if not VroidBody.dex_available():
		print("  SKIP dex 몸 폴더 없음")
		return 0
	for game in PLAYERS:
		var p: Node3D = (load(String(PLAYERS[game][0])) as PackedScene).instantiate()
		add_child(p)
		for i in 3:
			await get_tree().process_frame
		if String(p.get("body_id")) != String(PLAYERS[game][1]):
			_fail("%s body_id %s" % [game, p.get("body_id")])
		var visual := p.get_node_or_null("Visual") as Node3D
		var skel: Skeleton3D = null
		if visual != null:
			for s in visual.find_children("*", "Skeleton3D", true, false):
				skel = s
				break
		if skel == null or (skel.find_bone("J_Bip_C_Head") < 0 and skel.find_bone("head") < 0):
			_fail("%s 몸에 뼈대·머리 뼈 없음" % game)
		var ap: AnimationPlayer = null
		if visual != null:
			for a in visual.find_children("*", "AnimationPlayer", true, false):
				ap = a
				break
		if ap == null or not (ap.has_animation("idle") or ap.has_animation("lib/idle") or Array(ap.get_animation_list()).any(func(n): return String(n).ends_with("idle"))):
			_fail("%s idle 동작 없음 %s" % [game, ap.get_animation_list() if ap else "AP 없음"])
		p.queue_free()
		await get_tree().process_frame
	return fails
