using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-13 ① "싸움터 땅" — 웹 사가국지 §5-11 `battleLook(cityId)` 를 이 트랙으로(코드 공유 없음, 표·수치 그대로).
    /// 성마다 고정 싸움터: 땅(`land`) 넷 — 평야(풀)·구릉(둔덕)·강가(갈대 + 앞쪽 물줄기)·산성(봉우리) — 을 주(`prov`)가
    /// 덮어쓰는 곳은 사막·초원·밀림·해안·균열·폐허·묘역. 바닥빛·하늘·소품 자리(가장자리 반지름 8.4~9.8, 순번 — 무작위 없음).
    /// 판정(`RealmLand` Plain/River — 성벽·전술 배율)은 그대로고 이 표는 **그리기만** 쓴다(`RealmBattlefield`).
    /// 성마다 땅·주는 웹 `data-city.js` CITIES 에서 옮겼다(웹에 없는 정도는 이웃 복양·진류와 같은 연주 평야).
    /// 웹의 물 싸움(수전 물빛)은 이 트랙에 수전이 없어 뺐다. 지금 쉰여덟 성에 쓰이는 결은 여섯(평야·강가·산성·구릉·초원·밀림) —
    /// 사막·해안·균열·폐허·묘역은 그런 주의 성이 이 트랙에 아직 없어 표에만 있다.
    /// </summary>
    public static class RealmBattleLook
    {
        public enum Prop { Grass, Mound, Reed, Peak, Dune, Crystal, Rubble, Grave }

        public readonly struct PropSpot
        {
            public readonly Prop Kind;
            public readonly float X, Z, Scale;
            public PropSpot(Prop kind, float x, float z, float scale) { Kind = kind; X = x; Z = z; Scale = scale; }
        }

        public readonly struct Look
        {
            public readonly string Key;   // 결 이름 키(plain·desert …) — 번역 표 "battle.look.<key>"
            public readonly Color Ground;
            public readonly Color Sky;
            public readonly Prop PropKind;
            public readonly bool Stream;
            public readonly PropSpot[] Props;
            public Look(string key, Color ground, Color sky, Prop prop, bool stream, PropSpot[] props)
            {
                Key = key; Ground = ground; Sky = sky; PropKind = prop; Stream = stream; Props = props;
            }
            public string Name => RealmLocalization.T("battle.look." + Key, KoNames.TryGetValue(Key, out var n) ? n : Key);
        }

        private readonly struct Def
        {
            public readonly string Key; public readonly int Ground, Sky; public readonly Prop Prop; public readonly bool Stream;
            public Def(string key, int ground, int sky, Prop prop, bool stream = false) { Key = key; Ground = ground; Sky = sky; Prop = prop; Stream = stream; }
        }

        private static readonly Dictionary<string, string> KoNames = new Dictionary<string, string>
        {
            ["plain"] = "평야", ["hill"] = "구릉", ["river"] = "강가", ["mount"] = "산성",
            ["desert"] = "사막", ["steppe"] = "초원", ["jungle"] = "밀림", ["coast"] = "해안",
            ["rift"] = "균열", ["ruin"] = "폐허", ["grave"] = "묘역",
        };

        // 웹 LAND_LOOK 그대로.
        private static readonly Dictionary<string, Def> LandLook = new Dictionary<string, Def>
        {
            ["plain"] = new Def("plain", 0xcfe0a0, 0xb9dcef, Prop.Grass),
            ["hill"] = new Def("hill", 0xb8cf86, 0xb4d6e8, Prop.Mound),
            ["river"] = new Def("river", 0xa9d18f, 0xa9d2ea, Prop.Reed, stream: true),
            ["mount"] = new Def("mount", 0x9fa98a, 0xaecadb, Prop.Peak),
        };

        // 웹 PROV_LOOK 그대로(주가 땅 결을 덮어쓰는 곳).
        private static readonly Dictionary<string, Def> ProvLook = new Dictionary<string, Def>
        {
            ["xi"] = new Def("desert", 0xe0c98f, 0xe8d9b8, Prop.Dune), ["sl"] = new Def("desert", 0xdcc088, 0xe6d4ae, Prop.Dune),
            ["dj"] = new Def("desert", 0xd9c49a, 0xe2d6bd, Prop.Dune), ["liang"] = new Def("desert", 0xd6c08e, 0xe0d2b0, Prop.Dune),
            ["mb"] = new Def("steppe", 0xc9d27a, 0xc4ddec, Prop.Grass), ["xb"] = new Def("steppe", 0xc4cc72, 0xc0d9e8, Prop.Grass),
            ["nz"] = new Def("jungle", 0x7fae62, 0xa8cfc0, Prop.Reed), ["tz"] = new Def("jungle", 0x8ab466, 0xb2d4c4, Prop.Reed),
            ["cp"] = new Def("jungle", 0x80ad64, 0xaccfc0, Prop.Reed), ["nh"] = new Def("coast", 0xd8d0a0, 0x9fd0e8, Prop.Reed, stream: true),
            ["fu"] = new Def("rift", 0x6d5a8a, 0x8a7ab0, Prop.Crystal),
            ["pf"] = new Def("ruin", 0x8c8a80, 0xa6a6a0, Prop.Rubble),
            ["my"] = new Def("grave", 0x6f7560, 0x8c9488, Prop.Grave),
        };

        /// <summary>성 id → (웹 land, 웹 prov). `RealmCityData` 쉰여덟 성 전부.</summary>
        public static readonly Dictionary<string, (string land, string prov)> Cities = new Dictionary<string, (string, string)>
        {
            ["xuchang"] = ("plain", "yu"), ["chenliu"] = ("plain", "yan"), ["puyang"] = ("river", "yan"), ["xiaopei"] = ("plain", "xu"),
            ["dingtao"] = ("plain", "yan"), ["luoyang"] = ("plain", "si"), ["xiapi"] = ("river", "xu"), ["ye"] = ("plain", "ji"),
            ["changan"] = ("plain", "si"), ["shouchun"] = ("river", "yang"), ["jinyang"] = ("mount", "bing"), ["hanzhong"] = ("mount", "yi"),
            ["runan"] = ("plain", "yu"), ["chengdu"] = ("plain", "yi"), ["jiangxia"] = ("river", "jing"), ["jiangzhou"] = ("river", "yi"),
            ["xiangyang"] = ("river", "jing"), ["yongan"] = ("mount", "yi"), ["jiangling"] = ("river", "jing"), ["changsha"] = ("hill", "jing"),
            ["chaisang"] = ("river", "yang"), ["jianye"] = ("river", "yang"), ["kuaiji"] = ("plain", "yang"), ["yunzhong"] = ("plain", "mb"),
            ["shangjun"] = ("hill", "mb"), ["shuofang"] = ("plain", "mb"), ["wuyuan"] = ("hill", "mb"), ["beidi"] = ("plain", "mb"),
            ["yanmen"] = ("mount", "mb"), ["dingxiang"] = ("plain", "mb"), ["tianshui"] = ("hill", "yong"), ["nanhai"] = ("plain", "jiao"),
            ["zhuti"] = ("river", "nz"), ["cangwu"] = ("hill", "jiao"), ["jianning"] = ("plain", "nz"), ["yulin"] = ("hill", "jiao"),
            ["yuexi"] = ("mount", "nz"), ["jiaozhi"] = ("river", "jiao"), ["zangke"] = ("hill", "nz"), ["jiuzhen"] = ("plain", "jiao"),
            ["hepu"] = ("river", "jiao"), ["rinan"] = ("hill", "jiao"), ["yunnan"] = ("mount", "nz"), ["xianglin"] = ("plain", "cp"),
            ["yongchang"] = ("plain", "nz"), ["dianchong"] = ("plain", "cp"), ["shendu"] = ("plain", "tz"), ["bijing"] = ("river", "cp"),
            ["jiantuoluo"] = ("hill", "tz"), ["luorong"] = ("plain", "cp"), ["jibin"] = ("mount", "tz"), ["daxia"] = ("hill", "tz"),
            ["wuyishanli"] = ("hill", "tz"), ["moqietuo"] = ("plain", "tz"), ["sheyi"] = ("plain", "tz"), ["zhuwu"] = ("river", "cp"),
            ["xiquan"] = ("hill", "cp"), ["quzu"] = ("hill", "cp"),
        };

        /// <summary>순수 함수 — 이 성의 싸움터. 표에 없는 성은 평야. 소품은 풀이면 여섯, 나머지는 여덟(웹 그대로).</summary>
        public static Look For(string cityId)
        {
            Def d = LandLook["plain"];
            if (cityId != null && Cities.TryGetValue(cityId, out var c))
            {
                if (ProvLook.TryGetValue(c.prov, out var p)) d = p;
                else if (LandLook.TryGetValue(c.land, out var l)) d = l;
            }
            int n = d.Prop == Prop.Grass ? 6 : 8;
            var props = new PropSpot[n];
            for (int i = 0; i < n; i++)
            {
                float a = (i + 0.5f) / n * Mathf.PI * 2f + 0.3f, r = 8.4f + (i % 3) * 0.7f;
                props[i] = new PropSpot(d.Prop, Mathf.Cos(a) * r, Mathf.Sin(a) * r, 0.8f + (i % 4) * 0.22f);
            }
            return new Look(d.Key, Hex(d.Ground), Hex(d.Sky), d.Prop, d.Stream, props);
        }

        /// <summary>싸움터 이름 한 줄 — "소패 평야".</summary>
        public static string Title(string cityId)
        {
            var def = RealmCityData.Get(cityId);
            return string.Format(RealmLocalization.T("battle.title", "{0} {1}"), def != null ? def.Name : cityId, For(cityId).Name);
        }

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f);
    }
}
