using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0169 한 판 결과 등급 진단 — `PlaytestDungeonHeadless` 가 부른다(한 프레임 안).
    /// 순수 식(S 9점·D 0점·급 문턱) · 층 → 급 · 진짜 계단(Descend)으로 살아 나온 판(덤 = 번 금 ×0.5·S 보석·첫 기록·내려가는 층) ·
    /// 진짜 피격(HeroState.TakeDamage → Hurt 훅)·쓰러진 판(덤 없음) · 처치 3 미만 등급 없음 · JumpToFloor 판 버림 · 최고 기록 안 내려감 ·
    /// 세이브(ToJson 칸·Restore 가 나쁜 칸 버림). 끝나면 층·영웅·시나리오·기록·자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonRunRank
    {
        private const string T = "[PlaytestDungeonHeadless] runrank";
        private const BindingFlags Priv = BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok;

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
            bool bounty0 = DungeonBounty.On;
            string season0 = DungeonSeason.Snapshot(); // tasks U-0195 — 살아 나온 판이 시즌에도 기록된다
            Vector3 pos = playerGo.transform.position;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                DungeonRunRank.Hook();
                DungeonRunRank.Restore(null, null);
                DungeonBounty.On = false; // tasks U-0221 등급 덤만 본다(현상금은 PlaytestDungeonBounty — 고돗 dungeon_rank 도 SAGA_BOUNTY=0)
                m += CheckPure() + CheckAlive(runner) + CheckDead(runner) + CheckSave();
            }
            finally
            {
                DungeonBounty.On = bounty0;
                DungeonRunRank.Restore(tiers0, grades0);
                DungeonSeason.Restore(season0);
                DungeonRunRank.ClearForTest();
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                DungeonScenario.Restore(scen0);
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 식(S·D·급 문턱)·층→급·계단 판(덤·보석·첫 기록)·피격 훅·쓰러진 판(덤 없음)·처치 3 미만·층 건너뛰기 버림·기록 안 내려감·세이브 |{m}");
            return _ok;
        }

        private static string CheckPure()
        {
            var s = DungeonRunRank.RankOf(60f, 0, 20, 15, 1);
            if (s.Rank != "S" || s.Pt != 9) Fail($"최고 판 {s.Rank}/{s.Pt} ≠ S/9");
            var d = DungeonRunRank.RankOf(999f, 30, 0, 3, 1);
            if (d.Rank != "D" || d.Pt != 0) Fail($"최악 판 {d.Rank}/{d.Pt} ≠ D/0");
            // 급 5 는 피격 7·시간 400초를 봐준다(급 1 이면 피격 1점·시간 0점)
            int p1 = DungeonRunRank.RankOf(400f, 7, 0, 3, 1).Pt, p5 = DungeonRunRank.RankOf(400f, 7, 0, 3, 5).Pt;
            if (p1 != 1 || p5 != 3) Fail($"급 보정 {p1}/{p5} ≠ 1/3");
            int[] fl = { 1, 4, 5, 9, 10, 19, 20, 39, 40, 100 }, want = { 1, 1, 2, 2, 3, 3, 4, 4, 5, 5 };
            for (int i = 0; i < fl.Length; i++) if (DungeonRunRank.TierOf(fl[i]) != want[i]) Fail($"층 {fl[i]} 급 {DungeonRunRank.TierOf(fl[i])} ≠ {want[i]}");
            return $" 급보정 {p1}→{p5}";
        }

        private static void Descend(DungeonFloorRunner runner) => typeof(DungeonFloorRunner).GetMethod("Descend", Priv).Invoke(runner, null);

        private static string CheckAlive(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(12);
            HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 0, HeroState.EquippedWeaponId, null);
            DungeonRunRank.ClearForTest();
            for (int i = 0; i < 20; i++) DungeonRunRank.OnHit(100f);
            for (int i = 0; i < 15; i++) DungeonRunRank.OnKill();
            HeroState.AddGold(100);
            int earned = 100 + SigilState.ClearBonusGold(12); // 부적 층이면 떠날 때 금이 더 붙는다(그것도 그 판에 번 금)
            Descend(runner);
            var r = DungeonRunRank.Last;
            if (!r.HasValue) { Fail("계단 판 등급 없음"); return ""; }
            var v = r.Value;
            if (runner.CurrentFloor != 13) Fail($"내려간 층 {runner.CurrentFloor} ≠ 13");
            if (v.Rank != "S" || v.Tier != 3 || v.Dead) Fail($"계단 판 {v.Rank}/급 {v.Tier}/쓰러짐 {v.Dead}");
            if (v.Bonus != Mathf.RoundToInt(earned * 0.5f) || HeroState.Gold != earned + v.Bonus) Fail($"덤 {v.Bonus}·금 {HeroState.Gold} (번 금 {earned})");
            if (v.Gem != "gem_sapphire" || HeroState.SocketedGemId != "gem_sapphire") Fail($"S 보석 {v.Gem}/{HeroState.SocketedGemId}");
            if (!v.Best || v.PrevBest != null || DungeonRunRank.BestOf(3) != "S") Fail("첫 기록 안 섬");
            if (DungeonRunRank.Line2(v).Length == 0 || !DungeonRunRank.Append(r).Contains("S")) Fail("두 줄 글 빔");
            // 처치 3 미만 → 등급 없음
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(100f); DungeonRunRank.OnKill(); DungeonRunRank.OnKill();
            Descend(runner);
            if (DungeonRunRank.Last.HasValue) Fail("처치 2 판에 등급");
            // 층 건너뛰기는 판을 버린다
            DungeonRunRank.OnHit(100f);
            runner.JumpToFloor(12);
            if (DungeonRunRank.Active) Fail("JumpToFloor 뒤에도 판 열림");
            return $" 계단 {v.Rank}·덤 {v.Bonus}·{v.Gem}";
        }

        private static string CheckDead(DungeonFloorRunner runner)
        {
            DungeonRunRank.ClearForTest();
            HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 0, HeroState.EquippedWeaponId, null);
            for (int i = 0; i < 6; i++) DungeonRunRank.OnHit(100f);
            HeroState.TakeDamage(1f, "진단", "진단");     // 진짜 피격 → Hurt 훅 → 피격 1·연타 0
            for (int i = 0; i < 3; i++) DungeonRunRank.OnHit(100f);
            for (int i = 0; i < 3; i++) DungeonRunRank.OnKill();
            HeroState.AddGold(100);
            var r = DungeonRunRank.Finish(100f, true);
            if (!r.HasValue) { Fail("쓰러진 판 등급 없음"); return ""; }
            var v = r.Value;
            if (v.Hits != 1 || v.ComboMax != 6) Fail($"피격 훅 {v.Hits}/연타 {v.ComboMax} ≠ 1/6");
            if (!v.Dead || v.Bonus != 0 || v.Gem != null || HeroState.Gold != 100) Fail($"쓰러진 판 덤 {v.Bonus}·금 {HeroState.Gold}");
            if (v.Best || DungeonRunRank.BestOf(3) != "S") Fail($"낮은 등급 {v.Rank} 이 기록을 내림");
            return $" 쓰러짐 {v.Rank}";
        }

        private static string CheckSave()
        {
            string json = SaveState.ToJson();
            if (!json.Contains("\"rankTiers\":[3]") || !json.Contains("\"rankGrades\":[\"S\"]")) Fail("세이브에 기록 칸 없음");
            DungeonRunRank.Restore(new[] { 3, 9, 2 }, new[] { "A", "S", "Q" });
            if (DungeonRunRank.BestOf(3) != "A" || DungeonRunRank.BestOf(9) != "" || DungeonRunRank.BestOf(2) != "") Fail("Restore 가 나쁜 칸을 안 버림");
            DungeonRunRank.Restore(null, null);
            if (DungeonRunRank.BestOf(3) != "") Fail("옛 세이브(null) 가 빈 기록이 아님");
            return " 세이브";
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
