using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0216 풀 포기 흔들림·바람 날 배율 진단(고돗 G-0363 probe_go_weather · G-0365 짝) — `-executeMethod Saga.EditorTools.PlaytestGrassWind.Run`(-quit 없이).
    /// ① 배율 넷(바람 2.6·비 1.6·눈 1.3·그 밖 1) ② 다가가기 초당 0.5 · 0.5초 묶음 ③ 셰이더 `Saga/GrassSway` 컴파일 오류 0 · `_Sway` 기본 0
    /// ④ GLB 재질을 <see cref="GrassWind.Own"/> 하면 사본만(셰이더·값 그대로 넘어옴) · 에셋 그대로 ⑤ 들어올 때 바람이면 이미 2.6 · 끄면 0
    /// ⑥ 1만리 씬 풀 재질 등록 ≥1 · 풀 렌더러 재질 전부 사본 · 서로 다른 재질 수 앞뒤 같음(배칭 묶음·SetPass 안 늚) · 높이 맞춤이 원본 메시와 맞음. 씬은 저장 안 함.
    /// </summary>
    public static class PlaytestGrassWind
    {
        private const string Tag = "[PlaytestGrassWind]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckRules();
                    CheckShader();
                    CheckOwn();
                    CheckSkyWeather();
                    CheckScene();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally
                {
                    GrassWind.ForcedEnabled = null;
                    GrassWind.ResetAll();
                    SkyWeatherRules.ForcedWeather = null;
                    SkyWeatherRules.ForcedSeason = null;
                }
            }
            PlaytestKit.Summary("PlaytestGrassWind");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static bool Near(float a, float b, float eps = 1e-4f) => Mathf.Abs(a - b) <= eps;

        private static void CheckRules()
        {
            PlaytestKit.Check(Near(GrassWind.Target(SkyWeatherRules.Kind.Wind), 2.6f) && Near(GrassWind.Target(SkyWeatherRules.Kind.Rain), 1.6f)
                && Near(GrassWind.Target(SkyWeatherRules.Kind.Snow), 1.3f) && Near(GrassWind.Target(SkyWeatherRules.Kind.Clear), 1f)
                && Near(GrassWind.Target(SkyWeatherRules.Kind.Cloud), 1f) && Near(GrassWind.Target(SkyWeatherRules.Kind.Fog), 1f), "날씨 배율");
            float m = 1f;
            m = GrassWind.Step(m, 2.6f, 1f);
            PlaytestKit.Check(Near(m, 1.5f), $"1초 다가가기 {m} ≠ 1.5");
            for (int i = 0; i < 10; i++) m = GrassWind.Step(m, 2.6f, 0.5f);
            PlaytestKit.Check(Near(m, 2.6f), $"바람 끝 {m} ≠ 2.6(넘지 않음)");
            m = GrassWind.Step(m, 1f, 2f);
            PlaytestKit.Check(Near(m, 1.6f), $"그친 뒤 2초 {m} ≠ 1.6");
            Debug.Log($"{Tag} rules OK - 바람 2.6·비 1.6·눈 1.3·그 밖 1 · 초당 0.5");
        }

        private static void CheckShader()
        {
            var sh = Shader.Find(GrassWind.ShaderName);
            if (sh == null) { PlaytestKit.Fail($"{GrassWind.ShaderName} 없음"); return; }
            PlaytestKit.Check(!ShaderUtil.ShaderHasError(sh), "GrassSway 셰이더 오류");
            var msgs = ShaderUtil.GetShaderMessages(sh);
            int errs = msgs.Count(x => x.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error);
            foreach (var x in msgs.Where(x => x.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error).Take(5)) Debug.LogWarning($"{Tag} shader msg {x.message} @{x.line}");
            PlaytestKit.Check(errs == 0, $"GrassSway 컴파일 오류 {errs}");
            var probe = new Material(sh);
            PlaytestKit.Check(probe.GetFloat("_Sway") == 0f, "_Sway 기본이 0 이 아님(옛 화면이 흔들림)");
            string[] passes = { "ForwardLit", "ShadowCaster", "DepthOnly", "DepthNormals" };
            for (int i = 0; i < passes.Length; i++) PlaytestKit.Check(probe.FindPass(passes[i]) >= 0, $"GrassSway {passes[i]} 패스 없음");
            Object.DestroyImmediate(probe);
            Debug.Log($"{Tag} shader OK - 오류 0 · _Sway 기본 0 · 패스 넷(그림자·깊이 같이 흔듦)");
        }

        private static (Material mat, Mesh mesh) GlbGrass()
        {
            var prefab = WorldModels.Load("grass_tuft_01");
            var r = prefab != null ? prefab.GetComponentInChildren<MeshRenderer>(true) : null;
            var mf = prefab != null ? prefab.GetComponentInChildren<MeshFilter>(true) : null;
            return (r != null ? r.sharedMaterial : null, mf != null ? mf.sharedMesh : null);
        }

        private static void CheckOwn()
        {
            GrassWind.ResetAll();
            var (asset, mesh) = GlbGrass();
            if (asset == null || mesh == null) { PlaytestKit.Fail("grass_tuft_01 GLB 재질·메시 없음"); return; }
            var shader0 = asset.shader; var c0 = asset.GetColor("baseColorFactor"); var tex0 = asset.GetTexture("baseColorTexture"); bool dirty0 = EditorUtility.IsDirty(asset);
            var holder = GameObject.CreatePrimitive(PrimitiveType.Quad);
            var holder2 = GameObject.CreatePrimitive(PrimitiveType.Quad);
            try
            {
                var r = holder.GetComponent<MeshRenderer>();
                r.sharedMaterial = asset;
                int n = GrassWind.Own(r, mesh, 1.4f);
                var own = r.sharedMaterial;
                PlaytestKit.Check(n == 1 && own != asset && own.shader.name == GrassWind.ShaderName && GrassWind.IsRegistered(own), "GLB 재질을 흔들림 사본으로 안 바꿈");
                PlaytestKit.Check(asset.shader == shader0 && asset.GetColor("baseColorFactor") == c0 && EditorUtility.IsDirty(asset) == dirty0, $"Own 이 GLB 재질 에셋을 고침(더러움 {dirty0}→{EditorUtility.IsDirty(asset)})");
                PlaytestKit.Check(own.GetColor("baseColorFactor") == c0 && own.GetTexture("baseColorTexture") == tex0 && own.GetTexture("normalTexture") == asset.GetTexture("normalTexture")
                    && own.GetTexture("metallicRoughnessTexture") == asset.GetTexture("metallicRoughnessTexture") && Near(own.GetFloat("roughnessFactor"), asset.GetFloat("roughnessFactor"))
                    && Near(own.GetFloat("_Cull"), asset.GetFloat("_Cull")), "사본에 glTFast 값이 안 넘어옴");
                PlaytestKit.Check(Near(GrassWind.SwayOf(own), GrassWind.BaseSway), $"맑음 _Sway {GrassWind.SwayOf(own)} ≠ 0.12");
                var r2 = holder2.GetComponent<MeshRenderer>();
                r2.sharedMaterial = asset;
                GrassWind.Own(r2, mesh, 1.4f);
                PlaytestKit.Check(r2.sharedMaterial == own && GrassWind.Count == 1, "같은 원본·메시·서브메시인데 사본이 또 생김(배칭 묶음이 갈림)");

                GrassWind.SetMul(GrassWind.Target(SkyWeatherRules.Kind.Wind));
                PlaytestKit.Check(Near(GrassWind.SwayOf(own), 0.312f), $"바람 _Sway {GrassWind.SwayOf(own)} ≠ 0.312");
                GrassWind.Tick(SkyWeatherRules.Kind.Clear, 0.25f);
                PlaytestKit.Check(Near(GrassWind.SwayOf(own), 0.312f), "0.5초 묶음 전에 재질이 바뀜");
                GrassWind.Tick(SkyWeatherRules.Kind.Clear, 0.25f);
                PlaytestKit.Check(Near(GrassWind.Mul, 2.35f) && Near(GrassWind.SwayOf(own), 0.12f * 2.35f), $"0.5초 뒤 배율 {GrassWind.Mul}·_Sway {GrassWind.SwayOf(own)}");
                for (int i = 0; i < 12; i++) GrassWind.Tick(SkyWeatherRules.Kind.Clear, 0.5f);
                PlaytestKit.Check(Near(GrassWind.SwayOf(own), 0.12f), $"맑음으로 돌아온 뒤 _Sway {GrassWind.SwayOf(own)}");

                GrassWind.ForcedEnabled = false;
                GrassWind.Tick(SkyWeatherRules.Kind.Wind, 0.5f);
                PlaytestKit.Check(GrassWind.SwayOf(own) == 0f, $"끔인데 _Sway {GrassWind.SwayOf(own)}");
                var holder3 = GameObject.CreatePrimitive(PrimitiveType.Quad);
                holder3.GetComponent<MeshRenderer>().sharedMaterial = asset;
                PlaytestKit.Check(GrassWind.Own(holder3.GetComponent<MeshRenderer>(), mesh, 1.4f) == 0 && holder3.GetComponent<MeshRenderer>().sharedMaterial == asset, "끔인데 바꿔 끼움");
                Object.DestroyImmediate(holder3);
                GrassWind.ForcedEnabled = null;

                // 높이 맞춤 — glTF v 는 위가 0 → Unity uv.y = 1 - v(위 1). 첫 서브메시 h ≈ 0.012 + 0.633·uv.y(GLB 에서 잰 값)
                var fit = GrassWind.FitOf(mesh, 0);
                PlaytestKit.Check(Mathf.Abs(fit.x) < 0.06f && fit.y > 0.45f && fit.y < 0.8f, $"grass_tuft_01 높이 맞춤 {fit}");
                Debug.Log($"{Tag} own OK - 사본만(값 그대로)·에셋 그대로 · 맑음 0.12·바람 0.312·0.5초 묶음·맑음 복귀 · 끄면 0 · 맞춤 {fit.x:0.000}+{fit.y:0.000}·uv.y");
            }
            finally
            {
                var m = holder.GetComponent<MeshRenderer>().sharedMaterial;
                GrassWind.ForcedEnabled = null;
                GrassWind.ResetAll();
                Object.DestroyImmediate(holder); Object.DestroyImmediate(holder2);
                if (m != null && m != asset) Object.DestroyImmediate(m);
            }
        }

        private static void CheckSkyWeather()
        {
            var camGo = new GameObject("PlaytestGrassWindCam");
            var cam = camGo.AddComponent<Camera>();
            bool fog = RenderSettings.fog; float dens = RenderSettings.fogDensity; var fc = RenderSettings.fogColor;
            try
            {
                if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                SkyWeatherRules.ForcedSeason = "summer";
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Wind;
                var sw = SkyWeather.Install(cam);
                if (sw == null) { PlaytestKit.Fail("SkyWeather 가 안 섬(SAGA_NO_WEATHER?)"); return; }
                PlaytestKit.Check(Near(GrassWind.Mul, 2.6f), $"바람으로 들어왔는데 배율 {GrassWind.Mul}");
                sw.Teardown();
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Clear;
                sw = SkyWeather.Install(cam);
                PlaytestKit.Check(Near(GrassWind.Mul, 1f), $"맑음으로 들어왔는데 배율 {GrassWind.Mul}");
                sw.Teardown();
                Debug.Log($"{Tag} sky OK - 바람으로 들어오면 이미 2.6·맑음 1");
            }
            finally
            {
                if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                Object.DestroyImmediate(camGo);
                RenderSettings.fog = fog; RenderSettings.fogDensity = dens; RenderSettings.fogColor = fc;
                SkyWeatherRules.ForcedWeather = null; SkyWeatherRules.ForcedSeason = null;
                GrassWind.ResetAll();
            }
        }

        private static void CheckScene()
        {
            GrassWind.ResetAll();
            var s = EditorSceneManager.OpenScene("Assets/Scenes/TestVillage.unity");
            var veg = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Go.World.VegetationBuilder>(true)).FirstOrDefault();
            var grass = veg != null ? veg.transform.Find("Grass") : null;
            if (grass == null) { PlaytestKit.Fail("1만리 VegetationBuilder/Grass 없음"); return; }
            var rs = grass.GetComponentsInChildren<MeshRenderer>(true);
            var before = rs.SelectMany(r => r.sharedMaterials).Where(m => m != null).Distinct().ToList();
            var assetsBefore = before.Where(AssetDatabase.Contains).Select(m => (m, m.shader)).ToList();
            int n = veg.RegisterGrassWind();
            var after = rs.SelectMany(r => r.sharedMaterials).Where(m => m != null).Distinct().ToList();
            PlaytestKit.Check(n >= 1 && GrassWind.Count >= 1, $"1만리 풀 재질 등록 {GrassWind.Count}(바꿈 {n})");
            PlaytestKit.Check(after.All(m => m.shader.name == GrassWind.ShaderName && GrassWind.IsRegistered(m) && !AssetDatabase.Contains(m)), "풀 렌더러에 흔들림 사본 아닌 재질이 남음");
            PlaytestKit.Check(after.Count == before.Count, $"풀 재질 수 {before.Count} → {after.Count}(배칭 묶음·SetPass 가 늚)");
            PlaytestKit.Check(assetsBefore.All(p => p.m.shader == p.shader && !EditorUtility.IsDirty(p.m)), "공유 재질 에셋이 바뀜");
            // 다른 재질(나무·바위)은 그대로
            int others = veg.GetComponentsInChildren<MeshRenderer>(true).Where(r => !r.transform.IsChildOf(grass)).SelectMany(r => r.sharedMaterials).Count(m => m != null && m.shader.name == GrassWind.ShaderName);
            PlaytestKit.Check(others == 0, $"풀 말고 흔들림 재질 {others}");
            int again = veg.RegisterGrassWind();
            PlaytestKit.Check(again == 0 && GrassWind.Count == after.Count, $"두 번 등록하면 또 바꿈 {again}");
            var any = after[0];
            var fit = any.GetVector("_SwayFit");
            PlaytestKit.Check(fit.y > 0.3f && fit.y < 3f && Mathf.Abs(fit.x) < 1.6f, $"_SwayFit {fit}");
            GrassWind.SetMul(GrassWind.Target(SkyWeatherRules.Kind.Wind));
            PlaytestKit.Check(after.All(m => Near(m.GetFloat("_Sway"), 0.312f)), "씬 풀 바람 0.312 아님");
            GrassWind.ResetAll();
            Debug.Log($"{Tag} scene OK - 1만리 풀 렌더러 {rs.Length} · 재질 {before.Count} → 사본 {after.Count}(같은 수) · 공유 에셋 {assetsBefore.Count} 그대로 · 다른 재질 0 · 맞춤 예 {fit.x:0.00}+{fit.y:0.00}");
        }

        /// <summary>U-0216 화면 짝 비교(그래픽 필요 — `-batchmode` 없이) — 1만리 씬(편집 모드)에서 풀 포기 하나를 같은 카메라로 ① 원래 glTFast 재질
        /// ② 흔들림 사본 _Sway 0 ③ 흔들림 사본 바람(0.312) 세 장 → SAGA_SHOT_DIR. ①↔② 포기 둘레 픽셀 평균 차를 로그(같아야 함). 씬 저장 안 함.</summary>
        public static void ParityShots()
        {
            string dir = (System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIR") ?? "Temp/shots").Replace((char)92, (char)47).TrimEnd((char)47) + "/";
            System.IO.Directory.CreateDirectory(dir);
            var s = EditorSceneManager.OpenScene("Assets/Scenes/TestVillage.unity");
            var veg = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Saga.Go.World.VegetationBuilder>(true)).FirstOrDefault();
            var grass = veg != null ? veg.transform.Find("Grass") : null;
            var mainCam = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Camera>(true)).FirstOrDefault();
            if (grass == null || mainCam == null) { Debug.LogError($"{Tag} parity 풀·카메라 없음"); EditorApplication.Exit(1); return; }
            int shots = 0;
            bool asyncWas = ShaderUtil.allowAsyncCompilation;
            ShaderUtil.allowAsyncCompilation = false; // 첫 렌더에 셰이더가 덜 지어져 안 그려지는 것 막기(편집기 비동기 컴파일)
            var all = grass.GetComponentsInChildren<MeshRenderer>(true);
            var allOrig = all.Select(r => r.sharedMaterials).ToArray();
            foreach (var model in new[] { "grass_tuft_01", "grass_tuft_02" })
            {
                var t = grass.GetComponentsInChildren<Transform>(true).FirstOrDefault(x => x.name == model);
                if (t == null) continue;
                var rs = t.GetComponentsInChildren<MeshRenderer>(true);
                var bnd = rs[0].bounds; foreach (var r in rs) bnd.Encapsulate(r.bounds);
                var camGo = new GameObject("ParityCam");
                var cam = camGo.AddComponent<Camera>();
                cam.CopyFrom(mainCam);
                cam.fieldOfView = 30f; cam.nearClipPlane = 0.05f; cam.farClipPlane = 300f;
                var pos = bnd.center + new Vector3(0.9f, 0.35f, -1.6f) * Mathf.Max(1f, bnd.size.magnitude);
                cam.transform.SetPositionAndRotation(pos, Quaternion.LookRotation(bnd.center - pos));
                GrassWind.ResetAll();
                var a = Render(cam, dir + "parity_" + model + "_a_gltf.png");
                GrassWind.ForcedEnabled = true;
                veg.RegisterGrassWind();
                GrassWind.SetMul(0f);
                var b = Render(cam, dir + "parity_" + model + "_b_sway0.png");
                GrassWind.SetMul(GrassWind.Target(SkyWeatherRules.Kind.Wind));
                Render(cam, dir + "parity_" + model + "_c_wind.png");
                double sum = 0; int n = 0, big = 0;
                for (int i = 0; i < a.Length; i++)
                {
                    int d = Mathf.Abs(a[i].r - b[i].r) + Mathf.Abs(a[i].g - b[i].g) + Mathf.Abs(a[i].b - b[i].b);
                    sum += d; n++; if (d > 24) big++;
                }
                Debug.Log($"{Tag} parity {model} 평균 차 {sum / n / 3.0:0.00}/255 · 8 넘는 픽셀 {big * 100.0 / n:0.00}%");
                for (int i = 0; i < all.Length; i++) all[i].sharedMaterials = allOrig[i];
                GrassWind.ForcedEnabled = null;
                GrassWind.ResetAll();
                Object.DestroyImmediate(camGo);
                shots += 3;
            }
            ShaderUtil.allowAsyncCompilation = asyncWas;
            Debug.Log($"{Tag} parity 찍음 {shots}장 → {dir}");
            if (!Application.isBatchMode) EditorApplication.Exit(0);
        }

        private static Color32[] Render(Camera cam, string path)
        {
            var rt = new RenderTexture(960, 720, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render(); // 처음 쓰는 변형은 편집기가 뒤에서 짓는다 — 다 지어질 때까지 기다린 뒤 다시
            for (int w = 0; w < 200 && ShaderUtil.anythingCompiling; w++) System.Threading.Thread.Sleep(50);
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            System.IO.File.WriteAllBytes(path, tex.EncodeToPNG());
            var px = tex.GetPixels32();
            Object.DestroyImmediate(tex); cam.targetTexture = null; rt.Release(); Object.DestroyImmediate(rt);
            return px;
        }
    }
}
