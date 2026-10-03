using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 108 ③ "던전 명소 층" 진단 — `PlaytestDungeonHeadless` 가 3프레임째에 부른다(같은 프레임 안에서 끝낸다).
    /// 표(여섯·층 서로 다름·방 다섯·마지막은 주인·중간 종류는 문 종류 표 안·무기 카탈로그·한자 서로 다름) ·
    /// 5층을 두 번 걸어(문 하나·표지에 다음 방 이름·잡졸 이름·주인 이름) 두 번의 문 순서가 같다 ·
    /// 첫 토벌만 고유 무기·금 보너스, 두 번째는 흑철중검 · 주인 뒤 계단 · 보통 층(6층)은 예전 갈림길 ·
    /// 4층에서 내려가면 명소 층 · 세이브 v10 필드와 옛 세이브(null) 복원.
    /// 끝나면 층·토벌 수·영웅 상태·도감·플레이어 자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonLandmarks
    {
        private const string T = "[PlaytestDungeonHeadless] landmarks";
        private const BindingFlags Priv = BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }

            int floor0 = runner.CurrentFloor;
            int[] clears0 = LandmarkState.Snapshot();
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            string metrics = "";
            try
            {
                CheckTable();
                LandmarkState.Restore(null);
                var first = Walk(runner, 5, expectFirstClear: true);
                var second = Walk(runner, 5, expectFirstClear: false);
                if (string.Join("|", first) != string.Join("|", second)) Fail($"두 번 걸은 문 순서가 다름\n{string.Join("|", first)}\n{string.Join("|", second)}");
                if (LandmarkState.Clears(0) != 2) Fail($"토벌 수 {LandmarkState.Clears(0)} ≠ 2");
                CheckNormalFloor(runner);
                CheckDescendInto(runner);
                CheckSave();
                metrics = $" 5층 문 {string.Join("→", first)}";
            }
            finally
            {
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                LandmarkState.Restore(clears0);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 표·5층 두 번(문 하나·방 이름·잡졸·주인)·같은 순서·첫 토벌만 무기/금·계단·보통 층 갈림길·내려가며 진입·세이브 v10 |{metrics}");
            return _ok;
        }

        private static void CheckTable()
        {
            var all = DungeonLandmarkData.All;
            if (all.Length != 7) Fail($"명소 층 {all.Length} ≠ 7");
            var floors = new HashSet<int>();
            var hanja = new HashSet<string>();
            var kinds = new HashSet<string>();
            foreach (var k in DungeonFormulas.RoomKinds) kinds.Add(k.Key);
            for (int i = 0; i < all.Length; i++)
            {
                var lm = all[i];
                if (!floors.Add(lm.Floor) || lm.Floor < 3) Fail($"{lm.Key} 층 {lm.Floor}");
                if (!hanja.Add(lm.Hanja)) Fail($"{lm.Key} 한자 겹침");
                if (lm.Kinds.Length != DungeonLandmarkData.RoomCount || lm.RoomsKo.Length != DungeonLandmarkData.RoomCount) Fail($"{lm.Key} 방 수");
                if (lm.Kinds[DungeonLandmarkData.RoomCount - 1] != DungeonLandmarkData.LordKind) Fail($"{lm.Key} 마지막 방이 주인이 아님");
                for (int r = 0; r < DungeonLandmarkData.RoomCount - 1; r++)
                    if (!kinds.Contains(lm.Kinds[r])) Fail($"{lm.Key} 방{r} 종류 {lm.Kinds[r]} 가 문 종류 표 밖");
                if (ItemData.Get(lm.RewardItemId) == null) Fail($"{lm.Key} 무기 {lm.RewardItemId} 가 카탈로그에 없음");
                if (DungeonLandmarkData.IndexOfFloor(lm.Floor) != i) Fail($"{lm.Key} IndexOfFloor");
            }
            if (DungeonLandmarkData.IndexOfFloor(6) != -1) Fail("6층이 명소 층");
        }

        /// <summary>그 층 첫 방부터 주인·계단까지 걷는다. 선 문 표지를 "종류:글" 로 모아 돌려준다.</summary>
        private static List<string> Walk(DungeonFloorRunner runner, int floor, bool expectFirstClear)
        {
            var seen = new List<string>();
            runner.JumpToFloor(floor);
            int li = runner.CurrentLandmark;
            if (li != 0 || runner.RoomTotal != DungeonLandmarkData.RoomCount) { Fail($"{floor}층 명소 {li}·방 {runner.RoomTotal}"); return seen; }
            var lm = DungeonLandmarkData.All[li];
            if (!runner.LandmarkHud.Contains(DungeonLandmarkData.Name(li)) || !runner.LandmarkHud.Contains(DungeonLandmarkData.RoomName(li, 0))) Fail($"HUD \"{runner.LandmarkHud}\"");
            bool gruntChecked = false;
            for (int r = 0; r < DungeonLandmarkData.RoomCount - 1; r++)
            {
                foreach (var e in RoomEnemies(runner))
                {
                    if (!gruntChecked && e.DisplayNameRaw == DungeonLandmarkData.GruntName(li)) gruntChecked = true;
                    if (e.DisplayNameRaw == "황건적") Fail("명소 층 잡졸이 황건적");
                }
                KillRoom(runner);
                Tick(runner);
                var pods = new List<(string Kind, string Label)>(runner.DoorPods());
                if (pods.Count != 1) { Fail($"방{r} 문 {pods.Count} ≠ 1"); return seen; }
                if (pods[0].Kind != lm.Kinds[r + 1] || pods[0].Label != DungeonLandmarkData.RoomName(li, r + 1)) Fail($"방{r} 문 {pods[0].Kind}:{pods[0].Label}");
                seen.Add($"{pods[0].Kind}:{pods[0].Label}");
                Advance(runner, pods[0].Kind);
                if (runner.RoomIndex != r + 1) Fail($"방 번호 {runner.RoomIndex} ≠ {r + 1}");
            }
            if (!gruntChecked) Fail($"잡졸 이름 {DungeonLandmarkData.GruntName(li)} 가 안 보임");
            var lord = runner.Lord;
            if (lord == null) { Fail("주인 방에 주인이 없음"); return seen; }
            if (lord.DisplayNameRaw != DungeonLandmarkData.LordName(li) || !lord.IsBoss || lord.IsWorldBoss) Fail($"주인 {lord.DisplayNameRaw}·두목 {lord.IsBoss}·월드 {lord.IsWorldBoss}");
            string wantItem = expectFirstClear ? lm.RewardItemId : "wp_greatblade";
            if (lord.RewardItemId != wantItem) Fail($"주인 무기 {lord.RewardItemId} ≠ {wantItem}");
            int g0 = HeroState.Gold;
            lord.TakeDamage(999999f);
            int bonus = HeroState.Gold - g0 - DungeonFormulas.RewardGold(floor, true);
            int wantBonus = expectFirstClear ? DungeonLandmarkData.FirstClearGoldPerFloor * floor : 0;
            if (bonus != wantBonus) Fail($"토벌 금 보너스 {bonus} ≠ {wantBonus}");
            if (runner.Lord != null) Fail("쓰러진 주인이 남음");
            KillRoom(runner);
            Tick(runner);
            var stair = new List<(string Kind, string Label)>(runner.DoorPods());
            if (stair.Count != 1 || stair[0].Kind != "stair") Fail($"주인 뒤 문 {stair.Count}·{(stair.Count > 0 ? stair[0].Kind : "-")}");
            seen.Add("lord:" + lord.DisplayNameRaw);
            return seen;
        }

        private static void CheckNormalFloor(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(6);
            if (runner.CurrentLandmark != -1 || runner.LandmarkHud != "" || runner.RoomTotal != DungeonFormulas.RoomsFor(6)) Fail("6층이 명소처럼 굴음");
            // 109-2 — 보통 층 잡졸은 해시대로 황건적이거나 그 단계의 현대·미래 적
            int gi = 0;
            foreach (var e in RoomEnemies(runner))
            {
                if (e.IsMinion) continue; // 109-10-10 졸개는 우두머리 몸·이름을 따른다(PlaytestDungeonHunt 가 본다)
                var era = DungeonEras.GruntEra(6, runner.RoomIndex, gi++);
                string want = era == DungeonEra.Past ? "황건적" : DungeonEras.FoeFor(6, era).NameKo;
                if (e.DisplayNameRaw != want) Fail($"보통 층 잡졸 {e.DisplayNameRaw} ≠ {want}");
            }
            KillRoom(runner);
            Tick(runner);
            int n = 0;
            foreach (var p in runner.DoorPods())
            {
                n++;
                if (p.Label != DungeonFormulas.KindDisplayName(p.Kind)) Fail($"보통 층 문 글 {p.Label}");
            }
            if (n < 2) Fail($"보통 층 갈림길 {n} < 2");
        }

        private static void CheckDescendInto(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(4);
            typeof(DungeonFloorRunner).GetMethod("Descend", Priv).Invoke(runner, null);
            if (runner.CurrentFloor != 5 || runner.CurrentLandmark != 0 || runner.RoomTotal != DungeonLandmarkData.RoomCount) Fail($"4층에서 내려가도 명소 층이 아님 {runner.CurrentFloor}/{runner.CurrentLandmark}");
            if (!DungeonLandmarkData.EnterText(0).Contains(DungeonLandmarkData.All[0].Hanja)) Fail("명소 층 진입 글에 한자 없음");
        }

        private static void CheckSave()
        {
            var saveType = typeof(SaveState);
            var ver = saveType.GetField("SaveVersion", BindingFlags.NonPublic | BindingFlags.Static);
            if (ver == null || (int)ver.GetValue(null) < 10) Fail($"세이브 버전 {(ver != null ? ver.GetValue(null) : "?")} < 10");
            var data = saveType.GetNestedType("SaveData", BindingFlags.NonPublic);
            if (data == null || data.GetField("landmarkClears") == null) Fail("SaveData.landmarkClears 없음");
            LandmarkState.Restore(new[] { 3, 0, 1 });
            if (LandmarkState.Clears(0) != 3 || LandmarkState.Clears(2) != 1 || LandmarkState.Snapshot().Length != 7) Fail("짧은 배열 복원");
            LandmarkState.Restore(null);
            if (LandmarkState.IsCleared(0)) Fail("옛 세이브(null) 복원 뒤 토벌이 남음");
        }

        private static IEnumerable<DungeonEnemy> RoomEnemies(DungeonFloorRunner runner)
        {
            var content = runner.transform.Find("RoomContent");
            if (content == null) yield break;
            foreach (var e in content.GetComponentsInChildren<DungeonEnemy>())
                if (e.IsAlive) yield return e;
        }

        private static void KillRoom(DungeonFloorRunner runner)
        {
            foreach (var e in new List<DungeonEnemy>(RoomEnemies(runner))) e.TakeDamage(999999f);
        }

        private static void Tick(DungeonFloorRunner runner) => typeof(DungeonFloorRunner).GetMethod("Update", Priv).Invoke(runner, null);

        private static void Advance(DungeonFloorRunner runner, string kind)
        {
            typeof(DungeonFloorRunner).GetMethod("ClearDoorPods", Priv).Invoke(runner, null);
            typeof(DungeonFloorRunner).GetMethod("AdvanceRoom", Priv).Invoke(runner, new object[] { kind });
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
