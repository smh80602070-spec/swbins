using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// U-0041 — 사가고 마을 씬(`SkyFogBuilder` 가 있는 씬)이 켜지면 컴퓨터 시계 시각에 맞춰 K-0034 하늘 파노라마를 입힌다
    /// (카메라 배경이 단색이던 것을 하늘로). 씬은 안 고친다. 끄기: 환경변수 `SAGA_NO_SKY=1`. 배치 모드(헤드리스 진단)는 기본 꺼짐(켜려면 `SAGA_SKY=1`).
    /// 시각이 바뀌면(다음 시간대) 한 번 더 바꾼다. 시대는 현재(`present`) 고정 — 지역별 시대 연결은 후속.
    /// 하늘을 입힐 때 씬의 `Sun`(방향성 조명) 방향을 하늘 그림 속 해(밤엔 달) 자리(`sky_markers.json`, K-0067)로 돌리고 시간대에 맞춰 색·세기를 바꾼다.
    /// 해가 지평선에 너무 낮으면 고도 <see cref="MinPitch"/>° 로 끌어올린다(그림자가 끝없이 길어지지 않게). 방위·`RimLight`·앰비언트는 안 건드린다. 조명만 끄기: `SAGA_NO_SKYLIGHT=1`.
    /// </summary>
    public static class GoSkyPass
    {
        public static bool Enabled = true;
        public static Func<int> HourFn = () => DateTime.Now.Hour; // 진단·촬영이 시각을 붙든다
        public static string Era = "present";
        public static bool LightEnabled = true;
        public const float MinPitch = 10f;

        /// <summary>시간대별 조명 색·세기 배율(씬 기본 `Sun` 세기에 곱한다) — 새벽·노을은 주황, 낮은 밝게, 밤은 달빛으로 어둡게.</summary>
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

        /// <summary>씬의 `Sun`(이름 "Sun" 인 방향성 조명).</summary>
        public static Light FindSun()
        {
            foreach (var l in UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
                if (l.type == LightType.Directional && l.name == "Sun") return l;
            return null;
        }

        /// <summary>하늘 이름(`sky_noon_present`)에 맞춰 `Sun` 을 돌리고 색·세기를 바꾼다. 표식·`Sun` 이 없으면 거짓이고 아무것도 안 바꾼다. 적용한 방향(해를 향한)을 `dir` 로.</summary>
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
            var go = new GameObject("GoSkyPass") { hideFlags = HideFlags.HideAndDontSave };
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
                if (UnityEngine.Object.FindFirstObjectByType<SkyFogBuilder>() == null) yield break; // 사가고 마을 씬만
                string applied = null;
                var wait = new WaitForSeconds(60f);
                while (true)
                {
                    string want = SkyPanorama.NameFor(HourFn(), Era);
                    if (want != applied && SkyPanorama.Apply(want, Camera.main))
                    {
                        applied = want;
                        if (LightEnabled && Environment.GetEnvironmentVariable("SAGA_NO_SKYLIGHT") != "1") ApplyLight(want, out _);   // 하늘 속 해 자리로 Sun 맞춤(K-0067)
                    }
                    yield return wait;
                }
            }
        }
    }
}
