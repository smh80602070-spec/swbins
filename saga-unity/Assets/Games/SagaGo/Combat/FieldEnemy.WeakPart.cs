using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>
    /// `FieldEnemy` 의 일부(partial) — tasks U-0203 보스 약점 부수기(호라이즌 제로 던 부위 파괴 구조만 · 고돗 G-0342 `field_boss.gd` 짝 · 웹 W-0395).
    /// 들판 보스(수호장·만년설 곰왕·주간·이야기 보스·패턴 있는 영역 보스, 인물 빼고)는 몸 높이 0.85 자리에 주황 빛 약점 공. 가득 당긴 화살(`FieldCombat.HitArrow`)이
    /// 그 보스에 넣은 피해만큼 약점 체력(최대 체력 × <see cref="PartFrac"/>)이 깎이고 0 이면 부서짐 — 예고 끊고 <see cref="PartStagger"/>초 비틀,
    /// 그 뒤 이 보스 공격 × <see cref="PartAtkMul"/>, 빛 꺼짐, "약점 파괴!"·고리. 집으로 돌아가거나 되살면 다시 선다(`ResetShields`).
    /// 이 트랙 "급소"는 들키지 않은 적에게만 나서(보스는 늘 싸우는 중) 급소 대신 가득 당긴 화살로 옮겼다.
    /// </summary>
    public partial class FieldEnemy
    {
        public const float PartFrac = 0.12f, PartStagger = 2.5f, PartAtkMul = 0.85f, PartHeight = 0.85f, PartBall = 0.9f;
        public static bool WeakPartOn = true;
        private static readonly Color PartColor = new Color(1f, 0.55f, 0.15f);

        public float PartHp { get; private set; }
        public float PartMax { get; private set; }
        public bool PartBroken { get; private set; }
        /// <summary>진단 — 약점 빛 공(없으면 null).</summary>
        public GameObject PartMark { get; private set; }

        public bool IsFieldBoss => !IsHero && (IsGuardian || FrostKing || IsWeeklyBoss || IsStoryBoss || _rot != null);
        /// <summary>이 보스 공격 배율 — 약점이 부서졌으면 ×0.85.</summary>
        public float PartMul => PartBroken ? PartAtkMul : 1f;

        /// <summary>보스면 빛 공을 세운다(한 번). 끈 상태·잡몹이면 없음.</summary>
        public void EnsurePartMark()
        {
            if (!WeakPartOn || !IsFieldBoss || !Alive) return;
            if (PartMax <= 0f) { PartMax = MaxHp * PartFrac; PartHp = PartMax; }
            if (PartMark == null)
            {
                PartMark = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                PartMark.name = "WeakPart";
                Object.Destroy(PartMark.GetComponent<Collider>());
                PartMark.transform.SetParent(transform, false);
                var r = PartMark.GetComponent<Renderer>();
                r.sharedMaterial = PartMaterial();
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            PartMark.transform.localPosition = new Vector3(0f, BodyTop * PartHeight / Mathf.Max(0.01f, transform.lossyScale.y), 0f);
            PartMark.transform.localScale = Vector3.one * PartBall / Mathf.Max(0.01f, transform.lossyScale.y);
            PartMark.SetActive(!PartBroken);
        }

        /// <summary>가득 당긴 화살 피해 — 약점 체력을 깎고, 부서지면 true.</summary>
        public bool PartHit(float dmg)
        {
            if (!WeakPartOn || !IsFieldBoss || !Alive || PartBroken || dmg <= 0f) return false;
            EnsurePartMark();
            PartHp = Mathf.Max(0f, PartHp - dmg);
            if (PartHp > 0f) return false;
            PartBroken = true;
            if (PartMark != null) PartMark.SetActive(false);
            Parried(PartStagger); // 예고 끊고 비틀(쳐내기와 같은 길)
            FieldDamageText.Spawn(transform.position + Vector3.up * (BodyTop + 2.6f), GoLocalization.T("field.weakpart", "약점 파괴!"), PartColor, 1.5f);
            FieldRingFx.Spawn(transform.position, 4f, PartColor, 0.4f);
            Saga.Go.Audio.GoSfx.Play("sword_hit", 0.8f, 0.05f);
            return true;
        }

        /// <summary>`ResetShields`(되살기·귀가) — 약점이 다시 선다.</summary>
        private void ResetPart()
        {
            PartBroken = false;
            PartMax = MaxHp * PartFrac;
            PartHp = PartMax;
            if (PartMark != null) PartMark.SetActive(WeakPartOn && IsFieldBoss);
        }

        private static Material _partMat;
        private static Material PartMaterial()
        {
            if (_partMat == null) _partMat = new Material(Shader.Find("Sprites/Default")) { name = "WeakPart (generated)", color = PartColor };
            return _partMat;
        }
    }
}
