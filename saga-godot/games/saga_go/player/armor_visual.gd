extends RefCounted
## G-0060 — 낀 성유물이 몸에 갑옷 조각으로 보인다(101-3 G "성장 가시화"). 자체툴 `eq_<시대>_<등급>_<부위>` GLB 54 를 VRoid 뼈에 붙인다.
##   부위: 꽃 → chest · 깃 → shoulder · 해시계 → arm · 술잔 → leg + boot · 관 → head(다섯 다 끼면 여섯 부위, 좌우 포함 10 조각).
##   등급(그 성유물 하나): ★4 는 Lv 0~7 → 1, 8~ → 2 · ★5 는 0~7 → 1, 8~15 → 2, 16~ → 3.
##   시대(인물 era): 삼국지·한국사·일본사 → past · 세계사 → present · 균열(가상)·폐허(가상) → future · 나머지 → past.
##   GLB 규약(license.json·tools/world-forge/data/equip_slots.json): 원점 = 붙일 뼈의 머리, 인물 앞 = Blender -Y(= 고돗 +Z, 몸 앞과 같다).
##   왼쪽 부위(J_Bip_L_*)는 오른쪽에 X 뒤집은 사본. 몸마다 균등 배율 = 머리 뼈 높이 / 1.5m(기준 몸).
## 붙이는 길(앵커·배율·거울)은 G-0063 에서 다섯 판 공용 saga_core/world/bone_gear.gd 로 옮겼다(사가마을 옷도 쓴다).
## G-0083 — K-0081 몸 맞춤: 가슴판은 어깨 폭 비율로 X 만(fit "chest"), 관은 앞·윗머리(_Hair_)·신은 신발(_Shoes_) 표면을 숨긴다.

const BoneGear := preload("res://saga_core/world/bone_gear.gd")
const TAG := "armor"

const DIR := "res://assets/world/"
const PARTS_OF := {"flower": ["chest"], "plume": ["shoulder"], "sands": ["arm"], "goblet": ["leg", "boot"], "circlet": ["head"]}
## 부위 → [왼쪽(또는 가운데) 뼈 이름 후보, 오른쪽 뼈 이름 후보(거울 부위만)] — VRoid 이름 먼저, 공방 몸(UE 식) 이름 다음.
const BONES := {
	"head": [BoneGear.HEAD_BONES, []],
	"chest": [BoneGear.CHEST_BONES, []],
	"shoulder": [BoneGear.L_UPPER_ARM, BoneGear.R_UPPER_ARM],
	"arm": [BoneGear.L_LOWER_ARM, BoneGear.R_LOWER_ARM],
	"leg": [BoneGear.L_LOWER_LEG, BoneGear.R_LOWER_LEG],
	"boot": [BoneGear.L_FOOT, BoneGear.R_FOOT],
}
const FUTURE_ERAS := ["균열(가상)", "폐허(가상)"]
## 부위 → 숨길 몸 재질 이름 조각(equip_slots.json armor_slots.hides → hide_match, K-0081). 상의·소매·바지는 한 메시라 빈칸(K 정본).
const HIDES := {"head": ["_Hair_"], "boot": ["_Shoes_"]}


static func era_of(era: String) -> String:
	if era == "세계사":
		return "present"
	if era in FUTURE_ERAS:
		return "future"
	return "past"


static func grade_of(art: Dictionary) -> int:
	var lv := int(art.get("lv", 0))
	if lv < 8:
		return 1
	if int(art.get("rarity", 4)) >= 5 and lv >= 16:
		return 3
	return 2


## 낀 성유물 → 붙일 조각 목록 [{slot, part, path, bones, mirror}] — 화면 없이 셈(점검이 부른다). 거울 부위는 조각 하나에 mirror=true(붙일 때 둘).
static func pieces_for(artifacts: Array, era: String) -> Array:
	var out: Array = []
	var e := era_of(era)
	for a: Dictionary in artifacts:
		for part: String in PARTS_OF.get(String(a.get("slot", "")), []):
			var b: Array = BONES[part]
			out.append({"slot": String(a.slot), "part": part, "path": "%seq_%s_%d_%s.glb" % [DIR, e, grade_of(a), part],
				"bones": b[0], "mirror_bones": b[1], "mirror": not (b[1] as Array).is_empty(),
				"fit": "chest" if part == "chest" else "", "hides": HIDES.get(part, [])})
	return out


## 몸(Visual)에 조각을 붙인다(옛 조각은 먼저 치움). 붙인 GLB 수를 돌려준다.
static func attach(body: Node3D, pieces: Array) -> int:
	clear(body)
	if body == null:
		return 0
	var n := 0
	for p: Dictionary in pieces:
		var got := BoneGear.attach(body, String(p.path), p.bones, p.mirror_bones if bool(p.mirror) else [], TAG, "Armor_%s" % p.part, String(p.get("fit", "")))
		if got > 0:
			BoneGear.hide_surfaces(body, p.get("hides", []), TAG)
		n += got
	return n


static func body_scale(skel: Skeleton3D) -> float:
	return BoneGear.body_scale(skel)


## 몸에 붙은 갑옷 조각을 치운다(앵커째, 숨긴 머리카락·신발은 되돌림).
static func clear(body: Node3D) -> void:
	BoneGear.clear(body, TAG)


## 붙어 있는 조각 노드들(점검용).
static func worn(body: Node3D) -> Array:
	return BoneGear.worn(body, TAG)
