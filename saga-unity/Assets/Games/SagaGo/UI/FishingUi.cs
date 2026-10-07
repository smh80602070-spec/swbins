using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-14-24 낚시 화면(웹 사가만리 ⑲-24) — 낚시터 곁이면 "낚시" 단추(위 오른쪽 지도 왼쪽)·F 키로 시작,
    /// 아래 가운데 낚시 칸(미끼 셋·◀ 가까이 멀리 ▶·던지기/당기기 큰 단추·그만) + 줄다리기 막대(물고기 칸·찌·잡는 막대) ·
    /// 다리목 게시판 곁이면 "게시판" 단추·F 로 조합 창(물고기 → 갯바람 작살·금·쪽지·강화석·매듭).
    /// 키: F 던지기·당기기(길게)·게시판 · T 미끼 바꾸기 · Esc 그만. `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다.
    /// </summary>
    public class FishingUi : MonoBehaviour
    {
        public static FishingUi Instance { get; private set; }

        // 아래 가운데는 들판 전투 HUD(이름·체력·기력 막대 — 위로 ~206)가 차지해서 낚시 칸은 그 위에 앉힌다
        private const float PanelW = 420f, PanelH = 226f, PanelY = 215f, BarY = PanelH + 22f;

        private FishingFlow _flow;
        private GameObject _hud, _bar, _board;
        private TextMeshProUGUI _stateText, _actionText, _barText;
        private readonly Button[] _bait = new Button[3];
        private readonly TextMeshProUGUI[] _baitText = new TextMeshProUGUI[3];
        private RectTransform _zone, _cursor, _progress;
        private TextMeshProUGUI _boardTitle, _boardBag;
        private readonly TextMeshProUGUI[] _rows = new TextMeshProUGUI[6];
        private readonly Button[] _swap = new Button[6];
        private float _along, _side, _refresh;

        public Button OpenButton { get; private set; }
        public Button BoardButton { get; private set; }
        public Button CloserButton { get; private set; }
        public Button FartherButton { get; private set; }
        public Button LeftButton { get; private set; }
        public Button RightButton { get; private set; }
        public Button ActionButton { get; private set; }
        public Button QuitButton { get; private set; }
        public Button BoardClose { get; private set; }
        public Button BaitButton(int i) => _bait[i];
        public Button SwapButton(int i) => _swap[i];
        public string StateText => _stateText.text;
        public string ActionLabel => _actionText.text;
        public string RowText(int i) => _rows[i].text;
        public string BagText => _boardBag.text;
        public bool HudOpen => _hud != null && _hud.activeSelf;
        public bool BarOpen => _bar != null && _bar.activeSelf;
        public bool BoardOpen => _board != null && _board.activeSelf;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            if (_flow != null) _flow.Changed -= Refresh;
            FishState.Changed -= OnData;
            CookState.Changed -= OnData;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            _flow = FishingField.Instance != null ? FishingField.Instance.Flow : null;
            if (_flow != null) _flow.Changed += Refresh;
            FishState.Changed += OnData;
            CookState.Changed += OnData;
            _hud.SetActive(false);
            _bar.SetActive(false);
            _board.SetActive(false);
            Refresh();
        }

        private void OnData() => Refresh();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("FishingUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);
            var bottom = new Vector2(0.5f, 0f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("fish.button", "낚시"), new Vector2(1f, 1f), new Vector2(-200f, -230f), new Vector2(130f, 80f), null);
            OpenButton.onClick.AddListener(ToggleFishing);
            BoardButton = EncounterUiKit.NewButton(t, GoLocalization.T("fish.board_button", "게시판"), new Vector2(1f, 1f), new Vector2(-200f, -130f), new Vector2(130f, 80f), null);
            BoardButton.onClick.AddListener(ToggleBoard);

            // ---- 낚시 칸(아래 가운데) ----
            _hud = new GameObject("FishHud", typeof(RectTransform));
            _hud.transform.SetParent(t, false);
            var hr = (RectTransform)_hud.transform;
            hr.anchorMin = hr.anchorMax = hr.pivot = bottom;
            hr.anchoredPosition = new Vector2(0f, PanelY);
            hr.sizeDelta = new Vector2(PanelW, PanelH);
            _hud.AddComponent<Image>().color = new Color(0.03f, 0.05f, 0.07f, 0.72f);

            _stateText = EncounterUiKit.NewText(_hud.transform, "", bottom, new Vector2(0f, 162f), new Vector2(PanelW - 12f, 58f), 16);
            _stateText.lineSpacing = -6f;
            for (int i = 0; i < 3; i++)
            {
                int k = i;
                _bait[i] = HudButton(GoLocalization.T("fish.bait_pick", "미끼"), bottom, new Vector2((i - 1) * 144f, 116f), new Vector2(132f, 40f), 15);
                _bait[i].onClick.AddListener(() => PickBait(k));
                _baitText[i] = _bait[i].GetComponentInChildren<TextMeshProUGUI>();
            }
            LeftButton = HoldButton("◀", bottom, new Vector2(-162f, 68f), new Vector2(96f, 40f), 0f, -1f);
            CloserButton = HoldButton(GoLocalization.T("fish.closer", "가까이"), bottom, new Vector2(-54f, 68f), new Vector2(96f, 40f), -1f, 0f);
            FartherButton = HoldButton(GoLocalization.T("fish.farther", "멀리"), bottom, new Vector2(54f, 68f), new Vector2(96f, 40f), 1f, 0f);
            RightButton = HoldButton("▶", bottom, new Vector2(162f, 68f), new Vector2(96f, 40f), 0f, 1f);

            ActionButton = HudButton("", bottom, new Vector2(-85f, 8f), new Vector2(250f, 52f), 20);
            _actionText = ActionButton.GetComponentInChildren<TextMeshProUGUI>();
            var trig = ActionButton.gameObject.AddComponent<EventTrigger>();
            AddTrigger(trig, EventTriggerType.PointerDown, () => ActionDown());
            AddTrigger(trig, EventTriggerType.PointerUp, () => ActionUp());
            ActionButton.onClick.AddListener(ActionClick); // 누름·뗌은 위 EventTrigger 가 받는다 — 빈 클릭은 배선 점검(죽은 버튼)용
            QuitButton = HudButton(GoLocalization.T("fish.quit", "그만"), bottom, new Vector2(131f, 8f), new Vector2(158f, 52f), 18);
            QuitButton.onClick.AddListener(Quit);

            // ---- 줄다리기 막대 ----
            _bar = new GameObject("FishBar", typeof(RectTransform));
            _bar.transform.SetParent(t, false);
            var br = (RectTransform)_bar.transform;
            br.anchorMin = br.anchorMax = br.pivot = bottom;
            br.anchoredPosition = new Vector2(0f, PanelY);
            br.sizeDelta = new Vector2(PanelW, 300f);
            _barText = EncounterUiKit.NewText(_bar.transform, "", bottom, new Vector2(0f, BarY + 48f), new Vector2(PanelW, 26f), 15);
            Bar(_bar.transform, new Vector2(0f, BarY), new Vector2(PanelW, 28f), new Color(0.15f, 0.2f, 0.25f, 0.9f));
            _zone = Bar(_bar.transform, new Vector2(0f, BarY), new Vector2(60f, 28f), new Color(0.35f, 0.85f, 0.5f, 0.9f));
            _cursor = Bar(_bar.transform, new Vector2(0f, BarY), new Vector2(8f, 42f), Color.white);
            Bar(_bar.transform, new Vector2(0f, BarY + 28f), new Vector2(PanelW, 10f), new Color(0.15f, 0.2f, 0.25f, 0.9f));
            _progress = Bar(_bar.transform, new Vector2(0f, BarY + 28f), new Vector2(10f, 10f), new Color(1f, 0.82f, 0.3f, 1f));

            // ---- 게시판(조합) ----
            _board = new GameObject("FishBoard", typeof(RectTransform));
            _board.transform.SetParent(t, false);
            var pr = (RectTransform)_board.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _board.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);
            _boardTitle = EncounterUiKit.NewText(_board.transform, "", mid, new Vector2(0f, 390f), new Vector2(1200f, 40f), 26);
            _boardTitle.fontStyle = FontStyles.Bold;
            Center(_boardTitle.rectTransform);
            _boardBag = EncounterUiKit.NewText(_board.transform, "", mid, new Vector2(0f, 318f), new Vector2(1400f, 80f), 17);
            Center(_boardBag.rectTransform);
            for (int i = 0; i < _rows.Length; i++)
            {
                float y = 200f - i * 62f;
                int k = i;
                _rows[i] = EncounterUiKit.NewText(_board.transform, "", mid, new Vector2(-230f, y), new Vector2(820f, 56f), 17);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                _rows[i].lineSpacing = -6f;
                Center(_rows[i].rectTransform);
                _swap[i] = EncounterUiKit.NewButton(_board.transform, GoLocalization.T("fish.swap", "바꾸기"), mid, new Vector2(330f, y), new Vector2(200f, 48f), null);
                Center((RectTransform)_swap[i].transform);
                _swap[i].GetComponentInChildren<TextMeshProUGUI>().fontSize = 17;
                _swap[i].onClick.AddListener(() => Swap(k));
            }
            BoardClose = EncounterUiKit.NewButton(_board.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)BoardClose.transform);
            BoardClose.onClick.AddListener(CloseBoard);
        }

        private Button HudButton(string label, Vector2 anchor, Vector2 pos, Vector2 size, int font)
        {
            var b = EncounterUiKit.NewButton(_hud.transform, label, anchor, pos, size, null);
            ((RectTransform)b.transform).pivot = new Vector2(0.5f, 0f);
            b.GetComponentInChildren<TextMeshProUGUI>().fontSize = font;
            return b;
        }

        /// <summary>누르고 있는 동안 고리를 옮기는 단추(폰) — 서는 자리 기준 along(멀리 +)·side(오른쪽 +).</summary>
        private Button HoldButton(string label, Vector2 anchor, Vector2 pos, Vector2 size, float along, float side)
        {
            var b = HudButton(label, anchor, pos, size, 15);
            var trig = b.gameObject.AddComponent<EventTrigger>();
            AddTrigger(trig, EventTriggerType.PointerDown, () => { _along = along; _side = side; });
            AddTrigger(trig, EventTriggerType.PointerUp, () => { _along = 0f; _side = 0f; });
            b.onClick.AddListener(() => _flow?.Nudge(along, side, 0.03f)); // 톡 한 번 = 조금(길게 누르면 위 EventTrigger 가 계속 옮긴다)
            return b;
        }

        private static void AddTrigger(EventTrigger trig, EventTriggerType type, UnityEngine.Events.UnityAction a)
        {
            var e = new EventTrigger.Entry { eventID = type };
            e.callback.AddListener(_ => a());
            trig.triggers.Add(e);
        }

        private static RectTransform Bar(Transform parent, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject("Bar", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var r = (RectTransform)go.transform;
            r.anchorMin = r.anchorMax = new Vector2(0.5f, 0f);
            r.pivot = new Vector2(0.5f, 0.5f);
            r.anchoredPosition = pos;
            r.sizeDelta = size;
            go.AddComponent<Image>().color = c;
            return r;
        }

        // ---- 동작(진단도 이 메서드를 부른다) ----

        private static Vector2 Feet()
        {
            var fc = FieldCombat.Instance;
            return fc != null ? new Vector2(fc.transform.position.x, fc.transform.position.z) : Vector2.zero;
        }

        private static bool Fighting() => FieldCombat.Instance != null && FieldCombat.Instance.InCombat();

        public bool TryBegin() => _flow != null && _flow.Begin(Feet(), Fighting());

        public void ToggleFishing()
        {
            if (_flow == null) return;
            if (_flow.Busy) _flow.End();
            else TryBegin();
        }

        public void Quit() => _flow?.End();

        public void PickBait(int i)
        {
            if (_flow != null) _flow.SetBait(GoFishing.Baits[i]);
        }

        /// <summary>단추를 뗄 때 오는 클릭 — 하는 일 없음(누름·뗌은 `ActionDown`·`ActionUp`).</summary>
        private void ActionClick() { }

        public void ActionDown() => _flow?.Press(true);
        public void ActionUp() => _flow?.Press(false);

        public void OpenBoard()
        {
            if (_board == null || (_flow != null && _flow.Busy)) return;
            _board.SetActive(true);
            Refresh();
        }

        public void CloseBoard()
        {
            if (_board != null) _board.SetActive(false);
        }

        public void ToggleBoard()
        {
            if (BoardOpen) CloseBoard();
            else OpenBoard();
        }

        public void Swap(int i)
        {
            string got = FishState.Exchange(i);
            if (got.Length > 0) Toast(string.Format(GoLocalization.T("fish.swapped", "바꿨다 — {0}"), got));
            else { FishState.CanExchange(i, out string why); Toast(why); }
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        // ---- 글 ----

        private string StateLine()
        {
            if (_flow == null || _flow.Spot == null) return "";
            string s = _flow.State switch
            {
                FishingFlow.Phase.Aim => GoLocalization.T("fish.state.aim", "고리를 물 위로 옮기고(이동 키) 미끼를 골라 던진다"),
                FishingFlow.Phase.Wait => GoLocalization.T("fish.state.wait", "찌를 지켜본다 — 물고기가 다가온다"),
                FishingFlow.Phase.Nibble => GoLocalization.T("fish.state.nibble", "톡톡… 건드린다 — 아직 당기지 말 것"),
                FishingFlow.Phase.Bite => GoLocalization.T("fish.state.bite", "입질! — 지금 당겨라"),
                FishingFlow.Phase.Reel => GoLocalization.T("fish.state.reel", "길게 눌러 찌를 올려 물고기 칸 안에 붙잡는다"),
                _ => "",
            };
            return $"<b>{_flow.Spot.Name}</b> · " + string.Format(GoLocalization.T("fish.left", "물고기 {0}/{1}"), FishState.Left(_flow.Spot.Id), GoFishing.FishPerSpot) + "\n" + s;
        }

        private string ActionText() => _flow == null ? "" : _flow.State switch
        {
            FishingFlow.Phase.Aim => GoLocalization.T("fish.act.aim", "던지기 (F)"),
            FishingFlow.Phase.Wait => GoLocalization.T("fish.act.wait", "거두기 (F)"),
            FishingFlow.Phase.Nibble => GoLocalization.T("fish.act.nibble", "기다려…"),
            FishingFlow.Phase.Bite => GoLocalization.T("fish.act.bite", "당겨! (F)"),
            FishingFlow.Phase.Reel => GoLocalization.T("fish.act.reel", "당기기 — 길게 (F)"),
            _ => "",
        };

        public void Refresh()
        {
            if (_hud == null) return;
            bool busy = _flow != null && _flow.Busy;
            if (busy && BoardOpen) CloseBoard();
            _hud.SetActive(busy);
            _bar.SetActive(busy && _flow.State == FishingFlow.Phase.Reel);
            if (busy)
            {
                _stateText.text = StateLine();
                _actionText.text = ActionText();
                bool aim = _flow.State == FishingFlow.Phase.Aim;
                for (int i = 0; i < 3; i++)
                {
                    string b = GoFishing.Baits[i];
                    _baitText[i].text = $"{GoCooking.ItemName(b)} {CookState.Count(b)}";
                    _baitText[i].color = b == _flow.Bait ? new Color(1f, 0.88f, 0.4f) : Color.white;
                    _bait[i].interactable = aim || _flow.State == FishingFlow.Phase.Wait;
                }
                foreach (var b in new[] { LeftButton, CloserButton, FartherButton, RightButton }) b.interactable = aim;
                ActionButton.interactable = _flow.State != FishingFlow.Phase.Nibble;
            }
            if (BoardOpen) RefreshBoard();
        }

        private void RefreshBoard()
        {
            _boardTitle.text = GoLocalization.T("fish.board_title", "낚시 조합") + " — " + GoLocalization.T("fish.board_sub", "잡은 물고기를 바꾼다");
            var parts = new List<string>();
            foreach (var f in GoFishing.Fishes) parts.Add($"{f.Name} {f.Stars} ×{FishState.Count(f.Id)}");
            _boardBag.text = string.Join("  ·  ", parts);
            for (int i = 0; i < _rows.Length; i++)
            {
                var row = GoFishing.Exchange[i];
                var cost = new List<string>();
                foreach (var (fish, n) in row.Cost) cost.Add($"{GoFishing.FishOf(fish).Name} {FishState.Count(fish)}/{n}");
                _rows[i].text = $"<b>{row.Name}</b>\n<size=14><color=#b9c2cc>{string.Join(" · ", cost)}</color></size>";
                _swap[i].interactable = FishState.CanExchange(i, out _);
            }
        }

        // ---- 프레임 ----

        /// <summary>"낚시"·"게시판" 단추를 곁에 맞춰 보이거나 숨긴다(진단도 부른다).</summary>
        public void UpdateShown()
        {
            if (_flow == null) return;
            Vector2 p = Feet();
            bool busy = _flow.Busy;
            if (OpenButton != null)
            {
                OpenButton.gameObject.SetActive(busy || GoFishing.NearSpot(p) != null);
                var lbl = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
                string want = busy ? GoLocalization.T("fish.quit", "그만") : GoLocalization.T("fish.button", "낚시");
                if (lbl != null && lbl.text != want) lbl.text = want;
            }
            bool nearBoard = GoFishing.NearBoard(p);
            if (BoardButton != null) BoardButton.gameObject.SetActive(!BoardOpen && !busy && nearBoard); // 창이 열려 있는 동안엔 숨김(창 글과 안 겹치게) — 닫기는 "닫는다"·Esc·F
            if (BoardOpen && !nearBoard) CloseBoard();
        }

        private void Update()
        {
            if (_flow == null) return;
            Vector2 p = Feet();
            bool busy = _flow.Busy;
            bool nearSpot = GoFishing.NearSpot(p) != null;
            bool nearBoard = GoFishing.NearBoard(p);
            UpdateShown();

            var kb = Keyboard.current;
            if (kb != null)
            {
                bool talk = StoryState.Talking || (StoryUi.Instance != null && StoryUi.Instance.TalkShown);
                if (kb.fKey.wasPressedThisFrame)
                {
                    if (busy) _flow.Press(true);
                    else if (BoardOpen) CloseBoard();
                    else if (!talk)
                    {
                        if (nearSpot) TryBegin();
                        else if (nearBoard) OpenBoard();
                    }
                }
                if (kb.fKey.wasReleasedThisFrame) _flow.Press(false);
                if (kb.tKey.wasPressedThisFrame && (busy || nearSpot)) _flow.CycleBait();
                if (kb.escapeKey.wasPressedThisFrame)
                {
                    if (BoardOpen) CloseBoard();
                    else if (busy) _flow.End();
                }
            }

            if (_flow.State == FishingFlow.Phase.Aim && (_along != 0f || _side != 0f)) _flow.Nudge(_along, _side, Time.deltaTime);
            if (_bar != null && _bar.activeSelf)
            {
                _zone.anchoredPosition = new Vector2((_flow.ZoneC - 0.5f) * PanelW, BarY);
                _zone.sizeDelta = new Vector2(_flow.ZoneW * PanelW, 28f);
                _cursor.anchoredPosition = new Vector2((_flow.Cursor - 0.5f) * PanelW, BarY);
                _progress.sizeDelta = new Vector2(Mathf.Max(2f, _flow.Progress * PanelW), 10f);
                _progress.anchoredPosition = new Vector2((_flow.Progress - 1f) * PanelW * 0.5f, BarY + 28f);
                _barText.text = GoLocalization.T("fish.bar", "찌를 초록 칸 안에 붙잡는다");
            }
            _refresh -= Time.unscaledDeltaTime;
            if (_refresh <= 0f) { _refresh = 0.25f; Refresh(); }
        }
    }
}
