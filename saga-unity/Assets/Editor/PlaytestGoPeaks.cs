using System.Linq;
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
    /// PLAN.md 109-9 "정상 · 건물 가림 카메라"(웹 사가고 ⑰·⑯ 뒷부분) 진단 — `PlaytestHeadless` 가 스킬 모양 진단 뒤에 부른다.
    /// 정상 표(봉우리 칸마다 하나·id·이름·윗면 높이 = 실제 충돌면) · 발견(윗면 밖 안 셈·윗면 = 금 80+높이·경험 70·한 번만) ·
    /// 지도 ▲(안 간 지역 숨김·오른 정상 금빛·진짜 버튼으로 순간이동해 윗면에 선다·안 오른 정상 거절·결투 중 거절·안내 글 n/m) ·
    /// 세이브 v18 왕복·v17 로드(빈 기록) · 폭포 둘(산 칸 → 강 칸·턱 = 고원 높이·아래끝 = 수면·절벽 면 밖·셰이더 오류 없음·물보라·샘·충돌체 없음·지도 이름표) · 카메라(지붕 트리거가 카메라를 막고 발밑 광선은 지나감·사람 캡슐은 지나감·상자는 막음·지붕 셋).
    /// 끝나면 정상 기록·지도·돈·경험·자리·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoPeaks
    {
        private const float Dt = 0.02f;
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var ui = WorldMapUi.Instance;
            var summits = PeakSummits.Instance;
            if (pc == null || ui == null || summits == null) { Fail("PlayerController/WorldMapUi/PeakSummits 없음"); return false; }

            var startPeaks = WorldMapState.SnapshotPeaks();
            var startWp = WorldMapState.SnapshotWaypoints();
            var startRegions = WorldMapState.SnapshotRegions();
            bool startRevealed = WorldMapState.Revealed;
            int startGold = GoldState.Gold, startLevel = PlayerStats.Level, startExp = PlayerStats.Exp;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string table = "", found = "", cam = "", falls = "";
            try
            {
                table = CheckTable();
                found = CheckFindAndTeleport(pc, ui, summits);
                CheckSave(savePath);
                falls = CheckWaterfalls(ui);
                cam = CheckCamera(fc);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                WorldMapState.Restore(startWp, startRegions, startRevealed);
                WorldMapState.RestorePeaks(startPeaks);
                GoldState.Restore(startGold);
                PlayerStats.Restore(startLevel, startExp);
                DuelGate.ResetForTest();
                ui.Close();
                pc.ClearTestInput();
                pc.Teleport(fc.SafePoint);
                GoStamina.ResetFull();
            }
            if (_ok) Debug.Log($"[{_tag}] peaks OK - {table} | {found} | 세이브 v18/v17 | {falls} | {cam}");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] peaks: {msg}");
            _ok = false;
        }

        private static string CheckTable()
        {
            var peaks = GoWorldMap.Peaks;
            int cells = 0;
            for (int y = 0; y < TestMapData.RowCount; y++)
                for (int x = 0; x < TestMapData.Cols; x++) if (TestMapData.HasPeak(x, y)) cells++;
            if (peaks.Length != cells || peaks.Length < 4) Fail($"정상 {peaks.Length} ≠ 봉우리 칸 {cells}(또는 4 미만)");
            if (peaks.Select(p => p.Id).Distinct().Count() != peaks.Length) Fail("정상 id 겹침");
            if (peaks.Select(GoWorldMap.PeakName).Distinct().Count() != peaks.Length) Fail("정상 이름 겹침");
            float lo = float.MaxValue, hi = 0f;
            foreach (var p in peaks)
            {
                if (GoWorldMap.PeakIndex(p.Id) < 0) Fail($"{p.Id} 를 id 로 못 찾음");
                // 윗면 = 실제 충돌면
                if (Physics.Raycast(p.Top + Vector3.up * 6f, Vector3.down, out var hit, 12f, ~0, QueryTriggerInteraction.Ignore))
                {
                    if (Mathf.Abs(hit.point.y - p.Top.y) > 0.3f) Fail($"{p.Id} 윗면 높이 {hit.point.y:F1} ≠ {p.Top.y:F1}");
                }
                else Fail($"{p.Id} 윗면에 충돌면이 없음");
                lo = Mathf.Min(lo, p.Top.y); hi = Mathf.Max(hi, p.Top.y);
            }
            return $"정상 {peaks.Length} 높이 {lo:F0}~{hi:F0}m 금 {GoWorldMap.PeakGoldBase + Mathf.RoundToInt(lo)}~{GoWorldMap.PeakGoldBase + Mathf.RoundToInt(hi)}";
        }

        private static string CheckFindAndTeleport(PlayerController pc, WorldMapUi ui, PeakSummits summits)
        {
            WorldMapState.RestorePeaks(null);
            WorldMapState.Restore(null, null, false);
            var peaks = GoWorldMap.Peaks;
            var p = peaks[0];
            var other = peaks[1];
            // 지도 — 안 간 지역 정상은 숨김
            ui.Open();
            if (ui.PeakButton(0).gameObject.activeSelf) Fail("안 간 지역의 정상 ▲ 가 보임");
            ui.Close();

            PlayerStats.Restore(PlayerStats.Level, 0);
            bool noLevelUp = PlayerStats.ExpToNext > GoWorldMap.PeakExp;
            int gold = GoldState.Gold, exp = PlayerStats.Exp;
            if (summits.Check(p.Top + new Vector3(GoWorldMap.PeakStandRadius + 2f, 0.1f, 0f)) >= 0) Fail("윗면 밖인데 발견됨");
            if (summits.Check(p.Top - Vector3.up * 3f) >= 0) Fail("윗면 아래(옆면)인데 발견됨");
            if (summits.Check(p.Top + Vector3.up * 0.1f) != 0) { Fail("윗면에 섰는데 발견 안 됨"); return ""; }
            if (!WorldMapState.IsPeakFound(p.Id)) Fail("발견 기록이 없음");
            if (GoldState.Gold - gold != GoWorldMap.PeakGold(p)) Fail($"발견 금 {GoldState.Gold - gold} ≠ {GoWorldMap.PeakGold(p)}");
            if (noLevelUp && PlayerStats.Exp - exp != GoWorldMap.PeakExp) Fail($"발견 경험 {PlayerStats.Exp - exp} ≠ {GoWorldMap.PeakExp}");
            int g2 = GoldState.Gold;
            if (summits.Check(p.Top + Vector3.up * 0.1f) >= 0 || GoldState.Gold != g2) Fail("같은 정상이 또 보상함");

            // 지도 ▲ — 오른 정상 = 진짜 버튼으로 순간이동해 윗면에 선다
            ui.Open();
            var btn = ui.PeakButton(0);
            if (!btn.gameObject.activeSelf) Fail("오른 정상 ▲ 가 안 보임");
            if (!ui.InfoText.Contains($"1/{peaks.Length}")) Fail($"안내 글에 오른 정상 셈이 없음({ui.InfoText})");
            pc.Teleport(TestMapData.WorldPos(3, 4) + Vector3.up * 2f);
            btn.onClick.Invoke();
            if (ui.IsOpen) Fail("순간이동 뒤 지도가 안 닫힘");
            for (int i = 0; i < 25; i++) pc.Step(Dt);
            Vector3 at = pc.transform.position;
            if (!GoWorldMap.StandsOn(p, at)) Fail($"순간이동한 자리가 정상 윗면이 아님({at} / {p.Top})");
            if (at.y < p.Top.y - 0.6f) Fail($"정상 위에서 떨어짐({at.y:F1} < {p.Top.y:F1})");

            // 안 오른 정상 — 거절(자리 그대로)
            ui.Open();
            if (ui.TeleportToPeak(1)) Fail("안 오른 정상으로 순간이동됨");
            if (Vector3.Distance(pc.transform.position, at) > 0.5f) Fail("거절했는데 자리가 바뀜");
            // 결투 중 — 거절
            DuelGate.Report(true);
            if (ui.TeleportToPeak(0)) Fail("결투 중인데 순간이동됨");
            DuelGate.ResetForTest();
            ui.Close();
            return $"발견 {GoWorldMap.PeakName(p)} 금 +{GoWorldMap.PeakGold(p)} · 순간이동 윗면 {at.y - p.Top.y:+0.00;-0.00}m · 거절 둘(안 오름 {GoWorldMap.PeakName(other)}·결투)";
        }

        private static void CheckSave(string savePath)
        {
            var p = GoWorldMap.Peaks[0];
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":21") || !json.Contains($"\"peaksFound\":[\"{p.Id}\"]")) Fail("세이브 v18 에 오른 정상이 없다");
            WorldMapState.RestorePeaks(null);
            if (!SaveState.TryLoad() || !WorldMapState.IsPeakFound(p.Id)) Fail("v18 왕복 뒤 오른 정상이 사라졌다");
            string v17 = Regex.Replace(json.Replace("\"version\":21", "\"version\":17"), ",\"peaksFound\":\\[[^\\]]*\\]", "");
            if (v17.Contains("peaksFound")) { Fail("v17 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v17);
            if (!SaveState.TryLoad()) { Fail("v17 파일 TryLoad 실패"); return; }
            if (WorldMapState.PeakCount != 0) Fail("v17 파일을 읽었는데 정상 기록이 비어 있지 않음");
        }

        private static string CheckWaterfalls(WorldMapUi ui)
        {
            var parts = new System.Collections.Generic.List<string>();
            foreach (var w in TestMapData.Waterfalls)
            {
                if (TestMapData.TileAt(w.Gx, w.Gy) != '^' || !TestMapData.IsWater(TestMapData.TileAt(w.Gx + w.Dx, w.Gy + w.Dy)))
                    Fail($"{w.Id} 가 산 칸 → 강 칸이 아님");
                TestMapData.WaterfallGeometry(w, out Vector3 lip, out Vector3 foot, out Vector3 dir, out _);
                var root = GameObject.Find($"Waterfall_{w.Id}");
                if (root == null) { Fail($"{w.Id} 폭포가 씬에 없음"); continue; }
                var sheet = root.transform.Find("Sheet");
                var mr = sheet != null ? sheet.GetComponent<MeshRenderer>() : null;
                if (mr == null) { Fail($"{w.Id} 물 판 없음"); continue; }
                var sh = mr.sharedMaterial != null ? mr.sharedMaterial.shader : null;
                if (sh == null || sh.name != "Saga/WaterfallUnlit") Fail($"{w.Id} 셰이더 {(sh != null ? sh.name : "null")}");
                else if (UnityEditor.ShaderUtil.ShaderHasError(sh)) Fail("Saga/WaterfallUnlit 셰이더 오류");
                var b = mr.bounds;
                if (Mathf.Abs(b.max.y - lip.y) > 0.5f) Fail($"{w.Id} 턱 높이 {b.max.y:F1} ≠ 고원 {lip.y:F1}");
                if (Mathf.Abs(b.min.y - foot.y) > 0.3f) Fail($"{w.Id} 아래끝 {b.min.y:F1} ≠ 수면 {foot.y:F1}");
                float outMost = Vector3.Dot(b.center + Vector3.Scale(b.extents, new Vector3(Mathf.Sign(dir.x), 0f, Mathf.Sign(dir.z))) - lip, dir);
                if (outMost < 0.5f || outMost > TestMapData.WaterfallFoot + 1f) Fail($"{w.Id} 물 판이 절벽 면 밖 {outMost:F1}m");
                if (root.GetComponentsInChildren<Collider>().Length > 0) Fail($"{w.Id} 에 충돌체가 있음");
                var ps = root.GetComponentInChildren<ParticleSystem>();
                if (ps == null || ps.emission.rateOverTime.constant <= 0f) Fail($"{w.Id} 물보라 없음");
                if (root.transform.Find("SourcePool") == null) Fail($"{w.Id} 샘 웅덩이 없음");
                parts.Add($"{w.Id} {lip.y - foot.y:F0}m");
            }
            WorldMapState.Restore(null, null, false);
            ui.Open();
            if (ui.FallLabelCount != TestMapData.Waterfalls.Length) Fail($"지도 폭포 이름표 {ui.FallLabelCount}");
            else if (ui.FallLabelShown(0)) Fail("안 간 지역인데 폭포 이름표가 보임");
            WorldMapState.Visit("river");
            if (ui.FallLabelCount > 0 && !ui.FallLabelShown(0)) Fail("너른 강에 발 디뎠는데 폭포 이름표가 안 보임");
            ui.Close();
            return "폭포 " + string.Join(" · ", parts);
        }

        private static string CheckCamera(FieldCombat fc)
        {
            // 규칙
            var probe = new GameObject("CamProbe (test)");
            try
            {
                var cap = probe.AddComponent<CapsuleCollider>();
                if (CameraRig.Blocks(cap)) Fail("사람 캡슐이 카메라를 막음");
                var box = new GameObject("CamProbeBox (test)").AddComponent<BoxCollider>();
                box.transform.SetParent(probe.transform);
                if (!CameraRig.Blocks(box)) Fail("상자가 카메라를 안 막음");
                box.isTrigger = true;
                if (CameraRig.Blocks(box)) Fail("그냥 트리거가 카메라를 막음");
                box.gameObject.AddComponent<CameraOccluder>();
                if (!CameraRig.Blocks(box)) Fail("지붕 표식 트리거가 카메라를 안 막음");
                box.isTrigger = false;
                Object.DestroyImmediate(box.gameObject);

                // 공중(땅·물건 없음)에서 — 캡슐은 지나가고 상자는 막는다
                Vector3 o = fc.SafePoint + Vector3.up * 60f;
                Vector3 dir = new Vector3(0f, Mathf.Sin(35f * Mathf.Deg2Rad), Mathf.Cos(35f * Mathf.Deg2Rad));
                if (Mathf.Abs(CameraRig.OcclusionZoom(o, dir, 9f) - 9f) > 0.01f) Fail("빈 하늘에서 카메라가 당겨짐");
                probe.transform.position = o + dir * 5f;
                cap.height = 3.4f; cap.radius = 0.6f;
                Physics.SyncTransforms();
                if (Mathf.Abs(CameraRig.OcclusionZoom(o, dir, 9f) - 9f) > 0.01f) Fail("사람 캡슐 때문에 카메라가 당겨짐");
                Object.DestroyImmediate(cap);
                var solid = probe.AddComponent<BoxCollider>();
                solid.size = Vector3.one * 2f;
                Physics.SyncTransforms();
                float pulled = CameraRig.OcclusionZoom(o, dir, 9f);
                if (pulled > 5f) Fail($"상자 앞에서 카메라가 안 당겨짐({pulled:F2})");
            }
            finally
            {
                Object.DestroyImmediate(probe);
            }

            // 마을집 — 지붕 셋(몸통 둘·곁채 하나)에 트리거, 남쪽 벽 너머 지붕 속으로 가는 카메라 선이 당겨진다
            var roofs = Object.FindObjectsByType<CameraOccluder>(FindObjectsSortMode.None);
            if (roofs.Length < 3) Fail($"지붕 표식 {roofs.Length} < 3(씬 재빌드?)");
            var house = GameObject.Find("House_2");
            if (house == null) { Fail("House_2 없음"); return ""; }
            var wall = house.transform.Find("Wall");
            var wallCol = wall != null ? wall.GetComponent<BoxCollider>() : null;
            if (wallCol == null) { Fail("House_2 벽 충돌체 없음"); return ""; }
            var wb = wallCol.bounds;
            Vector3 origin = new Vector3(wb.center.x, wb.min.y + 2.5f, wb.min.z - 4f);
            Vector3 d = new Vector3(0f, Mathf.Sin(35f * Mathf.Deg2Rad), Mathf.Cos(35f * Mathf.Deg2Rad));
            float z = CameraRig.OcclusionZoom(origin, d, 16f);
            bool solidHit = Physics.Raycast(origin + d * 0.6f, d, out var sh, 15.4f, ~0, QueryTriggerInteraction.Ignore);
            if (z > 13f) Fail($"지붕 너머 카메라가 안 당겨짐({z:F1})");
            if (solidHit && sh.distance + 0.6f <= z + 0.6f) Fail($"지붕이 아니라 단단한 {sh.collider.name} 이 막음 — 지붕 트리거 검사가 안 됨");
            return $"지붕 {roofs.Length} · 지붕 너머 16→{z:F1}m(발밑 광선은 {(solidHit ? sh.collider.name : "안 맞음")})";
        }
    }
}
