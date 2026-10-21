using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 108 ① "지역 전용 소품 묶음" 진단 — `PlaytestHeadless` 가 식생 진단 뒤에 부른다(읽기만, 씬·세이브 안 바꾼다).
    /// 표(마을 빼고 여섯 지역 모두 무더기 · 조각이 제 지역·걷는 칸 안 · 길·다리 칸 아님 · 강 무더기는 강 칸) ·
    /// 비킴(상자·역참·무리·수호장 한가운데 12m · 채집·NPC·조우·석등·짐승 7m · 비탈 10m) · 세운 것(조각 수 = 표, 모델 다 찾음 ·
    /// 밑면 = 땅 + Y − 묻음 · 땅 광선이 그 높이 · 강 바위는 물 위로, 통나무는 물에 걸침 · 충돌 = 표 · 그을림 재질 ·
    /// LOD 둘(가벼운 메시가 원본 재질) · 불빛 둘·그림자 없음·깜빡임 공식 · 정적 표시).
    /// </summary>
    public static class PlaytestGoRegionProps
    {
        private static string _tag;
        private static bool _ok;

        public const float KeyClearance = 12f;
        public const float ObjectClearance = 7f;
        public const float RampClearance = 10f;
        /// <summary>무더기 하나를 전부 원본(LOD0)으로 볼 때 삼각형 상한 — 폰에서 한 자리에 몰리지 않게.</summary>
        public const long MaxClusterTris = 350000;

        private static readonly HashSet<string> Interactive = new HashSet<string>
        {
            "Gatherable", "TreasureChest", "WaypointStone", "ElementTorch", "BanditEncounter", "RareWolfEncounter",
            "HiddenTreasure", "MountainShrine", "ShrineTrialEncounter", "EastGroveRelic", "LuckyCairn", "BeaconTower",
            "Watchtower", "VillagerTalk", // 짐승(WanderingAnimal)은 돌아다녀 자리가 매번 달라 뺀다
        };

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            CheckTable();
            var builder = Object.FindFirstObjectByType<RegionPropsBuilder>();
            if (builder == null) { Fail("RegionPropsBuilder 없음(씬 재빌드?)"); return false; }
            string m = CheckBuilt(builder);
            CheckClearance(builder);
            CheckFlicker();
            if (_ok) Debug.Log($"[{_tag}] regionProps OK - 여섯 지역 무더기·제 지역·걷는 칸·비킴(요지·물건·비탈)·조각 수·밑면·땅 광선·강 물높이·충돌·그을림·LOD·불빛·정적 |{m}");
            return _ok;
        }

        private static void CheckTable()
        {
            var covered = new HashSet<string>();
            var ids = new HashSet<string>();
            foreach (var c in GoRegionProps.Clusters)
            {
                if (!ids.Add(c.Id)) Fail($"무더기 id 겹침 {c.Id}");
                covered.Add(c.RegionId);
                if (GoWorldMap.RegionAt(GoRegionProps.Center(c)) != c.RegionId) Fail($"{c.Id} 가운데가 {GoWorldMap.RegionAt(GoRegionProps.Center(c))} — 표는 {c.RegionId}");
                if (c.Pieces == null || c.Pieces.Length == 0) Fail($"{c.Id} 조각 없음");
                if (c.InRiver && c.Clearing > 0f) Fail($"{c.Id} 강 무더기에 빈터");
                foreach (var p in c.Pieces)
                {
                    Vector3 at = GoRegionProps.Center(c) + new Vector3(p.X, 0f, p.Z);
                    var (gx, gy) = TestMapData.WorldToGrid(at);
                    char ch = TestMapData.TileAt(gx, gy);
                    if (GoWorldMap.RegionAt(at) != c.RegionId) Fail($"{c.Id} 조각 {p.Model} 이 {GoWorldMap.RegionAt(at)} 로 넘어감");
                    if (c.InRiver) { if (ch != '~') Fail($"{c.Id} 조각 {p.Model} 이 강 칸 아님({ch})"); continue; }
                    if (ch == '=' || ch == 'B' || !TestMapData.Legend.TryGetValue(ch, out var info) || !info.Walkable)
                        Fail($"{c.Id} 조각 {p.Model} 이 {ch} 칸 ({gx},{gy})");
                }
            }
            foreach (var r in GoWorldMap.Regions)
                if (r.Id != "village" && !covered.Contains(r.Id)) Fail($"{r.Id} 에 지역 소품 무더기가 없다");
        }

        private static string CheckBuilt(RegionPropsBuilder builder)
        {
            int pieces = 0, lodPieces = 0, lights = 0;
            long tris0 = 0, tris1 = 0, heaviest = 0;
            string heaviestId = "";
            foreach (var c in GoRegionProps.Clusters)
            {
                var root = builder.transform.Find("RegionProps_" + c.Id);
                if (root == null) { Fail($"{c.Id} 무더기가 씬에 없다"); continue; }
                float baseY = GoRegionProps.BaseHeight(c);
                if (Mathf.Abs(root.position.y - baseY) > 0.01f) Fail($"{c.Id} 밑 높이 {root.position.y} ≠ {baseY}");
                var list = new List<Transform>();
                foreach (Transform t in root) if (t.GetComponent<Light>() == null) list.Add(t);
                long clusterTris = 0;
                if (list.Count != c.Pieces.Length) { Fail($"{c.Id} 조각 {list.Count} ≠ 표 {c.Pieces.Length}(모델 못 찾음?)"); continue; }
                for (int i = 0; i < list.Count; i++)
                {
                    var p = c.Pieces[i];
                    var go = list[i].gameObject;
                    pieces++;
                    if (!RegionPropsBuilderBounds(go, out var b)) { Fail($"{c.Id} {go.name} 렌더러 없음"); continue; }
                    float want = root.position.y + p.Y - p.Sink;
                    // 밑면은 빌더와 같이 꼭짓점 최저점(U-0151 — 기울인 두꺼운 짝 방패는 렌더러 상자가 0.05~0.4m 헐겁다)
                    float low = RegionPropsBuilder.TryLowest(go, out float lv) ? lv : b.min.y;
                    if (Mathf.Abs(low - want) > 0.05f) Fail($"{c.Id} {go.name} 밑면 {low:F2} ≠ {want:F2}");
                    if (!c.InRiver && p.Y == 0f) CheckGroundRay(c, go, b, root.position.y);
                    if (c.InRiver && p.Era != GoEra.Future) // 109-1b 시간 틈 잔해는 물 위에 떠 있다(PlaytestGoEras 가 본다)
                    {
                        bool rock = p.Model.Contains("#rock");
                        if (rock && b.max.y < TestMapData.WaterSurfaceHeight + 0.3f) Fail($"{c.Id} {go.name} 바위가 물에 잠김(꼭대기 {b.max.y:F2})");
                        if (!rock && !(b.min.y < TestMapData.WaterSurfaceHeight && b.max.y > TestMapData.WaterSurfaceHeight)) Fail($"{c.Id} {go.name} 통나무가 물에 안 걸침({b.min.y:F2}~{b.max.y:F2})");
                    }
                    var lod0 = go.transform.Find("LOD0");
                    var lod1 = go.transform.Find("LOD1");
                    var colliders = go.GetComponentsInChildren<Collider>(true);
                    if (p.Collide && colliders.Length == 0) Fail($"{c.Id} {go.name} 충돌 없음");
                    if (!p.Collide && colliders.Length > 0) Fail($"{c.Id} {go.name} 밟고 지나갈 조각에 충돌");
                    if (lod1 != null && lod1.GetComponentInChildren<Collider>(true) != null) Fail($"{c.Id} {go.name} LOD1 에 충돌(겹침)");
                    foreach (var r in go.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var mat in r.sharedMaterials)
                        {
                            if (mat == null) { Fail($"{c.Id} {go.name}/{r.name} 재질 빔"); continue; }
                            if (p.Charred != mat.name.EndsWith("_charred")) Fail($"{c.Id} {go.name} 그을림 {p.Charred} 인데 재질 {mat.name}");
                        }
                    if (lod1 != null)
                    {
                        lodPieces++;
                        var group = go.GetComponent<LODGroup>();
                        if (group == null || group.lodCount != 2) Fail($"{c.Id} {go.name} LODGroup 둘 아님");
                        tris1 += Tris(lod1);
                    }
                    long near = Tris(lod0 != null ? lod0 : go.transform);
                    tris0 += near;
                    clusterTris += near;
                    if (p.Era != GoEra.Future) // 109-1b 떠서 도는 조각은 정적이 아니다(PlaytestGoEras 가 본다)
                    foreach (Transform t in go.GetComponentsInChildren<Transform>(true))
                    {
                        var f = t.GetComponent<MeshFilter>();
                        bool multi = f != null && f.sharedMesh != null && f.sharedMesh.subMeshCount > 1;
                        if (!multi && !t.gameObject.isStatic) { Fail($"{c.Id} {t.name} 정적 표시 안 됨"); break; }
                    }
                }
                if (clusterTris > heaviest) { heaviest = clusterTris; heaviestId = c.Id; }
                if (clusterTris > MaxClusterTris) Fail($"{c.Id} 곁에 서면 삼각형 {clusterTris / 1000}k > {MaxClusterTris / 1000}k(폰)");
                var glow = root.GetComponentsInChildren<Light>(true);
                lights += glow.Length;
                if ((c.Light != GoRegionProps.Glow.None) != (glow.Length == 1)) Fail($"{c.Id} 불빛 {glow.Length} — 표 {c.Light}");
                foreach (var l in glow)
                {
                    if (l.shadows != LightShadows.None) Fail($"{c.Id} 불빛 그림자 켜짐(폰 추가 조명 그림자 끔)");
                    if (l.GetComponent<PropFlicker>() == null) Fail($"{c.Id} 불빛에 깜빡임 없음");
                }
            }
            if (lights != 2) Fail($"지역 소품 불빛 {lights} ≠ 2");
            if (lodPieces == 0) Fail("LOD 붙은 조각이 없다(tools/polyhaven_lod1.py 산출물?)");
            return $" 무더기 {GoRegionProps.Clusters.Length}·조각 {pieces}(LOD {lodPieces})·삼각형 가까이 {tris0 / 1000}k·멀리 {(tris0 - Tris0OfLod(builder) + tris1) / 1000}k·가장 무거운 무더기 {heaviestId} {heaviest / 1000}k·불빛 {lights}";
        }

        // 멀리 볼 때 삼각형 = LOD 없는 조각의 원본 + LOD 조각의 LOD1.
        private static long Tris0OfLod(RegionPropsBuilder builder)
        {
            long t = 0;
            foreach (var g in builder.GetComponentsInChildren<LODGroup>(true))
            {
                var lod0 = g.transform.Find("LOD0");
                if (lod0 != null) t += Tris(lod0);
            }
            return t;
        }

        /// <summary>정적 배칭 뒤엔 메시가 씬 전체 합친 메시라 — 그 렌더러가 쓰는 서브메시 구간만 센다.</summary>
        private static long Tris(Transform t)
        {
            long n = 0;
            foreach (var r in t.GetComponentsInChildren<MeshRenderer>(true))
            {
                var f = r.GetComponent<MeshFilter>();
                if (f == null || f.sharedMesh == null) continue;
                int start = r.isPartOfStaticBatch ? r.subMeshStartIndex : 0;
                int count = r.isPartOfStaticBatch ? r.sharedMaterials.Length : f.sharedMesh.subMeshCount;
                for (int s = start; s < start + count && s < f.sharedMesh.subMeshCount; s++) n += (long)f.sharedMesh.GetIndexCount(s) / 3;
            }
            return n;
        }

        private static bool RegionPropsBuilderBounds(GameObject go, out Bounds b)
        {
            b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            return any;
        }

        /// <summary>조각 밑 가운데로 위에서 쏜 광선이 소품 말고 처음 닿는 땅 — 칸 높이와 같아야 한다(가장자리 비탈·절벽에 안 걸침).</summary>
        private static void CheckGroundRay(GoRegionProps.Cluster c, GameObject go, Bounds b, float ground)
        {
            Vector3 from = new Vector3(b.center.x, ground + 8f, b.center.z);
            var hits = Physics.RaycastAll(from, Vector3.down, 20f, ~0, QueryTriggerInteraction.Ignore);
            float best = float.NegativeInfinity;
            foreach (var h in hits)
            {
                if (h.collider.GetComponentInParent<RegionPropsBuilder>() != null) continue;
                if (h.collider.attachedRigidbody != null || h.collider is CapsuleCollider || h.collider is CharacterController) continue; // 사람·짐승·나무 몸통
                if (h.point.y > best) best = h.point.y;
            }
            if (float.IsNegativeInfinity(best)) { Fail($"{c.Id} {go.name} 밑에 땅 충돌이 없다"); return; }
            if (Mathf.Abs(best - ground) > 0.4f) Fail($"{c.Id} {go.name} 밑 땅 {best:F2} ≠ 칸 높이 {ground:F2}(비탈·절벽 걸침?)");
        }

        private static void CheckClearance(RegionPropsBuilder builder)
        {
            var keys = VegetationBuilder.KeyPoints();
            var objects = new List<(string, Vector3)>();
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                if (Interactive.Contains(mb.GetType().Name)) objects.Add((mb.GetType().Name + ":" + mb.name, mb.transform.position));
            if (objects.Count < 10) Fail($"비킬 물건이 {objects.Count} 개뿐 — 이름표가 낡았나");
            var ramps = new List<Vector3>();
            foreach (var r in TestMapData.Ramps)
            {
                TestMapData.RampGeometry(r, out var bottom, out var top, out _, out _);
                ramps.Add(bottom); ramps.Add(top);
            }
            foreach (var c in GoRegionProps.Clusters)
            {
                Vector3 center = GoRegionProps.Center(c);
                foreach (var k in keys)
                    if (Flat(k - center) < KeyClearance) Fail($"{c.Id} 가 요지(상자·역참·무리) {k} 에서 {Flat(k - center):F1}m");
                foreach (var p in c.Pieces)
                {
                    Vector3 at = center + new Vector3(p.X, 0f, p.Z);
                    foreach (var (name, pos) in objects)
                        if (Flat(pos - at) < ObjectClearance) Fail($"{c.Id} 조각 {p.Model} 이 {name} 에서 {Flat(pos - at):F1}m");
                    foreach (var r in ramps)
                        if (Flat(r - at) < RampClearance) Fail($"{c.Id} 조각 {p.Model} 이 비탈 끝에서 {Flat(r - at):F1}m");
                }
            }
        }

        private static void CheckFlicker()
        {
            const float b = 0.25f;
            if (!Mathf.Approximately(PropFlicker.Intensity(PropFlicker.Mode.Spark, b, 0.01f), PropFlicker.SparkPeak)) Fail("벼락 번쩍임 첫 박자가 최고가 아님");
            if (!Mathf.Approximately(PropFlicker.Intensity(PropFlicker.Mode.Spark, b, 1f), b)) Fail("벼락 불빛이 평소에 안 희미함");
            if (!Mathf.Approximately(PropFlicker.Intensity(PropFlicker.Mode.Spark, b, PropFlicker.SparkPeriod + 0.01f), PropFlicker.SparkPeak)) Fail("벼락 번쩍임 주기");
            for (float t = 0f; t < 10f; t += 0.37f)
            {
                float f = PropFlicker.Intensity(PropFlicker.Mode.Fire, 2f, t) / 2f;
                if (f < 0.8f || f > 1.14f) { Fail($"모닥불 일렁임 {f:F2} 범위 밖"); break; }
            }
        }

        private static float Flat(Vector3 v) => new Vector2(v.x, v.z).magnitude;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] regionProps FAIL - {msg}");
        }
    }
}
