using UnityEngine;
using Saga.Forest.Audio;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 101-2 5.8① "채집 5요소" 진입점 — `ForestCollectSpot`·
    /// `ForestFruitTree`가 채집이 성사될 때마다 한 번만 부른다. 웹판 5.8
    /// (`saga-web/saga-forest/PLAN.md` 177행) "입력→반응 ≤100ms·대상
    /// 흔들림·수확 팝·효과음(item_pick)·연속 채집 리듬 보너스"를
    /// 이 트랙 컴포넌트로 재해석: 반응은 애초에 `Update()` 안에서 같은
    /// 프레임에 처리돼 100ms 제약이 저절로 지켜지고, 나머지 넷을 여기
    /// 한곳에 모았다(<see cref="ForestGatherPopup"/>·<see cref="ForestGatherBump"/>·
    /// `ForestAudio`·<see cref="ForestGatherStreak"/>).
    /// </summary>
    public static class ForestGatherFeel
    {
        private const int BonusFruit = 1; // 리듬 보너스 — 이 트랙 통화(과일) 그대로.

        /// <summary>헤드리스 진단 전용 카운터 — `HitSpark.SpawnCount`와 같은 결.</summary>
        public static int TriggerCount { get; private set; }

        /// <summary>보너스가 실제로 지급된 횟수 — 헤드리스 진단이 리듬 보너스
        /// 임계값을 넘겼는지 값으로 확인한다.</summary>
        public static int BonusCount { get; private set; }

        /// <param name="worldPos">팝업이 떠오를 자리(자리·나무 위쪽).</param>
        /// <param name="visual">범프를 먹일 대상(자리·나무의 `Visual` 자식).</param>
        /// <param name="label">팝업 글자(발견 이름, "NEW!" 등은 호출부가 이미 붙여 넘긴다).</param>
        public static void Play(Vector3 worldPos, Transform visual, string label)
        {
            TriggerCount++;
            Saga.Core.Motion30.Play(Object.FindFirstObjectByType<Saga.Forest.Player.PlayerController>()?.Animator, "gather"); // tasks U-0200 ① 줍기·채집
            bool bonus = ForestGatherStreak.ReportGather();
            if (bonus)
            {
                BonusCount++;
                // PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 소원 버프가 있으면 이 보너스도 ×1.5.
                ForestState.AddFruit(Mathf.RoundToInt(BonusFruit * ForestFestivalState.FruitMultiplier));
            }

            ForestGatherPopup.Spawn(worldPos, label, bonus);
            ForestGatherBump.Apply(visual);

            // tasks U-0104 — 자체 효과음 item_pick(변형은 SagaSfx 가 돌려 가며). U-0152 — 씬의 빌린 채집 클립 걷음.
            ForestAudio.PlaySfx("item_pick");
        }

        /// <summary>헤드리스 진단 전용 — 이전 검증의 카운터를
        /// 이어받지 않게 리셋한다.</summary>
        public static void ResetForTest()
        {
            TriggerCount = 0;
            BonusCount = 0;
            ForestGatherStreak.ResetForTest();
        }
    }
}
