extends RefCounted

## G-0217 2나락 경락도(經絡圖) — PoE식 패시브 그물을 직업(낀 무기)마다(웹 saga-web/saga-dungeon/js/meridian.js W-0180 고돗판).
## 본보기 games/saga_story/data/story_constellation.gd(G-0214)·games/saga_go/data/go_starchart.gd(G-0215).
## 규칙·화면은 공용(saga_core/data/passive_web.gd·ui/passive_web_screen.gd), 정의는 data/passive_def.json(tools/passive_from_web.mjs saga-dungeon),
## 찍은 것은 DungeonSaveState.passive {직업키: {start, taken}} — 웹은 인물마다지만 고돗 2나락엔 인물 레벨이 없어 무예 점수처럼 직업마다.
##
## 점수(재해석) = 첫 별 1 + 그 직업이 받은 무예 점수 누계(남은 점 + 올린 단, 방 깰 때 award_point) + 보스 처치 수, 상한 CAP 60(웹 = 레벨 30 + 층/3).
## 첫 점은 무명 또는 지금 직업 문만 · 되돌리기는 은총 자리 방(grace_sites.grace_room)에서만, 한 마디 금 DROP_GOLD.
## 효과: 작은·이름난 마디의 능력치 키는 DungeonRunState._sum_eff 가 그대로 더한다(atkPct·hpPct·critPct …) · allResPct 는 원소 저항에.
## 기력이 없는 고돗 2나락의 다시 읽기: mpRegen → 무예 재사용 줄임(웹 기력 회복 7/초 기준 7/(7+합)) · 혈공 → 무예마다 최대 체력 5% 내고 재사용 ×0.6 ·
## 무심 → 재사용 ×0.5·무예 피해 ×0.7 · 회피가 없어 유수 → 받는 피해 줄임 0·돌진 거리 ×1.5 · 귀신걸음 → 이동 +20%(마디 능력치)·받는 피해 +10%.
## 고돗 무예에 짝 있는 특수 키만 잇는다: boltShotAdd·swingRangePct·chainHopsAdd·summonCountAdd·buffDurPct·curseDurPct·healBonusPct·healOnFloor·piercePct
## (echoPct·drainPct·goldPct 는 원래 _sum_eff 키). 짝 없음(효과 0): novaExtraRing·dashInvulnAdd·sigCdPct·sigDmgPct·shadowSigPct·worldFindPct.
## 이 파일은 점검(SceneTree)이 preload 하는 파일들(dungeon_run_state 등)이 부르므로 autoload 이름을 직접 쓰지 않는다(트리에서 찾는다).
## 효과 배수는 api.rev 가 바뀔 때만 다시 센다(static 엔 객체 말고 id 만 — 종료 segfault, G-0214).

const DEF_PATH := "res://games/saga_dungeon/data/passive_def.json"
## 손잡이 — 웹 dg.pw.* 기본값
const CAP := 60
const DROP_GOLD := 100
const ONECUT := 1.3
const LONE := 1.25
const SCALE_HP := 0.35
const SCALE := 1.5
const FARSIGHT_NEAR := 0.7
const NEAR_M := 2.4 * 1.6   # 붙어서 = 기본 근접 사거리(melee_attack ATK_RANGE)의 1.6배 안(웹 reach*1.6)
const MP_BASE := 7.0        # 웹 MP_REGEN
const CD_FLOOR := 0.5
const BLOOD_HP := 0.05
const BLOOD_CD := 0.6
const MINDLESS_CD := 0.5
const MINDLESS_SKILL := 0.7
const FLOW_DASH := 1.5
const GHOST_TAKE := 1.1
## 웹 FMT 그대로(mpRegen 만 고돗 뜻으로)
const LABEL := {"atkPct": ["공격", "%"], "hpPct": ["체력", "%"], "critPct": ["치명", "%p"], "atkSpdPct": ["손 속도", "%"], "moveSpdPct": ["이동", "%"],
	"reachPct": ["사거리", "%"], "guardPct": ["받는 피해 줄임", "%"], "allResPct": ["모든 저항", "%"], "mpRegen": ["기력(무예 재사용 줄임)", "/초"],
	"skillPct": ["무예 위력", "%"], "drainPct": ["흡혈", "%"], "goldPct": ["금", "%"], "worldFindPct": ["물건 찾기", "%"], "boltShotAdd": ["화살", "발"],
	"swingRangePct": ["휘두르기 범위", "%"], "chainHopsAdd": ["번개 튐", "번"], "novaExtraRing": ["물결 고리", "겹"], "echoPct": ["되풀이", "%"],
	"piercePct": ["관통", "%"], "dashInvulnAdd": ["돌진 무적", "초"], "buffDurPct": ["버프 길이", "%"], "healBonusPct": ["회복량", "%"],
	"healOnFloor": ["방마다 회복", "%"], "sigCdPct": ["필살 대기 줄임", "%"], "sigDmgPct": ["필살 피해", "%"], "summonCountAdd": ["분신", "기"],
	"curseDurPct": ["저주 길이", "%"], "shadowSigPct": ["그림자 필살", "%"]}
