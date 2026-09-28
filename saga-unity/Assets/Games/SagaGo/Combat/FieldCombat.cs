using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 107-1 "들판 전투" — 플레이어에 붙는다. 무대 전환 없이 지도 위에서 기본 공격 3타(J)·
    /// 원소 스킬(E)·원소 폭발(Q)·회피(L·왼쪽 Ctrl)·동료 교체(1~4). 명단은 주인공 + 등용한 동료 앞 셋,
    /// 체력·스킬 쿨·기력은 인물마다 따로. 옛 사건 결투 중(`DuelGate.Active`)엔 입력을 안 받는다.
    /// </summary>
    public class FieldCombat : MonoBehaviour
    {
        public const string HeroId = "hero";
        public const int MaxParty = 4;

        public static readonly float[] ComboMul = { 0.8f, 0.9f, 1.3f };
        public const float ComboWindowSec = 0.9f;
        public const float AttackIntervalSec = 0.33f;
        public const float AttackReach = 4.2f;
        public const float AutoFaceRadius = 6.5f;
        public const float SkillOffset = 2f;
        public const float SkillRadius = 7f;
        public const float SkillMul = 1.8f;
        public const float SkillCooldownSec = 6f;
        public const float BurstRadius = 12f;
        public const float BurstMul = 4f;
        public const float BurstCost = 100f;
        public const float EnergyPerHit = 2f;
        public const float EnergyPerSkillHit = 15f;
        public const float DodgeStamina = 15f;
        public const float DodgeInvulnSec = 0.3f;
        public const float DodgeDistance = 5f;
        public const float DodgeSec = 0.2f;
        public const float SwapCooldownSec = 1f;
        public const float RegenDelaySec = 8f;
        public const float RegenPerSec = 0.04f; // 최대 체력 비율
        // PLAN.md 109-14-2 강공격·낙하 공격(웹 사가고 ⑲-2 · Godot 106 ⑧ 칸, 거리 × 1.85)
        public const float ChargeHoldSec = 0.4f;
        public const float ChargeStamina = 20f;
        public const float ChargeReach = 5.9f;       // 3.2m
        public const float ChargeFrontDot = -0.2f;   // 앞 넓게(옆까지)
        public const float ChargeMul = 1.3f;
        public const float PlungeMinHeight = 4.6f;   // 2.5m
        public const float PlungeSpeed = 55f;        // 초당 30m
        public const float PlungeRadius = 6.5f;      // 3.5m
        public const float PlungeBaseMul = 1.2f;
        public const float PlungePerMeter = 0.1f / 1.85f; // 떨어진 Godot 1m 당 +0.1
        public const float PlungeMaxFall = 27.75f;   // 15m 까지

        /// <summary>낙하 공격 배수 — 1.2 + 떨어진 높이(15m 까지).</summary>
        public static float PlungeMul(float fallMeters) => PlungeBaseMul + PlungePerMeter * Mathf.Clamp(fallMeters, 0f, PlungeMaxFall);

        public class Member
        {
            public string Id;
            public string Name;
            public GoElement Element;
            public float Hp;
            public float MaxHp;
            public float SkillCd;
            public float Energy;
            public bool Down => Hp <= 0f;
            public bool BurstReady => Energy >= BurstCost;
        }

        public static FieldCombat Instance { get; private set; }

        /// <summary>원소 스킬·폭발이 터진 원(가운데·반경·원소) — 적이 없어도 쏜다. 원소 석등(107-4)이 듣는다.</summary>
        public static event System.Action<Vector3, float, GoElement> ElementPulse;
        /// <summary>109-6 — 모두 쓰러졌다(`FieldHeroes` 가 겨루던 인물을 떠나보낸다).</summary>
        public static event System.Action Wiped;

        [SerializeField] private PlayerController player;
        // PLAN.md 109-8 소환 정령 몸(Poly Haven 등잔 — 씬 빌더가 채운다, 없으면 빛만)
        [SerializeField] private GameObject spiritModel;

        /// <summary>109-8 장판·소환 — 놓은 사람 공격력으로 틱마다 친다(그 사이 교체해도 남는다).</summary>
        public class SkillZone
        {
            public SkillShape Kind;
            public string Owner;
            public Vector3 Center;
            public float Radius, Left, Next, Atk;
            public GoElement Element;
            public Color Color;
            public int Ticks, Hits;
            public SkillSpirit Spirit;
        }

        private readonly List<SkillZone> _zones = new List<SkillZone>();
        public IReadOnlyList<SkillZone> Zones => _zones;
        /// <summary>마지막 스킬의 모양(진단·HUD).</summary>
        public SkillShape LastShape { get; private set; }

        private readonly List<Member> _party = new List<Member>();
        public IReadOnlyList<Member> Party => _party;
        public int ActiveIndex { get; private set; }
        public Member Active => _party.Count > 0 ? _party[ActiveIndex] : null;

        public int ComboStep { get; private set; }
        public float InvulnLeft { get; private set; }
        public float SwapCooldown { get; private set; }
        public bool Invulnerable => InvulnLeft > 0f;
        /// <summary>적이 노릴 수 있는가 — 결투 중·쓰러져 돌아가는 중엔 아니다.</summary>
        public bool CanBeTargeted => isActiveAndEnabled && !DuelGate.Active && Active != null && !Active.Down;

        public Vector3 SafePoint { get; set; }

        private PartyBodies _bodies;
        private float _comboWindow;
        private float _attackCd;
        private float _sinceHit = 999f;
        // 109-14-2 공격을 누르고 있는 시간 — 0.4초 넘으면 강공격 한 번
        private float _holdT;
        public bool AttackHeldByUi { get; set; }
        public bool ChargeFiredThisHold { get; private set; }

        // 107 ⑤ — 불도깨비에게 맞은 화상(맞은 인물에게 남은 틱). 109-14-1a 초 적의 중독도 이 자리(틱 수·간격·빛깔만 다르다)
        public int BurnTicksLeft { get; private set; }
        public GoElement BurnElement { get; private set; } = GoElement.Pyro;
        private float _burnTimer;
        private float _burnTickSec = GoElements.BurnTickSec;
        private float _burnDmg;
        private Member _burnTarget;

        // 109-14-1a 굳힘 보호막(명단 전체 — 나선 사람이 받는 피해를 먼저 막는다) · 꽃피움 씨앗
        public float GuardHp { get; private set; }
        public float GuardMax { get; private set; }
        public float GuardLeft { get; private set; }
        private readonly List<(Vector3 pos, float dmg, float left)> _seeds = new List<(Vector3, float, float)>();
        public int SeedCount => _seeds.Count;

        public float Atk => (PartyState.Atk + PlayerStats.AtkBonus + Inventory.AtkBonus) * PerkState.AtkMultiplier * BondState.AtkMultiplier;
        public float Def => (PartyState.Def + PlayerStats.DefBonus + Inventory.DefBonus) * PerkState.DefMultiplier * BondState.DefMultiplier;

        private void Awake()
        {
            Instance = this;
            if (player == null) player = GetComponent<PlayerController>();
            if (player != null) player.PlungeLanded += OnPlungeLanded;
            SafePoint = transform.position;
            RebuildParty();
            PartyState.PowerChanged += OnPowerChanged;
        }

        private void OnDestroy()
        {
            PartyState.PowerChanged -= OnPowerChanged;
            if (player != null) player.PlungeLanded -= OnPlungeLanded;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            if (GetComponent<FieldCombatHud>() == null) gameObject.AddComponent<FieldCombatHud>();
        }

        private void OnPowerChanged(float atk, float def) => RebuildParty();

        /// <summary>명단을 다시 짠다 — 이미 있던 인물은 체력 비율·쿨·기력을 지킨다.</summary>
        public void RebuildParty()
        {
            var old = new Dictionary<string, Member>();
            foreach (var m in _party) old[m.Id] = m;
            string activeId = Active?.Id;
            _party.Clear();

            float maxHp = 200f + Def * 2f;
            AddMember(old, HeroId, GoLocalization.T("field.hero", "주인공"), GoElements.HeroElement, maxHp);
            // PLAN.md 109-6 — 곁에 서는 셋 = 가장 최근에 등용한 셋(편성 화면이 생기기 전까지). 이름·원소는 도감(`GoHeroes`)에서.
            var members = PartyState.MemberIds;
            for (int k = members.Count - 1; k >= 0 && _party.Count < MaxParty; k--)
            {
                string id = members[k];
                bool dup = false;
                foreach (var m in _party) if (m.Id == id) { dup = true; break; }
                if (dup) continue;
                AddMember(old, id, MemberName(id), GoElements.ForMember(id), maxHp);
            }
            ActiveIndex = 0;
            for (int i = 0; i < _party.Count; i++) if (_party[i].Id == activeId) ActiveIndex = i;
            ApplyLook();
            // 109-14-1a — 원소가 일곱이 되어 옛 동행 원소가 바뀌었다(세이브엔 원소가 없다) — 동료가 있을 때 한 번만 알린다
            if (!GoElements.SevenNoticed && _party.Count > 1 && Application.isPlaying)
            {
                GoElements.SevenNoticed = true;
                ToastLine(GoLocalization.T("field.el7_notice", "원소가 일곱이 되었다 — 풍·빙·암·초. 동료 원소가 바뀌었을 수 있다"), 5f);
            }
        }

        /// <summary>동료 이름 — 도감 인물은 가명, 그 밖(산적)은 id 그대로.</summary>
        public static string MemberName(string id) => GoHeroes.TryGet(id, out var h) ? GoHeroes.Name(h) : id;

        private void AddMember(Dictionary<string, Member> old, string id, string name, GoElement el, float maxHp)
        {
            if (old.TryGetValue(id, out var m))
            {
                float ratio = m.MaxHp > 0f ? m.Hp / m.MaxHp : 1f;
                m.MaxHp = maxHp;
                m.Hp = maxHp * ratio;
                m.Element = el;
            }
            else
            {
                m = new Member { Id = id, Name = name, Element = el, MaxHp = maxHp, Hp = maxHp };
            }
            _party.Add(m);
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            TickTimers(dt);
            if (DuelGate.Active || Active == null || Saga.Go.Cinematics.GoCutscenes.Playing) return; // 106-9 등장 컷 동안 입력 안 받음

            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.jKey.wasPressedThisFrame) AttackPress();
            TickHold(kb.jKey.isPressed || AttackHeldByUi, dt);
            if (kb.eKey.wasPressedThisFrame) Skill();
            if (kb.qKey.wasPressedThisFrame) Burst();
            if (kb.lKey.wasPressedThisFrame || kb.leftCtrlKey.wasPressedThisFrame) Dodge();
            if (kb.digit1Key.wasPressedThisFrame) Swap(0);
            if (kb.digit2Key.wasPressedThisFrame) Swap(1);
            if (kb.digit3Key.wasPressedThisFrame) Swap(2);
            if (kb.digit4Key.wasPressedThisFrame) Swap(3);
        }

        /// <summary>진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void TickTimers(float dt)
        {
            if (_attackCd > 0f) _attackCd -= dt;
            if (_comboWindow > 0f) { _comboWindow -= dt; if (_comboWindow <= 0f) ComboStep = 0; }
            if (InvulnLeft > 0f) InvulnLeft -= dt;
            if (SwapCooldown > 0f) SwapCooldown -= dt;
            foreach (var m in _party) if (m.SkillCd > 0f) m.SkillCd = Mathf.Max(0f, m.SkillCd - dt);
            TickZones(dt);
            TickBurn(dt);
            TickGuardAndSeeds(dt);
            _sinceHit += dt;
            if (_sinceHit >= RegenDelaySec)
            {
                foreach (var m in _party)
                {
                    if (!m.Down && m.Hp < m.MaxHp) m.Hp = Mathf.Min(m.MaxHp, m.Hp + m.MaxHp * RegenPerSec * dt);
                }
            }
        }

        // ---- 공격 셋 -----------------------------------------------------------

        /// <summary>기본 공격 한 타. 들어간 적 수를 돌려준다(-1 = 못 침).</summary>
        public int Attack()
        {
            if (!CanAct() || _attackCd > 0f) return -1;
            int step = _comboWindow > 0f ? ComboStep : 0;
            _attackCd = AttackIntervalSec;
            _comboWindow = ComboWindowSec;
            ComboStep = (step + 1) % ComboMul.Length;

            var target = Nearest(AutoFaceRadius);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");

            Vector3 fwd = Forward();
            int hits = 0;
            float atk = Atk;
            foreach (var e in Snapshot())
            {
                Vector3 d = Flat(e.transform.position - transform.position);
                if (d.magnitude > AttackReach) continue;
                if (d.sqrMagnitude > 0.25f && Vector3.Dot(d.normalized, fwd) < 0.5f) continue; // 앞 120°
                e.TakeHit(atk * ComboMul[step], GoElement.Physical, atk, out _); // 깨뜨림은 강공격·낙하 공격만(109-14-2, 웹·Godot 와 같게)
                hits++;
            }
            if (hits > 0)
            {
                Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit);
                GroundDecal.Spawn(transform.position + fwd * 2f, GroundDecal.Kind.HitMark);
            }
            return hits;
        }

        /// <summary>109-14-2 공격 누름 — 활공 중이면 낙하 공격, 아니면 기본 한 타.</summary>
        public int AttackPress()
        {
            if (player != null && player.Mode == PlayerController.MoveMode.Glide) return TryPlunge() ? 0 : -1;
            return Attack();
        }

        /// <summary>누르고 있는 동안 — 0.4초가 넘으면 강공격 한 번(뗄 때까지 다시 안 나간다). 진단이 직접 부른다.</summary>
        public void TickHold(bool held, float dt)
        {
            if (!held) { _holdT = 0f; ChargeFiredThisHold = false; return; }
            _holdT += dt;
            if (ChargeFiredThisHold || _holdT < ChargeHoldSec) return;
            ChargeFiredThisHold = true;
            ChargedAttack();
        }

        /// <summary>강공격 — 스태미나 20, 가까운 적 쪽 앞 넓게(5.9m·옆까지) ×1.3 물리, 얼어붙은 적을 깨뜨린다, 콤보는 처음부터.
        /// 들어간 적 수(-1 = 못 침 — 스태미나 부족 등).</summary>
        public int ChargedAttack()
        {
            if (!CanAct()) return -1;
            if (!GoStamina.TrySpend(ChargeStamina))
            {
                FieldDamageText.Spawn(transform.position + Vector3.up * 4.6f, GoLocalization.T("field.charge_low", "스태미나 부족"), new Color(0.8f, 0.85f, 0.6f), 0.9f);
                return -1;
            }
            ComboStep = 0;
            _comboWindow = 0f;
            _attackCd = AttackIntervalSec;
            var target = Nearest(AutoFaceRadius);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            Vector3 fwd = Forward();
            float atk = Atk;
            int hits = 0;
            foreach (var e in Snapshot())
            {
                Vector3 d = Flat(e.transform.position - transform.position);
                if (d.magnitude > ChargeReach) continue;
                if (d.sqrMagnitude > 0.25f && Vector3.Dot(d.normalized, fwd) < ChargeFrontDot) continue;
                e.TakeHit(atk * ChargeMul, GoElement.Physical, atk, out _, heavy: true);
                hits++;
            }
            if (hits > 0) Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit * hits);
            FieldRingFx.Spawn(transform.position + fwd * 1.5f, ChargeReach, Color.white, 0.35f);
            FieldDamageText.Spawn(transform.position + Vector3.up * 4.6f, GoLocalization.T("field.charge", "강공격"), Color.white, 1f);
            return hits;
        }

        /// <summary>활공 중 내리꽂기 시작 — 발밑이 4.6m 넘어야.</summary>
        public bool TryPlunge()
        {
            if (Active == null || Active.Down || DuelGate.Active || player == null) return false;
            return player.TryPlunge(PlungeMinHeight, PlungeSpeed);
        }

        /// <summary>땅에 닿은 순간 — 둘레 6.5m 에 ×(1.2 + 떨어진 높이) 물리, 얼어붙은 적을 깨뜨린다. 진단이 직접 부른다.</summary>
        public int PlungeHit(float fallMeters)
        {
            float atk = Atk, mul = PlungeMul(fallMeters);
            int hits = 0;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - transform.position).magnitude > PlungeRadius) continue;
                e.TakeHit(atk * mul, GoElement.Physical, atk, out _, heavy: true);
                hits++;
            }
            if (hits > 0 && Active != null) Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit * hits);
            FieldRingFx.Spawn(transform.position, PlungeRadius, Color.white, 0.45f);
            FieldRingFx.Spawn(transform.position, PlungeRadius * 0.55f, Color.white, 0.3f);
            GroundDecal.Spawn(transform.position, GroundDecal.Kind.HitMark);
            FieldDamageText.Spawn(transform.position + Vector3.up * 4.6f, GoLocalization.T("field.plunge", "낙하 공격"), Color.white, 1.1f);
            LastPlungeHits = hits;
            return hits;
        }

        /// <summary>마지막 낙하 공격이 맞힌 적 수(진단).</summary>
        public int LastPlungeHits { get; private set; } = -1;

        private void OnPlungeLanded(float fallMeters) => PlungeHit(fallMeters);

        /// <summary>원소 스킬(E) — 나선 사람의 모양(`GoSkillShapes`, 109-8)대로. 주인공 = 앞 2m 중심 반경 7m 원형.
        /// 들어간 적 수(장판·소환은 첫 틱에 든 수) · -1 = 쿨·못 씀.</summary>
        public int Skill()
        {
            var m = Active;
            if (!CanAct() || m.SkillCd > 0f) return -1;
            m.SkillCd = SkillCooldownSec;
            var shape = GoSkillShapes.ShapeOf(m.Id);
            LastShape = shape;
            float aimRange = shape == SkillShape.Circle ? AutoFaceRadius * 1.5f : Mathf.Max(AutoFaceRadius * 1.5f, GoSkillShapes.ThrustLen);
            var target = Nearest(aimRange);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            Vector3 pos = transform.position;
            Vector3 dir = Forward();
            float aimDist = 0f;
            if (target != null)
            {
                Vector3 d = Flat(target.transform.position - pos);
                aimDist = d.magnitude;
                if (aimDist > 0.01f) dir = d / aimDist;
            }
            Color fx = GoSkillShapes.FxColor(m.Id, m.Element);
            float atk = Atk;
            int hits;
            switch (shape)
            {
                case SkillShape.Thrust:
                {
                    Vector3 end = pos + dir * GoSkillShapes.ThrustLen;
                    hits = LineHit(pos, end, GoSkillShapes.ThrustWidth, atk * GoSkillShapes.ThrustMul, m.Element);
                    FieldLineFx.Spawn(pos, end, GoSkillShapes.ThrustWidth * 2f, fx);
                    ElementPulse?.Invoke((pos + end) * 0.5f, GoSkillShapes.ThrustLen * 0.5f, m.Element);
                    break;
                }
                case SkillShape.Dash:
                {
                    float go = target != null ? Mathf.Min(GoSkillShapes.DashLen, Mathf.Max(0f, aimDist - GoSkillShapes.DashStop)) : GoSkillShapes.DashLen;
                    Vector3 end = pos + dir * go;
                    hits = LineHit(pos, end + dir * GoSkillShapes.DashStop, GoSkillShapes.DashWidth, atk * GoSkillShapes.DashMul, m.Element);
                    InvulnLeft = Mathf.Max(InvulnLeft, GoSkillShapes.DashInvulnSec);
                    if (player != null && go > 0.05f) player.Dash(dir, go, GoSkillShapes.DashSec);
                    FieldLineFx.Spawn(pos, end + dir * GoSkillShapes.DashStop, GoSkillShapes.DashWidth * 2f, fx, 0.45f);
                    ElementPulse?.Invoke(end, GoSkillShapes.DashWidth * 2f, m.Element);
                    break;
                }
                case SkillShape.Field:
                {
                    Vector3 c = target != null ? Flat(target.transform.position) + Vector3.up * pos.y : pos + dir * SkillOffset;
                    var z = new SkillZone { Kind = shape, Owner = m.Id, Center = c, Radius = GoSkillShapes.FieldRadius, Left = GoSkillShapes.FieldSec,
                        Atk = atk, Element = m.Element, Color = fx };
                    _zones.Add(z);
                    TickZone(z, 0f); // 놓자마자 첫 틱
                    hits = z.Hits;
                    break;
                }
                case SkillShape.Summon:
                {
                    Vector3 c = pos + dir * GoSkillShapes.SummonOffset;
                    var z = new SkillZone { Kind = shape, Owner = m.Id, Center = c, Radius = GoSkillShapes.SummonRadius, Left = GoSkillShapes.SummonSec,
                        Atk = atk, Element = m.Element, Color = fx };
                    z.Spirit = SkillSpirit.Spawn(c, spiritModel, fx);
                    _zones.Add(z);
                    ElementPulse?.Invoke(c, 3f, m.Element);
                    TickZone(z, 0f);
                    hits = z.Hits;
                    break;
                }
                default:
                {
                    Vector3 center = pos + Forward() * SkillOffset;
                    hits = AreaHit(center, SkillRadius, atk * SkillMul, m.Element);
                    FieldRingFx.Spawn(center, SkillRadius, GoElements.ColorOf(m.Element));
                    ElementPulse?.Invoke(center, SkillRadius, m.Element);
                    break;
                }
            }
            if (hits > 0) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerSkillHit);
            if (shape != SkillShape.Circle)
                FieldDamageText.Spawn(pos + Vector3.up * 5.2f, GoSkillShapes.Name(shape), fx, 1.1f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        /// <summary>선분 둘레 폭 안의 적을 친다(찌르기·돌진).</summary>
        private int LineHit(Vector3 a, Vector3 b, float width, float amount, GoElement el)
        {
            int hits = 0;
            float atk = Atk;
            foreach (var e in Snapshot())
            {
                if (GoSkillShapes.SegDist(e.transform.position, a, b) > width) continue;
                e.TakeHit(amount, el, atk, out _);
                hits++;
            }
            return hits;
        }

        private void TickZones(float dt)
        {
            for (int i = _zones.Count - 1; i >= 0; i--)
            {
                var z = _zones[i];
                TickZone(z, dt);
                if (z.Left <= 1e-6f) RemoveZone(i);
            }
        }

        private void TickZone(SkillZone z, float dt)
        {
            z.Left -= dt;
            z.Next -= dt;
            while (z.Next <= 1e-6f && z.Left > 1e-6f)
            {
                z.Ticks++;
                if (z.Kind == SkillShape.Field)
                {
                    int n = 0;
                    foreach (var e in Snapshot())
                    {
                        if (Flat(e.transform.position - z.Center).magnitude > z.Radius) continue;
                        e.TakeHit(z.Atk * GoSkillShapes.FieldMul, z.Element, z.Atk, out _);
                        n++;
                    }
                    z.Hits += n;
                    FieldRingFx.Spawn(z.Center, z.Radius, z.Color, 0.7f);
                    ElementPulse?.Invoke(z.Center, z.Radius, z.Element);
                    z.Next += GoSkillShapes.FieldEvery;
                }
                else
                {
                    FieldEnemy best = null;
                    float bestD = z.Radius;
                    foreach (var e in Snapshot())
                    {
                        float d = Flat(e.transform.position - z.Center).magnitude;
                        if (d <= bestD) { bestD = d; best = e; }
                    }
                    if (best != null)
                    {
                        best.TakeHit(z.Atk * GoSkillShapes.SummonMul, z.Element, z.Atk, out _);
                        z.Hits++;
                        Vector3 from = z.Spirit != null ? z.Spirit.Tip : z.Center + Vector3.up * SkillSpirit.Hover;
                        FieldLineFx.Spawn(from, best.transform.position + Vector3.up * 1.6f, 0.5f, z.Color, 0.3f, 0f);
                        if (z.Spirit != null) z.Spirit.Flash();
                    }
                    z.Next += GoSkillShapes.SummonEvery;
                }
            }
        }

        private void RemoveZone(int i)
        {
            var z = _zones[i];
            if (z.Spirit != null)
            {
                FieldRingFx.Spawn(z.Spirit.transform.position - Vector3.up * SkillSpirit.Hover, 1.5f, z.Color, 0.4f);
                Destroy(z.Spirit.gameObject);
            }
            _zones.RemoveAt(i);
        }

        private void ClearZones()
        {
            for (int i = _zones.Count - 1; i >= 0; i--) RemoveZone(i);
        }

        /// <summary>원소 폭발 — 반경 12m, 기력 100 소모. 들어간 적 수(-1 = 기력 모자람).</summary>
        public int Burst()
        {
            var m = Active;
            if (!CanAct() || !m.BurstReady) return -1;
            m.Energy = 0f;
            int hits = AreaHit(transform.position, BurstRadius, Atk * BurstMul, m.Element);
            FieldRingFx.Spawn(transform.position, BurstRadius, GoElements.ColorOf(m.Element), 0.7f);
            FieldRingFx.Spawn(transform.position, BurstRadius * 0.6f, Color.white, 0.5f);
            ElementPulse?.Invoke(transform.position, BurstRadius, m.Element);
            ToastLine(string.Format(GoLocalization.T("field.burst", "{0} — 원소 해방!"), m.Name), 1.5f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        private int AreaHit(Vector3 center, float radius, float amount, GoElement el)
        {
            int hits = 0;
            float atk = Atk;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - center).magnitude > radius) continue;
                e.TakeHit(amount, el, atk, out _);
                hits++;
            }
            return hits;
        }

        public bool Dodge()
        {
            if (!CanAct() || (player != null && player.IsDashing)) return false;
            if (!GoStamina.TrySpend(DodgeStamina)) return false;
            InvulnLeft = DodgeInvulnSec;
            Vector3 dir = player != null ? player.MoveIntent : Vector3.zero;
            if (dir.sqrMagnitude < 0.01f) dir = -Forward(); // 입력 없으면 뒤로 물러선다
            if (player != null) player.Dash(dir, DodgeDistance, DodgeSec);
            return true;
        }

        public bool Swap(int index)
        {
            if (DuelGate.Active || index < 0 || index >= _party.Count || index == ActiveIndex) return false;
            if (SwapCooldown > 0f || _party[index].Down) return false;
            ActiveIndex = index;
            SwapCooldown = SwapCooldownSec;
            ComboStep = 0;
            _comboWindow = 0f;
            ApplyLook(true);
            FieldRingFx.Spawn(transform.position, 2.5f, GoElements.ColorOf(Active.Element), 0.35f);
            return true;
        }

        private bool CanAct() => Active != null && !Active.Down && !DuelGate.Active && (player == null || player.OnFoot); // 107 ② 등반·활공·수영 중엔 못 싸운다

        // ---- 피격 --------------------------------------------------------------

        /// <summary>적 판정이 닿았을 때. 회피 무적이면 흘리고 false.</summary>
        public bool ReceiveStrike(float enemyAtk, FieldEnemy from)
        {
            var m = Active;
            if (m == null || m.Down) return false;
            if (Invulnerable)
            {
                FieldDamageText.Spawn(transform.position + Vector3.up * 4f, GoLocalization.T("field.evade", "회피!"), new Color(0.7f, 0.95f, 1f), 1.1f);
                return false;
            }
            float dmg = enemyAtk * 200f / (200f + Mathf.Max(0f, Def));
            if (GuardHp > 0f)
            {
                // 109-14-1a 굳힘 — 받는 피해를 먼저 막고, 다 막으면 원소 효과도 막는다
                float absorbed = Mathf.Min(GuardHp, dmg);
                GuardHp -= absorbed;
                dmg -= absorbed;
                if (GuardHp <= 0f) { GuardHp = 0f; GuardLeft = 0f; }
                FieldDamageText.Spawn(transform.position + Vector3.up * 4.6f, string.Format(GoLocalization.T("field.guard_block", "굳힘 −{0}"), Mathf.RoundToInt(absorbed)), GoElements.ColorOf(GoElement.Geo), 0.9f);
                if (dmg <= 0f) { _sinceHit = 0f; return true; }
            }
            m.Hp = Mathf.Max(0f, m.Hp - dmg);
            _sinceHit = 0f;
            FieldDamageText.Spawn(transform.position + Vector3.up * 4f, Mathf.RoundToInt(dmg).ToString(), new Color(1f, 0.3f, 0.25f));
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Hit");
            if (m.Down) OnMemberDown();
            else if (from != null && from.IsElemental) ApplyFoeStatus(from.Element, dmg);
            return true;
        }

        /// <summary>107 ⑤ 원소 쓰는 적에게 맞았을 때 — 화 = 화상(그 피해 ×0.2 세 번, 1초 간격, 이것만으론 안 쓰러짐) ·
        /// 수 = 젖음(스태미나 -25) · 뇌 = 감전(나선 인물 기력 -25).</summary>
        public void ApplyFoeStatus(GoElement el, float strikeDmg)
        {
            var m = Active;
            if (m == null || m.Down) return;
            Vector3 textPos = transform.position + Vector3.up * 5f;
            switch (el)
            {
                case GoElement.Pyro:
                    StartDot(m, GoElement.Pyro, GoElements.BurnTicks, GoElements.BurnTickSec, strikeDmg * GoElements.BurnMul);
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.burn", "화상"), GoElements.ColorOf(el), 1f);
                    break;
                case GoElement.Anemo:
                    m.SkillCd += GoElements.SweptSkillCdAdd;
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.swept", "휘말림 — 스킬 +2초"), GoElements.ColorOf(el), 1f);
                    break;
                case GoElement.Cryo:
                    GoStamina.BlockRegen(GoElements.ChillSec);
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.chill", "한기 — 스태미나 3초 멈춤"), GoElements.ColorOf(el), 1f);
                    break;
                case GoElement.Geo:
                {
                    float before = m.Hp;
                    m.Hp = Mathf.Max(Mathf.Min(1f, before), before - strikeDmg * GoElements.CrushMul); // 짓눌림만으로는 안 쓰러진다
                    FieldDamageText.Spawn(textPos, string.Format(GoLocalization.T("field.st.crush", "짓눌림 −{0}"), Mathf.RoundToInt(before - m.Hp)), GoElements.ColorOf(el), 1f);
                    break;
                }
                case GoElement.Dendro:
                    StartDot(m, GoElement.Dendro, GoElements.PoisonTicks, GoElements.PoisonTickSec, strikeDmg * GoElements.PoisonMul);
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.poison", "중독"), GoElements.ColorOf(el), 1f);
                    break;
                case GoElement.Hydro:
                    GoStamina.Use(GoElements.WetStaminaLoss);
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.wet", "젖음 — 스태미나 -25"), GoElements.ColorOf(el), 1f);
                    break;
                case GoElement.Electro:
                    m.Energy = Mathf.Max(0f, m.Energy - GoElements.ShockEnergyLoss);
                    FieldDamageText.Spawn(textPos, GoLocalization.T("field.st.shock", "감전 — 기력 -25"), GoElements.ColorOf(el), 1f);
                    break;
            }
        }

        private void StartDot(Member m, GoElement el, int ticks, float every, float dmg)
        {
            _burnTarget = m;
            BurnElement = el;
            BurnTicksLeft = ticks;
            _burnTickSec = every;
            _burnTimer = every;
            _burnDmg = dmg;
        }

        private void TickBurn(float dt)
        {
            if (BurnTicksLeft <= 0) return;
            if (_burnTarget == null || _burnTarget.Down) { BurnTicksLeft = 0; return; }
            _burnTimer -= dt;
            while (_burnTimer <= 0f && BurnTicksLeft > 0)
            {
                _burnTimer += _burnTickSec;
                BurnTicksLeft--;
                float before = _burnTarget.Hp;
                _burnTarget.Hp = Mathf.Max(Mathf.Min(1f, before), before - _burnDmg); // 화상·중독만으로는 안 쓰러진다
                FieldDamageText.Spawn(transform.position + Vector3.up * 4f, Mathf.RoundToInt(before - _burnTarget.Hp).ToString(), GoElements.ColorOf(BurnElement), 0.8f);
            }
        }

        /// <summary>109-14-1a 굳힘 — 나선 사람 최대 체력 20% 보호막 15초(이미 더 크면 그대로, 시간만 새로).</summary>
        public void AddCrystalGuard()
        {
            var m = Active;
            float hp = (m != null ? m.MaxHp : 600f) * GoElements.CrystalHpFrac;
            GuardMax = Mathf.Max(hp, GuardHp);
            GuardHp = Mathf.Max(hp, GuardHp);
            GuardLeft = GoElements.CrystalSec;
            FieldRingFx.Spawn(transform.position, 2.2f, GoElements.ColorOf(GoElement.Geo), 0.5f);
        }

        /// <summary>109-14-1a 꽃피움 — 1.5초 뒤 그 자리 반경 5.5m 적에게 터진다.</summary>
        public void AddBloomSeed(Vector3 pos, float dmg)
        {
            _seeds.Add((pos, dmg, GoElements.BloomDelay));
            FieldRingFx.Spawn(pos, 1.2f, GoElements.ColorOf(GoElement.Dendro), 0.4f);
        }

        private void TickGuardAndSeeds(float dt)
        {
            if (GuardLeft > 0f)
            {
                GuardLeft -= dt;
                if (GuardLeft <= 0f) { GuardLeft = 0f; GuardHp = 0f; }
            }
            for (int i = _seeds.Count - 1; i >= 0; i--)
            {
                var sd = _seeds[i];
                sd.left -= dt;
                if (sd.left > 0f) { _seeds[i] = sd; continue; }
                _seeds.RemoveAt(i);
                FieldRingFx.Spawn(sd.pos, GoElements.BloomRadius, GoElements.ColorOf(GoElement.Dendro), 0.5f);
                foreach (var e in Snapshot())
                    if (Flat(e.transform.position - sd.pos).magnitude <= GoElements.BloomRadius)
                        e.TakeRaw(sd.dmg, GoElements.ColorOf(GoElement.Dendro));
            }
        }

        private void OnMemberDown()
        {
            ToastLine(string.Format(GoLocalization.T("field.down", "{0} 쓰러짐"), Active.Name), 2f);
            for (int i = 1; i <= _party.Count; i++)
            {
                int idx = (ActiveIndex + i) % _party.Count;
                if (!_party[idx].Down)
                {
                    ActiveIndex = idx;
                    SwapCooldown = 0f;
                    ApplyLook(true);
                    return;
                }
            }
            WipeAndReturn();
        }

        /// <summary>모두 쓰러짐 — 잃는 것 없이 안전한 곳(마을 스폰)에서 전원 회복.</summary>
        public void WipeAndReturn()
        {
            foreach (var m in _party) { m.Hp = m.MaxHp; m.SkillCd = 0f; }
            BurnTicksLeft = 0;
            GuardHp = GuardLeft = 0f;
            _seeds.Clear();
            ClearZones();
            ActiveIndex = 0;
            ApplyLook();
            foreach (var e in FieldEnemy.All) e.ForceReturn();
            Wiped?.Invoke(); // 109-6 — 겨루던 들판 인물은 떠난다
            if (player != null) player.Teleport(SafePoint);
            else transform.position = SafePoint;
            GoStamina.ResetFull();
            ToastLine(GoLocalization.T("field.wipe", "모두 쓰러졌다 — 마을에서 기운을 차렸다(잃은 것 없음)"), 3f);
        }

        // ---- 도움 --------------------------------------------------------------

        /// <param name="motion">109-8 교체 연출 — 옛 몸이 옆뒤로 물러나 흩어지고 새 몸이 옆에서 들어선다(교체·쓰러져 넘김만, 되돌림·전멸은 바로).</param>
        private void ApplyLook(bool motion = false)
        {
            if (player == null || player.Visual == null || Active == null) return;
            // 107 ⑥ — 나선 인물의 몸으로 바꾼다. 제 몸이 없는 동료(모델 없음)만 주인공 몸에 원소 빛을 옅게 입힌다.
            if (_bodies == null) _bodies = player.GetComponent<PartyBodies>();
            bool ownBody = _bodies != null && _bodies.Show(Active.Id, motion);
            if (ActiveIndex == 0 || ownBody) CharacterVisual.ClearTint(player.Visual.gameObject);
            else CharacterVisual.Tint(player.Visual.gameObject, Color.Lerp(Color.white, GoElements.ColorOf(Active.Element), 0.35f));
        }

        private FieldEnemy Nearest(float radius)
        {
            FieldEnemy best = null;
            float bestD = radius;
            foreach (var e in FieldEnemy.All)
            {
                if (!e.Alive) continue;
                float d = Flat(e.transform.position - transform.position).magnitude;
                if (d <= bestD) { bestD = d; best = e; }
            }
            return best;
        }

        private static List<FieldEnemy> Snapshot()
        {
            var list = new List<FieldEnemy>();
            foreach (var e in FieldEnemy.All) if (e.Alive) list.Add(e);
            return list;
        }

        private Vector3 Forward()
        {
            Transform basis = player != null && player.Visual != null ? player.Visual : transform;
            Vector3 f = basis.forward;
            f.y = 0f;
            return f.sqrMagnitude > 0.0001f ? f.normalized : Vector3.forward;
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        private static void ToastLine(string text, float sec)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(text, sec);
        }

        /// <summary>진단용 — 전원 회복·쿨/기력 초기화.</summary>
        public void ResetForTest()
        {
            foreach (var m in _party) { m.Hp = m.MaxHp; m.SkillCd = 0f; m.Energy = 0f; }
            ActiveIndex = 0;
            ComboStep = 0;
            _comboWindow = 0f;
            _attackCd = 0f;
            InvulnLeft = 0f;
            SwapCooldown = 0f;
            _sinceHit = 999f;
            BurnTicksLeft = 0;
            GuardHp = GuardMax = GuardLeft = 0f;
            _seeds.Clear();
            ClearZones();
            ApplyLook();
        }
    }
}
