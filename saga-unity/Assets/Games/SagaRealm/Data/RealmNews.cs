using System;
using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0094 — 웹 사가천하 W-0105 "영내 소식 열둘"(`js/data-news.js` 표 그대로, 재미표준 E·D·G)의 이 트랙 판.
    /// 달을 넘기면 내 성 가운데 하나에서 소식이 뜬다 — 그 성 태수(<see cref="RealmActorPlan.GovernorOf"/>, 없으면 우리 무장 중 지력 높은 사람)의
    /// 한 줄(용맹이면 거친 말, 아니면 점잖은 말) + **세 갈래(축 고정)**: A 금 · B 병(병사·훈련) · C 민심(치안). 하나를 고르면 다른 둘은 못 얻는다.
    /// 효과는 있는 손잡이만(`RealmCityState.AddGold`·`AdjustCity`). 민심 갈래는 값이 안 든다(웹 규칙 — 늘 하나는 고를 수 있게).
    /// 굴림은 성마다 <see cref="Chance"/>(웹 12%), 한 달 한 장(사건 카드와 같은 칸 — 시나리오·예약 체인 다음, 기존 무작위 사건보다 먼저).
    /// 이 트랙엔 장수 2D 초상이 없어 카드엔 이름·딱지·한 줄만(에셋 0). 이름·말투는 창작(실명 금지).
    /// </summary>
    public static class RealmNews
    {
        public const float Chance = 0.12f;
        /// <summary>한 달에 굴리는 성 상한 — 웹은 성마다 굴려 성이 쉰 넘으면 거의 매달 카드가 떴다(진단 600달 중 497). 이 트랙은
        /// "다음 달" 단추마다 카드가 길을 막지 않게 넷까지만(달 약 40%, 성 넷 이하면 웹과 같다). 시작 성은 달마다 돌린다.</summary>
        public const int MaxCitiesPerMonth = 4;

        public sealed class Axis
        {
            public string Label;
            public int Gold, Troops, Train, Sec;
        }

        public sealed class News
        {
            public string Key, Name, Emoji, Text, Rough, Gentle;
            public Axis Util, Atk, Def;
        }

        private static News N(string key, string name, string emoji, string text, string rough, string gentle,
            string ul, int ug, string al, int at, int atr, string dl, int ds) => new News
        {
            Key = key, Name = name, Emoji = emoji, Text = text, Rough = rough, Gentle = gentle,
            Util = new Axis { Label = ul, Gold = ug },
            Atk = new Axis { Label = al, Troops = at, Train = atr },
            Def = new Axis { Label = dl, Sec = ds },
        };

        /// <summary>웹 `NEWS` 열둘 그대로(값·글).</summary>
        public static readonly News[] All =
        {
            N("harvest", "풍년 소식", "🌾", "{0} 들녘에 이삭이 무겁다. 거둔 것을 어디에 쓸까.",
                "곳간이 터지겠소! 이참에 칼 쥘 놈들을 더 먹입시다.", "하늘이 도왔습니다. 백성과 나누면 오래 기억할 것입니다.",
                "세금으로 거둔다", 400, "군량으로 돌려 병사를 늘린다", 400, 0, "백성에게 돌려준다", 8),
            N("drought", "가뭄 걱정", "🌵", "{0} 우물이 마른다는 말이 돈다.",
                "물이 없으면 칼도 녹슬지. 병영 우물부터 지킵시다.", "가물 때 곳간을 열면 민심이 단단해집니다.",
                "물값을 받고 우물을 판다", 200, "병영 우물부터 지킨다", 0, 6, "곳간 물을 나눈다", 7),
            N("bandit", "도적 출몰", "🗡", "{0} 고갯길에 도적이 들끓는다.",
                "소굴째 쓸어버리고 놈들 중 쓸 만한 건 군에 넣겠소.", "길목을 지키고 달래면 대부분은 돌아올 것입니다.",
                "통행세를 걷어 경비를 산다", 250, "토벌해 항복한 자를 병사로", 350, 2, "순찰을 늘리고 달랜다", 6),
            N("talent", "인재 소문", "📜", "{0} 저잣거리에 재주 있는 이가 숨어 산다는 말이 돈다.",
                "글 읽는 놈이든 칼 쓰는 놈이든 데려다 부려 봅시다.", "예를 갖춰 찾아가면 마음을 열 것입니다.",
                "장사 셈을 맡긴다", 300, "교관으로 앉힌다", 0, 8, "서당을 열게 한다", 5),
            N("relic", "유물 발견", "🏺", "{0} 옛 터에서 오래된 그릇과 쇠붙이가 나왔다.",
                "쇠붙이는 녹여 창날로 쓰면 그만이오.", "제를 올리고 모셔 두면 성 사람들이 자랑으로 여길 것입니다.",
                "상단에 판다", 450, "녹여 병장기를 만든다", 150, 5, "사당에 모신다", 8),
            N("plague", "역병 기미", "🦠", "{0} 몇 집에서 열병이 돈다.",
                "병영에 퍼지기 전에 아픈 놈들은 내보내시오!", "의원을 보내 집집이 돌보게 하소서.",
                "약재를 사들여 되판다", 250, "병영부터 막는다", 0, 5, "의원을 집집이 보낸다", 7),
            N("market", "장터 호황", "🏮", "{0} 장터에 먼 데 상인까지 몰려든다.",
                "장사꾼 쌈짓돈으로 말과 창을 삽시다.", "장세를 낮추면 내년에 더 많이 옵니다.",
                "장세를 올린다", 500, "말과 병장기를 사들인다", 300, 3, "장세를 낮춰 붙든다", 6),
            N("desert", "탈영 소문", "🏃", "{0} 병영에서 밤마다 몇씩 빠져나간다고 한다.",
                "붙잡아 다시 세우고 기강을 잡겠소.", "집이 그리운 자들입니다. 품삯을 올려 주면 남습니다.",
                "빈 자리 몫을 거둔다", 200, "붙잡아 다시 훈련한다", 0, 7, "고향 소식을 전해 달랜다", 5),
            N("counsel", "충신의 간언", "🪶", "{0} 에서 쓴소리를 담은 글이 올라왔다.",
                "말보다 칼이 빠르오. 그래도 들을 건 들읍시다.", "쓴 말이 약이 됩니다. 귀를 열어 주십시오.",
                "재정을 바로잡는다", 350, "군율을 바로잡는다", 0, 7, "부역을 덜어 준다", 8),
            N("border", "국경 다툼", "🚩", "{0} 경계에서 이웃 마을과 논두렁 다툼이 났다.",
                "한 번 밀어붙이면 다시는 못 넘볼 거요.", "양쪽 어른을 불러 화해시키면 됩니다.",
                "땅값을 받고 넘긴다", 300, "경계에 병사를 세운다", 250, 3, "어른들을 불러 화해시킨다", 6),
            N("steed", "명마 발견", "🐎", "{0} 목장에서 바람처럼 달리는 말이 태어났다.",
                "저 말이면 기병 열을 이끌 수 있소!", "귀한 말이니 성 잔치에 내어 모두 보게 합시다.",
                "비싼 값에 판다", 450, "기병대 종마로 쓴다", 0, 8, "잔치에 내어 자랑한다", 6),
            // 퓨전(109-5 시간 틈 사람) — 다른 때에서 흘러든 이야기
            N("rift", "시간 틈 소문", "🌀", "{0} 하늘에 금이 가고, 낯선 옷을 입은 이가 빛나는 도구를 놓고 사라졌다.",
                "저 번쩍이는 걸 무기로 쓸 수 있으면 좋겠소.", "두려워 말라 이르고, 그 물건은 잘 거두어 둡시다.",
                "낯선 도구를 상단에 판다", 500, "빛나는 도구로 조련한다", 200, 6, "성 사람들을 안심시킨다", 8),
        };

        public static News Get(string key)
        {
            foreach (var n in All) if (n.Key == key) return n;
            return null;
        }

        /// <summary>카드 키 "소식|성" 를 나눈다.</summary>
        public static bool Parse(string cardKey, out News news, out string cityId)
        {
            news = null; cityId = null;
            if (string.IsNullOrEmpty(cardKey)) return false;
            int bar = cardKey.IndexOf('|');
            if (bar <= 0) return false;
            news = Get(cardKey.Substring(0, bar));
            cityId = cardKey.Substring(bar + 1);
            return news != null && RealmCityData.Get(cityId) != null;
        }

        /// <summary>그 성 소식을 말할 사람 — 태수, 없으면 우리 무장 중 지력 높은 사람(같으면 id 순).</summary>
        public static string SpeakerOf(string cityId)
        {
            string gov = RealmActorPlan.GovernorOf(cityId);
            if (gov != null) return gov;
            string best = null; int bestWis = -1;
            foreach (var id in RealmCityState.RosterIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o == null) continue;
                if (o.Wisdom > bestWis || (o.Wisdom == bestWis && string.CompareOrdinal(id, best) < 0)) { best = id; bestWis = o.Wisdom; }
            }
            return best;
        }

        /// <summary>용맹이면 거친 말(웹 ROUGH = 용맹·호전 — 이 트랙 특성은 용맹·교활·현명).</summary>
        public static string LineOf(News n, string speakerId) =>
            speakerId != null && RealmOfficerTraits.Has(speakerId, RealmOfficerTraits.Trait.Brave)
                ? RealmLocalization.T($"news.{n.Key}.rough", n.Rough)
                : RealmLocalization.T($"news.{n.Key}.gentle", n.Gentle);

        /// <summary>이 달 소식 굴림 — 우리 성 가운데 넷까지(시작 자리 = <paramref name="pick"/>) 성마다 <see cref="Chance"/>, 첫 성공 한 장(한 달 한 장). 없으면 null.
        /// 결정적 진단은 <paramref name="roll"/>(0~1)·<paramref name="pick"/>(n → 0..n-1) 를 넣는다.</summary>
        public static string Roll(Func<float> roll, Func<int, int> pick)
        {
            var cities = RealmCityState.ActiveCityIds;
            if (cities.Count == 0) return null;
            int start = pick(cities.Count), n = Math.Min(MaxCitiesPerMonth, cities.Count);
            for (int k = 0; k < n; k++)
            {
                string city = cities[(start + k) % cities.Count];
                if (roll() >= Chance) continue;
                if (SpeakerOf(city) == null) continue;
                return All[pick(All.Length)].Key + "|" + city;
            }
            return null;
        }

        public static (string title, string body, string a, string b, string c) Describe(string cardKey)
        {
            if (!Parse(cardKey, out var n, out var city)) return ("?", "", "", "", "");
            string cityName = RealmCityData.Get(city)?.Name ?? city;
            string speaker = SpeakerOf(city);
            string who = speaker != null ? (RealmOfficerPool.Get(speaker)?.Name ?? speaker) : RealmLocalization.T("news.nobody", "고을 사람");
            string title = string.Format(RealmLocalization.T("news.title", "{0} 영내 소식 — {1} · {2}"), n.Emoji, RealmLocalization.T($"news.{n.Key}.name", n.Name), cityName);
            string body = string.Format(RealmLocalization.T($"news.{n.Key}.text", n.Text), cityName) + "\n\n" + string.Format(RealmLocalization.T("news.says", "{0}: \"{1}\""), who, LineOf(n, speaker));
            return (title, body, AxisLabel(n, n.Util, "util"), AxisLabel(n, n.Atk, "atk"), AxisLabel(n, n.Def, "def"));
        }

        private static string AxisLabel(News n, Axis x, string axis)
        {
            var parts = new List<string>();
            if (x.Gold > 0) parts.Add(string.Format(RealmLocalization.T("news.hint.gold", "금 +{0}"), x.Gold));
            if (x.Troops > 0) parts.Add(string.Format(RealmLocalization.T("news.hint.troops", "병사 +{0}"), x.Troops));
            if (x.Train > 0) parts.Add(string.Format(RealmLocalization.T("news.hint.train", "훈련 +{0}"), x.Train));
            if (x.Sec > 0) parts.Add(string.Format(RealmLocalization.T("news.hint.sec", "치안 +{0}"), x.Sec));
            return $"{RealmLocalization.T($"news.{n.Key}.{axis}", x.Label)} ({string.Join(" · ", parts)})";
        }

        /// <summary>갈래 A 금 · B 병 · C 민심 — 그 축만 바꾼다.</summary>
        public static (string message, bool ok) Resolve(string cardKey, int choice)
        {
            if (!Parse(cardKey, out var n, out var city)) return (RealmLocalization.T("news.gone", "소식이 흐지부지됐다."), false);
            var x = choice == 0 ? n.Util : choice == 1 ? n.Atk : n.Def;
            if (x.Gold > 0) RealmCityState.AddGold(x.Gold);
            if (x.Troops > 0 || x.Train > 0 || x.Sec > 0) RealmCityState.AdjustCity(city, sec: x.Sec, troops: x.Troops, train: x.Train);
            string cityName = RealmCityData.Get(city)?.Name ?? city;
            return (string.Format(RealmLocalization.T("news.done", "{0} — {1}"), cityName, AxisLabel(n, x, choice == 0 ? "util" : choice == 1 ? "atk" : "def")), true);
        }
    }
}
