using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.st.school-sets` 유파 세트·옷 빛깔 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 유파 표: 무예가 가리키는 유파가 모두 있음·유파 값 ② 표의 유파마다(무예 하나→세트 없음·둘 이상→2세트·넷→4세트)
    /// 익힌 수만큼 `SchoolTier`·`BonusOf`(종류별 DmgMul/AoeMul/BuffMul/ShotsAdd/CooldownMul/CritForce)가 맞고 남의 유파 무예는 보정이 없음 ③ 고정 칸으로 세트를 깨고 되돌리기
    /// ④ 옷 빛깔: 차수 × 12%·상한 60%·무명 0, 갈래 색 넷이 서로 다르고 모르는 갈래는 흰색.
    /// `-executeMethod Saga.EditorTools.PlaytestStorySchoolSets.Run` → "[PlaytestStorySchoolSets] OK/FAIL".
    /// </summary>
    public static class PlaytestStorySchoolSets
    {
        [MenuItem("Saga/Playtest Story School Sets")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestStorySchoolSets]");
            int lv0 = StoryJobState.Level;
            float exp0 = StoryJobState.Exp;
            string job0 = StoryJobState.Job;
            StorySkillState.Snapshot(out var keys0, out var levels0);
            string[] pins0 = StorySkillState.SnapshotPins();
            using (PlaytestKit.ErrorCounter())
            {
                CheckSchoolTable();
                CheckAllSchools();
                CheckPinsBreakSet();
                CheckOutfitTint();
            }
            StoryJobState.Restore(lv0, exp0, job0);
            StorySkillState.Restore(keys0, levels0, pins0);
            PlaytestKit.Summary("PlaytestStorySchoolSets");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static readonly Dictionary<string, string> TopJob = new Dictionary<string, string>
        {
            ["warrior"] = "warlord", ["archer"] = "falcon", ["rogue"] = "reaper", ["mage"] = "ascendant",
        };

        private static List<StorySkillData.Skill> SkillsOf(string school) =>
            StorySkillData.All.Where(s => s.School == school).OrderBy(s => s.Tier).ToList();

        private static void Learn(IEnumerable<StorySkillData.Skill> skills, string job)
        {
            StoryJobState.Restore(40, 0f, job);
            var list = skills.ToList();
            StorySkillState.Restore(list.Select(s => s.Key).ToArray(), list.Select(_ => 1).ToArray());
        }

        private static void CheckSchoolTable()
        {
            var ids = new HashSet<string>();
            foreach (var school in StorySkillData.Schools)
            {
                PlaytestKit.Check(ids.Add(school.Id), $"un.st.school-sets: 유파 id 중복 {school.Id}");
                PlaytestKit.Check(!string.IsNullOrEmpty(school.Name) && school.V2 > 0f && school.V4 > 0f, $"un.st.school-sets: 유파 {school.Id} 이름·값 이상");
                PlaytestKit.Check(StorySkillData.GetSchool(school.Id) == school, $"un.st.school-sets: GetSchool({school.Id}) 가 자기 자신이 아님");
            }
            PlaytestKit.Check(StorySkillData.GetSchool("nope") == null && StorySkillState.SchoolTier(null) == 0, "un.st.school-sets: 모르는 유파가 null/0 이 아님");
            foreach (var sk in StorySkillData.All)
                PlaytestKit.Check(ids.Contains(sk.School), $"un.st.school-sets: 무예 {sk.Key} 의 유파 {sk.School} 가 표에 없음");
        }

        private static void ExpectBonus(StorySkillData.School school, int tier, StorySkillState.SchoolBonus b, string tag)
        {
            float v = tier == 4 ? school.V4 : school.V2;
            var none = StorySkillState.SchoolBonus.None;
            float dmg = none.DmgMul, aoe = none.AoeMul, buff = none.BuffMul, cd = none.CooldownMul;
            int shots = 0;
            bool crit = false;
            switch (school.Kind)
            {
                case StorySkillData.SchoolKind.Dmg: dmg = v; break;
                case StorySkillData.SchoolKind.Aoe: aoe = v; break;
                case StorySkillData.SchoolKind.Buff: buff = v; break;
                case StorySkillData.SchoolKind.Volley: shots = Mathf.RoundToInt(v); break;
                case StorySkillData.SchoolKind.Dash: cd = school.V2; crit = tier >= 4; break;
            }
            bool ok = Mathf.Approximately(b.DmgMul, dmg) && Mathf.Approximately(b.AoeMul, aoe) && Mathf.Approximately(b.BuffMul, buff)
                      && Mathf.Approximately(b.CooldownMul, cd) && b.ShotsAdd == shots && b.CritForce == crit;
            PlaytestKit.Check(ok, $"un.st.school-sets: {tag} 보정 dmg={b.DmgMul} aoe={b.AoeMul} buff={b.BuffMul} cd={b.CooldownMul} shots={b.ShotsAdd} crit={b.CritForce} (기대 {dmg}/{aoe}/{buff}/{cd}/{shots}/{crit})");
        }

        private static void CheckAllSchools()
        {
            int checkedSchools = 0, four = 0;
            foreach (var school in StorySkillData.Schools)
            {
                var skills = SkillsOf(school.Id);
                if (skills.Count == 0) continue; // 회복 유파는 이 트랙에 무예가 없다.
                checkedSchools++;
                var top = skills.OrderByDescending(s => s.Tier).First();
                string job = top.Job;
                // 위 자리의 사슬이 아래 무예들을 다 품는지(표가 한 갈래 사슬 안에 있는지).
                StoryJobState.Restore(40, 0f, job);
                PlaytestKit.Check(skills.All(s => StoryJobState.InChain(s.Job)), $"un.st.school-sets: {school.Id} 무예가 한 사슬에 안 듦");

                // 하나만 익힘 → 세트 없음.
                Learn(skills.Take(1), job);
                PlaytestKit.Check(StorySkillState.SchoolTier(school.Id) == 0, $"un.st.school-sets: {school.Id} 하나인데 세트 {StorySkillState.SchoolTier(school.Id)}");
                var none = StorySkillState.BonusOf(skills[0]);
                PlaytestKit.Check(Mathf.Approximately(none.DmgMul, 1f) && Mathf.Approximately(none.CooldownMul, 1f) && none.ShotsAdd == 0 && !none.CritForce, $"un.st.school-sets: {school.Id} 하나인데 보정이 붙음");

                // 둘 → 2세트(셋이어도 2세트).
                int two = Mathf.Min(skills.Count, skills.Count == 4 ? 2 : 3);
                Learn(skills.Take(two), job);
                PlaytestKit.Check(StorySkillState.SchoolTier(school.Id) == 2, $"un.st.school-sets: {school.Id} {two}개인데 세트 {StorySkillState.SchoolTier(school.Id)} (기대 2)");
                ExpectBonus(school, 2, StorySkillState.BonusOf(skills[0]), $"{school.Id} 2세트");

                if (skills.Count < 4) continue;
                four++;
                Learn(skills, job);
                PlaytestKit.Check(StorySkillState.SchoolTier(school.Id) == 4, $"un.st.school-sets: {school.Id} 4개인데 세트 {StorySkillState.SchoolTier(school.Id)}");
                ExpectBonus(school, 4, StorySkillState.BonusOf(skills[0]), $"{school.Id} 4세트");
            }
            PlaytestKit.Check(checkedSchools >= 20 && four >= 15, $"un.st.school-sets: 검사한 유파 {checkedSchools}개·4세트 {four}개(표가 줄었나)");

            // 남의 유파는 영향을 안 받는다(켜진 세트가 있어도).
            var wj = SkillsOf("w_jung");
            Learn(wj, "warlord");
            var other = StorySkillData.Get("w_whirl");
            var b = StorySkillState.BonusOf(other);
            PlaytestKit.Check(StorySkillState.SchoolTier("w_pae") == 0 && Mathf.Approximately(b.AoeMul, 1f) && Mathf.Approximately(b.DmgMul, 1f), "un.st.school-sets: 다른 유파 무예가 세트 보정을 받음");
            PlaytestKit.Check(StorySkillState.BonusOf(null).ShotsAdd == 0 && Mathf.Approximately(StorySkillState.BonusOf(null).DmgMul, 1f), "un.st.school-sets: BonusOf(null) 이 기본값이 아님");
        }

        private static void CheckPinsBreakSet()
        {
            var wj = SkillsOf("w_jung");
            Learn(wj, "warlord");
            PlaytestKit.Check(StorySkillState.SchoolTier("w_jung") == 4, "un.st.school-sets: 고정 검사 준비 — 4세트가 아님");
            // 다른 유파 무예 둘을 익혀 앞칸에 고정하면 w_jung 네 개 중 둘이 칸 밖으로 밀려 세트가 2 로 내려간다.
            var extra = new[] { StorySkillData.Get("w_whirl"), StorySkillData.Get("w_iron") };
            StorySkillState.Restore(wj.Concat(extra).Select(s => s.Key).ToArray(), wj.Concat(extra).Select(_ => 1).ToArray());
            PlaytestKit.Check(StorySkillState.TogglePin("w_whirl") == null && StorySkillState.TogglePin("w_iron") == null, "un.st.school-sets: 고정 실패");
            PlaytestKit.Check(StorySkillState.SchoolTier("w_jung") == 2, $"un.st.school-sets: 고정으로 칸이 밀렸는데 세트 {StorySkillState.SchoolTier("w_jung")} (기대 2)");
            StorySkillState.TogglePin("w_whirl");
            StorySkillState.TogglePin("w_iron");
            PlaytestKit.Check(StorySkillState.SchoolTier("w_jung") == 4, "un.st.school-sets: 고정을 풀었는데 4세트로 안 돌아옴");
        }

        private static void CheckOutfitTint()
        {
            PlaytestKit.Check(Mathf.Approximately(StoryOutfitTint.TintPerTier, 0.12f) && Mathf.Approximately(StoryOutfitTint.TintMax, 0.6f), "un.st.school-sets: 옷 빛깔 상수가 웹판(12%·60%)과 다름");
            foreach (string root in StoryCombat.JobOrder)
            {
                PlaytestKit.Check(StoryOutfitTint.MixFor(0, root) == 0f, $"un.st.school-sets: {root} 차수 0 인데 섞임");
                for (int tier = 1; tier <= 4; tier++)
                    PlaytestKit.Check(Mathf.Approximately(StoryOutfitTint.MixFor(tier, root), tier * 0.12f), $"un.st.school-sets: {root} {tier}차 비율 {StoryOutfitTint.MixFor(tier, root)} (기대 {tier * 0.12f})");
                PlaytestKit.Check(Mathf.Approximately(StoryOutfitTint.MixFor(9, root), StoryOutfitTint.TintMax), $"un.st.school-sets: {root} 상한을 안 지킴");
            }
            PlaytestKit.Check(StoryOutfitTint.MixFor(3, StoryJobState.NoJob) == 0f, "un.st.school-sets: 무명이 섞임");
            var colors = new HashSet<Color>();
            foreach (string root in StoryCombat.JobOrder)
            {
                var c = StoryOutfitTint.BranchColor(root);
                PlaytestKit.Check(c != Color.white && colors.Add(c), $"un.st.school-sets: {root} 갈래 색이 흰색이거나 겹침");
            }
            PlaytestKit.Check(StoryOutfitTint.BranchColor("nope") == Color.white && StoryOutfitTint.BranchColor(StoryJobState.NoJob) == Color.white, "un.st.school-sets: 모르는 갈래가 흰색이 아님");
            // 지금 자리 → 비율: 모든 자리에서 Tier·Root 로 계산한 값이 차수 × 12% 와 같다.
            foreach (var kv in TopJob)
            {
                StoryJobState.Restore(40, 0f, kv.Value);
                PlaytestKit.Check(StoryJobState.Root == kv.Key && Mathf.Approximately(StoryOutfitTint.MixFor(StoryJobState.Tier, StoryJobState.Root), 0.48f), $"un.st.school-sets: {kv.Value} 4차 비율 이상");
            }
        }
    }
}
