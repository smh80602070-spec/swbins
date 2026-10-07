using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 108 ③ "고정 특색 지역 — 던전 명소 층"(2026-09-24) — 웹 사가나락 PLAN §5.15 결(코드 공유 없음).
    /// 무작위 문 갈림길 층 사이에 손으로 짠 고정 층 일곱을 박는다: 5·10·15·20·25·30·31층(31층 = 5막 끝 무명왕, tasks U-0028). 그 층은 방 다섯이 늘 같은 순서로
    /// 나오고(문 하나, 문 표지에 다음 방 이름), 잡졸 이름이 그 층 것으로 바뀌고, 마지막 방에 층 주인이 선다.
    /// 층 주인 첫 토벌에만 그 층 고유 무기 + 금(층 × <see cref="FirstClearGoldPerFloor"/>). 이름·한자·무기는 전부 지어낸 것.
    /// 나머지 층(2~4·6~9…·32~100)은 예전 갈림길 그대로 — 전부 고정하면 로그라이트 반복이 죽는다.
    /// </summary>
    public static class DungeonLandmarkData
    {
        public const int RoomCount = 5;
        public const int FirstClearGoldPerFloor = 40;
        /// <summary>방 종류 — 마지막 방(층 주인). `DungeonFloorRunner.BuildRoomContent` 가 받는다.</summary>
        public const string LordKind = "lord";

        public struct Landmark
        {
            public int Floor;
            public string Key;
            public string NameKo;
            public string Hanja;
            public string LoreKo;
            public string GruntKo;
            public string LordKo;
            public Color LordColor;
            public string RewardItemId;
            /// <summary>방 다섯의 종류(`DungeonFormulas.RoomKinds` 키, 마지막은 <see cref="LordKind"/>)와 이름.</summary>
            public string[] Kinds;
            public string[] RoomsKo;
        }

        public static readonly Landmark[] All =
        {
            new Landmark { Floor = 5, Key = "tomb", NameKo = "순장 왕릉", Hanja = "殉陵",
                LoreKo = "옛 왕과 함께 묻힌 병사들이 아직 무덤을 지킨다.",
                GruntKo = "순장 병사", LordKo = "옥관 수릉장", LordColor = new Color(0.35f, 0.55f, 0.45f), RewardItemId = "wp_lm_tomb",
                Kinds = new[] { "fight", "trove", "puzzle", "elite", LordKind },
                RoomsKo = new[] { "참배길", "부장품 방", "석인 회랑", "순장 무덤칸", "현실(玄室)" } },
            new Landmark { Floor = 10, Key = "fort", NameKo = "무너진 망루성", Hanja = "廢樓城",
                LoreKo = "불탄 뒤 버려진 산성. 잔병들이 아직 성문을 닫아 건다.",
                GruntKo = "망루 잔병", LordKo = "잿빛 성주", LordColor = new Color(0.45f, 0.45f, 0.48f), RewardItemId = "wp_lm_fort",
                Kinds = new[] { "fight", "well", "trove", "fight", LordKind },
                RoomsKo = new[] { "무너진 성문", "우물 뜰", "병기고", "망루 계단", "성주 대청" } },
            new Landmark { Floor = 15, Key = "bandit", NameKo = "흑풍 산채", Hanja = "黑風寨",
                LoreKo = "검은 바람을 부른다는 도적 떼의 소굴. 붙잡힌 나그네가 있다.",
                GruntKo = "흑풍 도적", LordKo = "흑풍 채주", LordColor = new Color(0.15f, 0.15f, 0.2f), RewardItemId = "wp_lm_bandit",
                Kinds = new[] { "fight", "event", "forage", "elite", LordKind },
                RoomsKo = new[] { "목책 길", "갇힌 나그네", "약초 바위", "정예 막사", "채주 천막" } },
            new Landmark { Floor = 20, Key = "palace", NameKo = "가라앉은 용궁", Hanja = "沈龍宮",
                LoreKo = "물이 빠진 뒤에도 비늘 병사들이 궁을 떠나지 않았다.",
                GruntKo = "물빛 수졸", LordKo = "비늘 수문장", LordColor = new Color(0.2f, 0.45f, 0.65f), RewardItemId = "wp_lm_palace",
                Kinds = new[] { "fight", "well", "shrine", "cave", LordKind },
                RoomsKo = new[] { "산호 문", "진주 샘", "거북 사당", "조개 광맥", "수정 궁전" } },
            new Landmark { Floor = 25, Key = "hellgate", NameKo = "업화 대문", Hanja = "業火門",
                LoreKo = "꺼지지 않는 불이 문을 두른다. 옥졸들이 사슬을 끌고 다닌다.",
                GruntKo = "업화 옥졸", LordKo = "업화 문지기", LordColor = new Color(0.7f, 0.2f, 0.08f), RewardItemId = "wp_lm_hellgate",
                Kinds = new[] { "fight", "shrine", "puzzle", "elite", LordKind },
                RoomsKo = new[] { "불길 다리", "재 사당", "쇠사슬 문", "옥졸 소굴", "대문 앞" } },
            new Landmark { Floor = 30, Key = "cloud", NameKo = "구름 위 금궐", Hanja = "雲上闕",
                LoreKo = "구름을 딛고 선 금빛 궁궐. 천병이 옥좌를 에워싼다.",
                GruntKo = "금궐 호위", LordKo = "구름 천장", LordColor = new Color(0.85f, 0.7f, 0.25f), RewardItemId = "wp_lm_cloud",
                Kinds = new[] { "fight", "merchant", "trove", "miniboss", LordKind },
                RoomsKo = new[] { "구름 계단", "선녀 좌판", "금빛 보고", "천병 진영", "금궐 옥좌" } },
            // 31층(tasks U-0028, 웹 `FIXED` 31층) — 5막 끝 무명왕이 서는 곳. 웹 방 종류 fight·shrine·elite·trove·boss.
            new Landmark { Floor = 31, Key = "nameless", NameKo = "이름 없는 곳", Hanja = "無名處",
                LoreKo = "글자가 다 지워진 비석들이 빛 기둥처럼 서 있다. 삼켜진 이름들이 저마다 다른 모습으로 일어난다.",
                GruntKo = "삼켜진 이름", LordKo = "이름을 삼키는 무명왕", LordColor = new Color(0.23f, 0.23f, 0.29f), RewardItemId = "wp_lm_nameless",
                Kinds = new[] { "fight", "shrine", "elite", "trove", LordKind },
                RoomsKo = new[] { "비석 숲", "지워진 이름의 제단", "도시 잔해 조각", "빛 기둥 곁", "이름 없는 곳" } },
        };

        /// <summary>그 층이 명소 층이면 번호, 아니면 -1.</summary>
        public static int IndexOfFloor(int floor)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].Floor == floor) return i;
            return -1;
        }

        public static string Name(int i) => DungeonLocalization.T($"landmark.{All[i].Key}", All[i].NameKo);
        public static string Lore(int i) => DungeonLocalization.T($"landmark.{All[i].Key}.lore", All[i].LoreKo);
        public static string GruntName(int i) => DungeonLocalization.T($"landmark.{All[i].Key}.grunt", All[i].GruntKo);
        public static string LordName(int i) => DungeonLocalization.T($"landmark.{All[i].Key}.lord", All[i].LordKo);
        public static string RoomName(int i, int room) => DungeonLocalization.T($"landmark.{All[i].Key}.room{room}", All[i].RoomsKo[room]);

        /// <summary>HUD·문 표지 — "⚱ 순장 왕릉 · 참배길".</summary>
        public static string HudLine(int i, int room) =>
            string.Format(DungeonLocalization.T("landmark.hud", "⚱ {0} · {1}"), Name(i), RoomName(i, Mathf.Clamp(room, 0, RoomCount - 1)));

        /// <summary>첫 토벌 — {0} 명소 이름, {1} 무기 이름, {2} 금.</summary>
        public static string FirstClearText() =>
            DungeonLocalization.T("landmark.first_clear", "⚱ {0} 답파! — 층 주인이 {1} 을(를) 떨궜다 · 금 +{2}");

        /// <summary>층에 들어설 때 — "⚱ 명소 층 — 순장 왕릉 殉陵" + 사연.</summary>
        public static string EnterText(int i) =>
            string.Format(DungeonLocalization.T("landmark.enter", "⚱ 명소 층 — {0} {1}"), Name(i), All[i].Hanja) + "\n" + Lore(i);
    }

    /// <summary>PLAN.md 108 ③ — 명소 층 주인 토벌 횟수(세이브 v10 `landmarkClears`). 첫 토벌 보상 판정에 쓴다.</summary>
    public static class LandmarkState
    {
        private static int[] _clears = new int[DungeonLandmarkData.All.Length];

        public static int Clears(int i) => i >= 0 && i < _clears.Length ? _clears[i] : 0;
        public static bool IsCleared(int i) => Clears(i) > 0;

        /// <summary>토벌 한 번 적는다. 첫 토벌이면 true.</summary>
        public static bool RecordClear(int i)
        {
            if (i < 0 || i >= _clears.Length) return false;
            _clears[i]++;
            return _clears[i] == 1;
        }

        public static int[] Snapshot() => (int[])_clears.Clone();

        /// <summary>옛 세이브(null)면 전부 0. 길이가 달라도 겹치는 앞쪽만 받는다.</summary>
        public static void Restore(int[] clears)
        {
            _clears = new int[DungeonLandmarkData.All.Length];
            if (clears == null) return;
            for (int i = 0; i < _clears.Length && i < clears.Length; i++) _clears[i] = Mathf.Max(0, clears[i]);
        }
    }
}
