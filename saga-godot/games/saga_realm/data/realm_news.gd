extends RefCounted

## G-0194 — 사가천하 영내 소식(웹 W-0105 · data-news.js 의 고돗 짝). "내 땅 안에서 달마다 일어나는 발견이 없다"(재미 표준 E)와
## "인물이 숫자다"를 한 카드로 — 달을 넘기면 내 성 가운데 하나에서 소식이 뜨고, 그 성 태수가 한 줄 말하며, 세 갈래(금 / 병 / 민심)를 고른다.
## 갈래 축은 고정: 0 = 금(세금·장터) · 1 = 병(징병·훈련) · 2 = 민심(치안·구휼). 효과는 이미 있는 값만(금·성의 troops·train·sec·food·comm·agri·태수 충성) — 새 판정 없음.
## 대사 두 벌 — 태수가 "호전"(militant) 특성이면 거친 말, 아니면 점잖은 말(realm_traits.gd). 실명 금지(전부 가상 글).
## 굴림은 결정적 해시(realm_tactics.gd hash01 — 시나리오·해·달·성): 성마다 달 CHANCE, 한 달에 하나, 쌓여 있는 소식은 MAX_PENDING 까지.
##   기존 사건 체인(realm_events.gd)·_rng 난수열은 안 건드린다(사건·전투 결과가 그대로).

const CHANCE := 0.12        # 웹 "12%/달/성" 그대로
const MAX_PENDING := 3
const AXES := ["금", "병", "민심"]

