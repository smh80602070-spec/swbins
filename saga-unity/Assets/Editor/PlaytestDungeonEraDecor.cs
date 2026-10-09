using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-2b "명소 층·마을 꾸밈에 시대 층" 진단 — `PlaytestDungeonHeadless` 가 세 시대 진단 뒤에 부른다(같은 프레임 안에서 끝낸다).
    /// 표(명소 층 여섯 = `DungeonLandmarkData` 순·벌마다 과거·현대·미래·다른 시대 몫 30~50%) ·
    /// 마을 다섯(조각 수·방 벽 안·문길 비킴·다른 사람·물건과 1m·밑면·잔해·삼각형 예산) ·
    /// 명소 층(그 층일 때만 그 벌이 켜짐·보통 층은 다 꺼짐·잡졸/두목/호위/볼일/문 표지/들어오는 자리/남쪽 문길/바이옴 꾸밈 비킴).
    /// 끝나면 층·플레이어 자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonEraDecor
    {
        private const string T = "[PlaytestDungeonHeadless] era-decor";
        private const float WallInner = 9.4f;       // 벽 안쪽 면(10) − 여유
        private const float DoorHalf = 3.9f;        // 문 너비 7.33 의 반 + 여유
        private const float DoorDepth = 6.5f;       // 벽에서 이만큼 안쪽까지는 문길
        // 방 하나 원본 삼각형 — GO 무더기 ≤ 35만(108 ①)보다 조금 아래. 방 안에선 늘 가까이 보여 LOD 를 안 둔다.
        private const int LandmarkTriBudget = 300000;
        private const int TownTriBudget = 300000;
        private static bool _ok;
        private static readonly List<string> _sizes = new List<string>();

        /// <summary>마을 방마다 열린 문(N·S·E·W) — `BuildTestDungeonScene` 의 OpenXxxDoor 와 같다.</summary>
        private static readonly Dictionary<string, string> TownDoors = new Dictionary<string, string>
        {
            { "Town2", "NWE" }, { "Town3", "ES" }, { "Town4", "WS" }, { "Crossroads", "NE" }, { "Crossroads2", "WN" },
        };

        public static bool Run()
        {
            _ok = true;
            _sizes.Clear();
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            Vector3 pos = playerGo.transform.position;
            string m = "";
            try
            {
                m += CheckTable() + CheckTowns() + CheckLandmarks(runner);
            }
            finally
            {
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            Debug.Log($"{T} 크기 — " + string.Join(" · ", _sizes));
            if (_ok) Debug.Log($"{T} OK - 표(여섯 = 명소 순·벌마다 세 시대·몫)·마을 다섯(벽 안·문길·비킴·밑면·잔해·예산)·명소 층(그 층만 켜짐·방 자리 비킴) |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            if (DungeonEraDecor.Landmarks.Length != DungeonLandmarkData.All.Length) Fail($"명소 꾸밈 {DungeonEraDecor.Landmarks.Length} ≠ 명소 {DungeonLandmarkData.All.Length}");
            for (int i = 0; i < DungeonEraDecor.Landmarks.Length && i < DungeonLandmarkData.All.Length; i++)
                if (DungeonEraDecor.Landmarks[i].Id != DungeonLandmarkData.All[i].Key) Fail($"명소 꾸밈 {i} 번 {DungeonEraDecor.Landmarks[i].Id} ≠ {DungeonLandmarkData.All[i].Key}");
            int n = 0, other = 0;
            foreach (var sets in new[] { DungeonEraDecor.Landmarks, DungeonEraDecor.Towns })
                foreach (var s in sets)
                {
                    var eras = new HashSet<DungeonEra>();
                    foreach (var p in s.Pieces)
                    {
                        n++;
                        eras.Add(p.Era);
                        if (p.Era != DungeonEra.Past) other++;
                        if (p.Era == DungeonEra.Future && (p.Collide || p.Y < DungeonEraDecor.RiftMinHover)) Fail($"{s.Id} 잔해 {p.Model} 가 부딪히거나 낮게 뜸");
                        if (System.Array.IndexOf(DungeonEraDecor.ModelIds, DungeonEraDecor.ModelId(p.Model)) < 0) Fail($"{s.Id} 모델 {p.Model} 가 ModelIds 에 없음");
                    }
                    if (eras.Count != 3) Fail($"{s.Id} 시대 {eras.Count}가지(세 시대여야)");
                }
            float share = n > 0 ? (float)other / n : 0f;
            if (share < 0.3f || share > 0.5f) Fail($"다른 시대 몫 {share:P0}(30~50%)");
            return $" 조각 {n}·다른 시대 {share:P0}";
        }

        // ---- 마을 ----------------------------------------------------------------

        private static string CheckTowns()
        {
            EraDecorBuilder builder = null;
            foreach (var b in Object.FindObjectsByType<EraDecorBuilder>(FindObjectsInactive.Include, FindObjectsSortMode.None))
                if (b.LandmarkRootCount == 0) builder = b;
            if (builder == null) { Fail("마을 꾸밈 빌더 없음"); return ""; }
            var centers = BuildTestDungeonScene.EraDecorTownCenters;
            int pieces = 0, maxTri = 0;
            for (int i = 0; i < DungeonEraDecor.Towns.Length; i++)
            {
                var set = DungeonEraDecor.Towns[i];
                var root = builder.transform.Find("EraDecor_" + set.Id);
                if (root == null) { Fail($"{set.Id} 꾸밈 없음"); continue; }
                if (i >= centers.Length || (root.position - centers[i]).sqrMagnitude > 0.01f) Fail($"{set.Id} 꾸밈 자리가 방 가운데가 아님");
                var room = GameObject.Find(set.Id);
                if (room == null || (room.transform.position - root.position).sqrMagnitude > 0.01f) Fail($"{set.Id} 방이 꾸밈 자리에 없음");

                // 같은 방 안의 다른 것 — 씬 뿌리 오브젝트 중 방 네모 안(방·꾸밈·복도·땅 조우 빼고).
                var others = new List<(string, Vector3)>();
                foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
                {
                    var t = go.transform;
                    if (t == builder.transform || (room != null && t == room.transform) || go.name.StartsWith("Corridor") || go.name.StartsWith("Minimap")) continue;
                    Vector3 d = t.position - root.position;
                    if (Mathf.Abs(d.x) < 9.9f && Mathf.Abs(d.z) < 9.9f) others.Add((go.name, t.position));
                }
                int tri = CheckSet(set, root, root.position, TownDoors.TryGetValue(set.Id, out var doors) ? doors : "", others, 1.0f);
                if (tri > TownTriBudget) Fail($"{set.Id} 삼각형 {tri} > {TownTriBudget}");
                maxTri = Mathf.Max(maxTri, tri);
                pieces += root.childCount;
                if (!root.gameObject.activeInHierarchy) Fail($"{set.Id} 꾸밈이 꺼져 있음");
            }
            return $" 마을 조각 {pieces}(최대 {maxTri / 1000}k)";
        }

        // ---- 명소 층 ---------------------------------------------------------------

        private static string CheckLandmarks(DungeonFloorRunner runner)
        {
            var builder = runner.GetComponentInChildren<EraDecorBuilder>(true);
            if (builder == null || builder.LandmarkRootCount != DungeonLandmarkData.All.Length) { Fail($"명소 꾸밈 빌더·벌 수({builder?.LandmarkRootCount})"); return ""; }

            // 방 안 자리(층 진행기 표 그대로 — 리플렉션으로 읽어 두 곳이 어긋나지 않게).
            var spots = new List<(string, Vector3)>();
            float soloR = 2.5f; // 층 주인(Demon × 2.1)은 넓게 비킨다
            foreach (var name in new[] { "GruntOffsets", "EscortOffsets", "DoorPodOffsets" })
                foreach (var v in (Vector3[])StaticField(name)) spots.Add((name, v));
            spots.Add(("PoiAnchor", (Vector3)StaticField("PoiAnchor")));
            spots.Add(("PlayerEntryOffset", (Vector3)StaticField("PlayerEntryOffset")));
            spots.Add(("BiomeDecor", new Vector3(-8f, 0f, 5f)));
            Vector3 solo = (Vector3)StaticField("SoloOffset");

            int maxTri = 0, pieces = 0;
            string sizes = "";
            for (int i = 0; i < DungeonLandmarkData.All.Length; i++)
            {
                runner.JumpToFloor(DungeonLandmarkData.All[i].Floor);
                if (runner.CurrentLandmark != i) Fail($"{DungeonLandmarkData.All[i].Floor}층이 명소 {i} 가 아님");
                for (int k = 0; k < builder.LandmarkRootCount; k++)
                    if (builder.LandmarkRoot(k).activeSelf != (k == i)) Fail($"{DungeonLandmarkData.All[i].Floor}층에 꾸밈 {k} 켜짐={builder.LandmarkRoot(k).activeSelf}");
                var root = builder.LandmarkRoot(i).transform;
                var worldSpots = new List<(string, Vector3)>();
                foreach (var s in spots) worldSpots.Add((s.Item1, runner.transform.TransformPoint(s.Item2)));
                int tri = CheckSet(DungeonEraDecor.Landmarks[i], root, runner.transform.position, "S", worldSpots, 1.2f);
                // 층 주인 자리는 더 넓게.
                foreach (Transform piece in root)
                    if (PieceRect(piece, out var r) && RectDist(r, runner.transform.TransformPoint(solo)) < soloR)
                        Fail($"{DungeonEraDecor.Landmarks[i].Id} {piece.name} 가 층 주인 자리와 가까움");
                if (tri > LandmarkTriBudget) Fail($"{DungeonEraDecor.Landmarks[i].Id} 삼각형 {tri} > {LandmarkTriBudget}");
                maxTri = Mathf.Max(maxTri, tri);
                pieces += root.childCount;
                if (i == 0) sizes = Sizes(root);
            }
            runner.JumpToFloor(6);
            for (int k = 0; k < builder.LandmarkRootCount; k++)
                if (builder.LandmarkRoot(k).activeSelf) Fail($"보통 층(6)에 명소 꾸밈 {k} 켜짐");
            return $" 명소 조각 {pieces}(최대 {maxTri / 1000}k) 왕릉 크기[{sizes}]";
        }

        private static object StaticField(string name)
        {
            var f = typeof(DungeonFloorRunner).GetField(name, BindingFlags.NonPublic | BindingFlags.Static);
            if (f == null) { Fail($"DungeonFloorRunner.{name} 없음"); return name.EndsWith("s") ? (object)new Vector3[0] : Vector3.zero; }
            return f.GetValue(null);
        }

        // ---- 한 벌 ------------------------------------------------------------------

        /// <summary>한 벌의 조각 검사. 돌려주는 값은 삼각형 합.</summary>
        private static int CheckSet(DungeonEraDecor.Set set, Transform root, Vector3 center, string doors,
            List<(string, Vector3)> others, float clearance)
        {
            if (root.childCount < set.Pieces.Length) Fail($"{set.Id} 조각 {root.childCount} < {set.Pieces.Length}(모델 빠짐)");
            int tri = 0;
            for (int i = 0; i < root.childCount && i < set.Pieces.Length; i++)
            {
                var piece = root.GetChild(i);
                var p = set.Pieces[i];
                string id = $"{set.Id} {piece.name}";
                foreach (var f in piece.GetComponentsInChildren<MeshFilter>(true))
                    if (f.sharedMesh != null)
                        for (int s = 0; s < f.sharedMesh.subMeshCount; s++) tri += (int)(f.sharedMesh.GetIndexCount(s) / 3);
                if (!PieceRect(piece, out var rect)) { Fail($"{id} 렌더러 없음"); continue; }
                _sizes.Add($"{set.Id}/{piece.name.Substring(3)} {rect.size.x:F1}×{rect.size.y:F1}×{rect.size.z:F1}");
                Vector3 lo = rect.min - center, hi = rect.max - center;

                // 벽 안.
                if (lo.x < -WallInner || hi.x > WallInner || lo.z < -WallInner || hi.z > WallInner)
                    Fail($"{id} 가 벽에 박힘 x[{lo.x:F1},{hi.x:F1}] z[{lo.z:F1},{hi.z:F1}]");
                // 문길.
                foreach (char d in doors)
                {
                    bool hit = d switch
                    {
                        'N' => hi.z > DoorDepth && lo.x < DoorHalf && hi.x > -DoorHalf,
                        'S' => lo.z < -DoorDepth && lo.x < DoorHalf && hi.x > -DoorHalf,
                        'E' => hi.x > DoorDepth && lo.z < DoorHalf && hi.z > -DoorHalf,
                        'W' => lo.x < -DoorDepth && lo.z < DoorHalf && hi.z > -DoorHalf,
                        _ => false,
                    };
                    if (hit) Fail($"{id} 가 {d} 문길을 막음");
                }
                // 다른 것 비킴(잔해는 머리 위라 문길·벽만 본다).
                if (p.Era != DungeonEra.Future)
                    foreach (var o in others)
                        if (RectDist(rect, o.Item2) < clearance) Fail($"{id} 가 {o.Item1} 와 {RectDist(rect, o.Item2):F1}m");

                bool hasCollider = piece.GetComponentInChildren<Collider>(true) != null;
                EraDecorBuilder.TryLowest(piece.gameObject, out float low);
                float top = rect.max.y - center.y;
                low -= center.y;
                if (p.Era == DungeonEra.Future)
                {
                    var spin = piece.GetComponent<EraRiftSpin>();
                    if (spin == null) Fail($"{id} 잔해가 안 돎");
                    if (hasCollider) Fail($"{id} 잔해에 충돌");
                    if (piece.gameObject.isStatic) Fail($"{id} 잔해가 정적");
                    if (low < DungeonEraDecor.RiftMinHover - 0.05f) Fail($"{id} 잔해 밑면 {low:F2} < {DungeonEraDecor.RiftMinHover}");
                    if (top > DungeonEraDecor.RiftMaxTop) Fail($"{id} 잔해 윗면 {top:F2} > {DungeonEraDecor.RiftMaxTop}");
                    float size = Mathf.Max(rect.size.x, rect.size.y, rect.size.z);
                    if (size < 0.8f || size > 2.4f) Fail($"{id} 잔해 크기 {size:F2}m(0.8~2.4)");
                    foreach (var r in piece.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var mat in r.sharedMaterials)
                            if (mat == null || !mat.name.EndsWith("_rift") || mat.shader == null || mat.shader.name != "Saga/CelToon" || mat.GetFloat("_RimStrength") < 1f) Fail( /* U-0066 툰 + 하늘색 림 */$"{id} 잔해 재질 {mat?.name}");
                    if (spin != null)
                    {
                        // 돌아도 밑면이 그대로 — 10초 뒤 자리로 돌려 다시 잰다.
                        var keep = piece.localRotation;
                        piece.localRotation = EraRiftSpin.RotationAt(spin.BaseRotation, 0f, 10f);
                        EraDecorBuilder.TryLowest(piece.gameObject, out float low2);
                        piece.localRotation = keep;
                        if (Mathf.Abs(low2 - center.y - low) > 0.02f) Fail($"{id} 돌면 밑면이 {low:F2}→{low2 - center.y:F2}");
                    }
                }
                else
                {
                    float want = p.Y - p.Sink;
                    if (Mathf.Abs(low - want) > 0.05f) Fail($"{id} 밑면 {low:F2} ≠ {want:F2}");
                    if (p.Collide != hasCollider) Fail($"{id} 충돌 {hasCollider} ≠ 표 {p.Collide}");
                    foreach (var r in piece.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var mat in r.sharedMaterials)
                            if (mat != null && mat.name.EndsWith("_rift")) Fail($"{id} 옛·현대 조각에 잔해 재질");
                    float size = Mathf.Max(rect.size.x, rect.size.y, rect.size.z);
                    if (size > 4.6f) Fail($"{id} 크기 {size:F2}m 가 방에 너무 큼");
                }
            }
            return tri;
        }

        private static bool PieceRect(Transform piece, out Bounds rect)
        {
            rect = default;
            bool any = false;
            foreach (var r in piece.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { rect = r.bounds; any = true; }
                else rect.Encapsulate(r.bounds);
            }
            return any;
        }

        /// <summary>점에서 조각 경계 상자(수평)까지 거리.</summary>
        private static float RectDist(Bounds b, Vector3 p)
        {
            float dx = Mathf.Max(0f, Mathf.Max(b.min.x - p.x, p.x - b.max.x));
            float dz = Mathf.Max(0f, Mathf.Max(b.min.z - p.z, p.z - b.max.z));
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        private static string Sizes(Transform root)
        {
            var parts = new List<string>();
            foreach (Transform piece in root)
                if (PieceRect(piece, out var r)) parts.Add($"{piece.name.Substring(3)} {r.size.x:F1}×{r.size.y:F1}×{r.size.z:F1}");
            return string.Join(", ", parts);
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
