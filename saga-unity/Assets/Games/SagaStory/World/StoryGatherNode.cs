using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Audio;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// tasks U-0133 들판 채집터(웹 W-0283 채집 칸) — 땅 둘·발판 둘 위 풀덤불 넷(발판 #3 은 전망대 발견 자리라 비움, 잡졸 자리 사이).
    /// 곁에 서면 아래 「🌿 캔다 (F)」 단추, F 또는 단추 → <see cref="StoryLife.Gather"/>(재료 +1·덤·경험 +1). 덤불마다 쿨 8초(그동안 흐리게).
    /// 에셋 없이 코드 도형. 씬 재빌드 없이 `GameBootstrap.Start` 가 <see cref="Install"/> 로 세운다(다른 Install 들과 같은 결).
    /// </summary>
    public class StoryGatherNode : MonoBehaviour
    {
        public const float CooldownSec = 8f, ReachX = 1.4f, ReachY = 1.8f;
        private static readonly Color Fresh = new Color(0.35f, 0.68f, 0.3f), Spent = new Color(0.32f, 0.36f, 0.3f);

        public static StoryGatherNode Instance { get; private set; }

        private readonly List<Transform> _nodes = new List<Transform>();
        private readonly List<Renderer> _bush = new List<Renderer>();
        private float[] _readyAt;
        private readonly System.Random _rng = new System.Random(20260824);
        private Transform _player;
        private Button _hint;
        private int _near = -1;

        public int Count => _nodes.Count;
        public Vector3 PosOf(int i) => _nodes[i].position;
        public bool HintShown => _hint != null && _hint.gameObject.activeSelf;
        public float CooldownLeft(int i) => Mathf.Max(0f, _readyAt[i] - Time.time);

        /// <summary>땅 x(m) 둘 + 발판 번호 둘 — 잡졸(3·8·13…m)과 두목(43.6m) 사이, 전망대(발판 #3) 빼고.</summary>
        public static Vector3[] Spots()
        {
            var p = FieldMapData.Platforms();
            return new[]
            {
                new Vector3(10.5f, 0f, 0f),
                new Vector3(p[1].X, p[1].Height, 0f),
                new Vector3(p[2].X + 1.5f, p[2].Height, 0f),
                new Vector3(30.5f, 0f, 0f),
            };
        }

        public static StoryGatherNode Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryGatherNodes").AddComponent<StoryGatherNode>();
        }

        private void Awake()
        {
            Instance = this;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryGatherBush (generated)" };
            foreach (var at in Spots())
            {
                var node = new GameObject("GatherNode").transform;
                node.SetParent(transform, false);
                node.position = at;
                var bush = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                bush.name = "Bush";
                Colliders.Strip(bush);
                bush.transform.SetParent(node, false);
                bush.transform.localPosition = new Vector3(0f, 0.3f, 0.35f); // 길(z=0) 조금 뒤 — 주인공 몸과 안 겹치게
                bush.transform.localScale = new Vector3(0.9f, 0.6f, 0.6f);
                var r = bush.GetComponent<Renderer>();
                r.material = new Material(mat) { color = Fresh };
                _nodes.Add(node);
                _bush.Add(r);
            }
            _readyAt = new float[_nodes.Count];
            // 단추는 아래 가운데 조금 왼쪽 — 4:3 에선 오른쪽 단추 열(탈것·횡소)이 가운데까지 들어온다(UiLayoutCheck 자리표).
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("GatherCanvas", 90, transform);
            _hint = SagaUi.NewButton(canvas.transform, "GatherHint", "", new Vector2(0.5f, 0f), new Vector2(-120f, 230f), new Vector2(300f, 64f), SagaUi.ButtonAccent, 24f);
            _hint.onClick.AddListener(() => { if (_near >= 0) Gather(_near); });
            _hint.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (_player == null) { var pl = GameObject.FindWithTag("Player"); _player = pl != null ? pl.transform : null; if (_player == null) return; }
            for (int i = 0; i < _bush.Count; i++)
            {
                var c = Time.time >= _readyAt[i] ? Fresh : Spent;
                if (_bush[i].material.color != c) _bush[i].material.color = c;
            }
            Sense();
            var kb = Keyboard.current;
            if (_near >= 0 && kb != null && kb.fKey.wasPressedThisFrame) Gather(_near);
        }

        /// <summary>곁 덤불을 찾아 단추를 맞춘다. 진단도 부른다.</summary>
        public void Sense()
        {
            _near = -1;
            if (_player != null)
            {
                for (int i = 0; i < _nodes.Count; i++)
                {
                    Vector3 d = _player.position - _nodes[i].position;
                    if (Mathf.Abs(d.x) <= ReachX && d.y > -0.5f && d.y <= ReachY) { _near = i; break; }
                }
            }
            bool show = _near >= 0;
            if (show)
            {
                float left = CooldownLeft(_near);
                _hint.GetComponentInChildren<TMPro.TMP_Text>().text = left > 0f
                    ? string.Format(StoryLocalization.T("life.wait", "🌿 다시 자라는 중 {0:0}초"), Mathf.Ceil(left))
                    : StoryLocalization.T("life.hint", "🌿 캔다 (F)");
            }
            if (_hint.gameObject.activeSelf != show) _hint.gameObject.SetActive(show);
        }

        /// <summary>덤불 i 를 캔다 — 쿨이면 false. 진단이 곧장 부른다.</summary>
        public bool Gather(int i)
        {
            if (i < 0 || i >= _nodes.Count || Time.time < _readyAt[i]) return false;
            _readyAt[i] = Time.time + CooldownSec;
            int n = StoryLife.Gather(_rng, out string rankUp);
            string line = string.Format(StoryLocalization.T("life.got", "🌿 재료 +{0}{1} — 채집 {2}"), n,
                n > 1 ? StoryLocalization.T("life.extra", " (덤)") : "", StoryLife.GatherRankName);
            if (rankUp != null) line += "\n" + StoryLife.RankUpLine(rankUp);
            DialogueLabel.Instance?.Show(line, rankUp != null ? 4f : 2f);
            StoryAudio.PlaySfx("item_pick");
            return true;
        }

        /// <summary>진단 — 쿨을 비운다.</summary>
        public void ResetCooldownsForTest()
        {
            for (int i = 0; i < _readyAt.Length; i++) _readyAt[i] = 0f;
        }
    }
}
