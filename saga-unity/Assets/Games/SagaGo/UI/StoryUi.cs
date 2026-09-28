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
    /// PLAN.md 109-14-12 이야기 임무 — 화면(웹 `story.js` 추적 줄·💬 단추·대화 창·O 목록). `WorldMapBuilder` 가 Play 때 붙인다(런타임 UI 라 람다 리스너).
    /// - 추적 줄: 위쪽 가운데, 대사 자막(위에서 112~)·지역 사명 줄(228~) 밑 284 — "◆ 장 이름 — 할 일 · 120m". 누르면(또는 O) 목록.
    /// - 대화 단추: talk 단계 인물 5m 안이면 아래 가운데 "누리와 이야기 (F)". 대화 창은 한 줄씩(F·다음 단추), 고르는 줄은 단추 둘(F = 첫째).
    ///   창이 열린 동안 `StoryState.Talking` — 들판 전투 입력·적이 멎는다. 숨은 터 도전·결투·등장 컷 중엔 안 열린다.
    /// - 목록: 장마다 끝남·진행 중(단계 ✓ ◆ ◇)·잠김(여정 등급 N).
    /// </summary>
    public class StoryUi : MonoBehaviour
    {
        public static StoryUi Instance { get; private set; }

        private GameObject _talk, _list;
        private TextMeshProUGUI _trackText, _who, _line, _count, _listText;
        private Button _next;
        private readonly Button[] _picks = new Button[2];
        private GoStory.Step _talkStep;
        private int _talkLine;
        private string _lastTrack;

        public Button TrackButton { get; private set; }
        public Button TalkButton { get; private set; }
        public Button NextButton => _next;
        public Button PickButton(int i) => _picks[i];
        public Button ListClose { get; private set; }
        public string TrackText => _trackText != null ? _trackText.text : "";
        public bool TrackShown => TrackButton != null && TrackButton.gameObject.activeSelf;
        public bool TalkShown => TalkButton != null && TalkButton.gameObject.activeSelf;
        public bool TalkOpen => _talk != null && _talk.activeSelf;
        public bool ListOpen => _list != null && _list.activeSelf;
        public string LineText => _line != null ? _line.text : "";
        public string WhoText => _who != null ? _who.text : "";
        public string ListText => _listText != null ? _listText.text : "";

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            StoryState.Talking = false;
        }

        private void Start()
        {
            var canvas = EncounterUiKit.NewCanvas("StoryUI");
            canvas.sortingOrder = 5;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            // 추적 줄 — 누르면 목록
            TrackButton = EncounterUiKit.NewButton(t, "", new Vector2(0.5f, 1f), new Vector2(0f, -284f), new Vector2(760f, 40f), () => ToggleList());
            TrackButton.name = "Btn_이야기";
            TrackButton.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            _trackText = TrackButton.GetComponentInChildren<TextMeshProUGUI>();
            _trackText.fontSize = 20;
            _trackText.color = new Color(1f, 0.86f, 0.45f);
            _trackText.raycastTarget = false;
            Saga.Core.TmpEffect.Add(_trackText.gameObject, Saga.Core.TmpEffect.Kind.Outline, new Color(0f, 0f, 0f, 0.8f), 0.18f);

            // 대화 단추 — 곁일 때만
            TalkButton = EncounterUiKit.NewButton(t, "", new Vector2(0.5f, 0f), new Vector2(0f, 360f), new Vector2(360f, 60f), () => StartTalk());
            TalkButton.name = "Btn_대화";
            TalkButton.GetComponent<Image>().color = new Color(0.1f, 0.08f, 0.02f, 0.75f);
            TalkButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 22;
            TalkButton.gameObject.SetActive(false);

            // 대화 창
            _talk = new GameObject("StoryTalk", typeof(RectTransform));
            _talk.transform.SetParent(t, false);
            var r = (RectTransform)_talk.transform;
            r.anchorMin = r.anchorMax = r.pivot = mid;
            r.anchoredPosition = new Vector2(0f, -150f);
            r.sizeDelta = new Vector2(1040f, 280f);
            _talk.AddComponent<Image>().color = new Color(0.04f, 0.03f, 0.02f, 0.92f);
            _who = EncounterUiKit.NewText(_talk.transform, "", mid, new Vector2(0f, 100f), new Vector2(980f, 40f), 24);
            _who.rectTransform.pivot = mid;
            _who.fontStyle = FontStyles.Bold;
            _who.color = new Color(1f, 0.82f, 0.4f);
            _line = EncounterUiKit.NewText(_talk.transform, "", mid, new Vector2(0f, 20f), new Vector2(980f, 110f), 22);
            _line.rectTransform.pivot = mid;
            _count = EncounterUiKit.NewText(_talk.transform, "", mid, new Vector2(-400f, -95f), new Vector2(160f, 36f), 16);
            _count.rectTransform.pivot = mid;
            _count.color = new Color(0.75f, 0.72f, 0.65f);
            _next = EncounterUiKit.NewButton(_talk.transform, "", mid, new Vector2(330f, -95f), new Vector2(260f, 56f), () => Next(-1));
            ((RectTransform)_next.transform).pivot = mid;
            for (int i = 0; i < 2; i++)
            {
                int k = i;
                _picks[i] = EncounterUiKit.NewButton(_talk.transform, "", mid, new Vector2(i == 0 ? -250f : 250f, -95f), new Vector2(440f, 56f), () => Next(k));
                ((RectTransform)_picks[i].transform).pivot = mid;
            }
            _talk.SetActive(false);

            // 목록
            _list = new GameObject("StoryList", typeof(RectTransform));
            _list.transform.SetParent(t, false);
            var lr = (RectTransform)_list.transform;
            lr.anchorMin = lr.anchorMax = lr.pivot = mid;
            lr.sizeDelta = new Vector2(900f, 560f);
            _list.AddComponent<Image>().color = new Color(0.04f, 0.03f, 0.02f, 0.94f);
            var title = EncounterUiKit.NewText(_list.transform, GoLocalization.T("story.list_title", "이야기 임무"), mid, new Vector2(0f, 240f), new Vector2(860f, 44f), 26);
            title.rectTransform.pivot = mid;
            title.fontStyle = FontStyles.Bold;
            _listText = EncounterUiKit.NewText(_list.transform, "", mid, new Vector2(0f, 10f), new Vector2(820f, 400f), 19);
            _listText.rectTransform.pivot = mid;
            _listText.alignment = TextAlignmentOptions.TopLeft;
            ListClose = EncounterUiKit.NewButton(_list.transform, GoLocalization.T("story.list_close", "닫는다 (O)"), mid, new Vector2(0f, -235f), new Vector2(240f, 52f), () => ToggleList(false));
            ((RectTransform)ListClose.transform).pivot = mid;
            _list.SetActive(false);

            Refresh();
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (TalkOpen)
                {
                    if (kb.fKey.wasPressedThisFrame) Next(IsPickLine ? 0 : -1);
                }
                else if (kb.fKey.wasPressedThisFrame && TalkShown) StartTalk();
                else if (kb.oKey.wasPressedThisFrame) ToggleList();
                else if (kb.escapeKey.wasPressedThisFrame && ListOpen) ToggleList(false);
            }
            Refresh();
        }

        // ---- 대화 ---------------------------------------------------------------------------------------------

        private static bool Busy => DuelGate.Active || Saga.Go.Cinematics.GoCutscenes.Playing ||
                                    (DomainField.Instance != null && DomainField.Instance.Current != null);

        /// <summary>곁에 선 talk 단계 인물 — 없으면 null.</summary>
        public static GoStory.Step NearTalk(Vector3 p)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Talk) return null;
            return GoStory.Flat(p, GoStory.NpcPos(st.Npc)) <= GoStory.TalkR ? st : null;
        }

        private bool IsPickLine => _talkStep != null && _talkLine < _talkStep.Lines.Length && _talkStep.Lines[_talkLine].IsPick;

        /// <summary>곁이면 대화를 연다.</summary>
        public bool StartTalk()
        {
            var fc = FieldCombat.Instance;
            var st = fc != null ? NearTalk(fc.transform.position) : null;
            if (st == null || TalkOpen || Busy) return false;
            _talkStep = st;
            _talkLine = 0;
            StoryState.Talking = true;
            ToggleList(false);
            _talk.SetActive(true);
            PaintTalk();
            return true;
        }

        /// <summary>다음 줄 — 고르는 줄이면 pick(0·1)이 있어야 넘긴다. 마지막 줄 뒤면 단계를 끝낸다.</summary>
        public bool Next(int pick)
        {
            if (!TalkOpen || _talkStep == null) return false;
            if (IsPickLine && pick < 0) return false;
            _talkLine++;
            if (_talkLine >= _talkStep.Lines.Length)
            {
                CloseTalk();
                StoryState.Advance();
                return true;
            }
            PaintTalk();
            return true;
        }

        private void CloseTalk()
        {
            _talk.SetActive(false);
            _talkStep = null;
            StoryState.Talking = false;
        }

        private void PaintTalk()
        {
            var line = _talkStep.Lines[_talkLine];
            bool pick = line.IsPick;
            _who.text = pick ? GoLocalization.T("story.me", "나") : GoStory.NpcShort(line.Who);
            _line.text = pick ? "……" : GoStory.LineText(line);
            _count.text = $"{_talkLine + 1}/{_talkStep.Lines.Length}";
            _next.gameObject.SetActive(!pick);
            _next.GetComponentInChildren<TextMeshProUGUI>().text = _talkLine + 1 < _talkStep.Lines.Length
                ? GoLocalization.T("story.next", "다음 ▶ (F)") : GoLocalization.T("story.end", "끝 (F)");
            for (int i = 0; i < 2; i++)
            {
                _picks[i].gameObject.SetActive(pick);
                if (pick) _picks[i].GetComponentInChildren<TextMeshProUGUI>().text = GoStory.PickText(line, i) + (i == 0 ? " (F)" : "");
            }
        }

        // ---- 추적 줄·목록 -------------------------------------------------------------------------------------

        public void ToggleList() => ToggleList(!ListOpen);

        public void ToggleList(bool open)
        {
            if (_list == null) return;
            if (open && (StoryState.OffForTest || TalkOpen)) return;
            _list.SetActive(open);
            if (open) _listText.text = ListBody();
        }

        public static string ListBody()
        {
            var sb = new System.Text.StringBuilder();
            for (int c = 0; c < GoStory.Chapters.Length; c++)
            {
                var ch = GoStory.Chapters[c];
                string state = c < StoryState.Ch ? GoLocalization.T("story.state_done", "끝")
                    : c == StoryState.Ch && PlayerStats.Level >= ch.Ar ? GoLocalization.T("story.state_now", "진행 중")
                    : string.Format(GoLocalization.T("story.state_locked", "여정 등급 {0} 에 열린다"), ch.Ar);
                sb.Append("<b>").Append(GoStory.ChapterName(ch)).Append("</b>  <size=80%>").Append(state).Append("</size>\n");
                if (c == StoryState.Ch && PlayerStats.Level >= ch.Ar)
                {
                    for (int i = 0; i < ch.Steps.Length; i++)
                    {
                        string mark = i < StoryState.StepIndex ? "✓" : i == StoryState.StepIndex ? "◆" : "◇";
                        string color = i < StoryState.StepIndex ? "#9a9a9a" : i == StoryState.StepIndex ? "#ffd970" : "#e8e2d4";
                        sb.Append("<size=85%><color=").Append(color).Append(">   ").Append(mark).Append(' ').Append(GoStory.StepText(ch.Steps[i])).Append("</color></size>\n");
                    }
                    sb.Append("<size=80%><color=#c9b27a>   ").Append(string.Format(GoLocalization.T("story.reward", "장 끝 보상 {0}"), GoStory.RewardText(ch))).Append("</color></size>\n");
                }
            }
            return sb.ToString();
        }

        /// <summary>추적 줄 글 — 순수(진행·자리만 본다). 이야기가 다 끝났거나 꺼졌으면 빈 글.</summary>
        public static string TrackLine(Vector3 p)
        {
            if (StoryState.OffForTest || StoryState.Done) return "";
            var ch = StoryState.Chapter;
            if (StoryState.Locked)
                return string.Format(GoLocalization.T("story.track_locked", "◆ {0} — 여정 등급 {1} 에 열린다"), GoStory.ChapterName(ch), ch.Ar);
            var st = StoryState.Current;
            StoryField.Target(out Vector3 t, out _);
            return string.Format(GoLocalization.T("story.track", "◆ {0} — {1} · {2}m"), GoStory.ChapterName(ch), GoStory.StepText(st), Mathf.RoundToInt(GoStory.Flat(p, t)));
        }

        /// <summary>추적 줄·대화 단추를 지금 상태로 — 진단도 부른다.</summary>
        public void Refresh()
        {
            if (TrackButton == null) return;
            var fc = FieldCombat.Instance;
            Vector3 p = fc != null ? fc.transform.position : Vector3.zero;
            string track = TrackLine(p);
            if (track != _lastTrack)
            {
                _lastTrack = track;
                _trackText.text = track;
            }
            TrackButton.gameObject.SetActive(track.Length > 0 && !Busy);
            var near = !TalkOpen && !Busy && fc != null ? NearTalk(p) : null;
            TalkButton.gameObject.SetActive(near != null);
            if (near != null)
                TalkButton.GetComponentInChildren<TextMeshProUGUI>().text = string.Format(GoLocalization.T("story.talk_btn", "{0}와 이야기 (F)"), GoStory.NpcShort(near.Npc));
            if (TalkOpen && StoryState.Current == null) CloseTalk();
        }

        /// <summary>진단용 — 창을 모두 닫는다.</summary>
        public void ResetForTest()
        {
            if (TalkOpen) CloseTalk();
            ToggleList(false);
            _lastTrack = null;
            Refresh();
        }
    }
}
