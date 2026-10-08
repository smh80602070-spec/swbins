using System.IO;
using Unity.Profiling;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0057 인물 Mesh LOD 측정(그래픽 필요 — `-batchmode` 없이, 끝나면 스스로 종료). 마을 장면을 띄워 메인 카메라를 끄고,
    /// 하늘 높이(y 5000)에 VRoid 주인공 몸 하나만 세워 전용 카메라로 네 번 그린다 — 가까이(4m)·멀리(80m) × 자동 LOD·LOD0 고정.
    /// 렌더 카운터 "Triangles Count" 로 삼각형 수를 재고, 가까이 두 장은 PNG 로 남겨 눈으로 비교한다(가까이선 같아야 한다).
    /// 로그 "[MeshLodGui] 가까이 자동 a / LOD0 b · 멀리 자동 c / LOD0 d · 몸 LOD n단". 환경변수 SAGA_SHOT_DIR(기본 Temp/meshlod).
    /// </summary>
    public static class PlaytestMeshLodGui
    {
        private const int Width = 1280, Height = 720, Warmup = 200, Hold = 12;
        private static readonly (string name, float dist, bool force0)[] Phases =
            { ("near_auto", 4f, false), ("near_lod0", 4f, true), ("far_auto", 80f, false), ("far_lod0", 80f, true) };

        private static string _dir;
        private static int _frame, _phase, _phaseFrame;
        private static bool _done, _origEnterOpts;
        private static EnterPlayModeOptions _origOpts;
        private static GameObject _body;
        private static Camera _cam;
        private static ProfilerRecorder _tris;
        private static readonly long[] Result = new long[4];

        [MenuItem("Saga/Playtest Mesh LOD (GUI)")]
        public static void Run()
        {
            _dir = (System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIR") ?? "Temp/meshlod").Replace((char)92, (char)47).TrimEnd((char)47) + "/";
            Directory.CreateDirectory(_dir);
            _origEnterOpts = EditorSettings.enterPlayModeOptionsEnabled;
            _origOpts = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene("Assets/Scenes/TestVillage.unity");
            _frame = 0; _phase = 0; _phaseFrame = 0; _done = false;
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
        }

        private static void OnState(PlayModeStateChange s)
        {
            if (s == PlayModeStateChange.EnteredPlayMode) EditorApplication.update += Tick;
            else if (s == PlayModeStateChange.EnteredEditMode && _done)
            {
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterOpts;
                EditorSettings.enterPlayModeOptions = _origOpts;
                EditorApplication.Exit(0);
            }
        }

        private static void Tick()
        {
            if (_done || ++_frame < Warmup) return;
            try
            {
                if (_body == null && !Setup()) { Finish(); return; }
                var ph = Phases[_phase];
                if (_phaseFrame == 0) Place(ph.dist, ph.force0);
                _phaseFrame++;
                if (_phaseFrame == Hold - 1) Result[_phase] = _tris.Valid ? _tris.LastValue : -1;
                if (_phaseFrame >= Hold)
                {
                    if (ph.name.StartsWith("near")) Png(ph.name);
                    _phase++; _phaseFrame = 0;
                    if (_phase >= Phases.Length) Finish();
                }
            }
            catch (System.Exception e) { Debug.LogError("[MeshLodGui] " + e); Finish(); }
        }

        private static bool Setup()
        {
            var prefab = Resources.Load<GameObject>(Saga.Go.Player.PartyBodies.HeroBodyPath);
            if (prefab == null) { Debug.LogError("[MeshLodGui] 주인공 VRoid 몸 없음(SetupVroidHero.Bake 먼저)"); return false; }
            foreach (var c in Object.FindObjectsByType<Camera>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)) c.enabled = false;
            _body = Object.Instantiate(prefab, new Vector3(0f, 5000f, 0f), Quaternion.identity);
            _body.name = "MeshLodProbe";
            float h = Saga.Go.Player.HeroDresser.MeasureHeight(_body);
            if (h > 0.01f) _body.transform.localScale *= Saga.Go.World.CharacterVisual.HumanHeight / h;
            var go = new GameObject("MeshLodCam");
            _cam = go.AddComponent<Camera>();
            _cam.fieldOfView = 42f; _cam.nearClipPlane = 0.1f; _cam.farClipPlane = 600f;
            _cam.clearFlags = CameraClearFlags.SolidColor; _cam.backgroundColor = new Color(0.55f, 0.62f, 0.7f);
            _cam.targetTexture = new RenderTexture(Width, Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            _cam.enabled = true; // 프레임마다 그린다 — 렌더 카운터는 수동 Render() 를 안 센다
            _tris = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Triangles Count");
            int lods = 0;
            foreach (var smr in _body.GetComponentsInChildren<SkinnedMeshRenderer>()) if (smr.sharedMesh != null) lods = Mathf.Max(lods, smr.sharedMesh.lodCount);
            Debug.Log($"[MeshLodGui] 몸 LOD {lods}단 · 카운터 {(_tris.Valid ? "있음" : "없음")}");
            return true;
        }

        private static void Place(float dist, bool force0)
        {
            Vector3 center = _body.transform.position + Vector3.up * (Saga.Go.World.CharacterVisual.HumanHeight * 0.55f);
            _cam.transform.position = center + Vector3.forward * dist;
            _cam.transform.LookAt(center);
            foreach (var r in _body.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                r.forceMeshLod = (short)(force0 ? 0 : -1);
                r.updateWhenOffscreen = true;
            }
        }

        private static void Png(string name)
        {
            var prev = RenderTexture.active;
            RenderTexture.active = _cam.targetTexture;
            var tex = new Texture2D(Width, Height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, Width, Height), 0, 0); tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(_dir + name + ".png", tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
        }

        private static void Finish()
        {
            if (_done) return;
            Debug.Log($"[MeshLodGui] 가까이 자동 {Result[0]:N0} / LOD0 {Result[1]:N0} · 멀리 자동 {Result[2]:N0} / LOD0 {Result[3]:N0}");
            if (_tris.Valid) _tris.Dispose();
            _done = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }
    }
}
