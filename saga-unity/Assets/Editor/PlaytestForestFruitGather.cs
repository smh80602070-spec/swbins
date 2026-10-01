using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Forest.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.fs.fruit-gather` 과일나무·채집·좌판 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 과일 통화: 더하기(0·음수 무시)·쓰기(부족하면 그대로)·복원 하한
    /// ② 채집 리듬: 연속 3번째마다 보너스(창 안에서) ③ 소원 버프: 과일 ×1.5(나무 1→2) ④ 좌판 표: 벽지·장판 다섯씩·기본은 공짜·가격 = 값/100 올림 규칙·오름차순
    /// ⑤ 구매·착용: 과일 부족이면 안 사짐·산 것은 다시 공짜·기본으로 돌아가기 공짜·모르는 키 거절 ⑥ 세이브 스냅샷 왕복(기본값 보장·빈 착용은 기본으로).
    /// `-executeMethod Saga.EditorTools.PlaytestForestFruitGather.Run` → "[PlaytestForestFruitGather] OK/FAIL".
    /// </summary>
    public static class PlaytestForestFruitGather
    {
        [MenuItem("Saga/Playtest Forest Fruit Gather")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestForestFruitGather]");
            int fruit0 = ForestState.FruitCount;
            var fin0 = ForestHomeState.SnapshotFinishes();
            string wishDone0 = ForestFestivalState.SnapshotDoneDate();
            long wish0 = ForestFestivalState.SnapshotWishUntilTicks();
            using (PlaytestKit.ErrorCounter())
            {
                CheckFruit();
                CheckStreak();
                CheckWish();
                CheckFinishTable();
                CheckBuy();
                CheckFinishSnapshot();
            }
            ForestGatherStreak.ResetForTest();
            ForestState.Restore(fruit0);
            ForestHomeState.RestoreFinishes(fin0.Walls, fin0.Floors, fin0.CurWall, fin0.CurFloor);
            ForestFestivalState.Restore(wishDone0, wish0);
            PlaytestKit.Summary("PlaytestForestFruitGather");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckFruit()
        {
            ForestState.Restore(0);
            ForestState.AddFruit(0); ForestState.AddFruit(-3);
            PlaytestKit.Check(ForestState.FruitCount == 0, "un.fs.fruit-gather: 0·음수가 더해짐");
            ForestState.AddFruit(5);
            PlaytestKit.Check(ForestState.FruitCount == 5, "un.fs.fruit-gather: 5개 더하기");
            PlaytestKit.Check(!ForestState.SpendFruit(6) && ForestState.FruitCount == 5, "un.fs.fruit-gather: 모자란데 쓰임/줄었음");
            PlaytestKit.Check(ForestState.SpendFruit(5) && ForestState.FruitCount == 0, "un.fs.fruit-gather: 딱 맞게 쓰기 실패");
            PlaytestKit.Check(ForestState.SpendFruit(0) && ForestState.SpendFruit(-2) && ForestState.FruitCount == 0, "un.fs.fruit-gather: 0·음수 지출이 실패하거나 값을 바꿈");
            ForestState.Restore(-9);
            PlaytestKit.Check(ForestState.FruitCount == 0, "un.fs.fruit-gather: 복원이 음수를 못 막음");
            ForestState.Restore(42);
            PlaytestKit.Check(ForestState.FruitCount == 42, "un.fs.fruit-gather: 복원 값");
        }

        private static void CheckStreak()
        {
            ForestGatherStreak.ResetForTest();
            var got = new List<bool>();
            for (int i = 0; i < 7; i++) got.Add(ForestGatherStreak.ReportGather());
            bool[] want = { false, false, true, false, false, true, false };
            for (int i = 0; i < want.Length; i++)
                PlaytestKit.Check(got[i] == want[i], $"un.fs.fruit-gather: {i + 1}번째 채집 보너스 {got[i]} (기대 {want[i]})");
            ForestGatherStreak.ResetForTest();
            PlaytestKit.Check(!ForestGatherStreak.ReportGather(), "un.fs.fruit-gather: 리셋 뒤 첫 채집이 보너스");
        }

        private static void CheckWish()
        {
            ForestFestivalState.Restore("", 0L);
            PlaytestKit.Check(!ForestFestivalState.WishActive && Mathf.Approximately(ForestFestivalState.FruitMultiplier, 1f), "un.fs.fruit-gather: 소원이 없는데 배율이 1 이 아님");
            PlaytestKit.Check(Mathf.RoundToInt(1 * ForestFestivalState.FruitMultiplier) == 1, "un.fs.fruit-gather: 나무 한 그루가 1개가 아님");
            ForestFestivalState.Restore("", DateTime.Now.AddHours(1).Ticks);
            PlaytestKit.Check(ForestFestivalState.WishActive && Mathf.Approximately(ForestFestivalState.FruitMultiplier, 1.5f), "un.fs.fruit-gather: 소원 버프가 ×1.5 가 아님");
            PlaytestKit.Check(Mathf.RoundToInt(1 * ForestFestivalState.FruitMultiplier) == 2, "un.fs.fruit-gather: 소원 중 나무 한 그루가 2개가 아님");
            ForestFestivalState.Restore("", DateTime.Now.AddHours(-1).Ticks);
            PlaytestKit.Check(!ForestFestivalState.WishActive && Mathf.Approximately(ForestFestivalState.FruitMultiplier, 1f), "un.fs.fruit-gather: 끝난 소원이 남아 있음");
        }

        private static void CheckFinishTable()
        {
            foreach (var kind in new[] { FinishKind.Wall, FinishKind.Floor })
            {
                var cat = ForestFinishData.CatalogOf(kind);
                PlaytestKit.Check(cat.Length == 5, $"un.fs.fruit-gather: {kind} {cat.Length}종 (기대 5)");
                PlaytestKit.Check(cat[0].Key == ForestFinishData.DefaultKeyOf(kind) && cat[0].FruitCost == 0 && cat[0].Value == 0, $"un.fs.fruit-gather: {kind} 첫 칸이 공짜 기본이 아님");
                var keys = new HashSet<string>();
                int prev = -1;
                foreach (var item in cat)
                {
                    PlaytestKit.Check(keys.Add(item.Key) && item.Kind == kind && !string.IsNullOrEmpty(item.Name), $"un.fs.fruit-gather: {kind} {item.Key} 키 중복·종류·이름 이상");
                    int expect = item.Value <= 0 ? 0 : Mathf.Max(1, (int)Math.Round(item.Value / 100.0));
                    PlaytestKit.Check(item.FruitCost == expect, $"un.fs.fruit-gather: {item.Key} 과일값 {item.FruitCost} (기대 {expect})");
                    PlaytestKit.Check(item.FruitCost > prev, $"un.fs.fruit-gather: {kind} 가격이 오름차순이 아님({item.Key})");
                    prev = item.FruitCost;
                    PlaytestKit.Check(ForestFinishData.Get(kind, item.Key) == item, $"un.fs.fruit-gather: Get({item.Key}) 가 자기 자신이 아님");
                }
                PlaytestKit.Check(ForestFinishData.Get(kind, "nope") == null, $"un.fs.fruit-gather: {kind} 모르는 키가 null 이 아님");
            }
            PlaytestKit.Check(ForestFinishData.Get(FinishKind.Wall, "wood") == null && ForestFinishData.Get(FinishKind.Floor, "earth") == null, "un.fs.fruit-gather: 벽·바닥 표가 섞임");
        }

        private static void CheckBuy()
        {
            ForestHomeState.RestoreFinishes(null, null, null, null);
            ForestState.Restore(0);
            PlaytestKit.Check(ForestHomeState.CurrentWall == ForestFinishData.DefaultWallKey && ForestHomeState.CurrentFloor == ForestFinishData.DefaultFloorKey, "un.fs.fruit-gather: 기본 착용이 아님");
            PlaytestKit.Check(ForestHomeState.OwnsFinish(FinishKind.Wall, "earth") && ForestHomeState.OwnsFinish(FinishKind.Floor, "wood") && !ForestHomeState.OwnsFinish(FinishKind.Wall, "hanji"), "un.fs.fruit-gather: 보유 목록 초기값 이상");

            var hanji = ForestFinishData.Get(FinishKind.Wall, "hanji");
            PlaytestKit.Check(!ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "hanji") && !ForestHomeState.OwnsFinish(FinishKind.Wall, "hanji") && ForestHomeState.CurrentWall == "earth", "un.fs.fruit-gather: 과일 0 개인데 한지벽이 사짐");
            ForestState.Restore(hanji.FruitCost - 1);
            PlaytestKit.Check(!ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "hanji") && ForestState.FruitCount == hanji.FruitCost - 1, "un.fs.fruit-gather: 1개 모자란데 사지거나 과일이 줄었음");
            ForestState.Restore(hanji.FruitCost + 3);
            PlaytestKit.Check(ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "hanji") && ForestState.FruitCount == 3 && ForestHomeState.OwnsFinish(FinishKind.Wall, "hanji") && ForestHomeState.CurrentWall == "hanji", "un.fs.fruit-gather: 한지벽 구매·착용 실패");
            PlaytestKit.Check(ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "earth") && ForestHomeState.CurrentWall == "earth" && ForestState.FruitCount == 3, "un.fs.fruit-gather: 기본으로 돌아가기가 공짜가 아님");
            PlaytestKit.Check(ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "hanji") && ForestHomeState.CurrentWall == "hanji" && ForestState.FruitCount == 3, "un.fs.fruit-gather: 산 벽지를 다시 입는데 과일이 듦");
            PlaytestKit.Check(!ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "nope") && !ForestHomeState.TryBuyAndEquipFinish(FinishKind.Wall, "wood"), "un.fs.fruit-gather: 모르는 키·장판 키가 벽지로 사짐");
            PlaytestKit.Check(ForestHomeState.CurrentFloor == "wood", "un.fs.fruit-gather: 벽지를 샀는데 장판이 바뀜");

            var ondol = ForestFinishData.Get(FinishKind.Floor, "ondol");
            ForestState.Restore(ondol.FruitCost);
            PlaytestKit.Check(ForestHomeState.TryBuyAndEquipFinish(FinishKind.Floor, "ondol") && ForestState.FruitCount == 0 && ForestHomeState.CurrentFloor == "ondol" && ForestHomeState.CurrentWall == "hanji", "un.fs.fruit-gather: 구들장(가장 비쌈) 구매 실패");
        }

        private static void CheckFinishSnapshot()
        {
            var s = ForestHomeState.SnapshotFinishes();
            ForestHomeState.RestoreFinishes(null, null, null, null);
            PlaytestKit.Check(!ForestHomeState.OwnsFinish(FinishKind.Wall, "hanji"), "un.fs.fruit-gather: 초기화가 보유를 안 비움");
            ForestHomeState.RestoreFinishes(s.Walls, s.Floors, s.CurWall, s.CurFloor);
            PlaytestKit.Check(ForestHomeState.OwnsFinish(FinishKind.Wall, "hanji") && ForestHomeState.OwnsFinish(FinishKind.Floor, "ondol") && ForestHomeState.CurrentWall == "hanji" && ForestHomeState.CurrentFloor == "ondol", "un.fs.fruit-gather: 스냅샷 왕복이 값을 못 되살림");
            ForestHomeState.RestoreFinishes(new[] { "muk", "", null }, new string[0], "", null);
            PlaytestKit.Check(ForestHomeState.OwnsFinish(FinishKind.Wall, "earth") && ForestHomeState.OwnsFinish(FinishKind.Wall, "muk") && ForestHomeState.OwnsFinish(FinishKind.Floor, "wood"), "un.fs.fruit-gather: 복원이 기본값을 보장 안 함/빈 키를 담음");
            PlaytestKit.Check(ForestHomeState.CurrentWall == "earth" && ForestHomeState.CurrentFloor == "wood", "un.fs.fruit-gather: 빈 착용이 기본으로 안 돌아감");
        }
    }
}
