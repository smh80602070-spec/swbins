using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Saga.Core
{
    /// <summary>
    /// U-0074 glb 안 동작 재생(다섯 판 공용) — glTFast 가 Mecanim 으로 가져온 클립(glb 하위 에셋)을 이름으로 튼다.
    /// 컨트롤러 없이 `AnimationPlayableUtilities.PlayClip` 하나로(같은 이름이면 그대로 둠). 클립이 없으면 <see cref="Attach"/> 가 null — 정지 자세로 둔다.
    /// 클립이 몸 뿌리 변환을 쓸 수 있으니, 몸을 움직이는 쪽은 이 몸의 **부모**를 움직인다(EggWalker 받침).
    /// </summary>
    public class GltfClipPlayer : MonoBehaviour
    {
        private readonly Dictionary<string, AnimationClip> _clips = new Dictionary<string, AnimationClip>();
        private PlayableGraph _graph;

        /// <summary>지금 트는 클립 이름(없으면 빈 글).</summary>
        public string Current { get; private set; } = "";
        public int ClipCount => _clips.Count;
        public bool Has(string clipName) => _clips.ContainsKey(clipName);

        /// <summary>`Resources/<paramref name="resourcesPath"/>` glb 의 클립을 몸에 붙인다. 클립이 하나도 없으면 null.</summary>
        public static GltfClipPlayer Attach(GameObject body, string resourcesPath)
        {
            if (body == null) return null;
            var clips = Resources.LoadAll<AnimationClip>(resourcesPath);
            if (clips == null || clips.Length == 0) return null;
            var p = body.AddComponent<GltfClipPlayer>();
            foreach (var c in clips) if (c != null) p._clips[c.name] = c;
            return p;
        }

        /// <summary>이름의 클립을 튼다(이미 트는 중이면 그대로). 없는 이름이면 거짓.</summary>
        public bool Play(string clipName)
        {
            if (clipName == Current) return true;
            if (!_clips.TryGetValue(clipName, out var clip)) return false;
            var animator = GetComponentInChildren<Animator>(true); // glTFast 가 붙인 것(클립 경로의 기준)
            if (animator == null) animator = gameObject.AddComponent<Animator>();
            if (_graph.IsValid()) _graph.Destroy();
            AnimationPlayableUtilities.PlayClip(animator, clip, out _graph);
            Current = clipName;
            return true;
        }

        private void OnDestroy()
        {
            if (_graph.IsValid()) _graph.Destroy();
        }
    }
}
