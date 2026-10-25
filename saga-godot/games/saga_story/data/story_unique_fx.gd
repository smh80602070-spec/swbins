extends RefCounted

## G-0399 4종횡 고유 장비 특수 효과(디아블로 고유 — 구조만) — 웹 saga-story/js/unique-fx.js(W-0437 ②) 짝, 수치 그대로.
##   kill   잡몹 처치마다 — hp: 최대 체력 비율 회복 · mp: 기력 더하기
##   boss   미니보스·보스 처치마다 — hp
##   cast   무예를 쓸 때마다 — refund: 그 무예 기력 비율 되돌림 · hp
## 요구 수준 미달이면 안 걸림. FX 표는 K 생성기 표(W-0435)가 오면 줄만 늘린다. 세이브 안 바뀜. SAGA_UNIQUE_FX=0 이면 끔.
## 처치는 story_enemy._die, 시전은 플레이어 _skill_pose(모든 무예가 지나는 자리 — 쓴 기력은 그 프레임 시작 mp 와의 차)가 부른다.

const FX := {
	"u_sword": {"on": "kill", "hp": 0.02, "desc": "처치마다 체력 2% 회복"},
	"u_ring": {"on": "kill", "mp": 3.0, "desc": "처치마다 기력 +3"},
	"u_cape": {"on": "boss", "hp": 0.15, "desc": "미니보스·보스를 쓰러뜨리면 체력 15% 회복"},
	"u_glove": {"on": "cast", "refund": 0.25, "desc": "무예를 쓰면 그 기력의 25% 를 되돌림"},
	"u_necklace": {"on": "cast", "hp": 0.01, "desc": "무예를 쓸 때마다 체력 1% 회복"},
}


static func on() -> bool:
	return OS.get_environment("SAGA_UNIQUE_FX") != "0"


## 낀(요구 수준을 채운) 고유의 효과들
static func worn(S: Object) -> Array:
	var out: Array = []
	for k: Variant in (S.equipped as Dictionary).values():
		var key := String(k)
		if FX.has(key):
			var d: Dictionary = StoryCombat.item_def(key)
			if not d.is_empty() and int(S.level) >= int(d.get("need", 0)):
				out.append(FX[key])
	return out


## 사건 하나 — 걸린 효과 수. player 는 hp·max_hp·mp·max_mp 를 가진 몸.
static func fire(kind: String, S: Object, player: Object, cost := 0.0) -> int:
	if not on() or player == null:
		return 0
	var n := 0
	for f: Dictionary in worn(S):
		if String(f.on) != kind:
			continue
		n += 1
		if f.has("hp"):
			var mh := float(player.get("max_hp"))
			player.set("hp", minf(mh, float(player.get("hp")) + roundf(mh * float(f.hp))))
		if f.has("mp"):
			player.set("mp", minf(float(player.get("max_mp")), float(player.get("mp")) + float(f.mp)))
		if f.has("refund") and cost > 0.0:
			player.set("mp", minf(float(player.get("max_mp")), float(player.get("mp")) + roundf(cost * float(f.refund))))
	return n


## 「내 정보」 줄 — 낀 고유 효과가 있을 때만
static func me_row(S: Object) -> Dictionary:
	if not on():
		return {}
	var L := worn(S)
	if L.is_empty():
		return {}
	var d: Array = []
	for f: Dictionary in L:
		d.append(String(f.desc))
	return {"label": "⭐ 고유 효과", "value": "%d" % L.size(), "detail": " · ".join(d)}
