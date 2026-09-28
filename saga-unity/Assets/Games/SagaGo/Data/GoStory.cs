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
    ///
    /// PLAN.md 109-14-13 3·4장(웹 ⑲-13) — 단계 셋 더: gather(그 채집물 n 번 — `CookState.Picked`) · cook(아무 요리 하나 — `CookState.Cooked`) ·
    /// follow(인물이 길을 따라 걷는다 — 12m 안이면 걷고 멀면 선다). 인물 넷째 가면 쓴 나그네는 4장 둘째~여섯째 단계에만 선다(옛 나그네 몸 + 가면).
    /// 자리 대응: 가마골(불도깨비 우두머리·수호자) → 끝 논밭 — 이 판 수호자는 망루 하나라 **이야기 보스를 새로 세운다**(불도깨비 몸을 키움, kill 단계의 `Boss`) ·
    /// 가마골 잠든 무덤 → 산기슭 잠든 무덤(숨은 터 `d_tomb`) · 잔치 마당 → 마을 역참 서쪽 들 · 남쪽 다리목 → 마을 남쪽 다리 북쪽 머리 · 남쪽 들녘 → 남쪽 공터 서쪽.
    /// </summary>
    public static class GoStory
    {
        public enum StepType { Talk, Go, Boss, Kill, Light, Domain, Gather, Cook, Follow }

        /// <summary>follow — 이 안이면 인물이 걷고(웹 12m), 이보다 멀면 추적 줄에 "너무 멀어졌다"(웹 30m). 걷는 빠르기 2.6m/초(웹 그대로).</summary>
        public const float FollowNear = 12f, FollowLost = 30f, FollowSpeed = 2.6f;
        /// <summary>대화 글이 흘러나오는 빠르기(초당 글자, 웹 30).</summary>
        public const float RevealCps = 30f;

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
            /// <summary>몸을 빌려 올 옛 마을 사람 id(`NpcBuilder`) — 촌장 = 사내 몸, 상인 = 여인 몸, 나그네 = 궁수 몸.</summary>
            public string BodyFrom;
            /// <summary>얼굴에 가면(나그네).</summary>
            public bool Mask;
            /// <summary>있으면 이 칸들 동안에만 선다(나그네). 칸마다 자리가 다를 수 있다.</summary>
            public Spot[] Appear;
            /// <summary>follow 단계에서 걷는 길(칸 좌표, 첫 점 = 걷기 전 자리).</summary>
            public Vector2[] Path;
        }

        /// <summary>인물이 서는 칸 — 장(0부터)·단계 From~To. Gx·Gy 가 음수면 길(Path) 위(따라가기 동안·뒤는 길 끝).</summary>
        public struct Spot
        {
            public int Ch, From, To;
            public float Gx, Gy;
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
            // 4장 둘째 단계 = 다리 북쪽 머리, 셋째(따라가기) = 길 위, 넷째~여섯째 = 길 끝(남쪽 공터 서쪽)
            new Npc { Id = "wanderer", NameKey = "story.npc.wanderer", NameKo = "가면 쓴 나그네", ShortKey = "story.short.wanderer", ShortKo = "나그네",
                Gx = WanderGx, Gy = WanderGy, BodyFrom = "npc_traveler", Mask = true,
                Appear = new[] { new Spot { Ch = 3, From = 1, To = 1, Gx = WanderGx, Gy = WanderGy }, new Spot { Ch = 3, From = 2, To = 5, Gx = -1f, Gy = -1f } },
                Path = new[] { new Vector2(WanderGx, WanderGy), new Vector2(3.0f, 5.0f), new Vector2(3.0f, 5.55f), new Vector2(3.0f, 6.2f), new Vector2(2.95f, 6.85f), new Vector2(2.55f, 7.2f) },
                IdleKey = "story.idle.wanderer", IdleKo = "……" },
        };

        /// <summary>남쪽 다리 북쪽 머리(마을 남쪽 길 끝) — 4장 나그네가 강물을 보고 선 자리.</summary>
        public const float WanderGx = 3.0f, WanderGy = 4.45f;

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
            public GoDomain.Foe[] Foes;     // Kill — 종류 + 덧씌울 원소(없는 괴물은 옛 몸에 그 원소, 14-1b 전까지)
            /// <summary>Kill — 첫 적을 이야기 보스로(이름·체력 ×`BossHp`·공격 ×`BossAtk`·몸 ×`BossScale`).</summary>
            public string BossKey, BossKo;
            public string Site;             // Domain — 숨은 터 id(없으면 먹구름 제단)
            public string Item;             // Gather
            public int Count;               // Gather
            public Line[] Lines;            // Talk
        }

        public const float BossHp = 6f, BossAtk = 1.5f, BossScale = 1.8f;

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

        private static GoDomain.Foe F(FieldEnemy.Kind k, GoElement over = GoElement.Physical) => new GoDomain.Foe(k, over);
        private static readonly GoDomain.Foe KT = F(FieldEnemy.Kind.StormWraith);
        private static readonly GoDomain.Foe KF = F(FieldEnemy.Kind.EmberImp);

        /// <summary>끝 논밭 가운데 둑(역참·쇠부리 터 사이) — 3장 불도깨비 우두머리.</summary>
        public const float ChiefGx = 3.0f, ChiefGy = 9.35f;
        /// <summary>마을 역참 서쪽 들 — 3장 잔치 마당 습격.</summary>
        public const float FeastGx = 2.3f, FeastGy = 2.3f;
        /// <summary>남쪽 공터 서쪽 풀숲(나그네 길 끝 남쪽) — 4장 가면 졸개.</summary>
        public const float MaskSquadGx = 2.3f, MaskSquadGy = 7.45f;

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
                    new Step { Type = StepType.Kill, Gx = SquadGx, Gy = SquadGy, Foes = new[] { KT, KT, KF, KF }, TextKey = "story.ch1.s5", TextKo = "산기슭 성터 어귀의 먹구름 졸개 물리치기" },
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
            new Chapter
            {
                Id = "ch3", NameKey = "story.ch3", NameKo = "제3장 · 잔칫날의 불청객", Ar = 7,
                Gold = 1250, Mats = new[] { 0, 2, 1, 3, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch3.s1", TextKo = "촌장에게 잔치 일손을 돕겠다고 하기",
                        Lines = new[]
                        {
                            L("elder", "story.ch3.s1.l1", "하늘이 갠 기념으로 잔치를 열기로 했단다. 그런데 일손이 모자라구나."),
                            L("elder", "story.ch3.s1.l2", "들에 피는 청하란을 셋만 꺾어다 주렴. 잔칫상에 꽂을 꽃이란다."),
                            Pick("story.ch3.s1.p", "맡겨 주세요.", "음식은요?"),
                            L("elder", "story.ch3.s1.l3", "꽃을 꺾거든 역참 솥에서 요리도 하나 해 오렴. 사공 버들이 요즘 통 입맛이 없다더구나."),
                        } },
                    new Step { Type = StepType.Gather, Item = "orchid", Count = 3, TextKey = "story.ch3.s2", TextKo = "청하란 꺾기" },
                    new Step { Type = StepType.Cook, TextKey = "story.ch3.s3", TextKo = "역참 곁 솥에서 요리 하나 만들기" },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch3.s4", TextKo = "강가 나루의 사공에게 요리 가져다주기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch3.s4.l1", "오, 냄새 좋구나! 이 늙은이를 다 챙겨 주고."),
                            L("ferryman", "story.ch3.s4.l2", "그런데 말이다, 어젯밤 끝 논밭 쪽 하늘이 벌겋더구나. 불도깨비 우두머리가 또 날뛰는 게야."),
                            Pick("story.ch3.s4.p", "제가 가 볼게요.", "잔치에 불똥이 튀면 큰일이네요."),
                            L("ferryman", "story.ch3.s4.l3", "그놈 불씨가 바람을 타고 마을로 날아들면 잔치고 뭐고 다 타 버릴 게다. 조심하거라."),
                        } },
                    new Step { Type = StepType.Kill, Gx = ChiefGx, Gy = ChiefGy, Foes = new[] { KF, KF, KF },
                        BossKey = "story.boss.chief", BossKo = "불도깨비 우두머리", TextKey = "story.ch3.s5", TextKo = "끝 논밭의 불도깨비 우두머리 쓰러뜨리기" },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch3.s6", TextKo = "떠돌이 학자에게 논밭 소식 전하기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch3.s6.l1", "불도깨비 우두머리를 잡았다고? 마침 잘 왔어. 비문 둘째 조각을 찾았거든."),
                            L("scholar", "story.ch3.s6.l2", "'가면 쓴 나그네가 제단을 두드려 잠든 것을 깨웠다' — 이무기는 스스로 깨어난 게 아니었어."),
                            Pick("story.ch3.s6.p", "가면 쓴 나그네?", "누가 그런 짓을?"),
                            L("scholar", "story.ch3.s6.l3", "이 산기슭 잠든 무덤 안쪽에 그 나그네가 남긴 흔적이 있을지도 몰라. 가 보자."),
                        } },
                    new Step { Type = StepType.Domain, Site = "d_tomb", TextKey = "story.ch3.s7", TextKo = "산기슭 잠든 무덤에서 나그네의 흔적 찾기" },
                    new Step { Type = StepType.Kill, Gx = FeastGx, Gy = FeastGy, Foes = new[] { KF, KF, KF, KT }, TextKey = "story.ch3.s8", TextKo = "잔치 마당에 쳐들어온 불도깨비 졸개 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch3.s9", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch3.s9.l1", "휴, 네가 없었으면 잔치 마당이 잿더미가 될 뻔했구나."),
                            L("elder", "story.ch3.s9.l2", "가면 쓴 나그네라… 옛이야기에 그런 자가 있었지. 먹구름이 올 때마다 어딘가에 서 있었다던."),
                            L("elder", "story.ch3.s9.l3", "오늘은 걱정 말고 실컷 먹고 즐기렴. 이건 잔치 손님께 드리는 선물이란다."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch4", NameKey = "story.ch4", NameKo = "제4장 · 가면 쓴 나그네", Ar = 10,
                Gold = 1500, Mats = new[] { 0, 2, 2, 3, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch4.s1", TextKo = "촌장에게 새벽 소식 듣기",
                        Lines = new[]
                        {
                            L("elder", "story.ch4.s1.l1", "잔치 이튿날 새벽이었단다. 남쪽 다리목에 웬 가면 쓴 나그네가 서 있더래."),
                            L("elder", "story.ch4.s1.l2", "말을 걸어도 대꾸도 않고 강물만 보더라는구나. 옛이야기 속 그자일까…"),
                            Pick("story.ch4.s1.p", "제가 만나 볼게요.", "위험한 사람일까요?"),
                            L("elder", "story.ch4.s1.l3", "조심하거라. 먹구름이 올 때마다 서 있었다던 자라면, 좋은 뜻인지 나쁜 뜻인지 아무도 모른단다."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch4.s2", TextKo = "남쪽 다리목의 가면 쓴 나그네에게 말 걸기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch4.s2.l1", "……먹구름을 걷어 낸 게 너로군."),
                            L("wanderer", "story.ch4.s2.l2", "여기선 귀가 많다. 할 말이 있으면 따라오게."),
                            Pick("story.ch4.s2.p", "따라가죠.", "당신은 누구죠?"),
                            L("wanderer", "story.ch4.s2.l3", "걸으면서 생각해 보게. 너무 떨어지면 기다려 주지 않을 테니."),
                        } },
                    new Step { Type = StepType.Follow, Npc = "wanderer", TextKey = "story.ch4.s3", TextKo = "가면 쓴 나그네를 놓치지 않고 따라가기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch4.s4", TextKo = "남쪽 공터에서 나그네의 말 듣기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch4.s4.l1", "여기라면 듣는 이가 없겠지. 이무기를 깨운 건 내가 아니다."),
                            L("wanderer", "story.ch4.s4.l2", "나는 제단을 두드리고 다니는 자를 쫓고 있을 뿐이다. 그자도 가면을 쓰지 — 그래서 다들 나로 착각하더군."),
                            Pick("story.ch4.s4.p", "그럼 진짜는 따로 있다는 거예요?", "증거라도 있나요?"),
                            L("wanderer", "story.ch4.s4.l3", "증거라… 마침 저기 풀숲이 수상하군. 너도 쫓기고 있었던 모양이다."),
                        } },
                    new Step { Type = StepType.Kill, Gx = MaskSquadGx, Gy = MaskSquadGy,
                        Foes = new[] { KF, KF, F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo) },
                        TextKey = "story.ch4.s5", TextKo = "풀숲에 숨어 있던 가면 졸개 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch4.s6", TextKo = "나그네에게 돌아가기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch4.s6.l1", "제법이군. 이 졸개들이 쓴 가면을 보게 — 내 것과 무늬가 다르지."),
                            L("wanderer", "story.ch4.s6.l2", "이 조각을 산기슭의 학자에게 보이게. 비문을 읽는 아이라면 알아볼 게다."),
                            L("wanderer", "story.ch4.s6.l3", "우린 또 만나겠지. 다음 먹구름이 오기 전에."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch4.s7", TextKo = "떠돌이 학자에게 가면 조각 보이기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch4.s7.l1", "가면 조각? 어디 봐… 이 무늬, 비문 맨 아래 새겨진 거랑 똑같아!"),
                            L("scholar", "story.ch4.s7.l2", "비문엔 제단이 다섯이라고 적혀 있어. 먹구름 제단은 그중 하나일 뿐이고."),
                            Pick("story.ch4.s7.p", "나머지 넷은 어디에?", "가면 쓴 자는 누구죠?"),
                            L("scholar", "story.ch4.s7.l3", "아직은 몰라. 하지만 조각이 모이면 알 수 있을 거야. 서쪽 고개 너머 옛길을 먼저 뒤져 볼게."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch4.s8", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch4.s8.l1", "나그네가 쫓는 가면 쓴 자라… 먹구름이 다섯 번이나 더 올 수 있다는 말이냐."),
                            L("elder", "story.ch4.s8.l2", "네가 있어 다행이구나. 마을 사람들 몫으로 모은 것이니 받아 두렴."),
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

        /// <summary>지금 진행(장·단계·따라간 거리)에서 인물이 서는 자리.</summary>
        public static Vector3 NpcPos(string id) => NpcPosAt(id, StoryState.Ch, StoryState.StepIndex, StoryState.FollowDist);

        /// <summary>그 칸에 서는 자리 — `Appear` 가 있으면 그 칸 자리(길 위면 따라간 거리만큼), 없으면 늘 제 자리.</summary>
        public static Vector3 NpcPosAt(string id, int ch, int step, float followDist)
        {
            var n = NpcOf(id);
            if (n.Appear != null)
                foreach (var a in n.Appear)
                    if (a.Ch == ch && step >= a.From && step <= a.To)
                        return a.Gx < 0f ? PathPos(n, step == FollowStepOf(id, ch) ? followDist : float.MaxValue) : GridPos(a.Gx, a.Gy);
            return GridPos(n.Gx, n.Gy);
        }

        /// <summary>그 칸에 서 있나(`Appear` 가 없으면 늘).</summary>
        public static bool Shown(string id, int ch, int step)
        {
            var n = NpcOf(id);
            if (n.Appear == null) return true;
            foreach (var a in n.Appear) if (a.Ch == ch && step >= a.From && step <= a.To) return true;
            return false;
        }

        /// <summary>그 장에서 이 인물을 따라가는 단계 번호(없으면 −1).</summary>
        public static int FollowStepOf(string id, int ch)
        {
            if (ch < 0 || ch >= Chapters.Length) return -1;
            var steps = Chapters[ch].Steps;
            for (int i = 0; i < steps.Length; i++) if (steps[i].Type == StepType.Follow && steps[i].Npc == id) return i;
            return -1;
        }

        public static float PathLength(Npc n)
        {
            float len = 0f;
            for (int i = 1; i < n.Path.Length; i++) len += Vector2.Distance(n.Path[i - 1], n.Path[i]) * TestMapData.TileSize;
            return len;
        }

        /// <summary>길 위 거리 d(m) 의 자리 — 길 끝을 넘으면 끝.</summary>
        public static Vector3 PathPos(Npc n, float d)
        {
            for (int i = 1; i < n.Path.Length; i++)
            {
                float seg = Vector2.Distance(n.Path[i - 1], n.Path[i]) * TestMapData.TileSize;
                if (d <= seg)
                {
                    Vector2 g = Vector2.Lerp(n.Path[i - 1], n.Path[i], seg > 0f ? d / seg : 1f);
                    return GridPos(g.x, g.y);
                }
                d -= seg;
            }
            var e = n.Path[n.Path.Length - 1];
            return GridPos(e.x, e.y);
        }

        public static Vector3 WeeklyAltarPos() => SitePos(null);

        /// <summary>숨은 터 입구 자리 — id 가 없으면 먹구름 제단.</summary>
        public static Vector3 SitePos(string id)
        {
            foreach (var s in GoDomain.Sites) if (id == null ? s.Kind == GoDomain.Kind.Weekly : s.Id == id) return s.Pos;
            return Vector3.zero;
        }

        public static GoDomain.Kind SiteKind(string id)
        {
            foreach (var s in GoDomain.Sites) if (id == null ? s.Kind == GoDomain.Kind.Weekly : s.Id == id) return s.Kind;
            return GoDomain.Kind.Weekly;
        }

        /// <summary>단계의 목표 자리 — 반지름 0 = 닿는 것으로 끝나지 않는 단계(boss·kill·domain·gather·cook·follow).
        /// gather 는 `from` 에서 가장 가까운 자란 그 채집물, cook 은 가장 가까운 역참 솥.</summary>
        public static Vector3 TargetOf(Step s, out float radius) => TargetOf(s, Vector3.zero, out radius);

        public static Vector3 TargetOf(Step s, Vector3 from, out float radius)
        {
            radius = 0f;
            switch (s.Type)
            {
                case StepType.Talk: radius = TalkR; return NpcPos(s.Npc);
                case StepType.Follow: return NpcPos(s.Npc);
                case StepType.Go: radius = GoR; return s.Altar ? WeeklyAltarPos() : GridPos(s.Gx, s.Gy);
                case StepType.Boss: return TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                case StepType.Domain: return SitePos(s.Site);
                case StepType.Light: radius = LightR; return GridPos(s.Gx, s.Gy);
                case StepType.Gather:
                {
                    Vector3 best = from; float bd = float.MaxValue;
                    foreach (var node in GoCooking.Nodes)
                    {
                        if (node.Item != s.Item || !CookState.Available(node)) continue;
                        float d = Flat(from, node.Pos);
                        if (d < bd) { bd = d; best = node.Pos; }
                    }
                    return best;
                }
                case StepType.Cook:
                {
                    Vector3 best = from; float bd = float.MaxValue;
                    foreach (var w in GoWorldMap.Waypoints)
                    {
                        float d = Flat(from, GoCooking.PotPos(w));
                        if (d < bd) { bd = d; best = GoCooking.PotPos(w); }
                    }
                    return best;
                }
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
