using System;
using System.Collections.Generic;

namespace Saga.Core
{
    /// <summary>
    /// 첫 10분 사명(tasks U-0013) — 새 세이브의 목표판 첫 줄에 차례로 뜨는 "첫걸음" 단계 목록. 판별 표는 단계마다 `Done`(기존 상태를 읽는
    /// 폴링 판정)을 준다 — 보드가 `GoalLineNow` 를 주기로 부를 때 <see cref="Line"/> 이 현재 단계를 판정하므로 이벤트·컴포넌트가 필요 없다.
    /// 판정은 절대 조건이라 순서를 바꿔 이미 한 일은 건너뛴다. 끝난 단계는 `Ids`(세이브)에 남고, 다 끝났거나 <see cref="Enabled"/> 가
    /// false 면 <see cref="Line"/> 이 null 이라 평소 목표 줄로 돌아간다. 옛 세이브는 마이그레이션이 <see cref="CompleteAll"/> 한 목록을 채운다.
    /// </summary>
    public sealed class TutorialSteps
    {
        public sealed class Step
        {
            public string Id, Ko, En;
            public Func<bool> Done;
        }

        private readonly Step[] _steps;
        private readonly HashSet<string> _done = new HashSet<string>();

        /// <summary>진단이 첫 목표판 줄을 검사할 때 끈다(`DungeonScenario.Enabled` 와 같은 결).</summary>
        public bool Enabled = true;

        public TutorialSteps(params Step[] steps) { _steps = steps; }

        public int Count => _steps.Length;
        public int DoneCount => _done.Count;
        public bool Finished => _done.Count >= _steps.Length;

        /// <summary>끝난 단계 id — 단계 표 순서대로(세이브용).</summary>
        public List<string> Ids()
        {
            var l = new List<string>();
            foreach (var s in _steps) if (_done.Contains(s.Id)) l.Add(s.Id);
            return l;
        }

        /// <summary>모든 단계 id(옛 세이브 마이그레이션이 "전부 끝남"으로 채운다).</summary>
        public List<string> AllIds()
        {
            var l = new List<string>();
            foreach (var s in _steps) l.Add(s.Id);
            return l;
        }

        public void Restore(IEnumerable<string> ids)
        {
            _done.Clear();
            if (ids == null) return;
            var known = new HashSet<string>(AllIds());
            foreach (var id in ids) if (known.Contains(id)) _done.Add(id);
        }

        public void CompleteAll() => Restore(AllIds());

        /// <summary>지금 단계 문구(`첫걸음 n/N: …`) — 끝났거나 꺼졌으면 null. 부를 때 현재 단계 판정이 참이면 완료 처리하고 다음 단계로 넘어간다.</summary>
        public string Line()
        {
            if (!Enabled) return null;
            for (int i = 0; i < _steps.Length; i++)
            {
                var s = _steps[i];
                if (_done.Contains(s.Id)) continue;
                if (s.Done != null && s.Done()) { _done.Add(s.Id); continue; }
                string text = SagaUi.L(s.Ko, s.En);
                string head = SagaUi.L("첫걸음", "First steps");
                return $"{head} {_done.Count + 1}/{_steps.Length}: {text}";
            }
            return null;
        }
    }
}
