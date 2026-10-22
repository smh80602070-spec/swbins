using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0163(웹 `shared/js/autoquest.js` W-0337 · 고돗 G-0298 짝) 자동 퀘스트 공용 틀 — 순수 상태 기계(그림·씬 없음).
    /// 판 어댑터(<see cref="IAutoQuestAdapter"/>)가 주는 "지금 목표"의 첫 것을 끝까지 대신하고, 목표 id 가 바뀌면 다음으로 센다.
    /// 규칙은 여기 없다 — 어댑터가 판 공개 함수만 불러 실행하고, 이 틀은 "어느 목표를 · 언제 멈추나"만 안다.
    /// 막힘: 바쁘지 않은데 <see cref="StillM"/> 안에 <see cref="StuckSec"/> 머물면 막힘 1 → 어댑터 Unstick(n), <see cref="StuckMax"/> 넘으면 멈춤 "막힘 — 목표".
    /// 멈춤 조건은 어댑터 Pause()(체력 낮음 등)와 판의 손 조작 감시(Stop 호출)가 준다. 이야기 장면은 건너뛰지 않는다(줄 넘기기는 판 몫).
    /// </summary>
    public class AutoQuest
    {
        public class Goal
        {
            /// <summary>목표가 바뀌었는지 가르는 열쇠(이야기 줄+단계 등).</summary>
            public string Id;
            /// <summary>"go" · "talk" · "kill" · "collect" · "enter" · "meet"(웹 TYPES).</summary>
            public string Type;
            public string Label;
            /// <summary>목표 자리(없으면 null — 어댑터가 알아서).</summary>
            public Vector3? At;
            public float Radius;
        }

        public interface IAutoQuestAdapter
        {
            /// <summary>지금 목표(없으면 null — 멈춤 "목표 없음").</summary>
            Goal First();
            /// <summary>한 걸음 굴린다 → 화면 한 줄(지금 하는 일).</summary>
            string Run(Goal g, float dt);
            Vector3? Pos();
            /// <summary>true 면 막힘을 안 센다(대화·싸움·창).</summary>
            bool Busy();
            /// <summary>멈출 이유(체력 낮음·모두 쓰러짐…) 또는 null.</summary>
            string Pause();
            void Begin(Goal g);
            void End(string why);
            /// <summary>n 번째 막힘 — 비켜 가기.</summary>
            void Unstick(int n, Goal g);
        }

        public static float StillM = 1f, StuckSec = 30f;
        public static int StuckMax = 3;

        private readonly IAutoQuestAdapter _ad;
        private Vector3? _last;
        private float _still;
        private readonly List<string> _log = new List<string>();

        public bool On { get; private set; }
        public Goal Current { get; private set; }
        public string Doing { get; private set; } = "";
        /// <summary>마지막으로 멈춘 이유.</summary>
        public string Why { get; private set; } = "";
        public int Stuck { get; private set; }
        /// <summary>켠 뒤 끝낸 목표 수(목표 id 가 바뀐 횟수).</summary>
        public int Done { get; private set; }
        public float Since { get; private set; }
        public IReadOnlyList<string> Log => _log;

        public AutoQuest(IAutoQuestAdapter adapter) { _ad = adapter; }

        public bool Start()
        {
            if (On) return false;
            var g = _ad.First();
            if (g == null) { Why = SagaUi.L("목표 없음", "No goal"); return false; }
            On = true; Why = ""; Current = g; Since = 0f; _still = 0f; Stuck = 0; _last = null; Doing = ""; Done = 0;
            _ad.Begin(g);
            return true;
        }

        public bool Stop(string why)
        {
            if (!On) return false;
            On = false; Why = why ?? ""; Current = null; Doing = "";
            _ad.End(Why);
            return true;
        }

        public bool Toggle() => On ? !Stop(SagaUi.L("손으로 끔", "Turned off")) : Start();

        public void Tick(float dt)
        {
            if (!On) return;
            if (dt < 0f) dt = 0f;
            var pz = _ad.Pause();
            if (pz != null) { Stop(pz); return; }
            var g = _ad.First();
            if (g == null) { Stop(SagaUi.L("목표 없음", "No goal")); return; }
            if (Current == null || g.Id != Current.Id) { Done++; Current = g; Since = 0f; _still = 0f; Stuck = 0; _last = null; }
            Since += dt;
            Doing = _ad.Run(g, dt) ?? "";
            var p = _ad.Pos();
            if (p == null || _ad.Busy()) { _still = 0f; _last = p; return; } // 대화·싸움·창 안에서는 서 있어도 막힘이 아니다
            Vector3 a = p.Value;
            if (_last.HasValue && Flat(a - _last.Value) < StillM) _still += dt;
            else { _still = 0f; _last = a; }
            if (_still < StuckSec) return;
            _still = 0f; Stuck++;
            _log.Add($"{Mathf.RoundToInt(Since)}s {g.Id} 막힘 {Stuck} @({a.x:0},{a.z:0})");
            if (_log.Count > 40) _log.RemoveAt(0);
            if (Stuck > StuckMax) { Stop(SagaUi.L("막힘 — ", "Stuck — ") + (g.Label ?? g.Id)); return; }
            _ad.Unstick(Stuck, g);
        }

        private static float Flat(Vector3 v) { v.y = 0f; return v.magnitude; }
    }
}
