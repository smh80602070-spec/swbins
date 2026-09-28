using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 107-1 "무대 전환 없음" — 들판 적 무리 여섯 곳 + 107 ⑤ 원소 쓰는 적 무리 셋을 Play 시작 때 세운다(편집기에선 모델만 받아 둔다 —
    /// 적은 체력·상태를 가진 런타임 존재라 씬에 굳히지 않는다). 자리는 사건 칸(마을·상인·촌장·도적·
    /// 희귀 늑대·채집·산신당·사당 시련·봉수대·돌탑·유물·보물)을 피한 숲·공터, 마을 스폰에서 두 칸 넘게.
    /// </summary>
    public class FieldSpawner : MonoBehaviour
    {
        private struct Group
        {
            public string Id;
            public float Gx, Gy;
            public FieldEnemy.Kind[] Members;
        }

        private static readonly FieldEnemy.Kind B = FieldEnemy.Kind.Bandit;
        private static readonly FieldEnemy.Kind S = FieldEnemy.Kind.Skeleton;
        private static readonly FieldEnemy.Kind F = FieldEnemy.Kind.EmberImp;
        private static readonly FieldEnemy.Kind W = FieldEnemy.Kind.DrownedGhost;
        private static readonly FieldEnemy.Kind T = FieldEnemy.Kind.StormWraith;

        private static readonly Group[] Groups =
        {
            new Group { Id = "east_grove_n", Gx = 6.9f, Gy = 2.0f, Members = new[] { B, B, B } },
            new Group { Id = "east_grove_s", Gx = 6.8f, Gy = 4.1f, Members = new[] { S, S } },
            new Group { Id = "north_wood",   Gx = 1.5f, Gy = 1.1f, Members = new[] { S, S, S } },
            new Group { Id = "south_glade_w", Gx = 1.6f, Gy = 7.0f, Members = new[] { B, B, S } },
            new Group { Id = "south_glade_e", Gx = 5.0f, Gy = 7.1f, Members = new[] { S, S } },
            new Group { Id = "farm_edge",    Gx = 1.6f, Gy = 9.0f, Members = new[] { B, B } },
            // 107 ⑤ 원소 쓰는 적 — 무리 셋 여덟(보물 상자·역참·사건 칸을 비켜 섰다)
            new Group { Id = "spirit_grove", Gx = 5.5f, Gy = 2.2f, Members = new[] { W, W } },
            new Group { Id = "spirit_west",  Gx = 0.2f, Gy = 4.0f, Members = new[] { T, T, W } },
            new Group { Id = "spirit_farm",  Gx = 5.3f, Gy = 9.0f, Members = new[] { F, F, T } },
        };

        public const float GroupSpread = 4.5f;

        // 107-7 망루 수호장 — 옛 망루(4,6) 고원 남쪽 발치, 남쪽 공터 북쪽 가장자리(역참·돌탑·두 무리를 비켜 섰다).
        public const float GuardianGx = 3.6f;
        public const float GuardianGy = 6.75f;
        public const string GuardianGroupId = "tower_guardian";

        [SerializeField] private GameObject banditModel;
        [SerializeField] private GameObject skeletonModel;
        [SerializeField] private GameObject guardianModel;
        // PLAN.md 109-1 — 다른 시대 적 몸(`GoEras.FoeBodies` 이름과 같은 순서로 씬 빌더가 채운다). 없는 PC 는 null → 옛 몸.
        [SerializeField] private string[] eraBodyNames = new string[0];
        [SerializeField] private GameObject[] eraBodyModels = new GameObject[0];

        /// <summary>109-1 — 무리 시대(한가운데·id 로 정해진다, 수호장은 과거). 모르는 id 는 과거.</summary>
        public static GoEra GroupEra(string groupId)
        {
            foreach (var g in Groups) if (g.Id == groupId) return GoEras.GroupEra(g.Id, TestMapData.WorldPos(g.Gx, g.Gy));
            return GoEra.Past;
        }

        /// <summary>109-1 — 그 지역 무리에 서는 다른 시대 적 이름들(겹침 없이, 원소 낱말 빼고). 지역 자막·지도 줄이 쓴다.</summary>
        public static System.Collections.Generic.List<string> EraFoeNames(string regionId)
        {
            var names = new System.Collections.Generic.List<string>();
            foreach (var g in Groups)
            {
                if (GoWorldMap.RegionAt(TestMapData.WorldPos(g.Gx, g.Gy)) != regionId) continue;
                GoEra era = GroupEra(g.Id);
                if (era == GoEra.Past) continue;
                for (int i = 0; i < g.Members.Length; i++)
                {
                    string n = GoEras.FoeBodyName(GoEras.FoeBodyFor(era, g.Id, i));
                    if (!names.Contains(n)) names.Add(n);
                }
            }
            return names;
        }

        private GameObject EraModel(string body)
        {
            for (int i = 0; i < eraBodyNames.Length && i < eraBodyModels.Length; i++)
                if (eraBodyNames[i] == body) return eraBodyModels[i];
            return null;
        }

        /// <summary>109-6 — 들판 인물의 졸개 하나(겨루기 동안만). 원소 = 그 인물 원소, 옛 시대면 해골 몸·다른 시대면 그 시대 몸.</summary>
        public FieldEnemy SpawnHeroMinion(GoElement element, Vector3 home, string groupId, GoEra era, int index)
        {
            var kind = element == GoElement.Pyro ? FieldEnemy.Kind.EmberImp : element == GoElement.Hydro ? FieldEnemy.Kind.DrownedGhost : FieldEnemy.Kind.StormWraith;
            string body = GoEras.FoeBodyFor(era, groupId, index);
            GameObject model = skeletonModel;
            if (body != null) { var m = EraModel(body); if (m != null) model = m; }
            // 109-14-1a — 풍·빙·암·초 인물은 제 괴물이 아직 없어(14-1b) 옛 몸에 그 원소를 입힌다
            var over = element == GoElement.Pyro || element == GoElement.Hydro || element == GoElement.Electro ? GoElement.Physical : element;
            return FieldEnemy.Spawn(kind, home, model, groupId, transform, era, body, over);
        }

        /// <summary>109-14-9 숨은 터 적 하나 — 옛 몸(산적 = 산적 몸, 나머지 = 해골 몸)에 덧씌울 원소, 지역 위험 2 고정(단계 배율은 부르는 쪽).</summary>
        public FieldEnemy SpawnDomainFoe(FieldEnemy.Kind kind, GoElement over, Vector3 home, string groupId)
        {
            GameObject model = kind == FieldEnemy.Kind.Bandit ? banditModel : skeletonModel;
            var e = FieldEnemy.Spawn(kind, home, model, groupId, transform, GoEra.Past, null, over);
            e.ApplyDanger(GoDomain.DomainDanger);
            return e;
        }

        /// <summary>109-14-12 이야기 임무 적 하나 — 옛 몸(산적 = 산적 몸, 나머지 = 해골 몸), 선 지역 위험도, 경험·전리품 없이 다시 안 선다.</summary>
        public FieldEnemy SpawnStoryFoe(FieldEnemy.Kind kind, Vector3 home, string groupId)
        {
            GameObject model = kind == FieldEnemy.Kind.Bandit ? banditModel : skeletonModel;
            var e = FieldEnemy.Spawn(kind, home, model, groupId, transform);
            e.ApplyDanger(GoWorldMap.DangerOf(GoWorldMap.RegionAt(home)));
            e.MarkStory();
            return e;
        }

        /// <summary>세우는 들판 적 수 — 이미 쓰러뜨린 수호장은 안 센다.</summary>
        public static int PlannedCount
        {
            get
            {
                int n = GuardianState.Standing ? 1 : 0;
                foreach (var g in Groups) n += g.Members.Length;
                return n;
            }
        }

        public static int GroupCount => Groups.Length;

        /// <summary>107-8 지역 사명 — 무리 한가운데가 선 지역. 모르는 id(수호장 포함)는 null.</summary>
        public static string GroupRegion(string groupId)
        {
            foreach (var g in Groups) if (g.Id == groupId) return GoWorldMap.RegionAt(TestMapData.WorldPos(g.Gx, g.Gy));
            return null;
        }

        /// <summary>108 진단 — 무리 id·구성(한가운데 지역은 `GroupRegion`).</summary>
        public static System.Collections.Generic.IEnumerable<(string id, FieldEnemy.Kind[] members)> GroupMembers()
        {
            foreach (var g in Groups) yield return (g.Id, g.Members);
        }

        /// <summary>107-3 식생 바이옴 — 늘어난 나무·풀이 비키는 들판 무리 한가운데(땅 높이 0).</summary>
        public static System.Collections.Generic.IEnumerable<Vector3> GroupCenters()
        {
            foreach (var g in Groups) yield return TestMapData.WorldPos(g.Gx, g.Gy);
        }

        /// <summary>그 무리 적이 한꺼번에 모두 쓰러져 있나(하나라도 서 있으면 false, 그 무리 적이 없어도 false).</summary>
        public static bool GroupWiped(string groupId)
        {
            int n = 0;
            foreach (var e in FieldEnemy.All)
            {
                if (e.GroupId != groupId) continue;
                if (e.Alive) return false;
                n++;
            }
            return n > 0;
        }

        private void Start()
        {
            if (GetComponent<FieldHeroes>() == null) gameObject.AddComponent<FieldHeroes>(); // 109-6 들판 인물
            if (GetComponent<Saga.Go.UI.HeroDexUi>() == null) gameObject.AddComponent<Saga.Go.UI.HeroDexUi>(); // 109-6b 도감 화면
            if (FieldEnemy.All.Count > 0) return;
            foreach (var g in Groups)
            {
                Vector3 center = TestMapData.WorldPos(g.Gx, g.Gy);
                int danger = GoWorldMap.DangerOf(GoWorldMap.RegionAt(center)); // 108 지역 위험도
                GoEra era = GoEras.GroupEra(g.Id, center); // 109-1 무리 시대
                for (int i = 0; i < g.Members.Length; i++)
                {
                    float a = i * Mathf.PI * 2f / g.Members.Length + g.Gx;
                    Vector3 home = center + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * GroupSpread;
                    var kind = g.Members[i];
                    // 원소 쓰는 적은 해골 모델에 원소 빛깔을 입힌다("원소 깃든 망자", 사실적 PBR 트랙이라 코드 도형 대신)
                    GameObject model = kind == FieldEnemy.Kind.Bandit ? banditModel : skeletonModel;
                    string body = GoEras.FoeBodyFor(era, g.Id, i);
                    if (body != null)
                    {
                        // 다른 시대 몸 — 없는 PC 는 옛 몸에 그 시대 이름만(종류·원소 규칙은 그대로)
                        var eraModel = EraModel(body);
                        if (eraModel != null) model = eraModel;
                    }
                    FieldEnemy.Spawn(kind, home, model, g.Id, transform, era, body).ApplyDanger(danger);
                }
            }
            // 109-14-10 늘 세운다 — 서 있을 때가 아니면 첫 틱에 스스로 꺼지고, 꽃을 받고 150초 뒤 `GuardianBloom` 이 다시 켠다
            {
                FieldEnemy.Spawn(FieldEnemy.Kind.Guardian, TestMapData.WorldPos(GuardianGx, GuardianGy),
                    guardianModel != null ? guardianModel : banditModel, GuardianGroupId, transform);
            }
        }
    }
}
