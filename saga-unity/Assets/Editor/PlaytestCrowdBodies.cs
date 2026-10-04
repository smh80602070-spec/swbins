using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0040 진단(Play 모드, 헤드리스 가능) — `CrowdBodies.Spawn`: 키가 같으면 같은 사람·다르면 퍼지고, 몸이 "Visual" 로 심기고 키가 맞고 발이 부모 높이에 닿고,
    /// 프레임을 돌리면 대기 동작이 몸을 움직이고(왼 허벅지 회전 변화) `SetWalking(true)` 가 걷기로 넘어가고, 목록이 없으면 null. 목록이 없는 PC 는 SKIP.
    /// `-executeMethod Saga.EditorTools.PlaytestCrowdBodies.Run` (-quit 없이) → "[PlaytestCrowdBodies] OK/FAIL/SKIP".
    /// </summary>
    public static class PlaytestCrowdBodies
    {
        private static bool _opt; private static EnterPlayModeOptions _opts;
        private static int _frame;
        private static GameObject _parent, _visual;
        private static Transform _leg;
        private static Quaternion _legAtStart;
        private static float _idleMoved, _walkMoved;
        private static CrowdBodyAnimator _anim;

        [MenuItem("Saga/Playtest Crowd Bodies")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestCrowdBodies]");
            // 새 프로세스에서도 목록 에셋이 스크립트에 연결돼 읽히는가(ScriptableObject 는 파일 이름 = 클래스 이름이어야 한다).
            if (System.IO.File.Exists(CrowdBodyListBuilder.AssetPath))
                PlaytestKit.Check(AssetDatabase.LoadAssetAtPath<CrowdBodyList>(CrowdBodyListBuilder.AssetPath) != null, "목록 에셋이 스크립트 연결이 끊겨 안 읽힘(파일 이름 ≠ 클래스 이름?)");
            if (!CrowdBodyListBuilder.Build())
            {
                Debug.Log("[PlaytestCrowdBodies] SKIP — 설치 없음");
                if (Application.isBatchMode) EditorApplication.Exit(0);
                return;
            }
            _opt = EditorSettings.enterPlayModeOptionsEnabled; _opts = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            _frame = 0;
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
        }

        private static void OnState(PlayModeStateChange s)
        {
            if (s == PlayModeStateChange.EnteredPlayMode)
            {
                Setup();
                EditorApplication.update += Tick;
            }
            else if (s == PlayModeStateChange.EnteredEditMode)
            {
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _opt; EditorSettings.enterPlayModeOptions = _opts;
                PlaytestKit.Summary("PlaytestCrowdBodies");
                EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
            }
        }

        private static void Setup()
        {
            PlaytestKit.Check(CrowdBodies.Available, "목록이 안 읽힘");
            int a1 = CrowdBodies.IndexFor("visit_sailor"), a2 = CrowdBodies.IndexFor("visit_sailor"), b = CrowdBodies.IndexFor("visit_wisp");
            PlaytestKit.Check(a1 == a2 && a1 >= 0, "같은 키가 같은 사람이 아님");
            var seen = new System.Collections.Generic.HashSet<int>();
            for (int i = 0; i < 40; i++) seen.Add(CrowdBodies.IndexFor("k" + i));
            PlaytestKit.Check(seen.Count >= 20, $"40 개 키가 {seen.Count} 명에 몰림");
            _parent = new GameObject("__crowd"); _parent.transform.position = new Vector3(0f, 2f, 0f);
            _visual = CrowdBodies.Spawn("visit_sailor", _parent.transform, 1.7f);
            PlaytestKit.Check(_visual != null && _visual.name == "Visual" && _visual.transform.parent == _parent.transform, "Visual 로 안 심김");
            if (_visual == null) return;
            var rs = _visual.GetComponentsInChildren<Renderer>(true);
            var bb = rs[0].bounds; foreach (var r in rs) bb.Encapsulate(r.bounds);
            PlaytestKit.Check(Mathf.Abs(bb.size.y - 1.7f) < 0.15f, $"키가 안 맞음 {bb.size.y:0.00}");
            PlaytestKit.Check(Mathf.Abs(bb.min.y - 2f) < 0.05f, $"발이 부모 높이에 안 닿음 {bb.min.y:0.00}");
            // 헤드리스는 카메라가 없어 렌더러가 안 보이는 것으로 친다 — 게임의 CullUpdateTransforms 는 그때 뼈를 안 갱신하니 시험에서만 항상 갱신으로.
            _visual.GetComponent<Animator>().cullingMode = AnimatorCullingMode.AlwaysAnimate;
            _leg = Find(_visual.transform, "J_Bip_L_UpperLeg");
            PlaytestKit.Check(_leg != null, "왼 허벅지 뼈가 없음");
            _anim = _visual.GetComponent<CrowdBodyAnimator>();
            PlaytestKit.Check(_anim != null && _anim.Ready, "동작 그래프가 안 만들어짐");
            if (_leg != null) _legAtStart = _leg.localRotation;
            Debug.Log($"[PlaytestCrowdBodies] 목록 {CrowdBodies.List.bodies.Length}명 · visit_sailor→{a1} · visit_wisp→{b} · 40키 {seen.Count}명 · 키 {bb.size.y:0.00}m");
        }

        private static float _t0, _t1;
        private static int _phase;

        // 헤드리스는 프레임이 아주 빨라(프레임 수 ≠ 게임 시간) 게임 시간(`Time.time`)으로 잰다.
        private static void Tick()
        {
            if (_leg == null || _anim == null) { Stop(); return; }
            if (_phase == 0) { _t0 = Time.time; _phase = 1; return; }
            if (_phase == 1 && Time.time - _t0 >= 0.8f)
            {
                _idleMoved = Quaternion.Angle(_legAtStart, _leg.localRotation); _legAtStart = _leg.localRotation;
                _anim.SetWalking(true); _t1 = Time.time; _phase = 2; return;
            }
            if (_phase == 2 && Time.time - _t1 >= 1.4f)
            {
                _walkMoved = Quaternion.Angle(_legAtStart, _leg.localRotation);
                Debug.Log($"[PlaytestCrowdBodies] 대기 0.8초 허벅지 변화 {_idleMoved:0.0}° · 걷기로 1.4초 뒤 변화 {_walkMoved:0.0}° · 걷기 가중치 {_anim.WalkWeight:0.00}");
                PlaytestKit.Check(_idleMoved > 0.2f, $"대기 동작이 몸을 안 움직임 {_idleMoved:0.00}°");
                PlaytestKit.Check(_anim.WalkWeight > 0.9f, $"걷기로 안 넘어감 {_anim.WalkWeight:0.00}");
                PlaytestKit.Check(_walkMoved > 3f, $"걷기 동작이 몸을 안 움직임 {_walkMoved:0.0}°");
                Stop();
            }
        }

        private static void Stop()
        {
            EditorApplication.update -= Tick;
            if (_parent != null) Object.Destroy(_parent);
            EditorApplication.isPlaying = false;
        }

        private static Transform Find(Transform t, string name)
        {
            if (t.name == name) return t;
            foreach (Transform c in t) { var f = Find(c, name); if (f != null) return f; }
            return null;
        }
    }
}
