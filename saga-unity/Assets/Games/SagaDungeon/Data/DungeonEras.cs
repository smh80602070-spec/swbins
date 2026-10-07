using UnityEngine;

namespace Saga.Dungeon.Data
{
    public enum DungeonEra { Past, Modern, Future }

    /// <summary>
    /// PLAN.md 109-2 "DUNGEON 세 시대"(웹 사가나락 §5.20 · SAGA-DESIGN §13 전체 퓨전) — 5.7 기계화 정찰병(정예 한 종)을 넓힌다.
    /// 잡졸: 절차 층 전투 방 잡졸 넷 중 약 40% 를 층 단계의 현대·미래 적으로(해시 — 층 난수 `_rng` 수열은 안 민다).
    /// 정예·살수·두목·층 주인·호위·명소 층 잡졸은 그대로. 몸은 저마다 다르고 이 판의 다른 적·보스 몸과 안 겹친다.
    /// 마을 손님: 마을 셋·갈림길에 현대·미래 사람 한 명씩(대사 넷 돌림, 볼일 없음). 행상: 같은 해시로 몸만 현대·미래.
    /// 이름은 전부 지어낸 것. `displayName` 이 도감(`BestiaryState`) 키라 새 이름은 새 도감 칸이 된다.
    /// </summary>
    public static class DungeonEras
    {
        /// <summary>다른 시대 몫(현대·미래가 반씩).</summary>
        public const float EraMix = 0.4f;

        public struct Foe
        {
            public DungeonEra Era;
            public string Body;
            public string NameKo;
            public string NameKey;
        }

        /// <summary>층 단계 — 2~9 · 10~24 · 25~49 · 50~.</summary>
        public static int Tier(int floor) => floor < 10 ? 0 : floor < 25 ? 1 : floor < 50 ? 2 : 3;
        public const int TierCount = 4;

        /// <summary>[단계, 0 = 현대 · 1 = 미래].</summary>
        public static readonly Foe[,] Foes =
        {
            {
                new Foe { Era = DungeonEra.Modern, Body = "Brian", NameKo = "폭주 청년", NameKey = "enemy.era_rioter" },
                new Foe { Era = DungeonEra.Future, Body = "XBot", NameKo = "시험 기동 인형", NameKey = "enemy.era_testbot" },
            },
            {
                new Foe { Era = DungeonEra.Modern, Body = "GasMask", NameKo = "방역복 추적자", NameKey = "enemy.era_hazmat" },
                new Foe { Era = DungeonEra.Future, Body = "ExoRed", NameKo = "경비 보행병", NameKey = "enemy.era_sentry" },
            },
            {
                new Foe { Era = DungeonEra.Modern, Body = "Swat", NameKo = "진압 특공대", NameKey = "enemy.era_swat" },
                new Foe { Era = DungeonEra.Future, Body = "YBot", NameKo = "강철 인형 병정", NameKey = "enemy.era_steelbot" },
            },
            {
                new Foe { Era = DungeonEra.Modern, Body = "Boss", NameKo = "암흑가 해결사", NameKey = "enemy.era_enforcer" },
                new Foe { Era = DungeonEra.Future, Body = "Zlorp", NameKo = "별 너머 방문자", NameKey = "enemy.era_visitor" },
            },
        };

        /// <summary>이 판의 옛 적·두목·NPC 몸 — 시대 적 몸은 이것들과 겹치면 안 된다(진단).</summary>
        public static readonly string[] OldBodies = { "Abe", "Brute", "Skeleton", "Ganfaul", "Ninja", "Demon", "AlienSoldier", "Paladin", "PeasantMan", "PeasantGirl" };

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

        /// <summary>층 f·방 r 의 전투 잡졸 i 번째 시대 — 60 미만 과거, 80 미만 현대, 나머지 미래.</summary>
        public static DungeonEra GruntEra(int floor, int room, int i) => Roll(Hash($"{floor}:{room}:{i}#grunt") % 100);

        /// <summary>층 f·방 r 의 행상 시대(같은 몫).</summary>
        public static DungeonEra PeddlerEra(int floor, int room) => Roll(Hash($"{floor}:{room}#peddler") % 100);

        private static DungeonEra Roll(uint roll) =>
            roll < (1f - EraMix) * 100f ? DungeonEra.Past : roll < (1f - EraMix * 0.5f) * 100f ? DungeonEra.Modern : DungeonEra.Future;

        public static Foe FoeFor(int floor, DungeonEra era) => Foes[Tier(floor), era == DungeonEra.Future ? 1 : 0];

