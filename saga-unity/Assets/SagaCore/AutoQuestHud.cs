using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0164 자동 퀘스트 판 어댑터의 공용 몸(고돗 `saga_core/ui/auto_quest_hud.gd` 짝) — ▶ 단추(켜지면 ■)·진행 글·손 조작 감시·대화 넘기기 박자.
    /// 판은 이걸 잇고 <see cref="AutoQuest.IAutoQuestAdapter"/> 다섯(First·Run·Pos·Busy·Pause)과 토스트만 채운다. 자리는 다섯 판 같다 —
    /// 목표판(위 가운데 540×90) 왼쪽 −310(1만리 U-0163 `GoAutoQuest` 와 같은 칸, 오른쪽은 일시정지 단추).
    /// 손 조작 = 이동 키(WASD·화살표)·조이스틱 — 카메라 끌기·단추는 안 센다. 1만리는 U-0163 그대로 따로 둔다.
    /// </summary>
    public abstract class AutoQuestHud : MonoBehaviour, AutoQuest.IAutoQuestAdapter
    {
        public const float LowHpFrac = 0.3f, TalkTick = 0.35f, SideSec = 2f;
        public static readonly Vector2 PlayPos = new Vector2(-310f, -14f), DoingPos = new Vector2(-380f, -80f);

        /// <summary>진단 — 손 조작 감시를 끈다(진단이 SetTestInput 을 쓰므로).</summary>
        public static bool WatchOffForTest;
        /// <summary>진단 — 손 조작 한 번을 흉내 낸다.</summary>
        public bool FakeHandInputForTest;

        public AutoQuest Q { get; private set; }
        public Button PlayButton { get; private set; }
        private TextMeshProUGUI _label, _doing;
        private VirtualJoystick _joy;
        private float _paint, _talkT;

        public static string HandWhy => SagaUi.L("손 조작", "Manual input");
        public static string LowHpWhy => SagaUi.L("체력 낮음", "Low HP");
        public static string DownWhy => SagaUi.L("쓰러짐", "Down");
        protected static string Title => SagaUi.L("자동 퀘스트", "Auto quest");

        protected virtual void Awake() => Q = new AutoQuest(this);

        protected virtual void Start()
        {
            var canvas = SagaUi.NewHudCanvas("AutoQuestUI", 7, transform);
            PlayButton = SagaUi.NewButton(canvas.transform, "Btn_▶", "▶", new Vector2(0.5f, 1f), PlayAt, new Vector2(64f, 64f), SagaUi.ButtonIdle, 30f);
            PlayButton.onClick.AddListener(() => Q.Toggle());
            _label = PlayButton.GetComponentInChildren<TextMeshProUGUI>();
            _doing = SagaUi.NewText(canvas.transform, "", 15f, new Color(0.85f, 0.95f, 1f), new Vector2(0.5f, 1f), DoingAt, new Vector2(180f, 26f));
            _doing.textWrappingMode = TextWrappingModes.NoWrap;
            _doing.overflowMode = TextOverflowModes.Ellipsis;
        }

        /// <summary>판 HUD 가 왼쪽 칸을 쓰면 판이 옮긴다(2나락 = 오른쪽 — 왼쪽 위 체력 글 700 폭).</summary>
        protected virtual Vector2 PlayAt => PlayPos;
        protected virtual Vector2 DoingAt => DoingPos;

        protected virtual void Update() => Step(Time.deltaTime);

        /// <summary>한 프레임 — 손 조작 감시 · 틀 굴리기 · 단추 칠(진단이 시간을 넣어 부른다).</summary>
        public void Step(float dt)
        {
            if (Q.On && HandInput()) Q.Stop(HandWhy);
            Q.Tick(dt);
            _paint -= Time.unscaledDeltaTime;
            if (_paint > 0f || PlayButton == null) return;
            _paint = 0.25f;
            PlayButton.gameObject.SetActive(Q.On || (CanOffer() && First() != null));
            _label.text = Q.On ? "■" : "▶";
            _doing.text = Q.On ? "▶ " + (Q.Current?.Label ?? "") + (Q.Doing.Length > 0 ? " · " + Q.Doing : "")
                : Q.Why.Length > 0 && Q.Why != HandWhy ? "⏸ " + Q.Why : "";
        }

        /// <summary>꺼진 채 ▶ 를 내보일 때인가(대화창이 떠 있으면 숨긴다 등).</summary>
        protected virtual bool CanOffer() => true;

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

        /// <summary>대화 줄 넘기기 박자 — true 면 지금 한 줄 넘긴다.</summary>
        protected bool TalkPulse(float dt)
        {
            _talkT -= dt;
            if (_talkT > 0f) return false;
            _talkT = TalkTick;
            return true;
        }

        /// <summary>판 토스트 한 줄(DialogueLabel 등).</summary>
        protected abstract void Toast(string text, float sec);

        public abstract AutoQuest.Goal First();
        public abstract string Run(AutoQuest.Goal g, float dt);
        public abstract Vector3? Pos();
        public abstract bool Busy();
        public abstract string Pause();
        public abstract void Unstick(int n, AutoQuest.Goal g);

        public virtual void Begin(AutoQuest.Goal g)
        {
            _talkT = 0f;
            Toast("▶ " + Title + " — " + g.Label, 2.5f);
        }

        public virtual void End(string why) => Toast("⏸ " + Title + " — " + (why ?? ""), 3f);

        /// <summary>막힘 n 번째 비켜 갈 옆 방향(목표 쪽에 직각, 번갈아 좌우).</summary>
        protected static Vector3 SideOf(Vector3 me, Vector3? at, int n)
        {
            Vector3 to = at.HasValue ? at.Value - me : Vector3.forward;
            to.y = 0f;
            return Vector3.Cross(Vector3.up, to.sqrMagnitude > 0.01f ? to.normalized : Vector3.forward) * (n % 2 == 0 ? -1f : 1f);
        }

        protected static float Flat(Vector3 v) { v.y = 0f; return v.magnitude; }
    }
}
