extends RefCounted

## G-0209 — 4종횡 잡몹 명단. 웹 saga-web/saga-story/js/data-enemy.js ENEMIES 32종에서 뽑음(2026-10-12, 일회용 node 스크립트 — 손으로 고치지 말고 웹 표를 고치면 함께 다시 뽑는다).
## 2나락 games/saga_dungeon/data/dungeon_enemies.gd(134종)와는 다른 사본이다(웹도 판마다 따로) — 판끼리 참조하지 않는다(check_refs).
## 이름은 웹에서 이미 이름 정책을 거친 표시 글자. kind human|beast · form(짐승 몸 모양, 사람이면 "") · weapon(사람 무기 — bow·staff 는 멀리서 쏜다).
## tier 1: lv 1~5 · 2: 6~12 · 3: 13~25 · 4: 26~ (웹 tierOf). 보스(BOSSES)는 사냥터마다 맵이 정한 그대로라 안 옮긴다.

const ENEMIES: Array[Dictionary] = [
	{"name": "황건적", "kind": "human", "color": "#c9a83a", "form": "", "weapon": "club", "tier": 1},
	{"name": "산적", "kind": "human", "color": "#6b5030", "form": "", "weapon": "axe", "tier": 1},
	{"name": "도적떼", "kind": "human", "color": "#5a4a58", "form": "", "weapon": "sword", "tier": 1},
	{"name": "들개", "kind": "beast", "color": "#8a7358", "form": "quad", "weapon": "", "tier": 1},
	{"name": "떠돌이 병졸", "kind": "human", "color": "#6a6a74", "form": "", "weapon": "spear", "tier": 1},
	{"name": "노략 궁수", "kind": "human", "color": "#9a8a5a", "form": "", "weapon": "bow", "tier": 1},
	{"name": "유민 폭도", "kind": "human", "color": "#7a6a4a", "form": "", "weapon": "club", "tier": 1},
	{"name": "굶주린 승냥이", "kind": "beast", "color": "#6a5a48", "form": "quad", "weapon": "", "tier": 1},
	{"name": "왜구", "kind": "human", "color": "#8a4a4a", "form": "", "weapon": "sword", "tier": 2},
	{"name": "마적", "kind": "human", "color": "#7a5a3a", "form": "", "weapon": "sword", "tier": 2},
	{"name": "오랑캐 궁수", "kind": "human", "color": "#7a6a4a", "form": "", "weapon": "bow", "tier": 2},
	{"name": "거란 기병", "kind": "human", "color": "#5a6a8a", "form": "", "weapon": "spear", "tier": 2},
	{"name": "남만 코끼리병", "kind": "beast", "color": "#8a8a92", "form": "quad", "weapon": "", "tier": 2},
	{"name": "요동 철기", "kind": "human", "color": "#4a5a7a", "form": "", "weapon": "spear", "tier": 2},
	{"name": "왜군 낭인", "kind": "human", "color": "#5a3a3a", "form": "", "weapon": "sword", "tier": 2},
	{"name": "중장 방패병", "kind": "human", "color": "#4a4a5a", "form": "", "weapon": "halberd", "tier": 2},
	{"name": "여진 궁수", "kind": "human", "color": "#6a7a5a", "form": "", "weapon": "bow", "tier": 3},
	{"name": "몽골 기병", "kind": "human", "color": "#8a7a5a", "form": "", "weapon": "spear", "tier": 3},
	{"name": "왜군 조총병", "kind": "human", "color": "#7a4a4a", "form": "", "weapon": "staff", "tier": 3},
	{"name": "위군 창병", "kind": "human", "color": "#31609f", "form": "", "weapon": "spear", "tier": 3},
	{"name": "수군 척후선", "kind": "human", "color": "#3a6a8a", "form": "", "weapon": "bow", "tier": 3},
	{"name": "중장 창병", "kind": "human", "color": "#3a4a6a", "form": "", "weapon": "halberd", "tier": 3},
	{"name": "자객대", "kind": "human", "color": "#2a2a3a", "form": "", "weapon": "sword", "tier": 3},
	{"name": "산짐승 무리", "kind": "beast", "color": "#4a3a2a", "form": "quad", "weapon": "", "tier": 3},
	{"name": "철갑 중장병", "kind": "human", "color": "#6a6a7a", "form": "", "weapon": "halberd", "tier": 4},
	{"name": "근위 기병", "kind": "human", "color": "#8a3a4a", "form": "", "weapon": "spear", "tier": 4},
	{"name": "연노 사수", "kind": "human", "color": "#5a5a6a", "form": "", "weapon": "bow", "tier": 4},
	{"name": "수군 함대", "kind": "human", "color": "#3a5a7a", "form": "", "weapon": "sword", "tier": 4},
	{"name": "흑기병", "kind": "human", "color": "#3a3a44", "form": "", "weapon": "halberd", "tier": 4},
	{"name": "창귀병(槍鬼兵)", "kind": "human", "color": "#5a2a3a", "form": "", "weapon": "sword", "tier": 4},
	{"name": "황실 궁병", "kind": "human", "color": "#6a5a8a", "form": "", "weapon": "bow", "tier": 4},
	{"name": "뇌격 기병", "kind": "human", "color": "#3a3a5a", "form": "", "weapon": "spear", "tier": 4},
]


