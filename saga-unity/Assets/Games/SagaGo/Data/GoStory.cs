using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-12 이야기 임무 1~2장(웹 사가고 ⑲-12 `story.js`, 정본 대사 saga-godot `data/story.gd` · 시나리오 `scenario/saga-go.md` 1부).
    /// 인물 셋·장 둘·단계 여섯 가지(talk·go·boss·kill·light·domain) — 순수 표. 진행은 `StoryState`, 들판은 `World.StoryField`, 화면은 `UI.StoryUi`.
    ///
    /// 자리 대응(웹 ⑮ 땅 → 이 판 지역, `scenario/saga-go.md` 트랙 메모의 대응표):
    /// 청하 마을(home) → 마을 들판 — 누리는 새로 세우지 않고 **옛 마을 촌장(1,3)** 이 곧 누리다(몸·혼잣말은 VS 촌장 그대로).
    /// 대숲 고을 탑 + 수호자(jugeup) → 남쪽 공터 옛 망루 + **망루 수호장**(이 판 들판 보스는 하나뿐, 107-7·109-14-10).
    /// 갈대 나루(galdae) → 너른 강 북쪽 물가(먹구름 제단 1.5,4.35 곁) · 옛 성터 언덕(gojeong) → 북쪽 산기슭 동굴 어귀(무너진 성터 무덤 땅).
    /// 대사는 원문 그대로, 땅 이름만 이 판 이름으로 바꿨다. 웹 부대 경험(단계 10·장 끝 300/500)은 이 트랙에 인물 경험이 없어 뺐다(14-7·14-8·14-10 과 같은 결정).
    /// </summary>
    public static class GoStory
    {
        public enum StepType { Talk, Go, Boss, Kill, Light, Domain }

        /// <summary>대화 거리 — 웹 6m(맨땅 판). 이 판 사람 키·카메라에 맞춰 5m.</summary>
        public const float TalkR = 5f;
        /// <summary>go 단계 도착 — 웹 30m(한 칸 1.2km 척도) → 이 판 한 칸 48m 에 맞춰 20m.</summary>
        public const float GoR = 20f;
        /// <summary>light — 원소 신호 원 반지름 + 이만큼 안에 제단이 들면 켜진다(웹 2.5m).</summary>
        public const float LightR = 2.5f;
        /// <summary>kill — 이만큼 안에 들면 임무 적이 선다(웹 150m → 이 판 60m, 지역 하나가 한두 칸).</summary>
        public const float KillNear = 60f;
        public const float KillSpread = 4.5f;
        /// <summary>지금 단계가 아닌 인물 곁 혼잣말 — 10m 안, 45초에 한 번(웹 12m·45초).</summary>
        public const float IdleR = 10f;
        public const float IdleGap = 45f;

        public struct Npc
        {
            public string Id;
            public string NameKey, NameKo;
            public string ShortKey, ShortKo;
            public float Gx, Gy;
            public string IdleKey, IdleKo;
            /// <summary>새로 세우지 않고 옛 마을 사람을 그대로 쓴다(누리 = 마을 촌장).</summary>
            public bool Existing;
            /// <summary>몸을 빌려 올 옛 마을 사람 id(`NpcBuilder`) — 촌장 = 사내 몸, 상인 = 여인 몸.</summary>
            public string BodyFrom;
        }

        public static readonly Npc[] Npcs =
        {
            new Npc { Id = "elder", NameKey = "story.npc.elder", NameKo = "청하 촌장 누리", ShortKey = "story.short.elder", ShortKo = "누리",
                Gx = 1f, Gy = 3f, Existing = true,
                IdleKey = "story.idle.elder", IdleKo = "먹구름이 걷히면 마을 잔치를 열어야지." },
            new Npc { Id = "ferryman", NameKey = "story.npc.ferryman", NameKo = "늙은 사공 버들", ShortKey = "story.short.ferryman", ShortKo = "버들",
                Gx = 2.35f, Gy = 4.4f, BodyFrom = "npc_elder",
                IdleKey = "story.idle.ferryman", IdleKo = "물 냄새가 요즘 영 비릿해." },
            new Npc { Id = "scholar", NameKey = "story.npc.scholar", NameKo = "떠돌이 학자 은비", ShortKey = "story.short.scholar", ShortKo = "은비",
                Gx = 3.35f, Gy = 1.4f, BodyFrom = "npc_merchant",
                IdleKey = "story.idle.scholar", IdleKo = "이 비문, 읽을수록 이상하다니까." },
        };

        /// <summary>대화 한 줄 — Who 가 null 이면 "나"의 고르는 줄(대답만 다르고 흐름은 같다).</summary>
        public struct Line
        {
            public string Who;      // 인물 id
            public string Key, Ko;
            public string[] PickKeys, PickKo;
            public bool IsPick => Who == null;
        }

        public class Step
        {
            public StepType Type;
            public string Npc;              // Talk
            public string TextKey, TextKo;
            public float Gx, Gy;            // Go·Kill·Light
            public bool Altar;              // Go — 먹구름 제단으로
            public FieldEnemy.Kind[] Kinds; // Kill
            public Line[] Lines;            // Talk
        }

        public class Chapter
        {
            public string Id;
            public string NameKey, NameKo;
            /// <summary>여정 등급(= 부대 레벨, 14-7) 이 이만큼이어야 열린다.</summary>
            public int Ar;
            public int Gold;
            /// <summary>`GoTalent.Mat` 순서(쪽지·교본·비전·매듭·비늘).</summary>
            public int[] Mats;
            public Step[] Steps;
        }

        private static Line L(string who, string key, string ko) => new Line { Who = who, Key = key, Ko = ko };
        private static Line Pick(string key, string a, string b) => new Line { PickKeys = new[] { key + ".a", key + ".b" }, PickKo = new[] { a, b } };

        private static readonly FieldEnemy.Kind KT = FieldEnemy.Kind.StormWraith;
        private static readonly FieldEnemy.Kind KF = FieldEnemy.Kind.EmberImp;

        /// <summary>옛 망루 발치(남쪽 공터 줄, 수호장 자리 서남쪽 27m) — 1장 go 단계.</summary>
        public const float TowerFootGx = 3.1f, TowerFootGy = 7.05f;
        /// <summary>산기슭 성터 어귀(무덤 터와 산신당 사이) — 1장 kill 단계.</summary>
        public const float SquadGx = 4.45f, SquadGy = 1.3f;
        /// <summary>동굴 어귀 옛 제단 — 1장 light 단계.</summary>
        public const float AltarGx = 3.0f, AltarGy = 1.1f;

        public static readonly Chapter[] Chapters =
        {
            new Chapter
            {
                Id = "ch1", NameKey = "story.ch1", NameKo = "제1장 · 먹구름이 오는 마을", Ar = 1,
                Gold = 500, Mats = new[] { 0, 2, 0, 2, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch1.s1", TextKo = "청하 촌장을 찾아가기",
                        Lines = new[]
                        {
                            L("elder", "story.ch1.s1.l1", "왔구나. 요 며칠 남쪽 망루 쪽에서 바람이 울고, 하늘에 먹구름이 걷히질 않는단다."),
                            L("elder", "story.ch1.s1.l2", "옛날부터 먹구름은 나쁜 기운이 깨어날 때 온다고 했지."),
                            Pick("story.ch1.s1.p", "제가 알아볼게요.", "바람이 운다고요?"),
                            L("elder", "story.ch1.s1.l3", "남쪽 공터 옛 망루에 가 보렴. 거기 사나운 것이 둥지를 틀었다는 소문이 있어."),
                        } },
                    new Step { Type = StepType.Go, Gx = TowerFootGx, Gy = TowerFootGy, TextKey = "story.ch1.s2", TextKo = "남쪽 공터 옛 망루, 바람이 우는 곳으로" },
                    new Step { Type = StepType.Boss, TextKey = "story.ch1.s3", TextKo = "망루 수호장을 쓰러뜨리기" },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch1.s4", TextKo = "강가 나루의 늙은 사공에게 먹구름을 묻기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch1.s4.l1", "수호장을 쓰러뜨렸다고? 허, 그놈도 먹구름에 홀렸던 게야."),
                            L("ferryman", "story.ch1.s4.l2", "먹구름은 이 물가 서쪽 제단에서 피어오르지. 거기 오래 잠든 이무기가 있다더군."),
                            Pick("story.ch1.s4.p", "이무기요?", "어떻게 막죠?"),
                            L("ferryman", "story.ch1.s4.l3", "북쪽 산기슭 성터의 학자가 비문을 읽고 있다던데, 그 아이한테 가 봐. 요즘 성터 어귀에 졸개들이 들끓는다니 조심하고."),
                        } },
                    new Step { Type = StepType.Kill, Gx = SquadGx, Gy = SquadGy, Kinds = new[] { KT, KT, KF, KF }, TextKey = "story.ch1.s5", TextKo = "산기슭 성터 어귀의 먹구름 졸개 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch1.s6", TextKo = "떠돌이 학자와 이야기하기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch1.s6.l1", "살았다! 졸개들 때문에 비문 곁엔 가지도 못했어."),
                            L("scholar", "story.ch1.s6.l2", "여길 봐. '제단에 원소의 불을 밝히면 잠든 것의 이름이 드러난다' — 네 힘이면 될지도 몰라."),
                        } },
                    new Step { Type = StepType.Light, Gx = AltarGx, Gy = AltarGy, TextKey = "story.ch1.s7", TextKo = "옛 제단에 원소 스킬로 불 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch1.s8", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch1.s8.l1", "먹구름 이무기라… 옛이야기인 줄로만 알았는데."),
                            L("elder", "story.ch1.s8.l2", "고맙다. 네 덕에 마을이 한시름 놓았구나. 이건 마을이 모은 작은 성의란다."),
                            L("elder", "story.ch1.s8.l3", "이무기를 상대하려면 더 강해져야 할 게다. 모험을 더 쌓고 오렴."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch2", NameKey = "story.ch2", NameKo = "제2장 · 먹구름 제단", Ar = 5,
                Gold = 1000, Mats = new[] { 0, 0, 1, 3, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch2.s1", TextKo = "학자에게 제단 가는 길을 묻기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch2.s1.l1", "비문을 다 읽었어. 이무기는 너른 강 물가 서쪽, 먹구름 제단 안에 잠들어 있어."),
                            L("scholar", "story.ch2.s1.l2", "이무기는 번개를 두르면 불에 약해. 준비 단단히 해!"),
                        } },
                    new Step { Type = StepType.Go, Altar = true, TextKey = "story.ch2.s2", TextKo = "강가 먹구름 제단으로" },
                    new Step { Type = StepType.Domain, TextKey = "story.ch2.s3", TextKo = "먹구름 제단에서 먹구름 이무기를 쓰러뜨리기" },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch2.s4", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch2.s4.l1", "하늘이… 개었구나! 몇 해 만에 보는 맑은 하늘이냐."),
                            L("elder", "story.ch2.s4.l2", "이무기는 또 깨어날지 모르지만, 네가 있으니 든든하다. 잔치 준비를 해야겠구나!"),
                            L("elder", "story.ch2.s4.l3", "참, 은비가 너와 함께 다니고 싶다더구나. 비문 읽는 솜씨가 싸움에도 쓸모 있을 게다."),
                        } },
                }
            },
        };

        public static int NpcIndex(string id)
        {
            for (int i = 0; i < Npcs.Length; i++) if (Npcs[i].Id == id) return i;
            return -1;
        }

        public static Npc NpcOf(string id) => Npcs[Mathf.Max(0, NpcIndex(id))];
        public static string NpcName(string id) { var n = NpcOf(id); return GoLocalization.T(n.NameKey, n.NameKo); }
        public static string NpcShort(string id) { var n = NpcOf(id); return GoLocalization.T(n.ShortKey, n.ShortKo); }
        public static string NpcIdle(string id) { var n = NpcOf(id); return GoLocalization.T(n.IdleKey, n.IdleKo); }
        public static string ChapterName(Chapter c) => GoLocalization.T(c.NameKey, c.NameKo);
        public static string StepText(Step s) => GoLocalization.T(s.TextKey, s.TextKo);
        public static string LineText(Line l) => GoLocalization.T(l.Key, l.Ko);
        public static string PickText(Line l, int i) => GoLocalization.T(l.PickKeys[i], l.PickKo[i]);

        /// <summary>칸 좌표 → 땅 위 자리(칸 땅 높이 — 산 칸이 아닌 곳만 쓴다).</summary>
        public static Vector3 GridPos(float gx, float gy)
        {
            int tx = Mathf.RoundToInt(gx), ty = Mathf.RoundToInt(gy);
            return TestMapData.WorldPos(gx, gy) + Vector3.up * TestMapData.GroundHeight(tx, ty);
        }

        public static Vector3 NpcPos(string id) { var n = NpcOf(id); return GridPos(n.Gx, n.Gy); }

        public static Vector3 WeeklyAltarPos()
        {
            foreach (var s in GoDomain.Sites) if (s.Kind == GoDomain.Kind.Weekly) return s.Pos;
            return Vector3.zero;
        }

        /// <summary>단계의 목표 자리 — 순수(표만 본다). 반지름 0 = 닿는 것으로 끝나지 않는 단계(boss·kill·domain).</summary>
        public static Vector3 TargetOf(Step s, out float radius)
        {
            radius = 0f;
            switch (s.Type)
            {
                case StepType.Talk: radius = TalkR; return NpcPos(s.Npc);
                case StepType.Go: radius = GoR; return s.Altar ? WeeklyAltarPos() : GridPos(s.Gx, s.Gy);
                case StepType.Boss: return TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                case StepType.Domain: return WeeklyAltarPos();
                case StepType.Light: radius = LightR; return GridPos(s.Gx, s.Gy);
                default: return GridPos(s.Gx, s.Gy);
            }
        }

        /// <summary>장 끝 보상 한 줄("금 +500 · 무예 교본 +2 · 인연 매듭 +2").</summary>
        public static string RewardText(Chapter c)
        {
            var parts = new System.Collections.Generic.List<string> { string.Format(GoLocalization.T("story.gold", "금 +{0}"), c.Gold) };
            for (int i = 0; i < c.Mats.Length; i++)
                if (c.Mats[i] > 0) parts.Add($"{GoTalent.MatName((GoTalent.Mat)i)} +{c.Mats[i]}");
            return string.Join(" · ", parts);
        }

        public static float Flat(Vector3 a, Vector3 b) { a.y = 0f; b.y = 0f; return Vector3.Distance(a, b); }
    }
}
