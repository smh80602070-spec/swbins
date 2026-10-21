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
            new Weather { Kind = Kind.Snow, NameKo = "눈", NameEn = "Snow", FogMul = 1.2f, Tint = new Color(1.02f, 1.02f, 1.08f), CloudAlpha = 0.90f, WindMul = 1f, Snow = 400f },
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
    /// U-0047 하늘 위 구름 3겹·날씨 입자(비·눈·안개)·안개 농도/색 — `SkyPass.Runner` 가 하늘을 입히는 씬(사가만리 마을·사가마을·사가종횡)에 세운다.
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
        private float _fogBaseDensity, _fogWeatherDensity;
        private Color _fogBaseColor;
        private float _windMul = 1f;
        private bool _clouds = true;
        /// <summary>진단 — 원통 구름을 세웠나(하늘 판) / 입자만인가(5천하).</summary>
        public bool CloudsBuilt => _clouds;

        public SkyWeatherRules.Kind Kind { get; private set; }
        public int LayerCount { get { int n = 0; foreach (var l in _layers) if (l != null) n++; return n; } }
        public float CloudAlpha(int i) => _layerMats[i] != null ? _layerMats[i].color.a : -1f;
        public float RainRate => _rain != null ? _rain.emission.rateOverTime.constant : -1f;
        public float SnowRate => _snow != null ? _snow.emission.rateOverTime.constant : -1f;
        public float FogRate => _fog != null ? _fog.emission.rateOverTime.constant : -1f;
        public bool HasParticles => _rain != null && _snow != null && _fog != null;

        /// <summary>씬에 하나 세운다(이미 있으면 그대로). 끄기 환경변수가 있으면 null.</summary>
        public static SkyWeather Install(Camera cam, bool clouds = true)
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
            sw._clouds = clouds; // tasks U-0149 — 하늘이 안 보이는 판(5천하 빛만)은 원통 구름 없이 비·눈·안개 입자만
            if (cam != null) go.transform.position = cam.transform.position;   // U-0117 미리 채운 눈(월드 좌표)이 원점 말고 카메라 둘레에 생기게
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
            for (int i = 0; i < 3 && _clouds; i++)
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
            _snow = BuildParticles("Snow", "Sky/fx_snow", new Vector3(40f, 0.5f, 40f), new Vector3(0f, 6f, 0f), 10f, 0.3f, 0.45f, 4800, false);   // U-0116 촬영: 위 14m 에선 내려다보는 카메라(1만리 35°·3마을 62°)에 사라질 때만 보여 6m·10초(카메라 밑 12m 까지)·크게
            _fog = BuildParticles("FogPuff", "Sky/fx_fog", new Vector3(50f, 6f, 50f), new Vector3(0f, 2f, 0f), 14f, 18f, 28f, 120, false);
            if (_rain != null) { var rm = _rain.main; rm.startColor = new ParticleSystem.MinMaxGradient(new Color(0.85f, 0.92f, 1f, 0.8f)); }
            if (_fog != null) { var fm = _fog.main; fm.startColor = new ParticleSystem.MinMaxGradient(new Color(1f, 1f, 1f, 0.22f)); }   // U-0116 0.14 는 덩이가 안 보임
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
            r.sharedMaterial = (name == "FogPuff" ? SoftPuffMaterial(tex) : null) ?? new Material(Shader.Find("Sprites/Default")) { name = "Weather " + name + " (generated)", mainTexture = tex };
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (stretch) { r.renderMode = ParticleSystemRenderMode.Stretch; r.lengthScale = 8f; r.velocityScale = 0.02f; }
            else r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
            return ps;
        }

        /// <summary>U-0119 — 안개 덩이만 URP 소프트 파티클(`Particles/Unlit`, 투명 알파 블렌드, 정점색 곱). `Sprites/Default` 는 깊이를 안 봐
        /// 18~28m 판이 땅을 뚫는 자리가 둥근 선으로 잘렸다(U-0118 3마을). 깊이 텍스처는 URP 자산이 이미 켬(`m_RequireDepthTexture: 1`).
        /// 판 픽셀과 그 뒤 땅의 거리가 0→SoftFarFade m 사이면 알파가 0→1 로 오른다. 셰이더가 없으면 null(호출부가 `Sprites/Default`).</summary>
        public const float SoftFarFade = 3f;
        private static Material SoftPuffMaterial(Texture2D tex)
        {
            var sh = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (sh == null) { Debug.LogWarning("[SkyWeather] URP Particles/Unlit 없음 — 안개 덩이는 Sprites/Default(땅 닿는 선 생김)"); return null; }
            var m = new Material(sh) { name = "Weather FogPuff soft (generated)" };
            m.SetTexture("_BaseMap", tex); m.mainTexture = tex;
            m.SetColor("_BaseColor", Color.white);
            m.SetFloat("_Surface", 1f); m.SetFloat("_Blend", 0f); m.SetFloat("_ColorMode", 0f); m.SetFloat("_Cull", 0f); m.SetFloat("_AlphaClip", 0f);
            m.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha); m.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_SrcBlendAlpha", (float)UnityEngine.Rendering.BlendMode.One); m.SetFloat("_DstBlendAlpha", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_ZWrite", 0f);
            m.SetOverrideTag("RenderType", "Transparent");
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            m.SetFloat("_SoftParticlesEnabled", 1f);
            m.SetFloat("_SoftParticlesNearFadeDistance", 0f); m.SetFloat("_SoftParticlesFarFadeDistance", SoftFarFade);
            m.SetVector("_SoftParticleFadeParams", new Vector4(0f, 1f / SoftFarFade, 0f, 0f));   // URP ParticleGUI 와 같은 꼴(x near, y 1/(far-near))
            m.EnableKeyword("_SOFTPARTICLES_ON");
            m.SetFloat("_CameraFadingEnabled", 0f);   // 카메라 가까이 페이드(_FADING_ON)는 안 씀 — 소프트 계산은 _SOFTPARTICLES_ON 만으로 돈다
            return m;
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
            // U-0083 — 사실 하늘(Saga/SkyReal)이면 구름은 하늘 셰이더가 그린다: 날씨 덮개만 넘기고 원통 구름 세 겹은 끈다(그림 하늘일 때만 켬)
            bool realSky = SkyPass.RealSkyMaterial != null;
            SkyPass.SetSkyWeather(w.CloudAlpha, SkyPass.OvercastOf(w.Kind), w.WindMul);
            for (int i = 0; i < 3; i++)
                if (_layers[i] != null) _layers[i].GetComponent<MeshRenderer>().enabled = !realSky;
            for (int i = 0; i < 3; i++)
                if (_layerMats[i] != null)
                {
                    // 겹마다 살짝 다르게 — 아래 겹이 더 짙다
                    float a = Mathf.Clamp01(w.CloudAlpha * (1f - 0.12f * i));
                    _layerMats[i].color = new Color(tod.r, tod.g, tod.b, a);
                }
            PlaceFogPuffs();   // U-0118 미리 채운 덩이도 땅 위에 생기게(채우기 전에)
            SetRate(_rain, w.Rain); SetRate(_snow, w.Snow, true); SetRate(_fog, w.Fog, true);
            ApplyFog(w, season);
        }

        /// <param name="fill">U-0117 — 0 에서 켜질 때 수명만큼 미리 돌려 채운다. 눈은 카메라 위 6m 에서 초당 1.8m 로 내려 빈 하늘에서 시작하면
        /// 화면에 닿기까지 3~5초가 걸린다(촬영 로그: 4종횡 첫 장 입자 699 · 1만리 2006, 안정 4000 — 4종횡은 200fps 라 첫 장까지 1.7초뿐).</param>
        private static void SetRate(ParticleSystem ps, float rate, bool fill = false)
        {
            if (ps == null) return;
            var em = ps.emission;
            bool wasOff = em.rateOverTime.constant <= 0f;
            em.rateOverTime = rate;
            if (fill && wasOff && rate > 0f) { ps.Simulate(ps.main.startLifetime.constantMax, true, true); ps.Play(); }
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
            _fogWeatherDensity = _fogBaseDensity * w.FogMul;
            RenderSettings.fogDensity = _fogWeatherDensity;
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

        /// <summary>U-0118 — 덩이 방출 상자를 카메라 아래 땅 + 2m 에(월드 시뮬이라 상자만 옮기면 된다). 땅을 못 찾으면 뿌리 + 2m.
        /// 3마을 촬영 로그: 카메라 y13.3 → 덩이 y15.3(카메라 위)이라 내려다보는 화면에 하나도 안 들어왔다.</summary>
        private void PlaceFogPuffs()
        {
            if (_fog == null) return;
            var t = _fog.transform;
            if (_cam != null && Physics.Raycast(_cam.transform.position, Vector3.down, out var hit, 60f, ~0, QueryTriggerInteraction.Ignore))
                t.position = new Vector3(_cam.transform.position.x, hit.point.y + 2f, _cam.transform.position.z);
            else t.localPosition = new Vector3(0f, 2f, 0f);
        }

        /// <summary>U-0118 — 안개 날씨에 카메라가 내려다볼 때(pitch ≥ 50°, 3마을 62°)만 농도 하한: 시선 중앙의 땅까지 거리 d 에서 안개 30%
        /// (지수² `sqrt(-ln 0.7)/d`). 촬영: 3마을 d≈15m 에서 날씨 농도 0.0084 → 안개 1.4% 라 맑음과 같았다. 1만리 35°·4종횡(옆, 씬 안개 꺼짐)은 안 걸린다.</summary>
        public const float LookDownPitch = 50f, LookDownFogAt = 0.30f;
        private void LookDownFogFloor()
        {
            if (!_fogCaptured || !RenderSettings.fog || Kind != SkyWeatherRules.Kind.Fog || _cam == null) return;
            float dens = _fogWeatherDensity;
            var ct = _cam.transform;
            float pitch = Vector3.Angle(Vector3.ProjectOnPlane(ct.forward, Vector3.up), ct.forward) * (ct.forward.y < 0f ? 1f : -1f);
            if (pitch >= LookDownPitch)
            {
                float d = Physics.Raycast(ct.position, ct.forward, out var hit, 80f, ~0, QueryTriggerInteraction.Ignore) ? hit.distance : 0f;
                if (d < 1f) { float h = transform.position.y - _fog.transform.position.y + 2f; d = h > 1f ? h / Mathf.Sin(pitch * Mathf.Deg2Rad) : 0f; }
                if (d >= 1f)
                {
                    float k = -Mathf.Log(1f - LookDownFogAt);
                    float floor = RenderSettings.fogMode == FogMode.ExponentialSquared ? Mathf.Sqrt(k) / d : RenderSettings.fogMode == FogMode.Exponential ? k / d : 0f;
                    dens = Mathf.Max(dens, floor);
                }
            }
            RenderSettings.fogDensity = dens;
        }

        private void LateUpdate()
        {
            if (_cam == null) _cam = Camera.main;
            if (_cam != null) transform.position = _cam.transform.position;
            PlaceFogPuffs();
            LookDownFogFloor();
            for (int i = 0; i < 3; i++)
                if (_layers[i] != null) _layers[i].Rotate(0f, SpinDegPerSec[i] * _windMul * Time.deltaTime, 0f, Space.World);
        }
    }
}
