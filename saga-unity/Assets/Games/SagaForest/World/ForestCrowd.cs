using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// U-0042 숲 마을 광장의 이름 없는 군중 — 인물 299 행인 열(서 있기 넷·걷기 여섯). `ForestBootstrap.Start` 가 `Install` 을 부른다(씬 재빌드 없이, Play 때).
    /// 시대 섞인 마을 사람(`ForestEraFolk`)·손님(`ForestVisitorNpc`)과 별개 — 이름표·대사·충돌체 없음. 299 목록이 없는 PC 는 0명.
    /// 자리 규칙은 `PlaytestForestEras` 의 사람 길과 같다: 존 밖 · 마을 가장자리 3m 안쪽 · 물건 3m · 집 5m · 존 소품 3m · 플레이어 스폰 4m.
    /// 사실 몸은 `ForestWorldCurve` 셰이더를 안 타 땅 휨만큼 몸을 내린다(<see cref="ForestLandmark.CurveAmount"/>).
    /// </summary>
    public static class ForestCrowd
    {
        public const int Standing = 4, Walking = 6;
        public const uint Seed = 20261005u;
        public const float Radius = 26f;
        public const float ObjectClearance = 3f, HouseClearance = 5f, PropClearance = 3f, SpawnClearance = 4f, FolkClearance = 2.5f, EdgeMargin = 3f;

        private static readonly HashSet<string> Objects = new HashSet<string>
        {
            "ForestCollectSpot", "ForestDeliveryMailbox", "ForestLandmark", "ForestFinishStall", "ForestVillager", "ForestFruitTree",
            "ForestTownScoreBoard", "ForestDeliveryCounter", "ForestWishStone", "ForestFurnitureStall",
        };

        public static List<GameObject> Crowd { get; private set; } = new List<GameObject>();

        public static void Install()
        {
            Crowd = new List<GameObject>();
            if (!CrowdBodies.Available) return;
            var host = new GameObject("ForestCrowdHost");
            Crowd = AnonymousCrowd.Spawn(host.transform, MakePlan());
            if (Crowd.Count == 0) Object.Destroy(host);
        }

        /// <summary>지금 씬의 물건·집·존 소품·사람 길·스폰을 읽어 군중 계획을 만든다(진단이 같은 계획으로 한 번 더 세워 견준다).</summary>
        public static AnonymousCrowd.Plan MakePlan()
        {
            var spawn = new Vector3(0f, 0f, -15f);
            var player = GameObject.FindWithTag("Player");
            if (player != null) spawn = player.transform.position;

            var blockers = new List<(Vector2 pos, float r)>();
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                if (mb == null) continue;
                string n = mb.GetType().Name;
                if (Objects.Contains(n)) blockers.Add((new Vector2(mb.transform.position.x, mb.transform.position.z), ObjectClearance));
                else if (n == "ForestHouse") blockers.Add((new Vector2(mb.transform.position.x, mb.transform.position.z), HouseClearance));
            }
            foreach (var c in ForestZoneProps.Clusters)
                foreach (var p in c.Pieces)
                {
                    var pp = ForestZoneProps.PiecePos(c, p);
                    blockers.Add((new Vector2(pp.x, pp.z), PropClearance));
                }
            blockers.Add((new Vector2(spawn.x, spawn.z), SpawnClearance));
            // 시대 섞인 마을 사람의 오가는 길(처음·가운데·끝)도 비킨다 — 군중이 그 사람 길을 막지 않게
            foreach (var f in ForestEras.FolkList)
                for (int s = 0; s <= 2; s++)
                {
                    var q = f.Start + f.Dir.normalized * (ForestEras.WalkDistance * 0.5f * s);
                    blockers.Add((q, FolkClearance));
                }

            return new AnonymousCrowd.Plan
            {
                Center = Vector3.zero, Radius = Radius, Standing = Standing, Walking = Walking, Seed = Seed,
                Height = ForestEras.Height, CurveAmount = ForestLandmark.CurveAmount,
                CanStand = p => IsClear(p, blockers),
            };
        }

        /// <summary>이 자리에 설 수 있나 — 존 밖·마을 가장자리 안쪽·비킬 물건에서 떨어짐(진단도 부른다).</summary>
        public static bool IsClear(Vector3 p, List<(Vector2 pos, float r)> blockers)
        {
            if (ForestBiomeData.ZoneAt(p.x, p.z) >= 0) return false;
            if (Mathf.Abs(p.x) > ForestGroundBuilder.VillageWidth * 0.5f - EdgeMargin || Mathf.Abs(p.z) > ForestGroundBuilder.VillageDepth * 0.5f - EdgeMargin) return false;
            var v = new Vector2(p.x, p.z);
            foreach (var (pos, r) in blockers) if ((pos - v).magnitude < r) return false;
            return true;
        }
    }
}
