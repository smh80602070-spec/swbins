using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-1 "GO 세 시대 사람"(웹 사가고 ⑱ `folk.js` 재해석) — 순간이동 역참 다섯 곳 둘레에 사람 셋씩
    /// (첫째 제 시대 + 나머지 두 시대). 역할·몸·대사는 `GoEras.Roles`. 적처럼 Play 시작 때 세운다(씬에 굽지 않는다 —
    /// 몸 프리팹만 씬 빌더가 넘긴다). 싸우지 않고 등용 대상도 아니다 — 곁을 지나면 땅·역참 이름 든 한 마디.
    /// </summary>
    public class FolkBuilder : MonoBehaviour
    {
        /// <summary>역참 돌기둥에서 사람까지(m). 돌기둥·도착 자리(남쪽 4m)를 비킨다.</summary>
        public const float Ring = 13f;
        public const float TalkRadius = 12f;
        public const int PerWaypoint = 3;

        [SerializeField] private string[] bodyNames = new string[0];
        [SerializeField] private GameObject[] bodyModels = new GameObject[0];

        public static FolkBuilder Instance { get; private set; }
        public readonly List<FolkWalker> Folk = new List<FolkWalker>();

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            if (Folk.Count > 0) return;
            for (int w = 0; w < GoWorldMap.Waypoints.Length; w++)
                for (int k = 0; k < PerWaypoint; k++) Spawn(w, k);
            SpawnCrowd();
        }

        /// <summary>마을 군중(U-0042) — 인물 299 중 이름 없는 행인 열(서 있기 넷·걷기 여섯). 역할 인물과 별개, 299 목록이 없는 PC 는 0명.</summary>
        public const int CrowdStanding = 4, CrowdWalking = 6;
        public const uint CrowdSeed = 20261004u;
        public List<GameObject> Crowd { get; private set; } = new List<GameObject>();

        /// <summary>마을 칸('H' 둘 사이) 가운데 둘레 22m — 서 있을 수 있는 자리만.</summary>
        public static Vector3 CrowdCenter => TestMapData.WorldPos(3f, 3.5f);

        private void SpawnCrowd() => Crowd = AnonymousCrowd.Spawn(transform, CrowdPlan());

        /// <summary>군중 계획 — 진단이 같은 계획으로 한 번 더 세워 견준다.</summary>
        public static AnonymousCrowd.Plan CrowdPlan() => new AnonymousCrowd.Plan
        {
            Center = CrowdCenter, Radius = 22f, Standing = CrowdStanding, Walking = CrowdWalking,
            Seed = CrowdSeed, Height = CharacterVisual.HumanHeight, CanStand = FieldEnemy.CanStandOn,
        };

        /// <summary>몸 이름 → 모델(109-14-19 이야기 인물 노 도둑·해솔도 빌린다).</summary>
        public GameObject BodyModel(string body)
        {
            for (int i = 0; i < bodyNames.Length && i < bodyModels.Length; i++)
                if (bodyNames[i] == body) return bodyModels[i];
            return null;
        }

        /// <summary>역참 w 의 k 번째 사람이 서는 자리와 걷는 쪽 — 돌기둥 둘레 120° 간격, 설 수 없는 칸이면 40°씩 돌려 본다.</summary>
        public static bool TryPlace(int w, int k, out Vector3 start, out Vector3 dir)
        {
            Vector3 pillar = GoWorldMap.WaypointPos(GoWorldMap.Waypoints[w]);
            float baseDeg = 25f + k * 120f + w * 17f;
            for (int t = 0; t < 9; t++)
            {
                float a = (baseDeg + t * 40f) * Mathf.Deg2Rad;
                Vector3 radial = new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a));
                Vector3 tangent = new Vector3(-radial.z, 0f, radial.x);
                Vector3 p0 = pillar + radial * Ring;
                Vector3 p1 = p0 + tangent * FolkWalker.WalkDistance;
                if (FieldEnemy.CanStandOn(p0) && FieldEnemy.CanStandOn(p1) && FieldEnemy.CanStandOn(p0 + tangent * FolkWalker.WalkDistance * 0.5f))
                {
                    start = p0;
                    dir = tangent;
                    return true;
                }
            }
            start = pillar + Vector3.right * Ring;
            dir = Vector3.forward;
            return false;
        }

        private void Spawn(int w, int k)
        {
            var role = GoEras.FolkAt(w, k);
            TryPlace(w, k, out Vector3 start, out Vector3 dir);
            var root = new GameObject($"Folk_{GoWorldMap.Waypoints[w].Id}_{role.Id}");
            root.transform.SetParent(transform, false);
            root.transform.position = FolkWalker.Grounded(start);

            var walker = root.AddComponent<FolkWalker>();
            walker.Init(role, w, start, dir, (w * 7 + k * 11) % 36);

            if (NpcIdle.SpawnRigged(BodyModel(role.Body), root.transform, CharacterVisual.HumanHeight) == null)
                CharacterVisual.SpawnFallbackCapsule(root.transform, role.Fallback);
            walker.BindAnimator();

            var talkGo = new GameObject("TalkArea");
            talkGo.transform.SetParent(root.transform, false);
            var col = talkGo.AddComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = TalkRadius;
            int wi = w;
            talkGo.AddComponent<VillagerTalk>().Init(GoEras.FolkName(role), () => GoEras.FolkLine(role, wi));
            Folk.Add(walker);
        }
    }
}
