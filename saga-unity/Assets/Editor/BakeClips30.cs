using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0200 ① K-0161 모션 30(한 팩 `clips30_anims.glb` — VRoid 뼈 J_Bip, 30fps, 이름 = `tools/char-forge/data/clips30.json` game)을
    /// 주인공 Humanoid 아바타(`SetupVroidHero` 의 hero_vroid)로 구워 Humanoid `.anim` 30 으로 — 판 주인공 컨트롤러가 다 Humanoid 라서(리타깃).
    /// 팩은 로컬 설치 `Assets/Art/CharactersDex/anims/`(crowd_anims 와 같은 자리, git 밖) · 결과 `Assets/Art/CharactersDex/Resources/Clips30/<이름>.anim`(git 밖) → 런타임 <see cref="Motion30"/>.
    /// 굽기: 몸에 일반 클립을 프레임마다 <c>SampleAnimation</c> → <c>HumanPoseHandler.GetHumanPose</c> → 근육·RootT·RootQ 곡선. 고리 여부는 clips30.json `loop`.
    /// 배치: `-executeMethod Saga.EditorTools.BakeClips30.Run` → "[BakeClips30] OK n".
    /// </summary>
    public static class BakeClips30
    {
        public const string PackPath = "Assets/Art/CharactersDex/anims/clips30_anims.glb";
        public const string OutDir = "Assets/Art/CharactersDex/Resources/" + Motion30.ResDir;
        public const string TablePath = "../tools/char-forge/data/clips30.json";
        public const float Fps = 30f;

        [MenuItem("Saga/Build/Bake Clips30 (Humanoid)")]
        public static void Run()
        {
            bool ok = Bake(out string msg);
            Debug.Log(ok ? "[BakeClips30] OK " + msg : "[BakeClips30] FAIL " + msg);
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        public static bool Bake(out string msg)
        {
            var src = AssetDatabase.LoadAllAssetsAtPath(PackPath).OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview")).ToArray();
            if (src.Length == 0) { msg = PackPath + " 없음(로컬 설치 — U-0200 메모)"; return false; }
            var hero = AssetDatabase.LoadAssetAtPath<GameObject>(SetupVroidHero.PrefabPath);
            if (hero == null) { msg = SetupVroidHero.PrefabPath + " 없음 — SetupVroidHero.Bake 먼저"; return false; }
            var loops = LoopTable();
            if (!Directory.Exists(OutDir)) Directory.CreateDirectory(OutDir);

            var go = (GameObject)Object.Instantiate(hero);
            var names = new List<string>();
            try
            {
                var animator = go.GetComponent<Animator>();
                if (animator == null || animator.avatar == null || !animator.avatar.isHuman) { msg = "hero_vroid 가 Humanoid 아님"; return false; }
                var avatar = animator.avatar;
                Object.DestroyImmediate(animator); // 아바타 든 애니메이터가 있으면 일반 클립 SampleAnimation 이 안 먹는다
                var handler = new HumanPoseHandler(avatar, go.transform);
                // 팩은 견본 몸(다른 키)으로 구워 뼈마다 위치·크기 곡선도 든다 — 이 몸에 그대로 입히면 팔다리가 늘고 몸이 눕는다.
                // 샘플 뒤 회전만 남긴다: 모든 뼈 위치·크기 = 쉬는 값(엉덩이 위치만 클립 — 높이·앉기), Armature·Root 는 통째로 쉬는 값.
                var rest = go.GetComponentsInChildren<Transform>(true).Where(x => x != go.transform)
                    .Select(x => (t: x, p: x.localPosition, r: x.localRotation, s: x.localScale)).ToArray();
                void KeepRotations()
                {
                    foreach (var b in rest)
                    {
                        bool frame = b.t.name == "Armature" || b.t.name == "Root";
                        if (frame) { b.t.localRotation = b.r; b.t.localPosition = b.p; }
                        else if (b.t.name != "J_Bip_C_Hips") b.t.localPosition = b.p;
                        b.t.localScale = b.s;
                    }
                }
                var pose = new HumanPose();
                string[] muscle = HumanTrait.MuscleName.Select(CurveName).ToArray();
                foreach (var clip in src)
                {
                    int n = Mathf.Max(2, Mathf.RoundToInt(clip.length * Fps) + 1);
                    var rootT = new[] { new AnimationCurve(), new AnimationCurve(), new AnimationCurve() };
                    var rootQ = new[] { new AnimationCurve(), new AnimationCurve(), new AnimationCurve(), new AnimationCurve() };
                    var mc = muscle.Select(_ => new AnimationCurve()).ToArray();
                    for (int f = 0; f < n; f++)
                    {
                        float t = clip.length * f / (n - 1);
                        clip.SampleAnimation(go, t);
                        KeepRotations();
                        handler.GetHumanPose(ref pose);
                        var p = pose.bodyPosition; var q = pose.bodyRotation;
                        rootT[0].AddKey(t, p.x); rootT[1].AddKey(t, p.y); rootT[2].AddKey(t, p.z);
                        rootQ[0].AddKey(t, q.x); rootQ[1].AddKey(t, q.y); rootQ[2].AddKey(t, q.z); rootQ[3].AddKey(t, q.w);
                        for (int i = 0; i < mc.Length; i++) mc[i].AddKey(t, pose.muscles[i]);
                    }
                    var outClip = new AnimationClip { name = clip.name, frameRate = Fps };
                    string[] xyz = { "x", "y", "z", "w" };
                    for (int i = 0; i < 3; i++) Set(outClip, "RootT." + xyz[i], rootT[i]);
                    for (int i = 0; i < 4; i++) Set(outClip, "RootQ." + xyz[i], rootQ[i]);
                    for (int i = 0; i < mc.Length; i++) Set(outClip, muscle[i], mc[i]);
                    var s = AnimationUtility.GetAnimationClipSettings(outClip);
                    s.loopTime = loops.TryGetValue(clip.name, out bool lp) && lp;
                    s.loopBlendOrientation = true; s.keepOriginalOrientation = true;   // 몸 방향은 자세에 — 판이 돌린 쪽 그대로
                    s.loopBlendPositionY = true; s.keepOriginalPositionY = true;
                    AnimationUtility.SetAnimationClipSettings(outClip, s);
                    string path = OutDir + clip.name + ".anim";
                    AssetDatabase.DeleteAsset(path);
                    AssetDatabase.CreateAsset(outClip, path);
                    names.Add(clip.name);
                }
                handler.Dispose();
            }
            finally { Object.DestroyImmediate(go); }
            AssetDatabase.SaveAssets();
            msg = $"{names.Count} → {OutDir} · 고리 {names.Count(x => loops.TryGetValue(x, out bool l) && l)} · {string.Join(",", names)}";
            return names.Count > 0;
        }

        /// <summary>
        /// 눈 확인 — 구운 클립 여럿의 가운데 칸을 주인공 몸에 입혀 한 장(칸 256, 옆 45°)으로. 배치는 그래픽 있이(-nographics 빼고):
        /// `-executeMethod Saga.EditorTools.BakeClips30.Shot` → 환경 변수 SAGA_SHOT_OUT(기본 Temp/clips30_sheet.png) · SAGA_SHOT_CLIPS(쉼표, 기본 아래 여덟).
        /// </summary>
        public static void Shot()
        {
            string outPath = System.Environment.GetEnvironmentVariable("SAGA_SHOT_OUT") ?? "Temp/clips30_sheet.png";
            string list = System.Environment.GetEnvironmentVariable("SAGA_SHOT_CLIPS") ?? "gather,fish_cast,sit_ground,cheer,command,ladder,stir,drink";
            var names = list.Split(',').Where(x => x.Length > 0).ToArray();
            var hero = AssetDatabase.LoadAssetAtPath<GameObject>(SetupVroidHero.PrefabPath);
            bool ok = hero != null;
            if (ok)
            {
                UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene);
                var light = new GameObject("Sun").AddComponent<Light>();
                light.type = LightType.Directional; light.intensity = 1.2f; light.transform.rotation = Quaternion.Euler(40f, -30f, 0f);
                RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.6f);
                var cam = new GameObject("Cam").AddComponent<Camera>();
                cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0.78f, 0.82f, 0.86f); cam.fieldOfView = 30f;
                const int S = 256;
                var rt = new RenderTexture(S, S, 24);
                cam.targetTexture = rt;
                var sheet = new Texture2D(S * names.Length, S, TextureFormat.RGB24, false);
                var tile = new Texture2D(S, S, TextureFormat.RGB24, false);
                var go = (GameObject)Object.Instantiate(hero);
                var anim = go.GetComponent<Animator>();
                anim.enabled = false;
                foreach (var smr in go.GetComponentsInChildren<SkinnedMeshRenderer>(true)) { smr.updateWhenOffscreen = true; smr.forceMatrixRecalculationPerRender = true; }
                foreach (var lg in go.GetComponentsInChildren<LODGroup>(true)) lg.ForceLOD(0);
                var handler = new HumanPoseHandler(anim.avatar, go.transform);
                for (int i = 0; i < names.Length; i++)
                {
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(OutDir + names[i] + ".anim");
                    if (clip != null) ApplyPose(handler, clip, clip.length * 0.5f);
                    // 틀은 몸 발밑 기준 고정(렌더러 경계는 스킨 갱신 전 값이라 자세마다 틀이 튄다)
                    var center = go.transform.position + Vector3.up * 0.85f;
                    cam.transform.position = center + new Vector3(0.7f, 0.25f, 0.7f).normalized * 4.6f;
                    cam.transform.LookAt(center);
                    cam.Render();
                    RenderTexture.active = rt;
                    tile.ReadPixels(new Rect(0, 0, S, S), 0, 0);
                    tile.Apply();
                    sheet.SetPixels(i * S, 0, S, S, tile.GetPixels());
                }
                RenderTexture.active = null;
                sheet.Apply();
                File.WriteAllBytes(outPath, sheet.EncodeToPNG());
                handler.Dispose();
                Object.DestroyImmediate(go);
            }
            Debug.Log(ok ? $"[BakeClips30] SHOT {outPath} · {string.Join(",", names)}" : "[BakeClips30] SHOT FAIL — hero_vroid·클립 없음");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        /// <summary>구운 Humanoid 클립의 t 자세를 몸에 입힌다(곡선을 직접 읽어 SetHumanPose — 꺼진 애니메이터에 SampleAnimation 은 안 먹는다).</summary>
        public static void ApplyPose(HumanPoseHandler handler, AnimationClip clip, float t)
        {
            var pose = new HumanPose { muscles = new float[HumanTrait.MuscleCount] };
            float Get(string attr)
            {
                var c = AnimationUtility.GetEditorCurve(clip, EditorCurveBinding.FloatCurve("", typeof(Animator), attr));
                return c != null ? c.Evaluate(t) : 0f;
            }
            pose.bodyPosition = new Vector3(Get("RootT.x"), Get("RootT.y"), Get("RootT.z"));
            pose.bodyRotation = new Quaternion(Get("RootQ.x"), Get("RootQ.y"), Get("RootQ.z"), Get("RootQ.w"));
            for (int i = 0; i < pose.muscles.Length; i++) pose.muscles[i] = Get(CurveName(HumanTrait.MuscleName[i]));
            handler.SetHumanPose(ref pose);
        }

        private static void Set(AnimationClip c, string attr, AnimationCurve curve) =>
            AnimationUtility.SetEditorCurve(c, EditorCurveBinding.FloatCurve("", typeof(Animator), attr), curve);

        /// <summary>근육 이름 → 클립 곡선 이름(손가락만 다르다: "Left Index 1 Stretched" → "LeftHand.Index.1 Stretched").</summary>
        internal static string CurveName(string muscle)
        {
            var p = muscle.Split(' ');
            if (p.Length >= 3 && (p[0] == "Left" || p[0] == "Right") && new[] { "Thumb", "Index", "Middle", "Ring", "Little" }.Contains(p[1]))
                return p.Length == 4 ? $"{p[0]}Hand.{p[1]}.{p[2]} {p[3]}" : $"{p[0]}Hand.{p[1]}.{p[2]}";
            return muscle;
        }

        /// <summary>clips30.json game → loop.</summary>
        private static Dictionary<string, bool> LoopTable()
        {
            var d = new Dictionary<string, bool>();
            if (!File.Exists(TablePath)) return d;
            var t = JsonUtility.FromJson<Table>(File.ReadAllText(TablePath));
            if (t?.clips != null) foreach (var c in t.clips) if (!string.IsNullOrEmpty(c.game)) d[c.game] = c.loop;
            return d;
        }

        [System.Serializable] private class Row { public string game; public bool loop; }
        [System.Serializable] private class Table { public Row[] clips; }
    }
}
