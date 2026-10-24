using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 101-2 5-8 "동료 교대 — 인물 셋 편성, 즉시 교대, 교대 서명
    /// 1발". 웹판 §5-8(`saga-web/saga-story/PLAN.md` 302행)은 인물 105
    /// 로스터에서 셋을 편성해 각자 개별 체력을 갖고, 쓰러진 인물은 마을
    /// 복귀까지 교대할 수 없는 것을 전제한다. 이 트랙엔 인물 로스터
    /// 자체가 없고(<see cref="StoryCombat"/> 클래스 주석 "인물 로스터를
    /// 아직 안 붙였다"), 결정적으로 **플레이어가 피격당하지 않아**
    /// (`StoryCombat.StartHp` 주석 "플레이어가 안 맞아 미사용") 개별 체력·
    /// 쓰러짐·"0.2초 무적" 셋 다 적용할 축이 없다.
    ///
    /// 그래서 "편성"을 인물 획득이 아니라 **항상 셋 다 갖춘 고정 역할
    /// 셋**(웹판 "faction/stats로 정한 효과 9 중 1"의 뜻을 이 트랙에 이미
    /// 있는 실제 채널 셋 — 횡소·기탄·기합 — 에 그대로 얹는 쪽으로
    /// 좁혔다)으로, "체력"을 공격 배율로, "서명 1발"을 그 역할의 기존
    /// 무예 하나를 MP 소모 없이 즉시 발동하는 것으로 재해석했다(웹판
    /// "새 효과 없음" 원칙 그대로 — 기존 셋을 재사용, 새 효과를 안
    /// 만든다). 직업·무예는 여전히 계정 단위(웹판 그대로) — 활성 역할은
    /// 계정 위에 얹는 공격 배율+서명 트리거일 뿐, 전직·SP와는 무관하다.
    /// </summary>
    public static class StoryPartyState
    {
        public enum Signature { Sweep, Bolt, Brace }

        public readonly struct Companion
        {
            public readonly string Id;
            public readonly string Name;
            /// <summary>110 ⑤c-2c — 화면에 보이는 이름(번역 표 party.name.&lt;id&gt;, 없으면 Name).</summary>
            public string DisplayName => StoryLocalization.T($"party.name.{Id}", Name);
            public readonly float AtkMultiplier;
            public readonly Signature Signature;

            public Companion(string id, string name, float atkMultiplier, Signature signature)
            {
                Id = id;
                Name = name;
                AtkMultiplier = atkMultiplier;
                Signature = signature;
            }
        }

        // 웹판 "faction/stats로 정한 효과 9 중 1"을 이 트랙 실제 채널 셋에
        // 맞춰 좁혔다 — 공격형(선봉)·원거리형(유격)·강화형(호법), 값은
        // PerkState류(다른 판 101-2)와 같은 규모(±10~15%).
        public static readonly Companion[] Roster =
        {
            new Companion("vanguard", "선봉(先鋒)", 1.15f, Signature.Sweep),
            new Companion("skirmisher", "유격(遊擊)", 1.0f, Signature.Bolt),
            new Companion("guardian", "호법(護法)", 0.9f, Signature.Brace),
        };

        public const float SwapCooldownSec = 4f; // 웹판 "교대 쿨 4s" 그대로.

        public static int ActiveIndex { get; private set; }
        private static float _cooldownLeft;

        /// <summary>UI(HUD·토스트)용 — 교대가 실제로 일어난 순간(index)만 쏜다.</summary>
        public static event Action<int> Swapped;

        public static Companion Active => Roster[ActiveIndex];
        public static float AtkMultiplier => Active.AtkMultiplier * StoryBond.AtkMul * StoryMonsterBook.AtkMul; // tasks U-0222 다 모은 종마다 +0.2% // tasks U-0208 지기 곱(한 번 닿으면 ×1.05, 아니면 ×1)
        public static float CooldownLeft => _cooldownLeft;

        public static void TickCooldown(float dt) => _cooldownLeft = Mathf.Max(0f, _cooldownLeft - dt);

        public static bool CanSwapTo(int index) => index != ActiveIndex && _cooldownLeft <= 0f
            && index >= 0 && index < Roster.Length;

        /// <summary>StoryPlayerController.TriggerPartySwap()이 부른다 — 성공하면
        /// 그 자리에서 새 역할의 서명(<see cref="Companion.Signature"/>)을
        /// 무료로 발동하는 것까지가 "교대"의 전체 뜻(호출부 책임).</summary>
        public static bool TrySwap(int index)
        {
            if (!CanSwapTo(index)) return false;
            ActiveIndex = index;
            _cooldownLeft = SwapCooldownSec;
            Swapped?.Invoke(index);
            return true;
        }

        /// <summary>세이브 로드 전용 — 저장된 인덱스가 범위 밖이면(파일 손상)
        /// 0(선봉)으로 되돌린다. 쿨다운은 세이브 대상이 아니다(회차성,
        /// StoryLabyrinthState류와 같은 결 — 어차피 4초라 무해).</summary>
        public static void Restore(int index)
        {
            ActiveIndex = index >= 0 && index < Roster.Length ? index : 0;
            _cooldownLeft = 0f;
        }
    }
}
