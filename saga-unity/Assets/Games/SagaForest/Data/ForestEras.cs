using UnityEngine;

namespace Saga.Forest.Data
{
    public enum ForestEra { Past, Modern, Future }

    /// <summary>
    /// PLAN.md 109-4 "FOREST 세 시대"(SAGA-DESIGN §13 전체 퓨전 · 웹 사가마을 §5.13 세 시대 손님 재해석) —
    /// ① 존 소품·명소 곁에 현대·미래 조각(표는 `ForestZoneProps` — 조각마다 <see cref="ForestEra"/>),
    /// ② 마을에 시대 섞인 사람 여섯(과거·현대·미래 둘씩, 이 표).
    /// 웹 판 손님은 날짜 해시로 하루 한 명·부탁·단골까지 있지만(§5.9·5.10) 그건 PLAN 109 C 줄 12 몫이라,
    /// 여기선 마을 광장 둘레에 늘 서서 짧게 오가고(36초 중 3초씩 걸어 3.5m, 시각의 순수 함수) 가까이 오면 대사 넷을 돌려 말한다.
    /// 몸은 저마다 다르고 이 판의 다른 몸(Maria·숲지기 PeasantMan·짐승 여섯)과 안 겹친다. 이름·대사는 전부 지어낸 것.
    /// </summary>
    public static class ForestEras
    {
        public const float TalkRadius = 2.5f;
        public const float RetalkCooldownSec = 4f;
        public const float LineSec = 4.5f;
        public const float Height = 1.75f;

        public const float Cycle = 36f;
        public const float WalkSec = 3f;
        public const float WalkDistance = 3.5f;
        private const float StandSec = Cycle * 0.5f - WalkSec;

        /// <summary>시간 틈 잔해 — GO 109-1b·DUNGEON 109-2b 와 같은 빛깔(세 판이 같은 "시간 틈"으로 읽히게).</summary>
        public static readonly Color RiftTint = new Color(0.55f, 0.8f, 0.9f, 1f);
        public static readonly Color RiftGlow = new Color(0.08f, 0.62f, 0.72f, 1f);
        public const float RiftSpinDegPerSec = 9f;
        /// <summary>떠 있는 잔해 밑면은 땅에서 적어도 이만큼(사람 머리 위).</summary>
        public const float RiftMinHover = 1.5f;

        public struct Folk
        {
            public string Id;
            public ForestEra Era;
            public string Body;
            public string NameKo, NameKey;
            public string LineKeyPrefix;
            public string[] LinesKo;
            /// <summary>출발점(world XZ)·오가는 쪽. 끝점 = Start + Dir × <see cref="WalkDistance"/>.</summary>
            public Vector2 Start, Dir;
            /// <summary>오가기 위상(초) — 여섯이 한꺼번에 걷지 않게.</summary>
            public float Phase;
            /// <summary>몸이 없는 PC 의 캡슐 빛깔.</summary>
            public Color Fallback;
        }

