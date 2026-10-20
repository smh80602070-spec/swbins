using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0129 기술 나무(웹 사가천하 W-0290 `data-tech.js`·`tech.js`) — 네 갈래(농·상·군·학) × 여섯 마디, 갈래 안에선 차례대로만.
    /// 마디 값(연구점) 6·9·12·16·20·25 · 연구점은 달마다 1 + 지력 85 이상 무장 수(넷까지) + 학 2마디("글 모으기") 1. 표·수치는 웹 그대로.
    /// 효과 길(웹 statecraft·rtk.order 자리를 이 트랙 식에 한 줄씩):
    /// goldPct 달 금 수입 · foodPct 수확 군량 · govPct 개간·상업·기술·치안 성과 · wallPct 축성 성과 · troopPct 징병 성과 · hirePct 등용 확률 ·
    /// plotPct·diploPct 계략 성공률(이 트랙의 "외교"는 계략 창) · atkPct 출진 공격력 · defPct 출진 아군 손실 감소 · cost 명령 금(조선·훈련 ×0.8).
    /// **이 트랙 다름**: 무장 경험치가 없어 expPct("무장 교습")는 효과 없음 · 불가사의가 없어 학 3마디는 문 플래그(<see cref="WonderOpen"/>)만 ·
    /// 적 세력은 연구하지 않는다(웹 aiStep 없음 — 우리 세력 하나만 센다). 연구 0 이면 모든 배율 = 1(옛 수치 그대로).
    /// </summary>
    public static class RealmTechData
    {
        public static readonly int[] Pts = { 6, 9, 12, 16, 20, 25 };
        public const int BasePts = 1, ScholarWis = 85, ScholarMax = 4;

        public class Node
        {
            public string Id, NameKo, DescKo, Rule, CostOrder;
            public float CostMul = 1f;
            public Dictionary<string, int> Stats = new Dictionary<string, int>();
            public string Branch;
            public int Index;
            public int Cost => Pts[Index];
            public string Name => RealmLocalization.T("tech." + Id + ".name", NameKo);
            public string Desc => RealmLocalization.T("tech." + Id + ".desc", DescKo);
        }

        public class Branch
        {
            public string Key, NameKo, Emoji, DescKo;
            public Node[] Nodes;
            public string Name => RealmLocalization.T("tech.branch." + Key, NameKo);
            public string Desc => RealmLocalization.T("tech.branch." + Key + ".desc", DescKo);
        }

        private static Node N(string id, string name, string desc, string stat = null, int v = 0, string stat2 = null, int v2 = 0, string rule = null, string costOrder = null, float costMul = 1f)
        {
            var n = new Node { Id = id, NameKo = name, DescKo = desc, Rule = rule, CostOrder = costOrder, CostMul = costMul };
            if (stat != null) n.Stats[stat] = v;
            if (stat2 != null) n.Stats[stat2] = v2;
            return n;
        }

        public static readonly Branch[] Branches = Build();

        private static Branch[] Build()
        {
            var b = new[]
            {
                new Branch { Key = "farm", NameKo = "농", Emoji = "🌾", DescKo = "군량과 백성", Nodes = new[] {
                    N("f1", "물꼬 트기", "군량 +5%", "foodPct", 5), N("f2", "두벌 갈이", "군량 +5%", "foodPct", 5),
                    N("f3", "둔전 두기", "징병 성과 +5%", "troopPct", 5), N("f4", "큰 곳간", "군량 +10%", "foodPct", 10),
                    N("f5", "향약 세우기", "내정 +5%", "govPct", 5), N("f6", "물레방아", "군량 +10%", "foodPct", 10) } },
                new Branch { Key = "trade", NameKo = "상", Emoji = "🪙", DescKo = "금과 길", Nodes = new[] {
                    N("t1", "저자 열기", "금 수입 +5%", "goldPct", 5), N("t2", "나루 짓기", "조선 비용 -20%", costOrder: "ships", costMul: 0.8f),
                    N("t3", "되 맞추기", "금 수입 +5%", "goldPct", 5), N("t4", "객주 두기", "등용 +10%", "hirePct", 10),
                    N("t5", "소금 길", "금 수입 +10%", "goldPct", 10), N("t6", "먼 장사", "외교 +10%", "diploPct", 10) } },
                new Branch { Key = "mil", NameKo = "군", Emoji = "⚔️", DescKo = "창과 성벽", Nodes = new[] {
                    N("m1", "창 갈기", "공격 +4%", "atkPct", 4), N("m2", "돌 성벽", "축성 성과 +10%", "wallPct", 10),
                    N("m3", "조련 틀", "훈련 비용 -20%", costOrder: "train", costMul: 0.8f), N("m4", "방패 벽", "수비 +5%", "defPct", 5),
                    N("m5", "쇠뇌 틀", "공격 +6%", "atkPct", 6), N("m6", "군적 정리", "징병 성과 +10%", "troopPct", 10) } },
                new Branch { Key = "learn", NameKo = "학", Emoji = "📜", DescKo = "글과 꾀", Nodes = new[] {
                    N("l1", "서당 열기", "내정 +5%", "govPct", 5), N("l2", "글 모으기", "연구점 +1/달", rule: "study"),
                    N("l3", "큰 도면", "불가사의를 지을 수 있다", rule: "wonder"), N("l4", "꾀주머니", "계략 성공률 +5%", "plotPct", 5),
                    N("l5", "무장 교습", "경험 +10%", "expPct", 10), N("l6", "태학 세우기", "내정 +10% · 계략 +5%", "govPct", 10, "plotPct", 5) } },
            };
            foreach (var br in b) for (int i = 0; i < br.Nodes.Length; i++) { br.Nodes[i].Branch = br.Key; br.Nodes[i].Index = i; }
            return b;
        }

        public static Branch GetBranch(string key) { foreach (var b in Branches) if (b.Key == key) return b; return null; }
        public static Node GetNode(string id) { foreach (var b in Branches) foreach (var n in b.Nodes) if (n.Id == id) return n; return null; }

        // ---- 우리 세력 상태 ----

        public static int Points { get; private set; }
        private static readonly List<string> Done = new List<string>();
        public static IReadOnlyList<string> DoneIds => Done;
        public static event Action Changed;

        public static bool Has(string id) => Done.Contains(id);

        public static int DoneCount(string branch)
        {
            int n = 0;
            foreach (var id in Done) { var nd = GetNode(id); if (nd != null && nd.Branch == branch) n++; }
            return n;
        }

        public static Node NextOf(string branch)
        {
            var b = GetBranch(branch);
            if (b == null) return null;
            int n = DoneCount(branch);
            return n < b.Nodes.Length ? b.Nodes[n] : null;
        }

        /// <summary>연구한 마디의 그 키 합(%).</summary>
        public static int Pct(string key)
        {
            int n = 0;
            foreach (var id in Done) { var nd = GetNode(id); if (nd != null && nd.Stats.TryGetValue(key, out var v)) n += v; }
            return n + RealmWonder.Pct(key); // tasks U-0136 — 우리가 먼저 다 지은 불가사의(같은 key 자리를 그대로 탄다)
        }

        /// <summary>1 + 그 키 합/100 — 연구 0 이면 정확히 1.</summary>
        public static float Mul(string key) => 1f + Pct(key) / 100f;

        /// <summary>명령 금 — 연구한 cost 마디를 곱한다(웹 Math.round).</summary>
        public static int Cost(string orderKey, int gold)
        {
            float m = 1f;
            foreach (var id in Done) { var nd = GetNode(id); if (nd != null && nd.CostOrder == orderKey) m *= nd.CostMul; }
            return m == 1f ? gold : Mathf.RoundToInt(gold * m);
        }

        public static bool HasRule(string rule)
        {
            foreach (var id in Done) { var nd = GetNode(id); if (nd != null && nd.Rule == rule) return true; }
            return false;
        }

        public static bool WonderOpen => HasRule("wonder");

        public static int Scholars()
        {
            int n = 0;
            foreach (var id in RealmCityState.RosterIds) { var o = RealmOfficerPool.Get(id); if (o != null && o.Wisdom >= ScholarWis) n++; }
            return Mathf.Min(ScholarMax, n);
        }

        public static int PtsPerMonth() => BasePts + Scholars() + (HasRule("study") ? 1 : 0);

        /// <summary>한 달 — `RealmCityState.NextMonth` 끝에서 부른다.</summary>
        public static int Monthly()
        {
            int add = PtsPerMonth();
            Points += add;
            Changed?.Invoke();
            return add;
        }

        /// <summary>못 사는 까닭(살 수 있으면 null).</summary>
        public static string Why(string branch)
        {
            var nd = NextOf(branch);
            if (nd == null) return RealmLocalization.T("tech.why_all", "이 갈래는 다 연구했습니다");
            if (Points < nd.Cost) return string.Format(RealmLocalization.T("tech.why_pts", "연구점이 모자랍니다({0}/{1})"), Points, nd.Cost);
            return null;
        }

        public static Node Research(string branch, out string why)
        {
            why = Why(branch);
            if (why != null) return null;
            var nd = NextOf(branch);
            Points -= nd.Cost;
            Done.Add(nd.Id);
            Changed?.Invoke();
            return nd;
        }

        // ---- 저장(옛 세이브 = 0점·없음) ----

        public static void Restore(int pts, string[] done)
        {
            Points = Mathf.Max(0, pts);
            Done.Clear();
            if (done != null)
                foreach (var b in Branches)
                    for (int i = 0; i < b.Nodes.Length; i++)
                    {
                        if (Array.IndexOf(done, b.Nodes[i].Id) < 0) break; // 차례대로만 — 빠진 앞 마디 뒤는 버린다
                        Done.Add(b.Nodes[i].Id);
                    }
            Changed?.Invoke();
        }

        public static string[] SnapshotDone() => Done.ToArray();

        /// <summary>진단 — 점을 곧장 준다.</summary>
        public static void AddPointsForTest(int n) { Points = Mathf.Max(0, Points + n); Changed?.Invoke(); }
    }
}
