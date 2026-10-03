using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Core.Region
{
    /// <summary>삼각형을 모아 메시 한 장으로 만든다. 면마다 꼭짓점을 따로 둬 평평한 명암을 내고, 구는 꼭짓점 법선을 쓴다.
    /// 바깥쪽 판정은 <see cref="AddOriented"/> 가 한다 — 감는 방향을 손으로 맞추다 틀리는 것보다 힌트 벡터로 고르는 쪽이 안전하다.</summary>
    public sealed class MeshBuilder
    {
        private readonly List<Vector3> _v = new List<Vector3>();
        private readonly List<Vector3> _n = new List<Vector3>();
        private readonly List<Color32> _c = new List<Color32>();
        private readonly List<int> _t = new List<int>();

        public int VertexCount => _v.Count;
        public int TriangleCount => _t.Count / 3;

        /// <summary>유니티는 시계 방향이 앞면 — 법선은 cross(b-a, c-a). outward 쪽을 보지 않으면 b·c 를 맞바꾼다.</summary>
        public void AddOriented(Vector3 a, Vector3 b, Vector3 c, Vector3 outward, Color color)
        {
            Vector3 n = Vector3.Cross(b - a, c - a);
            if (Vector3.Dot(n, outward) < 0f) { var s = b; b = c; c = s; n = -n; }
            n.Normalize();
            int k = _v.Count;
            _v.Add(a); _v.Add(b); _v.Add(c);
            _n.Add(n); _n.Add(n); _n.Add(n);
            Color32 c32 = color;
            _c.Add(c32); _c.Add(c32); _c.Add(c32);
            _t.Add(k); _t.Add(k + 1); _t.Add(k + 2);
        }

        /// <summary>뿔(밑면 원 + 꼭대기). 기울기 tilt 는 꼭대기를 옆으로 민다(꽃대).</summary>
        public void AddCone(Vector3 baseCenter, float radius, float height, Vector2 tilt, int sides, Color color)
        {
            var ring = new Vector3[sides];
            for (int k = 0; k < sides; k++)
            {
                float a = k / (float)sides * Mathf.PI * 2f;
                ring[k] = baseCenter + new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius);
            }
            Vector3 tip = baseCenter + new Vector3(tilt.x * height, height, tilt.y * height);
            for (int k = 0; k < sides; k++)
            {
                Vector3 p = ring[k], q = ring[(k + 1) % sides];
                Vector3 centroid = (p + q + tip) / 3f;
                AddOriented(p, q, tip, new Vector3(centroid.x - baseCenter.x, 0f, centroid.z - baseCenter.z), color);
                AddOriented(baseCenter, q, p, Vector3.down, color);   // 밑면 부채꼴
            }
        }

        /// <summary>윗면이 둥근 구(정이십면체를 두 번 쪼갠 모양). 꼭짓점마다 조금씩 흔들어(jitter) 잎덩이처럼 울퉁불퉁하게.</summary>
        public void AddBlob(Vector3 center, float radius, Color color, System.Random rng, float jitter)
        {
            var ico = Ico.Get();
            int baseIndex = _v.Count;
            var pos = new Vector3[ico.verts.Length];
            for (int i = 0; i < pos.Length; i++)
            {
                Vector3 off = jitter <= 0f ? Vector3.zero : new Vector3(Rnd(rng, jitter), Rnd(rng, jitter), Rnd(rng, jitter * 0.8f));
                pos[i] = center + ico.verts[i] * radius + off;
            }
            Color32 c32 = color;
            for (int i = 0; i < pos.Length; i++)
            {
                _v.Add(pos[i]);
                _n.Add(ico.verts[i]);
                _c.Add(c32);
            }
            for (int k = 0; k < ico.tris.Length; k += 3)
            {
                int a = ico.tris[k], b = ico.tris[k + 1], c = ico.tris[k + 2];
                // 중심에서 바깥으로 보도록 감는다
                Vector3 n = Vector3.Cross(pos[b] - pos[a], pos[c] - pos[a]);
                Vector3 centroid = (pos[a] + pos[b] + pos[c]) / 3f - center;
                if (Vector3.Dot(n, centroid) < 0f) { int s = b; b = c; c = s; }
                _t.Add(baseIndex + a); _t.Add(baseIndex + b); _t.Add(baseIndex + c);
            }
        }

        private static float Rnd(System.Random rng, float amp) => ((float)rng.NextDouble() * 2f - 1f) * amp;

        public Mesh ToMesh(string name)
        {
            var m = new Mesh { name = name };
            if (_v.Count > 65535) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(_v);
            m.SetNormals(_n);
            m.SetColors(_c);
            m.SetTriangles(_t, 0);
            m.RecalculateBounds();
            return m;
        }

        // 단위 구(정이십면체 2회 분할: 꼭짓점 162·삼각형 320) — 한 번 만들어 모두가 쓴다.
        private sealed class Ico
        {
            public Vector3[] verts;
            public int[] tris;
            private static Ico _cached;

            public static Ico Get() => _cached ?? (_cached = Build());

            private static Ico Build()
            {
                float t = (1f + Mathf.Sqrt(5f)) * 0.5f;
                var v = new List<Vector3>
                {
                    new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0),
                    new Vector3(0, -1, t), new Vector3(0, 1, t), new Vector3(0, -1, -t), new Vector3(0, 1, -t),
                    new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1),
                };
                for (int i = 0; i < v.Count; i++) v[i] = v[i].normalized;
                var f = new List<int>
                {
                    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
                    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
                    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
                    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
                };
                for (int pass = 0; pass < 2; pass++)
                {
                    var mid = new Dictionary<long, int>();
                    var nf = new List<int>(f.Count * 4);
                    for (int k = 0; k < f.Count; k += 3)
                    {
                        int a = f[k], b = f[k + 1], c = f[k + 2];
                        int ab = Mid(v, mid, a, b), bc = Mid(v, mid, b, c), ca = Mid(v, mid, c, a);
                        nf.AddRange(new[] { a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca });
                    }
                    f = nf;
                }
                return new Ico { verts = v.ToArray(), tris = f.ToArray() };
            }

            private static int Mid(List<Vector3> v, Dictionary<long, int> cache, int a, int b)
            {
                long key = a < b ? ((long)a << 32) | (uint)b : ((long)b << 32) | (uint)a;
                if (cache.TryGetValue(key, out int i)) return i;
                v.Add(((v[a] + v[b]) * 0.5f).normalized);
                cache[key] = v.Count - 1;
                return v.Count - 1;
            }
        }
    }

    /// <summary>지역 메시 만들기 — 지형·길·광장·나무·꽃·원판. 전부 값에서 곧장 만드는 순수 함수라 장면 없이 진단할 수 있다.</summary>
    public static class RegionMeshes
    {
        // 마을 나무·꽃 색(region_hero.py village 의 mat_simple 값 — Blender 선형 값 그대로 정점색으로 쓴다)
        public static readonly Color[] LeafColors =
        {
            new Color(0.08f, 0.2f, 0.06f), new Color(0.16f, 0.3f, 0.08f), new Color(0.45f, 0.2f, 0.05f),
        };
        public static readonly Color TrunkColor = new Color(0.12f, 0.07f, 0.04f);
        public static readonly Color[] FlowerColors =
        {
            new Color(1.0f, 0.85f, 0.2f), new Color(0.95f, 0.4f, 0.55f), new Color(0.95f, 0.95f, 1.0f), new Color(0.6f, 0.5f, 1.0f),
        };

        public const float RoadLift = 0.05f;
        public const float PlazaLift = 0.07f;

        /// <summary>높이 격자 → 메시 한 장. 구멍(NaN) 칸은 건너뛰고 쓰이는 꼭짓점만 남긴다. 모서리 네 개가 모두 있는 칸만 면이 된다.</summary>
        public static Mesh Terrain(TerrainSpec t, out int quads)
        {
            int nx = t.nx, nz = t.nz;
            var remap = new int[nx * nz];
            for (int k = 0; k < remap.Length; k++) remap[k] = -1;
            var tris = new List<int>();
            var verts = new List<Vector3>();
            var normals = new List<Vector3>();
            var uvs = new List<Vector2>();

            int Use(int i, int j)
            {
                int key = j * nx + i;
                if (remap[key] >= 0) return remap[key];
                float h = t.H(i, j);
                verts.Add(new Vector3(t.x0 + i * t.step, h, t.z0 + j * t.step));
                normals.Add(GridNormal(t, i, j));
                uvs.Add(new Vector2((t.x0 + i * t.step) / t.tileLow, (t.z0 + j * t.step) / t.tileLow));
                remap[key] = verts.Count - 1;
                return remap[key];
            }

            quads = 0;
            for (int j = 0; j < nz - 1; j++)
            {
                for (int i = 0; i < nx - 1; i++)
                {
                    if (float.IsNaN(t.H(i, j)) || float.IsNaN(t.H(i + 1, j)) || float.IsNaN(t.H(i, j + 1)) || float.IsNaN(t.H(i + 1, j + 1))) continue;
                    int a = Use(i, j), b = Use(i, j + 1), c = Use(i + 1, j), d = Use(i + 1, j + 1);
                    tris.Add(a); tris.Add(b); tris.Add(c);   // 위에서 봐 시계 방향 = 앞면
                    tris.Add(c); tris.Add(b); tris.Add(d);
                    quads++;
                }
            }

            var m = new Mesh { name = "RegionTerrain" };
            if (verts.Count > 65535) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(verts);
            m.SetNormals(normals);
            m.SetUVs(0, uvs);
            m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            return m;
        }

        private static Vector3 GridNormal(TerrainSpec t, int i, int j)
        {
            float c = t.H(i, j);
            float Near(int ii, int jj)
            {
                if (ii < 0 || jj < 0 || ii >= t.nx || jj >= t.nz) return c;
                float h = t.H(ii, jj);
                return float.IsNaN(h) ? c : h;
            }
            float dx = (Near(i + 1, j) - Near(i - 1, j)) / (2f * t.step);
            float dz = (Near(i, j + 1) - Near(i, j - 1)) / (2f * t.step);
            return new Vector3(-dx, 1f, -dz).normalized;
        }

        /// <summary>길 띠 — 지형을 따라 눕는다(직선 상자는 구불구불한 땅에서 둔덕처럼 뜬다). 재질 이름별로 한 장씩. uv 는 폭·길이를 tile 미터로 나눈 값.</summary>
        public static Dictionary<string, Mesh> Roads(RegionLayout layout, float step = 1.5f, float tile = 3f)
        {
            var groups = new Dictionary<string, (List<Vector3> v, List<Vector3> n, List<Vector2> uv, List<int> t)>();
            foreach (var r in layout.roads)
            {
                if (!groups.TryGetValue(r.mat, out var g))
                    groups[r.mat] = g = (new List<Vector3>(), new List<Vector3>(), new List<Vector2>(), new List<int>());
                Vector2 d = r.to - r.from;
                float len = d.magnitude;
                if (len < 0.01f) continue;
                Vector2 u = d / len, side = new Vector2(-u.y, u.x);
                int n = Mathf.Max(2, (int)(len / step));
                int prev0 = -1, prev1 = -1;
                for (int i = 0; i <= n; i++)
                {
                    float along = len * i / n;
                    int idx0 = g.v.Count;
                    foreach (float s in new[] { -r.width * 0.5f, r.width * 0.5f })
                    {
                        Vector2 p = r.from + u * along + side * s;
                        float h = 0f;
                        layout.terrain?.SampleHeight(p.x, p.y, out h);
                        g.v.Add(new Vector3(p.x, h + RoadLift, p.y));
                        g.n.Add(Vector3.up);
                        g.uv.Add(new Vector2((s + r.width * 0.5f) / tile, along / tile));
                    }
                    if (prev0 >= 0)
                    {
                        // 길 방향(+u)과 옆(+side) 으로 위에서 봐 시계 방향이 되게 — 진행 방향이 어떻든 법선이 위를 보게 맞춘다
                        Vector3 a = g.v[prev0], b = g.v[prev1], c = g.v[idx0 + 1];
                        AddUpFacingQuad(g.t, prev0, prev1, idx0 + 1, idx0, a, b, c);
                    }
                    prev0 = idx0; prev1 = idx0 + 1;
                }
            }
            var result = new Dictionary<string, Mesh>();
            foreach (var kv in groups)
            {
                var g = kv.Value;
                if (g.v.Count == 0) continue;
                var m = new Mesh { name = "Road_" + kv.Key };
                if (g.v.Count > 65535) m.indexFormat = IndexFormat.UInt32;
                m.SetVertices(g.v); m.SetNormals(g.n); m.SetUVs(0, g.uv); m.SetTriangles(g.t, 0);
                m.RecalculateBounds();
                result[kv.Key] = m;
            }
            return result;
        }

        // 네 꼭짓점(p0 p1 p2 p3)을 두 삼각형으로, 법선이 위(+Y)를 보게 감는다. p0 p1 p2 로 방향을 정한다.
        private static void AddUpFacingQuad(List<int> tris, int i0, int i1, int i2, int i3, Vector3 a, Vector3 b, Vector3 c)
        {
            bool flip = Vector3.Cross(b - a, c - a).y < 0f;
            if (!flip) { tris.Add(i0); tris.Add(i1); tris.Add(i2); tris.Add(i0); tris.Add(i2); tris.Add(i3); }
            else { tris.Add(i0); tris.Add(i2); tris.Add(i1); tris.Add(i0); tris.Add(i3); tris.Add(i2); }
        }

        /// <summary>광장 — 지형 위에 얹는 원판(방사 링 6 × 48 쪽). uv 는 월드 미터 / tile.</summary>
        public static Mesh Plaza(RegionLayout layout, float tile = 4f)
        {
            const int rings = 6, segs = 48;
            Vector2 c = layout.plazaCenter;
            float R = layout.plazaRadius;
            var v = new List<Vector3>(); var n = new List<Vector3>(); var uv = new List<Vector2>(); var t = new List<int>();
            for (int r = 0; r <= rings; r++)
            {
                float rad = R * r / rings;
                int count = r == 0 ? 1 : segs;
                for (int s = 0; s < count; s++)
                {
                    float a = s / (float)segs * Mathf.PI * 2f;
                    Vector2 p = c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * rad;
                    float h = 0f;
                    layout.terrain?.SampleHeight(p.x, p.y, out h);
                    v.Add(new Vector3(p.x, h + PlazaLift, p.y)); n.Add(Vector3.up); uv.Add(new Vector2(p.x / tile, p.y / tile));
                }
            }
            int RingStart(int r) => r == 0 ? 0 : 1 + (r - 1) * segs;
            for (int s = 0; s < segs; s++)
            {
                int s2 = (s + 1) % segs;
                AddTriUp(t, v, 0, RingStart(1) + s, RingStart(1) + s2);
                for (int r = 1; r < rings; r++)
                {
                    int a0 = RingStart(r) + s, a1 = RingStart(r) + s2, b0 = RingStart(r + 1) + s, b1 = RingStart(r + 1) + s2;
                    AddTriUp(t, v, a0, b0, a1);
                    AddTriUp(t, v, a1, b0, b1);
                }
            }
            var m = new Mesh { name = "Plaza" };
            m.SetVertices(v); m.SetNormals(n); m.SetUVs(0, uv); m.SetTriangles(t, 0);
            m.RecalculateBounds();
            return m;
        }

        private static void AddTriUp(List<int> tris, List<Vector3> v, int a, int b, int c)
        {
            if (Vector3.Cross(v[b] - v[a], v[c] - v[a]).y < 0f) { tris.Add(a); tris.Add(c); tris.Add(b); }
            else { tris.Add(a); tris.Add(b); tris.Add(c); }
        }

        /// <summary>마을 나무 — 줄기 메시 하나 + 잎 색별 메시. region_hero.py trees_round() 와 같은 모양(줄기 뿔 + 어긋난 잎덩이 셋). 시드는 나무 순번이라 늘 같다.</summary>
        public static void Trees(IReadOnlyList<TreeSpec> trees, out Mesh trunks, out Mesh[] leaves)
        {
            var trunk = new MeshBuilder();
            var leaf = new MeshBuilder[LeafColors.Length];
            for (int i = 0; i < leaf.Length; i++) leaf[i] = new MeshBuilder();
            (float ox, float oy, float oz, float rr)[] blobs = { (0f, 0f, 1.2f, 1.7f), (0.9f, 0.3f, 0.7f, 1.3f), (-0.8f, -0.4f, 0.8f, 1.4f) };
            for (int i = 0; i < trees.Count; i++)
            {
                var tr = trees[i];
                float s = tr.scale;
                trunk.AddCone(tr.pos, 0.28f * s, 2.4f * s, Vector2.zero, 6, TrunkColor);
                var rng = new System.Random(20260824 + i);
                int kind = Mathf.Clamp(tr.kind, 0, leaf.Length - 1);
                Vector3 head = tr.pos + new Vector3(0f, 2.0f * s, 0f);
                foreach (var b in blobs)
                    leaf[kind].AddBlob(head + new Vector3(b.ox * s, b.oz * s, b.oy * s), b.rr * s, LeafColors[kind], rng, 0.12f * s);
            }
            trunks = trunk.ToMesh("TreeTrunks");
            leaves = new Mesh[leaf.Length];
            for (int i = 0; i < leaf.Length; i++) leaves[i] = leaf[i].ToMesh("TreeLeaves" + i);
        }

        /// <summary>마을 꽃 — 색별 메시. 한 송이에 꽃대 3~6개(작은 뿔).</summary>
        public static Mesh[] Flowers(RegionLayout layout)
        {
            var b = new MeshBuilder[FlowerColors.Length];
            for (int i = 0; i < b.Length; i++) b[i] = new MeshBuilder();
            for (int i = 0; i < layout.flowers.Count; i++)
            {
                var f = layout.flowers[i];
                int kind = Mathf.Clamp(f.kind, 0, b.Length - 1);
                float h = 0f;
                layout.terrain?.SampleHeight(f.xz.x, f.xz.y, out h);
                var rng = new System.Random(77031 + i);
                int stems = 3 + rng.Next(4);
                for (int k = 0; k < stems; k++)
                {
                    float jx = (float)(rng.NextDouble() * 0.3 - 0.15), jz = (float)(rng.NextDouble() * 0.3 - 0.15);
                    float height = 0.14f + (float)rng.NextDouble() * 0.14f;
                    var tilt = new Vector2((float)(rng.NextDouble() * 0.4 - 0.2), (float)(rng.NextDouble() * 0.4 - 0.2));
                    b[kind].AddCone(new Vector3(f.xz.x + jx, h, f.xz.y + jz), 0.025f, height, tilt, 5, FlowerColors[kind]);
                }
            }
            var meshes = new Mesh[b.Length];
            for (int i = 0; i < b.Length; i++) meshes[i] = b[i].ToMesh("Flowers" + i);
            return meshes;
        }

        /// <summary>위를 보는 정사각 판(물). 가운데 원점, 한 변 size 미터.</summary>
        public static Mesh WaterPlane(float size)
        {
            float h = size * 0.5f;
            var m = new Mesh { name = "RegionPlane" };
            m.SetVertices(new[] { new Vector3(-h, 0, -h), new Vector3(-h, 0, h), new Vector3(h, 0, -h), new Vector3(h, 0, h) });
            m.SetNormals(new[] { Vector3.up, Vector3.up, Vector3.up, Vector3.up });
            m.SetUVs(0, new[] { new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 0), new Vector2(1, 1) });
            m.SetTriangles(new[] { 0, 1, 2, 2, 1, 3 }, 0);
            m.RecalculateBounds();
            return m;
        }

        /// <summary>XY 평면에 서 있는 원판(균열 문). 가운데 원점, 앞뒤 어느 쪽에서든 보이게 재질이 Cull Off.</summary>
        public static Mesh Disc(float radius, int segments = 64)
        {
            var v = new List<Vector3> { Vector3.zero };
            var uv = new List<Vector2> { new Vector2(0.5f, 0.5f) };
            var t = new List<int>();
            for (int k = 0; k < segments; k++)
            {
                float a = k / (float)segments * Mathf.PI * 2f;
                v.Add(new Vector3(Mathf.Cos(a) * radius, Mathf.Sin(a) * radius, 0f));
                uv.Add(new Vector2(0.5f + Mathf.Cos(a) * 0.5f, 0.5f + Mathf.Sin(a) * 0.5f));
            }
            for (int k = 0; k < segments; k++) { t.Add(0); t.Add(1 + k); t.Add(1 + (k + 1) % segments); }
            var m = new Mesh { name = "RegionDisc" };
            m.SetVertices(v); m.SetUVs(0, uv); m.SetTriangles(t, 0);
            var cols = new Color32[v.Count];
            for (int i = 0; i < cols.Length; i++) cols[i] = Color.white;
            m.SetColors(cols);
            m.RecalculateNormals();
            m.RecalculateBounds();
            return m;
        }
    }
}
