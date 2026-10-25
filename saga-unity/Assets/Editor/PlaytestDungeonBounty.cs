using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0221 2나락 현상금(고돗 G-0372 짝) 진단 — `PlaytestDungeonHeadless` 가 판 등급 진단 뒤에 부른다(한 프레임 안).
    /// ① 고르기(같은 씨앗 같은 셋·셋·다섯 다 나옴·판 열림 = 그 층 씨앗) ② 판 도중 셈(처치 20·정예 2·통 6 — 훅으로, 채울 때 한 번) ③ 끝 판정(맞음 5 채움·6 실패 · 360초 채움·361 실패)
    /// ④ 진짜 계단(Descend) — 다섯 채움 = 5×150×급 금 · 등급 덤은 그대로(번 금에 안 섞임) · 글 ⑤ 쓰러짐 0 ⑥ 건너뜀(JumpToFloor) 버림 ⑦ 끔 ⑧ 「오늘」 맨 위 셋.
    /// 끝나면 층·영웅·시나리오·등급 기록·시즌·우정·자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonBounty
    {
        private const string T = "[PlaytestDungeonHeadless] bounty";
        private const BindingFlags Priv = BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string scen0 = DungeonScenario.Snapshot();
            int[] tiers0 = DungeonRunRank.SnapshotTiers();
            string[] grades0 = DungeonRunRank.SnapshotGrades(tiers0);
            string season0 = DungeonSeason.Snapshot();
            string bond0 = DungeonBond.Snapshot();
            bool on0 = DungeonBounty.On;
            Vector3 pos = playerGo.transform.position;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                DungeonRunRank.Hook();
                DungeonBounty.On = true;
                CheckPick(runner);
                CheckLive();
                CheckEnd();
                m += CheckStairs(runner);
                CheckDead();
                CheckSkip(runner);
                CheckOff();
                m += CheckToday(runner);
            }
            finally
            {
                DungeonBounty.On = on0;
                DungeonRunRank.Restore(tiers0, grades0);
                DungeonSeason.Restore(season0);
                DungeonBond.Restore(bond0);
                DungeonRunRank.ClearForTest();
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                DungeonRunRank.ClearForTest();
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                DungeonScenario.Restore(scen0);
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} done |{m}");
            return _ok;
        }

        private static string Ids(IReadOnlyList<DungeonBounty.Row> l)
        {
            var s = new List<string>();
            foreach (var r in l) s.Add(r.Id.ToString());
            return string.Join(",", s);
        }

        private static void CheckPick(DungeonFloorRunner runner)
        {
            Begin();
            string a = Ids(DungeonBounty.Pick(1234)), b = Ids(DungeonBounty.Pick(1234));
            if (a != b) Fail($"같은 씨앗 다른 셋 {a} / {b}");
            var seen = new HashSet<DungeonBounty.Id>();
            for (int s = 0; s < 200; s++)
            {
                var p = DungeonBounty.Pick(s);
                if (p.Count != DungeonBounty.PickCount) { Fail($"씨앗 {s} 셋이 아님 {p.Count}"); break; }
                foreach (var r in p) seen.Add(r.Id);
            }
            if (seen.Count != DungeonBounty.PoolCount) Fail($"표 {DungeonBounty.PoolCount} 가 다 안 나옴 {seen.Count}");
            runner.JumpToFloor(12);
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(100f);
            string opened = Ids(DungeonBounty.Active), want = Ids(DungeonBounty.Pick(DungeonBounty.SeedOf(12)));
            if (opened != want) Fail($"판 열림 셋 {opened} ≠ 12층 씨앗 {want}");
            if (DungeonBounty.Grade != DungeonBounty.GradeOf(12)) Fail($"급 {DungeonBounty.Grade}");
            DungeonRunRank.Cancel();
            End($"pick OK - 같은 씨앗 같은 셋({a}) · 씨앗 200 에 다섯 다 · 첫 타격에 12층 씨앗 셋({opened}) · 급 {DungeonBounty.GradeOf(12)}");
        }

        private static void CheckLive()
        {
            Begin();
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(100f);
            DungeonBounty.BeginAllForTest(12);
            int filledKills = 0, filledElite = 0, filledProps = 0;
            for (int i = 0; i < 19; i++) DungeonRunRank.OnBountyKill(false);
            if (Row(DungeonBounty.Id.Kills).Done) Fail("처치 19 에 채움");
            var k = DungeonBounty.Kill(false); filledKills = k.Count;
            var e1 = DungeonBounty.Kill(true); var e2 = DungeonBounty.Kill(true);
            filledElite = e1.Count + e2.Count;
            for (int i = 0; i < 5; i++) DungeonRunRank.OnBountyProp();
            if (Row(DungeonBounty.Id.Props).Done) Fail("통 5 에 채움");
            DungeonRunRank.OnBountyProp();
            filledProps = Row(DungeonBounty.Id.Props).Done ? 1 : 0;
            string again = DungeonBounty.Prop();
            if (filledKills != 1 || !Row(DungeonBounty.Id.Kills).Done) Fail($"처치 20 채움 {filledKills}");
            if (filledElite != 1 || !Row(DungeonBounty.Id.Elite).Done || Row(DungeonBounty.Id.Elite).Cur != 2) Fail($"정예 2 채움 {filledElite}");
            if (filledProps != 1 || again.Length != 0 || Row(DungeonBounty.Id.Props).Cur != 6) Fail($"통 6 채움 {filledProps}·또 「{again}」");
            DungeonRunRank.Cancel();
            End("live OK - 처치 20(19 안 됨)·정예 2·통 6(5 안 됨) 채움 · 채운 뒤 또 안 셈 · 훅(OnBountyKill·OnBountyProp)으로");
        }

        private static DungeonBounty.Row Row(DungeonBounty.Id id)
        {
            foreach (var r in DungeonBounty.Active) if (r.Id == id) return r;
            return new DungeonBounty.Row();
        }

        private static void CheckEnd()
        {
            Begin();
            int g0 = HeroState.Gold;
            DungeonBounty.BeginAllForTest(12);
            var a = DungeonBounty.Finish(false, 5, 360f);
            int grade = DungeonBounty.GradeOf(12);
            if (!a.HasValue || a.Value.Done != 2 || a.Value.Gold != 2 * DungeonBounty.GoldPer * grade || HeroState.Gold - g0 != a.Value.Gold) Fail($"맞음 5·360초 = 둘 채움 {a?.Done}·금 {a?.Gold}");
            DungeonBounty.BeginAllForTest(12);
            var b = DungeonBounty.Finish(false, 6, 361f);
            if (!b.HasValue || b.Value.Done != 0 || b.Value.Gold != 0) Fail($"맞음 6·361초 = 실패 {b?.Done}");
            if (DungeonBounty.Finish(false, 0, 0f).HasValue) Fail("건 게 없는데 결과");
            End($"end OK - 맞음 5 채움·6 실패 · 360초 채움·361 실패 · 둘 = 금 {a?.Gold}(150×2×급 {grade}) · 건 게 없으면 결과 없음");
        }

        private static void Descend(DungeonFloorRunner runner) => typeof(DungeonFloorRunner).GetMethod("Descend", Priv).Invoke(runner, null);

        private static string CheckStairs(DungeonFloorRunner runner)
        {
            Begin();
            runner.JumpToFloor(12);
            HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 0, HeroState.EquippedWeaponId, null);
            DungeonRunRank.ClearForTest();
            for (int i = 0; i < 20; i++) DungeonRunRank.OnHit(100f);
            DungeonBounty.BeginAllForTest(12);
            for (int i = 0; i < 18; i++) { DungeonRunRank.OnKill(); DungeonRunRank.OnBountyKill(false); }
            for (int i = 0; i < 2; i++) { DungeonRunRank.OnKill(); DungeonRunRank.OnBountyKill(true); }
            for (int i = 0; i < 6; i++) DungeonRunRank.OnBountyProp();
            HeroState.AddGold(100);
            int earned = 100 + SigilState.ClearBonusGold(12);
            int grade = DungeonBounty.GradeOf(12);
            Descend(runner);
            var r = DungeonRunRank.Last; var bo = DungeonBounty.Last;
            if (!r.HasValue || !bo.HasValue) { Fail("계단 판 결과 없음"); return ""; }
            int want = 5 * DungeonBounty.GoldPer * grade;
            if (bo.Value.Done != 5 || bo.Value.Gold != want || bo.Value.Dead) Fail($"다섯 채움 {bo.Value.Done}·금 {bo.Value.Gold} ≠ {want}");
            if (r.Value.Bonus != Mathf.RoundToInt(earned * 0.5f)) Fail($"등급 덤 {r.Value.Bonus} 이 현상금 금에 섞임(번 금 {earned})");
            if (HeroState.Gold != earned + r.Value.Bonus + want) Fail($"금 {HeroState.Gold} ≠ {earned}+{r.Value.Bonus}+{want}");
            if (DungeonRunRank.BountyLine.Length != 0) Fail("현상금 줄이 내려가는 글에 안 붙음");
            if (DungeonBounty.Active.Count != 0) Fail("끝난 뒤에도 현상금이 걸림");
            string txt = DungeonBounty.Text(bo.Value);
            End($"stairs OK - 진짜 계단: 다섯 채움 = 금 +{want}(5×150×급 {grade}) · 등급 {r.Value.Rank} 덤 {r.Value.Bonus} 그대로 · 「{txt}」");
            return $" 계단 +{want}";
        }

        private static void CheckDead()
        {
            Begin();
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(100f);
            DungeonBounty.BeginAllForTest(12);
            for (int i = 0; i < 20; i++) DungeonRunRank.OnBountyKill(false);
            int g0 = HeroState.Gold;
            DungeonRunRank.Finish(100f, true);
            var bo = DungeonBounty.Last;
            string line = DungeonRunRank.Append(null);
            if (!bo.HasValue || !bo.Value.Dead || bo.Value.Gold != 0 || HeroState.Gold != g0) Fail($"쓰러진 판 금 {bo?.Gold}·{HeroState.Gold - g0}");
            if (!line.Contains("📜")) Fail($"쓰러짐 글에 현상금 줄 없음「{line}」(처치 3 미만이라 등급 없어도)");
            End($"dead OK - 쓰러지면 덤 0 · 등급 없어도 줄「{line.Trim()}」");
        }

        private static void CheckSkip(DungeonFloorRunner runner)
        {
            Begin();
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(100f);
            if (DungeonBounty.Active.Count != DungeonBounty.PickCount) Fail("판 열림에 셋 아님");
            int g0 = HeroState.Gold;
            runner.JumpToFloor(12);
            if (DungeonBounty.Active.Count != 0 || DungeonBounty.Last.HasValue || HeroState.Gold != g0) Fail("건너뛴 층 현상금이 남음");
            End("skip OK - JumpToFloor 는 현상금을 버림(결과·금 없음)");
        }

        private static void CheckOff()
        {
            Begin();
            DungeonRunRank.ClearForTest();
            DungeonBounty.On = false;
            DungeonRunRank.OnHit(100f);
            if (DungeonBounty.Active.Count != 0 || DungeonBounty.Rows(12).Count != 0) Fail("껐는데 현상금");
            DungeonRunRank.Finish(100f, false);
            if (DungeonBounty.Last.HasValue) Fail("껐는데 결과");
            DungeonBounty.On = true;
            DungeonRunRank.ClearForTest();
            End("off OK - 끄면 안 걺·줄 없음·결과 없음");
        }

        private static string CheckToday(DungeonFloorRunner runner)
        {
            Begin();
            DungeonRunRank.ClearForTest();
            var today = new List<TodayRow>(); var week = new List<TodayRow>();
            new DungeonTodaySource().Rows(today, week);
            int n = DungeonDailyTaskState.TaskCount;
            if (today.Count != n + 1 + DungeonBounty.PickCount) Fail($"오늘 줄 {today.Count} ≠ 일과 {n} + 도장 1 + 현상금 3");
            for (int i = 0; i < DungeonBounty.PickCount && i < today.Count; i++) if (!today[i].Text.Contains("📜")) Fail($"맨 위 {i} 줄이 현상금 아님「{today[i].Text}」");
            DungeonRunRank.OnHit(100f);
            DungeonRunRank.OnBountyKill(false);
            today.Clear(); week.Clear();
            new DungeonTodaySource().Rows(today, week);
            string top = today.Count > 0 ? today[0].Text : "";
            DungeonRunRank.Cancel();
            End($"today OK - 맨 위 셋(판 전엔 이 층 셋 미리) · 오늘 {n + 1 + DungeonBounty.PickCount}줄 · 「{top}」");
            return $" 오늘 +{DungeonBounty.PickCount}";
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
