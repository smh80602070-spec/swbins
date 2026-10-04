using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using Saga.Core.Region;

namespace Saga.Core
{
    /// <summary>
    /// U-0022 단계 3 — 씬이 켜진 뒤 그 씬의 GLB·표준 재질을 툰(`Saga/CelToon`)으로 바꾼다. 씬 파일·GLB 원본은 안 고친다
    /// (메모리 재질만 갈아 끼움 — 되돌리기 = 이 패스를 끄기). 바꾸는 규칙은 지역 로더와 같은 <see cref="RegionMaterials.FromGltf"/>
    /// (반투명은 그대로, 스스로 빛나는 재질은 Unlit). 파티클·트레일·선 렌더러와 이미 툰·특수 셰이더는 건드리지 않는다.
    ///
    /// 끄기: 환경변수 `SAGA_NO_TOON=1`, 또는 코드에서 <see cref="Enabled"/> = false.
    /// 배치 모드(헤드리스 진단)는 기본으로 안 돈다 — 진단이 원래 재질 값을 읽기 때문. 켜려면 `SAGA_TOON=1`.
    /// Start 에서 만들어지는 물체까지 잡으려고 씬이 켜진 첫 프레임에 한 번, 두 프레임 뒤 한 번 더 훑는다(이미 툰이면 그대로라 값싸다).
    /// </summary>
    public static class ToonScenePass
    {
        public static bool Enabled = true;

        // 바꿀 수 있는 셰이더만 — glTFast(Shader Graph)·URP 표준. 땅·하늘·유리·툰 같은 특수 셰이더는 그대로.
        private static readonly HashSet<string> Convertible = new HashSet<string>
        {
            "Shader Graphs/glTF-pbrMetallicRoughness", "Shader Graphs/glTF-unlit",
            "Universal Render Pipeline/Lit", "Universal Render Pipeline/Simple Lit", "Universal Render Pipeline/Baked Lit",
        };

        private static UnityEngine.Events.UnityAction<Scene, LoadSceneMode> _handler;

        public struct Stats { public int renderers, slots, converted, kept; }

        public static bool ActiveByEnvironment()
        {
            if (!Enabled) return false;
            if (System.Environment.GetEnvironmentVariable("SAGA_NO_TOON") == "1") return false;
            if (Application.isBatchMode && System.Environment.GetEnvironmentVariable("SAGA_TOON") != "1") return false;
            return true;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (!ActiveByEnvironment()) return;
            var go = new GameObject("ToonScenePass") { hideFlags = HideFlags.HideAndDontSave };
            Object.DontDestroyOnLoad(go);
            var runner = go.AddComponent<Runner>();
            // 도메인 리로드를 끈 에디터 Play 는 정적 값이 남는다 — 앞 Play 의 구독(파괴된 runner)을 먼저 뗀다.
            if (_handler != null) SceneManager.sceneLoaded -= _handler;
            _handler = (scene, mode) => runner.Schedule(scene);
            SceneManager.sceneLoaded += _handler;
            runner.Schedule(SceneManager.GetActiveScene());
        }

        private sealed class Runner : MonoBehaviour
        {
            public void Schedule(Scene scene) => StartCoroutine(Pass(scene));

            private IEnumerator Pass(Scene scene)
            {
                ApplyTo(scene);
                yield return null; yield return null;
                if (scene.isLoaded) ApplyTo(scene);
            }
        }

        /// <summary>한 씬의 렌더러 재질을 바꾼다. 반환 = 훑은 수·바꾼 칸·그대로 둔 칸.</summary>
        public static Stats ApplyTo(Scene scene)
        {
            var st = new Stats();
            var cache = new Dictionary<Material, Material>();
            var mats = new List<Material>();
            foreach (var root in scene.GetRootGameObjects())
            {
                foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                {
                    if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                    st.renderers++;
                    r.GetSharedMaterials(mats);
                    bool any = false;
                    for (int i = 0; i < mats.Count; i++)
                    {
                        var src = mats[i];
                        if (src == null) continue;
                        st.slots++;
                        if (src.shader == null || !Convertible.Contains(src.shader.name)) { st.kept++; continue; }
                        var made = RegionMaterials.FromGltf(src, cache, out _);
                        if (made == null || made == src) { st.kept++; continue; }
                        mats[i] = made; any = true; st.converted++;
                    }
                    if (any) r.SetSharedMaterials(mats);
                }
            }
            return st;
        }
    }
}
