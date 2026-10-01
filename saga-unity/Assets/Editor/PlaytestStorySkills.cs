using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.st.skills` 무예 1~4차 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 표: 키 중복 0·자리·유파·선행 무예 ② SP: 레벨당 2·찍을수록 줄고 상한에서 막힘
    /// ③ 못 찍는 이유 순서(모르는 키·남의 자리·무명·SP 없음·선행) ④ 칸 고정: 안 익힌 것 거절·순서·가득 참·풀면 당김 ⑤ 자동 배치: 넷 이하·중복 없음·고정이 앞
    /// ⑥ 세이브 왕복(모르는 키·상한 초과·0 이하·중복 고정은 조용히 거름) ⑦ Changed 이벤트.
    /// `-executeMethod Saga.EditorTools.PlaytestStorySkills.Run` → "[PlaytestStorySkills] OK/FAIL".
    /// </summary>
    public static class PlaytestStorySkills
    {
        [MenuItem("Saga/Playtest Story Skills")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestStorySkills]");
            int lv0 = StoryJobState.Level;
            float exp0 = StoryJobState.Exp;
            string job0 = StoryJobState.Job;
            StorySkillState.Snapshot(out var keys0, out var levels0);
            string[] pins0 = StorySkillState.SnapshotPins();
            using (PlaytestKit.ErrorCounter())
            {
                CheckTable();
                CheckPoints();
                CheckReasons();
                CheckPins();
                CheckAutoSlots();
                CheckSnapshot();
                CheckChanged();
            }
            StoryJobState.Restore(lv0, exp0, job0);
            StorySkillState.Restore(keys0, levels0, pins0);
            PlaytestKit.Summary("PlaytestStorySkills");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Reset(int level, string job)
        {
            StoryJobState.Restore(level, 0f, job);
            StorySkillState.Restore(null, null);
        }

        private static void CheckTable()
        {
            var keys = new HashSet<string>();
            foreach (var sk in StorySkillData.All)
            {
                PlaytestKit.Check(keys.Add(sk.Key), $"un.st.skills: 키 중복 {sk.Key}");
                PlaytestKit.Check(StoryCombat.TryGetJob(sk.Job, out _), $"un.st.skills: {sk.Key} 자리 {sk.Job} 가 직업 표에 없음");
                PlaytestKit.Check(StorySkillData.GetSchool(sk.School) != null, $"un.st.skills: {sk.Key} 유파 {sk.School} 없음");
                PlaytestKit.Check(sk.Max >= 1 && sk.Cost >= 0f && sk.Cooldown >= 0f, $"un.st.skills: {sk.Key} 상한·비용·재사용 값 이상");
                if (sk.Need == null) continue;
                var need = StorySkillData.Get(sk.Need);
                PlaytestKit.Check(need != null && need.Key != sk.Key, $"un.st.skills: {sk.Key} 선행 {sk.Need} 가 없거나 자기 자신");
                PlaytestKit.Check(need != null && sk.NeedLv >= 1 && sk.NeedLv <= need.Max, $"un.st.skills: {sk.Key} 선행 레벨 {sk.NeedLv} 이 {sk.Need} 상한 밖");
            }
            foreach (var table in StoryCombat.JobsTier1)
                PlaytestKit.Check(StorySkillData.OfJob(table.Key).Count > 0, $"un.st.skills: 1차 {table.Key} 에 무예가 하나도 없음");
        }

        private static void CheckPoints()
        {
            Reset(10, "warrior");
            int total = (10 - 1) * StorySkillState.SpPerLevel;
            PlaytestKit.Check(StorySkillState.SpTotal == total && StorySkillState.SpLeft == total && StorySkillState.SpSpent == 0,
                $"un.st.skills: SP 파생값 total={StorySkillState.SpTotal} left={StorySkillState.SpLeft} spent={StorySkillState.SpSpent} (기대 {total})");
            var cut = StorySkillData.Get("w_cut");
            for (int i = 1; i <= cut.Max; i++)
                PlaytestKit.Check(StorySkillState.Raise("w_cut") && StorySkillState.LevelOf("w_cut") == i, $"un.st.skills: 참격 {i}번째 찍기 실패");
            PlaytestKit.Check(StorySkillState.CanRaise("w_cut") == "skill.why_maxed" && !StorySkillState.Raise("w_cut"), "un.st.skills: 상한에서 안 막힘");
            PlaytestKit.Check(StorySkillState.SpSpent == cut.Max && StorySkillState.SpLeft == total - cut.Max, $"un.st.skills: 찍은 만큼 SP 가 안 줆 left={StorySkillState.SpLeft}");
            float expect = cut.MulBase + cut.MulPerLevel * (cut.Max - 1);
            PlaytestKit.Check(Mathf.Approximately(StorySkillState.MulOf(cut), expect), $"un.st.skills: 상한 배율 {StorySkillState.MulOf(cut)} ≠ {expect}");
            Reset(10, "warrior");
            PlaytestKit.Check(Mathf.Approximately(StorySkillState.MulOf(cut), cut.MulBase), "un.st.skills: 안 찍은 무예 배율이 기본값이 아님");
        }

        private static void CheckReasons()
        {
            Reset(10, "warrior");
            PlaytestKit.Check(StorySkillState.CanRaise("nope") == "skill.why_unknown", "un.st.skills: 모르는 키 이유");
            PlaytestKit.Check(StorySkillState.CanRaise("a_shot") == "skill.why_other_job", "un.st.skills: 남의 자리 이유");
            PlaytestKit.Check(StorySkillState.CanRaise("w_cut") == null, "un.st.skills: 찍을 수 있는데 막힘");

            Reset(10, StoryJobState.NoJob);
            PlaytestKit.Check(StorySkillState.CanRaise("w_cut") == "skill.why_other_job", "un.st.skills: 무명이 무예를 찍음");

            Reset(1, "warrior");
            PlaytestKit.Check(StorySkillState.SpTotal == 0 && StorySkillState.CanRaise("w_cut") == "skill.why_no_sp", "un.st.skills: SP 0 인데 안 막힘");

            // 선행: 표에서 Need 가 있는 무예를 하나 골라, 그 자리로 올려 놓고 본다(모든 차수를 한 규칙으로).
            StorySkillData.Skill gated = null;
            foreach (var sk in StorySkillData.All) if (sk.Need != null) { gated = sk; break; }
            PlaytestKit.Check(gated != null, "un.st.skills: 선행 있는 무예가 표에 없음");
            if (gated == null) return;
            Reset(40, gated.Job);
            PlaytestKit.Check(StorySkillState.CanRaise(gated.Key) == "skill.why_need", $"un.st.skills: {gated.Key} 선행 전인데 막히지 않음");
            for (int i = 0; i < gated.NeedLv; i++)
            {
                PlaytestKit.Check(StorySkillState.CanRaise(gated.Key) == "skill.why_need", $"un.st.skills: 선행 {i}/{gated.NeedLv} 인데 열림");
                PlaytestKit.Check(StorySkillState.Raise(gated.Need), $"un.st.skills: 선행 {gated.Need} 찍기 실패");
            }
            PlaytestKit.Check(StorySkillState.CanRaise(gated.Key) == null, $"un.st.skills: 선행 {gated.NeedLv} 를 채웠는데 안 열림");
        }

        private static void CheckPins()
        {
            Reset(10, "warrior");
            PlaytestKit.Check(StorySkillState.TogglePin("w_cut") == "skill.why_pin_unlearned", "un.st.skills: 안 익힌 무예를 고정함");
            PlaytestKit.Check(StorySkillState.TogglePin("nope") == "skill.why_unknown", "un.st.skills: 모르는 키 고정 이유");
            var ws = StorySkillData.OfJob("warrior");
            PlaytestKit.Check(ws.Count >= StorySkillState.SlotCount + 1, "un.st.skills: 무사 무예가 칸 수보다 적어 가득 참을 못 봄");
            foreach (var sk in ws) StorySkillState.Raise(sk.Key);
            for (int i = 0; i < StorySkillState.SlotCount; i++)
                PlaytestKit.Check(StorySkillState.TogglePin(ws[i].Key) == null && StorySkillState.PinIndex(ws[i].Key) == i, $"un.st.skills: 고정 {i} 칸 실패");
            PlaytestKit.Check(StorySkillState.TogglePin(ws[StorySkillState.SlotCount].Key) == "skill.why_pin_full", "un.st.skills: 칸이 찼는데 더 고정됨");
            for (int i = 0; i < StorySkillState.SlotCount; i++)
                PlaytestKit.Check(StorySkillState.SlotSkill(i) == ws[i], $"un.st.skills: 칸 {i} 이 고정한 순서가 아님");
            PlaytestKit.Check(StorySkillState.SlotSkill(-1) == null && StorySkillState.SlotSkill(StorySkillState.SlotCount) == null, "un.st.skills: 칸 밖 번호가 null 이 아님");

            PlaytestKit.Check(StorySkillState.TogglePin(ws[0].Key) == null && StorySkillState.PinIndex(ws[0].Key) == -1, "un.st.skills: 고정 풀기 실패");
            PlaytestKit.Check(StorySkillState.PinIndex(ws[1].Key) == 0 && StorySkillState.PinCount == StorySkillState.SlotCount - 1, "un.st.skills: 풀었는데 뒤가 안 당겨짐");

            // 자리를 바꾸면 사슬 밖 무예의 고정은 칸에서 빠진다(고정 기록은 남아도 놓이지 않는다).
            StoryJobState.Restore(10, 0f, StoryJobState.NoJob);
            PlaytestKit.Check(StorySkillState.SlotSkills().Count == 0, "un.st.skills: 무명인데 칸에 무예가 놓임");
        }

        private static void CheckAutoSlots()
        {
            Reset(10, "warrior");
            PlaytestKit.Check(StorySkillState.SlotSkills().Count == 0, "un.st.skills: 안 찍었는데 칸이 참");
            var ws = StorySkillData.OfJob("warrior");
            foreach (var sk in ws) StorySkillState.Raise(sk.Key);
            var slots = StorySkillState.SlotSkills();
            PlaytestKit.Check(slots.Count == StorySkillState.SlotCount, $"un.st.skills: 자동 배치 {slots.Count}칸 (기대 {StorySkillState.SlotCount})");
            PlaytestKit.Check(new HashSet<StorySkillData.Skill>(slots).Count == slots.Count, "un.st.skills: 자동 배치에 같은 무예가 두 번");
            // 고정한 것이 자동 배치보다 앞.
            var last = ws[ws.Count - 1];
            StorySkillState.TogglePin(last.Key);
            PlaytestKit.Check(StorySkillState.SlotSkill(0) == last, "un.st.skills: 고정한 무예가 첫 칸이 아님");
            PlaytestKit.Check(StorySkillState.SlotSkills().Count == StorySkillState.SlotCount, "un.st.skills: 고정 뒤 칸 수가 달라짐");
        }

        private static void CheckSnapshot()
        {
            Reset(20, "warrior");
            StorySkillState.Raise("w_cut"); StorySkillState.Raise("w_cut"); StorySkillState.Raise("w_whirl");
            StorySkillState.TogglePin("w_whirl");
            StorySkillState.Snapshot(out var keys, out var levels);
            var pins = StorySkillState.SnapshotPins();
            StorySkillState.Restore(null, null);
            PlaytestKit.Check(StorySkillState.LevelOf("w_cut") == 0 && StorySkillState.PinCount == 0, "un.st.skills: Restore(null) 이 비우지 않음");
            StorySkillState.Restore(keys, levels, pins);
            PlaytestKit.Check(StorySkillState.LevelOf("w_cut") == 2 && StorySkillState.LevelOf("w_whirl") == 1 && StorySkillState.PinIndex("w_whirl") == 0, "un.st.skills: 세이브 왕복이 값을 못 되살림");

            var cut = StorySkillData.Get("w_cut");
            StorySkillState.Restore(new[] { "nope", "w_cut", "w_whirl" }, new[] { 3, 999, 0 }, new[] { "nope", "w_cut", "w_cut" });
            PlaytestKit.Check(StorySkillState.LevelOf("nope") == 0, "un.st.skills: 모르는 키가 남음");
            PlaytestKit.Check(StorySkillState.LevelOf("w_cut") == cut.Max, $"un.st.skills: 상한 초과가 안 잘림 lv={StorySkillState.LevelOf("w_cut")}");
            PlaytestKit.Check(StorySkillState.LevelOf("w_whirl") == 0, "un.st.skills: 0 레벨이 남음");
            PlaytestKit.Check(StorySkillState.PinCount == 1 && StorySkillState.PinIndex("w_cut") == 0, $"un.st.skills: 모르는·중복 고정이 안 걸러짐 pins={StorySkillState.PinCount}");
            StorySkillState.Restore(new[] { "w_cut" }, null);
            PlaytestKit.Check(StorySkillState.LevelOf("w_cut") == 0, "un.st.skills: 레벨 배열이 없는 옛 세이브가 값을 만듦");
        }

        private static void CheckChanged()
        {
            Reset(10, "warrior");
            int fired = 0;
            void On() => fired++;
            StorySkillState.Changed += On;
            try
            {
                StorySkillState.Raise("w_cut");
                PlaytestKit.Check(fired == 1, $"un.st.skills: 찍기에 Changed {fired}번");
                StorySkillState.Raise("a_shot");
                PlaytestKit.Check(fired == 1, "un.st.skills: 못 찍었는데 Changed 가 울림");
                StorySkillState.TogglePin("w_cut");
                PlaytestKit.Check(fired == 2, $"un.st.skills: 고정에 Changed {fired}번");
                StorySkillState.Restore(null, null);
                PlaytestKit.Check(fired == 3, $"un.st.skills: Restore 에 Changed {fired}번");
            }
            finally { StorySkillState.Changed -= On; }
        }
    }
}
