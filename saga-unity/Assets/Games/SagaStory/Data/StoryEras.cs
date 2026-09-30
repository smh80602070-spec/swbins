using UnityEngine;

namespace Saga.Story.Data
{
    public enum StoryEra { Past, Modern, Future }

    /// <summary>
    /// PLAN.md 109-3 "STORY 세 시대 사람·적"(웹 사가스토리 §5-12 · SAGA-DESIGN §13 전체 퓨전) — 웹 판은 관문대 넷마다 현대·미래 적 하나씩,
    /// 사냥터 잡졸의 40% 를 그 관문대 시대 적으로, 마을마다 현대·미래 사람 하나씩을 더 세운다.
    /// 이 트랙 STORY 는 들판 하나(잡졸 열·두목)와 비경(5-3) 아레나뿐이라 "관문대" 넷을 들판 · 비경 1~2층 · 3~4층 · 5층으로 읽는다.
    /// 들판은 손으로 짠 고정 자리라 열 자리 중 넷(40%)을 표로 박고, 비경 전투 잡졸은 해시(층:전투 순번:자리)로 40%.
    /// 두목·관문 대장·비경 정예/보스는 그대로. 체력·경험치는 잡졸 공식 그대로, 몸·이름만 — 몸은 저마다 다르고 이 판의 다른 몸과 안 겹친다.
    /// 마을 사람: 이 판엔 마을이 없어 들판 들머리 뒤쪽 길(z = <see cref="FolkLaneZ"/>)에 현대·미래 손님 둘(대사 넷 돌림, 볼일 없음).
    /// 이름은 전부 지어낸 것.
    /// </summary>
    public static class StoryEras
    {
        public const float EraMix = 0.4f;
        public const int TierCount = 4;
        /// <summary>처음 가까이 올 때 "시간 틈" 알림을 띄우는 거리(m, X 만).</summary>
        public const float AnnounceRadiusM = 7f;

        public struct Foe
        {
            public StoryEra Era;
            public string Body;
            public string NameKo, NameKey;
            /// <summary>잡졸 키(1.6m)에 곱한다 — 강철 거신만 크다.</summary>
            public float HeightMul;
        }

        /// <summary>비경 층 → 단계. 0(들판) · 1~2 → 1 · 3~4 → 2 · 5~ → 3.</summary>
        public static int Tier(int labyrinthFloor) => labyrinthFloor <= 0 ? 0 : labyrinthFloor <= 2 ? 1 : labyrinthFloor <= 4 ? 2 : 3;

        /// <summary>[단계, 0 = 현대 · 1 = 미래].</summary>
        public static readonly Foe[,] Foes =
        {
            {
                new Foe { Era = StoryEra.Modern, Body = "Racer", NameKo = "폭주 라이더", NameKey = "enemy.era_rider", HeightMul = 1f },
                new Foe { Era = StoryEra.Future, Body = "Dummy", NameKo = "시험 인형", NameKey = "enemy.era_dummy", HeightMul = 1f },
            },
            {
                new Foe { Era = StoryEra.Modern, Body = "Warzombie", NameKo = "떠도는 망자", NameKey = "enemy.era_revenant", HeightMul = 1f },
                new Foe { Era = StoryEra.Future, Body = "Mremireh", NameKo = "별바다 손님", NameKey = "enemy.era_stranger", HeightMul = 1.05f },
            },
            {
                new Foe { Era = StoryEra.Modern, Body = "Jody", NameKo = "뒷골목 불량배", NameKey = "enemy.era_punk", HeightMul = 1f },
                new Foe { Era = StoryEra.Future, Body = "Yaku", NameKo = "플라즈마 변이체", NameKey = "enemy.era_plasma", HeightMul = 1.05f },
            },
            {
                new Foe { Era = StoryEra.Modern, Body = "Steve", NameKo = "용병 돌격대", NameKey = "enemy.era_merc", HeightMul = 1f },
                new Foe { Era = StoryEra.Future, Body = "Mannequin", NameKo = "강철 거신", NameKey = "enemy.era_colossus", HeightMul = 1.3f },
            },
        };

