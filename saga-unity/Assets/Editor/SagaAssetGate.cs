using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ④ 빌드 재현성 — 빌드 전에 "이 PC 의 빌드가 목록대로의 자산으로 만들어지는가"를 막는 검사.
    /// <see cref="SagaPlayerBuild"/> 가 빌드마다 먼저 부르고, 하나라도 걸리면 빌드하지 않는다.
    ///
    /// ① git 밖 사실 몸 폴더(`Assets/Art/CharactersRealistic`)가 `tools/realistic/manifest.sha256` 과 한 바이트도
    ///    안 다르다(빠짐·다름 = 실패). 받기는 `tools/realistic-pack.sh fetch <보관함>`.
    /// ② 빌드 씬이 끌어 쓰는 그 폴더 파일이 전부 목록 안에 있다(목록 밖 = 다른 PC 에 없는 몸).
    /// ③ `tools/realistic/build_deps.txt` 에 적힌 몸을 빌드 씬이 여전히 다 쓴다 — 줄었으면 씬이 몸 없는 PC 에서
    ///    다시 지어져 칸이 비었다는 뜻이고, 그러면 게임은 폴백 캡슐·옛 도형으로 선다.
    /// ④ 빌드 씬과 그 텍스트 의존(프리팹·재질·컨트롤러…)에 끊긴 GUID(없는 스크립트·프리팹·에셋 참조)가 없다.
    /// ⑤ 빌드에 들어가는 에셋이 전부 크레딧 출처 표(`SagaCredits`)에 있다 — 통과하면 법적 고지 파일도 새로 쓴다(110 ⑥).
    /// </summary>
    public static class SagaAssetGate
    {
        public const string RealisticRoot = "Assets/Art/CharactersRealistic/";
        public const string ManifestPath = "tools/realistic/manifest.sha256";
        public const string BuildDepsPath = "tools/realistic/build_deps.txt";

        private static readonly Regex GuidRef = new Regex(@"guid: ([0-9a-f]{32})", RegexOptions.Compiled);
        private static readonly HashSet<string> YamlExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { ".unity", ".prefab", ".mat", ".asset", ".controller", ".overrideController", ".playable", ".mask", ".anim", ".lighting", ".signal", ".physicMaterial" };

        [MenuItem("Saga/Build/Check Assets (gate)")]
        public static void CheckMenu() => Check(out _);

        /// <summary>배치: `-executeMethod Saga.EditorTools.SagaAssetGate.CheckBatch` — 통과 0, 실패 1.</summary>
        public static void CheckBatch()
        {
            bool ok = Check(out _);
            EditorApplication.Exit(ok ? 0 : 1);
        }

        /// <summary>검사 넷. 요약 줄은 콘솔에 "[SagaAssetGate] OK/FAIL" 로 찍고 <paramref name="summary"/> 로도 준다.</summary>
        public static bool Check(out string summary)
        {
            var t0 = DateTime.Now;
            var fails = new List<string>();
            var notes = new List<string>();

            var manifest = ReadManifest(fails);
            if (manifest != null) VerifyRealistic(manifest, fails);

            var deps = AssetDatabase.GetDependencies(SagaPlayerBuild.Scenes, true);
            var usedRealistic = deps.Where(p => p.StartsWith(RealisticRoot, StringComparison.Ordinal))
                .Select(p => p.Substring(RealisticRoot.Length)).ToList();
            if (manifest != null)
                foreach (var rel in usedRealistic.Where(r => !manifest.ContainsKey(r)))
                    fails.Add($"② 목록 밖 파일을 빌드가 씀: {rel} — realistic-pack.sh manifest·pack 다시");

            var expected = File.Exists(BuildDepsPath)
                ? File.ReadAllLines(BuildDepsPath).Select(l => l.Trim()).Where(l => l.Length > 0 && !l.StartsWith("#")).ToList()
                : null;
            if (expected == null) fails.Add($"③ {BuildDepsPath} 없음 — Saga/Build/Write Asset Gate Deps");
            else
            {
                var used = new HashSet<string>(usedRealistic);
                foreach (var rel in expected.Where(r => !used.Contains(r)))
                    fails.Add($"③ 빌드 씬이 더는 안 쓰는 사실 몸: {rel} — 씬이 몸 없이 지어졌나(폴백)? 일부러 뺐으면 Write Asset Gate Deps");
                int added = usedRealistic.Count(r => !expected.Contains(r));
                if (added > 0) notes.Add($"③ 새로 쓰는 사실 몸 {added}개 — Write Asset Gate Deps 로 목록에 올릴 것");
            }

            ScanDanglingGuids(deps, fails);

            if (!SagaCreditsCheck.Check(out var credits)) fails.Add("⑤ " + credits);

            var sb = new StringBuilder();
            sb.AppendLine($"[SagaAssetGate] {(fails.Count == 0 ? "OK" : "FAIL")} — 사실 몸 {manifest?.Count ?? 0}개 파일 · 빌드가 쓰는 것 {usedRealistic.Count} · 의존 {deps.Length} · {(DateTime.Now - t0).TotalSeconds:F0}초");
            // 칸(①~④)마다 앞 여덟 줄만 — 몸이 통째로 없을 때 ③ 수백 줄이 ④ 를 가리지 않게.
            foreach (var g in fails.GroupBy(f => f.Substring(0, 1)))
            {
                foreach (var f in g.Take(8)) sb.AppendLine("  " + f);
                if (g.Count() > 8) sb.AppendLine($"  {g.Key} … 외 {g.Count() - 8}줄");
            }
            foreach (var n in notes) sb.AppendLine("  참고: " + n);
            summary = sb.ToString();
            if (fails.Count == 0) Debug.Log(summary); else Debug.LogError(summary);
            return fails.Count == 0;
        }

        /// <summary>빌드 씬이 지금 쓰는 사실 몸 목록을 `build_deps.txt` 로 쓴다(몸을 더하거나 뺀 뒤, 이 PC 에 몸이 다 있을 때만).</summary>
        [MenuItem("Saga/Build/Write Asset Gate Deps")]
        public static void WriteBuildDeps()
        {
            var used = AssetDatabase.GetDependencies(SagaPlayerBuild.Scenes, true)
                .Where(p => p.StartsWith(RealisticRoot, StringComparison.Ordinal))
                .Select(p => p.Substring(RealisticRoot.Length))
                .OrderBy(p => p, StringComparer.Ordinal).ToList();
            Directory.CreateDirectory(Path.GetDirectoryName(BuildDepsPath));
            var header = "# PLAN.md 110 ④ — 빌드 씬이 쓰는 git 밖 사실 몸(Assets/Art/CharactersRealistic/ 기준). SagaAssetGate 가 이게 줄면 빌드를 막는다.\n" +
                         "# 다시 쓰기: Saga/Build/Write Asset Gate Deps (-executeMethod Saga.EditorTools.SagaAssetGate.WriteBuildDeps)\n";
            File.WriteAllText(BuildDepsPath, header + string.Join("\n", used) + "\n", new UTF8Encoding(false));
            Debug.Log($"[SagaAssetGate] {BuildDepsPath} — {used.Count}개");
            if (Application.isBatchMode) EditorApplication.Exit(0);
        }

        /// <summary>`sha256sum` 형식 — 해시 64자, 칸, `*` 또는 칸, 경로.</summary>
        private static Dictionary<string, string> ReadManifest(List<string> fails)
        {
            if (!File.Exists(ManifestPath)) { fails.Add($"① 목록 없음: {ManifestPath}"); return null; }
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var line in File.ReadAllLines(ManifestPath))
            {
                if (line.Length < 67) continue;
                map[line.Substring(66)] = line.Substring(0, 64);
            }
            return map;
        }

        private static void VerifyRealistic(Dictionary<string, string> manifest, List<string> fails)
        {
            if (!Directory.Exists(RealisticRoot))
            {
                fails.Add($"① {RealisticRoot} 없음 — bash tools/realistic-pack.sh fetch <보관함>");
                return;
            }
            int missing = 0, differ = 0;
            using (var sha = SHA256.Create())
            {
                foreach (var kv in manifest)
                {
                    var path = RealisticRoot + kv.Key;
                    if (!File.Exists(path)) { if (missing++ < 10) fails.Add($"① 빠짐: {kv.Key}"); continue; }
                    string hex;
                    using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1 << 20))
                        hex = BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
                    if (hex != kv.Value && differ++ < 10) fails.Add($"① 다름: {kv.Key}");
                }
            }
            if (missing > 10) fails.Add($"① 빠짐 외 {missing - 10}개");
            if (differ > 10) fails.Add($"① 다름 외 {differ - 10}개");
            if (missing + differ > 0)
                fails.Add("① 사실 몸이 목록과 다르다 — 받기: bash tools/realistic-pack.sh fetch <보관함> · 일부러 고쳤으면 manifest·pack·커밋");
        }

        /// <summary>빌드 씬과 그 텍스트 직렬화 의존을 훑어 어디에도 없는 GUID 를 찾는다(없는 스크립트·프리팹·에셋 참조).</summary>
        private static void ScanDanglingGuids(string[] deps, List<string> fails)
        {
            var known = new Dictionary<string, bool>();
            int found = 0;
            foreach (var path in deps)
            {
                if (!path.StartsWith("Assets/", StringComparison.Ordinal) || !YamlExts.Contains(Path.GetExtension(path))) continue;
                string text;
                try { text = File.ReadAllText(path); } catch (IOException) { continue; }
                if (!text.StartsWith("%YAML", StringComparison.Ordinal)) continue; // 바이너리 직렬화는 건너뜀
                var bad = new HashSet<string>();
                foreach (Match m in GuidRef.Matches(text))
                {
                    var g = m.Groups[1].Value;
                    if (!known.TryGetValue(g, out bool ok))
                    {
                        ok = g.StartsWith("0000000000000000", StringComparison.Ordinal) // 내장 리소스
                             || !string.IsNullOrEmpty(AssetDatabase.GUIDToAssetPath(g));
                        known[g] = ok;
                    }
                    if (!ok) bad.Add(g);
                }
                if (bad.Count > 0 && found++ < 20)
                    fails.Add($"④ 끊긴 참조 {bad.Count}개: {path} ({string.Join(", ", bad.Take(3))}{(bad.Count > 3 ? " …" : "")})");
            }
            if (found > 20) fails.Add($"④ 끊긴 참조가 있는 파일 외 {found - 20}개");
        }
    }
}
