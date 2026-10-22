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
    /// tasks U-0164 2나락 자동 퀘스트 진단 — `PlaytestDungeonHeadless` 가 부른다(한 프레임 안, 시간·쿨·층 진행기 Update 는 손으로 넣는다).
    /// 진짜 2층 전투방 하나: 방 입구에서 켜면 적에게 걸어가 평타로 다 치우고(목표 = 그 방) → 선 문으로 걸어가 밟아 다음 방(목표 = 문) ·
    /// 체력 30% 밑 = 멈춤 · 손 조작 = 멈춤 · ▶ 단추. 끝나면 층·영웅·시나리오·자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonAutoQuest
    {
        private const string T = "[PlaytestDungeonHeadless] autoquest";
        private const BindingFlags Priv = BindingFlags.Instance | BindingFlags.NonPublic;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            var aq = DungeonAutoQuest.Instance;
            var pc = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            if (runner == null || aq == null || pc == null || combat == null) { Fail("러너·DungeonAutoQuest·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string scen0 = DungeonScenario.Snapshot();
            Vector3 pos0 = playerGo.transform.position;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                AutoQuestHud.WatchOffForTest = true;
                HeroState.Restore(lv, exp, HeroState.HpMax, gold, weapon, gem);
                runner.JumpToFloor(2);
                runner.BuildRoomForTest("fight");
                int room0 = runner.RoomIndex, alive0 = DungeonEnemy.CountAliveInRoom("procroom");
                if (alive0 == 0) Fail("전투방에 적 없음");
                pc.Teleport(runner.transform.position + new Vector3(0f, 0.2f, -6f));
                Physics.SyncTransforms(); // 한 프레임 안 — 막 지은 방 바닥 충돌을 몸이 보게
                var g = aq.First();
                if (g == null || g.Type != "kill" || !g.Id.StartsWith("room:")) Fail($"첫 목표 {g?.Id}·{g?.Type}");
                if (!aq.Q.Start()) Fail("켜기 " + aq.Q.Why);
                bool doorGoal = false;
                int steps = 0;
                for (; steps < 3000 && aq.Q.On && runner.RoomIndex == room0; steps++)
                {
                    combat.ResetCooldownsForTest();
                    aq.Step(0.05f);
                    pc.Step(0.05f);
                    typeof(DungeonFloorRunner).GetMethod("Update", Priv).Invoke(runner, null);
                    doorGoal |= aq.Q.Current != null && aq.Q.Current.Type == "enter";
                }
                int alive1 = DungeonEnemy.CountAliveInRoom("procroom");
                if (runner.RoomIndex == room0) Fail($"다음 방으로 안 감({steps} 걸음, 남은 적 {alive1}/{alive0}·{aq.Q.Why}·{aq.Q.Doing}·목표 {aq.Q.Current?.Id} {aq.Q.Current?.Label} @{aq.Q.Current?.At}·나 {playerGo.transform.position}·방 {runner.transform.position}·문 {string.Join(",", runner.DoorSpots())}·{string.Join(" ", aq.Q.Log)})");
                if (!doorGoal) Fail("문 목표가 안 나옴");
                m += $" 걸음 {steps}·적 {alive0} 치움·방 {room0}→{runner.RoomIndex}·목표 {aq.Q.Done + 1}";
                aq.Q.Stop("진단");
                // 체력 낮음
                runner.BuildRoomForTest("fight");
                HeroState.Restore(HeroState.Level, HeroState.Exp, Mathf.Max(1, HeroState.HpMax / 5), HeroState.Gold, HeroState.EquippedWeaponId, HeroState.SocketedGemId);
                aq.Q.Start();
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != AutoQuestHud.LowHpWhy) Fail($"체력 낮음 멈춤 {aq.Q.On}·{aq.Q.Why}");
                HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, HeroState.Gold, HeroState.EquippedWeaponId, HeroState.SocketedGemId);
                // 손 조작
                aq.Q.Start();
                aq.FakeHandInputForTest = true;
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != AutoQuestHud.HandWhy) Fail($"손 조작 멈춤 {aq.Q.On}·{aq.Q.Why}");
                // ▶ 단추
                if (aq.PlayButton == null) Fail("▶ 단추 없음");
                else
                {
                    aq.PlayButton.onClick.Invoke();
                    bool on = aq.Q.On;
                    aq.PlayButton.onClick.Invoke();
                    if (!on || aq.Q.On) Fail("▶ 단추 켜고 끄기");
                }
            }
            finally
            {
                if (aq.Q.On) aq.Q.Stop("진단 끝");
                pc.ClearTestInput();
                AutoQuestHud.WatchOffForTest = false;
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                DungeonScenario.Restore(scen0);
                combat.ResetCooldownsForTest();
                pc.Teleport(pos0);
            }
            if (_ok) Debug.Log($"{T} OK - 2나락(방 적 걸어가 평타로 치움 → 문 밟아 다음 방·체력 낮음·손 조작·▶) |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
