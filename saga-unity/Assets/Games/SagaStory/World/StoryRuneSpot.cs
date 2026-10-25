using Saga.Core;
using Saga.Story.Data;
using Saga.Story.UI;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// tasks U-0230 ① 룬 런타임 — 들판(비경 밖)에서 `StoryRune.GapOf` 마다 플레이어 앞 7m 땅에 빛나는 원판(코드 도형·충돌 없음).
    /// 1.2m 안으로 오면 입력 창: 화살표 넷과 진행 · 방향키 또는 폰 화살 단추 넷 · 6초 · 다 맞히면 10분 경험치 ×2, 틀리면 사라짐.
    /// 엘리트 띠·화면 살짝 어둡게도 여기 덧칠이 맡는다(<see cref="Flash"/>). `StoryEnemySpawner.Start` 가 붙인다.
    /// </summary>
    public class StoryRuneSpot : MonoBehaviour
    {
        public enum Phase { Idle, Placed, Input }

        public static StoryRuneSpot Instance { get; private set; }
        public Phase State { get; private set; } = Phase.Idle;
        public int[] Sequence { get; private set; }
        public int Step { get; private set; }
        public int Count { get; private set; }
        public Vector3 RunePos { get; private set; }

        private float _wait = -1f, _inputLeft, _flashLeft;
        private GameObject _rune;
        private GameObject _panel;
        private Text _arrows;
        private Image _dim;
        private Transform _player;

        private void Awake()
        {
            Instance = this;
            var canvas = SagaUi.NewHudCanvas("RuneCanvas", 40, transform);
            _dim = NewImage(canvas.transform, "EliteDim", new Color(0f, 0f, 0f, 0f), Vector2.zero, Vector2.one);
            _panel = new GameObject("RunePanel", typeof(RectTransform));
            _panel.transform.SetParent(canvas.transform, false);
            var rt = (RectTransform)_panel.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.62f); rt.sizeDelta = new Vector2(640f, 300f);
            _panel.AddComponent<Image>().color = new Color(0.05f, 0.08f, 0.15f, 0.85f);
            var tgo = new GameObject("Arrows", typeof(RectTransform));
            tgo.transform.SetParent(_panel.transform, false);
            var trt = (RectTransform)tgo.transform; trt.anchorMin = new Vector2(0f, 0.45f); trt.anchorMax = Vector2.one; trt.offsetMin = trt.offsetMax = Vector2.zero;
            _arrows = tgo.AddComponent<Text>();
            _arrows.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _arrows.fontSize = 72; _arrows.alignment = TextAnchor.MiddleCenter; _arrows.color = Color.white; _arrows.raycastTarget = false;
            for (int d = 0; d < 4; d++)
            {
                int dir = d;
                var b = SagaUi.NewButton(_panel.transform, "Btn_Rune" + d, StoryRune.ArrowText[d], new Vector2(0.5f, 0.2f), new Vector2(-195f + d * 130f, 0f), new Vector2(110f, 90f), SagaUi.ButtonIdle, 48f);
                b.onClick.AddListener(() => Press(dir));
            }
            _panel.SetActive(false);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; if (_rune != null) Destroy(_rune); }

        private static Image NewImage(Transform parent, string name, Color c, Vector2 min, Vector2 max)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform; rt.anchorMin = min; rt.anchorMax = max; rt.offsetMin = rt.offsetMax = Vector2.zero;
            var img = go.AddComponent<Image>(); img.color = c; img.raycastTarget = false;
            return img;
        }

        /// <summary>엘리트 띠 — 토스트 + 화면 살짝 어둡게 2.5초.</summary>
        public static void Flash(string line)
        {
            DialogueLabel.Instance?.Show(line, 3.5f);
            if (Instance != null) Instance._flashLeft = 2.5f;
        }

        private void Update()
        {
            if (_flashLeft > 0f) { _flashLeft -= Time.deltaTime; _dim.color = new Color(0f, 0f, 0f, 0.18f * Mathf.Clamp01(_flashLeft)); }
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            // 이야기 장면 카드가 열린 동안은 룬이 서지도 흐르지도 않고 창도 숨긴다(카드 대사를 가렸다 — U-0230 촬영)
            bool busy = StoryScenarioUi.Instance != null && StoryScenarioUi.Instance.IsOpen;
            if (_panel != null) _panel.SetActive(State == Phase.Input && !busy);
            if (busy) return;
            var kb = Keyboard.current;
            if (State == Phase.Input && kb != null)
            {
                if (kb.leftArrowKey.wasPressedThisFrame) Press(0);
                else if (kb.upArrowKey.wasPressedThisFrame) Press(1);
                else if (kb.rightArrowKey.wasPressedThisFrame) Press(2);
                else if (kb.downArrowKey.wasPressedThisFrame) Press(3);
            }
            float facing = 1f;
            var pc = _player.GetComponent<Saga.Story.Player.StoryPlayerController>();
            if (pc != null) facing = pc.Facing;
            Tick(Time.deltaTime, _player.position, facing, StoryLabyrinthState.InRun);
        }

        /// <summary>한 프레임(진단은 시간·자리를 넘겨 직접 부른다).</summary>
        public void Tick(float dt, Vector3 player, float facing, bool inLabyrinth)
        {
            if (!StoryRune.On || inLabyrinth) { if (State != Phase.Idle) Clear(); return; }
            switch (State)
            {
                case Phase.Idle:
                    if (_wait < 0f) _wait = StoryRune.GapOf(Count);
                    _wait -= dt;
                    if (_wait <= 0f) Place(player + new Vector3(facing * StoryRune.Ahead, 0f, 0f));
                    break;
                case Phase.Placed:
                    if (Mathf.Abs(player.x - RunePos.x) <= StoryRune.TouchR) BeginInput();
                    break;
                case Phase.Input:
                    _inputLeft -= dt;
                    if (_inputLeft <= 0f) Fail();
                    break;
            }
        }

        public void Place(Vector3 at)
        {
            Clear();
            RunePos = new Vector3(at.x, 0f, at.z);
            Sequence = StoryRune.SequenceOf(Count);
            Count++;
            _wait = -1f;
            _rune = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _rune.name = "Rune";
            Destroy(_rune.GetComponent<Collider>());
            _rune.transform.position = RunePos + Vector3.up * 0.05f;
            _rune.transform.localScale = new Vector3(1.4f, 0.04f, 1.4f);
            var m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Rune (generated)", color = new Color(0.3f, 0.85f, 1f) };
            m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", new Color(0.2f, 0.7f, 1f) * 1.5f);
            _rune.GetComponent<MeshRenderer>().sharedMaterial = m;
            State = Phase.Placed;
        }

        private void BeginInput()
        {
            State = Phase.Input; Step = 0; _inputLeft = StoryRune.InputSec;
            _panel.SetActive(true);
            Paint();
        }

        /// <summary>화살 하나(방향키·단추·진단) — 0←·1↑·2→·3↓.</summary>
        public void Press(int dir)
        {
            if (State != Phase.Input) return;
            if (dir != Sequence[Step]) { Fail(); return; }
            Step++;
            if (Step >= Sequence.Length)
            {
                StoryRune.GrantBuff();
                DialogueLabel.Instance?.Show(StoryLocalization.T("rune.ok", "✨ 룬 해방 — 10분 동안 경험치 ×2"), 3.5f);
                Clear();
                return;
            }
            Paint();
        }

        private void Fail()
        {
            DialogueLabel.Instance?.Show(StoryLocalization.T("rune.fail", "룬이 흩어졌다"), 2f);
            Clear();
        }

        private void Clear()
        {
            State = Phase.Idle;
            if (_rune != null) Destroy(_rune);
            _rune = null;
            if (_panel != null) _panel.SetActive(false);
        }

        private void Paint()
        {
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < Sequence.Length; i++)
            {
                string a = StoryRune.ArrowText[Sequence[i]];
                sb.Append(i < Step ? $"<color=#ffd34d>{a}</color>" : a).Append(i < Sequence.Length - 1 ? "  " : "");
            }
            _arrows.supportRichText = true;
            _arrows.text = sb.ToString();
        }

        public bool PanelShown => _panel != null && _panel.activeSelf;
    }
}
