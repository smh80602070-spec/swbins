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
    /// </summary>
    public static class GoSkyPass
    {
        public static bool Enabled = true;
        public static Func<int> HourFn = () => DateTime.Now.Hour; // 진단·촬영이 시각을 붙든다
        public static string Era = "present";

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
                    if (want != applied && SkyPanorama.Apply(want, Camera.main)) applied = want;
                    yield return wait;
                }
            }
        }
    }
}
