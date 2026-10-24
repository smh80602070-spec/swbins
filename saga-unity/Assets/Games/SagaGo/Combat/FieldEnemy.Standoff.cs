using UnityEngine;

namespace Saga.Go.Combat
{
    /// <summary>`FieldEnemy` 의 일부(partial) — tasks U-0202 대치(고돗 G-0343 짝). 흐름은 `FieldCombat.Standoff`, 여기는 몸만.</summary>
    public partial class FieldEnemy
    {
        public enum StandPose { None, Glare, Cue, Lunge }

        /// <summary>대치 중 이 적의 자세 — None 이면 옛 길(떠돌기·어그로).</summary>
        public StandPose Stand { get; private set; }
        public const float StandLungeSpeed = 22f;
        private Vector3 _standTo;

        private static readonly Color StandCueTint = new Color(1f, 0.8f, 0.45f), StandLungeTint = new Color(1f, 0.35f, 0.3f);

        /// <summary>대치에 들 수 있나 — 떠도는 잡몹·체력 가득(인물·수호장·이야기·영역·주간 보스·얼음·잡힘·굴복 빼고).</summary>
        public bool StandoffOk => Alive && CurrentState == State.Wander && Stand == StandPose.None && !IsHero && !IsGuardian && !DomainFoe && !StoryFoe
            && !IsWeeklyBoss && !Siege.HasValue && !Frozen && !Yielded && HoldState == Hold.None && Hp >= MaxHp - 0.01f;

        /// <summary>멈춰 나를 노려본다.</summary>
        public void StandGlare()
        {
            Stand = StandPose.Glare;
            TintVisual(Color.white, false);
        }

        /// <summary>움찔(헛몸짓) — 달려들 듯 몸을 부풀린다. 이때 누르면 성급.</summary>
        public void StandCue()
        {
            Stand = StandPose.Cue;
            TintVisual(StandCueTint, true);
            if (_animator != null) Trig("Attack");
        }

        /// <summary>내 앞 자리로 미끄러지듯 달려든다(예고 빛).</summary>
        public void StandLunge(Vector3 to)
        {
            Stand = StandPose.Lunge;
            _standTo = to;
            TintVisual(StandLungeTint, true);
            if (_animator != null) Trig("Attack");
        }

        /// <summary>대치를 푼다 — chase 면 곧장 쫓아온다(깨짐), 아니면 옛 떠돌기로.</summary>
        public void StandRelease(bool chase)
        {
            if (Stand == StandPose.None) return;
            Stand = StandPose.None;
            TintVisual(Color.white, false);
            if (chase && Alive && CurrentState == State.Wander) EnterChase();
        }

        /// <summary>`Tick` 떠돌기 첫머리 — 대치 중이면 제 몫을 하고 true(어그로 안 함).</summary>
        private bool TickStand(Vector3 toPlayer, float dt)
        {
            if (Stand == StandPose.None) return false;
            if (Stand == StandPose.Lunge)
            {
                SetMoveAnim(1f);
                MoveToward(_standTo, StandLungeSpeed, dt, 0.05f);
            }
            else SetMoveAnim(0f);
            if (toPlayer.sqrMagnitude > 0.01f) Face(toPlayer);
            return true;
        }
    }
}
