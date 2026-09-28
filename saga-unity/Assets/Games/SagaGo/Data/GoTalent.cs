using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-4 "무예 단계·깨달음"(웹 사가고 ⑲-4 · ⑳ 이름·수치 · saga-godot 106 ⑩⑫) — 규칙표만 모은 순수 정적 클래스.
    /// 도감 동행마다 기본 공격·원소 스킬·원소 해방 무예 1~10(배율 1.0~1.98, 깨달음 ③ 이 스킬·해방 +2단 → 2.1)과 깨달음 다섯(인연 매듭 하나씩).
    /// 상한은 웹의 인물 승급 ★0~5(3·4·5·7·9·10) — 이 트랙엔 인물마다 승급이 없어(승급 3택은 부대 레벨업마다, `PerkState`) 부대 레벨 1·5·10·15·20·25 가 그 여섯 칸을 연다.
    /// 값 = 금 + 쪽지/교본/비전(웹 그대로). 웹의 단사는 이 판에 없어 뺐고, 7단 → 8단부터 드는 뇌룡 비늘(웹 ⑲-9 주간 보스)은 그 순서가 오기 전까지 없다 — 그때까지 7단이 끝.
    /// 주인공("hero")·도감 밖(산적)은 단계 1·깨달음 0(웹 `_me`·도감 밖과 같다).
    /// </summary>
    public static class GoTalent
    {
        public enum Kind { Normal = 0, Skill = 1, Burst = 2 }
        public enum Mat { Note = 0, Guide = 1, Secret = 2, Knot = 3, Scale = 4 }

        public const int Max = 10;
        public const int Bonus = 2;
        public const int ConMax = 5;
        public const float C1SkillCd = 0.85f;
        public const float C2React = 1.2f;
        public const float C4Hp = 1.15f;
        public const float C5Sec = 8f;
        public const float C5Atk = 1.2f;

        public static readonly int[] CapByRank = { 3, 4, 5, 7, 9, 10 };
        public static readonly int[] RankLevel = { 1, 5, 10, 15, 20, 25 };
        public static readonly float[] Mul = { 1.0f, 1.08f, 1.16f, 1.24f, 1.32f, 1.4f, 1.48f, 1.58f, 1.68f, 1.78f, 1.88f, 1.98f, 2.1f };

        public readonly struct Cost
        {
            public readonly int Gold; public readonly Mat Book; public readonly int Books; public readonly int Scale;
            public Cost(int gold, Mat book, int books, int scale = 0) { Gold = gold; Book = book; Books = books; Scale = scale; }
        }

        /// <summary>n 단 → n+1 단(n = 1~9) — 웹 COST 그대로(단사 뺌).</summary>
        public static readonly Cost[] Costs =
        {
            new Cost(100, Mat.Note, 2), new Cost(160, Mat.Guide, 2), new Cost(220, Mat.Guide, 3), new Cost(300, Mat.Guide, 5),
            new Cost(400, Mat.Guide, 8), new Cost(1000, Mat.Secret, 3), new Cost(2200, Mat.Secret, 5, 1), new Cost(4000, Mat.Secret, 10, 2),
            new Cost(6500, Mat.Secret, 14, 2),
        };

        /// <summary>얻는 곳 — 상자 등급별(평범·정교·진귀·화려) [쪽지, 교본, 비전, 매듭, 비늘].</summary>
        public static readonly int[][] ChestMats =
        {
            new[] { 1, 0, 0, 0, 0 }, new[] { 2, 0, 0, 0, 0 }, new[] { 0, 2, 0, 1, 0 }, new[] { 0, 3, 1, 2, 0 },
        };
        public static readonly int[] EliteMats = { 1, 0, 0, 0, 0 };   // 방패 두른 원소 괴물 하나
        public const int KnotPerShrineLevel = 1;                       // 신상 등급 하나마다

        public static int RankOf(int partyLevel)
        {
            int r = 0;
            for (int i = 0; i < RankLevel.Length; i++) if (partyLevel >= RankLevel[i]) r = i;
            return r;
        }

        public static int CapOf(int partyLevel) => CapByRank[RankOf(partyLevel)];

        /// <summary>그 단계를 여는 부대 레벨.</summary>
        public static int LevelFor(int talentLevel)
        {
            for (int r = 0; r < CapByRank.Length; r++) if (CapByRank[r] >= talentLevel) return RankLevel[r];
            return RankLevel[RankLevel.Length - 1];
        }

        public static float MulAt(int lv) => Mul[Mathf.Clamp(lv, 1, Mul.Length) - 1];

        public static string KindName(Kind k) => k switch
        {
            Kind.Normal => GoLocalization.T("talent.kind.normal", "기본 공격"),
            Kind.Skill => GoLocalization.T("talent.kind.skill", "원소 스킬"),
            _ => GoLocalization.T("talent.kind.burst", "원소 해방"),
        };

        public static string MatName(Mat m) => m switch
        {
            Mat.Note => GoLocalization.T("talent.mat.note", "무예 쪽지"),
            Mat.Guide => GoLocalization.T("talent.mat.guide", "무예 교본"),
            Mat.Secret => GoLocalization.T("talent.mat.secret", "무예 비전"),
            Mat.Knot => GoLocalization.T("talent.mat.knot", "인연 매듭"),
            _ => GoLocalization.T("talent.mat.scale", "뇌룡 비늘"),
        };

        public static string ConText(int n) => n switch
        {
            1 => GoLocalization.T("talent.con1", "원소 스킬 재사용 대기 -15%"),
            2 => GoLocalization.T("talent.con2", "원소 반응 피해 +20%"),
            3 => GoLocalization.T("talent.con3", "원소 스킬·해방 무예 +2"),
            4 => GoLocalization.T("talent.con4", "최대 체력 +15%"),
            _ => GoLocalization.T("talent.con5", "원소 해방 뒤 8초 공격 +20%"),
        };
    }

    /// <summary>109-14-4 동행마다 무예 단계·깨달음과 재료 주머니(세이브 v20).</summary>
    public static class TalentState
    {
        private static readonly Dictionary<string, int[]> _lv = new Dictionary<string, int[]>();
        private static readonly Dictionary<string, int> _con = new Dictionary<string, int>();
        private static readonly int[] _mats = new int[5];
        public static event System.Action Changed;

        public static bool Trainable(string id) => id != null && GoHeroes.TryGet(id, out _) && HeroDexState.IsRecruited(id);

        public static int BaseLevel(string id, GoTalent.Kind k) => id != null && _lv.TryGetValue(id, out var a) ? a[(int)k] : 1;
        public static int Con(string id) => id != null && _con.TryGetValue(id, out var c) ? c : 0;
        public static int Level(string id, GoTalent.Kind k) => BaseLevel(id, k) + (k != GoTalent.Kind.Normal && Con(id) >= 3 ? GoTalent.Bonus : 0);
        public static float Mul(string id, GoTalent.Kind k) => GoTalent.MulAt(Level(id, k));
        public static int Count(GoTalent.Mat m) => _mats[(int)m];

        public static float SkillCdMul(string id) => Con(id) >= 1 ? GoTalent.C1SkillCd : 1f;
        public static float ReactMul(string id) => Con(id) >= 2 ? GoTalent.C2React : 1f;
        public static float HpMul(string id) => Con(id) >= 4 ? GoTalent.C4Hp : 1f;
        public static bool BurstBuff(string id) => Con(id) >= 5;

        /// <summary>올릴 수 있나 — 안 되면 까닭(값은 cost 에).</summary>
        public static bool CanUp(string id, GoTalent.Kind k, out string why, out GoTalent.Cost cost)
        {
            cost = default;
            if (!Trainable(id)) { why = GoLocalization.T("talent.why.not_member", "동행이 아님"); return false; }
            int lv = BaseLevel(id, k);
            if (lv >= GoTalent.Max) { why = GoLocalization.T("talent.why.max", "최대 단계"); return false; }
            cost = GoTalent.Costs[lv - 1];
            if (lv >= GoTalent.CapOf(PlayerStats.Level))
            {
                why = string.Format(GoLocalization.T("talent.why.cap", "부대 Lv {0} 에 열림"), GoTalent.LevelFor(lv + 1));
                return false;
            }
            if (GoldState.Gold < cost.Gold) { why = GoLocalization.T("talent.why.gold", "금 부족"); return false; }
            if (Count(cost.Book) < cost.Books) { why = GoTalent.MatName(cost.Book) + " " + GoLocalization.T("talent.why.short", "부족"); return false; }
            if (cost.Scale > 0 && Count(GoTalent.Mat.Scale) < cost.Scale) { why = GoTalent.MatName(GoTalent.Mat.Scale) + " " + GoLocalization.T("talent.why.short", "부족"); return false; }
            why = null;
            return true;
        }

        public static bool Up(string id, GoTalent.Kind k)
        {
            if (!CanUp(id, k, out _, out var c)) return false;
            GoldState.TrySpend(c.Gold);
            _mats[(int)c.Book] -= c.Books;
            _mats[(int)GoTalent.Mat.Scale] -= c.Scale;
            if (!_lv.TryGetValue(id, out var a)) _lv[id] = a = new[] { 1, 1, 1 };
            a[(int)k]++;
            Changed?.Invoke();
            return true;
        }

        public static bool CanUnlockCon(string id, out string why)
        {
            if (!Trainable(id)) { why = GoLocalization.T("talent.why.not_member", "동행이 아님"); return false; }
            if (Con(id) >= GoTalent.ConMax) { why = GoLocalization.T("talent.why.con_full", "모두 열림"); return false; }
            if (Count(GoTalent.Mat.Knot) < 1) { why = GoTalent.MatName(GoTalent.Mat.Knot) + " " + GoLocalization.T("talent.why.short", "부족"); return false; }
            why = null;
            return true;
        }

        public static bool UnlockCon(string id)
        {
            if (!CanUnlockCon(id, out _)) return false;
            _mats[(int)GoTalent.Mat.Knot]--;
            _con[id] = Con(id) + 1;
            Changed?.Invoke();
            return true;
        }

        /// <summary>재료를 더한다 — 더한 것을 "무예 쪽지 +1 · …" 한 줄로(없으면 빈 글).</summary>
        public static string Add(int[] bag, int times = 1)
        {
            var parts = new List<string>();
            for (int i = 0; i < _mats.Length && i < bag.Length; i++)
            {
                int n = bag[i] * times;
                if (n <= 0) continue;
                _mats[i] += n;
                parts.Add($"{GoTalent.MatName((GoTalent.Mat)i)} +{n}");
            }
            if (parts.Count > 0) Changed?.Invoke();
            return string.Join(" · ", parts);
        }

        [System.Serializable]
        public struct Entry { public string id; public int n, s, b, con; }

        public static List<Entry> Snapshot()
        {
            var ids = new HashSet<string>(_lv.Keys);
            foreach (var k in _con.Keys) ids.Add(k);
            var list = new List<Entry>();
            foreach (var id in ids)
                list.Add(new Entry { id = id, n = BaseLevel(id, GoTalent.Kind.Normal), s = BaseLevel(id, GoTalent.Kind.Skill), b = BaseLevel(id, GoTalent.Kind.Burst), con = Con(id) });
            list.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return list;
        }

        public static int[] SnapshotMats() => (int[])_mats.Clone();

        public static void Restore(List<Entry> entries, int[] mats)
        {
            _lv.Clear();
            _con.Clear();
            System.Array.Clear(_mats, 0, _mats.Length);
            if (entries != null)
                foreach (var e in entries)
                {
                    if (string.IsNullOrEmpty(e.id)) continue;
                    _lv[e.id] = new[] { Mathf.Clamp(e.n, 1, GoTalent.Max), Mathf.Clamp(e.s, 1, GoTalent.Max), Mathf.Clamp(e.b, 1, GoTalent.Max) };
                    if (e.con > 0) _con[e.id] = Mathf.Clamp(e.con, 0, GoTalent.ConMax);
                }
            if (mats != null) for (int i = 0; i < _mats.Length && i < mats.Length; i++) _mats[i] = Mathf.Max(0, mats[i]);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, null);
    }
}
