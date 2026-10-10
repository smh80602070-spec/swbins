using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Saga.Core
{
    /// <summary>
    /// U-0041 — 야외 씬이 켜지면 컴퓨터 시계 시각에 맞춰 K-0034 하늘 파노라마를 입히고(카메라 배경이 단색이던 것을 하늘로),
    /// 씬의 주 조명(방향성·그림자 있는 "Sun"/"Light")을 하늘 속 해(밤엔 달) 자리(`sky_markers.json`, K-0067)로 돌린다. 씬 파일은 안 고친다(메모리만).
    /// 씬마다 방식(<see cref="ModeFor"/>): 사가만리 마을(`TestVillage`)·사가마을(`TestVillageForest`)·사가종횡(`TestField`) = 하늘+조명 /
    /// 사가천하 도시(`TestCity`, 위에서 내려다보는 전략 화면이라 하늘이 안 보임) = 조명만 / 던전(실내)·그 밖 = 안 건드림.
    /// 끄기: 환경변수 `SAGA_NO_SKY=1`(전부) · `SAGA_NO_SKYLIGHT=1`(조명만). 배치 모드(헤드리스 진단)는 기본 꺼짐(켜려면 `SAGA_SKY=1`).
    /// 시각이 바뀌면(다음 시간대) 한 번 더 바꾼다. 시대는 현재(`present`) 고정 — 지역별 시대 연결은 후속.
    /// 해가 지평선에 너무 낮으면 조명 고도를 <see cref="MinPitch"/>° 로 끌어올린다(그림자가 끝없이 길어지지 않게). 방위·`RimLight`·앰비언트는 안 건드린다.
    /// U-0083 — 기본은 그림 대신 사실 하늘 셰이더(`Saga/SkyReal`): 해·달 방향을 시각에서 계산(<see cref="SunDirAt"/>, 옛 표식과 같은 규칙 — 아침 동쪽 +X·정오 남쪽 −Z 62°·저녁 서쪽 −X)해
    /// 하늘 원반과 주 조명에 같이 쓴다. 그림 파노라마는 `SAGA_SKY_PANO=1` 일 때만(비교·되돌리기). 앰비언트 방식(Trilight)은 그대로, 반사(DynamicGI)는 시간대가 바뀔 때만 다시 굽는다.
    /// </summary>
    public static class SkyPass
    {
        public enum Mode { None, SkyAndLight, LightOnly }

        public static bool Enabled = true;
        public static bool LightEnabled = true;
        public static Func<int> HourFn = () => DateTime.Now.Hour; // 진단·촬영이 시각을 붙든다
        public static string Era = "present";
        public const float MinPitch = 10f;
        /// <summary>분까지 — 기본은 벽시계 분, 진단·촬영이 <see cref="HourFn"/> 을 붙들면 0(정각, 재현 가능).</summary>
        public static Func<float> MinuteFracFn = () => DateTime.Now.Minute / 60f;
        private static readonly Func<int> DefaultHourFn = HourFn;
        public static float HourNow() => HourFn() + (HourFn == DefaultHourFn ? MinuteFracFn() : 0f);

        public const string RealSkyShader = "Saga/SkyReal";
        /// <summary>해가 뜨고 지는 시각과 한낮 고도 — 옛 표식(정오 62°)과 맞춘 값.</summary>
        public const float Sunrise = 6f, Sunset = 18f, NoonElevation = 62f;

        public static bool UsePanorama => Environment.GetEnvironmentVariable("SAGA_SKY_PANO") == "1";

        /// <summary>시각(0~24, 소수) → 해를 향한 월드 방향. 해 뜨기 전·진 뒤는 지평선 아래(y&lt;0). 순수 함수.</summary>
        public static Vector3 SunDirAt(float hour)
        {
            float x = (Mathf.Repeat(hour, 24f) - Sunrise) / (Sunset - Sunrise);   // 0 해 뜸 → 1 해 짐(밖이면 아래)
            float phi = x * Mathf.PI;
            float el = NoonElevation * Mathf.Deg2Rad * Mathf.Sin(phi);
            var h = new Vector3(Mathf.Cos(phi), 0f, -Mathf.Sin(phi));
            if (x < 0f || x > 1f) el = -Mathf.Abs(el) - 0.05f;                    // 밤 — 지평선 아래에 둔다
            return new Vector3(h.x * Mathf.Cos(el), Mathf.Sin(el), h.z * Mathf.Cos(el)).normalized;
        }

        /// <summary>달 — 해와 열두 시간 어긋난 같은 길(밤 22시면 높이 떠 있다).</summary>
        public static Vector3 MoonDirAt(float hour) => SunDirAt(hour + 12f);

        /// <summary>그 시각 주 조명이 향할 빛원 방향 — 밤이면 달, 아니면 해(새벽 해가 아직 아래여도 해 쪽 방위).</summary>
        public static Vector3 LightSourceAt(float hour) => SkyPanorama.TimeOf(Mathf.FloorToInt(Mathf.Repeat(hour, 24f))) == "night" ? MoonDirAt(hour) : SunDirAt(hour);

        /// <summary>씬 이름 → 방식. 모르는 씬은 안 건드린다.</summary>
        public static Mode ModeFor(string sceneName)
        {
            switch (sceneName)
            {
                case "TestVillage":        // 사가만리
                case "TestVillageForest":  // 사가마을
                case "TestField":          // 사가종횡
                    return Mode.SkyAndLight;
                case "TestCity":           // 사가천하(전략 화면 — 하늘 안 보임)
                    return Mode.LightOnly;
                default:
                    return Mode.None;
            }
        }

        /// <summary>시간대별 조명 색·세기 배율(씬 기본 주 조명 세기에 곱한다) — 새벽·노을은 주황, 낮은 밝게, 밤은 달빛으로 어둡게.</summary>
        public static void LookFor(string time, out Color color, out float intensityMul)
        {
            switch (time)
            {
                case "dawn": color = new Color(1.00f, 0.78f, 0.60f); intensityMul = 0.9f; break;
                case "sunset": color = new Color(1.00f, 0.60f, 0.36f); intensityMul = 0.95f; break;
                case "night": color = new Color(0.55f, 0.65f, 1.00f); intensityMul = 0.35f; break;
                default: color = new Color(1.00f, 0.95f, 0.86f); intensityMul = 1.1f; break; // noon
            }
        }

        private static Light _sun;
        private static float _baseIntensity;

        /// <summary>씬의 주 조명 — 방향성이고 그림자가 켜져 있으며 `RimLight` 가 아닌 것(없으면 이름이 "Sun" 인 방향성 조명).</summary>
        public static Light FindSun()
        {
            Light named = null;
            foreach (var l in UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
            {
                if (l.type != LightType.Directional || l.name == "RimLight") continue;
                if (l.shadows != LightShadows.None) return l;
                if (l.name == "Sun") named = l;
            }
            return named;
        }

        /// <summary>하늘 이름(`sky_noon_present`)에 맞춰 주 조명을 돌리고 색·세기를 바꾼다. 표식·조명이 없으면 거짓이고 아무것도 안 바꾼다. 적용한 방향(해를 향한)을 `dir` 로.</summary>
        public static bool ApplyLight(string skyName, out Vector3 dir)
        {
            dir = Vector3.up;
            if (FindSun() == null || !SkyPanorama.TrySun(skyName, out dir, out _)) return false;
            string[] parts = skyName.Split('_');
            return ApplyLightDir(dir, parts.Length > 1 ? parts[1] : "noon", out dir);
        }

        /// <summary>U-0083 — 시각 공식으로 주 조명을 돌린다(사실 하늘 경로). 적용한 방향(빛원을 향한, 고도 보정 뒤)을 `dir` 로.</summary>
        public static bool ApplyLightAt(float hour, out Vector3 dir)
        {
            dir = Vector3.up;
            if (FindSun() == null) return false;
            return ApplyLightDir(LightSourceAt(hour), SkyPanorama.TimeOf(Mathf.FloorToInt(Mathf.Repeat(hour, 24f))), out dir);
        }

        private static bool ApplyLightDir(Vector3 src, string time, out Vector3 dir)
        {
            dir = src;
            var sun = FindSun();
            if (sun == null) return false;
            if (sun != _sun) { _sun = sun; _baseIntensity = sun.intensity; }
            float el = Mathf.Asin(Mathf.Clamp(dir.y, -1f, 1f)) * Mathf.Rad2Deg;
            if (el < MinPitch)
            {
                var h = new Vector3(dir.x, 0f, dir.z);
                h = h.sqrMagnitude < 1e-6f ? Vector3.forward : h.normalized;
                float pr = MinPitch * Mathf.Deg2Rad;
                dir = new Vector3(h.x * Mathf.Cos(pr), Mathf.Sin(pr), h.z * Mathf.Cos(pr));
            }
            sun.transform.rotation = Quaternion.LookRotation(-dir);
            LookFor(time, out var color, out float mul);
            sun.color = color;
            sun.intensity = _baseIntensity * mul;
            return true;
        }

        private static Material _realSky;

        /// <summary>U-0083 — 사실 하늘을 입히고 해·달 방향을 넘긴다. `rebake` 면 반사·주변 환경을 다시 굽는다(시간대가 바뀔 때만).
        /// 셰이더가 없으면 거짓이고 아무것도 안 바꾼다.</summary>
        public static bool ApplyRealSky(float hour, Camera camera, bool rebake)
        {
            if (_realSky == null)
            {
                _realSky = Saga.Core.Region.RegionMaterials.Make("SkyReal");
                if (_realSky == null || _realSky.shader.name != RealSkyShader) { _realSky = null; return false; }
            }
            _realSky.SetVector("_SunDir", SunDirAt(hour));
            _realSky.SetVector("_MoonDir", MoonDirAt(hour));
            if (RenderSettings.skybox != _realSky) { RenderSettings.skybox = _realSky; rebake = true; }
            if (SkyWeather.Instance != null) SkyWeather.Instance.Refresh();   // 날씨 덮개 + 원통 구름 끔
            else { var w = SkyWeatherRules.Current(); SetSkyWeather(w.CloudAlpha, OvercastOf(w.Kind), w.WindMul); }
            if (camera != null) camera.clearFlags = CameraClearFlags.Skybox;
            if (rebake && Application.isPlaying) DynamicGI.UpdateEnvironment();
            return true;
        }

        /// <summary>날씨 → 하늘 잿빛 정도(비·눈 0.8 · 흐림 0.45 · 안개 0.35 · 그 밖 0).</summary>
        public static float OvercastOf(SkyWeatherRules.Kind k) =>
            k == SkyWeatherRules.Kind.Rain || k == SkyWeatherRules.Kind.Snow ? 0.8f : k == SkyWeatherRules.Kind.Cloud ? 0.45f : k == SkyWeatherRules.Kind.Fog ? 0.35f : 0f;

        /// <summary>날씨 덮개 — 구름 양·흐림(잿빛)·바람. SkyWeather.Refresh 도 부른다. 사실 하늘이 없으면 아무것도 안 함.</summary>
        public static void SetSkyWeather(float cloudCover, float overcast, float wind)
        {
            if (_realSky == null) return;
            _realSky.SetFloat("_CloudCover", Mathf.Clamp01(cloudCover));
            _realSky.SetFloat("_Overcast", Mathf.Clamp01(overcast));
            _realSky.SetFloat("_Wind", wind);
        }

        /// <summary>지금 입힌 사실 하늘 재질(없으면 null) — 진단·촬영용.</summary>
        public static Material RealSkyMaterial => _realSky != null && RenderSettings.skybox == _realSky ? _realSky : null;

        public static bool ActiveByEnvironment()
        {
            if (!Enabled) return false;
            if (Environment.GetEnvironmentVariable("SAGA_NO_SKY") == "1") return false;
            if (Application.isBatchMode && Environment.GetEnvironmentVariable("SAGA_SKY") != "1") return false;
            return true;
        }

        private static UnityEngine.Events.UnityAction<Scene, LoadSceneMode> _handler;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (!ActiveByEnvironment()) return;
            var go = new GameObject("SkyPass") { hideFlags = HideFlags.HideAndDontSave };
            UnityEngine.Object.DontDestroyOnLoad(go);
            var runner = go.AddComponent<Runner>();
            if (_handler != null) SceneManager.sceneLoaded -= _handler;
            _handler = (scene, mode) => runner.Begin();
            SceneManager.sceneLoaded += _handler;
            runner.Begin();
        }

        private sealed class Runner : MonoBehaviour
        {
            private Coroutine _co;
            public void Begin()
            {
                if (_co != null) StopCoroutine(_co);
                _co = StartCoroutine(Loop());
            }

            private IEnumerator Loop()
            {
                yield return null; yield return null; // 씬의 Awake/Start 가 끝난 뒤
                var mode = ModeFor(SceneManager.GetActiveScene().name);
                if (mode == Mode.None) yield break;
                if (mode == Mode.SkyAndLight) SkyWeather.Install(Camera.main); // U-0047 구름 3겹·계절 날씨 입자(끄기 SAGA_NO_WEATHER=1)
                string applied = null;
                var wait = new WaitForSeconds(60f);
                bool lightOn = LightEnabled && Environment.GetEnvironmentVariable("SAGA_NO_SKYLIGHT") != "1";
                bool real = !UsePanorama;
                while (true)
                {
                    string want = SkyPanorama.NameFor(HourFn(), Era);
                    if (SkyWeather.Instance != null) SkyWeather.Instance.Refresh(); // 날씨(3시간)·시간대 색이 바뀌었으면 맞춘다
                    if (real)
                    {
                        // U-0083 사실 하늘 — 해·달은 분 단위로 움직이고, 반사는 시간대가 바뀔 때만 다시 굽는다
                        float hour = HourNow();
                        bool done = mode == Mode.LightOnly || ApplyRealSky(hour, Camera.main, want != applied);
                        if (!done) real = false;                                          // 셰이더가 없으면 그림 하늘로
                        else
                        {
                            applied = want;
                            if (lightOn) ApplyLightAt(hour, out _);
                            yield return wait;
                            continue;
                        }
                    }
                    if (want != applied)
                    {
                        bool done = mode == Mode.LightOnly ? SkyPanorama.TryMarker(want, out _) : SkyPanorama.Apply(want, Camera.main);
                        if (done)
                        {
                            applied = want;
                            if (lightOn) ApplyLight(want, out _); // 하늘 속 해 자리로 주 조명 맞춤(K-0067)
                        }
                    }
                    yield return wait;
                }
            }
        }
    }
}
