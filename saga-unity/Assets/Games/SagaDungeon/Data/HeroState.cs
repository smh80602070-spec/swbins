using System;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md — saga-dungeon 웹판(js/hero.js)의
    /// `partyPower()`(여러 영웅의 might/wisdom/command 합산)는 다중 영웅
    /// 부대 시스템 전체를 요구해 이번 슬라이스 범위 밖이다. 이 슬라이스는
    /// **단일 캐릭터**라 그 계산 결과와 같은 자릿수로 값만 새로 잡았다
    /// (`hpMaxOf()`의 `Math.max(30, round(def*3))` 하한 30, `atkOf()`의
    /// `max(4, atk/6)` 한 타 공식은 그대로 가져옴). GO의 PlayerStats.cs와
    /// 같은 자리(static, UnityEngine 안 끌어오는 순수 데이터 클래스)지만
    /// DUNGEON은 부대(PartyState) 개념이 없어 체력·공격력·돈·장비까지
    /// 이 한 클래스에 모았다.
    /// </summary>
    public static class HeroState
    {
        public const int BaseHp = 30;
        public const float BaseAtk = 30f; // atk/6 = 5, js/dungeon.js:140 한 타 공식
        private const int HpPerLevel = 6;
        private const float AtkPerLevel = 6f;
        private const int ExpBase = 20;
        private const float ExpGrowth = 1.3f;

        public static int Level { get; private set; } = 1;
        public static int Exp { get; private set; }
        public static int ExpToNext => ExpForLevel(Level);
        public static int Gold { get; private set; }
        public static int HpMax => BaseHp + (Level - 1) * HpPerLevel;
        public static int Hp { get; private set; } = BaseHp;
        public static string EquippedWeaponId { get; private set; } = "wp_start";
        public static ItemData EquippedWeapon => ItemData.Get(EquippedWeaponId);

        // "세공·행상 재고 굴리기·도감" 슬라이스 — 무기 소켓 하나(둘째
        // 소켓·세트 효과는 범위 밖, GemData.cs 참고).
        public static string SocketedGemId { get; private set; }
        public static GemData SocketedGem => GemData.Get(SocketedGemId);

        // "DUNGEON 더 다듬기" 슬라이스(2026-09-12) — 절차적 층 진행이
        // 100층까지 가능해졌지만 몬스터 hp는 지수적으로(1.26^floor) 크는
        // 반면 이 보정은 선형이라 근본 해결이 아니다 — 사용자에게 그 수학
        // 차이를 먼저 설명하고 "체감용으로만" 추가하기로 확인받았다.
        // 층이 깊어질수록 장비가 조금씩 세진다는 감각만 준다.
        private const float DepthAtkPerFloor = 2f;

        public static float DepthAtkBonus =>
            Math.Max(0f, ((DungeonFloorRunner.Instance?.CurrentFloor ?? 1) - 1) * DepthAtkPerFloor);

        public static float Atk => BaseAtk + (Level - 1) * AtkPerLevel
            + (EquippedWeapon?.AtkBonus ?? 0f) + (SocketedGem?.AtkBonus ?? 0f) + DepthAtkBonus;

        /// <summary>js/dungeon.js:140 — `Math.max(4, p.atk * ... / 6)` 한 타 피해.
        /// PLAN.md 101-2 5.1 "축복 3택" 공(攻) 축(<see cref="BlessingState.AtkMultiplier"/>)을
        /// 곱한다 — 평타·강공격·회전베기가 전부 이 값을 밑값으로 쓰므로 세 공격 다 같이 큰다.
        /// PLAN.md 101-2 5.3 "부적 던전" 유리대포 변형자(<see cref="SigilState.PlayerDamageMultiplier"/>)도
        /// 같은 자리에 곱한다 — 그 층에선 플레이어도 더 세게 때린다.</summary>
        public static float HitDamage => Math.Max(4f, Atk / 6f) * BlessingState.AtkMultiplier
            * SigilState.PlayerDamageMultiplier(DungeonFloorRunner.Instance?.CurrentFloor ?? 1);

        /// <summary>회피(Player/PlayerController.cs) 중에만 켜진다 — 켜져
        /// 있는 동안 TakeDamage가 전부 무시된다(dungeon.js `p.invuln`과
        /// 같은 뜻, DungeonEnemy.cs는 이 플래그를 몰라도 된다).</summary>
        public static bool Invulnerable { get; set; }

        /// <summary>PLAN.md 109-10-3 시련 동안 켠다 — 쓰러져도 유품(금)을 떨구지 않는다.</summary>
        public static bool GraveSuppressed { get; set; }

        public static event Action<int> LeveledUp;

        /// <summary>PLAN.md 101-2 5.2 "유품" — 인자는 <see cref="DropGoldAsGrave"/>가
        /// 돌려준 유품 골드(0이면 잃을 게 없었다는 뜻). `PlayerCombat.OnDied()`가
        /// 이 값으로 그 자리에 `GraveMarker`를 세운다.</summary>
        public static event Action<int> Died;

        /// <summary>PLAN.md 101-3 G "장비 가시화" — `WeaponVisual`이 무기를
        /// 다시 쥐어야 할 때만 구독(`EquipIfBetter`가 실제로 바뀔 때만
        /// 부른다 — `LeveledUp`과 같은 결).</summary>
        public static event Action<string> EquipmentChanged;

        // 높은 레벨(≈80)에서 int 를 넘으면 음수로 뒤집혀 AddExp 의 while 이 끝나지 않았다(2026-09-27 PLAN.md 109-10-9 진단 중 발견) — 넘으면 int 최대에 멈춘다.
        private static int ExpForLevel(int level)
        {
            float v = ExpBase * Pow(ExpGrowth, level - 1);
            return v >= int.MaxValue ? int.MaxValue : RoundInt(v);
        }

        public static void AddExp(int amount)
        {
            if (amount <= 0) return;
            Exp += amount;
            while (Exp >= ExpToNext)
            {
                Exp -= ExpToNext;
                Level++;
                LeveledUp?.Invoke(Level);
            }
        }

        public static void AddGold(int amount)
        {
            if (amount > 0) Gold += amount;
        }

        public static bool TrySpendGold(int amount)
        {
            if (amount <= 0 || Gold < amount) return false;
            Gold -= amount;
            return true;
        }

        /// <summary>더 센 무기만 자동 장착 — GO Inventory.cs와 같은 결.</summary>
        public static bool EquipIfBetter(string itemId)
        {
            var item = ItemData.Get(itemId);
            if (item == null) return false;
            if (EquippedWeapon != null && EquippedWeapon.AtkBonus >= item.AtkBonus) return false;
            EquippedWeaponId = itemId;
            EquipmentChanged?.Invoke(EquippedWeaponId);
            return true;
        }

        /// <summary>더 센 보석만 자동 세공 — EquipIfBetter()와 같은 규칙
        /// (소켓 하나뿐이라 "더 센 것으로 교체"가 그대로 세공에 대응).</summary>
        public static bool SocketIfBetter(string gemId)
        {
            var gem = GemData.Get(gemId);
            if (gem == null) return false;
            if (SocketedGem != null && SocketedGem.AtkBonus >= gem.AtkBonus) return false;
            SocketedGemId = gemId;
            return true;
        }

        /// <summary>PLAN.md 101-2 5.1 "축복 3택" 수(守) 축 — <see cref="BlessingState.DefMultiplier"/>로
        /// 나눈다(클수록 덜 맞는다, PerkState.cs의 def 곱과 같은 방향).</summary>
        public static void TakeDamage(float amount)
        {
            if (Invulnerable || amount <= 0f || Hp <= 0) return;
            Hp = Math.Max(0, Hp - RoundInt(amount / BlessingState.DefMultiplier));
            if (Hp <= 0) Died?.Invoke(DropGoldAsGrave());
        }

        /// <summary>PLAN.md 101-2 5.2 "유품" — 웹판 §5.2("회수 시 금 100%")의 뜻을
        /// 이 트랙에 옮긴다. 이 트랙엔 가방·다중 장비 슬롯이 없어(장비는 항상
        /// "지금 낀 것" 하나뿐 — <see cref="EquipIfBetter"/>) 유품으로 남길 수
        /// 있는 노획물은 사실상 골드뿐이다 — 소지 골드 전부를 내려놓고 돌려준다.</summary>
        public static int DropGoldAsGrave()
        {
            if (GraveSuppressed) return 0; // PLAN.md 109-10-3 시련 — 쓰러져도 끝나지 않고 −30초뿐(유품 없음).
            int amount = Gold;
            Gold = 0;
            return amount;
        }

        /// <summary>죽었다가 다시 방에 들어올 때(이번 슬라이스는 죽음 화면
        /// 없이 바로 회복 — 다음 슬라이스에서 실제 페널티를 다룬다).</summary>
        public static void FullHeal()
        {
            Hp = HpMax;
        }

        /// <summary>우물(World/DungeonWell.cs)처럼 일부만 회복 — 최대치를
        /// 넘기지 않는다.</summary>
        public static void HealBy(int amount)
        {
            if (amount <= 0 || Hp <= 0) return;
            Hp = Math.Min(HpMax, Hp + amount);
        }

        public static void Restore(int level, int exp, int hp, int gold, string weaponId, string gemId = null)
        {
            Level = Math.Max(1, level);
            Exp = Math.Max(0, exp);
            Gold = Math.Max(0, gold);
            EquippedWeaponId = string.IsNullOrEmpty(weaponId) ? "wp_start" : weaponId;
            SocketedGemId = gemId; // 없으면 null 그대로 — 소켓 빈 채로 시작(구 세이브도 그대로 로드됨).
            Hp = Math.Clamp(hp, 0, HpMax);
            if (Hp <= 0) Hp = HpMax;

            // PLAN.md 101-2 5.7 진단 중 발견 — 세이브 로드 경로는 그동안
            // EquipmentChanged를 안 쏴 WeaponVisual.Start()가 SaveState.TryLoad()
            // 보다 먼저 도는 실행 순서에서 로드된 무기 모양이 안 갱신될 수
            // 있었다(StoryWeaponVisual의 JobChosen 함정과 같은 결). Start()가
            // 이미 한 번 Refresh()를 부르니 정상 순서에선 안 드러나지만,
            // 순서에 기대지 않도록 여기서도 쏜다.
            EquipmentChanged?.Invoke(EquippedWeaponId);
        }

        private static int RoundInt(float v) => (int)Math.Round(v, MidpointRounding.AwayFromZero);
        private static float Pow(float b, float e) => (float)Math.Pow(b, e);
    }
}
