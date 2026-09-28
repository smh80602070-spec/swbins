using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 107-4 "보물 상자" — 상자 열여섯의 표(등급 4 × 잠금 3)와 보상 규칙만 모은 순수 정적 클래스.
    /// Godot 사가고(⑥)와 비율만 같고(등급 경험치 5·15·30·60, 평범 7·정교 4·진귀 3·화려 2) 코드는 따로다.
    /// 연 상자는 `WorldEventState` 의 `chest_<id>` — 세이브 스키마(v14)는 그대로.
    /// 거리는 GO 사람 키 배율(약 1.85)로 늘렸다: 석등 둘레 6m → 11m, 여는 거리 2m → 4m.
    /// </summary>
    public static class GoTreasure
    {
        public enum Grade { Common = 0, Exquisite = 1, Precious = 2, Luxurious = 3 }

        /// <summary>잠금 — 없음 · 무리 전멸(`FieldSpawner` 무리 id 의 적이 한꺼번에 모두 쓰러짐) · 원소 석등 · 109-14-22 과녁 셋(활·서책으로 맞혀 10초 안에 모두 빛나게).</summary>
        public enum Lock { None, Group, Torches, Targets }

        /// <summary>놓이는 자리 — 땅 · 산 칸 고원 윗면 · 봉우리 꼭대기 · 옛 망루 꼭대기.</summary>
        public enum Spot { Ground, Plateau, Peak, Tower }

        public struct Chest
        {
            public string Id;
            public Grade Grade;
            public Lock Lock;
            public Spot Spot;
            public float Gx, Gy;
            public string GroupId;          // Lock.Group
            public GoElement[] Torches;     // Lock.Torches — 석등마다 정한 원소
            public string ItemId;           // 화려만 — 없으면 null
            public float TargetDeg;         // Lock.Targets — 첫 과녁 방향(도, 북 0 시계 방향)
        }

        // ---- PLAN.md 109-14-22 과녁 잠금(웹 사가고 ⑲-22 treasure 과녁) — 상자에서 12·16·20m(웹 9·12·15m × 1.35), 2.1 라디안씩.
        // 화살(충전 무관)·서책·활 기본 공격(둘레에 적이 없으면 사거리 안 가장 가까운 과녁)이 맞히면 10초 금빛, 셋이 함께 빛나면 풀린다.
        public static readonly float[] TargetDist = { 12f, 16f, 20f };
        public const float TargetStepRad = 2.1f, TargetLitSec = 10f, TargetHeight = 2.4f;

        /// <summary>과녁 i 의 자리(땅 높이, 기둥 밑).</summary>
        public static Vector3 TargetPosition(Chest c, int i)
        {
            float a = c.TargetDeg * Mathf.Deg2Rad + i * TargetStepRad;
            Vector3 p = Position(c) + new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a)) * TargetDist[i];
            var (gx, gy) = TestMapData.WorldToGrid(p);
            p.y = TestMapData.GroundHeight(gx, gy);
            return p;
        }

        public static readonly int[] ExpByGrade = { 5, 15, 30, 60 };
        public static readonly int[] GoldByGrade = { 10, 25, 50, 100 };

        public const float OpenRadius = 4f;
        public const float OpenHeight = 3f;
        public const float HintRadius = 14f;
        public const float TorchRingRadius = 11f;
        public const float TorchWindowSec = 20f;
        /// <summary>석등이 원소 스킬·폭발 원에 걸리는 여유(석등 몸 반지름).</summary>
        public const float TorchHitSlack = 1f;
        /// <summary>망루 꼭대기 화톳불(반지름 1.1m)을 비켜 앉는 거리.</summary>
        public const float TowerTopOffset = 2.4f;
        /// <summary>봉우리·고원 한가운데를 비켜 앉는 거리 — 가운데는 이동·지도 진단이 위에서 쏴 높이를 잰다
        /// (봉우리 윗면 육각 안지름 4.3m 안).</summary>
        public const float PeakCenterOffset = 2.2f;
        public static readonly Vector3 PlateauCenterOffset = new Vector3(6f, 0f, 6f);

        private static readonly GoElement P = GoElement.Pyro;
        private static readonly GoElement H = GoElement.Hydro;

        public static readonly Chest[] Chests =
        {
            // 평범 7 — 잠금 없음, 숲·들 곳곳(사건 칸 한가운데는 비켜 섰다)
            new Chest { Id = "west_path",   Grade = Grade.Common, Spot = Spot.Ground, Gx = 0.3f, Gy = 2.3f },
            new Chest { Id = "north_wood",  Grade = Grade.Common, Spot = Spot.Ground, Gx = 2.3f, Gy = 1.2f },
            new Chest { Id = "village_e",   Grade = Grade.Common, Spot = Spot.Ground, Gx = 4.3f, Gy = 2.3f },
            new Chest { Id = "river_bank",  Grade = Grade.Common, Spot = Spot.Ground, Gx = 1.3f, Gy = 4.3f },
            new Chest { Id = "south_glade", Grade = Grade.Common, Spot = Spot.Ground, Gx = 2.3f, Gy = 6.8f },
            new Chest { Id = "cairn_side",  Grade = Grade.Common, Spot = Spot.Ground, Gx = 3.6f, Gy = 6.7f },
            new Chest { Id = "farm_e",      Grade = Grade.Common, Spot = Spot.Ground, Gx = 4.3f, Gy = 9.3f },
            // 정교 4 — 잠금 없음, 높은 곳(기어올라야 닿는다)
            new Chest { Id = "tower_top",   Grade = Grade.Exquisite, Spot = Spot.Tower,   Gx = GoWorldMap.TowerGx, Gy = GoWorldMap.TowerGy },
            new Chest { Id = "peak_gate",   Grade = Grade.Exquisite, Spot = Spot.Peak,    Gx = 4, Gy = 8 },
            new Chest { Id = "peak_river",  Grade = Grade.Exquisite, Spot = Spot.Peak,    Gx = 6, Gy = 6 },
            new Chest { Id = "ledge_west",  Grade = Grade.Exquisite, Spot = Spot.Plateau, Gx = 2, Gy = 6 },
            // 진귀 3 — 무리 전멸(들판 적 무리 한가운데)
            new Chest { Id = "grove_band",  Grade = Grade.Precious, Lock = Lock.Group, Spot = Spot.Ground, Gx = 6.9f, Gy = 2.0f, GroupId = "east_grove_n" },
            new Chest { Id = "glade_band",  Grade = Grade.Precious, Lock = Lock.Group, Spot = Spot.Ground, Gx = 1.6f, Gy = 7.0f, GroupId = "south_glade_w" },
            new Chest { Id = "farm_band",   Grade = Grade.Precious, Lock = Lock.Group, Spot = Spot.Ground, Gx = 1.6f, Gy = 9.0f, GroupId = "farm_edge" },
            // 화려 2 — 원소 석등. 첫째는 주인공(화) 혼자 풀고, 둘째는 수 원소 동료(등용한 산적)가 있어야 풀린다
            new Chest { Id = "lantern_west", Grade = Grade.Luxurious, Lock = Lock.Torches, Spot = Spot.Ground, Gx = 1.4f, Gy = 2.4f, Torches = new[] { P, P, P }, ItemId = "wp_iron" },
            new Chest { Id = "lantern_ford", Grade = Grade.Luxurious, Lock = Lock.Torches, Spot = Spot.Ground, Gx = 4.6f, Gy = 4.3f, Torches = new[] { P, H, P }, ItemId = "ar_leather" },
            // 109-14-22 과녁 셋 — 웹은 고향 밖 무늬 상자 절반이지만 이 판 무늬 상자는 높은 곳 자리라 잠금 퍼즐 등급(옻칠) 하나를, 들이 다 차 있어
            // 남쪽 공터와 논밭 사이 봉우리 없는 산 (1,8) 고원 위에(멀리서 쏘기 좋은 자리). 첫 방향 59.4° 면 과녁 셋이 모두 그 고원 안이다.
            new Chest { Id = "target_ledge", Grade = Grade.Precious, Lock = Lock.Targets, Spot = Spot.Plateau, Gx = 1, Gy = 8, TargetDeg = 59.4f },
        };

        public static string EventKey(Chest c) => "chest_" + c.Id;

        public static bool IsOpened(Chest c) => WorldEventState.IsTriggered(EventKey(c));

        public static int OpenedCount
        {
            get
            {
                int n = 0;
                foreach (var c in Chests) if (IsOpened(c)) n++;
                return n;
            }
        }

        public static int CountOf(Grade g)
        {
            int n = 0;
            foreach (var c in Chests) if (c.Grade == g) n++;
            return n;
        }

        public static string GradeName(Grade g)
        {
            switch (g)
            {
                case Grade.Exquisite: return GoLocalization.T("chest.grade1", "무늬 상자");
                case Grade.Precious: return GoLocalization.T("chest.grade2", "옻칠 상자");
                case Grade.Luxurious: return GoLocalization.T("chest.grade3", "금박 상자");
                default: return GoLocalization.T("chest.grade0", "나무 상자");
            }
        }

        public static Color GradeColor(Grade g)
        {
            switch (g)
            {
                case Grade.Exquisite: return new Color(0.78f, 0.52f, 0.28f);  // 구리
                case Grade.Precious: return new Color(0.62f, 0.78f, 0.95f);   // 은청
                case Grade.Luxurious: return new Color(1f, 0.8f, 0.3f);       // 금
                default: return new Color(0.45f, 0.45f, 0.48f);               // 쇠
            }
        }

        /// <summary>상자가 앉는 자리(바닥 가운데, 땅 높이 포함).</summary>
        public static Vector3 Position(Chest c)
        {
            switch (c.Spot)
            {
                case Spot.Peak:
                {
                    int gx = Mathf.RoundToInt(c.Gx), gy = Mathf.RoundToInt(c.Gy);
                    return TestMapData.PeakBase(gx, gy) + new Vector3(PeakCenterOffset, TestMapData.PeakHeight(gx, gy), 0f);
                }
                case Spot.Plateau:
                {
                    int gx = Mathf.RoundToInt(c.Gx), gy = Mathf.RoundToInt(c.Gy);
                    return TestMapData.WorldPos(gx, gy) + PlateauCenterOffset + Vector3.up * TestMapData.GroundHeight(gx, gy);
                }
                case Spot.Tower:
                {
                    float top = TestMapData.GroundHeight(GoWorldMap.TowerGx, GoWorldMap.TowerGy) + GoWorldMap.TowerHeight;
                    return TestMapData.WorldPos(GoWorldMap.TowerGx, GoWorldMap.TowerGy) + new Vector3(TowerTopOffset, top, 0f);
                }
                default:
                {
                    var (gx, gy) = TestMapData.WorldToGrid(TestMapData.WorldPos(c.Gx, c.Gy));
                    return TestMapData.WorldPos(c.Gx, c.Gy) + Vector3.up * TestMapData.GroundHeight(gx, gy);
                }
            }
        }

        /// <summary>석등 i 의 자리 — 상자 둘레 11m 에 고르게(첫째는 북쪽).</summary>
        public static Vector3 TorchPosition(Chest c, int i)
        {
            int n = c.Torches != null ? c.Torches.Length : 1;
            float a = i * Mathf.PI * 2f / n;
            Vector3 p = Position(c) + new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a)) * TorchRingRadius;
            var (gx, gy) = TestMapData.WorldToGrid(p);
            p.y = TestMapData.GroundHeight(gx, gy);
            return p;
        }
    }
}
