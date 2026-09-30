using System;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-8 동행 서명 — 동행 뿌리에 하나(무사·술사가 Awake 에서 붙인다). 웹 `stepAllySig` + `castAllySig`:
    /// 재사용이 돌았고 축복 3택이 안 떠 있고 동행이 일어서 있으면, 제 자리 5m 안 적을 세어 <see cref="AllySigState.Wants"/> 면
    /// 파동 하나 — 반경 안 모두 제 평타 × v(합격 ×1.5)·두목급 아니면 밀침·술사는 얼림. 합격이면 알림 한 줄, 몸짓 ✨ 서명 / ⚡ 합격.
    /// </summary>
    public class AllySigCaster : MonoBehaviour
    {
        private PartyRole _role;
        private Func<bool> _canAct;
        private Func<float> _baseDamage;
        private Action _playAnim;
        private float _cd = AllySigState.FirstSec;
        private static BlessingChoiceUi _choice;

        public PartyRole Role => _role;
        public AllySigState.Sig Sig => AllySigState.Of(_role);
        public float CooldownLeft => _cd;
        /// <summary>진단 — 쓴 수·마지막에 맞힌 수·마지막 한 대 피해·마지막이 합격이었나.</summary>
        public int Casts { get; private set; }
        public int LastHits { get; private set; }
        public float LastDamage { get; private set; }
        public bool LastCombo { get; private set; }

        /// <summary>몸짓 키 — 동행 둘이 같이 읽는 <see cref="GestureState.AllyKey"/> 와 따로(서명은 쓴 쪽만).</summary>
        public static string GestureKeyOf(PartyRole role) => role == PartyRole.Mystic ? GestureState.MysticKey : GestureState.GuardKey;

        public static AllySigCaster Attach(GameObject root, PartyRole role, Func<bool> canAct, Func<float> baseDamage, Action playAnim)
        {
            var c = root.GetComponent<AllySigCaster>();
            if (c == null) c = root.AddComponent<AllySigCaster>();
            c._role = role;
            c._canAct = canAct;
            c._baseDamage = baseDamage;
            c._playAnim = playAnim;
            return c;
        }

        /// <summary>진단 — 재사용을 정한 값으로.</summary>
        public void SetCooldownForTest(float seconds) => _cd = seconds;

        private void Update()
        {
            if (DungeonCutscenes.Playing) return;
            Tick(Time.deltaTime, AllySigState.Now);
        }

        private static bool ChoiceOpen()
        {
            if (_choice == null) _choice = FindFirstObjectByType<BlessingChoiceUi>();
            return _choice != null && _choice.IsShowing;
        }

        /// <summary>한 프레임 — 진단이 시간을 넣어 부른다. 썼으면 true.</summary>
        public bool Tick(float dt, float now)
        {
            _cd -= dt;
            if (_cd > 0f || ChoiceOpen() || (_canAct != null && !_canAct())) return false;
            bool combo = AllySigState.ComboOpen(now);
            Count(out int n, out bool strong);
            if (!AllySigState.Wants(n, strong, combo)) return false;
            Cast(combo, now);
            return true;
        }

        /// <summary>제 자리 반경 안 산 적 수와 그중 정예·두목급이 있나.</summary>
        public void Count(out int n, out bool strong)
        {
            n = 0;
            strong = false;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || !e.IsAlive || Flat(e.transform.position) > AllySigState.Radius) continue;
                n++;
                if (e.IsElite || e.IsBoss || e.IsWorldBoss) strong = true;
            }
        }

        private float Flat(Vector3 p)
        {
            Vector3 d = p - transform.position;
            d.y = 0f;
            return d.magnitude;
        }

        private void Cast(bool combo, float now)
        {
            var sig = Sig;
            _cd = AllySigState.CooldownOf(sig);
            float dmg = (_baseDamage != null ? _baseDamage() : 4f) * sig.V * (combo ? AllySigState.ComboMul : 1f);
            int hits = 0;
            Vector3 c = transform.position;
            // 목록을 베껴 돈다 — 쓰러지는 적이 Active 에서 빠진다.
            foreach (var e in DungeonEnemy.Active.ToArray())
            {
                if (e == null || !e.IsAlive || Flat(e.transform.position) > AllySigState.Radius) continue;
                e.TakeDamage(dmg, heavy: true);
                hits++;
                if (!e.IsAlive) continue;
                if (sig.ChillSec > 0f) e.Chill(sig.ChillSec);
                if (!e.IsBoss && !e.IsWorldBoss && sig.Knockback > 0f)
                {
                    Vector3 d = e.transform.position - c;
                    d.y = 0f;
                    if (d.sqrMagnitude < 0.0001f) d = transform.forward;
                    e.transform.position += d.normalized * Mathf.Min(sig.Knockback, AllySigState.KnockbackMax);
                }
            }
            Casts++;
            LastHits = hits;
            LastDamage = dmg;
            LastCombo = combo;
            AllySigState.OnCast(combo);
            _playAnim?.Invoke();
            SigPulse.Spawn(c, AllySigState.Radius, sig.Color);
            HitSpark.Spawn(c + Vector3.up * 0.6f, heavy: true);
            SfxPlayer.PlayHeavyHit();
            GestureState.OnAllySig(GestureKeyOf(_role), combo, now);
            if (combo)
            {
                string who = _role == PartyRole.Mystic ? DungeonLocalization.T("party.hud_mystic", "술사") : DungeonLocalization.T("party.hud_guard", "무사");
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("allysig.combo", "⚡ 합격! {0} · {1} {2}"),
                    who, sig.Emoji, AllySigState.Name(sig)), 2.5f);
            }
        }
    }
}
