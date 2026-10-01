using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>`FieldEnemy` 의 일부(partial) — tasks U-0010 분할.</summary>
    public partial class FieldEnemy
    {
        /// <summary>플레이어 공격 한 번. 반응을 풀고 실제로 들어간 피해를 돌려준다.
        /// <paramref name="atk"/> 는 반응 피해를 셀 공격력. <paramref name="heavy"/> = 기본 공격 3타째(얼어붙은 적을 깨뜨린다, 109-14-1a).</summary>
        public float TakeHit(float amount, GoElement element, float atk, out GoReaction reaction, bool heavy = false, bool crit = false)
        {
            reaction = GoReaction.None;
            if (!Alive) return 0f;
            FieldCombat.Instance?.MarkFought(); // 109-14-18 방금 싸움(편성 막기)
            if (MarkLeft > 0f) amount *= MarkMul; // 109-14-15 그림자 걸음 표식 — 누구에게든 받는 피해
            if (Shielded) return HitShield(amount, element);

            GoElement from = GoElement.Physical; // 반응 전에 붙어 있던 원소(회오리가 옮겨 붙인다)
            if (element == GoElement.Physical && SuperLeft > 0f) amount *= GoElements.SuperPhysMul; // 서리번개 뒤 물리
            if (Frozen && (element == GoElement.Geo || heavy))
            {
                // 깨뜨림 — 얼어 멈춘 적을 암이나 3타째로 치면 크게 들어가고 풀린다
                reaction = GoReaction.Shatter;
                amount *= GoElements.ShatterMul;
                FrozenLeft = 0f;
                TintVisual(Color.white, false);
            }
            else if (QuickenLeft > 0f && (element == GoElement.Electro || element == GoElement.Dendro))
            {
                // 싹틈 상태 — 뇌는 번개싹, 초는 덩굴뻗음(붙은 원소는 안 건드린다)
                reaction = element == GoElement.Electro ? GoReaction.Aggravate : GoReaction.Spread;
                amount *= GoElements.QuickenMul;
            }
            else if (element != GoElement.Physical)
            {
                reaction = AuraLeft > 0f ? GoElements.Resolve(Aura, element) : GoReaction.None;
                if (reaction == GoReaction.None)
                {
                    if (GoElements.Attaches(element))
                    {
                        Aura = element;
                        AuraLeft = GoElements.AuraSec;
                    }
                }
                else
                {
                    from = Aura;
                    Aura = GoElement.Physical;
                    AuraLeft = 0f;
                }
            }

            // 109-14-5b 보패 4 세트 — 대장간 불씨(물안개·녹임·터짐·들불)·솔바람 피리(회오리)
            float setRx = reaction != GoReaction.None && FieldCombat.Instance != null ? FieldCombat.Instance.SetReactMul(reaction) : 1f;
            if (reaction == GoReaction.Vaporize) amount *= GoElements.VaporizeMul * setRx;
            if (reaction == GoReaction.Melt) amount *= GoElements.MeltMul * setRx;

            if (reaction != GoReaction.None)
            {
                DailyTaskState.ReportProgress(DailyTaskState.Kind.Reaction, 1); // 109-14-8 일일 의뢰 — 원소 반응
                AchieveState.Reaction(reaction); // 109-14-25 업적 — 반응 수·가짓수
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 1.8f),
                    GoElements.NameOf(reaction), GoElements.ColorOf(reaction), 1.3f);
            }

            // 109-14-5a 치명타는 굵고 크게(금빛)
            float dealt = ApplyDamage(amount, crit ? new Color(1f, 0.82f, 0.3f) : element == GoElement.Physical ? Color.white : GoElements.ColorOf(element), crit ? 1.45f : 1f);

            if (reaction == GoReaction.Overload)
            {
                // 과부하 — 둘레 적 전부(자기 포함 이미 맞은 몫과 별도로 광역 몫)·밀침.
                float blast = atk * GoElements.OverloadAtkMul * setRx;
                foreach (var other in _all.ToArray())
                {
                    if (!other.Alive) continue;
                    Vector3 d = Flat(other.transform.position - transform.position);
                    if (d.magnitude > GoElements.OverloadRadius) continue;
                    other.ApplyDamage(blast, GoElements.ColorOf(GoReaction.Overload), 1f);
                    if (other.Alive) other._knock = (d.sqrMagnitude > 0.01f ? d.normalized : -transform.forward) * GoElements.OverloadKnockback;
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.ElectroCharged)
            {
                if (Alive) StartCharged(atk); // 죽였으면 감전을 다시 세우지 않는다(tasks U-0015)
                foreach (var other in _all)
                {
                    if (other == this || !other.Alive || other.Aura != GoElement.Hydro || other.AuraLeft <= 0f) continue;
                    if (Flat(other.transform.position - transform.position).magnitude > GoElements.ChargedSpreadRadius) continue;
                    other.Aura = GoElement.Physical;
                    other.AuraLeft = 0f;
                    other.StartCharged(atk);
                }
            }
            else if (reaction == GoReaction.Frozen)
            {
                if (Alive) Freeze();
            }
            else if (reaction == GoReaction.Superconduct)
            {
                // 서리번개 — 둘레 적(자기 포함) 광역 ×0.5 + 8초 동안 물리 ×1.4
                foreach (var other in _all.ToArray())
                {
                    if (!other.Alive || Flat(other.transform.position - transform.position).magnitude > GoElements.SuperRadius) continue;
                    other.SuperLeft = GoElements.SuperSec;
                    other.ApplyDamage(atk * GoElements.SuperAtkMul, GoElements.ColorOf(GoReaction.Superconduct), 1f);
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.Swirl)
            {
                // 회오리 — 둘레 다른 적에게 그 원소를 옮겨 붙이고 ×0.6
                foreach (var other in _all.ToArray())
                {
                    if (other == this || !other.Alive) continue;
                    if (Flat(other.transform.position - transform.position).magnitude > GoElements.SwirlRadius) continue;
                    if (!other.Shielded && (other.AuraLeft <= 0f || other.Aura == from))
                    {
                        other.Aura = from;
                        other.AuraLeft = GoElements.AuraSec;
                    }
                    other.ApplyDamage(atk * GoElements.SwirlAtkMul * setRx, GoElements.ColorOf(from), 1f);
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.Crystallize)
            {
                FieldCombat.Instance?.AddCrystalGuard();
            }
            else if (reaction == GoReaction.Bloom)
            {
                FieldCombat.Instance?.AddBloomSeed(transform.position, atk * GoElements.BloomAtkMul);
            }
            else if (reaction == GoReaction.Burning && Alive) // 죽였으면 불붙음을 다시 세우지 않는다(tasks U-0015)
            {
                BurningLeft = GoElements.BurningTicks;
                _burningTick = GoElements.BurningTickSec;
                _burningDmg = atk * GoElements.BurningAtkMul * setRx;
            }
            else if (reaction == GoReaction.Quicken && Alive)
            {
                QuickenLeft = GoElements.QuickenSec;
            }

            Aggro();
            return dealt;
        }

        /// <summary>얼어붙음 — 2.5초 제자리에 멎고, 예고하던 수도 끊긴다.</summary>
        private void Freeze()
        {
            FrozenLeft = GoElements.FrozenSec;
            if (CurrentState == State.Telegraph)
            {
                CurrentState = State.Chase;
                _warnRing.enabled = false;
                _alertText.gameObject.SetActive(false); // tasks U-0015
                _siegeStrike = false;
            }
            TintVisual(GoElements.ColorOf(GoElement.Cryo), true);
        }

        /// <summary>원소 없는 날 피해(꽃피움 씨앗 터짐 등) — 반응·부착 없이.</summary>
        public float TakeRaw(float amount, Color color)
        {
            if (!Alive) return 0f;
            Aggro();
            return ApplyDamage(amount, color, 1f);
        }

        /// <summary>부활·귀가 때 남아 있으면 안 되는 상태 — 반응(불붙음·가속·얼음·초전도)·감전·밀림·공성 일격 표시(tasks U-0015).</summary>
        private void ClearLingeringState()
        {
            ClearReactionStates();
            _chargedLeft = 0f;
            _knock = Vector3.zero;
            _siegeStrike = false;
        }

        private void ClearReactionStates()
        {
            if (FrozenLeft > 0f) TintVisual(Color.white, false);
            FrozenLeft = 0f;
            SuperLeft = 0f;
            QuickenLeft = 0f;
            BurningLeft = 0;
        }

        /// <summary>원소 방패에 한 번 — 체력은 안 깎이고 반응·부착도 없다. 방패에 들어간 양을 돌려준다.</summary>
        private float HitShield(float amount, GoElement element)
        {
            float mul = GoElements.ShieldMul(Element, element);
            Vector3 textPos = transform.position + Vector3.up * (BodyHeight + 0.8f);
            Aggro();
            if (mul <= 0f)
            {
                FieldDamageText.Spawn(textPos, GoLocalization.T("field.immune", "면역"), new Color(0.7f, 0.7f, 0.72f), 1f);
                return 0f;
            }
            float dmg = amount * mul;
            float dealt = Mathf.Min(ShieldHp, dmg);
            ShieldHp -= dmg;
            FieldDamageText.Spawn(textPos, Mathf.RoundToInt(dmg).ToString(), GoElements.ColorOf(Element), mul > 1f ? 1.25f : 0.85f);
            if (mul > 1f)
                FieldDamageText.Spawn(textPos + Vector3.up * 1f, GoLocalization.T("field.counter", "상성!"), GoElements.ColorOf(element), 1.1f);
            if (ShieldHp <= 0f) BreakShield();
            RefreshHeadUi();
            return dealt;
        }

        /// <summary>방패가 깨짐 — 하던 예고를 끊고 2초 비틀거린다. 그 뒤로는 보통 적(부착·반응 받음).
        /// 수호장은 겉이 깨지면 0.8초 휘청한 뒤 속 방패(다른 원소)가 차오르고, 속이 깨지면 3초 드러눕는다.</summary>
        private void BreakShield()
        {
            if (TwoLayered && ShieldLayers >= 2)
            {
                ShieldLayers = 1;
                Element = InnerElement;
                ShieldHp = ShieldMax;
                _alertText.gameObject.SetActive(false);
                _warnRing.enabled = false;
                CurrentState = State.Stagger;
                _timer = GuardianOuterStaggerSec;
                if (_animator != null) Trig("Hit");
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyTop + 2f),
                    GoLocalization.T("field.guard_outer_break", "겉 방패 깨짐!"), GoElements.ColorOf(OuterElement), 1.4f);
                FieldRingFx.Spawn(transform.position, 6f, GoElements.ColorOf(OuterElement), 0.5f);
                string hint = string.Format(GoLocalization.T("field.guard_inner", "속 방패 {0} — {1} 원소 동료로 바꿔라"),
                    GoElements.NameOf(InnerElement), GoElements.NameOf(CounterOf(InnerElement)));
                Saga.Go.UI.DialogueLabel.Instance?.Show(hint, 3.5f);
                ApplyElementColors();
                RefreshElementFx();
                RefreshHeadUi();
                return;
            }
            ShieldHp = 0f;
            ShieldLayers = 0;
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            CurrentState = State.Stagger;
            _timer = IsGuardian ? GuardianDownSec : GoElements.ShieldBreakStaggerSec;
            if (_animator != null) Trig("Hit");
            FieldDamageText.Spawn(transform.position + Vector3.up * (BodyTop + 2f),
                IsGuardian ? GoLocalization.T("field.guard_down", "속 방패 깨짐! — 드러누웠다") : GoLocalization.T("field.shield_break", "방패 깨짐!"),
                GoElements.ColorOf(Element), 1.4f);
            FieldRingFx.Spawn(transform.position, 4f, GoElements.ColorOf(Element), 0.5f);
            RefreshElementFx();
        }

        /// <summary>방패를 처음 모양으로(수호장은 겉 겹부터 다시).</summary>
        private void ResetShields()
        {
            ShieldHp = ShieldMax;
            if (TwoLayered)
            {
                ShieldLayers = 2;
                Element = OuterElement;
                ApplyElementColors();
            }
            else
            {
                ShieldLayers = ShieldMax > 0f ? 1 : 0;
            }
            RefreshElementFx();
        }

        /// <summary>수호장 겹이 바뀌면 방패 거품·구슬·빛·방패 막대·이름·몸 빛깔을 그 원소로.</summary>
        private void ApplyElementColors()
        {
            Color c = GoElements.ColorOf(Element);
            if (_bubbleMat != null) _bubbleMat.color = new Color(c.r, c.g, c.b, 0.22f);
            if (_orbMat != null)
            {
                _orbMat.color = c;
                _orbMat.SetColor("_EmissionColor", c * 2.5f);
            }
            if (_elementLight != null) _elementLight.color = c;
            if (_shieldFillRenderer != null)
            {
                var block = new MaterialPropertyBlock();
                block.SetColor("_Color", c);
                _shieldFillRenderer.SetPropertyBlock(block);
            }
            if (_nameText != null) _nameText.color = Color.Lerp(Color.white, c, 0.6f);
            if (_visual != null && !_tinted && BaseTint(out Color baseTint)) CharacterVisual.Tint(_visual.gameObject, baseTint);
        }

        /// <summary>그 원소를 누르는 원소(수 → 화 · 뇌 → 수 · 화 → 뇌).</summary>
        private static GoElement CounterOf(GoElement e)
        {
            return GoElements.CounterOf(e); // 109-14-1a 일곱
        }
    }
}
