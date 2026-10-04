using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Saga.Core
{
    public static class CrowdBodies
    {
        private static CrowdBodyList _list;
        private static bool _tried;

        public static CrowdBodyList List
        {
            get
            {
                if (!_tried || (_list == null && Application.isPlaying == false)) { _list = Resources.Load<CrowdBodyList>("CrowdBodyList"); _tried = true; }
                return _list;
            }
        }

        public static bool Available => List != null && List.bodies != null && List.bodies.Length > 0 && List.idle != null;

        /// <summary>키 문자열 → 몸 번호(안정 해시 — 같은 키는 늘 같은 사람). 목록이 비었으면 -1.</summary>
        public static int IndexFor(string key)
        {
            if (!Available) return -1;
            unchecked
            {
                uint h = 2166136261u;
                foreach (char c in key ?? "") h = (h ^ c) * 16777619u;
                return (int)(h % (uint)List.bodies.Length);
            }
        }

        /// <summary>
        /// 키에 맞는 인물을 `parent` 밑 "Visual" 로 심는다(키 `height`·발을 parent 높이에, 걷기·대기 동작). 몸 최상위를 `Armature` 로 부르고 빈 부모(Visual)
        /// 밑에 두어야 동작 클립의 뼈 경로(`Armature/Root/J_Bip_*`)가 맞는다. 목록이 없거나 몸이 비면 null(호출부가 기존 몸을 쓴다).
        /// </summary>
        public static GameObject Spawn(string key, Transform parent, float height, float yawDeg = 0f)
        {
            int i = IndexFor(key);
            if (i < 0) return null;
            var prefab = List.bodies[i];
            if (prefab == null) return null;
            var holder = new GameObject("Visual");
            holder.transform.SetParent(parent, false);
            holder.transform.localPosition = Vector3.zero;
            holder.transform.localRotation = Quaternion.Euler(0f, yawDeg, 0f);
            var inst = Object.Instantiate(prefab, holder.transform, false);
            inst.name = "Armature";
            if (TryBounds(holder, out var b) && b.size.y > 0.01f)
            {
                holder.transform.localScale *= height / b.size.y;
                TryBounds(holder, out b);
                holder.transform.position += Vector3.up * (parent.position.y - b.min.y);
            }
            var animator = holder.AddComponent<Animator>();
            animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
            holder.AddComponent<CrowdBodyAnimator>().Init(List.idle, List.walk);
            if (parent.GetComponent<BlobShadow>() == null) parent.gameObject.AddComponent<BlobShadow>();
            return holder;
        }

        private static bool TryBounds(GameObject go, out Bounds b)
        {
            b = default; bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer) continue;
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any;
        }
    }

    /// <summary>
    /// U-0040 — 컨트롤러 없이 클립 둘(대기·걷기)을 `PlayableGraph` 로 섞어 튼다. <see cref="SetWalking"/> 으로 부드럽게 넘어간다.
    /// 클립은 직접 되감는다(임포트 클립의 루프 설정에 기대지 않는다).
    /// </summary>
    public sealed class CrowdBodyAnimator : MonoBehaviour
    {
        private PlayableGraph _graph;
        private AnimationMixerPlayable _mix;
        private AnimationClipPlayable _idle, _walk;
        private AnimationClip _idleClip, _walkClip;
        private float _walkWeight, _walkTarget;
        public const float BlendPerSec = 4f;

        public bool Ready => _graph.IsValid();
        public float WalkWeight => _walkWeight;

        public void Init(AnimationClip idle, AnimationClip walk)
        {
            var animator = GetComponent<Animator>();
            if (animator == null || idle == null) return;
            _idleClip = idle; _walkClip = walk;
            _graph = PlayableGraph.Create("CrowdBody");
            _graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            var output = AnimationPlayableOutput.Create(_graph, "Anim", animator);
            _mix = AnimationMixerPlayable.Create(_graph, 2);
            _idle = AnimationClipPlayable.Create(_graph, idle);
            _idle.SetTime(Random.value * idle.length); // 같은 숨을 맞춰 쉬지 않게
            _mix.ConnectInput(0, _idle, 0, 1f);
            if (walk != null)
            {
                _walk = AnimationClipPlayable.Create(_graph, walk);
                _mix.ConnectInput(1, _walk, 0, 0f);
            }
            output.SetSourcePlayable(_mix);
            _graph.Play();
        }

        public void SetWalking(bool walking) => _walkTarget = walking && _walkClip != null ? 1f : 0f;

        private void Update()
        {
            if (!_graph.IsValid()) return;
            _walkWeight = Mathf.MoveTowards(_walkWeight, _walkTarget, BlendPerSec * Time.deltaTime);
            _mix.SetInputWeight(0, 1f - _walkWeight);
            if (_walkClip != null) _mix.SetInputWeight(1, _walkWeight);
            if (_idle.GetTime() >= _idleClip.length) _idle.SetTime(_idle.GetTime() % _idleClip.length);
            if (_walkClip != null && _walk.GetTime() >= _walkClip.length) _walk.SetTime(_walk.GetTime() % _walkClip.length);
        }

        private void OnDestroy()
        {
            if (_graph.IsValid()) _graph.Destroy();
        }
    }
}
