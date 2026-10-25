using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0228 진단 — `PlaytestDungeonHeadless` 현상금 진단 뒤(한 프레임 안).
    /// cursed: ① 방 고르기(층 씨앗·두목 방 안 씀) ② 곁 3m 에 열림·파도 4번 8마리 ③ 24초 고리 안 성공·금 ④ 고리 밖 실패
    /// bounty+: ⑤ 방 연달아 안 맞기(맞으면 0)·보물 방 들름 ⑥ 셋 다 → 계단 곁 상자 → 열면 금, 두 번 안 줌 ⑦ 판 끝 자동 상자 ⑧ 둘만 채우면 상자 없음.
    /// 끝나면 층·영웅·판 기록을 되돌린다.
    /// </summary>
    public static class PlaytestDungeonCursed
    {
        private const string T = "[PlaytestDungeonHeadless]";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} cursed FAIL - {why}"); }
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Debug.LogError($"{T} cursed FAIL - 러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            bool on0 = DungeonBounty.On;
            Vector3 pos = playerGo.transform.position;
            try
            {
                // ① 방 고르기
                for (int f = 1; f <= 30; f++)
                    foreach (int total in new[] { 4, 6, 8, 10 })
                    {
                        int r = DungeonCursedChest.RoomFor(f, total);
                        if (r != DungeonCursedChest.RoomFor(f, total) || (r >= 0 && (r != 3 && r != 6 || r >= total - 1))) { Fail($"층 {f} 방 {total} → {r}"); break; }
                    }
                if (DungeonCursedChest.RoomFor(5, 4) != -1) Fail("방 넷이면 없어야 함(3 = 두목 방)");
                if (ok) Debug.Log($"{T} cursed room OK - 층 씨앗으로 3·6 · 두목 방 안 씀 · 방 넷이면 없음");

                // ② ③ 열기·파도·성공
                runner.JumpToFloor(8);
                runner.BuildRoomForTest("fight");
                var c = runner.SpawnCursedChest();
                var at = c.transform.position;
                c.Step(0.1f, at + new Vector3(8f, 0f, 0f));
                if (c.State != DungeonCursedChestRunner.Phase.Waiting) Fail("8m 에서 열림");
                c.Step(0.1f, at + new Vector3(1f, 0f, 0f));
                if (c.State != DungeonCursedChestRunner.Phase.Active || c.Spawned != 2) Fail($"곁 1m 열림 {c.State}·첫 파도 {c.Spawned}");
                int g0 = HeroState.Gold;
                for (int i = 0; i < 25; i++) c.Step(1f, at + new Vector3(5f, 0f, 0f));
                int want = DungeonCursedChest.Reward(8, DungeonMode.Gold(DungeonFormulas.EliteRewardGold(8)));
                if (c.State != DungeonCursedChestRunner.Phase.Won || c.Spawned != 8 || HeroState.Gold - g0 != want) Fail($"24초 버팀 {c.State}·파도 {c.Spawned}/8·금 +{HeroState.Gold - g0}/{want}");
                else Debug.Log($"{T} cursed win OK - 3m 열림 · 6초마다 둘 × 4 = {c.Spawned} · 고리 안 24초 → 금 +{want}");

                // ④ 실패
                runner.BuildRoomForTest("fight");
                var c2 = runner.SpawnCursedChest();
                c2.Step(0.1f, c2.transform.position);
                c2.Step(3f, c2.transform.position + new Vector3(10f, 0f, 0f));
                if (c2.State != DungeonCursedChestRunner.Phase.Lost) Fail($"고리 밖 10m 인데 {c2.State}");
                else Debug.Log($"{T} cursed lose OK - 고리(9m) 밖이면 실패·상자 사라짐");

                // ⑤ 새 갈래
                DungeonBounty.On = true;
                DungeonBounty.BeginForTest(8, DungeonBounty.Id.Rooms, DungeonBounty.Id.Trove);
                DungeonBounty.Room(true); DungeonBounty.Room(true); DungeonBounty.Room(false);
                var rooms = Row(DungeonBounty.Id.Rooms);
                if (rooms.Cur != 0 || rooms.Done) Fail($"맞은 방 뒤 연달아 {rooms.Cur}");
                for (int i = 0; i < 3; i++) DungeonBounty.Room(true);
                DungeonBounty.TroveVisit();
                if (!rooms.Done || !Row(DungeonBounty.Id.Trove).Done || !DungeonBounty.AllDone) Fail($"연달아 3·보물 방 들름 안 채움 {rooms.Cur}");
                else Debug.Log($"{T} bounty+ OK - 방 연달아 안 맞기(맞으면 0)·보물 방 들름 · 표 {DungeonBounty.PoolCount}");

                // ⑥ 셋 다 → 계단 곁 상자(진짜 판·방 넘김 길로)
                runner.JumpToFloor(8);
                DungeonRunRank.ClearForTest();
                DungeonRunRank.OnHit(200f);
                DungeonBounty.BeginForTest(8, DungeonBounty.Id.Rooms, DungeonBounty.Id.Trove);
                for (int i = 0; i < 3; i++) DungeonRunRank.OnBountyRoom("fight"); // 앞서 맞은 흔적이 첫 방을 더럽힐 수 있어 셋
                DungeonRunRank.OnBountyRoom("trove");
                var chest = runner.BountyChest;
                if (chest == null) Fail("셋 다 채웠는데 상자가 안 섬");
                else
                {
                    var bc = chest.GetComponent<DungeonBountyChest>();
                    int gb = HeroState.Gold;
                    int got = bc.TryOpen(chest.transform.position);
                    if (got != DungeonBounty.ChestGold || HeroState.Gold - gb != got || DungeonBounty.ClaimChest() != 0) Fail($"상자 금 {got}/{DungeonBounty.ChestGold}·두 번");
                    else Debug.Log($"{T} bounty chest OK - 셋 다 → 계단 곁 상자 · 열면 금 +{got} · 두 번 안 줌");
                }
                DungeonRunRank.ClearForTest();

                // ⑦ 판 끝 자동 ⑧ 둘만
                DungeonBounty.BeginForTest(8, DungeonBounty.Id.NoHit, DungeonBounty.Id.Fast, DungeonBounty.Id.Trove);
                DungeonBounty.TroveVisit();
                var r1 = DungeonBounty.Finish(false, 1, 60f);
                if (!r1.HasValue || r1.Value.Chest != DungeonBounty.GradeOf(8) * DungeonBounty.GoldPer * DungeonBounty.ChestMul) Fail($"끝 판정으로 셋 다 → 자동 상자 {r1?.Chest}");
                DungeonBounty.BeginForTest(8, DungeonBounty.Id.NoHit, DungeonBounty.Id.Fast, DungeonBounty.Id.Trove);
                var r2 = DungeonBounty.Finish(false, 1, 60f);
                if (!r2.HasValue || r2.Value.Chest != 0) Fail($"둘만 채웠는데 상자 {r2?.Chest}");
                if (ok) Debug.Log($"{T} bounty end OK - 끝 판정으로 셋 다 → 판 끝 자동 상자 · 둘이면 없음");
            }
            finally
            {
                DungeonBounty.On = on0;
                DungeonBounty.ClearForTest();
                DungeonRunRank.ClearForTest();
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                DungeonRunRank.ClearForTest();
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            return ok;
        }

        private static DungeonBounty.Row Row(DungeonBounty.Id id)
        {
            foreach (var r in DungeonBounty.Active) if (r.Id == id) return r;
            return new DungeonBounty.Row();
        }
    }
}
