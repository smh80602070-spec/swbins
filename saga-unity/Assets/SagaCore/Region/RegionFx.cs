using UnityEngine;

namespace Saga.Core.Region
{
    /// <summary>지역 효과(tasks U-0023) — 반딧불·눈발 입자와 균열 문 그림. 그림 두 장(부드러운 점·소용돌이)은 코드가 값으로 만든다(에셋 파일 0).
    /// 입자 수·구역은 배치표의 fx 값 그대로. 전부 선형 색 텍스처라 값이 그대로 화면에 간다.</summary>
    public static class RegionFx
    {
        private static Texture2D _dot;

        public static Texture2D SoftDot()
        {
            if (_dot != null) return _dot;
            const int n = 32;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false, true) { name = "RegionSoftDot", wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.DontSave };
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(n * 0.5f, n * 0.5f)) / (n * 0.5f);
                    float a = Mathf.Clamp01(1f - d);
                    a *= a;
                    px[y * n + x] = new Color(1f, 1f, 1f, a);
                }
            t.SetPixels(px); t.Apply(false, true);
            return _dot = t;
        }

        private static Texture2D _moon;

        /// <summary>달 원판 — 가장자리가 부드러운 옅은 푸른 흰색 원, 안쪽에 옅은 얼룩(바다)을 얹은 그림. 더하기 섞기용.</summary>
        public static Texture2D MoonDisc()
        {
            if (_moon != null) return _moon;
            const int n = 128;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false, true) { name = "RegionMoonDisc", wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.DontSave };
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2f - 1f, v = (y + 0.5f) / n * 2f - 1f;
                    float r = Mathf.Sqrt(u * u + v * v);
                    float edge = Mathf.Clamp01((1f - r) / 0.06f);                       // 가장자리 부드럽게
                    float maria = Mathf.PerlinNoise(x * 0.07f + 3.1f, y * 0.07f + 7.7f);   // 옅은 얼룩
                    float shade = 0.82f + 0.18f * (1f - maria * 0.9f);
                    px[y * n + x] = new Color(0.93f * shade, 0.95f * shade, 1f * shade, edge);
                }
            t.SetPixels(px); t.Apply(false, true);
            return _moon = t;
        }

        /// <summary>두 색을 잡음으로 섞은 그림 — region_hero.py 의 균열 문(노이즈 → 색 램프) 재료.</summary>
        public static Texture2D Swirl(Color c0, Color c1, int n = 128)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false, true) { name = "RegionSwirl", wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.DontSave };
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = x / (float)n, v = y / (float)n;
                    float w = Mathf.PerlinNoise(u * 3f + 11f, v * 3f + 7f) * 0.55f + Mathf.PerlinNoise(u * 7f + 3f, v * 7f + 19f) * 0.3f + Mathf.PerlinNoise(u * 15f + 5f, v * 15f + 2f) * 0.15f;
                    Color c = Color.Lerp(c0, c1, Mathf.SmoothStep(0.25f, 0.75f, w));
                    px[y * n + x] = new Color(c.r, c.g, c.b, 1f);
                }
            t.SetPixels(px); t.Apply(false, true);
            return t;
        }

        public static GameObject Fireflies(Transform parent, FxSpec s)
        {
            var go = NewSystem(parent, "Fireflies", s, "SparkAdd", out var ps);
            const float life = 9f;
            var main = ps.main;
            main.startLifetime = life; main.startSpeed = 0f; main.startSize = new ParticleSystem.MinMaxCurve(0.07f, 0.14f);
            main.startColor = s.color.gamma; main.maxParticles = s.count; main.prewarm = true;
            var em = ps.emission; em.rateOverTime = s.count / life;
            var noise = ps.noise; noise.enabled = true; noise.strength = 0.7f; noise.frequency = 0.35f; noise.quality = ParticleSystemNoiseQuality.Low;
            var fade = ps.colorOverLifetime; fade.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                      new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.25f), new GradientAlphaKey(1f, 0.75f), new GradientAlphaKey(0f, 1f) });
            fade.color = g;
            ps.Play();
            return go;
        }

        public static GameObject Snow(Transform parent, FxSpec s)
        {
            var go = NewSystem(parent, "Snowfall", s, "SparkAlpha", out var ps);
            // 상자 윗면에서 태어나 바닥(상자 높이)에서 사라지게: 수명 = 높이 / 낙하 속도(땅 밑으로 계속 그리지 않는다)
            const float fall = 1.3f;
            float life = Mathf.Max(1f, s.size.y / fall);
            var shape = ps.shape; shape.position = new Vector3(0f, s.size.y * 0.5f, 0f); shape.scale = new Vector3(s.size.x, 0.1f, s.size.z);
            var main = ps.main;
            main.startLifetime = life; main.startSpeed = 0f; main.startSize = new ParticleSystem.MinMaxCurve(0.05f, 0.1f);
            main.startColor = Color.white; main.maxParticles = s.count; main.prewarm = true;
            var em = ps.emission; em.rateOverTime = s.count / life;
            var vel = ps.velocityOverLifetime; vel.enabled = true; vel.space = ParticleSystemSimulationSpace.Local;
            vel.x = new ParticleSystem.MinMaxCurve(-0.3f, 0.3f); vel.y = new ParticleSystem.MinMaxCurve(-fall, -fall); vel.z = new ParticleSystem.MinMaxCurve(-0.3f, 0.3f);
            ps.Play();
            return go;
        }

        private static GameObject NewSystem(Transform parent, string name, FxSpec s, string materialName, out ParticleSystem ps)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = s.center;
            ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = true; main.playOnAwake = true; main.simulationSpace = ParticleSystemSimulationSpace.Local;
            var shape = ps.shape; shape.enabled = true; shape.shapeType = ParticleSystemShapeType.Box; shape.scale = s.size;
            var r = go.GetComponent<ParticleSystemRenderer>();
            var mat = RegionMaterials.Make(materialName);
            if (mat != null) { mat.SetTexture("_MainTex", SoftDot()); r.sharedMaterial = mat; }
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
            return go;
        }
    }
}
