using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Saga.Core;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ⑥ 크레딧 점검 — 빌드에 들어가는 에셋(빌드 씬·Resources·렌더 파이프라인 에셋의 의존)을 출처 표
    /// <see cref="SagaCredits.Entries"/> 에 맞춘다. 표에 없는 에셋이 하나라도 있으면 FAIL(새 에셋은 출처 한 줄부터).
    /// 통과하면 법적 고지 `Assets/SagaCore/Resources/SagaLegal.txt` 를 쓴다: 첫 줄 = 쓰인 출처 id, 이어서
    /// ① 전문을 실어야 하는 라이선스(OFL·MIT — 표의 <c>LicenseFiles</c>) ② 플레이어 빌드에 들어가는 어셈블리·에셋의 패키지 중
    /// Unity Companion License 가 아닌 라이선스(glTFast 의 Apache 2.0 등) 전문과 패키지의 제3자 고지.
    /// 빌드 문지기 <see cref="SagaAssetGate"/> 가 빌드마다 부른다. 보고서 `Logs/credits_report.txt`.
    /// git 밖 사실 몸은 이 PC 에 없을 수 있어(의존이 안 풀림) `build_deps.txt` 가 비어 있지 않으면 쓰인 것으로 친다.
    /// `-executeMethod Saga.EditorTools.SagaCreditsCheck.Run`
    /// </summary>
    public static class SagaCreditsCheck
    {
        private const string T = "[SagaCreditsCheck]";
        public const string LegalPath = "Assets/SagaCore/Resources/" + SagaCredits.LegalResource + ".txt";
        public const string ReportPath = "Logs/credits_report.txt";

        [MenuItem("Saga/Build/Check Credits")]
        public static void Run()
        {
            bool ok = Check(out _);
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        /// <summary>빌드에 들어가는 에셋 경로 — 빌드 씬 · 모든 Resources(에디터 폴더 밖) · 품질 단계별 렌더 파이프라인 에셋의 의존.</summary>
        public static string[] BuildDependencies()
        {
            var roots = new List<string>(SagaPlayerBuild.Scenes);
            foreach (var path in AssetDatabase.GetAllAssetPaths())
            {
                if (!path.StartsWith("Assets/", StringComparison.Ordinal) || AssetDatabase.IsValidFolder(path)) continue;
                if (path.Contains("/Editor/") || !path.Contains("/Resources/")) continue;
                roots.Add(path);
            }
            if (GraphicsSettings.defaultRenderPipeline != null) roots.Add(AssetDatabase.GetAssetPath(GraphicsSettings.defaultRenderPipeline));
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                var rp = QualitySettings.GetRenderPipelineAssetAt(i);
                if (rp != null) roots.Add(AssetDatabase.GetAssetPath(rp));
            }
            return AssetDatabase.GetDependencies(roots.Where(r => !string.IsNullOrEmpty(r)).Distinct().ToArray(), true);
        }

        public static bool Check(out string summary)
        {
            var deps = BuildDependencies();
            var byEntry = new Dictionary<string, List<string>>();
            var unmatched = new List<string>();
            foreach (var d in deps)
            {
                if (d == LegalPath) continue;
                var e = SagaCredits.Match(d);
                if (e == null) { unmatched.Add(d); continue; }
                if (!byEntry.TryGetValue(e.Id, out var list)) byEntry[e.Id] = list = new List<string>();
                list.Add(d);
            }
            if (File.Exists(SagaAssetGate.BuildDepsPath) &&
                File.ReadAllLines(SagaAssetGate.BuildDepsPath).Any(l => l.Trim().Length > 0 && !l.StartsWith("#")) &&
                !byEntry.ContainsKey("mixamo"))
                byEntry["mixamo"] = new List<string> { "(git 밖 — " + SagaAssetGate.BuildDepsPath + ")" };

            var used = SagaCredits.Entries.Where(e => byEntry.ContainsKey(e.Id)).Select(e => e.Id).ToList();
            var packages = PlayerPackages(deps);
            string legal = Legal(used, packages, out var legalNotes);

            var report = new StringBuilder();
            report.AppendLine($"{T} 의존 {deps.Length} · 출처 {used.Count}/{SagaCredits.Entries.Length} · 표에 없음 {unmatched.Count} · 패키지 {packages.Count}");
            foreach (var e in SagaCredits.Entries)
            {
                if (!byEntry.TryGetValue(e.Id, out var list)) { report.AppendLine($"  (안 쓰임) {e.Id}"); continue; }
                report.AppendLine($"  {e.Id} {list.Count}: {string.Join(" · ", list.Take(3))}{(list.Count > 3 ? " …" : "")}");
            }
            report.AppendLine("== 패키지(플레이어 어셈블리·에셋)");
            foreach (var p in packages) report.AppendLine($"  {p.name} {p.version}");
            foreach (var n in legalNotes) report.AppendLine("  " + n);
            report.AppendLine("== 표에 없음");
            foreach (var u in unmatched.OrderBy(x => x, StringComparer.Ordinal)) report.AppendLine("  " + u);
            Directory.CreateDirectory(Path.GetDirectoryName(ReportPath));
            File.WriteAllText(ReportPath, report.ToString(), new UTF8Encoding(false));

            bool ok = unmatched.Count == 0;
            if (ok) WriteLegal(legal);
            summary = $"{T} {(ok ? "OK" : "FAIL")} — 의존 {deps.Length} · 출처 {used.Count} [{string.Join(",", used)}] · 패키지 {packages.Count} · 표에 없음 {unmatched.Count}" +
                      (ok ? "" : " — 첫 몇: " + string.Join(", ", unmatched.Take(6)) + $" (전부 {ReportPath})");
            if (ok) Debug.Log(summary); else Debug.LogError(summary);
            return ok;
        }

        /// <summary>플레이어 빌드에 들어가는 패키지 — 플레이어 어셈블리의 소스가 든 패키지 + 에셋 의존이 든 패키지.</summary>
        private static List<UnityEditor.PackageManager.PackageInfo> PlayerPackages(string[] deps)
        {
            var found = new Dictionary<string, UnityEditor.PackageManager.PackageInfo>();
            void Add(string path)
            {
                var info = UnityEditor.PackageManager.PackageInfo.FindForAssetPath(path);
                if (info != null) found[info.name] = info;
            }
            foreach (var asm in CompilationPipeline.GetAssemblies(AssembliesType.PlayerWithoutTestAssemblies))
            {
                var src = asm.sourceFiles.FirstOrDefault(f => f.StartsWith("Packages/", StringComparison.Ordinal));
                if (src != null) Add(src);
            }
            foreach (var d in deps) if (d.StartsWith("Packages/", StringComparison.Ordinal)) Add(d);
            return found.Values.OrderBy(p => p.name, StringComparer.Ordinal).ToList();
        }

        private static string Legal(List<string> used, List<UnityEditor.PackageManager.PackageInfo> packages, out List<string> notes)
        {
            notes = new List<string>();
            var sb = new StringBuilder();
            sb.Append(SagaCredits.UsedPrefix).Append(string.Join(",", used)).Append('\n');
            sb.Append("THIRD-PARTY LICENSES AND NOTICES\n");
            foreach (var e in SagaCredits.Entries)
            {
                if (!used.Contains(e.Id) || e.LicenseFiles == null) continue;
                foreach (var f in e.LicenseFiles)
                {
                    string name = Path.GetFileName(f);
                    if (name == "LICENSE" || name == "OFL.txt") name = Path.GetFileName(Path.GetDirectoryName(f));
                    sb.Append("\n==== ").Append(e.TitleEn).Append(" — ").Append(name).Append(" ====\n");
                    if (e.Copyright != null && f == e.LicenseFiles[0]) sb.Append(e.Copyright).Append("\n\n");
                    if (File.Exists(f)) sb.Append(Clean(File.ReadAllText(f))).Append('\n');
                    else notes.Add($"라이선스 파일 없음: {f}");
                }
            }
            foreach (var p in packages)
            {
                string dir = p.resolvedPath;
                string lic = FirstExisting(dir, "LICENSE.md", "LICENSE.txt", "LICENSE");
                // Unity 자체 라이선스(Companion·Package Distribution)는 Unity 이용 약관 안이라 전문을 안 싣는다 — 그 밖(Apache 등)만.
                string licText = lic != null ? File.ReadAllText(lic) : "";
                bool companion = licText.IndexOf("Unity Companion License", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                 licText.IndexOf("Unity Package Distribution License", StringComparison.OrdinalIgnoreCase) >= 0;
                string tpn = FirstExisting(dir, "Third Party Notices.md", "THIRD PARTY NOTICES.md", "Third-Party Notices.md");
                if (lic != null && !companion)
                {
                    sb.Append("\n==== ").Append(p.displayName).Append(" (").Append(p.name).Append(") — license ====\n").Append(Clean(File.ReadAllText(lic))).Append('\n');
                    notes.Add($"전문 실음: {p.name} {Path.GetFileName(lic)}");
                }
                if (tpn != null)
                {
                    string text = Clean(File.ReadAllText(tpn));
                    if (text.Trim().Length < 80) continue; // "없음" 한 줄짜리
                    sb.Append("\n==== ").Append(p.displayName).Append(" (").Append(p.name).Append(") — third-party notices ====\n").Append(text).Append('\n');
                    notes.Add($"제3자 고지 실음: {p.name}");
                }
            }
            return sb.ToString();
        }

        private static string FirstExisting(string dir, params string[] names)
        {
            foreach (var n in names)
            {
                var p = Path.Combine(dir, n);
                if (File.Exists(p)) return p;
            }
            return null;
        }

        /// <summary>줄끝 LF · 세 줄 넘는 빈 줄 접기 — 같은 입력이면 같은 파일(커밋 흔들림 없음).</summary>
        private static string Clean(string s)
        {
            s = s.Replace("\r\n", "\n").Replace('\r', '\n').TrimEnd();
            while (s.Contains("\n\n\n\n")) s = s.Replace("\n\n\n\n", "\n\n\n");
            return s;
        }

        private static void WriteLegal(string legal)
        {
            if (File.Exists(LegalPath) && File.ReadAllText(LegalPath) == legal) return;
            Directory.CreateDirectory(Path.GetDirectoryName(LegalPath));
            File.WriteAllText(LegalPath, legal, new UTF8Encoding(false));
            AssetDatabase.ImportAsset(LegalPath);
            Debug.Log($"{T} {LegalPath} 갱신 — 커밋할 것");
        }
    }
}
