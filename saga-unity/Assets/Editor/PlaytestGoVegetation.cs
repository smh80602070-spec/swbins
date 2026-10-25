using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-3 "식생 바이옴" 진단 — `PlaytestHeadless` 가 경사·바이옴 진단 뒤에 부른다(씬에 구운 식생만 읽는다, 바꾸는 것 없음).
    /// 빛깔 공식(몸통·바위 그대로, 초록만, 세기 0 그대로) · 숲 칸 나무 수(옛 셋 이상·표 이하, 서쪽 숲길은 넷인 칸이 있음) ·
    /// 지역 모양(북쪽 산기슭 침엽수만, 동쪽 숲·끝 논밭 활엽수만, 침엽수는 산기슭 밖에 없음) · 지역 재질 `_CanopyTint` · 몸통 충돌 수 ·
    /// 상자가 몸통에 안 박힘 · 풀(들·숲 칸만, 충돌 없음, 상자·역참 비킴, 남쪽 공터가 마을보다 빽빽·더 노랗다) · 갈대(강 북쪽 둑 띠, 충돌 없음).
    /// procgen 모델이 없는 PC(gitignore)면 모양·풀·갈대 단계는 건너뛴다고 적고 넘어간다.
    /// </summary>
    public static class PlaytestGoVegetation
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var veg = Object.FindFirstObjectByType<VegetationBuilder>();
            if (veg == null) { Fail("VegetationBuilder 없음(씬 재빌드?)"); return false; }
            CheckTintFormula();
            string m = CheckTrees(veg) + CheckGrass(veg) + CheckReeds(veg) + CheckUnified(veg);
            if (_ok) Debug.Log($"[{_tag}] vegetation OK - 빛깔 공식·숲 칸 나무 수·지역 모양·재질 빛깔·몸통 충돌·상자 비킴·풀(자리·빽빽함·빛깔)·갈대(둑 띠) |{m}");
            return _ok;
        }

        private static void CheckTintFormula()
        {
            var amber = GoWorldMap.VegetationOf("east_grove").CanopyTint;
            var trunk = new Color(0.32f, 0.21f, 0.12f, 1f);
            var rock = new Color(0.5f, 0.48f, 0.46f, 1f);
            var leaf = new Color(0.12f, 0.30f, 0.11f, 1f);
            if (VegetationBuilder.TintLeafy(trunk, amber) != trunk) Fail("몸통 갈색이 물들었다");
            if (VegetationBuilder.TintLeafy(rock, amber) != rock) Fail("바위 회색이 물들었다");
            var t = VegetationBuilder.TintLeafy(leaf, amber);
            if (!(t.r > leaf.r + 0.15f)) Fail($"호박빛 수관이 안 붉어졌다 {t}");
            if (VegetationBuilder.TintLeafy(leaf, GoWorldMap.VegetationOf("village").CanopyTint) != leaf) Fail("세기 0 인 마을 빛깔이 수관을 바꿨다");
        }

        private static string CheckTrees(VegetationBuilder veg)
        {
            var trees = Children(veg.transform, "Trees");
            var trunks = Children(veg.transform, "TreeTrunkCollisions");
            if (trees.Count == 0) { Fail("나무가 없다"); return ""; }
            if (trunks.Count != trees.Count) Fail($"나무 {trees.Count} ≠ 몸통 충돌 {trunks.Count}");
            bool named = trees[0].name.StartsWith("Tree_");
            var perTile = new Dictionary<(int, int), int>();
            foreach (var t in trees)
            {
                var (gx, gy) = TestMapData.WorldToGrid(t.position);
                perTile[(gx, gy)] = perTile.TryGetValue((gx, gy), out var n) ? n + 1 : 1;
                if (TestMapData.TileAt(gx, gy) != 'T') Fail($"숲 칸 밖 나무 ({gx},{gy})");
                string region = GoWorldMap.RegionAt(gx, gy);
                if (named)
                {
                    bool conifer = t.name == "Tree_Conifer";
                    if (region == "north_foot" && !conifer) Fail($"북쪽 산기슭에 {t.name}");
                    if (region != "north_foot" && conifer) Fail($"{region} 에 침엽수");
                    if ((region == "east_grove" || region == "farmland") && t.name != "Tree_Broadleaf") Fail($"{region} 에 {t.name}");
                }
                var r = t.GetComponentInChildren<MeshRenderer>();
                var want = GoWorldMap.VegetationOf(region).CanopyTint;
                if (r != null && r.sharedMaterial != null && r.sharedMaterial.HasProperty("_CanopyTint")
                    && !Near(r.sharedMaterial.GetColor("_CanopyTint"), want, want.a > 0f)) Fail($"{region} 나무 재질 빛깔 {r.sharedMaterial.GetColor("_CanopyTint")}");
            }
            int maxWest = 0, cleared = 0;
            var keys = VegetationBuilder.KeyPoints();
            for (int y = 0; y < TestMapData.RowCount; y++)
                for (int x = 0; x < TestMapData.Cols; x++)
                {
                    if (TestMapData.TileAt(x, y) != 'T') continue;
                    var v = GoWorldMap.VegetationOf(GoWorldMap.RegionAt(x, y));
                    int n = perTile.TryGetValue((x, y), out var c) ? c : 0;
                    // 표대로 선 수 — 옛 셋은 지역 소품 빈터(108 ①)에서만, 늘어난 나무는 요지 곁에서도 빠진다.
                    int want = 0;
                    for (int i = 0; i < v.TreesPerForestTile; i++)
                    {
                        var at = VegetationBuilder.TreeBase(x, y, i);
                        if (!VegetationBuilder.SkipTree(at, i, keys)) want++;
                        else if (i < VegetationBuilder.LegacyTreesPerTile) cleared++;
                    }
                    if (n != want) Fail($"({x},{y}) {v.RegionId} 나무 {n} ≠ 표 {want}");
                    if (v.RegionId == "west_wood") maxWest = Mathf.Max(maxWest, n);
                }
            foreach (var t in trees)
                if (GoRegionProps.InClearing(t.position)) Fail($"지역 소품 빈터에 나무 {t.position}");
            if (maxWest < 4) Fail("서쪽 숲길에 네 그루 선 칸이 없다(빽빽한 숲 아님)");
            foreach (var c in GoTreasure.Chests)
            {
                if (c.Spot != GoTreasure.Spot.Ground) continue;
                Vector3 p = TestMapData.WorldPos(c.Gx, c.Gy);
                foreach (var t in trunks)
                    if (Flat(t.position - p).magnitude < 2.5f) Fail($"상자 {c.Id} 가 나무 몸통에 박혔다");
            }
            return $" 나무 {trees.Count}(서쪽 숲길 최대 {maxWest}/칸, 소품 빈터가 비운 옛 자리 {cleared}){(named ? "" : " · 모양 이름 없음(모델 없는 PC)")}";
        }

        private static string CheckGrass(VegetationBuilder veg)
        {
            var grass = Children(veg.transform, "Grass");
            if (grass.Count == 0) return " · 풀 없음(procgen 풀 모델 없는 PC — 건너뜀)";
            var byRegion = new Dictionary<string, int>();
            var tilesByRegion = new Dictionary<string, int>();
            for (int y = 0; y < TestMapData.RowCount; y++)
                for (int x = 0; x < TestMapData.Cols; x++)
                {
                    char ch = TestMapData.TileAt(x, y);
                    if (ch != '.' && ch != 'T') continue;
                    string rg = GoWorldMap.RegionAt(x, y);
                    tilesByRegion[rg] = tilesByRegion.TryGetValue(rg, out var n) ? n + 1 : 1;
                }
            var keys = VegetationBuilder.KeyPoints();
            Color village = Color.clear, glade = Color.clear;
            foreach (var g in grass)
            {
                var (gx, gy) = TestMapData.WorldToGrid(g.position);
                char ch = TestMapData.TileAt(gx, gy);
                if (ch != '.' && ch != 'T') Fail($"풀이 {ch} 칸 ({gx},{gy}) 에");
                if (g.GetComponentInChildren<Collider>(true) != null) Fail("풀에 충돌체가 있다");
                foreach (var k in keys) if (Flat(g.position - k).magnitude < VegetationBuilder.GrassClearance - 0.01f) { Fail("풀이 상자·역참·무리 자리를 안 비켰다"); break; }
                if (GoRegionProps.InClearing(g.position)) Fail("풀이 지역 소품 빈터에 났다");
                string rg = GoWorldMap.RegionAt(gx, gy);
                byRegion[rg] = byRegion.TryGetValue(rg, out var n) ? n + 1 : 1;
                var col = LeafColor(g);
                if (rg == "village" && village == Color.clear) village = col;
                if (rg == "south_glade" && glade == Color.clear) glade = col;
            }
            float Density(string rg) => byRegion.TryGetValue(rg, out var n) && tilesByRegion.TryGetValue(rg, out var t) ? n / (float)t : 0f;
            float dv = Density("village"), dg = Density("south_glade");
            if (!(dg > dv * 1.5f)) Fail($"남쪽 공터 풀({dg:0.0}/칸)이 마을({dv:0.0}/칸)보다 빽빽하지 않다");
            // 노란 정도 = (r+g)/2 − b — 단색 풀(초록 쪽만 물듦)과 텍스처 풀(바탕색에 곱, tasks U-0141) 둘 다 공터 쪽이 커야 한다.
            if (village != Color.clear && glade != Color.clear && !(Yellow(glade) > Yellow(village) + 0.05f))
                Fail($"남쪽 공터 풀이 더 노랗지 않다(마을 {village} · 공터 {glade})");
            return $" · 풀 {grass.Count}(마을 {dv:0.0}·공터 {dg:0.0}/칸)";
        }

        private static string CheckReeds(VegetationBuilder veg)
        {
            var reeds = Children(veg.transform, "Reeds");
            if (reeds.Count == 0) return " · 갈대 없음(모델 없는 PC — 건너뜀)";
            foreach (var r in reeds)
            {
                var (gx, gy) = TestMapData.WorldToGrid(r.position);
                if (TestMapData.TileAt(gx, gy + 1) != '~') Fail($"갈대 ({gx},{gy}) 가 강 북쪽 둑 줄이 아니다");
                float dz = r.position.z - TestMapData.WorldPos(gx, gy).z;
                if (dz < TestMapData.TileSize * 0.3f || dz > TestMapData.TileSize * 0.5f) Fail($"갈대가 둑 띠 밖(칸 가운데에서 {dz:0.0}m)");
                if (r.GetComponentInChildren<Collider>(true) != null) Fail("갈대에 충돌체가 있다");
            }
            return $" · 갈대 {reeds.Count}";
        }

        private static float Yellow(Color c) => (c.r + c.g) * 0.5f - c.b;

        /// <summary>tasks U-0141 — 통일 세트(`Resources/World`)가 있으면: 나무·바위·풀·갈대에 procgen 메시 0 · 동쪽 숲은 단풍판 ·
        /// 충돌 없는 풀·바위 · 식생 삼각형 합(성능 기록). 없는 PC 면 건너뛴다고 적는다.</summary>
        private static string CheckUnified(VegetationBuilder veg)
        {
            if (Saga.Core.WorldModels.Load(VegetationBuilder.UnifiedTrees[0].name) == null) return " · 통일 세트 없음(procgen 그대로)";
            var names = new HashSet<string>();
            foreach (var t in VegetationBuilder.UnifiedTrees) { names.Add(t.name); names.Add(t.name + "_autumn"); }
            foreach (var n in VegetationBuilder.UnifiedRocks) names.Add(n);
            foreach (var n in VegetationBuilder.UnifiedGrass) names.Add(n);
            foreach (var n in VegetationBuilder.UnifiedReeds) names.Add(n);
            int other = 0, tris = 0, autumnWant = 0, autumnHas = 0;
            // 정적 배칭 뒤엔 메시 경로가 없다 — glb 노드 이름으로 가린다(통일 세트 = 모델 이름, procgen = geometry_0·partNN).
            foreach (var f in veg.GetComponentsInChildren<MeshFilter>(true))
            {
                var mesh = f.sharedMesh;
                if (mesh == null) continue;
                if (!names.Contains(f.gameObject.name) && (f.transform.parent == null || !names.Contains(f.transform.parent.name))) other++;
                var mr = f.GetComponent<MeshRenderer>();
                int first = 0, count = mesh.subMeshCount;
                if (mr != null && mr.isPartOfStaticBatch) { first = mr.subMeshStartIndex; count = mr.sharedMaterials.Length; }
                for (int s = first; s < first + count && s < mesh.subMeshCount; s++) tris += (int)(mesh.GetIndexCount(s) / 3);
            }
            if (other > 0) Fail($"통일 세트 아닌 식생 메시 {other} 개(procgen·결합 메시)");
            foreach (var t in Children(veg.transform, "Trees"))
            {
                var (gx, gy) = TestMapData.WorldToGrid(t.position);
                if (!VegetationBuilder.WantsAutumn(GoWorldMap.VegetationOf(GoWorldMap.RegionAt(gx, gy)).CanopyTint)) continue;
                autumnWant++;
                // tasks U-0239 — 사실판은 단풍 사본이 없어 같은 모델 + 지역 잎 빛깔(LeafTinted)이 단풍이다(갈음 직후 옛 자식은 꺼진 채 남음 — 켜진 첫 자식)
                Transform c0 = null;
                for (int ci = 0; ci < t.childCount && c0 == null; ci++) if (t.GetChild(ci).gameObject.activeSelf) c0 = t.GetChild(ci);
                if (c0 != null && (c0.name.EndsWith("_autumn") || Saga.Core.WorldModels.IsReal(c0.name))) autumnHas++;
            }
            if (autumnWant > 0 && autumnHas < autumnWant) Fail($"단풍 지역 나무 {autumnWant} 중 단풍판 {autumnHas}");
            foreach (var group in new[] { "Rocks", "Grass", "Reeds" })
                foreach (var t in Children(veg.transform, group))
                    if (t.GetComponentInChildren<Collider>(true) != null) { Fail($"{group} 에 충돌체"); break; }
            return $" · 통일 세트(다른 메시 0·단풍 {autumnHas}/{autumnWant}·식생 삼각형 {tris / 1000}k)";
        }

        /// <summary>풀 포기에서 가장 초록이 짙은 재질 색(물든 뒤).</summary>
        private static Color LeafColor(Transform g)
        {
            Color best = Color.clear;
            float bestLeaf = -1f;
            foreach (var r in g.GetComponentsInChildren<MeshRenderer>(true))
                foreach (var m in r.sharedMaterials)
                {
                    if (m == null) continue;
                    string prop = m.HasProperty("baseColorFactor") ? "baseColorFactor" : m.HasProperty("_BaseColor") ? "_BaseColor" : null;
                    if (prop == null) continue;
                    var c = m.GetColor(prop);
                    float leaf = c.g - Mathf.Max(c.r, c.b) + c.g * 0.01f;
                    if (leaf > bestLeaf) { bestLeaf = leaf; best = c; }
                }
            return best;
        }

        private static List<Transform> Children(Transform root, string group)
        {
            var list = new List<Transform>();
            var g = root.Find(group);
            if (g != null) foreach (Transform t in g) list.Add(t);
            return list;
        }

        private static bool Near(Color a, Color b, bool check) => !check ? true : Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b) + Mathf.Abs(a.a - b.a) < 0.01f;
        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] vegetation: {msg}");
            _ok = false;
        }
    }
}
