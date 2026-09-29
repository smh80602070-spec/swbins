using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>Story = 109-14-15 이야기 동료(도감 밖 — 도감 수에 안 센다).</summary>
    public enum HeroEra { ThreeKingdoms, Korea, Japan, World, Story }
    public enum HeroTrait { Might, Wisdom, Virtue, Command }
    /// <summary>웹 원소 일곱(`field-combat.js` EL_KEYS) — 109-14-1a 부터 이 트랙 전투도 일곱(<see cref="GoElement"/>, <see cref="GoHeroes.ElementOf"/>).
    /// 원래 값은 PLAN 109 줄 8(인물마다 다른 원소 스킬 모양)이 쓰려고 남긴다.</summary>
    public enum WebElement { Fire, Water, Elec, Wind, Ice, Rock, Grass }

    /// <summary>
    /// PLAN.md 109-6 "도감 옮기기"(B 인물 105 첫 줄) — 웹 `saga-web/saga-go/js/data.js` HEROES 105 를 그대로 옮긴 표
    /// (id·가명·시대 묶음·세력·희귀도·기질·자질·한마디 — 이름은 이미 가명, 루트 CLAUDE.md 이름 정책. 웹 `hanja` 칸은 세계사 몇몇이 실명에 가까운 로마자라 옮기지 않는다). 표는 스크립트로
    /// 뽑았다(손으로 고치지 않는다 — 웹 도감을 고치면 다시 뽑는다). 원소는 웹과 같은 식(`elementOf` = FNV-1a·xorshift 15 → 일곱 중 하나)이고
    /// 이 트랙 셋으로 접는다: 불·바위 → 화 · 물·얼음·풀 → 수 · 번개·바람 → 뇌(40·33·32 로 고르다).
    ///
    /// 들판 인물(웹 사가고 ⑯ "싸워서 등용"): 지역 위험도 = 희귀도 − 2 인 지역에 표 순서대로 나눠 둔다(★3 → 마을 들판 ·
    /// ★4 → 서쪽 숲길·동쪽 숲·끝 논밭 · ★5 → 북쪽 산기슭·남쪽 공터, 너른 강은 설 땅이 없어 뺀다). 지역마다 한 자리에 한 명씩 —
    /// 아직 동행이 아닌 첫 사람이 선다(`FieldHeroes`). 체력·방패·졸개는 희귀도로(아래 상수, 웹 ⑯ 비율).
    /// </summary>
    public static class GoHeroes
    {
        public struct Hero
        {
            public string Id, NameKo, Faction, QuoteKo;
            public HeroEra Era;
            public int Rarity;
            public HeroTrait Trait;
            public int Might, Wisdom, Command;
            public WebElement WebElement;
        }

        // ---- 싸워서 등용(웹 ⑯ — HP_BASE×(1.6+0.7×★), ★3 졸개 하나·★4~5 둘, ★4 방패 한 겹·★5 두 겹) ----
        public const float HpBase = 220f;
        public const float AtkBase = 14f;
        public const float AtkPerRarity = 4f;
        public const float ShieldPerLayer = 120f;
        /// <summary>이 거리 안에 들면 겨루기가 열린다(말 한마디 + 졸개).</summary>
        public const float ChallengeRadius = 7f;
        /// <summary>굴복 — 체력 0 이면 쓰러지지 않고 무릎 꿇는 시간(웹 1초).</summary>
        public const float YieldSec = 1.2f;
        public const int ExpPerRarity = 15;

        public static float MaxHp(int rarity) => HpBase * (1.6f + 0.7f * rarity);
        public static float Atk(int rarity) => AtkBase + AtkPerRarity * rarity;
        public static int ShieldLayers(int rarity) => rarity >= 5 ? 2 : rarity == 4 ? 1 : 0;
        public static int Minions(int rarity) => rarity >= 4 ? 2 : 1;

        /// <summary>109-14-1a — 전투도 일곱이라 그대로(옛 107 은 셋으로 접었다: 암 → 화 · 빙·초 → 수 · 풍 → 뇌).</summary>
        public static GoElement ElementOf(WebElement w)
        {
            switch (w)
            {
                case WebElement.Fire: return GoElement.Pyro;
                case WebElement.Water: return GoElement.Hydro;
                case WebElement.Elec: return GoElement.Electro;
                case WebElement.Wind: return GoElement.Anemo;
                case WebElement.Ice: return GoElement.Cryo;
                case WebElement.Rock: return GoElement.Geo;
                default: return GoElement.Dendro;
            }
        }

        /// <summary>★5 속 방패 — 제 원소가 누르는 원소(화 → 뇌 · 수 → 화 · 뇌 → 수). 겉을 상성으로 깬 뒤 다른 동료로 바꿔야 한다.</summary>
        public static GoElement InnerOf(GoElement outer)
        {
            foreach (GoElement e in GoElements.All)
                if (GoElements.Counters(outer, e)) return e;
            return GoElements.CounterOf(outer); // 빙은 누르는 원소가 없어 — 빙을 누르는 화(웹 방식)
        }

        public static GoElement ElementOf(Hero h) => ElementOf(h.WebElement);

        public static string Name(Hero h) => GoLocalization.T("hero." + h.Id, h.NameKo);
        public static string Quote(Hero h) => GoLocalization.T("hero." + h.Id + ".quote", h.QuoteKo);

        public static string EraName(HeroEra e)
        {
            switch (e)
            {
                case HeroEra.ThreeKingdoms: return GoLocalization.T("hero.era.three_kingdoms", "삼국지");
                case HeroEra.Korea: return GoLocalization.T("hero.era.korea", "한국사");
                case HeroEra.Japan: return GoLocalization.T("hero.era.japan", "일본사");
                case HeroEra.Story: return GoLocalization.T("hero.era.story", "이야기 동료");
                default: return GoLocalization.T("hero.era.world", "세계사");
            }
        }

        public static string Stars(int rarity) => new string('★', rarity);

        /// <summary>머리 위 이름표 — "★★★★ 명운(삼국지)".</summary>
        public static string Label(Hero h) => $"{Stars(h.Rarity)} {Name(h)}({EraName(h.Era)})";

        private static Dictionary<string, int> _index;

        public static bool TryGet(string id, out Hero h)
        {
            if (_index == null)
            {
                _index = new Dictionary<string, int>();
                for (int i = 0; i < All.Length; i++) _index[All[i].Id] = i;
                for (int i = 0; i < Story.Length; i++) _index[Story[i].Id] = -1 - i; // 109-14-15 이야기 동료
            }
            if (id != null && _index.TryGetValue(id, out int k)) { h = k >= 0 ? All[k] : Story[-1 - k]; return true; }
            h = default;
            return false;
        }

        // ---- 들판 인물 자리 ----------------------------------------------------

        public struct Stand
        {
            public string RegionId;
            public float Gx, Gy;
        }

        /// <summary>
        /// PLAN.md 109-14-15 이야기 동료(웹 사가고 ⑲-15 `story.js` MEMBERS) — 도감 밖 id(도감 105 는 그대로). 이야기 장 끝에 동행으로 들어온다
        /// (`GoStory.Chapter.Join`), 들판 인물로는 안 선다. 원소·기질·자질은 웹 표 그대로, 무기 종류는 해시 대신 `GoWeapons.TypeOf` 표.
        /// </summary>
        public static readonly Hero[] Story =
        {
            new Hero { Id = "story_scholar", NameKo = "은비", Era = HeroEra.Story, Faction = "재야", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 55, Wisdom = 92, Command = 70,
                WebElement = WebElement.Grass, QuoteKo = "이 비문, 읽을수록 이상하다니까." },
            new Hero { Id = "story_wanderer", NameKo = "가면 쓴 나그네", Era = HeroEra.Story, Faction = "재야", Rarity = 5, Trait = HeroTrait.Might, Might = 90, Wisdom = 75, Command = 72,
                WebElement = WebElement.Ice, QuoteKo = "너무 떨어지면 기다려 주지 않을 테니." },
            // 109-14-17 치유(촌장, 6장 끝)·협동 공격(사공, 7장 끝) — 웹 ⑲-17
            new Hero { Id = "story_elder", NameKo = "누리", Era = HeroEra.Story, Faction = "재야", Rarity = 4, Trait = HeroTrait.Virtue, Might = 48, Wisdom = 80, Command = 86,
                WebElement = WebElement.Wind, QuoteKo = "먹구름이 걷히면 마을 잔치를 열어야지." },
            new Hero { Id = "story_ferryman", NameKo = "버들", Era = HeroEra.Story, Faction = "재야", Rarity = 4, Trait = HeroTrait.Might, Might = 82, Wisdom = 60, Command = 66,
                WebElement = WebElement.Water, QuoteKo = "물 냄새가 요즘 영 비릿해." },
            // 109-14-20 해솔(9장 끝) — 뇌 대도(웹 ⑲-20)
            new Hero { Id = "story_haesol", NameKo = "해솔", Era = HeroEra.Story, Faction = "재야", Rarity = 5, Trait = HeroTrait.Might, Might = 91, Wisdom = 70, Command = 68,
                WebElement = WebElement.Elec, QuoteKo = "……고맙다. 노래를 다시 부를 수 있을 것 같아." },
            // 109-14-30 하람(12장 끝) — 화 활(신호탄), 지(智) 갈래(웹 ⑲-30)
            new Hero { Id = "story_haram", NameKo = "하람", Era = HeroEra.Story, Faction = "재야", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 62, Wisdom = 84, Command = 64,
                WebElement = WebElement.Fire, QuoteKo = "날씨도 시간도, 재야 아는 거니까." },
        };

        public static bool IsStory(string id) => id != null && id.StartsWith("story_");

        /// <summary>지역마다 서는 자리 한 곳 — 무리·역참·상자·사건 칸을 비킨 걸을 수 있는 땅(`PlaytestGoHeroes` 가 잰다).</summary>
        public static readonly Stand[] Stands =
        {
            new Stand { RegionId = "village",     Gx = 3.7f, Gy = 4.1f },
            new Stand { RegionId = "west_wood",   Gx = 0.15f, Gy = 2.0f },
            new Stand { RegionId = "east_grove",  Gx = 6.2f, Gy = 3.8f },
            new Stand { RegionId = "farmland",    Gx = 3.4f, Gy = 8.9f },
            new Stand { RegionId = "north_foot",  Gx = 3.3f, Gy = 0.9f },
            new Stand { RegionId = "south_glade", Gx = 4.4f, Gy = 7.4f },
        };

        /// <summary>지역 → 그 지역에 서는 인물 id 들(표 순서). 위험도 = 희귀도 − 2 인 지역에 돌아가며.</summary>
        public static List<string> RosterOf(string regionId)
        {
            var list = new List<string>();
            var byDanger = new Dictionary<int, List<string>>();
            foreach (var s in Stands)
            {
                int d = GoWorldMap.DangerOf(s.RegionId);
                if (!byDanger.TryGetValue(d, out var regions)) byDanger[d] = regions = new List<string>();
                regions.Add(s.RegionId);
            }
            var turn = new Dictionary<int, int>();
            foreach (var h in All)
            {
                int d = Mathf.Clamp(h.Rarity - 2, 1, GoWorldMap.MaxDanger);
                if (!byDanger.TryGetValue(d, out var regions)) continue;
                turn.TryGetValue(d, out int t);
                if (regions[t % regions.Count] == regionId) list.Add(h.Id);
                turn[d] = t + 1;
            }
            return list;
        }

        private static Dictionary<string, string> _regionOf;

        /// <summary>그 인물이 서는 지역 id(도감 화면 "어디서 만나나" 한 줄). 없는 id 면 null.</summary>
        public static string RegionOf(string heroId)
        {
            if (_regionOf == null)
            {
                _regionOf = new Dictionary<string, string>();
                foreach (var s in Stands)
                    foreach (var id in RosterOf(s.RegionId)) _regionOf[id] = s.RegionId;
            }
            return heroId != null && _regionOf.TryGetValue(heroId, out var r) ? r : null;
        }

        public static string TraitName(HeroTrait t)
        {
            switch (t)
            {
                case HeroTrait.Might: return GoLocalization.T("hero.trait.might", "무");
                case HeroTrait.Wisdom: return GoLocalization.T("hero.trait.wisdom", "지");
                case HeroTrait.Virtue: return GoLocalization.T("hero.trait.virtue", "덕");
                default: return GoLocalization.T("hero.trait.command", "통");
            }
        }

        public static readonly Hero[] All =
        {
            new Hero { Id = "sg_guanyu", NameKo = "명운", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 5, Trait = HeroTrait.Virtue, Might = 97, Wisdom = 75, Command = 95, WebElement = WebElement.Elec,
                QuoteKo = "의(義)를 아는 이와 함께라면 어디든 가겠소." },
            new Hero { Id = "sg_zhangfei", NameKo = "뇌호", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 4, Trait = HeroTrait.Might, Might = 98, Wisdom = 45, Command = 80, WebElement = WebElement.Ice,
                QuoteKo = "술이나 한잔 하며 이야기하세!" },
            new Hero { Id = "sg_zhaoyun", NameKo = "은창", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 5, Trait = HeroTrait.Virtue, Might = 96, Wisdom = 76, Command = 91, WebElement = WebElement.Elec,
                QuoteKo = "한 몸 바쳐 주공을 지키겠습니다." },
            new Hero { Id = "sg_zhugeliang", NameKo = "현책", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 38, Wisdom = 100, Command = 92, WebElement = WebElement.Ice,
                QuoteKo = "삼고초려의 뜻, 잊지 않겠습니다." },
            new Hero { Id = "sg_liubei", NameKo = "인형", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 5, Trait = HeroTrait.Virtue, Might = 72, Wisdom = 78, Command = 90, WebElement = WebElement.Fire,
                QuoteKo = "백성을 생각하는 마음이 같구려." },
            new Hero { Id = "sg_machao", NameKo = "서풍", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 4, Trait = HeroTrait.Might, Might = 97, Wisdom = 44, Command = 87, WebElement = WebElement.Rock,
                QuoteKo = "서량의 창끝을 빌려주겠다." },
            new Hero { Id = "sg_huangzhong", NameKo = "노궁", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 4, Trait = HeroTrait.Might, Might = 93, Wisdom = 62, Command = 85, WebElement = WebElement.Elec,
                QuoteKo = "늙었다 얕보지 마라!" },
            new Hero { Id = "sg_caocao", NameKo = "패헌", Era = HeroEra.ThreeKingdoms, Faction = "위", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 72, Wisdom = 96, Command = 98, WebElement = WebElement.Water,
                QuoteKo = "내가 천하를 저버릴지언정, 천하가 나를 저버리게 두지 않는다." },
            new Hero { Id = "sg_simayi", NameKo = "은인", Era = HeroEra.ThreeKingdoms, Faction = "위", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 63, Wisdom = 98, Command = 94, WebElement = WebElement.Rock,
                QuoteKo = "때를 기다릴 줄 아는 자가 이깁니다." },
            new Hero { Id = "sg_xiahoudun", NameKo = "언무", Era = HeroEra.ThreeKingdoms, Faction = "위", Rarity = 4, Trait = HeroTrait.Might, Might = 92, Wisdom = 58, Command = 88, WebElement = WebElement.Fire,
                QuoteKo = "이 한쪽 눈으로도 적은 충분히 보인다." },
            new Hero { Id = "sg_zhangliao", NameKo = "철벽", Era = HeroEra.ThreeKingdoms, Faction = "위", Rarity = 4, Trait = HeroTrait.Might, Might = 94, Wisdom = 78, Command = 93, WebElement = WebElement.Wind,
                QuoteKo = "팔백으로 십만을 막아 보이겠소." },
            new Hero { Id = "sg_xunyu", NameKo = "청안", Era = HeroEra.ThreeKingdoms, Faction = "위", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 30, Wisdom = 96, Command = 70, WebElement = WebElement.Rock,
                QuoteKo = "왕좌지재(王佐之才)라 불러주시니 부끄럽습니다." },
            new Hero { Id = "sg_sunquan", NameKo = "벽해", Era = HeroEra.ThreeKingdoms, Faction = "오", Rarity = 4, Trait = HeroTrait.Virtue, Might = 70, Wisdom = 86, Command = 89, WebElement = WebElement.Fire,
                QuoteKo = "강동은 손을 잡을 줄 아는 자를 반깁니다." },
            new Hero { Id = "sg_zhouyu", NameKo = "화풍", Era = HeroEra.ThreeKingdoms, Faction = "오", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 71, Wisdom = 96, Command = 97, WebElement = WebElement.Fire,
                QuoteKo = "동남풍이 불면, 그때가 우리의 때입니다." },
            new Hero { Id = "sg_luxun", NameKo = "담연", Era = HeroEra.ThreeKingdoms, Faction = "오", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 66, Wisdom = 95, Command = 94, WebElement = WebElement.Rock,
                QuoteKo = "서두르지 않는 것이 제 병법입니다." },
            new Hero { Id = "sg_taishici", NameKo = "궁성", Era = HeroEra.ThreeKingdoms, Faction = "오", Rarity = 4, Trait = HeroTrait.Might, Might = 93, Wisdom = 66, Command = 82, WebElement = WebElement.Rock,
                QuoteKo = "활 솜씨를 보여드리지요." },
            new Hero { Id = "sg_ganning", NameKo = "영진", Era = HeroEra.ThreeKingdoms, Faction = "오", Rarity = 3, Trait = HeroTrait.Might, Might = 94, Wisdom = 60, Command = 79, WebElement = WebElement.Grass,
                QuoteKo = "방울 소리가 들리면 이미 늦은 것이다." },
            new Hero { Id = "sg_lubu", NameKo = "패창", Era = HeroEra.ThreeKingdoms, Faction = "군웅", Rarity = 5, Trait = HeroTrait.Might, Might = 100, Wisdom = 26, Command = 88, WebElement = WebElement.Elec,
                QuoteKo = "천하무쌍! 나를 막을 자가 있나?" },
            new Hero { Id = "sg_diaochan", NameKo = "월영", Era = HeroEra.ThreeKingdoms, Faction = "군웅", Rarity = 5, Trait = HeroTrait.Virtue, Might = 20, Wisdom = 88, Command = 40, WebElement = WebElement.Rock,
                QuoteKo = "이 몸이 도움이 된다면요." },
            new Hero { Id = "sg_pangtong", NameKo = "봉래", Era = HeroEra.ThreeKingdoms, Faction = "촉", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 40, Wisdom = 97, Command = 80, WebElement = WebElement.Fire,
                QuoteKo = "봉래가 여기 있습니다." },
            new Hero { Id = "sg_huatuo", NameKo = "신침", Era = HeroEra.ThreeKingdoms, Faction = "재야", Rarity = 4, Trait = HeroTrait.Virtue, Might = 15, Wisdom = 92, Command = 20, WebElement = WebElement.Elec,
                QuoteKo = "사람을 살리는 일이라면 함께하지요." },
            new Hero { Id = "sg_menghuo", NameKo = "만왕", Era = HeroEra.ThreeKingdoms, Faction = "남만", Rarity = 3, Trait = HeroTrait.Might, Might = 88, Wisdom = 40, Command = 76, WebElement = WebElement.Rock,
                QuoteKo = "일곱 번 져도 여덟 번 일어난다!" },
            new Hero { Id = "kr_yisunsin", NameKo = "해장", Era = HeroEra.Korea, Faction = "조선", Rarity = 5, Trait = HeroTrait.Virtue, Might = 92, Wisdom = 98, Command = 100, WebElement = WebElement.Elec,
                QuoteKo = "아직 신에게는 열두 척의 배가 남아 있사옵니다." },
            new Hero { Id = "kr_euljimundeok", NameKo = "현묘", Era = HeroEra.Korea, Faction = "고구려", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 88, Wisdom = 97, Command = 98, WebElement = WebElement.Fire,
                QuoteKo = "만족함을 알고 그만두기를 권하노라." },
            new Hero { Id = "kr_ganggamchan", NameKo = "강우", Era = HeroEra.Korea, Faction = "고려", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 80, Wisdom = 96, Command = 97, WebElement = WebElement.Rock,
                QuoteKo = "강물을 터뜨릴 준비는 끝났소." },
            new Hero { Id = "kr_kimyusin", NameKo = "화랑준", Era = HeroEra.Korea, Faction = "신라", Rarity = 5, Trait = HeroTrait.Might, Might = 95, Wisdom = 88, Command = 96, WebElement = WebElement.Elec,
                QuoteKo = "삼한을 하나로 잇겠소." },
            new Hero { Id = "kr_gyebaek", NameKo = "결사", Era = HeroEra.Korea, Faction = "백제", Rarity = 4, Trait = HeroTrait.Might, Might = 94, Wisdom = 70, Command = 90, WebElement = WebElement.Rock,
                QuoteKo = "오천으로 오만을 맞겠다." },
            new Hero { Id = "kr_yeongaesomun", NameKo = "철령", Era = HeroEra.Korea, Faction = "고구려", Rarity = 5, Trait = HeroTrait.Might, Might = 96, Wisdom = 82, Command = 95, WebElement = WebElement.Wind,
                QuoteKo = "요동의 성벽은 무너지지 않는다." },
            new Hero { Id = "kr_gwanggaeto", NameKo = "정복왕", Era = HeroEra.Korea, Faction = "고구려", Rarity = 5, Trait = HeroTrait.Might, Might = 97, Wisdom = 85, Command = 99, WebElement = WebElement.Wind,
                QuoteKo = "북으로, 더 북으로 나아가자." },
            new Hero { Id = "kr_sejong", NameKo = "훈민", Era = HeroEra.Korea, Faction = "조선", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 40, Wisdom = 100, Command = 95, WebElement = WebElement.Fire,
                QuoteKo = "백성이 쉽게 익혀 날로 쓰게 하고자 함이라." },
            new Hero { Id = "kr_jangyeongsil", NameKo = "성시", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 25, Wisdom = 97, Command = 45, WebElement = WebElement.Wind,
                QuoteKo = "해 그림자로 시간을 재어 보이겠습니다." },
            new Hero { Id = "kr_choemuseon", NameKo = "화포공", Era = HeroEra.Korea, Faction = "고려", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 55, Wisdom = 94, Command = 70, WebElement = WebElement.Wind,
                QuoteKo = "화약이라면 제게 맡기시지요." },
            new Hero { Id = "kr_daejoyeong", NameKo = "요동패", Era = HeroEra.Korea, Faction = "발해", Rarity = 5, Trait = HeroTrait.Command, Might = 90, Wisdom = 88, Command = 96, WebElement = WebElement.Rock,
                QuoteKo = "고구려의 뒤를 잇겠소." },
            new Hero { Id = "kr_wanggeon", NameKo = "통합공", Era = HeroEra.Korea, Faction = "고려", Rarity = 5, Trait = HeroTrait.Virtue, Might = 82, Wisdom = 88, Command = 94, WebElement = WebElement.Rock,
                QuoteKo = "흩어진 것을 다시 모으는 일이오." },
            new Hero { Id = "kr_jeongyakyong", NameKo = "만기", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 20, Wisdom = 98, Command = 60, WebElement = WebElement.Grass,
                QuoteKo = "거중기로 백성의 짐을 덜겠습니다." },
            new Hero { Id = "kr_heojun", NameKo = "활인", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Virtue, Might = 15, Wisdom = 95, Command = 40, WebElement = WebElement.Fire,
                QuoteKo = "병 앞에 귀천이 어디 있겠습니까." },
            new Hero { Id = "kr_sinsaimdang", NameKo = "초충당", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Virtue, Might = 12, Wisdom = 92, Command = 55, WebElement = WebElement.Ice,
                QuoteKo = "붓끝에 마음을 담을 뿐입니다." },
            new Hero { Id = "kr_ahnjunggeun", NameKo = "동양평", Era = HeroEra.Korea, Faction = "대한제국", Rarity = 5, Trait = HeroTrait.Virtue, Might = 88, Wisdom = 90, Command = 85, WebElement = WebElement.Rock,
                QuoteKo = "하루라도 글을 읽지 않으면 입에 가시가 돋는다." },
            new Hero { Id = "kr_yugwansun", NameKo = "소녀화", Era = HeroEra.Korea, Faction = "일제강점기", Rarity = 5, Trait = HeroTrait.Virtue, Might = 60, Wisdom = 80, Command = 88, WebElement = WebElement.Wind,
                QuoteKo = "나라에 바칠 목숨이 하나뿐인 것이 슬플 따름입니다." },
            new Hero { Id = "kr_kimgu", NameKo = "자강", Era = HeroEra.Korea, Faction = "일제강점기", Rarity = 5, Trait = HeroTrait.Virtue, Might = 70, Wisdom = 92, Command = 94, WebElement = WebElement.Ice,
                QuoteKo = "나의 소원은 오직 완전한 자주독립이오." },
            new Hero { Id = "kr_wonhyo", NameKo = "각원", Era = HeroEra.Korea, Faction = "신라", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 30, Wisdom = 96, Command = 50, WebElement = WebElement.Ice,
                QuoteKo = "모든 것은 마음이 짓는 것이오." },
            new Hero { Id = "kr_kimjeongho", NameKo = "방각", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 35, Wisdom = 93, Command = 40, WebElement = WebElement.Fire,
                QuoteKo = "이 땅을 한 장에 담아보겠습니다." },
            new Hero { Id = "kr_gwakjaeu", NameKo = "초모의", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Might, Might = 89, Wisdom = 80, Command = 88, WebElement = WebElement.Grass,
                QuoteKo = "홍의(紅衣)를 보면 왜적이 달아난다 하더이다." },
            new Hero { Id = "kr_nongae", NameKo = "화영", Era = HeroEra.Korea, Faction = "조선", Rarity = 4, Trait = HeroTrait.Virtue, Might = 55, Wisdom = 70, Command = 50, WebElement = WebElement.Water,
                QuoteKo = "남강의 물결을 기억해 주십시오." },
            new Hero { Id = "kr_yihwang", NameKo = "경헌", Era = HeroEra.Korea, Faction = "조선", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 15, Wisdom = 95, Command = 55, WebElement = WebElement.Elec,
                QuoteKo = "경(敬)으로써 마음을 바로 합니다." },
            new Hero { Id = "kr_yii", NameKo = "문형", Era = HeroEra.Korea, Faction = "조선", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 20, Wisdom = 96, Command = 65, WebElement = WebElement.Rock,
                QuoteKo = "십만 양병이 늦지 않았기를 바랍니다." },
            new Hero { Id = "kr_hwanghui", NameKo = "균형공", Era = HeroEra.Korea, Faction = "조선", Rarity = 3, Trait = HeroTrait.Virtue, Might = 18, Wisdom = 90, Command = 75, WebElement = WebElement.Water,
                QuoteKo = "네 말도 옳고, 네 말도 옳다." },
            new Hero { Id = "kr_jeongmongju", NameKo = "청죽", Era = HeroEra.Korea, Faction = "고려", Rarity = 4, Trait = HeroTrait.Virtue, Might = 35, Wisdom = 93, Command = 68, WebElement = WebElement.Grass,
                QuoteKo = "일백 번 고쳐 죽어도 마음은 하나입니다." },
            new Hero { Id = "jp_himiko", NameKo = "여왕영", Era = HeroEra.Japan, Faction = "야마타이", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 20, Wisdom = 98, Command = 80, WebElement = WebElement.Rock,
                QuoteKo = "귀도(鬼道)로 백성의 마음을 다스리오." },
            new Hero { Id = "jp_taira", NameKo = "평가주", Era = HeroEra.Japan, Faction = "다이라가", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 70, Wisdom = 80, Command = 92, WebElement = WebElement.Elec,
                QuoteKo = "헤이케(平家) 아니면 사람이 아니다." },
            new Hero { Id = "jp_yoritomo", NameKo = "막부조", Era = HeroEra.Japan, Faction = "가마쿠라막부", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 65, Wisdom = 90, Command = 97, WebElement = WebElement.Wind,
                QuoteKo = "무사의 세상을 열겠다." },
            new Hero { Id = "jp_yoshitsune", NameKo = "비장군", Era = HeroEra.Japan, Faction = "겐지가", Rarity = 5, Trait = HeroTrait.Might, Might = 95, Wisdom = 80, Command = 88, WebElement = WebElement.Rock,
                QuoteKo = "형의 그늘 아래서도 활은 빗나가지 않았다." },
            new Hero { Id = "jp_murasaki", NameKo = "원씨필", Era = HeroEra.Japan, Faction = "헤이안", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 10, Wisdom = 99, Command = 40, WebElement = WebElement.Fire,
                QuoteKo = "덧없는 세상, 이야기로 남기겠소." },
            new Hero { Id = "jp_seishonagon", NameKo = "침초필", Era = HeroEra.Japan, Faction = "헤이안", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 8, Wisdom = 96, Command = 35, WebElement = WebElement.Wind,
                QuoteKo = "봄은 새벽이 가장 좋습니다." },
            new Hero { Id = "jp_tomoegozen", NameKo = "여무연", Era = HeroEra.Japan, Faction = "겐지가", Rarity = 4, Trait = HeroTrait.Might, Might = 90, Wisdom = 60, Command = 78, WebElement = WebElement.Wind,
                QuoteKo = "여인이라 활을 못 당길 이유가 없소." },
            new Hero { Id = "jp_nobunaga", NameKo = "화천마", Era = HeroEra.Japan, Faction = "오다가", Rarity = 5, Trait = HeroTrait.Might, Might = 88, Wisdom = 90, Command = 97, WebElement = WebElement.Ice,
                QuoteKo = "울지 않는 새는 베어버린다." },
            new Hero { Id = "jp_hideyoshi", NameKo = "태합원", Era = HeroEra.Japan, Faction = "도요토미가", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 60, Wisdom = 96, Command = 96, WebElement = WebElement.Elec,
                QuoteKo = "천하는 재주로도 쥘 수 있소." },
            new Hero { Id = "jp_ieyasu", NameKo = "인내옹", Era = HeroEra.Japan, Faction = "도쿠가와막부", Rarity = 5, Trait = HeroTrait.Virtue, Might = 70, Wisdom = 94, Command = 98, WebElement = WebElement.Ice,
                QuoteKo = "두견새는 울 때까지 기다리면 되오." },
            new Hero { Id = "jp_shingen", NameKo = "풍림화", Era = HeroEra.Japan, Faction = "다케다가", Rarity = 5, Trait = HeroTrait.Might, Might = 90, Wisdom = 88, Command = 95, WebElement = WebElement.Ice,
                QuoteKo = "바람처럼 빠르고 숲처럼 고요하게." },
            new Hero { Id = "jp_kenshin", NameKo = "군신아", Era = HeroEra.Japan, Faction = "우에스기가", Rarity = 5, Trait = HeroTrait.Virtue, Might = 93, Wisdom = 85, Command = 94, WebElement = WebElement.Fire,
                QuoteKo = "적에게 소금을 보내지 않을 이유가 없소." },
            new Hero { Id = "jp_masamune", NameKo = "독안룡", Era = HeroEra.Japan, Faction = "다테가", Rarity = 4, Trait = HeroTrait.Might, Might = 91, Wisdom = 82, Command = 90, WebElement = WebElement.Rock,
                QuoteKo = "한쪽 눈으로도 천하는 다 보인다." },
            new Hero { Id = "jp_yukimura", NameKo = "일번창", Era = HeroEra.Japan, Faction = "사나다가", Rarity = 5, Trait = HeroTrait.Might, Might = 96, Wisdom = 75, Command = 89, WebElement = WebElement.Ice,
                QuoteKo = "오사카의 마지막 창은 내가 쥐겠소." },
            new Hero { Id = "jp_musashi", NameKo = "이도인", Era = HeroEra.Japan, Faction = "낭인", Rarity = 4, Trait = HeroTrait.Might, Might = 97, Wisdom = 70, Command = 60, WebElement = WebElement.Fire,
                QuoteKo = "천 일의 연습, 만 일의 단련." },
            new Hero { Id = "jp_hanzo", NameKo = "암영조", Era = HeroEra.Japan, Faction = "이가", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 75, Wisdom = 88, Command = 65, WebElement = WebElement.Ice,
                QuoteKo = "그림자는 소리를 남기지 않는다." },
            new Hero { Id = "jp_mitsukuni", NameKo = "천하부", Era = HeroEra.Japan, Faction = "도쿠가와막부", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 30, Wisdom = 92, Command = 75, WebElement = WebElement.Elec,
                QuoteKo = "이 나라의 역사를 편찬하겠소." },
            new Hero { Id = "jp_naosuke", NameKo = "개항로", Era = HeroEra.Japan, Faction = "도쿠가와막부", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 25, Wisdom = 90, Command = 80, WebElement = WebElement.Fire,
                QuoteKo = "문을 여는 것도 나라를 지키는 길이오." },
            new Hero { Id = "jp_saigo", NameKo = "최후향", Era = HeroEra.Japan, Faction = "메이지유신", Rarity = 5, Trait = HeroTrait.Virtue, Might = 85, Wisdom = 80, Command = 92, WebElement = WebElement.Wind,
                QuoteKo = "경천애인(敬天愛人), 하늘을 공경하고 사람을 사랑하라." },
            new Hero { Id = "jp_ryoma", NameKo = "해원랑", Era = HeroEra.Japan, Faction = "메이지유신", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 55, Wisdom = 92, Command = 85, WebElement = WebElement.Ice,
                QuoteKo = "세상을 다시 씻어내야 하오." },
            new Hero { Id = "eu_caesar", NameKo = "발레리안", Era = HeroEra.World, Faction = "로마", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 78, Wisdom = 92, Command = 98, WebElement = WebElement.Water,
                QuoteKo = "왔노라, 보았노라, 그리고 함께 가겠노라." },
            new Hero { Id = "eu_alexander", NameKo = "카시안더", Era = HeroEra.World, Faction = "마케도니아", Rarity = 5, Trait = HeroTrait.Might, Might = 94, Wisdom = 88, Command = 97, WebElement = WebElement.Elec,
                QuoteKo = "세상의 끝까지 가 보고 싶지 않은가." },
            new Hero { Id = "eu_hannibal", NameKo = "마그나로", Era = HeroEra.World, Faction = "카르타고", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 85, Wisdom = 95, Command = 94, WebElement = WebElement.Rock,
                QuoteKo = "길이 없다면 알프스를 넘어 만들면 된다." },
            new Hero { Id = "eu_charlemagne", NameKo = "로타리안", Era = HeroEra.World, Faction = "프랑크", Rarity = 5, Trait = HeroTrait.Virtue, Might = 85, Wisdom = 82, Command = 95, WebElement = WebElement.Fire,
                QuoteKo = "검과 글을 함께 쥔 나라를 세우려 하오." },
            new Hero { Id = "eu_joan", NameKo = "셀렌느", Era = HeroEra.World, Faction = "프랑스", Rarity = 5, Trait = HeroTrait.Virtue, Might = 78, Wisdom = 70, Command = 92, WebElement = WebElement.Rock,
                QuoteKo = "두려움은 제 것이 아닙니다. 깃발을 드십시오." },
            new Hero { Id = "eu_napoleon", NameKo = "발데나르", Era = HeroEra.World, Faction = "프랑스", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 80, Wisdom = 96, Command = 99, WebElement = WebElement.Elec,
                QuoteKo = "불가능이라는 말은 겁쟁이의 변명이오." },
            new Hero { Id = "eu_davinci", NameKo = "마라노", Era = HeroEra.World, Faction = "이탈리아", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 25, Wisdom = 100, Command = 58, WebElement = WebElement.Wind,
                QuoteKo = "아직 그리지 못한 것이 너무 많소." },
            new Hero { Id = "eu_augustus", NameKo = "세레누스", Era = HeroEra.World, Faction = "로마", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 55, Wisdom = 94, Command = 92, WebElement = WebElement.Grass,
                QuoteKo = "벽돌의 도시를 대리석으로 바꾸겠소." },
            new Hero { Id = "eu_scipio", NameKo = "코르비날", Era = HeroEra.World, Faction = "로마", Rarity = 4, Trait = HeroTrait.Might, Might = 82, Wisdom = 88, Command = 90, WebElement = WebElement.Wind,
                QuoteKo = "마그나로를 이기는 법은 마그나로에게 배웠소." },
            new Hero { Id = "eu_leonidas", NameKo = "테살로르", Era = HeroEra.World, Faction = "스파르타", Rarity = 4, Trait = HeroTrait.Might, Might = 92, Wisdom = 60, Command = 86, WebElement = WebElement.Elec,
                QuoteKo = "와서 가져가라." },
            new Hero { Id = "eu_aurelius", NameKo = "베렌델", Era = HeroEra.World, Faction = "로마", Rarity = 4, Trait = HeroTrait.Virtue, Might = 58, Wisdom = 96, Command = 84, WebElement = WebElement.Water,
                QuoteKo = "오늘 할 수 있는 선(善)을 미루지 마시오." },
            new Hero { Id = "eu_richard", NameKo = "코드윈", Era = HeroEra.World, Faction = "잉글랜드", Rarity = 4, Trait = HeroTrait.Might, Might = 93, Wisdom = 65, Command = 86, WebElement = WebElement.Wind,
                QuoteKo = "사자의 심장은 물러서는 법을 모른다." },
            new Hero { Id = "eu_william", NameKo = "펜드릭", Era = HeroEra.World, Faction = "노르만", Rarity = 4, Trait = HeroTrait.Might, Might = 88, Wisdom = 78, Command = 90, WebElement = WebElement.Ice,
                QuoteKo = "바다를 건넜으면 배는 태워야 하오." },
            new Hero { Id = "eu_harald", NameKo = "오스트바르드", Era = HeroEra.World, Faction = "노르웨이", Rarity = 4, Trait = HeroTrait.Might, Might = 95, Wisdom = 62, Command = 84, WebElement = WebElement.Elec,
                QuoteKo = "북쪽에서 왔다. 노를 저을 줄 아는가." },
            new Hero { Id = "eu_frederick", NameKo = "바실로른", Era = HeroEra.World, Faction = "프로이센", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 78, Wisdom = 93, Command = 95, WebElement = WebElement.Elec,
                QuoteKo = "왕은 나라의 첫째 종복이오." },
            new Hero { Id = "eu_peter", NameKo = "볼카노프", Era = HeroEra.World, Faction = "러시아", Rarity = 4, Trait = HeroTrait.Might, Might = 82, Wisdom = 90, Command = 93, WebElement = WebElement.Ice,
                QuoteKo = "바다로 나가는 창을 열어야 하오." },
            new Hero { Id = "eu_elizabeth", NameKo = "코리넬레", Era = HeroEra.World, Faction = "잉글랜드", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 25, Wisdom = 95, Command = 90, WebElement = WebElement.Grass,
                QuoteKo = "나는 이 나라와 혼인했소." },
            new Hero { Id = "eu_nelson", NameKo = "애쉬그레이브", Era = HeroEra.World, Faction = "잉글랜드", Rarity = 4, Trait = HeroTrait.Might, Might = 85, Wisdom = 88, Command = 92, WebElement = WebElement.Rock,
                QuoteKo = "나라가 각자의 본분을 기대하고 있다." },
            new Hero { Id = "eu_machiavelli", NameKo = "반토렐리", Era = HeroEra.World, Faction = "이탈리아", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 22, Wisdom = 96, Command = 70, WebElement = WebElement.Rock,
                QuoteKo = "사랑받기 어렵다면, 적어도 얕보이지는 마시오." },
            new Hero { Id = "eu_newton", NameKo = "할베린", Era = HeroEra.World, Faction = "잉글랜드", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 15, Wisdom = 100, Command = 48, WebElement = WebElement.Wind,
                QuoteKo = "거인의 어깨에 올라섰을 뿐이오." },
            new Hero { Id = "eu_michelangelo", NameKo = "첼로리니", Era = HeroEra.World, Faction = "이탈리아", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 32, Wisdom = 94, Command = 54, WebElement = WebElement.Ice,
                QuoteKo = "돌 안에 이미 있는 것을 꺼낼 뿐이오." },
            new Hero { Id = "eu_eleanor", NameKo = "바엘린", Era = HeroEra.World, Faction = "프랑스", Rarity = 3, Trait = HeroTrait.Virtue, Might = 20, Wisdom = 90, Command = 78, WebElement = WebElement.Grass,
                QuoteKo = "두 왕국의 왕비였으니, 셈은 제가 하겠소." },
            new Hero { Id = "wd_ashoka", NameKo = "법륜왕", Era = HeroEra.World, Faction = "마우리아", Rarity = 5, Trait = HeroTrait.Virtue, Might = 60, Wisdom = 92, Command = 90, WebElement = WebElement.Fire,
                QuoteKo = "칼로 얻은 땅을 이제 법으로 다스리겠다." },
            new Hero { Id = "wd_akbar", NameKo = "관용제", Era = HeroEra.World, Faction = "무굴", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 75, Wisdom = 93, Command = 95, WebElement = WebElement.Water,
                QuoteKo = "믿음은 강요로 얻어지지 않는다." },
            new Hero { Id = "wd_saladin", NameKo = "의검주", Era = HeroEra.World, Faction = "아이유브", Rarity = 5, Trait = HeroTrait.Virtue, Might = 88, Wisdom = 90, Command = 96, WebElement = WebElement.Water,
                QuoteKo = "예루살렘의 문은 자비로도 열린다." },
            new Hero { Id = "wd_suleiman", NameKo = "장려제", Era = HeroEra.World, Faction = "오스만", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 80, Wisdom = 95, Command = 97, WebElement = WebElement.Elec,
                QuoteKo = "법과 영광을 함께 세우겠다." },
            new Hero { Id = "wd_ibnsina", NameKo = "의철인", Era = HeroEra.World, Faction = "페르시아", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 10, Wisdom = 99, Command = 40, WebElement = WebElement.Water,
                QuoteKo = "몸의 이치를 책 한 권에 담겠소." },
            new Hero { Id = "wd_genghis", NameKo = "초원패", Era = HeroEra.World, Faction = "몽골제국", Rarity = 5, Trait = HeroTrait.Might, Might = 96, Wisdom = 85, Command = 99, WebElement = WebElement.Water,
                QuoteKo = "세상의 끝까지 말을 달리겠다." },
            new Hero { Id = "wd_khubilai", NameKo = "대원조", Era = HeroEra.World, Faction = "원", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 75, Wisdom = 90, Command = 95, WebElement = WebElement.Rock,
                QuoteKo = "초원과 중원을 하나로 잇겠다." },
            new Hero { Id = "wd_mansamusa", NameKo = "황금왕", Era = HeroEra.World, Faction = "말리제국", Rarity = 5, Trait = HeroTrait.Virtue, Might = 55, Wisdom = 88, Command = 90, WebElement = WebElement.Rock,
                QuoteKo = "금은 나눌수록 내 것이 된다." },
            new Hero { Id = "wd_shaka", NameKo = "창군왕", Era = HeroEra.World, Faction = "줄루왕국", Rarity = 4, Trait = HeroTrait.Might, Might = 94, Wisdom = 75, Command = 92, WebElement = WebElement.Wind,
                QuoteKo = "짧은 창이 긴 창을 이긴다." },
            new Hero { Id = "wd_cleopatra", NameKo = "나일화", Era = HeroEra.World, Faction = "프톨레마이오스", Rarity = 5, Trait = HeroTrait.Wisdom, Might = 30, Wisdom = 95, Command = 88, WebElement = WebElement.Fire,
                QuoteKo = "나일강은 아직 나의 편이오." },
            new Hero { Id = "wd_pachacuti", NameKo = "태양개", Era = HeroEra.World, Faction = "잉카제국", Rarity = 4, Trait = HeroTrait.Wisdom, Might = 65, Wisdom = 88, Command = 93, WebElement = WebElement.Water,
                QuoteKo = "세상을 뒤바꾸는 자, 그것이 나의 이름이다." },
            new Hero { Id = "wd_moctezuma", NameKo = "독수리주", Era = HeroEra.World, Faction = "아즈텍", Rarity = 4, Trait = HeroTrait.Virtue, Might = 60, Wisdom = 82, Command = 85, WebElement = WebElement.Fire,
                QuoteKo = "별들이 낯선 자들의 도착을 알렸다." },
            new Hero { Id = "wd_ibnbattuta", NameKo = "천리객", Era = HeroEra.World, Faction = "여행자", Rarity = 3, Trait = HeroTrait.Wisdom, Might = 20, Wisdom = 90, Command = 50, WebElement = WebElement.Fire,
                QuoteKo = "길이 있는 한 걸음을 멈추지 않겠소." },
            new Hero { Id = "wd_hammurabi", NameKo = "율법석", Era = HeroEra.World, Faction = "바빌로니아", Rarity = 4, Trait = HeroTrait.Virtue, Might = 50, Wisdom = 92, Command = 88, WebElement = WebElement.Ice,
                QuoteKo = "눈에는 눈, 이에는 이, 돌에 새겨 두겠다." },
            new Hero { Id = "wd_attila", NameKo = "재앙편", Era = HeroEra.World, Faction = "훈제국", Rarity = 5, Trait = HeroTrait.Might, Might = 95, Wisdom = 78, Command = 94, WebElement = WebElement.Ice,
                QuoteKo = "신의 채찍이 여기 있다." },
        };
    }
}
