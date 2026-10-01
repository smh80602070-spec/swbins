using UnityEngine;
using Saga.Core;
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
        public enum StepType { Talk, Go, Boss, Kill, Light, Domain, Gather, Cook, Follow, Seal, Climb, Duel, Defend, Chase, Sail, Sky, Party }

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
        public static Vector3 SailDest(Step s) => s.Eye ? EyePos(s.Arena ?? Vector2.zero) : s.Route != null ? RoutePos(RouteIndex(s.Route), s.Arena ?? Vector2.zero) : s.Sky && s.Rift ? RiftPos(s.Arena ?? Vector2.zero) : s.At != null ? AreaPos(s.At, s.Arena ?? Vector2.zero) : s.ToIsle ? IslePos(IsleLand) : GridPos(DockGx, DockGy);
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
        public static Vector3 RunPoint(string id, int i) { var n = NpcOf(id); var p = n.RunPath; return n.RunRoute != null ? RoutePos(RouteIndex(n.RunRoute), p[i]) : n.RunAt != null ? AreaPos(n.RunAt, p[i]) : GridPos(p[i].x, p[i].y); }
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
        public static bool OnSkyTop(Vector3 p) => (Flat(p, SkyCenter) <= SkyR - 1.5f && Mathf.Abs(p.y - SkyCenter.y) < 3f) || OnDeckTop(p) || OnRiftTop(p) || OnRouteTop(p) || OnEyeTop(p);
        /// <summary>섬 층인가(윗면 8m 아래까지·난간 3m 밖까지) — 층이 다르면 들판 전투가 서로 못 본다(웹 `apart`).</summary>
        public static bool OnSkyLayer(Vector3 p) => (Flat(p, SkyCenter) <= SkyR + 3f && p.y > SkyCenter.y - 8f) || (Flat(p, DeckCenter) <= DeckR + 3f && p.y > DeckCenter.y - 8f) || (Flat(p, RiftCenter) <= RiftR + 3f && p.y > RiftCenter.y - 8f) || OnRouteLayer(p) || (Flat(p, EyeCenter) <= EyeR + 3f && p.y > EyeCenter.y - 8f);
        public static bool SameLayer(Vector3 a, Vector3 b) => OnSkyLayer(a) == OnSkyLayer(b);
        public static float DraftTop => SkyCenter.y + DraftOver;
        /// <summary>구름섬·기둥이 열렸나 — 9장이 열린 뒤 늘(그 전엔 먹구름 덮개).</summary>
        public static bool SkyOpen => StoryState.Ch > 8 || (StoryState.Ch == 8 && !StoryState.Locked);

        public static float DefendHpMax(Vector3 altar) => Mathf.Round(DefendHits * DefendRefAtk * GoWorldMap.DangerMul(GoWorldMap.DangerOf(GoWorldMap.RegionAt(altar))));

        /// <summary>물결 n 의 i 째 적이 나오는 자리(웹: 둘레 자리 중 4n 째부터).</summary>
        public static Vector3 DefendSlot(Vector3 altar, float[] dirs, int wave, int i, float ring = 0f)
        {
            float a = dirs[(wave * 4 + i) % dirs.Length] * Mathf.Deg2Rad;
            return altar + new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a)) * (ring > 0f ? ring : DefendRing);
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
            /// <summary>109-14-36 말 몸(도형) — 놀란 역마.</summary>
            public bool Horse;
            /// <summary>109-14-38 독립 땅 명소 곁에 늘 서는 인물 — 명소 열쇠 + 그 가운데에서 m(Gx·Gy 대신).</summary>
            public string AtSite;
            public Vector2 AtOff;
            public Vector2[] RunPath;
            /// <summary>109-14-40 달리는 길이 독립 땅 명소 곁이면 그 명소 열쇠 — RunPath 는 그 가운데에서 m.</summary>
            public string RunAt;
            /// <summary>109-14-50 달리는 길이 하늘 섬 위면 그 섬 id — RunPath 는 그 섬 윗면 가운데에서 m.</summary>
            public string RunRoute;
            /// <summary>있으면 이 칸들 동안에만 선다(나그네). 칸마다 자리가 다를 수 있다.</summary>
            public Spot[] Appear;
            /// <summary>늘 서되 이 칸들 동안엔 그 자리로 옮겨 선다(은비 — 5장 옛길·둘째 제단, 6장 봉우리).</summary>
            public Spot[] At;
            /// <summary>follow 단계에서 걷는 길(칸 좌표, 첫 점 = 걷기 전 자리 — `FrostPath` 면 고원 가운데에서 m).</summary>
            public Vector2[] Path;
            public bool FrostPath;
            /// <summary>109-14-66 follow 길이 독립 땅 명소 곁이면 그 명소 열쇠("지역:명소") — `Path` 는 그 가운데에서 m(첫 점 = 걷기 전 자리).</summary>
            public string PathAt;
        }

        /// <summary>인물이 서는 칸 — 장(0부터)·단계 From~To 동안 Gx·Gy(또는 길 위·고원 위).</summary>
        public struct Spot
        {
            public int Ch, From, To;
            /// <summary>109-14-62 웹 `chTo` — 0 이면 `Ch` 장 하나만, 아니면 `Ch`~`ChTo` 장(`Ch` 장은 From~To 단계, 그 뒤 장은 늘).</summary>
            public int ChTo;
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
            /// <summary>109-14-43 갈림길 끝 섬 위(`Sky` 와 함께) — Arena 는 섬 가운데에서 m.</summary>
            public bool Rift;
            /// <summary>109-14-38 독립 땅 명소 곁("지역:명소") — Arena 는 그 명소 가운데에서 m.</summary>
            public string At;
            /// <summary>109-14-36 옛 역참 터 위 — Arena 는 역참 가운데에서 m.</summary>
            public bool Stn;
            /// <summary>109-14-35 관측대 위(`Sky` 와 함께) — Arena 는 관측대 가운데에서 m.</summary>
            public bool Obs;
            /// <summary>109-14-49 하늘 섬 위("shrine"·"wreck"·"orbit") — Arena 는 그 섬 윗면 가운데에서 m.</summary>
            public string Route;
            /// <summary>109-14-55 먹구름 눈 위 — Arena 는 눈 윗면 가운데에서 m.</summary>
            public bool Eye;
        }

        /// <summary>그 칸이 지금 서 있는 칸인가 — 세계 임무 칸이면 그 임무 단계, 아니면 이야기 장·단계.</summary>
        private static bool SpotOn(Spot a, int ch, int step)
        {
            if (a.Wq != null)
            {
                int q = GoWorldQuests.IndexOf(a.Wq);
                return q >= 0 && WorldQuestState.Taken(q) && WorldQuestState.Step(q) >= a.From && WorldQuestState.Step(q) <= a.To;
            }
            if (a.ChTo > a.Ch) return ch > a.Ch ? ch <= a.ChTo : ch == a.Ch && step >= a.From && step <= a.To;
            return a.Ch == ch && step >= a.From && step <= a.To;
        }

        /// <summary>109-14-28 서리봉 고원 위 자리 — 고원 가운데에서 (x, z) m(눈 바닥 높이 0).</summary>
        public static Vector3 FrostPos(Vector2 off) => GoFrost.Center + new Vector3(off.x, 0.05f, off.y);
        /// <summary>고원 명소 site 곁 — 명소 자리 + 덧셈.</summary>
        public static Vector2 FrostAt(string siteId, float dx, float dz) { GoFrost.TrySite(siteId, out var s); return s.Off + new Vector2(dx, dz); }

        private static Vector3 SpotPos(Npc n, Spot a, int ch, int step, float followDist) =>
            a.Eye ? EyePos(a.Arena) : a.Route != null ? RoutePos(RouteIndex(a.Route), a.Arena) : a.Sky && a.Rift ? RiftPos(a.Arena) : a.At != null ? AreaPos(a.At, a.Arena) : a.Stn ? StationPos(a.Arena) : a.Yard ? YardPos(a.Arena) : a.Sky && a.Obs ? DeckPos(a.Arena) : a.Frost ? FrostPos(a.Arena) : a.Sky ? SkyPos(a.Arena) : a.Summit ? DuelPeak.Top + new Vector3(a.Arena.x, 0f, a.Arena.y) : a.Isle ? IslePos(a.Arena) : a.Peak ? ArenaPos(a.Arena) : a.Path ? PathPos(n, step == FollowStepOf(n.Id, ch) ? followDist : float.MaxValue) : GridPos(a.Gx, a.Gy);

        // ---- 109-14-28 10장 서리봉 고원 자리(고원 가운데에서 m — 웹 명소 자리 × 0.45 위에 얹는다) ----
        public static readonly Vector2 HaramObs = FrostAt("obs", 0f, 9f), HaramShip = FrostAt("ship", -7f, 13f), BandiShip = FrostAt("ship", 1f, 12f), HaramFort = FrostAt("fort", 0f, 16f);
        /// <summary>109-14-70 12부(웹 ⑲-70 × 0.45) — 39장 결정 짐승 = 별배 북쪽 6.3m · 40장 나침 제단 = 별배 남쪽 10.8m(가기 반지름 6.3) · 41장 고을 마당 가기 = 길목 남쪽 9.9m · 소담 = 곳간 문 앞 → 고을 길목 동남쪽 → 촌장 곁.</summary>
        public static readonly Vector2 ShipKill = FrostAt("ship", 0f, -6.3f), ShipAltar = FrostAt("ship", 0f, 10.8f), YardSproutGo = new Vector2(0f, 9.9f), SodamGranary40 = new Vector2(-5.4f, 2.25f), SodamJunction = new Vector2(6.3f, 6.3f);
        // 11장(⑲-29) — 산성 문루 앞(문 남쪽 22m)·호숫가 석등 자리(호수 북쪽 물가 밖)·바우가 호숫가에서 기다리는 자리·봉화 제단(문 앞 32m)
        public static readonly Vector2 BawooGate = FrostAt("fort", 3f, 22f), LakeSeal = FrostAt("lake", 0f, -36f), BawooLake = FrostAt("lake", 16f, -34f), BeaconAltar = FrostAt("fort", 0f, 32f);
        // 12장(⑲-30) — 서리 무리·구미호는 얼음굴 어귀 남쪽 14m · 반디는 구미호 뒤 굴 앞 · 심장 받침은 비행선 곁(선체 밖)
        // 18장(⑲-40) 변전함 자리(태양광 밭 가운데에서 m) — 은하 나루 모양이 쓴다.
        public static readonly Vector2 SubstationOff = new Vector2(10.5f, 0f);

        // 21~23장(⑲-45~47) — 잠긴 도읍 상수: 물은 무릎 높이 투명 판(잠수 없음), 테왁 여덟이 궁궐 둘레 9m, 빛 돔 반지름 11m·열두 조각 벽(북쪽 한 조각이 문), 등대 15m 돌탑.
        public const float SeaLevel = 0.35f, SeaLightR = 9f, DomeR = 11f, LightHeight = 15f, LightHalf = 1.4f;
        public const int SeaLights = 8, DomeSegs = 12;
        public static readonly Vector2 AnnexOff = new Vector2(9.5f, 0f), Term = new Vector2(4f, 4f);
        /// <summary>궁궐 둘레 테왁 불(20장을 마친 뒤 늘) · 빛 돔 문(22장 8째 단계부터 늘 열림) · 등대 불(23장 4째 단계부터 늘).</summary>
        public static bool SeaLightsOn => StoryState.Ch > 19;
        public static bool DomeOpen => StoryState.Ch > 21 || (StoryState.Ch == 21 && StoryState.StepIndex >= 7);
        public static bool LighthouseLit => StoryState.Ch > 22 || (StoryState.Ch == 22 && StoryState.StepIndex >= 3);

        // 20장(⑲-43) — 갈림길 끝: 첫 정거장 동남쪽 (31.5, 11.25)m 위 40m 에 뜬 반지름 24m 돌 섬(웹 (70,25)m·46m·20m 을 이 판 크기로). 세 갈래 선로(옛 나무 60°·쇠 300°·빛 180°)가 가운데에서 뻗고 끝마다 닻,
        // 가운데 세로 틈은 `TearState` 0(찢어짐) → 1(석등 뒤 오므라듦·닻 켜짐) → 2(장 끝·닫힘 → 별빛). 바람 기둥 = 섬 남쪽 30m 땅에서 섬 + 12m 까지(20장이 끝난 뒤 늘).
        public const float RiftUp = 40f, RiftR = 24f;
        public static readonly Vector2 RiftOff = new Vector2(31.5f, 11.25f), RiftPillarOff = new Vector2(0f, 30f);
        public static readonly Vector2 RiftArrive = new Vector2(-12.1f, -7f), RiftHanbyeol = new Vector2(-4f, 5f), RiftBandi = new Vector2(5f, 4f), RiftDodam = new Vector2(-9f, -2f);
        public static Vector3 RiftCenter { get { GoAreas.TrySite("crossing:platform", out var s); return s.Pos + new Vector3(RiftOff.x, RiftUp, RiftOff.y); } }
        public static Vector3 RiftPos(Vector2 off) => RiftCenter + new Vector3(off.x, 0.05f, off.y);
        public static bool OnRiftTop(Vector3 p) => Flat(p, RiftCenter) <= RiftR - 1.5f && Mathf.Abs(p.y - RiftCenter.y) < 3f;
        public static Vector3 RiftPillarPos { get { var c = RiftCenter; return new Vector3(c.x + RiftPillarOff.x, 0f, c.z + RiftPillarOff.y); } }
        public static float RiftDraftTop => RiftCenter.y + DraftOver;
        public static bool RiftPillarOpen => StoryState.Ch > 19;
        public static int TearState => StoryState.Ch > 19 ? 2 : (StoryState.Ch == 19 && StoryState.StepIndex >= 6 ? 1 : 0);

        // 19장(⑲-42) — 틈새 갈림길 시계탑(16m 옆면 타기 — 기둥과 같은 폭의 곧은 벽)·섬돌(열다섯이 나선으로 1.1m 씩 — 걸어 오르는 턱 안이라 걸어서 오른다).
        public const float ClockHeight = 16f, ClockHalf = 1.5f, StepRise = 1.1f, StepR = 3.2f;
        public const int StepN = 15;

        // 27~29장(⑲-52) 8부 무대 — 새 고정 지역 없이 첫 지역들로 돌아온다. 여섯 매듭 = 1부 여섯 제단 자리 북쪽 `KnotNorth`m 의 금줄 감은 돌(보기만) · 먹구름 눈 = 구름섬 서쪽 `EyeWest`m·윗면 +`EyeRise`m 위 판.
        // 매듭은 26장을 마친 뒤부터 보이고(풀린 = 먹구름 연기), `KnotCh`/`KnotStep` 부터 묶인다(불 + 금빛 줄) — 27·28장을 짤 때 이 단계 번호에 맞춘다. 여섯이 다 묶이면 줄이 눈 가운데 등불로 기울고, 29장 6째 단계(보스 뒤)부터 거둔다.
        public const float KnotNorth = 3f, KnotBeamUp = 90f, EyeWest = 42f, EyeRise = 24f, EyeR = 18f, EyeSlab = 4f, EyeLantern = 3.6f;
        public static readonly int[] KnotCh = { 26, 26, 26, 27, 27, 27 }, KnotStep = { 4, 5, 8, 3, 5, 8 };
        /// <summary>진단 전용 — 27~29장이 이식되기 전에 장·단계를 가정한다(웹 `stormeye` 손잡이 대신). 없으면 지금 이야기 진행.</summary>
        public static int? TestCh; public static int TestStep;
        private static bool Reached(int ch, int step) { int c = TestCh ?? StoryState.Ch, s = TestCh.HasValue ? TestStep : StoryState.StepIndex; return c > ch || (c == ch && s >= step); }
        public static bool KnotsShown => Reached(26, 0);
        public static bool KnotTied(int k) => Reached(KnotCh[k], KnotStep[k]);
        public static bool AllKnotsTied { get { for (int k = 0; k < 6; k++) if (!KnotTied(k)) return false; return true; } }
        public static bool EyeShown => Reached(27, 9);
        public static bool EyeClear => Reached(28, 6);
        public static bool EyePillarOpen => Reached(28, 0);
        /// <summary>매듭 k 금빛 줄 — 0 없음 · 1 곧게 위로 · 2 눈 가운데 등불로(여섯 다 묶인 뒤 29장 보스 전까지).</summary>
        public static int KnotBeam(int k) => !KnotTied(k) || EyeClear ? 0 : (AllKnotsTied ? 2 : 1);
        /// <summary>매듭 돌 k 밑자리(땅) — 1장 옛 제단 · 5장 둘째 제단 · 6장 봉우리 제단 · 7장 곶 · 8장 바위섬 · 9장 구름섬, 각각 북쪽 `KnotNorth`m.</summary>
        public static Vector3 KnotBase(int k)
        {
            Vector3 b;
            switch (k)
            {
                case 0: b = GridPos(AltarGx, AltarGy); break;
                case 1: b = GridPos(Altar2Gx, Altar2Gy); break;
                case 2: b = ArenaPos(ArenaAltar); break;
                case 3: b = GridPos(CapeGx, CapeGy - 22f / 48f); break;
                case 4: b = IslePos(Vector2.zero); break;
                default: b = SkyCenter; break;
            }
            return b + new Vector3(0f, 0f, -KnotNorth);
        }
        /// <summary>29장 자리(눈 윗면 가운데에서 m, z 남쪽): 임금은 눈 북쪽, 해솔은 북동쪽, 참몸 자리는 남쪽 9m(가운데 등불·소용돌이 밖).</summary>
        public static readonly Vector2 EyeKing = new Vector2(0f, -9f), EyeHaesol = new Vector2(7f, -6f), EyeDuel = new Vector2(0f, 9f);
        /// <summary>과거·현대·미래 이야기 동료 시대(웹 `MEMBER_TIME`) — 없으면 null.</summary>
        public static GoEra? MemberEra(string id)
        {
            switch (id)
            {
                case "story_wanderer": case "story_elder": case "story_ferryman": case "story_dareum": case "story_mulsae": case "story_byeori": case "story_sodam": return GoEra.Past;
                case "story_scholar": case "story_haesol": case "story_haram": case "story_dodam": case "story_haneul": case "story_chorong": case "story_narae": return GoEra.Modern;
                case "story_hanbyeol": case "story_haemi": return GoEra.Future;
                default: return null;
            }
        }
        /// <summary>들판 명단(주인공 곁 동행 셋)에 든 이야기 동료의 시대들.</summary>
        public static bool PartyHasEra(GoEra e) { foreach (var id in PartyState.FieldIds()) if (MemberEra(id) == e) return true; return false; }
        public static bool PartyOk => PartyHasEra(GoEra.Past) && PartyHasEra(GoEra.Modern) && PartyHasEra(GoEra.Future);
        public static Vector3 EyeCenter => SkyCenter + new Vector3(-EyeWest, EyeRise, 0f);
        public static Vector3 EyePos(Vector2 off) => EyeCenter + new Vector3(off.x, 0.05f, off.y);
        public static bool OnEyeTop(Vector3 p) => Flat(p, EyeCenter) <= EyeR - 1.5f && Mathf.Abs(p.y - EyeCenter.y) < 3f;
        /// <summary>눈으로 가는 바람 기둥 — 구름섬 서쪽 가장자리 안, 끝 = 눈 윗면 + `DraftOver`(29장부터).</summary>
        public static Vector3 EyePillarPos => new Vector3(SkyCenter.x - SkyR + DraftR, SkyCenter.y, SkyCenter.z);
        public static float EyePillarTop => EyeCenter.y + DraftOver;

        // 24~26장(⑲-48) 구름 위 항로 — 옛 등대 서쪽 하늘 섬 셋(표 `GoAreas.Route*`). 23장 등롱 불(`LighthouseLit`) 뒤에만 서고 밟힌다.
        // 바람 기둥 셋 — 등대 서쪽 7m 땅 → 사당 · 사당 서쪽 가장자리 안 → 잔해 · 잔해 서쪽 가장자리 안 → 정거장. 끝 = 다음 섬 윗면 + `DraftOver`. 등대·사당 기둥은 24장 뒤, 잔해 기둥은 25장 뒤.
        public static Vector3 RouteCenter(int i) { var o = GoAreas.RouteOff(i); return GoAreas.Sunken.Center + new Vector3(o.x, GoAreas.RouteUp[i], o.y); }
        public static Vector3 RoutePos(int i, Vector2 off) => RouteCenter(i) + new Vector3(off.x, 0.05f, off.y);
        public static bool OnRouteTop(int i, Vector3 p) => Flat(p, RouteCenter(i)) <= GoAreas.RouteR[i] - 1.5f && Mathf.Abs(p.y - RouteCenter(i).y) < 3f;
        public static bool OnRouteTop(Vector3 p) { for (int i = 0; i < 3; i++) if (OnRouteTop(i, p)) return true; return false; }
        public static bool OnRouteLayer(Vector3 p) { for (int i = 0; i < 3; i++) if (Flat(p, RouteCenter(i)) <= GoAreas.RouteR[i] + 3f && p.y > RouteCenter(i).y - 8f) return true; return false; }
        public static bool RouteOn => LighthouseLit;
        public static int RouteIndex(string id) => System.Array.IndexOf(GoAreas.RouteIds, id);
        /// <summary>24장 자리(사당 섬 윗면 가운데에서 m, z 남쪽): 별배는 사당 남쪽 10m 에 내린다, 무녀는 사당 앞 서쪽(가운데 8m 석등 자리를 비켜), 한별·반디는 내린 자리 곁.</summary>
        public static readonly Vector2 ShrineLand = new Vector2(0f, 10f), ShrineSaebyeok = new Vector2(-4.5f, -7.5f), ShrineHanbyeol = new Vector2(3.5f, 11f), ShrineBandi = new Vector2(-3f, 11.5f);
        /// <summary>25장 자리(잔해 섬 윗면 가운데에서 m, z 남쪽): 하늬는 조종실 동쪽 앞, 기관은 조종실 앞 남동(찢어진 기낭 밖), 반디는 하늬 곁. 드론은 섬 둘레를 돈다(웹 SEED_DRONE_PATH, 첫 점 = 프로펠러 곁).</summary>
        public static readonly Vector2 WreckHaneul = new Vector2(11f, -1f), WreckEngine = new Vector2(8f, 3f), WreckBandi = new Vector2(12f, 2.5f);
        public static readonly Vector2[] SeedPath = { new Vector2(8f, -9f), new Vector2(-2f, -14f), new Vector2(-13f, -5f), new Vector2(-14f, 10f), new Vector2(0f, 16f), new Vector2(13f, 9f) };
        /// <summary>26장 자리(정거장 섬 윗면 가운데에서 m, z 남쪽): 구름 씨앗 장치 셋은 가운데에서 9m(남동·북·남서), 가면 그림자는 서쪽 끝, 보스 자리는 남쪽, 하늬·반디는 동쪽(태양 날개 밖).</summary>
        public static readonly Vector2 SeedSE = new Vector2(7.8f, 4.5f), SeedN = new Vector2(0f, -9f), SeedSW = new Vector2(-7.8f, 4.5f), OrbitGamyeon = new Vector2(-12f, 0f), OrbitDuel = new Vector2(0f, 7f), OrbitHaneul = new Vector2(10f, -3f), OrbitBandi = new Vector2(11f, 1f);
        /// <summary>구름 씨앗 장치 k(0 남동·1 북·2 남서)가 꺼졌나 — 26장에서 그 장치를 끈 다음 단계부터(장을 마친 뒤에도).</summary>
        public static bool SeederOff(int k) => StoryState.Ch > 25 || (StoryState.Ch == 25 && StoryState.StepIndex >= 4 + k);
        /// <summary>비행선 기관이 살았나 — 25장 7째 단계(기관을 지켜 낸 뒤)부터 늘. 그 전엔 프로펠러가 멎어 있다.</summary>
        public static bool WreckLive => StoryState.Ch > 24 || (StoryState.Ch == 24 && StoryState.StepIndex >= 6);
        /// <summary>사당 위 먹구름이 걷혔나 — 24장 7째 단계(방울을 다 울린 뒤)부터 늘.</summary>
        public static bool ShrineClear => StoryState.Ch > 23 || (StoryState.Ch == 23 && StoryState.StepIndex >= 6);
        /// <summary>바람 기둥 i(0 등대→사당 · 1 사당→잔해 · 2 잔해→정거장) 밑자리·솟는 높이·열림.</summary>
        public static Vector3 RoutePillarPos(int i)
        {
            if (i == 0) return GoAreas.Sunken.Center + new Vector3(GoAreas.RouteLightX - GoAreas.RouteLightDraft, 0f, GoAreas.RouteLightZ);
            var c = RouteCenter(i - 1);
            return new Vector3(c.x - GoAreas.RouteR[i - 1] + DraftR, c.y, c.z);
        }
        public static float RoutePillarTop(int i) => RouteCenter(i).y + DraftOver;
        /// <summary>진단 전용 — 24·25장이 이식되기 전에 기둥이 서는 모습을 잰다(웹 `skyroute.drafts` 손잡이).</summary>
        public static bool RouteDraftsForTest;
        public static bool RoutePillarOpen(int i) => RouteDraftsForTest || (i < 2 ? StoryState.Ch > 23 : StoryState.Ch > 24);

        // 21장(⑲-45) — 잠긴 도읍 자리(각 명소 가운데에서 m, z 남쪽): 별배는 해무 어귀 안쪽(가운데 쪽 = 북쪽)에 내린다, 잠수정 선착장 = 기지 잔교 머리, 기단 = 궁궐 앞마당. 한별은 은하 나루 착륙판 곁(웹 hb_port).
        public static readonly Vector2 SunkPortHanbyeol = new Vector2(-9f, 5f), SandArrive = new Vector2(6f, -20f), SandHanbyeol = new Vector2(2f, -14f), SandBandi = new Vector2(10f, -16f),
            LabFront = new Vector2(0f, -14f), LabDock = new Vector2(1f, 6f), LabYeoul = new Vector2(-8f, 4f), PlinthArrive = new Vector2(0f, 3.5f), PlinthYeoul = new Vector2(2.5f, 3.2f), PlinthBandi = new Vector2(-3f, 3.2f);

        // 22장(⑲-46) — 빛 돔 둘레 자리(돔 가운데에서 m, z 남쪽): 문 앞 = 북쪽 19m(석등 셋이 그 둘레), 돔 안 마른 바닥. 곁채 앞 물새 = 궁궐 곁채(동쪽 9.5m) 앞.
        public static readonly Vector2 AnnexMulsae = new Vector2(9.5f, 3.2f), DomeFront = new Vector2(0f, -19f), FrontMulsae = new Vector2(-8f, -20f), FrontYeoul = new Vector2(8f, -20f), FrontBandi = new Vector2(0f, -28f),
            DomeDuel = new Vector2(-5f, 0f), InMulsae = new Vector2(3f, 3f), InYeoul = new Vector2(4f, -2f), InBandi = new Vector2(0f, 5f);

        // 23장(⑲-47) — 등대 발치(등대 가운데에서 m, 남쪽 5.5) · 기록실 앞(돔 가운데에서 m) — 파랑은 단말 남쪽.
        public static readonly Vector2 LightBandi = new Vector2(0f, 5.5f), ParangAt = new Vector2(4f, 6.5f);

        // 19장(⑲-42) — 틈새 갈림길 자리(각 명소 가운데에서 m): 막차는 승강장 동쪽에 내린다, 갈림목 = 시계탑 북서쪽, 한별은 섬돌 가운데 밑(틈 수정 아래).
        public static readonly Vector2 CrossArrive = new Vector2(6.5f, 0f), CrossBandi = new Vector2(7f, 4f), CrossHanbyeol = new Vector2(6.5f, 7f), CrossFork = new Vector2(-18f, -14f), CrossClockBandi = new Vector2(4f, 4f),
            CrossStepsBandi = new Vector2(6f, 5f), CrossDuel = new Vector2(10f, -8f), CrossStepsHanbyeol = new Vector2(7f, -3f);
        /// <summary>오르기 단계(`At`)의 꼭대기 — 계류 탑·시계탑은 그 명소 가운데 위, 섬돌은 마지막 돌 위.</summary>
        public static Vector3 ClimbTopOf(string at)
        {
            if (at == "crossing:steps")
            {
                float a = (StepN - 1) * Mathf.PI * 0.25f;
                return AreaPos(at, new Vector2(Mathf.Cos(a) * StepR, Mathf.Sin(a) * StepR)) + Vector3.up * (StepN * StepRise - 0.1f);
            }
            return AreaPos(at, Vector2.zero) + Vector3.up * (at == "crossing:clock" ? ClockHeight : at == "sunken:lighthouse" ? LightHeight : at == "amber:tower" ? AmberTowerHeight : at == "vault:vault" ? VaultPillarH : at == "fork:tower" ? ForkTowerH : TowerHeight);
        }
        public static bool OnClimbTop(string at, Vector3 p)
        {
            Vector3 top = ClimbTopOf(at);
            float r = at == "crossing:steps" ? 1.6f : (at == "crossing:clock" ? ClockHalf : at == "sunken:lighthouse" ? LightHalf : at == "amber:tower" ? AmberTowerHalf : at == "vault:vault" ? VaultPillarW * 0.5f : at == "fork:tower" ? ForkTowerW * 0.5f : TowerHalf) + 0.6f;
            return Flat(p, top) <= r && p.y >= top.y - 1.2f;
        }
        // 30~32장(⑲-57) — 굳은 거리(여덟째 지역) 상수·이야기 상태: 부양탑 심 6×6m·12m, 장터 결정 돔 반지름 4.6m(31장 석등 고리 6m 가 바깥), 시계방 5×4.2×5m, 신호등 넷(±9), 굳은 자리 셋(네거리 가운데에서 m).
        // 상태는 순수 함수(장, 단계) — 30장(이식 전)까지 아직 없어 진단이 장·단계를 직접 넣어 잰다. 장은 0부터(30장 = 29).
        public const float AmberTowerHalf = 3f, AmberTowerHeight = 12f, AmberDomeR = 4.6f, AmberPassHalf = 9f;
        public static readonly Vector2[] AmberCrystalAt = { new Vector2(11f, -9f), new Vector2(-14f, 7f), new Vector2(6f, 15f) };
        public static readonly Vector2[] AmberLights = { new Vector2(9f, 9f), new Vector2(-9f, 9f), new Vector2(9f, -9f), new Vector2(-9f, -9f) };
        public static readonly int[] AmberCrystalFrom = { 5, 6, 7 };
        /// <summary>30장(⑲-58) 자리(각 명소 가운데에서 m, z 남쪽): 고개 어귀 go = 고개 북쪽 40m(돌기둥에서 내린 자리에서 20m 넘게 걸어야 닿는다) · 네거리 무리 = 가운데 남쪽 8m · 초롱 = 시계방 서남쪽 앞 · 반디 = 시계방 남서쪽.</summary>
        public static readonly Vector2 AmberPassGo = new Vector2(0f, -40f), AmberCrossKill = new Vector2(0f, 8f), ChorongAt = new Vector2(-3f, 6f), ChorongBandi = new Vector2(-8f, 8f);
        /// <summary>31장(⑲-59) 자리: 너울 = 장터 가운데 굳어 있던 자리(돔이 깨진 뒤) · 초롱 = 장터 동쪽 앞(석등 고리 밖) · 괘종시계 지키기 제단 = 시계방 서쪽 · 조각 도둑 길 = 네거리 둘레 열한 점(웹 열한 점을 이 땅 크기로 — 시계방·신상·장터·탑·굳은 자리에서 9m 넘게 떨어짐).</summary>
        public static readonly Vector2 NeoulAt = new Vector2(0f, 3.8f), ChorongMarket = new Vector2(9f, 0f), ClockDefend = new Vector2(-8f, 2f);
        /// <summary>32장(⑲-60) 자리(탑 가운데에서 m, z 남쪽): 새길 = 탑 발치 남쪽 · 거북·초롱(거북 뒤) = 탑 밑 광장(웹 [16,8]·[8,10]).</summary>
        public static readonly Vector2 SaegilAt = new Vector2(0f, 6f), AmberTurtleAt = new Vector2(16f, 8f), ChorongTower = new Vector2(8f, 10f);
        /// <summary>33장(⑲-62) 자리(각 명소 가운데에서 m, z 남쪽): 고개 어귀 go = 어귀 동쪽 26m(돌기둥에서 내린 자리에서 20m 넘게 걸어야 닿는다) · 야적장 무리 = 창고 서북쪽 · 마루 = 창고 남쪽 앞 · 반디 = 창고 서남쪽 · 반디(고원) = 하람 곁.
        /// 운반 드론 길 = 웹 열한 점 × 0.45(야적장 → 컨테이너 사이 → 창고 서쪽 → 동력 기둥 사이 → 금고 문 앞), 창고 모서리·금고 문에 걸리는 둘만 밖으로 옮김.</summary>
        public static readonly Vector2 VaultPassGo = new Vector2(26f, 0f), VaultYardKill = new Vector2(-34f, -19f), MaruAt = new Vector2(-5f, 9f), VaultBandi = new Vector2(-10f, 9f), BandiObs = FrostAt("obs", 5f, 10f);
        /// <summary>34장(⑲-63) 자리(각 명소 가운데에서 m, z 남쪽): 마루 = 곳간 동남쪽(석등 고리 `SealR` 8m 밖) · 소담 = 곳간 문 앞 서쪽 → 동력 기둥부터 금고 문 앞 남쪽 15m(35장 시작도) → 35장 1째부터 금고 안 남쪽 · 곳간 지키기 제단 = 곳간 문 앞 남쪽 7m.</summary>
        public static readonly Vector2 MaruGranary = new Vector2(11f, 11f), SodamGranary = new Vector2(-12f, 5f), SodamDoor = new Vector2(0f, 15f), SodamVault = new Vector2(0f, 8f), GranaryDefend = new Vector2(0f, 7f);
        /// <summary>35장(⑲-64) 자리(금고 가운데에서 m, z 남쪽): 안 진열관 go = 금고 안 남쪽(`GoRadius` 4 — 문 밖에선 안 닿는다) · 해미 = 해미 진열장(160° 6.5m — 북쪽) 속 · 갈무리 = 기록 기둥 곁(기둥 꼭대기에서도 대화 거리 안) · 여왕 = 금고 문 앞 광장.</summary>
        public static readonly Vector2 VaultGoIn = new Vector2(0f, 4.8f), VaultHaemiAt = new Vector2(-Mathf.Sin(VaultHaemiDeg * Mathf.Deg2Rad) * VaultCaseR, Mathf.Cos(VaultHaemiDeg * Mathf.Deg2Rad) * VaultCaseR), VaultGarmuriAt = new Vector2(0f, 3f), VaultQueenAt = new Vector2(0f, 18f);
        /// <summary>36장(⑲-66) 자리: 해미 = 금고 가장 깊은 진열장(북쪽 벽) 곁(금고 가운데에서 m — 진열장 자리 + 웹 [3.5, 3]) · 진열장 속으로 들어가면 성문 남쪽 18m(`Area.ArrivalOff` 와 같음) · 벼리 = 성문 북쪽(안쪽) 7.7m ·
        /// 결정 짐승 무리 = 성문 남쪽 30m · 대장간까지 걷는 길 = 웹 다섯 점 × 0.45(대장간 가운데에서 m — 시작은 성문 안쪽, 끝은 화덕 앞).</summary>
        public static readonly Vector2 VaultHaemiDeep = new Vector2(3.5f, -VaultDeepR + 3f), ForkGateArrive = new Vector2(0f, 18f), ByeoriGate = new Vector2(0f, -7.7f), ForkGateKill = new Vector2(0f, 30f);
        /// <summary>37장(⑲-67) 자리(각 명소 가운데에서 m, z 남쪽): 나래 = 공사장 북동쪽 → 기관차 서쪽 끝(웹 × 0.45) · 벼리 = 길목 동남쪽(머리 위 별까마귀를 지켜본다) · 기관차 지키기 제단 = 기관차 남쪽 4.5m.</summary>
        public static readonly Vector2 NaraeWorks = new Vector2(6.3f, -6.3f), NaraeLoco = new Vector2(-5.2f, 3f), ByeoriJunction = new Vector2(7.7f, 6.3f), ForkLocoDefend = new Vector2(0f, 4.5f);
        /// <summary>38장(⑲-68) 자리: 두 보스 = 길목 남쪽 6m(같은 자리) · 갈무리 대화 = 길목 위 한 번 · 해미 = 길목 서쪽(웹 [-14,12] × 0.45) · 서리봉 고개 go = 고원 북쪽 끝 돌기둥에서 남쪽 30m 안쪽(`GoRadius` 12 — 돌기둥에서 내린 자리에선 안 닿는다).</summary>
        public static readonly Vector2 ForkCrowAt = new Vector2(0f, 6f), GarmuriJunction = new Vector2(2f, 2f), HaemiJunction = new Vector2(-6.3f, 5.4f), FrostNorthGo = new Vector2(-30f, -215f);
        public static readonly Vector2[] ForkForgePath = { new Vector2(34.7f, 16.2f), new Vector2(27.9f, 11.7f), new Vector2(17.1f, 9.9f), new Vector2(8.6f, 7.7f), new Vector2(1.1f, 5.4f) };
        public static readonly Vector2[] VaultDronePath = { new Vector2(8.6f, -5.4f), new Vector2(-8.5f, -8f), new Vector2(-21.6f, -0.9f), new Vector2(-36.9f, 2.3f), new Vector2(-47.7f, -8.6f), new Vector2(-43.2f, -23.9f),
            new Vector2(-27.9f, -30.2f), new Vector2(-15.3f, -38.7f), new Vector2(-23.9f, -51.8f), new Vector2(-41f, -56.3f), new Vector2(-49.5f, -56.5f) };
        public static readonly Vector2[] AmberThiefPath = { new Vector2(-26.3f, -9.6f), new Vector2(-19.4f, -26.7f), new Vector2(-1.3f, -38f), new Vector2(14.8f, -23.7f), new Vector2(30.1f, -13.4f), new Vector2(37.4f, 6.6f),
            new Vector2(20.1f, 19.5f), new Vector2(6.9f, 32.3f), new Vector2(-14.2f, 35.2f), new Vector2(-23.2f, 15.7f), new Vector2(-33f, 0f) };
        public const int AmberCh30 = 29, AmberCh31 = 30, AmberCh32 = 31, AmberDomeStep = 2, AmberTowerStep = 3, AmberGreenStep = 5, AmberWindStep = 5;
        private static bool Reached(int ch, int step, int atCh, int atStep) => ch > atCh || (ch == atCh && step >= atStep);
        /// <summary>고개 결정 막이 풀렸나 — 1차 결말(29장)을 마친 뒤.</summary>
        public static bool AmberPassOpenAt(int ch) => ch >= 29;
        /// <summary>굳은 자리 i(0 신호등 앞·1 정류장·2 우체통)가 녹았나 — 30장 5·6·7째 단계(0부터 5·6·7)부터.</summary>
        public static bool AmberCrystalOffAt(int i, int ch, int step) => Reached(ch, step, AmberCh30, AmberCrystalFrom[i]);
        /// <summary>장터 결정 돔이 깨졌나 — 31장 석등을 다 켠 뒤(2째 단계)부터.</summary>
        public static bool AmberDomeBrokenAt(int ch, int step) => Reached(ch, step, AmberCh31, AmberDomeStep);
        /// <summary>부양탑 태엽 심장이 녹았나 — 32장 3째 단계부터.</summary>
        public static bool AmberTowerMeltedAt(int ch, int step) => Reached(ch, step, AmberCh32, AmberTowerStep);
        /// <summary>신호등이 초록(거리 시간이 다시 흐름)인가 — 32장 거북을 쓰러뜨린 뒤(5째 단계)부터.</summary>
        public static bool AmberLightsGreenAt(int ch, int step) => Reached(ch, step, AmberCh32, AmberGreenStep);
        /// <summary>시계방 괘종시계 바늘이 도나 — 31장 5째 단계(되감는 동안)만.</summary>
        public static bool AmberClockWindingAt(int ch, int step) => ch == AmberCh31 && step == AmberWindStep;
        public static bool AmberPassOpen => AmberPassOpenAt(StoryState.Ch);
        public static bool AmberCrystalOff(int i) => AmberCrystalOffAt(i, StoryState.Ch, StoryState.StepIndex);
        public static bool AmberDomeBroken => AmberDomeBrokenAt(StoryState.Ch, StoryState.StepIndex);
        public static bool AmberTowerMelted => AmberTowerMeltedAt(StoryState.Ch, StoryState.StepIndex);
        public static bool AmberLightsGreen => AmberLightsGreenAt(StoryState.Ch, StoryState.StepIndex);
        public static bool AmberClockWinding => AmberClockWindingAt(StoryState.Ch, StoryState.StepIndex);

        // 33~35장(⑲-61) — 갈무리 벌(아홉째 지역) 상수·이야기 상태: 금고 반지름 11m·벽 12m·열여섯 조각(남쪽 한 조각이 문 4.6m), 기록 기둥 3×3×9m, 진열장 다섯은 금고 가운데에서 6.5m, 해미 진열장은 160°(남쪽 0·시계 방향)라 북쪽, 가장 깊은 진열장은 북쪽 9.5m, 동력 기둥 10m.
        // 장은 0부터(33장 = 32) — 33~35장·11부는 이식 전이라 진단이 (장, 단계)를 직접 넣어 순수 함수를 잰다.
        public const float VaultR = 11f, VaultH = 12f, VaultDoorW = 4.6f, VaultPillarW = 3f, VaultPillarH = 9f, VaultCaseR = 6.5f, VaultDeepR = 9.5f, VaultHaemiDeg = 160f, VaultPylonH = 10f;
        public const int VaultSegs = 16, VaultCh33 = 32, VaultCh34 = 33, VaultCh35 = 34, VaultCh38 = 37;
        public static readonly int[] VaultPylonFrom = { 5, 6 };
        public const int VaultGranaryStep = 2, VaultDoorStep = 6, VaultCoreStep = 5, VaultHaemiStep = 6, VaultMomentStep = 4;
        /// <summary>빛 울타리가 꺼졌나 — 9부(32장)를 마친 뒤.</summary>
        public static bool VaultGateOpenAt(int ch) => ch >= 32;
        /// <summary>곳간 문이 열렸나 — 34장 2째 단계부터.</summary>
        public static bool VaultGranaryOpenAt(int ch, int step) => Reached(ch, step, VaultCh34, VaultGranaryStep);
        /// <summary>동력 기둥 k(0 서·1 동)가 꺼졌나 — 34장 5·6째 단계부터.</summary>
        public static bool VaultPylonOffAt(int k, int ch, int step) => Reached(ch, step, VaultCh34, VaultPylonFrom[k]);
        /// <summary>금고 남쪽 문이 열렸나 — 34장 6째 단계부터.</summary>
        public static bool VaultDoorOpenAt(int ch, int step) => Reached(ch, step, VaultCh34, VaultDoorStep);
        /// <summary>갈무리의 핵이 꺼졌나 — 35장 5째 단계부터.</summary>
        public static bool VaultCoreDimAt(int ch, int step) => Reached(ch, step, VaultCh35, VaultCoreStep);
        /// <summary>해미 진열장이 깨졌나 — 35장 6째 단계부터.</summary>
        public static bool VaultHaemiFreeAt(int ch, int step) => Reached(ch, step, VaultCh35, VaultHaemiStep);
        /// <summary>가장 깊은 진열장이 드러났나 — 10부(35장)를 마친 뒤.</summary>
        public static bool VaultDeepShownAt(int ch) => ch >= 35;
        /// <summary>가장 깊은 진열장 유리가 깨졌나 — 11부 38장 4째 단계부터.</summary>
        public static bool VaultMomentFreeAt(int ch, int step) => Reached(ch, step, VaultCh38, VaultMomentStep);
        public static bool VaultGateOpen => VaultGateOpenAt(StoryState.Ch);
        public static bool VaultGranaryOpen => VaultGranaryOpenAt(StoryState.Ch, StoryState.StepIndex);
        public static bool VaultPylonOff(int k) => VaultPylonOffAt(k, StoryState.Ch, StoryState.StepIndex);
        public static bool VaultDoorOpen => VaultDoorOpenAt(StoryState.Ch, StoryState.StepIndex);
        public static bool VaultCoreDim => VaultCoreDimAt(StoryState.Ch, StoryState.StepIndex);
        public static bool VaultHaemiFree => VaultHaemiFreeAt(StoryState.Ch, StoryState.StepIndex);
        public static bool VaultDeepShown => VaultDeepShownAt(StoryState.Ch);
        public static bool VaultMomentFree => VaultMomentFreeAt(StoryState.Ch, StoryState.StepIndex);

        // 36~38장(⑲-65) — 세갈래 고을(열째 지역) 상수·이야기 상태: 종루 5×5×10m(꼭대기 5m 네모), 격자 말뚝 밑동 1.4m·빛 틀 6m, 멈춘 별까마귀 높이 20m, 하늘 틈 42m, 공중 호박 알갱이 48. 장은 0부터(37장 = 36, 38장 = 37).
        public const float ForkTowerW = 5f, ForkTowerH = 10f, ForkLatticeH = 6f, ForkCrowY = 20f, ForkRiftY = 42f;
        public const int ForkSpecks = 48, ForkCh37 = 36, ForkCh38 = 37, ForkCrowStep = 1;
        public static readonly int[] ForkLatticeFrom = { 2, 5, 7 };
        /// <summary>진단이 `Chapters` 가 38장까지 없을 때 호박 장막이 걷힌 척한다(땅 진단이 열림 뒤 길을 재도록).</summary>
        public static bool ForkPassForTest;
        /// <summary>격자 말뚝 k(0 역참길·1 선로·2 종루 위)의 빛 틀이 사라졌나 — 37장 2·5·7째 단계부터.</summary>
        public static bool ForkLatticeOffAt(int k, int ch, int step) => Reached(ch, step, ForkCh37, ForkLatticeFrom[k]);
        /// <summary>멈춘 별까마귀가 아직 있나 — 38장 1째 단계 전까지(그 뒤 이야기 보스로).</summary>
        public static bool ForkCrowFrozenAt(int ch, int step) => !Reached(ch, step, ForkCh38, ForkCrowStep);
        /// <summary>순간이 풀렸나(하늘 틈·알갱이·고개 장막 걷힘) — 38장 4째 단계부터(금고 깊은 진열장 유리와 같은 때).</summary>
        public static bool ForkMomentFreeAt(int ch, int step) => Reached(ch, step, ForkCh38, VaultMomentStep);
        public static bool ForkLatticeOff(int k) => ForkLatticeOffAt(k, StoryState.Ch, StoryState.StepIndex);
        public static bool ForkCrowFrozen => ForkCrowFrozenAt(StoryState.Ch, StoryState.StepIndex);
        public static bool ForkMomentFree => ForkMomentFreeAt(StoryState.Ch, StoryState.StepIndex);
        /// <summary>서리봉 쪽 돌기둥이 열렸나 — 순간이 풀린 뒤(호박 장막이 걷힌 뒤).</summary>
        public static bool ForkPassOpen => ForkPassForTest || ForkMomentFree;

        /// <summary>시계탑 바늘이 도나 — 19장 6째 단계(태엽을 푼 뒤)부터 늘.</summary>
        public static bool ClockRunning => StoryState.Ch > 18 || (StoryState.Ch == 18 && StoryState.StepIndex >= 5);

        // 18장(⑲-40) — 은하역·태양광 밭 자리(각 명소 가운데에서 m, z 남쪽): 도담은 승강장 남쪽 끝 아래, 막차 = 승강장 가운데(객차), 잔상은 선로(남쪽)를 지그재그로 달린다(웹 ×1.35).
        public static readonly Vector2 DodamAt = new Vector2(9f, 3.4f), StationBandi = new Vector2(-6f, 4.5f), DodamEnd = new Vector2(4f, 70f), TrainAt = new Vector2(0f, 0.5f), FarmFight = new Vector2(0f, 12f);
        public static readonly Vector2[] CaptainPath = { new Vector2(0f, 8f), new Vector2(2f, 22f), new Vector2(-2f, 35f), new Vector2(2f, 49f), new Vector2(-1f, 62f), new Vector2(3f, 78f), new Vector2(-3f, 92f) };
        /// <summary>변전함에 전기가 들어왔나(18장 6째 단계부터 늘) — 막차 전조등·변전함 표시등이 켜진다.</summary>
        public static bool TrainPowered => StoryState.Ch > 17 || (StoryState.Ch == 17 && StoryState.StepIndex >= 5);

        // 17장(⑲-39) — 옛 절터·떨어진 절 종 곁 자리(각 명소 가운데에서 m): 종각 = 절터 동쪽 10m, 한결은 그 남쪽, 쓰러진 종 곁 무리/이무기/한결/반디
        public static readonly Vector2 Belfry = new Vector2(10f, 0f), Hangyeol = new Vector2(10f, 3.6f), TempleBandi = new Vector2(14.5f, -1f),
            BellFight = new Vector2(-4f, 7f), BellDuel = new Vector2(3f, 6f), HgBell = new Vector2(-3f, 3f), BellBandi = new Vector2(4f, -3f);
        /// <summary>종이 종각에 걸렸나(반디가 들어 올린 17장 8째 단계부터 늘) — 걸리면 쓰러진 종은 사라진다.</summary>
        public static bool BellHung => StoryState.Ch > 16 || (StoryState.Ch == 16 && StoryState.StepIndex >= 7);

        // 16장(⑲-38) — 은하 나루 별배 나루 안 자리(계류 탑 밑에서 m, z 남쪽): 아라는 부스 곁(동쪽), 반디는 서남쪽, 무리·계류 지키기는 착륙판 가운데. 탑 = 18m 기둥(옆면 타기), 매인 별배 = 착륙판 위 6m.
        public const float TowerHeight = 18.4f, TowerHalf = 1.2f, ShipUp = 6f;
        public static readonly Vector2 PortAra = new Vector2(11.5f, 5f), PortBandi = new Vector2(-5f, 9f), PortFight = new Vector2(0f, 6f), PortAltar = new Vector2(0f, 6f);
        /// <summary>단계·인물이 은하 나루 같은 독립 땅 명소 곁에 서는 자리 — 명소 열쇠("지역:명소") + 그 가운데에서 m.</summary>
        public static Vector3 AreaPos(string siteKey, Vector2 off)
        {
            if (!GoAreas.TrySite(siteKey, out var s)) return Vector3.zero;
            return s.Pos + new Vector3(off.x, 0.05f, off.y);
        }
        /// <summary>계류 탑 꼭대기(윗면).</summary>
        public static Vector3 TowerTop { get { GoAreas.TrySite("skyport:port", out var s); return s.Pos + Vector3.up * TowerHeight; } }
        public static bool OnTower(Vector3 p) => Flat(p, TowerTop) <= TowerHalf + 0.6f && p.y >= TowerTop.y - 1.2f;
        /// <summary>계류 탑 빛 공이 켜졌나 · 별배가 나루에 매였나 — 16장 7째 단계(반디)부터 늘.</summary>
        public static bool PortDocked => StoryState.Ch > 15 || (StoryState.Ch == 15 && StoryState.StepIndex >= 6);

        // 15장(⑲-36) — 옛 역참 터: 남쪽 공터와 논밭 사이 길 칸 (3,8) 한가운데(평평한 길 — 위아래 칸도 평지). 자리는 역참 가운데에서 m(x 동쪽·z 남쪽), 동쪽이 트인 돌담 세 변.
        public const float StationGx = 3.0f, StationGy = 8.0f;
        public static readonly Vector2 StationHorse = new Vector2(-9f, -4f), StationDareum = new Vector2(6f, -3f), StationFight = new Vector2(0f, 13f), StationDuel = new Vector2(0f, 17f);
        public static Vector3 StationPos(Vector2 off) => GridPos(StationGx, StationGy) + new Vector3(off.x, 0f, off.y);
        /// <summary>고원 별배 곁 — 달음은 선체 밖 서쪽, 날개 이음매는 선체 밖 남서쪽(웹 DAREUM_SHIP·WING_SEAM).</summary>
        public static readonly Vector2 DareumShip = FrostAt("ship", -12f, 10f), WingSeam = FrostAt("ship", -4f, 8f);
        /// <summary>역마가 달아나는 길(칸 좌표, 첫 점 = 마구간) — 길 칸을 따라 남쪽 논밭 칸으로, 접히지 않게(걸어선 못 따라잡는다).</summary>
        public static readonly Vector2[] HorsePath =
        {
            new Vector2(StationGx - 9f / 48f, StationGy - 4f / 48f), new Vector2(3.0f, 8.3f), new Vector2(3.05f, 8.8f), new Vector2(3.35f, 9.2f), new Vector2(4.0f, 9.2f), new Vector2(4.35f, 9.15f),
        };

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
                    new Spot { Ch = 27, From = 0, To = 3, Gx = CapeGx - 6f / 48f, Gy = CapeGy - 6f / 48f }, new Spot { Ch = 27, From = 4, To = 9, Isle = true, Arena = IsleFerry }, // 28장 — 곶에서 배를 기다리다 바위섬에
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
                    new Spot { Ch = 26, From = 5, To = 5, Gx = Altar2Gx + 7f / 48f, Gy = Altar2Gy + 5f / 48f }, // 27장 — 둘째 매듭 곁
                    new Spot { Ch = 27, From = 9, To = 9, Sky = true, Arena = SkyWanderer }, // 28장 — 구름섬
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
                    // 109-14-53 27장 — 가면 벗은 해솔이 봉우리 셋째 매듭 곁에(9째 단계에만)
                    new Spot { Ch = 28, From = 6, To = 6, Eye = true, Arena = EyeHaesol, Unmask = true, NameKey = "story.npc.haesol2", NameKo = "해솔", IdleKey = "story.idle.haesol2", IdleKo = "……고맙다. 노래를 다시 부를 수 있을 것 같아." }, // 29장 — 먹구름 눈 북동쪽
                    new Spot { Ch = 26, From = 8, To = 8, Peak = true, Arena = new Vector2(-14f, -12f), Unmask = true, NameKey = "story.npc.haesol2", NameKo = "해솔",
                        IdleKey = "story.idle.haesol2", IdleKo = "……고맙다. 노래를 다시 부를 수 있을 것 같아." },
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
                    new Spot { Ch = 32, From = 1, To = 1, Frost = true, Arena = HaramObs }, // 33장 — 관측소에서 레이더를 본다
                    new Spot { Ch = 38, From = 1, To = 1, Frost = true, Arena = HaramObs }, // 109-14-70 39장 2째 — 관측소에서 시간 물결 기록을 본다
                },
                IdleKey = "story.idle.haram", IdleKo = "바늘이 또 얼었네… 눈은 언제 그치려나." },
            new Npc { Id = "bandi", NameKey = "story.npc.bandi", NameKo = "조종 기계 반디", ShortKey = "story.short.bandi", ShortKo = "반디",
                Gx = 4.5f, Gy = 0.5f, Pet = true,
                Appear = new[] { new Spot { Ch = 38, From = 2, To = 2, Frost = true, Arena = BandiShip }, new Spot { Ch = 39, From = 3, To = 3, Frost = true, Arena = BandiShip }, // 109-14-70 39장 3째 · 40장 4째(나침을 살핀 뒤) 별배 곁
                    new Spot { Ch = 9, From = 6, To = 8, Frost = true, Arena = BandiShip }, new Spot { Ch = 10, From = 0, To = 8, Frost = true, Arena = BandiShip },
                    new Spot { Ch = 11, From = 0, To = 4, Frost = true, Arena = BandiShip }, new Spot { Ch = 11, From = 5, To = 5, Frost = true, Arena = BandiCave }, new Spot { Ch = 11, From = 6, To = 8, Frost = true, Arena = BandiShip },
                    new Spot { Ch = 12, From = 0, To = 5, Frost = true, Arena = BandiShip }, new Spot { Ch = 12, From = 6, To = 8, Yard = true, Arena = YardBandi },
                    new Spot { Ch = 13, From = 0, To = 8, Frost = true, Arena = BandiShip }, new Spot { Ch = 13, From = 9, To = 9, Sky = true, Obs = true, Arena = new Vector2(3f, 3f) },
                    new Spot { Ch = 14, From = 0, To = 20, Frost = true, Arena = BandiShip },
                    new Spot { Ch = 15, From = 0, To = 5, Frost = true, Arena = BandiShip }, new Spot { Ch = 15, From = 6, To = 8, At = "skyport:port", Arena = PortBandi },
                    new Spot { Ch = 16, From = 0, To = 6, At = "skyport:port", Arena = PortBandi }, new Spot { Ch = 16, From = 7, To = 7, At = "skyport:bell", Arena = BellBandi }, new Spot { Ch = 16, From = 8, To = 9, At = "skyport:temple", Arena = TempleBandi },
                    new Spot { Ch = 17, From = 0, To = 0, At = "skyport:temple", Arena = TempleBandi }, new Spot { Ch = 17, From = 1, To = 9, At = "skyport:station", Arena = StationBandi },
                    new Spot { Ch = 18, From = 0, To = 1, At = "skyport:station", Arena = StationBandi }, new Spot { Ch = 18, From = 2, To = 4, At = "crossing:platform", Arena = CrossBandi },
                    new Spot { Ch = 18, From = 5, To = 5, At = "crossing:clock", Arena = CrossClockBandi }, new Spot { Ch = 18, From = 6, To = 9, At = "crossing:steps", Arena = CrossStepsBandi },
                    new Spot { Ch = 19, From = 0, To = 1, At = "skyport:port", Arena = PortBandi }, new Spot { Ch = 19, From = 2, To = 10, Sky = true, Rift = true, Arena = RiftBandi }, new Spot { Ch = 20, From = 0, To = 1, At = "skyport:port", Arena = PortBandi },
                    new Spot { Ch = 20, From = 2, To = 6, At = "sunken:gate", Arena = SandBandi }, new Spot { Ch = 20, From = 7, To = 99, At = "sunken:palace", Arena = PlinthBandi }, new Spot { Ch = 21, From = 0, To = 2, At = "sunken:palace", Arena = PlinthBandi },
                    new Spot { Ch = 21, From = 3, To = 6, At = "sunken:dome", Arena = FrontBandi }, new Spot { Ch = 21, From = 7, To = 99, At = "sunken:dome", Arena = InBandi }, new Spot { Ch = 22, From = 0, To = 0, At = "sunken:dome", Arena = InBandi },
                    new Spot { Ch = 22, From = 1, To = 3, At = "sunken:lighthouse", Arena = LightBandi }, new Spot { Ch = 22, From = 4, To = 99, At = "sunken:dome", Arena = InBandi }, new Spot { Ch = 23, From = 0, To = 1, At = "sunken:gate", Arena = SandBandi },
                    new Spot { Ch = 23, From = 2, To = 99, Route = "shrine", Arena = ShrineBandi }, new Spot { Ch = 24, From = 0, To = 0, Route = "shrine", Arena = ShrineBandi },
                    new Spot { Ch = 24, From = 1, To = 99, Route = "wreck", Arena = WreckBandi }, new Spot { Ch = 25, From = 0, To = 0, Route = "wreck", Arena = WreckBandi },
                    new Spot { Ch = 25, From = 1, To = 99, Route = "orbit", Arena = OrbitBandi }, new Spot { Ch = 26, From = 0, To = 99, Gx = 4.5f, Gy = 0.5f }, new Spot { Ch = 27, From = 0, To = 99, Gx = 4.5f, Gy = 0.5f }, new Spot { Ch = 28, From = 0, To = 99, Gx = 4.5f, Gy = 0.5f },
                    new Spot { Ch = 29, From = 0, To = 0, At = "skyport:port", Arena = PortBandi }, new Spot { Ch = 29, From = 1, To = 99, At = "amber:clock", Arena = ChorongBandi }, new Spot { Ch = 30, From = 0, To = 99, At = "amber:clock", Arena = ChorongBandi }, new Spot { Ch = 31, From = 0, To = 99, At = "amber:clock", Arena = ChorongBandi }, new Spot { Ch = 32, From = 0, To = 0, At = "amber:clock", Arena = ChorongBandi },
                    new Spot { Ch = 32, From = 1, To = 1, Frost = true, Arena = BandiObs }, new Spot { Ch = 32, ChTo = 999, From = 2, To = 99, At = "vault:yard", Arena = VaultBandi } }, // 8부(27장~) 반디는 청하 촌장 곁 마을 · 9부(30장~) 굳은 거리 시계방
                IdleKey = "story.idle.bandi", IdleKo = "삐— 별배 심장 온도, 계속 하락 중." },
            // 109-14-42 19장(웹 ⑲-42) — 별배 선장 한별: 첫 정거장 승강장 남쪽 끝에 서고(19장 뒤 20장까지), 19장 8~10째 단계엔 섬돌 밑 틈 수정 아래 (20장에서 동료)
            new Npc { Id = "hanbyeol", NameKey = "story.npc.hanbyeol", NameKo = "별배 선장 한별", ShortKey = "story.short.hanbyeol", ShortKo = "한별",
                AtSite = "crossing:platform", AtOff = CrossHanbyeol, FolkBody = "Vanguard",
                Appear = new[] { new Spot { Ch = 18, From = 7, To = 9, At = "crossing:steps", Arena = CrossStepsHanbyeol }, new Spot { Ch = 19, From = 0, To = 1, At = "crossing:platform", Arena = CrossHanbyeol }, new Spot { Ch = 19, From = 2, To = 10, Sky = true, Rift = true, Arena = RiftHanbyeol },
                    new Spot { Ch = 20, From = 0, To = 1, At = "skyport:port", Arena = SunkPortHanbyeol }, new Spot { Ch = 20, From = 2, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 21, From = 0, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 22, From = 0, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 23, From = 0, To = 1, At = "sunken:gate", Arena = SandHanbyeol },
                    new Spot { Ch = 23, From = 2, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 24, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 25, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 26, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol },
                    new Spot { Ch = 29, From = 0, To = 99, At = "skyport:port", Arena = SunkPortHanbyeol }, new Spot { Ch = 30, From = 0, To = 99, At = "skyport:port", Arena = SunkPortHanbyeol }, new Spot { Ch = 31, From = 0, To = 99, At = "skyport:port", Arena = SunkPortHanbyeol }, new Spot { Ch = 32, ChTo = 999, From = 0, To = 99, At = "skyport:port", Arena = SunkPortHanbyeol } }, // 9부(30장~) 은하 나루 착륙판 곁
                IdleKey = "story.idle.hanbyeol", IdleKo = "틈의 끝은 첫 정거장 다음 역이다." },
            // 109-14-45 21장(웹 ⑲-45) — 잠수 기사 여울(현대): 늘 연구 기지 서쪽, 21장 5~7째 단계 선착장 · 8째~ 궁궐 기단
            new Npc { Id = "yeoul", NameKey = "story.npc.yeoul", NameKo = "잠수 기사 여울", ShortKey = "story.short.yeoul", ShortKo = "여울",
                AtSite = "sunken:lab", AtOff = LabYeoul, FolkBody = "SwatGuy",
                At = new[] { new Spot { Ch = 20, From = 4, To = 6, At = "sunken:lab", Arena = LabDock }, new Spot { Ch = 20, From = 7, To = 99, At = "sunken:palace", Arena = PlinthYeoul }, new Spot { Ch = 21, From = 0, To = 2, At = "sunken:palace", Arena = PlinthYeoul },
                    new Spot { Ch = 21, From = 3, To = 6, At = "sunken:dome", Arena = FrontYeoul }, new Spot { Ch = 21, From = 7, To = 99, At = "sunken:dome", Arena = InYeoul }, new Spot { Ch = 22, From = 0, To = 99, At = "sunken:dome", Arena = InYeoul }, new Spot { Ch = 23, From = 0, To = 99, At = "sunken:dome", Arena = InYeoul } },
                IdleKey = "story.idle.yeoul", IdleKo = "기지 불이 나간 지 한참이에요. 그래도 잠수정은 제가 지켜요." },
            // 109-14-51 26장(웹 ⑲-51) — 가면 그림자: 23장 반디 기록 속 그자. 26장 장치 셋을 끈 뒤(7째 단계) 한 번만 정거장 서쪽 끝에 선다. 정체는 8부까지.
            new Npc { Id = "gamyeon", NameKey = "story.npc.gamyeon", NameKo = "가면 그림자", ShortKey = "story.short.gamyeon", ShortKo = "그림자",
                AtSite = "sunken:lighthouse", AtOff = Vector2.zero, FolkBody = "Vanguard", Mask = true,
                Appear = new[] { new Spot { Ch = 25, From = 6, To = 6, Route = "orbit", Arena = OrbitGamyeon }, new Spot { Ch = 27, From = 8, To = 8, Sky = true, Arena = new Vector2(7f, -7f) }, // 28장 — 구름섬 북동쪽 한 번
                    // 29장 — 먹구름 눈 북쪽의 임금(참몸, 이름·혼잣말을 덮는다)
                    new Spot { Ch = 28, From = 3, To = 3, Eye = true, Arena = EyeKing, NameKey = "story.npc.king", NameKo = "먹구름 임금", IdleKey = "story.idle.king", IdleKo = "……" } },
                IdleKey = "story.idle.gamyeon", IdleKo = "……" },
            // 109-14-50 25장(웹 ⑲-50) — 비행사 하늬(현대): 먹구름에 휘말려 잔해 섬에 처박힌 기상 비행선 조종사. 25장부터 조종실 동쪽 앞(뒤에도).
            new Npc { Id = "haneul", NameKey = "story.npc.haneul", NameKo = "비행사 하늬", ShortKey = "story.short.haneul", ShortKo = "하늬",
                AtSite = "sunken:lighthouse", AtOff = Vector2.zero, FolkBody = "Crypto",
                Appear = new[] { new Spot { Ch = 24, From = 0, To = 99, Route = "wreck", Arena = WreckHaneul }, new Spot { Ch = 25, From = 0, To = 0, Route = "wreck", Arena = WreckHaneul },
                    new Spot { Ch = 25, From = 1, To = 99, Route = "orbit", Arena = OrbitHaneul }, new Spot { Ch = 26, From = 0, To = 99, Route = "orbit", Arena = OrbitHaneul } },
                IdleKey = "story.idle.haneul", IdleKo = "기록계 바늘이 또 튀어요. 구름이 저절로 생기는 게 아니라니까요." },
            // 구름 씨앗 드론 — 25장 쫓기 때만(4째 단계) 잔해 섬 둘레 길(SeedPath)을 난다. 반디와 같은 기계 몸.
            new Npc { Id = "seeddrone", NameKey = "story.npc.seeddrone", NameKo = "구름 씨앗 드론", ShortKey = "story.short.seeddrone", ShortKo = "드론",
                AtSite = "sunken:lighthouse", AtOff = Vector2.zero, Pet = true, RunRoute = "wreck", RunPath = SeedPath,
                Appear = new[] { new Spot { Ch = 24, From = 3, To = 3, Route = "wreck", Arena = new Vector2(8f, -9f) } },
                IdleKey = "story.idle.seeddrone", IdleKo = "삐비— 치익." },
            // 109-14-49 24장(웹 ⑲-49) — 바람 무녀 새벽(과거): 사당이 하늘로 들린 날부터 홀로. 24장 3째 단계(별배가 섬에 내린 뒤)부터 사당 앞 서쪽(뒤에도).
            new Npc { Id = "saebyeok", NameKey = "story.npc.saebyeok", NameKo = "바람 무녀 새벽", ShortKey = "story.short.saebyeok", ShortKo = "새벽",
                AtSite = "sunken:lighthouse", AtOff = Vector2.zero, FolkBody = "Archer",
                Appear = new[] { new Spot { Ch = 23, From = 2, To = 99, Route = "shrine", Arena = ShrineSaebyeok }, new Spot { Ch = 24, From = 0, To = 99, Route = "shrine", Arena = ShrineSaebyeok }, new Spot { Ch = 25, From = 0, To = 99, Route = "shrine", Arena = ShrineSaebyeok }, new Spot { Ch = 26, From = 0, To = 99, Route = "shrine", Arena = ShrineSaebyeok } },
                IdleKey = "story.idle.saebyeok", IdleKo = "방울이 울면 바람이 길을 안다오." },
            // 109-14-47 23장(웹 ⑲-47) — 돔 관리 인공지능 파랑(미래): 반디와 같은 떠 있는 기계 몸(웹은 파란 빛깔 — 이 판은 14-1b 전까지 같은 빛). 23장부터 돔 안 기록실 앞.
            new Npc { Id = "parang", NameKey = "story.npc.parang", NameKo = "돔 관리 인공지능 파랑", ShortKey = "story.short.parang", ShortKo = "파랑",
                AtSite = "sunken:dome", AtOff = ParangAt, Pet = true,
                Appear = new[] { new Spot { Ch = 22, From = 0, To = 99, At = "sunken:dome", Arena = ParangAt }, new Spot { Ch = 23, From = 0, To = 99, At = "sunken:dome", Arena = ParangAt } },
                IdleKey = "story.idle.parang", IdleKo = "빛 돔 기록실입니다. 열람하실 기록을 말씀해 주십시오." },
            // 109-14-46 22장(웹 ⑲-46) — 해녀 물새(과거): 도읍이 잠기던 날 물질 나갔다 갇혔다. 22장 2~3째 곁채 앞 · 4~7째 돔 문 앞 · 8째~ 돔 안(뒤에도). 23장에서 동료.
            new Npc { Id = "mulsae", NameKey = "story.npc.mulsae", NameKo = "해녀 물새", ShortKey = "story.short.mulsae", ShortKo = "물새",
                AtSite = "sunken:dome", AtOff = InMulsae, FolkBody = "Megan",
                Appear = new[] { new Spot { Ch = 21, From = 1, To = 2, At = "sunken:palace", Arena = AnnexMulsae }, new Spot { Ch = 21, From = 3, To = 6, At = "sunken:dome", Arena = FrontMulsae },
                    new Spot { Ch = 21, From = 7, To = 99, At = "sunken:dome", Arena = InMulsae }, new Spot { Ch = 22, From = 0, To = 99, At = "sunken:dome", Arena = InMulsae }, new Spot { Ch = 23, From = 0, To = 99, At = "sunken:dome", Arena = InMulsae } },
                IdleKey = "story.idle.mulsae", IdleKo = "숨 한 번에 한 길. 물은 서두르는 사람을 싫어한다오." },
            // 109-14-40 18장(웹 ⑲-40) — 기관사 도담(늘 승강장 남쪽 끝 아래, 8째 단계는 선로 끝) · 선장의 잔상(18장 쫓기 때만 — 은하역 선로 위를 달린다)
            new Npc { Id = "dodam", NameKey = "story.npc.dodam", NameKo = "기관사 도담", ShortKey = "story.short.dodam", ShortKo = "도담",
                AtSite = "skyport:station", AtOff = DodamAt, FolkBody = "PeasantMan",
                At = new[] { new Spot { Ch = 17, From = 7, To = 7, At = "skyport:station", Arena = DodamEnd }, new Spot { Ch = 19, From = 0, To = 1, At = "crossing:platform", Arena = new Vector2(6.5f, -3f) }, new Spot { Ch = 19, From = 2, To = 10, Sky = true, Rift = true, Arena = RiftDodam } },
                IdleKey = "story.idle.dodam", IdleKo = "막차는 아직 이 역에 서 있어요." },
            new Npc { Id = "captain", NameKey = "story.npc.captain", NameKo = "선장의 잔상", ShortKey = "story.short.captain", ShortKo = "잔상",
                AtSite = "skyport:station", AtOff = new Vector2(0f, 8f), FolkBody = "Remy", RunAt = "skyport:station", RunPath = CaptainPath,
                Appear = new[] { new Spot { Ch = 17, From = 6, To = 6, At = "skyport:station", Arena = new Vector2(0f, 8f) } },
                IdleKey = "story.idle.captain", IdleKo = "…종이 울리면 막차가…" },
            // 109-14-39 17장(웹 ⑲-39) — 종지기 한결: 늘 절터 종각 남쪽, 17장 5~8째 단계엔 쓰러진 종 곁
            new Npc { Id = "hangyeol", NameKey = "story.npc.hangyeol", NameKo = "종지기 한결", ShortKey = "story.short.hangyeol", ShortKo = "한결",
                AtSite = "skyport:temple", AtOff = Hangyeol, FolkBody = "Paladin",
                At = new[] { new Spot { Ch = 16, From = 4, To = 7, At = "skyport:bell", Arena = HgBell } },
                IdleKey = "story.idle.hangyeol", IdleKo = "종은 소리로 사람을 부르는 물건이오." },
            // 109-14-38 16장(웹 ⑲-38) — 나루지기 아라: 늘 은하 나루 별배 나루 부스 곁에 선다
            new Npc { Id = "ara", NameKey = "story.npc.ara", NameKo = "나루지기 아라", ShortKey = "story.short.ara", ShortKo = "아라",
                AtSite = "skyport:port", AtOff = PortAra, FolkBody = "Megan",
                IdleKey = "story.idle.ara", IdleKo = "별배는 꼭 돌아온다고 믿고 불을 켜 두었어요." },
            // 109-14-36 15장(웹 ⑲-36) — 파발꾼 달음(과거): 역참 터에서 만나고(2~8단계) 뒤로는 고원 별배 곁(9~11단계) · 놀란 역마: 늘 마구간, 15장 쫓기 때만 달아난다
            new Npc { Id = "dareum", NameKey = "story.npc.dareum", NameKo = "파발꾼 달음", ShortKey = "story.short.dareum", ShortKo = "달음",
                Gx = StationGx, Gy = StationGy, FolkBody = "Archer",
                Appear = new[] { new Spot { Ch = 14, From = 1, To = 7, Stn = true, Arena = StationDareum }, new Spot { Ch = 14, From = 8, To = 10, Frost = true, Arena = DareumShip } },
                IdleKey = "story.idle.dareum", IdleKo = "파발꾼은 길 끝을 봐야 직성이 풀리오." },
            new Npc { Id = "horse", NameKey = "story.npc.horse", NameKo = "놀란 역마", ShortKey = "story.short.horse", ShortKo = "역마",
                Gx = StationGx - 9f / 48f, Gy = StationGy - 4f / 48f, Horse = true, RunPath = HorsePath,
                IdleKey = "story.idle.horse", IdleKo = "히힝… 푸르르." },
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
            // 109-14-58 30장(웹 ⑲-58) — 시계 수리공 초롱(현대): 손목시계 속 틈 조각 태엽 덕에 혼자 안 굳었다. 9부(30장~) 늘 시계방 서쪽 앞(뒤 장은 31장 이식 때 자리를 더한다)
            new Npc { Id = "chorong", NameKey = "story.npc.chorong", NameKo = "시계 수리공 초롱", ShortKey = "story.short.chorong", ShortKo = "초롱",
                AtSite = "amber:clock", AtOff = ChorongAt, FolkBody = "Megan",
                Appear = new[] { new Spot { Ch = 29, From = 0, To = 99, At = "amber:clock", Arena = ChorongAt },
                    new Spot { Ch = 30, From = 1, To = 4, At = "amber:market", Arena = ChorongMarket }, new Spot { Ch = 30, From = 0, To = 99, At = "amber:clock", Arena = ChorongAt }, // 31장 석등·너울·도둑·저울추 — 장터 동쪽 앞
                    new Spot { Ch = 31, From = 5, To = 5, At = "amber:tower", Arena = ChorongTower }, new Spot { Ch = 31, From = 0, To = 99, At = "amber:clock", Arena = ChorongAt }, // 32장 거북을 쓰러뜨린 뒤 탑 밑 광장
                    new Spot { Ch = 32, ChTo = 999, From = 0, To = 99, At = "amber:clock", Arena = ChorongAt } },
                IdleKey = "story.idle.chorong", IdleKo = "다른 시계는 다 멈췄는데 내 손목시계만 째깍거려요." },
            // 109-14-59 31장(웹 ⑲-59) — 장돌뱅이 너울(과거): 장터 결정 속에 좌판째 굳어 있던 사람. 결정이 깨진 뒤(31장 3째 단계부터, 뒤에도) 장터 가운데 굳어 있던 자리
            new Npc { Id = "neoul", NameKey = "story.npc.neoul", NameKo = "장돌뱅이 너울", ShortKey = "story.short.neoul", ShortKo = "너울",
                AtSite = "amber:market", AtOff = NeoulAt, FolkBody = "PeasantMan",
                Appear = new[] { new Spot { Ch = 30, From = 2, To = 99, At = "amber:market", Arena = NeoulAt }, new Spot { Ch = 31, From = 0, To = 99, At = "amber:market", Arena = NeoulAt }, new Spot { Ch = 32, ChTo = 999, From = 0, To = 99, At = "amber:market", Arena = NeoulAt } },
                IdleKey = "story.idle.neoul", IdleKo = "저울추는 셈이 정확해야 하는 법이지. 쇠 수레 구경도 한두 번이지, 허허." },
            // 조각 도둑 — 31장 쫓기 때만(4째 단계) 네거리 둘레 길(AmberThiefPath)을 난다. 반디와 같은 기계 몸.
            new Npc { Id = "partthief", NameKey = "story.npc.partthief", NameKo = "조각 도둑", ShortKey = "story.short.partthief", ShortKo = "도둑",
                AtSite = "amber:cross", AtOff = Vector2.zero, Pet = true, RunAt = "amber:cross", RunPath = AmberThiefPath,
                Appear = new[] { new Spot { Ch = 30, From = 3, To = 3, At = "amber:cross", Arena = new Vector2(-26.3f, -9.6f) } },
                IdleKey = "story.idle.partthief", IdleKo = "삐비— 치익." },
            // 109-14-60 32장(웹 ⑲-60) — 탑 설계사 새길(미래): 높은 데를 무서워해 탑 발치 남쪽에서 도면만 본다. 31장 끝(7째 단계)부터(뒤에도)
            new Npc { Id = "saegil", NameKey = "story.npc.saegil", NameKo = "탑 설계사 새길", ShortKey = "story.short.saegil", ShortKo = "새길",
                AtSite = "amber:tower", AtOff = SaegilAt, FolkBody = "ExoGray",
                Appear = new[] { new Spot { Ch = 30, From = 6, To = 99, At = "amber:tower", Arena = SaegilAt }, new Spot { Ch = 31, From = 0, To = 99, At = "amber:tower", Arena = SaegilAt }, new Spot { Ch = 32, ChTo = 999, From = 0, To = 99, At = "amber:tower", Arena = SaegilAt } },
                IdleKey = "story.idle.saegil", IdleKo = "층판 공식은 맞는데… 시간이 안 흐르면 공식도 멈추나 봐요." },
            // 109-14-62 33장(웹 ⑲-62) — 창고지기 마루(현대): 갈무리 물류의 마지막 창고지기. 10부(33장~)부터 늘 창고 앞(34장에서 곳간으로 옮긴다)
            new Npc { Id = "maru", NameKey = "story.npc.maru", NameKo = "창고지기 마루", ShortKey = "story.short.maru", ShortKo = "마루",
                AtSite = "vault:yard", AtOff = MaruAt, FolkBody = "SwatGuy",
                Appear = new[] { new Spot { Ch = 33, From = 1, To = 99, At = "vault:granary", Arena = MaruGranary }, // 34장 1째 단계부터 지게차로 곳간 마을에
                    new Spot { Ch = 32, ChTo = 999, From = 0, To = 99, At = "vault:yard", Arena = MaruAt } },
                IdleKey = "story.idle.maru", IdleKo = "드론이 또 한 대 지나가네. 오늘만 백스무 번째…" },
            // 109-14-63 34장(웹 ⑲-63) — 곳간지기 소담(과거): 곳간째 떠서 떨어진 아이. 34장 3~4째 곳간 문 앞 서쪽 → 5째~(동력 기둥부터)·35장 첫 단계는 금고 문 앞 → 35장 2째부터 금고 안
            new Npc { Id = "sodam", NameKey = "story.npc.sodam", NameKo = "곳간지기 소담", ShortKey = "story.short.sodam", ShortKo = "소담",
                AtSite = "vault:granary", AtOff = SodamGranary, FolkBody = "PeasantGirl",
                Appear = new[] { new Spot { Ch = 40, From = 1, To = 1, At = "vault:granary", Arena = SodamGranary40 }, new Spot { Ch = 40, From = 2, To = 4, At = "fork:junction", Arena = SodamJunction }, // 109-14-70 41장 곳간 마을 → 같이 고을 마당으로
                    new Spot { Ch = 40, From = 5, To = 99, Gx = 0.94f, Gy = 3.03f }, new Spot { Ch = 41, ChTo = 999, From = 0, To = 99, Gx = 0.94f, Gy = 3.03f }, // 촌장 곁 → 합류한 뒤에도 청하
                    new Spot { Ch = 33, From = 2, To = 3, At = "vault:granary", Arena = SodamGranary }, new Spot { Ch = 33, From = 4, To = 99, At = "vault:vault", Arena = SodamDoor },
                    new Spot { Ch = 34, From = 0, To = 0, At = "vault:vault", Arena = SodamDoor }, new Spot { Ch = 34, ChTo = 999, From = 0, To = 99, At = "vault:vault", Arena = SodamVault } },
                IdleKey = "story.idle.sodam", IdleKo = "씨앗 한 톨이 한 해 농사예요. 한 톨도 못 줘요." },
            // 109-14-64 35장(웹 ⑲-64) — 씨앗 보관사 해미(미래): 금고 해미 진열장 속. 금고에 들어선 뒤(35장 2째~, 뒤에도)
            new Npc { Id = "haemi", NameKey = "story.npc.haemi", NameKo = "씨앗 보관사 해미", ShortKey = "story.short.haemi", ShortKo = "해미",
                AtSite = "vault:vault", AtOff = VaultHaemiAt, FolkBody = "Vanguard",
                Appear = new[] { new Spot { Ch = 37, ChTo = 999, From = 4, To = 99, At = "fork:junction", Arena = HaemiJunction }, // 38장 참몸을 쓰러뜨린 뒤(5째~, 뒤에도) 길목 서쪽에 걸어 들어온다
                    new Spot { Ch = 35, From = 0, To = 1, At = "vault:vault", Arena = VaultHaemiDeep }, // 36장 처음 둘 — 가장 깊은 진열장 곁
                    new Spot { Ch = 34, ChTo = 999, From = 1, To = 99, At = "vault:vault", Arena = VaultHaemiAt } },
                IdleKey = "story.idle.haemi", IdleKo = "씨앗도 순간도, 갈무리는 다시 꺼내 심으려고 하는 거예요." },
            // 금고 관리 인공지능 갈무리(미래, 기계 몸) — 기둥 위 대화 단계(35장 5째)에만 핵 곁에 선다
            new Npc { Id = "garmuri", NameKey = "story.npc.garmuri", NameKo = "금고 관리 인공지능 갈무리", ShortKey = "story.short.garmuri", ShortKo = "갈무리",
                AtSite = "vault:vault", AtOff = VaultGarmuriAt, Pet = true,
                Appear = new[] { new Spot { Ch = 34, From = 4, To = 4, At = "vault:vault", Arena = VaultGarmuriAt }, new Spot { Ch = 37, From = 2, To = 2, At = "fork:junction", Arena = GarmuriJunction } },
                IdleKey = "story.idle.garmuri", IdleKo = "아름다운 때를 영원히." },
            // 109-14-66 36장(웹 ⑲-66) — 대장장이 벼리(과거): 그날 새벽 벼리던 칼이 틈 조각 쇠라 멈춘 순간 속에서 혼자 움직인다. 11부(36장~) 성문 안쪽 → 대장간으로 앞장선 뒤(6째~, 뒤에도) 화덕 앞
            new Npc { Id = "byeori", NameKey = "story.npc.byeori", NameKo = "대장장이 벼리", ShortKey = "story.short.byeori", ShortKo = "벼리",
                AtSite = "fork:gate", AtOff = ByeoriGate, FolkBody = "PeasantMan", PathAt = "fork:forge", Path = ForkForgePath,
                Appear = new[] { new Spot { Ch = 36, ChTo = 999, From = 1, To = 99, At = "fork:junction", Arena = ByeoriJunction }, // 37장 말뚝을 끄러 나선 뒤(2째~, 뒤에도) 길목 동남쪽
                    new Spot { Ch = 35, ChTo = 999, From = 4, To = 99, Path = true }, new Spot { Ch = 35, From = 0, To = 3, At = "fork:gate", Arena = ByeoriGate } },
                IdleKey = "story.idle.byeori", IdleKo = "쇠는 식기 전에 두드려야 하는데… 불도, 쇠도, 하늘도 다 멈췄어." },
            // 109-14-67 37장(웹 ⑲-67) — 측량 기사 나래(현대): 공사장째 끌려온 측량 기사. 역참길 말뚝 뒤(3째) 공사장 북동쪽 → 기관차로 간 뒤(4째~, 뒤에도) 기관차 서쪽 끝
            new Npc { Id = "narae", NameKey = "story.npc.narae", NameKo = "측량 기사 나래", ShortKey = "story.short.narae", ShortKo = "나래",
                AtSite = "fork:works", AtOff = NaraeWorks, FolkBody = "Remy",
                Appear = new[] { new Spot { Ch = 36, ChTo = 999, From = 3, To = 99, At = "fork:loco", Arena = NaraeLoco }, new Spot { Ch = 36, From = 2, To = 2, At = "fork:works", Arena = NaraeWorks } },
                IdleKey = "story.idle.narae", IdleKo = "측량값이 전부 0 이에요. 거리도, 시간도." },
            // 조각 운반 드론 — 33장 쫓기 때만(5째 단계) 야적장에서 금고 문 앞까지 길(VaultDronePath)을 난다. 반디와 같은 기계 몸.
            new Npc { Id = "carrier", NameKey = "story.npc.carrier", NameKo = "조각 운반 드론", ShortKey = "story.short.carrier", ShortKo = "드론",
                AtSite = "vault:yard", AtOff = Vector2.zero, Pet = true, RunAt = "vault:yard", RunPath = VaultDronePath,
                Appear = new[] { new Spot { Ch = 32, From = 4, To = 4, At = "vault:yard", Arena = new Vector2(8.6f, -5.4f) } },
                IdleKey = "story.idle.carrier", IdleKo = "삐비— 치익." },
        };


        /// <summary>남쪽 다리 북쪽 머리(마을 남쪽 길 끝) — 4장 나그네가 강물을 보고 선 자리.</summary>
        public const float WanderGx = 3.0f, WanderGy = 4.45f;
        /// <summary>5장 서쪽 숲길 — 옛길(은비가 졸개에 에워싸인 곳) · 어귀(go, 마을 쪽 숲 가장자리) · 옛길 졸개 · 둘째 제단(숲길 북쪽 끝) · 제단 졸개(제단 남쪽 10m).</summary>
        public const float RoadGx = -0.1f, RoadGy = 2.85f, RoadGoGx = 0.35f, RoadGoGy = 3.0f, RoadSquadGx = 0.1f, RoadSquadGy = 3.15f;
        public const float Altar2Gx = 0.0f, Altar2Gy = 2.05f, Altar2SquadGx = 0.0f, Altar2SquadGy = 2.25f;

        /// <summary>대화 한 줄 — Who 가 null 이면 "나"의 고르는 줄(대답만 다르고 흐름은 같다).</summary>
        [System.Serializable]
        public struct Line
        {
            public string Who;      // 인물 id
            public string Key, Ko;
            public string[] PickKeys, PickKo;
            public bool IsPick => Who == null;
        }

        [System.Serializable]
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
            // JsonUtility 가 `Vector2?`·`Foe[][]` 를 못 담아 병렬 필드로 둔다 — `Bake()` 가 채우고 `Link()` 가 되돌린다(tasks U-0016).
            public Vector2 ArenaV;
            public bool HasArena;
            public WaveRow[] WaveRows;
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
            /// <summary>109-14-43 갈림길 끝 섬 위(`Sky` 와 함께 — 자리 = 섬 가운데 + Arena).</summary>
            public bool Rift;
            /// <summary>109-14-39 light — 등롱(제단 불) 없이 그 자리에 원소를 대면 된다(종각 종·변전함…). 알림은 EnterKo.</summary>
            public bool Bare;
            /// <summary>109-14-38 독립 땅 명소 곁("지역:명소" — 자리 = 그 명소 가운데 + Arena, climb 은 명소의 탑).</summary>
            public string At;
            /// <summary>109-14-36 옛 역참 터 위(자리 = 역참 가운데 + Arena).</summary>
            public bool Stn;
            /// <summary>109-14-35 관측대 위(`Sky` 와 함께 — 자리 = 관측대 가운데 + Arena) · sky 단계는 시간 기둥으로.</summary>
            public bool Obs;
            public string ArriveKey, ArriveKo;
            public float Speed;
            /// <summary>109-14-47 light — 그 명소의 오르기 꼭대기(`At` 의 탑)에 서야 원소가 닿는다 · 못 닿을 때 알림(등대 등롱).</summary>
            public bool Perch;
            public string AwayKey, AwayKo;
            /// <summary>109-14-49 하늘 섬 위("shrine"·"wreck"·"orbit" — 자리 = 그 섬 윗면 가운데 + Arena).</summary>
            public string Route;
            /// <summary>109-14-55 먹구름 눈 위(자리 = 눈 윗면 가운데 + Arena, `Sky` 단계는 눈 바람 기둥).</summary>
            public bool Eye;
            /// <summary>109-14-50 defend — 물결이 나오는 거리(0 이면 `DefendRing`) — 작은 하늘 섬 위에서 섬 밖으로 안 나오게.</summary>
            public float Ring;
            /// <summary>109-14-64 go — 닿는 반지름(0 이면 `GoR`) — 금고 안처럼 안에 들어서야 닿게 좁힌다.</summary>
            public float GoRadius;

            /// <summary>내보내기 전 — `Arena`·`Waves` 를 직렬화 가능한 병렬 필드로.</summary>
            public void Bake()
            {
                HasArena = Arena.HasValue;
                ArenaV = Arena ?? Vector2.zero;
                WaveRows = Waves == null ? new WaveRow[0] : System.Array.ConvertAll(Waves, w => new WaveRow { Foes = w });
            }

            /// <summary>읽은 뒤 — 병렬 필드에서 `Arena`·`Waves` 를 되살린다.</summary>
            public void Link()
            {
                Arena = HasArena ? ArenaV : (Vector2?)null;
                Waves = WaveRows != null && WaveRows.Length > 0 ? System.Array.ConvertAll(WaveRows, r => r.Foes) : null;
                // JsonUtility 는 null 배열을 빈 배열로 읽는다 — 옛 표에선 null 이었고 소비 코드가 `?? 기본값` 으로 본다(`Order`·`Dirs`·`Rot`·`Foes`·`Adds`…).
                NullEmptyArrays(this);
                if (Lines != null)
                    for (int i = 0; i < Lines.Length; i++)
                    {
                        var l = Lines[i];
                        if (l.PickKeys != null && l.PickKeys.Length == 0) l.PickKeys = null;
                        if (l.PickKo != null && l.PickKo.Length == 0) l.PickKo = null;
                        Lines[i] = l;
                    }
            }
        }

        [System.Serializable]
        public struct WaveRow { public GoDomain.Foe[] Foes; }

        public static Vector3 StepPos(Step s) => s.Eye ? EyePos(s.Arena ?? Vector2.zero) : s.Route != null ? RoutePos(RouteIndex(s.Route), s.Arena ?? Vector2.zero) : s.Sky && s.Rift ? RiftPos(s.Arena ?? Vector2.zero) : s.At != null ? AreaPos(s.At, s.Arena ?? Vector2.zero) : s.Stn ? StationPos(s.Arena ?? Vector2.zero) : s.Yard ? YardPos(s.Arena ?? Vector2.zero) : s.Sky && s.Obs ? DeckPos(s.Arena ?? Vector2.zero) : s.Frost ? FrostPos(s.Arena ?? Vector2.zero) : s.Sky ? SkyPos(s.Arena ?? Vector2.zero) : s.Isle ? IslePos(s.Arena ?? Vector2.zero) : s.Arena.HasValue ? ArenaPos(s.Arena.Value) : GridPos(s.Gx, s.Gy);

        /// <summary>석등 차례(해·달·별이 기본, 8장은 별·달·해).</summary>
        public static string[] OrderOf(Step s) => s.Order ?? SealOrder;

        /// <summary>석등 가운데 — 5장 둘째 제단 또는 섬(8장).</summary>
        public static Vector3 SealPos(Step s) => s.Frost || s.Rift || s.At != null || s.Route != null ? StepPos(s) : s.Isle ? IslePos(Vector2.zero) : s.Gx != 0f || s.Gy != 0f ? GridPos(s.Gx, s.Gy) : GridPos(Altar2Gx, Altar2Gy);

        public const float BossHp = 6f, BossAtk = 1.5f, BossScale = 1.8f;

        [System.Serializable]
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

        /// <summary>JSON 한 파일 모양(tasks U-0016) — `Resources/story_go.json`.</summary>
        [System.Serializable]
        public sealed class StoryFile : IScenarioFile
        {
            public Chapter[] chapters;
            public void Finish()
            {
                if (chapters == null) return;
                foreach (var c in chapters)
                {
                    if (c == null) continue;
                    if (c.Mats != null && c.Mats.Length == 0) c.Mats = null;
                    if (c.Steps != null) foreach (var s in c.Steps) s?.Link();
                }
            }
        }

        private static void NullEmptyArrays(object o)
        {
            foreach (var f in o.GetType().GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
                if (f.FieldType.IsArray && f.GetValue(o) is System.Array a && a.Length == 0) f.SetValue(o, null);
        }

        public static StoryFile Snapshot()
        {
            foreach (var c in Chapters) foreach (var s in c.Steps) s.Bake();
            return new StoryFile { chapters = Chapters };
        }

        internal static Line L(string who, string key, string ko) => new Line { Who = who, Key = key, Ko = ko };
        internal static Line Pick(string key, string a, string b) => new Line { PickKeys = new[] { key + ".a", key + ".b" }, PickKo = new[] { a, b } };

        internal static GoDomain.Foe F(FieldEnemy.Kind k, GoElement over = GoElement.Physical) => new GoDomain.Foe(k, over);

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

        // 장 표는 `Resources/story_go.json`(tasks U-0016 — 고치려면 JSON 을 고치거나 `ScenarioJsonExport.Go` 로 다시 내보낸다). 읽은 뒤 `Step.Link()` 가 `Arena`·`Waves` 를 되살린다.
        private static readonly StoryFile _file = ScenarioJson.Load<StoryFile>("story_go");
        public static readonly Chapter[] Chapters = _file.chapters ?? new Chapter[0];

        /// <summary>109-14-16 기본 물결 셋(웹 DEFEND_WAVES — 두꺼비 = 물귀신, 날쌘용 = 번개귀, 바위곰·눈여우 = 암·빙 물귀신, 14-1b 전까지).</summary>
        public static readonly GoDomain.Foe[][] DefendWaves =
        {
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost) },
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith) },
            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
        };

        /// <summary>109-14-56 메아리 — 그 보스 이름 열쇠를 쓰는 이야기 결투 단계(없으면 null).</summary>
        public static Step DuelByBoss(string bossKey)
        {
            foreach (var c in Chapters) foreach (var s in c.Steps) if (s.Type == StepType.Duel && s.BossKey == bossKey) return s;
            return null;
        }

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
        public static string NpcShort(string id) { var sp = SpotNow(id); if (sp.HasValue && sp.Value.NameKo != null) return GoLocalization.T(sp.Value.NameKey, sp.Value.NameKo); var n = NpcOf(id); return GoLocalization.T(n.ShortKey, n.ShortKo); }
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
            if (n.AtSite != null) return AreaPos(n.AtSite, n.AtOff);
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
            for (int i = 1; i < n.Path.Length; i++) len += Vector2.Distance(n.Path[i - 1], n.Path[i]) * (n.FrostPath || n.PathAt != null ? 1f : TestMapData.TileSize);
            return len;
        }

        /// <summary>길 위 거리 d(m) 의 자리 — 길 끝을 넘으면 끝.</summary>
        public static Vector3 PathPos(Npc n, float d)
        {
            for (int i = 1; i < n.Path.Length; i++)
            {
                float seg = Vector2.Distance(n.Path[i - 1], n.Path[i]) * (n.FrostPath || n.PathAt != null ? 1f : TestMapData.TileSize);
                if (d <= seg)
                {
                    Vector2 g = Vector2.Lerp(n.Path[i - 1], n.Path[i], seg > 0f ? d / seg : 1f);
                    return n.PathAt != null ? AreaPos(n.PathAt, g) : n.FrostPath ? FrostPos(g) : GridPos(g.x, g.y);
                }
                d -= seg;
            }
            var e = n.Path[n.Path.Length - 1];
            return n.PathAt != null ? AreaPos(n.PathAt, e) : n.FrostPath ? FrostPos(e) : GridPos(e.x, e.y);
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
            var inArea = from != Vector3.zero ? GoAreas.AreaAt(from) : null;
            if (inArea != null && !inArea.Contains(t)) return inArea.SteleGround; // 109-14-68 독립 땅 안인데 목표가 그 땅 밖이면 땅 쪽 나가는 돌기둥
            if (from != Vector3.zero && GoFrost.Contains(t) && !GoFrost.Contains(from)) return GoFrost.GatePos;
            var ta = GoAreas.AreaAt(t);
            if (from != Vector3.zero && ta != null && ta != GoAreas.AreaAt(from)) return ta.MapGate(); // 109-14-38 독립 땅 안 목표인데 내가 밖이면 지도 쪽 돌기둥
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
                case StepType.Go: radius = s.GoRadius > 0f ? s.GoRadius : GoR; return s.Altar ? WeeklyAltarPos() : s.Frost || s.Yard || s.Stn || s.At != null ? StepPos(s) : GridPos(s.Gx, s.Gy);
                case StepType.Boss: return TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                case StepType.Domain: return SitePos(s.Site);
                case StepType.Light: radius = LightR; return StepPos(s);
                case StepType.Seal: return SealPos(s);
                case StepType.Climb: return s.At != null ? ClimbTopOf(s.At) : s.Yard ? CraneTop : DuelPeak.Top;
                case StepType.Party: return NpcPos("elder");
                case StepType.Sky: radius = DraftR; return s.Eye ? EyePillarPos : s.Route != null ? RoutePillarPos(RouteIndex(s.Route)) : s.Obs ? ObsPillarPos : DuelPeak.Top; // 109-14-20 바람 기둥 = 봉우리 정상 · 109-14-35 시간 기둥
                case StepType.Gather:
                {
                    Vector3 best = from; float bd = float.MaxValue;
                    foreach (var node in System.Linq.Enumerable.Concat(GoCooking.Nodes, GoCooking.SunkenNodes))
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
