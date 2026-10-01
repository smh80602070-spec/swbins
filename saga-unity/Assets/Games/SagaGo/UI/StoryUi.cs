using TMPro;
using UnityEngine;
using Saga.Core;
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
            lr.sizeDelta = new Vector2(900f, 640f); // 109-14-21 세계 임무 칸·따라가기 단추로 높임
            _list.AddComponent<Image>().color = new Color(0.04f, 0.03f, 0.02f, 0.94f);
            var title = EncounterUiKit.NewText(_list.transform, GoLocalization.T("story.list_title", "이야기 임무"), mid, new Vector2(0f, 285f), new Vector2(860f, 44f), 26);
            title.rectTransform.pivot = mid;
            title.fontStyle = FontStyles.Bold;
            _listText = EncounterUiKit.NewText(_list.transform, "", mid, new Vector2(0f, 60f), new Vector2(820f, 420f), 17);
            _listText.rectTransform.pivot = mid;
            _listText.alignment = TextAlignmentOptions.TopLeft;
            // 109-14-21 따라가기 단추 — 이야기 · 세계 임무 셋
            for (int i = 0; i < _trackButtons.Length; i++)
            {
                int k = i;
                var b = EncounterUiKit.NewButton(_list.transform, "", mid, new Vector2(-315f + i * 210f, -196f), new Vector2(200f, 50f), () => TrackPress(k));
                ((RectTransform)b.transform).pivot = mid;
                var bt = b.GetComponentInChildren<TextMeshProUGUI>();
                bt.fontSize = 15;
                bt.lineSpacing = -10f;
                _trackButtons[i] = b;
            }
            ListClose = EncounterUiKit.NewButton(_list.transform, GoLocalization.T("story.list_close", "닫는다 (O)"), mid, new Vector2(0f, -268f), new Vector2(240f, 52f), () => ToggleList(false));
            ((RectTransform)ListClose.transform).pivot = mid;
            _list.SetActive(false);

            Refresh();
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null || SagaPad.Connected) // tasks U-0018 — 패드 Y 다음·대화, Start 목록, B 닫기
            {
                if (TalkOpen)
                {
                    if (SagaPad.Pressed(SagaPad.Btn.Interact, kb?.fKey)) Next(IsPickLine && !Revealing && _mine == null ? 0 : -1);
                }
                else if (SagaPad.Pressed(SagaPad.Btn.Interact, kb?.fKey) && TalkShown && !Saga.Go.World.FishingField.Busy) StartTalk(); // 109-14-24 낚시 중 F 는 낚싯대(웹 story F 양보)
                else if (SagaPad.Pressed(SagaPad.Btn.Menu, kb?.oKey)) ToggleList();
                else if (SagaPad.Pressed(SagaPad.Btn.Cancel, kb?.escapeKey) && ListOpen) ToggleList(false);
            }
            if (TalkOpen && Revealing)
            {
                _shown += Time.deltaTime * RevealCps;
                _line.maxVisibleCharacters = Mathf.Min(_line.text.Length, Mathf.FloorToInt(_shown));
            }
            Refresh();
        }

        // ---- 대화 ---------------------------------------------------------------------------------------------

        /// <summary>109-14-13 글이 흘러나오는 빠르기(초당 글자, 0 이면 한 번에 — 진단이 끈다).</summary>
        public static float RevealCps = GoStory.RevealCps;
        private float _shown;
        private string _mine;

        /// <summary>줄이 아직 흘러나오는 중인가.</summary>
        public bool Revealing => TalkOpen && _line.maxVisibleCharacters < _line.text.Length;

        private static bool Busy => DuelGate.Active || Saga.Go.Cinematics.GoCutscenes.Playing ||
                                    (DomainField.Instance != null && DomainField.Instance.Current != null);

        /// <summary>109-14-21 말 걸 수 있는 것 하나 — 그 단계 · 줄(−1 이야기, 0~ 세계 임무) · 맡기(푸른 !) · 거리.</summary>
        public struct Talkable
        {
            public GoStory.Step Step;
            public int Line;
            public bool Take;
            public float Dist;
        }

        /// <summary>곁(5m)에서 말 걸 수 있는 가장 가까운 것 — 이야기의 지금 대화 · 맡을 임무의 맡길 사람 · 맡은 임무의 다음 대화 상대(따라가지 않아도).
        /// 같은 거리면 따라가는 줄(웹 ⑲-21 talkables). 말을 걸면 그 줄을 따라간다.</summary>
        public static bool NearestTalk(Vector3 p, out Talkable best)
        {
            best = default;
            if (StoryState.OffForTest) return false;
            bool any = false;
            var b = best;
            void Consider(GoStory.Step st, int line, bool take)
            {
                if (st == null || (st.Type != GoStory.StepType.Talk && st.Type != GoStory.StepType.Sail) || !GoStory.Shown(st.Npc, StoryState.Ch, StoryState.StepIndex)) return;
                float d = GoStory.Flat(p, GoStory.NpcPos(st.Npc));
                if (d > GoStory.TalkR) return;
                bool tracked = line == (StoryState.TrackingQuest ? StoryState.Track : -1);
                if (!any || d < b.Dist - 0.01f || (Mathf.Abs(d - b.Dist) <= 0.01f && tracked)) { b = new Talkable { Step = st, Line = line, Take = take, Dist = d }; any = true; }
            }
            Consider(StoryState.StoryCurrent, -1, false);
            for (int q = 0; q < GoWorldQuests.Quests.Length; q++)
            {
                if (WorldQuestState.Available(q)) Consider(GoWorldQuests.Quests[q].Steps[0], q, true);
                else if (WorldQuestState.Taken(q)) Consider(WorldQuestState.Current(q), q, false);
            }
            best = b;
            return any;
        }

        /// <summary>곁에 선 대화 단계 — 없으면 null.</summary>
        public static GoStory.Step NearTalk(Vector3 p) => NearestTalk(p, out var t) ? t.Step : null;

        private bool IsPickLine => _talkStep != null && _talkLine < _talkStep.Lines.Length && _talkStep.Lines[_talkLine].IsPick;

        /// <summary>곁이면 대화를 연다.</summary>
        public bool StartTalk()
        {
            var fc = FieldCombat.Instance;
            if (fc == null || TalkOpen || Busy || !NearestTalk(fc.transform.position, out var near)) return false;
            // 109-14-21 — 맡을 임무면 맡고, 그 줄을 따라간다(바꾸면 그 단계 처음부터)
            if (near.Take && !WorldQuestState.Take(near.Line)) return false;
            StoryState.SetTrack(near.Line);
            var st = near.Step;
            _talkStep = st;
            _talkLine = 0;
            _mine = null;
            StoryState.Talking = true;
            ToggleList(false);
            _talk.SetActive(true);
            // 카메라는 말하는 이를 내 어깨 너머로, 인물은 나를 본다
            Vector3 npc = GoStory.NpcPos(st.Npc);
            StoryField.Instance?.Face(st.Npc, fc.transform.position);
            Rig?.BeginTalkShot(npc + Vector3.up * 1.4f);
            PaintTalk();
            return true;
        }

        private static Saga.Go.Player.CameraRig _rig;
        private static Saga.Go.Player.CameraRig Rig => _rig != null ? _rig : (_rig = Object.FindFirstObjectByType<Saga.Go.Player.CameraRig>());

        /// <summary>다음 — 글이 흘러나오는 중이면 줄 전체를 보이고 멈춘다. 고르는 줄은 pick(0·1)이 있어야 넘기고, 고른 대답이 "나"의 줄로 한 번 나온다.
        /// 마지막 줄 뒤면 단계를 끝낸다.</summary>
        public bool Next(int pick)
        {
            if (!TalkOpen || _talkStep == null) return false;
            if (Revealing) { _line.maxVisibleCharacters = _line.text.Length; return true; }
            if (_mine == null && IsPickLine)
            {
                if (pick < 0) return false;
                _mine = GoStory.PickText(_talkStep.Lines[_talkLine], Mathf.Clamp(pick, 0, 1));
                PaintTalk();
                return true;
            }
            _mine = null;
            _talkLine++;
            if (_talkLine >= _talkStep.Lines.Length)
            {
                var done = _talkStep;
                CloseTalk();
                if (done.Type == GoStory.StepType.Sail) StoryField.Sail(done); // 109-14-19 배로 그 자리에
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
            _mine = null;
            StoryState.Talking = false;
            Rig?.EndTalkShot();
        }

        private void PaintTalk()
        {
            var line = _talkStep.Lines[_talkLine];
            bool pick = line.IsPick && _mine == null;
            _who.text = line.IsPick ? GoLocalization.T("story.me", "나") : GoStory.NpcShort(line.Who);
            _line.text = pick ? "……" : _mine ?? GoStory.LineText(line);
            _shown = 0f;
            _line.maxVisibleCharacters = pick || RevealCps <= 0f ? _line.text.Length : 0;
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
            if (open) RefreshList();
        }

        // ---- 109-14-21 따라가기 단추(0 = 이야기, 1~ = 세계 임무) ----
        private readonly Button[] _trackButtons = new Button[4];
        public Button TrackQuestButton(int i) => _trackButtons[i];

        private void TrackPress(int i)
        {
            if (StoryState.SetTrack(i - 1)) RefreshList();
        }

        private void RefreshList()
        {
            _listText.text = ListBody();
            for (int i = 0; i < _trackButtons.Length; i++)
            {
                var b = _trackButtons[i];
                if (b == null) continue;
                bool quest = i > 0 && i - 1 < GoWorldQuests.Quests.Length;
                b.gameObject.SetActive(i == 0 || quest);
                if (i > 0 && !quest) continue;
                b.GetComponentInChildren<TextMeshProUGUI>().text = i == 0 ? GoLocalization.T("wq.track_story", "이야기 임무 따라가기")
                    : string.Format(GoLocalization.T("wq.track_btn", "{0} 따라가기"), GoWorldQuests.Name(GoWorldQuests.Quests[i - 1]));
                b.interactable = i == 0 ? StoryState.TrackingQuest && StoryState.StoryCurrent != null
                    : WorldQuestState.Taken(i - 1) && !(StoryState.TrackingQuest && StoryState.Track == i - 1);
            }
        }

        public static string ListBody()
        {
            var sb = new System.Text.StringBuilder();
            // 109-14-21 — 끝난 장은 한 줄로, 지금 장과 다음 장만(아래에 세계 임무)
            int doneN = Mathf.Min(StoryState.Ch, GoStory.Chapters.Length);
            if (doneN > 0) sb.Append("<size=80%><color=#9a9a9a>").Append(string.Format(GoLocalization.T("story.chapters_done", "✓ 끝난 장 {0}"), doneN)).Append("</color></size>\n");
            for (int c = StoryState.Ch; c < GoStory.Chapters.Length && c <= StoryState.Ch + 1; c++)
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
            // 109-14-21 세계 임무 — 끝 · 따라가는 중 · 맡음(지금 단계) · ❗ 누구에게 · 잠김
            sb.Append("\n<b>").Append(GoLocalization.T("wq.list_title", "세계 임무")).Append("</b>\n");
            for (int q = 0; q < GoWorldQuests.Quests.Length; q++)
            {
                var w = GoWorldQuests.Quests[q];
                string state = WorldQuestState.Done(q) ? GoLocalization.T("wq.state_done", "끝")
                    : WorldQuestState.Taken(q) ? (StoryState.TrackingQuest && StoryState.Track == q ? GoLocalization.T("wq.state_track", "따라가는 중") : GoLocalization.T("wq.state_taken", "맡음"))
                        + " · " + GoStory.StepText(WorldQuestState.Current(q))
                    : WorldQuestState.Available(q) ? string.Format(GoLocalization.T("wq.state_giver", "❗ {0}에게"), GoStory.NpcName(w.Giver))
                    : string.Format(GoLocalization.T("wq.state_locked", "여정 등급 {0} 에 열린다"), w.Ar);
                string color = WorldQuestState.Done(q) ? "#9a9a9a" : WorldQuestState.Taken(q) ? "#8fd0ff" : "#e8e2d4";
                sb.Append("<size=85%><color=").Append(color).Append(">🔷 ").Append(GoWorldQuests.Name(w)).Append(" <size=80%>(").Append(GoWorldQuests.Place(w)).Append(")</size>  ")
                    .Append(state).Append("</color></size>\n");
            }
            return sb.ToString();
        }

        /// <summary>추적 줄 글 — 순수(진행·자리만 본다). 이야기가 다 끝났거나 꺼졌으면 빈 글.</summary>
        public static string TrackLine(Vector3 p)
        {
            if (StoryState.OffForTest || (StoryState.Done && !StoryState.TrackingQuest)) return "";
            var ch = StoryState.Chapter;
            if (!StoryState.TrackingQuest && StoryState.Locked)
                return string.Format(GoLocalization.T("story.track_locked", "◆ {0} — 여정 등급 {1} 에 열린다"), GoStory.ChapterName(ch), ch.Ar);
            var st = StoryState.Current;
            StoryField.Target(out Vector3 t, out _);
            string text = GoStory.StepText(st);
            if (st.Type == GoStory.StepType.Gather) text += $" {StoryState.Progress}/{st.Count}";
            if (st.Type == GoStory.StepType.Party) // 109-14-55 시대마다 ✔/✗
                foreach (var e in new[] { GoEra.Past, GoEra.Modern, GoEra.Future }) text += $" {GoEras.EraName(e)}{(GoStory.PartyHasEra(e) ? " ✔" : " ✗")}";
            if (st.Type == GoStory.StepType.Chase) // 109-14-19 · 109-14-21 둥실이
                text = StoryField.Instance != null && StoryField.Instance.ChaseRunning
                    ? string.Format(GoLocalization.T("story.chase_track2", "{0} {1}m — 달려라!"), GoStory.NpcShort(st.Npc), Mathf.RoundToInt(GoStory.Flat(p, StoryField.Instance.ChasePos)))
                    : text + GoLocalization.T("story.chase_idle", " (가까이 가면 달아난다)");
            float dist = GoStory.Flat(p, t);
            string line = StoryState.TrackingQuest // 109-14-21 🔷 세계 임무
                ? string.Format(GoLocalization.T("wq.track", "🔷 {0} — {1} · {2}m"), GoWorldQuests.Name(GoWorldQuests.Quests[StoryState.Track]), text, Mathf.RoundToInt(dist))
                : string.Format(GoLocalization.T("story.track", "◆ {0} — {1} · {2}m"), GoStory.ChapterName(ch), text, Mathf.RoundToInt(dist));
            if (st.Type == GoStory.StepType.Follow && dist > GoStory.FollowLost) line += GoLocalization.T("story.follow_lost", " · 너무 멀어졌다");
            var sf = StoryField.Instance;
            if (st.Type == GoStory.StepType.Defend && sf != null && sf.DefendHpMax > 0f && (sf.DefendWave >= 0 || sf.DefendRest > 0f)) // 109-14-16
                line += string.Format(GoLocalization.T("story.defend_line", " · {0} {1}% · 물결 {2}/{3}"), GoLocalization.T(st.NameKey, st.NameKo),
                    Mathf.CeilToInt(sf.DefendHp / sf.DefendHpMax * 100f), Mathf.Max(0, sf.DefendWave + 1), (st.Waves ?? GoStory.DefendWaves).Length);
            return line;
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
            {
                string era = GoStory.NpcEra(near.Npc); // 109-14-21 세계 임무 인물은 시대 글자
                TalkButton.GetComponentInChildren<TextMeshProUGUI>().text = string.Format(GoLocalization.T("story.talk_btn", "{0}와 이야기 (F)"),
                    GoStory.NpcShort(near.Npc) + (era != null ? $" <size=70%>({era})</size>" : ""));
            }
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