        /// <summary>
        /// 마을 광장 둘레(존 넷 밖) — 판·창구·소원석·과일나무·숲지기·집·스폰과 3m 넘게 떨어진 길(`PlaytestForestEras`).
        /// 택배 기사는 택배 창구 곁, 시간 여행자는 소원석 곁을 오간다.
        /// </summary>
        public static readonly Folk[] FolkList =
        {
            new Folk { Id = "sentry", Era = ForestEra.Past, Body = "CastleGuard", NameKo = "길 잃은 성 파수병", NameKey = "era_folk.sentry",
                Start = new Vector2(-15f, 11f), Dir = new Vector2(1f, 0f), Phase = 0f, Fallback = new Color(0.4f, 0.38f, 0.35f),
                LineKeyPrefix = "era_folk.sentry.", LinesKo = new[] {
                    "성문을 지키다 눈을 떠 보니 이 숲이었소. 내 성은 어디로 갔단 말이오?",
                    "바위 지대에 쇠로 된 통이 굴러다니더군. 기름 냄새가 나는 게 우리 성 창고 것은 아니오.",
                    "밤에 숲 위로 푸른 빛덩이가 떠서 도는 걸 봤소. 파수병 눈은 못 속이오.",
                    "과일나무 열매 하나면 하루는 버티오. 이 마을 인심이 좋구려.",
                } },
            new Folk { Id = "pilgrim", Era = ForestEra.Past, Body = "Pelegrini", NameKo = "붉은 두건 순례 기사", NameKey = "era_folk.pilgrim",
                Start = new Vector2(-6f, 16f), Dir = new Vector2(0f, 1f), Phase = 7f, Fallback = new Color(0.6f, 0.15f, 0.12f),
                LineKeyPrefix = "era_folk.pilgrim.", LinesKo = new[] {
                    "옛 돌기둥터를 찾아 순례 중이오. 기둥 위에 쇠 눈알이 떠 있다니, 불길하군.",
                    "이끼 돌제단 등불이 꺼지지 않는 까닭을 알았소 — 제단 위에 뜬 쇠함이 빛을 뿜더이다.",
                    "칼은 칼집에 넣어 두었소. 이 숲 짐승은 겁만 많지 사람을 해치진 않으니.",
                    "다른 때 사람들이 자꾸 넘어오오. 하늘에 틈이 벌어진 게 틀림없소.",
                } },
            new Folk { Id = "courier", Era = ForestEra.Modern, Body = "Pete", NameKo = "택배 기사 달음", NameKey = "era_folk.courier",
                Start = new Vector2(-10f, -8f), Dir = new Vector2(0f, -1f), Phase = 13f, Fallback = new Color(0.9f, 0.5f, 0.1f),
                LineKeyPrefix = "era_folk.courier.", LinesKo = new[] {
                    "배송지가 '숲 마을 우편함'으로만 적혀 있어요. 여긴 주소가 없네요.",
                    "택배 창구 옆에 차를 대려 했는데 길이 없어서 다 걸어 다녀요.",
                    "꽃밭에 덮개 씌운 차 한 대 봤어요? 동료 차 같은데 사람은 없더라고요.",
                    "서명 대신 도장 받는 마을은 처음이에요. 아니, 발바닥 도장이었나…",
                } },
            new Folk { Id = "photographer", Era = ForestEra.Modern, Body = "Sophie", NameKo = "사진작가 찰나", NameKey = "era_folk.photographer",
                Start = new Vector2(5f, 12f), Dir = new Vector2(1f, 0f), Phase = 20f, Fallback = new Color(0.9f, 0.55f, 0.2f),
                LineKeyPrefix = "era_folk.photographer.", LinesKo = new[] {
                    "요정 돌고리 한가운데 기계가 떠 있어요! 이건 잡지 표지감이에요.",
                    "안개유령은 사진에 안 찍혀요. 대신 사진 구석에 푸른 빛이 번져요.",
                    "휴대폰 배터리가 떨어져 가요. 이 마을엔 콘센트가 없죠?",
                    "숲도깨비가 렌즈 뚜껑을 가져갔어요. 돌려받을 수 있을까요?",
                } },
            new Folk { Id = "chrononaut", Era = ForestEra.Future, Body = "Uriel", NameKo = "금빛 외골격 시간 여행자", NameKey = "era_folk.chrononaut",
                Start = new Vector2(11f, -1f), Dir = new Vector2(1f, 0f), Phase = 26f, Fallback = new Color(0.8f, 0.65f, 0.25f),
                LineKeyPrefix = "era_folk.chrononaut.", LinesKo = new[] {
                    "이 외골격은 걷기 전용입니다. 뛰어다니는 짐승은 못 쫓아가요.",
                    "기록 보관소엔 이 숲이 '사라진 숲'으로 남아 있어요. 이렇게 살아 있었군요.",
                    "숲 곳곳에 떠 있는 잔해는 제 시대 물건이에요. 시간 틈에 휩쓸려 온 거죠.",
                    "소원석에 빌면 이뤄진다고요? 제 시대엔 그런 돌이 박물관에만 있어요.",
                } },
            new Folk { Id = "surveyor", Era = ForestEra.Future, Body = "Jennifer", NameKo = "불시착 탐사원 루미", NameKey = "era_folk.surveyor",
                Start = new Vector2(-2f, 22f), Dir = new Vector2(1f, 0f), Phase = 31f, Fallback = new Color(0.7f, 0.2f, 0.25f),
                LineKeyPrefix = "era_folk.surveyor.", LinesKo = new[] {
                    "착륙선이 시간 틈에 걸려 부서졌어요. 부품이 숲 여기저기 떠 있을 거예요.",
                    "바위 지대 선돌 곁에 제 탐조등이 떠 있더라고요. 아직 불이 들어와요.",
                    "이 시대 공기는 달아요. 필터를 끄고 숨 쉬어도 되겠어요.",
                    "구조 신호는 보냈어요. 도착은… 삼백 년 뒤래요.",
                } },
        };

        /// <summary>이 판의 옛 몸 — 시대 사람 몸은 이것들과 겹치면 안 된다(진단).</summary>
        public static readonly string[] OldBodies = { "PeasantMan", "Goblin", "Hulk", "Warrok", "Parasite", "Nightshade", "Jolleen" };

        public static string EraName(ForestEra e) => e == ForestEra.Past
            ? ForestLocalization.T("era.past", "과거")
            : e == ForestEra.Modern ? ForestLocalization.T("era.modern", "현대") : ForestLocalization.T("era.future", "미래");

        public static string FolkName(Folk f) => $"{ForestLocalization.T(f.NameKey, f.NameKo)}({EraName(f.Era)})";

        public static string FolkLine(Folk f, int i)
        {
            int k = ((i % f.LinesKo.Length) + f.LinesKo.Length) % f.LinesKo.Length;
            return ForestLocalization.T(f.LineKeyPrefix + k, f.LinesKo[k]);
        }

        public static string[] FolkBodies()
        {
            var list = new string[FolkList.Length];
            for (int i = 0; i < FolkList.Length; i++) list[i] = FolkList[i].Body;
            return list;
        }

        /// <summary>시각 t 에 출발점에서 몇 m 나가 있나(0~<see cref="WalkDistance"/>)·걷는 중인가·어느 쪽으로(+1 나감, -1 돌아옴).</summary>
        public static float OffsetAt(float t, out bool walking, out int sign)
        {
            t = Mathf.Repeat(t, Cycle);
            walking = false;
            sign = 1;
            if (t < WalkSec) { walking = true; return WalkDistance * t / WalkSec; }
            t -= WalkSec;
            if (t < StandSec) return WalkDistance;
            t -= StandSec;
            if (t < WalkSec) { walking = true; sign = -1; return WalkDistance * (1f - t / WalkSec); }
            return 0f;
        }

        public static Vector3 PosAt(Folk f, float t)
        {
            var d = f.Dir.normalized;
            float off = OffsetAt(t + f.Phase, out _, out _);
            return new Vector3(f.Start.x + d.x * off, 0f, f.Start.y + d.y * off);
        }
    }
}