## 다시 해석한 규칙의 카드 글(정의 파일은 생성물이라 안 고침)
const DESC := {"bloodcast": "무예를 쓸 때마다 최대 체력 5%를 낸다, 무예 재사용 ×0.6",
	"mindless": "무예 재사용 ×0.5, 무예 피해 ×0.7",
	"flow": "받는 피해 줄임이 없다, 돌진 거리 ×1.5",
	"ghost": "이동 +20%, 받는 피해 +10%",
	"lone": "동료 능력치·분신이 없다, 주는 피해 +25%"}
const RULES := ["bloodcast", "diamond", "onecut", "fiveone", "flow", "lone", "farsight", "scale", "mindless", "ghost"]

static var _def: Dictionary = {}
static var _fx: Dictionary = {}
static var _fx_api_id := 0
static var _fx_rev := -1


static func _node(name: String) -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null(name) if ml != null else null


static func definition() -> Dictionary:
	if _def.is_empty():
		_def = (load("res://saga_core/data/passive_web.gd") as GDScript).call("load_def", DEF_PATH)
	return _def


## 지금 낀 무기가 정하는 직업 키
static func class_key() -> String:
	var eq := _node("DungeonEquipmentState")
	return DungeonItems.class_key_for_weapon(eq.get("weapon") if eq != null else {})


## 그 직업이 받은 무예 점수 누계 = 남은 점 + 그 직업 무예에 올린 단
static func earned(cls: String) -> int:
	var ss := _node("DungeonSkillState")
	if ss == null:
		return 0
	var n: int = int(ss.call("points_for", cls))
	for sk: Dictionary in DungeonSkills.skills_of(cls):
		n += int(ss.call("rank_of", str(sk.key)))
	return n


static func boss_kills() -> int:
	var sv := _node("DungeonSaveState")
	return int((sv.get("scenario") as Dictionary).get("boss_kills", 0)) if sv != null else 0


static func points_total(cls: String) -> int:
	return mini(CAP, 1 + earned(cls) + boss_kills())


static func api() -> RefCounted:
	var sv := _node("DungeonSaveState")
	return sv.call("passive_api") if sv != null else null


## 효과 배수 묶음 — 경락도가 비면 전부 1(또는 0)이라 기존 수치 그대로
static func fx() -> Dictionary:
	var a := api()
	if a == null:
		return {}
	if a.get_instance_id() == _fx_api_id and int(a.rev) == _fx_rev:
		return _fx
	_fx_api_id = a.get_instance_id()
	_fx_rev = int(a.rev)
	var r := {}
	for k in RULES:
		r[k] = bool(a.has(k))
	var regen := float(a.sum("mpRegen"))
	var sums := {}
	for k in ["allResPct", "boltShotAdd", "swingRangePct", "chainHopsAdd", "summonCountAdd", "buffDurPct", "curseDurPct", "healBonusPct", "healOnFloor", "piercePct"]:
		sums[k] = float(a.sum(k))
	_fx = {
		"dmg": (ONECUT if r.onecut else 1.0) * (LONE if r.lone else 1.0) * (1.0 + sums.piercePct / 200.0),
		"skill": MINDLESS_SKILL if r.mindless else 1.0,
		"cd": maxf(CD_FLOOR, MP_BASE / (MP_BASE + regen)) * (BLOOD_CD if r.bloodcast else 1.0) * (MINDLESS_CD if r.mindless else 1.0),
		"dash": FLOW_DASH if r.flow else 1.0,
		"rules": r,
		"sums": sums,
	}
	return _fx


static func has_rule(rule: String) -> bool:
	return bool((fx().get("rules", {}) as Dictionary).get(rule, false))


static func mul(key: String) -> float:
	return float(fx().get(key, 1.0))


## 특수 키 합(빈 경락도 = 0)
static func add(key: String) -> float:
	return float((fx().get("sums", {}) as Dictionary).get(key, 0.0))


## _sum_eff 가 더하는 값 — 지금 직업 그물의 능력치 합
static func val(eff_key: String) -> float:
	var a := api()
	return float(a.sum(eff_key)) if a != null else 0.0


## 받는 피해 배수 — 유수면 막기(guardPct) 없음, 귀신걸음이면 +10%
static func take_mul(base: float) -> float:
	var f := fx()
	if f.is_empty():
		return base
	var r: Dictionary = f.rules
	return (1.0 if r.flow else base) * (GHOST_TAKE if r.ghost else 1.0)


