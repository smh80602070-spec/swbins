using UnityEngine;

namespace Saga.Go.Data
{
    public enum GoEra { Past, Modern, Future }

    /// <summary>
    /// PLAN.md 109-1 "GO 세 시대 사람·적"(웹 사가고 ⑱ · SAGA-DESIGN §13 전체 퓨전) — 시대 표.
    /// 적: 들판 무리마다 시대를 해시로 고른다(선 지역의 제 시대 60%, 나머지 둘 20%씩 · 마을 역참 둘레는 제 시대만).
    /// 다른 시대 무리는 종류·원소·체력 규칙을 그대로 두고 **몸과 이름만** 그 시대 것으로 바꾼다(웹 "원소 규칙 그대로").
    /// 사람: 역참마다 셋(첫째 제 시대 + 나머지 둘) — `FolkBuilder`. 이름·대사는 전부 지어낸 것(실명 아님).
    /// </summary>
    public static class GoEras
    {
        /// <summary>제 시대 몫(나머지 두 시대가 반씩 나눈다).</summary>
        public const float MainShare = 0.6f;
        /// <summary>이 거리(m) 안 무리는 제 시대만 — 첫 걸음에 낯선 적부터 만나지 않게(웹 `field.eraFrom` 300m 를 이 지도 척도로).</summary>
        public const float MainOnlyRadius = 110f;
        public const string HashSalt = "#era";

        public static readonly GoEra[] All = { GoEra.Past, GoEra.Modern, GoEra.Future };

        /// <summary>지역의 제 시대 — 일곱 지역 모두 옛 땅(사연·한자가 옛것)이라 과거. 시대 섞임은 무리·사람 몫으로 온다.</summary>
        public static GoEra RegionEra(string regionId) => GoEra.Past;

        public static string EraName(GoEra e)
        {
            switch (e)
            {
                case GoEra.Modern: return GoLocalization.T("era.modern", "현대");
                case GoEra.Future: return GoLocalization.T("era.future", "미래");
                default: return GoLocalization.T("era.past", "과거");
            }
        }

        /// <summary>FNV-1a 32비트 — 씬·PC 가 달라도 같은 값(string.GetHashCode 는 실행마다 다를 수 있다).</summary>
        public static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (byte b in System.Text.Encoding.UTF8.GetBytes(s))
            {
                h ^= b;
                h *= 16777619;
            }
            return h;
        }

        /// <summary>제 시대 다음으로 도는 두 시대(과거 → 현대·미래, 현대 → 미래·과거, 미래 → 과거·현대).</summary>
        public static GoEra Next(GoEra e, int step) => (GoEra)(((int)e + step) % 3);

        /// <summary>무리 시대 — 한가운데와 마을 역참 거리, 무리 id 해시로 정한다(난수 0).</summary>
        public static GoEra GroupEra(string groupId, Vector3 center)
        {
            GoEra main = RegionEra(GoWorldMap.RegionAt(center));
            var home = GoWorldMap.Waypoints[0];
            Vector3 d = center - TestMapData.WorldPos(home.Gx, home.Gy);
            d.y = 0f;
            if (d.magnitude < MainOnlyRadius) return main;
            uint roll = Hash(groupId + HashSalt) % 100;
            if (roll < MainShare * 100f) return main;
            return Next(main, roll < 80 ? 1 : 2);
        }

        // ---- 다른 시대 적의 몸·이름 ------------------------------------------

        /// <summary>시대마다 적 몸 둘(무리 안에서 번갈아 선다). 과거는 옛 몸(산적·해골) 그대로라 표에 없다.</summary>
        public static string[] FoeBodies(GoEra e)
        {
            switch (e)
            {
                case GoEra.Modern: return new[] { "GasMask", "Copzombie" };
                case GoEra.Future: return new[] { "ExoRed", "AlienSoldier" };
                default: return new string[0];
            }
        }

        /// <summary>무리 안 i 번째가 입는 몸 — 무리 id 해시로 시작을 흩어 두 몸이 다 나오게.</summary>
        public static string FoeBodyFor(GoEra e, string groupId, int i)
        {
            var bodies = FoeBodies(e);
            if (bodies.Length == 0) return null;
            return bodies[(int)((Hash(groupId) + (uint)i) % (uint)bodies.Length)];
        }

