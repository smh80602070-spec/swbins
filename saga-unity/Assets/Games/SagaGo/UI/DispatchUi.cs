using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-14-26 탐사 창(웹 사가고 ⑲-26 탐사 시트) — 역참 게시판 곁이면 위 오른쪽 "탐사"(끝난 게 있으면 ●N) 단추·F(이야기·낚시·게시판이 먼저)로 연다.
    /// 위에 보낼 동료(◀ ▶ — 들판 명단 밖 도감 동료)·시간(◀ ▶ 4·8·12·20시간), 아래 탐사지 여덟 줄(이름·시대·원소·상태·보상)과 보내기/부르기·받기, 모두 받기.
    /// 1초마다 새로 끝난 탐사를 알린다(불러온 직후는 모아 한 줄). `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다.
    /// </summary>
    public class DispatchUi : MonoBehaviour
    {
        public static DispatchUi Instance { get; private set; }

        private const float RowTop = 250f, RowStep = 56f;
        public const float CheckSec = 1f;

        private GameObject _panel;
        private TextMeshProUGUI _title, _heroText, _hoursText;
        private readonly TextMeshProUGUI[] _rows = new TextMeshProUGUI[8];
        private readonly Button[] _act = new Button[8], _claim = new Button[8];
        private readonly TextMeshProUGUI[] _actText = new TextMeshProUGUI[8];
        private int _heroAt, _hoursAt = 1;
        private float _check, _tick;

        public Button OpenButton { get; private set; }
        public Button AllButton { get; private set; }
        public Button CloseButton { get; private set; }
        public Button HeroPrev { get; private set; }
        public Button HeroNext { get; private set; }
        public Button HoursPrev { get; private set; }
        public Button HoursNext { get; private set; }
        public Button ActButton(int i) => _act[i];
        public Button ClaimButton(int i) => _claim[i];
        public string RowText(int i) => _rows[i].text;
        public string ActLabel(int i) => _actText[i].text;
        public string HeroLabel => _heroText.text;
        public string HoursLabel => _hoursText.text;
        public string TitleText => _title.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public int Hours => GoDispatch.Hours[_hoursAt];
        /// <summary>진단 — 게시판 곁 판정을 대신한다(−1 = 진짜 판정, 0 = 항상 밖, 1 = 항상 곁).</summary>
        public static int AtBoardForTest = -1;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            DispatchState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            DispatchState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();

        public static bool AtBoard() => AtBoardForTest >= 0 ? AtBoardForTest == 1 : DispatchField.PlayerAtBoard();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private Button Btn(Transform parent, string label, Vector2 pos, Vector2 size, int font, UnityEngine.Events.UnityAction a)
        {
            var b = EncounterUiKit.NewButton(parent, label, new Vector2(0.5f, 0.5f), pos, size, null);
            Center((RectTransform)b.transform);
            b.GetComponentInChildren<TextMeshProUGUI>().fontSize = font;
            b.onClick.AddListener(a);
            return b;
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("DispatchUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("dispatch.button", "탐사"), new Vector2(1f, 1f), new Vector2(-200f, -130f), new Vector2(130f, 80f), null);
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("DispatchPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-120f, 390f), new Vector2(1000f, 40f), 26);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            AllButton = Btn(_panel.transform, GoLocalization.T("dispatch.claim_all", "모두 받기"), new Vector2(560f, 390f), new Vector2(260f, 48f), 20, ClaimAll);

            HeroPrev = Btn(_panel.transform, "◀", new Vector2(-590f, 322f), new Vector2(60f, 48f), 22, () => PickHero(-1));
            _heroText = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-360f, 322f), new Vector2(380f, 48f), 19);
            Center(_heroText.rectTransform);
            HeroNext = Btn(_panel.transform, "▶", new Vector2(-130f, 322f), new Vector2(60f, 48f), 22, () => PickHero(1));
            HoursPrev = Btn(_panel.transform, "◀", new Vector2(110f, 322f), new Vector2(60f, 48f), 22, () => PickHours(-1));
            _hoursText = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(300f, 322f), new Vector2(240f, 48f), 19);
            Center(_hoursText.rectTransform);
            HoursNext = Btn(_panel.transform, "▶", new Vector2(490f, 322f), new Vector2(60f, 48f), 22, () => PickHours(1));

            for (int i = 0; i < 8; i++)
            {
                int k = i;
                float y = RowTop - i * RowStep;
                _rows[i] = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-330f, y), new Vector2(700f, 52f), 16);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                _rows[i].lineSpacing = -6f;
                Center(_rows[i].rectTransform);
                _act[i] = Btn(_panel.transform, "", new Vector2(250f, y), new Vector2(170f, 46f), 17, () => Act(k));
                _actText[i] = _act[i].GetComponentInChildren<TextMeshProUGUI>();
                _claim[i] = Btn(_panel.transform, GoLocalization.T("dispatch.claim", "받기"), new Vector2(440f, y), new Vector2(170f, 46f), 17, () => Claim(k));
            }

            CloseButton = Btn(_panel.transform, GoLocalization.T("dex.close", "닫는다"), new Vector2(0f, -405f), new Vector2(200f, 44f), 20, Close);
        }

        // ---- 동작(진단도 부른다) ----

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (_panel == null) return;
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        private string HeroId()
        {
            var c = DispatchState.Candidates();
            if (c.Count == 0) return null;
            _heroAt = Mathf.Clamp(_heroAt, 0, c.Count - 1);
            return c[_heroAt];
        }

        public void PickHero(int d)
        {
            var c = DispatchState.Candidates();
            if (c.Count > 0) _heroAt = ((_heroAt + d) % c.Count + c.Count) % c.Count;
            Refresh();
        }

        public void PickHours(int d)
        {
            int n = GoDispatch.Hours.Length;
            _hoursAt = ((_hoursAt + d) % n + n) % n;
            Refresh();
        }

        /// <summary>줄의 보내기/부르기 단추.</summary>
        public void Act(int i)
        {
            var s = GoDispatch.Sites[i];
            string why = DispatchState.IsOut(s.Id)
                ? DispatchState.Recall(s.Id, AtBoard())
                : DispatchState.Send(s.Id, HeroId(), Hours, AtBoard());
            if (why != null) Toast(why);
            Refresh();
        }

        public void Claim(int i)
        {
            var s = GoDispatch.Sites[i];
            string got = DispatchState.Claim(s.Id, AtBoard(), out string why);
            Toast(got != null ? string.Format(GoLocalization.T("dispatch.got", "탐사를 마쳤다 — {0}"), got) : why);
            Refresh();
        }

        public void ClaimAll()
        {
            int n = DispatchState.ClaimAll(AtBoard());
            if (n > 0) Toast(string.Format(GoLocalization.T("dispatch.got_all", "탐사 {0}곳을 받았다"), n));
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        /// <summary>새로 끝난 탐사를 알린다 — 알린 글(진단도 부른다).</summary>
        public List<string> CheckNow()
        {
            var list = DispatchState.Check();
            foreach (var t in list) Toast(t);
            return list;
        }

        // ---- 글 ----

        private string RowLine(int i)
        {
            var s = GoDispatch.Sites[i];
            string head = $"<b>{s.Name}</b>  <size=14><color=#b9c2cc>{GoEras.EraName(s.Era)} · {GoElements.NameOf(s.El)} · {s.Place}</color></size>";
            string body;
            if (DispatchState.TryOut(s.Id, out var e))
            {
                GoHeroes.TryGet(e.hero, out var h);
                long left = DispatchState.Left(s.Id);
                var r = GoDispatch.RewardOf(s, e.hours, GoDispatch.Fits(s, e.hero));
                body = (left == 0
                    ? string.Format(GoLocalization.T("dispatch.row_done", "{0} 돌아옴 — 받으세요: {1}"), GoHeroes.Name(h), GoDispatch.RewardText(r))
                    : string.Format(GoLocalization.T("dispatch.row_out", "{0} 탐사 중 — 남은 {1} ({2}시간): {3}"), GoHeroes.Name(h), GoDispatch.TimeText(left), e.hours, GoDispatch.RewardText(r)));
            }
            else if (!DispatchState.Open(s)) body = string.Format(GoLocalization.T("dispatch.row_locked", "잠김 — {0} 을(를) 밟으면 열린다"), s.Place);
            else
            {
                string hid = HeroId();
                bool fit = hid != null && GoDispatch.Fits(s, hid);
                body = s.Desc + " — " + GoDispatch.RewardText(GoDispatch.RewardOf(s, Hours, fit)) + (fit ? " ★" : "");
            }
            return head + "\n<size=14>" + body + "</size>";
        }

        public void Refresh()
        {
            if (_panel == null) return;
            int done = DispatchState.DoneList().Count;
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("dispatch.button", "탐사") + (done > 0 ? " ●" + done : "");
            open.color = done > 0 ? new Color(1f, 0.88f, 0.4f) : Color.white;
            if (!IsOpen) return;
            bool atBoard = AtBoard();
            _title.text = string.Format(GoLocalization.T("dispatch.title", "탐사 파견 — 자리 {0}/{1} · 다녀온 탐사 {2}"), DispatchState.Used, DispatchState.Slots, DispatchState.Done);
            string hid = HeroId();
            if (hid != null && GoHeroes.TryGet(hid, out var hero))
                _heroText.text = $"{GoHeroes.Name(hero)}  <size=14>{GoElements.NameOf(GoElements.ForMember(hid))}</size>";
            else _heroText.text = GoLocalization.T("dispatch.no_hero", "보낼 동료가 없다 (들판 명단 밖 동료만)");
            _hoursText.text = string.Format(GoLocalization.T("dispatch.hours", "{0}시간 (×{1})"), Hours, GoDispatch.MulOf(Hours));
            bool many = DispatchState.Candidates().Count > 1;
            HeroPrev.interactable = HeroNext.interactable = many;
            AllButton.interactable = done > 0 && atBoard;
            for (int i = 0; i < 8; i++)
            {
                var s = GoDispatch.Sites[i];
                _rows[i].text = RowLine(i);
                bool isOut = DispatchState.IsOut(s.Id);
                _actText[i].text = isOut ? GoLocalization.T("dispatch.recall", "부르기") : GoLocalization.T("dispatch.send", "보내기");
                _act[i].interactable = atBoard && (isOut || (DispatchState.Open(s) && hid != null));
                _claim[i].interactable = atBoard && isOut && DispatchState.Left(s.Id) == 0;
            }
            if (!atBoard) _title.text += "  " + GoLocalization.T("dispatch.away_hint", "· 게시판 곁에서만 보내고 받는다");
        }

        /// <summary>"탐사" 단추를 게시판 곁에서만 보인다(창이 열려 있는 동안은 숨김 — 창 글과 안 겹치게). 진단도 부른다.</summary>
        public void UpdateShown()
        {
            if (OpenButton != null) OpenButton.gameObject.SetActive(!IsOpen && AtBoard());
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                bool busy = FishingField.Busy || StoryState.Talking || (StoryUi.Instance != null && StoryUi.Instance.TalkShown)
                    || (FishingUi.Instance != null && (FishingUi.Instance.BoardOpen || GoFishing.NearBoard(FeetXZ()) || GoFishing.NearSpot(FeetXZ()) != null));
                if (kb.fKey.wasPressedThisFrame)
                {
                    if (IsOpen) Close();
                    else if (!busy && AtBoard()) Open();
                }
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            UpdateShown();
            _check -= Time.unscaledDeltaTime;
            if (_check <= 0f) { _check = CheckSec; CheckNow(); }
            _tick -= Time.unscaledDeltaTime;
            if (_tick <= 0f) { _tick = 1f; Refresh(); }
        }

        private static Vector2 FeetXZ()
        {
            var fc = FieldCombat.Instance;
            return fc != null ? new Vector2(fc.transform.position.x, fc.transform.position.z) : Vector2.zero;
        }
    }
}