## 웹 tierOf(stage) — 사냥터 lv 로 단계
static func tier_of(lv: float) -> int:
	if lv <= 5.0:
		return 1
	if lv <= 12.0:
		return 2
	if lv <= 25.0:
		return 3
	return 4


## 웹 poolFor(stage, false) — 그 단계만(비면 전체)
static func pool_for(lv: float) -> Array[Dictionary]:
	var t := tier_of(lv)
	var out: Array[Dictionary] = []
	for e: Dictionary in ENEMIES:
		if int(e.tier) == t:
			out.append(e)
	return out if not out.is_empty() else ENEMIES


## G-0210 — 세 시대 적(웹 data-side.js ERA_ENEMIES 8, 2026-10-12 같은 꼴로 옮김 — 3D model 칸은 뺌). 사냥터 잡몹의 ERA_SHARE 가 여기서.
## 무기 없는 짐승은 weapon "" — 정찰 드론(staff)=탄환·강철 거신(halberd)=탱커는 웹 규칙 그대로 무기로 가른다.
const ERA_SHARE := 0.4
const ERA_ENEMIES: Array[Dictionary] = [
	{"name": "잿빛 떼쥐", "kind": "beast", "color": "#6a6a6a", "form": "quad", "weapon": "", "tier": 1, "era": "modern"},
	{"name": "정찰 드론", "kind": "beast", "color": "#8a9aa8", "form": "bird", "weapon": "staff", "tier": 1, "era": "future"},
	{"name": "벼락 말벌", "kind": "beast", "color": "#d8b030", "form": "bird", "weapon": "", "tier": 2, "era": "modern"},
	{"name": "경비 보행기", "kind": "human", "color": "#7a8a9a", "form": "", "weapon": "club", "tier": 2, "era": "future"},
	{"name": "떠도는 망자", "kind": "human", "color": "#5a7a5a", "form": "", "weapon": "club", "tier": 3, "era": "modern"},
	{"name": "별바다 손님", "kind": "beast", "color": "#6ac08a", "form": "ogre", "weapon": "", "tier": 3, "era": "future"},
	{"name": "진압 특공대", "kind": "human", "color": "#3a3a44", "form": "", "weapon": "staff", "tier": 4, "era": "modern"},
	{"name": "강철 거신", "kind": "beast", "color": "#9a6a4a", "form": "ogre", "weapon": "halberd", "tier": 4, "era": "future"},
]


## 웹 eraPoolFor(tierOf(lv)) — 그 단계 시대 적, 없으면 가까운 아래 단계
static func era_pool_for(lv: float) -> Array[Dictionary]:
	for t in range(tier_of(lv), 0, -1):
		var out: Array[Dictionary] = []
		for e: Dictionary in ERA_ENEMIES:
			if int(e.tier) == t:
				out.append(e)
		if not out.is_empty():
			return out
	return []


## 웹 enemyRole — 활·조총 ranged · 이름 "기병" dash · "코끼리"·미늘창 tank · 나머지 melee(마법형은 spawner 가 melee 에서 굴린다)
static func role_of(sp: Dictionary) -> String:
	var w := String(sp.get("weapon", ""))
	var n := String(sp.get("name", ""))
	if w == "bow" or w == "staff":
		return "ranged"
	if n.contains("기병"):
		return "dash"
	if n.contains("코끼리") or w == "halberd":
		return "tank"
	return "melee"
