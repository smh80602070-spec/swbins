using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.st.job-tiers` 전직 1~4차 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 표: 차수마다 넷·`From` 이 한 칸 아래 자리를 일대일로 가리킴·키/이름 중복 0·능력치가 사슬을 따라 늘어남
    /// ② 요구 레벨 10·15·20·25 / 아랫자리 무예 0·5·8·10 ③ 1차 고르기(레벨 부족·모르는 키·윗자리 키·두 번째 거절) ④ 네 갈래 모두 1→4차 승급(레벨 → 아랫자리 무예 순으로 막힘,
    /// 윗자리 아닌 무예는 안 침, 4차에서 끝) ⑤ 자리 사슬 능력치 합 ⑥ 모르는 자리 복원·`JobChosen` 이벤트.
    /// `-executeMethod Saga.EditorTools.PlaytestStoryJobTiers.Run` → "[PlaytestStoryJobTiers] OK/FAIL".
    /// </summary>
    public static class PlaytestStoryJobTiers
    {
        [MenuItem("Saga/Playtest Story Job Tiers")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestStoryJobTiers]");
            int lv0 = StoryJobState.Level;
            float exp0 = StoryJobState.Exp;
            string job0 = StoryJobState.Job;
            StorySkillState.Snapshot(out var keys0, out var levels0);
            string[] pins0 = StorySkillState.SnapshotPins();
            using (PlaytestKit.ErrorCounter())
            {
                CheckTables();
                CheckThresholds();
                CheckChoose();
                foreach (string root in StoryCombat.JobOrder) CheckPromotion(root);
                CheckChainBonus();
                CheckAwakening();
                CheckRestoreAndEvent();
            }
            StoryJobState.Restore(lv0, exp0, job0);
            StorySkillState.Restore(keys0, levels0, pins0);
            PlaytestKit.Summary("PlaytestStoryJobTiers");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckTables()
        {
            var seenKeys = new HashSet<string>();
            var seenNames = new HashSet<string>();
            var tables = new List<Dictionary<string, StoryCombat.JobInfo>> { StoryCombat.JobsTier1 };
            tables.AddRange(StoryCombat.UpperJobTables);
            PlaytestKit.Check(tables.Count == 5, $"un.st.job-tiers: 차수 표 {tables.Count}개 (기대 5)");
            for (int t = 0; t < tables.Count; t++)
            {
                PlaytestKit.Check(tables[t].Count == 4, $"un.st.job-tiers: {t + 1}차 {tables[t].Count}자리 (기대 4)");
                var successors = new HashSet<string>();
                foreach (var kv in tables[t])
                {
                    var info = kv.Value;
                    PlaytestKit.Check(seenKeys.Add(kv.Key), $"un.st.job-tiers: 키 중복 {kv.Key}");
                    PlaytestKit.Check(!string.IsNullOrEmpty(info.Name) && seenNames.Add(info.Name), $"un.st.job-tiers: {kv.Key} 이름이 비었거나 중복");
                    PlaytestKit.Check(info.Tier == t + 1, $"un.st.job-tiers: {kv.Key} Tier={info.Tier} (기대 {t + 1})");
                    if (t == 0)
                    {
                        PlaytestKit.Check(info.From == null, $"un.st.job-tiers: 1차 {kv.Key} 에 From 이 있음");
                        continue;
                    }
                    PlaytestKit.Check(tables[t - 1].TryGetValue(info.From ?? "", out var below), $"un.st.job-tiers: {kv.Key} From={info.From} 가 {t}차에 없음");
                    PlaytestKit.Check(successors.Add(info.From ?? ""), $"un.st.job-tiers: {info.From} 의 윗자리가 둘 이상");
                    if (tables[t - 1].TryGetValue(info.From ?? "", out below))
                    {
                        PlaytestKit.Check(info.Hp > below.Hp && info.Atk > below.Atk && info.Mp >= below.Mp, $"un.st.job-tiers: {kv.Key} 능력치가 아랫자리 {info.From} 보다 안 늘어남");
                        PlaytestKit.Check((info.Mp > 0f) == (below.Mp > 0f), $"un.st.job-tiers: {kv.Key} 와 {info.From} 의 마력 유무가 다름");
                    }
                }
            }
            var order = new HashSet<string>(StoryCombat.JobOrder);
            PlaytestKit.Check(order.Count == 4 && order.SetEquals(StoryCombat.JobsTier1.Keys), "un.st.job-tiers: JobOrder 가 1차 키와 다름");
        }

        private static void CheckThresholds()
        {
            int[] lv = { 10, 15, 20, 25, 30 };
            int[] sk = { 0, 5, 8, 10, 10 };
            for (int tier = 1; tier <= 5; tier++)
            {
                PlaytestKit.Check(StoryCombat.PromoteLevelFor(tier) == lv[tier - 1], $"un.st.job-tiers: {tier}차 요구 레벨 {StoryCombat.PromoteLevelFor(tier)} (기대 {lv[tier - 1]})");
                PlaytestKit.Check(StoryCombat.PromoteSkillLevelFor(tier) == sk[tier - 1], $"un.st.job-tiers: {tier}차 요구 무예 {StoryCombat.PromoteSkillLevelFor(tier)} (기대 {sk[tier - 1]})");
            }
            PlaytestKit.Check(StoryCombat.JobChangeLevel == lv[0], "un.st.job-tiers: JobChangeLevel 이 1차 요구 레벨과 다름");
        }

        private static void CheckChoose()
        {
            StorySkillState.Restore(null, null);
            StoryJobState.Restore(StoryCombat.JobChangeLevel - 1, 0f, StoryJobState.NoJob);
            PlaytestKit.Check(!StoryJobState.CanChooseJob && !StoryJobState.ChooseJob("warrior") && !StoryJobState.HasJob, "un.st.job-tiers: 레벨 부족인데 1차가 골라짐");
            StoryJobState.Restore(StoryCombat.JobChangeLevel, 0f, StoryJobState.NoJob);
            PlaytestKit.Check(StoryJobState.CanChooseJob, "un.st.job-tiers: 요구 레벨인데 못 고름");
            PlaytestKit.Check(!StoryJobState.ChooseJob("nope") && !StoryJobState.ChooseJob("general") && !StoryJobState.HasJob, "un.st.job-tiers: 모르는 키·윗자리 키가 1차로 골라짐");
            PlaytestKit.Check(StoryJobState.ChooseJob("mage") && StoryJobState.Job == "mage" && StoryJobState.Tier == 1, "un.st.job-tiers: 1차 고르기 실패");
            PlaytestKit.Check(!StoryJobState.CanChooseJob && !StoryJobState.ChooseJob("warrior") && StoryJobState.Job == "mage", "un.st.job-tiers: 전직이 한 번 더 됨");
        }

        private static StorySkillData.Skill PickSkill(string job, int needLevel)
        {
            foreach (var sk in StorySkillData.OfJob(job)) if (sk.Max >= needLevel) return sk;
            return null;
        }

        /// <summary>그 무예를 level 까지 찍는다 — 2차 이상 무예는 선행(아랫자리 무예 5)을 먼저 채운다.</summary>
        private static void RaiseTo(StorySkillData.Skill sk, int level)
        {
            if (sk.Need != null) RaiseTo(StorySkillData.Get(sk.Need), sk.NeedLv);
            while (StorySkillState.LevelOf(sk.Key) < level)
                if (!StorySkillState.Raise(sk.Key)) { PlaytestKit.Fail($"un.st.job-tiers: {sk.Key} 를 {level} 까지 못 찍음(lv={StorySkillState.LevelOf(sk.Key)} {StorySkillState.CanRaise(sk.Key)})"); return; }
        }

        private static void CheckPromotion(string root)
        {
            StorySkillState.Restore(null, null);
            StoryJobState.Restore(StoryCombat.JobChangeLevel, 0f, StoryJobState.NoJob);
            PlaytestKit.Check(StoryJobState.ChooseJob(root), $"un.st.job-tiers: {root} 1차 고르기 실패");
            string cur = root;
            string lowerSkillJob = null;
            for (int tier = 2; tier <= 5; tier++)
            {
                string next = StoryJobState.NextJob;
                PlaytestKit.Check(next != null && StoryCombat.TryGetJob(next, out var ni) && ni.Tier == tier && ni.From == cur, $"un.st.job-tiers: {root} {tier - 1}차 {cur} 의 다음 자리 {next} 이상");
                if (next == null) return;
                int needLv = StoryCombat.PromoteLevelFor(tier);
                int needSk = StoryCombat.PromoteSkillLevelFor(tier);
                StoryJobState.Restore(needLv - 1, 0f, cur);
                PlaytestKit.Check(StoryJobState.PromoteBlock() == "job.why_level" && !StoryJobState.Promote() && StoryJobState.Job == cur, $"un.st.job-tiers: {root} {tier}차 레벨 부족이 안 막힘({StoryJobState.PromoteBlock()})");
                StoryJobState.Restore(needLv, 0f, cur);
                PlaytestKit.Check(StoryJobState.PromoteBlock() == "job.why_skill", $"un.st.job-tiers: {root} {tier}차 무예 없이 열림({StoryJobState.PromoteBlock()})");
                // 더 아랫자리 무예는 요구에 안 센다(지금 자리 무예만).
                if (lowerSkillJob != null)
                {
                    var low = PickSkill(lowerSkillJob, needSk);
                    if (low != null) RaiseTo(low, needSk);
                    PlaytestKit.Check(StoryJobState.PromoteBlock() == "job.why_skill", $"un.st.job-tiers: {root} {tier}차에 아랫자리 무예가 요구로 셈");
                }
                var sk = PickSkill(cur, needSk);
                PlaytestKit.Check(sk != null, $"un.st.job-tiers: {cur} 에 상한 ≥{needSk} 인 무예가 없음");
                if (sk == null) return;
                RaiseTo(sk, needSk - 1);
                PlaytestKit.Check(StoryJobState.PromoteBlock() == "job.why_skill", $"un.st.job-tiers: {root} {tier}차 무예 {needSk - 1} 에서 열림");
                RaiseTo(sk, needSk);
                PlaytestKit.Check(StoryJobState.CanPromote, $"un.st.job-tiers: {root} {tier}차 조건을 채웠는데 안 열림({StoryJobState.PromoteBlock()})");
                PlaytestKit.Check(StoryJobState.Promote() && StoryJobState.Job == next && StoryJobState.Tier == tier, $"un.st.job-tiers: {root} {tier}차 승급 실패");
                PlaytestKit.Check(StoryJobState.Root == root && StoryJobState.InChain(root) && StoryJobState.InChain(cur) && StoryJobState.InChain(next), $"un.st.job-tiers: {root} {tier}차 사슬·뿌리 이상");
                PlaytestKit.Check(StorySkillState.LevelOf(sk.Key) == needSk, $"un.st.job-tiers: 승급이 무예 레벨을 건드림 {sk.Key}={StorySkillState.LevelOf(sk.Key)}");
                lowerSkillJob = cur;
                cur = next;
            }
            PlaytestKit.Check(StoryJobState.NextJob == null && StoryJobState.PromoteBlock() == "job.why_no_next" && !StoryJobState.Promote(), $"un.st.job-tiers: {root} 5차 뒤에도 승급이 열림");
        }

        // 5차 각성기(tasks U-0025): 갈래마다 둘(태허는 회복 하나를 뺀 하나), 4차 무예 하나가 선행(NeedLv 5)이고 같은 유파·효과가 회복이 아니다.
        // 자리를 5차로 두고 각성기 하나를 찍으면 무예 칸 맨 앞에 놓인다(윗자리 무예부터 채운다).
        private static void CheckAwakening()
        {
            var expect = new Dictionary<string, int> { ["godwar"] = 2, ["skybow"] = 2, ["noshadow"] = 2, ["voidsage"] = 1 };
            foreach (var kv in StoryCombat.JobsTier5)
            {
                var skills = StorySkillData.OfJob(kv.Key);
                PlaytestKit.Check(skills.Count == expect[kv.Key], $"un.st.job-tiers: {kv.Key} 각성기 {skills.Count}개 (기대 {expect[kv.Key]})");
                foreach (var sk in skills)
                {
                    PlaytestKit.Check(sk.Tier == 5 && sk.Need != null && sk.NeedLv == 5, $"un.st.job-tiers: {sk.Key} 차수·선행이 이상");
                    var need = StorySkillData.Get(sk.Need);
                    PlaytestKit.Check(need != null && need.Job == kv.Value.From && need.School == sk.School, $"un.st.job-tiers: {sk.Key} 선행 {sk.Need} 가 4차 {kv.Value.From} 의 같은 유파가 아님");
                    var school = StorySkillData.GetSchool(sk.School);
                    PlaytestKit.Check(school != null && school.Kind != StorySkillData.SchoolKind.Heal, $"un.st.job-tiers: {sk.Key} 유파가 회복(이 트랙엔 없음)");
                }
                StorySkillState.Restore(null, null);
                StoryJobState.Restore(99, 0f, kv.Key);
                if (skills.Count > 0)
                {
                    RaiseTo(skills[0], 1);
                    var slots = StorySkillState.SlotSkills();
                    PlaytestKit.Check(slots.Count > 0 && slots[0].Key == skills[0].Key, $"un.st.job-tiers: {kv.Key} 각성기가 무예 칸 맨 앞이 아님({(slots.Count > 0 ? slots[0].Key : "빈 칸")})");
                }
            }
        }

        private static void CheckChainBonus()
        {
            foreach (string root in StoryCombat.JobOrder)
            {
                string top = root;
                while (true)
                {
                    string next = null;
                    foreach (var table in StoryCombat.UpperJobTables)
                        foreach (var kv in table) if (kv.Value.From == top) next = kv.Key;
                    if (next == null) break;
                    top = next;
                }
                float hp = 0f, atk = 0f, mp = 0f;
                for (string k = top; k != null && StoryCombat.TryGetJob(k, out var i); k = i.From) { hp += i.Hp; atk += i.Atk; mp += i.Mp; }
                StoryJobState.Restore(30, 0f, top);
                PlaytestKit.Check(Mathf.Approximately(StoryJobState.HpBonus, hp) && Mathf.Approximately(StoryJobState.AtkBonus, atk) && Mathf.Approximately(StoryJobState.MpBonus, mp),
                    $"un.st.job-tiers: {top} 사슬 합 hp={StoryJobState.HpBonus}/{hp} atk={StoryJobState.AtkBonus}/{atk} mp={StoryJobState.MpBonus}/{mp}");
            }
        }

        private static void CheckRestoreAndEvent()
        {
            string last = null;
            int fired = 0;
            void On(string job) { last = job; fired++; }
            StoryJobState.JobChosen += On;
            try
            {
                StoryJobState.Restore(0, -5f, "nope");
                PlaytestKit.Check(StoryJobState.Level == 1 && StoryJobState.Exp == 0f && StoryJobState.Job == StoryJobState.NoJob && fired == 1 && last == StoryJobState.NoJob,
                    $"un.st.job-tiers: 모르는 자리 복원 lv={StoryJobState.Level} exp={StoryJobState.Exp} job={StoryJobState.Job} fired={fired}");
                StoryJobState.Restore(10, 0f, StoryJobState.NoJob);
                StoryJobState.ChooseJob("rogue");
                PlaytestKit.Check(fired == 3 && last == "rogue", $"un.st.job-tiers: 1차 고르기 이벤트 fired={fired} last={last}");
                StoryJobState.Restore(15, 0f, "rogue");
                var sk = PickSkill("rogue", 5);
                StorySkillState.Restore(null, null);
                if (sk != null) RaiseTo(sk, 5);
                int before = fired;
                PlaytestKit.Check(StoryJobState.Promote() && fired == before + 1 && last == "assassin", $"un.st.job-tiers: 승급 이벤트 fired={fired - before} last={last}");
                int b2 = fired;
                StoryJobState.Promote();
                PlaytestKit.Check(fired == b2, "un.st.job-tiers: 못 한 승급에 이벤트가 울림");
            }
            finally { StoryJobState.JobChosen -= On; }
        }
    }
}
