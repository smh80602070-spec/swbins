using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// Saga/CelToon 셰이더 진단(tasks U-0022) — 컴파일 오류 0 · 지원됨 · 패스 넷(ForwardLit·Outline·ShadowCaster·DepthOnly) · 속성 이름이 Godot 본보기와 맞는지 ·
    /// 기본 재질 `Assets/Shaders/CelToon.mat` 이 있고 값이 본보기 기본값(band 3·부드러움 0.08·림 4.5/0.3)인지.
    /// 재질이 없으면 만든다(`Saga/Cel Toon/Create Material`). `-executeMethod Saga.EditorTools.PlaytestCelToon.Run` → "[PlaytestCelToon] OK/FAIL".
    /// </summary>
    public static class PlaytestCelToon
    {
        public const string ShaderName = "Saga/CelToon";
        public const string MaterialPath = "Assets/Shaders/CelToon.mat";
        public const string SourcePath = "Assets/Shaders/CelToon.shader";

        [MenuItem("Saga/Cel Toon/Create Material")]
        public static Material EnsureMaterial()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (mat != null) return mat;
            var shader = Shader.Find(ShaderName);
            if (shader == null) return null;
            mat = new Material(shader) { name = "CelToon" };
            AssetDatabase.CreateAsset(mat, MaterialPath);
            AssetDatabase.SaveAssets();
            return mat;
        }

        [MenuItem("Saga/Playtest Cel Toon")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestCelToon]");
            using (PlaytestKit.ErrorCounter())
            {
                Checks();
                ChecksConvert();
                ChecksOutline();
            }
            PlaytestKit.Summary("PlaytestCelToon");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // tasks U-0148 인물 외곽선 — 인물(Animator 아래) 불투명 CelToon 만 사본에 화면 두께, 소품·눈·반투명·무기 빛·공유 원본은 그대로, 화질 낮음이면 전역 0.
        private static void ChecksOutline()
        {
            var shader = Shader.Find("Saga/CelToon");
            var body = new Material(shader) { name = "Body" };
            var eye = new Material(shader) { name = "EyeIris" };
            var lash = new Material(shader) { name = "Hair", renderQueue = 2450 };
            var glow = new Material(shader) { name = "Weapon" };
            glow.SetFloat("_OutlineWidth", 0.01f);
            var prop = new Material(shader) { name = "Crate" };
            var who = new GameObject("OutlineTest_Char");
            var stuff = new GameObject("OutlineTest_Prop");
            try
            {
                who.AddComponent<Animator>();
                var r = new GameObject("Mesh").AddComponent<MeshRenderer>();
                r.transform.SetParent(who.transform, false);
                r.sharedMaterials = new[] { body, eye, lash, glow };
                var pr = stuff.AddComponent<MeshRenderer>();
                pr.sharedMaterial = prop;
                int n = CharacterOutline.ApplyTo(who) + CharacterOutline.ApplyTo(stuff);
                var got = r.sharedMaterials;
                PlaytestKit.Check(n == 1, $"외곽선 바꾼 칸 {n} ≠ 1(몸만)");
                PlaytestKit.Check(got[0] != body && Mathf.Approximately(got[0].GetFloat("_OutlinePx"), CharacterOutline.DefaultPx), "몸 사본에 화면 두께 없음");
                PlaytestKit.Check(body.GetFloat("_OutlinePx") == 0f, "공유 원본이 바뀜");
                PlaytestKit.Check(got[1] == eye && got[2] == lash && got[3] == glow && pr.sharedMaterial == prop, "눈·반투명·무기 빛·소품이 바뀜");
                PlaytestKit.Check(CharacterOutline.ApplyTo(who) == 0, "두 번 훑으면 또 바뀜");
                CharacterOutline.SetActiveForTest(true);
                CharacterOutline.SetQuality(false);
                PlaytestKit.Check(CharacterOutline.Mul == 0f, "화질 낮음인데 외곽선 켜짐");
                CharacterOutline.SetQuality(true);
                PlaytestKit.Check(CharacterOutline.Mul == 1f, "화질 높음인데 외곽선 꺼짐");
                Debug.Log("[PlaytestCelToon] outline OK - 인물 몸만 사본 1.6px · 눈·반투명·무기 빛·소품·원본 그대로 · 두 번째 0 · 낮음 0/높음 1");
            }
            finally
            {
                CharacterOutline.SetActiveForTest(false);
                Object.DestroyImmediate(who);
                Object.DestroyImmediate(stuff);
            }
        }

        // 변환 — 불투명 URP 재질은 바탕 그림·색을 옮기고, 반투명·다른 셰이더는 그대로 둔다. GO 마을 씬을 열어 전체 변환도 오류 없이 도는지 본다.
        private static void ChecksConvert()
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit == null) { PlaytestKit.Check(false, "URP Lit 셰이더를 못 찾음"); return; }
            var src = new Material(lit) { name = "src" };
            var tex = new Texture2D(2, 2);
            src.SetTexture("_BaseMap", tex);
            src.SetColor("_BaseColor", new Color(0.2f, 0.4f, 0.6f, 1f));
            var toon = CelToonConvert.Convert(src);
            PlaytestKit.Check(toon != null && toon.shader.name == ShaderName, "불투명 Lit 가 CelToon 으로 안 바뀜");
            if (toon != null)
            {
                PlaytestKit.Check(toon.GetTexture("_BaseMap") == tex, "바탕 그림이 안 옮겨짐");
                PlaytestKit.Check(toon.GetColor("_BaseColor") == new Color(0.2f, 0.4f, 0.6f, 1f), "바탕 색이 안 옮겨짐");
                PlaytestKit.Check(CelToonConvert.Convert(toon) == null, "이미 CelToon 인 재질을 또 바꿈");
            }
            src.SetFloat("_Surface", 1f);
            PlaytestKit.Check(CelToonConvert.Convert(src) == null, "반투명 재질을 바꿈");
            Object.DestroyImmediate(src); Object.DestroyImmediate(tex);

            const string village = "Assets/Scenes/TestVillage.unity";
            if (System.IO.File.Exists(village))
            {
                UnityEditor.SceneManagement.EditorSceneManager.OpenScene(village, UnityEditor.SceneManagement.OpenSceneMode.Single);
                int n = CelToonConvert.ConvertOpenScene();
                PlaytestKit.Check(n > 100, $"GO 마을 씬에서 바뀐 재질 칸이 너무 적음 {n}");
                Debug.Log($"[PlaytestCelToon] GO 마을 씬 재질 {n}칸 변환");
                UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene);
            }
        }

        private static void Checks()
        {
            var shader = Shader.Find(ShaderName);
            PlaytestKit.Check(shader != null, "Saga/CelToon 셰이더를 못 찾음");
            if (shader == null) return;

            foreach (var m in ShaderUtil.GetShaderMessages(shader))
                if (m.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error)
                    PlaytestKit.Check(false, $"셰이더 오류 {m.file}:{m.line} {m.message}");
            PlaytestKit.Check(!ShaderUtil.ShaderHasError(shader), "ShaderHasError");
            PlaytestKit.Check(shader.isSupported, "이 환경에서 지원 안 됨");

            // 속성 — Godot cel_toon / cel_vertex_color / cel_outline 의 uniform 과 짝
            string[] props = { "_BaseMap", "_BaseColor", "_BandCount", "_BandSoftness", "_RimColor", "_RimPower", "_RimStrength", "_HitFlash", "_GlowStrength", "_OutlineColor", "_OutlineWidth" };
            foreach (var p in props) PlaytestKit.Check(shader.FindPropertyIndex(p) >= 0, $"속성 {p} 없음");

            var mat = EnsureMaterial();
            PlaytestKit.Check(mat != null, "기본 재질을 만들지 못함");
            if (mat == null) return;
            // -nographics 배치에서는 재질 패스가 모두 이름 없는 한 개로 보인다(URP Unlit 도 같다) — 패스 이름은 원본 글로 확인한다.
            string src = System.IO.File.ReadAllText(SourcePath);
            foreach (var pass in new[] { "ForwardLit", "Outline", "ShadowCaster", "DepthOnly" })
                PlaytestKit.Check(src.Contains("Name \"" + pass + "\""), $"패스 {pass} 없음");
            foreach (var w in ShaderUtil.GetShaderMessages(shader))
                PlaytestKit.Check(w.severity != UnityEditor.Rendering.ShaderCompilerMessageSeverity.Warning, $"셰이더 경고 {w.message}");
            PlaytestKit.Check(Mathf.Approximately(mat.GetFloat("_BandCount"), 3f), $"기본 단 수 {mat.GetFloat("_BandCount")} ≠ 3");
            PlaytestKit.Check(Mathf.Approximately(mat.GetFloat("_BandSoftness"), 0.08f), "기본 단 경계 부드러움 ≠ 0.08");
            PlaytestKit.Check(Mathf.Approximately(mat.GetFloat("_RimPower"), 4.5f) && Mathf.Approximately(mat.GetFloat("_RimStrength"), 0.3f), "기본 림 값이 본보기와 다름");
            PlaytestKit.Check(Mathf.Approximately(mat.GetFloat("_OutlineWidth"), 0f), "외곽선은 기본으로 꺼져 있어야 함");
        }
    }
}