        public static string FoeBodyName(string body)
        {
            switch (body)
            {
                case "GasMask": return GoLocalization.T("era.foe.gasmask", "방독면 약탈자");
                case "Copzombie": return GoLocalization.T("era.foe.copzombie", "떠도는 망자");
                case "ExoRed": return GoLocalization.T("era.foe.exored", "강철 경비병");
                case "AlienSoldier": return GoLocalization.T("era.foe.alien", "별바다 손님");
                default: return body;
            }
        }

        /// <summary>원소 쓰는 적이면 앞에 원소 낱말("벼락 떠도는 망자").</summary>
        public static string FoeName(string body, Combat.GoElement element)
        {
            string name = FoeBodyName(body);
            switch (element)
            {
                case Combat.GoElement.Pyro: return GoLocalization.T("era.foe.pre_pyro", "불꽃") + " " + name;
                case Combat.GoElement.Hydro: return GoLocalization.T("era.foe.pre_hydro", "물결") + " " + name;
                case Combat.GoElement.Electro: return GoLocalization.T("era.foe.pre_electro", "벼락") + " " + name;
                case Combat.GoElement.Anemo: return GoLocalization.T("era.foe.pre_anemo", "바람") + " " + name;
                case Combat.GoElement.Cryo: return GoLocalization.T("era.foe.pre_cryo", "서리") + " " + name;
                case Combat.GoElement.Geo: return GoLocalization.T("era.foe.pre_geo", "바위") + " " + name;
                case Combat.GoElement.Dendro: return GoLocalization.T("era.foe.pre_dendro", "덩굴") + " " + name;
                default: return name;
            }
        }

        // ---- 역참 둘레 사람 ----------------------------------------------------

        public struct FolkRole
        {
            public GoEra Era;
            public string Id;
            public string Body;
            public string NameKey, NameKo;
            /// <summary>{0} = 지역 이름, {1} = 역참 이름. 이름 바로 뒤에 조사를 붙이지 않게 썼다(받침 맞춤 불필요).</summary>
            public string LineKey, LineKo;
            /// <summary>몸이 없는 PC 의 캡슐 빛깔.</summary>
            public Color Fallback;
        }

