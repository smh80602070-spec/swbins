using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0231 ② 지원 단계(웹 W-0425 · 파이어 엠블렘 — 구조만). 격자 SRPG 판(`Board.IsSrpg`)이 끝날 때 맨해튼 거리 1 로 끝난 우리 장수 쌍마다 +1(판마다 한 번) —
    /// 3/7/12 점 = C/B/A. 이웃 칸에 지원 짝이 있으면 명중·회피 +5/+10/+15(가장 큰 하나만, `RealmTactics.HitAt` 의 extra 한 항).
    /// 실시간(RTS) 판엔 안 씀. **이 판 다름**: 의형제 B 시작·원수 안 오름은 관계망이 없어 뺐다.
    /// 세이브 `supportJson`(버전 그대로 — 옛 세이브 null → 빈 것). 손잡이 `SAGA_REALM_SUPPORT=0`.
    /// </summary>
    public static class RealmSupport
    {
        public static readonly int[] RankAt = { 3, 7, 12 };
        public static readonly int[] RankBonus = { 5, 10, 15 };
        public static readonly string[] RankName = { "C", "B", "A" };

        public static bool On = Environment.GetEnvironmentVariable("SAGA_REALM_SUPPORT") != "0";

        [Serializable] private class Pair { public string k; public int p; }
        [Serializable] private class Store { public List<Pair> list = new List<Pair>(); }
        private static Store _s = new Store();

        public static string Key(string a, string b) => string.CompareOrdinal(a, b) <= 0 ? a + "|" + b : b + "|" + a;

        public static int Points(string a, string b)
        {
            string k = Key(a, b);
            foreach (var p in _s.list) if (p.k == k) return p.p;
            return 0;
        }

        /// <summary>점수 → 단계(-1 없음 · 0 C · 1 B · 2 A).</summary>
        public static int RankOf(int points)
        {
            int r = -1;
            for (int i = 0; i < RankAt.Length; i++) if (points >= RankAt[i]) r = i;
            return r;
        }

        public static int Rank(string a, string b) => RankOf(Points(a, b));

        /// <summary>이 장수 곁(거리 1)에 선 우리 장수들과의 지원 보정 중 가장 큰 것(SRPG·우리 쪽만).</summary>
        public static int BonusFor(RealmTactics.Board b, RealmTactics.Unit u)
        {
            if (!On || b == null || !b.IsSrpg || u == null || u.Side != "me") return 0;
            int best = 0;
            foreach (var o in b.Units)
            {
                if (o == u || o.Hp <= 0 || o.Side != "me" || RealmTactics.Dist(u.X, u.Y, o.X, o.Y) != 1) continue;
                int r = Rank(u.Id, o.Id);
                if (r >= 0) best = Mathf.Max(best, RankBonus[r]);
            }
            return best;
        }

        /// <summary>판 끝 — 이웃으로 끝난 우리 쌍마다 +1. 단계가 오른 쌍 문구들.</summary>
        public static List<string> OnBattleEnd(RealmTactics.Board b)
        {
            var ups = new List<string>();
            if (!On || b == null || !b.IsSrpg) return ups;
            var mine = b.Units.FindAll(x => x.Hp > 0 && x.Side == "me" && !string.IsNullOrEmpty(x.Id));
            var done = new HashSet<string>();
            for (int i = 0; i < mine.Count; i++)
                for (int j = i + 1; j < mine.Count; j++)
                {
                    var a = mine[i]; var c = mine[j];
                    if (a.Id == c.Id || RealmTactics.Dist(a.X, a.Y, c.X, c.Y) != 1) continue;
                    string k = Key(a.Id, c.Id);
                    if (!done.Add(k)) continue;
                    int before = Rank(a.Id, c.Id);
                    Add(k, 1);
                    int after = Rank(a.Id, c.Id);
                    if (after > before) ups.Add(string.Format(RealmLocalization.T("support.up", "🤝 {0} · {1} 지원 {2}"), NameOf(a.Id), NameOf(c.Id), RankName[after]));
                }
            return ups;
        }

        private static void Add(string k, int d)
        {
            foreach (var p in _s.list) if (p.k == k) { p.p += d; return; }
            _s.list.Add(new Pair { k = k, p = d });
        }

        private static string NameOf(string id) { var o = RealmOfficerPool.Get(id); return o != null ? o.Name : id; }

        /// <summary>장수 창 줄 — 이 장수의 지원 짝들(C 이상).</summary>
        public static string LineFor(string id)
        {
            var parts = new List<string>();
            foreach (var p in _s.list)
            {
                var ab = p.k.Split('|');
                if (ab.Length != 2 || (ab[0] != id && ab[1] != id)) continue;
                int r = RankOf(p.p);
                if (r < 0) continue;
                parts.Add(NameOf(ab[0] == id ? ab[1] : ab[0]) + " " + RankName[r]);
            }
            return parts.Count == 0 ? "" : string.Format(RealmLocalization.T("support.line", "🤝 지원 {0}"), string.Join(" · ", parts));
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);
        public static void Restore(string json)
        {
            _s = new Store();
            if (string.IsNullOrEmpty(json)) return;
            try { _s = JsonUtility.FromJson<Store>(json) ?? new Store(); } catch { _s = new Store(); }
        }
        public static void SetForTest(string a, string b, int points) { string k = Key(a, b); _s.list.RemoveAll(p => p.k == k); _s.list.Add(new Pair { k = k, p = points }); }
        public static void ResetForTest() => _s = new Store();
    }
}
