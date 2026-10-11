using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 101-2 STORY 5-2 1단계 — 무예 레벨과 무예 점수(SP). 웹판
    /// `saga-web/saga-story/js/job.js`(levelOf·spTotal·spSpent·canRaise·mulOf) 규칙 그대로:
    /// SP는 세이브에 따로 안 담는 **파생값**((레벨-1)×<see cref="SpPerLevel"/> − 찍은 레벨 합),
    /// 레벨 0인 무예는 못 쓴다, 힘 = 기본 + 레벨당×(lv−1). 레벨당 점수는 웹판 현재값 2
    /// (§5-2가 3→2로 낮춘 뒤의 값 — 유파 2단계를 얹을 때 다시 안 바꾸려고 처음부터 맞춘다).
    ///
    /// 무예 칸(<see cref="SlotCount"/>개)은 웹판 조작 띠처럼 기본은 **자동으로** 채운다 —
    /// <see cref="SlotSkills"/>(윗자리부터 + 같은 유파 짝 먼저).
    ///
    /// **3단계(2026-09-23) — 칸 고정**: 4차까지 오르면 윗자리 무예만으로 칸 넷이 전부 다른
    /// 유파로 차 자동 배치로는 세트가 아예 안 켜진다(웹판은 띠가 8칸이라 덜 막힌다). 그래서
    /// 사람이 무예를 **칸에 고정**(<see cref="TogglePin"/>)할 수 있게 했다 — 고정한 것이 고정한
    /// 순서대로 앞 칸을 차지하고, 남은 칸은 예전 자동 배치가 채운다(고정한 무예와 같은 유파가
    /// 먼저 오므로 짝 하나만 고정해도 세트가 이어진다). 아무것도 안 고정하면 예전과 똑같다.
    /// </summary>
    public static class StorySkillState
    {
        public const int SpPerLevel = 2;
        public const int SlotCount = 4;

        private static readonly Dictionary<string, int> Levels = new Dictionary<string, int>();

        /// <summary>칸에 고정한 무예(고정한 순서 = 칸 순서, 최대 <see cref="SlotCount"/>).</summary>
        private static readonly List<string> Pins = new List<string>();

        /// <summary>무예 레벨이 바뀔 때(찍기·로드) — 패널·무예 칸 버튼이 다시 그린다.</summary>
        public static event Action Changed;

        public static int LevelOf(string key) => key != null && Levels.TryGetValue(key, out var lv) ? lv : 0;

        // tasks U-0093(웹 W-0104 "레벨업 무예 3택") — SP 는 <see cref="SpCutLv"/> 레벨까지만 쌓이고, 그 뒤 레벨마다 **서로 다른 유파 무예 셋 중 하나 +1**
        // (<see cref="Pick"/>, 고른 몫은 <see cref="FreeLevels"/> 로 따로 세어 SP 에서 안 뺀다) 또는 거절(<see cref="Decline"/> = 강화 점수 +1).
        // 고를 무예가 없는 레벨은 예전처럼 SP 2(<see cref="BonusSp"/>). SpCutLv 0 = 3택 꺼짐(옛 진단·세이브 없이 상태만 짠 경우 — 예전 그대로).
        // 세이브는 새 판이면 1, 옛 세이브(칸 없음)는 **불러올 때의 레벨** → 옛 SP·찍은 무예가 한 점도 안 변한다(StorySaveState).
        public static int SpCutLv { get; private set; }
        public static int FreeLevels { get; private set; }
        public static int BonusSp { get; private set; }
        /// <summary>아직 안 고른 3택 장 수(레벨 하나에 한 장).</summary>
        public static int PendingPicks { get; private set; }
        /// <summary>3택 장이 생기거나 줄 때 — 3택 창이 듣는다.</summary>
        public static event Action PicksChanged;

        public static int SpTotal => Mathf.Max(0, (Mathf.Min(StoryJobState.Level, SpCutLv > 0 ? SpCutLv : StoryJobState.Level) - 1) * SpPerLevel + BonusSp);

        public static int SpSpent
        {
            get
            {
                int sum = 0;
                foreach (var kv in Levels) sum += kv.Value;
                return Mathf.Max(0, sum - FreeLevels);
            }
        }

        public static int SpLeft => Mathf.Max(0, SpTotal - SpSpent);

        /// <summary>못 올리는 이유(현지화 키), 올릴 수 있으면 null — 웹판 canRaise()와 같은 순서.</summary>
        public static string CanRaise(string key)
        {
            var sk = StorySkillData.Get(key);
            if (sk == null) return "skill.why_unknown";
            // 2단계(2026-09-23) — 지금 자리 사슬(2차면 1차 무예도)의 무예면 찍을 수 있다(웹판 skillsOf()).
            if (!StoryJobState.HasJob || !StoryJobState.InChain(sk.Job)) return "skill.why_other_job";
            if (LevelOf(key) >= sk.Max) return "skill.why_maxed";
            if (SpLeft <= 0) return "skill.why_no_sp";
            if (sk.Need != null && LevelOf(sk.Need) < sk.NeedLv) return "skill.why_need";
            return null;
        }

        public static bool Raise(string key)
        {
            if (CanRaise(key) != null) return false;
            Levels[key] = LevelOf(key) + 1;
            Changed?.Invoke();
            return true;
        }

        /// <summary>3택으로 올릴 수 있는가 — <see cref="CanRaise"/> 에서 SP 검사만 뺀 것(이유 키, 되면 null).</summary>
        public static string CanPick(string key)
        {
            var sk = StorySkillData.Get(key);
            if (sk == null) return "skill.why_unknown";
            if (!StoryJobState.HasJob || !StoryJobState.InChain(sk.Job)) return "skill.why_other_job";
            if (LevelOf(key) >= sk.Max) return "skill.why_maxed";
            if (sk.Need != null && LevelOf(sk.Need) < sk.NeedLv) return "skill.why_need";
            return null;
        }

        /// <summary>3택 — 올릴 수 있는 무예 중 **유파가 서로 다른** 셋(모자라면 둘·하나·없음, 규격 D "같은 축 둘 금지"). 유파 없는 무예는 제 키가 유파.</summary>
        public static List<StorySkillData.Skill> Offer3(System.Random rng = null)
        {
            var pool = new List<StorySkillData.Skill>();
            foreach (var sk in StorySkillData.All) if (CanPick(sk.Key) == null) pool.Add(sk);
            for (int i = pool.Count - 1; i > 0; i--)
            {
                int j = rng != null ? rng.Next(i + 1) : UnityEngine.Random.Range(0, i + 1);
                (pool[i], pool[j]) = (pool[j], pool[i]);
            }
            var offer = new List<StorySkillData.Skill>();
            var schools = new HashSet<string>();
            foreach (var sk in pool)
            {
                if (offer.Count >= 3) break;
                if (schools.Add(string.IsNullOrEmpty(sk.School) ? sk.Key : sk.School)) offer.Add(sk);
            }
            return offer;
        }

        /// <summary>레벨이 오를 때(`StoryJobState.GainExp`) — 3택이 켜져 있고 문턱 위면 장 하나, 고를 것이 없으면 SP 2.</summary>
        public static void OnLevelUp(int level)
        {
            if (SpCutLv <= 0 || level <= SpCutLv) return;
            if (Offer3().Count == 0) BonusSp += SpPerLevel;
            else PendingPicks++;
            Changed?.Invoke();
            PicksChanged?.Invoke();
        }

        /// <summary>장 하나로 그 무예 +1(SP 안 씀). 장이 없거나 못 올리면 false.</summary>
        public static bool Pick(string key)
        {
            if (PendingPicks <= 0 || CanPick(key) != null) return false;
            Levels[key] = LevelOf(key) + 1;
            FreeLevels++;
            PendingPicks--;
            Changed?.Invoke();
            PicksChanged?.Invoke();
            return true;
        }

        /// <summary>장 하나를 거절 — 강화 점수(SP) +1. 고를 것이 아예 없어진 장은 <paramref name="nothingLeft"/> 로 SP 2.</summary>
        public static bool Decline(bool nothingLeft = false)
        {
            if (PendingPicks <= 0) return false;
            BonusSp += nothingLeft ? SpPerLevel : 1;
            PendingPicks--;
            Changed?.Invoke();
            PicksChanged?.Invoke();
            return true;
        }

        /// <summary>세이브 로드·진단 — 3택 몫. <paramref name="cutLv"/> 0 이면 3택 끔.</summary>
        public static void RestorePicks(int cutLv, int free, int bonus, int pending)
        {
            SpCutLv = Mathf.Max(0, cutLv);
            FreeLevels = Mathf.Max(0, free);
            BonusSp = Mathf.Max(0, bonus);
            PendingPicks = Mathf.Max(0, pending);
            Changed?.Invoke();
            PicksChanged?.Invoke();
        }

        public static float MulOf(StorySkillData.Skill sk) =>
            sk.MulBase + sk.MulPerLevel * Mathf.Max(0, LevelOf(sk.Key) - 1);

        /// <summary>무예 칸 i에 놓인 무예(비었으면 null).</summary>
        public static StorySkillData.Skill SlotSkill(int slot)
        {
            if (slot < 0 || slot >= SlotCount) return null;
            var list = SlotSkills();
            return slot < list.Count ? list[slot] : null;
        }

        /// <summary>그 무예를 고정한 칸 번호(0부터), 안 고정했으면 -1.</summary>
        public static int PinIndex(string key) => key != null ? Pins.IndexOf(key) : -1;

        public static int PinCount => Pins.Count;

        /// <summary>칸 고정을 켜고 끈다. 못 하면 이유(현지화 키) — 안 익힌 무예·칸이 다 찼을 때.
        /// 풀면 뒤의 고정이 한 칸씩 당겨진다.</summary>
        public static string TogglePin(string key)
        {
            int at = PinIndex(key);
            if (at >= 0)
            {
                Pins.RemoveAt(at);
                Changed?.Invoke();
                return null;
            }
            var sk = StorySkillData.Get(key);
            if (sk == null) return "skill.why_unknown";
            if (!StoryJobState.HasJob || !StoryJobState.InChain(sk.Job) || LevelOf(key) <= 0) return "skill.why_pin_unlearned";
            if (Pins.Count >= SlotCount) return "skill.why_pin_full";
            Pins.Add(key);
            Changed?.Invoke();
            return null;
        }

        /// <summary>무예 칸 넷. 먼저 **고정한 무예**(지금 자리 사슬에 들고 익힌 것만, 고정 순서),
        /// 남은 칸은 자동 배치 — 웹판 bar()처럼 **윗자리 무예부터**(같은 자리 안에선
        /// 표 순서) 찍은 것만 놓는다. **재해석(2026-09-23)**: 웹판 띠는 8칸이라 윗자리부터 놓기만
        /// 해도 같은 유파가 자연히 모이지만, 이 트랙은 4칸이라 표 순서만 따르면 2차 무예의 짝(같은
        /// 유파 1차)이 칸 밖으로 밀리기 쉽다 — 남은 자리엔 **이미 놓인 무예와 유파가 같은 것**을
        /// 먼저 놓아 세트를 이룬다. 사람이 고르지 않는 것은 웹판 그대로.</summary>
        public static List<StorySkillData.Skill> SlotSkills()
        {
            var picked = new List<StorySkillData.Skill>();
            if (!StoryJobState.HasJob) return picked;

            var learned = new List<StorySkillData.Skill>();
            foreach (var sk in StorySkillData.All)
            {
                if (StoryJobState.InChain(sk.Job) && LevelOf(sk.Key) > 0) learned.Add(sk);
            }
            foreach (var key in Pins)
            {
                var sk = StorySkillData.Get(key);
                if (sk != null && learned.Contains(sk) && picked.Count < SlotCount) picked.Add(sk);
            }
            for (int tier = StoryJobState.Tier; tier >= 1 && picked.Count < SlotCount; tier--)
            {
                // 이 자리 무예 중 — 먼저 이미 놓인 것과 유파가 같은 것, 그다음 표 순서.
                for (int pass = 0; pass < 2 && picked.Count < SlotCount; pass++)
                {
                    foreach (var sk in learned)
                    {
                        if (picked.Count >= SlotCount) break;
                        if (sk.Tier != tier || picked.Contains(sk)) continue;
                        if (pass == 0 && !picked.Exists(p => p.School == sk.School)) continue;
                        picked.Add(sk);
                    }
                }
            }
            return picked;
        }

        // ── 유파 세트(PLAN.md 101-2 5-2 2단계, 웹판 job.js schoolCounts·activeSchools·schoolBonus) ──

        /// <summary>그 유파가 지금 칸에서 켠 세트(0·2·4) — 웹판 activeSchools().</summary>
        public static int SchoolTier(string school)
        {
            if (school == null) return 0;
            int n = 0;
            foreach (var sk in SlotSkills()) if (sk.School == school) n++;
            return n >= 4 ? 4 : n >= 2 ? 2 : 0;
        }

        public struct SchoolBonus
        {
            public float DmgMul, AoeMul, BuffMul, CooldownMul;
            public int ShotsAdd;
            public bool CritForce;
            public static SchoolBonus None => new SchoolBonus { DmgMul = 1f, AoeMul = 1f, BuffMul = 1f, CooldownMul = 1f };
        }

        /// <summary>그 무예 하나가 지금 받는 세트 보정 — **판정은 여기 한 곳**(웹판 schoolBonus()).
        /// 시전 쪽은 결과를 제자리(배율·반경·지속·발수·재사용 대기)에 곱하거나 더할 뿐이다.
        /// **재해석 — dash**: 웹판 2세트는 회피(대시) 재사용 대기를 줄이는데 이 트랙엔 회피 동작이
        /// 없어, 그 유파의 dash 무예 자신의 재사용 대기에 곱한다(4세트 "급소 확정"은 그대로).</summary>
        public static SchoolBonus BonusOf(StorySkillData.Skill sk)
        {
            var b = SchoolBonus.None;
            if (sk == null) return b;
            int tier = SchoolTier(sk.School);
            var def = StorySkillData.GetSchool(sk.School);
            if (tier == 0 || def == null) return b;
            float v = tier == 4 ? def.V4 : def.V2;
            switch (def.Kind)
            {
                case StorySkillData.SchoolKind.Dmg: b.DmgMul = v; break;
                case StorySkillData.SchoolKind.Aoe: b.AoeMul = v; break;
                case StorySkillData.SchoolKind.Buff: b.BuffMul = v; break;
                case StorySkillData.SchoolKind.Volley: b.ShotsAdd = Mathf.RoundToInt(v); break;
                case StorySkillData.SchoolKind.Dash:
                    b.CooldownMul = def.V2;
                    b.CritForce = tier >= 4;
                    break;
                // Heal — 회복 무예가 이 트랙에 없어 적용할 자리가 없다.
            }
            return b;
        }

        public static void Snapshot(out string[] keys, out int[] levels)
        {
            var k = new List<string>();
            var l = new List<int>();
            foreach (var kv in Levels)
            {
                if (kv.Value <= 0) continue;
                k.Add(kv.Key);
                l.Add(kv.Value);
            }
            keys = k.ToArray();
            levels = l.ToArray();
        }

        public static string[] SnapshotPins() => Pins.ToArray();

        /// <summary>세이브 로드·테스트 초기화. 모르는 키(데이터에서 빠진 무예)와 상한 초과는
        /// 조용히 거른다 — 옛 세이브엔 두 배열이 아예 없어(null) 빈 상태로 시작한다. 칸 고정
        /// (<paramref name="pins"/>)도 같이 갈아 끼운다(없으면 고정 없음 = 자동 배치만).</summary>
        public static void Restore(string[] keys, int[] levels, string[] pins = null)
        {
            Levels.Clear();
            Pins.Clear();
            SpCutLv = 0; FreeLevels = 0; BonusSp = 0; PendingPicks = 0;   // tasks U-0093 — 3택 몫은 RestorePicks 가 다시 채운다(옛 진단은 꺼진 채)
            if (pins != null)
            {
                foreach (var key in pins)
                {
                    if (StorySkillData.Get(key) != null && !Pins.Contains(key) && Pins.Count < SlotCount) Pins.Add(key);
                }
            }
            if (keys != null && levels != null)
            {
                int n = Mathf.Min(keys.Length, levels.Length);
                for (int i = 0; i < n; i++)
                {
                    var sk = StorySkillData.Get(keys[i]);
                    if (sk == null || levels[i] <= 0) continue;
                    Levels[sk.Key] = Mathf.Min(levels[i], sk.Max);
                }
            }
            Changed?.Invoke();
        }
    }
}
