using System;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-31 서리봉 고원 들판 보스 "만년설 바위곰왕"(웹 ⑲-31 `g_frost`) — 망루 수호장(<see cref="GuardianState"/>)과 같은 결의 쓰러뜨림 기록.
    /// 쓰러뜨리면 그 자리에 보상 꽃, 원기 30 으로 받으면(`PaidAt`) 150초 뒤 다시 선다(`Standing`). 첫 토벌만 금·경험(`MarkDefeated` 가 true).
    /// 세이브 `frostBossDown`·`frostBossBloom`·`frostBossPaidAt`(버전 그대로 — 옛 세이브는 안 쓰러뜨린 채).
    /// </summary>
    public static class FrostBossState
    {
        public const long BackSec = GuardianState.BackSec;

        public static bool Defeated { get; private set; }
        public static bool Bloom { get; private set; }
        public static long PaidAt { get; private set; }

        public static long NowForTest = -1;
        public static long Now => NowForTest >= 0 ? NowForTest : DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        public static bool Standing => !Defeated || (!Bloom && PaidAt > 0 && Now - PaidAt >= BackSec);

        public static event Action Changed;

        public static bool MarkDefeated()
        {
            bool first = !Defeated;
            Defeated = true;
            Bloom = true;
            PaidAt = 0;
            Changed?.Invoke();
            return first;
        }

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
