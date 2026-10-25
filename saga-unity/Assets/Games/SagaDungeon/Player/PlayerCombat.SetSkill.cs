using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// tasks U-0245 세트 무예(웹 data-set.js `skill`, 고돗 G-0398 짝) — 한 벌 세 점을 다 걸치면(<see cref="Gear.Sum.FullSet"/>) C 로 쓰는 넷째 무예.
    /// 웹 모양 여덟을 이 트랙 동작으로: nova·swing = 둘레 모두 · dash = 앞 부채꼴 · bolt = 가까운 적 N · curse = 둘레 한기+피해 ·
    /// heal = 최대 체력 % · buff = 몇 초 막기 % · summon = 몇 초 동안 1초마다 가까운 적을 친다(학의 진 대역 — 동행 몸은 안 세움).
    /// 웹 반경(px)은 ÷34 로 m(고돗 G-0398 과 같은 환산). 피해 = HitDamage × v.
    /// </summary>
    public partial class PlayerCombat
    {
        public const float PxPerM = 34f, SummonTickSec = 1f, SummonRangeM = 7f, BoltRangeM = 10f, DashLenPerFar = 2f, DashHalfDeg = 40f, SwingRPerUnit = 1.4f;

        private float _setSkillCdLeft;
        public float SetSkillCooldownLeft => _setSkillCdLeft;
        /// <summary>HUD — 세트 무예를 다시 쓸 수 있는 시각(Time.time).</summary>
        public static float SetSkillReadyAt { get; private set; }
        /// <summary>진단 — 마지막 세트 무예에 맞은 적 수(heal·buff 는 0).</summary>
        public int LastSetSkillHits { get; private set; }

        /// <summary>폰 단추·진단이 부른다.</summary>
        public bool TriggerSetSkill() => TrySetSkill();

        private bool TrySetSkill()
        {
            var set = Gear.Totals.FullSet;
            if (set == null || set.Skill == null)
            {
                DialogueLabel.Instance?.Show(DungeonLocalization.T("gear.setskill_none", "세트 무예가 없다 — 한 벌 세 점을 다 걸쳐야 한다"), 2f);
                return false;
            }
            if (_setSkillCdLeft > 0f || DungeonCutscenes.Playing || Climbing) return false;
            var k = set.Skill;
            float hit = HeroState.HitDamage * Mathf.Max(0.1f, k.V);
            var hits = new List<DungeonEnemy>();
            Vector3 p = transform.position;
            switch (k.Shape)
            {
                case "nova":
                case "curse":
                    Around(p, Mathf.Max(1f, k.R / PxPerM), hits);
                    break;
                case "swing":
                    Around(p, Mathf.Max(1f, k.R * SwingRPerUnit), hits);
                    break;
                case "dash":
                {
                    var target = Nearest(p, Mathf.Max(2f, k.Far * DashLenPerFar));
                    Vector3 fwd = target != null ? target.transform.position - p : transform.forward;
                    foreach (var e in DungeonEnemy.Active)
                        if (e != null && e.IsAlive && DungeonHunt.InCone(p, fwd, e.transform.position, Mathf.Max(2f, k.Far * DashLenPerFar), DashHalfDeg)) hits.Add(e);
                    break;
                }
                case "bolt":
                {
                    Around(p, BoltRangeM, hits);
                    hits.Sort((a, b) => Vector3.Distance(p, a.transform.position).CompareTo(Vector3.Distance(p, b.transform.position)));
                    int n = Mathf.Max(1, k.Shots);
                    if (hits.Count > n) hits.RemoveRange(n, hits.Count - n);
                    break;
                }
                case "heal":
                    HeroState.HealBy(Mathf.Max(1, Mathf.RoundToInt(HeroState.HpMax * k.V / 100f)));
                    break;
                case "buff":
                    Gear.Buff(k.Eff, k.V, k.Sec);
                    break;
                case "summon":
                    StartCoroutine(SummonTicks(Mathf.Max(1f, k.Sec), HeroState.HitDamage * Mathf.Max(1f, k.V) * 0.5f));
                    break;
            }
            foreach (var e in hits)
            {
                Strike(e, hit, true, SecretMove.Whirl);
                if (k.Shape == "curse" && e.IsAlive) e.Chill(Mathf.Max(1f, k.Sec));
            }
            LastSetSkillHits = hits.Count;
            _setSkillCdLeft = Mathf.Max(1f, k.Cd);
            SetSkillReadyAt = Time.time + _setSkillCdLeft;
            _cooldownLeft = Mathf.Max(_cooldownLeft, WhirlRecoverSec);
            if (hits.Count > 0) { _cameraRig?.Shake(WhirlShakeMag, WhirlShakeSec); SfxPlayer.PlayHit(); }
            _controller?.Animator?.SetTrigger("Attack");
            DialogueLabel.Instance?.Show($"{k.Emoji} {k.Name}", 1.4f);
            return true;
        }

        private static void Around(Vector3 p, float radius, List<DungeonEnemy> into)
        {
            foreach (var e in DungeonEnemy.Active)
                if (e != null && e.IsAlive && Vector3.Distance(p, e.transform.position) <= radius) into.Add(e);
        }

        private static DungeonEnemy Nearest(Vector3 p, float range)
        {
            DungeonEnemy best = null; float bd = range;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || !e.IsAlive) continue;
                float d = Vector3.Distance(p, e.transform.position);
                if (d <= bd) { bd = d; best = e; }
            }
            return best;
        }

        private IEnumerator SummonTicks(float sec, float damage)
        {
            for (float t = 0f; t < sec; t += SummonTickSec)
            {
                yield return new WaitForSeconds(SummonTickSec);
                var e = Nearest(transform.position, SummonRangeM);
                if (e != null) Strike(e, damage, false, SecretMove.Whirl);
            }
        }
    }
}
