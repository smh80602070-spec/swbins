using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0096 사냥 의뢰(웹 W-0101) 들판 쪽 — <see cref="GoTrack.All"/> 흔적을 주인공 둘레 70m 안에만 세우고(멀면 거둠, 0.5초 박자 — 칸이 60여 개뿐),
    /// 안 읽은 흔적 10m 안에서 F(다른 F 쓰임 — 낚시·대화·탐사 게시판 — 이 바쁘면 안 받음)로 읽는다. 들판 보스가 쓰러지면 `FieldEnemy.Killed` 로 의뢰를 닫는다.
    /// 흔적 그림은 에셋 0 — 종류별 색 납작 원반 + 작은 기둥(대역). 읽은 흔적은 사라진다(웹과 같음).
    /// </summary>
    public class TrackField : MonoBehaviour
    {
        public const float ShowR = 70f;
        private static readonly Color[] KindColor =
        {
            new Color(0.45f, 0.3f, 0.18f), new Color(0.55f, 0.38f, 0.2f), new Color(0.85f, 0.85f, 0.9f),
            new Color(0.35f, 0.6f, 0.25f), new Color(0.3f, 0.55f, 0.75f), new Color(0.7f, 0.6f, 0.3f),
        };

        public static TrackField Instance { get; private set; }
        private readonly Dictionary<string, GameObject> _shown = new Dictionary<string, GameObject>();
        private float _wait;
        private string _hinted;
        public int ShownCount => _shown.Count;

        private void Awake()
        {
            Instance = this;
            FieldEnemy.Killed += OnKilled;
            GoTrack.Changed += OnChanged;
        }

        private void OnDestroy()
        {
            FieldEnemy.Killed -= OnKilled;
            GoTrack.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void OnChanged() => _wait = 0f;

        private static void OnKilled(FieldEnemy e)
        {
            if (e == null || !e.IsGuardian) return;
            string msg = GoTrack.OnBossDown(e.FrostKing);
            if (msg != null) DialogueLabel.Instance?.Show(msg, 4f);
        }

        private void Update()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            Vector3 feet = fc.transform.position;
            _wait -= Time.deltaTime;
            if (_wait <= 0f) { _wait = 0.5f; Tick(feet); }

            var near = GoTrack.NearestUnread(feet);
            if (near != null && _hinted != near.Value.Key)
            {
                _hinted = near.Value.Key;
                DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("track.hint", "{0} {1} — F 로 읽는다"), GoTrack.KindEmoji[(int)near.Value.Kind], GoTrack.KindName[(int)near.Value.Kind]), 2.5f);
            }
            var kb = Keyboard.current;
            if (near == null || kb == null || !kb.fKey.wasPressedThisFrame) return;
            bool busy = FishingField.Busy || StoryState.Talking || (StoryUi.Instance != null && StoryUi.Instance.TalkShown) || DispatchUi.AtBoard()
                || (FishingUi.Instance != null && FishingUi.Instance.BoardOpen);
            if (busy) return;
            ReadAt(near.Value.Key);
        }

        /// <summary>흔적 하나를 읽고 글을 띄운다(진단도 부른다).</summary>
        public string ReadAt(string key)
        {
            string msg = GoTrack.Read(key);
            if (msg != null) DialogueLabel.Instance?.Show(msg, 3.5f);
            if (msg != null && _shown.TryGetValue(key, out var go)) { if (go != null) Destroy(go); _shown.Remove(key); }   // 읽은 흔적만 치운다(나머지는 다음 박자)
            return msg;
        }

        /// <summary>한 박자 — 둘레 <see cref="ShowR"/> 안 안 읽은 흔적만 세우고 나머지는 거둔다.</summary>
        public void Tick(Vector3 feet)
        {
            var keep = new HashSet<string>();
            foreach (var t in GoTrack.All)
            {
                if (GoTrack.IsRead(t.Key)) continue;
                if (Vector2.Distance(new Vector2(t.Pos.x, t.Pos.z), new Vector2(feet.x, feet.z)) > ShowR) continue;
                keep.Add(t.Key);
                if (!_shown.ContainsKey(t.Key)) _shown[t.Key] = Spawn(t);
            }
            var drop = new List<string>();
            foreach (var kv in _shown) if (!keep.Contains(kv.Key)) drop.Add(kv.Key);
            foreach (var k in drop) { if (_shown[k] != null) Destroy(_shown[k]); _shown.Remove(k); }
        }

        private GameObject Spawn(GoTrack.Trace t)
        {
            var root = new GameObject("Trace_" + t.Key);
            root.transform.SetParent(transform, false);
            root.transform.position = t.Pos;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Trace (generated)" };
            mat.color = KindColor[(int)t.Kind];
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", KindColor[(int)t.Kind] * 0.6f);
            var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            disc.name = "Mark";
            disc.transform.SetParent(root.transform, false);
            disc.transform.localScale = new Vector3(1.6f, 0.04f, 1.6f);
            disc.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            Saga.Core.Colliders.Strip(disc);
            disc.GetComponent<MeshRenderer>().sharedMaterial = mat;
            var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            post.name = "Post";
            post.transform.SetParent(root.transform, false);
            post.transform.localScale = new Vector3(0.18f, 0.6f, 0.18f);
            post.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            Saga.Core.Colliders.Strip(post);
            post.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return root;
        }
    }
}
