using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0109 — 면마다 UV 가 미터 단위인 상자 메시. Unity 기본 Cube 는 면마다 UV 0~1 이라
    /// 재질 반복(`EnvironmentMaterial.MakeTiled`)을 옆면 크기로 맞추면 얇은 윗면·끝면에 결이 눌려 줄무늬가 진다.
    /// 이 상자는 각 면 UV = (그 면 가로 m, 세로 m) / `EnvironmentMaterial.TileMeters` 라 재질 반복 1 로 모든 면에 같은 크기 돌 결이 간다.
    /// 로컬 단위 상자(−0.5~0.5, 기본 Cube 와 같은 자리)라 `localScale = size` 를 그대로 두고 메시만 바꿔 끼운다(BoxCollider 무변경).
    /// 크기별로 하나만 만든다(소수 둘째 자리 키) — 메시가 지워졌으면(씬 언로드 뒤 정리) 다시 만든다.
    /// 면 방향은 기본 Cube 와 같다: 옆면(±Z) u=X·v=Y, 끝면(±X) u=Z·v=Y, 윗·밑면(±Y) u=X·v=Z.
    /// </summary>
    public static class MetricBox
    {
        public const string MeshName = "MetricBox";
        private static readonly Dictionary<Vector3Int, Mesh> Cache = new Dictionary<Vector3Int, Mesh>();

        // (바깥 노멀, 위쪽) — 오른쪽 u = cross(노멀, 위쪽)(밖에서 볼 때 시계 방향 감기)
        private static readonly Vector3[] FaceNormal = { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };
        private static readonly Vector3[] FaceUp = { Vector3.up, Vector3.up, Vector3.forward, Vector3.forward, Vector3.up, Vector3.up };

        public static Mesh Get(Vector3 size)
        {
            size = new Vector3(Mathf.Abs(size.x), Mathf.Abs(size.y), Mathf.Abs(size.z));
            var key = new Vector3Int(Mathf.RoundToInt(size.x * 100f), Mathf.RoundToInt(size.y * 100f), Mathf.RoundToInt(size.z * 100f));
            if (Cache.TryGetValue(key, out var cached) && cached != null) return cached;
            var mesh = Build(new Vector3(key.x, key.y, key.z) / 100f);
            Cache[key] = mesh;
            return mesh;
        }

        private static Mesh Build(Vector3 size)
        {
            var verts = new Vector3[24];
            var normals = new Vector3[24];
            var uvs = new Vector2[24];
            var tris = new int[36];
            for (int f = 0; f < 6; f++)
            {
                Vector3 n = FaceNormal[f], v = FaceUp[f], u = Vector3.Cross(n, v);
                float su = Vector3.Scale(u, size).magnitude / EnvironmentMaterial.TileMeters;
                float sv = Vector3.Scale(v, size).magnitude / EnvironmentMaterial.TileMeters;
                int b = f * 4;
                // 왼아래 · 왼위 · 오른위 · 오른아래(밖에서 볼 때)
                verts[b + 0] = (n - u - v) * 0.5f; uvs[b + 0] = new Vector2(0f, 0f);
                verts[b + 1] = (n - u + v) * 0.5f; uvs[b + 1] = new Vector2(0f, sv);
                verts[b + 2] = (n + u + v) * 0.5f; uvs[b + 2] = new Vector2(su, sv);
                verts[b + 3] = (n + u - v) * 0.5f; uvs[b + 3] = new Vector2(su, 0f);
                for (int k = 0; k < 4; k++) normals[b + k] = n;
                int t = f * 6;
                tris[t + 0] = b; tris[t + 1] = b + 1; tris[t + 2] = b + 2;
                tris[t + 3] = b; tris[t + 4] = b + 2; tris[t + 5] = b + 3;
            }
            var mesh = new Mesh { name = MeshName };
            mesh.vertices = verts;
            mesh.normals = normals;
            mesh.uv = uvs;
            mesh.triangles = tris;
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