        /// <summary>이 판의 옛 몸(잡졸·두목·NPC·동료·소환) — 시대 몸은 이것들과 겹치면 안 된다(진단).</summary>
        public static readonly string[] OldBodies = { "Abe", "Brute", "Morak", "PeasantMan", "PeasantGirl", "Jolleen", "Paladin", "Archer", "Warrok" };

        /// <summary>들판 잡졸 열 자리 중 다른 시대 자리 — (자리 번호, 시대). 13m·28m 현대, 18m·37m 미래.</summary>
        public static readonly (int Slot, StoryEra Era)[] FieldSlots =
        {
            (2, StoryEra.Modern), (3, StoryEra.Future), (5, StoryEra.Modern), (7, StoryEra.Future),
        };

        public static StoryEra FieldEra(int slot)
        {
            foreach (var s in FieldSlots) if (s.Slot == slot) return s.Era;
            return StoryEra.Past;
        }

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

        /// <summary>비경 층 f · 그 회차 전투 순번 n · 자리 i 의 시대 — 60 미만 과거, 80 미만 현대, 나머지 미래.</summary>
        public static StoryEra LabyrinthEra(int floor, int combat, int i)
        {
            uint roll = Hash($"{floor}:{combat}:{i}#story") % 100;
            return roll < (1f - EraMix) * 100f ? StoryEra.Past : roll < (1f - EraMix * 0.5f) * 100f ? StoryEra.Modern : StoryEra.Future;
        }

        public static Foe FoeFor(int tier, StoryEra era) => Foes[Mathf.Clamp(tier, 0, TierCount - 1), era == StoryEra.Future ? 1 : 0];

        public static string FoeName(Foe f) => StoryLocalization.T(f.NameKey, f.NameKo);

        public static string[] FoeBodies()
        {
            var list = new System.Collections.Generic.List<string>();
            foreach (var f in Foes) list.Add(f.Body);
            return list.ToArray();
        }

        /// <summary>처음 마주칠 때 한 줄 — {0} 이름.</summary>
        public static string AnnounceText(StoryEra era) => era == StoryEra.Future
            ? StoryLocalization.T("era.announce_future", "⏳ 시간 틈 너머에서 — {0}")
            : StoryLocalization.T("era.announce_modern", "⏳ 다른 시대에서 흘러든 — {0}");

        // ---- 들판 손님 ------------------------------------------------------------

        /// <summary>손님은 싸움길(z = 0) 뒤쪽에 선다 — 길을 막지 않고, 지나가며 X 로 가까워지면 말한다.</summary>
        public const float FolkLaneZ = 1.2f;
        public const float FolkTalkRadiusM = 1.8f;

        public struct Folk
        {
            public string Id;
            public StoryEra Era;
            public string Body;
            public float X;
            public string NameKo, NameKey;
            public string[] LinesKo;
            public string LineKeyPrefix;
        }

        /// <summary>들판 들머리 쪽 둘 — 잡졸·발판·로프·척후병·전직관과 안 겹치는 X.</summary>
        public static readonly Folk[] FolkList =
        {
            new Folk { Id = "photographer", Era = StoryEra.Modern, Body = "Olivia", X = 10.5f, NameKo = "사진 찍는 여행자", NameKey = "era_folk.photographer",
                LineKeyPrefix = "era_folk.photographer.", LinesKo = new[] {
                    "황건 난리 한복판이라니, 이건 꼭 찍어 가야 해요. 저 두목 쪽으로 좀 비켜 주실래요?",
                    "휴대폰 배터리가 12% 남았어요. 이 시대엔 충전할 데가 없겠죠?",
                    "방금 지나간 헬멧 쓴 사람, 제 시대 폭주족이랑 똑같이 생겼어요.",
                    "사진 속 하늘에 금이 가 있어요. 시간 틈이라는 게 저건가 봐요.",
                } },
            new Folk { Id = "chrononaut", Era = StoryEra.Future, Body = "Ely", X = 20.5f, NameKo = "시간 여행자", NameKey = "era_folk.story_chrononaut",
                LineKeyPrefix = "era_folk.story_chrononaut.", LinesKo = new[] {
                    "제 기록엔 이 들판이 '첫 사냥터'로만 남아 있어요. 이렇게 시끄러운 줄은 몰랐네요.",
                    "비경 깊은 층일수록 틈이 넓어요. 강철 거신을 보면 무리하지 마세요.",
                    "그 무예, 제 시대 교본에 그림으로만 남아 있던 거예요.",
                    "돌아갈 좌표가 자꾸 흔들려요. 당분간은 여기서 구경이나 할게요.",
                } },
        };

