using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-3 "지역 지도" 진단 — `PlaytestHeadless` 가 이동 진단 뒤(일일 과제 앞)에 부른다.
    /// 세이브 파일을 덮어쓰는 단계는 try/finally 로 원래 파일(없었으면 지움)로 되돌린다(일일 과제 진단과 같은 이유).
    /// 끝나면 지도 상태·플레이어 자리도 시작 때로 되돌린다.
    /// </summary>
    public static class PlaytestGoWorldMap
    {
        private const float Dt = 0.02f;
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var builder = WorldMapBuilder.Instance;
            var ui = WorldMapUi.Instance;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (builder == null || ui == null || pc == null) { Fail("WorldMapBuilder/WorldMapUi/PlayerController 없음(씬 재빌드?)"); return false; }

            var startWp = WorldMapState.SnapshotWaypoints();
            var startRegions = WorldMapState.SnapshotRegions();
            bool startRevealed = WorldMapState.Revealed;
            Vector3 home = fc.SafePoint;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                CheckData();
                CheckPeaks();
                WorldMapState.Restore(null, null, false);
                CheckRegions(ui);
                CheckWaypoints(builder, ui, pc);
                CheckTower(builder, ui, pc);
                CheckToggle(ui);
                CheckSave(pc, savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                WorldMapState.Restore(startWp, startRegions, startRevealed);
                pc.ClearTestInput();
                pc.Teleport(home);
                GoStamina.ResetFull();
                ui.Close();
            }
            if (_ok) Debug.Log($"[{_tag}] world map OK - 지역 {GoWorldMap.Regions.Length}·역참 {builder.Stones.Count}·봉우리·망루 등반/밝히기·순간이동(진짜 버튼)·지도 열고 닫기·세이브 v18 왕복·v13 로드");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] world map: {msg}");
            _ok = false;
        }

        private static void CheckData()
        {
            for (int gy = 0; gy < TestMapData.RowCount; gy++)
                for (int gx = 0; gx < TestMapData.Cols; gx++)
                {
                    string r = GoWorldMap.RegionAt(gx, gy);
                    bool known = false;
                    foreach (var reg in GoWorldMap.Regions) if (reg.Id == r) known = true;
                    if (!known) { Fail($"({gx},{gy}) 지역 '{r}' 이 표에 없음"); return; }
                }
            foreach (var w in GoWorldMap.Waypoints)
            {
                var (gx, gy) = TestMapData.WorldToGrid(TestMapData.WorldPos(w.Gx, w.Gy));
                char ch = TestMapData.TileAt(gx, gy);
                if (ch == '^' || TestMapData.IsWater(ch)) Fail($"{w.Id} 가 걸을 수 없는 칸({ch})에 있음");
            }
        }

        private static void CheckPeaks()
        {
            int n = 0;
            for (int gy = 0; gy < TestMapData.RowCount; gy++)
                for (int gx = 0; gx < TestMapData.Cols; gx++)
                {
                    if (!TestMapData.HasPeak(gx, gy)) continue;
                    n++;
                    Vector3 b = TestMapData.PeakBase(gx, gy);
                    float top = b.y + TestMapData.PeakHeight(gx, gy);
                    if (!Physics.Raycast(b + Vector3.up * 80f, Vector3.down, out RaycastHit hit, 200f, ~0, QueryTriggerInteraction.Ignore) || Mathf.Abs(hit.point.y - top) > 0.3f)
                        Fail($"봉우리 ({gx},{gy}) 윗면 충돌 {top:F1} 이 아님");
                }
            if (n < 5) Fail($"봉우리가 {n}개뿐(5 이상 기대)");
            if (TestMapData.HasPeak(GoWorldMap.TowerGx, GoWorldMap.TowerGy)) Fail("망루 칸에 봉우리가 겹침");
        }

        private static void CheckRegions(WorldMapUi ui)
        {
            Vector3 village = TestMapData.WorldPos(2.5f, 3f);
            Vector3 east = TestMapData.WorldPos(6.8f, 3f);
            ui.TrackRegion(village, 1f);
            ui.TrackRegion(east, 1f);
            if (ui.LastRegion != "east_grove") Fail($"동쪽 숲으로 옮겼는데 지역이 {ui.LastRegion}");
            if (!WorldMapState.HasStepped("east_grove") || !WorldMapState.HasStepped("village")) Fail("지나온 지역이 발 디딘 곳으로 안 적힘");
            int eastIdx = System.Array.FindIndex(GoWorldMap.Regions, r => r.Id == "east_grove");
            int southIdx = System.Array.FindIndex(GoWorldMap.Regions, r => r.Id == "south_glade");
            if (ui.RegionLabel(eastIdx) == "? ? ?") Fail("가 본 지역 이름이 지도에 안 뜸");
            if (ui.RegionLabel(southIdx) != "? ? ?") Fail("안 가 본 지역 이름이 지도에 보임");
            float seen = Bright(ui.TileColorOnMap(6, 3)), unseen = Bright(ui.TileColorOnMap(2, 7));
            if (!(seen > unseen * 2.5f)) Fail($"안 가 본 지역이 지도에서 어둡지 않음({seen:F2} vs {unseen:F2})");
        }

        private static float Bright(Color c) => c.r + c.g + c.b;

        private static void CheckWaypoints(WorldMapBuilder builder, WorldMapUi ui, PlayerController pc)
        {
            if (builder.Stones.Count != GoWorldMap.Waypoints.Length) { Fail($"역참 {builder.Stones.Count} ≠ {GoWorldMap.Waypoints.Length}"); return; }
            var s0 = builder.Stones[0];
            var s1 = builder.Stones[1];
            if (s0.TryActivateFrom(s0.transform.position + new Vector3(40f, 0f, 0f))) Fail("멀리서 역참이 켜짐");
            if (!s0.TryActivateFrom(s0.transform.position + new Vector3(3f, 0f, 0f)) || !WorldMapState.IsActive(s0.Data.Id)) Fail("가까이 갔는데 역참이 안 켜짐");
            if (s0.TryActivateFrom(s0.transform.position)) Fail("이미 켠 역참이 또 처음 켜짐");
            if (ui.TeleportTo(1)) Fail("안 켠 역참으로 순간이동됨");
            pc.Teleport(TestMapData.WorldPos(2.5f, 3f));
            if (!ui.TeleportTo(0)) Fail("켠 역참으로 순간이동이 안 됨");
            if ((pc.transform.position - GoWorldMap.ArrivalPos(s0.Data)).magnitude > 1.5f) Fail("순간이동 도착 자리가 틀림");
            // 진짜 onClick
            s1.TryActivateFrom(s1.transform.position);
            ui.Open();
            ui.WaypointButton(1).onClick.Invoke();
            if ((pc.transform.position - GoWorldMap.ArrivalPos(s1.Data)).magnitude > 1.5f) Fail("지도 역참 버튼(진짜 onClick)으로 순간이동이 안 됨");
            if (ui.IsOpen) Fail("순간이동 뒤 지도가 안 닫힘");
            DuelGate.Report(true);
            if (ui.TeleportTo(0)) Fail("결투 중인데 순간이동됨");
            DuelGate.ResetForTest();
        }

        private static void CheckTower(WorldMapBuilder builder, WorldMapUi ui, PlayerController pc)
        {
            var tower = builder.Tower;
            if (tower == null) { Fail("옛 망루가 없음"); return; }
            float expectTop = TestMapData.GroundHeight(GoWorldMap.TowerGx, GoWorldMap.TowerGy) + GoWorldMap.TowerHeight;
            if (Mathf.Abs(tower.TopY - expectTop) > 0.01f) Fail("망루 꼭대기 높이가 틀림");
            if (tower.TryRevealFrom(tower.TopCenter + new Vector3(0f, -10f, 0f))) Fail("꼭대기가 아닌데 지도가 밝혀짐");

            // 실제로 기어오른다 — 고원 위 탑 북쪽 면 3m 앞에서 남(+Z)으로 밀기
            Vector3 c = tower.transform.position;
            pc.Teleport(new Vector3(c.x, c.y + 0.2f, c.z - GoWorldMap.TowerWidth * 0.5f - 3f));
            GoStamina.ResetFull();
            pc.SetTestInput(new Vector2(0f, 1f), false);
            bool reached = false;
            for (float t = 0f; t < 20f; t += Dt)
            {
                pc.Step(Dt);
                if (pc.Mode == PlayerController.MoveMode.Ground && pc.transform.position.y > tower.TopY - 0.5f) { reached = true; break; }
            }
            pc.ClearTestInput();
            if (!reached) { Fail($"망루를 기어올라 꼭대기에 못 섬(y {pc.transform.position.y:F1} / {tower.TopY:F1}, mode {pc.Mode}, 기력 {GoStamina.Value:F0})"); return; }
            if (!tower.TryRevealFrom(pc.transform.position)) Fail("망루 꼭대기에 섰는데 지도가 안 밝혀짐");
            int southIdx = System.Array.FindIndex(GoWorldMap.Regions, r => r.Id == "south_glade");
            if (ui.RegionLabel(southIdx) == "? ? ?") Fail("지도를 밝혔는데 안 가 본 지역 이름이 여전히 ???");
            if (WorldMapState.HasStepped("farmland")) Fail("밝히기가 발 디딘 기록까지 바꿈");
        }

        private static void CheckToggle(WorldMapUi ui)
        {
            ui.Close();
            ui.MapButton.onClick.Invoke();
            if (!ui.IsOpen) Fail("지도 버튼(진짜 onClick)으로 안 열림");
            ui.MapButton.onClick.Invoke();
            if (ui.IsOpen) Fail("지도 버튼을 다시 눌러도 안 닫힘");
        }

        private static void CheckSave(PlayerController pc, string savePath)
        {
            // 지금(역참 둘·지역 둘+·밝힘) 저장 → 지우고 → 불러와 같은지
            var wp = WorldMapState.SnapshotWaypoints();
            var rg = WorldMapState.SnapshotRegions();
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":20")) Fail("세이브 버전이 18 이 아님"); // 109-9 정상으로 v18
            WorldMapState.Restore(null, null, false);
            if (!SaveState.TryLoad()) { Fail("v14 TryLoad 실패"); return; }
            if (WorldMapState.ActiveCount != wp.Count || !WorldMapState.Revealed || WorldMapState.SnapshotRegions().Count != rg.Count)
                Fail("v14 왕복 뒤 지도 상태가 다름");

            // v13 옛 파일 — 지도 필드 없이 → 빈 기본값
            string v13 = json.Replace("\"version\":20", "\"version\":13");
            v13 = Regex.Replace(v13, ",\"guardianDown\":(true|false)", "");
            v13 = Regex.Replace(v13, ",\"waypoints\":\\[[^\\]]*\\]", "");
            v13 = Regex.Replace(v13, ",\"regionsVisited\":\\[[^\\]]*\\]", "");
            v13 = Regex.Replace(v13, ",\"mapRevealed\":(true|false)", "");
            if (v13.Contains("waypoints") || v13.Contains("mapRevealed")) { Fail("v13 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v13);
            if (!SaveState.TryLoad()) { Fail("v13 파일 TryLoad 실패(마이그레이션 경로?)"); return; }
            if (WorldMapState.ActiveCount != 0 || WorldMapState.Revealed || WorldMapState.SnapshotRegions().Count != 0)
                Fail("v13 파일을 읽었는데 지도 상태가 빈 기본값이 아님");
        }
    }
}
