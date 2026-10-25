using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0233 얼굴 — 먼저 잴 것: 임포트된 몸(주역 VRoid·공방 주인공·군중)에 얼굴 모프가 남았는지 표로 남긴다.
    /// `-executeMethod Saga.EditorTools.PlaytestTalkFace.Measure`(배치, `-quit` 없이 — 스스로 끝냄).
    /// </summary>
    public static class PlaytestTalkFace
    {
        private static readonly string[] Want = { "EYE_Close", "ALL_Joy", "ALL_Surprised", "MTH_A", "MTH_I", "MTH_U", "MTH_E", "MTH_O", "ALL_Angry", "ALL_Sorrow", "ALL_Fun" };

        /// <summary>판 헤드리스가 부른다 — `face` 줄. 주역 몸이 없는 PC(로컬 전용 굽기)면 SKIP(OK).</summary>
        public static bool Check(string tag, bool levelUp)
        {
            bool ok = true;
            void Fail(string m) { ok = false; Debug.LogError($"[{tag}] face FAIL - {m}"); }
            if (Resources.Load<GameObject>("HeroBody/hero_vroid") == null) { Debug.Log($"[{tag}] face OK - SKIP(주역 VRoid 몸 없음 — 로컬 굽기 전)"); return true; }
            var f = Saga.Core.TalkFace.Hero;
            if (f == null || !f.isActiveAndEnabled) { Fail("주인공 몸에 TalkFace 없음"); return false; }
            if (f.MorphCount < 9) Fail($"찾은 모프 {f.MorphCount} < 9");
            // 깜박임 — 최대 간격 안에 한 번 감았다 뜬다
            bool closed = false, opened = false;
            for (float t = 0f; t < Saga.Core.TalkFace.BlinkMax + 1f && !opened; t += 0.02f)
            {
                f.Tick(0.02f);
                if (f.EyeMorphWeight > 1f) closed = true;
                else if (closed && f.EyeMorphWeight <= 0.001f) opened = true;
            }
            if (!closed || !opened) Fail($"깜박임 감음 {closed} 뜸 {opened}");
            // 맞음 → 놀람 0.45초
            Saga.Core.HurtVignette.Flash();
            f.Tick(0f);
            float sur = f.WeightOf(Saga.Core.TalkFace.Mood.Surprised);
            if (sur < 50f) Fail($"피격 놀람 무게 {sur:0}");
            for (int i = 0; i < 25; i++) f.Tick(0.02f);
            float sur2 = f.WeightOf(Saga.Core.TalkFace.Mood.Surprised);
            if (sur2 > 0.001f) Fail($"0.5초 뒤 놀람 {sur2:0.0}");
            // 레벨업 → 웃음 2초
            string joy = "레벨업 판 아님";
            if (levelUp)
            {
                Saga.Core.TalkFace.HeroJoy();
                f.Tick(0f);
                float j1 = f.WeightOf(Saga.Core.TalkFace.Mood.Joy);
                for (int i = 0; i < 105; i++) f.Tick(0.02f);
                float j2 = f.WeightOf(Saga.Core.TalkFace.Mood.Joy);
                if (j1 < 50f || j2 > 0.001f) Fail($"웃음 {j1:0} → 2.1초 뒤 {j2:0.0}");
                joy = $"웃음 {j1:0}→0";
            }
            // 대화 입 모양
            f.Talking = true; f.Tick(0.1f);
            int m1 = f.MouthNow;
            f.Talking = false; f.Tick(0.02f);
            if (m1 < 0 || f.MouthNow >= 0) Fail($"입 모양 {m1} → {f.MouthNow}");
            // 모프 없는 몸·끔
            var bare = new GameObject("FaceBare");
            if (Saga.Core.TalkFace.Attach(bare) != null || bare.GetComponent<Saga.Core.TalkFace>() != null) Fail("모프 없는 몸에 붙음");
            Object.DestroyImmediate(bare);
            bool on0 = Saga.Core.TalkFace.On;
            Saga.Core.TalkFace.On = false;
            if (Saga.Core.TalkFace.Attach(f.gameObject) != null) Fail("끔인데 붙음");
            Saga.Core.TalkFace.On = on0;
            int crowd = Object.FindObjectsByType<Saga.Core.TalkFace>(FindObjectsInactive.Include, FindObjectsSortMode.None).Count(x => x.BlinkOnly);
            int all = Object.FindObjectsByType<Saga.Core.TalkFace>(FindObjectsInactive.Include, FindObjectsSortMode.None).Length;
            if (ok) Debug.Log($"[{tag}] face OK - 주인공 모프 {f.MorphCount} · 깜박임 · 피격 놀람 {sur:0}→0(0.5초) · {joy} · 입 모양 · 모프 없는 몸 안 붙음 · 끔 · 얼굴 {all}(군중 깜박임만 {crowd})");
            return ok;
        }

        public static void Measure()
        {
            var rows = new List<string>();
            void Row(string tag, GameObject go)
            {
                if (go == null) { rows.Add($"{tag}: 없음"); return; }
                var parts = new List<string>();
                foreach (var smr in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                {
                    var m = smr.sharedMesh;
                    if (m == null || m.blendShapeCount == 0) continue;
                    var names = Enumerable.Range(0, m.blendShapeCount).Select(i => m.GetBlendShapeName(i)).ToList();
                    var hit = Want.Where(w => names.Any(n => n.EndsWith(w))).ToList();
                    parts.Add($"{smr.name} 모프 {m.blendShapeCount} · 맞는 것 {hit.Count}/{Want.Length}[{string.Join(",", hit)}] · 예 {string.Join("|", names.Take(4))}");
                }
                rows.Add($"{tag}: " + (parts.Count == 0 ? "모프 0" : string.Join(" ;; ", parts)));
            }
            Row("hero_vroid", Resources.Load<GameObject>("HeroBody/hero_vroid"));
            var forge = Resources.LoadAll<GameObject>("ForgeHero");
            foreach (var g in forge.Take(4)) Row("forge " + g.name, g);
            var list = Resources.Load<Saga.Core.CrowdBodyList>("CrowdBodyList");
            if (list != null && list.bodies != null) foreach (var g in list.bodies.Take(4)) Row("crowd " + (g != null ? g.name : "null"), g);
            Debug.Log("[TalkFace] measure\n" + string.Join("\n", rows));
            UnityEditor.EditorApplication.Exit(0);
        }
    }
}
