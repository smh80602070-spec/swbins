using System.Collections.Generic;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-2 "DUNGEON 세 시대" 진단 — `PlaytestDungeonHeadless` 가 명소 층 진단 뒤에 부른다(같은 프레임 안에서 끝낸다).
    /// 표(단계 넷 × 현대·미래 몸 여덟이 서로 다르고 옛 몸과 안 겹침) · 해시 몫(층 2~100 잡졸·행상 다른 시대 약 40%, 현대·미래 둘 다) ·
    /// 실제 방(단계·시대마다 한 층을 찾아 전투 방을 지어 잡졸 이름·몸이 표대로, 과거 잡졸은 황건적, 정예 방 호위는 그대로) ·
    /// 행상(현대·미래 몸) · 마을 손님 넷(서로 다른 몸·현대·미래 둘 다·대사 넷 돌림·다른 사람과 떨어짐).
    /// 끝나면 층·도감·플레이어 자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonEras
    {
        private const string T = "[PlaytestDungeonHeadless] eras";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            string[] bestiary = BestiaryState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            string m = "";
            try
            {
                m += CheckTable() + CheckShares() + CheckRooms(runner) + CheckPeddlers(runner) + CheckFolk();
            }
            finally
            {
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                BestiaryState.Restore(bestiary);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 표(몸 여덟·옛 몸과 안 겹침)·해시 몫·단계×시대 실제 방(이름·몸)·정예 호위 그대로·행상 몸·마을 손님 넷(몸·대사 돌림·자리) |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var bodies = new HashSet<string>();
            for (int t = 0; t < DungeonEras.TierCount; t++)
            {
                if (DungeonEras.Foes[t, 0].Era != DungeonEra.Modern || DungeonEras.Foes[t, 1].Era != DungeonEra.Future) Fail($"단계 {t} 시대 칸 순서");
                for (int e = 0; e < 2; e++)
                {
                    var f = DungeonEras.Foes[t, e];
                    if (!bodies.Add(f.Body)) Fail($"몸 {f.Body} 겹침");
                    if (System.Array.IndexOf(DungeonEras.OldBodies, f.Body) >= 0) Fail($"몸 {f.Body} 가 옛 적·NPC 몸과 같음");
                    if (string.IsNullOrEmpty(f.NameKo) || f.NameKo == "황건적") Fail($"단계 {t} 이름 \"{f.NameKo}\"");
                }
            }
            foreach (var folk in DungeonEras.FolkList)
                if (bodies.Contains(folk.Body) || System.Array.IndexOf(DungeonEras.OldBodies, folk.Body) >= 0) Fail($"손님 몸 {folk.Body} 가 적·옛 몸과 같음");
            if (DungeonEras.Tier(2) != 0 || DungeonEras.Tier(10) != 1 || DungeonEras.Tier(25) != 2 || DungeonEras.Tier(99) != 3) Fail("단계 경계");
            return $" 몸 {bodies.Count}";
        }

        private static string CheckShares()
        {
            int n = 0, mo = 0, fu = 0, pn = 0, pOther = 0;
            for (int f = 2; f <= 100; f++)
                for (int r = 0; r < 8; r++)
                {
                    for (int i = 0; i < 4; i++)
                    {
                        n++;
                        var e = DungeonEras.GruntEra(f, r, i);
                        if (e != DungeonEras.GruntEra(f, r, i)) Fail("해시가 부를 때마다 다름");
                        if (e == DungeonEra.Modern) mo++; else if (e == DungeonEra.Future) fu++;
                    }
                    pn++;
                    if (DungeonEras.PeddlerEra(f, r) != DungeonEra.Past) pOther++;
                }
            float share = (float)(mo + fu) / n, ps = (float)pOther / pn;
            if (share < 0.34f || share > 0.46f) Fail($"잡졸 다른 시대 몫 {share:P0}");
            if ((float)mo / n < 0.15f || (float)fu / n < 0.15f) Fail($"현대 {mo}·미래 {fu} 가 한쪽으로 쏠림");
            if (ps < 0.3f || ps > 0.5f) Fail($"행상 다른 시대 몫 {ps:P0}");
            return $" 잡졸 몫 {share:P0}(현대 {mo}·미래 {fu})·행상 {ps:P0}";
        }

        private static readonly (int lo, int hi)[] TierFloors = { (2, 9), (10, 24), (25, 49), (50, 100) };

        /// <summary>단계 t 안에서 첫 방(방 0)에 그 시대 잡졸이 서는 보통 층(명소 층 아님)을 찾는다.</summary>
        private static int FindFloor(int t, DungeonEra era)
        {
            for (int f = TierFloors[t].lo; f <= TierFloors[t].hi; f++)
            {
                if (DungeonLandmarkData.IndexOfFloor(f) >= 0) continue;
                for (int i = 0; i < 4; i++) if (DungeonEras.GruntEra(f, 0, i) == era) return f;
            }
            return -1;
        }

        private static List<DungeonEnemy> RoomEnemies(DungeonFloorRunner runner)
        {
            var root = (Transform)typeof(DungeonFloorRunner).GetField("_contentRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(runner);
            var list = new List<DungeonEnemy>();
            foreach (Transform c in root)
            {
                var e = c.GetComponent<DungeonEnemy>();
                if (e != null && c.gameObject.activeSelf) list.Add(e);
            }
            return list;
        }

        private static string ControllerOf(Component c)
        {
            var a = c.GetComponentInChildren<Animator>();
            return a != null && a.runtimeAnimatorController != null ? a.runtimeAnimatorController.name : null;
        }

        private static string CheckRooms(DungeonFloorRunner runner)
        {
            int eraSeen = 0, rigged = 0;
            var bodiesSeen = new HashSet<string>();
            for (int t = 0; t < DungeonEras.TierCount; t++)
                foreach (var era in new[] { DungeonEra.Modern, DungeonEra.Future })
                {
                    int f = FindFloor(t, era);
                    if (f < 0) { Fail($"단계 {t} {era} 잡졸이 서는 층을 못 찾음"); continue; }
                    runner.JumpToFloor(f);
                    runner.BuildRoomForTest("fight");
                    var list = RoomEnemies(runner).FindAll(e => !e.IsMinion); // 109-10-10 졸개 빼고 잡졸 넷(졸개는 PlaytestDungeonHunt)
                    if (list.Count != 4) { Fail($"{f}층 전투 방 적 {list.Count} ≠ 4"); continue; }
                    for (int i = 0; i < 4; i++)
                    {
                        var want = DungeonEras.GruntEra(f, runner.RoomIndex, i);
                        string name = list[i].DisplayNameRaw;
                        if (want == DungeonEra.Past) { if (name != "황건적") Fail($"{f}층 잡졸 {i} 과거인데 \"{name}\""); continue; }
                        var foe = DungeonEras.FoeFor(f, want);
                        if (name != foe.NameKo) { Fail($"{f}층 잡졸 {i} \"{name}\" ≠ {foe.NameKo}"); continue; }
                        eraSeen++;
                        if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(foe.Body)) == null) continue;
                        string ctrl = ControllerOf(list[i]);
                        if (ctrl != foe.Body) Fail($"{f}층 {foe.NameKo} 몸 {ctrl} ≠ {foe.Body}");
                        else { rigged++; bodiesSeen.Add(foe.Body); }
                    }
                }
            // 정예 방 — 호위 잡졸은 시대를 안 탄다
            runner.JumpToFloor(12);
            runner.BuildRoomForTest("elite");
            foreach (var e in RoomEnemies(runner))
                if (e.gameObject.name == "Enemy_Floor_EraGrunt") Fail("정예 방 호위가 시대 잡졸");
            if (eraSeen == 0) Fail("시대 잡졸을 한 번도 못 봄");
            return $" 시대 잡졸 {eraSeen}(사실 몸 {rigged}·몸 {bodiesSeen.Count}가지)";
        }

        private static string CheckPeddlers(DungeonFloorRunner runner)
        {
            string m = "";
            foreach (var era in new[] { DungeonEra.Modern, DungeonEra.Future })
            {
                int f = -1;
                for (int x = 2; x <= 100 && f < 0; x++)
                    if (DungeonLandmarkData.IndexOfFloor(x) < 0 && DungeonEras.PeddlerEra(x, 0) == era) f = x;
                if (f < 0) { Fail($"{era} 행상 층 없음"); continue; }
                runner.JumpToFloor(f);
                runner.BuildRoomForTest("merchant");
                if (runner.LastPeddlerEra != era) Fail($"{f}층 행상 시대 {runner.LastPeddlerEra} ≠ {era}");
                string body = era == DungeonEra.Modern ? DungeonEras.ModernPeddlerBody : DungeonEras.FuturePeddlerBody;
                // 층 진행기 방 안의 행상만(씬의 고정 방에도 "Merchant" 가 있다)
                var root = (Transform)typeof(DungeonFloorRunner).GetField("_contentRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(runner);
                DungeonMerchant mine = null;
                foreach (Transform c in root)
                    if (c.gameObject.activeSelf && c.GetComponent<DungeonMerchant>() != null) mine = c.GetComponent<DungeonMerchant>();
                if (mine == null) { Fail($"{f}층 행상 없음"); continue; }
                if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(body)) == null) { m += $" 행상 {era}: 프리팹 없음"; continue; }
                string ctrl = ControllerOf(mine);
                if (ctrl != body) Fail($"{f}층 {era} 행상 몸 {ctrl} ≠ {body}");
                else m += $" {era} 행상={body}";
            }
            return m;
        }

        private static string CheckFolk()
        {
            var folks = Object.FindObjectsByType<EraFolk>(FindObjectsSortMode.None);
            if (folks.Length != DungeonEras.FolkList.Length) { Fail($"마을 손님 {folks.Length} ≠ {DungeonEras.FolkList.Length}"); return ""; }
            var idx = new HashSet<int>();
            var eras = new HashSet<DungeonEra>();
            int rigged = 0;
            var others = new List<Vector3>();
            foreach (var d in Object.FindObjectsByType<DungeonMerchant>(FindObjectsSortMode.None)) others.Add(d.transform.position);
            foreach (var t in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                if (t.name == "Villager" || t.name.StartsWith("Decor_Crate") || t.name.StartsWith("Decor_TownLanternBase")) others.Add(t.position);
            foreach (var f in folks)
            {
                if (!idx.Add(f.FolkIndex)) Fail($"손님 번호 {f.FolkIndex} 겹침");
                var data = f.Data;
                eras.Add(data.Era);
                if (data.Era == DungeonEra.Past) Fail($"{data.Id} 가 과거 사람");
                foreach (var o in others)
                {
                    Vector3 d = o - f.transform.position; d.y = 0f;
                    if (d.magnitude < 2f) Fail($"{data.Id} 가 다른 사람·물건과 {d.magnitude:F1}m");
                }
                var lines = new HashSet<string>();
                for (int i = 0; i < data.LinesKo.Length; i++) lines.Add(f.Speak());
                if (lines.Count != data.LinesKo.Length) Fail($"{data.Id} 대사 {lines.Count}가지 ≠ {data.LinesKo.Length}");
                if (f.Speak() != $"{DungeonEras.FolkName(data)} — {DungeonEras.FolkLine(data, 0)}") Fail($"{data.Id} 대사가 한 바퀴 뒤 처음으로 안 돎");
                if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(data.Body)) == null) continue;
                if (ControllerOf(f) != data.Body) Fail($"{data.Id} 몸 {ControllerOf(f)} ≠ {data.Body}");
                else rigged++;
            }
            if (!eras.Contains(DungeonEra.Modern) || !eras.Contains(DungeonEra.Future)) Fail("손님이 현대·미래 둘 다가 아님");
            return $" 손님 {folks.Length}(사실 몸 {rigged})";
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
