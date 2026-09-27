using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md의 기본 공격 + 다음 슬라이스 "스킬
    /// 다양화"의 강공격. 키보드는 둘 다 직접 읽기(Keyboard.current) —
    /// 프로젝트 기본 InputActions 자산의 "Attack" 액션은 마우스 왼쪽
    /// 버튼에도 물려 있어 CameraRig.cs의 드래그 판정(마우스 왼쪽 버튼을
    /// 직접 읽는다)과 같은 프레임에 겹칠 수 있다 — 그 충돌을 피하려고
    /// 이번 슬라이스는 "Attack" 액션을 안 쓰고 새로 읽는다. 모바일은
    /// `TriggerAttack()`/`TriggerHeavyAttack()`을 uGUI 버튼(OnClick)이
    /// 직접 부른다(SagaGo EncounterUiKit 버튼과 같은 결).
    /// 강공격은 웹판 `js/dungeon.js:2509` `heavyAttack()`의 실제 상수를
    /// 그대로 옮겼다 — 쿨다운 1.3초·피해 배율 2.6배·사거리 1.15배,
    /// 회피 중엔(웹판 `p.dash || p.dodge`) 못 쓴다. 넉백(HEAVY_KB=26)은
    /// 이 슬라이스에 밀치기 물리가 없어 뺐다(다음 슬라이스 몫).
    ///
    /// **회전베기(2026-09-14 추가) — PLAN.md 51장 "DUNGEON 확장 — 빌드"**.
    /// GO/DUNGEON/FOREST/REALM 51장 확장 축 조사에서 DUNGEON만 "빌드"
    /// 칸이 비어 있었다(엘리트/보스/장비는 이미 있음 — `DungeonFormulas.
    /// EliteHp/EliteDmg`, `QuestState.cs`, `HeroState.EquipIfBetter`).
    /// STORY의 `StoryPlayerController.TriggerSweep`(범위 안 전체 타격)과
    /// 같은 결의 AoE를 더해 "단일 대상에 강공격을 쌓을지, 범위로 잡몹을
    /// 쓸어낼지" 플레이스타일 갈림을 만든다 — DUNGEON엔 MP 자원이 없어
    /// (`HeroState.cs`에 자원 필드 자체가 없다) 쿨다운만으로 억제한다.
    /// 한 대상당 피해는 평타보다 낮게(`WhirlDamageMul`) 잡아 "여럿을 조금씩"
    /// 대 "하나를 크게"(강공격)가 실제로 트레이드오프가 되게 했다.
    ///
    /// **비결(PLAN.md 109-10, 웹 §5.9)** — 세 무예마다 `SecretState` 비결 하나가 위력·재냉각·사거리를
    /// 곱하고(분노·한기·확산·신속·흡혈), 확산이면 한 명 치는 무예가 곁의 둘을 더, 한기면 맞은 적을
    /// 얼리고, 흡혈이면 창 안의 피해로 체력을 되찾는다. 비결 없음 = 옛 수치 그대로.
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public class PlayerCombat : MonoBehaviour
    {
        private const float AttackRange = 2.5f;
        private const float AttackCooldown = 0.55f; // js/dungeon.js BASE_ATK_CD

        private const float HeavyCooldown = 1.3f;      // dungeon.js HEAVY_CD
        private const float HeavyDamageMul = 2.6f;     // dungeon.js HEAVY_MUL
        private const float HeavyRangeMul = 1.15f;     // dungeon.js heavyAttack() reach
        private const float HeavyRecoverSec = 0.16f;   // dungeon.js HEAVY_RECOVER

        private const float WhirlCooldown = 3.5f;   // 평타·강공격보다 훨씬 길다 — 여럿을 한꺼번에 치는 대가.
        private const float WhirlDamageMul = 0.7f;  // 대상 하나당 피해는 평타보다 낮다(범위가 보상).
        private const float WhirlRadius = 2.8f;     // AttackRange보다 살짝 넓다 — "둘러싼 잡몹 쓸기" 용도.
        private const float WhirlRecoverSec = 0.2f;

        // "타격감 1차" 슬라이스(PLAN.md 38장 "camera shake") — 강공격이
        // 평타보다 더 크게 흔들린다.
        private const float HitShakeMag = 0.05f;
        private const float HitShakeSec = 0.08f;
        private const float HeavyShakeMag = 0.12f;
        private const float HeavyShakeSec = 0.15f;
        private const float WhirlShakeMag = 0.09f;
        private const float WhirlShakeSec = 0.12f;

        // "타격감 2차"(PLAN.md 101-3 C hitstop) — Time.timeScale 대신
        // 가해자·피해자 두 Animator.speed만 잠깐 0으로 둔다(101-3 표 그대로,
        // 나머지 게임 로직·모바일 입력은 정상 진행 — 전역 정지는 모바일에서
        // 입력 지연으로 느껴진다). 강공격이 평타보다 더 오래 멎는다.
        private const float HitstopSec = 0.07f;
        private const float HeavyHitstopSec = 0.12f;

        // PLAN.md 106-1 "완벽 회피 → 반격" — 판정을 회피 무적으로 흘리면 이 시간
        // 안의 다음 평타·강공격 한 번이 이 배율(전역 슬로모 없이, 101-3 원칙).
        public const float CounterWindowSec = 1.2f;
        public const float CounterDamageMul = 2f;

        private float _cooldownLeft;
        private float _heavyCooldownLeft;
        private float _whirlCooldownLeft;
        private float _counterUntil = -1f;
        private PlayerController _controller;
        private PlayerLockOn _lockOn;
        private CameraRig _cameraRig;

        /// <summary>반격 창이 열려 있는가 — HUD·진단이 본다.</summary>
        public bool CounterReady => Time.time <= _counterUntil;

        /// <summary>진단·HUD 용 — 무예마다 남은 재냉각.</summary>
        public float CooldownLeft(SecretMove m) =>
            m == SecretMove.Heavy ? _heavyCooldownLeft : m == SecretMove.Whirl ? _whirlCooldownLeft : _cooldownLeft;

        /// <summary>헤드리스 진단이 무예를 잇달아 쓸 때만.</summary>
        public void ResetCooldownsForTest()
        {
            _cooldownLeft = _heavyCooldownLeft = _whirlCooldownLeft = 0f;
            _counterUntil = -1f;
        }

        private void Awake()
        {
            HeroState.Died += OnDied;
            PlayerController.PerfectDodged += OnPerfectDodged;
            _controller = GetComponent<PlayerController>();
            _lockOn = GetComponent<PlayerLockOn>();
            _cameraRig = GetComponentInChildren<CameraRig>();
        }

        private void OnDestroy()
        {
            HeroState.Died -= OnDied;
            PlayerController.PerfectDodged -= OnPerfectDodged;
        }

        private void OnPerfectDodged()
        {
            _counterUntil = Time.time + CounterWindowSec;
            _cameraRig?.Shake(HitShakeMag, HitShakeSec);
            DialogueLabel.Instance?.Show(DungeonLocalization.T("combat.perfect_dodge", "완벽 회피! — 지금 반격"), CounterWindowSec);
        }

        /// <summary>반격 창이 열려 있으면 소비하고 배율을 돌려준다.</summary>
        private float ConsumeCounter()
        {
            if (!CounterReady) return 1f;
            _counterUntil = -1f;
            return CounterDamageMul;
        }

        /// <summary>PLAN.md 106-1 — 락온 대상이 사거리 안이면 그 적, 아니면
        /// 예전처럼 가장 가까운 적.</summary>
        private DungeonEnemy PickTarget(float range)
        {
            if (_lockOn != null && _lockOn.IsLocked)
            {
                var t = _lockOn.Target;
                if (Vector3.Distance(transform.position, t.transform.position) <= range) return t;
            }
            return DungeonEnemy.FindNearest(transform.position, range);
        }

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_heavyCooldownLeft > 0f) _heavyCooldownLeft -= Time.deltaTime;
            if (_whirlCooldownLeft > 0f) _whirlCooldownLeft -= Time.deltaTime;

            var kb = Keyboard.current;
            if (kb == null) return;

            if (kb.spaceKey.wasPressedThisFrame)
            {
                TryAttack();
            }
            if (kb.leftAltKey.wasPressedThisFrame)
            {
                TryHeavyAttack();
            }
            if (kb.eKey.wasPressedThisFrame)
            {
                TryWhirl();
            }
        }

        /// <summary>모바일 화면의 "공격" 버튼(OnClick)이 부른다.</summary>
        /// <summary>PLAN.md 106-5 — 등반·넘어오르기 중엔 못 싸운다(GO 107 ② 와 같은 결).</summary>
        private bool Climbing => _controller != null && _controller.Climbing;

        public void TriggerAttack() => TryAttack();

        /// <summary>모바일 화면의 "강공격" 버튼(OnClick)이 부른다.</summary>
        public void TriggerHeavyAttack() => TryHeavyAttack();

        /// <summary>모바일 화면의 "회전베기" 버튼(OnClick)이 부른다. 데스크톱은 E키.</summary>
        public void TriggerWhirl() => TryWhirl();

        private void TryAttack()
        {
            if (_cooldownLeft > 0f || DungeonCutscenes.Playing || Climbing) return;
            const SecretMove M = SecretMove.Attack;
            float range = AttackRange * SecretState.RangeMul(M);
            var enemy = PickTarget(range);
            if (enemy == null) return;

            _cooldownLeft = AttackCooldown * SecretState.CooldownMul(M);
            _controller.FaceToward(enemy.transform.position);
            SecretState.OnCast(M, Time.time);
            float mul = ConsumeCounter();
            float dmg = HeroState.HitDamage * SecretState.DamageMul(M);
            Strike(enemy, dmg * mul, mul > 1f, M);
            var hitList = new List<DungeonEnemy>(ExtraTargets(enemy, range, SecretState.ExtraTargets(M)));
            foreach (var extra in hitList) Strike(extra, dmg, false, M);
            // PLAN.md 109-10-10 몰이 사냥 — 앞 120°·사거리 × 1.35 안 곁의 적도 60% 로 휩쓴다.
            Cleave(enemy, hitList, AttackRange * DungeonHunt.CleaveR * SecretState.RangeMul(M), DungeonHunt.CleaveHalfDeg, dmg * DungeonHunt.CleaveMul, false, M);
            PartyState.AddPlayerHit(heavy: mul > 1f); // PLAN.md 106-6 — 맞힐 때마다 동료 명령·소환 게이지.
            _cameraRig?.Shake(mul > 1f ? HeavyShakeMag : HitShakeMag, mul > 1f ? HeavyShakeSec : HitShakeSec);
            SfxPlayer.PlayHit();
            _controller.Animator?.SetTrigger("Attack");
            StartCoroutine(ApplyHitstop(_controller.Animator, enemy.Animator, HitstopSec));
        }

        private void TryHeavyAttack()
        {
            if (_heavyCooldownLeft > 0f || (_controller != null && _controller.IsDodging) || DungeonCutscenes.Playing || Climbing) return;
            const SecretMove M = SecretMove.Heavy;
            float range = AttackRange * HeavyRangeMul * SecretState.RangeMul(M);
            var enemy = PickTarget(range);
            if (enemy == null) return;

            _heavyCooldownLeft = HeavyCooldown * SecretState.CooldownMul(M);
            _cooldownLeft = Mathf.Max(_cooldownLeft, HeavyRecoverSec);
            _controller.FaceToward(enemy.transform.position);
            SecretState.OnCast(M, Time.time);
            float dmg = HeroState.HitDamage * HeavyDamageMul * SecretState.DamageMul(M);
            Strike(enemy, dmg * ConsumeCounter(), true, M);
            var hitList = new List<DungeonEnemy>(ExtraTargets(enemy, range, SecretState.ExtraTargets(M)));
            foreach (var extra in hitList) Strike(extra, dmg, true, M);
            // PLAN.md 109-10-10 — 강공격은 앞 반원(180°)·사거리 × 1.8, 곁은 강공격의 75%(예비동작도 끊는다).
            Cleave(enemy, hitList, AttackRange * DungeonHunt.HeavyR * SecretState.RangeMul(M), DungeonHunt.HeavyHalfDeg, dmg * DungeonHunt.HeavySide, true, M);
            PartyState.AddPlayerHit(heavy: true);
            _cameraRig?.Shake(HeavyShakeMag, HeavyShakeSec);
            SfxPlayer.PlayHeavyHit();
            // Maria.controller엔 슬래시 클립이 하나뿐이라 강공격도 같은
            // "Attack" 트리거를 쓴다 — 전용 클립은 다음에 받을 몫.
            _controller.Animator?.SetTrigger("Attack");
            StartCoroutine(ApplyHitstop(_controller.Animator, enemy.Animator, HeavyHitstopSec));
        }

        /// <summary>회전베기 — 반경 안 살아있는 적을 전부 때린다(TryAttack의
        /// "가장 가까운 하나"와 달리 다수 타격). `DungeonEnemy.Active`가
        /// 이미 public static이라 별도 조회 API 없이 바로 순회한다.</summary>
        private void TryWhirl()
        {
            if (_whirlCooldownLeft > 0f || DungeonCutscenes.Playing || Climbing) return;

            const SecretMove M = SecretMove.Whirl;
            float radius = WhirlRadius * SecretState.RangeMul(M);
            float damage = HeroState.HitDamage * WhirlDamageMul * SecretState.DamageMul(M);
            var hits = new List<DungeonEnemy>();
            foreach (var enemy in DungeonEnemy.Active)
            {
                if (enemy == null || !enemy.IsAlive) continue;
                if (Vector3.Distance(transform.position, enemy.transform.position) > radius) continue;
                hits.Add(enemy);
            }
            if (hits.Count == 0) return;
            SecretState.OnCast(M, Time.time);
            foreach (var enemy in hits) Strike(enemy, damage, false, M); // 모아 두고 친다 — 쓰러지는 적이 목록을 흔들지 않게.
            PartyState.AddPlayerHit(heavy: false); // 여럿을 베도 한 번(게이지가 회전베기 난사로 넘치지 않게).
            GestureState.OnLeadSignature(GestureState.Now); // PLAN.md 109-10-7 — 동행 둘이 ❗ 호응(웹 선두 서명 무예 자리).
            AllySigState.OnLeadSignature(AllySigState.Now); // PLAN.md 109-10-8 — 1.5초 합격 창.

            // PLAN.md 101-2 5.1 "축복 3택" 선(旋) 축 — BlessingState.SweepMultiplier로
            // 나눈다(클수록 회전베기를 더 자주 쓴다, 51장 "범위형 빌드"를 직접 강화).
            _whirlCooldownLeft = WhirlCooldown / BlessingState.SweepMultiplier * SecretState.CooldownMul(M);
            _cooldownLeft = Mathf.Max(_cooldownLeft, WhirlRecoverSec);
            _cameraRig?.Shake(WhirlShakeMag, WhirlShakeSec);
            SfxPlayer.PlayHit();
            _controller.Animator?.SetTrigger("Attack"); // Maria.controller엔 슬래시 클립이 하나뿐(강공격과 같은 이유).
            // 회전베기는 한 번에 여럿을 때려 "피해자 쪽" 하나를 못 고른다 —
            // 가해자(플레이어) 쪽만 멎는다.
            StartCoroutine(ApplyHitstop(_controller.Animator, null, HitstopSec));
        }

        /// <summary>진단 — 마지막 휩쓸기에 곁으로 맞은 수.</summary>
        public int LastCleaveHits { get; private set; }

        /// <summary>PLAN.md 109-10-10 휩쓸기(웹 cleave) — 첫 대상 쪽을 앞으로 한 부채꼴 안, 이미 맞은 적 빼고 곁 피해로.</summary>
        private void Cleave(DungeonEnemy main, List<DungeonEnemy> already, float radius, float halfDeg, float damage, bool heavy, SecretMove move)
        {
            LastCleaveHits = 0;
            if (!DungeonHunt.CleaveOn || main == null) return;
            Vector3 origin = transform.position, fwd = main.transform.position - origin;
            foreach (var e in DungeonEnemy.Active.ToArray())
            {
                if (e == null || !e.IsAlive || e == main || already.Contains(e)) continue;
                if (!DungeonHunt.InCone(origin, fwd, e.transform.position, radius, halfDeg)) continue;
                Strike(e, damage, heavy, move);
                LastCleaveHits++;
            }
        }

        /// <summary>한 번 때리기 — 비결 한기면 얼리고, 흡혈 창이면 준 피해로 체력을 되찾는다.</summary>
        private static void Strike(DungeonEnemy enemy, float damage, bool heavy, SecretMove move)
        {
            if (enemy == null || !enemy.IsAlive) return;
            enemy.TakeDamage(damage, heavy);
            float chill = SecretState.ChillSec(move);
            if (chill > 0f && enemy.IsAlive) enemy.Chill(chill);
            int heal = SecretState.LeechHeal(damage, Time.time);
            if (heal > 0) HeroState.HealBy(heal);
        }

        /// <summary>비결 확산 — 첫 대상 말고 플레이어 사거리 안 가까운 적 <paramref name="count"/>.</summary>
        private List<DungeonEnemy> ExtraTargets(DungeonEnemy main, float range, int count)
        {
            var list = new List<DungeonEnemy>();
            if (count <= 0) return list;
            Vector3 p = transform.position;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || e == main || !e.IsAlive) continue;
                if (Vector3.Distance(p, e.transform.position) <= range) list.Add(e);
            }
            list.Sort((a, b) => Vector3.Distance(p, a.transform.position).CompareTo(Vector3.Distance(p, b.transform.position)));
            if (list.Count > count) list.RemoveRange(count, list.Count - count);
            return list;
        }

        /// <summary>가해자·피해자 두 Animator를 `seconds` 동안 멈췄다 되돌린다
        /// (defender 는 null 허용 — 회전베기처럼 특정 피해자를 못 고를 때).
        /// 공격 쿨다운이 hitstop 길이보다 훨씬 길어(0.55s+ vs 0.07~0.12s)
        /// 같은 Animator를 겹쳐 멈출 일은 없다.</summary>
        private static IEnumerator ApplyHitstop(Animator attacker, Animator defender, float seconds)
        {
            if (attacker != null) attacker.speed = 0f;
            if (defender != null) defender.speed = 0f;
            yield return new WaitForSeconds(seconds);
            if (attacker != null) attacker.speed = 1f;
            if (defender != null) defender.speed = 1f;
        }

        /// <summary>PLAN.md 101-2 5.2 "유품" — <paramref name="lostGold"/>는
        /// <see cref="HeroState.DropGoldAsGrave"/>가 이미 떼어 둔 값(0이면
        /// 잃을 게 없었다는 뜻, 마커를 안 세운다). 죽음 화면(웹판 §5.2의
        /// 세션 카드)은 GameBootstrap이 `HeroState.Died`를 같이 구독해 띄운다
        /// — 이 메서드는 애니메이션·마커 등 "그 자리" 반응만 맡는다.</summary>
        private void OnDied(int lostGold)
        {
            _controller.Animator?.SetTrigger("Death");
            if (lostGold > 0)
            {
                GraveMarker.Spawn(transform.position, lostGold);
            }
            HeroState.FullHeal();

            string msg = lostGold > 0
                ? string.Format(DungeonLocalization.T("grave.dropped", "쓰러졌다가 정신을 차렸다. 이 자리에 금 {0}을 유품으로 남겼다."), lostGold)
                : DungeonLocalization.T("grave.dropped_none", "쓰러졌다가 정신을 차렸다.");
            DialogueLabel.Instance?.Show(msg, 4f);
        }
    }
}
