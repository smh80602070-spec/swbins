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
            /// <summary>109-14-4 깨달음 ⑤ — 해방 뒤 남은 공격 +20% 초.</summary>
            public float BuffLeft;
            /// <summary>109-14-11 원소 부여(검기·불새 깃) — 남은 초·기본/강/낙하 피해 배율.</summary>
            public float InfuseLeft, InfuseMul = 1f;
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
            public float Mul = 1f, React = 1f; // 109-14-4 놓은 사람의 스킬 무예 배율·깨달음 ② 반응 배율
            public GoElement Element;
            public Color Color;
            public int Ticks, Hits;
            public SkillSpirit Spirit;
            // 109-14-11 진(가까운 적 N · 맞힐 때마다 명단 기력)·소용돌이(빨아들임)
            public float Every, EnergyPerHit, Pull;
            public int N;
            /// <summary>109-14-17 바람 자리 — 틱마다 안에 선 지금 인물 최대 체력의 이만큼 회복(Heals = 회복한 틱 수, 진단).</summary>
            public float Heal;
            public int Heals;
        }

        // ---- 109-14-11 고유·갈래 해방이 거는 명단 효과 · 늦게 떨어지는 탄 ----
        public float RallyLeft { get; private set; }
        public float RallyMul { get; private set; } = 1f;
        public float WardLeft { get; private set; }
        public float WardMul { get; private set; } = 1f;
        public float HasteLeft { get; private set; }
        /// <summary>109-14-15 옛 글자 풀이 — 남은 초 동안 명단 원소 반응 피해 × LoreMul.</summary>
        public float LoreLeft { get; private set; }
        public float LoreMul { get; private set; } = 1f;
        /// <summary>109-14-15 가면 벗기 메아리 — 그 적을 따라가 남은 초 뒤에 친다(진단이 센다).</summary>
        private readonly List<(FieldEnemy target, float left, float amount, GoElement el, Color c)> _echoes = new List<(FieldEnemy, float, float, GoElement, Color)>();
        public int EchoCount => _echoes.Count;
        /// <summary>109-14-17 뱃노래 — 남은 초 동안 기본·강·낙하 공격이 맞으면 쉼이 끝났을 때 물 노가 따라 친다(놓은 사람의 값으로).</summary>
        public float RainLeft { get; private set; }
        public float RainCd { get; private set; }
        public int RainHits { get; private set; }
        private KitBurst _rainKit;
        private string _rainOwner;
        private float _rainAmount;
        private GoElement _rainEl;
        private Color _rainColor;
        /// <summary>마지막으로 쓴 스킬·해방 한 벌(진단).</summary>
        public HeroKit LastKit { get; private set; }
        private readonly List<(Vector3 pos, float left, float r, float amount, GoElement el, Color c)> _shells = new List<(Vector3, float, float, float, GoElement, Color)>();
        public int ShellCount => _shells.Count;

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
        // 109-14-18 방금 싸움(내가 맞히거나 맞은 뒤 흐른 초 — 편성 막기)
        private float _calmT = 999f;
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

        public float Atk
        {
            get
            {
                var md = WeaponState.ModsOf(Active?.Id); // 109-14-5a 든 무기 공격 · 공격%
                var ab = ArtifactState.BonusOf(Active?.Id); // 109-14-5b 보패 공격% · 고정 공격(웹 식: (기본 + 무기) × (1 + %) + 고정)
                return ((PartyState.Atk + PlayerStats.AtkBonus + Inventory.AtkBonus + md.Atk) * (1f + md.AtkPct + ab.AtkPct) + ab.Atk + CookState.Buff("atk")) * PerkState.AtkMultiplier * BondState.AtkMultiplier // 109-14-6 요리 공격(고정)
                    * (Active != null && Active.BuffLeft > 0f ? GoTalent.C5Atk : 1f) // 109-14-4 깨달음 ⑤
                    * (RallyLeft > 0f ? RallyMul : 1f); // 109-14-11 군기·학날개 진
            }
        }

        // ---- 109-14-5a 치명타(씨앗 고정 난수 — mulberry32 20260824)·무기 효과·기력 ----
        /// <summary>진단 — 피해값을 딱 맞춰 보는 진단은 치명타를 끈다. 0 이상이면 그 확률로 굴린다.</summary>
        public static bool CritOffForTest;
        public static float CritRateForTest = -1f;
        private uint _rng = 20260824u;
        /// <summary>마지막 굴림이 치명이었나(진단).</summary>
        public bool LastCrit { get; private set; }

        private float NextRand()
        {
            unchecked
            {
                _rng += 0x6D2B79F5u;
                uint t = _rng;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return ((t ^ (t >> 14)) >> 0) / 4294967296f;
            }
        }

        /// <summary>한 타의 치명 배수 — 기본·강공격·낙하·스킬·장판·해방만 굴린다(반응 조각은 안 굴림).</summary>
        private float CritMul(string id, out bool crit)
        {
            crit = false;
            LastCrit = false;
            if (CritOffForTest) return 1f;
            var md = WeaponState.ModsOf(id);
            var ab = ArtifactState.BonusOf(id); // 109-14-5b 보패 치명
            float rate = CritRateForTest >= 0f ? CritRateForTest : md.CritRate + ab.CritRate + CookState.Buff("crit_rate"); // 109-14-6 요리 치명
            crit = LastCrit = NextRand() < rate;
            return crit ? 1f + md.CritDmg + ab.CritDmg + CookState.Buff("crit_dmg") : 1f;
        }

        /// <summary>무기 효과 — 그 갈래(n·s·b·react)면 1 + 값.</summary>
        private static float PasMul(string id, string kind)
        {
            var md = WeaponState.ModsOf(id);
            return md.Pas == kind ? 1f + md.PasV : 1f;
        }

        /// <summary>한 타의 피해 보너스(웹 식 더하기: 1 + 무기 효과 + 보패 4 세트 + 원소 피해) — kind 는 n·s·b.
        /// 떠돌이 무사 4 는 칼·대도·창의 기본 공격(강공격·낙하 포함)만.</summary>
        public static float DmgMul(string id, string kind, GoElement el)
        {
            var md = WeaponState.ModsOf(id);
            var ab = ArtifactState.BonusOf(id);
            float b = md.Pas == kind ? md.PasV : 0f;
            if (kind == "n" && md.Weapon.Type != GoWeapons.Type.Catalyst && md.Weapon.Type != GoWeapons.Type.Bow) b += ab.NormalMelee;
            else if (kind == "s") b += ab.SkillDmg;
            else if (kind == "b") b += ab.BurstDmg;
            return 1f + b + ab.Elem[(int)el];
        }

        /// <summary>109-14-5b 보패 4 세트 반응 — 대장간 불씨(물안개·녹임·터짐·들불 +35%)·솔바람 피리(회오리 +50%). 나선 사람 몫.</summary>
        public float SetReactMul(GoReaction r)
        {
            if (Active == null) return 1f;
            var ab = ArtifactState.BonusOf(Active.Id);
            switch (r)
            {
                case GoReaction.Vaporize: case GoReaction.Melt: case GoReaction.Overload: case GoReaction.Burning: return 1f + ab.ReactFire;
                case GoReaction.Swirl: return 1f + ab.ReactSwirl;
                default: return 1f;
            }
        }

        private float EnergyMul => Active != null ? 1f + WeaponState.ModsOf(Active.Id).Energy + ArtifactState.BonusOf(Active.Id).Energy : 1f;

        /// <summary>109-14-4 나선 사람의 무예 배율·반응 배율(주인공·도감 밖은 1).</summary>
        private float TalentMul(GoTalent.Kind k) => Active != null ? TalentState.Mul(Active.Id, k) : 1f;
        private float ReactMul => (Active != null ? TalentState.ReactMul(Active.Id) * PasMul(Active.Id, "react") : 1f) * (LoreLeft > 0f ? LoreMul : 1f); // 109-14-15 옛 글자 풀이
        public float Def => (PartyState.Def + PlayerStats.DefBonus + Inventory.DefBonus) * PerkState.DefMultiplier * BondState.DefMultiplier;

        /// <summary>109-14-5b 나선 사람이 받는 피해에 쓰는 방어(보패 방어% · 고정 방어). 체력 상한은 보패 없는 <see cref="Def"/> 로 센다.</summary>
        public float ActiveDef
        {
            get
            {
                var ab = ArtifactState.BonusOf(Active?.Id);
                return Def * (1f + ab.DefPct) + ab.Def + CookState.Buff("def"); // 109-14-6 요리 방어(고정)
            }
        }

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
        /// <param name="lead">109-14-18 편성을 바꿨을 때 — 첫 자리(주인공)를 앞에 세운다.</param>
        public void RebuildParty(bool lead = false)
        {
            var old = new Dictionary<string, Member>();
            foreach (var m in _party) old[m.Id] = m;
            string activeId = Active?.Id;
            _party.Clear();

            float maxHp = 200f + Def * 2f;
            AddMember(old, HeroId, GoLocalization.T("field.hero", "주인공"), GoElements.HeroElement, maxHp);
            // PLAN.md 109-6 — 곁에 서는 셋 = 동행 순서의 뒤 셋(109-14-15 편성이 순서를 바꾼다). 이름·원소는 도감(`GoHeroes`)에서.
            foreach (var id in PartyState.FieldIds())
                if (_party.Count < MaxParty && id != HeroId) AddMember(old, id, MemberName(id), GoElements.ForMember(id), maxHp);
            ActiveIndex = 0;
            if (!lead) for (int i = 0; i < _party.Count; i++) if (_party[i].Id == activeId) ActiveIndex = i;
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
            var ab = ArtifactState.BonusOf(id); // 109-14-5b 보패 체력% · 고정 체력(웹 식: (기본 × (1 + %) + 고정) × 깨달음)
            maxHp = (maxHp * (1f + WeaponState.ModsOf(id).HpPct + ab.HpPct) + ab.Hp) * TalentState.HpMul(id); // 109-14-4 깨달음 ④ · 109-14-5a 무기 체력%
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
            if (DuelGate.Active || Active == null || Saga.Go.Cinematics.GoCutscenes.Playing || StoryState.Talking) return; // 106-9 등장 컷 동안 입력 안 받음 · 109-14-12 이야기 대화 중도

            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.rKey.wasPressedThisFrame) ToggleAim(); // 109-14-22 활 조준
            TickAim(dt, player != null ? player.AimInput.x : 0f);
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
            foreach (var m in _party)
            {
                if (m.SkillCd > 0f) m.SkillCd = Mathf.Max(0f, m.SkillCd - dt * (HasteLeft > 0f ? 2f : 1f)); // 109-14-11 천기 뇌우 — 두 배로 돈다
                if (m.BuffLeft > 0f) m.BuffLeft = Mathf.Max(0f, m.BuffLeft - dt);
                if (m.InfuseLeft > 0f) m.InfuseLeft = Mathf.Max(0f, m.InfuseLeft - dt);
            }
            TickZones(dt);
            TickKitEffects(dt);
            TickBurn(dt);
            TickGuardAndSeeds(dt);
            TickArrows(dt); // 109-14-22
            _sinceHit += dt;
            _calmT += dt;
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
            // 109-14-5a 든 무기 모양 — 칼·대도·창은 앞 120° 붙어 치기, 서책(인물 원소)·활은 사거리 안 가장 가까운 하나. 대도는 무거운 타격(깨뜨림)
            var md = WeaponState.ModsOf(Active.Id);
            var kit = md.Kit;
            int step = _comboWindow > 0f ? ComboStep : 0;
            _attackCd = kit.Sec[step];
            _comboWindow = ComboWindowSec;
            ComboStep = (step + 1) % ComboMul.Length;

            var target = kit.Reach > 0f ? Nearest(AutoFaceRadius) : Nearest(kit.Range);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");

            Vector3 fwd = Forward();
            int hits = 0;
            float atk = Atk;
            GoElement el = kit.Element || Active.InfuseLeft > 0f ? Active.Element : GoElement.Physical; // 109-14-11 원소 부여
            float amount = atk * kit.Mul[step] * TalentMul(GoTalent.Kind.Normal) * DmgMul(Active.Id, "n", el) * (Active.InfuseLeft > 0f ? Active.InfuseMul : 1f); // 109-14-4 기본 무예 · 무기 효과 · 109-14-5b 보패
            if (kit.Reach > 0f)
            {
                foreach (var e in Snapshot())
                {
                    Vector3 d = Flat(e.transform.position - transform.position);
                    if (d.magnitude > kit.Reach) continue;
                    if (d.sqrMagnitude > 0.25f && Vector3.Dot(d.normalized, fwd) < 0.5f) continue; // 앞 120°
                    float cm = CritMul(Active.Id, out bool crit);
                    e.TakeHit(amount * cm, el, atk * ReactMul, out _, heavy: kit.Heavy, crit: crit); // 깨뜨림은 대도·강공격·낙하만
                    hits++;
                }
            }
            else if (target == null && HitNearestTarget(kit.Range)) hits = 0; // 109-14-22 과녁 잠금
            else if (target != null)
            {
                float cm = CritMul(Active.Id, out bool crit);
                target.TakeHit(amount * cm, el, atk * ReactMul, out _, crit: crit);
                FieldLineFx.Spawn(transform.position + Vector3.up * 1.6f, target.transform.position + Vector3.up * 1.2f, 0.25f, el == GoElement.Physical ? Color.white : GoElements.ColorOf(el), 0.2f);
                hits = 1;
            }
            if (hits > 0)
            {
                Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit * EnergyMul);
                GroundDecal.Spawn(transform.position + fwd * 2f, GroundDecal.Kind.HitMark);
                RainFollow(); // 109-14-17 뱃노래
            }
            return hits;
        }

        /// <summary>109-14-2 공격 누름 — 활공 중이면 낙하 공격, 아니면 기본 한 타.</summary>
        public int AttackPress()
        {
            if (AimOn) return 0; // 109-14-22 조준 중엔 누르는 동안 충전(TickHold)
            if (player != null && player.Mode == PlayerController.MoveMode.Glide) return TryPlunge() ? 0 : -1;
            return Attack();
        }

        /// <summary>누르고 있는 동안 — 0.4초가 넘으면 강공격 한 번(뗄 때까지 다시 안 나간다). 진단이 직접 부른다.</summary>
        public void TickHold(bool held, float dt)
        {
            if (AimOn) // 109-14-22 누르는 동안 충전, 떼면 쏜다(길게 눌러 들어온 조준이면 쏘고 나온다)
            {
                if (held && !Charging) { Charging = true; AimCharge = 0f; }
                else if (!held && Charging)
                {
                    Charging = false;
                    FireArrow();
                    if (_aimFromHold) ExitAim();
                }
                if (!held) { _holdT = 0f; ChargeFiredThisHold = false; }
                return;
            }
            if (!held) { _holdT = 0f; ChargeFiredThisHold = false; return; }
            _holdT += dt;
            if (ChargeFiredThisHold || _holdT < ChargeHoldSec) return;
            ChargeFiredThisHold = true;
            if (IsBow(Active) && EnterAim()) { _aimFromHold = true; Charging = true; AimCharge = 0f; return; } // 활 인물 — 강공격 대신 조준·충전
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
                float cm = CritMul(Active.Id, out bool crit);
                GoElement cel = Active.InfuseLeft > 0f ? Active.Element : GoElement.Physical; // 109-14-11 원소 부여
                e.TakeHit(atk * ChargeMul * TalentMul(GoTalent.Kind.Normal) * DmgMul(Active.Id, "n", cel) * (Active.InfuseLeft > 0f ? Active.InfuseMul : 1f) * cm, cel, atk * ReactMul, out _, heavy: true, crit: crit);
                hits++;
            }
            if (hits > 0) { Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit * hits); RainFollow(); } // 109-14-17 뱃노래
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
            float atk = Atk, mul = PlungeMul(fallMeters) * TalentMul(GoTalent.Kind.Normal) * (Active != null ? DmgMul(Active.Id, "n", GoElement.Physical) : 1f);
            int hits = 0;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - transform.position).magnitude > PlungeRadius) continue;
                float cm = Active != null ? CritMul(Active.Id, out bool crit) : 1f;
                bool inf = Active != null && Active.InfuseLeft > 0f; // 109-14-11 원소 부여
                e.TakeHit(atk * mul * cm * (inf ? Active.InfuseMul : 1f), inf ? Active.Element : GoElement.Physical, atk, out _, heavy: true, crit: LastCrit);
                hits++;
            }
            if (hits > 0 && Active != null) Active.Energy = Mathf.Min(BurstCost, Active.Energy + EnergyPerHit * hits);
            if (hits > 0) RainFollow(); // 109-14-17 뱃노래
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
            var hk = GoKits.KitOf(m.Id, m.Element); // 109-14-11 고유·갈래 — 지략·도감 밖은 null(109-8 모양)
            if (hk != null) return KitSkillCast(m, hk);
            m.SkillCd = SkillCooldownSec * TalentState.SkillCdMul(m.Id); // 109-14-4 깨달음 ①
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
                    hits = LineHit(pos, end, GoSkillShapes.ThrustWidth, atk * GoSkillShapes.ThrustMul * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), m.Element);
                    FieldLineFx.Spawn(pos, end, GoSkillShapes.ThrustWidth * 2f, fx);
                    ElementPulse?.Invoke((pos + end) * 0.5f, GoSkillShapes.ThrustLen * 0.5f, m.Element);
                    break;
                }
                case SkillShape.Dash:
                {
                    float go = target != null ? Mathf.Min(GoSkillShapes.DashLen, Mathf.Max(0f, aimDist - GoSkillShapes.DashStop)) : GoSkillShapes.DashLen;
                    Vector3 end = pos + dir * go;
                    hits = LineHit(pos, end + dir * GoSkillShapes.DashStop, GoSkillShapes.DashWidth, atk * GoSkillShapes.DashMul * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), m.Element);
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
                        Atk = atk, Element = m.Element, Color = fx, Mul = TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), React = ReactMul };
                    _zones.Add(z);
                    TickZone(z, 0f); // 놓자마자 첫 틱
                    hits = z.Hits;
                    break;
                }
                case SkillShape.Summon:
                {
                    Vector3 c = pos + dir * GoSkillShapes.SummonOffset;
                    var z = new SkillZone { Kind = shape, Owner = m.Id, Center = c, Radius = GoSkillShapes.SummonRadius, Left = GoSkillShapes.SummonSec,
                        Atk = atk, Element = m.Element, Color = fx, Mul = TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), React = ReactMul };
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
                    hits = AreaHit(center, SkillRadius, atk * SkillMul * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), m.Element);
                    FieldRingFx.Spawn(center, SkillRadius, GoElements.ColorOf(m.Element));
                    ElementPulse?.Invoke(center, SkillRadius, m.Element);
                    break;
                }
            }
            if (hits > 0) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerSkillHit * EnergyMul);
            if (shape != SkillShape.Circle)
                FieldDamageText.Spawn(pos + Vector3.up * 5.2f, GoSkillShapes.Name(shape), fx, 1.1f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        /// <summary>선분 둘레 폭 안의 적을 친다(찌르기·돌진).</summary>
        private int LineHit(Vector3 a, Vector3 b, float width, float amount, GoElement el)
        {
            int hits = 0;
            float atk = Atk * ReactMul;
            foreach (var e in Snapshot())
            {
                if (GoSkillShapes.SegDist(e.transform.position, a, b) > width) continue;
                float cm = Active != null ? CritMul(Active.Id, out _) : 1f;
                e.TakeHit(amount * cm, el, atk, out _, crit: LastCrit);
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
                if (z.Kind == SkillShape.KitZone || z.Kind == SkillShape.Vortex)
                {
                    TickKitZone(z); // 109-14-11 진·소용돌이
                    z.Next += z.Every;
                    continue;
                }
                if (z.Kind == SkillShape.Feast)
                {
                    TickFeast(z); // 109-14-17 바람 자리
                    z.Next += z.Every;
                    continue;
                }
                if (z.Kind == SkillShape.Field)
                {
                    int n = 0;
                    foreach (var e in Snapshot())
                    {
                        if (Flat(e.transform.position - z.Center).magnitude > z.Radius) continue;
                        float zc = CritMul(z.Owner, out bool zcrit);
                        e.TakeHit(z.Atk * GoSkillShapes.FieldMul * z.Mul * zc, z.Element, z.Atk * z.React, out _, crit: zcrit);
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
                        float sc = CritMul(z.Owner, out bool scrit);
                        best.TakeHit(z.Atk * GoSkillShapes.SummonMul * z.Mul * sc, z.Element, z.Atk * z.React, out _, crit: scrit);
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
            var hk = GoKits.KitOf(m.Id, m.Element); // 109-14-11
            if (hk != null) return KitBurstCast(m, hk);
            m.Energy = 0f;
            int hits = AreaHit(transform.position, BurstRadius, Atk * BurstMul * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), m.Element);
            if (TalentState.BurstBuff(m.Id)) m.BuffLeft = GoTalent.C5Sec; // 109-14-4 깨달음 ⑤
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
            float atk = Atk * ReactMul;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - center).magnitude > radius) continue;
                float cm = Active != null ? CritMul(Active.Id, out _) : 1f;
                e.TakeHit(amount * cm, el, atk, out _, crit: LastCrit);
                hits++;
            }
            return hits;
        }

        public bool Dodge()
        {
            if (!CanAct() || (player != null && player.IsDashing)) return false;
            if (!GoStamina.TrySpend(DodgeStamina)) return false;
            if (AimOn) ExitAim(); // 109-14-22
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

        private bool CanAct() => Active != null && !Active.Down && !DuelGate.Active && (player == null || player.OnFoot) && !Saga.Go.World.FishingField.Busy; // 107 ② 등반·활공·수영 중엔 못 싸운다 · 109-14-24 낚시 중엔 낚싯대만

        // ---- 피격 --------------------------------------------------------------

        /// <summary>적 판정이 닿았을 때. 회피 무적이면 흘리고 false.</summary>
        // ---- 109-14-18 편성을 막는 "싸우는 중"(웹 ⑲-18 `inCombat`) — 방금(3초 안) 맞히거나 맞았거나, 55.5m(웹 30m × 1.85) 안에
        // 나를 쫓거나 예고·숨 고르는 적. 쉬는 적·제단만 치는 적(곁 SiegePull 밖)은 뺀다. 옛 `WorldMapUi.Fighting`(천하 등급·숨은 터)은 그대로.
        public const float CombatCalmSec = 3f, CombatRadius = 30f * 1.85f;

        /// <summary>적이 맞았을 때(`FieldEnemy.TakeHit`)·내가 맞았을 때 — 방금 싸움.</summary>
        public void MarkFought() => _calmT = 0f;

        public bool InCombat()
        {
            if (_calmT < CombatCalmSec) return true;
            Vector3 p = transform.position;
            foreach (var e in FieldEnemy.All)
            {
                if (e == null || !e.Alive || !e.isActiveAndEnabled) continue;
                var st = e.CurrentState;
                if (st != FieldEnemy.State.Chase && st != FieldEnemy.State.Telegraph && st != FieldEnemy.State.Recover) continue;
                float d = Flat(e.transform.position - p).magnitude;
                if (d > CombatRadius || (e.Siege.HasValue && d > FieldEnemy.SiegePull)) continue;
                return true;
            }
            return false;
        }

        /// <summary>편성 막기 — 들판 전투가 없으면(다른 씬) 옛 판정.</summary>
        public static bool FormationBusy() => Instance != null ? Instance.InCombat() : Saga.Go.UI.WorldMapUi.Fighting();

        public bool ReceiveStrike(float enemyAtk, FieldEnemy from)
        {
            _calmT = 0f; // 109-14-18
            var m = Active;
            if (m == null || m.Down) return false;
            if (Invulnerable)
            {
                FieldDamageText.Spawn(transform.position + Vector3.up * 4f, GoLocalization.T("field.evade", "회피!"), new Color(0.7f, 0.95f, 1f), 1.1f);
                return false;
            }
            float dmg = enemyAtk * 200f / (200f + Mathf.Max(0f, ActiveDef)) * (WardLeft > 0f ? WardMul : 1f); // 109-14-11 맹세
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
            Vector3 me = Instance != null ? Instance.transform.position : Vector3.zero;
            foreach (var e in FieldEnemy.All) if (e.Alive && GoStory.SameLayer(e.transform.position, me)) list.Add(e); // 109-14-20 층이 다른 적은 못 친다
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

        /// <summary>109-14-6 요리를 먹는다(가장 좋은 품질부터) — 회복은 들판 명단에(한 사람 = 체력 비율 가장 낮은 사람, 되살리기 = 쓰러진 첫 사람), 버프는 계열마다 하나.
        /// 성공하면 알림 글, 못 먹으면 null 과 까닭.</summary>
        public string Eat(int ri, out string why)
        {
            why = null;
            int q = ri >= 0 && ri < GoCooking.Recipes.Length ? CookState.BestDish(ri) : -1;
            if (q < 0) { why = GoLocalization.T("cook.why.no_dish", "요리가 없다"); return null; }
            var r = GoCooking.Recipes[ri];
            string text;
            if (r.Effect == GoCooking.Effect.Buff)
            {
                CookState.SetBuff(ri, q);
                text = GoCooking.EffectText(r, q);
            }
            else if (r.Effect == GoCooking.Effect.HealAll)
            {
                bool any = false;
                foreach (var m in _party)
                {
                    if (m.Down) continue;
                    m.Hp = Mathf.Min(m.MaxHp, m.Hp + m.MaxHp * r.Ratio[q]);
                    any = true;
                }
                if (!any) { why = GoLocalization.T("cook.why.nobody", "먹일 사람이 없다"); return null; }
                text = GoLocalization.T("cook.healed_all", "명단 모두 체력 회복");
            }
            else
            {
                Member m = null;
                foreach (var o in _party)
                {
                    if (r.Effect == GoCooking.Effect.Revive) { if (o.Down) { m = o; break; } }
                    else if (!o.Down && (m == null || o.Hp / o.MaxHp < m.Hp / m.MaxHp)) m = o;
                }
                if (m == null)
                {
                    why = r.Effect == GoCooking.Effect.Revive ? GoLocalization.T("cook.why.no_down", "쓰러진 사람이 없다") : GoLocalization.T("cook.why.nobody", "먹일 사람이 없다");
                    return null;
                }
                if (!CookState.TryFeed(m.Id)) { why = string.Format(GoLocalization.T("cook.why.full", "{0} 배가 부르다"), m.Name); return null; }
                if (r.Effect == GoCooking.Effect.Revive)
                {
                    m.Hp = Mathf.Max(1f, m.MaxHp * r.Ratio[q]);
                    text = string.Format(GoLocalization.T("cook.revived", "{0} 일어났다"), m.Name);
                }
                else
                {
                    m.Hp = Mathf.Min(m.MaxHp, m.Hp + m.MaxHp * r.Ratio[q] + GoCooking.HealFlat(r, q));
                    text = string.Format(GoLocalization.T("cook.healed", "{0} 체력 회복"), m.Name);
                }
            }
            CookState.UseDish(ri, q);
            return GoCooking.DishName(r.Id, q) + " — " + text;
        }

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
            _calmT = 999f; // 109-14-18
            BurnTicksLeft = 0;
            GuardHp = GuardMax = GuardLeft = 0f;
            _seeds.Clear();
            ClearZones();
            RallyLeft = WardLeft = HasteLeft = 0f; // 109-14-11
            LoreLeft = 0f; // 109-14-15
            _echoes.Clear();
            RainLeft = RainCd = 0f; RainHits = 0; _rainKit = null; // 109-14-17
            if (AimOn) ExitAim(); // 109-14-22
            ClearArrows();
            _shells.Clear();
            foreach (var m in _party) m.InfuseLeft = 0f;
            ApplyLook();
        }

        // ---- 109-14-11 고유·갈래 스킬·해방(웹 사가고 ⑲-11 `kitSkill`·`kitBurst`) ----

        private void HealParty(float frac)
        {
            foreach (var o in _party) if (!o.Down) o.Hp = Mathf.Min(o.MaxHp, o.Hp + o.MaxHp * frac);
        }

        private void EnergyOthers(Member m, float web)
        {
            foreach (var o in _party) if (o != m && !o.Down) o.Energy = Mathf.Min(BurstCost, o.Energy + web * GoKits.EnergyScale);
        }

        private int KitSkillCast(Member m, HeroKit hk)
        {
            var s = hk.Skill;
            LastKit = hk;
            m.SkillCd = Mathf.Max(1f, s.Cd) * TalentState.SkillCdMul(m.Id);
            const float D = GoKits.Dist;
            float reach = s.Type == KitSkillType.Shells || s.Type == KitSkillType.Blink ? s.Reach * D : Mathf.Max(AutoFaceRadius * 1.5f, s.Len * D);
            var target = Nearest(reach);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            Vector3 pos = transform.position, dir = Forward();
            float aimDist = 0f;
            if (target != null)
            {
                Vector3 d = Flat(target.transform.position - pos);
                aimDist = d.magnitude;
                if (aimDist > 0.01f) dir = d / aimDist;
            }
            Color fx = GoSkillShapes.FxColor(m.Id, m.Element);
            float atk = Atk;
            float amount = atk * s.Mul * GoKits.SkillScale * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element);
            int hits = 0;
            switch (s.Type)
            {
                case KitSkillType.Dash:
                {
                    float len = s.Len * D, w = s.W * D, stop = 1.2f * D;
                    float go = target != null ? Mathf.Min(len, Mathf.Max(0f, aimDist - stop)) : len;
                    Vector3 end = pos + dir * go;
                    hits = LineHit(pos, end + dir * stop, w, amount, m.Element);
                    InvulnLeft = Mathf.Max(InvulnLeft, GoSkillShapes.DashInvulnSec);
                    if (player != null && go > 0.05f) player.Dash(dir, go, GoSkillShapes.DashSec);
                    FieldLineFx.Spawn(pos, end + dir * stop, w * 2f, fx, 0.45f);
                    ElementPulse?.Invoke(end, w * 2f, m.Element);
                    break;
                }
                case KitSkillType.Shells:
                {
                    var foes = new List<FieldEnemy>(Snapshot());
                    foes.RemoveAll(e => Flat(e.transform.position - pos).magnitude > s.Reach * D);
                    foes.Sort((a, b) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(b.transform.position - pos).sqrMagnitude));
                    var spots = new List<Vector3>();
                    for (int i = 0; i < foes.Count && i < s.N; i++) spots.Add(foes[i].transform.position);
                    if (spots.Count == 0) spots.Add(pos + dir * 8f * D);
                    foreach (var p in spots)
                    {
                        _shells.Add((p, s.Delay, s.R * D, amount, m.Element, fx));
                        FieldRingFx.Spawn(p, s.R * D, fx, s.Delay);
                    }
                    hits = foes.Count > 0 ? Mathf.Min(foes.Count, s.N) : 0;
                    break;
                }
                case KitSkillType.Guard:
                {
                    hits = AreaHit(pos, s.R * D, amount, m.Element);
                    float shield = m.MaxHp * (s.Shield + s.ShieldAdd);
                    GuardMax = Mathf.Max(shield, GuardHp);
                    GuardHp = Mathf.Max(shield, GuardHp);
                    GuardLeft = Mathf.Max(GuardLeft, s.Sec);
                    FieldRingFx.Spawn(pos, s.R * D, fx, 0.6f);
                    FieldRingFx.Spawn(pos, 2.2f, GoElements.ColorOf(GoElement.Geo), 0.5f);
                    ElementPulse?.Invoke(pos, s.R * D, m.Element);
                    break;
                }
                case KitSkillType.Zone:
                {
                    var z = new SkillZone { Kind = SkillShape.KitZone, Owner = m.Id, Center = pos, Radius = s.R * D, Left = s.Sec, Atk = atk, Element = m.Element, Color = fx,
                        Mul = s.Mul * GoKits.SkillScale * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), React = ReactMul,
                        Every = s.Every, N = s.N, EnergyPerHit = s.Energy * GoKits.EnergyScale };
                    _zones.Add(z);
                    TickZone(z, 0f);
                    hits = z.Hits;
                    break;
                }
                case KitSkillType.Blink:
                {
                    // 109-14-15 그림자 걸음 — 가까운 적을 지나 그 뒤로 건너뛰어(무적) 도착 둘레를 베고, 그 적에 표식. 적이 없으면 앞으로.
                    Vector3 dest = target != null ? target.transform.position + dir * s.Back * D : pos + dir * s.Len * D;
                    if (!BlinkOk(pos, ref dest) && target != null)
                    {
                        dest = target.transform.position - dir * 1.2f * D; // 뒤가 벼랑·물이면 앞에 선다
                        if (!BlinkOk(pos, ref dest)) dest = pos;
                    }
                    InvulnLeft = Mathf.Max(InvulnLeft, GoSkillShapes.DashInvulnSec);
                    if (player != null && Flat(dest - pos).sqrMagnitude > 0.01f) player.Teleport(dest + Vector3.up * 0.1f);
                    hits = AreaHit(dest, s.R * D, amount, m.Element);
                    if (target != null && target.Alive) target.Mark(s.Mark, s.MarkMul);
                    FieldLineFx.Spawn(pos, dest, 1.2f, fx, 0.35f);
                    FieldRingFx.Spawn(dest, s.R * D, fx, 0.5f);
                    ElementPulse?.Invoke(dest, s.R * D, m.Element);
                    break;
                }
                case KitSkillType.Gust:
                {
                    // 109-14-17 부채 바람 — 앞 R 부채꼴(내적 Arc 이상)을 치고 나에게서 먼 쪽으로 밀어낸다. 명단 회복은 아래 s.Heal
                    float r = s.R * D, ra = Atk * ReactMul;
                    foreach (var e in Snapshot())
                    {
                        Vector3 d = Flat(e.transform.position - pos);
                        float dl = d.magnitude;
                        if (dl > r || (dl >= 0.5f && Vector3.Dot(d / dl, dir) < s.Arc)) continue;
                        float cm = CritMul(m.Id, out bool crit);
                        e.TakeHit(amount * cm, m.Element, ra, out _, crit: crit);
                        e.KnockBack(dl >= 0.5f ? d : dir, s.Knock * D);
                        hits++;
                    }
                    float half = Mathf.Acos(s.Arc) * Mathf.Rad2Deg;
                    Vector3 up = Vector3.up * 0.4f;
                    foreach (float a in new[] { -half, -half * 0.5f, 0f, half * 0.5f, half })
                        FieldLineFx.Spawn(pos + up, pos + up + Quaternion.Euler(0f, a, 0f) * dir * r, 0.6f, fx, 0.4f);
                    FieldRingFx.Spawn(pos + dir * r * 0.5f, r * 0.5f, fx, 0.5f);
                    ElementPulse?.Invoke(pos + dir * r * 0.5f, r * 0.5f, m.Element);
                    break;
                }
                case KitSkillType.Wave:
                {
                    // 109-14-17 노 물결 — 앞으로 Len·폭 W 의 길을 치고 앞으로 밀어낸다(나는 제자리)
                    Vector3 end = pos + dir * s.Len * D;
                    float w = s.W * D, ra = Atk * ReactMul;
                    foreach (var e in Snapshot())
                    {
                        if (GoSkillShapes.SegDist(e.transform.position, pos, end) > w) continue;
                        float cm = CritMul(m.Id, out bool crit);
                        e.TakeHit(amount * cm, m.Element, ra, out _, crit: crit);
                        e.KnockBack(dir, s.Knock * D);
                        hits++;
                    }
                    FieldLineFx.Spawn(pos + Vector3.up * 0.3f, end + Vector3.up * 0.3f, w * 2f, fx, 0.5f);
                    FieldRingFx.Spawn(end, w, fx, 0.4f);
                    ElementPulse?.Invoke(end, w * 2f, m.Element);
                    break;
                }
            }
            if (s.Heal > 0f) HealParty(s.Heal);
            if (s.Team > 0f) EnergyOthers(m, s.Team);
            if (hits > 0) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerSkillHit * EnergyMul);
            FieldDamageText.Spawn(pos + Vector3.up * 5.2f, s.Name, fx, 1.1f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        private int KitBurstCast(Member m, HeroKit hk)
        {
            var b = hk.Burst;
            LastKit = hk;
            m.Energy = 0f;
            const float D = GoKits.Dist;
            Vector3 pos = transform.position;
            Color fx = GoSkillShapes.FxColor(m.Id, m.Element);
            int hits = AreaHit(pos, b.R * D, Atk * b.Mul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), m.Element);
            switch (b.Type)
            {
                case KitBurstType.Infuse: m.InfuseLeft = b.Sec; m.InfuseMul = b.NMul; break;
                case KitBurstType.Rally: RallyLeft = b.Sec; RallyMul = b.Atk; break;
                case KitBurstType.Ward: WardLeft = b.Sec; WardMul = b.Taken; break;
                case KitBurstType.Haste: HasteLeft = b.Sec; EnergyOthers(m, b.Energy); break;
                case KitBurstType.Lore: LoreLeft = b.Sec; LoreMul = b.RMul; break; // 109-14-15 옛 글자 풀이
                case KitBurstType.Echo:
                {
                    // 109-14-15 가면 벗기 — reach 안 표식 난 적마다 every 초 간격 메아리 N(적을 따라감), 표식 난 적이 없으면 가까운 둘
                    var near = new List<FieldEnemy>(Snapshot());
                    near.RemoveAll(e => Flat(e.transform.position - pos).magnitude > b.Reach * D);
                    near.Sort((a, c) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(c.transform.position - pos).sqrMagnitude));
                    var marked = near.FindAll(e => e.MarkLeft > 0f);
                    var tgs = marked.Count > 0 ? marked : near.GetRange(0, Mathf.Min(2, near.Count));
                    float amount = Atk * b.EMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element);
                    foreach (var e in tgs)
                        for (int k = 1; k <= b.N; k++) _echoes.Add((e, b.Every * k, amount, m.Element, fx));
                    break;
                }
                case KitBurstType.Feast:
                    // 109-14-17 잔칫날 순풍 — 발밑 바람 자리, 첫 틱은 Every 초 뒤
                    _zones.Add(new SkillZone { Kind = SkillShape.Feast, Owner = m.Id, Center = pos, Radius = b.R * D, Left = b.Sec, Next = b.Every, Every = b.Every, Atk = Atk, Element = m.Element, Color = fx,
                        Mul = b.EMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), React = ReactMul, Heal = b.FHeal });
                    break;
                case KitBurstType.Rain:
                    // 109-14-17 뱃노래 — 값은 놓은 사람 것으로 굳힌다(교체해도 그 사람 공격력·원소)
                    RainLeft = b.Sec; RainCd = 0f; _rainKit = b; _rainOwner = m.Id; _rainEl = m.Element; _rainColor = fx;
                    _rainAmount = Atk * b.RMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element);
                    break;
                case KitBurstType.Vortex:
                {
                    Vector3 c = pos + Forward() * b.Ahead * D;
                    var z = new SkillZone { Kind = SkillShape.Vortex, Owner = m.Id, Center = c, Radius = b.Pull * D, Left = b.Sec, Atk = Atk, Element = m.Element, Color = fx,
                        Mul = b.Tick * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), React = ReactMul,
                        Every = b.Every, Pull = b.Pull * D };
                    _zones.Add(z);
                    FieldRingFx.Spawn(c, z.Radius, fx, 0.8f);
                    break;
                }
            }
            if (b.Heal > 0f) HealParty(b.Heal);
            if (b.Team > 0f) EnergyOthers(m, b.Team);
            if (TalentState.BurstBuff(m.Id)) m.BuffLeft = GoTalent.C5Sec; // 109-14-4 깨달음 ⑤
            FieldRingFx.Spawn(pos, b.R * D, fx, 0.7f);
            FieldRingFx.Spawn(pos, b.R * D * 0.6f, Color.white, 0.5f);
            ElementPulse?.Invoke(pos, b.R * D, m.Element);
            ToastLine(string.Format(GoLocalization.T("field.burst_named", "{0} — {1}!"), m.Name, b.Name), 1.5f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        /// <summary>109-14-15 그림자 걸음 도착 자리 — 땅에 앉히고, 물·높이 차 3m 넘는 곳(벼랑 아래·고원 위)이면 안 된다.</summary>
        private static bool BlinkOk(Vector3 from, ref Vector3 dest)
        {
            dest = FolkWalker.Grounded(dest + Vector3.up * 1.5f);
            var (gx, gy) = TestMapData.WorldToGrid(dest);
            return !TestMapData.IsWater(TestMapData.TileAt(gx, gy)) && Mathf.Abs(dest.y - from.y) < 3f;
        }

        /// <summary>진 — 가까운 적 N 을 치고 맞힐 때마다 명단 기력 · 소용돌이 — 반경 안 적을 가운데로 끌며 친다.</summary>
        private void TickKitZone(SkillZone z)
        {
            var foes = new List<FieldEnemy>();
            foreach (var e in Snapshot()) if (Flat(e.transform.position - z.Center).magnitude <= z.Radius) foes.Add(e);
            foes.Sort((a, b) => Flat(a.transform.position - z.Center).sqrMagnitude.CompareTo(Flat(b.transform.position - z.Center).sqrMagnitude));
            int n = 0;
            foreach (var e in foes)
            {
                if (z.Kind == SkillShape.KitZone && n >= z.N) break;
                if (z.Kind == SkillShape.Vortex) e.PullToward(z.Center, z.Pull * 0.35f);
                float cm = CritMul(z.Owner, out bool crit);
                e.TakeHit(z.Atk * z.Mul * cm, z.Element, z.Atk * z.React, out _, crit: crit);
                n++;
            }
            z.Hits += n;
            if (z.Kind == SkillShape.KitZone && n > 0)
                foreach (var o in _party) if (!o.Down) o.Energy = Mathf.Min(BurstCost, o.Energy + z.EnergyPerHit * n);
            FieldRingFx.Spawn(z.Center, z.Radius, z.Color, 0.5f);
            ElementPulse?.Invoke(z.Center, z.Radius, z.Element);
        }

        /// <summary>109-14-17 바람 자리 한 틱 — 안에 선 지금 인물 회복, 안의 적을 친다.</summary>
        private void TickFeast(SkillZone z)
        {
            var a = Active;
            if (a != null && !a.Down && Flat(transform.position - z.Center).magnitude <= z.Radius)
            {
                a.Hp = Mathf.Min(a.MaxHp, a.Hp + a.MaxHp * z.Heal);
                z.Heals++;
            }
            int n = 0;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - z.Center).magnitude > z.Radius) continue;
                float cm = CritMul(z.Owner, out bool crit);
                e.TakeHit(z.Atk * z.Mul * cm, z.Element, z.Atk * z.React, out _, crit: crit);
                n++;
            }
            z.Hits += n;
            FieldRingFx.Spawn(z.Center, z.Radius, z.Color, 0.5f);
            FieldRingFx.Spawn(z.Center, z.Radius * 0.45f, Color.Lerp(z.Color, Color.white, 0.5f), 0.4f);
            ElementPulse?.Invoke(z.Center, z.Radius, z.Element);
        }

        /// <summary>109-14-17 뱃노래 따라 치기 — 기본·강·낙하 공격이 맞은 뒤 부른다. 쉼이 끝났으면 Reach 안 가까운 N 에 물 노 한 대씩. 친 수.</summary>
        private int RainFollow()
        {
            var k = _rainKit;
            if (RainLeft <= 0f || RainCd > 0f || k == null) return 0;
            Vector3 pos = transform.position;
            var tg = new List<FieldEnemy>(Snapshot());
            tg.RemoveAll(e => Flat(e.transform.position - pos).magnitude > k.Reach * GoKits.Dist);
            if (tg.Count == 0) return 0;
            tg.Sort((a, c) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(c.transform.position - pos).sqrMagnitude));
            RainCd = k.Gap;
            int n = Mathf.Min(k.N, tg.Count);
            for (int i = 0; i < n; i++)
            {
                var e = tg[i];
                float cm = CritMul(_rainOwner, out bool crit);
                e.TakeHit(_rainAmount * cm, _rainEl, Atk * ReactMul, out _, crit: crit);
                FieldLineFx.Spawn(pos + Vector3.up * 2.2f, e.transform.position + Vector3.up * 1.2f, 0.45f, _rainColor, 0.3f);
                FieldRingFx.Spawn(e.transform.position, 1.2f * GoKits.Dist, _rainColor, 0.3f);
            }
            RainHits += n;
            return n;
        }

        // ---- PLAN.md 109-14-22 활 조준 사격(웹 사가고 ⑲-22) — 활 인물만 R(🎯): 제자리·어깨 너머, 방향 입력이 겨눈 쪽을 돌린다(초당 2.4 라디안).
        // 겨눈 쪽 ±0.16 라디안·74m(웹 40m × 1.85) 안의 적·상자 과녁·상자 석등·이야기 석등·제단에 저절로 잠김. 누르는 동안 충전, 떼면 쏜다.
        // 화살 초속 111m·사거리 83m(웹 60·45 × 1.85), 1.4초 다 차면 인물 원소 ×1.25, 덜 차면 물리 ×0.45(원소 부여면 그 원소). 다 찬 화살이
        // 아직 나를 모르는 적(쫓기·예고·숨 고르기가 아님)에 박히면 반드시 치명(급소 — 세로 조준이 없는 판이라 머리 대신 기습 저격).
        // 충전 화살이 멈춘 자리 2.2m 는 원소 신호(멀리서 석등·제단을 켠다). 웹과 같게 세로 조준·지형 가림은 뺐다(잠긴 점으로 곧장 난다).
        public const float AimTurnRad = 2.4f, AimLockRad = 0.16f, AimRange = 74f, ArrowSpeed = 111f, ArrowRange = 83f, AimChargeSec = 1.4f,
            ArrowFullMul = 1.25f, ArrowWeakMul = 0.45f, ArrowSignalR = 2.2f, ArrowBodyR = 1.3f;
        public enum AimKind { None, Enemy, Target, Point }
        public struct AimLockInfo
        {
            public AimKind Kind;
            public FieldEnemy Enemy;
            public Saga.Go.World.TreasureChest Chest;
            public int Index;
            public Vector3 Point;
        }
        private class Arrow
        {
            public Vector3 Pos, Dir;
            public float Left, Amount, React;
            public GoElement El;
            public bool Full;
            public string Owner;
            public FieldEnemy Target;
            public bool HasStop;
            public Vector3 Stop;
            public Saga.Go.World.TreasureChest Chest;
            public int Index = -1;
            public GameObject Vis;
        }
        public bool AimOn { get; private set; }
        public float AimYaw { get; private set; }
        public float AimCharge { get; private set; }
        public bool Charging { get; private set; }
        public AimLockInfo AimLock { get; private set; }
        public int ArrowCount => _arrows.Count;
        /// <summary>진단 — 마지막 화살 끝: "enemy" · "target" · "point" · "miss", 급소였나.</summary>
        public string LastArrow { get; private set; }
        public bool LastSneak { get; private set; }
        private readonly List<Arrow> _arrows = new List<Arrow>();
        private bool _aimFromHold;
        private LineRenderer _lockRing;
        private Saga.Go.Player.CameraRig _rig;
        private Saga.Go.Player.CameraRig Rig => _rig != null ? _rig : (_rig = GetComponentInChildren<Saga.Go.Player.CameraRig>());

        public static bool IsBow(Member m) => m != null && WeaponState.ModsOf(m.Id).Weapon.Type == GoWeapons.Type.Bow;
        public bool CanAim => CanAct() && IsBow(Active) && !StoryState.Talking && (player == null || !player.IsDashing);
        public Vector3 AimDir => Quaternion.Euler(0f, AimYaw, 0f) * Vector3.forward;

        public bool ToggleAim() { if (AimOn) { ExitAim(); return false; } return EnterAim(); }

        /// <summary>그 점 쪽으로 겨눈다(진단·지도 표식 누르기 등).</summary>
        public void AimToward(Vector3 p)
        {
            if (!AimOn) return;
            Vector3 d = p - transform.position;
            d.y = 0f;
            if (d.sqrMagnitude < 0.01f) return;
            AimYaw = Quaternion.LookRotation(d).eulerAngles.y;
            Rig?.SetAim(true, AimYaw);
            UpdateLock();
        }

        public bool EnterAim()
        {
            if (AimOn) return true;
            if (!CanAim) return false;
            AimOn = true;
            _aimFromHold = false;
            Charging = false;
            AimCharge = 0f;
            Vector3 f = player != null && player.Visual != null ? player.Visual.forward : transform.forward;
            f.y = 0f;
            AimYaw = f.sqrMagnitude > 0.001f ? Quaternion.LookRotation(f).eulerAngles.y : 0f;
            if (player != null) { player.MoveLocked = true; player.AimCancelled = false; }
            Rig?.SetAim(true, AimYaw);
            UpdateLock();
            return true;
        }

        public void ExitAim()
        {
            if (!AimOn) return;
            AimOn = false;
            Charging = false;
            _aimFromHold = false;
            AimCharge = 0f;
            AimLock = default;
            if (player != null) player.MoveLocked = false;
            Rig?.SetAim(false);
            if (_lockRing != null) _lockRing.enabled = false;
        }

        /// <summary>한 박자(프레임마다 · 진단도 부른다) — turn = 좌우 입력(−1~1).</summary>
        public void TickAim(float dt, float turn)
        {
            if (!AimOn) return;
            if ((player != null && player.AimCancelled) || !CanAim) { if (player != null) player.AimCancelled = false; ExitAim(); return; }
            AimYaw = Mathf.Repeat(AimYaw + turn * AimTurnRad * Mathf.Rad2Deg * dt, 360f);
            Rig?.SetAim(true, AimYaw);
            if (player != null) player.FaceToward(transform.position + AimDir * 5f);
            if (Charging) AimCharge = Mathf.Min(AimChargeSec, AimCharge + dt);
            UpdateLock();
        }

        /// <summary>겨눈 쪽 ±0.16 라디안·74m 안 가장 곧은 것에 잠근다(같은 층의 적 · 상자 과녁 · 상자 석등 · 이야기 석등·제단).</summary>
        private void UpdateLock()
        {
            Vector3 o = transform.position, dir = AimDir;
            var best = new AimLockInfo();
            float bestA = AimLockRad, bestD = float.MaxValue;
            void Consider(Vector3 p, AimLockInfo info)
            {
                Vector3 v = p - o;
                v.y = 0f;
                float d = v.magnitude;
                if (d < 1f || d > AimRange) return;
                float a = Mathf.Acos(Mathf.Clamp(Vector3.Dot(v / d, dir), -1f, 1f));
                if (a < bestA - 1e-4f || (Mathf.Abs(a - bestA) <= 1e-4f && d < bestD)) { bestA = a; bestD = d; info.Point = p; best = info; }
            }
            foreach (var e in Snapshot()) Consider(e.transform.position + Vector3.up * 1.2f, new AimLockInfo { Kind = AimKind.Enemy, Enemy = e });
            var b = Saga.Go.World.WorldMapBuilder.Instance;
            if (b != null)
                foreach (var c in b.Chests)
                {
                    if (c == null || c.Opened || c.Unlocked) continue;
                    for (int i = 0; i < c.Targets.Count; i++) Consider(c.TargetEye(i), new AimLockInfo { Kind = AimKind.Target, Chest = c, Index = i });
                    foreach (var t in c.Torches) if (t != null && !t.Lit) Consider(t.transform.position + Vector3.up * 1.5f, new AimLockInfo { Kind = AimKind.Point });
                }
            var sf = Saga.Go.World.StoryField.Instance;
            if (sf != null) foreach (var p in sf.AimPoints()) Consider(p, new AimLockInfo { Kind = AimKind.Point });
            AimLock = best;
            ShowLockRing();
        }

        private void ShowLockRing()
        {
            if (AimLock.Kind == AimKind.None) { if (_lockRing != null) _lockRing.enabled = false; return; }
            if (_lockRing == null)
            {
                var go = new GameObject("AimLockRing");
                _lockRing = go.AddComponent<LineRenderer>();
                _lockRing.useWorldSpace = false;
                _lockRing.loop = true;
                _lockRing.positionCount = 24;
                _lockRing.widthMultiplier = 0.12f;
                _lockRing.material = new Material(Shader.Find("Sprites/Default")) { name = "AimLock (generated)" };
                _lockRing.startColor = _lockRing.endColor = new Color(1f, 0.82f, 0.3f, 0.95f);
                _lockRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                for (int k = 0; k < 24; k++)
                {
                    float a = k * Mathf.PI * 2f / 24f;
                    _lockRing.SetPosition(k, new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f) * 0.9f);
                }
            }
            _lockRing.enabled = true;
            _lockRing.transform.position = AimLock.Point;
            var cam = Camera.main;
            if (cam != null) _lockRing.transform.rotation = Quaternion.LookRotation(AimLock.Point - cam.transform.position);
        }

        /// <summary>쏜다 — 잠긴 점으로(적이면 따라간다), 없으면 겨눈 쪽으로. 쏜 화살 수(0 = 못 쏨).</summary>
        public int FireArrow()
        {
            var m = Active;
            if (m == null || m.Down) return 0;
            bool full = AimCharge >= AimChargeSec - 1e-4f;
            AimCharge = 0f;
            GoElement el = full || m.InfuseLeft > 0f ? m.Element : GoElement.Physical;
            float amount = Atk * (full ? ArrowFullMul : ArrowWeakMul) * TalentMul(GoTalent.Kind.Normal) * DmgMul(m.Id, "n", el) * (m.InfuseLeft > 0f ? m.InfuseMul : 1f);
            Vector3 o = transform.position + Vector3.up * 1.6f;
            var lk = AimLock;
            Vector3 aimAt = lk.Kind != AimKind.None ? lk.Point : o + AimDir * ArrowRange;
            var a = new Arrow { Pos = o, Dir = (aimAt - o).normalized, Left = ArrowRange, Amount = amount, React = Atk * ReactMul, El = el, Full = full, Owner = m.Id,
                Target = lk.Kind == AimKind.Enemy ? lk.Enemy : null, HasStop = lk.Kind == AimKind.Target || lk.Kind == AimKind.Point, Stop = lk.Point, Chest = lk.Chest, Index = lk.Index };
            var vis = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            vis.name = "Arrow";
            Destroy(vis.GetComponent<Collider>());
            vis.transform.localScale = new Vector3(0.08f, 0.7f, 0.08f);
            var col = full ? GoElements.ColorOf(el) : new Color(0.85f, 0.8f, 0.7f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Arrow (generated)", color = col };
            if (full) { mat.EnableKeyword("_EMISSION"); mat.SetColor("_EmissionColor", col * 2f); }
            vis.GetComponent<MeshRenderer>().sharedMaterial = mat;
            a.Vis = vis;
            PlaceArrow(a);
            _arrows.Add(a);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return 1;
        }

        private static void PlaceArrow(Arrow a)
        {
            if (a.Vis == null) return;
            a.Vis.transform.position = a.Pos;
            a.Vis.transform.rotation = Quaternion.FromToRotation(Vector3.up, a.Dir);
        }

        private void TickArrows(float dt)
        {
            for (int i = _arrows.Count - 1; i >= 0; i--)
            {
                var a = _arrows[i];
                if (a.Target != null && a.Target.Alive) a.Dir = (a.Target.transform.position + Vector3.up * 1.2f - a.Pos).normalized; // 잠긴 적을 따라간다
                float step = Mathf.Min(ArrowSpeed * dt, a.Left);
                Vector3 next = a.Pos + a.Dir * step;
                bool done = false;
                if (a.HasStop && Vector3.Distance(a.Pos, a.Stop) <= step + 1e-3f) { Land(a, a.Stop); done = true; }
                else
                {
                    FieldEnemy hit = null;
                    float hitT = float.MaxValue;
                    foreach (var e in Snapshot())
                    {
                        Vector3 c = e.transform.position + Vector3.up * 1.2f;
                        float t = Mathf.Clamp01(Vector3.Dot(c - a.Pos, a.Dir) / Mathf.Max(step, 1e-4f));
                        float r = Mathf.Max(ArrowBodyR, e.transform.lossyScale.y * 0.9f);
                        if (Vector3.Distance(a.Pos + a.Dir * step * t, c) <= r && t < hitT) { hitT = t; hit = e; }
                    }
                    if (hit != null) { HitArrow(a, hit); done = true; }
                    else
                    {
                        a.Pos = next;
                        a.Left -= step;
                        if (a.Left <= 1e-3f) { Land(a, a.Pos); done = true; }
                    }
                }
                if (done) { if (a.Vis != null) Destroy(a.Vis); _arrows.RemoveAt(i); }
                else PlaceArrow(a);
            }
        }

        private void HitArrow(Arrow a, FieldEnemy e)
        {
            var st = e.CurrentState;
            bool sneak = a.Full && st != FieldEnemy.State.Chase && st != FieldEnemy.State.Telegraph && st != FieldEnemy.State.Recover;
            bool crit;
            float cm;
            if (sneak)
            {
                var md = WeaponState.ModsOf(a.Owner);
                var ab = ArtifactState.BonusOf(a.Owner);
                crit = true;
                cm = 1f + md.CritDmg + ab.CritDmg + CookState.Buff("crit_dmg"); // 급소 — 반드시 치명
            }
            else cm = CritMul(a.Owner, out crit);
            e.TakeHit(a.Amount * cm, a.El, a.React, out _, crit: crit);
            if (sneak) FieldDamageText.Spawn(e.transform.position + Vector3.up * 5f, GoLocalization.T("field.sneak", "급소!"), new Color(1f, 0.85f, 0.3f), 1.2f);
            var m = Active;
            if (m != null && m.Id == a.Owner) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerHit * EnergyMul);
            RainFollow();
            FieldRingFx.Spawn(e.transform.position, 1.2f, a.Full ? GoElements.ColorOf(a.El) : Color.white, 0.3f);
            LastArrow = "enemy";
            LastSneak = sneak;
        }

        /// <summary>화살이 멈춘 자리 — 과녁이면 맞히고, 충전 화살이면 원소 신호.</summary>
        private void Land(Arrow a, Vector3 p)
        {
            LastSneak = false;
            LastArrow = "miss";
            if (a.Chest != null && a.Index >= 0) { a.Chest.HitTarget(a.Index); LastArrow = "target"; }
            else if (a.HasStop) LastArrow = "point";
            if (a.Full)
            {
                FieldRingFx.Spawn(p, ArrowSignalR, GoElements.ColorOf(a.El), 0.5f);
                ElementPulse?.Invoke(p, ArrowSignalR, a.El);
            }
        }

        private void ClearArrows()
        {
            foreach (var a in _arrows) if (a.Vis != null) Destroy(a.Vis);
            _arrows.Clear();
        }

        /// <summary>서책·활 기본 공격이 적 없이 나가면 사거리 안 가장 가까운 과녁(안 풀린 상자). 맞혔으면 true.</summary>
        private bool HitNearestTarget(float range)
        {
            var b = Saga.Go.World.WorldMapBuilder.Instance;
            if (b == null || range <= 0f) return false;
            Saga.Go.World.TreasureChest bc = null;
            int bi = -1;
            float bd = range;
            foreach (var c in b.Chests)
            {
                if (c == null || c.Opened || c.Unlocked) continue;
                for (int i = 0; i < c.Targets.Count; i++)
                {
                    float d = Flat(c.TargetEye(i) - transform.position).magnitude;
                    if (d <= bd) { bd = d; bc = c; bi = i; }
                }
            }
            if (bc == null) return false;
            if (player != null) player.FaceToward(bc.TargetEye(bi));
            FieldLineFx.Spawn(transform.position + Vector3.up * 1.6f, bc.TargetEye(bi), 0.25f, Color.white, 0.2f);
            bc.HitTarget(bi);
            return true;
        }

        private void TickKitEffects(float dt)
        {
            if (RainLeft > 0f) RainLeft = Mathf.Max(0f, RainLeft - dt); // 109-14-17 뱃노래
            if (RainCd > 0f) RainCd = Mathf.Max(0f, RainCd - dt);
            if (RallyLeft > 0f) RallyLeft = Mathf.Max(0f, RallyLeft - dt);
            if (WardLeft > 0f) WardLeft = Mathf.Max(0f, WardLeft - dt);
            if (HasteLeft > 0f) HasteLeft = Mathf.Max(0f, HasteLeft - dt);
            if (LoreLeft > 0f) LoreLeft = Mathf.Max(0f, LoreLeft - dt);
            for (int i = _echoes.Count - 1; i >= 0; i--)
            {
                var ec = _echoes[i];
                ec.left -= dt;
                if (ec.left > 0f) { _echoes[i] = ec; continue; }
                _echoes.RemoveAt(i);
                if (ec.target == null || !ec.target.Alive) continue; // 이미 쓰러졌으면 헛친다
                float cm = CritMul(Active != null ? Active.Id : HeroId, out bool crit);
                ec.target.TakeHit(ec.amount * cm, ec.el, Atk * ReactMul, out _, crit: crit);
                FieldRingFx.Spawn(ec.target.transform.position, 1.2f * GoKits.Dist, ec.c, 0.3f);
            }
            for (int i = _shells.Count - 1; i >= 0; i--)
            {
                var sh = _shells[i];
                sh.left -= dt;
                if (sh.left > 0f) { _shells[i] = sh; continue; }
                _shells.RemoveAt(i);
                AreaHit(sh.pos, sh.r, sh.amount, sh.el);
                FieldRingFx.Spawn(sh.pos, sh.r, sh.c, 0.4f);
                ElementPulse?.Invoke(sh.pos, sh.r, sh.el);
            }
        }
    }
}
