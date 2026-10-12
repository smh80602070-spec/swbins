using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// tasks U-0113 — 5천하 판(`RealmTacticsView`)·싸움터(`RealmBattlefield`)·인물 대역(`RealmFigure`)이 같이 쓰는 원시 도형 헬퍼.
    /// 기본 도형 만들고 충돌체 떼고 색 재질 입히기·여덟모 뿔 메시·재질 캐시를 한 벌로 — 재질은 (색, 매끈함) 열쇠라
    /// 같은 색·같은 매끈함이면 세 화면이 한 재질을 같이 쓴다. 매끈함은 부르는 쪽이 정한다(판 0.12·싸움터 0.15·인물 0.25).
    /// </summary>
    internal static class RealmPrims
    {
        private static readonly Dictionary<(Color, float), Material> Mats = new Dictionary<(Color, float), Material>();
        private static Mesh _cone;

        /// <summary>URP/Lit 단색 재질 — 알파는 1 로 맞춘다. 파괴된 재질이면 다시 만든다.</summary>
        public static Material Mat(Color c, float smoothness)
        {
            c.a = 1f;
            var key = (c, smoothness);
            if (Mats.TryGetValue(key, out var m) && m != null) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Realm (generated)", color = c };
            m.SetFloat("_Smoothness", smoothness);
            Mats[key] = m;
            return m;
        }

        /// <summary>밑 반지름 1·높이 1 여덟모 뿔(봉우리·풀·결정) — 한 번만 만든다.</summary>
        public static Mesh Cone()
        {
            if (_cone != null) return _cone;
            const int n = 8;
            var v = new List<Vector3>();
            var tri = new List<int>();
            for (int i = 0; i < n; i++)
            {
                float a0 = i * Mathf.PI * 2f / n, a1 = (i + 1) * Mathf.PI * 2f / n;
                int b = v.Count;
                v.Add(new Vector3(Mathf.Cos(a0), 0f, Mathf.Sin(a0)));
                v.Add(new Vector3(0f, 1f, 0f));
                v.Add(new Vector3(Mathf.Cos(a1), 0f, Mathf.Sin(a1)));
                tri.Add(b); tri.Add(b + 1); tri.Add(b + 2);
            }
            _cone = new Mesh { name = "RealmCone" };
            _cone.SetVertices(v);
            _cone.SetTriangles(tri, 0);
            _cone.RecalculateNormals();
            _cone.RecalculateBounds();
            return _cone;
        }

        /// <summary>기본 도형 하나 — 부모 밑 로컬 자리·크기, 충돌체 떼고 색 재질.</summary>
        public static GameObject Prim(string name, PrimitiveType type, Transform parent, Vector3 localPos, Vector3 scale, Color color, float smoothness)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            var col = go.GetComponent<Collider>();
            if (col != null) Kill(col);
            go.GetComponent<MeshRenderer>().sharedMaterial = Mat(color, smoothness);
            return go;
        }

        /// <summary>여덟모 뿔 하나 — 밑 반지름 `radius`·높이 `height`(충돌체 없음).</summary>
        public static GameObject ConeObj(string name, Transform parent, Vector3 localPos, float radius, float height, Color color, float smoothness)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = new Vector3(radius, height, radius);
            go.AddComponent<MeshFilter>().sharedMesh = Cone();
            go.AddComponent<MeshRenderer>().sharedMaterial = Mat(color, smoothness);
            return go;
        }

        /// <summary>플레이 중이면 Destroy, 아니면 DestroyImmediate.</summary>
        public static void Kill(Object o)
        {
            if (Application.isPlaying) Object.Destroy(o); else Object.DestroyImmediate(o);
        }
    }
}
