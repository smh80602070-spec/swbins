using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core.Region
{
    public struct PiecePlacement
    {
        public string piece;
        public Vector3 pos;
        public float yawDeg;
        public float scale;
    }

    public struct RegionLightSpec
    {
        public bool sun;
        public Color color;
        public float energy;
        public Vector3 pos;
        public Vector3 dir;
    }

    public struct RoadSpec
    {
        public Vector2 from;
        public Vector2 to;
        public float width;
        public string mat;
    }

    public struct TreeSpec
    {
        public Vector3 pos;
        public float scale;
        public int kind;
    }

    public struct FlowerSpec
    {
        public int kind;
        public Vector2 xz;
    }

    public struct FxSpec
    {
        public bool on;
        public int count;
        public Vector3 center;
        public Vector3 size;
        public Color color;
    }

    /// <summary>지형 높이 격자 + 땅 재질 섞기 값. 좌표는 Unity(x, 높이 y, z) — 배치표의 y 가 여기서 z 다. 높이가 비어 있는 칸(구멍)은 NaN.</summary>
    public sealed class TerrainSpec
    {
        public float x0, z0, step;
        public int nx, nz;
        public float[] heights;
        public string lowTex, highTex;
        public float tileLow = 5f, tileHigh = 8f;
        public float heightZ0 = 999f, heightZ1 = 1000f, slope0 = 0.35f, slope1 = 0.6f;
        public float satLow = 1f, satHigh = 1f;
        public Color tintLow = Color.white, tintHigh = Color.white;
        public bool hasMaterials;                    // 재질 칸이 있는 새 모양 배치표(서리봉·사거리·은하 나루)

        public float H(int i, int j) => heights[j * nx + i];

        /// <summary>새 모양 배치표의 높이는 안개 상자 안쪽에서 "위에서 쏜 광선이 상자 윗면을 먼저 맞은" 값(상자 윗면 높이 그대로의 평평한 고원)으로 덮여 있다 —
        /// 서리봉 10m·사거리 8m·은하 나루 5m 가 각 `fog.box` 윗면과 정확히 같다. 이대로 땅으로 쓰면 카메라와 조각(z≈0)이 땅 아래에 묻혀
        /// 땅 뒷면이 컬링돼 하늘이 보인다. 상자 발자국 안에서 높이가 윗면과 같은 칸을 땅이 아닌 값(윗면 이상 = 상자 윗면 또는 그 안에 선 조각 윗면)으로 보고, 가장자리 바로 바깥의 진짜 땅 칸과
        /// 조각 자리(조각은 땅 위에 서 있다)에서 역거리 가중(제곱)으로 메운다. 상자 발자국 밖의 언덕은 그대로 둔다.</summary>
        public int RemoveFogLid(Vector2 boxCenter, Vector2 boxSize, float top, IList<Vector3> anchors)
        {
            const float Eps = 0.02f;
            float hx = boxSize.x * 0.5f + step * 0.5f, hz = boxSize.y * 0.5f + step * 0.5f;
            var lid = new bool[heights.Length];
            int count = 0;
            for (int j = 0; j < nz; j++)
                for (int i = 0; i < nx; i++)
                {
                    float x = x0 + i * step, z = z0 + j * step, h = heights[j * nx + i];
                    if (float.IsNaN(h) || Mathf.Abs(x - boxCenter.x) > hx || Mathf.Abs(z - boxCenter.y) > hz) continue;
                    if (h >= top - Eps) { lid[j * nx + i] = true; count++; }   // 윗면 그대로이거나 그보다 높은 칸 = 상자 안에 선 조각(숙소·비석)의 윗면
                }
            if (count == 0) return 0;

            // 근거 점: 뚜껑 칸과 맞닿은 진짜 땅 칸 + 상자 안의 조각 자리
            var px = new List<float>(); var pz = new List<float>(); var ph = new List<float>();
            for (int j = 0; j < nz; j++)
                for (int i = 0; i < nx; i++)
                {
                    int k = j * nx + i;
                    if (lid[k] || float.IsNaN(heights[k])) continue;
                    bool edge = false;
                    for (int dj = -1; dj <= 1 && !edge; dj++)
                        for (int di = -1; di <= 1; di++)
                        {
                            int ii = i + di, jj = j + dj;
                            if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && lid[jj * nx + ii]) { edge = true; break; }
                        }
                    if (edge) { px.Add(x0 + i * step); pz.Add(z0 + j * step); ph.Add(heights[k]); }
                }
            if (anchors != null)
                foreach (var a in anchors)
                    if (Mathf.Abs(a.x - boxCenter.x) <= hx && Mathf.Abs(a.z - boxCenter.y) <= hz) { px.Add(a.x); pz.Add(a.z); ph.Add(a.y); }
            if (px.Count == 0) return 0;   // 근거가 없으면 그대로 둔다

            var filled = (float[])heights.Clone();
            for (int j = 0; j < nz; j++)
                for (int i = 0; i < nx; i++)
                {
                    if (!lid[j * nx + i]) continue;
                    float x = x0 + i * step, z = z0 + j * step, sw = 0f, sh = 0f;
                    for (int k = 0; k < px.Count; k++)
                    {
                        float dx = x - px[k], dz = z - pz[k];
                        float w = 1f / (dx * dx + dz * dz + 1f);
                        sw += w; sh += w * ph[k];
                    }
                    filled[j * nx + i] = sh / sw;
                }
            heights = filled;
            return count;
        }

        /// <summary>`materials` 가 없는 옛 모양 배치표(마을)의 높이는 땅이 아니라 "위에서 쏜 광선이 처음 맞은 면"(집·나무 꼭대기 포함)이다.
        /// 이 반경(m)으로 열림(침식 → 팽창)해 집·나무만큼 좁은 돌기를 걷어내고 넓은 언덕만 남긴다 — Godot `region_loader.gd`
        /// `GROUND_OPEN_RADIUS_M`(조각 z 와의 평균 오차 3.6m → 0.8m)와 같은 값.</summary>
        public const float GroundOpenRadiusM = 8f;

        /// <summary>마을 풀 한 장의 색 보정 — 시안이 풀을 초록으로 틴트했고 `ground_grass.jpg` 는 올리브색이다(Godot `VILLAGE_GRASS_TINT` 와 같은 값).</summary>
        public static readonly Color VillageGrassTint = new Color(0.78f, 1f, 0.74f);

        /// <summary>열림(최소 필터 → 최대 필터). NaN(땅 없음)은 건너뛰고 NaN 칸은 NaN 으로 남긴다.</summary>
        public void Open(float radiusM)
        {
            int k = Mathf.RoundToInt(radiusM / step);
            if (k <= 0) return;
            heights = Window(Window(heights, k, true), k, false);
        }

        private float[] Window(float[] src, int k, bool wantMin)
        {
            var o = new float[src.Length];
            for (int j = 0; j < nz; j++)
            {
                for (int i = 0; i < nx; i++)
                {
                    if (float.IsNaN(src[j * nx + i])) { o[j * nx + i] = float.NaN; continue; }
                    float best = wantMin ? float.PositiveInfinity : float.NegativeInfinity;
                    int j0 = Mathf.Max(j - k, 0), j1 = Mathf.Min(j + k, nz - 1), i0 = Mathf.Max(i - k, 0), i1 = Mathf.Min(i + k, nx - 1);
                    for (int dj = j0; dj <= j1; dj++)
                        for (int di = i0; di <= i1; di++)
                        {
                            float v = src[dj * nx + di];
                            if (float.IsNaN(v)) continue;
                            if (wantMin ? v < best : v > best) best = v;
                        }
                    o[j * nx + i] = best;
                }
            }
            return o;
        }

        /// <summary>격자를 이중선형으로 읽는다. 네 모서리 중 하나라도 구멍이면 false(Blender 의 ground_z 가 None 인 곳).</summary>
        public bool SampleHeight(float x, float z, out float h)
        {
            h = 0f;
            float fx = (x - x0) / step, fz = (z - z0) / step;
            int i = Mathf.FloorToInt(fx), j = Mathf.FloorToInt(fz);
            if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return false;
            float a = H(i, j), b = H(i + 1, j), c = H(i, j + 1), d = H(i + 1, j + 1);
            if (float.IsNaN(a) || float.IsNaN(b) || float.IsNaN(c) || float.IsNaN(d)) return false;
            float tx = fx - i, tz = fz - j;
            h = Mathf.Lerp(Mathf.Lerp(a, b, tx), Mathf.Lerp(c, d, tx), tz);
            return true;
        }
    }

    /// <summary>지역 배치표(tools/world-forge/region_hero.py 가 만든 layout.json)를 Unity 좌표로 바꾼 모양(tasks U-0023).
    /// 좌표 규칙: Blender (x, y, z) → Unity (x, z, y), 회전은 Blender 의 Z 축 회전 r → Unity Y 축 -r(왼손 좌표라 방향이 뒤집힌다).</summary>
    public sealed class RegionLayout
    {
        public string id;
        public string scenery;                       // 풍경 GLB 이름(없으면 null) — 있으면 길도 그 안에 구워져 있다.
        public readonly List<PiecePlacement> pieces = new List<PiecePlacement>();
        public readonly List<RegionLightSpec> lights = new List<RegionLightSpec>();
        public readonly List<RoadSpec> roads = new List<RoadSpec>();
        public readonly List<TreeSpec> trees = new List<TreeSpec>();
        public readonly List<FlowerSpec> flowers = new List<FlowerSpec>();
        public TerrainSpec terrain;
        public bool hasPlaza; public Vector2 plazaCenter; public float plazaRadius;
        public string skyKind, skyFull, skyMobile;
        public bool hasFog; public float fogDensity; public Color fogColor; public float fogBoxHeight;
        public bool hasFogBox; public float fogBoxTop; public Vector2 fogBoxCenter, fogBoxSize;   // Blender (x, y) → Unity (x, z), 크기는 x·y 칸수
        public bool hasWater; public float waterY, waterSize; public Color waterColor;
        public FxSpec fireflies, snowfall;
        public bool hasGate; public Vector3 gateCenter; public float gateRadius; public Color gateColor0, gateColor1;
        public bool hasCamera; public Vector3 cameraPos, cameraLook; public float cameraLens;

        /// <summary>Blender 좌표(미터) → Unity 좌표.</summary>
        public static Vector3 BlenderToUnity(float x, float y, float z) => new Vector3(x, z, y);

        public static float YawFromBlender(float rotRadians) => -rotRadians * Mathf.Rad2Deg;

        public static RegionLayout Parse(string id, string json)
        {
            var root = RegionJson.Parse(json) as Dictionary<string, object>;
            if (root == null) throw new FormatException("배치표 맨 위가 객체가 아니다: " + id);
            var L = new RegionLayout { id = id };
            L.scenery = Str(Get(root, "scenery"));

            foreach (var o in Arr(Get(root, "pieces")))
            {
                var d = (Dictionary<string, object>)o;
                var p = Floats(Get(d, "pos"));
                L.pieces.Add(new PiecePlacement
                {
                    piece = Str(Get(d, "piece")),
                    pos = BlenderToUnity(p[0], p[1], p[2]),
                    yawDeg = YawFromBlender(Num(Get(d, "rot"))),
                    scale = Get(d, "scale") == null ? 1f : Num(Get(d, "scale")),
                });
            }

            foreach (var o in Arr(Get(root, "lights")))
            {
                var d = (Dictionary<string, object>)o;
                var c = Floats(Get(d, "color"));
                var spec = new RegionLightSpec
                {
                    sun = Str(Get(d, "type")) == "SUN",
                    color = new Color(c[0], c[1], c[2]),
                    energy = Num(Get(d, "energy")),
                };
                if (spec.sun)
                {
                    var r = Floats(Get(d, "rot"));
                    spec.dir = SunDirection(r[0], r[1], r[2]);
                }
                else
                {
                    var p = Floats(Get(d, "pos"));
                    spec.pos = BlenderToUnity(p[0], p[1], p[2]);
                }
                L.lights.Add(spec);
            }

            foreach (var o in Arr(Get(root, "roads")))
            {
                var d = (Dictionary<string, object>)o;
                var a = Floats(Get(d, "from")); var b = Floats(Get(d, "to"));
                L.roads.Add(new RoadSpec { from = new Vector2(a[0], a[1]), to = new Vector2(b[0], b[1]), width = Num(Get(d, "width")), mat = Str(Get(d, "mat")) });
            }

            foreach (var o in Arr(Get(root, "trees")))
            {
                var t = Floats(o);   // [x, y, z, 크기, 잎 색 번호]
                L.trees.Add(new TreeSpec { pos = BlenderToUnity(t[0], t[1], t[2]), scale = t[3], kind = Mathf.RoundToInt(t[4]) });
            }
            foreach (var o in Arr(Get(root, "flowers")))
            {
                var f = Floats(o);   // [색 번호, x, y]
                L.flowers.Add(new FlowerSpec { kind = Mathf.RoundToInt(f[0]), xz = new Vector2(f[1], f[2]) });
            }

            if (Get(root, "plaza") is Dictionary<string, object> plaza)
            {
                var c = Floats(Get(plaza, "center"));
                L.hasPlaza = true; L.plazaCenter = new Vector2(c[0], c[1]); L.plazaRadius = Num(Get(plaza, "radius"));
            }

            if (Get(root, "terrain") is Dictionary<string, object> tr) L.terrain = ParseTerrain(tr);

            if (Get(root, "sky") is Dictionary<string, object> sky)
            {
                L.skyKind = Str(Get(sky, "kind"));
                if (Get(sky, "panorama") is Dictionary<string, object> pano)
                {
                    L.skyFull = Str(Get(pano, "full"));
                    L.skyMobile = Str(Get(pano, "mobile"));
                }
            }

            if (Get(root, "fog") is Dictionary<string, object> fog)
            {
                var c = Floats(Get(fog, "color"));
                L.hasFog = true; L.fogDensity = Num(Get(fog, "density")); L.fogColor = new Color(c[0], c[1], c[2]);
                if (Get(fog, "box") is List<object> box && box.Count >= 3)
                {
                    L.fogBoxHeight = Num(box[2]);
                    if (box.Count >= 6)
                    {
                        L.hasFogBox = true;
                        L.fogBoxSize = new Vector2(Num(box[0]), Num(box[1]));
                        L.fogBoxCenter = new Vector2(Num(box[3]), Num(box[4]));
                        L.fogBoxTop = Num(box[5]) + Num(box[2]) * 0.5f;
                    }
                }
            }

            if (Get(root, "water") is Dictionary<string, object> wt)
            {
                var c = Floats(Get(wt, "color"));
                L.hasWater = true; L.waterY = Num(Get(wt, "z")); L.waterSize = Num(Get(wt, "size")); L.waterColor = new Color(c[0], c[1], c[2]);
            }

            if (Get(root, "fx") is Dictionary<string, object> fx)
            {
                L.fireflies = Fx(Get(fx, "fireflies"));
                L.snowfall = Fx(Get(fx, "snowfall"));
            }

            if (Get(root, "gate") is Dictionary<string, object> gate)
            {
                var c = Floats(Get(gate, "center")); var cols = Arr(Get(gate, "colors"));
                var c0 = Floats(cols[0]); var c1 = Floats(cols[1]);
                L.hasGate = true; L.gateCenter = BlenderToUnity(c[0], c[1], c[2]); L.gateRadius = Num(Get(gate, "radius"));
                L.gateColor0 = new Color(c0[0], c0[1], c0[2]); L.gateColor1 = new Color(c1[0], c1[1], c1[2]);
            }

            if (Get(root, "camera") is Dictionary<string, object> cam)
            {
                var p = Floats(Get(cam, "pos")); var lk = Floats(Get(cam, "look"));
                L.hasCamera = true; L.cameraPos = BlenderToUnity(p[0], p[1], p[2]); L.cameraLook = BlenderToUnity(lk[0], lk[1], lk[2]);
                L.cameraLens = Num(Get(cam, "lens"));
            }
            // 새 모양 배치표(재질 칸 있음)의 지형 높이에서 안개 상자 윗면 오염을 걷어낸다(마을은 위 열림 처리가 맡는다)
            if (L.terrain != null && L.terrain.hasMaterials && L.hasFogBox)
            {
                var anchors = new List<Vector3>();
                foreach (var pc in L.pieces) anchors.Add(pc.pos);
                L.terrain.RemoveFogLid(L.fogBoxCenter, L.fogBoxSize, L.fogBoxTop, anchors);
            }
            return L;
        }

        /// <summary>Blender 렌즈(mm, 센서 가로 36)로 세로 시야각(도). 화면 비율이 가로/세로.</summary>
        public static float VerticalFov(float lensMm, float aspect)
        {
            float h = 2f * Mathf.Atan(18f / Mathf.Max(lensMm, 1f));
            return 2f * Mathf.Atan(Mathf.Tan(h * 0.5f) / Mathf.Max(aspect, 0.1f)) * Mathf.Rad2Deg;
        }

        // Blender 해(SUN)는 오일러 XYZ 로 돌려 -Z 쪽을 비춘다.
        private static Vector3 SunDirection(float rx, float ry, float rz)
        {
            Vector3 v = new Vector3(0f, 0f, -1f);
            float cx = Mathf.Cos(rx), sx = Mathf.Sin(rx);
            v = new Vector3(v.x, v.y * cx - v.z * sx, v.y * sx + v.z * cx);
            float cy = Mathf.Cos(ry), sy = Mathf.Sin(ry);
            v = new Vector3(v.x * cy + v.z * sy, v.y, -v.x * sy + v.z * cy);
            float cz = Mathf.Cos(rz), sz = Mathf.Sin(rz);
            v = new Vector3(v.x * cz - v.y * sz, v.x * sz + v.y * cz, v.z);
            return BlenderToUnity(v.x, v.y, v.z).normalized;
        }

        private static TerrainSpec ParseTerrain(Dictionary<string, object> d)
        {
            var T = new TerrainSpec
            {
                x0 = Num(Get(d, "x0")), z0 = Num(Get(d, "y0")), step = Num(Get(d, "step")),
                nx = (int)Num(Get(d, "nx")), nz = (int)Num(Get(d, "ny")),
            };
            var hs = Arr(Get(d, "heights"));
            if (hs.Count != T.nx * T.nz) throw new FormatException($"지형 높이 수 {hs.Count} != {T.nx}×{T.nz}");
            T.heights = new float[hs.Count];
            for (int k = 0; k < hs.Count; k++) T.heights[k] = hs[k] == null ? float.NaN : Num(hs[k]);

            T.lowTex = "tex/ground_grass.jpg";   // 마을은 재질 칸이 없다 — 풀 한 장
            if (Get(d, "materials") is Dictionary<string, object> m)
            {
                T.hasMaterials = true;
                T.lowTex = Str(Get(m, "low")) ?? T.lowTex;
                T.highTex = Str(Get(m, "high"));
                T.tileLow = Opt(m, "tile_low", T.tileLow); T.tileHigh = Opt(m, "tile_high", T.tileHigh);
                T.heightZ0 = Opt(m, "z0", T.heightZ0); T.heightZ1 = Opt(m, "z1", T.heightZ1);
                T.slope0 = Opt(m, "slope0", T.slope0); T.slope1 = Opt(m, "slope1", T.slope1);
                T.satLow = Opt(m, "sat_low", 1f); T.satHigh = Opt(m, "sat_high", 1f);
                if (Get(m, "tint_low") != null) { var c = Floats(Get(m, "tint_low")); T.tintLow = new Color(c[0], c[1], c[2]); }
                if (Get(m, "tint_high") != null) { var c = Floats(Get(m, "tint_high")); T.tintHigh = new Color(c[0], c[1], c[2]); }
            }
            else
            {
                T.Open(TerrainSpec.GroundOpenRadiusM);   // 마을 — 집·나무가 구워진 높이에서 땅만 남긴다
                T.tintLow = TerrainSpec.VillageGrassTint;
            }
            return T;
        }

        private static FxSpec Fx(object o)
        {
            if (!(o is Dictionary<string, object> d)) return default;
            var a = Floats(Get(d, "area"));   // Blender x0 x1 y0 y1 z0 z1
            var spec = new FxSpec
            {
                on = true,
                count = (int)Num(Get(d, "count")),
                center = BlenderToUnity((a[0] + a[1]) * 0.5f, (a[2] + a[3]) * 0.5f, (a[4] + a[5]) * 0.5f),
                size = new Vector3(a[1] - a[0], a[5] - a[4], a[3] - a[2]),
                color = Color.white,
            };
            if (Get(d, "color") != null) { var c = Floats(Get(d, "color")); spec.color = new Color(c[0], c[1], c[2]); }
            return spec;
        }

        // ---- 읽기 도우미 ----
        private static object Get(Dictionary<string, object> d, string key) => d != null && d.TryGetValue(key, out var v) ? v : null;
        private static string Str(object o) => o as string;
        private static float Num(object o) => o == null ? 0f : (float)(double)o;
        private static float Opt(Dictionary<string, object> d, string key, float fallback) => Get(d, key) == null ? fallback : Num(Get(d, key));
        private static List<object> Arr(object o) => o as List<object> ?? new List<object>();
        private static float[] Floats(object o)
        {
            var l = Arr(o);
            var r = new float[l.Count];
            for (int i = 0; i < r.Length; i++) r[i] = Num(l[i]);
            return r;
        }
    }
}
