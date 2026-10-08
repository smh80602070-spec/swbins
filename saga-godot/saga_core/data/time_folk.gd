extends RefCounted

## G-0117 — 사가천하 시간 틈 사람 아홉(웹 saga-realm data-force.js TIME_OFFICERS 그대로 — 이름·한자 지어낸 가명).
## characters.gd HEROES(도감 몸과 짝)에 안 넣는다 — 천하 재야(realm_officer_pool)로만 나오고, Characters.find() 가 여기까지 찾는다.
## 웹 `body`(사람 몸 GLB)는 고돗에 없어 뺐다.
const TIME_FOLK := [
	{"id": "tm_gangseo", "name": "강서", "hanja": "剛誓", "era": "현대(가상)", "faction": "시간 틈", "rarity": 4, "trait": "might",
	 "stats": {"might": 84, "wisdom": 42, "command": 74}, "emoji": "🛡️", "quote": "방패 뒤로 서십시오. 이 성문은 제가 막습니다."},
	{"id": "tm_gongseok", "name": "공석", "hanja": "工石", "era": "현대(가상)", "faction": "시간 틈", "rarity": 3, "trait": "virtue",
	 "stats": {"might": 68, "wisdom": 58, "command": 62}, "emoji": "🦺", "quote": "성벽이요? 사흘이면 두 겹으로 올립니다."},
	{"id": "tm_geumdam", "name": "금담", "hanja": "金談", "era": "현대(가상)", "faction": "시간 틈", "rarity": 4, "trait": "wisdom",
	 "stats": {"might": 40, "wisdom": 86, "command": 64}, "emoji": "💼", "quote": "군자금은 모으는 게 아니라 굴리는 겁니다."},
	{"id": "tm_myeongbyeon", "name": "명변", "hanja": "明辯", "era": "현대(가상)", "faction": "시간 틈", "rarity": 3, "trait": "wisdom",
	 "stats": {"might": 34, "wisdom": 88, "command": 56}, "emoji": "⚖️", "quote": "설전이라면 제 쪽이 이깁니다. 근거가 있으니까요."},
	{"id": "tm_doha", "name": "도하", "hanja": "道河", "era": "현대(가상)", "faction": "시간 틈", "rarity": 3, "trait": "wisdom",
	 "stats": {"might": 46, "wisdom": 82, "command": 50}, "emoji": "💻", "quote": "봉화보다 빠른 소식길을 알고 있어요."},
	{"id": "tm_seongyeon", "name": "성연", "hanja": "星緣", "era": "미래(가상)", "faction": "시간 틈", "rarity": 4, "trait": "virtue",
	 "stats": {"might": 50, "wisdom": 86, "command": 76}, "emoji": "🧭", "quote": "별자리가 이 시대 것과 조금 달라요. 그래도 길은 찾습니다."},
	{"id": "tm_gwedo", "name": "궤도", "hanja": "軌道", "era": "미래(가상)", "faction": "시간 틈", "rarity": 4, "trait": "virtue",
	 "stats": {"might": 66, "wisdom": 70, "command": 84}, "emoji": "🧑‍🚀", "quote": "대원들은 제가 데려갑니다. 한 명도 두고 가지 않아요."},
	{"id": "tm_eunha", "name": "은하", "hanja": "銀河", "era": "미래(가상)", "faction": "시간 틈", "rarity": 3, "trait": "might",
	 "stats": {"might": 76, "wisdom": 58, "command": 68}, "emoji": "🚀", "quote": "여기 중력은 가볍네요. 창도 가볍게 들립니다."},
	{"id": "tm_yeongjeom", "name": "영점", "hanja": "零點", "era": "미래(가상)", "faction": "시간 틈", "rarity": 4, "trait": "might",
	 "stats": {"might": 88, "wisdom": 50, "command": 62}, "emoji": "🦾", "quote": "의체 출력 백 퍼센트. 일기토, 받아 드리죠."},
]


static func find(id: String) -> Variant:
	for h in TIME_FOLK:
		if h.id == id:
			return h
	return null