## months: 비면 아무 달 · 아니면 그 달들만
const NEWS := {
	"harvest": {"name": "풍년", "emoji": "🌾", "months": [7, 8, 9, 10], "text": "%s 들녘에 이삭이 고개를 숙였습니다.",
		"rough": "곳간이 터지겠소! 이참에 칼을 갈아 둡시다.", "gentle": "올해는 하늘이 도왔습니다. 백성과 나누면 좋겠습니다.",
		"choices": [{"label": "세금을 더 걷는다", "gold": 300, "sec": -3}, {"label": "군량으로 병사를 먹인다", "food": 3000, "train": 4}, {"label": "추수 잔치를 연다", "sec": 8, "gold": -100}]},
	"drought": {"name": "가뭄", "emoji": "☀️", "months": [5, 6, 7, 8], "text": "%s 우물이 바닥을 드러냅니다.",
		"rough": "물이 없으면 칼도 녹슬지. 빨리 손을 쓰시오.", "gentle": "논이 갈라졌습니다. 서둘러 도와야 합니다.",
		"choices": [{"label": "곡물 값을 올려 판다", "gold": 250, "sec": -6}, {"label": "병사를 풀어 둑을 쌓는다", "agri": 20, "train": -3}, {"label": "곳간을 열어 구휼한다", "sec": 10, "food": -2500}]},
	"bandits": {"name": "도적 출몰", "emoji": "🗡️", "months": [], "text": "%s 고갯길에 도적 떼가 나타났습니다.",
		"rough": "내게 맡기시오. 모가지를 꿰어 오겠소!", "gentle": "길손이 끊겼습니다. 어떻게 하시겠습니까.",
		"choices": [{"label": "통행세를 걷어 경비를 산다", "gold": 150, "sec": -2}, {"label": "토벌대를 보낸다", "train": 6, "troops": -100}, {"label": "도적을 달래 백성으로 들인다", "sec": 6, "troops": 150}]},
	"talent": {"name": "인재 소문", "emoji": "📜", "months": [], "text": "%s 저잣거리에 재주꾼이 숨어 산다는 말이 돕니다.",
		"rough": "쓸 만한 놈이면 끌어오면 그만이오.", "gentle": "예를 갖춰 청하면 마음을 열지도 모릅니다.",
		"choices": [{"label": "사례금을 걸어 일을 맡긴다", "gold": -100, "comm": 20}, {"label": "군에 들여 조련을 맡긴다", "train": 8}, {"label": "학당을 열어 가르치게 한다", "sec": 5, "loyal": 4}]},
	"relic": {"name": "유물 발견", "emoji": "🏺", "months": [], "text": "%s 성벽 밑에서 옛 그릇이 나왔습니다.",
		"rough": "팔아서 갑옷이나 사지요.", "gentle": "옛사람의 손길입니다. 소중히 하면 좋겠습니다.",
		"choices": [{"label": "장터에 내다 판다", "gold": 400}, {"label": "녹여 병장기를 만든다", "train": 5, "troops": 50}, {"label": "사당에 모신다", "sec": 7, "loyal": 3}]},
	"plague": {"name": "역병", "emoji": "🤒", "months": [], "text": "%s 마을에 열병이 번집니다.",
		"rough": "병든 자는 성 밖으로! 군을 지켜야 하오.", "gentle": "의원을 모아야 합니다. 시간이 없습니다.",
		"choices": [{"label": "약값을 받고 약을 판다", "gold": 200, "sec": -8}, {"label": "병영을 막아 군만 지킨다", "train": 2, "sec": -4}, {"label": "의원을 모아 치료한다", "sec": 9, "gold": -200}]},
	"market": {"name": "장터 호황", "emoji": "🏮", "months": [], "text": "%s 장터에 먼 데 상인들이 몰려듭니다.",
		"rough": "돈이 돌면 칼도 돈다. 좋소!", "gentle": "길이 넓어지니 사람이 모입니다.",
		"choices": [{"label": "자릿세를 받는다", "gold": 350, "sec": -2}, {"label": "말과 병기를 사들인다", "train": 5, "gold": -100}, {"label": "길을 넓혀 상인을 반긴다", "comm": 25, "sec": 3}]},
	"desert": {"name": "탈영", "emoji": "🏃", "months": [], "text": "%s 병영에서 밤마다 사람이 빠져나갑니다.",
		"rough": "본보기를 보여야 하오!", "gentle": "고향 생각이 짙은 모양입니다. 사정을 들어 보지요.",
		"choices": [{"label": "빈 자리 녹봉을 거둔다", "gold": 150, "troops": -150}, {"label": "엄히 다스린다", "train": 6, "sec": -5}, {"label": "고향에 다녀오게 한다", "sec": 6, "troops": -50}]},
	"counsel": {"name": "충신의 간언", "emoji": "🙇", "months": [], "text": "%s 늙은 아전이 상소를 올렸습니다.",
		"rough": "말만 많은 늙은이요. 그래도 들어는 보시오.", "gentle": "귀한 말씀입니다. 새겨들으시지요.",
		"choices": [{"label": "씀씀이를 줄이라는 말을 따른다", "gold": 200}, {"label": "변경을 지키라는 말을 따른다", "train": 5, "troops": 100}, {"label": "백성을 살피라는 말을 따른다", "sec": 8, "loyal": 3}]},
	"border": {"name": "국경 분쟁", "emoji": "🚩", "months": [], "text": "%s 경계 마을에서 이웃 군과 실랑이가 벌어졌습니다.",
		"rough": "밀리면 끝이오. 한 번 붙어 봅시다!", "gentle": "피를 보기 전에 말로 풀었으면 합니다.",
		"choices": [{"label": "배상을 받아 낸다", "gold": 250, "sec": -3}, {"label": "국경에 병을 늘린다", "troops": 200, "gold": -150}, {"label": "마을 사람을 안으로 들인다", "sec": 6, "agri": -10}]},
	"horse": {"name": "명마 발견", "emoji": "🐎", "months": [], "text": "%s 들판에서 바람 같은 말 무리를 보았답니다.",
		"rough": "잡아다 길들이면 천하무적이오!", "gentle": "그냥 두어도 들판이 아름답겠지요.",
		"choices": [{"label": "잡아 장사꾼에게 판다", "gold": 300}, {"label": "길들여 기병을 만든다", "train": 9}, {"label": "들판을 금렵으로 지킨다", "sec": 5, "agri": 10}]},
	"rift": {"name": "시간 틈 소문", "emoji": "🌀", "months": [], "text": "%s 하늘에 이 시대 것이 아닌 빛이 걸렸다는 소문입니다.",
		"rough": "무엇이 나오든 베면 그만이오.", "gentle": "틈 너머에서 온 사람도 있다지요. 맞이할 채비를 하겠습니다.",
		"choices": [{"label": "구경꾼에게 길값을 받는다", "gold": 200, "sec": -2}, {"label": "틈 둘레에 진을 친다", "train": 6, "troops": 50}, {"label": "흉흉한 소문을 잠재운다", "sec": 7}]},
}


static func by_key(key: String) -> Dictionary:
	return NEWS.get(key, {})


static func eligible(m: int) -> Array:
	var out: Array = []
	for k: String in NEWS.keys():
		var months: Array = NEWS[k].months
		if months.is_empty() or months.has(m):
			out.append(k)
	out.sort()
	return out


## 그 성 태수의 한 줄(호전이면 거친 말)
static func line_of(key: String, militant: bool) -> String:
	var d := by_key(key)
	return String(d.get("rough" if militant else "gentle", ""))
