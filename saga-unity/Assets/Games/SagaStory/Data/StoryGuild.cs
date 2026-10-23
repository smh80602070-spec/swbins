using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0192 4종횡 문파(고돗 G-0333 `story_guild.gd` 짝, 웹 짝 없음 — 메이플 길드 구조만, NPC 문파) — 🏯 창에서 셋 중 하나에 든다(나가면 공 0).
    /// ⚔️ 검각(劍閣) 공격 · 💰 상단(商團) 재료 · 📜 서원(書院) 경험 — 단계마다 +<see cref="StepPct"/>%(문주 +10%).
    /// 이 판엔 돈이 없어(`StoryLife` 주석) 상단 덤은 금 대신 **채집 덤 재료 확률**(+단계×2%p). 사냥터가 들판·비경 둘뿐이라 오늘의 의뢰 사냥터는
    /// 날·문파로 둘 중 하나(고돗은 일곱). 처치마다 공 +1·두목 +<see cref="BossPts"/>, 오늘 의뢰 사냥터면 ×2. 문턱 100·300·700·1500·3000 → 제자~문주.
    /// </summary>
    public static class StoryGuild
    {
        public struct Guild { public string Id, Name, Hanja, Emoji, Fx, FxName; }

        public static readonly Guild[] All =
        {
            new Guild { Id = "blade", Name = "검각", Hanja = "劍閣", Emoji = "⚔️", Fx = "atk", FxName = "공격" },
            new Guild { Id = "merchant", Name = "상단", Hanja = "商團", Emoji = "💰", Fx = "mats", FxName = "채집 덤" },
            new Guild { Id = "academy", Name = "서원", Hanja = "書院", Emoji = "📜", Fx = "exp", FxName = "경험" },
        };
        public static readonly int[] Ranks = { 0, 100, 300, 700, 1500, 3000 };
        public static readonly string[] RankNames = { "입문", "제자", "사형", "장로", "부문주", "문주" };
        public static readonly string[] Hunts = { "field", "labyrinth" };
        public const float StepPct = 2f;
        public const int BossPts = 10;

        /// <summary>끄면 문파 없음(고돗 `SAGA_GUILD=0` 짝).</summary>
        public static bool On = true;
        /// <summary>진단 — 오늘 날짜(null = 기기 날짜).</summary>
        public static DateTime? TodayForTest;

        [Serializable]
        private class Store { public string id = ""; public int pts; }

        private static Store _s = new Store();

        public static event Action Changed;

        public static string Joined => On ? _s.id ?? "" : "";
        public static int Pts => _s.pts;

        public static int IndexOf(string id) { for (int i = 0; i < All.Length; i++) if (All[i].Id == id) return i; return -1; }

        public static int RankOf(int pts) { int r = 0; for (int i = 0; i < Ranks.Length; i++) if (pts >= Ranks[i]) r = i; return r; }
        public static int Rank => RankOf(_s.pts);

        public static int DayKey(DateTime d) => d.Year * 10000 + d.Month * 100 + d.Day;
        public static int Today => DayKey(TodayForTest ?? DateTime.Now);

        /// <summary>오늘의 의뢰 사냥터 — 날과 문파로 돌아감("field"·"labyrinth").</summary>
        public static string HuntToday(string id, int dayKey) => Hunts[(dayKey + Mathf.Max(0, IndexOf(id))) % Hunts.Length];

        public static string Name(int i) => StoryLocalization.T($"guild.{All[i].Id}", All[i].Name);
        public static string FxName(int i) => StoryLocalization.T($"guild.{All[i].Id}.fx", All[i].FxName);
        public static string RankName(int r) => StoryLocalization.T($"guild.rank{r}", RankNames[r]);
        public static string HuntName(string h) => h == "labyrinth" ? StoryLocalization.T("guild.hunt.labyrinth", "비경") : StoryLocalization.T("guild.hunt.field", "허창 들판");

        /// <summary>든다 — 안 되면 까닭.</summary>
        public static string Join(string id)
        {
            if (!On) return StoryLocalization.T("guild.off", "꺼져 있다");
            if (IndexOf(id) < 0) return StoryLocalization.T("guild.none_such", "없는 문파");
            if (Joined == id) return StoryLocalization.T("guild.already", "이미 든 문파다");
            _s = new Store { id = id, pts = 0 };
            Changed?.Invoke();
            return "";
        }

        public static void Leave() { _s = new Store(); Changed?.Invoke(); }

        /// <summary>처치 — 공 +1(두목 +10), 오늘 의뢰 사냥터면 ×2. 단계가 오르면 새 단계(아니면 −1).</summary>
        public static int OnKill(bool labyrinth, bool boss) => OnKill(labyrinth ? "labyrinth" : "field", boss, Today);

        public static int OnKill(string hunt, bool boss, int dayKey)
        {
            string id = Joined;
            if (id.Length == 0) return -1;
            int before = Rank;
            int n = boss ? BossPts : 1;
            if (hunt == HuntToday(id, dayKey)) n *= 2;
            _s.pts += n;
            Changed?.Invoke();
            int after = Rank;
            return after > before ? after : -1;
        }

        /// <summary>덤 — fx("atk"·"mats"·"exp")가 내 문파 갈래면 단계 × 2%(0~0.1), 아니면 0.</summary>
        public static float Bonus(string fx)
        {
            int i = IndexOf(Joined);
            return i < 0 || All[i].Fx != fx ? 0f : StepPct * Rank / 100f;
        }

        public static float AtkMul => 1f + Bonus("atk");
        public static float ExpMul => 1f + Bonus("exp");
        public static float MatsChance => Bonus("mats");

        public static string RankText()
        {
            int i = IndexOf(Joined);
            if (i < 0) return StoryLocalization.T("guild.no_guild", "문파 없음");
            int r = Rank;
            string next = r >= Ranks.Length - 1 ? "" : string.Format(StoryLocalization.T("guild.next", " · 다음 {0}까지 {1}"), RankName(r + 1), Ranks[r + 1] - _s.pts);
            return string.Format(StoryLocalization.T("guild.rank_line", "{0} {1}({2}) {3} · 공 {4}{5} · {6} +{7:0}%"),
                All[i].Emoji, Name(i), All[i].Hanja, RankName(r), _s.pts, next, FxName(i), StepPct * r);
        }

        public static string HuntLine()
        {
            string id = Joined;
            if (id.Length == 0) return "";
            return string.Format(StoryLocalization.T("guild.hunt_line", "📋 오늘의 문파 의뢰 — {0}에서 잡으면 공 두 배(두목 +{1})"), HuntName(HuntToday(id, Today)), BossPts);
        }

        public static string RankUpLine(int r)
        {
            int i = IndexOf(Joined);
            return i < 0 ? "" : string.Format(StoryLocalization.T("guild.rankup", "🏯 {0} {1} — {2} +{3:0}%"), Name(i), RankName(r), FxName(i), StepPct * r);
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.id == null || IndexOf(_s.id) < 0) _s = new Store();
            _s.pts = Mathf.Max(0, _s.pts);
        }

        public static void ResetForTest() => Restore(null);
        public static void SetPtsForTest(int pts) => _s.pts = Mathf.Max(0, pts);
    }
}