        public static string[] FoeBodies()
        {
            var list = new System.Collections.Generic.List<string>();
            foreach (var f in Foes) list.Add(f.Body);
            return list.ToArray();
        }

        // ---- 행상 -------------------------------------------------------------

        public const string ModernPeddlerBody = "Leonard"; // 고물 행상
        public const string FuturePeddlerBody = "Astra";    // 시간 행상

        // ---- 마을 손님 -----------------------------------------------------------

        public struct Folk
        {
            public string Id;
            public DungeonEra Era;
            public string Body;
            public string NameKo, NameKey;
            /// <summary>다가갈 때마다 하나씩 돌려 말한다.</summary>
            public string[] LinesKo;
            public string LineKeyPrefix;
        }

        /// <summary>마을 셋(Town2·3·4)·갈림길에 한 명씩 — 순서는 `FolkSpots` 와 같다. 현대 둘·미래 둘.</summary>
        public static readonly Folk[] FolkList =
        {
            new Folk { Id = "courier", Era = DungeonEra.Modern, Body = "Megan", NameKo = "택배 기사", NameKey = "era_folk.courier", LineKeyPrefix = "era_folk.courier.",
                LinesKo = new[] {
                    "주소가 '황건 난리 통 셋째 마을'이라고만 적혀 있네요. 여기 맞죠?",
                    "짐이 자꾸 무거워져요. 상자 속에서 뭔가 칼 가는 소리가 나요.",
                    "아래층엔 배달 안 갑니다. 지난번에 강철 인형이 서명 대신 주먹을 줬거든요.",
                    "시간 틈 요금이 따로 붙는다던데, 누가 내 주실 분?",
                } },
            new Folk { Id = "chrononaut", Era = DungeonEra.Future, Body = "Crypto", NameKo = "시간 여행자", NameKey = "era_folk.chrononaut", LineKeyPrefix = "era_folk.chrononaut.",
                LinesKo = new[] {
                    "기록엔 이 마을이 이번 난리에 사라진다고 돼 있어요. 제가 틀렸으면 좋겠네요.",
                    "깊은 층일수록 시간 틈이 넓어요. 제 시대 기계가 거기서 길을 잃었죠.",
                    "그 칼, 제 시대 박물관에 걸려 있던 것과 똑같이 생겼어요.",
                    "돌아갈 문이 닫혔어요. 당분간 이 시대 밥을 먹어야겠네요.",
                } },
            new Folk { Id = "surveyor", Era = DungeonEra.Future, Body = "ExoGray", NameKo = "탐사 대원", NameKey = "era_folk.surveyor", LineKeyPrefix = "era_folk.surveyor.",
                LinesKo = new[] {
                    "지하 공명 측정 중. 층을 내려갈수록 수치가 요동친다.",
                    "경비 보행병을 만나면 다리 관절을 노려라. 우리 시대 교범 그대로다.",
                    "이 시대 사람들 튼튼하군. 보호복 없이 폐허를 오르다니.",
                    "표본 하나만 부탁한다. 층 주인 비늘이면 더 좋고.",
                } },
            new Folk { Id = "salaryman", Era = DungeonEra.Modern, Body = "Remy", NameKo = "출장 온 회사원", NameKey = "era_folk.salaryman", LineKeyPrefix = "era_folk.salaryman.",
                LinesKo = new[] {
                    "지하철에서 졸았을 뿐인데 눈 떠 보니 갈림길이더군요.",
                    "보고서 마감이 내일인데… 여기 전기 들어오는 데 없나요?",
                    "방독면 쓴 사람들, 우리 회사 방역팀 같던데 말이 안 통해요.",
                    "명함이라도 드릴까요? 아, 이 시대엔 종이가 귀하다고요.",
                } },
        };

