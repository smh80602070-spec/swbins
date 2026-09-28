using System;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 107-7 "망루 수호장" — 쓰러뜨림 기록(웹 ⑪ `save.field.guards` 와 같은 결). 세이브 v15 `guardianDown`. UnityEngine 을 안 끌어오는 순수 데이터.
    /// PLAN.md 109-14-10 "들판 보스"(웹 ⑲-10 `fieldboss.js`) — 쓰러뜨리면 그 자리에 보상 꽃(`Bloom`), 원기 30 으로 받으면(`PaidAt`) 150초 뒤 다시 선다(`Standing`).
    /// 다시 쓰러뜨리면 토벌 금·경험 없이 꽃만 다시 핀다(첫 토벌만 `MarkDefeated` 가 true). 세이브 v27 `guardianBloom`·`guardianPaidAt`.
    /// </summary>
    public static class GuardianState
    {
        public const long BackSec = 150;

        /// <summary>한 번이라도 쓰러뜨렸나(지역 사명·첫 토벌 보상이 본다).</summary>
        public static bool Defeated { get; private set; }
        /// <summary>보상 꽃이 피어 있나(쓰러뜨렸고 아직 안 받음).</summary>
        public static bool Bloom { get; private set; }
        /// <summary>꽃을 받은 유닉스 초(0 = 없음).</summary>
        public static long PaidAt { get; private set; }

        public static long NowForTest = -1;
        public static long Now => NowForTest >= 0 ? NowForTest : DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        /// <summary>수호장이 서 있어야 하나 — 안 쓰러뜨렸거나, 꽃을 받고 150초가 지났다.</summary>
        public static bool Standing => !Defeated || (!Bloom && PaidAt > 0 && Now - PaidAt >= BackSec);

        public static event Action Changed;

        /// <summary>쓰러뜨렸다 — 꽃이 핀다. 처음이면 true(토벌 금·경험은 처음만).</summary>
        public static bool MarkDefeated()
        {
            bool first = !Defeated;
            Defeated = true;
            Bloom = true;
            PaidAt = 0;
            Changed?.Invoke();
            return first;
        }

        /// <summary>꽃을 받았다 — 지금부터 150초 뒤 다시 선다.</summary>
        public static void MarkPaid()
        {
            Bloom = false;
            PaidAt = Now;
            Changed?.Invoke();
        }

        public static void Restore(bool defeated, bool bloom = false, long paidAt = 0)
        {
            Defeated = defeated;
            Bloom = defeated && bloom;
            PaidAt = defeated ? Math.Max(0, paidAt) : 0;
            Changed?.Invoke();
        }
    }
}
