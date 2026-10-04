using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Core;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0042 이름 없는 군중 진단 — `PlaytestHeadless`(GO 마을)가 부른다(읽기만, 세운 군중과 같은 시드로 한 번 더 세워 비교한 뒤 지운다).
    /// 299 목록이 있으면: 수(서 있기 4 + 걷기 6 에서 자리 못 잡은 몫 빼고 ≥ 8)·서로 다른 인물·키 ±8%·충돌체·이름표 없음·같은 시드 같은 사람·자리·
    /// 이동 주기 순수 함수(0·2·10·22·36초) · 역할 인물(`FolkWalker` 15)은 그대로. 목록이 없으면 0명이어야 한다(캡슐 대체 금지).
    /// </summary>
    public static class PlaytestAnonymousCrowd
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fb = FolkBuilder.Instance;
            if (fb == null) { Fail("FolkBuilder 없음(GO 마을 하네스 밖)"); return false; }
            string m;
            if (!CrowdBodies.Available)
            {
                if (fb.Crowd.Count != 0) Fail($"299 목록이 없는데 군중 {fb.Crowd.Count}명이 섰다");
                if (fb.transform.Find("AnonymousCrowd") != null) Fail("299 목록이 없는데 군중 뿌리가 있다");
                m = " 299 목록 없음 — 0명(건너뜀)";
            }
            else m = CheckSpawned(fb) + CheckPure() + CheckSameSeed(fb);
            if (fb.Folk.Count != 15) Fail($"역할 인물이 15 가 아니다({fb.Folk.Count}) — 군중이 역할 인물을 건드렸다");
            if (_ok) Debug.Log($"[{_tag}] anon crowd OK -{m}");
            return _ok;
        }

        private static string CheckSpawned(FolkBuilder fb)
        {
            var crowd = fb.Crowd;
            int want = FolkBuilder.CrowdStanding + FolkBuilder.CrowdWalking;
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
                var rs = go.GetComponentsInChildren<Renderer>().Where(r => !(r is ParticleSystemRenderer)).ToArray();
                var b = rs[0].bounds;
                foreach (var r in rs) b.Encapsulate(r.bounds);
                minH = Mathf.Min(minH, b.size.y); maxH = Mathf.Max(maxH, b.size.y);
                if (go.GetComponentsInChildren<Collider>().Any(c => !c.isTrigger)) Fail($"{go.name} 에 충돌체(군중은 길을 안 막는다)");
                if (go.transform.Find("NameTag") != null || go.GetComponentInChildren<VillagerTalk>() != null) Fail($"{go.name} 에 이름표·대사(이름 없는 군중)");
                if (go.GetComponentInChildren<CrowdBodyAnimator>() == null) Fail($"{go.name} 동작기 없음");
                float dist = new Vector2(go.transform.position.x - FolkBuilder.CrowdCenter.x, go.transform.position.z - FolkBuilder.CrowdCenter.z).magnitude;
                if (dist > 22f + 0.5f + (w.Walks ? 8f : 0f)) Fail($"{go.name} 마을 칸 밖 {dist:0.0}m");
            }
            if (meshes.Count != crowd.Count) Fail($"서로 다른 인물 {meshes.Count} ≠ 사람 {crowd.Count}");
            if (walks != Mathf.Min(FolkBuilder.CrowdWalking, crowd.Count)) { if (walks > FolkBuilder.CrowdWalking) Fail($"걷는 사람 {walks} > {FolkBuilder.CrowdWalking}"); }
            float h = Saga.Go.World.CharacterVisual.HumanHeight;
            if (minH < h * 0.86f || maxH > h * 1.12f) Fail($"키 {minH:0.00}~{maxH:0.00}m 가 {h:0.0}m ±범위 밖");
            return $" {crowd.Count}명(걷기 {walks})·서로 다른 인물 {meshes.Count}·키 {minH:0.00}~{maxH:0.00}m";
        }

        /// <summary>이동 주기 순수 함수 — 0초 0m·2초 4m(걷는 중)·10초 8m(섬)·22초 8m→돌아옴 시작·36초 0m.</summary>
        private static string CheckPure()
        {
            float o0 = CrowdWalker.OffsetAt(0f, out bool w0, out _);
            float o2 = CrowdWalker.OffsetAt(2f, out bool w2, out int s2);
            float o10 = CrowdWalker.OffsetAt(10f, out bool w10, out _);
            float o20 = CrowdWalker.OffsetAt(20f, out bool w20, out int s20);
            float o36 = CrowdWalker.OffsetAt(36f, out bool w36, out _);
            if (!Mathf.Approximately(o0, 0f) || !w0) Fail($"0초 {o0}m 걷기 {w0}");
            if (Mathf.Abs(o2 - 4f) > 0.01f || !w2 || s2 != 1) Fail($"2초 {o2}m 걷기 {w2} 방향 {s2}");
            if (Mathf.Abs(o10 - AnonymousCrowd.WalkDistance) > 0.01f || w10) Fail($"10초 {o10}m 걷기 {w10}");
            if (!w20 || s20 != -1) Fail($"20초 돌아오는 걸음이 아니다 걷기 {w20} 방향 {s20}");
            if (!Mathf.Approximately(o36, 0f)) Fail($"36초 {o36}m(한 주기 뒤 제자리)");
            return " 주기 0·2·10·20·36초";
        }

        /// <summary>같은 시드·같은 판으로 한 번 더 세우면 같은 사람(몸 이름)·같은 자리 — 세운 뒤 지운다.</summary>
        private static string CheckSameSeed(FolkBuilder fb)
        {
            var tmp = new GameObject("CrowdSeedCheck").transform;
            var again = AnonymousCrowd.Spawn(tmp, new AnonymousCrowd.Plan
            {
                Center = FolkBuilder.CrowdCenter, Radius = 22f, Standing = FolkBuilder.CrowdStanding, Walking = FolkBuilder.CrowdWalking,
                Seed = FolkBuilder.CrowdSeed, Height = Saga.Go.World.CharacterVisual.HumanHeight, CanStand = Saga.Go.Combat.FieldEnemy.CanStandOn,
            });
            int Name(GameObject g) => g.GetComponentInChildren<SkinnedMeshRenderer>()?.sharedMesh != null ? g.GetComponentInChildren<SkinnedMeshRenderer>().sharedMesh.GetInstanceID() : 0;
            if (again.Count != fb.Crowd.Count) Fail($"같은 시드인데 수가 다르다 {again.Count} ≠ {fb.Crowd.Count}");
            else
            {
                for (int i = 0; i < again.Count; i++)
                {
                    if (Name(again[i]) != Name(fb.Crowd[i])) Fail($"같은 시드인데 {i} 번 사람이 다르다");
                    // 걷는 사람은 그사이 오갔으니 서 있는 사람만 자리를 견준다
                    if (!fb.Crowd[i].GetComponent<CrowdWalker>().Walks && (again[i].transform.position - fb.Crowd[i].transform.position).sqrMagnitude > 0.25f) Fail($"같은 시드인데 {i} 번 자리가 다르다");
                }
            }
            Object.DestroyImmediate(tmp.gameObject);
            return " 같은 시드 같은 사람·자리";
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] anon crowd FAIL - {msg}");
        }
    }
}
