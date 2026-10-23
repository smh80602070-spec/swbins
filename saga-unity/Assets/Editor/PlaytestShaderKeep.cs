using System.Collections.Generic;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0183 런타임 셰이더 빌드 포함(`SagaShaderKeep`) 진단 — `PlaytestHeadless` 끝(바람 길잡이 뒤)이 부른다. 빌드는 안 한다(사용자 10-09 "빌드 하지마").
    /// ① 런타임 코드의 `Shader.Find` 이름이 모두 목록(넣을 것 + 안 넣어도 되는 것) 안 ② 넣을 셰이더가 에디터에서 다 찾아짐
    /// ③ 진짜 빌드 앞 콜백 → 항상 포함에 다 들어감 ④ 뒤 콜백 → 원래 목록 그대로(더한 것만 빠짐, 두 번 불러도 같음).
    /// </summary>
    public static class PlaytestShaderKeep
    {
        private const string T = "[PlaytestHeadless] shaderkeep";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var before = SagaShaderKeep.Included();
            var hook = new SagaShaderKeep();
            try
            {
                // ① 코드 훑기
                Begin();
                var names = SagaShaderKeep.RuntimeFindNames();
                var known = new HashSet<string>(SagaShaderKeep.Names);
                known.UnionWith(SagaShaderKeep.Covered);
                var miss = new List<string>();
                foreach (var n in names) if (!known.Contains(n)) miss.Add(n);
                if (miss.Count > 0) Fail($"목록에 없는 Shader.Find 이름 {miss.Count}: {string.Join(", ", miss)}");
                End($"scan OK - 런타임 Shader.Find 이름 {names.Count}개 모두 목록 안(넣을 것 {SagaShaderKeep.Names.Length} · 안 넣어도 됨 {SagaShaderKeep.Covered.Length})");

                // ② 찾기
                Begin();
                foreach (var n in SagaShaderKeep.Names) if (Shader.Find(n) == null) Fail($"셰이더 \"{n}\" 를 못 찾음");
                End("find OK - 넣을 셰이더 모두 에디터에서 찾아짐");

                // ③ 앞 콜백
                Begin();
                hook.OnPreprocessBuild(null);
                var during = SagaShaderKeep.Included();
                int added = during.Count - before.Count;
                foreach (var n in SagaShaderKeep.Names) { var s = Shader.Find(n); if (s != null && !during.Contains(s)) Fail($"\"{n}\" 가 항상 포함에 없음"); }
                End($"pre OK - 빌드 앞: 항상 포함 {before.Count} → {during.Count}(+{added})");

                // ④ 뒤 콜백
                Begin();
                hook.OnPostprocessBuild(null);
                SagaShaderKeep.Cleanup(); // 두 번째도 아무것도 안 바꿔야
                var after = SagaShaderKeep.Included();
                if (!Same(before, after)) Fail($"빌드 뒤 목록이 원래와 다름 {before.Count} → {after.Count}");
                End($"post OK - 빌드 뒤 원래 {after.Count}개 그대로(두 번 불러도 같음)");
            }
            finally
            {
                SagaShaderKeep.Cleanup();
            }
            return _ok;
        }

        private static bool Same(List<Shader> a, List<Shader> b)
        {
            if (a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; i++) if (a[i] != b[i]) return false;
            return true;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