        // ---- 곁가지 side_visitors(웹 사가나락 town.js ERA_FOLK story) — 손님 셋의 사연 ----
        /// <summary>마을 시대 손님이 다가설 때마다 사연 네 토막을 차례로, 끝 토막에 금 한 번(웹 FOLK_STORY_GOLD). 다 들었으면 예전 대사로.</summary>
        public const int StoryGold = 5000;
        public const int StoryLength = 4;
        private static readonly System.Collections.Generic.Dictionary<string, string[]> StoryKo = new System.Collections.Generic.Dictionary<string, string[]>
        {
            ["courier"] = new[] {
                "제가 처음 배달한 짐은 주소 없는 상자였어요. 받는 사람을 못 찾아 사흘을 헤맸죠.",
                "결국 상자를 열어 봤는데 안에는 \"누군가에게 전해질 마음\"이라 적힌 쪽지 한 장뿐이더라고요.",
                "그 쪽지를 들고 다니다 이 시대까지 왔어요. 신기하게 여기선 받을 사람이 자꾸 나타나요.",
                "어제 마을 사관님께 쪽지를 보여 드렸더니 \"내 기록에도 없는 글씨네\" 하셨어요. 주소가 생겼네요!",
            },
            ["salaryman"] = new[] {
                "저는 원래 본사 지시서만 따라 움직이는 사람이었어요. 출장도 지시서대로 왔죠.",
                "그런데 도착하니 지시서에 없는 일이 하나도 안 멈추는 거예요. 굴혈에서 사람 이름이 지워지는 일 같은.",
                "지시서를 접어 넣고 처음으로 제 판단으로 한 일이 지워진 이름 하나를 적어 두는 거였어요.",
                "오늘 사관님이 그 이름을 기록에 올려 주셨어요. 보고서로 쓰면 한 줄일 일인데 이렇게 마음이 무겁네요.",
            },
            ["chrononaut"] = new[] {
                "제 귀환 일정은 원래 사흘이었어요. 이 시대를 관찰하고 돌아가는 일이었죠.",
                "그런데 관찰이란 게 이상해요. 제가 보면 보는 대로 이 마을이 조금씩 바뀌더라고요.",
                "그래서 일정을 미뤘어요. 바뀌는 걸 끝까지 보고 싶어서요. 우리 시대 기록에 이 마을은 없거든요.",
                "어제 굴혈 이름 없는 비석 앞에서 한참 서 있었어요. 우리 시대에도 그 자리에 비석이 있어요. 이름이 없는 채로요.",
            },
        };
        private static readonly System.Collections.Generic.Dictionary<string, int> StoryHeard = new System.Collections.Generic.Dictionary<string, int>();

        public static bool HasStory(string folkId) => StoryKo.ContainsKey(folkId);
        public static int StoryHeardCount(string folkId) => StoryHeard.TryGetValue(folkId, out var n) ? n : 0;
        public static string StoryLine(string folkId, int i) =>
            DungeonLocalization.T($"era_folk.{folkId}.story.{i}", StoryKo[folkId][i]);

        /// <summary>다음 사연 토막을 돌려주고 차례를 넘긴다. 사연이 없거나 다 들었으면 null. 마지막 토막이면 <paramref name="gold"/> 에 금을 준다.</summary>
        public static string NextStory(string folkId, out int gold)
        {
            gold = 0;
            if (!StoryKo.ContainsKey(folkId)) return null;
            int n = StoryHeardCount(folkId);
            if (n >= StoryKo[folkId].Length) return null;
            StoryHeard[folkId] = n + 1;
            bool last = n + 1 == StoryKo[folkId].Length;
            if (last) gold = StoryGold;
            return StoryLine(folkId, n) + $" ({DungeonLocalization.T("era_folk.story_of", "사연")} {n + 1}/{StoryKo[folkId].Length})";
        }

        public static void SnapshotStories(out string[] ids, out int[] counts)
        {
            var i = new System.Collections.Generic.List<string>(); var c = new System.Collections.Generic.List<int>();
            foreach (var kv in StoryHeard) { i.Add(kv.Key); c.Add(kv.Value); }
            ids = i.ToArray(); counts = c.ToArray();
        }

        public static void RestoreStories(string[] ids, int[] counts)
        {
            StoryHeard.Clear();
            if (ids == null || counts == null) return;
            for (int i = 0; i < ids.Length && i < counts.Length; i++)
                if (StoryKo.ContainsKey(ids[i])) StoryHeard[ids[i]] = System.Math.Min(counts[i], StoryKo[ids[i]].Length);
        }

        public static string FolkName(Folk f) => DungeonLocalization.T(f.NameKey, f.NameKo);

        public static string FolkLine(Folk f, int i)
        {
            int k = ((i % f.LinesKo.Length) + f.LinesKo.Length) % f.LinesKo.Length;
            return DungeonLocalization.T(f.LineKeyPrefix + k, f.LinesKo[k]);
        }

        public static string[] FolkBodies()
        {
            var list = new System.Collections.Generic.List<string>();
            foreach (var f in FolkList) list.Add(f.Body);
            return list.ToArray();
        }
    }
}
