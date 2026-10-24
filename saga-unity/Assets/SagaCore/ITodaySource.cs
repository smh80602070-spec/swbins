using System;
using System.Collections.Generic;

namespace Saga.Core
{
    /// <summary>tasks U-0213 「오늘」 창 한 줄 — 글·끝남·받기 단추(ClaimId &lt; 0 이면 단추 없음).</summary>
    public struct TodayRow
    {
        public string Text;
        public bool Done;
        /// <summary>받기 단추 번호(판 어댑터가 <see cref="ITodaySource.Claim"/> 로 다시 받는다). -1 = 단추 없음.</summary>
        public int ClaimId;
        /// <summary>지금 받을 수 있다(단추 켜짐).</summary>
        public bool Claimable;

        public static TodayRow Line(string text, bool done = false) => new TodayRow { Text = text, Done = done, ClaimId = -1 };
        public static TodayRow Reward(string text, int claimId, bool claimable, bool claimed) => new TodayRow { Text = text, Done = claimed, ClaimId = claimId, Claimable = claimable && !claimed };
    }

    /// <summary>
    /// tasks U-0213 「오늘」 창(고돗 G-0351·웹 W-0380 짝)의 판 어댑터 — <see cref="IGoalSource"/> 와 같은 결로 SagaCore 는 이 인터페이스만 안다(49장 단방향).
    /// 어댑터는 **판에 이미 있는 값만 읽고**, 받기는 판의 기존 함수를 부른다(새 상태·새 일일 거리 없음). 5천하는 실제 시계 일일이 없어
    /// 게임 달 기준 「이번 달」(tasks U-0215 — 갈림 없음 = <see cref="DateTime.MinValue"/>)로 구현한다.
    /// </summary>
    public interface ITodaySource
    {
        /// <summary>첫 묶음 머리·창 제목(tasks U-0215 — 네 판은 "오늘", 5천하는 게임 달 기준 "이번 달 · ○년 ○월").</summary>
        string TodayTitle { get; }

        /// <summary>둘째 묶음 머리(판 말 — "이번 주"·"시즌"·"축제" 등).</summary>
        string WeekTitle { get; }

        /// <summary>오늘 줄·둘째 묶음 줄을 채운다(부르는 쪽이 비워서 넘긴다).</summary>
        void Rows(List<TodayRow> today, List<TodayRow> week);

        /// <summary>받기 — 판 기존 함수를 부르고 알림은 판이 띄운다.</summary>
        void Claim(int claimId);

        /// <summary>다음 갈림(기기 현지 시각). 없으면 <see cref="DateTime.MinValue"/> — 판마다 갈림이 달라 판 셈 그대로.</summary>
        DateTime NextReset(bool week, DateTime now);
    }
}
