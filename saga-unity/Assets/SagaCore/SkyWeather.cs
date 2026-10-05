using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0047 계절·날씨 규칙(saga-godot `data/season.gd`·`data/weather.gd` 이식) — 실제 벽시계 달로 계절을 정하고, 계절이 기울인 확률로
    /// **3시간마다 바뀌는 결정론 날씨**(같은 시각이면 어느 기기에서나 같다)를 뽑는다. 시각 전용 — 보상·판정에는 안 닿는다(고돗의 날씨 경험치 보너스는 안 옮김).
    /// </summary>
    public static class SkyWeatherRules
    {
        public enum Kind { Clear = 0, Cloud, Rain, Wind, Fog, Snow }

        public struct Season
        {
            public string Key, NameKo, NameEn;
            public int[] Months;
            public float[] Wx;            // Kind 순서의 날씨 가중치 배수
            public Color Ambient;         // 안개색 배수
        }

        public static readonly Season[] Seasons =
        {
            new Season { Key = "spring", NameKo = "봄", NameEn = "Spring", Months = new[] { 3, 4, 5 }, Wx = new[] { 1.2f, 1.0f, 1.1f, 1.2f, 1.1f, 0.05f }, Ambient = new Color(1.00f, 1.02f, 0.98f) },
            new Season { Key = "summer", NameKo = "여름", NameEn = "Summer", Months = new[] { 6, 7, 8 }, Wx = new[] { 1.1f, 1.1f, 1.9f, 0.8f, 0.7f, 0.0f }, Ambient = new Color(1.00f, 1.00f, 1.00f) },
            new Season { Key = "autumn", NameKo = "가을", NameEn = "Autumn", Months = new[] { 9, 10, 11 }, Wx = new[] { 1.3f, 1.0f, 0.7f, 1.3f, 1.4f, 0.1f }, Ambient = new Color(1.05f, 0.98f, 0.90f) },
            new Season { Key = "winter", NameKo = "겨울", NameEn = "Winter", Months = new[] { 12, 1, 2 }, Wx = new[] { 0.9f, 1.2f, 0.2f, 1.1f, 0.9f, 2.6f }, Ambient = new Color(0.95f, 0.97f, 1.05f) },
        };

        public struct Weather
        {
            public Kind Kind;
            public string NameKo, NameEn;
            public float FogMul;          // 안개 농도 배수
            public Color Tint;            // 안개색 배수
            public float CloudAlpha;      // 구름 겹 투명도
            public float WindMul;         // 구름 흐르는 속도 배수
            public float Rain, Snow, Fog; // 입자 초당 방출 수
        }

        public static readonly Weather[] Weathers =
        {
            new Weather { Kind = Kind.Clear, NameKo = "맑음", NameEn = "Clear", FogMul = 0.6f, Tint = new Color(1.05f, 1.03f, 0.95f), CloudAlpha = 0.35f, WindMul = 1f },
            new Weather { Kind = Kind.Cloud, NameKo = "흐림", NameEn = "Cloudy", FogMul = 1.0f, Tint = new Color(0.95f, 0.96f, 1.00f), CloudAlpha = 0.90f, WindMul = 1f },
            new Weather { Kind = Kind.Rain, NameKo = "비", NameEn = "Rain", FogMul = 1.6f, Tint = new Color(0.85f, 0.90f, 1.00f), CloudAlpha = 1.00f, WindMul = 1.5f, Rain = 800f },
            new Weather { Kind = Kind.Wind, NameKo = "바람", NameEn = "Windy", FogMul = 0.8f, Tint = new Color(1.00f, 1.00f, 1.00f), CloudAlpha = 0.55f, WindMul = 4f },
            new Weather { Kind = Kind.Fog, NameKo = "안개", NameEn = "Fog", FogMul = 2.4f, Tint = new Color(0.90f, 0.90f, 0.92f), CloudAlpha = 0.50f, WindMul = 0.5f, Fog = 5f },
            new Weather { Kind = Kind.Snow, NameKo = "눈", NameEn = "Snow", FogMul = 1.2f, Tint = new Color(1.02f, 1.02f, 1.08f), CloudAlpha = 0.90f, WindMul = 1f, Snow = 260f },
        };

        public const long SpanMs = 3L * 60 * 60 * 1000;

        /// <summary>진단·촬영이 시각·계절·날씨를 붙든다(null = 진짜).</summary>
        public static Func<long> NowMsFn = () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        public static Func<int> MonthFn = () => DateTime.Now.Month;
        public static Kind? ForcedWeather;
        public static string ForcedSeason;

        public static Season SeasonOfMonth(int month)
        {
            foreach (var s in Seasons) if (Array.IndexOf(s.Months, month) >= 0) return s;
            return Seasons[0];
        }

        public static Season CurrentSeason()
        {
            if (!string.IsNullOrEmpty(ForcedSeason)) foreach (var s in Seasons) if (s.Key == ForcedSeason) return s;
            return SeasonOfMonth(MonthFn());
        }

        /// <summary>시간 슬롯 번호 → 0~1 (결정적, 정수 입력). 고돗 `weather.gd::_hash01` 와 같은 정신.</summary>
        public static float Hash01(long slot)
        {
            unchecked
            {
                int s = (int)slot;
                int h = (s * 374761393) ^ 987654321;
                h = (h ^ (h >> 13)) * 1274126177;
                h = h ^ (h >> 16);
                return (h & 0x7fffffff) / (float)0x7fffffff;
            }
        }

        /// <summary>그 시각(유닉스 ms)·계절의 날씨 — 같은 입력이면 늘 같다. 가중치가 전부 0 이면 맑음.</summary>
        public static Kind KeyAt(long unixMs, Season season)
        {
            long slot = unixMs / SpanMs;
            float h = Hash01(slot);
            float total = 0f;
            for (int i = 0; i < Weathers.Length; i++) total += Mathf.Max(0f, season.Wx[i]);
            if (total <= 0f) return Kind.Clear;
            float x = h * total;
            for (int i = 0; i < Weathers.Length; i++)
            {
                x -= Mathf.Max(0f, season.Wx[i]);
                if (x < 0f) return (Kind)i;
            }
            return Kind.Clear;
        }

        public static Kind CurrentKind() => ForcedWeather ?? KeyAt(NowMsFn(), CurrentSeason());
        public static Weather Info(Kind k) => Weathers[(int)k];
        public static Weather Current() => Info(CurrentKind());

        public static string Summary()
        {
            var s = CurrentSeason(); var w = Current();
            return SagaUi.L(s.NameKo, s.NameEn) + " · " + SagaUi.L(w.NameKo, w.NameEn);
        }
    }

    /// <summary>
    /// U-0047 하늘 위 구름 3겹·날씨 입자(비·눈·안개)·안개 농도/색 — `SkyPass.Runner` 가 하늘을 입히는 씬(사가고 마을·사가의숲·사가스토리)에 세운다.
    /// 구름 = 카메라를 따라다니는 열린 원통 세 겹(`Resources/Sky/cloud_layer_01~03`, 겹마다 높이·속도 다르고 시간대 색을 곱, 날씨별 투명도) ·
    /// 입자 = 카메라 곁 상자에서 내리는 ParticleSystem 셋(월드 좌표 시뮬이라 걸으면 비가 제자리에 남는다) · 안개 = 씬이 이미 `RenderSettings.fog` 를
    /// 켜 뒀을 때만 농도·색에 날씨·계절 배수를 곱한다(기준값을 기억했다 파괴될 때 되돌림). 그림이 없으면 그 부분은 아무것도 안 세운다.
    /// 끄기: 환경변수 `SAGA_NO_WEATHER=1`. 60초마다 날씨·시간대를 다시 본다(`Refresh`).
    /// </summary>
    public class SkyWeather : MonoBehaviour
    {
        public static SkyWeather Instance { get; private set; }

        private static readonly float[] Radius = { 360f, 370f, 380f };
        private static readonly float[] BaseY = { 60f, 90f, 120f };
        private const float LayerHeight = 150f;
        private static readonly float[] SpinDegPerSec = { 0.25f, 0.45f, 0.75f };

        private Camera _cam;
        private Transform[] _layers = new Transform[3];
        private Material[] _layerMats = new Material[3];
        private ParticleSystem _rain, _snow, _fog;
        private bool _fogCaptured;
        private float _fogBaseDensity;
        private Color _fogBaseColor;
        private float _windMul = 1f;

        public SkyWeatherRules.Kind Kind { get; private set; }
        public int LayerCount { get { int n = 0; foreach (var l in _layers) if (l != null) n++; return n; } }
        public float CloudAlpha(int i) => _layerMats[i] != null ? _layerMats[i].color.a : -1f;
        public float RainRate => _rain != null ? _rain.emission.rateOverTime.constant : -1f;
        public float SnowRate => _snow != null ? _snow.emission.rateOverTime.constant : -1f;
        public float FogRate => _fog != null ? _fog.emission.rateOverTime.constant : -1f;
        public bool HasParticles => _rain != null && _snow != null && _fog != null;

        /// <summary>씬에 하나 세운다(이미 있으면 그대로). 끄기 환경변수가 있으면 null.</summary>
        public static SkyWeather Install(Camera cam)
        {
            if (Environment.GetEnvironmentVariable("SAGA_NO_WEATHER") == "1") return null;
            if (Instance != null) { Instance._cam = cam != null ? cam : Instance._cam; return Instance; }
            // 촬영·점검용 — SAGA_WEATHER=clear|cloud|rain|wind|fog|snow · SAGA_SEASON=spring|summer|autumn|winter
            var envW = Environment.GetEnvironmentVariable("SAGA_WEATHER");
            if (!string.IsNullOrEmpty(envW) && Enum.TryParse(envW, true, out SkyWeatherRules.Kind forced)) SkyWeatherRules.ForcedWeather = forced;
            var envS = Environment.GetEnvironmentVariable("SAGA_SEASON");
            if (!string.IsNullOrEmpty(envS)) SkyWeatherRules.ForcedSeason = envS;
            var go = new GameObject("SkyWeather");
            var sw = go.AddComponent<SkyWeather>();
            sw._cam = cam;
            Instance = sw; // 편집 모드(배치 진단)는 Awake 가 안 돌아 여기서도 적는다
            sw.Build();
            sw.Refresh();
            return sw;
        }

        private void Awake() { if (Instance == null) Instance = this; }

        /// <summary>치운다 — 안개 곱을 되돌리고 오브젝트를 없앤다(진단·씬 정리용; 편집 모드는 OnDestroy 가 안 돌아 직접 부른다).</summary>
        public void Teardown()
        {
            RestoreFog();
            if (Instance == this) Instance = null;
            if (Application.isPlaying) Destroy(gameObject); else DestroyImmediate(gameObject);
        }

        private void OnDestroy()
        {
            RestoreFog();
            if (Instance == this) Instance = null;
        }

        // ---- 짓기 ----

        private void Build()
        {
            for (int i = 0; i < 3; i++)
            {
                var tex = Resources.Load<Texture2D>("Sky/cloud_layer_0" + (i + 1));
                if (tex == null) continue;
                tex.wrapMode = TextureWrapMode.Repeat;
                var go = new GameObject("CloudLayer_" + (i + 1));
                go.transform.SetParent(transform, false);
                go.transform.localPosition = new Vector3(0f, BaseY[i], 0f);
                go.AddComponent<MeshFilter>().sharedMesh = CylinderMesh(Radius[i], LayerHeight, 48, 2f);
                var mat = new Material(Shader.Find("Sprites/Default")) { name = "CloudLayer (generated)", mainTexture = tex };
                mat.renderQueue = 3000 + i;
                var mr = go.AddComponent<MeshRenderer>();
                mr.sharedMaterial = mat;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                mr.receiveShadows = false;
                _layers[i] = go.transform; _layerMats[i] = mat;
            }
            _rain = BuildParticles("Rain", "Sky/fx_rain", new Vector3(30f, 0.5f, 30f), new Vector3(0f, 16f, 0f), 0.8f, 0.22f, 0.3f, 1600, true);
            _snow = BuildParticles("Snow", "Sky/fx_snow", new Vector3(40f, 0.5f, 40f), new Vector3(0f, 14f, 0f), 9f, 0.16f, 0.26f, 3200, false);
            _fog = BuildParticles("FogPuff", "Sky/fx_fog", new Vector3(50f, 6f, 50f), new Vector3(0f, 2f, 0f), 14f, 18f, 28f, 120, false);
            if (_rain != null) { var rm = _rain.main; rm.startColor = new ParticleSystem.MinMaxGradient(new Color(0.85f, 0.92f, 1f, 0.8f)); }
            if (_fog != null) { var fm = _fog.main; fm.startColor = new ParticleSystem.MinMaxGradient(new Color(1f, 1f, 1f, 0.14f)); }
            if (_snow != null) { var v = _snow.velocityOverLifetime; v.y = new ParticleSystem.MinMaxCurve(-1.8f); }
            if (_rain != null) { var v = _rain.velocityOverLifetime; v.y = new ParticleSystem.MinMaxCurve(-32f); }
        }

        private ParticleSystem BuildParticles(string name, string texPath, Vector3 box, Vector3 offset, float life, float sizeMin, float sizeMax, int max, bool stretch)
        {
            var tex = Resources.Load<Texture2D>(texPath);
            if (tex == null) return null;
            var go = new GameObject("Fx_" + name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = offset;
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = true; main.playOnAwake = true;
            main.startLifetime = life; main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(sizeMin, sizeMax);
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = max;
            main.startRotation = stretch ? new ParticleSystem.MinMaxCurve(0f) : new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2f);
            var em = ps.emission; em.enabled = true; em.rateOverTime = 0f;
            var sh = ps.shape; sh.enabled = true; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = box;
            var vel = ps.velocityOverLifetime; vel.enabled = true; vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(0f); vel.y = new ParticleSystem.MinMaxCurve(0f); vel.z = new ParticleSystem.MinMaxCurve(0f);
            var col = ps.colorOverLifetime; col.enabled = !stretch;
            if (!stretch)
            {
                var g = new Gradient();
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                          new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.15f), new GradientAlphaKey(1f, 0.85f), new GradientAlphaKey(0f, 1f) });
                col.color = new ParticleSystem.MinMaxGradient(g);
            }
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = new Material(Shader.Find("Sprites/Default")) { name = "Weather " + name + " (generated)", mainTexture = tex };
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (stretch) { r.renderMode = ParticleSystemRenderMode.Stretch; r.lengthScale = 8f; r.velocityScale = 0.02f; }
            else r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
            return ps;
        }

        /// <summary>열린 원통(위아래 뚜껑 없음) — u 는 둘레를 uRepeat 번 감는다. 재질이 양면이라 안쪽에서 보인다.</summary>
        public static Mesh CylinderMesh(float radius, float height, int segments, float uRepeat)
        {
            var verts = new Vector3[(segments + 1) * 2];
            var uvs = new Vector2[verts.Length];
            var tris = new int[segments * 6];
            for (int i = 0; i <= segments; i++)
            {
                float a = Mathf.PI * 2f * i / segments;
                float x = Mathf.Cos(a) * radius, z = Mathf.Sin(a) * radius;
                verts[i * 2] = new Vector3(x, 0f, z); uvs[i * 2] = new Vector2((float)i / segments * uRepeat, 0f);
                verts[i * 2 + 1] = new Vector3(x, height, z); uvs[i * 2 + 1] = new Vector2((float)i / segments * uRepeat, 1f);
            }
            for (int i = 0; i < segments; i++)
            {
                int b = i * 2, t = i * 6;
                tris[t] = b; tris[t + 1] = b + 1; tris[t + 2] = b + 2;
                tris[t + 3] = b + 2; tris[t + 4] = b + 1; tris[t + 5] = b + 3;
            }
            var mesh = new Mesh { name = "CloudCylinder (generated)", vertices = verts, uv = uvs, triangles = tris };
            mesh.RecalculateBounds();
            return mesh;
        }

        // ---- 갱신 ----

        /// <summary>날씨·시간대를 다시 봐 구름 투명도·색, 입자 방출, 안개 곱을 맞춘다.</summary>
        public void Refresh()
        {
            var w = SkyWeatherRules.Current();
            var season = SkyWeatherRules.CurrentSeason();
            Kind = w.Kind;
            _windMul = w.WindMul;
            Color tod = TimeTint(SkyPanorama.TimeOf(SkyPass.HourFn()));
            for (int i = 0; i < 3; i++)
                if (_layerMats[i] != null)
                {
                    // 겹마다 살짝 다르게 — 아래 겹이 더 짙다
                    float a = Mathf.Clamp01(w.CloudAlpha * (1f - 0.12f * i));
                    _layerMats[i].color = new Color(tod.r, tod.g, tod.b, a);
                }
            SetRate(_rain, w.Rain); SetRate(_snow, w.Snow); SetRate(_fog, w.Fog);
            ApplyFog(w, season);
        }

        private static void SetRate(ParticleSystem ps, float rate)
        {
            if (ps == null) return;
            var em = ps.emission; em.rateOverTime = rate;
        }

        /// <summary>시간대별 구름 색(새벽·노을은 붉게, 밤은 어둡게).</summary>
        public static Color TimeTint(string time)
        {
            switch (time)
            {
                case "dawn": return new Color(1.00f, 0.82f, 0.70f);
                case "sunset": return new Color(1.00f, 0.66f, 0.50f);
                case "night": return new Color(0.28f, 0.34f, 0.55f);
                default: return Color.white;
            }
        }

        private void ApplyFog(SkyWeatherRules.Weather w, SkyWeatherRules.Season s)
        {
            if (!RenderSettings.fog) return;
            if (!_fogCaptured) { _fogBaseDensity = RenderSettings.fogDensity; _fogBaseColor = RenderSettings.fogColor; _fogCaptured = true; }
            RenderSettings.fogDensity = _fogBaseDensity * w.FogMul;
            RenderSettings.fogColor = new Color(
                Mathf.Clamp01(_fogBaseColor.r * w.Tint.r * s.Ambient.r),
                Mathf.Clamp01(_fogBaseColor.g * w.Tint.g * s.Ambient.g),
                Mathf.Clamp01(_fogBaseColor.b * w.Tint.b * s.Ambient.b));
        }

        private void RestoreFog()
        {
            if (!_fogCaptured) return;
            RenderSettings.fogDensity = _fogBaseDensity; RenderSettings.fogColor = _fogBaseColor; _fogCaptured = false;
        }

        private void LateUpdate()
        {
            if (_cam == null) _cam = Camera.main;
            if (_cam != null) transform.position = _cam.transform.position;
            for (int i = 0; i < 3; i++)
                if (_layers[i] != null) _layers[i].Rotate(0f, SpinDegPerSec[i] * _windMul * Time.deltaTime, 0f, Space.World);
        }
    }
}
