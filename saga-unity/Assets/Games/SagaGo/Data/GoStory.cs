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
        public static Vector3 SailDest(Step s) => s.Route != null ? RoutePos(RouteIndex(s.Route), s.Arena ?? Vector2.zero) : s.Sky && s.Rift ? RiftPos(s.Arena ?? Vector2.zero) : s.At != null ? AreaPos(s.At, s.Arena ?? Vector2.zero) : s.ToIsle ? IslePos(IsleLand) : GridPos(DockGx, DockGy);
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
            a.Route != null ? RoutePos(RouteIndex(a.Route), a.Arena) : a.Sky && a.Rift ? RiftPos(a.Arena) : a.At != null ? AreaPos(a.At, a.Arena) : a.Stn ? StationPos(a.Arena) : a.Yard ? YardPos(a.Arena) : a.Sky && a.Obs ? DeckPos(a.Arena) : a.Frost ? FrostPos(a.Arena) : a.Sky ? SkyPos(a.Arena) : a.Summit ? DuelPeak.Top + new Vector3(a.Arena.x, 0f, a.Arena.y) : a.Isle ? IslePos(a.Arena) : a.Peak ? ArenaPos(a.Arena) : a.Path ? PathPos(n, step == FollowStepOf(n.Id, ch) ? followDist : float.MaxValue) : GridPos(a.Gx, a.Gy);

        // ---- 109-14-28 10장 서리봉 고원 자리(고원 가운데에서 m — 웹 명소 자리 × 0.45 위에 얹는다) ----
        public static readonly Vector2 HaramObs = FrostAt("obs", 0f, 9f), HaramShip = FrostAt("ship", -7f, 13f), BandiShip = FrostAt("ship", 1f, 12f), HaramFort = FrostAt("fort", 0f, 16f);
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
            return AreaPos(at, Vector2.zero) + Vector3.up * (at == "crossing:clock" ? ClockHeight : at == "sunken:lighthouse" ? LightHeight : TowerHeight);
        }
        public static bool OnClimbTop(string at, Vector3 p)
        {
            Vector3 top = ClimbTopOf(at);
            float r = at == "crossing:steps" ? 1.6f : (at == "crossing:clock" ? ClockHalf : at == "sunken:lighthouse" ? LightHalf : TowerHalf) + 0.6f;
            return Flat(p, top) <= r && p.y >= top.y - 1.2f;
        }
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
                },
                IdleKey = "story.idle.haram", IdleKo = "바늘이 또 얼었네… 눈은 언제 그치려나." },
            new Npc { Id = "bandi", NameKey = "story.npc.bandi", NameKo = "조종 기계 반디", ShortKey = "story.short.bandi", ShortKo = "반디",
                Gx = 4.5f, Gy = 0.5f, Pet = true,
                Appear = new[] { new Spot { Ch = 9, From = 6, To = 8, Frost = true, Arena = BandiShip }, new Spot { Ch = 10, From = 0, To = 8, Frost = true, Arena = BandiShip },
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
                    new Spot { Ch = 25, From = 1, To = 99, Route = "orbit", Arena = OrbitBandi }, new Spot { Ch = 26, From = 0, To = 99, Gx = 4.5f, Gy = 0.5f } }, // 8부(27장~) 반디는 청하 촌장 곁 마을
                IdleKey = "story.idle.bandi", IdleKo = "삐— 별배 심장 온도, 계속 하락 중." },
            // 109-14-42 19장(웹 ⑲-42) — 별배 선장 한별: 첫 정거장 승강장 남쪽 끝에 서고(19장 뒤 20장까지), 19장 8~10째 단계엔 섬돌 밑 틈 수정 아래 (20장에서 동료)
            new Npc { Id = "hanbyeol", NameKey = "story.npc.hanbyeol", NameKo = "별배 선장 한별", ShortKey = "story.short.hanbyeol", ShortKo = "한별",
                AtSite = "crossing:platform", AtOff = CrossHanbyeol, FolkBody = "Vanguard",
                Appear = new[] { new Spot { Ch = 18, From = 7, To = 9, At = "crossing:steps", Arena = CrossStepsHanbyeol }, new Spot { Ch = 19, From = 0, To = 1, At = "crossing:platform", Arena = CrossHanbyeol }, new Spot { Ch = 19, From = 2, To = 10, Sky = true, Rift = true, Arena = RiftHanbyeol },
                    new Spot { Ch = 20, From = 0, To = 1, At = "skyport:port", Arena = SunkPortHanbyeol }, new Spot { Ch = 20, From = 2, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 21, From = 0, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 22, From = 0, To = 99, At = "sunken:gate", Arena = SandHanbyeol }, new Spot { Ch = 23, From = 0, To = 1, At = "sunken:gate", Arena = SandHanbyeol },
                    new Spot { Ch = 23, From = 2, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 24, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 25, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol }, new Spot { Ch = 26, From = 0, To = 99, Route = "shrine", Arena = ShrineHanbyeol } },
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
                Appear = new[] { new Spot { Ch = 25, From = 6, To = 6, Route = "orbit", Arena = OrbitGamyeon } },
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
            /// <summary>109-14-50 defend — 물결이 나오는 거리(0 이면 `DefendRing`) — 작은 하늘 섬 위에서 섬 밖으로 안 나오게.</summary>
            public float Ring;
        }

        public static Vector3 StepPos(Step s) => s.Route != null ? RoutePos(RouteIndex(s.Route), s.Arena ?? Vector2.zero) : s.Sky && s.Rift ? RiftPos(s.Arena ?? Vector2.zero) : s.At != null ? AreaPos(s.At, s.Arena ?? Vector2.zero) : s.Stn ? StationPos(s.Arena ?? Vector2.zero) : s.Yard ? YardPos(s.Arena ?? Vector2.zero) : s.Sky && s.Obs ? DeckPos(s.Arena ?? Vector2.zero) : s.Frost ? FrostPos(s.Arena ?? Vector2.zero) : s.Sky ? SkyPos(s.Arena ?? Vector2.zero) : s.Isle ? IslePos(s.Arena ?? Vector2.zero) : s.Arena.HasValue ? ArenaPos(s.Arena.Value) : GridPos(s.Gx, s.Gy);

        /// <summary>석등 차례(해·달·별이 기본, 8장은 별·달·해).</summary>
        public static string[] OrderOf(Step s) => s.Order ?? SealOrder;

        /// <summary>석등 가운데 — 5장 둘째 제단 또는 섬(8장).</summary>
        public static Vector3 SealPos(Step s) => s.Frost || s.Rift || s.At != null || s.Route != null ? StepPos(s) : s.Isle ? IslePos(Vector2.zero) : s.Gx != 0f || s.Gy != 0f ? GridPos(s.Gx, s.Gy) : GridPos(Altar2Gx, Altar2Gy);

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
            // 109-14-36 15장(웹 ⑲-36) — 3부 끝, 옛 역참 길: 반디 → 옛 역참 터(남쪽 공터·논밭 사이 길 칸) → 파발꾼 달음 → 놀란 역마 쫓기 → 달음 → 여우불 무리 → 여우불 구미호(화, 절반에서 화 방패 — 물로)
            // → 달음 → 고원 별배 → 날개 이음매에 원소 → 반디(달음 곁) · 달음 합류. 장이 끝나면 별배가 뜬다(`FrostField` 가 선체를 9m 띄운다).
            new Chapter
            {
                Id = "ch15", NameKey = "story.ch15", NameKo = "제15장 · 옛 역참 길", Ar = 36, Join = "story_dareum",
                Gold = 4250, Mats = new[] { 0, 5, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch15.s1", TextKo = "추락한 비행선의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch15.s1.l1", "삐— 셋째 조각 신호. 시대 표지는 뒤 — 아주 오래전. 좌표는 청하 마을 남쪽 옛 길입니다."),
                            L("bandi", "story.ch15.s1.l2", "같은 자리에 차가운 신호가 하나 더. 꼬리 아홉… 구미호입니다. 그런데 이번엔 뜨겁습니다."),
                            Pick("story.ch15.s1.p", "뜨겁다고?", "구미호가 먼저 가 있구나."),
                            L("bandi", "story.ch15.s1.l3", "옛 시대의 여우불을 먹은 것으로 보입니다. 조심하십시오."),
                        } },
                    new Step { Type = StepType.Go, Stn = true, Arena = Vector2.zero, TextKey = "story.ch15.s2", TextKo = "청하 마을 남쪽 옛 역참 길로" },
                    new Step { Type = StepType.Talk, Npc = "dareum", TextKey = "story.ch15.s3", TextKo = "역참 터 앞의 파발꾼 달음과 이야기하기",
                        Lines = new[]
                        {
                            L("dareum", "story.ch15.s3.l1", "어이쿠, 길손이구려! 여기가 어딘지 아시오? 나는 분명 한양 가는 파발을 달리던 참인데…"),
                            L("dareum", "story.ch15.s3.l2", "사흘 전 밤, 하늘에서 떨어진 빛 조각을 주웠소. 파발 주머니에 넣은 순간 눈앞이 번쩍 — 정신 차려 보니 이 길이오."),
                            Pick("story.ch15.s3.p", "그 조각, 우리가 찾던 거예요.", "지금 조각은 어디 있어요?"),
                            L("dareum", "story.ch15.s3.l3", "말 안장 주머니에… 아니, 저놈! 흰 여우불에 놀라 말이 달아나오! 저 말부터 잡아 주시오!"),
                        } },
                    new Step { Type = StepType.Chase, Npc = "horse", TextKey = "story.ch15.s4", TextKo = "여우불에 놀라 달아난 역마 따라잡기(달리기)",
                        EnterKey = "story.ch15.flee", EnterKo = "🐎 역마가 여우불 냄새에 놀라 내달린다 — 달려라!",
                        WinKey = "story.ch15.caught", WinKo = "🐎 역마의 고삐를 붙잡았다 — 워, 워",
                        LostKey = "story.ch15.lost", LostKo = "💨 놓쳤다 — 역마가 처음 자리로 돌아갔다. 다시 가까이 가면 달아난다" },
                    new Step { Type = StepType.Talk, Npc = "dareum", TextKey = "story.ch15.s5", TextKo = "달음에게 역마 데려다주기",
                        Lines = new[]
                        {
                            L("dareum", "story.ch15.s5.l1", "워, 워— 착하지. 고맙소, 길손. 그런데 이걸 보시오. 안장 주머니가 불에 그을려 찢겼소."),
                            L("dareum", "story.ch15.s5.l2", "여우불이 말을 쫓은 게 아니었소. 주머니를 노린 게요. 조각을 문 흰 여우가 길 남쪽 끝으로 갔소."),
                            Pick("story.ch15.s5.p", "구미호예요. 되찾아 올게요.", "같이 가요."),
                            L("dareum", "story.ch15.s5.l3", "파발꾼은 길을 잃은 짐을 끝까지 쫓는 법이오. 앞장서시오!"),
                        } },
                    new Step { Type = StepType.Kill, Stn = true, Arena = StationFight,
                        Foes = new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch15.enter1", EnterKo = "길 위에 여우불이 번지며 도깨비들이 튀어나왔다",
                        TextKey = "story.ch15.s6", TextKo = "길을 막은 여우불 무리 물리치기" },
                    new Step { Type = StepType.Duel, Stn = true, Arena = StationDuel, Foes = new[] { F(FieldEnemy.Kind.EmberImp) },
                        BossKey = "story.boss.emberfox", BossKo = "여우불 구미호", HpMul = 12.8f, AtkMul = 2.3f, ScaleMul = 1.9f,
                        Rot = new[] { FieldEnemy.BossMove.Rift, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Rift, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Halo },
                        P2El = GoElement.Pyro, Adds = new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith) },
                        EnterKey = "story.ch15.enter2", EnterKo = "여우불을 두른 흰 여우가 길을 막아섰다 — 여우불 구미호!",
                        P2Key = "story.ch15.p2", P2Ko = "여우불 구미호가 옛 길의 여우불을 둘렀다 — 물로 깨라! 도깨비와 날쌘용이 뛰어든다",
                        WinKey = "story.ch15.win", WinKo = "여우불 구미호가 날개 조각을 떨구고 — 닫히는 시간 틈 속으로 흩어졌다",
                        TextKey = "story.ch15.s7", TextKo = "셋째 조각을 문 여우불 구미호와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "dareum", TextKey = "story.ch15.s8", TextKo = "달음과 이야기하기",
                        Lines = new[]
                        {
                            L("dareum", "story.ch15.s8.l1", "해냈소! 그 여우, 이제 틈 너머로도 못 돌아오겠구려. 자, 셋째 조각이오."),
                            L("dareum", "story.ch15.s8.l2", "그런데 길손, 이 조각이 가야 할 곳이 있다고 했지요? 파발은 받는 이 손에 닿아야 끝나는 법이오."),
                            Pick("story.ch15.s8.p", "서리봉 고원 별배로 가요.", "같이 가 줄래요?"),
                            L("dareum", "story.ch15.s8.l3", "말은 여기 두고, 발로 먼저 가 있겠소. 파발꾼 다리를 얕보지 마시오!"),
                        } },
                    new Step { Type = StepType.Go, Frost = true, Arena = FrostAt("ship", 0f, 14f), TextKey = "story.ch15.s9", TextKo = "날개 조각 셋을 들고 서리봉 고원 별배로" },
                    new Step { Type = StepType.Light, Frost = true, Arena = WingSeam, TextKey = "story.ch15.s10", TextKo = "별배 날개 이음매에 조각 셋을 끼우고 원소 스킬로 불 넣기" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch15.s11", TextKo = "반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch15.s11.l1", "삐— 날개 조각 셋, 연결 완료. 별배 심장 출력 백 퍼센트. 기동합니다!"),
                            L("dareum", "story.ch15.s11.l2", "허어, 쇳덩이 배가 하늘로… 내 평생 이런 파발은 처음이오."),
                            Pick("story.ch15.s11.p", "드디어 떴다!", "반디, 이제 어디로 가?"),
                            L("bandi", "story.ch15.s11.l3", "틈이 닫히는 방향을 따라가면 이 배가 온 시대에 닿을 겁니다. 그 전까지 — 이 하늘은 여러분 것입니다."),
                            L("dareum", "story.ch15.s11.l4", "그 길, 나도 따라가겠소. 파발꾼은 길 끝을 봐야 직성이 풀리니까!"),
                        } },
                }
            },
            // 109-14-38 16장(웹 ⑲-38) — 4부 첫 장, 별배가 돌아온 나루: 별배 곁 반디 → 틈 고개 너머 은하 나루 → 나루지기 아라 → 착륙판 무리 → 아라 → 계류 탑 옆면 타기(꼭대기에 서야) → 반디(별배를 몰고 옴 — 이때부터 나루에 매임)
            // → 계류된 별배 지키기(부스 쪽 동쪽을 뺀 일곱 방향) → 아라. 탑 단계를 지나면 빛 공이 켜지고 별배가 착륙판 위 6m 에 매이며 고원 별배는 떠난다.
            new Chapter
            {
                Id = "ch16", NameKey = "story.ch16", NameKo = "제16장 · 별배가 돌아온 나루", Ar = 38,
                Gold = 4500, Mats = new[] { 0, 5, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch16.s1", TextKo = "별배 곁의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch16.s1.l1", "삐— 별배가 뜨고 나서 틈이 닫히는 방향을 쫓았습니다. 마을 남쪽 끝 논밭 너머입니다."),
                            L("bandi", "story.ch16.s1.l2", "그곳에 틈이 문처럼 열렸습니다. 문 너머 좌표는… 제 기억 속 별배의 집, 은하 나루."),
                            Pick("story.ch16.s1.p", "별배가 온 곳이구나.", "같이 가 보자."),
                            L("bandi", "story.ch16.s1.l3", "먼저 가 주십시오. 나루의 계류 신호가 살아 있으면 별배를 몰고 뒤따르겠습니다."),
                        } },
                    new Step { Type = StepType.Go, At = "skyport:gate", Arena = new Vector2(0f, -8f), TextKey = "story.ch16.s2", TextKo = "마을 남쪽 끝, 틈 고개 너머 은하 나루로" },
                    new Step { Type = StepType.Talk, Npc = "ara", TextKey = "story.ch16.s3", TextKo = "별배 나루의 나루지기 아라와 이야기하기",
                        Lines = new[]
                        {
                            L("ara", "story.ch16.s3.l1", "…손님? 틈 고개로 사람이 넘어온 건 몇 해 만이에요!"),
                            Pick("story.ch16.s3.p", "별배를 알아요?", "여기가 은하 나루예요?"),
                            L("ara", "story.ch16.s3.l2", "별배는 이 나루의 배였어요. 어느 밤 선장님을 태우고 틈으로 떠난 뒤로 돌아오지 않았죠. 저는 그날부터 기다렸고요."),
                            L("ara", "story.ch16.s3.l3", "별배가 살아 있다고요? 그럼 — 앗, 틈 짐승들이 착륙판을 차지했어요!"),
                        } },
                    new Step { Type = StepType.Kill, At = "skyport:port", Arena = PortFight,
                        Foes = new[] { F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo) },
                        EnterKey = "story.ch16.enter1", EnterKo = "착륙판 위에 시간 틈 짐승들이 버티고 섰다",
                        TextKey = "story.ch16.s4", TextKo = "착륙판을 차지한 시간 틈 무리 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "ara", TextKey = "story.ch16.s5", TextKo = "아라와 이야기하기",
                        Lines = new[]
                        {
                            L("ara", "story.ch16.s5.l1", "고마워요. 이제 계류 탑 신호만 켜면 돼요. 꼭대기 빛 공이 꺼져서 별배가 길을 못 찾을 거예요."),
                            L("ara", "story.ch16.s5.l2", "승강기는 녹아내렸고… 탑 옆면을 타고 오를 수 있겠어요? 열여덟 미터예요."),
                            Pick("story.ch16.s5.p", "올라가 볼게요.", "높네요…"),
                            L("ara", "story.ch16.s5.l3", "꼭대기에 서면 신호가 저절로 켜져요. 떨어지면 날개를 펴요!"),
                        } },
                    new Step { Type = StepType.Climb, At = "skyport:port", EnterKey = "story.ch16.climbed", EnterKo = "💡 계류 탑 꼭대기 — 빛 공에 신호가 켜졌다",
                        TextKey = "story.ch16.s6", TextKo = "계류 탑 옆면을 타고 꼭대기로 올라 신호 켜기" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch16.s7", TextKo = "별배를 몰고 온 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch16.s7.l1", "삐— 계류 신호 수신. 별배, 은하 나루에 계류 완료. …돌아왔습니다."),
                            L("ara", "story.ch16.s7.l2", "정말 별배예요… 날개가 바뀌었지만 틀림없어요!"),
                            Pick("story.ch16.s7.p", "어서 와, 별배.", "반디, 수고했어."),
                            L("ara", "story.ch16.s7.l3", "그런데 계류 불빛에 틈 짐승들이 또 몰려와요. 계류 팔이 풀리면 별배가 또 떠내려가요!"),
                        } },
                    new Step { Type = StepType.Defend, At = "skyport:port", Arena = PortAltar, NameKey = "story.altar_moored", NameKo = "계류된 별배", Dirs = new[] { 0f, 45f, 135f, 180f, 225f, 270f, 315f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro) },
                        },
                        TextKey = "story.ch16.s8", TextKo = "별배 계류대 지키기" },
                    new Step { Type = StepType.Talk, Npc = "ara", TextKey = "story.ch16.s9", TextKo = "아라와 이야기하기",
                        Lines = new[]
                        {
                            L("ara", "story.ch16.s9.l1", "지켰어요… 별배가 다시 나루에 있어요. 고마워요."),
                            L("bandi", "story.ch16.s9.l2", "삐— 별배 항해 기록 복구. 마지막 기록: 선장, 옛 절터 종소리를 따라 틈으로."),
                            Pick("story.ch16.s9.p", "선장님이 절터로?", "종소리?"),
                            L("ara", "story.ch16.s9.l3", "절터 종은 수백 년 전에 떨어져 나뒹구는데… 가끔 밤마다 울려요. 선장님이 거기서 무언가를 들으셨나 봐요."),
                            L("ara", "story.ch16.s9.l4", "나루는 제가 지킬게요. 별배도 여기 쉬게 두세요. 이제 여기가 여러분 나루이기도 하니까!"),
                        } },
                }
            },
            // 109-14-39 17장(웹 ⑲-39) — 4부 둘째 장, 옛 절터의 종: 아라 → 옛 절터 → 종지기 한결 → 쓰러진 종 곁 무리 → 한결 → 이끼 이무기(2단계 초 방패 — 풍으로) → 한결 → 반디(견인 빛줄로 종을 종각에 — 이때부터 걸린다)
            // → 종각 종 울리기(등롱 없이 원소) → 한결. 덩굴뱀·회오리매는 14-1b(새 몸) 전까지 옛 몸에 초·풍, 이끼 이무기는 물귀신 몸을 키워 초로.
            new Chapter
            {
                Id = "ch17", NameKey = "story.ch17", NameKo = "제17장 · 옛 절터의 종", Ar = 40,
                Gold = 4750, Mats = new[] { 0, 5, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "ara", TextKey = "story.ch17.s1", TextKo = "나루지기 아라와 이야기하기",
                        Lines = new[]
                        {
                            L("ara", "story.ch17.s1.l1", "어젯밤에도 울렸어요. 옛 절터 쪽에서 — 뎅, 하고 딱 한 번."),
                            Pick("story.ch17.s1.p", "떨어진 종이 운다고?", "선장님 기록의 그 종소리?"),
                            L("ara", "story.ch17.s1.l2", "절터엔 늘 한 분이 계세요. 스스로 종지기라고 하시는데… 종이 떨어진 지 수백 년인데도요."),
                            L("ara", "story.ch17.s1.l3", "선장님이 무얼 들으셨는지, 그분이라면 알 거예요."),
                        } },
                    new Step { Type = StepType.Go, At = "skyport:temple", Arena = Vector2.zero, TextKey = "story.ch17.s2", TextKo = "은하 나루 서쪽 옛 절터로" },
                    new Step { Type = StepType.Talk, Npc = "hangyeol", TextKey = "story.ch17.s3", TextKo = "옛 절터의 종지기 한결과 이야기하기",
                        Lines = new[]
                        {
                            L("hangyeol", "story.ch17.s3.l1", "종을 찾아왔소? …별배를 탄 그 선장도 같은 말을 했지."),
                            Pick("story.ch17.s3.p", "선장님을 만났어요?", "종은 어디 있어요?"),
                            L("hangyeol", "story.ch17.s3.l2", "나는 이 절의 종지기요. 종각이 무너지던 밤 종을 붙들다 시간 틈에 휩쓸려 — 눈을 떠 보니 절은 주춧돌만 남았더군."),
                            L("hangyeol", "story.ch17.s3.l3", "종은 그때 서쪽 비탈로 굴러떨어졌소. 요즘 밤마다 우는 건 종이 아니오 — 종을 감은 무언가가 틈 짐승을 부르는 소리지."),
                            L("hangyeol", "story.ch17.s3.l4", "선장도 그 울음을 따라 비탈로 갔소. 먼저 비탈에 몰린 짐승들부터 쫓아 주시오."),
                        } },
                    new Step { Type = StepType.Kill, At = "skyport:bell", Arena = BellFight,
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro), F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch17.enter1", EnterKo = "이끼 덮인 종 곁에 틈 짐승들이 똬리를 틀었다",
                        TextKey = "story.ch17.s4", TextKo = "쓰러진 종 곁에 몰려든 틈 짐승 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "hangyeol", TextKey = "story.ch17.s5", TextKo = "쓰러진 종 곁의 한결과 이야기하기",
                        Lines = new[]
                        {
                            L("hangyeol", "story.ch17.s5.l1", "이 종이오. 이끼가 두껍게 덮였어도 소리는 그대로요."),
                            L("hangyeol", "story.ch17.s5.l2", "…쉿. 종 속에서 무언가 몸을 뒤채는 소리가 들리오?"),
                            Pick("story.ch17.s5.p", "뭔가 있어요!", "물러나요!"),
                            L("hangyeol", "story.ch17.s5.l3", "이무기요! 틈에서 기어 나와 종에 똬리를 틀고 수백 년 이끼를 먹은 놈 — 덩굴 비늘은 바람이 찢소!"),
                        } },
                    new Step { Type = StepType.Duel, At = "skyport:bell", Arena = BellDuel, Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro) },
                        BossKey = "story.boss.mossserpent", BossKo = "이끼 이무기", HpMul = 13.6f, AtkMul = 2.3f, ScaleMul = 1.9f,
                        Rot = new[] { FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Spit },
                        P2El = GoElement.Dendro, Adds = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch17.enter2", EnterKo = "종을 감고 있던 이끼 이무기가 머리를 들었다!",
                        P2Key = "story.ch17.p2", P2Ko = "이끼 이무기가 덩굴 비늘을 곤두세웠다 — 바람으로 찢어라! 덩굴뱀과 회오리매가 뛰어든다",
                        WinKey = "story.ch17.win", WinKo = "이무기가 종에서 풀려나 — 틈 속으로 스르르 사라졌다",
                        TextKey = "story.ch17.s6", TextKo = "종을 감은 이끼 이무기와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "hangyeol", TextKey = "story.ch17.s7", TextKo = "한결과 이야기하기",
                        Lines = new[]
                        {
                            L("hangyeol", "story.ch17.s7.l1", "풀려났소… 종이 다시 숨을 쉬는구려."),
                            L("hangyeol", "story.ch17.s7.l2", "허나 이 무게를 어찌 종각까지 올린단 말이오. 옛날엔 스님 서른이 밧줄로 끌어 올렸소."),
                            Pick("story.ch17.s7.p", "별배라면 들 수 있어요.", "반디를 불러 볼게요."),
                            L("hangyeol", "story.ch17.s7.l3", "하늘 배로 종을 든다고? …허허, 오래 살고 볼 일이오."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch17.s8", TextKo = "별배를 몰고 온 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch17.s8.l1", "삐— 별배 견인 빛줄 연결. 무게 십이 톤. 들어 올립니다."),
                            L("hangyeol", "story.ch17.s8.l2", "종이… 하늘을 나는구려!"),
                            Pick("story.ch17.s8.p", "종각 들보에 맞춰!", "천천히, 반디."),
                            L("bandi", "story.ch17.s8.l3", "삐— 종각 들보에 걸었습니다. 새 종고리는 별배 계류 쇠붙이로 만들었습니다."),
                            L("hangyeol", "story.ch17.s8.l4", "앞날의 쇠로 옛 종을 걸다니. 자, 이제 종을 울려 주시오 — 무엇으로든 힘껏!"),
                        } },
                    new Step { Type = StepType.Light, Bare = true, At = "skyport:temple", Arena = Belfry, EnterKey = "story.ch17.rung", EnterKo = "🔔 뎅— 종이 울렸다",
                        TextKey = "story.ch17.s9", TextKo = "종각에 다시 건 종을 원소 스킬로 울리기" },
                    new Step { Type = StepType.Talk, Npc = "hangyeol", TextKey = "story.ch17.s10", TextKo = "한결과 이야기하기",
                        Lines = new[]
                        {
                            L("hangyeol", "story.ch17.s10.l1", "…삼백 년 만의 종소리요. 이 소리를 다시 듣다니."),
                            L("bandi", "story.ch17.s10.l2", "삐— 종소리에 응답 신호. 남쪽, 은하역 방향 — 열차 기적 소리입니다."),
                            Pick("story.ch17.s10.p", "저 녹슨 역에서 열차가?", "선장님의 신호일까?"),
                            L("hangyeol", "story.ch17.s10.l3", "그 선장이 떠나며 말했소. '종이 다시 울리면 막차가 한 번 더 온다'고. 무슨 뜻인지는 나도 모르오."),
                            L("hangyeol", "story.ch17.s10.l4", "나는 이제 종 곁을 지키겠소. 종지기가 종 곁에 있어야지. 가 보시오 — 은하역으로."),
                        } },
                }
            },
            // 109-14-40 18장(웹 ⑲-40) — 4부 끝, 은하역 막차: 반디(종각) → 은하역 → 기관사 도담 → 태양광 밭 무리 → 변전함에 원소(등롱 없이 — 이때부터 막차에 불) → 도담 → 선장의 잔상 쫓기(선로 위)
            // → 도담(선로 끝) → 출발을 기다리는 막차 지키기(북쪽 객차 쪽 뺀 다섯 방향) → 도담 · 도담 합류. 라피드·바위곰은 14-1b 전까지 옛 몸+원소.
            new Chapter
            {
                Id = "ch18", NameKey = "story.ch18", NameKo = "제18장 · 은하역 막차", Ar = 42, Join = "story_dodam",
                Gold = 5000, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch18.s1", TextKo = "종각 곁의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch18.s1.l1", "삐— 기적 소리 분석 완료. 발신지 은하역, 신호 종류… 막차 운행 예고."),
                            L("bandi", "story.ch18.s1.l2", "역에 생체 신호 하나. 녹슨 역에 사람이 있습니다."),
                            Pick("story.ch18.s1.p", "가 보자, 은하역.", "막차라니…"),
                            L("bandi", "story.ch18.s1.l3", "먼저 가 주십시오. 저는 선로 위 하늘을 살피며 뒤따르겠습니다."),
                        } },
                    new Step { Type = StepType.Go, At = "skyport:station", Arena = Vector2.zero, TextKey = "story.ch18.s2", TextKo = "은하 나루 남쪽 은하역으로" },
                    new Step { Type = StepType.Talk, Npc = "dodam", TextKey = "story.ch18.s3", TextKo = "은하역의 기관사 도담과 이야기하기",
                        Lines = new[]
                        {
                            L("dodam", "story.ch18.s3.l1", "종소리 들었어요? 어젯밤 이 녹슨 막차 전조등이 혼자 깜빡였어요. 십 년 만에요!"),
                            L("dodam", "story.ch18.s3.l2", "나는 이 역 마지막 기관사예요. 선로가 끊긴 뒤로도 막차를 두고 떠날 수가 없어서."),
                            Pick("story.ch18.s3.p", "별배 선장님을 알아요?", "막차를 움직일 수 있어요?"),
                            L("dodam", "story.ch18.s3.l3", "선장이요? 그 사람이 막차 표를 끊었어요 — 행선지 칸이 비어 있는 표를. 그러고는 선로 끝 틈으로 걸어 들어갔죠."),
                            L("dodam", "story.ch18.s3.l4", "막차를 깨우려면 전기부터예요. 서쪽 태양광 밭 변전함이 틈 짐승들 때문에 꺼져 버렸어요."),
                        } },
                    new Step { Type = StepType.Kill, At = "skyport:farm", Arena = FarmFight,
                        Foes = new[] { F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo) },
                        EnterKey = "story.ch18.enter1", EnterKo = "부서진 태양광 판 사이로 틈 짐승들이 튀어나왔다",
                        TextKey = "story.ch18.s4", TextKo = "태양광 밭을 헤집는 틈 짐승 물리치기" },
                    new Step { Type = StepType.Light, Bare = true, At = "skyport:farm", Arena = SubstationOff, EnterKey = "story.ch18.powered", EnterKo = "⚡ 변전함에 전기가 들어왔다 — 은하역 쪽에서 불빛이 번쩍인다",
                        TextKey = "story.ch18.s5", TextKo = "꺼진 변전함에 원소 스킬로 전기 넣기" },
                    new Step { Type = StepType.Talk, Npc = "dodam", TextKey = "story.ch18.s6", TextKo = "도담과 이야기하기",
                        Lines = new[]
                        {
                            L("dodam", "story.ch18.s6.l1", "전조등이 켜졌어요! 막차가… 숨을 쉬어요!"),
                            L("dodam", "story.ch18.s6.l2", "어? 선로 위에 누가 — 저 모자, 선장이에요! 그런데 몸이 비쳐 보여요."),
                            Pick("story.ch18.s6.p", "선장님!", "잔상이야, 쫓아가자!"),
                            L("dodam", "story.ch18.s6.l3", "운행 기록부를 들고 남쪽 선로로 가요! 붙잡아 줘요, 나는 막차를 데워 둘게요!"),
                        } },
                    new Step { Type = StepType.Chase, Npc = "captain", TextKey = "story.ch18.s7", TextKo = "운행 기록부를 든 선장의 잔상 따라잡기(달리기)",
                        EnterKey = "story.ch18.flee", EnterKo = "👤 선장의 잔상이 기록부를 들고 선로 위로 달아난다 — 달려라!",
                        WinKey = "story.ch18.caught", WinKo = "👤 잔상을 붙잡자 — 흩어지며 운행 기록부만 남았다",
                        LostKey = "story.ch18.lost", LostKo = "💨 놓쳤다 — 잔상이 처음 자리로 돌아갔다. 다시 가까이 가면 달아난다" },
                    new Step { Type = StepType.Talk, Npc = "dodam", TextKey = "story.ch18.s8", TextKo = "선로 끝의 도담과 이야기하기",
                        Lines = new[]
                        {
                            L("dodam", "story.ch18.s8.l1", "잔상은 흩어지고… 기록부만 남았네요."),
                            L("dodam", "story.ch18.s8.l2", "마지막 장 — '막차 행선지: 틈 너머 첫 정거장. 선장은 먼저 내림.'"),
                            Pick("story.ch18.s8.p", "선장님은 틈 너머에 있어!", "다음 줄은?"),
                            L("dodam", "story.ch18.s8.l3", "끝 줄은 선장 글씨예요. '종이 울리고, 별배가 돌아오고, 막차가 달리면 — 그 정거장에서 다시 만나자.'"),
                            L("dodam", "story.ch18.s8.l4", "앗, 전조등 불빛을 보고 짐승들이 역으로 몰려가요! 막차가 데워질 때까지 지켜야 해요!"),
                        } },
                    new Step { Type = StepType.Defend, At = "skyport:station", Arena = TrainAt, NameKey = "story.altar_train", NameKo = "출발을 기다리는 막차", Dirs = new[] { 45f, 90f, 135f, 180f, 225f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.EmberImp) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro) },
                        },
                        TextKey = "story.ch18.s9", TextKo = "출발을 기다리는 막차 지키기" },
                    new Step { Type = StepType.Talk, Npc = "dodam", TextKey = "story.ch18.s10", TextKo = "도담과 이야기하기",
                        Lines = new[]
                        {
                            L("dodam", "story.ch18.s10.l1", "보일러 압력 정상, 전조등 이상 없음… 막차, 출발 준비 끝!"),
                            L("bandi", "story.ch18.s10.l2", "삐— 별배·종·막차, 세 신호 모두 확인. 선장이 남긴 좌표가 열립니다 — 틈 너머 첫 정거장."),
                            Pick("story.ch18.s10.p", "같이 가 줄래요, 도담?", "선장님을 만나러 가자."),
                            L("dodam", "story.ch18.s10.l3", "막차 기관사가 막차를 두고 갈 순 없죠. 틈 너머 첫 정거장까지 — 제가 몰게요!"),
                            L("bandi", "story.ch18.s10.l4", "별배는 나루에, 종은 절터에, 막차는 선로에. 이 시대의 길이 다시 이어졌습니다."),
                        } },
                }
            },
            // 109-14-42 19장(웹 ⑲-42) — 5부 첫 장, 틈 너머 첫 정거장: 도담 → 막차 타기(sail — 틈새 갈림길로) → 반디 → 갈림목 무리 → 멈춘 시계탑 옆면 타기(이때부터 바늘이 돈다) → 반디
            // → 떠 있는 섬돌 밟고 오르기 → 한별(섬돌 밑) → 멈춘 시간의 파수꾼(풍, 절반에서 풍 방패 — 암으로) → 한별. 눈여우·회오리매·임프는 14-1b 전까지 옛 몸+원소.
            new Chapter
            {
                Id = "ch19", NameKey = "story.ch19", NameKo = "제19장 · 틈 너머 첫 정거장", Ar = 44,
                Gold = 5250, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "dodam", TextKey = "story.ch19.s1", TextKo = "은하역의 도담과 이야기하기",
                        Lines = new[]
                        {
                            L("dodam", "story.ch19.s1.l1", "보일러도 전조등도 문제없어요. 선로 끝 고개의 틈도 활짝 열렸고요!"),
                            L("bandi", "story.ch19.s1.l2", "삐— 선장 신호, 틈 너머에서 미약하게 수신. 끊겼다 이어졌다 합니다."),
                            Pick("story.ch19.s1.p", "가자, 틈 너머로.", "선장님이 기다려."),
                            L("dodam", "story.ch19.s1.l3", "그럼 올라타요. 오늘은 막차가 첫차예요!"),
                        } },
                    new Step { Type = StepType.Sail, Npc = "dodam", At = "crossing:platform", Arena = CrossArrive, EnterKey = "story.ch19.arrive", EnterKo = "🚂 막차가 기적을 울리며 틈을 지나 첫 정거장에 닿았다",
                        Lines = new[] { L("dodam", "story.ch19.s2.l1", "막차, 출발합니다! 다음 정거장은 — 틈 너머 첫 정거장!") },
                        TextKey = "story.ch19.s2", TextKo = "도담의 막차를 타고 틈 너머로" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch19.s3", TextKo = "첫 정거장의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch19.s3.l1", "삐— 이곳의 시계는 모두 같은 시각에 멈춰 있습니다. 시간이 멈춘 곳에선 신호가 갇힙니다."),
                            L("dodam", "story.ch19.s3.l2", "저기 성문 조각이 허공에 떠 있어요… 시간이 뒤엉킨 땅이네요."),
                            Pick("story.ch19.s3.p", "신호를 풀 방법은?", "시계를 다시 돌리면?"),
                            L("bandi", "story.ch19.s3.l3", "남쪽 멈춘 시계탑 — 꼭대기 태엽을 풀면 신호가 풀릴 겁니다. 다만 갈림목에 틈 짐승이 모여 있습니다."),
                        } },
                    new Step { Type = StepType.Kill, At = "crossing:clock", Arena = CrossFork,
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch19.enter1", EnterKo = "뒤엉킨 갈림목에서 틈 짐승들이 시대를 가리지 않고 튀어나왔다",
                        TextKey = "story.ch19.s4", TextKo = "갈림목에 모인 틈 짐승 물리치기" },
                    new Step { Type = StepType.Climb, At = "crossing:clock", EnterKey = "story.ch19.clocked", EnterKo = "🕰️ 시계탑 꼭대기 — 태엽을 풀자 네 면 바늘이 다시 돈다",
                        TextKey = "story.ch19.s5", TextKo = "멈춘 시계탑을 타고 올라 태엽 풀기(꼭대기에 서기)" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch19.s6", TextKo = "시계탑 발치의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch19.s6.l1", "삐— 시계가 다시 갑니다! 선장 신호… 선명합니다!"),
                            L("bandi", "story.ch19.s6.l2", "발신지 서쪽, 떠 있는 섬돌 꼭대기. 섬돌을 밟고 오를 수 있습니다."),
                            Pick("story.ch19.s6.p", "바로 갈게!", "높이는?"),
                            L("bandi", "story.ch19.s6.l3", "열일곱 미터 남짓. 떨어지면 날개를 펴십시오."),
                        } },
                    new Step { Type = StepType.Climb, At = "crossing:steps", EnterKey = "story.ch19.stepped", EnterKo = "💎 마지막 섬돌에 올라섰다 — 섬돌 밑 틈 수정 아래에 누군가 서 있다",
                        TextKey = "story.ch19.s7", TextKo = "떠 있는 섬돌을 밟고 꼭대기에 오르기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch19.s8", TextKo = "섬돌 밑의 선장과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch19.s8.l1", "정말 왔구나. 종이 울리고, 별배가 돌아오고, 막차가 달렸다는 뜻이지."),
                            Pick("story.ch19.s8.p", "여기서 뭘 하고 계셨어요?", "반디가 기다렸어요."),
                            L("hanbyeol", "story.ch19.s8.l2", "나는 별배 선장 한별. 틈이 시대를 삼키던 날, 이 틈 한가운데서 시간을 멈춰 틈이 더 벌어지지 않게 붙들고 있었다."),
                            L("hanbyeol", "story.ch19.s8.l3", "그런데 너희가 시계를 다시 돌렸으니 — 멈춰 있던 파수꾼도 깨어난다. 내려와라, 섬돌 곁이다!"),
                        } },
                    new Step { Type = StepType.Duel, At = "crossing:steps", Arena = CrossDuel, Foes = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        BossKey = "story.boss.timewarden", BossKo = "멈춘 시간의 파수꾼", HpMul = 14.4f, AtkMul = 2.4f, ScaleMul = 2.0f,
                        Rot = new[] { FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Spit },
                        P2El = GoElement.Anemo, Adds = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        EnterKey = "story.ch19.enter2", EnterKo = "⏳ 멈춘 시간 조각을 두른 거인이 금빛 가면을 들었다 — 멈춘 시간의 파수꾼!",
                        P2Key = "story.ch19.p2", P2Ko = "파수꾼이 멈춘 바람을 둘렀다 — 바위로 깨라! 회오리매와 눈여우가 뛰어든다",
                        WinKey = "story.ch19.win", WinKo = "파수꾼의 금빛 가면이 부서지고 — 멈춘 시간 조각이 흩어졌다",
                        TextKey = "story.ch19.s9", TextKo = "깨어난 멈춘 시간의 파수꾼과 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch19.s10", TextKo = "선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch19.s10.l1", "고맙다. 이제 틈은 멈춰 있지 않는다. 스스로 닫히지도 않고 — 누군가 틈의 끝을 찾아가 닫아야 해."),
                            L("bandi", "story.ch19.s10.l2", "선장님… 별배는 은하 나루에 매여 있습니다."),
                            L("hanbyeol", "story.ch19.s10.l3", "알고 있다, 반디. 잘 지켜 줬구나. 날개가 바뀌었다지?"),
                            Pick("story.ch19.s10.p", "틈의 끝은 어디예요?", "같이 가요."),
                            L("hanbyeol", "story.ch19.s10.l4", "첫 정거장 다음 역은 '갈림길 끝'. 틈이 처음 찢어진 곳이지. 준비가 되면 — 함께 가자."),
                        } },
                }
            },
            // 109-14-43 20장(웹 ⑲-43) — 5부 끝, 갈림길 끝: 한별 → 막차로 섬 위(sail) → 반디 → 틈 짐승 다섯 → 한별 → 매듭 석등 달 → 별 → 해 → 한별(틈이 오므라든다) → 매듭 제단 지키기 → 한별 → 틈 삼킨 별까마귀(빙, 절반에서 빙 방패 — 화로)
            // → 한별 · 한별 합류(틈이 닫힌다). 섬 위는 첫 정거장 동남쪽 40m 하늘에 뜬 반지름 24m 돌 섬. 덩굴·바위곰·눈여우·회오리매는 14-1b(새 몸) 전까지 옛 몸+원소.
            new Chapter
            {
                Id = "ch20", NameKey = "story.ch20", NameKo = "제20장 · 갈림길 끝", Ar = 46, Join = "story_hanbyeol",
                Gold = 5500, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch20.s1", TextKo = "첫 정거장의 선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch20.s1.l1", "저 위를 보게. 동쪽 하늘에 뜬 섬 — 저기가 갈림길 끝, 틈이 처음 찢어진 곳이다."),
                            L("hanbyeol", "story.ch20.s1.l2", "틈이 찢어지던 날 선로가 통째로 들려 올라갔지. 막차 선로는 끊긴 채로 아직 그 섬까지 이어져 있어."),
                            Pick("story.ch20.s1.p", "막차로 갈 수 있어요?", "틈을 닫으러 가요."),
                            L("hanbyeol", "story.ch20.s1.l3", "도담에게 부탁하자. 반디는 벌써 날아 올라갔다."),
                        } },
                    new Step { Type = StepType.Sail, Npc = "dodam", Sky = true, Rift = true, Arena = RiftArrive, EnterKey = "story.ch20.arrive", EnterKo = "🚂 막차가 끊긴 선로 조각을 밟고 올라 갈림길 끝 차막이에 닿았다",
                        Lines = new[] { L("dodam", "story.ch20.s2.l1", "하늘로 끊긴 선로라도 선로는 선로죠! 막차, 갈림길 끝까지 — 출발!") },
                        TextKey = "story.ch20.s2", TextKo = "도담의 막차를 타고 갈림길 끝으로" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch20.s3", TextKo = "갈림길 끝의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch20.s3.l1", "삐— 이곳에서 선로가 세 갈래로 갈립니다. 옛 나무 선로, 쇠 선로, 빛 선로."),
                            L("dodam", "story.ch20.s3.l2", "갈래마다 끝이 뚝 끊겨 있네요. 가다 만 선로처럼……"),
                            L("bandi", "story.ch20.s3.l3", "세 갈래가 서로 엉키며 틈을 찢었습니다. 틈 한가운데에 짐승이 모여 있습니다."),
                            Pick("story.ch20.s3.p", "짐승부터 치우자.", "한가운데로 가자."),
                        } },
                    new Step { Type = StepType.Kill, Sky = true, Rift = true, Arena = Vector2.zero,
                        Foes = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro) },
                        EnterKey = "story.ch20.enter1", EnterKo = "찢어진 틈 밑에서 시대가 뒤섞인 짐승들이 쏟아져 나왔다",
                        TextKey = "story.ch20.s4", TextKo = "틈 한가운데에 모인 틈 짐승 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch20.s5", TextKo = "선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch20.s5.l1", "틈 밑을 보게. 옛 매듭 자리다 — 시대를 하나씩 묶어 두는 매듭이지."),
                            L("hanbyeol", "story.ch20.s5.l2", "틈이 찢어진 차례대로 묶어야 한다. 옛날의 달, 지금의 별, 앞날의 해."),
                            Pick("story.ch20.s5.p", "달, 별, 해.", "차례가 틀리면요?"),
                            L("hanbyeol", "story.ch20.s5.l3", "다 풀린다. 차례만 지키면 돼 — 원소를 매듭 석등에 대 보게."),
                        } },
                    new Step { Type = StepType.Seal, Sky = true, Rift = true, Arena = Vector2.zero, Order = new[] { "moon", "star", "sun" }, TextKey = "story.ch20.s6", TextKo = "틈 밑 매듭 석등을 차례(달 → 별 → 해)로 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch20.s7", TextKo = "선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch20.s7.l1", "삐— 세 갈래 끝의 닻이 켜졌습니다! 틈이 오므라듭니다!"),
                            L("hanbyeol", "story.ch20.s7.l2", "아직이다. 틈이 닫히려 하면 틈 너머 짐승들이 한꺼번에 몰려온다."),
                            Pick("story.ch20.s7.p", "매듭을 지킬게요.", "선장님은요?"),
                            L("hanbyeol", "story.ch20.s7.l3", "나는 틈을 붙들고 있겠다 — 매듭 제단이 무너지지 않게 지켜 다오!"),
                        } },
                    new Step { Type = StepType.Defend, Sky = true, Rift = true, Arena = Vector2.zero, NameKey = "story.altar_knot", NameKo = "매듭 제단", Dirs = new[] { 0f, 45f, 90f, 135f, 180f, 225f, 270f, 315f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.EmberImp) },
                        },
                        TextKey = "story.ch20.s8", TextKo = "틈이 닫히는 동안 매듭 제단 지키기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch20.s9", TextKo = "선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch20.s9.l1", "……온다. 틈을 처음 찢은 놈이다."),
                            L("hanbyeol", "story.ch20.s9.l2", "그날 세 갈래 선로를 한입에 삼키려다 틈을 찢고 스스로 틈 속에 갇혔던 짐승 — 틈 삼킨 별까마귀."),
                            L("dodam", "story.ch20.s9.l3", "저, 저 날개 좀 봐요! 섬만 해요!"),
                            Pick("story.ch20.s9.p", "같이 막아요, 선장님!", "여기서 끝내자."),
                            L("hanbyeol", "story.ch20.s9.l4", "그래, 함께다. 이번엔 멈춰 두지 않는다 — 끝낸다!"),
                        } },
                    new Step { Type = StepType.Duel, Sky = true, Rift = true, Arena = new Vector2(0f, -4f), Foes = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Cryo) },
                        BossKey = "story.boss.riftcrow", BossKo = "틈 삼킨 별까마귀", HpMul = 16f, AtkMul = 2.5f, ScaleMul = 2.2f,
                        Rot = new[] { FieldEnemy.BossMove.Rift, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Rift },
                        P2El = GoElement.Cryo, Adds = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                        EnterKey = "story.ch20.enter2", EnterKo = "🐦‍⬛ 섬만 한 날개가 틈을 가리고 내려앉았다 — 틈 삼킨 별까마귀!",
                        P2Key = "story.ch20.p2", P2Ko = "❄️ 별까마귀가 틈의 냉기를 두른다 — 불로 녹여라! 회오리매와 눈여우가 뛰어든다",
                        WinKey = "story.ch20.win", WinKo = "🐦‍⬛ 별까마귀가 틈 속으로 떨어지고 — 찢어진 틈이 소리 없이 닫혔다",
                        TextKey = "story.ch20.s10", TextKo = "틈을 처음 찢은 틈 삼킨 별까마귀와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch20.s11", TextKo = "선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch20.s11.l1", "……닫혔다. 틈이 처음 찢어진 곳이, 이제 그냥 하늘이다."),
                            L("bandi", "story.ch20.s11.l2", "삐— 세 갈래 선로 신호, 모두 안정. 옛날도 지금도 앞날도 제자리에 있습니다."),
                            L("dodam", "story.ch20.s11.l3", "막차는 계속 달릴 수 있겠네요. 첫 정거장도, 은하역도!"),
                            Pick("story.ch20.s11.p", "선장님은 이제 어떡하실 거예요?", "별배로 돌아가세요?"),
                            L("hanbyeol", "story.ch20.s11.l4", "별배는 나루에 매여 있고 틈은 닫혔다. 선장이 할 일은 다음 항로를 찾는 거지 — 이번엔 너희와 함께."),
                            L("hanbyeol", "story.ch20.s11.l5", "별배 선장 한별, 오늘부터 너희 편에 선다. 잘 부탁하네."),
                        } },
                }
            },
            // 109-14-45 21장(웹 ⑲-45) — 6부 첫 장, 바다 밑 등불: 한별(별배 곁) → 별배 타기(sail — 잠긴 도읍 해무 어귀 안쪽) → 반디 → 기지 앞 물짐승 → 잔교 따라 선착장 → 여울
            // → 잠수정 타기(sail — 궁궐 기단) → 여울(테왁 불빛·반디의 지워진 칸 "등대"). 두꺼비·날쌘용·회오리매는 14-1b 전까지 옛 몸+원소.
            new Chapter
            {
                Id = "ch21", NameKey = "story.ch21", NameKo = "제21장 · 바다 밑 등불", Ar = 48,
                Gold = 5750, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch21.s1", TextKo = "은하 나루 별배 곁의 선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch21.s1.l1", "틈이 닫힌 날부터 별배 항로표에 없던 불빛 하나가 떠 있다. 소금 갯벌 너머 바다 밑이야."),
                            L("bandi", "story.ch21.s1.l2", "삐— 그 좌표… 별배가 떨어지기 전에 가려던 항로 끝과 같습니다. 그런데 제 기록엔 그 까닭이 없습니다."),
                            L("hanbyeol", "story.ch21.s1.l3", "선장이 제 항로를 모르면 안 되지. 원래 가려던 곳을 확인하러 가자."),
                            Pick("story.ch21.s1.p", "별배로 가요.", "바다 밑이라니…"),
                            L("hanbyeol", "story.ch21.s1.l4", "별배는 물에 못 들어가지만 바다 위까진 간다. 타게!"),
                        } },
                    new Step { Type = StepType.Sail, Npc = "hanbyeol", At = "sunken:gate", Arena = SandArrive, EnterKey = "story.ch21.arrive", EnterKo = "🛸 별배가 바다 위에서 멈칫하더니 — 잠긴 도읍 모래밭에 우리를 내려 주었다",
                        Lines = new[] { L("hanbyeol", "story.ch21.s2.l1", "별배, 남쪽 바다로! 반디, 항로를 잡아 다오.") },
                        TextKey = "story.ch21.s2", TextKo = "선장의 별배를 타고 옛 항로 끝으로" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch21.s3", TextKo = "모래밭의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch21.s3.l1", "삐— 항로 신호가 여기서 물속으로 꺾입니다. 별배 기관이 저절로 멈췄습니다."),
                            L("hanbyeol", "story.ch21.s3.l2", "저 물속을 보게. 기와 지붕이… 도읍 하나가 통째로 잠겨 있어."),
                            L("bandi", "story.ch21.s3.l3", "궁궐 둘레에 불빛이 흔들립니다. 옛 해녀가 물질할 때 들던 등불과 같은 빛깔입니다."),
                            Pick("story.ch21.s3.p", "어떻게 내려가지?", "저 쇠 갑판은 뭐야?"),
                            L("bandi", "story.ch21.s3.l4", "모래밭 끝에 지금 시대의 해저 연구 기지가 있습니다. 잠수정 신호가 하나 살아 있습니다. 다만 기지 앞에 물짐승이 올라와 있습니다."),
                        } },
                    new Step { Type = StepType.Kill, At = "sunken:lab", Arena = LabFront,
                        Foes = new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch21.enter1", EnterKo = "⚔️ 기지 갑판 앞 모래밭에 물짐승들이 기어올라 왔다",
                        TextKey = "story.ch21.s4", TextKo = "해저 연구 기지 앞 모래밭에 올라온 물짐승 물리치기" },
                    new Step { Type = StepType.Go, At = "sunken:lab", Arena = LabDock, TextKey = "story.ch21.s5", TextKo = "기지 잔교를 따라 잠수정 선착장으로" },
                    new Step { Type = StepType.Talk, Npc = "yeoul", TextKey = "story.ch21.s6", TextKo = "잠수정 선착장의 여울과 이야기하기",
                        Lines = new[]
                        {
                            L("yeoul", "story.ch21.s6.l1", "누, 누구세요? 이 기지엔 이제 저 혼자뿐인데요."),
                            Pick("story.ch21.s6.p", "물속 불빛을 따라왔어요.", "별배 선장과 함께 왔어요."),
                            L("yeoul", "story.ch21.s6.l2", "저는 잠수 기사 여울. 해저 연구 기지 마지막 대원이에요. 틈이 닫히던 밤, 기지 불이 다 나갔어요."),
                            L("yeoul", "story.ch21.s6.l3", "그날부터 바다 밑에 옛 궁궐이 보이고, 그 둘레에 등불이 켜졌어요. 누군가 아직 물질을 하는 것처럼요."),
                            L("yeoul", "story.ch21.s6.l4", "잠수정은 살아 있어요. 불빛까지 모셔다 드릴게요 — 대신 저도 그 불빛이 뭔지 알고 싶어요."),
                        } },
                    new Step { Type = StepType.Sail, Npc = "yeoul", At = "sunken:palace", Arena = PlinthArrive, EnterKey = "story.ch21.arrive2", EnterKo = "🌊 잠수정이 물속 불빛 사이로 내려갔다가 — 잠긴 궁궐 기단 곁에 떠올랐다",
                        Lines = new[] { L("yeoul", "story.ch21.s7.l1", "해치 닫습니다. 잠수정, 물속 불빛을 따라 — 잠항!") },
                        TextKey = "story.ch21.s7", TextKo = "여울의 잠수정을 타고 물속 불빛을 따라가기" },
                    new Step { Type = StepType.Talk, Npc = "yeoul", TextKey = "story.ch21.s8", TextKo = "궁궐 기단 위의 여울과 이야기하기",
                        Lines = new[]
                        {
                            L("yeoul", "story.ch21.s8.l1", "가까이서 보니 등불이 아니었어요. 테왁 — 해녀들이 물에 띄우던 뒤웅박에 불이 들어 있어요."),
                            L("bandi", "story.ch21.s8.l2", "삐— 이 궁궐 좌표, 제 기록에… 있었습니다. 지워진 칸이 하나 있습니다. 읽을 수 없습니다."),
                            Pick("story.ch21.s8.p", "누가 지웠을까?", "괜찮아, 반디?"),
                            L("bandi", "story.ch21.s8.l3", "모르겠습니다. 다만 지워진 칸 끝에 적힌 말은 하나 — '등대'."),
                            L("yeoul", "story.ch21.s8.l4", "테왁이 궁궐 기와 사이로 이어져요. 물질하는 사람이 정말 있다면… 저 안쪽에 있을 거예요."),
                        } },
                }
            },
            // 109-14-46 22장(웹 ⑲-46) — 6부 둘째 장, 잠긴 궁궐의 해녀: 여울 → 물새(곁채 앞) → 바지락 셋(잠긴 도읍 갯벌 채집 포기) → 물새(돔 문 앞) → 물길 석등 해 → 별 → 달 → 물새
            // → 돔 문 자물쇠 지키기(동·서) → 여울(여덟째 단계부터 문이 열린다) → 심해 등불아귀(돔 안, 수 — 절반에서 수 방패, 번개로) → 물새. 두꺼비·날쌘용·회오리매는 14-1b 전까지 옛 몸+원소.
            new Chapter
            {
                Id = "ch22", NameKey = "story.ch22", NameKo = "제22장 · 잠긴 궁궐의 해녀", Ar = 50,
                Gold = 6000, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "yeoul", TextKey = "story.ch22.s1", TextKo = "궁궐 기단 위의 여울과 이야기하기",
                        Lines = new[]
                        {
                            L("yeoul", "story.ch22.s1.l1", "테왁 불빛이 동쪽 곁채 쪽에서 가장 밝아요. 누가 거기서 숨을 고르는 것 같아요."),
                            L("bandi", "story.ch22.s1.l2", "삐— 사람 한 명의 체온 신호. 곁채 앞에 있습니다."),
                            Pick("story.ch22.s1.p", "가 볼게.", "조심해서 다가가자."),
                            L("yeoul", "story.ch22.s1.l3", "물이 얕아도 기와가 미끄러워요. 천천히 가세요."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "mulsae", TextKey = "story.ch22.s2", TextKo = "곁채 앞의 해녀와 이야기하기",
                        Lines = new[]
                        {
                            L("mulsae", "story.ch22.s2.l1", "……뭍사람이 여기까지 오다니. 숨이 길구려."),
                            Pick("story.ch22.s2.p", "누구세요?", "테왁 불빛을 따라왔어요."),
                            L("mulsae", "story.ch22.s2.l2", "나는 해녀 물새. 도읍이 물에 잠기던 날 아침, 물질 나갔다가 그대로 이 물에 갇혔지."),
                            L("mulsae", "story.ch22.s2.l3", "그날부터 해가 몇 번 떴는지 모르겠소. 다만 저 둥근 빛 집 문이 닫혀 있는 건 알지."),
                            L("mulsae", "story.ch22.s2.l4", "문 앞 물길 석등 셋에 불을 넣으면 문이 풀린다오. 옛날엔 조개 기름으로 불을 살렸는데… 바지락 좀 캐다 주겠소?"),
                        } },
                    new Step { Type = StepType.Gather, Item = "clam", Count = 3, TextKey = "story.ch22.s3", TextKo = "석등 기름으로 쓸 바지락 셋 캐기(갯벌 물가)" },
                    new Step { Type = StepType.Talk, Npc = "mulsae", TextKey = "story.ch22.s4", TextKo = "빛 돔 문 앞의 물새와 이야기하기",
                        Lines = new[]
                        {
                            L("mulsae", "story.ch22.s4.l1", "기름은 됐소. 이제 차례가 문제지 — 물길 석등은 해 뜨는 쪽, 별 뜨는 쪽, 달 뜨는 쪽 차례로 켰다오."),
                            L("yeoul", "story.ch22.s4.l2", "기지 수중 조명 배치도에도 석등 자리가 적혀 있어요. 해, 별, 달 — 맞아요!"),
                            Pick("story.ch22.s4.p", "해, 별, 달.", "틀리면 어떻게 돼요?"),
                            L("mulsae", "story.ch22.s4.l3", "다 꺼지지. 물은 두 번 가르쳐 주지 않는다오."),
                        } },
                    new Step { Type = StepType.Seal, At = "sunken:dome", Arena = DomeFront, Order = new[] { "sun", "star", "moon" }, TextKey = "story.ch22.s5", TextKo = "빛 돔 문 앞 물길 석등을 차례(해 → 별 → 달)로 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "mulsae", TextKey = "story.ch22.s6", TextKo = "빛 돔 문 앞의 물새와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch22.s6.l1", "삐— 돔 문 빛 자물쇠가 돌기 시작했습니다. 다 풀리려면 시간이 걸립니다."),
                            L("mulsae", "story.ch22.s6.l2", "물이 술렁이는구려. 불을 보고 바다 것들이 몰려오고 있소."),
                            Pick("story.ch22.s6.p", "자물쇠를 지킬게요.", "어느 쪽에서 와요?"),
                            L("yeoul", "story.ch22.s6.l3", "동쪽과 서쪽이에요! 문 앞을 지켜 주세요!"),
                        } },
                    new Step { Type = StepType.Defend, At = "sunken:dome", Arena = DomeFront, NameKey = "story.altar_domelock", NameKo = "빛 돔 문 자물쇠", Dirs = new[] { 84f, 96f, 264f, 276f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        },
                        TextKey = "story.ch22.s7", TextKo = "빛 돔 문 자물쇠가 풀리는 동안 지키기" },
                    new Step { Type = StepType.Talk, Npc = "yeoul", TextKey = "story.ch22.s8", TextKo = "빛 돔 문 앞의 여울과 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch22.s8.l1", "삐— 자물쇠 해제. 빛 돔 문이 열립니다."),
                            L("yeoul", "story.ch22.s8.l2", "안이… 말라 있어요. 바다 밑인데 물이 한 방울도 없어요!"),
                            L("mulsae", "story.ch22.s8.l3", "저 안에 무언가 빛나는구려. 내가 본 테왁 불빛보다 훨씬 큰 것이."),
                            Pick("story.ch22.s8.p", "들어가 보자.", "조심해, 다들."),
                            L("mulsae", "story.ch22.s8.l4", "등불을 단 물고기라… 옛 어른들이 말하던 심해 등불아귀인가. 빛을 먹고 산다더니."),
                        } },
                    new Step { Type = StepType.Duel, At = "sunken:dome", Arena = DomeDuel, Foes = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Hydro) },
                        BossKey = "story.boss.angler", BossKo = "심해 등불아귀", HpMul = 16.8f, AtkMul = 2.5f, ScaleMul = 2.3f,
                        Rot = new[] { FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Spit, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Melee },
                        P2El = GoElement.Hydro, Adds = new[] { F(FieldEnemy.Kind.DrownedGhost), F(FieldEnemy.Kind.StormWraith) },
                        EnterKey = "story.ch22.enter", EnterKo = "🐟 돔 안 어둠 속에서 등불 하나가 떠올랐다 — 심해 등불아귀!",
                        P2Key = "story.ch22.p2", P2Ko = "💧 등불아귀가 물 비늘을 세운다 — 번개로 깨라! 물두꺼비와 날쌘용이 뛰어든다",
                        WinKey = "story.ch22.win", WinKo = "🐟 등불아귀의 등불이 꺼지고 — 어둠 속으로 비늘 조각만 흩어졌다",
                        TextKey = "story.ch22.s9", TextKo = "돔 안에 숨어 빛을 먹던 심해 등불아귀와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "mulsae", TextKey = "story.ch22.s10", TextKo = "돔 안의 물새와 이야기하기",
                        Lines = new[]
                        {
                            L("mulsae", "story.ch22.s10.l1", "……이 빛 집이 바다를 밀어내고 있었구려. 도읍이 잠기던 날에도 이 안만은 마른 땅이었을 테지."),
                            L("yeoul", "story.ch22.s10.l2", "저 안쪽 기록실 — 옛 기단 위에 앞 시대 단말이 서 있어요. 기지 자료에도 없는 건물이에요."),
                            L("bandi", "story.ch22.s10.l3", "삐— 기록실에서 제 신호와 같은 주파수가 나옵니다. 지워진 칸이… 저 안에 있습니다."),
                            Pick("story.ch22.s10.p", "기록실로 가자.", "물새 님도 같이 가요."),
                            L("mulsae", "story.ch22.s10.l4", "갇힌 줄로만 알았는데, 기다린 거였나 보오. 좋소 — 끝까지 같이 가 보지."),
                        } },
                }
            },
            // 109-14-47 23장(웹 ⑲-47) — 6부 끝, 빛 돔의 기록: 파랑(기록실 앞) → 옛 등대 돌탑 타고 난간 판 → 난간 판 위에서 꺼진 등롱에 원소(`Perch`) → 반디(등대 발치)
            // → 파랑(기록 재생) → 돔 파수 거신(암, 절반에서 암 방패 — 초로) → 물새 합류. 등대 불은 4째 단계부터(`LighthouseLit`).
            new Chapter
            {
                Id = "ch23", NameKey = "story.ch23", NameKo = "제23장 · 빛 돔의 기록", Ar = 52, Join = "story_mulsae",
                Gold = 6250, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "parang", TextKey = "story.ch23.s1", TextKo = "기록실 앞의 파랑과 이야기하기",
                        Lines = new[]
                        {
                            L("parang", "story.ch23.s1.l1", "방문자 확인. 빛 돔 관리 인공지능 파랑입니다. 문이 열린 것은 도읍이 잠긴 뒤 처음입니다."),
                            L("bandi", "story.ch23.s1.l2", "삐— 파랑. 그 이름… 제 기록에 있습니다. 지워진 칸 바로 앞에."),
                            L("parang", "story.ch23.s1.l3", "조종 기계 반디, 별배 소속. 당신의 기록 사본이 이 기록실에 맡겨져 있습니다. 다만 열람할 전력이 모자랍니다."),
                            L("parang", "story.ch23.s1.l4", "돔은 옛 등대에서 전력을 받았습니다. 도읍이 잠기던 날 등대 불이 꺼진 뒤로, 기록실은 옥새 봉인만 남은 채 잠들어 있습니다."),
                            Pick("story.ch23.s1.p", "등대에 불을 켜면 돼요?", "지워진 칸 끝 말, '등대'…"),
                            L("mulsae", "story.ch23.s1.l5", "북쪽 바위섬 등대 말이오? 물질 나갈 때 늘 보던 불이오. 돌탑을 타고 오르면 등롱까지 닿을 거요."),
                            L("yeoul", "story.ch23.s1.l6", "제 잠수복 불빛으로 물길을 비춰 드릴게요. 꼭대기 난간 판에 서야 등롱에 손이 닿아요."),
                        } },
                    new Step { Type = StepType.Climb, At = "sunken:lighthouse", EnterKey = "story.ch23.stepped", EnterKo = "🗼 등대 난간 판에 올라섰다 — 꺼진 등롱이 눈앞에 있다",
                        TextKey = "story.ch23.s2", TextKo = "옛 등대 돌탑을 타고 난간 판까지 오르기" },
                    new Step { Type = StepType.Light, Bare = true, Perch = true, At = "sunken:lighthouse", Arena = Vector2.zero, EnterKey = "story.ch23.lit", EnterKo = "🗼 등롱에 불이 들어왔다 — 빛줄기가 돌며 빛 돔 꼭대기를 비춘다",
                        AwayKey = "story.ch23.away", AwayKo = "🗼 등롱은 탑 꼭대기에 있다 — 난간 판에 올라서야 불이 닿는다",
                        TextKey = "story.ch23.s3", TextKo = "꺼진 등롱에 원소 스킬로 불 넣기(난간 판 위에서)" },
                    new Step { Type = StepType.Talk, Npc = "bandi", TextKey = "story.ch23.s4", TextKo = "등대 발치의 반디와 이야기하기",
                        Lines = new[]
                        {
                            L("bandi", "story.ch23.s4.l1", "삐— 등대 빛 수신. 빛 돔 전력 회복. 기록실이 깨어납니다."),
                            L("bandi", "story.ch23.s4.l2", "……이상합니다. 이 자리에 서니 무언가 떠오릅니다. 그날 별배는 이 등대 불빛을 보고 항로를 잡았습니다."),
                            L("bandi", "story.ch23.s4.l3", "그런데 불빛이 한순간 꺼졌습니다. 누군가 먹구름으로 등롱을 덮었습니다. 거기서 기억이 끊깁니다."),
                            Pick("story.ch23.s4.p", "먹구름이라고?", "기록실로 돌아가자."),
                            L("bandi", "story.ch23.s4.l4", "나머지는 기록실 사본에 있을 겁니다. 파랑에게 돌아가 주십시오."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "parang", TextKey = "story.ch23.s5", TextKo = "기록실 앞의 파랑과 이야기하기",
                        Lines = new[]
                        {
                            L("parang", "story.ch23.s5.l1", "전력 회복 확인. 옥새 봉인 해제. 조종 기계 반디의 기록 사본을 재생합니다."),
                            L("bandi", "story.ch23.s5.l2", "(기록 재생) 별배 항로 끝, 잠긴 도읍 등대. 등롱 꺼짐. 항로 밖에서 먹구름 접근 — 먹구름 속에 사람 그림자, 가면."),
                            L("bandi", "story.ch23.s5.l3", "(기록 재생) 그림자가 손을 들자 먹구름이 별배를 덮쳤습니다. 기관 정지, 추락. …그리고 그림자가 제 기록을 지웠습니다."),
                            L("mulsae", "story.ch23.s5.l4", "도읍이 잠기던 날에도 하늘이 그렇게 검었소. 파도보다 먹구름이 먼저 왔었지."),
                            Pick("story.ch23.s5.p", "별배를 떨어뜨린 건 틈이 아니었어…", "먹구름을 부리는 누군가가 있어."),
                            L("parang", "story.ch23.s5.l5", "경고. 기록 복원이 '기록을 지운 자'가 남긴 명령에 걸렸습니다. 돔 파수 거신이 침입자 제거를 시작합니다."),
                            L("yeoul", "story.ch23.s5.l6", "돔 바닥이 울려요! 바위 거인이 — 서쪽에서 일어나요!"),
                        } },
                    new Step { Type = StepType.Duel, At = "sunken:dome", Arena = DomeDuel, Foes = new[] { F(FieldEnemy.Kind.EmberImp, GoElement.Geo) },
                        BossKey = "story.boss.colossus", BossKo = "돔 파수 거신", HpMul = 17.6f, AtkMul = 2.6f, ScaleMul = 2.5f,
                        Rot = new[] { FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Shadow },
                        P2El = GoElement.Geo, Adds = new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.EmberImp) },
                        EnterKey = "story.ch23.enter", EnterKo = "🗿 돔 서쪽 바닥이 갈라지며 — 돔 파수 거신이 일어섰다!",
                        P2Key = "story.ch23.p2", P2Ko = "🪨 거신이 바위 껍질을 두른다 — 풀(초)로 깨라! 바위곰과 불도깨비가 뛰어든다",
                        WinKey = "story.ch23.win", WinKo = "🗿 파수 거신이 무너지고 — 가슴에 박혀 있던 먹구름 조각이 흩어졌다",
                        TextKey = "story.ch23.s6", TextKo = "기록을 지운 자의 명령으로 깨어난 돔 파수 거신과 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "mulsae", TextKey = "story.ch23.s7", TextKo = "돔 안의 물새와 이야기하기",
                        Lines = new[]
                        {
                            L("mulsae", "story.ch23.s7.l1", "……바위 속에 먹구름이 박혀 있었구려. 누가 이 빛 집까지 손을 뻗은 게요."),
                            L("parang", "story.ch23.s7.l2", "파수 거신 정지. 명령 기록 추적 — 발신지는 하늘 항로 위, 구름 위입니다."),
                            L("bandi", "story.ch23.s7.l3", "삐— 기억이 돌아왔습니다. 별배가 가려던 곳은 등대가 아니라, 등대가 비추던 하늘 항로였습니다."),
                            Pick("story.ch23.s7.p", "먹구름을 부리는 자를 찾자.", "물새 님은 이제 어떡해요?"),
                            L("mulsae", "story.ch23.s7.l4", "물은 두 번 가르쳐 주지 않는다 했지. 이번엔 나도 안 놓치겠소 — 도읍을 잠기게 한 그 먹구름을."),
                            L("mulsae", "story.ch23.s7.l5", "해녀 물새, 오늘부터 뭍사람들 편이오. 숨 긴 거 하나는 자신 있소."),
                        } },
                }
            },
            // 109-14-49 24장(웹 ⑲-49) — 7부 첫 장, 하늘 사당의 바람 방울: 한별(도읍 모래밭) → 별배 타기(sail — 하늘 사당 섬) → 새벽 → 사당 마당 먹구름 졸개 넷 → 새벽 → 바람 방울 석등 별 → 해 → 달 → 새벽.
            // 방울을 다 울리면(7째 단계부터) 사당 위 먹구름이 걷힌다(`ShrineClear`). 섬 위 단계는 `Route` 로 하늘 섬 표(`GoAreas.Route*`)에 앉는다.
            new Chapter
            {
                Id = "ch24", NameKey = "story.ch24", NameKo = "제24장 · 하늘 사당의 바람 방울", Ar = 54,
                Gold = 6500, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "hanbyeol", TextKey = "story.ch24.s1", TextKo = "모래밭의 선장 한별과 이야기하기",
                        Lines = new[]
                        {
                            L("hanbyeol", "story.ch24.s1.l1", "등대 빛줄기가 도는 걸 봤나? 빛 끝이 늘 같은 하늘을 짚고 멈춰. 저기 — 구름 위에 섬이 떠 있어."),
                            L("bandi", "story.ch24.s1.l2", "삐— 별배 항로표에 새 신호 둘. 하나는 옛 사당의 방울 소리, 하나는… 지금 시대 기상 비행선의 구조 신호입니다."),
                            L("hanbyeol", "story.ch24.s1.l3", "먹구름을 부리는 자의 명령이 구름 위에서 왔다고 했지. 별배가 원래 가려던 항로도 저 위다."),
                            Pick("story.ch24.s1.p", "별배로 올라가요.", "비행선에 누가 있을지도 몰라요."),
                            L("hanbyeol", "story.ch24.s1.l4", "이번엔 하늘길이다. 별배가 제일 잘하는 거지 — 타게!"),
                        } },
                    new Step { Type = StepType.Sail, Npc = "hanbyeol", Route = "shrine", Arena = ShrineLand, EnterKey = "story.ch24.arrive", EnterKo = "🛸 별배가 구름을 뚫고 올라 — 기와 사당이 선 떠 있는 섬에 우리를 내려 주었다",
                        Lines = new[] { L("hanbyeol", "story.ch24.s2.l1", "별배, 등대 빛줄기를 따라 위로! 반디, 구름 사이 길을 읽어 다오.") },
                        TextKey = "story.ch24.s2", TextKo = "선장의 별배를 타고 하늘 항로로" },
                    new Step { Type = StepType.Talk, Npc = "saebyeok", TextKey = "story.ch24.s3", TextKo = "사당 앞의 무녀와 이야기하기",
                        Lines = new[]
                        {
                            L("saebyeok", "story.ch24.s3.l1", "……바람이 손님을 데려왔구려. 사당이 하늘로 들린 뒤로 사람 발소리는 처음이오."),
                            Pick("story.ch24.s3.p", "누구세요?", "여기가 하늘 사당인가요?"),
                            L("saebyeok", "story.ch24.s3.l2", "나는 바람 무녀 새벽. 이 사당의 바람 방울을 지켰소. 방울이 울면 바람이 길을 알고, 구름이 물러났지."),
                            L("saebyeok", "story.ch24.s3.l3", "그런데 먹구름이 내려앉아 방울을 틀어막았소. 마당엔 먹구름 먹은 것들이 들끓고."),
                            L("hanbyeol", "story.ch24.s3.l4", "먹구름이 저 혼자 내려앉았을 리 없지. 마당부터 치우자."),
                        } },
                    new Step { Type = StepType.Kill, Route = "shrine", Arena = Vector2.zero,
                        Foes = new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch24.enter1", EnterKo = "⚔️ 사당 마당의 먹구름 속에서 졸개들이 뛰쳐나왔다",
                        TextKey = "story.ch24.s4", TextKo = "사당 마당의 먹구름 졸개 물리치기" },
                    new Step { Type = StepType.Talk, Npc = "saebyeok", TextKey = "story.ch24.s5", TextKo = "사당 앞의 무녀와 이야기하기",
                        Lines = new[]
                        {
                            L("saebyeok", "story.ch24.s5.l1", "고맙소. 이제 방울을 울릴 차례요. 바람 방울은 하루를 따라 울렸지 — 새벽별, 한낮의 해, 밤의 달."),
                            L("bandi", "story.ch24.s5.l2", "삐— 마당 석등 셋에서 방울 주파수가 나옵니다. 별, 해, 달 무늬."),
                            Pick("story.ch24.s5.p", "별, 해, 달.", "틀리면요?"),
                            L("saebyeok", "story.ch24.s5.l3", "바람은 순서를 잊지 않소. 틀리면 방울이 다 멎고 처음부터요."),
                        } },
                    new Step { Type = StepType.Seal, Route = "shrine", Arena = Vector2.zero, Order = new[] { "star", "sun", "moon" }, TextKey = "story.ch24.s6", TextKo = "사당 마당 바람 방울 석등을 차례(별 → 해 → 달)로 울리기" },
                    new Step { Type = StepType.Talk, Npc = "saebyeok", TextKey = "story.ch24.s7", TextKo = "사당 앞의 무녀와 이야기하기",
                        Lines = new[]
                        {
                            L("saebyeok", "story.ch24.s7.l1", "……들리오? 방울이 다시 운다. 먹구름이 걷히는구려."),
                            L("bandi", "story.ch24.s7.l2", "삐— 구름 틈으로 더 높은 섬 하나. 비행선 구조 신호가 거기서 나옵니다."),
                            L("saebyeok", "story.ch24.s7.l3", "저 먹구름은 땅에서 오른 게 아니오. 위에서 흘러내렸소 — 누가 위에서 구름을 빚어 흘려보내는 게지."),
                            Pick("story.ch24.s7.p", "위로 올라갈 길은요?", "구름을 빚는 자…"),
                            L("saebyeok", "story.ch24.s7.l4", "방울이 울었으니 바람이 길을 낼 거요. 사당 서쪽 끝에 바람 기둥이 설 테니, 타고 올라 날개를 펴시오."),
                            L("hanbyeol", "story.ch24.s7.l5", "비행선이라면 지금 시대 사람이 갇혀 있을 거야. 서두르자."),
                        } },
                }
            },
            // 109-14-50 25장(웹 ⑲-50) — 7부 둘째 장, 멈춘 기상 비행선: 새벽(사당) → 사당 바람 기둥 타고 활공해 잔해 섬(`Sky`+`Route`) → 하늬 → 구름 씨앗 드론 쫓기(섬 둘레) → 하늬
            // → 비행선 기관 지키기(섬 위 물결 셋, 바깥 12m) → 하늬. 기관을 지켜 내면(7째 단계부터 `WreckLive`) 프로펠러가 다시 돈다.
            new Chapter
            {
                Id = "ch25", NameKey = "story.ch25", NameKo = "제25장 · 멈춘 기상 비행선", Ar = 56,
                Gold = 6750, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "saebyeok", TextKey = "story.ch25.s1", TextKo = "사당 앞의 무녀와 이야기하기",
                        Lines = new[]
                        {
                            L("saebyeok", "story.ch25.s1.l1", "바람 기둥이 섰소. 사당 서쪽 끝이오 — 기둥에 들어서면 바람이 몸을 들어 올릴 거요."),
                            L("bandi", "story.ch25.s1.l2", "삐— 위 섬에서 구조 신호가 계속됩니다. 사람 한 명, 기상 비행선 조종실."),
                            Pick("story.ch25.s1.p", "올라가 볼게요.", "날개를 펴면 되죠?"),
                            L("saebyeok", "story.ch25.s1.l3", "기둥 꼭대기에서 날개를 펴고 저 섬으로 미끄러지시오. 바람은 한 번 연 길은 닫지 않소."),
                        } },
                    new Step { Type = StepType.Sky, Route = "wreck", EnterKey = "story.ch25.landed", EnterKo = "🪂 비행선 잔해 섬에 내려섰다 — 찢어진 기낭 곁에서 누가 손을 흔든다",
                        TextKey = "story.ch25.s2", TextKo = "사당 바람 기둥을 타고 올라 비행선 잔해 섬으로 건너가기(활공)" },
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch25.s3", TextKo = "조종실 앞의 비행사와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch25.s3.l1", "사, 사람이다! 구조대…는 아니죠? 날개 달고 날아온 사람은 처음 봐요."),
                            Pick("story.ch25.s3.p", "구조 신호를 따라왔어요.", "괜찮아요?"),
                            L("haneul", "story.ch25.s3.l2", "저는 비행사 하늬. 기상 비행선을 몰다가 먹구름에 휘말려 이 섬에 처박혔어요. 벌써 며칠째인지…"),
                            L("haneul", "story.ch25.s3.l3", "그런데 이상해요. 기록계를 보면 먹구름이 저절로 생긴 게 아니에요. 누가 구름을 “만들고” 있어요."),
                            L("haneul", "story.ch25.s3.l4", "저기 — 또 왔다! 저 드론이 구름 씨앗을 뿌리고 다녀요. 잡아 주세요!"),
                        } },
                    new Step { Type = StepType.Chase, Npc = "seeddrone", TextKey = "story.ch25.s4", TextKo = "구름 씨앗을 뿌리며 달아나는 드론 쫓기",
                        EnterKey = "story.ch25.flee", EnterKo = "🛸 드론이 검보랏빛 씨앗을 흩뿌리며 섬 둘레로 달아난다 — 쫓아라!",
                        WinKey = "story.ch25.caught", WinKo = "🛸 구름 씨앗 드론을 붙잡았다 — 배 속에서 검보랏빛 씨앗 알갱이가 쏟아진다",
                        LostKey = "story.ch25.lost", LostKo = "💨 놓쳤다 — 드론이 프로펠러 곁으로 돌아가 숨었다. 다시 가까이 가면 달아난다" },
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch25.s5", TextKo = "조종실 앞의 비행사와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch25.s5.l1", "이 씨앗… 우리 시대 물건이 아니에요. 물기를 빨아들여 먹구름으로 부풀어요."),
                            L("bandi", "story.ch25.s5.l2", "삐— 앞 시대 기상 조작 장치의 씨앗과 같은 구조입니다. 누군가 앞 시대 기술을 쓰고 있습니다."),
                            L("haneul", "story.ch25.s5.l3", "비행선 기관만 살리면 기록계로 드론 신호가 어디서 오는지 짚을 수 있어요. 그런데 기관 소리를 들으면 먹구름 것들이 몰려올 거예요."),
                            Pick("story.ch25.s5.p", "기관을 지킬게요.", "어서 시동을 걸어요."),
                            L("haneul", "story.ch25.s5.l4", "좋아요, 시동 겁니다! 조종실 앞 기관을 지켜 주세요!"),
                        } },
                    new Step { Type = StepType.Defend, Route = "wreck", Arena = WreckEngine, Ring = 12f, NameKey = "story.altar_engine", NameKo = "비행선 기관", Dirs = new[] { 330f, 0f, 200f, 240f, 300f },
                        Waves = new[]
                        {
                            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith) },
                            new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo) },
                            new[] { F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        },
                        TextKey = "story.ch25.s6", TextKo = "비행선 기관이 데워지는 동안 지키기" },
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch25.s7", TextKo = "조종실 앞의 비행사와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch25.s7.l1", "기관 살았다! 기록계 켜졌어요 — 드론 신호 발신지… 여기보다 위예요. 서쪽 하늘 제일 높은 섬."),
                            L("bandi", "story.ch25.s7.l2", "삐— 앞 시대 궤도 정거장 조각입니다. 구름 씨앗 장치 신호 셋. 먹구름을 부리는 자가 거기서 구름을 빚어 흘려보내고 있습니다."),
                            Pick("story.ch25.s7.p", "거기로 가자.", "하늬 씨는요?"),
                            L("haneul", "story.ch25.s7.l3", "저도 가요. 제 비행선을 떨어뜨린 놈 얼굴은 봐야죠. 잔해 서쪽 끝에 바람이 모이는 게 보여요 — 거기서 올라가요!"),
                        } },
                }
            },
            // 109-14-51 26장(웹 ⑲-51) — 7부 끝, 궤도 조각의 그림자: 하늬(잔해) → 잔해 바람 기둥 타고 정거장 섬으로 활공(`Sky`+`Route`) → 하늬 → 구름 씨앗 장치 셋을 원소로 끈다(남동 → 북 → 남서, `Light`+`Bare`)
            // → 가면 그림자 → 먹구름 임금의 그림자(뇌 방패는 불로) → 하늬 합류. 장치는 끈 다음 단계부터 코어가 식는다(`SeederOff`).
            new Chapter
            {
                Id = "ch26", NameKey = "story.ch26", NameKo = "제26장 · 궤도 조각의 그림자", Ar = 58, Join = "story_haneul",
                Gold = 7000, Mats = new[] { 0, 6, 5, 6, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch26.s1", TextKo = "잔해 섬의 하늬와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch26.s1.l1", "바람 기둥이 섰어요. 저 위 — 궤도 정거장 조각이에요. 앞 시대 물건이 저기 떠 있다니."),
                            L("bandi", "story.ch26.s1.l2", "삐— 구름 씨앗 장치 신호 셋, 여전히 켜져 있습니다. 먹구름이 계속 빚어지고 있습니다."),
                            Pick("story.ch26.s1.p", "먼저 올라갈게요.", "같이 가요."),
                            L("haneul", "story.ch26.s1.l3", "비행사가 날개 없이 올라가는 건 처음이네요. 먼저 가요, 뒤따를게요!"),
                        } },
                    new Step { Type = StepType.Sky, Route = "orbit", EnterKey = "story.ch26.landed", EnterKo = "🪂 궤도 정거장 조각에 내려섰다 — 합금 판 위에 구름 씨앗 장치 셋이 검보랏빛으로 타오른다",
                        TextKey = "story.ch26.s2", TextKo = "잔해 바람 기둥을 타고 올라 궤도 정거장 조각으로 건너가기(활공)" },
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch26.s3", TextKo = "정거장 조각의 하늬와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch26.s3.l1", "저 셋이에요. 검보랏빛 알에서 먹구름이 피어올라요 — 구름 씨앗 장치."),
                            L("bandi", "story.ch26.s3.l2", "삐— 장치마다 원소를 대면 멈춥니다. 남동쪽, 북쪽, 남서쪽 차례로 신호가 약합니다."),
                            Pick("story.ch26.s3.p", "하나씩 끌게요.", "알겠어, 남동쪽부터."),
                            L("haneul", "story.ch26.s3.l3", "먹구름 공장이라니… 다 끄면 하늘이 맑아질 거예요."),
                        } },
                    new Step { Type = StepType.Light, Bare = true, Route = "orbit", Arena = SeedSE, EnterKey = "story.ch26.off0", EnterKo = "☁️ 남동쪽 장치의 먹구름 알이 식어 꺼졌다",
                        TextKey = "story.ch26.s4", TextKo = "남동쪽 구름 씨앗 장치를 원소 스킬로 끄기" },
                    new Step { Type = StepType.Light, Bare = true, Route = "orbit", Arena = SeedN, EnterKey = "story.ch26.off1", EnterKo = "☁️ 북쪽 장치의 먹구름 알이 식어 꺼졌다",
                        TextKey = "story.ch26.s5", TextKo = "북쪽 구름 씨앗 장치를 원소 스킬로 끄기" },
                    new Step { Type = StepType.Light, Bare = true, Route = "orbit", Arena = SeedSW, EnterKey = "story.ch26.off2", EnterKo = "☁️ 남서쪽 장치까지 꺼졌다 — 서쪽 끝에서 누군가 박수를 친다",
                        TextKey = "story.ch26.s6", TextKo = "남서쪽 구름 씨앗 장치를 원소 스킬로 끄기" },
                    new Step { Type = StepType.Talk, Npc = "gamyeon", TextKey = "story.ch26.s7", TextKo = "서쪽 끝의 가면 그림자와 이야기하기",
                        Lines = new[]
                        {
                            L("gamyeon", "story.ch26.s7.l1", "……구름 공장을 셋 다 끄다니. 별배를 떨어뜨릴 때도 이렇게 성가신 녀석들은 없었는데."),
                            L("bandi", "story.ch26.s7.l2", "삐— 그 목소리. 그날 기록 속의 그림자입니다! 제 기록을 지운 자!"),
                            Pick("story.ch26.s7.p", "네가 먹구름을 부렸구나.", "왜 별배를 떨어뜨렸지?"),
                            L("gamyeon", "story.ch26.s7.l3", "별배가 가려던 곳에 가 닿으면 곤란하거든. 매듭이 다시 묶이면 먹구름이 설 자리가 없지."),
                            L("haneul", "story.ch26.s7.l4", "제 비행선도 당신이 떨어뜨렸죠!"),
                            L("gamyeon", "story.ch26.s7.l5", "구름 씨앗은 또 뿌리면 그만이다. 그 사이 놀 상대를 붙여 주지 — 네놈들이 한 번 쓰러뜨렸던 먹구름 임금의 그림자로."),
                        } },
                    new Step { Type = StepType.Duel, Route = "orbit", Arena = OrbitDuel, Foes = new[] { F(FieldEnemy.Kind.Bandit, GoElement.Electro) }, Mask = true,
                        BossKey = "story.boss.stormshadow", BossKo = "먹구름 임금의 그림자", HpMul = 16.8f, AtkMul = 2.5f, ScaleMul = 2.1f,
                        Rot = new[] { FieldEnemy.BossMove.Melee, FieldEnemy.BossMove.Shadow, FieldEnemy.BossMove.Slam, FieldEnemy.BossMove.Halo, FieldEnemy.BossMove.Tide, FieldEnemy.BossMove.Spit },
                        P2El = GoElement.Electro, Adds = new[] { F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), F(FieldEnemy.Kind.StormWraith) },
                        EnterKey = "story.ch26.enter", EnterKo = "🌩️ 먹빛 왕관의 그림자가 합금 판 위에 일어섰다 — 먹구름 임금의 그림자!",
                        P2Key = "story.ch26.p2", P2Ko = "⚡ 그림자가 구름 씨앗의 먹구름을 두른다 — 불로 방패를 깨라! 매와 살쾡이가 뛰어든다",
                        WinKey = "story.ch26.win", WinKo = "🌩️ 그림자 임금이 흩어지고 — 가면 그림자는 \"청하의 여섯 매듭이 풀리는 날 다시 보자\" 한마디를 남기고 먹구름 속으로 사라졌다",
                        TextKey = "story.ch26.s8", TextKo = "가면 그림자가 불러낸 먹구름 임금의 그림자와 맞서기" },
                    new Step { Type = StepType.Talk, Npc = "haneul", TextKey = "story.ch26.s9", TextKo = "정거장 조각의 하늬와 이야기하기",
                        Lines = new[]
                        {
                            L("haneul", "story.ch26.s9.l1", "……갔어요. 먹구름도 같이 걷혔고요. 하늘이 이렇게 파란 건 처음 봐요."),
                            L("bandi", "story.ch26.s9.l2", "삐— 여섯 매듭. 1부의 여섯 제단과 수가 같습니다. 청하 마을의 제단이 무언가를 묶고 있었을지도 모릅니다."),
                            Pick("story.ch26.s9.p", "청하 마을로 돌아가 보자.", "하늬 씨는 이제 어떡해요?"),
                            L("haneul", "story.ch26.s9.l3", "비행선은 못 뜨지만 닻 갈고리는 멀쩡해요. 먹구름 쫓는 일이라면 기상 비행사가 빠질 수 없죠."),
                            L("haneul", "story.ch26.s9.l4", "비행사 하늬, 오늘부터 같이 날아요 — 날개는 빌려 쓰고요!"),
                        } },
                }
            },
            // 109-14-53 27장(웹 ⑲-53) — 8부 첫 장, 풀리는 매듭. 1부 여섯 제단 자리가 실은 여섯 매듭이었다(`KnotField`). 촌장 → 은비(폐허) → 첫째 매듭 졸개 → 첫째 매듭 불 → 둘째 매듭 석등(달 → 별 → 해) → 나그네 → 봉우리 → 셋째 매듭 불 → 해솔.
            // 매듭은 그 단계 다음부터 묶인다(`GoStory.KnotStep` 4·5·8 — 단계 번호를 바꾸면 그쪽도).
            new Chapter
            {
                Id = "ch27", NameKey = "story.ch27", NameKo = "제27장 · 풀리는 매듭", Ar = 60,
                Gold = 7250, Mats = new[] { 0, 6, 5, 7, 0 },
                Steps = new[]
                {
                    new Step { Type = StepType.Talk, Npc = "elder", TextKey = "story.ch27.s1", TextKo = "청하 촌장에게 돌아가기",
                        Lines = new[]
                        {
                            L("elder", "story.ch27.s1.l1", "돌아왔구나! 하늘에 뜬 사당이며 정거장이며… 은비한테 다 들었다. 먼 데까지 잘도 다녀왔어."),
                            L("elder", "story.ch27.s1.l2", "그런데 네가 떠난 그날 밤부터 이상한 일이 생겼단다. 네가 밝혀 둔 옛 제단 불이 하나씩 꺼지고 있어."),
                            L("bandi", "story.ch27.s1.l3", "삐— 제단 자리마다 먹구름 신호. 가면 그림자가 말한 '여섯 매듭'과 수가 맞습니다."),
                            Pick("story.ch27.s1.p", "매듭이 풀리고 있다는 거네요.", "자장가 끝 소절이 뭐였죠?"),
                            L("elder", "story.ch27.s1.l4", "할머니 자장가 끝 소절이 이제야 떠오르는구나 — '여섯 매듭 풀리면 임금이 눈을 뜬다'. 폐허의 은비에게 가 보렴. 비문은 그 아이가 제일 잘 안다."),
                        } },
                    new Step { Type = StepType.Talk, Npc = "scholar", TextKey = "story.ch27.s2", TextKo = "폐허의 학자 은비와 이야기하기",
                        Lines = new[]
                        {
                            L("scholar", "story.ch27.s2.l1", "왔구나! 비문 탁본을 다시 떠 봤어. 다들 앞면만 읽었지 뒷면은 아무도 안 봤더라고."),
                            L("scholar", "story.ch27.s2.l2", "'매듭 여섯이 틈을 묶고, 틈이 임금을 묶는다' — 제단은 자물쇠이기 전에 매듭이었어. 시간 틈을 꽁꽁 묶어 두는."),
                            Pick("story.ch27.s2.p", "그래서 가면 그림자가 풀러 왔구나.", "다시 묶을 수 있어?"),
                            L("scholar", "story.ch27.s2.l3", "원소의 불로 다시 묶으면 돼. 둘째 매듭 석등은 자장가 차례래 — '달이 뜨고, 별이 돌고, 해가 묶는다'."),
                            L("scholar", "story.ch27.s2.l4", "그런데 첫째 매듭 곁에 먹구름 졸개들이 진을 쳤어. 저것부터!"),
                        } },
                    new Step { Type = StepType.Kill, Gx = AltarGx, Gy = AltarGy + 0.45f,
                        Foes = new[] { F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.EmberImp), F(FieldEnemy.Kind.StormWraith), F(FieldEnemy.Kind.StormWraith, GoElement.Anemo) },
                        EnterKey = "story.ch27.enter1", EnterKo = "⚔️ 매듭 돌 곁에 먹구름 졸개들이 진을 쳤다",
                        TextKey = "story.ch27.s3", TextKo = "첫째 매듭을 둘러싼 먹구름 졸개 물리치기" },
                    new Step { Type = StepType.Light, Gx = AltarGx, Gy = AltarGy, EnterKey = "story.ch27.tied1", EnterKo = "🔥 매듭 돌의 금줄에 불이 옮겨 붙고 — 금빛 줄이 하늘로 솟았다",
                        TextKey = "story.ch27.s4", TextKo = "첫째 매듭의 제단에 원소 불 다시 밝히기" },
                    new Step { Type = StepType.Seal, Order = new[] { "moon", "star", "sun" }, TextKey = "story.ch27.s5", TextKo = "서쪽 옛길 둘째 매듭 석등을 자장가 차례(달 → 별 → 해)대로 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "wanderer", TextKey = "story.ch27.s6", TextKo = "둘째 매듭 곁의 나그네와 이야기하기",
                        Lines = new[]
                        {
                            L("wanderer", "story.ch27.s6.l1", "……늦지 않았군. 매듭이 풀린 자리마다 이게 떨어져 있었다."),
                            L("wanderer", "story.ch27.s6.l2", "가면 조각이다. 무늬를 보게 — 은비가 비문 맨 아래에서 찾았던 그 무늬. 신하들 가면이 아니라, 처음 가면이야."),
                            Pick("story.ch27.s6.p", "처음 가면이라니요?", "가면 그림자의 것인가요?"),
                            L("wanderer", "story.ch27.s6.l3", "해솔을 삼킨 가면도, 검은 가면들도 전부 이걸 본떴다. 임금의 신하라는 표식이 아니라 — 임금 자신의 얼굴이었던 게지."),
                            L("wanderer", "story.ch27.s6.l4", "셋째 매듭은 북쪽 봉우리다. 해솔이 먼저 올라가 있다."),
                        } },
                    new Step { Type = StepType.Climb, TextKey = "story.ch27.s7", TextKo = "북쪽 봉우리 꼭대기로 올라가기(벽 타기)" },
                    new Step { Type = StepType.Light, Arena = ArenaAltar, EnterKey = "story.ch27.tied3", EnterKo = "🔥 셋째 매듭이 다시 묶였다 — 봉우리에서 금빛 줄이 솟는다",
                        TextKey = "story.ch27.s8", TextKo = "봉우리의 셋째 매듭에 원소 불 다시 밝히기" },
                    new Step { Type = StepType.Talk, Npc = "haesol", TextKey = "story.ch27.s9", TextKo = "봉우리의 해솔과 이야기하기",
                        Lines = new[]
                        {
                            L("haesol", "story.ch27.s9.l1", "셋째 매듭까지… 고마워. 매듭에 불이 붙을 때마다 귓가에 맴돌던 노랫소리가 작아져."),
                            L("haesol", "story.ch27.s9.l2", "가면에 먹혀 있을 때 먹구름 속에서 누가 계속 노래를 부르라고 했다고 했지. 그 목소리 — 정거장에서 들은 가면 그림자랑 똑같아."),
                            Pick("story.ch27.s9.p", "그자가 널 부렸던 거구나.", "나머지 매듭은?"),
                            L("haesol", "story.ch27.s9.l3", "넷째는 물마루 곶, 다섯째는 바위섬, 여섯째는 저 위 구름섬. 그자가 먼저 닿기 전에 — 포구의 버들 할아버지한테 가 보자."),
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
                case StepType.Go: radius = GoR; return s.Altar ? WeeklyAltarPos() : s.Frost || s.Yard || s.Stn || s.At != null ? StepPos(s) : GridPos(s.Gx, s.Gy);
                case StepType.Boss: return TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                case StepType.Domain: return SitePos(s.Site);
                case StepType.Light: radius = LightR; return StepPos(s);
                case StepType.Seal: return SealPos(s);
                case StepType.Climb: return s.At != null ? ClimbTopOf(s.At) : s.Yard ? CraneTop : DuelPeak.Top;
                case StepType.Sky: radius = DraftR; return s.Route != null ? RoutePillarPos(RouteIndex(s.Route)) : s.Obs ? ObsPillarPos : DuelPeak.Top; // 109-14-20 바람 기둥 = 봉우리 정상 · 109-14-35 시간 기둥
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
