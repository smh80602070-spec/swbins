using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0164 2나락 자동 퀘스트 어댑터(웹 `saga-dungeon/js/auto-quest-dg.js` W-0338 · 고돗 G-0299 `auto_quest_dg.gd` 짝) — 방 클리어 단위.
    /// 목표 순서: 시나리오 장면(줄 넘김·고르기 첫 답) → 산 적 = 다가가 평타 → 안 풀린 인영(걸어 닿으면 풀림) → 선 문 표지(가장 가까운 것 — 밟으면 다음 방·계단).
    /// 굴혈 방(층 진행기 20×20) 안에 서 있으면 그 방 것만(옆 고정 방 적·인영을 쫓아 방 밖 허공으로 안 나간다), 밖이면 14m 안 적·인영만. 축복 3택은 사람 몫이라 기다린다.
    /// 멈춤 = 이동 키·조이스틱 · 체력 30% 밑 · 쓰러짐 · 막힘 넷째. `GameBootstrap.Start` 가 붙인다(씬 재빌드 없음).
    /// </summary>
    public class DungeonAutoQuest : AutoQuestHud
    {
        public const float FightR = 14f, HitR = 2.2f, ArriveR = 0.8f, InRoomPad = 1f;
        private const string ProcRoom = "procroom";

        public static DungeonAutoQuest Instance { get; private set; }
        private Transform _player;
        private PlayerController _pc;
        private PlayerCombat _combat;
        private Vector3 _side;
        private float _sideT;

        public static DungeonAutoQuest Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("DungeonAutoQuest").AddComponent<DungeonAutoQuest>();
        }

        protected override void Awake()
        {
            base.Awake();
            Instance = this;
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private bool Ready()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return false;
                _player = go.transform;
                _pc = go.GetComponent<PlayerController>();
                _combat = go.GetComponent<PlayerCombat>();
            }
            return _pc != null && _combat != null;
        }

        // 왼쪽 위는 체력 글(PlayerHudUI Label 700 폭, 밑으로 −160), 오른쪽 위는 일시정지·비결 단추가 차지 — 목표판·적 카드(−104~−162) 밑 가운데(지역 배너 −330 위)
        protected override Vector2 PlayAt => new Vector2(0f, -170f);
        protected override Vector2 DoingAt => new Vector2(0f, -238f);

        protected override void Toast(string text, float sec) => DialogueLabel.Instance?.Show(text, sec);

        protected override bool CanOffer() => !(DungeonScenarioUi.Instance != null && DungeonScenarioUi.Instance.IsOpen) && !(BlessingUi != null && BlessingUi.IsShowing)
            && !(TrialCardUi.Instance != null && TrialCardUi.Instance.IsOpen);

        // ---- 어댑터 ----

        public override AutoQuest.Goal First()
        {
            var sc = DungeonScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
                return new AutoQuest.Goal { Id = "scene:" + sc.SceneId, Type = "talk", Label = "📜 " + DungeonLocalization.T("aq.scene", "장면") };
            if (!Ready()) return null;
            Vector3 me = _player.position;
            var runner = DungeonFloorRunner.Instance;
            bool inRoom = InRoom(runner, me);
            var foe = NearestFoe(me, inRoom);
            if (foe != null)
            {
                bool room = inRoom;
                return new AutoQuest.Goal
                {
                    Id = room ? $"room:{runner.CurrentFloor}.{runner.RoomIndex}" : "foe:" + foe.GetInstanceID(),
                    Type = "kill",
                    Label = "⚔ " + (room ? string.Format(DungeonLocalization.T("aq.room", "{0}층 {1}방 치우기"), runner.CurrentFloor, runner.RoomIndex + 1)
                        : DungeonLocalization.T("aq.foe", "적 처치")),
                    At = foe.transform.position,
                    Radius = HitR,
                };
            }
            var cap = NearestCaptive(me, inRoom);
            if (cap != null)
                return new AutoQuest.Goal { Id = "rescue:" + cap.GetInstanceID(), Type = "meet", Label = "🙏 " + DungeonLocalization.T("aq.rescue", "인영 구출"), At = cap.transform.position, Radius = ArriveR };
            if (inRoom)
            {
                bool any = false;
                Vector3 best = default;
                string kind = null;
                float bd = float.MaxValue;
                foreach (var d in runner.DoorSpots())
                {
                    float m = Flat(d.Pos - me);
                    if (m < bd) { bd = m; best = d.Pos; kind = d.Kind; any = true; }
                }
                if (any)
                    return new AutoQuest.Goal
                    {
                        Id = $"door:{runner.CurrentFloor}.{runner.RoomIndex}",
                        Type = "enter",
                        Label = "🚪 " + (kind == "stair" ? DungeonLocalization.T("aq.stair", "계단 — 다음 층") : string.Format(DungeonLocalization.T("aq.door", "다음 방 — {0}"), DungeonFormulas.KindDisplayName(kind))),
                        At = best,
                        Radius = ArriveR,
                    };
            }
            return null;
        }

        public override Vector3? Pos() => Ready() ? _player.position : (Vector3?)null;

        public override bool Busy()
        {
            var sc = DungeonScenarioUi.Instance;
            var bl = BlessingUi;
            return DungeonCutscenes.Playing || TrialRunner.Busy || (sc != null && sc.IsOpen) || (bl != null && bl.IsShowing) || (_pc != null && _pc.Climbing);
        }

        private BlessingChoiceUi _blessing;
        private BlessingChoiceUi BlessingUi => _blessing != null ? _blessing : (_blessing = FindFirstObjectByType<BlessingChoiceUi>());

        public override string Pause()
        {
            if (HeroState.Hp <= 0) return DownWhy;
            return PlayerController.HeroHpFrac() < LowHpFrac ? LowHpWhy : null;
        }

        public override void Begin(AutoQuest.Goal g)
        {
            _sideT = 0f;
            base.Begin(g);
        }

        public override void End(string why)
        {
            _pc?.ClearTestInput();
            base.End(why);
        }

        public override void Unstick(int n, AutoQuest.Goal g)
        {
            if (!Ready()) return;
            _side = SideOf(_player.position, g.At, n);
            _sideT = SideSec + n;
            _pc.RequestJump();
        }

        public override string Run(AutoQuest.Goal g, float dt)
        {
            if (!Ready()) return "";
            if (DungeonCutscenes.Playing) { _pc.ClearTestInput(); return DungeonLocalization.T("aq.scene", "장면"); }
            var sc = DungeonScenarioUi.Instance;
            if (sc != null && sc.IsOpen)
            {
                _pc.ClearTestInput();
                if (TalkPulse(dt)) { if (sc.Picking) sc.Pick(0); else sc.Next(); }
                return DungeonLocalization.T("aq.talk", "대화");
            }
            var bl = BlessingUi;
            if (bl != null && bl.IsShowing) { _pc.ClearTestInput(); return DungeonLocalization.T("aq.pick", "고르기 기다림"); }
            if (_sideT > 0f) { _sideT -= dt; Walk(_side); return DungeonLocalization.T("aq.side", "비켜 감"); }
            Vector3 me = _player.position;
            if (g.Type == "kill")
            {
                var foe = NearestFoe(me, InRoom(DungeonFloorRunner.Instance, me));
                if (foe == null) { _pc.ClearTestInput(); return ""; }
                Vector3 d = foe.transform.position - me; d.y = 0f;
                if (d.magnitude > HitR) { Walk(d.normalized); return DungeonLocalization.T("aq.fight", "싸움"); }
                _pc.ClearTestInput();
                _pc.FaceToward(foe.transform.position);
                _combat.TriggerAttack();
                return DungeonLocalization.T("aq.fight", "싸움");
            }
            if (g.At == null) { _pc.ClearTestInput(); return ""; }
            Vector3 to = g.At.Value - me; to.y = 0f;
            float dist = to.magnitude;
            if (dist > ArriveR) { Walk(to / Mathf.Max(dist, 0.001f)); return $"{DungeonLocalization.T("aq.walk", "걷는 중")} {Mathf.RoundToInt(dist)}m"; }
            _pc.ClearTestInput();
            return DungeonLocalization.T("aq.wait", "도착");
        }

        private void Walk(Vector3 dir) => _pc.SetTestInput(new Vector2(dir.x, dir.z));

        /// <summary>굴혈 방(층 진행기 자리 ±10m) 안인가.</summary>
        public static bool InRoom(DungeonFloorRunner runner, Vector3 me)
        {
            if (runner == null) return false;
            Vector3 d = me - runner.transform.position;
            float h = DungeonRoomBuilder.RoomWidth * 0.5f + InRoomPad;
            return Mathf.Abs(d.x) <= h && Mathf.Abs(d.z) <= h;
        }

        /// <summary>방 안이면 그 방 산 적 전부, 밖이면 14m 안 — 가장 가까운 것.</summary>
        private static DungeonEnemy NearestFoe(Vector3 me, bool inRoom)
        {
            DungeonEnemy best = null;
            float bd = float.MaxValue;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || !e.IsAlive || !e.isActiveAndEnabled) continue;
                float m = Flat(e.transform.position - me);
                if (inRoom ? e.RoomId != ProcRoom : m > FightR) continue;
                if (m < bd) { bd = m; best = e; }
            }
            return best;
        }

        private static DungeonCaptive NearestCaptive(Vector3 me, bool inRoom)
        {
            DungeonCaptive best = null;
            float bd = inRoom ? float.MaxValue : FightR;
            foreach (var c in FindObjectsByType<DungeonCaptive>(FindObjectsSortMode.None))
            {
                if (c.IsFreed || !c.isActiveAndEnabled || inRoom != (c.RoomId == ProcRoom)) continue;
                float m = Flat(c.transform.position - me);
                if (m < bd) { bd = m; best = c; }
            }
            return best;
        }
    }
}
