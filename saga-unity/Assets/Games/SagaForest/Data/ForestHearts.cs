using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0143 관계 하트(웹 사가마을 §5.4 `js/village-folk.js` heartRec·bumpHeart·heartNext, 문턱 `data-village.js` HEART_UNLOCKS) —
    /// 손님 정(<see cref="ForestVisitors.BondOf"/>, 눌러앉기 셈) 옆에 두는 **새 0~10 게이지**. 오를 때마다 하루 상한 +4(벌은 상한 없이).
    ///
    ///   말 걸기   그날 그 사람에게 처음 다가서면 +1(손님·눌러앉은 손님·숲지기)
    ///   부탁 완수 손님 부탁을 마치면 +2 · 숲지기 세배를 마치면 +2(웹 축제 하트 +2)
    ///   문턱      3 집 방문 허용 · 5 고유 대화 · 7 동행 · 10 기념품
    ///
    /// **이 트랙 다름**: 가방이 없어(채집 = 도감 기록) 웹 "선물 +2"를 뺐고, 배달처가 사람이 아니라 존 우체통이라 웹 "배달 완수 +2"도 뺐다.
    /// 집 방문·동행은 이 판에 그 놀이가 없어 **문턱 안내 글만**(다음 해제 이름). 5♥ 고유 대화는 웹이 도감 열전 한 줄을 쓰는데
    /// 이 판 사람은 도감 인물이 아니라 사람마다 한 줄을 두었다(가명·실명 없음). 10♥ 기념품은 사람마다 한 번 — 웹 틀 셋(고향·꿈·선물)에
    /// 그 고유 대화를 끼우고 과일 80(웹 금 3000 ÷ 50 + 공적 20, 손님 사연 <see cref="ForestVisitors.StoryFruit"/> 와 같은 셈).
    /// 날짜는 <see cref="ForestVisitors.Today"/>(진단은 그 고정). 세이브 `heartsJson`(버전 그대로 — 옛 세이브 null → 전원 0).
    /// </summary>
    public static class ForestHearts
    {
        public const int Max = 10, DailyCap = 4, TalkGain = 1, DoneGain = 2;
        public const int MementoFruit = 80;
        public const string KeeperId = "keeper";

        public struct Unlock { public int At; public string Key; public string Ko; }
        public static readonly Unlock[] Unlocks =
        {
            new Unlock { At = 3, Key = "visit", Ko = "집 방문 허용" },
            new Unlock { At = 5, Key = "uniq", Ko = "고유 대화" },
            new Unlock { At = 7, Key = "follow", Ko = "동행" },
            new Unlock { At = 10, Key = "memento", Ko = "기념품" },
        };

        private static readonly Dictionary<string, string> UniqKo = new Dictionary<string, string>
        {
            [KeeperId] = "숲이 말을 한다는 걸 믿나? 나는 바람 소리로 내일 날씨를 안다네. 그대 발소리도 이제 알아듣지",
            ["fox"] = "장사꾼끼리 하는 말인데, 제일 비싼 물건은 늘 덤으로 끼워 주는 정이라오",
            ["sailor"] = "별자리 읽는 법을 아오? 북쪽 일곱 별만 알면 어느 바다에서도 집에 돌아오지",
            ["wisp"] = "히히, 사실 나 어둠이 무서워. 그래서 늘 반짝이는 거야 — 비밀이야!",
            ["angler"] = "물고기가 안 물 땐 하늘을 보게. 구름 그림자가 물속 길을 가르쳐 준다네",
            ["bugdoc"] = "개미는 자기 몸의 쉰 배를 든대요. 저도 그 정도로 이 숲을 아끼고 싶어요",
            ["traveler"] = "삐빗. 고백: 제 기록 장치엔 ‘친구’ 칸이 없었습니다. 어제 새로 만들었습니다",
            ["dokkaebi"] = "도깨비 방망이 얘기 들었나? 금 나와라 뚝딱보다 웃음 나와라 뚝딱이 더 어렵다네",
            ["alien"] = "제 별엔 노을이 없어요. 여기 노을을 처음 봤을 때 모선에 ‘색이 너무 많음’ 이라고 보냈어요",
        };

        private struct Frame { public string Key; public string Emoji; public string Ko; }
        private static readonly Frame[] Frames =
        {
            new Frame { Key = "home", Emoji = "🏡", Ko = "{0}: 그대에게만 하는 얘기요. 내 고향 이야기를 한 번도 못 했구려. {1} 그 하늘 아래 배운 것이 이 마을에서도 통하니 신기한 일이오." },
            new Frame { Key = "dream", Emoji = "🌠", Ko = "{0}: 내 꿈을 말해도 웃지 않겠소? 이 마을에서 이웃과 오래오래 사는 것이오. {1} 그런 꿈을 이루게 해 준 이가 바로 그대요." },
            new Frame { Key = "gift", Emoji = "🎁", Ko = "{0}: 이것을 받아 주시오. 오래 아껴 온 것인데 그대가 가질 때가 되었소. {1} 정이란 이렇게 손에서 손으로 넘어가는 것이라 배웠소." },
        };

        [Serializable]
        private class Rec { public string id; public int h; public int lastTalk = int.MinValue; public int gainDay = int.MinValue; public int gained; public bool memento; }
        [Serializable]
        private class Store { public List<Rec> list = new List<Rec>(); }

        private static Store _s = new Store();

        private static Rec RecOf(string id)
        {
            foreach (var r in _s.list) if (r.id == id) return r;
            var n = new Rec { id = id };
            _s.list.Add(n);
            return n;
        }

        private static Rec Find(string id)
        {
            foreach (var r in _s.list) if (r.id == id) return r;
            return null;
        }

        public static int Of(string id) => Find(id)?.h ?? 0;
        public static int GainedToday(string id) { var r = Find(id); return r != null && r.gainDay == ForestVisitors.Today ? r.gained : 0; }

        /// <summary>하트를 올리거나(하루 상한 +4) 내린다(상한 없음) — 실제로 들어간 값.</summary>
        public static int Bump(string id, int delta)
        {
            if (string.IsNullOrEmpty(id) || delta == 0) return 0;
            var r = RecOf(id);
            int day = ForestVisitors.Today;
            if (r.gainDay != day) { r.gainDay = day; r.gained = 0; }
            int applied = delta;
            if (delta > 0)
            {
                applied = Mathf.Max(0, Mathf.Min(delta, DailyCap - r.gained));
                r.gained += applied;
            }
            int before = r.h;
            r.h = Mathf.Clamp(r.h + applied, 0, Max);
            return r.h - before;
        }

        /// <summary>말 걸기 — 그날 그 사람에게 처음이면 +1(들어간 값).</summary>
        public static int Talk(string id)
        {
            if (string.IsNullOrEmpty(id)) return 0;
            var r = RecOf(id);
            int day = ForestVisitors.Today;
            if (r.lastTalk == day) return 0;
            r.lastTalk = day;
            return Bump(id, TalkGain);
        }

        public static int UnlockAt(string key)
        {
            foreach (var u in Unlocks) if (u.Key == key) return u.At;
            return int.MaxValue;
        }

        /// <summary>다음 해제(없으면 null).</summary>
        public static Unlock? Next(string id)
        {
            int h = Of(id);
            foreach (var u in Unlocks) if (h < u.At) return u;
            return null;
        }

        public static string UnlockName(Unlock u) => ForestLocalization.T("heart.unlock." + u.Key, u.Ko);

        /// <summary>말 끝에 붙는 꼬리 — " ♥ 4/10 · 다음 5♥ 고유 대화".</summary>
        public static string Tail(string id)
        {
            var n = Next(id);
            string s = string.Format(ForestLocalization.T("heart.tail", " ♥ {0}/{1}"), Of(id), Max);
            if (n.HasValue) s += string.Format(ForestLocalization.T("heart.tail_next", " · 다음 {0}♥ {1}"), n.Value.At, UnlockName(n.Value));
            return s;
        }

        /// <summary>5♥ 고유 대화 — 아직 못 열었거나 줄이 없으면 null.</summary>
        public static string UniqLine(string id)
        {
            if (Of(id) < UnlockAt("uniq") || !UniqKo.TryGetValue(id, out var ko)) return null;
            return ForestLocalization.T("heart.uniq." + id, ko);
        }

        public static bool HasMemento(string id) => Find(id)?.memento ?? false;

        /// <summary>10♥ 기념품 — 사람마다 한 번(과일 80). 아직 아니거나 이미 받았으면 null.</summary>
        public static string Memento(string id, string displayName)
        {
            var r = Find(id);
            if (r == null || r.memento || r.h < UnlockAt("memento")) return null;
            r.memento = true;
            var fr = Frames[(int)(ForestVisitors.Hash01(StableNum(id), 53) * Frames.Length) % Frames.Length];
            ForestState.AddFruit(MementoFruit);
            string body = string.Format(ForestLocalization.T("heart.memento." + fr.Key, fr.Ko), displayName, UniqLine(id) ?? "");
            return fr.Emoji + " " + body + " " + string.Format(ForestLocalization.T("heart.memento_reward", "(기념품 · 과일 +{0})"), MementoFruit);
        }

        /// <summary>id 글자 합(웹 idNum 결) — string.GetHashCode 는 런타임마다 달라 쓰지 않는다.</summary>
        private static int StableNum(string id) { int n = 0; foreach (char c in id) n = n * 31 + c; return n & 0x7fffffff; }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            foreach (var r in _s.list) r.h = Mathf.Clamp(r.h, 0, Max);
        }

        public static void ResetForTest() => Restore(null);
    }
}
