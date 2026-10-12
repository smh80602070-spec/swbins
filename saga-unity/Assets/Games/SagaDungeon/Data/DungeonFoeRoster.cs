using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>무기 갈래 — 잡졸이 싸우는 법(웹 `look.weapon`). None 은 옛 동작 그대로(정예·두목·명소·시대 적).</summary>
    public enum FoeWeapon { None, Sword, Spear, Halberd, Club, Axe, Bow, Staff }

    /// <summary>
    /// tasks U-0106(고돗 G-0207·G-0208 짝) — 과거 시대 잡졸 명단. 전엔 전부 "황건적" 하나였다.
    /// 웹 saga-dungeon/js/data-enemy.js 에서 뽑음(10-12, 사람 종 18 — 짐승 116 은 몸이 없어 U-0100 뒤) — 웹 표를 고치면 함께.
    /// 층 단계(<see cref="TierOf"/>, 웹 tierOf 그대로)마다 4~5종, 같은 층·방·자리 = 같은 종(해시 — 전역 Random 없음).
    /// 무기마다 싸우는 법(웹 dungeon.js 그대로, 단위는 <see cref="DungeonLordSigs.PxPerMeter"/> 24): 활·지팡이는 6.25m 에서 멈춰
    /// 10.8m 안이면 피할 수 있는 투사체(쿨 ×1.4) · 창·미늘창은 판정 +0.58m · 곤봉은 들썩이며 몰아침 · 도끼는 옆으로 흔들리며 다가옴.
    /// </summary>
    public static class DungeonFoeRoster
    {
        public readonly struct Foe
        {
            public readonly string NameKo;
            public readonly Color Color;
            public readonly FoeWeapon Weapon;
            public readonly int Tier;
            public Foe(string name, string hex, FoeWeapon w, int tier)
            {
                NameKo = name;
                ColorUtility.TryParseHtmlString(hex, out var c);
                Color = c;
                Weapon = w;
                Tier = tier;
            }
        }

        public static readonly Foe[] All =
        {
            new Foe("황건적", "#c9a83a", FoeWeapon.Club, 1),
            new Foe("산적", "#6b5030", FoeWeapon.Axe, 1),
            new Foe("도적떼", "#5a4a58", FoeWeapon.Sword, 1),
            new Foe("떠돌이 병졸", "#6a6a74", FoeWeapon.Spear, 1),
            new Foe("왜구", "#8a4a4a", FoeWeapon.Sword, 2),
            new Foe("마적", "#7a5a3a", FoeWeapon.Sword, 2),
            new Foe("오랑캐 궁수", "#7a6a4a", FoeWeapon.Bow, 2),
            new Foe("거란 기병", "#5a6a8a", FoeWeapon.Spear, 2),
            new Foe("여진 궁수", "#6a7a5a", FoeWeapon.Bow, 3),
            new Foe("몽골 기병", "#8a7a5a", FoeWeapon.Spear, 3),
            new Foe("왜군 조총병", "#7a4a4a", FoeWeapon.Staff, 3),
            new Foe("위군 창병", "#31609f", FoeWeapon.Spear, 3),
            new Foe("수군 척후선", "#3a6a8a", FoeWeapon.Bow, 3),
            new Foe("철갑 중장병", "#6a6a7a", FoeWeapon.Halberd, 4),
            new Foe("근위 기병", "#8a3a4a", FoeWeapon.Spear, 4),
            new Foe("연노 사수", "#5a5a6a", FoeWeapon.Bow, 4),
            new Foe("수군 함대", "#3a5a7a", FoeWeapon.Sword, 4),
            new Foe("흑기병", "#3a3a44", FoeWeapon.Halberd, 4),
        };

        // ---- 무기별 수치(웹 px ÷ 24) ---------------------------------------------
        public const float RangedStop = 150f / 24f;      // 6.25m — 이보다 안 다가온다
        public const float RangedMax = 260f / 24f;       // 10.8m — 이보다 멀면 안 쏜다
        public const float RangedCooldownMul = 1.4f;     // 쏜 뒤 다음까지 기존 쿨 × 이 값
        public const float ShotSpeed = 260f / 24f;       // 10.8m/s
        public const float ShotLife = 1.8f;
        public const float ShotHitRadius = (13f + 8f) / 24f; // 0.875m — 내 몸 반경 + 탄
        public const float ReachBonus = 14f / 24f;       // 창·미늘창 +0.58m
        public const float PhaseRate = 7f;               // 웹 en.phase += dt × 7
        public const float AxeWob = 0.5f;                // 옆 흔들림 sin(phase × 0.6) × 0.5
        public const float ClubLunge = 0.7f;             // 몰아침 1 + max(0, sin(phase × 0.9)) × 0.7

        /// <summary>웹 tierOf — ≤5 → 1 · ≤12 → 2 · ≤25 → 3 · 나머지 4.</summary>
        public static int TierOf(int floor) => floor <= 5 ? 1 : floor <= 12 ? 2 : floor <= 25 ? 3 : 4;

        /// <summary>층 f·방 r·자리 slot 의 과거 잡졸 종 — 그 단계 사람 종 중 해시로 하나.</summary>
        public static Foe Pick(int floor, int room, int slot)
        {
            int tier = TierOf(floor), n = 0;
            foreach (var f in All) if (f.Tier == tier) n++;
            int k = (int)(DungeonEras.Hash($"{floor}:{room}:{slot}#foe") % (uint)n);
            foreach (var f in All)
                if (f.Tier == tier && k-- == 0) return f;
            return All[0];
        }

        public static bool IsRanged(FoeWeapon w) => w == FoeWeapon.Bow || w == FoeWeapon.Staff;

        /// <summary>판정 반경 덧셈 — 창·미늘창만.</summary>
        public static float ReachOf(FoeWeapon w) => w == FoeWeapon.Spear || w == FoeWeapon.Halberd ? ReachBonus : 0f;

        /// <summary>쫓는 속도 배율 — 곤봉만 들썩인다.</summary>
        public static float LungeOf(FoeWeapon w, float phase) => w == FoeWeapon.Club ? 1f + Mathf.Max(0f, Mathf.Sin(phase * 0.9f)) * ClubLunge : 1f;

        /// <summary>옆 흔들림(진행 방향에 수직 성분) — 도끼만.</summary>
        public static float WobOf(FoeWeapon w, float phase) => w == FoeWeapon.Axe ? Mathf.Sin(phase * 0.6f) * AxeWob : 0f;

        /// <summary>개체마다 다른 처음 위상(해시).</summary>
        public static float PhaseSeed(int floor, int room, int slot, int k) =>
            (DungeonEras.Hash($"{floor}:{room}:{slot}:{k}#phase") % 6283u) / 1000f;

        /// <summary>표시 이름 번역 키(DungeonEnemy.DisplayNameKeys 가 쓴다). 황건적은 옛 enemy.grunt 그대로.</summary>
        public static readonly string[] Keys =
        {
            "enemy.grunt", "enemy.foe_bandit", "enemy.foe_thieves", "enemy.foe_stray", "enemy.foe_raider", "enemy.foe_horsethief",
            "enemy.foe_barb_archer", "enemy.foe_khitan", "enemy.foe_jurchen", "enemy.foe_mongol", "enemy.foe_musket", "enemy.foe_wei_spear",
            "enemy.foe_navy_scout", "enemy.foe_ironclad", "enemy.foe_guard_cav", "enemy.foe_crossbow", "enemy.foe_marine", "enemy.foe_black_rider",
        };
    }
}
