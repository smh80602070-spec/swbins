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
        public enum StepType { Talk, Go, Boss, Kill, Light, Domain, Gather, Cook, Follow, Seal, Climb, Duel, Defend, Chase, Sail, Sky }

        // ---- 109-14-16 7장(웹 ⑲-16) — 곶 → 강 북쪽 물가 마을 동쪽 끝(이 판 강은 곧은 띠라 곶이 없다, 강 쪽을 뺀 다섯 방향에서 무리가 온다) ----
        public const float CapeGx = 5.35f, CapeGy = 4.45f;
        /// <summary>defend — 물결이 나오는 제단 둘레(웹 15m × 1.35) · 다음 물결(웹 28초) · 무너지면 쉬는 초 · 이만큼 안에 오면 첫 물결.</summary>
        public const float DefendRing = 20f, DefendWaveSec = 28f, DefendRest = 4f, DefendStart = 30f;
        /// <summary>제단 체력 = 45 × 산적 공격(26) × 그 지역 위험 배율(웹: 45 × 멧돼지 공격).</summary>
        public const float DefendHits = 45f, DefendRefAtk = 26f;
        /// <summary>물결이 나오는 방향(도, 북 0 시계 방향) — 남쪽(강) 빼고 다섯.</summary>
        public static readonly float[] CapeDirs = { 270f, 315f, 0f, 45f, 90f };

        // ---- 109-14-19 8장(웹 ⑲-19) — 바위섬: 웹은 곶 둘레에서 이웃 물이 가장 많은 뭍 칸이지만 이 판 강은 곧은 띠 하나라 그런 칸이 없다 →
        // 곶 동남쪽 강 칸 한가운데 둥근 바위섬(반지름 12m)을 Play 때 짓는다(`StoryField`). 섬 위 자리는 섬 가운데에서 m(북 = −z).
        public const float IsleGx = 6.4f, IsleGy = 5.0f, IsleR = 12f, IsleTop = 0.1f;
        public static readonly Vector2 IsleLand = new Vector2(1f, -6f), IsleFerry = new Vector2(-4f, -9f), IsleWanderer = new Vector2(7f, -3f),
            IsleHaesol = new Vector2(0f, 4f), IsleSquad = new Vector2(0f, 2f);
        public static Vector3 IslePos(Vector2 off) => TestMapData.WorldPos(IsleGx, IsleGy) + new Vector3(off.x, IsleTop, off.y);
        /// <summary>섬 위인가(가장자리 1m 안쪽) — 섬 위 이야기 적은 이 안에서만 걷는다.</summary>
        public static bool OnIsle(Vector3 p) => Flat(p, IslePos(Vector2.zero)) <= IsleR - 1f;
        /// <summary>배가 닿는 곳 — 섬(북쪽 물가) 또는 강가 나루(사공 곁).</summary>
        public static Vector3 SailDest(Step s) => s.ToIsle ? IslePos(IsleLand) : GridPos(DockGx, DockGy);
        public const float DockGx = 2.35f + 3f / 48f, DockGy = 4.4f - 3f / 48f;

        /// <summary>chase — 노 도둑(웹 13m/초·점마다 0.5초 = 걷기 8·달리기 17.6 사이) → 이 판 걷기 6·달리기 10 사이로 9m/초·0.5초.
        /// 이만큼 안에 오면 달아나고(웹 14m), 이만큼 안이면 잡는다(웹 2.5m). 길 끝이면 놓친 것 — 처음 자리로.</summary>
        public const float ChaseSpeed = 9f, ChasePause = 0.5f, ChaseStart = 12f, ChaseCatch = 2.5f;
        /// <summary>도둑이 달리는 길(칸 좌표) — 강가 나루 동쪽 물가를 따라가다 마을 동쪽 들로 꺾어 북쪽으로(되돌아오지 않는다 — 걸어서 지름길로 가로채지 못하게, 첫 점 = 서 있는 곳).</summary>
        public const float ThiefGx = 2.75f, ThiefGy = 4.3f;
        public static readonly Vector2[] ThiefPath =
        {
            new Vector2(ThiefGx, ThiefGy), new Vector2(3.45f, 4.25f), new Vector2(4.15f, 4.3f), new Vector2(4.6f, 3.95f),
            new Vector2(4.3f, 3.35f), new Vector2(4.35f, 2.7f), new Vector2(4.6f, 2.1f), new Vector2(4.25f, 1.6f),
        };
        public static Vector3 ThiefPoint(int i) => GridPos(ThiefPath[i].x, ThiefPath[i].y);

        // ---- 109-14-21 세계 임무 자리(칸 좌표) — 옛 등대 터 = 강가 나루 동쪽 물가 끝(곶과 바위섬 사이, 동쪽 숲 무리와 45m) · 틈 제단 = 산기슭 역참 서쪽 ·
        // 둥실이 길 = 마을 북쪽 들을 동쪽으로 곧게(되돌아오지 않는다 — 걸어서 가로채지 못하게, 쫓기 수치는 노 도둑 그대로)
        public const float LightGx = 5.95f, LightGy = 4.3f, RiftGx = 2.05f, RiftGy = 1.7f;
        public static readonly Vector2 DungsilPath0 = new Vector2(1.7f, 2.0f);
        public static readonly Vector2[] DungsilPath =
        {
            DungsilPath0, new Vector2(2.25f, 1.95f), new Vector2(2.8f, 1.95f), new Vector2(3.35f, 1.95f), new Vector2(3.9f, 2.0f), new Vector2(4.45f, 2.0f), new Vector2(4.9f, 2.05f),
        };
        /// <summary>달리는 인물의 길 i 째 점(도둑·둥실이).</summary>
        public static Vector3 RunPoint(string id, int i) { var p = NpcOf(id).RunPath; return GridPos(p[i].x, p[i].y); }
        public static int RunCount(string id) => NpcOf(id).RunPath?.Length ?? 0;

        // ---- 109-14-20 9장(웹 ⑲-20) — 구름섬: 6장 봉우리 정상에서 서쪽 36m·위로 54m(웹 북쪽 27m·40m × 1.35 — 이 판 북쪽 하늘엔 옆 봉우리 (6,6) 이 솟아 서쪽 숲 칸 위로), 반지름 19m(웹 14), 난간 1.6m
        // (걸어 오르는 턱 1.1m 보다 높고 점프 2.4m 보다 낮다). 바람 기둥 = 정상 반지름 4.7m(웹 3.5) · 섬 윗면 + 12m 까지 초당 9m(웹 그대로).
        public const float SkyWest = 36f, SkyRise = 54f, SkyR = 19f, SkyRail = 1.6f, DraftR = 4.7f, DraftOver = 12f, DraftRise = 9f;
        public static readonly Vector2 SkySquad = new Vector2(0f, 2.7f), SkyDuel = new Vector2(0f, -4f), SkyWanderer = new Vector2(6.75f, 8.1f),
            SkyHaesol = new Vector2(-6.75f, 6.75f), SummitWanderer = new Vector2(3f, 2f);
        private static Vector3? _skyCenter;
        /// <summary>구름섬 윗면 가운데(월드).</summary>
        public static Vector3 SkyCenter => _skyCenter ??= DuelPeak.Top + new Vector3(-SkyWest, SkyRise, 0f);
        public static Vector3 SkyPos(Vector2 off) => SkyCenter + new Vector3(off.x, 0f, off.y);
        /// <summary>섬 윗면에 섰나(난간 안쪽).</summary>
        public static bool OnSkyTop(Vector3 p) => (Flat(p, SkyCenter) <= SkyR - 1.5f && Mathf.Abs(p.y - SkyCenter.y) < 3f) || OnDeckTop(p);
        /// <summary>섬 층인가(윗면 8m 아래까지·난간 3m 밖까지) — 층이 다르면 들판 전투가 서로 못 본다(웹 `apart`).</summary>
        public static bool OnSkyLayer(Vector3 p) => (Flat(p, SkyCenter) <= SkyR + 3f && p.y > SkyCenter.y - 8f) || (Flat(p, DeckCenter) <= DeckR + 3f && p.y > DeckCenter.y - 8f);
        public static bool SameLayer(Vector3 a, Vector3 b) => OnSkyLayer(a) == OnSkyLayer(b);
        public static float DraftTop => SkyCenter.y + DraftOver;
        /// <summary>구름섬·기둥이 열렸나 — 9장이 열린 뒤 늘(그 전엔 먹구름 덮개).</summary>
        public static bool SkyOpen => StoryState.Ch > 8 || (StoryState.Ch == 8 && !StoryState.Locked);

        public static float DefendHpMax(Vector3 altar) => Mathf.Round(DefendHits * DefendRefAtk * GoWorldMap.DangerMul(GoWorldMap.DangerOf(GoWorldMap.RegionAt(altar))));

        /// <summary>물결 n 의 i 째 적이 나오는 자리(웹: 둘레 자리 중 4n 째부터).</summary>
        public static Vector3 DefendSlot(Vector3 altar, float[] dirs, int wave, int i)
        {
            float a = dirs[(wave * 4 + i) % dirs.Length] * Mathf.Deg2Rad;
            return altar + new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a)) * DefendRing;
        }

        // ---- 109-14-14 5·6장(웹 ⑲-14) — 솔숲 고개 → 서쪽 숲길(옛길 어귀·둘째 제단), 봉우리 → 안쪽 산 칸 (6,7) 봉우리와 그 고원 ----
        /// <summary>seal — 둘째 제단 둘레 석등 셋(북쪽부터 시계 방향 달·별·해), 비문 차례는 해·달·별. 웹 6m × 1.35.</summary>
        public const float SealR = 8f;
        public static readonly string[] SealLayout = { "moon", "star", "sun" };
        public static readonly string[] SealOrder = { "sun", "moon", "star" };
        /// <summary>duel — 체력 절반에서 뇌 방패(최대 체력 12%) + 불도깨비 졸개 둘(웹 그대로).</summary>
        public const float DuelP2At = 0.5f, DuelP2Shield = 0.12f;
        /// <summary>6장 봉우리 — 안쪽 산 칸 가운데 오르기 가장 쉬운 곳(고원 14m + 봉우리 13.5m). 고원 위 자리는 칸 가운데에서 m.</summary>
        public const int DuelPeakGx = 6, DuelPeakGy = 7;
        public static readonly Vector2 ArenaDuel = new Vector2(-12f, -10f), ArenaWanderer = new Vector2(-6f, -16f),
            ArenaScholar = new Vector2(-16f, -4f), ArenaAltar = new Vector2(-17f, -15f);

        /// <summary>6장 봉우리 고원 위 자리(칸 가운데 + 오프셋, 고원 높이).</summary>
        public static Vector3 ArenaPos(Vector2 off) =>
            TestMapData.WorldPos(DuelPeakGx, DuelPeakGy) + new Vector3(off.x, TestMapData.MountainHeight(DuelPeakGx, DuelPeakGy), off.y);

        public static GoWorldMap.Peak DuelPeak
        {
            get
            {
                int i = GoWorldMap.PeakIndex($"peak_{DuelPeakGx}_{DuelPeakGy}");
                return i >= 0 ? GoWorldMap.Peaks[i] : default;
            }
        }

        /// <summary>석등 하나의 자리 — 둘째 제단 둘레(북 = −z 부터 시계 방향).</summary>
        public static Vector3 SealLampPos(Vector3 altar, int i)
        {
            float a = i * Mathf.PI * 2f / 3f;
            return altar + new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a)) * SealR;
        }

        /// <summary>석등 표시 이름(해·달·별).</summary>
        public static string SealName(string id) => id switch
        {
            "sun" => GoLocalization.T("story.seal.sun", "해"),
            "moon" => GoLocalization.T("story.seal.moon", "달"),
            _ => GoLocalization.T("story.seal.star", "별"),
        };

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
            /// <summary>109-14-19 금 간 가면(해솔) · 역참 사람 몸 이름(`FolkBuilder` — 도둑 = 나무꾼, 해솔 = 파수꾼).</summary>
            public bool Crack;
            public string FolkBody;
            /// <summary>109-14-21 세계 임무 인물 — 시대 글자(대화 단추·이름 옆) · 사람 대신 떠 있는 기계 몸(둥실이) · 쫓기 단계에서 달리는 길(칸 좌표, 첫 점 = 서 있는 곳).</summary>
            public string EraKey, EraKo;
            public bool Pet;
            public Vector2[] RunPath;
            /// <summary>있으면 이 칸들 동안에만 선다(나그네). 칸마다 자리가 다를 수 있다.</summary>
            public Spot[] Appear;
            /// <summary>늘 서되 이 칸들 동안엔 그 자리로 옮겨 선다(은비 — 5장 옛길·둘째 제단, 6장 봉우리).</summary>
            public Spot[] At;
            /// <summary>follow 단계에서 걷는 길(칸 좌표, 첫 점 = 걷기 전 자리 — `FrostPath` 면 고원 가운데에서 m).</summary>
            public Vector2[] Path;
            public bool FrostPath;
        }

        /// <summary>인물이 서는 칸 — 장(0부터)·단계 From~To 동안 Gx·Gy(또는 길 위·고원 위).</summary>
        public struct Spot
        {
            public int Ch, From, To;
            public float Gx, Gy;
            /// <summary>길(Path) 위 — 따라가기 동안은 걸은 거리, 뒤는 길 끝.</summary>
            public bool Path;
            /// <summary>6장 봉우리 고원 위 — Gx·Gy 대신 `Arena`(칸 가운데에서 m).</summary>
            public bool Peak;
            public Vector2 Arena;
            /// <summary>109-14-19 바위섬 위 — Gx·Gy 대신 `Arena`(섬 가운데에서 m).</summary>
            public bool Isle;
            /// <summary>109-14-20 구름섬 위 · 봉우리 정상 위(Arena 는 거기서 m) · 그 칸 동안 가면을 벗는다 · 이름·혼잣말을 덮는다.</summary>
            public bool Sky, Summit, Unmask;
            public string NameKey, NameKo, IdleKey, IdleKo;
            /// <summary>109-14-21 세계 임무 칸 — 그 임무(id)를 맡은 동안 단계 From~To 에만(Ch 는 안 본다).</summary>
            public string Wq;
            /// <summary>109-14-28 서리봉 고원 위 — Arena 는 고원 가운데에서 m.</summary>
            public bool Frost;
            /// <summary>109-14-34 조선소 위 — Arena 는 조선소 가운데에서 m.</summary>
            public bool Yard;
            /// <summary>109-14-35 관측대 위(`Sky` 와 함께) — Arena 는 관측대 가운데에서 m.</summary>
            public bool Obs;
        }

        /// <summary>그 칸이 지금 서 있는 칸인가 — 세계 임무 칸이면 그 임무 단계, 아니면 이야기 장·단계.</summary>
        private static bool SpotOn(Spot a, int ch, int step)
        {
            if (a.Wq != null)
            {
                int q = GoWorldQuests.IndexOf(a.Wq);
                return q >= 0 && WorldQuestState.Taken(q) && WorldQuestState.Step(q) >= a.From && WorldQuestState.Step(q) <= a.To;
            }
            return a.Ch == ch && step >= a.From && step <= a.To;
        }

        /// <summary>109-14-28 서리봉 고원 위 자리 — 고원 가운데에서 (x, z) m(눈 바닥 높이 0).</summary>
        public static Vector3 FrostPos(Vector2 off) => GoFrost.Center + new Vector3(off.x, 0.05f, off.y);
        /// <summary>고원 명소 site 곁 — 명소 자리 + 덧셈.</summary>
        public static Vector2 FrostAt(string siteId, float dx, float dz) { GoFrost.TrySite(siteId, out var s); return s.Off + new Vector2(dx, dz); }

        private static Vector3 SpotPos(Npc n, Spot a, int ch, int step, float followDist) =>
            a.Yard ? YardPos(a.Arena) : a.Sky && a.Obs ? DeckPos(a.Arena) : a.Frost ? FrostPos(a.Arena) : a.Sky ? SkyPos(a.Arena) : a.Summit ? DuelPeak.Top + new Vector3(a.Arena.x, 0f, a.Arena.y) : a.Isle ? IslePos(a.Arena) : a.Peak ? ArenaPos(a.Arena) : a.Path ? PathPos(n, step == FollowStepOf(n.Id, ch) ? followDist : float.MaxValue) : GridPos(a.Gx, a.Gy);

        // ---- 109-14-28 10장 서리봉 고원 자리(고원 가운데에서 m — 웹 명소 자리 × 0.45 위에 얹는다) ----
        public static readonly Vector2 HaramObs = FrostAt("obs", 0f, 9f), HaramShip = FrostAt("ship", -7f, 13f), BandiShip = FrostAt("ship", 1f, 12f), HaramFort = FrostAt("fort", 0f, 16f);
        // 11장(⑲-29) — 산성 문루 앞(문 남쪽 22m)·호숫가 석등 자리(호수 북쪽 물가 밖)·바우가 호숫가에서 기다리는 자리·봉화 제단(문 앞 32m)
        public static readonly Vector2 BawooGate = FrostAt("fort", 3f, 22f), LakeSeal = FrostAt("lake", 0f, -36f), BawooLake = FrostAt("lake", 16f, -34f), BeaconAltar = FrostAt("fort", 0f, 32f);
        // 12장(⑲-30) — 서리 무리·구미호는 얼음굴 어귀 남쪽 14m · 반디는 구미호 뒤 굴 앞 · 심장 받침은 비행선 곁(선체 밖)
        // 14장(⑲-35) — 시간 틈 관측소: 마을 서북쪽 풀밭. 자리는 관측소 가운데에서 m(x 동쪽·z 남쪽). 관측대 = 그 위 24m 에 뜬 반지름 12m 돌 원판, 시간 기둥 = 남쪽 13m(구름섬 바람 기둥과 같은 반지름·솟는 빠르기).
        public const float ObsGx = 1.0f, ObsGy = 2.4f, ObsRise = 24f, DeckR = 12f;
        public static readonly Vector2 ObsPillar = new Vector2(0f, 13f), ObsGaon = new Vector2(-9f, 8f);
        public static Vector3 ObsPos(Vector2 off) => GridPos(ObsGx, ObsGy) + new Vector3(off.x, 0f, off.y);
        public static Vector3 DeckCenter => ObsPos(Vector2.zero) + Vector3.up * ObsRise;
        public static Vector3 DeckPos(Vector2 off) => DeckCenter + new Vector3(off.x, 0f, off.y);
        public static Vector3 ObsPillarPos => ObsPos(ObsPillar);
        public static float ObsDraftTop => DeckCenter.y + DraftOver;
        public static bool OnDeckTop(Vector3 p) => Flat(p, DeckCenter) <= DeckR - 1.5f && Mathf.Abs(p.y - DeckCenter.y) < 3f;
        /// <summary>시간 기둥이 섰나 — 14장 틈 석등(6단계)을 밝힌 뒤부터 늘.</summary>
        public static bool ObsPillarOpen => StoryState.Ch > 13 || (StoryState.Ch == 13 && StoryState.StepIndex >= 6);

        // 13장(⑲-34) — 갈대 나루 물가 녹슨 조선소: 마을 강 서쪽 둑(강은 남쪽 19m 밖). 자리는 조선소 가운데에서 m(x 동쪽·z 남쪽). 기중기 다리 둘 사이 들보 윗면이 꼭대기.
        public const float YardGx = 1.3f, YardGy = 4.1f, CraneHeight = 16f, CraneR = 6.5f;
        public static readonly Vector2 YardDaon = new Vector2(-6f, -2f), YardCrane = new Vector2(12f, -4f), YardWeld = new Vector2(0f, -8f), YardFight = new Vector2(0f, -18f), YardBandi = new Vector2(3f, -6f);
        public static Vector3 YardPos(Vector2 off) => GridPos(YardGx, YardGy) + new Vector3(off.x, 0f, off.y);
        public static Vector3 CraneTop => YardPos(YardCrane) + Vector3.up * CraneHeight;
        /// <summary>기중기 들보 위에 섰나(수평 `CraneR` 안 · 윗면에서 1.2m 안).</summary>
        public static bool OnCrane(Vector3 p) => Flat(p, CraneTop) <= CraneR && p.y >= CraneTop.y - 1.2f;
        public static readonly Vector2 CaveFight = FrostAt("cave", 0f, 14f), BandiCave = FrostAt("cave", 8f, 6f), HeartAt = FrostAt("ship", 4f, 7f);

        public static readonly Npc[] Npcs =
        {
            new Npc { Id = "elder", NameKey = "story.npc.elder", NameKo = "청하 촌장 누리", ShortKey = "story.short.elder", ShortKo = "누리",
                Gx = 1f, Gy = 3f, Existing = true,
                IdleKey = "story.idle.elder", IdleKo = "먹구름이 걷히면 마을 잔치를 열어야지." },
            new Npc { Id = "ferryman", NameKey = "story.npc.ferryman", NameKo = "늙은 사공 버들", ShortKey = "story.short.ferryman", ShortKo = "버들",
                Gx = 2.35f, Gy = 4.4f, BodyFrom = "npc_elder",
                At = new[] { new Spot { Ch = 6, From = 8, To = 8, Gx = CapeGx - 6f / 48f, Gy = CapeGy - 6f / 48f }, // 7장 — 곶에 노 저어 온다
                    new Spot { Ch = 7, From = 5, To = 10, Isle = true, Arena = IsleFerry } }, // 8장 — 섬 북쪽에 배를 대고 기다린다
                IdleKey = "story.idle.ferryman", IdleKo = "물 냄새가 요즘 영 비릿해." },
            new Npc { Id = "scholar", NameKey = "story.npc.scholar", NameKo = "떠돌이 학자 은비", ShortKey = "story.short.scholar", ShortKo = "은비",
                Gx = 3.35f, Gy = 1.4f, BodyFrom = "npc_merchant",
                At = new[]
                {
                    new Spot { Ch = 4, From = 0, To = 3, Gx = RoadGx, Gy = RoadGy },
                    new Spot { Ch = 4, From = 4, To = 7, Gx = Altar2Gx - 5f / 48f, Gy = Altar2Gy + 7f / 48f },
                    new Spot { Ch = 5, From = 6, To = 6, Peak = true, Arena = ArenaScholar },
                },
                IdleKey = "story.idle.scholar", IdleKo = "이 비문, 읽을수록 이상하다니까." },
            // 4장 둘째 단계 = 다리 북쪽 머리, 셋째(따라가기) = 길 위, 넷째~여섯째 = 길 끝(남쪽 공터 서쪽)
            new Npc { Id = "wanderer", NameKey = "story.npc.wanderer", NameKo = "가면 쓴 나그네", ShortKey = "story.short.wanderer", ShortKo = "나그네",
                Gx = WanderGx, Gy = WanderGy, BodyFrom = "npc_traveler", Mask = true,
                Appear = new[]
                {
                    new Spot { Ch = 3, From = 1, To = 1, Gx = WanderGx, Gy = WanderGy }, new Spot { Ch = 3, From = 2, To = 5, Path = true },
                    new Spot { Ch = 4, From = 6, To = 6, Gx = Altar2Gx + 7f / 48f, Gy = Altar2Gy + 5f / 48f },
                    new Spot { Ch = 5, From = 2, To = 4, Peak = true, Arena = ArenaWanderer },
                    new Spot { Ch = 6, From = 3, To = 6, Gx = CapeGx + 6f / 48f, Gy = CapeGy - 6f / 48f },
                    new Spot { Ch = 7, From = 6, To = 9, Isle = true, Arena = IsleWanderer },
                    new Spot { Ch = 8, From = 2, To = 2, Summit = true, Arena = SummitWanderer }, // 9장 — 바람 기둥 곁, 먼저 섬으로
                    new Spot { Ch = 8, From = 3, To = 9, Sky = true, Arena = SkyWanderer },
                },
                Path = new[] { new Vector2(WanderGx, WanderGy), new Vector2(3.0f, 5.0f), new Vector2(3.0f, 5.55f), new Vector2(3.0f, 6.2f), new Vector2(2.95f, 6.85f), new Vector2(2.55f, 7.2f) },
                IdleKey = "story.idle.wanderer", IdleKo = "……" },
            // 109-14-19 해솔(검은 가면의 참이름, 금 간 가면 — 섬에서 한 단계) · 노 도둑(쫓기 단계에만 — 자리는 달리는 곳)
            new Npc { Id = "haesol", NameKey = "story.npc.haesol", NameKo = "검은 가면 해솔", ShortKey = "story.short.haesol", ShortKo = "해솔",
                Gx = IsleGx, Gy = IsleGy, FolkBody = "Paladin", Mask = true, Crack = true,
                Appear = new[] { new Spot { Ch = 7, From = 8, To = 8, Isle = true, Arena = IsleHaesol },
                    // 109-14-20 9장 — 가면을 벗은 해솔이 구름섬에 선다(이름·혼잣말도 그 칸 동안)
                    new Spot { Ch = 8, From = 6, To = 9, Sky = true, Arena = SkyHaesol, Unmask = true, NameKey = "story.npc.haesol2", NameKo = "해솔",
                        IdleKey = "story.idle.haesol2", IdleKo = "……고맙다. 노래를 다시 부를 수 있을 것 같아." } },
                IdleKey = "story.idle.haesol", IdleKo = "……" },
            new Npc { Id = "thief", NameKey = "story.npc.thief", NameKo = "노 도둑", ShortKey = "story.short.thief", ShortKo = "도둑",
                Gx = ThiefGx, Gy = ThiefGy, FolkBody = "PeasantMan", RunPath = ThiefPath,
                Appear = new[] { new Spot { Ch = 7, From = 2, To = 2, Gx = ThiefGx, Gy = ThiefGy } },
                IdleKey = "story.idle.thief", IdleKo = "헤헤, 못 잡지롱!" },
            // ---- 109-14-21 세계 임무 인물 일곱(웹 worldquest.js NPCS — 과거·현대·미래가 한 사건에). 맡길 사람(묵호·물결·별이)은 늘 선다 ----
            new Npc { Id = "wq_postmaster", NameKey = "wq.npc.postmaster", NameKo = "역참지기 묵호", ShortKey = "wq.short.postmaster", ShortKo = "묵호",
                EraKey = "era.past", EraKo = "과거", Gx = 4.3f, Gy = 2.65f, FolkBody = "Archer",
                IdleKey = "wq.idle.postmaster", IdleKo = "파발 말은 늙었어도 편지는 늘 제때 가야지." },
            new Npc { Id = "wq_rider", NameKey = "wq.npc.rider", NameKo = "배달꾼 다래", ShortKey = "wq.short.rider", ShortKo = "다래",
                EraKey = "era.modern", EraKo = "현대", Gx = 1.75f, Gy = 2.4f, FolkBody = "Megan",
                Appear = new[] { new Spot { Wq = "wq_letters", From = 1, To = 3, Gx = 1.75f, Gy = 2.4f } },
                IdleKey = "wq.idle.rider", IdleKo = "오늘도 마을 한 바퀴! 짐칸 자물쇠만 말썽이야." },
            new Npc { Id = "wq_dungsil", NameKey = "wq.npc.dungsil", NameKo = "배달 기계 둥실이", ShortKey = "wq.short.dungsil", ShortKo = "둥실이",
                EraKey = "era.future", EraKo = "미래", Gx = DungsilPath0.x, Gy = DungsilPath0.y, Pet = true, RunPath = DungsilPath,
                Appear = new[] { new Spot { Wq = "wq_letters", From = 2, To = 3, Gx = DungsilPath0.x, Gy = DungsilPath0.y } },
                IdleKey = "wq.idle.dungsil", IdleKo = "삐빅 — 배달 경로 다시 짜는 중." },
            new Npc { Id = "wq_researcher", NameKey = "wq.npc.researcher", NameKo = "바다 연구원 물결", ShortKey = "wq.short.researcher", ShortKo = "물결",
                EraKey = "era.modern", EraKo = "현대", Gx = 2.0f, Gy = 4.2f, FolkBody = "Remy",
                IdleKey = "wq.idle.researcher", IdleKo = "밤바다에 옛 등대 불빛 같은 게 깜박여. 기록해 둬야지." },
            new Npc { Id = "wq_hanbit", NameKey = "wq.npc.hanbit", NameKo = "등대 지기 한빛", ShortKey = "wq.short.hanbit", ShortKo = "한빛",
                EraKey = "era.future", EraKo = "미래", Gx = LightGx + 0.12f, Gy = LightGy - 0.1f, FolkBody = "ExoGray",
                Appear = new[] { new Spot { Wq = "wq_lighthouse", From = 2, To = 4, Gx = LightGx + 0.12f, Gy = LightGy - 0.1f } },
                IdleKey = "wq.idle.hanbit", IdleKo = "신호 세기 백 분의 사. 불씨가 필요합니다." },
            new Npc { Id = "wq_byeori", NameKey = "wq.npc.byeori", NameKo = "시간 탐사대원 별이", ShortKey = "wq.short.byeori", ShortKo = "별이",
                EraKey = "era.future", EraKo = "미래", Gx = 3.1f, Gy = 1.75f, FolkBody = "Crypto",
                IdleKey = "wq.idle.byeori", IdleKo = "여기 연도 표시가 셋이나 겹쳐 보여. 시간 틈이 맞아." },
            new Npc { Id = "wq_dolsoe", NameKey = "wq.npc.dolsoe", NameKo = "옛 석공 돌쇠", ShortKey = "wq.short.dolsoe", ShortKo = "돌쇠",
                EraKey = "era.past", EraKo = "과거", Gx = RiftGx - 0.25f, Gy = RiftGy + 0.05f, FolkBody = "PeasantMan",
                Appear = new[] { new Spot { Wq = "wq_rift", From = 2, To = 6, Gx = RiftGx - 0.25f, Gy = RiftGy + 0.05f } },
                IdleKey = "wq.idle.dolsoe", IdleKo = "돌은 거짓말을 안 하지. 사람이 할 뿐." },
            // 109-14-28 10장(웹 ⑲-28) — 서리봉 고원. 하람 = 기상 관측원(관측소 곁 → 따라가면 비행선 곁 → 산성 문 안쪽) · 반디 = 비행선 곁 떠 있는 조종 기계
            new Npc { Id = "haram", NameKey = "story.npc.haram", NameKo = "기상 관측원 하람", ShortKey = "story.short.haram", ShortKo = "하람",
                Gx = 4.5f, Gy = 0.5f, FolkBody = "SwatGuy", FrostPath = true, Path = new[] { HaramObs, HaramShip },
                Appear = new[]
                {
                    new Spot { Ch = 9, From = 3, To = 4, Frost = true, Arena = HaramObs },
                    new Spot { Ch = 9, From = 5, To = 6, Path = true },
                    new Spot { Ch = 9, From = 7, To = 8, Frost = true, Arena = HaramFort },
                    new Spot { Ch = 10, From = 0, To = 7, Frost = true, Arena = HaramObs }, // 11장 — 관측소에서 바늘을 지킨다
                    new Spot { Ch = 10, From = 8, To = 8, Frost = true, Arena = HaramShip },
                    new Spot { Ch = 11, From = 0, To = 5, Frost = true, Arena = HaramObs }, // 12장 — 관측소에서 기다린다, 심장이 돌아온 뒤엔 비행선 곁
                    new Spot { Ch = 11, From = 6, To = 8, Frost = true, Arena = HaramShip },
                },
                IdleKey = "story.idle.haram", IdleKo = "바늘이 또 얼었네… 눈은 언제 그치려나." },
            new Npc { Id = "bandi", NameKey = "story.npc.bandi", NameKo = "조종 기계 반디", ShortKey = "story.short.bandi", ShortKo = "반디",
                Gx = 4.5f, Gy = 0.5f, Pet = true,
                Appear = new[] { new Spot { Ch = 9, From = 6, To = 8, Frost = true, Arena = BandiShip }, new Spot { Ch = 10, From = 0, To = 8, Frost = true, Arena = BandiShip },
                    new Spot { Ch = 11, From = 0, To = 4, Frost = true, Arena = BandiShip }, new Spot { Ch = 11, From = 5, To = 5, Frost = true, Arena = BandiCave }, new Spot { Ch = 11, From = 6, To = 8, Frost = true, Arena = BandiShip },
                    new Spot { Ch = 12, From = 0, To = 5, Frost = true, Arena = BandiShip }, new Spot { Ch = 12, From = 6, To = 8, Yard = true, Arena = YardBandi },
                    new Spot { Ch = 13, From = 0, To = 8, Frost = true, Arena = BandiShip }, new Spot { Ch = 13, From = 9, To = 9, Sky = true, Obs = true, Arena = new Vector2(3f, 3f) } },
                IdleKey = "story.idle.bandi", IdleKo = "삐— 별배 심장 온도, 계속 하락 중." },
            // 109-14-35 14장(웹 ⑲-35) — 시간 틈 관측사 가온: 늘 관측소 남서쪽 발치에 선다
            new Npc { Id = "gaon", NameKey = "story.npc.gaon", NameKo = "시간 틈 관측사 가온", ShortKey = "story.short.gaon", ShortKo = "가온",
                Gx = ObsGx + ObsGaon.x / TestMapData.TileSize, Gy = ObsGy + ObsGaon.y / TestMapData.TileSize, FolkBody = "Crypto",
                IdleKey = "story.idle.gaon", IdleKo = "관측대가 또 한 뼘 기울었어요. 기록만 하고 있을 순 없는데…" },
            // 109-14-34 13장(웹 ⑲-34) — 조선공 다온: 늘 조선소 창고 앞에 선다(나루 서쪽 둑)
            new Npc { Id = "daon", NameKey = "story.npc.daon", NameKo = "조선공 다온", ShortKey = "story.short.daon", ShortKo = "다온",
                Gx = YardGx - 6f / TestMapData.TileSize, Gy = YardGy - 2f / TestMapData.TileSize, FolkBody = "PeasantMan",
                IdleKey = "story.idle.daon", IdleKo = "이 조선소 문 닫은 지 십 년인데… 요즘 밤마다 쇳소리가 나요." },
            // 109-14-29 11장(웹 ⑲-29) — 산성지기 바우: 문루(2·6~7단계)·호숫가(3~5단계)에 선다
            new Npc { Id = "bawoo", NameKey = "story.npc.bawoo", NameKo = "산성지기 바우", ShortKey = "story.short.bawoo", ShortKo = "바우",
                Gx = 4.5f, Gy = 0.5f, FolkBody = "Vanguard",
                Appear = new[]
                {
                    new Spot { Ch = 10, From = 1, To = 2, Frost = true, Arena = BawooGate },
                    new Spot { Ch = 10, From = 3, To = 5, Frost = true, Arena = BawooLake },
                    new Spot { Ch = 10, From = 6, To = 7, Frost = true, Arena = BawooGate },
                },
                IdleKey = "story.idle.bawoo", IdleKo = "……불씨는 아직 꺼지지 않았다." },
        };


        /// <summary>남쪽 다리 북쪽 머리(마을 남쪽 길 끝) — 4장 나그네가 강물을 보고 선 자리.</summary>
        public const float WanderGx = 3.0f, WanderGy = 4.45f;
        /// <summary>5장 서쪽 숲길 — 옛길(은비가 졸개에 에워싸인 곳) · 어귀(go, 마을 쪽 숲 가장자리) · 옛길 졸개 · 둘째 제단(숲길 북쪽 끝) · 제단 졸개(제단 남쪽 10m).</summary>
        public const float RoadGx = -0.1f, RoadGy = 2.85f, RoadGoGx = 0.35f, RoadGoGy = 3.0f, RoadSquadGx = 0.1f, RoadSquadGy = 3.15f;
        public const float Altar2Gx = 0.0f, Altar2Gy = 2.05f, Altar2SquadGx = 0.0f, Altar2SquadGy = 2.25f;

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
            /// <summary>Kill·Duel·Light — 6장 봉우리 고원 위 자리(있으면 Gx·Gy 대신).</summary>
            public Vector2? Arena;
            /// <summary>Kill·Duel 이야기 보스 배율(0 이면 `BossHp`·`BossAtk`·`BossScale`) · 공격 차례 · 가면.</summary>
            public float HpMul, AtkMul, ScaleMul;
            public FieldEnemy.BossMove[] Rot;
            public bool Mask;
            /// <summary>109-14-16 duel — 금 간 가면 · 2단계 방패 원소(기본 뇌) · 2단계 졸개(기본 불도깨비 둘) · 나올 때·2단계·쓰러질 때 글.</summary>
            public bool Crack;
            public GoElement P2El = GoElement.Electro;
            public GoDomain.Foe[] Adds;
            public string EnterKey, EnterKo, P2Key, P2Ko, WinKey, WinKo;
            /// <summary>109-14-16 defend — 지킬 것 이름 · 물결(없으면 `DefendWaves`) · 나오는 방향.</summary>
            public string NameKey, NameKo;
            public GoDomain.Foe[][] Waves;
            public float[] Dirs;
            /// <summary>Light — 이 단계부터 제단 몸이 선다(지키기·결투 동안에도 보이게, 없으면 그 단계부터).</summary>
            public int AltarFrom = -1;
            /// <summary>109-14-19 — 바위섬 위(Kill·Seal, 자리 = 섬 가운데 + Arena) · Seal 차례(없으면 `SealOrder`) · Sail 이 섬으로 가나(아니면 나루로).</summary>
            public bool Isle;
            public string[] Order;
            public bool ToIsle;
            /// <summary>109-14-20 — 구름섬 위(Kill·Duel, 자리 = 섬 가운데 + Arena) · 이야기 보스 왕관·먹구름 가면(먹구름 임금).</summary>
            public bool Sky, Crown;
            /// <summary>109-14-21 chase 알림 — 달아날 때(Enter)·잡았을 때(Win)는 위 칸을 쓰고, 놓쳤을 때만 여기(없으면 노 도둑 글).</summary>
            public string LostKey, LostKo;
            /// <summary>109-14-28 서리봉 고원 위(자리 = 고원 가운데 + Arena, 명소 자리는 `GoFrost.Sites` 의 Off + 덧셈) · follow 알림 글(없으면 나그네) · 걷는 빠르기(0 이면 `FollowSpeed`).</summary>
            public bool Frost;
            /// <summary>109-14-34 조선소 위(자리 = 조선소 가운데 + Arena, climb 은 기중기 꼭대기).</summary>
            public bool Yard;
            /// <summary>109-14-35 관측대 위(`Sky` 와 함께 — 자리 = 관측대 가운데 + Arena) · sky 단계는 시간 기둥으로.</summary>
            public bool Obs;
            public string ArriveKey, ArriveKo;
            public float Speed;
        }

        public static Vector3 StepPos(Step s) => s.Yard ? YardPos(s.Arena ?? Vector2.zero) : s.Sky && s.Obs ? DeckPos(s.Arena ?? Vector2.zero) : s.Frost ? FrostPos(s.Arena ?? Vector2.zero) : s.Sky ? SkyPos(s.Arena ?? Vector2.zero) : s.Isle ? IslePos(s.Arena ?? Vector2.zero) : s.Arena.HasValue ? ArenaPos(s.Arena.Value) : GridPos(s.Gx, s.Gy);

        /// <summary>석등 차례(해·달·별이 기본, 8장은 별·달·해).</summary>
        public static string[] OrderOf(Step s) => s.Order ?? SealOrder;

        /// <summary>석등 가운데 — 5장 둘째 제단 또는 섬(8장).</summary>
        public static Vector3 SealPos(Step s) => s.Frost ? StepPos(s) : s.Isle ? IslePos(Vector2.zero) : s.Gx != 0f || s.Gy != 0f ? GridPos(s.Gx, s.Gy) : GridPos(Altar2Gx, Altar2Gy);

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
            /// <summary>109-14-15 장 끝에 동행으로 들어오는 이야기 동료(`GoHeroes.Story`, 없으면 null).</summary>
            public string Join;
        }

        internal static Line L(string who, string key, string ko) => new Line { Who = who, Key = key, Ko = ko };
        internal static Line Pick(string key, string a, string b) => new Line { PickKeys = new[] { key + ".a", key + ".b" }, PickKo = new[] { a, b } };

        internal static GoDomain.Foe F(FieldEnemy.Kind k, GoElement over = GoElement.Physical) => new GoDomain.Foe(k, over);
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
                Id = "ch2", NameKey = "story.ch2", NameKo = "제2장 · 먹구름 제단", Ar = 5, Join = "story_scholar",
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
            new Chapter
            {
                Id = "ch5", NameKey = "story.ch5", NameKo = "제5장 · 서쪽 고개 옛길", Ar = 12, Join = "story_wanderer",
                Gold = 1750, Mats = new[] { 0, 3, 2, 3, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch5.s1", TextKo = "촌장에게 학자 소식 듣기",
                        Lines = new[]
                        {
                            L("elder", "story.ch5.s1.l1", "은비가 서쪽 숲 옛길로 떠난 지 사흘째란다. 그 뒤로 소식이 뚝 끊겼어."),
                            L("elder", "story.ch5.s1.l2", "그 길은 사당보다도 오래된 길이야. 숲에 묻혀서 이제 아는 사람도 드물지."),
                            Pick("story.ch5.s1.p", "제가 찾아볼게요.", "혼자 간 거예요?"),
                            L("elder", "story.ch5.s1.l3", "마을 서쪽 숲길로 들어가면 옛길 어귀가 나온단다. 서두르렴."),
                        } },
                    new Step { Type = StepType.Go, Gx = RoadGoGx, Gy = RoadGoGy, TextKey = "story.ch5.s2", TextKo = "서쪽 숲길 옛길 어귀로" },
                    new Step { Type = StepType.Kill, Gx = RoadSquadGx, Gy = RoadSquadGy,
                        Foes = new[] { KF, KF, F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        TextKey = "story.ch5.s3", TextKo = "옛길에서 학자를 에워싼 가면 졸개 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch5.s4", TextKo = "옛길에서 학자와 이야기하기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch5.s4.l1", "휴, 살았다! 비문을 베끼다가 졸개들한테 딱 걸렸지 뭐야."),
                            L("scholar", "story.ch5.s4.l2", "둘째 제단은 이 숲길 북쪽 끝에 있어. 석등 셋이 제단을 둘러싸고 있지."),
                            L("scholar", "story.ch5.s4.l3", "비문엔 이렇게 적혀 있었어 — '해가 뜨고, 달이 지고, 별이 남는다'. 그 차례대로 불을 밝혀야 봉인이 풀려."),
                            Pick("story.ch5.s4.p", "차례가 틀리면요?", "먼저 가 볼게요."),
                            L("scholar", "story.ch5.s4.l4", "전부 꺼져 버리겠지. 해, 달, 별 — 잊으면 안 돼!"),
                        } },
                    new Step { Type = StepType.Seal, TextKey = "story.ch5.s5", TextKo = "둘째 제단 석등을 비문 차례대로 밝히기" },
                    new Step { Type = StepType.Kill, Gx = Altar2SquadGx, Gy = Altar2SquadGy,
                        Foes = new[] { KF, KF, KT, F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo) },
                        TextKey = "story.ch5.s6", TextKo = "제단에 몰려든 가면 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch5.s7", TextKo = "제단 곁의 가면 쓴 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch5.s7.l1", "……한발 늦을 뻔했군. 그자가 이 제단을 두드리러 오던 참이었다."),
                            L("wanderer", "story.ch5.s7.l2", "네가 먼저 봉인을 밝혀 두었으니 깨우지는 못하고, 졸개만 풀어 놓고 달아났지."),
                            Pick("story.ch5.s7.p", "그자를 봤어요?", "어디로 갔죠?"),
                            L("wanderer", "story.ch5.s7.l3", "봉우리 너머로. 그자가 떨군 비문 조각이다 — 학자에게 건네게."),
                            L("wanderer", "story.ch5.s7.l4", "……그자를 쫓는 길, 이제부턴 혼자보다 둘이 낫겠군. 촌장에게 인사를 마치면 네 곁에 서지."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch5.s8", TextKo = "학자에게 셋째 비문 조각 건네기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch5.s8.l1", "셋째 조각…! '다섯 제단이 모두 깨면 먹구름의 주인이 돌아온다'."),
                            L("scholar", "story.ch5.s8.l2", "가면 쓴 자가 노리는 건 이무기가 아니었어. 그 '주인'이야."),
                            Pick("story.ch5.s8.p", "먹구름의 주인?", "남은 제단은 셋이네요."),
                            L("scholar", "story.ch5.s8.l3", "둘은 우리가 지켰어. 남은 셋은… 조각을 더 읽어 보고 알려 줄게."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch5.s9", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch5.s9.l1", "은비가 무사하다니 다행이구나. 먹구름의 주인이라… 이름만 들어도 오싹하다."),
                            L("elder", "story.ch5.s9.l2", "잊혔던 옛길까지 되살려 준 셈이니 마을이 네게 진 빚이 크구나. 받아 두렴."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch6", NameKey = "story.ch6", NameKo = "제6장 · 봉우리의 검은 가면", Ar = 15, Join = "story_elder",
                Gold = 2000, Mats = new[] { 0, 3, 2, 4, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch6.s1", TextKo = "학자에게 셋째 제단 자리 듣기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch6.s1.l1", "조각들을 맞춰 봤어. 셋째 제단은 남쪽 공터 동쪽 봉우리야 — 길이 없어서 벽을 타고 올라가야 해."),
                            L("scholar", "story.ch6.s1.l2", "나그네는 벌써 올라갔대. 검은 가면이 그리로 가는 걸 봤다나."),
                            Pick("story.ch6.s1.p", "바로 갈게요.", "검은 가면?"),
                            L("scholar", "story.ch6.s1.l3", "진짜 범인 말이야. 이번엔 도망치기 전에 붙잡아야 해! 기력 잘 보면서 올라가."),
                        } },
                    new Step { Type = StepType.Climb, TextKey = "story.ch6.s2", TextKo = "봉우리 꼭대기로 올라가기(벽 타기·활공)" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch6.s3", TextKo = "봉우리 고원의 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch6.s3.l1", "제법 빨리 왔군. 그자가 곧 제단을 두드리러 올 게다."),
                            L("wanderer", "story.ch6.s3.l2", "그자는 그림자처럼 등 뒤로 붙는다. 붉은 원이 발밑에 생기면 곧장 몸을 빼게."),
                            Pick("story.ch6.s3.p", "같이 싸워요.", "왔다!"),
                            L("wanderer", "story.ch6.s3.l3", "……왔군. 먹구름을 두르면 불로 깨라!"),
                        } },
                    new Step { Type = StepType.Duel, Arena = ArenaDuel, Foes = new[] { F(FieldEnemy.Kind.Bandit) }, Mask = true,
                        BossKey = "story.boss.mask", BossKo = "검은 가면", HpMul = 8f, AtkMul = 1.9f, ScaleMul = 1.05f,
                        Rot = new[] { FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Melee },
                        TextKey = "story.ch6.s4", TextKo = "검은 가면과 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch6.s5", TextKo = "나그네와 검은 가면이 남긴 것 살피기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch6.s5.l1", "……먹구름 속으로 달아났군. 하지만 가면에 금이 갔다. 다음엔 못 숨는다."),
                            L("wanderer", "story.ch6.s5.l2", "그자가 떨군 비문 조각이다. 그리고 제단 — 두드린 자국이 있지만 아직 살아 있어."),
                            L("wanderer", "story.ch6.s5.l3", "원소의 불을 다시 밝히게. 학자도 곧 올라올 게다."),
                        } },
                    new Step { Type = StepType.Light, Arena = ArenaAltar, TextKey = "story.ch6.s6", TextKo = "셋째 제단에 원소 불 다시 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch6.s7", TextKo = "봉우리 고원에 올라온 학자에게 넷째 조각 보이기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch6.s7.l1", "헉, 헉… 이 벽 누가 만든 거야. 조각 좀 보여 줘!"),
                            L("scholar", "story.ch6.s7.l2", "'먹구름 임금은 다섯 제단에 나뉘어 잠들었다. 가면은 임금의 신하의 표식이다'…"),
                            Pick("story.ch6.s7.p", "신하라고요?", "검은 가면이 그 신하?"),
                            L("scholar", "story.ch6.s7.l3", "응. 남은 제단은 둘. 그자도 급해졌을 거야 — 마을에 먼저 알리자."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch6.s8", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch6.s8.l1", "먹구름 임금의 신하라… 옛날 할머니가 들려주던 자장가에 그런 말이 있었지."),
                            L("elder", "story.ch6.s8.l2", "봉우리까지 오르다니 장하구나. 다친 데는 없느냐? 이건 마을 사람들이 모은 거란다."),
                            L("elder", "story.ch6.s8.l3", "……이 늙은이도 더는 앉아만 있을 수 없구나. 다음 길엔 나도 함께 가마. 부채 바람쯤은 아직 일으킬 줄 안단다."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch7", NameKey = "story.ch7", NameKo = "제7장 · 물가 곶의 넷째 제단", Ar = 18, Join = "story_ferryman",
                Gold = 2250, Mats = new[] { 0, 3, 2, 4, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch7.s1", TextKo = "학자에게 넷째 제단 자리 듣기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch7.s1.l1", "넷째 조각 뒷면에 지도가 새겨져 있었어. 넷째 제단은 강가 나루 동쪽, 물이 휘감아 도는 곶이야."),
                            L("scholar", "story.ch7.s1.l2", "근데 이상해. 곶 쪽에서 밤마다 불빛이 오락가락한대. 사공 할아버지가 제일 잘 알 거야."),
                            Pick("story.ch7.s1.p", "사공에게 가 볼게요.", "불빛이요?"),
                            L("scholar", "story.ch7.s1.l3", "검은 가면이 이번엔 혼자 오지 않을지도 몰라. 조심해!"),
                        } },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch7.s2", TextKo = "강가 나루의 사공에게 곶 소식 묻기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch7.s2.l1", "곶 말이냐? 요 며칠 밤마다 가면 쓴 무리가 떼로 몰려가더구나."),
                            L("ferryman", "story.ch7.s2.l2", "제단 돌을 두드리는 소리가 여기까지 들려. 이 늙은이 배로는 어림도 없고."),
                            Pick("story.ch7.s2.p", "제가 지킬게요.", "몇이나 되던가요?"),
                            L("ferryman", "story.ch7.s2.l3", "셀 수가 없었다. 한 떼를 쫓으면 또 한 떼가 오더구나. 제단이 무너지기 전에 서두르거라."),
                        } },
                    new Step { Type = StepType.Go, Gx = CapeGx, Gy = CapeGy - 22f / 48f, TextKey = "story.ch7.s3", TextKo = "강가 동쪽 곶, 넷째 제단으로" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch7.s4", TextKo = "곶의 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch7.s4.l1", "왔군. 그자가 이번엔 제 손을 더럽히지 않을 셈이다 — 무리부터 보냈어."),
                            L("wanderer", "story.ch7.s4.l2", "제단이 무너지면 먹구름 임금의 넷째 조각이 풀려난다. 무리를 제단에 붙이지 마라."),
                            Pick("story.ch7.s4.p", "제단 곁을 지킬게요.", "그자는 어디 있죠?"),
                            L("wanderer", "story.ch7.s4.l3", "물결 뒤에 숨어 보고 있겠지. 무리가 다 쓰러지면 제 발로 나올 게다."),
                        } },
                    new Step { Type = StepType.Defend, Gx = CapeGx, Gy = CapeGy, NameKey = "story.altar4", NameKo = "넷째 제단", Dirs = CapeDirs,
                        TextKey = "story.ch7.s5", TextKo = "넷째 제단을 가면 무리에게서 지키기" },
                    new Step { Type = StepType.Duel, Gx = CapeGx, Gy = CapeGy - 12f / 48f, Foes = new[] { F(FieldEnemy.Kind.Bandit) }, Mask = true, Crack = true,
                        BossKey = "story.boss.mask2", BossKo = "금 간 검은 가면", HpMul = 9.2f, AtkMul = 2.0f, ScaleMul = 1.05f,
                        Rot = new[] { FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Shadow },
                        P2El = GoElement.Hydro, Adds = new[] { KF, F(FieldEnemy.Kind.DrownedGhost) },
                        EnterKey = "story.ch7.enter", EnterKo = "금 간 검은 가면이 물결을 가르고 곶에 올라섰다",
                        P2Key = "story.ch7.p2", P2Ko = "금 간 검은 가면이 물 방패를 둘렀다 — 번개로 깨라! 졸개가 뛰어든다",
                        WinKey = "story.ch7.win", WinKo = "가면 반쪽이 떨어졌다 — 금 간 검은 가면이 물속으로 몸을 던졌다. 졸개도 흩어진다",
                        TextKey = "story.ch7.s6", TextKo = "금 간 검은 가면과 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch7.s7", TextKo = "나그네와 깨진 가면 반쪽 살피기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch7.s7.l1", "……물속으로 달아났군. 하지만 가면 반쪽을 두고 갔다."),
                            L("wanderer", "story.ch7.s7.l2", "방금 그 얼굴… 아니, 그럴 리가 없지."),
                            Pick("story.ch7.s7.p", "아는 얼굴이에요?", "괜찮아요?"),
                            L("wanderer", "story.ch7.s7.l3", "아직은 말할 수 없다. 제단부터 다시 밝히게 — 그자가 두드린 자국이 깊다."),
                        } },
                    new Step { Type = StepType.Light, Gx = CapeGx, Gy = CapeGy, AltarFrom = 4, TextKey = "story.ch7.s8", TextKo = "넷째 제단에 원소 불 다시 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch7.s9", TextKo = "곶에 온 사공과 물 건너 불빛 보기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch7.s9.l1", "불이 켜졌구나! 멀리서 보고 노를 저어 왔지."),
                            L("ferryman", "story.ch7.s9.l2", "그런데 저기 보이느냐? 물 건너 바위섬에도 불빛 하나가 깜박이는구나."),
                            Pick("story.ch7.s9.p", "다섯째 제단?", "누가 켰을까요?"),
                            L("ferryman", "story.ch7.s9.l3", "바위섬은 뱃길이 험해 아무도 안 가는 곳이다. 촌장께 먼저 알리거라."),
                            L("ferryman", "story.ch7.s9.l4", "……그리고 그 뱃길은 내가 안내하마. 이 늙은 노도 아직 쓸 만하단다. 촌장께 인사를 마치면 네 곁에 서지."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch7.s10", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch7.s10.l1", "제단을 지켜 냈다니… 이제 남은 건 바위섬 하나로구나."),
                            L("elder", "story.ch7.s10.l2", "가면 반쪽이라. 나그네가 그렇게 놀라더란 말이지."),
                            L("elder", "story.ch7.s10.l3", "고생 많았다. 마을 사람들이 곶의 불빛을 보고 모은 거란다."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch8", NameKey = "story.ch8", NameKo = "제8장 · 바위섬의 다섯째 제단", Ar = 20,
                Gold = 2500, Mats = new[] { 0, 3, 3, 4, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch8.s1", TextKo = "촌장에게 바위섬 이야기 듣기",
                        Lines = new[]
                        {
                            L("elder", "story.ch8.s1.l1", "사공이 본 바위섬 불빛 말이다, 오늘 새벽엔 더 밝아졌다는구나."),
                            L("elder", "story.ch8.s1.l2", "바위섬엔 뱃길 말고는 갈 길이 없단다. 사공 버들에게 배를 부탁해 보렴."),
                            Pick("story.ch8.s1.p", "나루로 갈게요.", "섬엔 뭐가 있죠?"),
                            L("elder", "story.ch8.s1.l3", "옛사람들은 거기를 \"별이 쉬는 바위\"라 불렀지. 다섯째 제단이 있다면 거기일 게다."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch8.s2", TextKo = "강가 나루의 사공에게 배를 부탁하기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch8.s2.l1", "배? 태워 주고말고… 그런데 노가 없어졌다!"),
                            L("ferryman", "story.ch8.s2.l2", "방금 웬 날랜 녀석이 노를 둘러메고 물가를 따라 내뺐어. 가면 무리 끄나풀인 게야."),
                            Pick("story.ch8.s2.p", "제가 잡아 올게요.", "어느 쪽으로요?"),
                            L("ferryman", "story.ch8.s2.l3", "걸어서는 어림없다, 그놈 발이 여간 빠른 게 아니야. 힘껏 달려야 잡는다!"),
                        } },
                    new Step { Type = StepType.Chase, Npc = "thief", TextKey = "story.ch8.s3", TextKo = "노 도둑을 쫓아가 붙잡기(달리기)" },
                    new Step { Type = StepType.Talk, Npc = "ferryman", TextKey = "story.ch8.s4", TextKo = "사공에게 노 돌려주기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch8.s4.l1", "허허, 그 날랜 놈을 잡았다고? 네 발도 보통이 아니구나."),
                            L("ferryman", "story.ch8.s4.l2", "노만 있으면 바위섬쯤이야. 배에 오르거든 꽉 잡거라."),
                        } },
                    new Step { Type = StepType.Sail, Npc = "ferryman", ToIsle = true, TextKey = "story.ch8.s5", TextKo = "사공의 배를 타고 바위섬으로",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch8.s5.l1", "자, 간다! 물살이 세니 고개 숙이고 있거라."),
                        } },
                    new Step { Type = StepType.Kill, Isle = true, Arena = IsleSquad, Foes = new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith) }, TextKey = "story.ch8.s6", TextKo = "바위섬 꼭대기의 가면 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch8.s7", TextKo = "섬의 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch8.s7.l1", "……먼저 와 있었다. 그자가 이 섬에 올 줄 알았지."),
                            L("wanderer", "story.ch8.s7.l2", "이제 말해야겠군. 검은 가면의 참이름은 해솔 — 나와 같은 마을에서 자란 옛 동무다."),
                            Pick("story.ch8.s7.p", "옛 동무라고요?", "왜 이런 짓을?"),
                            L("wanderer", "story.ch8.s7.l3", "석등을 켜 보게. 별, 달, 해 — 해솔이 어릴 때 부르던 노래 차례다. 그 녀석이라면 이 차례로 잠갔을 게다."),
                        } },
                    new Step { Type = StepType.Seal, Isle = true, Order = new[] { "star", "moon", "sun" }, TextKey = "story.ch8.s8", TextKo = "다섯째 제단 석등을 해솔의 노래 차례대로 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "haesol", TextKey = "story.ch8.s9", TextKo = "석등 곁에 나타난 해솔과 이야기하기",
                        Lines = new[]
                        {
                            L("haesol", "story.ch8.s9.l1", "……별, 달, 해. 그 노래를 아직 기억하는 사람이 있었나."),
                            L("haesol", "story.ch8.s9.l2", "다섯 제단은 임금을 가둔 자물쇠다. 나는 그 자물쇠를 여는 열쇠고."),
                            Pick("story.ch8.s9.p", "왜 임금을 깨우려는 거죠?", "나그네가 당신을 찾고 있어요."),
                            L("haesol", "story.ch8.s9.l3", "알 것 없다. 먹구름 위 여섯째 자리에서 기다리마 — 거기서 끝을 보자."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch8.s10", TextKo = "나그네와 해솔이 남긴 말 되새기기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch8.s10.l1", "……여전히 제멋대로군. 가면 반쪽이 깨진 채로 가다니."),
                            L("wanderer", "story.ch8.s10.l2", "먹구름 위 여섯째 자리라… 하늘에 뜬 섬 이야기를 들어 본 적이 있다. 학자가 알 게다."),
                            L("wanderer", "story.ch8.s10.l3", "일단 뭍으로 돌아가세. 사공이 배를 대고 기다리고 있다."),
                        } },
                    new Step { Type = StepType.Sail, Npc = "ferryman", ToIsle = false, TextKey = "story.ch8.s11", TextKo = "사공의 배를 타고 강가 나루로 돌아가기",
                        Lines = new[]
                        {
                            L("ferryman", "story.ch8.s11.l1", "다 끝났느냐? 해 지기 전에 돌아가자꾸나."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch8.s12", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch8.s12.l1", "해솔이라… 그 이름을 다시 듣게 될 줄이야. 어릴 적 나그네와 늘 붙어 다니던 아이였지."),
                            L("elder", "story.ch8.s12.l2", "먹구름 위 여섯째 자리라니, 은비에게 물어보자꾸나. 오늘은 푹 쉬렴."),
                            L("elder", "story.ch8.s12.l3", "바위섬까지 다녀온 수고비다. 마을 사람들이 조금씩 모았단다."),
                        } },
                }
            },
            new Chapter
            {
                Id = "ch9", NameKey = "story.ch9", NameKo = "제9장 · 먹구름 위 여섯째 자리", Ar = 25, Join = "story_haesol",
                Gold = 2750, Mats = new[] { 0, 3, 4, 5, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch9.s1", TextKo = "떠돌이 학자에게 여섯째 자리 묻기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch9.s1.l1", "다섯 조각을 다 맞췄어! 끝 구절은 이래 — '다섯 불이 모이는 곳, 봉우리 위 하늘에 여섯째 자리'."),
                            L("scholar", "story.ch9.s1.l2", "그리고 어젯밤, 셋째 제단이 있던 봉우리 꼭대기에서 하늘로 바람 기둥이 솟는 걸 봤어. 다섯 제단 불빛이 거기로 모이더라."),
                            Pick("story.ch9.s1.p", "봉우리로 갈게요.", "하늘로 가는 길이라고요?"),
                            L("scholar", "story.ch9.s1.l3", "바람을 타면 구름 위까지 오를 수 있을 거야. 나그네가 먼저 봉우리로 갔어 — 서둘러!"),
                        } },
                    new Step { Type = StepType.Climb, EnterKey = "story.ch9.climbed", EnterKo = "봉우리 꼭대기 — 하늘로 솟는 바람 기둥 곁에 나그네가 서 있다", TextKey = "story.ch9.s2", TextKo = "봉우리 꼭대기로 오르기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch9.s3", TextKo = "바람 기둥 곁의 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch9.s3.l1", "왔군. 보이나 — 저 바람 기둥. 다섯 제단의 불이 하늘에 길을 냈다."),
                            L("wanderer", "story.ch9.s3.l2", "기둥 안에서 뛰어오르게. 바람이 날개를 펴 주고, 구름섬 위까지 밀어 올려 줄 거다."),
                            Pick("story.ch9.s3.p", "같이 가요.", "해솔은 거기 있을까요?"),
                            L("wanderer", "story.ch9.s3.l3", "…있을 거다. 이번엔 가면이 아니라 해솔을 데려온다. 먼저 올라가 있겠네."),
                        } },
                    new Step { Type = StepType.Sky, TextKey = "story.ch9.s4", TextKo = "바람 기둥을 타고 구름섬에 오르기(기둥 안에서 점프)" },
                    new Step { Type = StepType.Kill, Sky = true, Arena = SkySquad, Foes = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), KT, KT, KF }, TextKey = "story.ch9.s5", TextKo = "구름섬을 지키는 먹구름 무리 물리치기" },
                    new Step { Type = StepType.Duel, Sky = true, Arena = SkyDuel, Foes = new[] { F(FieldEnemy.Kind.Bandit) }, Mask = true, Crack = true,
                        BossKey = "story.boss.haesol", BossKo = "먹구름 가면 해솔", HpMul = 10.4f, AtkMul = 2.1f, ScaleMul = 1.05f,
                        Rot = new[] { FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Shadow },
                        Adds = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), KT },
                        EnterKey = "story.ch9.enter1", EnterKo = "먹구름을 두른 해솔이 여섯째 자리에서 내려섰다",
                        P2Key = "story.ch9.p21", P2Ko = "해솔이 먹구름 방패를 둘렀다 — 불로 깨라! 회오리매와 번개귀가 뛰어든다",
                        WinKey = "story.ch9.win1", WinKo = "해솔의 가면이 마침내 두 쪽으로 갈라져 떨어졌다 — 해솔이 무릎을 꿇는다", TextKey = "story.ch9.s6", TextKo = "먹구름 가면을 쓴 해솔과 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "haesol", TextKey = "story.ch9.s7", TextKo = "가면을 벗은 해솔과 이야기하기",
                        Lines = new[]
                        {
                            L("haesol", "story.ch9.s7.l1", "……여기가, 어디지. 오래 꿈을 꾼 것 같아. 먹구름 속에서 누가 계속 노래를 부르라고…"),
                            L("haesol", "story.ch9.s7.l2", "아니 — 늦었다! 내가 자물쇠를 두드려 낸 틈으로 임금의 꿈이 새어 나왔어. 그 꿈이 이 섬에서 몸을 얻는다!"),
                            Pick("story.ch9.s7.p", "같이 막아요!", "해솔, 괜찮아요?"),
                            L("haesol", "story.ch9.s7.l3", "몸이 아직 말을 안 들어. 네가 먹구름 임금을 막아 줘. 난 곁에서 노래로 바람을 붙들고 있을게."),
                        } },
                    new Step { Type = StepType.Duel, Sky = true, Arena = SkyDuel, Foes = new[] { F(FieldEnemy.Kind.Bandit) }, Mask = true, Crown = true,
                        BossKey = "story.boss.king", BossKo = "먹구름 임금", HpMul = 13.6f, AtkMul = 2.3f, ScaleMul = 2.0f,
                        Rot = new[] { FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Halo },
                        Adds = new[] { KF, KT },
                        EnterKey = "story.ch9.enter2", EnterKo = "먹구름이 뭉쳐 왕관 쓴 거인이 되었다 — 먹구름 임금!",
                        P2Key = "story.ch9.p22", P2Ko = "먹구름 임금이 번개 방패를 둘렀다 — 불로 깨라! 졸개 둘이 뛰어든다",
                        WinKey = "story.ch9.win2", WinKo = "먹구름 임금 — 꿈이 흩어지며 하늘의 먹구름이 걷혀 간다", TextKey = "story.ch9.s8", TextKo = "먹구름 임금 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch9.s9", TextKo = "나그네와 해솔 곁으로 가기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch9.s9.l1", "……해솔."),
                            L("haesol", "story.ch9.s9.l2", "여전하구나, 그 흰 가면. 날 찾겠다는 맹세였다고? 바보 같긴."),
                            L("wanderer", "story.ch9.s9.l3", "이제 벗어도 되겠지."),
                            Pick("story.ch9.s9.p", "다행이에요.", "두 분 다 돌아와서 기뻐요."),
                            L("haesol", "story.ch9.s9.l4", "마을로 내려가자. 누리 할머니한테 혼나야겠지만 — 날개를 펴고 곧장."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "haesol", TextKey = "story.ch9.s10", TextKo = "해솔과 함께 내려갈 채비하기",
                        Lines = new[]
                        {
                            L("haesol", "story.ch9.s10.l1", "난간을 뛰어넘으면 바람이 날개를 펴 줘. 마을 쪽으로 한달음이야. 먼저 가 있어, 곧 따라갈게."),
                        } },
                    new Step { Type = StepType.Go, Gx = 1.2f, Gy = 3.2f, TextKey = "story.ch9.s11", TextKo = "구름섬에서 뛰어내려 청하 마을로" },
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch9.s12", TextKo = "청하 촌장에게 알리기",
                        Lines = new[]
                        {
                            L("elder", "story.ch9.s12.l1", "하늘이 이렇게 파란 건 몇 해 만인지…! 먹구름이 걷혔어."),
                            L("elder", "story.ch9.s12.l2", "해솔이 돌아왔다고? 그 녀석, 할머니 볼 낯도 없나 봐. 이따 잔칫상 앞에 끌고 오너라."),
                            L("elder", "story.ch9.s12.l3", "늘 노래를 흥얼거리던 착한 아이였지. 이제부턴 네 곁에 서겠다더구나."),
                            L("elder", "story.ch9.s12.l4", "약속대로 잔치를 열자꾸나. 이건 온 마을이 너를 위해 모은 거다. 고맙다, 정말로."),
                        } },
                }
            },
            // 109-14-28 10장(웹 ⑲-28, 정본 대사 saga-godot `story.gd` ch10) — 서리 고개 너머: 이야기 2부의 첫 장. 무대 = 서리봉 고원(`GoFrost`, 지도 밖 눈밭).
            // 눈여우·매는 14-1b(새 원소 괴물 몸) 전까지 옛 몸에 그 원소(빙·풍)를 덧씌운다. 웹의 "고원 탑 켜기"는 지도 순간이동 지점이 14-27b 라 고원 가운데까지 걸어가기로.
            new Chapter
            {
                Id = "ch10", NameKey = "story.ch10", NameKo = "제10장 · 서리 고개 너머", Ar = 26,
                Gold = 3000, Mats = new[] { 0, 3, 4, 5, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch10.s1", TextKo = "청하 촌장에게 북쪽 소식 듣기",
                        Lines = new[]
                        {
                            L("elder", "story.ch10.s1.l1", "잔치가 끝나자마자 북쪽 산길이 얼어붙었단다. 고개에서 찬바람이 내려와."),
                            L("elder", "story.ch10.s1.l2", "고개 너머 서리봉 고원엔 옛 산성 터가 있고, 요즘은 날씨를 재는 관측소도 있다지. 그 불빛이 사흘째 꺼져 있구나."),
                            Pick("story.ch10.s1.p", "가 볼게요.", "관측소요?"),
                            L("elder", "story.ch10.s1.l3", "해솔 말로는 그날 밤 불붙은 별 하나가 고원 쪽으로 떨어졌대. 두껍게 입고 가거라."),
                        } },
                    new Step { Type = StepType.Go, Frost = true, Arena = FrostAt("stele", 0f, -4f), TextKey = "story.ch10.s2", TextKo = "북쪽 산기슭 역참 곁 서리 고개 돌기둥에서 고원으로 오르기" },
                    new Step { Type = StepType.Go, Frost = true, Arena = new Vector2(0f, 8f), TextKey = "story.ch10.s3", TextKo = "눈밭을 가로질러 고원 가운데로 걸어가기" },
                    new Step { Type = StepType.Kill, Frost = true, Arena = FrostAt("obs", 0f, 20f),
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        TextKey = "story.ch10.s4", TextKo = "기상 관측소를 에워싼 눈여우 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "haram", TextKey = "story.ch10.s5", TextKo = "기상 관측소 앞의 관측원과 이야기하기",
                        Lines = new[]
                        {
                            L("haram", "story.ch10.s5.l1", "살았다…! 저 여우들, 사흘째 관측소를 에워싸고 있었어요."),
                            L("haram", "story.ch10.s5.l2", "난 기상 관측원 하람이에요. 사흘 전 밤, 은빛 배가 하늘에서 떨어진 뒤로 눈이 한 번도 안 멎어요. 바늘도 다 얼었고."),
                            Pick("story.ch10.s5.p", "은빛 배요?", "같이 가 봐요."),
                            L("haram", "story.ch10.s5.l3", "떨어진 자리는 알아요. 따라와요 — 여우가 또 올지 모르니까 가까이 붙어서!"),
                        } },
                    new Step { Type = StepType.Follow, Npc = "haram", Speed = 6f, ArriveKey = "story.ch10.arrive", ArriveKo = "하람이 걸음을 멈췄다",
                        TextKey = "story.ch10.s6", TextKo = "관측원 하람을 따라 추락한 비행선으로" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch10.s7", TextKo = "추락한 비행선 곁의 기계와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch10.s7.l1", "삐— 생체 신호 둘. 구조대입니까?"),
                            L("haram", "story.ch10.s7.l2", "구조대는 아니고… 넌 누구니?"),
                            L("bandi", "story.ch10.s7.l3", "조종 기계 반디. 이 배 「별배」는 먼 앞날에서 시간 틈을 지나다 떨어졌습니다. 심장이 식으면서 추위를 뿜고 있습니다."),
                            Pick("story.ch10.s7.p", "심장을 다시 켤 수 있어?", "앞날에서 왔다고?"),
                            L("bandi", "story.ch10.s7.l4", "불씨가 필요합니다. 기록에 따르면 이 고원의 옛 산성에 꺼지지 않는 불씨가 지켜졌습니다."),
                            L("haram", "story.ch10.s7.l5", "산성이라면 고원 북쪽 돌담이에요. 요즘 밤마다 거기서 등불이 떠다닌다던데…"),
                        } },
                    new Step { Type = StepType.Go, Frost = true, Arena = FrostAt("fort", 0f, 30f), TextKey = "story.ch10.s8", TextKo = "옛 산성 터 둘러보기" },
                    new Step { Type = StepType.Talk, Npc = "haram", TextKey = "story.ch10.s9", TextKo = "산성 터에서 하람과 이야기하기",
                        Lines = new[]
                        {
                            L("haram", "story.ch10.s9.l1", "봐요, 눈 위에 발자국 하나 없는데 등불 그을음만 남았어요."),
                            L("haram", "story.ch10.s9.l2", "밤이 되면 산성지기가 나와 불씨를 지킨다는 옛이야기가 있어요. 그냥 이야기인 줄 알았는데…"),
                            Pick("story.ch10.s9.p", "산성지기를 찾아봐요.", "불씨가 정말 있을까요?"),
                            L("haram", "story.ch10.s9.l3", "오늘은 관측소에서 몸 좀 녹여요. 기계가 풀리면 날씨 지도를 보여 줄게요. 다음엔 산성 안쪽으로!"),
                        } },
                }
            },
            // 109-14-29 11장(웹 ⑲-29) — 얼음 아래 산성: 관측소 → 산성 문루(바우) → 호숫가 석등(달·해·별) → 얼음 밑 파수 → 불씨 → 문 앞 봉화 제단 지키기 → 비행선.
            // 바위곰·눈여우·매·날쌘용은 14-1b(새 원소 괴물 몸) 전까지 옛 몸에 그 원소(암·빙·풍·뇌)를 덧씌운다.
            new Chapter
            {
                Id = "ch11", NameKey = "story.ch11", NameKo = "제11장 · 얼음 아래 산성", Ar = 28,
                Gold = 3250, Mats = new[] { 0, 3, 4, 5, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "haram", TextKey = "story.ch11.s1", TextKo = "기상 관측소의 하람에게 날씨 지도 보기",
                        Lines = new[]
                        {
                            L("haram", "story.ch11.s1.l1", "기계가 풀렸어요! 이것 봐요 — 찬 기운이 두 군데서 뿜어 나와요. 하나는 비행선, 하나는… 호수 한가운데."),
                            L("haram", "story.ch11.s1.l2", "호수 밑엔 아무것도 없을 텐데. 그리고 어젯밤, 산성 문루에 등불 하나가 또 떠 있었어요."),
                            Pick("story.ch11.s1.p", "산성으로 가 볼게요.", "등불이요?"),
                            L("haram", "story.ch11.s1.l3", "옛이야기의 산성지기라면, 호수 얘기도 알겠죠. 난 여기서 바늘을 지켜볼게요. 조심해요!"),
                        } },
                    new Step { Type = StepType.Go, Frost = true, Arena = FrostAt("fort", 0f, 30f), TextKey = "story.ch11.s2", TextKo = "옛 산성 문루로" },
                    new Step { Type = StepType.Talk, Npc = "bawoo", TextKey = "story.ch11.s3", TextKo = "문루에 나타난 산성지기와 이야기하기",
                        Lines = new[]
                        {
                            L("bawoo", "story.ch11.s3.l1", "……또 누가 불씨를 찾아왔구나. 먹구름 졸개냐, 하늘에서 떨어진 쇳덩이의 심부름꾼이냐."),
                            Pick("story.ch11.s3.p", "불씨를 빌리러 왔어요.", "당신이 산성지기?"),
                            L("bawoo", "story.ch11.s3.l2", "나는 바우. 이 산성이 무너지던 날까지 봉화 불씨를 지켰고, 그 뒤로도 떠나지 못했다."),
                            L("bawoo", "story.ch11.s3.l3", "적이 산성을 넘던 밤, 불씨를 호수 얼음 밑 석빙고에 감췄지. 얼음 문은 호숫가 석등 셋으로만 열린다."),
                            L("bawoo", "story.ch11.s3.l4", "옛 노랫말이다 — '달이 얼음에 먼저 비치고, 해가 얼음을 녹이고, 별이 길을 연다'. 차례를 어기면 문은 다시 얼어붙는다."),
                            L("bawoo", "story.ch11.s3.l5", "호숫가에서 기다리마. 네 불이 노랫말을 따르는지 보겠다."),
                        } },
                    new Step { Type = StepType.Seal, Frost = true, Arena = LakeSeal, Order = new[] { "moon", "sun", "star" }, TextKey = "story.ch11.s4", TextKo = "얼어붙은 호수 석등을 노랫말 차례대로 밝히기" },
                    new Step { Type = StepType.Kill, Frost = true, Arena = FrostAt("lake", 0f, 0f),
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith) },
                        TextKey = "story.ch11.s5", TextKo = "얼음 문이 열리며 깨어난 파수 짐승 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "bawoo", TextKey = "story.ch11.s6", TextKo = "호숫가의 바우에게 불씨 받기",
                        Lines = new[]
                        {
                            L("bawoo", "story.ch11.s6.l1", "석빙고 파수들이 백 년 만에 깼구나. 저놈들도 제 일을 했을 뿐이다."),
                            L("bawoo", "story.ch11.s6.l2", "보아라 — 꺼지지 않았다. 산성 봉화의 불씨다."),
                            Pick("story.ch11.s6.p", "하늘 배의 심장을 켜야 해요.", "받아도 될까요?"),
                            L("bawoo", "story.ch11.s6.l3", "쇳덩이의 심장이라… 불씨는 제가 갈 곳을 안다. 헌데 불씨가 얼음 밖에 나오면 그 냄새를 맡고 서리 짐승들이 몰려온다."),
                            L("bawoo", "story.ch11.s6.l4", "산성 문루 앞 봉화 제단에 불씨를 올려라. 불이 제 힘을 되찾을 때까지 지켜 내야 한다. 담이 뒤를 막아 줄 게다."),
                        } },
                    new Step { Type = StepType.Defend, Frost = true, Arena = BeaconAltar, NameKey = "story.altar_beacon", NameKo = "봉화 제단", Dirs = new[] { 90f, 135f, 180f, 225f, 270f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        },
                        TextKey = "story.ch11.s7", TextKo = "산성 문루 앞 봉화 제단을 서리 짐승에게서 지키기" },
                    new Step { Type = StepType.Talk, Npc = "bawoo", TextKey = "story.ch11.s8", TextKo = "문루의 바우와 이야기하기",
                        Lines = new[]
                        {
                            L("bawoo", "story.ch11.s8.l1", "……버텼구나. 불씨가 제 빛을 찾았다. 이제 얼음 밖에서도 꺼지지 않을 게다."),
                            L("bawoo", "story.ch11.s8.l2", "백 년을 지켰으니, 이제 넘겨도 되겠지. 산성의 불씨를 네게 맡긴다."),
                            Pick("story.ch11.s8.p", "꼭 지킬게요.", "당신은요?"),
                            L("bawoo", "story.ch11.s8.l3", "나는 이 돌담에 남는다. 하늘 배가 다시 떠오르면, 봉화가 오른 것으로 알겠다."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch11.s9", TextKo = "추락한 비행선의 반디에게 불씨 가져가기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch11.s9.l1", "삐— 열원 감지. 온도… 상승. 이것이 기록 속의 불씨입니까?"),
                            L("haram", "story.ch11.s9.l2", "관측소 바늘이 움직였어요! 호수 쪽 찬 기운이 뚝 끊겼고요."),
                            Pick("story.ch11.s9.p", "이제 심장을 켤 수 있어?", "바우가 맡긴 거야."),
                            L("bandi", "story.ch11.s9.l3", "불씨만으로는 부족합니다. 심장실 문이 안쪽에서 얼어붙었고, 시간 틈에서 무언가가 심장을 붙잡고 있습니다."),
                            L("haram", "story.ch11.s9.l4", "무언가라니… 오늘은 여기까지. 내일 날이 개면, 셋이서 배 안으로 들어가요."),
                        } },
                }
            },
            // 109-14-30 12장(웹 ⑲-30) — 떨어진 별배: 관측소 → 비행선(반디) → 얼음굴 어귀 → 서리 무리 → 틈새 서리 구미호(빙 방패 2단계) → 반디 → 심장 받침 → 반디 → 하람 합류 = 2부 끝.
            // 눈여우·회오리매는 14-1b(새 원소 괴물 몸) 전까지 옛 몸에 그 원소(빙·풍)를 덧씌우고, 구미호도 물귀신 몸을 키워 빙으로 둘렀다(틈새 질주만 새 수 Rift).
            new Chapter
            {
                Id = "ch12", NameKey = "story.ch12", NameKo = "제12장 · 떨어진 별배", Ar = 30, Join = "story_haram",
                Gold = 3500, Mats = new[] { 0, 4, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "haram", TextKey = "story.ch12.s1", TextKo = "기상 관측소의 하람과 이야기하기",
                        Lines = new[]
                        {
                            L("haram", "story.ch12.s1.l1", "왔어요? 바늘이 또 이상해요 — 비행선 쪽 온도가 뚝뚝 떨어지는데, 반디 신호는 끊겼다 이어졌다 해요."),
                            Pick("story.ch12.s1.p", "바로 가 볼게요.", "반디가 위험해요?"),
                            L("haram", "story.ch12.s1.l2", "불씨는 잘 갖고 있죠? 먼저 가요. 나도 기계만 챙겨서 곧 따라갈게요!"),
                        } },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch12.s2", TextKo = "추락한 비행선의 반디에게 가기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch12.s2.l1", "삐— 경고. 심장실 문을 열었습니다. 심장이… 없습니다."),
                            L("bandi", "story.ch12.s2.l2", "시간 틈에서 흰 짐승이 나와 심장을 물고 갔습니다. 꼬리가 아홉. 발자국은 얼음굴로."),
                            Pick("story.ch12.s2.p", "쫓아갈게.", "꼬리가 아홉?"),
                            L("bandi", "story.ch12.s2.l3", "그 짐승은 이 시대 것이 아닙니다. 심장의 추위를 먹고 자랍니다. 서둘러 주십시오."),
                        } },
                    new Step { Type = StepType.Go, Frost = true, Arena = FrostAt("cave", 0f, 0f), TextKey = "story.ch12.s3", TextKo = "흰 발자국을 따라 얼음굴 어귀로" },
                    new Step { Type = StepType.Kill, Frost = true, Arena = CaveFight,
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        TextKey = "story.ch12.s4", TextKo = "시간 틈에서 새어 나온 서리 무리 물리치기" },
                    new Step { Type = StepType.Duel, Frost = true, Arena = CaveFight, Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        BossKey = "story.boss.riftfox", BossKo = "틈새 서리 구미호", HpMul = 12f, AtkMul = 2.2f, ScaleMul = 1.9f,
                        Rot = new[] { FieldEnemy.BossMove.Rift, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Rift, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Halo },
                        P2El = GoElement.Cryo, Adds = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch12.enter", EnterKo = "시간 틈이 찢어지며 꼬리 아홉 달린 흰 여우가 뛰어나왔다 — 틈새 서리 구미호!",
                        P2Key = "story.ch12.p2", P2Ko = "틈새 서리 구미호가 시간 틈의 서리를 둘렀다 — 불로 깨라! 여우와 매가 뛰어든다",
                        WinKey = "story.ch12.win", WinKo = "틈새 서리 구미호 — 별배 심장을 떨구고 시간 틈 속으로 사라졌다",
                        TextKey = "story.ch12.s5", TextKo = "별배 심장을 문 틈새 서리 구미호와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch12.s6", TextKo = "얼음굴 앞에 날아온 반디와 심장 살피기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch12.s6.l1", "삐— 심장 회수. 금은 갔지만 멈추지 않았습니다."),
                            L("bandi", "story.ch12.s6.l2", "그 짐승은 틈 너머로 달아났습니다. 틈은 아직 닫히지 않았습니다 — 기록해 두겠습니다."),
                            Pick("story.ch12.s6.p", "이제 불씨로 켜자.", "틈이 또 열릴까?"),
                            L("bandi", "story.ch12.s6.l3", "비행선 곁 심장 받침으로. 불씨를 원소로 불어 넣어 주십시오."),
                        } },
                    new Step { Type = StepType.Light, Frost = true, Arena = HeartAt, TextKey = "story.ch12.s7", TextKo = "비행선 곁 심장 받침에 원소 스킬로 불씨 불어 넣기" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch12.s8", TextKo = "심장이 뛰는 비행선의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch12.s8.l1", "삐— 심장 박동 확인. 선체 온도 상승. 추위 방출… 정지."),
                            L("haram", "story.ch12.s8.l2", "보여요? 눈이 잦아들어요! 사흘 만에 하늘이 보여요."),
                            Pick("story.ch12.s8.p", "별배는 날 수 있어?", "이제 끝난 거야?"),
                            L("bandi", "story.ch12.s8.l3", "아직입니다. 날개 조각 셋이 시간 틈 너머 여러 시대에 흩어졌습니다. 그리고 그 흰 짐승도."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "haram", TextKey = "story.ch12.s9", TextKo = "하람과 이야기하기",
                        Lines = new[]
                        {
                            L("haram", "story.ch12.s9.l1", "여러 시대라니… 관측원 인생에 이런 날이 올 줄이야."),
                            L("haram", "story.ch12.s9.l2", "결정했어요. 관측소 기록은 기계한테 맡기고, 나도 같이 갈래요. 날씨도 시간도, 재야 아는 거니까."),
                            Pick("story.ch12.s9.p", "같이 가요!", "위험할 텐데요?"),
                            L("haram", "story.ch12.s9.l3", "신호탄 활이면 여우쯤은 문제없어요. 잘 부탁해요!"),
                        } },
                }
            },
            // 109-14-34 13장(웹 ⑲-34) — 3부 첫 장, 녹슨 조선소의 날개: 비행선 반디 → 강 서쪽 둑 조선소 → 다온 → 시간 틈 무리 → 다온 → 기중기 다리를 타고 들보 위로 → 반디 → 용접대 지키기(강 쪽을 뺀 여섯 방향) → 다온.
            // 두꺼비·날쌘용·매·도깨비·바위곰은 14-1b(새 몸) 전까지 옛 몸(물귀신·번개귀·풍·불도깨비·암 물귀신).
            new Chapter
            {
                Id = "ch13", NameKey = "story.ch13", NameKo = "제13장 · 녹슨 조선소의 날개", Ar = 32,
                Gold = 3750, Mats = new[] { 0, 4, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch13.s1", TextKo = "추락한 비행선의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch13.s1.l1", "삐— 날개 조각 신호 하나 수신. 방향 남쪽, 바다 냄새. 시대 표지는… 지금과 가깝습니다."),
                            Pick("story.ch13.s1.p", "바다라면 갈대 나루?", "지금과 가깝다니?"),
                            L("bandi", "story.ch13.s1.l2", "갈대 나루 물가, 문 닫은 조선소 좌표입니다. 조각이 쇠붙이 사이에 끼어 있을 확률 칠십 퍼센트."),
                            L("bandi", "story.ch13.s1.l3", "시간 틈 짐승들도 신호를 맡았을 겁니다. 서둘러 주십시오."),
                        } },
                    new Step { Type = StepType.Go, Yard = true, Arena = Vector2.zero, TextKey = "story.ch13.s2", TextKo = "갈대 나루 물가의 녹슨 조선소로" },
                    new Step { Type = StepType.Talk, Npc = "daon", TextKey = "story.ch13.s3", TextKo = "조선소 창고 앞의 다온과 이야기하기",
                        Lines = new[]
                        {
                            L("daon", "story.ch13.s3.l1", "누구세요? 여긴 문 닫은 지 오래인데… 설마 밤마다 쇳소리 내는 게 당신들이에요?"),
                            Pick("story.ch13.s3.p", "하늘에서 떨어진 조각을 찾고 있어요.", "쇳소리요?"),
                            L("daon", "story.ch13.s3.l2", "사흘 전 밤에 번쩍하더니 기중기 꼭대기에 뭔가 박혔어요. 그 뒤로 이상한 짐승들이 조선소를 뒤져요."),
                            L("daon", "story.ch13.s3.l3", "저기 — 또 왔네요!"),
                        } },
                    new Step { Type = StepType.Kill, Yard = true, Arena = YardFight,
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost) },
                        TextKey = "story.ch13.s4", TextKo = "조선소를 뒤지는 시간 틈 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "daon", TextKey = "story.ch13.s5", TextKo = "다온과 이야기하기",
                        Lines = new[]
                        {
                            L("daon", "story.ch13.s5.l1", "와… 고마워요. 저 짐승들, 기중기 꼭대기만 올려다보더라고요."),
                            L("daon", "story.ch13.s5.l2", "사다리는 녹슬어 다 떨어졌어요. 다리를 타고 오를 수 있으면 모를까…"),
                            Pick("story.ch13.s5.p", "타고 올라가 볼게요.", "높네요…"),
                            L("daon", "story.ch13.s5.l3", "노란 다리 바깥쪽에 디딤이 남아 있어요. 기력 아껴서, 조심해요!"),
                        } },
                    new Step { Type = StepType.Climb, Yard = true, TextKey = "story.ch13.s6", TextKo = "녹슨 기중기 다리를 타고 들보 위로 올라 날개 조각 꺼내기",
                        EnterKey = "story.ch13.climbed", EnterKo = "기중기 들보 위 — 끼어 있던 날개 조각을 뽑았다" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch13.s7", TextKo = "날아온 반디에게 조각 보여 주기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch13.s7.l1", "삐— 날개 조각 하나 확인. 셋 가운데 하나입니다."),
                            L("daon", "story.ch13.s7.l2", "잠깐, 그 조각 끝이 휘었어요. 그대로 끼우면 별배 날개에서 떨어져 나갈걸요."),
                            L("daon", "story.ch13.s7.l3", "이 조선소 용접대, 아직 살아 있어요. 제가 이음매를 펴 붙일게요. 그동안만 막아 줘요."),
                            Pick("story.ch13.s7.p", "맡겨 줘요.", "용접 할 줄 알아요?"),
                            L("daon", "story.ch13.s7.l4", "여기서 배만 이십 년 붙였거든요. 불꽃 튀면 짐승들이 또 몰려올 거예요!"),
                        } },
                    new Step { Type = StepType.Defend, Yard = true, Arena = YardWeld, NameKey = "story.altar_weld", NameKo = "용접대", Dirs = new[] { 225f, 270f, 315f, 0f, 45f, 90f, 135f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.EmberImp) },
                        },
                        TextKey = "story.ch13.s8", TextKo = "다온이 조각을 붙이는 동안 용접대 지키기" },
                    new Step { Type = StepType.Talk, Npc = "daon", TextKey = "story.ch13.s9", TextKo = "다온과 이야기하기",
                        Lines = new[]
                        {
                            L("daon", "story.ch13.s9.l1", "다 됐어요! 이음매 반듯하게 폈어요. 십 년 만에 제대로 된 일 한 기분이네요."),
                            L("bandi", "story.ch13.s9.l2", "삐— 조각 상태 양호. 남은 둘은 더 먼 시대 신호입니다. 하나는 앞, 하나는 뒤."),
                            Pick("story.ch13.s9.p", "앞 시대와 뒤 시대…", "다온, 고마워요."),
                            L("daon", "story.ch13.s9.l3", "별배가 날면 꼭 보여 줘요. 배 붙이는 사람은 뜨는 걸 봐야 끝이거든요."),
                        } },
                }
            },
            // 109-14-35 14장(웹 ⑲-35) — 시간 틈 관측소: 반디 → 관측소 → 가온 → 시간 틈 무리 → 가온 → 틈 석등 별·해·달 → 가온 → 시간 기둥 타고 관측대로 → 관측대 파수 → 반디(관측대 위).
            // 회오리매·바위곰·눈여우·날쌘용은 14-1b(새 몸) 전까지 옛 몸에 그 원소.
            new Chapter
            {
                Id = "ch14", NameKey = "story.ch14", NameKo = "제14장 · 시간 틈 관측소", Ar = 34,
                Gold = 4000, Mats = new[] { 0, 4, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch14.s1", TextKo = "추락한 비행선의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch14.s1.l1", "삐— 둘째 조각 신호 수신. 시대 표지가 이상합니다. 지금보다 앞 — 아직 오지 않은 때."),
                            Pick("story.ch14.s1.p", "오지 않은 때라니?", "어디서 오는 신호야?"),
                            L("bandi", "story.ch14.s1.l2", "좌표는 마을 서북쪽 풀밭. 그런데 높이 값이 땅 위 이십사 미터입니다. 하늘에 뭔가 떠 있습니다."),
                            L("bandi", "story.ch14.s1.l3", "먼저 가 주십시오. 저는 동력을 모아 뒤따르겠습니다."),
                        } },
                    new Step { Type = StepType.Go, Gx = ObsGx, Gy = ObsGy, TextKey = "story.ch14.s2", TextKo = "마을 서북쪽 시간 틈 관측소로" },
                    new Step { Type = StepType.Talk, Npc = "gaon", TextKey = "story.ch14.s3", TextKo = "관측소 발치의 가온과 이야기하기",
                        Lines = new[]
                        {
                            L("gaon", "story.ch14.s3.l1", "여기까지 걸어 들어온 사람은 처음이네요. 이 관측소, 원래는 이 시대에 없어야 하는 건물이에요."),
                            Pick("story.ch14.s3.p", "저 위에 뜬 게 관측소예요?", "없어야 한다고요?"),
                            L("gaon", "story.ch14.s3.l2", "저 틈에서 흘러나왔어요. 저도 같이요. 틈 석등 셋이 받쳐 줄 땐 시간 기둥이 서서 오르내릴 수 있었는데…"),
                            L("gaon", "story.ch14.s3.l3", "며칠 전 하늘에서 빛나는 조각이 관측대에 박히더니 석등이 다 꺼졌어요. 그 뒤로 짐승들이 — 또 와요!"),
                        } },
                    new Step { Type = StepType.Kill, Gx = ObsGx, Gy = ObsGy,
                        Foes = new[] { F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith) },
                        EnterKey = "story.ch14.enter1", EnterKo = "틈에서 시간 틈 짐승들이 쏟아져 나왔다",
                        TextKey = "story.ch14.s4", TextKo = "관측소를 둘러싼 시간 틈 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "gaon", TextKey = "story.ch14.s5", TextKo = "가온과 이야기하기",
                        Lines = new[]
                        {
                            L("gaon", "story.ch14.s5.l1", "고마워요. 석등을 다시 켜면 시간 기둥이 설 거예요. 그런데 차례가 있어요."),
                            L("gaon", "story.ch14.s5.l2", "우리 시대 아이들이 부르는 노래가 있거든요 — \"별이 먼저 깨우고, 해가 밝히고, 달이 닫는다.\""),
                            Pick("story.ch14.s5.p", "별, 해, 달 차례군요.", "노래가 열쇠예요?"),
                            L("gaon", "story.ch14.s5.l3", "틀리면 다 꺼져요. 원소 힘을 석등에 대 주세요."),
                        } },
                    new Step { Type = StepType.Seal, Gx = ObsGx, Gy = ObsGy, Order = new[] { "star", "sun", "moon" }, TextKey = "story.ch14.s6", TextKo = "틈 석등을 노래 차례(별 → 해 → 달)로 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "gaon", TextKey = "story.ch14.s7", TextKo = "가온과 이야기하기",
                        Lines = new[]
                        {
                            L("gaon", "story.ch14.s7.l1", "섰어요! 관측소 남쪽에 빛기둥 보이죠? 저게 시간 기둥이에요."),
                            L("gaon", "story.ch14.s7.l2", "뛰어올라 몸을 맡기면 위로 솟아요. 꼭대기에서 날개를 펴고 관측대로 내려앉으면 돼요."),
                            Pick("story.ch14.s7.p", "다녀올게요.", "위에 뭐가 있어요?"),
                            L("gaon", "story.ch14.s7.l3", "조각 빛에 이끌린 파수들이 관측대를 차지했어요. 조심해요!"),
                        } },
                    new Step { Type = StepType.Sky, Obs = true, EnterKey = "story.ch14.landed", EnterKo = "🔭 관측대에 내려앉았다 — 틈새 파수가 지키고 있다",
                        TextKey = "story.ch14.s8", TextKo = "시간 기둥을 타고 떠 있는 관측대 위로(기둥 안에서 점프)" },
                    new Step { Type = StepType.Kill, Sky = true, Obs = true, Arena = new Vector2(0f, 2.7f),
                        Foes = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        EnterKey = "story.ch14.enter2", EnterKo = "관측대의 틈새 파수가 몸을 일으켰다",
                        TextKey = "story.ch14.s9", TextKo = "관측대를 차지한 틈새 파수 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch14.s10", TextKo = "관측대로 날아온 반디에게 조각 보여 주기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch14.s10.l1", "삐— 둘째 날개 조각 확인. 관측경 틀에 끼어 있었군요."),
                            L("gaon", "story.ch14.s10.l2", "(아래에서) 관측경에 남은 기록이 떴어요! 조각이 박히기 직전 — 꼬리 아홉 흰 짐승이 틈을 지나갔대요."),
                            Pick("story.ch14.s10.p", "그 구미호가…", "어느 쪽으로?"),
                            L("bandi", "story.ch14.s10.l3", "마지막 조각은 뒤 시대 신호. 옛 역참 길 쪽입니다. 구미호도 같은 곳을 향했을 확률이 높습니다."),
                            L("gaon", "story.ch14.s10.l4", "(아래에서) 시간 기둥은 켜 둘게요. 언제든 다시 올라와 하늘을 봐요!"),
                        } },
                }
            },
        };

        /// <summary>109-14-16 기본 물결 셋(웹 DEFEND_WAVES — 두꺼비 = 물귀신, 날쌘용 = 번개귀, 바위곰·눈여우 = 암·빙 물귀신, 14-1b 전까지).</summary>
        public static readonly GoDomain.Foe[][] DefendWaves =
        {
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost) },
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith) },
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
        };

        public static int NpcIndex(string id)
        {
            for (int i = 0; i < Npcs.Length; i++) if (Npcs[i].Id == id) return i;
            return -1;
        }

        public static Npc NpcOf(string id) => Npcs[Mathf.Max(0, NpcIndex(id))];
        public static string NpcName(string id)
        {
            var sp = SpotNow(id);
            if (sp.HasValue && sp.Value.NameKo != null) return GoLocalization.T(sp.Value.NameKey, sp.Value.NameKo);
            var n = NpcOf(id);
            return GoLocalization.T(n.NameKey, n.NameKo);
        }
        public static string NpcShort(string id) { var n = NpcOf(id); return GoLocalization.T(n.ShortKey, n.ShortKo); }
        /// <summary>109-14-21 시대 글자(세계 임무 인물만, 없으면 null).</summary>
        public static string NpcEra(string id) { var n = NpcOf(id); return n.EraKo != null ? GoLocalization.T(n.EraKey, n.EraKo) : null; }
        public static string NpcIdle(string id)
        {
            var sp = SpotNow(id);
            if (sp.HasValue && sp.Value.IdleKo != null) return GoLocalization.T(sp.Value.IdleKey, sp.Value.IdleKo);
            var n = NpcOf(id);
            return GoLocalization.T(n.IdleKey, n.IdleKo);
        }

        /// <summary>109-14-20 지금 진행에서 그 인물이 선 칸(없으면 null) — 이름·혼잣말·가면을 덮는다.</summary>
        public static Spot? SpotNow(string id) => SpotAt(id, StoryState.Ch, StoryState.StepIndex);
        public static Spot? SpotAt(string id, int ch, int step)
        {
            var n = NpcOf(id);
            foreach (var list in new[] { n.Appear, n.At })
                if (list != null)
                    foreach (var a in list)
                        if (SpotOn(a, ch, step)) return a;
            return null;
        }
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
            foreach (var list in new[] { n.Appear, n.At })
                if (list != null)
                    foreach (var a in list)
                        if (SpotOn(a, ch, step)) return SpotPos(n, a, ch, step, followDist);
            return GridPos(n.Gx, n.Gy);
        }

        /// <summary>그 칸에 서 있나(`Appear` 가 없으면 늘).</summary>
        public static bool Shown(string id, int ch, int step)
        {
            var n = NpcOf(id);
            if (n.Appear == null) return true;
            foreach (var a in n.Appear) if (SpotOn(a, ch, step)) return true;
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
            for (int i = 1; i < n.Path.Length; i++) len += Vector2.Distance(n.Path[i - 1], n.Path[i]) * (n.FrostPath ? 1f : TestMapData.TileSize);
            return len;
        }

        /// <summary>길 위 거리 d(m) 의 자리 — 길 끝을 넘으면 끝.</summary>
        public static Vector3 PathPos(Npc n, float d)
        {
            for (int i = 1; i < n.Path.Length; i++)
            {
                float seg = Vector2.Distance(n.Path[i - 1], n.Path[i]) * (n.FrostPath ? 1f : TestMapData.TileSize);
                if (d <= seg)
                {
                    Vector2 g = Vector2.Lerp(n.Path[i - 1], n.Path[i], seg > 0f ? d / seg : 1f);
                    return n.FrostPath ? FrostPos(g) : GridPos(g.x, g.y);
                }
                d -= seg;
            }
            var e = n.Path[n.Path.Length - 1];
            return n.FrostPath ? FrostPos(e) : GridPos(e.x, e.y);
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

        /// <summary>109-14-28 — 목표가 서리봉 고원 안인데 내가 고원 밖이면 화살표는 서리 고개 돌기둥(마을 쪽)을 가리킨다(`from` 이 영벡터면 실제 목표).</summary>
        public static Vector3 TargetOf(Step s, Vector3 from, out float radius)
        {
            Vector3 t = TargetRaw(s, from, out radius);
            if (from != Vector3.zero && GoFrost.Contains(t) && !GoFrost.Contains(from)) return GoFrost.GatePos;
            return t;
        }

        private static Vector3 TargetRaw(Step s, Vector3 from, out float radius)
        {
            radius = 0f;
            switch (s.Type)
            {
                case StepType.Talk:
                case StepType.Sail: radius = TalkR; return NpcPos(s.Npc);
                case StepType.Chase: return StoryState.ChasePos ?? NpcPos(s.Npc); // 109-14-19 달리는 도둑
                case StepType.Follow: return NpcPos(s.Npc);
                case StepType.Go: radius = GoR; return s.Altar ? WeeklyAltarPos() : s.Frost || s.Yard ? StepPos(s) : GridPos(s.Gx, s.Gy);
                case StepType.Boss: return TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                case StepType.Domain: return SitePos(s.Site);
                case StepType.Light: radius = LightR; return StepPos(s);
                case StepType.Seal: return SealPos(s);
                case StepType.Climb: return s.Yard ? CraneTop : DuelPeak.Top;
                case StepType.Sky: radius = DraftR; return s.Obs ? ObsPillarPos : DuelPeak.Top; // 109-14-20 바람 기둥 = 봉우리 정상 · 109-14-35 시간 기둥
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
                default: return StepPos(s);
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
