using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Core;
using Saga.Go.Cinematics;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0163 1만리 자동 퀘스트 어댑터(웹 `saga-go/js/auto-quest-go.js` W-0337 · 고돗 G-0298 짝) — 공용 <see cref="AutoQuest"/> 에 "지금 목표"를 주고 실행한다.
    /// 목표 = 따라가는 줄(이야기·세계 임무)의 지금 단계(`StoryField.Target` 자리). 웹은 있던 자동 순행에 맡기지만 이 트랙엔 그게 없어
    /// 판 공개 함수만으로 굴린다: 걷기 = `PlayerController.SetTestInput`(세계 방향) · 말 = `StoryUi.StartTalk`·`Next`(고르기 줄은 첫 답) · 싸움 = 가까운 적에게 다가가 `FieldCombat.Attack`.
    /// 멈춤 = 이동 키·조이스틱(손 조작) · 모두 쓰러짐 · 앞장 체력 30% 밑 · 막힘 넷째. 막히면 옆으로 2초 비켜 걷고 뛴다. 목표판 오른쪽 ▶(켜지면 ■) 단추.
    /// `MenuHubUi.Start` 가 붙인다(씬 재빌드 없음).
    /// </summary>
    public class GoAutoQuest : MonoBehaviour, AutoQuest.IAutoQuestAdapter
    {
        public const float LowHpFrac = 0.3f, FightR = 12f, HitR = 2.6f, ArriveFrac = 0.6f, SprintFar = 20f, SideSec = 2f, TalkTick = 0.35f;

        public static GoAutoQuest Instance { get; private set; }
        public AutoQuest Q { get; private set; }
        public Button PlayButton { get; private set; }
        private TextMeshProUGUI _label, _doing;
        private PlayerController _pc;
        private VirtualJoystick _joy;
        private float _talkT, _sideT;
        private Vector3 _side;
        private float _paint;

        /// <summary>진단 — 손 조작 감시를 끈다(진단이 SetTestInput 을 쓰므로) · 손 조작 한 번을 흉내 낸다.</summary>
        public static bool WatchOffForTest;
        public bool FakeHandInputForTest;

        private void Awake()
        {
            Instance = this;
            Q = new AutoQuest(this);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            var canvas = EncounterUiKit.NewCanvas("AutoQuestUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);
            // 목표판(위 가운데 540×90) 왼쪽 끝 옆 — 오른쪽은 일시정지 단추(UiLayoutCheck)
            PlayButton = EncounterUiKit.NewButton(canvas.transform, "▶", new Vector2(0.5f, 1f), new Vector2(-310f, -14f), new Vector2(64f, 64f), () => Q.Toggle());
            _label = PlayButton.GetComponentInChildren<TextMeshProUGUI>();
            _label.fontSize = 30;
            _doing = EncounterUiKit.NewText(canvas.transform, "", new Vector2(0.5f, 1f), new Vector2(-380f, -80f), new Vector2(180f, 26f), 15); // ▶ 밑 왼쪽(목표판 −270 과 대사 줄에 안 닿게)
            _doing.textWrappingMode = TextWrappingModes.NoWrap;
            _doing.overflowMode = TextOverflowModes.Ellipsis;
            _doing.raycastTarget = false;
            _doing.color = new Color(0.85f, 0.95f, 1f);
        }

        private PlayerController Pc
        {
            get
            {
                if (_pc == null && FieldCombat.Instance != null) _pc = FieldCombat.Instance.GetComponent<PlayerController>();
                return _pc;
            }
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>한 프레임 — 손 조작 감시 · 틀 굴리기 · 단추 칠(진단이 시간을 넣어 부른다).</summary>
        public void Step(float dt)
        {
            if (Q.On && HandInput()) Q.Stop(GoLocalization.T("aq.hand", "손 조작"));
            Q.Tick(dt);
            _paint -= Time.unscaledDeltaTime;
            if (_paint > 0f || PlayButton == null) return;
            _paint = 0.25f;
            var ui = StoryUi.Instance;
            bool can = Q.On || (First() != null && (ui == null || !ui.TalkOpen));
            PlayButton.gameObject.SetActive(can);
            _label.text = Q.On ? "■" : "▶";
            _doing.text = Q.On ? "▶ " + (Q.Current?.Label ?? "") + (Q.Doing.Length > 0 ? " · " + Q.Doing : "")
                : Q.Why.Length > 0 && Q.Why != GoLocalization.T("aq.hand", "손 조작") ? "⏸ " + Q.Why : "";
        }

        /// <summary>이동 키·조이스틱 = 손 조작(웹 watchInput). 카메라 끌기·단추는 안 센다.</summary>
        private bool HandInput()
        {
            if (FakeHandInputForTest) { FakeHandInputForTest = false; return true; }
            if (WatchOffForTest) return false;
            var kb = Keyboard.current;
            if (kb != null && (kb.wKey.wasPressedThisFrame || kb.aKey.wasPressedThisFrame || kb.sKey.wasPressedThisFrame || kb.dKey.wasPressedThisFrame
                || kb.upArrowKey.wasPressedThisFrame || kb.downArrowKey.wasPressedThisFrame || kb.leftArrowKey.wasPressedThisFrame || kb.rightArrowKey.wasPressedThisFrame)) return true;
            if (_joy == null) _joy = FindFirstObjectByType<VirtualJoystick>();
            return _joy != null && _joy.Value.sqrMagnitude > 0.04f;
        }

        // ---- 어댑터 ----

        public static string TypeOf(GoStory.StepType t) => t switch
        {
            GoStory.StepType.Talk or GoStory.StepType.Party => "talk",
            GoStory.StepType.Kill or GoStory.StepType.Boss or GoStory.StepType.Duel or GoStory.StepType.Defend => "kill",
            GoStory.StepType.Gather or GoStory.StepType.Cook => "collect",
            GoStory.StepType.Domain => "enter",
            _ => "go",
        };

        public AutoQuest.Goal First()
        {
            var st = StoryState.Current;
            if (st == null || !StoryField.Target(out var pos, out var r)) return null;
            return new AutoQuest.Goal
            {
                Id = StoryState.LineKey,
                Type = TypeOf(st.Type),
                Label = (StoryState.TrackingQuest ? "🔷 " : "📖 ") + GoStory.StepText(st),
                At = pos,
                Radius = Mathf.Max(1.5f, r),
            };
        }

        public Vector3? Pos() => FieldCombat.Instance != null ? FieldCombat.Instance.transform.position : (Vector3?)null;

        public bool Busy()
        {
            var fc = FieldCombat.Instance;
            var ui = StoryUi.Instance;
            return GoCutscenes.Playing || DuelGate.Active || FishingField.Busy || (ui != null && ui.TalkOpen) || (fc != null && fc.InCombat());
        }

        public string Pause()
        {
            var fc = FieldCombat.Instance;
            if (fc == null || fc.Party.Count == 0) return null;
            bool all = true;
            foreach (var m in fc.Party) if (!m.Down) { all = false; break; }
            if (all) return GoLocalization.T("aq.down", "모두 쓰러짐");
            var a = fc.Active;
            if (a != null && a.MaxHp > 0f && a.Hp / a.MaxHp < LowHpFrac) return GoLocalization.T("aq.lowhp", "체력 낮음");
            return null;
        }

        public void Begin(AutoQuest.Goal g)
        {
            _sideT = 0f; _talkT = 0f;
            DialogueLabel.Instance?.Show("▶ " + GoLocalization.T("aq.title", "자동 퀘스트") + " — " + g.Label, 2.5f);
        }

        public void End(string why)
        {
            Pc?.ClearTestInput();
            DialogueLabel.Instance?.Show("⏸ " + GoLocalization.T("aq.title", "자동 퀘스트") + " — " + (why ?? ""), 3f);
        }

        public void Unstick(int n, AutoQuest.Goal g)
        {
            var p = Pos();
            if (p == null || g.At == null) return;
            Vector3 to = g.At.Value - p.Value; to.y = 0f;
            _side = Vector3.Cross(Vector3.up, to.sqrMagnitude > 0.01f ? to.normalized : Vector3.forward) * (n % 2 == 0 ? -1f : 1f);
            _sideT = SideSec + n;
            Pc?.RequestJump();
        }

        public string Run(AutoQuest.Goal g, float dt)
        {
            var pc = Pc;
            var fc = FieldCombat.Instance;
            var ui = StoryUi.Instance;
            if (pc == null || fc == null) return "";
            if (GoCutscenes.Playing) { pc.ClearTestInput(); return GoLocalization.T("aq.scene", "장면"); }
            // 대화 — 줄을 넘긴다(고르기 줄은 첫 답)
            if (ui != null && ui.TalkOpen)
            {
                pc.ClearTestInput();
                _talkT -= dt;
                if (_talkT <= 0f) { _talkT = TalkTick; ui.Next(ui.PickLine && !ui.Revealing ? 0 : -1); }
                return GoLocalization.T("aq.talk", "대화");
            }
            Vector3 me = fc.transform.position;
            // 비켜 걷기
            if (_sideT > 0f) { _sideT -= dt; Walk(pc, _side, false); return GoLocalization.T("aq.side", "비켜 감"); }
            // 싸움 — 가까운 적
            var foe = NearestFoe(me);
            if (foe != null)
            {
                Vector3 d = foe.transform.position - me; d.y = 0f;
                if (d.magnitude > HitR) { Walk(pc, d.normalized, false); return GoLocalization.T("aq.fight", "싸움"); }
                pc.ClearTestInput();
                fc.Attack();
                return GoLocalization.T("aq.fight", "싸움");
            }
            if (g.At == null) { pc.ClearTestInput(); return ""; }
            Vector3 to = g.At.Value - me; to.y = 0f;
            float dist = to.magnitude;
            if (g.Type == "talk" && dist <= GoStory.TalkR && ui != null && ui.StartTalk()) { pc.ClearTestInput(); return GoLocalization.T("aq.talk", "대화"); }
            if (dist > g.Radius * ArriveFrac) { Walk(pc, to / Mathf.Max(dist, 0.001f), dist > SprintFar); return $"{GoLocalization.T("aq.walk", "걷는 중")} {Mathf.RoundToInt(dist)}m"; }
            pc.ClearTestInput();
            return GoLocalization.T("aq.wait", "도착");
        }

        private static void Walk(PlayerController pc, Vector3 dir, bool sprint) => pc.SetTestInput(new Vector2(dir.x, dir.z), sprint);

        private static FieldEnemy NearestFoe(Vector3 me)
        {
            FieldEnemy best = null;
            float bd = FightR;
            foreach (var e in FieldEnemy.All)
            {
                if (e == null || !e.Alive || !e.isActiveAndEnabled) continue;
                Vector3 d = e.transform.position - me; d.y = 0f;
                float m = d.magnitude;
                if (m < bd) { bd = m; best = e; }
            }
            return best;
        }
    }
}
