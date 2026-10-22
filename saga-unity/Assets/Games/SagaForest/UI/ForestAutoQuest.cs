using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.Player;
using Saga.Forest.World;

namespace Saga.Forest.UI
{
    /// <summary>
    /// tasks U-0166 3마을 자동 퀘스트 어댑터(웹 `saga-forest/js/auto-quest-fs.js` W-0338 · 고돗 G-0299 `auto_quest_fs.gd` 짝) — 걷기 단계만 대신.
    /// 목표 = 이야기 걸음(<see cref="ForestScenario.CurrentStep"/>): talk = 마을에 서면 장면이 저절로 떠 줄 넘김(고르기 첫 답) · forest = 그 구역 가운데로 ·
    /// go = 그 구역 명소(5m 안 — 명소가 셈) · deliver = 소포 없으면 접수대, 있으면 그 구역 우체통 · place·gather·heart·donate·fest·settle 은 사람 몫 → 멈춤 "직접 —".
    /// 이야기가 없거나 다 봤으면 들고 있는 소포 배달만. 집·굴 안에서는 구역으로 못 걸어 멈춤. 마을엔 싸움·체력이 없어 멈춤은 손 조작·직접·막힘.
    /// `ForestBootstrap.Start` 가 붙인다(씬 재빌드 없음).
    /// </summary>
    public class ForestAutoQuest : AutoQuestHud
    {
        /// <summary>도착 반경 — 우체통 2·접수대 1.2(각 판정 반경보다 안쪽) · 명소 5 · 구역은 안쪽 반경 6.</summary>
        public const float MailR = 1.4f, CounterR = 0.8f, LandmarkR = 3.5f, ZoneR = 4f;

        public static ForestAutoQuest Instance { get; private set; }
        private PlayerController _pc;
        private Vector3 _side;
        private float _sideT;

        public static ForestAutoQuest Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestAutoQuest").AddComponent<ForestAutoQuest>();
        }

        protected override void Awake()
        {
            base.Awake();
            Instance = this;
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private PlayerController Pc => _pc != null ? _pc : (_pc = FindFirstObjectByType<PlayerController>());

        protected override void Toast(string text, float sec) => DialogueLabel.Instance?.Show(text, sec);

        protected override bool CanOffer() => !Popup();

        // ▶ 는 기본 자리(목표판 왼쪽 −310) — 3마을 왼쪽 위 글(PlayerHudUI Label)은 −130 밑부터라 비어 있고, 목표판 밑 −172 는 대사 줄(DialogueUI)과 닿는다

        private static bool Popup()
        {
            var sc = ForestScenarioUi.Instance;
            return (sc != null && sc.IsOpen) || (ForestWorkbench.Instance != null && ForestWorkbench.Instance.IsOpen);
        }

        // ---- 어댑터 ----

        /// <summary>걸음 종류 → 틀 종류("talk"·"go"·"meet"·"deliver"·"manual").</summary>
        public static string KindOf(ForestScenarioData.Step s)
        {
            if (s == null) return null;
            switch (s.T)
            {
                case "talk": return "talk";
                case "forest": return "go";
                case "go": return "meet";
                case "deliver": return "deliver";
                default: return "manual"; // place·gather·heart·donate·fest·settle
            }
        }

        public override AutoQuest.Goal First()
        {
            var sc = ForestScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
                return new AutoQuest.Goal { Id = "scene:" + sc.SceneId, Type = "talk", Label = "📖 " + ForestLocalization.T("aq.scene", "장면") };
            var step = ForestScenario.CurrentStep();
            if (step != null)
            {
                string kind = KindOf(step);
                var g = new AutoQuest.Goal { Id = $"{ForestScenario.ChapterId}.{ForestScenario.StepIndex}", Type = kind, Label = ForestScenario.HudLine() };
                Aim(g, kind, ForestScenario.ZoneOf(step.Key));
                if (kind == "deliver") g.Id += ForestDeliveryState.Carrying ? ".mail" : ".pickup";
                return g;
            }
            if (ForestDeliveryState.Carrying)
            {
                var g = new AutoQuest.Goal { Id = "deliver.mail", Type = "deliver", Label = "📦 " + ForestLocalization.T("aq.deliver", "택배 배달") };
                Aim(g, "deliver", -1);
                return g;
            }
            return null;
        }

        /// <summary>목표 자리·반경을 채운다(자리를 못 찾으면 At = null).</summary>
        private static void Aim(AutoQuest.Goal g, string kind, int zone)
        {
            switch (kind)
            {
                case "go":
                    if (zone < 0) return;
                    var c = ForestBiomeData.Zones[zone].Center;
                    g.At = new Vector3(c.x, 0f, c.y);
                    g.Radius = ZoneR;
                    return;
                case "meet":
                    foreach (var lm in FindObjectsByType<ForestLandmark>(FindObjectsSortMode.None))
                        if (lm.ZoneIndex == zone) { g.At = lm.transform.position; g.Radius = LandmarkR; return; }
                    return;
                case "deliver":
                    if (ForestDeliveryState.Carrying) { g.At = ForestDeliveryMailbox.PositionOf(ForestDeliveryState.TargetIndex); g.Radius = MailR; return; }
                    var counter = FindFirstObjectByType<ForestDeliveryCounter>();
                    if (counter != null) { g.At = counter.transform.position; g.Radius = CounterR; }
                    return;
            }
        }

        public override Vector3? Pos() => Pc != null ? Pc.transform.position : (Vector3?)null;

        public override bool Busy() => Popup();

        public override string Pause()
        {
            var step = ForestScenario.CurrentStep();
            if (step != null && KindOf(step) == "manual" && !Popup()) return ForestLocalization.T("aq.manual", "직접 — ") + ForestScenario.HudLine();
            var pc = Pc;
            if (pc != null && (ForestCave.Inside || ForestMounts.Indoors(pc.transform.position))) return ForestLocalization.T("aq.indoor", "집·굴 안 — 밖에서 켠다");
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
            var p = Pos();
            if (p == null) return;
            _side = SideOf(p.Value, g.At, n);
            _sideT = SideSec + n;
        }

        public override string Run(AutoQuest.Goal g, float dt)
        {
            var pc = Pc;
            if (pc == null) return "";
            var sc = ForestScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
            {
                pc.ClearTestInput();
                if (TalkPulse(dt)) { if (sc.Picking) sc.Pick(0); else sc.Next(); }
                return ForestLocalization.T("aq.talk", "대화");
            }
            if (Popup()) { pc.ClearTestInput(); return ForestLocalization.T("aq.pick", "고르기 기다림"); }
            if (_sideT > 0f) { _sideT -= dt; pc.SetTestInput(new Vector2(_side.x, _side.z)); return ForestLocalization.T("aq.side", "비켜 감"); }
            if (g.Type == "talk") { pc.ClearTestInput(); return ForestLocalization.T("aq.wait_talk", "이야기 기다림"); }
            if (g.At == null) { pc.ClearTestInput(); return ForestLocalization.T("aq.nowhere", "자리 모름"); }
            Vector3 to = g.At.Value - pc.transform.position; to.y = 0f;
            float dist = to.magnitude;
            if (dist > g.Radius) { to /= Mathf.Max(dist, 0.001f); pc.SetTestInput(new Vector2(to.x, to.z)); return $"{ForestLocalization.T("aq.walk", "걷는 중")} {Mathf.RoundToInt(dist)}m"; }
            pc.ClearTestInput();
            return ForestLocalization.T("aq.wait", "도착");
        }
    }
}
