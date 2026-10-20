using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0135 무예별 작은 나무(웹 W-0280 `skill-tree.js`·고돗 G-0241) — 무예(평타·강공격·회전베기)마다 나무 하나.
    /// 맞힌 시전 1 = 경험 1, Lv 1~20(Lv→+1 에 Lv×8, 누적 1520), 레벨마다 점 1 · 마디 여덟(갈래 가/나 — 한 마디엔 한 갈래, 마디 최대 3점·결/연타 1점,
    /// 앞 마디에 점이 있어야 열림) · 되돌리기 금 200(경험 유지). 마디 수치는 웹 TREE 그대로.
    /// 이 트랙엔 기력이 없어 **기력 축 = 재냉각과 같은 %**(고돗과 같음) · 원소가 없어 **불 결 = 위력 ×1.1 · 한기 결 = 맞은 적 얼림**(그 무예에 이미 분노/한기
    /// 비결이면 위력 ×1.05 로) · 연타 = 평타·강공격은 곁 한 놈 더, 회전베기는 위력 ×1.06 · 흡수 = 그 타 피해 × 합%.
    /// </summary>
    public static class SkillTree
    {
        public const int MaxLv = 20, Nodes = 8, NodeMax = 3, ResetGold = 200;
        public const float CdFloor = 0.3f, FireMul = 1.1f, DupMul = 1.05f, MultiWhirlMul = 1.06f;

        public struct Opt { public string K; public string Ko; public int Per; public int Max; }
        private static Opt O(string k, string ko, int per, int max = NodeMax) => new Opt { K = k, Ko = ko, Per = per, Max = max };

        /// <summary>웹 TREE 그대로 — [마디] = (가, 나).</summary>
        public static readonly Opt[,] Tree =
        {
            { O("dmg", "위력", 4), O("cost", "기력", 6) },
            { O("cd", "재냉각", 4), O("range", "범위", 6) },
            { O("dmg", "위력", 5), O("drain", "흡수", 3) },
            { O("fire", "불 결", 1, 1), O("cold", "한기 결", 1, 1) },
            { O("cost", "기력", 5), O("cd", "재냉각", 3) },
            { O("dmg", "위력", 6), O("range", "범위", 8) },
            { O("multi", "연타", 1, 1), O("cd", "재냉각", 5) },
            { O("dmg", "위력", 8), O("cost", "기력", 8) },
        };

        [Serializable]
        private class Branch { public int xp; public int[] pts = new int[Nodes]; }

        [Serializable]
        private class Store { public Branch[] moves = { new Branch(), new Branch(), new Branch() }; }

        private static Store _s = new Store();

        public static event Action Changed;
        /// <summary>무예 레벨이 오른 순간(무예·새 레벨) — 토스트.</summary>
        public static event Action<SecretMove, int> LeveledUp;

        private static Branch Of(SecretMove m) => _s.moves[(int)m];

        public static int Need(int lv) => lv * 8;

        public static int Xp(SecretMove m) => Of(m).xp;

        public static int Level(SecretMove m)
        {
            int xp = Of(m).xp, lv = 1;
            while (lv < MaxLv && xp >= Need(lv)) { xp -= Need(lv); lv++; }
            return lv;
        }

        public static int Pts(SecretMove m, int node) => Of(m).pts[node];

        public static int Spent(SecretMove m) { int n = 0; foreach (int v in Of(m).pts) n += Math.Abs(v); return n; }
        public static int PointsLeft(SecretMove m) => Math.Max(0, Level(m) - 1 - Spent(m));

        /// <summary>맞힌 시전 하나 — 경험 +1. 레벨이 오르면 새 레벨(아니면 0).</summary>
        public static int Gain(SecretMove m, int n = 1)
        {
            int before = Level(m);
            Of(m).xp += Math.Max(0, n);
            int after = Level(m);
            if (after <= before) return 0;
            LeveledUp?.Invoke(m, after);
            Changed?.Invoke();
            return after;
        }

        /// <summary>못 찍는 이유(null = 찍을 수 있음): arg·prereq(앞 마디)·side(다른 갈래)·max·point.</summary>
        public static string Why(SecretMove m, int node, bool a)
        {
            if (node < 0 || node >= Nodes) return "arg";
            var p = Of(m).pts;
            if (node > 0 && p[node - 1] == 0) return "prereq";
            if ((a && p[node] < 0) || (!a && p[node] > 0)) return "side";
            if (Math.Abs(p[node]) >= Tree[node, a ? 0 : 1].Max) return "max";
            if (PointsLeft(m) < 1) return "point";
            return null;
        }

        public static bool Put(SecretMove m, int node, bool a)
        {
            if (Why(m, node, a) != null) return false;
            Of(m).pts[node] += a ? 1 : -1;
            Changed?.Invoke();
            return true;
        }

        /// <summary>되돌리기 — 금 200, 경험은 그대로. 찍은 게 없거나 금이 모자라면 이유.</summary>
        public static string Reset(SecretMove m)
        {
            if (Spent(m) == 0) return "empty";
            if (!HeroState.TrySpendGold(ResetGold)) return "gold";
            Of(m).pts = new int[Nodes];
            Changed?.Invoke();
            return null;
        }

        /// <summary>축 합(%) — dmg·cost·cd·range·drain·fire·cold·multi.</summary>
        public static int Sum(SecretMove m, string k)
        {
            int n = 0;
            var p = Of(m).pts;
            for (int i = 0; i < Nodes; i++)
            {
                if (p[i] == 0) continue;
                var o = Tree[i, p[i] > 0 ? 0 : 1];
                if (o.K == k) n += o.Per * Math.Abs(p[i]);
            }
            return n;
        }

        // ---- 공격이 읽는 배율 ----

        public static float DamageMul(SecretMove m)
        {
            float mul = 1f + Sum(m, "dmg") / 100f;
            if (Sum(m, "fire") > 0) mul *= SecretState.Of(m) == Secret.Rage ? DupMul : FireMul;
            if (Sum(m, "cold") > 0 && SecretState.Of(m) == Secret.Frost) mul *= DupMul;
            if (m == SecretMove.Whirl && Sum(m, "multi") > 0) mul *= MultiWhirlMul;
            return mul;
        }

        /// <summary>재냉각 배율 — (1−재냉각%)(1−기력%), 하한 ×0.3.</summary>
        public static float CooldownMul(SecretMove m) =>
            Mathf.Max(CdFloor, (1f - Sum(m, "cd") / 100f) * (1f - Sum(m, "cost") / 100f));

        public static float RangeMul(SecretMove m) => 1f + Sum(m, "range") / 100f;
        public static float DrainFrac(SecretMove m) => Sum(m, "drain") / 100f;
        public static bool Chills(SecretMove m) => Sum(m, "cold") > 0;
        public static int ExtraTargets(SecretMove m) => m != SecretMove.Whirl && Sum(m, "multi") > 0 ? 1 : 0;

        public static string OptLabel(int node, bool a)
        {
            var o = Tree[node, a ? 0 : 1];
            string name = DungeonLocalization.T("tree.k." + o.K, o.Ko);
            if (o.K == "fire" || o.K == "cold" || o.K == "multi") return name;
            return name + (o.K == "cost" || o.K == "cd" ? " -" : " +") + o.Per + "%";
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.moves == null || _s.moves.Length != SecretState.MoveCount)
            {
                _s.moves = new Branch[SecretState.MoveCount];
                for (int i = 0; i < _s.moves.Length; i++) _s.moves[i] = new Branch();
            }
            for (int i = 0; i < _s.moves.Length; i++)
            {
                if (_s.moves[i] == null) _s.moves[i] = new Branch();
                var b = _s.moves[i];
                if (b.pts == null || b.pts.Length != Nodes) b.pts = new int[Nodes];
                b.xp = Math.Max(0, b.xp);
                // R-5 리뷰 — 저장된 점을 마디 최대·앞 마디·레벨 점 수로 자른다(고친 세이브가 상한을 넘지 않게)
                for (int n = 0; n < Nodes; n++)
                {
                    int max = Tree[n, b.pts[n] > 0 ? 0 : 1].Max;
                    b.pts[n] = Mathf.Clamp(b.pts[n], -max, max);
                    if (n > 0 && b.pts[n - 1] == 0) b.pts[n] = 0;
                }
                var m = (SecretMove)i;
                if (Spent(m) > Level(m) - 1) b.pts = new int[Nodes];
            }
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
