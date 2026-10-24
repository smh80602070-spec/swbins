extends RefCounted

## G-0347 ① 지역 단위 전략 지도 — 한 화면 = 한 지역(나라). 웹 W-0400 REGIONS 와 같은 규칙(웹 region-view.js 가 아직 없어 고돗이 먼저 정함 —
## 웹이 옮겨 쓸 때 이 표가 정본, 티켓 메모에 적음):
##   확장 지역은 prov 하나 = 지역 하나 · 중국 주 열셋은 이웃 주끼리 넷으로 묶음(하북·중원·서촉·강남, 지역당 성 6~10).
##   prov 는 웹 data-city.js 성마다의 prov 그대로(고돗 성 표 realm_cities.gd 엔 칸이 없어 여기 둔다 — 성 id 안 바꿈).
##   이웃 = 두 지역 성 사이에 길(RealmCities.is_adjacent)이 하나라도 있으면. 표는 처음 부를 때 한 번 셈.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const REGIONS := [
	{"id": "hebei", "name": "하북", "provs": ["you", "ji", "bing", "qing"]},
	{"id": "zhongyuan", "name": "중원", "provs": ["yan", "si", "yu", "xu"]},
	{"id": "xishu", "name": "서촉", "provs": ["liang", "yong", "yi"]},
	{"id": "jiangnan", "name": "강남", "provs": ["jing", "yang"]},
	{"id": "kr", "name": "한국", "provs": ["kr"]},
	{"id": "jp", "name": "일본", "provs": ["jp"]},
	{"id": "jiao", "name": "교주", "provs": ["jiao"]},
	{"id": "xi", "name": "서역", "provs": ["xi"]},
	{"id": "nz", "name": "남중", "provs": ["nz"]},
	{"id": "tz", "name": "천축", "provs": ["tz"]},
	{"id": "mb", "name": "막북", "provs": ["mb"]},
	{"id": "cp", "name": "임읍", "provs": ["cp"]},
	{"id": "fu", "name": "균열", "provs": ["fu"]},
	{"id": "pf", "name": "폐허", "provs": ["pf"]},
	{"id": "my", "name": "묘역", "provs": ["my"]},
]

## 성 id → prov(웹 data-city.js)
const PROV_OF := {
	"chenliu": "yan", "puyang": "yan", "xuchang": "yu", "xiaopei": "xu", "xiapi": "xu", "luoyang": "si",
	"ye": "ji", "beihai": "qing", "runan": "yu", "wan": "jing", "shouchun": "yang", "jinyang": "bing",
	"changan": "si", "nanpi": "ji", "jiangxia": "jing", "xinye": "jing", "jianye": "yang", "chaisang": "yang",
	"tianshui": "yong", "hanzhong": "yi", "jixian": "you", "xiangyang": "jing", "jiangling": "jing", "kuaiji": "yang",
	"changsha": "jing", "wuwei": "liang", "chengdu": "yi", "jiangzhou": "yi", "beiping": "you", "yongan": "yi",
	"yangping": "kr", "guknae": "kr", "nakrang": "kr", "daebang": "kr", "wirye": "kr", "geumseong": "kr",
	"gimhae": "kr", "tsushima": "jp", "iki": "jp", "chikushi": "jp", "hyuga": "jp", "izumo": "jp",
	"kibi": "jp", "yamato": "jp", "nanhai": "jiao", "cangwu": "jiao", "hepu": "jiao", "yulin": "jiao",
	"jiaozhi": "jiao", "jiuzhen": "jiao", "rinan": "jiao", "dunhuang": "xi", "loulan": "xi", "yanqi": "xi",
	"khotan": "xi", "kucha": "xi", "kashgar": "xi", "dayuan": "xi", "zhuti": "nz", "jianning": "nz",
	"yuexi": "nz", "zangke": "nz", "yunnan": "nz", "xinggu": "nz", "yongchang": "nz", "shendu": "tz",
	"jiantuoluo": "tz", "daxia": "tz", "moqietuo": "tz", "sheyi": "tz", "jibin": "tz", "wuyishanli": "tz",
	"yunzhong": "mb", "yanmen": "mb", "dingxiang": "mb", "shangjun": "mb", "beidi": "mb", "shuofang": "mb",
	"wuyuan": "mb", "xianglin": "cp", "luorong": "cp", "dianchong": "cp", "zhuwu": "cp", "bijing": "cp",
	"xiquan": "cp", "quzu": "cp", "cheongwe": "fu", "noeseong": "fu", "gangcheol": "fu", "yuri": "fu",
	"hwanyeong": "fu", "jongmal": "fu", "janyeong": "fu", "pyedo": "pf", "janjae": "pf", "oyeom": "pf",
	"hoegok": "pf", "chimmuk": "pf", "yeokbyeong": "pf", "janhyang": "pf", "myomun": "my", "baekgol": "my",
	"chimgwan": "my", "honro": "my", "jinhon": "my", "yugol": "my", "simyeon": "my",
}

static var _region_of := {}
static var _neighbors := {}


static func _build() -> void:
	if not _region_of.is_empty():
		return
	var prov_region := {}
	for r: Dictionary in REGIONS:
		for p in r.provs:
			prov_region[p] = r.id
	for cid: String in PROV_OF:
		_region_of[cid] = String(prov_region.get(PROV_OF[cid], ""))
	var ids: Array = PROV_OF.keys()
	for r: Dictionary in REGIONS:
		_neighbors[r.id] = []
	for i in ids.size():
		for j in range(i + 1, ids.size()):
			var a := String(_region_of[ids[i]])
			var b := String(_region_of[ids[j]])
			if a == b or a == "" or b == "" or (_neighbors[a] as Array).has(b):
				continue
			if RealmCities.is_adjacent(ids[i], ids[j]):
				(_neighbors[a] as Array).append(b)
				(_neighbors[b] as Array).append(a)


## 성이 속한 지역 id(모르는 성이면 "")
static func region_of(city_id: String) -> String:
	_build()
	return String(_region_of.get(city_id, ""))


static func by_id(region_id: String) -> Dictionary:
	for r: Dictionary in REGIONS:
		if String(r.id) == region_id:
			return r
	return {}


static func name_of(region_id: String) -> String:
	return String(by_id(region_id).get("name", region_id))


## 그 지역 성 id 목록(성 표 순서)
static func cities_of(region_id: String) -> Array:
	_build()
	var out: Array = []
	for cid: String in PROV_OF:
		if String(_region_of[cid]) == region_id:
			out.append(cid)
	return out


## 길이 이어진 이웃 지역 id 목록
static func neighbors(region_id: String) -> Array:
	_build()
	return (_neighbors.get(region_id, []) as Array).duplicate()