        /// <summary>시대마다 역할 — 역할마다 몸이 다르다(색만 다른 몸 금지, 2026-09-25 사용자 지시).</summary>
        public static readonly FolkRole[] Roles =
        {
            new FolkRole { Era = GoEra.Past, Id = "woodcutter", Body = "PeasantMan", NameKey = "folk.woodcutter", NameKo = "나무꾼", Fallback = new Color(0.45f, 0.33f, 0.2f),
                LineKey = "folk.woodcutter.line", LineKo = "{0} 나무는 결이 곱지. {1} 둘레 장작은 내가 다 팬다오. 요새는 쇠옷 입은 손님이 자꾸 구경을 오네." },
            new FolkRole { Era = GoEra.Past, Id = "shrine_maiden", Body = "PeasantGirl", NameKey = "folk.shrine_maiden", NameKo = "무녀", Fallback = new Color(0.8f, 0.8f, 0.78f),
                LineKey = "folk.shrine_maiden.line", LineKo = "{0} 바람에 낯선 기운이 섞였어요. 하늘에 틈이 벌어져 다른 때 사람들이 넘어온다지요." },
            new FolkRole { Era = GoEra.Past, Id = "watchman", Body = "Paladin", NameKey = "folk.watchman", NameKo = "파수꾼", Fallback = new Color(0.4f, 0.42f, 0.46f),
                LineKey = "folk.watchman.line", LineKo = "{1} 지키는 게 내 일이오. 요즘은 이상한 차림 손님이 하도 많아 누가 도적인지 모르겠군." },
            new FolkRole { Era = GoEra.Past, Id = "hunter", Body = "Archer", NameKey = "folk.hunter", NameKo = "사냥꾼", Fallback = new Color(0.35f, 0.4f, 0.25f),
                LineKey = "folk.hunter.line", LineKo = "{0} 짐승 발자국 사이로 쇠바퀴 자국이 났어. 태어나 처음 보는 흔적이야." },
            new FolkRole { Era = GoEra.Modern, Id = "tourist", Body = "Remy", NameKey = "folk.tourist", NameKo = "여행자", Fallback = new Color(0.3f, 0.45f, 0.7f),
                LineKey = "folk.tourist.line", LineKo = "지도 앱엔 {0} 같은 곳이 안 나오던데… 그래도 경치 하나는 끝내주네요." },
            new FolkRole { Era = GoEra.Modern, Id = "courier", Body = "Megan", NameKey = "folk.courier", NameKo = "택배 기사", Fallback = new Color(0.85f, 0.55f, 0.15f),
                LineKey = "folk.courier.line", LineKo = "{1} 앞으로 온 소포가 있는데, 받는 분이 삼백 년 전 사람이래요. 서명은 어떻게 받죠?" },
            new FolkRole { Era = GoEra.Modern, Id = "patrol", Body = "SwatGuy", NameKey = "folk.patrol", NameKo = "순찰 대원", Fallback = new Color(0.15f, 0.17f, 0.22f),
                LineKey = "folk.patrol.line", LineKo = "{0} 쪽에 방독면 쓴 무리가 돌아다닙니다. 혼자 다니지 마세요." },
            new FolkRole { Era = GoEra.Future, Id = "surveyor", Body = "ExoGray", NameKey = "folk.surveyor", NameKo = "탐사 대원", Fallback = new Color(0.6f, 0.65f, 0.7f),
                LineKey = "folk.surveyor.line", LineKo = "{0} 대기 표본 채취 중. 시간 틈이 이 근처에서 가장 넓게 열려 있다." },
            new FolkRole { Era = GoEra.Future, Id = "mechanic", Body = "Vanguard", NameKey = "folk.mechanic", NameKo = "수리 기사", Fallback = new Color(0.25f, 0.55f, 0.6f),
                LineKey = "folk.mechanic.line", LineKo = "{1} 돌기둥 말이에요, 겉은 돌인데 속은 우리 시대 중계기처럼 떨려요." },
            new FolkRole { Era = GoEra.Future, Id = "chrononaut", Body = "Crypto", NameKey = "folk.chrononaut", NameKo = "시간 여행자", Fallback = new Color(0.5f, 0.3f, 0.65f),
                LineKey = "folk.chrononaut.line", LineKo = "{0}… 기록으로만 보던 곳이군요. 제가 여기 있었다는 건 비밀로 해 주세요." },
        };

        public static FolkRole[] RolesOf(GoEra e) => System.Array.FindAll(Roles, r => r.Era == e);

        /// <summary>역참 w 둘레 k 번째(0 = 제 시대, 1·2 = 나머지 둘) 사람의 역할 — 역참마다 역할이 돌아 같은 줄이 겹치지 않게.</summary>
        public static FolkRole FolkAt(int waypointIndex, int k)
        {
            var w = GoWorldMap.Waypoints[waypointIndex];
            GoEra era = Next(RegionEra(GoWorldMap.RegionAt(TestMapData.WorldPos(w.Gx, w.Gy))), k);
            var roles = RolesOf(era);
            return roles[(waypointIndex + k) % roles.Length];
        }

        public static string FolkName(FolkRole r) => $"{GoLocalization.T(r.NameKey, r.NameKo)}({EraName(r.Era)})";

        public static string FolkLine(FolkRole r, int waypointIndex)
        {
            var w = GoWorldMap.Waypoints[waypointIndex];
            string region = GoWorldMap.RegionName(GoWorldMap.RegionAt(TestMapData.WorldPos(w.Gx, w.Gy)));
            return string.Format(GoLocalization.T(r.LineKey, r.LineKo), region, GoWorldMap.WaypointName(w));
        }

        /// <summary>과거·현대·미래 사람 몸 전부(씬 빌더가 이 이름으로 프리팹을 찾아 넘긴다).</summary>
        public static string[] FolkBodies()
        {
            var list = new System.Collections.Generic.List<string>();
            foreach (var r in Roles) if (!list.Contains(r.Body)) list.Add(r.Body);
            return list.ToArray();
        }
    }
}
