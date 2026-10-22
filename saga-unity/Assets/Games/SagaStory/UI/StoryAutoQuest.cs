using UnityEngine;
using Saga.Core;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;

namespace Saga.Story.UI
{
    /// <summary>
    /// tasks U-0165 4종횡 자동 퀘스트 어댑터(웹 `saga-story/js/auto-quest-st.js` W-0338 · 고돗 G-0299 `auto_quest_st.gd` 짝) — 옆보기라 좌우 축 + 평타.
    /// 목표 = 이야기 걸음(<see cref="StoryScenario.CurrentStep"/>): talk 는 들판에 서면 장면이 저절로 떠 줄 넘김(고르기 첫 답) · mission q_field·kills = 가까운 잡졸 ·
    /// mission q_boss1·boss = 두목(없으면 잡졸 — 두목은 잡졸을 치우면 선다) · gate = 관문 대장(떴을 때) · job·rift 는 사람 몫(전직관·비경 문) → 멈춤 "직접".
    /// 이야기가 없거나 다 봤으면 사명(첫 사냥 10 → 두목의 목). 들판에 땅 사이 문이 없어(한 들판) 걷기는 적 쪽 x 로만.
    /// 멈춤 = 이동 키·조이스틱 · 체력 30% 밑 · 쓰러짐 · 막힘 넷째(셋째까진 반대로 걷고 뛴다). `GameBootstrap.Start` 가 붙인다(씬 재빌드 없음).
    /// </summary>
    public class StoryAutoQuest : AutoQuestHud
    {
        /// <summary>평타 사거리 2.2(StoryPlayerController.AttackRange) 안쪽에서 선다 · 돌아서기용 아주 작은 축.</summary>
        public const float HitR = 1.8f, TurnAxis = 0.08f, StallSec = 0.5f, StallM = 0.05f;

        public static StoryAutoQuest Instance { get; private set; }
        private StoryPlayerController _pc;
        private float _sideDir, _sideT, _lastX, _stallT;

        public static StoryAutoQuest Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryAutoQuest").AddComponent<StoryAutoQuest>();
        }

