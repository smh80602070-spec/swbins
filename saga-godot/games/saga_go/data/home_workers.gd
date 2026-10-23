extends RefCounted

## G-0328 1만리 신수 일꾼 — 쉼터 마당에 신수를 앉히면 실제 시간으로 채집물을 모은다(팰월드 기지 일꾼 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 go.md 우선 3).
##   앉히기   가진 신수(도감 pet) 중 동행(eggs.buddy)이 아닌 것 · 칸 = 1 + 마당 등급(빈 마당 1 ~ 이름난 쉼터 5, data/homestead.gd TIERS) — 꾸밀수록 일꾼이 는다.
##   일       신수 능력 갈래(pets.gd bonus.stat)대로 — 무력 ⛏️ 강화석 조각(ore_s) · 지력 🌿 박하·꿀꽃 번갈아 · 통솔 🍖 짐승 고기.
##            일꾼마다 EVERY_MIN 분에 하나, 상한 CAP 개(쉼터 냥 수입과 같은 12시간). 끈 동안에도 흐른다(마당 냥과 같은 시계 Homestead.now()).
##   받기     쉼터 화면 「수확」이 냥과 함께 받는다. 내보내면 그때까지 모은 것을 먼저 받는다.
##   저장     PartyState.home.workers = [{pet, t}] — 쉼터 칸 안 순수 추가(SAVE_VERSION 그대로). SAGA_HOME_WORK=0 이면 끔.

const Homestead := preload("res://games/saga_go/data/homestead.gd")
const Pets := preload("res://saga_core/data/pets.gd")

const EVERY_MIN := 30.0
const CAP := 24
const MAX_SLOTS := 5
const JOBS := {
	"might": {"label": "⛏️ 캐기", "items": ["ore_s"]},
	"wisdom": {"label": "🌿 뜯기", "items": ["mint", "honey_flower"]},
	"command": {"label": "🍖 사냥", "items": ["meat"]},
}


static func on() -> bool:
	return OS.get_environment("SAGA_HOME_WORK") != "0"


static func list() -> Array:
	var h := Homestead.state()
	if typeof(h.get("workers")) != TYPE_ARRAY:
		h["workers"] = []
	return h.workers


static func slots() -> int:
	return mini(MAX_SLOTS, 1 + Homestead.tier())


static func job_of(pet_id: String) -> Dictionary:
	var p: Variant = Pets.find(pet_id)
	var st := String(p.bonus.stat) if p != null else "might"
	return JOBS.get(st, JOBS.might)


static func working(pet_id: String) -> bool:
	for w: Dictionary in list():
		if String(w.pet) == pet_id:
			return true
	return false


## 앉힐 수 없는 까닭("" 이면 됨). buddy·owned 는 부르는 쪽이 넘긴다(점검이 autoload 없이 부르게).
static func why(pet_id: String, owned: bool, buddy: String) -> String:
	if not on():
		return "꺼져 있다"
	if not owned:
		return "아직 만나지 못한 신수다"
	if pet_id == buddy:
		return "동행 중인 신수다"
	if working(pet_id):
		return "이미 일하고 있다"
	if list().size() >= slots():
		return "일꾼 자리가 없다(%d/%d — 마당을 꾸미면 는다)" % [list().size(), slots()]
	return ""


static func assign(pet_id: String, owned: bool, buddy: String) -> String:
	var w := why(pet_id, owned, buddy)
	if w != "":
		return w
	list().append({"pet": pet_id, "t": Homestead.now()})
	return ""


## 한 일꾼이 지금까지 모은 것 {item: n}
static func pending_of(w: Dictionary) -> Dictionary:
	var n := mini(CAP, int(maxf(Homestead.now() - float(w.t), 0.0) / (EVERY_MIN * 60.0)))
	if n <= 0:
		return {}
	var items: Array = job_of(String(w.pet)).items
	var out := {}
	for i in n:
		var it := String(items[i % items.size()])
		out[it] = int(out.get(it, 0)) + 1
	return out


static func pending() -> Dictionary:
	var out := {}
	if not on():
		return out
	for w: Dictionary in list():
		var p := pending_of(w)
		for k in p:
			out[k] = int(out.get(k, 0)) + int(p[k])
	return out


static func count(d: Dictionary) -> int:
	var n := 0
	for k in d:
		n += int(d[k])
	return n


## 받기 — 받은 것 {item: n}(빈 것이면 아무것도 안 함). 받은 몫만큼 시계를 당긴다(남은 자투리 시간은 이어서 셈).
static func collect(add_items: Callable) -> Dictionary:
	var got := pending()
	if got.is_empty():
		return got
	for w: Dictionary in list():
		var n := count(pending_of(w))
		if n >= CAP:
			w.t = Homestead.now()
		else:
			w.t = float(w.t) + float(n) * EVERY_MIN * 60.0
	add_items.call(got)
	return got


## 내보내기 — 모은 것을 먼저 받고 뺀다
static func release(pet_id: String, add_items: Callable) -> Dictionary:
	var got := {}
	for i in list().size():
		var w: Dictionary = list()[i]
		if String(w.pet) == pet_id:
			got = pending_of(w)
			if not got.is_empty():
				add_items.call(got)
			list().remove_at(i)
			break
	return got
