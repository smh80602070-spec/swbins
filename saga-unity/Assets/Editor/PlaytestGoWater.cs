using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0078 사실 물 진단 — `PlaytestHeadless` 가 정상 진단 앞에 부른다(상태를 안 바꾼다).
    /// 수면·폭포 묶음이 한 벌씩만(씬에 구운 옛 판 치움) · 수면·샘 웅덩이 재질 = `Saga/WaterReal`(셰이더 오류 없음, 굴절 = 파이프라인 불투명 텍스처, 웅덩이 덧깊이) ·
    /// 물 밑 비탈(흙 둑 끝 = 수면 0.25m 위, 안쪽 정점은 둑과 바닥 사이, 칸 가운데 = 강바닥, 폭포 발 = 깊음) · Mobile 파이프라인 깊이 텍스처 켬·불투명 텍스처 끔.
    /// </summary>
    public static class PlaytestGoWater
    {
        private const string MobileAsset = "Assets/Settings/Mobile_RPAsset.asset";
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var tb = Object.FindAnyObjectByType<TerrainBuilder>();
            if (tb == null) { Fail("TerrainBuilder 없음"); return false; }

            string mats = CheckMaterials(tb.transform);
            string slope = CheckSlope(tb);
            var mobile = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(MobileAsset);
            if (mobile == null) Fail("Mobile_RPAsset 없음");
            else if (!mobile.supportsCameraDepthTexture || mobile.supportsCameraOpaqueTexture)
                Fail($"Mobile 깊이 {mobile.supportsCameraDepthTexture}·불투명 {mobile.supportsCameraOpaqueTexture}(깊이만 켬이어야)");

            if (_ok) Debug.Log($"[{_tag}] water OK - {mats} | {slope} | Mobile 깊이 텍스처 켬");
            return _ok;
        }

        private static string CheckMaterials(Transform terrain)
        {
            var surfaces = terrain.Cast<Transform>().Where(c => c.name == "WaterSurface" && c.gameObject.activeInHierarchy).ToArray();
            var falls = terrain.Cast<Transform>().Where(c => c.name == "Waterfalls" && c.gameObject.activeInHierarchy).ToArray();
            if (surfaces.Length != 1) Fail($"수면 {surfaces.Length}벌(1벌이어야 — 씬에 구운 옛 판 남음)");
            if (falls.Length != 1) Fail($"폭포 묶음 {falls.Length}벌(1벌이어야)");
            if (surfaces.Length == 0) return "수면 없음";

            var mat = surfaces[0].GetComponent<MeshRenderer>()?.sharedMaterial;
            if (mat == null || mat.shader == null || mat.shader.name != TerrainBuilder.WaterRealShader) { Fail($"수면 셰이더 {mat?.shader?.name}"); return "수면 재질 ×"; }
            if (ShaderUtil.ShaderHasError(mat.shader)) Fail("Saga/WaterReal 셰이더 오류");
            var urp = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            float wantRefract = urp != null && urp.supportsCameraOpaqueTexture ? 1f : 0f;
            if (!Mathf.Approximately(mat.GetFloat("_Refract"), wantRefract)) Fail($"굴절 {mat.GetFloat("_Refract")} ≠ 파이프라인 {wantRefract}");
            if (mat.GetFloat("_FakeDepth") != 0f) Fail("강 수면 덧깊이가 0 이 아님(거품이 꺼진다)");

            int pools = 0;
            if (falls.Length > 0)
                foreach (var r in falls[0].GetComponentsInChildren<MeshRenderer>().Where(r => r.name == "SourcePool"))
                {
                    pools++;
                    var pm = r.sharedMaterial;
                    if (pm == null || pm.shader.name != TerrainBuilder.WaterRealShader) Fail($"샘 웅덩이 셰이더 {pm?.shader?.name}");
                    else if (pm.GetFloat("_FakeDepth") <= 0f) Fail("샘 웅덩이 덧깊이 0(땅 바로 위 판이라 거품 판이 된다)");
                }
            if (pools != TestMapData.Waterfalls.Length) Fail($"샘 웅덩이 {pools}/{TestMapData.Waterfalls.Length}");
            return $"수면 1·폭포 1·웅덩이 {pools} WaterReal(굴절 {wantRefract})";
        }

        private static string CheckSlope(TerrainBuilder tb)
        {
            float half = TestMapData.TileSize * 0.5f;
            var dirs = new[] { new Vector2Int(1, 0), new Vector2Int(-1, 0), new Vector2Int(0, 1), new Vector2Int(0, -1) };
            int gx = -1, gy = -1; Vector2Int dir = default;
            for (int y = 1; y < TestMapData.RowCount - 1 && gx < 0; y++)
                for (int x = 1; x < TestMapData.Cols - 1 && gx < 0; x++)
                {
                    if (TestMapData.TileAt(x, y) != '~') continue;
                    foreach (var d in dirs)
                    {
                        char n = TestMapData.TileAt(x + d.x, y + d.y);
                        if (!TestMapData.IsWater(n) && n != '^') { gx = x; gy = y; dir = d; break; }
                    }
                }
            if (gx < 0) { Fail("흙 둑에 닿은 강 칸 없음"); return "비탈 ×"; }

            Vector3 c = TestMapData.WorldPos(gx, gy);
            Vector3 d3 = new Vector3(dir.x, 0, dir.y);
            Vector3 edge = c + d3 * half;
            float hEdge = TerrainBuilder.RiverBedAt(gx, gy, edge);
            float hCenter = TerrainBuilder.RiverBedAt(gx, gy, c);
            if (Mathf.Abs(hEdge - TerrainBuilder.BankLipHeight) > 0.05f) Fail($"둑 끝 높이 {hEdge:F2} ≠ {TerrainBuilder.BankLipHeight:F2}");
            if (hEdge <= TestMapData.WaterSurfaceHeight) Fail($"둑 끝 {hEdge:F2} 가 수면 아래(물가 띠가 안 생김)");
            if (Mathf.Abs(hCenter - TestMapData.RiverBedHeight) > 0.01f) Fail($"칸 가운데 {hCenter:F2} ≠ 강바닥 {TestMapData.RiverBedHeight}");

            // 실제 땅 메시 — 둑 끝에서 안쪽 6m(BedSub 한 칸) 정점이 둑과 바닥 사이
            var mesh = tb.GetComponent<MeshFilter>()?.sharedMesh;
            if (mesh == null) { Fail("땅 메시 없음"); return "비탈 ×"; }
            Vector3 inner = edge - d3 * (TestMapData.TileSize / 8f);
            var vs = mesh.vertices;
            var near = vs.Where(v => (new Vector2(v.x - inner.x, v.z - inner.z)).sqrMagnitude < 0.01f).ToArray();
            if (near.Length == 0) Fail($"안쪽 6m 자리 정점 없음 {inner}");
            else if (!near.Any(v => v.y > TestMapData.RiverBedHeight + 0.3f && v.y < TerrainBuilder.BankLipHeight - 0.3f))
                Fail($"안쪽 6m 정점 높이 {string.Join(",", near.Select(v => v.y.ToString("F2")))} — 비탈 아님");

            // 폭포 발(절벽 쪽)은 깊게 — 얕은 물가에 떨어지지 않는다
            string foot = "";
            foreach (var w in TestMapData.Waterfalls)
            {
                TestMapData.WaterfallGeometry(w, out _, out Vector3 f, out _, out _);
                float hf = TerrainBuilder.RiverBedAt(w.Gx + w.Dx, w.Gy + w.Dy, f);
                if (hf > TestMapData.WaterSurfaceHeight - 1.5f) Fail($"{w.Id} 폭포 발 바닥 {hf:F2}(얕음)");
                foot += $" {w.Id} {hf:F1}";
            }
            return $"비탈({gx},{gy}) 둑 {hEdge:F2}→6m {near.Select(v => v.y).Where(y => y < 0f).DefaultIfEmpty(0f).Min():F2}→가운데 {hCenter:F2} · 폭포 발{foot}";
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] water: {msg}");
            _ok = false;
        }
    }
}
