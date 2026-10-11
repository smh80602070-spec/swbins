using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-9 명소 층 주인 고유 수 — 주인 하나에 하나(`DungeonFloorRunner.SpawnLord` 가 만들어 <see cref="DungeonEnemy.SetLordSig"/>).
    /// 웹 `stepGuardSig`·`beginGuardSig`·`resolveGuardSig` 그대로: 첫 3초 → 예고(원 테두리, 제 크기) → 터짐(원 안이면 주인 공격력 × mul) → 재사용.
    /// 예고·시전하는 동안(<see cref="Tick"/> 이 true)은 주인이 강타를 쉰다. 주인 강타 예비동작 중엔 새로 시작하지 않는다(웹 무기 패턴과 안 겹침).
    /// 삼연돌은 주인이 원 가운데로 뛰어들고 세 번까지 · 소용돌이는 예고 동안 나를 끌어당긴다(구르는 중이면 안) · 장판은 터진 자리에 불바닥이 남아
    /// 0.5초마다 × 0.2(넷까지) · 호령은 체력 문턱마다 졸개 둘(층 진행기 잡졸 — 방 치움 셈에 든다). 구르기 무적이면 안 맞는다. 첫 시전만 알림.
    /// 주인이 쓰러지면 <see cref="Clear"/>(예고 원·불바닥 지움).
    /// </summary>
    public class LordSigRunner
    {
        private struct Pool { public Vector3 C; public float R, T; public LordZoneFx Fx; }

        private readonly DungeonEnemy _lord;
        private readonly DungeonLordSigs.Sig _sig;
        private readonly Func<Vector3, DungeonEnemy> _spawnAdd;
        private float _cd = DungeonLordSigs.FirstSec;
        private float _warn;
        private int _step, _left, _phase;
        private List<DungeonLordSigs.Zone> _zones;
        private readonly List<Pool> _pools = new List<Pool>();
        private readonly List<LordZoneFx> _warnFx = new List<LordZoneFx>();
        private float _poolT;
        private bool _said;

        public DungeonLordSigs.Sig Sig => _sig;
        public bool Busy => _warn > 0f;
        public float CooldownLeft => _cd;
        public int Casts => _step;
        public int Phase => _phase;
        public int PoolCount => _pools.Count;
        public int WarnRings => _warnFx.Count;
        public IReadOnlyList<DungeonLordSigs.Zone> Zones => _zones;
        /// <summary>진단 — 나를 맞힌 수·마지막 판정이 맞았나·불러낸 졸개 수·끝 알림.</summary>
        public int PlayerHits { get; private set; }
        public int Adds { get; private set; }
        public string LastToast { get; private set; } = "";
        public int Toasts { get; private set; }

        public LordSigRunner(DungeonEnemy lord, DungeonLordSigs.Sig sig, Func<Vector3, DungeonEnemy> spawnAdd)
        {
            _lord = lord;
            _sig = sig;
            _spawnAdd = spawnAdd;
        }

        /// <summary>한 틱(주인 `Tick` 이 부른다). true 면 지금 예고·시전 중 — 강타를 쉰다.</summary>
        public bool Tick(float dt, bool allowBegin, Transform player)
        {
            if (!DungeonLordSigs.Enabled || _lord == null || player == null) return false;
            Vector3 p = player.position;
            TickPools(dt, p);
            if (_sig.Kind == DungeonLordSigs.Kind.Summon)
            {
                TickSummon();
                return false;
            }
            if (_warn > 0f)
            {
                _warn -= dt;
                if (_sig.Kind == DungeonLordSigs.Kind.Vortex) Pull(player, dt);
                if (_warn <= 0f) Resolve(player);
                return true;
            }
            _cd -= dt;
            if (_cd <= 0f && allowBegin)
            {
                if (_sig.Kind == DungeonLordSigs.Kind.Hops) _left = Mathf.Max(1, _sig.Hops);
                Begin(p);
                return true;
            }
            return false;
        }

        private void TickPools(float dt, Vector3 p)
        {
            if (_pools.Count == 0) return;
            for (int i = _pools.Count - 1; i >= 0; i--)
            {
                var pl = _pools[i];
                pl.T -= dt;
                if (pl.T <= 0f) { _pools.RemoveAt(i); continue; }
                _pools[i] = pl;
            }
            _poolT -= dt;
            if (_poolT > 0f) return;
            _poolT = DungeonLordSigs.PoolTickSec;
            var zs = new List<DungeonLordSigs.Zone>();
            foreach (var pl in _pools) zs.Add(new DungeonLordSigs.Zone { C = pl.C, R = pl.R });
            if (DungeonLordSigs.InZones(zs, p)) Hurt(_lord.Damage * _sig.PoolMul);
        }

        private void TickSummon()
        {
            var at = _sig.At;
            if (at == null || _phase >= at.Length || _lord.MaxHp <= 0f) return;
            if (_lord.CurrentHp / _lord.MaxHp > at[_phase]) return;
            _phase++;
            Vector3 c = _lord.transform.position;
            for (int i = 0; i < Mathf.Max(1, _sig.N); i++)
            {
                // 웹: 주인 x − 30, y ± (40 + 20 × ⌊i/2⌋)
                float side = (i % 2 == 1 ? 1f : -1f) * (40f + 20f * (i / 2)) / DungeonLordSigs.PxPerMeter;
                var e = _spawnAdd?.Invoke(c + _lord.transform.right * side - _lord.transform.forward * (30f / DungeonLordSigs.PxPerMeter));
                if (e != null) Adds++;
            }
            LordZoneFx.Spawn(c, 60f / DungeonLordSigs.PxPerMeter, _sig.Color, 0.5f, pool: false);
            Toast($"{DungeonLordSigs.Name(_sig)} — {DungeonLordSigs.Line(_sig)}");
        }

        private void Begin(Vector3 p)
        {
            _zones = DungeonLordSigs.Zones(_sig, _lord.transform.position, p, _step);
            _step++;
            _warn = _sig.Warn;
            ClearWarnFx();
            foreach (var z in _zones) _warnFx.Add(LordZoneFx.Spawn(z.C, z.R, _sig.Color, _sig.Warn, pool: false));
            _lord.PlayRoar();
            if (!_said)
            {
                _said = true;
                Toast($"{_lord.DisplayName} — {DungeonLordSigs.Name(_sig)}");
            }
        }

        private void Resolve(Transform player)
        {
            var zs = _zones ?? new List<DungeonLordSigs.Zone>();
            int sparks = 0;
            foreach (var z in zs) if (sparks++ < 20) HitSpark.Spawn(z.C + Vector3.up * 0.3f, heavy: true);
            if (_sig.Kind == DungeonLordSigs.Kind.Hops && zs.Count > 0)
            {
                var lp = _lord.transform.position;
                _lord.transform.position = new Vector3(zs[0].C.x, lp.y, zs[0].C.z);
            }
            if (_sig.Kind == DungeonLordSigs.Kind.Pool && zs.Count > 0)
            {
                _pools.Add(new Pool { C = zs[0].C, R = zs[0].R, T = _sig.Last, Fx = LordZoneFx.Spawn(zs[0].C, zs[0].R, _sig.Color, _sig.Last, pool: true) });
                while (_pools.Count > Mathf.Max(1, _sig.MaxPools))
                {
                    if (_pools[0].Fx != null) UnityEngine.Object.Destroy(_pools[0].Fx.gameObject);
                    _pools.RemoveAt(0);
                }
            }
            _zones = null;
            ClearWarnFx();
            if (DungeonLordSigs.InZones(zs, player.position)) Hurt(_lord.Damage * _sig.Mul);
            if (_sig.Kind == DungeonLordSigs.Kind.Hops && --_left > 0)
            {
                Begin(player.position);
                return;
            }
            _left = 0;
            _cd = _sig.Cd;
        }

        /// <summary>소용돌이 — 예고 동안 주인 쪽으로 끈다(벽은 CharacterController 가 막는다). 구르는 중이면 안 끈다.</summary>
        private void Pull(Transform player, float dt)
        {
            var pc = player.GetComponent<PlayerController>();
            if (pc != null && pc.IsDodging) return;
            Vector3 d = _lord.transform.position - player.position;
            d.y = 0f;
            float dist = d.magnitude;
            if (dist <= DungeonLordSigs.VortexStop) return;
            Vector3 mv = d / dist * Mathf.Min(dist - DungeonLordSigs.VortexStop, _sig.Pull * dt);
            var cc = player.GetComponent<CharacterController>();
            if (cc != null && cc.enabled) cc.Move(mv);
            else player.position += mv;
        }

        private void Hurt(float amount)
        {
            if (HeroState.Invulnerable) return; // 구르기 무적 — 원 판정도 비킨다
            HeroState.TakeDamage(amount, _lord != null ? _lord.DisplayName : null, _sig.NameKo);   // tasks U-0092 — 층 주인 이름·고유 기술 이름
            PlayerHits++;
        }

        private void Toast(string text)
        {
            LastToast = text;
            Toasts++;
            DialogueLabel.Instance?.Show(text, 2.5f);
        }

        private void ClearWarnFx()
        {
            foreach (var f in _warnFx) if (f != null) UnityEngine.Object.Destroy(f.gameObject);
            _warnFx.Clear();
        }

        /// <summary>주인이 쓰러졌다 — 예고 원·불바닥을 지운다.</summary>
        public void Clear()
        {
            ClearWarnFx();
            foreach (var pl in _pools) if (pl.Fx != null) UnityEngine.Object.Destroy(pl.Fx.gameObject);
            _pools.Clear();
            _warn = 0f;
            _zones = null;
        }

        /// <summary>진단 — 재사용을 정한 값으로.</summary>
        public void SetCooldownForTest(float seconds) => _cd = seconds;
    }
}
