using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0212 비 오는 날 땅 젖음 진단(고돗 G-0359~0361 짝) — `-executeMethod Saga.EditorTools.PlaytestWetGround.Run`(-quit 없이).
    /// ① 셈: 비 20초 0→1 · 그치면 60초 1→0 · 끔(SAGA_WET=0) 이면 0 ② 재질: 색 ×0.64·거칠기 ×0.45(스무스는 1-(1-s)×0.45) · 0 이면 처음 값 그대로 ·
    /// 0.5초 묶음 갱신 · 끄면 등록 안 함 ③ 공유 에셋(.mat)을 <see cref="WetGround.Own"/> 하면 사본만 바뀌고 에셋은 그대로 ④ SkyWeather: 들어올 때 비면 1·
    /// 빛만 판(5천하)은 0 ⑤ 세 씬(1만리·3마을·4종횡) 땅 재질 등록 ≥1 · 5천하 바닥은 등록 안 함. 씬은 저장 안 함.
    /// U-0214 ⑥ 웅덩이 층: 땅 셰이더(VertexColorLit·ForestWorldCurve) 컴파일 오류 0 · <c>_Wet</c>·<c>_Rain</c> 기본 0(옛 화면) ·
    /// 비 1 = <c>_Wet</c> 1·<c>_Rain</c> 1(색 곱은 ×0.64 한 번만) · 비 그치면 <c>_Rain</c> 3초에 0(젖음은 남음) · 마르면 둘 다 0 · 겨울·끔이면 <c>_Wet</c> 0.
    /// </summary>
    public static class PlaytestWetGround
    {
        private const string Tag = "[PlaytestWetGround]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckStep();
                    CheckPuddles();
                    CheckMaterials();
                    CheckAssetUntouched();
                    CheckSkyWeather();
                    CheckScenes();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally
                {
                    WetGround.ForcedEnabled = null;
                    WetGround.ForcedNoPuddles = null;
                    WetGround.ResetAll();
                    SkyWeatherRules.ForcedWeather = null;
                    SkyWeatherRules.ForcedSeason = null;
                }
            }
            PlaytestKit.Summary("PlaytestWetGround");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static bool Near(float a, float b, float eps = 1e-4f) => Mathf.Abs(a - b) <= eps;

        private static void CheckStep()
        {
            float w = 0f;
            for (int i = 0; i < 10; i++) w = WetGround.WetStep(w, true, 1f);
            PlaytestKit.Check(Near(w, 0.5f), $"비 10초 젖음 {w} ≠ 0.5");
            for (int i = 0; i < 10; i++) w = WetGround.WetStep(w, true, 1f);
            PlaytestKit.Check(Near(w, 1f), $"비 20초 젖음 {w} ≠ 1");
            w = WetGround.WetStep(w, true, 5f);
            PlaytestKit.Check(w == 1f, "1 을 넘음");
            for (int i = 0; i < 30; i++) w = WetGround.WetStep(w, false, 1f);
            PlaytestKit.Check(Near(w, 0.5f), $"그친 뒤 30초 {w} ≠ 0.5");
            for (int i = 0; i < 30; i++) w = WetGround.WetStep(w, false, 1f);
            PlaytestKit.Check(Near(w, 0f, 1e-3f), $"그친 뒤 60초 {w} ≠ 0");
            w = WetGround.WetStep(w, false, 5f);
            PlaytestKit.Check(w == 0f, "0 아래로 내려감");

            WetGround.ResetAll();
            WetGround.ForcedEnabled = false;
            for (int i = 0; i < 40; i++) WetGround.Tick(true, 1f);
            PlaytestKit.Check(WetGround.Wet == 0f, $"SAGA_WET=0 인데 젖음 {WetGround.Wet}");
            WetGround.ForcedEnabled = null;
            Debug.Log($"{Tag} step OK - 20초 젖음·60초 마름·끔 0");
        }

        private static void CheckPuddles()
        {
            float r = 0f;
            for (int i = 0; i < 6; i++) r = WetGround.RainStep(r, true, 0.5f);
            PlaytestKit.Check(Near(r, 1f), $"물결 3초 {r} ≠ 1");
            for (int i = 0; i < 6; i++) r = WetGround.RainStep(r, false, 0.5f);
            PlaytestKit.Check(Near(r, 0f), $"그친 뒤 물결 3초 {r} ≠ 0");

            foreach (var name in new[] { "Saga/VertexColorLit", "Saga/ForestWorldCurve" })
            {
                var sh = Shader.Find(name);
                if (sh == null) { PlaytestKit.Fail($"{name} 없음"); continue; }
                PlaytestKit.Check(!ShaderUtil.ShaderHasError(sh), $"{name} 셰이더 오류");
                int errs = ShaderUtil.GetShaderMessages(sh).Count(m => m.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error);
                PlaytestKit.Check(errs == 0, $"{name} 컴파일 오류 {errs}");
            }

            WetGround.ResetAll();
            WetGround.ForcedNoPuddles = false;
            var go = new Material(Shader.Find("Saga/VertexColorLit"));
            var forest = new Material(Shader.Find("Saga/ForestWorldCurve"));
            var lit = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            try
            {
                PlaytestKit.Check(go.HasProperty("_Wet") && go.HasProperty("_Rain") && forest.HasProperty("_Wet") && forest.HasProperty("_Rain"), "땅 셰이더에 _Wet·_Rain 없음");
                PlaytestKit.Check(go.GetFloat("_Wet") == 0f && go.GetFloat("_Rain") == 0f && forest.GetFloat("_Wet") == 0f && forest.GetFloat("_Rain") == 0f,
                    "_Wet·_Rain 기본 0 아님(옛 화면이 바뀜)");
                WetGround.Register(go); WetGround.Register(forest); WetGround.Register(lit);

                WetGround.SetWet(1f);
                PlaytestKit.Check(go.GetFloat("_Wet") == 1f && go.GetFloat("_Rain") == 1f && forest.GetFloat("_Wet") == 1f && forest.GetFloat("_Rain") == 1f,
                    $"비 1 인데 _Wet {go.GetFloat("_Wet")}·_Rain {go.GetFloat("_Rain")}");
                PlaytestKit.Check(Near(go.GetColor("_BaseColor").r, 0.64f), $"웅덩이 층 붙이고 색 곱이 바뀜 {go.GetColor("_BaseColor")}");
                PlaytestKit.Check(!lit.HasProperty("_Wet"), "URP Lit 에 _Wet 이 있음(검사 전제 틀림)");

                // 비 그침 — 0.5초씩 3초: 물결 0, 젖음은 남음(60초 마름)
                for (int i = 0; i < 6; i++) WetGround.Tick(false, 0.5f);
                PlaytestKit.Check(Near(go.GetFloat("_Rain"), 0f) && go.GetFloat("_Wet") > 0.9f && Near(go.GetFloat("_Wet"), WetGround.Wet),
                    $"비 그친 3초 _Rain {go.GetFloat("_Rain")}·_Wet {go.GetFloat("_Wet")}");
                // 다시 비 — 0.5초 묶음으로 물결 1 쪽
                for (int i = 0; i < 6; i++) WetGround.Tick(true, 0.5f);
                PlaytestKit.Check(Near(go.GetFloat("_Rain"), 1f) && Near(forest.GetFloat("_Rain"), 1f), $"다시 비 3초 _Rain {go.GetFloat("_Rain")}");

                WetGround.SetWet(0f);
                PlaytestKit.Check(go.GetFloat("_Wet") == 0f && go.GetFloat("_Rain") == 0f && forest.GetFloat("_Wet") == 0f, "마른 뒤 _Wet·_Rain 이 남음");

                WetGround.ForcedNoPuddles = true;
                WetGround.SetWet(1f);
                PlaytestKit.Check(go.GetFloat("_Wet") == 0f && go.GetFloat("_Rain") == 0f && Near(go.GetColor("_BaseColor").r, 0.64f), "겨울인데 웅덩이(또는 젖음 곱 빠짐)");
                WetGround.ForcedNoPuddles = false;

                WetGround.ForcedEnabled = false;
                WetGround.SetWet(1f);
                PlaytestKit.Check(go.GetFloat("_Wet") == 0f && go.GetFloat("_Rain") == 0f, "끔인데 _Wet 이 0 아님");
                WetGround.ForcedEnabled = null;

                WetGround.SetWet(1f);
                WetGround.ResetAll();
                PlaytestKit.Check(go.GetFloat("_Wet") == 0f && forest.GetFloat("_Rain") == 0f, "ResetAll 이 _Wet·_Rain 을 안 되돌림");
                Debug.Log($"{Tag} puddle OK - _Wet 비 1·맑음 0·끄면 0·겨울 0 · _Rain 비 그치면 3초에 0·다시 비 1 · 셰이더 오류 0");
            }
            finally
            {
                WetGround.ForcedEnabled = null;
                WetGround.ForcedNoPuddles = null;
                WetGround.ResetAll();
                Object.DestroyImmediate(go); Object.DestroyImmediate(forest); Object.DestroyImmediate(lit);
            }
        }

        private static void CheckMaterials()
        {
            WetGround.ResetAll();
            var go = new Material(Shader.Find("Saga/VertexColorLit"));
            var forest = new Material(Shader.Find("Saga/ForestWorldCurve"));
            var lit = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            try
            {
                go.SetFloat("_Roughness", 0.85f);
                forest.SetColor("_BaseColor", new Color(0.35f, 0.55f, 0.25f, 1f)); forest.SetFloat("_Roughness", 0.8f);
                lit.SetColor("_BaseColor", new Color(0.5f, 0.6f, 0.7f, 1f)); lit.SetFloat("_Smoothness", 0.2f);
                var c0Go = go.GetColor("_BaseColor"); var c0F = forest.GetColor("_BaseColor"); var c0L = lit.GetColor("_BaseColor");
                PlaytestKit.Check(go.HasProperty("_BaseColor") && c0Go == Color.white, "VertexColorLit _BaseColor 기본 흰색 아님(옛 화면이 바뀜)");

                WetGround.Register(go); WetGround.Register(forest); WetGround.Register(lit); WetGround.Register(go);
                PlaytestKit.Check(WetGround.Count == 3, $"등록 수 {WetGround.Count} ≠ 3(같은 재질 두 번은 하나)");

                WetGround.SetWet(1f);
                PlaytestKit.Check(Near(go.GetColor("_BaseColor").r, 0.64f) && Near(go.GetFloat("_Roughness"), 0.85f * 0.45f), $"1만리 젖음 색 {go.GetColor("_BaseColor")}·거칠기 {go.GetFloat("_Roughness")}");
                PlaytestKit.Check(Near(forest.GetColor("_BaseColor").g, 0.55f * 0.64f) && Near(forest.GetFloat("_Roughness"), 0.8f * 0.45f), "3마을 젖음 곱 틀림");
                PlaytestKit.Check(Near(lit.GetColor("_BaseColor").b, 0.7f * 0.64f) && Near(lit.GetFloat("_Smoothness"), 1f - 0.8f * 0.45f) && lit.GetColor("_BaseColor").a == 1f,
                    $"URP Lit 젖음 스무스 {lit.GetFloat("_Smoothness")} ≠ 0.64");

                WetGround.SetWet(0f);
                PlaytestKit.Check(go.GetColor("_BaseColor") == c0Go && forest.GetColor("_BaseColor") == c0F && lit.GetColor("_BaseColor") == c0L
                    && go.GetFloat("_Roughness") == 0.85f && forest.GetFloat("_Roughness") == 0.8f && lit.GetFloat("_Smoothness") == 0.2f, "마른 뒤 처음 값과 다름");

                // 0.5초 묶음 갱신 — 0.3초 한 틱은 셈만, 0.6초째 재질에 얹힘
                WetGround.Tick(true, 0.3f);
                PlaytestKit.Check(go.GetFloat("_Roughness") == 0.85f, "0.5초 전에 재질을 고침(매 프레임 SetFloat)");
                WetGround.Tick(true, 0.3f);
                float w = WetGround.Wet;
                PlaytestKit.Check(Near(w, 0.03f) && Near(go.GetFloat("_Roughness"), 0.85f * Mathf.Lerp(1f, 0.45f, w)), $"0.6초 뒤 젖음 {w}·거칠기 {go.GetFloat("_Roughness")}");

                WetGround.SetWet(1f);
                WetGround.Unregister(go);
                PlaytestKit.Check(go.GetColor("_BaseColor") == c0Go && go.GetFloat("_Roughness") == 0.85f && !WetGround.IsRegistered(go), "등록 풀면 처음 값으로 안 돌아옴");

                WetGround.ResetAll();
                PlaytestKit.Check(forest.GetColor("_BaseColor") == c0F && lit.GetFloat("_Smoothness") == 0.2f && WetGround.Count == 0, "ResetAll 이 되돌리지 않음");

                WetGround.ForcedEnabled = false;
                WetGround.Register(forest);
                PlaytestKit.Check(WetGround.Count == 0, "끔인데 등록됨");
                WetGround.ForcedEnabled = null;
                Debug.Log($"{Tag} material OK - 색 ×0.64·거칠기 ×0.45·스무스 같은 뜻·0 이면 처음 값·0.5초 묶음");
            }
            finally
            {
                WetGround.ForcedEnabled = null;
                WetGround.ResetAll();
                Object.DestroyImmediate(go); Object.DestroyImmediate(forest); Object.DestroyImmediate(lit);
            }
        }

        private static void CheckAssetUntouched()
        {
            const string path = "Assets/Art/Environment/PBR/leafy_grass_URPLit.mat";
            var asset = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (asset == null) { PlaytestKit.Fail($"{path} 없음"); return; }
            var c0 = asset.GetColor("_BaseColor"); float s0 = asset.GetFloat("_Smoothness");
            var holder = GameObject.CreatePrimitive(PrimitiveType.Quad);
            try
            {
                var r = holder.GetComponent<MeshRenderer>();
                r.sharedMaterial = asset;
                var own = WetGround.Own(r);
                WetGround.SetWet(1f);
                PlaytestKit.Check(own != null && own != asset && r.sharedMaterial == own && WetGround.IsRegistered(own) && !WetGround.IsRegistered(asset), "공유 에셋을 사본으로 안 바꿈");
                PlaytestKit.Check(asset.GetColor("_BaseColor") == c0 && asset.GetFloat("_Smoothness") == s0 && !EditorUtility.IsDirty(asset), "젖음이 에셋 .mat 을 고침");
                PlaytestKit.Check(own != null && Near(own.GetColor("_BaseColor").r, c0.r * 0.64f), "사본이 안 젖음");
                PlaytestKit.Check(WetGround.Own(r) == own, "두 번 Own 하면 사본이 또 생김");
                Debug.Log($"{Tag} asset OK - 공유 .mat 그대로·사본만 젖음");
            }
            finally
            {
                var m = holder.GetComponent<MeshRenderer>().sharedMaterial;
                WetGround.ResetAll();
                Object.DestroyImmediate(holder);
                if (m != null && m != asset) Object.DestroyImmediate(m);
            }
        }

        private static void CheckSkyWeather()
        {
            var camGo = new GameObject("PlaytestWetGroundCam");
            var cam = camGo.AddComponent<Camera>();
            bool fog = RenderSettings.fog; float dens = RenderSettings.fogDensity; var fc = RenderSettings.fogColor;
            try
            {
                if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                SkyWeatherRules.ForcedSeason = "summer";
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Rain;
                var sw = SkyWeather.Install(cam);
                if (sw == null) { PlaytestKit.Fail("SkyWeather 가 안 섬(SAGA_NO_WEATHER?)"); return; }
                PlaytestKit.Check(sw.RainWets && WetGround.Wet == 1f, $"비로 들어왔는데 젖음 {WetGround.Wet}");
                sw.Teardown();
                PlaytestKit.Check(WetGround.Wet == 0f, "날씨를 치웠는데 젖음이 남음");

                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Clear;
                sw = SkyWeather.Install(cam);
                PlaytestKit.Check(!sw.RainWets && WetGround.Wet == 0f, "맑음으로 들어왔는데 젖음");
                sw.Teardown();

                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Rain;
                sw = SkyWeather.Install(cam, clouds: false);
                PlaytestKit.Check(!sw.RainWets && WetGround.Wet == 0f, "5천하(빛만) 비에 땅이 젖음");
                sw.Teardown();
                Debug.Log($"{Tag} sky OK - 비로 들어오면 1·맑음 0·빛만 판 0·치우면 0");
            }
            finally
            {
                if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                Object.DestroyImmediate(camGo);
                RenderSettings.fog = fog; RenderSettings.fogDensity = dens; RenderSettings.fogColor = fc;
                SkyWeatherRules.ForcedWeather = null; SkyWeatherRules.ForcedSeason = null;
            }
        }

        private static void CheckScenes()
        {
            WetGround.ResetAll();
            // 1만리
            var s = EditorSceneManager.OpenScene("Assets/Scenes/TestVillage.unity");
            var tb = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Go.World.TerrainBuilder>(true)).FirstOrDefault();
            if (tb == null) PlaytestKit.Fail("1만리 TerrainBuilder 없음");
            else
            {
                tb.Build();
                var m = tb.GetComponent<MeshRenderer>().sharedMaterial;
                PlaytestKit.Check(WetGround.IsRegistered(m), "1만리 땅 재질 등록 안 됨");
                // U-0214 1만리 땅이 웅덩이 층 셰이더면 비 1 에 _Wet 1
                if (m != null && m.HasProperty("_Wet"))
                {
                    WetGround.ForcedNoPuddles = false;
                    WetGround.SetWet(1f);
                    PlaytestKit.Check(m.GetFloat("_Wet") == 1f && m.GetFloat("_Rain") == 1f, $"1만리 땅 _Wet {m.GetFloat("_Wet")}");
                    WetGround.SetWet(0f);
                    PlaytestKit.Check(m.GetFloat("_Wet") == 0f, "1만리 땅 마른 뒤 _Wet 남음");
                    WetGround.ForcedNoPuddles = null;
                    Debug.Log($"{Tag} go ground puddle OK - {m.shader.name}");
                }
                else Debug.Log($"{Tag} go ground no puddle layer - {(m != null ? m.shader.name : "null")}");
            }
            int go = WetGround.Count;

            WetGround.ResetAll();
            s = EditorSceneManager.OpenScene("Assets/Scenes/TestVillageForest.unity");
            var fb = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Forest.World.ForestGroundBuilder>(true)).FirstOrDefault();
            if (fb == null) PlaytestKit.Fail("3마을 ForestGroundBuilder 없음");
            else
            {
                fb.Build();
                PlaytestKit.Check(WetGround.IsRegistered(fb.GetComponent<MeshRenderer>().sharedMaterial), "3마을 땅 재질 등록 안 됨");
            }
            int forest = WetGround.Count;

            WetGround.ResetAll();
            s = EditorSceneManager.OpenScene("Assets/Scenes/TestField.unity");
            var sb = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Story.World.StoryTerrainBuilder>(true)).FirstOrDefault();
            if (sb == null) PlaytestKit.Fail("4종횡 StoryTerrainBuilder 없음");
            else
            {
                var m = sb.RegisterWetGround();
                PlaytestKit.Check(m != null && WetGround.IsRegistered(m), "4종횡 들판 바닥 등록 안 됨");
                if (m != null)
                {
                    WetGround.SetWet(1f);
                    var g = sb.transform.Find("Ground").GetComponent<MeshRenderer>().sharedMaterial;
                    PlaytestKit.Check(g == m && !AssetDatabase.Contains(m), "4종횡 바닥이 런타임 사본이 아님");
                }
            }
            int story = WetGround.Count;

            WetGround.ResetAll();
            s = EditorSceneManager.OpenScene("Assets/Scenes/TestCity.unity");
            var cb = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Story.World.StoryTerrainBuilder>(true)).FirstOrDefault();
            PlaytestKit.Check(cb == null || cb.RegisterWetGround() == null, "5천하 바닥이 등록됨(빛만 판은 손대지 않음)");
            int city = WetGround.Count;
            WetGround.ResetAll();

            PlaytestKit.Check(go >= 1 && forest >= 1 && story >= 1 && city == 0, $"등록 수 1만리 {go}·3마을 {forest}·4종횡 {story}·5천하 {city}");
            Debug.Log($"{Tag} scenes OK - 등록 1만리 {go}·3마을 {forest}·4종횡 {story}·5천하 {city}");
        }
    }
}
