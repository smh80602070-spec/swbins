using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0200 ① 모션 30(K-0161, 다섯 판 공용) — 판 주인공(Humanoid 컨트롤러) 위에 행동 클립 하나를 잠깐 섞어 튼다.
    /// 클립 = `Resources/Clips30/&lt;이름&gt;`(편집기 `BakeClips30` 이 K 팩을 주인공 아바타로 구운 Humanoid — 로컬 설치, 없으면 아무것도 안 함).
    /// 이름은 `tools/char-forge/data/clips30.json` game 그대로(gather·throw·fish_cast·eat·drink·cheer·sit_ground·bow_greet …).
    /// 섞기: 그래프 하나(컨트롤러 사본 ↔ 클립) · <see cref="Blend"/>초 들어갔다 나옴 · 고리 클립은 <c>seconds</c> 동안(0 이면 한 바퀴) ·
    /// 걷기·공격 등 판이 넘긴 조건(<c>cancel</c>)이 참이 되면 바로 나온다. 끝나면 그래프를 지워 원래 컨트롤러로.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class Motion30 : MonoBehaviour
    {
        public const string ResDir = "Clips30/";
        public const float Blend = 0.2f, LoopDefault = 3f, MoveCancel = 0.25f;

        /// <summary>끄면 안 튼다(손잡이).</summary>
        public static bool On = true;

        private static readonly Dictionary<string, AnimationClip> Cache = new Dictionary<string, AnimationClip>();

        private Animator _animator;
        private PlayableGraph _graph;
        private AnimationMixerPlayable _mixer;
        private float _t, _dur;
        private System.Func<bool> _cancel;
        private bool _leaving, _stopOnMove;
        private Vector3 _from;

        /// <summary>지금 트는 클립(없으면 빈 글).</summary>
        public string Current { get; private set; } = "";
        /// <summary>진단 — 지금 섞인 클립 몫(0~1).</summary>
        public float Weight => _graph.IsValid() ? _mixer.GetInputWeight(1) : 0f;

        public static AnimationClip Clip(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            if (!Cache.TryGetValue(name, out var c)) { c = Resources.Load<AnimationClip>(ResDir + name); Cache[name] = c; }
            return c;
        }

        public static bool Has(string name) => Clip(name) != null;

        /// <summary>이 몸에서 지금 트는 것(없으면 빈 글).</summary>
        public static string CurrentOf(Animator a) => a != null && a.TryGetComponent<Motion30>(out var m) ? m.Current : "";

        /// <summary>클립을 튼다 — 몸·클립이 없거나 Humanoid 가 아니면 거짓(판은 그냥 지나간다).</summary>
        /// <paramref name="stopOnMove"/> = 몸이 <see cref="MoveCancel"/>m 넘게 움직이면 나옴(걷기·밀림 — 사다리처럼 움직이며 트는 것만 끈다).
        public static bool Play(Animator a, string name, float seconds = 0f, System.Func<bool> cancel = null, bool stopOnMove = true)
        {
            if (!On || a == null || !a.isHuman || a.runtimeAnimatorController == null) return false;
            var clip = Clip(name);
            if (clip == null) return false;
            if (!a.TryGetComponent<Motion30>(out var m)) m = a.gameObject.AddComponent<Motion30>();
            m.Begin(a, clip, seconds, cancel, stopOnMove);
            return true;
        }

        public static void Stop(Animator a)
        {
            if (a != null && a.TryGetComponent<Motion30>(out var m)) m.End();
        }

        private void Begin(Animator a, AnimationClip clip, float seconds, System.Func<bool> cancel, bool stopOnMove)
        {
            End();
            _animator = a;
            _cancel = cancel;
            _stopOnMove = stopOnMove;
            _from = a.transform.position;
            _graph = PlayableGraph.Create("Motion30_" + clip.name);
            _graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            var output = AnimationPlayableOutput.Create(_graph, "Motion30", a);
            _mixer = AnimationMixerPlayable.Create(_graph, 2);
            var ctrl = AnimatorControllerPlayable.Create(_graph, a.runtimeAnimatorController);
            var cp = AnimationClipPlayable.Create(_graph, clip);
            _graph.Connect(ctrl, 0, _mixer, 0);
            _graph.Connect(cp, 0, _mixer, 1);
            _mixer.SetInputWeight(0, 1f);
            _mixer.SetInputWeight(1, 0f);
            output.SetSourcePlayable(_mixer);
            _graph.Play();
            _dur = clip.isLooping ? (seconds > 0f ? seconds : LoopDefault) : Mathf.Max(clip.length, 2f * Blend);
            _t = 0f;
            _leaving = false;
            Current = clip.name;
        }

        private void Update() => Tick(Time.deltaTime);

        private void Tick(float dt)
        {
            if (!_graph.IsValid()) return;
            _t += dt;
            if (!_leaving && (_t >= _dur - Blend || (_cancel != null && _cancel()) || (_stopOnMove && Moved()))) { _leaving = true; _dur = Mathf.Min(_dur, _t + Blend); }
            float w = Mathf.Min(Mathf.Clamp01(_t / Blend), Mathf.Clamp01((_dur - _t) / Blend));
            _mixer.SetInputWeight(1, w);
            _mixer.SetInputWeight(0, 1f - w);
            if (_t >= _dur) End();
        }

        private bool Moved()
        {
            var d = _animator != null ? _animator.transform.position - _from : Vector3.zero;
            d.y = 0f;
            return d.sqrMagnitude > MoveCancel * MoveCancel;
        }

        private void End()
        {
            if (_graph.IsValid()) _graph.Destroy();
            Current = "";
        }

        private void OnDisable() => End();
        private void OnDestroy() => End();

        /// <summary>진단 — 몇 초 앞으로 돌린다(배치 모드는 프레임이 띄엄띄엄).</summary>
        public void StepForTest(float dt) => Tick(dt);
    }
}
