using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.dg.rescue-riddle` 구출(메인 사명의 마지막 목표) — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 목표 글자: 단계마다 다름 ② 두목·미니보스: 도감 기록을 `Poll` 이 읽어 한 번만 인정(보상 25 경험치·10 금)
    /// ③ 구출: `MarkCaptiveFreed` 한 번만 보상 ④ 어떤 순서로 끝내도 즉시 인정되고 단계는 "아직 안 끝난 첫 목표"로 다시 계산 ⑤ 옛 세이브 단계(0~3, 범위 밖은 자름) ⑥ 세이브 JSON 왕복.
    /// 구출 자리·은닉 주머니의 수치 상수는 `DungeonCaptive`·`DungeonSecretStash`(씬) 안에 있어 이 진단 밖.
    /// `-executeMethod Saga.EditorTools.PlaytestDungeonQuestRescue.Run` → "[PlaytestDungeonQuestRescue] OK/FAIL".
    /// </summary>
    public static class PlaytestDungeonQuestRescue
    {
        private const string Boss = "황건적 두목";
        private const string Mini = "황건 살수";

        [MenuItem("Saga/Playtest Dungeon Quest Rescue")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestDungeonQuestRescue]");
            string saved = DungeonSave.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckObjectiveText();
                CheckPollRewards();
                CheckAnyOrder();
                CheckLegacyStage();
                CheckSaveRoundTrip();
            }
            DungeonSave.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestDungeonQuestRescue");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // 영웅은 90레벨로 두어 경험치 보상이 레벨업에 먹히지 않게(Exp 그대로 읽는다).
        private static void Fresh(bool boss = false, bool mini = false, bool captive = false)
        {
            HeroState.Restore(90, 0, 100, 0, null, null);
            BestiaryState.Restore(null);
            QuestState.Restore(boss, mini, captive);
        }

        private static void CheckObjectiveText()
        {
            var texts = new HashSet<string>();
            var cases = new (bool b, bool m, bool c, QuestState.Stage s)[]
            {
                (false, false, false, QuestState.Stage.HuntBoss), (true, false, false, QuestState.Stage.HuntMiniboss),
                (true, true, false, QuestState.Stage.Rescue), (true, true, true, QuestState.Stage.Done),
            };
            foreach (var c in cases)
            {
                Fresh(c.b, c.m, c.c);
                PlaytestKit.Check(QuestState.Current == c.s, $"un.dg.rescue-riddle: {c.s} 단계가 아님({QuestState.Current})");
                PlaytestKit.Check(!string.IsNullOrEmpty(QuestState.ObjectiveText) && texts.Add(QuestState.ObjectiveText), $"un.dg.rescue-riddle: {c.s} 목표 글자가 비었거나 다른 단계와 같음");
            }
        }

        private static void CheckPollRewards()
        {
            Fresh();
            var msgs = new List<string>();
            Action<QuestState.Stage, string> on = (s, m) => msgs.Add(m);
            QuestState.StageCompleted += on;
            try
            {
                QuestState.Poll();
                PlaytestKit.Check(!QuestState.BossDead && msgs.Count == 0 && HeroState.Gold == 0, "un.dg.rescue-riddle: 도감에 없는데 두목이 인정됨");
                BestiaryState.Record(Boss);
                QuestState.Poll();
                PlaytestKit.Check(QuestState.BossDead && QuestState.Current == QuestState.Stage.HuntMiniboss && HeroState.Exp == 25 && HeroState.Gold == 10 && msgs.Count == 1,
                    $"un.dg.rescue-riddle: 두목 처치 exp={HeroState.Exp} gold={HeroState.Gold} 알림={msgs.Count}");
                PlaytestKit.Check(msgs.Count == 1 && msgs[0].Contains("25") && msgs[0].Contains("10"), "un.dg.rescue-riddle: 보상 알림에 수치가 없음");
                QuestState.Poll(); QuestState.Poll();
                PlaytestKit.Check(HeroState.Exp == 25 && HeroState.Gold == 10 && msgs.Count == 1, "un.dg.rescue-riddle: 같은 목표가 다시 보상됨");
                BestiaryState.Record(Mini);
                QuestState.Poll();
                PlaytestKit.Check(QuestState.MinibossDead && QuestState.Current == QuestState.Stage.Rescue && HeroState.Exp == 50 && HeroState.Gold == 20, "un.dg.rescue-riddle: 미니보스 처치 보상/단계 이상");
                QuestState.MarkCaptiveFreed();
                PlaytestKit.Check(QuestState.CaptiveFreed && QuestState.Current == QuestState.Stage.Done && HeroState.Exp == 75 && HeroState.Gold == 30 && msgs.Count == 3,
                    $"un.dg.rescue-riddle: 구출 exp={HeroState.Exp} gold={HeroState.Gold} 알림={msgs.Count}");
                QuestState.MarkCaptiveFreed();
                PlaytestKit.Check(HeroState.Exp == 75 && HeroState.Gold == 30 && msgs.Count == 3, "un.dg.rescue-riddle: 구출이 두 번 보상됨");
            }
            finally { QuestState.StageCompleted -= on; }
        }

        private static void CheckAnyOrder()
        {
            Fresh();
            QuestState.MarkCaptiveFreed();
            PlaytestKit.Check(QuestState.CaptiveFreed && QuestState.Current == QuestState.Stage.HuntBoss && HeroState.Gold == 10, "un.dg.rescue-riddle: 구출을 먼저 끝냈는데 인정 안 됨/단계가 앞서감");
            BestiaryState.Record(Mini);
            QuestState.Poll();
            PlaytestKit.Check(QuestState.MinibossDead && QuestState.Current == QuestState.Stage.HuntBoss && HeroState.Gold == 20, "un.dg.rescue-riddle: 미니보스를 먼저 끝냈는데 인정 안 됨");
            BestiaryState.Record(Boss);
            QuestState.Poll();
            PlaytestKit.Check(QuestState.Current == QuestState.Stage.Done && HeroState.Gold == 30 && HeroState.Exp == 75, "un.dg.rescue-riddle: 거꾸로 끝낸 뒤 완료가 안 됨/보상이 어긋남");

            Fresh();
            BestiaryState.Record(Boss); BestiaryState.Record(Mini);
            QuestState.Poll();
            PlaytestKit.Check(QuestState.BossDead && QuestState.MinibossDead && HeroState.Exp == 50 && QuestState.Current == QuestState.Stage.Rescue, "un.dg.rescue-riddle: 한 번의 Poll 로 두 목표를 못 인정함");
        }

        private static void CheckLegacyStage()
        {
            var want = new (int stage, bool b, bool m, bool c)[] { (0, false, false, false), (1, true, false, false), (2, true, true, false), (3, true, true, true), (-5, false, false, false), (99, true, true, true) };
            foreach (var w in want)
            {
                QuestState.RestoreLegacyStage(w.stage);
                PlaytestKit.Check(QuestState.BossDead == w.b && QuestState.MinibossDead == w.m && QuestState.CaptiveFreed == w.c, $"un.dg.rescue-riddle: 옛 단계 {w.stage} 복원이 어긋남({QuestState.BossDead}/{QuestState.MinibossDead}/{QuestState.CaptiveFreed})");
            }
        }

        private static void CheckSaveRoundTrip()
        {
            Fresh(true, false, true);
            string json = DungeonSave.ToJson();
            Fresh();
            PlaytestKit.Check(DungeonSave.ApplyJson(json), "un.dg.rescue-riddle: DUNGEON 세이브가 안 읽힘");
            PlaytestKit.Check(QuestState.BossDead && !QuestState.MinibossDead && QuestState.CaptiveFreed && QuestState.Current == QuestState.Stage.HuntMiniboss, $"un.dg.rescue-riddle: 사명 왕복 {QuestState.BossDead}/{QuestState.MinibossDead}/{QuestState.CaptiveFreed}");
        }
    }
}
