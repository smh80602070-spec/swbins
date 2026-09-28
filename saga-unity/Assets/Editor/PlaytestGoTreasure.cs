using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-4 "보물 상자" 진단 — `PlaytestHeadless` 가 지역 지도 진단 뒤(일일 과제 앞)에 부른다.
    /// 연 상자 기록(`WorldEventState`)·돈·경험치·가방·세이브 파일·들판 적을 전부 시작 때로 되돌린다.
    /// </summary>
    public static class PlaytestGoTreasure
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            DuelGate.ResetForTest();
            var builder = WorldMapBuilder.Instance;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (builder == null || pc == null) { Fail("WorldMapBuilder/PlayerController 없음(씬 재빌드?)"); return false; }

            var startFlags = new List<string>(WorldEventState.TriggeredIds);
            int startGold = GoldState.Gold, startLevel = PlayerStats.Level, startExp = PlayerStats.Exp;
            var startOwned = new List<string>(Inventory.OwnedIds);
            string startWeapon = Inventory.EquippedWeaponId, startArmor = Inventory.EquippedArmorId;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                // 시작 상태에서 상자 기록만 지운다(앞 진단·실기 세이브가 연 상자가 있을 수 있다)
                var cleared = new List<string>();
                foreach (var f in startFlags) if (!f.StartsWith("chest_")) cleared.Add(f);
                WorldEventState.Restore(cleared);
                foreach (var ch in builder.Chests) ch.Tick(0.3f, Far);

                CheckData();
                CheckSpawned(builder);
                CheckPlain(builder, pc);
                CheckGroup(builder);
                CheckTorches(builder, fc, pc);
                CheckMapCount();
                CheckSave(builder, savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                WorldEventState.Restore(startFlags);
                GoldState.Restore(startGold);
                PlayerStats.Restore(startLevel, startExp);
                Inventory.Restore(startOwned, startWeapon, startArmor);
                foreach (var e in FieldEnemy.All) { if (!e.Alive) e.ReviveNow(); e.RestoreHomeForTest(); }
                foreach (var ch in builder.Chests) ch.Tick(0.3f, Far);
                DuelGate.ResetForTest();
                fc.ResetForTest();
                pc.ClearTestInput();
                pc.Teleport(fc.SafePoint);
                GoStamina.ResetFull();
                if (WorldMapUi.Instance != null) WorldMapUi.Instance.Close();
            }
            if (_ok) Debug.Log($"[{_tag}] treasure OK - 상자 {builder.Chests.Count}(평범 {GoTreasure.CountOf(GoTreasure.Grade.Common)}·정교 {GoTreasure.CountOf(GoTreasure.Grade.Exquisite)}·진귀 {GoTreasure.CountOf(GoTreasure.Grade.Precious)}·화려 {GoTreasure.CountOf(GoTreasure.Grade.Luxurious)})·자리·다가가 열기·높이·무리 한꺼번에 전멸·석등 원소/20초/진짜 스킬·지도 개수·세이브 왕복");
            return _ok;
        }

        private static readonly Vector3 Far = new Vector3(0f, -9999f, 0f);

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] treasure: {msg}");
            _ok = false;
        }

        private static TreasureChest Find(WorldMapBuilder b, string id)
        {
            foreach (var c in b.Chests) if (c.Data.Id == id) return c;
            Fail($"상자 {id} 가 없음");
            return null;
        }

        private static bool Walkable(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char ch = TestMapData.TileAt(gx, gy);
            return ch != '^' && !TestMapData.IsWater(ch);
        }

        private static void CheckData()
        {
            var chests = GoTreasure.Chests;
            if (chests.Length != 16) Fail($"상자 {chests.Length} ≠ 16");
            if (GoTreasure.CountOf(GoTreasure.Grade.Common) != 7 || GoTreasure.CountOf(GoTreasure.Grade.Exquisite) != 4
                || GoTreasure.CountOf(GoTreasure.Grade.Precious) != 3 || GoTreasure.CountOf(GoTreasure.Grade.Luxurious) != 2)
                Fail("등급 수가 평범 7·정교 4·진귀 3·화려 2 가 아님");
            var ids = new HashSet<string>();
            var solvable = new HashSet<GoElement> { GoElements.HeroElement, GoElements.ForMember("산적") };
            foreach (var c in chests)
            {
                if (!ids.Add(c.Id)) Fail($"상자 id {c.Id} 가 겹침");
                int gx = Mathf.RoundToInt(c.Gx), gy = Mathf.RoundToInt(c.Gy);
                switch (c.Spot)
                {
                    case GoTreasure.Spot.Ground:
                        if (!Walkable(GoTreasure.Position(c))) Fail($"{c.Id} 가 걸을 수 없는 칸에 있음");
                        break;
                    case GoTreasure.Spot.Peak:
                        if (!TestMapData.HasPeak(gx, gy)) Fail($"{c.Id} 칸 ({gx},{gy}) 에 봉우리가 없음");
                        break;
                    case GoTreasure.Spot.Plateau:
                        if (TestMapData.TileAt(gx, gy) != '^' || TestMapData.HasPeak(gx, gy)) Fail($"{c.Id} 칸 ({gx},{gy}) 이 봉우리 없는 산이 아님");
                        break;
                }
                if (c.Grade == GoTreasure.Grade.Exquisite && c.Spot == GoTreasure.Spot.Ground) Fail($"정교한 상자 {c.Id} 가 높은 곳이 아님");
                if (c.Lock == GoTreasure.Lock.Group)
                {
                    int n = 0;
                    foreach (var e in FieldEnemy.All) if (e.GroupId == c.GroupId) n++;
                    if (n == 0) Fail($"{c.Id} 의 무리 {c.GroupId} 적이 없음");
                }
                if (c.Lock == GoTreasure.Lock.Torches)
                {
                    if (c.Torches == null || c.Torches.Length < 2) { Fail($"{c.Id} 석등이 둘 미만"); continue; }
                    for (int i = 0; i < c.Torches.Length; i++)
                    {
                        if (!Walkable(GoTreasure.TorchPosition(c, i))) Fail($"{c.Id} 석등 {i} 가 걸을 수 없는 칸");
                        if (!solvable.Contains(c.Torches[i])) Fail($"{c.Id} 석등 {i} 원소 {c.Torches[i]} 를 주인공·산적이 못 냄");
                    }
                }
            }
        }

        private static void CheckSpawned(WorldMapBuilder b)
        {
            if (b.Chests.Count != GoTreasure.Chests.Length) { Fail($"세운 상자 {b.Chests.Count} ≠ {GoTreasure.Chests.Length}"); return; }
            foreach (var ch in b.Chests)
            {
                if (ch.Opened) Fail($"{ch.Data.Id} 가 기록을 지웠는데도 열려 있음");
                if (ch.Unlocked != (ch.Data.Lock == GoTreasure.Lock.None)) Fail($"{ch.Data.Id} 잠금 상태가 틀림");
                if (ch.Data.Spot == GoTreasure.Spot.Ground) continue;
                // 높은 곳 — 상자 옆 1.6m(가운데 쪽)를 위에서 쏘면 상자 바닥 높이의 땅(봉우리·망루·고원 윗면)에 닿아야 한다
                Vector3 p = ch.transform.position + new Vector3(-1.6f, 0f, ch.Data.Spot == GoTreasure.Spot.Plateau ? -1.6f : 0f);
                if (!Physics.Raycast(p + Vector3.up * 40f, Vector3.down, out RaycastHit hit, 120f, ~0, QueryTriggerInteraction.Ignore)
                    || Mathf.Abs(hit.point.y - ch.transform.position.y) > 0.4f)
                    Fail($"{ch.Data.Id} 가 딛는 면 위에 안 앉음(상자 {ch.transform.position.y:F1}, 면 {hit.point.y:F1})");
            }
            var lw = Find(b, "lantern_west");
            if (lw != null && lw.Torches.Count != 3) Fail($"lantern_west 석등 {lw.Torches.Count} ≠ 3");
        }

        private static void CheckPlain(WorldMapBuilder b, PlayerController pc)
        {
            var ch = Find(b, "village_e");
            if (ch == null) return;
            int gold = GoldState.Gold, lv = PlayerStats.Level, exp = PlayerStats.Exp;
            Vector3 p = ch.transform.position;
            if (ch.TryApproach(p + new Vector3(12f, 0f, 0f))) Fail("12m 밖에서 상자가 열림");
            if (!ch.TryApproach(p + new Vector3(3f, 0f, 0f))) { Fail("3m 까지 다가갔는데 안 열림"); return; }
            if (!ch.Opened || !WorldEventState.IsTriggered("chest_village_e")) Fail("열린 상자가 chest_village_e 로 안 남음");
            if (GoldState.Gold != gold + GoTreasure.GoldByGrade[0]) Fail($"평범 상자 돈 +{GoTreasure.GoldByGrade[0]} 이 아님({gold}→{GoldState.Gold})");
            if (PlayerStats.Level == lv && PlayerStats.Exp != exp + GoTreasure.ExpByGrade[0]) Fail("평범 상자 경험치 +5 가 아님");
            if (ch.TryApproach(p)) Fail("연 상자가 또 열림");
            ch.Tick(1f, Far);
            if (ch.LidAngle > -100f) Fail($"뚜껑이 안 젖혀짐({ch.LidAngle:F0}°)");

            // 망루 꼭대기 상자 — 발밑(높이 차 24m)에선 안 열리고 꼭대기에선 열린다
            var top = Find(b, "tower_top");
            if (top == null) return;
            Vector3 tp = top.transform.position;
            if (top.TryApproach(new Vector3(tp.x, tp.y - GoWorldMap.TowerHeight, tp.z))) Fail("망루 밑에서 꼭대기 상자가 열림");
            int g2 = GoldState.Gold;
            if (!top.TryApproach(tp + new Vector3(0f, 0.5f, 2f))) Fail("망루 꼭대기에서 상자가 안 열림");
            else if (GoldState.Gold != g2 + GoTreasure.GoldByGrade[1]) Fail("정교 상자 돈이 틀림");
        }

        private static void CheckGroup(WorldMapBuilder b)
        {
            var ch = Find(b, "grove_band");
            if (ch == null) return;
            var group = new List<FieldEnemy>();
            foreach (var e in FieldEnemy.All) if (e.GroupId == ch.Data.GroupId) { if (!e.Alive) e.ReviveNow(); group.Add(e); }
            if (group.Count < 2) { Fail("무리 적이 둘 미만"); return; }
            Vector3 p = ch.transform.position;
            if (ch.TryApproach(p + new Vector3(1f, 0f, 0f))) Fail("무리가 살아 있는데 진귀 상자가 열림");
            if (!ch.HintText().Contains(group.Count.ToString())) Fail($"잠금 안내에 남은 적 수가 없음: {ch.HintText()}");

            // 한꺼번에가 아니면 안 풀린다 — 하나 되살린 뒤 마지막을 쓰러뜨려도 잠긴 채
            for (int i = 0; i < group.Count - 1; i++) Kill(group[i]);
            group[0].ReviveNow();
            Kill(group[group.Count - 1]);
            ch.Tick(0.3f, Far);
            if (ch.Unlocked) Fail("무리가 한꺼번에 다 쓰러지지 않았는데 풀림");
            Kill(group[0]);
            if (!ch.Unlocked) { Fail("무리를 모두 쓰러뜨렸는데 사슬이 안 풀림"); return; }
            group[1].ReviveNow(); // 풀린 뒤 적이 다시 서도 풀린 채
            ch.Tick(0.3f, Far);
            if (!ch.Unlocked) Fail("적이 되살아나자 다시 잠김");
            int gold = GoldState.Gold;
            if (!ch.TryApproach(p + new Vector3(2f, 0f, 0f))) Fail("풀린 진귀 상자가 안 열림");
            else if (GoldState.Gold != gold + GoTreasure.GoldByGrade[2]) Fail("진귀 상자 돈이 틀림");
        }

        private static void Kill(FieldEnemy e)
        {
            if (e.Alive) e.TakeHit(999999f, GoElement.Physical, 100f, out _);
        }

        private static void CheckTorches(WorldMapBuilder b, FieldCombat fc, PlayerController pc)
        {
            var ch = Find(b, "lantern_west");
            if (ch == null) return;
            var t0 = ch.Torches[0];
            Vector3 p0 = t0.transform.position;
            if (ch.Pulse(p0, FieldCombat.SkillRadius, GoElement.Hydro) != 0 || t0.Lit) Fail("다른 원소로 화 석등이 켜짐");
            if (ch.Pulse(p0, FieldCombat.SkillRadius, GoElement.Pyro) != 1) Fail("스킬 원 하나가 석등 하나만 켜야 함(둘레 11m)");
            if (Mathf.Abs(ch.TorchTimeLeft - GoTreasure.TorchWindowSec) > 0.01f) Fail("첫 석등에 20초 창이 안 열림");
            if (ch.TryApproach(ch.transform.position)) Fail("석등이 덜 켜졌는데 상자가 열림");
            ch.Tick(GoTreasure.TorchWindowSec + 0.5f, Far);
            if (ch.LitCount != 0 || ch.TorchTimeLeft > 0f) Fail("20초가 지났는데 석등이 안 꺼짐");

            // 진짜 스킬(E) — 석등 옆에 서서 쓰면 ElementPulse 로 켜진다
            fc.ResetForTest();
            pc.Teleport(p0 + new Vector3(3f, 0.1f, 0f));
            if (fc.Skill() < 0) Fail("석등 옆에서 스킬이 안 나감");
            if (!t0.Lit) Fail("진짜 스킬(ElementPulse)로 석등이 안 켜짐");
            // 폭발 크기 원(12m)을 상자 가운데서 — 나머지 둘이 켜지며 풀린다
            if (ch.Pulse(ch.transform.position, FieldCombat.BurstRadius, GoElement.Pyro) != 2) Fail("상자 가운데 폭발 원이 남은 석등 둘을 못 켬");
            if (!ch.Unlocked) { Fail("석등이 모두 켜졌는데 안 풀림"); return; }
            ch.Tick(GoTreasure.TorchWindowSec + 1f, Far);
            if (ch.LitCount != 3) Fail("풀린 뒤 20초가 지나자 석등이 꺼짐");
            int gold = GoldState.Gold;
            if (!ch.TryApproach(ch.transform.position + new Vector3(0f, 0f, 2f))) Fail("풀린 화려 상자가 안 열림");
            else
            {
                if (GoldState.Gold != gold + GoTreasure.GoldByGrade[3]) Fail("화려 상자 돈이 틀림");
                bool has = false;
                foreach (var id in Inventory.OwnedIds) if (id == ch.Data.ItemId) has = true;
                if (!has) Fail($"화려 상자 물건 {ch.Data.ItemId} 이 가방에 없음");
            }

            // 둘째 화려 상자 — 수 석등은 화로 안 켜지고 수로 켜진다
            var ford = Find(b, "lantern_ford");
            if (ford == null) return;
            int hydroIdx = System.Array.IndexOf(ford.Data.Torches, GoElement.Hydro);
            if (hydroIdx < 0) { Fail("lantern_ford 에 수 석등이 없음"); return; }
            Vector3 ph = ford.Torches[hydroIdx].transform.position;
            if (ford.Pulse(ph, FieldCombat.SkillRadius, GoElement.Pyro) != 0) Fail("화로 수 석등이 켜짐");
            if (ford.Pulse(ph, FieldCombat.SkillRadius, GoElement.Hydro) != 1) Fail("수로 수 석등이 안 켜짐");
            ford.Tick(GoTreasure.TorchWindowSec + 0.5f, Far);
        }

        private static void CheckMapCount()
        {
            var ui = WorldMapUi.Instance;
            if (ui == null) { Fail("WorldMapUi 없음"); return; }
            ui.Open();
            string want = $"{GoTreasure.OpenedCount}/{GoTreasure.Chests.Length}";
            if (!ui.InfoText.Contains(want)) Fail($"지도 안내에 보물 상자 {want} 가 없음: {ui.InfoText}");
            ui.Close();
        }

        private static void CheckSave(WorldMapBuilder b, string savePath)
        {
            int opened = GoTreasure.OpenedCount;
            if (opened < 4) Fail($"진단에서 연 상자 {opened} < 4");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":28")) Fail("세이브 버전이 18 이 아님(107-4 는 스키마를 안 바꾼다, 18 = 109-9 정상)");
            if (!json.Contains("chest_village_e")) Fail("세이브에 chest_village_e 가 없음");

            var ch = Find(b, "village_e");
            WorldEventState.Restore(null);
            ch.Tick(0.3f, Far);
            if (ch.Opened || ch.LidAngle < -1f) Fail("기록을 지웠는데 상자가 닫히지 않음");
            if (!SaveState.TryLoad()) { Fail("TryLoad 실패"); return; }
            ch.Tick(0.3f, Far);
            if (!ch.Opened || ch.LidAngle > -100f) Fail("불러온 뒤 연 상자가 열린 모습이 아님");
            if (GoTreasure.OpenedCount != opened) Fail($"불러온 뒤 연 상자 수 {GoTreasure.OpenedCount} ≠ {opened}");
        }
    }
}
