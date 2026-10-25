using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0234 판별 폰 예산 — 대표 자리마다 「카메라 절두체 안 켜진 렌더러 수」·「삼각형」 상한. 넘으면 진단 FAIL(재기만 — 고치는 건 다음 R-0).
    /// 상한 = 10-25 잰 값 ×1.15(근거 표는 tasks/unity/done/U-0234.md 메모). 화질은 안 깎는다 — 이 표는 늘어나는 낭비를 잡는 줄.
    /// LODGroup 은 지금 거리에서 고를 단계 하나만 센다(멀면 꺼진 단계 포함 안 함). 입자·UI 는 뺌.
    /// 손잡이 `SAGA_PERF_BUDGET_SCALE`(상한 배율 — 0.5 면 틀이 진짜 잡는지 시험).
    /// </summary>
    public static class PerfBudget
    {
        public struct Limit { public string Key; public int Renderers; public int Tris; }

        /// <summary>판.자리 → 상한(잰 값 ×1.15, 반올림). 표에 없는 자리는 재기만 하고 판정 안 함.</summary>
        public static readonly Dictionary<string, Limit> Table = new Dictionary<string, Limit>();

        static PerfBudget()
        {
            // 10-25 잰 값(헤드리스 끝 무렵 장면) ×1.15 — go 434/722710·210/229596 · dungeon 134/157277·24/149276 · forest 111/325530·53/109078 · story 171/301745 · realm 78/122609
            // 4종횡(옆 화면)·5천하(내려다봄)는 뒤로 돈 카메라에 잡히는 게 없어(0) back 상한을 안 둔다.
            Add("go.front", 499, 831117); Add("go.back", 242, 264035);
            Add("dungeon.front", 154, 180869); Add("dungeon.back", 28, 171667);
            Add("forest.front", 128, 374360); Add("forest.back", 61, 125440);
            Add("story.front", 197, 347007);
            Add("realm.front", 90, 141000);
        }

        public static float Scale
        {
            get
            {
                var s = Environment.GetEnvironmentVariable("SAGA_PERF_BUDGET_SCALE");
                return float.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v) && v > 0f ? v : 1f;
            }
        }

        private static void Add(string key, int renderers, int tris) => Table[key] = new Limit { Key = key, Renderers = renderers, Tris = tris };

        /// <summary>그 카메라 절두체 안 켜진 렌더러 수·삼각형.</summary>
        public static (int renderers, long tris) Measure(Camera cam)
        {
            if (cam == null) return (0, 0);
            var planes = GeometryUtility.CalculateFrustumPlanes(cam);
            var lodSkip = new HashSet<Renderer>();
            foreach (var g in UnityEngine.Object.FindObjectsByType<LODGroup>(FindObjectsSortMode.None))
            {
                if (!g.enabled || !g.gameObject.activeInHierarchy) continue;
                var lods = g.GetLODs();
                int pick = PickLod(g, lods, cam);
                for (int i = 0; i < lods.Length; i++)
                    if (i != pick) foreach (var r in lods[i].renderers) if (r != null) lodSkip.Add(r);
            }
            int n = 0; long tris = 0;
            foreach (var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (!r.enabled || !r.gameObject.activeInHierarchy || r.forceRenderingOff) continue;
                if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer || r is BillboardRenderer) continue;
                if ((cam.cullingMask & (1 << r.gameObject.layer)) == 0) continue;
                if (lodSkip.Contains(r)) continue;
                if (!GeometryUtility.TestPlanesAABB(planes, r.bounds)) continue;
                Mesh m = r is SkinnedMeshRenderer s ? s.sharedMesh : (r.TryGetComponent<MeshFilter>(out var mf) ? mf.sharedMesh : null);
                if (m == null) continue;
                n++;
                for (int k = 0; k < m.subMeshCount; k++) tris += (long)m.GetIndexCount(k) / 3;
            }
            return (n, tris);
        }

        private static int PickLod(LODGroup g, LOD[] lods, Camera cam)
        {
            if (lods.Length == 0) return -1;
            var t = g.transform;
            float size = g.size * Mathf.Max(Mathf.Abs(t.lossyScale.x), Mathf.Abs(t.lossyScale.y), Mathf.Abs(t.lossyScale.z));
            float dist = Vector3.Distance(cam.transform.position, t.TransformPoint(g.localReferencePoint));
            float h = dist > 0.001f ? size / (2f * dist * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad)) : 1f;
            h *= QualitySettings.lodBias;
            for (int i = 0; i < lods.Length; i++) if (h >= lods[i].screenRelativeTransitionHeight) return i;
            return lods.Length; // 마지막 단계보다 작으면 다 꺼짐
        }

        /// <summary>판정 한 줄 — ok 와 설명. 표에 없으면 ok(재기만).</summary>
        public static bool Judge(string key, int renderers, long tris, out string line)
        {
            if (!Table.TryGetValue(key, out var lim)) { line = $"{key} 렌더러 {renderers}·삼각형 {tris}(상한 없음 — 재기만)"; return true; }
            float sc = Scale;
            int lr = Mathf.RoundToInt(lim.Renderers * sc); long lt = (long)(lim.Tris * (double)sc);
            bool ok = renderers <= lr && tris <= lt;
            line = $"{key} 렌더러 {renderers}/{lr}·삼각형 {tris}/{lt}";
            return ok;
        }
    }
}
