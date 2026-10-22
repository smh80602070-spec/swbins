using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>`FieldCombat` 의 일부(partial) — U-0157 쳐내기(패링).</summary>
    public partial class FieldCombat
    {
        // ---- U-0157 쳐내기(엘든 링 패링 — 유니티 전용, `docs/spec/references-1017.md` 1만리) — X(폰 🛡): 0.25초 창을 연다.
        // 창 안에 근접 예고가 떨어지면 피해·원소 효과 없이 튕겨 내고, 그 적은 비틀(잡몹 1.6초 · 인물·보스류 0.7초 — 눕지 않는다).
        // 2초 안 그 적에게 넣는 다음 기본 공격 한 타는 ×2(반격). 떨어지는 원거리(지 인물)·땅 원 수(밀물·고리·자리 수)는 못 쳐낸다 — 회피 몫.
        // 스태미나 10 · 쿨 0.8초(헛치면 그대로 날린다 — 일찍 누르는 벌). 쳐내면 쿨 0 이라 이어 오는 수도 다시 쳐낼 수 있다.
        public const float ParryWindowSec = 0.25f, ParryCdSec = 0.8f, ParryStamina = 10f, ParryStaggerSec = 1.6f, ParryBossStaggerSec = 0.7f,
            RiposteSec = 2f, RiposteMul = 2f;

        public float ParryLeft { get; private set; }
        public float ParryCd { get; private set; }
        public FieldEnemy RiposteFoe { get; private set; }
        public float RiposteLeft { get; private set; }
        /// <summary>진단 — 마지막 누름: "open" · "cd" · "stamina" · "busy", 쳐냈으면 "parry".</summary>
        public string LastParry { get; private set; }
        /// <summary>진단 — 마지막으로 들어간 반격 배수(아직 없으면 1, `ResetForTest` 가 1 로).</summary>
        public float LastRiposte { get; private set; } = 1f;

        private static readonly Color ParryGold = new Color(1f, 0.86f, 0.4f);

        /// <summary>X·🛡 — 쳐내기 창을 연다. 열렸으면 true.</summary>
        public bool Parry()
        {
            if (!CanAct() || MountBlocks()) { LastParry = "busy"; return false; } // U-0171 탄 동안 못 쳐냄
            if (ParryCd > 0f) { LastParry = "cd"; return false; }
            if (!GoStamina.TrySpend(ParryStamina)) { LastParry = "stamina"; return false; }
            ParryLeft = ParryWindowSec;
            ParryCd = ParryCdSec;
            LastParry = "open";
            FieldRingFx.Spawn(transform.position, 1.6f, ParryGold, 0.2f);
            return true;
        }

        /// <summary>`ReceiveStrike` 맨 앞 — 창 안의 근접 한 대면 튕겨 내고 true(안 맞음).</summary>
        private bool TryParry(FieldEnemy from)
        {
            if (ParryLeft <= 0f || from == null || !from.Parryable) return false;
            ParryLeft = 0f;
            ParryCd = 0f;
            from.Parried(from.ShoveOnly ? ParryBossStaggerSec : ParryStaggerSec);
            RiposteFoe = from;
            RiposteLeft = RiposteSec;
            LastParry = "parry";
            Saga.Go.Audio.GoSfx.Play("sword_hit", 1f, 0.05f);
            FieldDamageText.Spawn(transform.position + Vector3.up * 4f, GoLocalization.T("field.parry", "쳐냄!"), ParryGold, 1.3f);
            FieldRingFx.Spawn(from.transform.position, 3f, ParryGold, 0.35f);
            return true;
        }

        /// <summary>기본 공격 한 타의 반격 배수 — 쳐낸 그 적이고 2초 안이면 ×2 를 한 번 쓴다.</summary>
        private float RiposteFor(FieldEnemy e)
        {
            if (e == null || e != RiposteFoe || RiposteLeft <= 0f) return 1f;
            RiposteFoe = null;
            RiposteLeft = 0f;
            LastRiposte = RiposteMul;
            FieldDamageText.Spawn(e.transform.position + Vector3.up * (e.BodyTop + 2.4f), GoLocalization.T("field.riposte", "반격!"), ParryGold, 1.2f);
            return RiposteMul;
        }

        private void TickParry(float dt)
        {
            if (ParryLeft > 0f) ParryLeft = Mathf.Max(0f, ParryLeft - dt);
            if (ParryCd > 0f) ParryCd = Mathf.Max(0f, ParryCd - dt);
            if (RiposteLeft > 0f) { RiposteLeft -= dt; if (RiposteLeft <= 0f) { RiposteLeft = 0f; RiposteFoe = null; } }
        }

        private void ClearParry()
        {
            ParryLeft = ParryCd = RiposteLeft = 0f;
            RiposteFoe = null;
            LastParry = null;
            LastRiposte = 1f;
        }
    }
}
