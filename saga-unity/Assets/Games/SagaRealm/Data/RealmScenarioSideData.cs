using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16 곁가지 「시간 틈 사람 각자 두 번째 카드」(정본 `scenario/saga-realm.md` side_time_&lt;인물&gt; · 웹 `data-scenario.js` SIDE 아홉) — 시간 틈 사람이 우리 사람이 된 지 열두 달 뒤 그 사람 고향 이야기 한 장.
    /// 본 사슬과 **따로** 흐르며(<see cref="RealmScenario.DueCardId"/> 가 본 사슬에 받을 카드가 없을 때만 낸다) 카드 속 {책사} 는 그 사람이다. 웹 충성 +5 는 이 트랙 규칙대로 수도 기술 +10. 생성물 — 웹 표를 스크립트로 옮김.
    /// </summary>
    public static class RealmScenarioSideData
    {
        public static readonly RealmScenarioData.Card[] Side = RealmScenarioData.SideCards;

        public static RealmScenarioData.Card Get(string id)
        {
            foreach (var c in Side) if (c.Id == id) return c;
            return null;
        }
    }
}