## 주는 피해 배수(기본·무예 둘 다) — 일격·독행·관통 + 역린(체력 35% 밑) + 천리안(붙어서 −30%)
static func dmg_mul(dist: float, hp: float, max_hp: float) -> float:
	var f := fx()
	if f.is_empty():
		return 1.0
	var m: float = f.dmg
	var r: Dictionary = f.rules
	if r.scale and max_hp > 0.0 and hp < max_hp * SCALE_HP:
		m *= SCALE
	if r.farsight and dist <= NEAR_M:
		m *= FARSIGHT_NEAR
	return m


## 타격 한 번의 배수 — 역린·천리안이 없으면 체력·거리를 안 본다(기본 공격·무예 _strike 가 부른다)
static func hit_mul(tree: SceneTree, enemy: Node, from: Node3D) -> float:
	var f := fx()
	if f.is_empty():
		return 1.0
	var r: Dictionary = f.rules
	if not (r.scale or r.farsight):
		return float(f.dmg)
	var hp := 1.0
	var mx := 1.0
	var ph := tree.get_first_node_in_group("player_health")
	if ph != null:
		hp = float(ph.get("hp"))
		mx = float(ph.get("max_hp"))
	var d := INF
	if enemy is Node3D and from != null:
		d = (enemy as Node3D).global_position.distance_to(from.global_position)
	return dmg_mul(d, hp, mx)


## 혈공 — 무예 한 번 값(최대 체력 5%). 0 이면 혈공 아님
static func blood_cost(tree: SceneTree) -> float:
	if not has_rule("bloodcast"):
		return 0.0
	var ph := tree.get_first_node_in_group("player_health")
	return float(ph.get("max_hp")) * BLOOD_HP if ph != null else 0.0


## 방을 깰 때 — 방마다 회복(healOnFloor %)
static func on_room_clear(tree: SceneTree) -> void:
	var pct := add("healOnFloor")
	var ph := tree.get_first_node_in_group("player_health")
	if pct > 0.0 and ph != null:
		ph.call("heal_by", float(ph.get("max_hp")) * pct / 100.0)


## 오행귀일 — 원소 피해 {fire: n, …} 를 가장 센 원소 하나로 모은다
static func elem(dmgs: Dictionary) -> Dictionary:
	if dmgs.is_empty() or not has_rule("fiveone"):
		return dmgs
	var top := ""
	var tot := 0.0
	for k in dmgs:
		var v := float(dmgs[k])
		if v > 0.0:
			tot += v
			if top == "" or v > float(dmgs[top]):
				top = String(k)
	return dmgs if top == "" else {top: tot}


## 지금 플레이어가 은총 자리 방에 서 있나
static func in_grace(tree: SceneTree) -> bool:
	var g := tree.get_first_node_in_group("dungeon_grace")
	var p := tree.get_first_node_in_group("player") as Node3D
	return g != null and p != null and int(g.call("room_index_at", p.global_position.z)) == int(g.get("grace_room"))


## 화면 막음 — "" 면 됨. 첫 점은 무명·지금 직업 문만 · 되돌리기는 은총 자리 방·금 DROP_GOLD
static func gate(tree: SceneTree, id: String) -> String:
	var a := api()
	if a == null:
		return ""
	var nd: Dictionary = a.node(id)
	if nd.is_empty():
		return ""
	if String(nd.k) == "o":
		if a.store.start != null:
			return ""
		var key := String(nd.get("s", ""))
		var cls := class_key()
		return "" if key == "none" or key == cls else "지금 직업(%s)의 문이나 무명에서만 시작한다" % String(DungeonItems.CLASS_NAMES.get(cls, cls))
	if a.state(id) == "taken":
		if not in_grace(tree):
			return "되돌리기는 은총 자리 방에서만"
		var gs := _node("DungeonGoldState")
		if gs == null or int(gs.get("gold")) < DROP_GOLD:
			return "되돌리기 금 %d 이 모자란다" % DROP_GOLD
	return ""


static func pay_drop() -> void:
	var gs := _node("DungeonGoldState")
	if gs != null:
		gs.call("spend", DROP_GOLD)


static func desc(nd: Dictionary) -> String:
	return String(DESC.get(String(nd.get("rule", "")), nd.get("desc", "")))


static func fmt(stats: Dictionary) -> String:
	var parts: Array = []
	for k in stats:
		var lab: Array = LABEL.get(k, [k, ""])
		var v := float(stats[k])
		parts.append("%s %s%s%s" % [lab[0], "+" if v >= 0.0 else "", str(snappedf(v, 0.1)).trim_suffix(".0"), lab[1]])
	return " · ".join(parts)
