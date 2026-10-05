using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Saga.Core
{
    /// <summary>
    /// U-0041 — 야외 씬이 켜지면 컴퓨터 시계 시각에 맞춰 K-0034 하늘 파노라마를 입히고(카메라 배경이 단색이던 것을 하늘로),
    /// 씬의 주 조명(방향성·그림자 있는 "Sun"/"Light")을 하늘 속 해(밤엔 달) 자리(`sky_markers.json`, K-0067)로 돌린다. 씬 파일은 안 고친다(메모리만).
    /// 씬마다 방식(<see cref="ModeFor"/>): 사가고 마을(`TestVillage`)·사가의숲(`TestVillageForest`)·사가스토리(`TestField`) = 하늘+조명 /
    /// 사가국지 도시(`TestCity`, 위에서 내려다보는 전략 화면이라 하늘이 안 보임) = 조명만 / 던전(실내)·그 밖 = 안 건드림.
    /// 끄기: 환경변수 `SAGA_NO_SKY=1`(전부) · `SAGA_NO_SKYLIGHT=1`(조명만). 배치 모드(헤드리스 진단)는 기본 꺼짐(켜려면 `SAGA_SKY=1`).
    /// 시각이 바뀌면(다음 시간대) 한 번 더 바꾼다. 시대는 현재(`present`) 고정 — 지역별 시대 연결은 후속.
    /// 해가 지평선에 너무 낮으면 조명 고도를 <see cref="MinPitch"/>° 로 끌어올린다(그림자가 끝없이 길어지지 않게). 방위·`RimLight`·앰비언트는 안 건드린다.
    /// </summary>
    public static class SkyPass
    {
        public enum Mode { None, SkyAndLight, LightOnly }

        public static bool Enabled = true;
        public static bool LightEnabled = true;
        public static Func<int> HourFn = () => DateTime.Now.Hour; // 진단·촬영이 시각을 붙든다
        public static string Era = "present";
        public const float MinPitch = 10f;

        /// <summary>씬 이름 → 방식. 모르는 씬은 안 건드린다.</summary>
        public static Mode ModeFor(string sceneName)
        {
            switch (sceneName)
            {
                case "TestVillage":        // 사가고
                case "TestVillageForest":  // 사가의숲
                case "TestField":          // 사가스토리
                    return Mode.SkyAndLight;
                case "TestCity":           // 사가국지(전략 화면 — 하늘 안 보임)
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
            var sun = FindSun();
            if (sun == null || !SkyPanorama.TrySun(skyName, out dir, out _)) return false;
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
            string[] parts = skyName.Split('_');
            LookFor(parts.Length > 1 ? parts[1] : "noon", out var color, out float mul);
            sun.color = color;
            sun.intensity = _baseIntensity * mul;
            return true;
        }

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
                while (true)
                {
                    string want = SkyPanorama.NameFor(HourFn(), Era);
                    if (SkyWeather.Instance != null) SkyWeather.Instance.Refresh(); // 날씨(3시간)·시간대 색이 바뀌었으면 맞춘다
                    if (want != applied)
                    {
                        bool done = mode == Mode.LightOnly ? SkyPanorama.TryMarker(want, out _) : SkyPanorama.Apply(want, Camera.main);
                        if (done)
                        {
                            applied = want;
                            if (LightEnabled && Environment.GetEnvironmentVariable("SAGA_NO_SKYLIGHT") != "1") ApplyLight(want, out _); // 하늘 속 해 자리로 주 조명 맞춤(K-0067)
                        }
                    }
                    yield return wait;
                }
            }
        }
    }
}