        // ---- 곁가지 side_guests(웹 사가스토리 data-side.js NPC_TALK story) — 들판 시대 손님의 사연 ----
        /// <summary>손님이 X 로 가까워질 때마다 사연 네 토막을 차례로, 끝 토막에 경험치 한 번(웹 금 4000 · 공적 20 → 이 판엔 돈이 없어 경험치). 다 들었으면 예전 대사로.</summary>
        public const float StoryExp = 400f;
        private static readonly System.Collections.Generic.Dictionary<string, string[]> StoryKo = new System.Collections.Generic.Dictionary<string, string[]>
        {
            ["photographer"] = new[] {
                "제 첫 사진은 흐릿한 새벽 풍경이었어요. 잘 안 찍혔다고 버리려 했죠.",
                "옆에서 누가 \"그 흐릿함이 좋다\"고 하더라고요. 그때 처음 사진이 잘 찍는 게 아니란 걸 알았어요.",
                "여기 오니 흐릿한 게 더 많아요. 안개, 연기, 옛 성벽… 다 제 취향이에요.",
                "어제 기와 위 아침 안개를 찍었는데 그 안에 낯선 그림자들이 겹쳐 찍혔어요. 누구였을까요?",
            },
            ["chrononaut"] = new[] {
                "제 귀환 일정은 원래 사흘이었어요. 이 시대를 관찰하고 돌아가는 일이죠.",
                "그런데 관찰이란 게 이상해요. 제가 보면 보는 대로 이 마을이 조금씩 바뀌더라고요.",
                "그래서 일정을 미뤘어요. 바뀌는 걸 끝까지 보고 싶어서요.",
                "어제 촌로께서 \"자네가 온 뒤로 마을이 밝아졌네\" 하셨어요. 제 일정표에 없는 말이라 한참 웃었어요.",
            },
        };
        private static readonly System.Collections.Generic.Dictionary<string, int> StoryHeard = new System.Collections.Generic.Dictionary<string, int>();

        public static bool HasStory(string folkId) => StoryKo.ContainsKey(folkId);
        public static int StoryLength(string folkId) => StoryKo.TryGetValue(folkId, out var a) ? a.Length : 0;
        public static int StoryHeardCount(string folkId) => StoryHeard.TryGetValue(folkId, out var n) ? n : 0;
        public static string StoryLine(string folkId, int i) => StoryLocalization.T($"era_folk.{folkId}.story.{i}", StoryKo[folkId][i]);

        /// <summary>다음 사연 토막을 돌려주고 차례를 넘긴다. 사연이 없거나 다 들었으면 null. 마지막 토막이면 <paramref name="exp"/> 에 경험치.</summary>
        public static string NextStory(string folkId, out float exp)
        {
            exp = 0f;
            if (!StoryKo.ContainsKey(folkId)) return null;
            int n = StoryHeardCount(folkId);
            if (n >= StoryKo[folkId].Length) return null;
            StoryHeard[folkId] = n + 1;
            if (n + 1 == StoryKo[folkId].Length) exp = StoryExp;
            return StoryLine(folkId, n) + $" ({StoryLocalization.T("era_folk.story_of", "사연")} {n + 1}/{StoryKo[folkId].Length})";
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

        public static string FolkName(Folk f) => StoryLocalization.T(f.NameKey, f.NameKo);

        public static string FolkLine(Folk f, int i)
        {
            int k = ((i % f.LinesKo.Length) + f.LinesKo.Length) % f.LinesKo.Length;
            return StoryLocalization.T(f.LineKeyPrefix + k, f.LinesKo[k]);
        }
    }
}