        protected override void Awake()
        {
            base.Awake();
            Instance = this;
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private StoryPlayerController Pc => _pc != null ? _pc : (_pc = FindFirstObjectByType<StoryPlayerController>());

        // 왼쪽 위 사명 글(StoryHudUI Label, 오른쪽 끝 ≈ −305)이 −310 칸을 덮어 — 목표판(−270~270, 밑 −100) 왼쪽 밑 모서리
        protected override Vector2 PlayAt => new Vector2(-266f, -104f);
        protected override Vector2 DoingAt => new Vector2(-266f, -172f);

        protected override void Toast(string text, float sec) => FindFirstObjectByType<DialogueLabel>()?.Show(text, sec);

        protected override bool CanOffer() => !Popup();

        private static bool Popup()
        {
            var sc = StoryScenarioUi.Instance;
            return (sc != null && sc.IsOpen) || (StoryPickUi.Instance != null && StoryPickUi.Instance.IsShowing)
                || (StoryChoiceUi.Instance != null && StoryChoiceUi.Instance.IsShowing);
        }

        // ---- 어댑터 ----

        /// <summary>걸음 종류 → 틀 종류("talk"·"kill"·"boss"·"gate"·"manual").</summary>
        public static string KindOf(StoryScenarioData.Step s)
        {
            if (s == null) return null;
            switch (s.T)
            {
                case "talk": return "talk";
                case "mission": return s.Key == "q_boss1" ? "boss" : "kill";
                case "kills": return "kill";
                case "boss": return "boss";
                case "gate": return "gate";
                default: return "manual"; // job·rift
            }
        }

        public override AutoQuest.Goal First()
        {
            var sc = StoryScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
                return new AutoQuest.Goal { Id = "scene:" + sc.SceneId, Type = "talk", Label = "📖 " + StoryLocalization.T("aq.scene", "장면") };
            var step = StoryScenario.CurrentStep();
            if (step != null)
            {
                string kind = KindOf(step);
                return new AutoQuest.Goal
                {
                    Id = $"{StoryScenario.ChapterId}.{StoryScenario.StepIndex}",
                    Type = kind,
                    Label = StoryScenario.HudLine(),
                    At = TargetOf(kind)?.transform.position,
                    Radius = HitR,
                };
            }
            if (!StoryQuestState.QuestDone)
                return new AutoQuest.Goal { Id = "q_field", Type = "kill", Label = "🗡️ " + StoryLocalization.T("aq.q_field", "첫 사냥"), At = TargetOf("kill")?.transform.position, Radius = HitR };
            if (!StoryQuestState.QuestBossDone)
                return new AutoQuest.Goal { Id = "q_boss1", Type = "boss", Label = "👺 " + StoryLocalization.T("aq.q_boss", "두목의 목"), At = TargetOf("boss")?.transform.position, Radius = HitR };
            return null;
        }

        /// <summary>종류에 맞는 적 — kill = 가장 가까운 산 잡졸(두목·대장 빼고 없으면 아무나) · boss = 산 두목(없으면 잡졸) · gate = 관문 대장.</summary>
        public StoryEnemy TargetOf(string kind)
        {
            var pc = Pc;
            if (pc == null || kind == null) return null;
            float x = pc.transform.position.x;
            if (kind == "gate") return StoryEnemy.ActiveChampion != null && !StoryEnemy.ActiveChampion.IsDead ? StoryEnemy.ActiveChampion : null;
            if (kind != "kill" && kind != "boss") return null;
            StoryEnemy best = null, boss = null;
            float bd = float.MaxValue, bb = float.MaxValue;
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.IsDead || !e.isActiveAndEnabled) continue;
                float d = Mathf.Abs(e.transform.position.x - x);
                if (e.IsBoss || e.IsChampion) { if (e.IsBoss && d < bb) { bb = d; boss = e; } continue; }
                if (d < bd) { bd = d; best = e; }
            }
            return kind == "boss" && boss != null ? boss : best ?? (kind == "kill" ? boss : null);
        }

        public override Vector3? Pos() => Pc != null ? Pc.transform.position : (Vector3?)null;

        public override bool Busy() => StoryCutscenes.Playing || Popup() || (Pc != null && Pc.OnRope);

        public override string Pause()
        {
            if (StoryPlayerHp.Hp <= 0f) return DownWhy;
            if (StoryPlayerVitals.HpFrac() < LowHpFrac) return LowHpWhy;
            var step = StoryScenario.CurrentStep();
            if (step != null && KindOf(step) == "manual" && !Popup())
                return StoryLocalization.T("aq.manual", "직접 — ") + StoryScenario.HudLine();
            return null;
        }

        public override void Begin(AutoQuest.Goal g)
        {
            _sideT = 0f;
            base.Begin(g);
        }

        public override void End(string why)
        {
            Pc?.ClearTestInput();
            base.End(why);
        }

        public override void Unstick(int n, AutoQuest.Goal g)
        {
            var pc = Pc;
            if (pc == null) return;
            float to = g.At.HasValue ? Mathf.Sign(g.At.Value.x - pc.transform.position.x) : 1f;
            _sideDir = n % 2 == 1 ? -to : to; // 홀수 번째는 물러섰다가, 짝수 번째는 뛰어넘으며 다시
            _sideT = SideSec + n;
            pc.TriggerJump();
        }

        public override string Run(AutoQuest.Goal g, float dt)
        {
            var pc = Pc;
            if (pc == null) return "";
            if (StoryCutscenes.Playing) { pc.ClearTestInput(); return StoryLocalization.T("aq.scene", "장면"); }
            var sc = StoryScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
            {
                pc.ClearTestInput();
                if (TalkPulse(dt))
                {
                    if (sc.Choosing && sc.ChoiceCount > 0) sc.ChoiceButton(0).onClick.Invoke();
                    else sc.Next();
                }
                return StoryLocalization.T("aq.talk", "대화");
            }
            if (Popup()) { pc.ClearTestInput(); return StoryLocalization.T("aq.pick", "고르기 기다림"); }
            if (_sideT > 0f) { _sideT -= dt; pc.SetTestAxis(_sideDir); return StoryLocalization.T("aq.side", "비켜 감"); }
            if (g.Type == "talk") { pc.ClearTestInput(); return StoryLocalization.T("aq.wait_talk", "이야기 기다림"); }
            var foe = TargetOf(g.Type);
            if (foe == null) { pc.ClearTestInput(); return StoryLocalization.T("aq.wait_foe", "적 기다림"); }
            float dx = foe.transform.position.x - pc.transform.position.x;
            float dir = Mathf.Sign(dx);
            if (Mathf.Abs(dx) > HitR)
            {
                pc.SetTestAxis(dir);
                // 턱·발판 끝 — 걷는데 0.5초 제자리면 뛴다(막힘 30초 전에)
                float x = pc.transform.position.x;
                if (Mathf.Abs(x - _lastX) > StallM) { _lastX = x; _stallT = 0f; }
                else if ((_stallT += dt) >= StallSec) { _stallT = 0f; pc.TriggerJump(); }
                return $"{StoryLocalization.T("aq.walk", "걷는 중")} {Mathf.RoundToInt(Mathf.Abs(dx))}m";
            }
            pc.SetTestAxis(dir * TurnAxis); // 등 뒤는 안 맞는다 — 적 쪽으로 돌아서며 친다
            pc.TriggerAttack();
            return StoryLocalization.T("aq.fight", "싸움");
        }
    }
}
