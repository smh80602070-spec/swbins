using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 106-10 — 교대 셋(`StoryPartyState.Roster` 순서: 선봉·유격·호법)의 몸을 거느린다. 앞에 나선 역할은
    /// 숨기고 쉬는 둘을 곁에 세운다. 교대(`StoryPartyState.TrySwap`)든 세이브 복원(`Restore`)이든 활성 역할이
    /// 바뀐 것을 매 프레임 비교로 알아채, 들어가는 쪽은 불꽃과 함께 사라지고 나오는 쪽은 플레이어 곁에서 튀어나온다.
    /// 몸은 씬 빌더가 편집기에서 짓는다(`[SerializeField] members`).
    /// </summary>
    public class StoryCompanionSquad : MonoBehaviour
    {
        /// <summary>진단 — `PlaytestStorySlice` 가 동료 진단 뒤 나머지 단계(잡졸 수·한 방 피해 전제)를 안 흔들게 멈춘다.
        /// 멈춰도 숨김·드러냄은 돈다.</summary>
        public static bool PausedForTest;

        [SerializeField] private StoryCompanion[] members = new StoryCompanion[0];

        private int _lastActive = -1;

        public static StoryCompanionSquad Instance { get; private set; }
        public IReadOnlyList<StoryCompanion> Members => members;

        private void Awake()
        {
            Instance = this;
            PausedForTest = false; // 에디터에서 도메인 리로드 없이 다시 Play 해도 남지 않게.
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Refresh(true);
        }

        private void LateUpdate()
        {
            Refresh(false);
        }

        /// <summary>활성 역할이 바뀌었으면 숨김·드러냄을 고친다. 진단도 부른다.</summary>
        public void Refresh(bool first)
        {
            int active = StoryPartyState.ActiveIndex;
            if (!first && active == _lastActive) return;
            int slot = 0;
            foreach (var m in members)
            {
                if (m == null) continue;
                bool show = m.RoleIndex != active;
                if (show) m.SetSlot(slot++);
                bool was = m.gameObject.activeSelf;
                if (was && !show && !first) HitSpark.Spawn(m.transform.position + Vector3.up, false); // 들어간다.
                m.gameObject.SetActive(show);
                if (show && (!was || first)) m.AppearBeside();
            }
            _lastActive = active;
        }

        public StoryCompanion Member(int roleIndex)
        {
            foreach (var m in members) if (m != null && m.RoleIndex == roleIndex) return m;
            return null;
        }
    }
}
