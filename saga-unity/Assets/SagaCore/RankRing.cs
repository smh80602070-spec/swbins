using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0160(웹 W-0246 tierDeco · 고돗 rank_ring 짝) — 발밑 단 표식. 단(1~5)마다 하나씩 늘어난다:
    /// 1 가는 고리 · 2 굵게 · 3 안쪽 빛 고리 · 4 바깥 고리 · 5 별 여섯. 테 빛깔 = tint(갈래 색과 금빛 섞음), 별은 금빛.
    /// 땅에 눕힌 LineRenderer(재질 Sprites/Default 코드 생성 — 에셋 없음). 1만리 승급 금테(W-0237)도 같은 것을 쓸 자리.
    /// </summary>
    public static class RankRing
    {
        public const string Name = "RankRing";
        public const float Radius = 0.55f, InnerRadius = 0.36f, OuterRadius = 0.78f, StarRadius = 0.95f;
        public const float Thin = 0.035f, Thick = 0.07f;
        public const int Segments = 40;
        public static readonly Color Gold = new Color(1f, 0.84f, 0.35f);

        /// <summary>parent 밑 표식을 다시 짓는다(단 0 이면 지우기만). 조각(선) 수를 돌려준다.</summary>
        public static int Apply(Transform parent, int tier, Color tint, float scale = 1f, float lift = 0.04f)
        {
            if (parent == null) return 0;
            var old = parent.Find(Name);
            if (old != null) { old.SetParent(null); Object.Destroy(old.gameObject); }
            if (tier <= 0) return 0;
            var root = new GameObject(Name).transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(0f, lift, 0f);
            Color rim = Color.Lerp(tint, Gold, 0.35f);
            var mat = new Material(Shader.Find("Sprites/Default")) { name = "RankRing (generated)" };
            int n = 0;
            Circle(root, mat, Radius * scale, (tier >= 2 ? Thick : Thin) * scale, rim, 0.9f); n++;
            if (tier >= 3) { Circle(root, mat, InnerRadius * scale, Thin * scale, Color.Lerp(rim, Color.white, 0.4f), 0.55f); n++; }
            if (tier >= 4) { Circle(root, mat, OuterRadius * scale, Thin * scale, rim, 0.75f); n++; }
            if (tier >= 5)
                for (int i = 0; i < 6; i++)
                {
                    float a = i * Mathf.PI / 3f;
                    Star(root, mat, new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * StarRadius * scale, 0.09f * scale, Gold);
                    n++;
                }
            return n;
        }

        /// <summary>진단 — parent 밑 표식의 선 수(없으면 0).</summary>
        public static int Count(Transform parent)
        {
            var r = parent != null ? parent.Find(Name) : null;
            return r != null ? r.GetComponentsInChildren<LineRenderer>(true).Length : 0;
        }

        private static LineRenderer Line(Transform root, Material mat, string name, float width, Color c, float alpha)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = false;
            lr.loop = true;
            lr.widthMultiplier = width;
            lr.alignment = LineAlignment.TransformZ; // 땅에 눕힌다(트랜스폼 Z = 위)
            go.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            lr.sharedMaterial = mat;
            lr.startColor = lr.endColor = new Color(c.r, c.g, c.b, alpha);
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            return lr;
        }

        private static void Circle(Transform root, Material mat, float r, float width, Color c, float alpha)
        {
            var lr = Line(root, mat, "Ring", width, c, alpha);
            lr.positionCount = Segments;
            for (int i = 0; i < Segments; i++)
            {
                float a = i * Mathf.PI * 2f / Segments;
                lr.SetPosition(i, new Vector3(Mathf.Cos(a) * r, Mathf.Sin(a) * r, 0f));
            }
        }

        private static void Star(Transform root, Material mat, Vector3 at, float s, Color c)
        {
            var lr = Line(root, mat, "Star", s * 0.6f, c, 1f);
            lr.transform.localPosition = at;
            lr.positionCount = 4;
            lr.SetPosition(0, new Vector3(0f, s, 0f));
            lr.SetPosition(1, new Vector3(s * 0.6f, 0f, 0f));
            lr.SetPosition(2, new Vector3(0f, -s, 0f));
            lr.SetPosition(3, new Vector3(-s * 0.6f, 0f, 0f));
        }
    }
}
