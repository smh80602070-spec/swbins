using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0109 2나락 벽 상자 = 면마다 미터 UV(`MetricBox`) 진단 — `PlaytestDungeonHeadless` 가 잡졸 명단(foes) 뒤에 부른다(한 프레임 안).
    /// ① `MetricBox.Get((6,4,0.3))` 윗면 UV 폭 (3, 0.15)·옆면 (3, 2)·끝면 (0.15, 2)(±1e-3) · 같은 크기 두 번 = 같은 메시 · 24정점·36색인.
    /// ② 씬의 PBR 방·복도 빌더의 `Wall_*` 렌더러(아치 `_Gate` 제외) 전부 메시 이름 `MetricBox`·단위 상자(정적 배칭에 든 벽은 합친 메시의 그 벽 윗면 UV 폭 = 월드 m/2)·재질 `mainTextureScale` (1,1) — 0개면 실패(PBR 빌더가 없으면 "건너뜀").
    /// ③ 방마다 `SetWearTier` 로 마모 단계를 바꾼 뒤에도 ② — 끝나면 원래 단계로 되돌린다. 정적 배칭에 든 벽 수는 기록만 한다.
    /// ④ U-0112 — 같은 빌더의 `Floor`·`Ceiling` 판(두께 1m)도 ②·③ 과 같이(`CheckSlabs` — 배칭됐으면 윗면·옆면 +X·+Z 의 합친 메시 UV 폭) — `slabs OK` 줄.
    /// </summary>
    public static class PlaytestDungeonWalls
    {
        private const string T = "[PlaytestDungeonHeadless] walls";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            try
            {
                CheckMesh();
                var rooms = Object.FindObjectsByType<DungeonRoomBuilder>(FindObjectsInactive.Include, FindObjectsSortMode.None);
                var corrs = Object.FindObjectsByType<DungeonCorridorBuilder>(FindObjectsInactive.Include, FindObjectsSortMode.None);
                int pbr = 0;
                foreach (var r in rooms) if (r.UsesPbrEnvironment) pbr++;
                foreach (var c in corrs) if (c.UsesPbrEnvironment) pbr++;
                if (pbr == 0)
                {
                    Debug.Log($"{T} 건너뜀 - PBR 방·복도 없음(아틀라스 경로, 방 {rooms.Length}·복도 {corrs.Length}) · MetricBox 메시 OK");
                    return _ok;
                }
                var (walls, batched) = CheckWalls(rooms, corrs, "처음");
                var (slabs, slabsBatched) = CheckSlabs(rooms, corrs, "처음");

                // ③ 마모 단계 바꿈 → 다시 확인 → 되돌림
                var orig = new Dictionary<DungeonRoomBuilder, int>();
                foreach (var r in rooms) if (r.UsesPbrEnvironment) { orig[r] = r.WearTier; r.SetWearTier(r.WearTier == 2 ? 1 : 2); }
                try
                {
                    foreach (var kv in orig) if (kv.Key.WearTier == kv.Value) Fail($"{kv.Key.name} 마모 단계가 안 바뀜({kv.Value})");
                    CheckWalls(rooms, corrs, "마모 뒤");
                    CheckSlabs(rooms, corrs, "마모 뒤");
                }
                finally
                {
                    foreach (var kv in orig) kv.Key.SetWearTier(kv.Value);
                }
                if (_ok) Debug.Log($"{T} OK - MetricBox 윗면 (3,0.15)·옆면 (3,2)·끝면 (0.15,2)·캐시 같음 · PBR 빌더 {pbr}(방 {orig.Count}) 벽 {walls} 전부 MetricBox 면 UV(배칭된 벽은 합친 메시 윗면)·반복 (1,1) · 마모 바꾼 뒤도 같음 · 정적 배칭에 든 벽 {batched}");
                if (_ok) Debug.Log($"{T} slabs OK - 천장·바닥 판 {slabs} 전부 MetricBox 면 UV(배칭된 판 {slabsBatched} 은 합친 메시의 윗면·옆면 +X·+Z UV 폭 = 월드 m/2)·반복 (1,1) · 마모 바꾼 뒤도 같음");
            }
            catch (System.Exception e)
            {
                Fail($"예외 {e.GetType().Name}: {e.Message}");
            }
            return _ok;
        }

        private static void CheckMesh()
        {
            var size = new Vector3(6f, 4f, 0.3f);
            var m = MetricBox.Get(size);
            if (m == null || m.name != MetricBox.MeshName) { Fail("MetricBox 메시 없음·이름 틀림"); return; }
            if (m.vertexCount != 24 || m.triangles.Length != 36) Fail($"정점 {m.vertexCount}·색인 {m.triangles.Length} ≠ 24·36");
            if (!ReferenceEquals(MetricBox.Get(size), m)) Fail("같은 크기 두 번 = 다른 메시(캐시 안 됨)");
            if ((m.bounds.size - Vector3.one).sqrMagnitude > 1e-6f) Fail($"단위 상자 아님 {m.bounds.size}");
            Face(m, Vector3.up, new Vector2(3f, 0.15f), "윗면");
            Face(m, Vector3.down, new Vector2(3f, 0.15f), "밑면");
            Face(m, Vector3.forward, new Vector2(3f, 2f), "옆면+Z");
            Face(m, Vector3.back, new Vector2(3f, 2f), "옆면-Z");
            Face(m, Vector3.right, new Vector2(0.15f, 2f), "끝면+X");
            Face(m, Vector3.left, new Vector2(0.15f, 2f), "끝면-X");
        }

        /// <summary>노멀이 n 인 정점 넷의 UV 폭(최대−최소)이 want 인지 + 감기가 바깥을 향하는지.</summary>
        private static void Face(Mesh m, Vector3 n, Vector2 want, string label)
        {
            var nor = m.normals; var uv = m.uv; var v = m.vertices; var tri = m.triangles;
            Vector2 lo = new Vector2(float.MaxValue, float.MaxValue), hi = new Vector2(float.MinValue, float.MinValue);
            int count = 0;
            for (int i = 0; i < nor.Length; i++)
            {
                if (Vector3.Dot(nor[i], n) < 0.99f) continue;
                count++; lo = Vector2.Min(lo, uv[i]); hi = Vector2.Max(hi, uv[i]);
            }
            var span = hi - lo;
            if (count != 4) { Fail($"{label} 정점 {count} ≠ 4"); return; }
            if (Mathf.Abs(span.x - want.x) > 1e-3f || Mathf.Abs(span.y - want.y) > 1e-3f) Fail($"{label} UV 폭 {span.x:0.###},{span.y:0.###} ≠ {want.x},{want.y}");
            for (int t = 0; t < tri.Length; t += 3)
            {
                if (Vector3.Dot(nor[tri[t]], n) < 0.99f) continue;
                // Unity 앞면 = 밖에서 볼 때 시계 방향 → cross(b−a, c−a) 가 노멀 쪽
                var c = Vector3.Cross(v[tri[t + 1]] - v[tri[t]], v[tri[t + 2]] - v[tri[t]]);
                if (Vector3.Dot(c, n) <= 0f) { Fail($"{label} 삼각형 감기가 안쪽"); return; }
            }
        }

        private static (int walls, int batched) CheckWalls(DungeonRoomBuilder[] rooms, DungeonCorridorBuilder[] corrs, string when)
        {
            int walls = 0, batched = 0, bad = 0;
            var roots = new List<Transform>();
            foreach (var r in rooms) if (r.UsesPbrEnvironment) roots.Add(r.transform);
            foreach (var c in corrs) if (c.UsesPbrEnvironment) roots.Add(c.transform);
            foreach (var root in roots)
            {
                foreach (Transform child in root)
                {
                    if (!child.name.StartsWith("Wall_") || child.name.EndsWith("_Gate")) continue;
                    var mr = child.GetComponent<MeshRenderer>();
                    var mf = child.GetComponent<MeshFilter>();
                    if (mr == null || mf == null) continue;
                    walls++;
                    if (mr.isPartOfStaticBatch) batched++;
                    var mesh = mf.sharedMesh;
                    var mat = mr.sharedMaterial;
                    string why = null;
                    if (mr.isPartOfStaticBatch) why = BatchedTop(mr, mesh); // 합친 메시에선 이 벽 윗면 네 점의 UV 로 본다
                    else if (mesh == null || mesh.name != MetricBox.MeshName) why = $"메시 {(mesh == null ? "없음" : mesh.name)}";
                    else if ((mesh.bounds.size - Vector3.one).sqrMagnitude > 1e-6f) why = $"메시 크기 {mesh.bounds.size}";
                    if (why == null && (mat == null || (mat.mainTextureScale - Vector2.one).sqrMagnitude > 1e-6f)) why =$"반복 {(mat == null ? "재질 없음" : mat.mainTextureScale.ToString("F3"))}";
                    if (why != null && bad++ < 5) Fail($"{when} {root.name}/{child.name} {why}");
                }
            }
            if (walls == 0) Fail($"{when} PBR 빌더 {roots.Count} 인데 Wall_ 렌더러 0");
            if (bad > 5) Fail($"{when} 틀린 벽 모두 {bad}");
            return (walls, batched);
        }

        /// <summary>U-0112 — PBR 빌더의 `Floor`·`Ceiling` 판(두께 1m) 전부: 배칭 전이면 메시 `MetricBox`·단위 상자, 배칭됐으면 합친 메시에서
        /// 윗면(+Y)·옆면(+X·+Z — 가장 얇은 축 y 를 낀 면) UV 폭 = 월드 m / TileMeters · 재질 반복 (1,1). 0개면 실패.</summary>
        private static (int slabs, int batched) CheckSlabs(DungeonRoomBuilder[] rooms, DungeonCorridorBuilder[] corrs, string when)
        {
            int slabs = 0, batched = 0, bad = 0;
            var roots = new List<Transform>();
            foreach (var r in rooms) if (r.UsesPbrEnvironment) roots.Add(r.transform);
            foreach (var c in corrs) if (c.UsesPbrEnvironment) roots.Add(c.transform);
            foreach (var root in roots)
            {
                foreach (Transform child in root)
                {
                    if (child.name != "Floor" && child.name != "Ceiling") continue;
                    var mr = child.GetComponent<MeshRenderer>();
                    var mf = child.GetComponent<MeshFilter>();
                    if (mr == null || mf == null) continue;
                    slabs++;
                    var mesh = mf.sharedMesh;
                    var mat = mr.sharedMaterial;
                    string why = null;
                    if (mr.isPartOfStaticBatch)
                    {
                        batched++;
                        why = BatchedFace(mr, mesh, 1, "윗면") ?? BatchedFace(mr, mesh, 0, "옆면+X") ?? BatchedFace(mr, mesh, 2, "옆면+Z");
                    }
                    else if (mesh == null || mesh.name != MetricBox.MeshName) why = $"메시 {(mesh == null ? "없음" : mesh.name)}";
                    else if ((mesh.bounds.size - Vector3.one).sqrMagnitude > 1e-6f) why = $"메시 크기 {mesh.bounds.size}";
                    if (why == null && child.name == "Ceiling" && mr.shadowCastingMode != UnityEngine.Rendering.ShadowCastingMode.ShadowsOnly) why = $"천장이 보임 {mr.shadowCastingMode}(U-0191 — 카메라가 천장 위라 윗면만 보인다)";
                    if (why == null && (mat == null || (mat.mainTextureScale - Vector2.one).sqrMagnitude > 1e-6f)) why = $"반복 {(mat == null ? "재질 없음" : mat.mainTextureScale.ToString("F3"))}";
                    if (why != null && bad++ < 5) Fail($"{when} {root.name}/{child.name} {why}");
                }
            }
            // U-0191 — PBR 아닌 방·복도 천장도 그림자만
            var all = new List<Transform>();
            foreach (var r in rooms) all.Add(r.transform);
            foreach (var c in corrs) all.Add(c.transform);
            foreach (var root in all)
            {
                var ce = root.Find("Ceiling");
                var cr = ce != null ? ce.GetComponent<MeshRenderer>() : null;
                if (cr != null && cr.shadowCastingMode != UnityEngine.Rendering.ShadowCastingMode.ShadowsOnly && bad++ < 5) Fail($"{when} {root.name}/Ceiling 천장이 보임 {cr.shadowCastingMode}(U-0191)");
            }
            if (slabs == 0) Fail($"{when} PBR 빌더 {roots.Count} 인데 Floor·Ceiling 렌더러 0");
            if (bad > 5) Fail($"{when} 틀린 판 모두 {bad}");
            return (slabs, batched);
        }

        private static readonly Dictionary<Mesh, (Vector3[] v, Vector3[] n, Vector2[] uv, int[] t)> Combined = new Dictionary<Mesh, (Vector3[], Vector3[], Vector2[], int[])>();

        /// <summary>정적 배칭에 든 벽 — 합친 메시(씬 뿌리 = 월드 좌표)에서 이 렌더러 경계 맨 위, 무게중심이 경계 안쪽인
        /// 위쪽 노멀 삼각형(= 이 벽 윗면)을 찾아 UV 폭 = 그 점들의 월드 가로·세로 m / TileMeters 인지 본다
        /// (기본 Cube 였다면 (1,1) — 얇은 윗면이 눌린다). 모서리에 닿은 옆 벽 윗면은 무게중심이 밖이라 빠진다. 맞으면 null.</summary>
        private static string BatchedTop(MeshRenderer mr, Mesh mesh)
        {
            if (mesh == null) return "합친 메시 없음";
            if (!Combined.TryGetValue(mesh, out var c)) { c = (mesh.vertices, mesh.normals, mesh.uv, mesh.triangles); Combined[mesh] = c; }
            var b = mr.bounds;
            Vector3 lo = new Vector3(float.MaxValue, 0f, float.MaxValue), hi = new Vector3(float.MinValue, 0f, float.MinValue);
            Vector2 ulo = new Vector2(float.MaxValue, float.MaxValue), uhi = new Vector2(float.MinValue, float.MinValue);
            int tris = 0;
            for (int t = 0; t < c.t.Length; t += 3)
            {
                int i0 = c.t[t], i1 = c.t[t + 1], i2 = c.t[t + 2];
                var g = (c.v[i0] + c.v[i1] + c.v[i2]) / 3f;
                if (Mathf.Abs(g.y - b.max.y) > 0.01f || g.x <= b.min.x + 0.01f || g.x >= b.max.x - 0.01f || g.z <= b.min.z + 0.01f || g.z >= b.max.z - 0.01f) continue;
                if (c.n[i0].y < 0.99f || c.n[i1].y < 0.99f || c.n[i2].y < 0.99f) continue;
                tris++;
                foreach (int i in new[] { i0, i1, i2 })
                {
                    lo = Vector3.Min(lo, c.v[i]); hi = Vector3.Max(hi, c.v[i]);
                    ulo = Vector2.Min(ulo, c.uv[i]); uhi = Vector2.Max(uhi, c.uv[i]);
                }
            }
            if (tris < 2) return $"합친 메시 {mesh.name} 에 윗면 삼각형 {tris}";
            var ext = hi - lo; var span = uhi - ulo;
            float a = Mathf.Max(ext.x, ext.z) / EnvironmentMaterial.TileMeters, d = Mathf.Min(ext.x, ext.z) / EnvironmentMaterial.TileMeters;
            float su = Mathf.Max(span.x, span.y), sv = Mathf.Min(span.x, span.y);
            if (Mathf.Abs(su - a) > 0.01f || Mathf.Abs(sv - d) > 0.01f) return $"합친 메시 윗면 UV 폭 {su:0.###},{sv:0.###} ≠ {a:0.###},{d:0.###}(삼각형 {tris})";
            return null;
        }

        /// <summary>U-0112 — `BatchedTop` 을 축 하나로 넓힘: 합친 메시에서 이 렌더러 경계의 +axis 면 평면 위, 무게중심이 나머지 두 축 경계 안쪽이고
        /// 노멀이 +axis 인 삼각형(= 이 판의 그 면)을 찾아 UV 폭 = 그 점들의 월드 두 축 m / TileMeters(큰 쪽끼리·작은 쪽끼리) 인지. 맞으면 null.</summary>
        private static string BatchedFace(MeshRenderer mr, Mesh mesh, int axis, string label)
        {
            if (mesh == null) return "합친 메시 없음";
            if (!Combined.TryGetValue(mesh, out var c)) { c = (mesh.vertices, mesh.normals, mesh.uv, mesh.triangles); Combined[mesh] = c; }
            var b = mr.bounds;
            int o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
            float lo1 = float.MaxValue, hi1 = float.MinValue, lo2 = float.MaxValue, hi2 = float.MinValue;
            Vector2 ulo = new Vector2(float.MaxValue, float.MaxValue), uhi = new Vector2(float.MinValue, float.MinValue);
            int tris = 0;
            for (int t = 0; t < c.t.Length; t += 3)
            {
                int i0 = c.t[t], i1 = c.t[t + 1], i2 = c.t[t + 2];
                var g = (c.v[i0] + c.v[i1] + c.v[i2]) / 3f;
                if (Mathf.Abs(g[axis] - b.max[axis]) > 0.01f) continue;
                if (g[o1] <= b.min[o1] + 0.01f || g[o1] >= b.max[o1] - 0.01f || g[o2] <= b.min[o2] + 0.01f || g[o2] >= b.max[o2] - 0.01f) continue;
                if (c.n[i0][axis] < 0.99f || c.n[i1][axis] < 0.99f || c.n[i2][axis] < 0.99f) continue;
                tris++;
                foreach (int i in new[] { i0, i1, i2 })
                {
                    lo1 = Mathf.Min(lo1, c.v[i][o1]); hi1 = Mathf.Max(hi1, c.v[i][o1]);
                    lo2 = Mathf.Min(lo2, c.v[i][o2]); hi2 = Mathf.Max(hi2, c.v[i][o2]);
                    ulo = Vector2.Min(ulo, c.uv[i]); uhi = Vector2.Max(uhi, c.uv[i]);
                }
            }
            if (tris < 2) return $"합친 메시 {mesh.name} 에 {label} 삼각형 {tris}";
            float e1 = (hi1 - lo1) / EnvironmentMaterial.TileMeters, e2 = (hi2 - lo2) / EnvironmentMaterial.TileMeters;
            float a = Mathf.Max(e1, e2), d = Mathf.Min(e1, e2);
            var span = uhi - ulo;
            float su = Mathf.Max(span.x, span.y), sv = Mathf.Min(span.x, span.y);
            if (Mathf.Abs(su - a) > 0.01f || Mathf.Abs(sv - d) > 0.01f) return $"합친 메시 {label} UV 폭 {su:0.###},{sv:0.###} ≠ {a:0.###},{d:0.###}(삼각형 {tris})";
            return null;
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
