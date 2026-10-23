using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0193 국가 방침 나무(고돗 G-0336 `realm_focus.gd` 짝, 웹 짝 없음 — HOI 국가 방침 구조만) — 몇 달짜리 국책을 하나씩 골라, 끝나면 덤이 영구.
    /// 🏯 나라의 근본(3달·금 300) → 💰 부국(금 +10%) → 🌾 둔전 확장(수확 +10%) / ⚔️ 강병(징병 +15%) → 🎯 조련 — 부국·강병은 갈림길(하나 고르면 다른 쪽 닫힘)
    /// → 🤝 인재 등용(등용 +15%, 둔전 확장 또는 조련 뒤) → 🐉 천하의 대계(6달 · 금·수확 +5% · 계략 +10% · 금 1000).
    /// 이 트랙엔 무장 경험이 없어(`RealmLaws` 머리말) 조련은 고돗 "무장 경험 +10%" 대신 **훈련 명령 +10%**. 한 번에 하나, 달 끝(`RealmCityState.NextMonth`)마다 1 씩 준다.
    /// 곱은 법령·국세와 같은 자리(금·수확·징병·등용) + 훈련 명령·계략 확률 — 끝낸 방침이 없으면 모두 1.
    /// </summary>
    public static class RealmFocus
    {
        public sealed class Focus
        {
            public readonly string Id, Emoji, Ko, TextKo, Lock;
            public readonly int Months, Gold;
            public readonly string[] Need;   // 하나씩 다 있어야 · "a|b" = 둘 중 하나
            public readonly Dictionary<string, float> Mul;
            public Focus(string id, string emoji, string ko, int months, string[] need, string textKo, Dictionary<string, float> mul, string lockId = "", int gold = 0)
            { Id = id; Emoji = emoji; Ko = ko; Months = months; Need = need; TextKo = textKo; Mul = mul; Lock = lockId; Gold = gold; }
            public string Name => RealmLocalization.T("focus." + Id, Ko);
            public string Text => RealmLocalization.T("focus." + Id + ".text", TextKo);
        }

        public static readonly Focus[] All =
        {
            new Focus("root", "🏯", "나라의 근본", 3, new string[0], "금 300", new Dictionary<string, float>(), gold: 300),
            new Focus("rich", "💰", "부국", 4, new[] { "root" }, "금 수입 +10%", new Dictionary<string, float> { { "gold", 1.1f } }, lockId: "army"),
            new Focus("farm", "🌾", "둔전 확장", 4, new[] { "rich" }, "수확 +10%", new Dictionary<string, float> { { "food", 1.1f } }),
            new Focus("army", "⚔️", "강병", 4, new[] { "root" }, "징병 +15%", new Dictionary<string, float> { { "draft", 1.15f } }, lockId: "rich"),
            new Focus("drill", "🎯", "조련", 4, new[] { "army" }, "훈련 +10%", new Dictionary<string, float> { { "train", 1.1f } }),
            new Focus("talent", "🤝", "인재 등용", 4, new[] { "farm|drill" }, "등용 +15%", new Dictionary<string, float> { { "hire", 1.15f } }),
            new Focus("grand", "🐉", "천하의 대계", 6, new[] { "talent" }, "금·수확 +5% · 계략 +10% · 금 1000",
                new Dictionary<string, float> { { "gold", 1.05f }, { "food", 1.05f }, { "plot", 1.1f } }, gold: 1000),
        };
        public const int MaxDone = 5;   // 근본·갈림길 한쪽 둘·인재·대계

        /// <summary>끄면 곱 1·못 고름(고돗 `SAGA_FOCUS=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        private class Store { public List<string> done = new List<string>(); public string cur = ""; public int left; }

        private static Store _s = new Store();

        public static event Action Changed;

        public static Focus Get(string id) => Array.Find(All, f => f.Id == id);
        public static IReadOnlyList<string> Done => _s.done;
        public static bool IsDone(string id) => _s.done.Contains(id);
        public static string Current => _s.cur ?? "";
        public static int Left => _s.left;

        /// <summary>끝낸 방침 곱("gold"·"food"·"draft"·"train"·"hire"·"plot") — 없거나 꺼짐이면 1.</summary>
        public static float Mul(string key)
        {
            if (!On) return 1f;
            float m = 1f;
            foreach (var id in _s.done)
            {
                var f = Get(id);
                if (f != null && f.Mul.TryGetValue(key, out float v)) m *= v;
            }
            return m;
        }

        public static bool Locked(string id)
        {
            foreach (var d in _s.done) { var f = Get(d); if (f != null && f.Lock == id) return true; }
            var c = Get(Current);
            return c != null && c.Lock == id;
        }

        /// <summary>고를 수 없는 까닭(null = 고를 수 있음).</summary>
        public static string Why(string id)
        {
            if (!On) return RealmLocalization.T("focus.why_off", "꺼져 있다");
            var f = Get(id);
            if (f == null) return RealmLocalization.T("focus.why_none", "없는 방침");
            if (_s.done.Contains(id)) return RealmLocalization.T("focus.why_done", "이미 끝냈다");
            if (Current == id) return RealmLocalization.T("focus.why_cur", "진행 중");
            if (Locked(id)) return RealmLocalization.T("focus.why_lock", "갈림길 — 닫힘");
            foreach (var n in f.Need)
            {
                var alts = n.Split('|');
                if (Array.Exists(alts, a => _s.done.Contains(a))) continue;
                return string.Format(RealmLocalization.T("focus.why_need", "{0} 먼저"),
                    string.Join(RealmLocalization.T("focus.or", " 또는 "), Array.ConvertAll(alts, a => Get(a).Name)));
            }
            var c = Get(Current);
            if (c != null) return string.Format(RealmLocalization.T("focus.why_busy", "다른 방침 진행 중({0} {1}달)"), c.Name, _s.left);
            return null;
        }

        public static string Pick(string id)
        {
            string w = Why(id);
            if (w != null) return w;
            _s.cur = id;
            _s.left = Get(id).Months;
            Changed?.Invoke();
            return null;
        }

        /// <summary>달 끝 — 진행 중 방침 한 달. 끝나면 알림 줄(금 덤은 <paramref name="gold"/> 로 — 부르는 쪽이 금고에 더한다).</summary>
        public static List<string> Monthly(out int gold)
        {
            gold = 0;
            var lines = new List<string>();
            var c = Get(Current);
            if (!On || c == null) return lines;
            _s.left--;
            if (_s.left > 0) { Changed?.Invoke(); return lines; }
            _s.done.Add(c.Id);
            _s.cur = "";
            _s.left = 0;
            gold = c.Gold;
            lines.Add(string.Format(RealmLocalization.T("focus.done_line", "{0} 방침 「{1}」 완수 — {2}"), c.Emoji, c.Name, c.Text));
            Changed?.Invoke();
            return lines;
        }

        /// <summary>창 줄 하나 — 들여쓰기·이름·덤·상태(✓ 완수 · ⏳ n달 남음 · ▶ n달 · (까닭)).</summary>
        public static string Line(Focus f)
        {
            string w = Why(f.Id);
            string mark = _s.done.Contains(f.Id) ? RealmLocalization.T("focus.mark_done", "✓ 완수")
                : Current == f.Id ? string.Format(RealmLocalization.T("focus.mark_left", "⏳ {0}달 남음"), _s.left)
                : w == null ? string.Format(RealmLocalization.T("focus.mark_go", "▶ {0}달"), f.Months) : $"({w})";
            string indent = f.Need.Length > 0 ? "  └ " : "";
            return $"{indent}{f.Emoji} {f.Name} — {f.Text}  {mark}";
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.done = (_s.done ?? new List<string>()).FindAll(id => Get(id) != null);
            if (Get(_s.cur ?? "") == null) { _s.cur = ""; _s.left = 0; }
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
