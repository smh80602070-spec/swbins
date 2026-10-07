using System.Collections.Generic;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md — GO의 Data/ItemData.cs와 같은 결(코드
    /// 카탈로그, ScriptableObject 없음). 이번 슬라이스는 무기 하나뿐 —
    /// 방어구·세공·희귀도는 다음 슬라이스(saga-dungeon 웹판 30~32장) 몫.
    /// 원작 상표 없는 순수 설명형 이름.
    /// </summary>
    public class ItemData
    {
        // PLAN.md 101-2 5.7 "미래 무기 look" — `Player/WeaponVisual.cs`가 등급
        // 색과 별개로 실제 모양을 바꾸는 축. 기존 다섯 종(도끼~중검)은 전부
        // 칼날 하나로 뭉뚱그려 그렸던 그대로 Blade.
        public enum WeaponShape { Blade, Lance, Gauntlet }

        public readonly string Id;
        private readonly string _name;
        public string Name => DungeonLocalization.T("item." + Id, _name);
        public readonly float AtkBonus;

        // PLAN.md 101-3 G "장비 가시화" — 무기 소켓의 이미시브 림 3단(0~2)을
        // 고르는 값. 별도 희귀도 시스템은 아직 없어(클래스 상단 주석) 기존
        // AtkBonus 서열을 그대로 3단에 나눠 붙였다.
        public readonly int Grade;
        public readonly WeaponShape Shape;

        // PLAN.md 109-10-2 비전(웹 사가나락 §5.10) — 웹은 전설(4) 한 점에 비전 하나인데 이 트랙엔 전설 등급이
        // 없어 맨 위(빛기둥 "고유") = 명소 층 첫 토벌 무기 여섯이 맡는다. 웹 "고유는 늘 같은 비전"대로 굴리지
        // 않고 여기 박는다(층 이름에 맞춰, 다섯 다 나오게 — 분노만 둘). 없음 = 비전 없는 무기.
        public readonly Secret Lore;

        private ItemData(string id, string name, float atk, int grade, WeaponShape shape = WeaponShape.Blade, Secret lore = Secret.None)
        {
            Id = id;
            _name = name;
            AtkBonus = atk;
            Grade = grade;
            Shape = shape;
            Lore = lore;
        }

        public static readonly Dictionary<string, ItemData> Catalog = new Dictionary<string, ItemData>
        {
            ["wp_start"] = new ItemData("wp_start", "목검", 0f, 0),
            // 황건적(World/DungeonEnemy.cs) 처치 확정 드랍 — 이번 슬라이스
            // 유일한 보상 아이템이라 확률 룰렛 없이 항상 나온다.
            ["wp_axe"] = new ItemData("wp_axe", "쇠도끼", 12f, 0),
            // 두목(황건적 두목, DungeonEnemy isBoss=true) 확정 드랍 —
            // js/dungeon.js의 boss 공격력 배율(2.2배, enemyDmg 공식)을
            // 그대로 재사용해 wp_axe(12) × 2.2 = 26.4 → 26으로 잡았다
            // (웹판 boss 노획은 절차적 희귀도 시스템이라 이번 슬라이스
            // 범위 밖 — VERTICAL_SLICE_DUNGEON.md "제외" 참고, 그래도
            // 임의 수치 대신 기존 공식의 배율을 재사용).
            ["wp_glaive"] = new ItemData("wp_glaive", "귀두도", 26f, 2),
            // 행상(World/DungeonMerchant.cs, "방 종류 나머지" 슬라이스) 전용
            // 판매 아이템 — wp_axe(12)와 wp_glaive(26) 사이 중간 티어로
            // 잡았다(웹판 행상의 절차적 재고 굴리기는 범위 밖, GO
            // ShopState.cs와 같은 "고정 물건 하나" 단순화).
            ["wp_saber"] = new ItemData("wp_saber", "환도", 18f, 1),
            // 층2 두목("오픈월드 확장" 슬라이스, Editor/BuildTestDungeonScene.cs
            // BuildBossFloor2()) 확정 드랍 — js/dungeon.js enemyDmg가
            // floor 1→2에 걸리는 성장률(11→13, 약 1.18배)을 wp_glaive(26)에
            // 그대로 곱해 round(26*13/11)=31로 잡았다(층1 두목 아이템이
            // 이미 floor=1 공식 배율을 재사용한 것과 같은 결).
            ["wp_greatblade"] = new ItemData("wp_greatblade", "흑철중검", 31f, 2),
            // PLAN.md 101-2 5.7 "시대 퓨전" — 깊은 층 절차적 정예("기계화
            // 정찰병", World/EraFusionData.cs·DungeonFloorRunner.SpawnElite())
            // 확정 드랍, 층 홀짝으로 둘을 번갈아 준다. 웹판 lance_e·gauntlet의
            // atk는 절차적 희귀도 시스템 몫이라(범위 밖) 이 트랙 기존 서열에
            // 맞춰 wp_greatblade(31) 바로 위/사이로 잡았다.
            ["wp_lance_e"] = new ItemData("wp_lance_e", "전자창", 34f, 2, WeaponShape.Lance),
            ["wp_gauntlet"] = new ItemData("wp_gauntlet", "동력장갑", 20f, 1, WeaponShape.Gauntlet),
            // PLAN.md 108 ③ 명소 층 주인 첫 토벌 무기(`DungeonLandmarkData`) — 그 층에서 행상 환도(18)·
            // 두목 흑철중검(31)보다 한 발 앞서게, 5층 24 에서 층마다 대략 +4~5.
            ["wp_lm_tomb"] = new ItemData("wp_lm_tomb", "청동 순장검", 24f, 2, lore: Secret.Leech),        // 혈해 — 순장 피
            ["wp_lm_fort"] = new ItemData("wp_lm_fort", "잿빛 성주도", 29f, 2, lore: Secret.Rage),         // 노화 — 무너진 성주의 분
            ["wp_lm_bandit"] = new ItemData("wp_lm_bandit", "흑풍 쌍부", 33f, 2, lore: Secret.Spread),     // 만상 — 흩어지는 검은 바람
            ["wp_lm_palace"] = new ItemData("wp_lm_palace", "비늘 삼지창", 37f, 2, WeaponShape.Lance, Secret.Frost), // 빙혼 — 가라앉은 물
            ["wp_lm_hellgate"] = new ItemData("wp_lm_hellgate", "업화 철퇴", 41f, 2, lore: Secret.Rage),   // 노화 — 업화
            ["wp_lm_cloud"] = new ItemData("wp_lm_cloud", "천장 금검", 46f, 2, lore: Secret.Swift),        // 섬광 — 구름 번개
            ["wp_lm_nameless"] = new ItemData("wp_lm_nameless", "무명 묵검", 51f, 2, lore: Secret.Leech),  // 혈해 — 삼킨 이름(31층, tasks U-0028)
        };

        public static ItemData Get(string id) => id != null && Catalog.TryGetValue(id, out var d) ? d : null;
    }
}
