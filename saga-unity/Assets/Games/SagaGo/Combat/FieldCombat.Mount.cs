using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>`FieldCombat` 의 일부(partial) — U-0171 말 위 전투(웹 W-0304 · 고돗 G-0306 짝, 엘든 링·붉은사막 구조만).</summary>
    public partial class FieldCombat
    {
        // 지상 탈것에 탄 채 싸운다(나는 탈것은 옛대로 — MountField 가 싸움이 붙으면 내린다).
        // 평타 피해 ×(1 + 0.5 × 빠르기 비율) · E = 돌진(앞 3.5m 적 ×1.6·밀침·비틀 1초, 쿨 6초 — 원소 무예 대신) ·
        // 탄 채 맞으면 낙마(내림·0.8초 못 침). 폭발·회피·조준·잡기·쳐내기는 탄 동안 막는다.
        public const float MountSpeedBonus = 0.5f, RushReach = 3.5f, RushMul = 1.6f, RushKnock = 3f, RushStaggerSec = 1f,
            RushCdSec = 6f, FallLockSec = 0.8f;

        public float RushCd { get; private set; }
        public float FallLeft { get; private set; }
        /// <summary>진단 — 마지막 돌진에 든 적 수(-1 = 못 함).</summary>
        public int LastRush { get; private set; } = -1;

        /// <summary>지상 탈것에 탐(싸움 손이 바뀌는 때).</summary>
        public static bool Mounted => GoMounts.RidingGround && !GoMounts.OffForTest;

        /// <summary>빠르기 비율 0~1 — 지금 빠르기 / (달리기 10 × 탈것 배율).</summary>
        public float MountSpeedRatio()
        {
            if (!Mounted || player == null) return 0f;
            float max = 10f * GoMounts.GroundMul;
            return max > 0f ? Mathf.Clamp01(player.GroundSpeedNow / max) : 0f;
        }

        /// <summary>평타 배율 — 안 탔으면 1.</summary>
        public float MountMul() => Mounted ? 1f + MountSpeedBonus * MountSpeedRatio() : 1f;

        /// <summary>탄 동안 막는 손(폭발·회피·조준·잡기·쳐내기).</summary>
        private static bool MountBlocks() => Mounted;

        private void TickMount(float dt)
        {
            if (RushCd > 0f) RushCd = Mathf.Max(0f, RushCd - dt);
            if (FallLeft > 0f) FallLeft = Mathf.Max(0f, FallLeft - dt);
        }

        /// <summary>E(탄 채) — 앞 3.5m·120° 적에게 평타 ×1.6(빠르기 배율도) · 밀침 · 비틀 1초. 든 적 수(-1 = 쿨·못 침).</summary>
        public int Rush()
        {
            if (!Mounted || !CanAct() || RushCd > 0f || FallLeft > 0f) { LastRush = -1; return -1; }
            RushCd = RushCdSec;
            Vector3 fwd = Forward();
            float atk = Atk;
            float amount = atk * RushMul * MountMul();
            int hits = 0;
            foreach (var e in Snapshot())
            {
                Vector3 d = Flat(e.transform.position - transform.position);
                if (d.magnitude > RushReach) continue;
                if (d.sqrMagnitude > 0.25f && Vector3.Dot(d.normalized, fwd) < 0.5f) continue;
                float cm = CritMul(Active.Id, out bool crit);
                e.TakeHit(amount * cm, GoElement.Physical, atk * ReactMul, out _, heavy: true, crit: crit);
                if (e.Alive) { e.KnockBack(d.sqrMagnitude > 0.01f ? d.normalized : fwd, RushKnock); e.Parried(RushStaggerSec); }
                hits++;
            }
            MarkFought();
            FieldRingFx.Spawn(transform.position + fwd * 1.5f, RushReach, new Color(1f, 0.8f, 0.45f), 0.3f);
            FieldDamageText.Spawn(transform.position + Vector3.up * 4f, GoLocalization.T("mount.charge", "돌진!"), new Color(1f, 0.85f, 0.5f), 1f);
            LastRush = hits;
            return hits;
        }

        /// <summary>`ReceiveStrike` 가 실제로 깎였을 때 — 탄 채면 낙마.</summary>
        private void OnHurtMounted()
        {
            if (!Mounted) return;
            GoMounts.Dismount();
            FallLeft = FallLockSec;
            FieldDamageText.Spawn(transform.position + Vector3.up * 4.6f, GoLocalization.T("mount.fall", "낙마!"), new Color(1f, 0.6f, 0.4f), 1f);
        }

        /// <summary>진단 — 쿨·낙마를 비운다.</summary>
        public void ResetMountForTest() { RushCd = 0f; FallLeft = 0f; LastRush = -1; }
    }
}
