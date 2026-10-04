using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Core;
using Saga.Go.World;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0042 이름 없는 군중 진단 — GO 마을은 `PlaytestHeadless`, 숲 마을은 `PlaytestForestHeadless` 가 부른다(읽기만, 같은 계획으로 한 번 더 세워 비교한 뒤 지운다).
    /// 299 목록이 있으면: 수(서 있기+걷기 에서 자리 못 잡은 몫 빼고 ≥ 8)·서로 다른 인물·키 범위·충돌체·이름표 없음·같은 시드 같은 사람·자리·
    /// 이동 주기 순수 함수(0·2·10·20·36초). 목록이 없으면 0명이어야 한다(캡슐 대체 금지).
    /// </summary>
    public static class PlaytestAnonymousCrowd
    {
        private static string _tag, _label;
        private static bool _ok;

        /// <summary>GO 마을 — 역할 인물(역참 행인 15)은 그대로여야 한다.</summary>
        public static bool Run(string tag)
        {
            var fb = FolkBuilder.Instance;
            if (fb == null) { _tag = tag; _label = "GO"; _ok = false; Fail("FolkBuilder 없음(GO 마을 하네스 밖)"); return false; }
            bool ok = Verify(tag, "GO", fb.Crowd, FolkBuilder.CrowdPlan(), Saga.Go.World.CharacterVisual.HumanHeight);
            if (fb.Folk.Count != 15) { _ok = false; Fail($"역할 인물이 15 가 아니다({fb.Folk.Count}) — 군중이 역할 인물을 건드렸다"); ok = false; }
            return ok;
        }

        /// <summary>숲 마을 — 시대 섞인 마을 사람(`ForestEraFolk`)은 그대로여야 한다.</summary>
        public static bool RunForest(string tag)
        {
            bool ok = Verify(tag, "숲", ForestCrowd.Crowd, ForestCrowd.MakePlan(), Saga.Forest.Data.ForestEras.Height);
            int folk = Object.FindObjectsByType<ForestEraFolk>(FindObjectsSortMode.None).Length;
            if (folk != Saga.Forest.Data.ForestEras.FolkList.Length) { _ok = false; Fail($"마을 사람이 {folk} (기대 {Saga.Forest.Data.ForestEras.FolkList.Length}) — 군중이 건드렸다"); ok = false; }
            return ok;
        }

        private static bool Verify(string tag, string label, List<GameObject> crowd, AnonymousCrowd.Plan plan, float height)
        {
            _tag = tag; _label = label; _ok = true;
            string m;
            if (!CrowdBodies.Available)
            {
                if (crowd.Count != 0) Fail($"299 목록이 없는데 군중 {crowd.Count}명이 섰다");
                m = " 299 목록 없음 — 0명(건너뜀)";
            }
            else m = CheckSpawned(crowd, plan, height) + CheckPure() + CheckSameSeed(crowd, plan);
            if (_ok) Debug.Log($"[{_tag}] anon crowd {_label} OK -{m}");
            return _ok;
        }

        private static string CheckSpawned(List<GameObject> crowd, AnonymousCrowd.Plan plan, float height)
        {
            int want = plan.Standing + plan.Walking;
            if (crowd.Count < 8 || crowd.Count > want) Fail($"군중 수 {crowd.Count} (기대 8~{want})");
            var meshes = new HashSet<int>();   // 몸 메시 에셋 번호 — VRoid 몸은 메시 이름이 공통(Body 등)이라 이름으로는 못 가른다
            int walks = 0;
            float minH = 99f, maxH = 0f;
            foreach (var go in crowd)
            {
                var w = go.GetComponent<CrowdWalker>();
                if (w == null) { Fail($"{go.name} CrowdWalker 없음"); continue; }
                if (w.Walks) walks++;
                var smr = go.GetComponentInChildren<SkinnedMeshRenderer>();
                if (smr == null || smr.sharedMesh == null) { Fail($"{go.name} 스킨 몸 없음"); continue; }
                meshes.Add(smr.sharedMesh.GetInstanceID());
                // 몸("Visual")만 잰다 — 지면 위에 남는 그림자(BlobShadow)는 숲에서 몸이 땅 휨만큼 내려가면 키에 섞인다
                var visual = go.transform.Find("Visual");
                var rs = (visual != null ? visual : go.transform).GetComponentsInChildren<Renderer>().Where(r => !(r is ParticleSystemRenderer)).ToArray();
                var b = rs[0].bounds;
                foreach (var r in rs) b.Encapsulate(r.bounds);
                minH = Mathf.Min(minH, b.size.y); maxH = Mathf.Max(maxH, b.size.y);
                if (go.GetComponentsInChildren<Collider>().Any(c => !c.isTrigger)) Fail($"{go.name} 에 충돌체(군중은 길을 안 막는다)");
                if (go.transform.Find("NameTag") != null || go.GetComponentInChildren<VillagerTalk>() != null) Fail($"{go.name} 에 이름표·대사(이름 없는 군중)");
                if (go.GetComponentInChildren<CrowdBodyAnimator>() == null) Fail($"{go.name} 동작기 없음");
                float dist = new Vector2(go.transform.position.x - plan.Center.x, go.transform.position.z - plan.Center.z).magnitude;
                if (dist > plan.Radius + 0.5f + (w.Walks ? AnonymousCrowd.WalkDistance : 0f)) Fail($"{go.name} 자리 둘레 밖 {dist:0.0}m");
            }
            if (meshes.Count != crowd.Count) Fail($"서로 다른 인물 {meshes.Count} ≠ 사람 {crowd.Count}");
            if (walks > plan.Walking) Fail($"걷는 사람 {walks} > {plan.Walking}");
            if (minH < height * 0.86f || maxH > height * 1.12f) Fail($"키 {minH:0.00}~{maxH:0.00}m 가 {height:0.0}m 범위 밖");
            return $" {crowd.Count}명(걷기 {walks})·서로 다른 인물 {meshes.Count}·키 {minH:0.00}~{maxH:0.00}m";
        }

        /// <summary>이동 주기 순수 함수 — 0초 0m·2초 4m(걷는 중)·10초 8m(섬)·20초 돌아오는 걸음·36초 0m.</summary>
        private static string CheckPure()
        {
            float o0 = CrowdWalker.OffsetAt(0f, out bool w0, out _);
            float o2 = CrowdWalker.OffsetAt(2f, out bool w2, out int s2);
            float o10 = CrowdWalker.OffsetAt(10f, out bool w10, out _);
            CrowdWalker.OffsetAt(20f, out bool w20, out int s20);
            float o36 = CrowdWalker.OffsetAt(36f, out _, out _);
            if (!Mathf.Approximately(o0, 0f) || !w0) Fail($"0초 {o0}m 걷기 {w0}");
            if (Mathf.Abs(o2 - 4f) > 0.01f || !w2 || s2 != 1) Fail($"2초 {o2}m 걷기 {w2} 방향 {s2}");
            if (Mathf.Abs(o10 - AnonymousCrowd.WalkDistance) > 0.01f || w10) Fail($"10초 {o10}m 걷기 {w10}");
            if (!w20 || s20 != -1) Fail($"20초 돌아오는 걸음이 아니다 걷기 {w20} 방향 {s20}");
            if (!Mathf.Approximately(o36, 0f)) Fail($"36초 {o36}m(한 주기 뒤 제자리)");
            return " 주기 0·2·10·20·36초";
        }

        /// <summary>같은 계획으로 한 번 더 세우면 같은 사람·같은 자리(서 있는 사람만 — 걷는 사람은 그사이 오갔다). 세운 뒤 지운다.</summary>
        private static string CheckSameSeed(List<GameObject> crowd, AnonymousCrowd.Plan plan)
        {
            var tmp = new GameObject("CrowdSeedCheck").transform;
            var again = AnonymousCrowd.Spawn(tmp, plan);
            int Id(GameObject g) { var s = g.GetComponentInChildren<SkinnedMeshRenderer>(); return s != null && s.sharedMesh != null ? s.sharedMesh.GetInstanceID() : 0; }
            if (again.Count != crowd.Count) Fail($"같은 시드인데 수가 다르다 {again.Count} ≠ {crowd.Count}");
            else
            {
                for (int i = 0; i < again.Count; i++)
                {
                    if (Id(again[i]) != Id(crowd[i])) Fail($"같은 시드인데 {i} 번 사람이 다르다");
                    if (!crowd[i].GetComponent<CrowdWalker>().Walks && (again[i].transform.position - crowd[i].transform.position).sqrMagnitude > 0.25f) Fail($"같은 시드인데 {i} 번 자리가 다르다");
                }
            }
            Object.DestroyImmediate(tmp.gameObject);
            return " 같은 시드 같은 사람·자리";
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] anon crowd {_label} FAIL - {msg}");
        }
    }
}
