using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 상용화 ① "실제 빌드 한 번" — 다섯 판 씬을 실행 파일로 묶는다(배치 모드 `-executeMethod`).
    /// 결과물은 `Build/`(gitignore). 끝나면 `Build/<대상>/<파일>_report.txt` 에 결과·크기·시간·경고/오류 수와
    /// 가장 큰 에셋 스물을 적고, 콘솔에 "[SagaPlayerBuild] OK/FAIL" 한 줄. 실패면 종료 코드 1.
    /// 프로젝트 설정은 정해진 값에 맞출 때만 쓴다(110 ⑥: 안드로이드 버전 코드·앱 정체성·아이콘 — 이미 같으면 그대로).
    /// </summary>
    public static class SagaPlayerBuild
    {
        /// <summary>빌드 씬 — 0번 타이틀(110 ②)이 켜질 때 뜨고 다섯 판을 연다. 에디터 빌드 목록도 이것으로 맞춘다(<see cref="SyncEditorBuildScenes"/>).</summary>
        public static readonly string[] Scenes =
        {
            Saga.Core.SagaFlow.TitleScenePath,       // 타이틀·판 고르기
            "Assets/Scenes/TestVillage.unity",       // GO
            "Assets/Scenes/TestDungeon.unity",       // DUNGEON
            "Assets/Scenes/TestVillageForest.unity", // FOREST
            "Assets/Scenes/TestField.unity",         // STORY
            "Assets/Scenes/TestCity.unity",          // REALM
        };

        // PLAN.md 110 ⑥b — 앱 정체성(2026-09-27 사용자 결정). 앱 id 는 스토어에 올리면 못 바꾼다(하이픈 불가라 GitHub 이름에서 뺐다).
        // 회사명을 바꾸면 PC 저장·PlayerPrefs 위치(LocalLow·레지스트리의 회사명 칸)가 바뀐다 — 옛 DefaultCompany 것은 이 PC 에서 복사해 옮겼다.
        public const string AppId = "io.github.smh8627jpg.saga";
        public const string Company = "SAGA Games";
        public const string Product = "SAGA";

        /// <summary>정체성을 PlayerSettings 에 맞춘다 — 빌드마다 먼저(이미 같으면 아무것도 안 바꾼다).</summary>
        [MenuItem("Saga/Build/Apply App Identity")]
        public static void ApplyIdentity()
        {
            if (PlayerSettings.companyName != Company) PlayerSettings.companyName = Company;
            if (PlayerSettings.productName != Product) PlayerSettings.productName = Product;
            foreach (var t in new[] { UnityEditor.Build.NamedBuildTarget.Android, UnityEditor.Build.NamedBuildTarget.Standalone, UnityEditor.Build.NamedBuildTarget.iOS })
                if (PlayerSettings.GetApplicationIdentifier(t) != AppId) PlayerSettings.SetApplicationIdentifier(t, AppId);
            if (Application.isBatchMode && !BuildPipeline.isBuildingPlayer) { AssetDatabase.SaveAssets(); }
        }

        public static bool IdentityApplied() =>
            PlayerSettings.companyName == Company && PlayerSettings.productName == Product &&
            PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android) == AppId &&
            PlayerSettings.GetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Standalone) == AppId;

        [MenuItem("Saga/Build/Sync Editor Build Scenes")]
        public static void SyncEditorBuildScenes()
        {
            // 목록은 설정만으로 저장된다. SaveAssets 는 부르지 않는다 — 진단 중 동적 글꼴 아틀라스에 오른 글자까지 에셋에 써 버린다.
            EditorBuildSettings.scenes = Scenes.Where(File.Exists).Select(p => new EditorBuildSettingsScene(p, true)).ToArray();
        }

        [MenuItem("Saga/Build/Windows Player")]
        public static void BuildWindows() =>
            Run(BuildTarget.StandaloneWindows64, BuildTargetGroup.Standalone, "Build/Windows/SAGA.exe");

        [MenuItem("Saga/Build/Android APK")]
        public static void BuildAndroid()
        {
            EditorUserBuildSettings.buildAppBundle = false;
            Run(BuildTarget.Android, BuildTargetGroup.Android, "Build/Android/SAGA.apk");
        }

        /// <summary>PLAN.md 110 ③ 측정용 — 릴리스 빌드에 `SAGA_PERF` 만 더한다(화면 fps·온도 줄, 자동 측정, 성능 기록표). 개발 빌드는 스크립트가 느려 fps 를 낮게 잰다.</summary>
        [MenuItem("Saga/Build/Android APK (perf)")]
        public static void BuildAndroidPerf()
        {
            EditorUserBuildSettings.buildAppBundle = false;
            Run(BuildTarget.Android, BuildTargetGroup.Android, "Build/Android/SAGA-perf.apk", PerfDefines);
        }

        [MenuItem("Saga/Build/Windows Player (perf)")]
        public static void BuildWindowsPerf() =>
            Run(BuildTarget.StandaloneWindows64, BuildTargetGroup.Standalone, "Build/WindowsPerf/SAGA.exe", PerfDefines);

        /// <summary>PLAN.md 110 ⑥d — Google Play 에 올릴 앱 번들. APK 470MB 는 기본 모듈 한도(200MB)를 넘으므로
        /// "분할"(splitApplicationBinary)로 첫 씬 밖 데이터를 **설치 시점 에셋 팩**(Play Asset Delivery install-time)에 넣는다 —
        /// 설치할 때 같이 받아져 런타임 코드가 필요 없다. 서명은 <see cref="SigningEnv"/> 환경 변수(없으면 디버그 서명 = 업로드 불가).
        /// 끝나면 모듈별 크기를 재어 Play 한도를 넘으면 FAIL(<see cref="InspectAab"/>).</summary>
        [MenuItem("Saga/Build/Android App Bundle (Google Play)")]
        public static void BuildAndroidAab() =>
            Run(BuildTarget.Android, BuildTargetGroup.Android, "Build/Android/SAGA.aab");

        private static readonly string[] PerfDefines = { "SAGA_PERF" };

        private static void Run(BuildTarget target, BuildTargetGroup group, string output, string[] defines = null)
        {
            var r = Build(target, group, output, defines);
            Finish(r.Ok, r.Why, r.Report, output, r.Extra);
        }

        public struct BuildResultInfo
        {
            public bool Ok;
            public string Why;
            public BuildReport Report;
            public string Extra;   // 보고서에 덧붙일 줄(서명·앱 번들 모듈)
            public AabInfo Aab;
        }

        /// <summary>빌드 본체 — 끝내지 않고 결과만 돌려준다(진단 `PlaytestSagaAab` 가 검사한다). `scenes`·`gate` 는 진단용:
        /// 판 씬 없이 작게 지어 볼 때만 바꾼다(스토어 빌드는 늘 전체 씬 + 자산 검사).</summary>
        public static BuildResultInfo Build(BuildTarget target, BuildTargetGroup group, string output, string[] defines = null,
            string[] scenes = null, bool gate = true)
        {
            scenes ??= Scenes;
            foreach (var s in scenes)
                if (!File.Exists(s)) return new BuildResultInfo { Why = $"씬 없음 {s}" };
            SyncEditorBuildScenes();
            // 110 ④ — git 밖 사실 몸이 목록과 다르거나 씬이 폴백으로 지어졌으면 빌드하지 않는다.
            if (gate && !SagaAssetGate.Check(out var gateSummary)) return new BuildResultInfo { Why = "자산 검사 실패\n" + gateSummary };
            // 110 ⑥ — 버전은 bundleVersion 한 곳, 안드로이드 버전 코드는 거기서 셈(스토어는 올릴 때마다 코드가 커야 한다).
            int code = VersionCode(PlayerSettings.bundleVersion);
            if (code <= 0) return new BuildResultInfo { Why = $"버전 형식이 a.b.c 가 아님: {PlayerSettings.bundleVersion}" };
            if (PlayerSettings.Android.bundleVersionCode != code) PlayerSettings.Android.bundleVersionCode = code;
            ApplyIdentity();
            SagaAppIcon.Apply();

            if (EditorUserBuildSettings.activeBuildTarget != target)
                EditorUserBuildSettings.SwitchActiveBuildTarget(group, target);

            // 110 ⑥d — 앱 번들이면 분할·서명을 이 빌드 동안만 건다(끝나면 되돌려 ProjectSettings 에 키 경로가 남지 않게).
            bool aab = target == BuildTarget.Android && output.EndsWith(".aab");
            var extra = new StringBuilder();
            bool oldSplit = PlayerSettings.Android.splitApplicationBinary;
            if (target == BuildTarget.Android)
            {
                EditorUserBuildSettings.buildAppBundle = aab;
                if (oldSplit != aab) PlayerSettings.Android.splitApplicationBinary = aab;
            }
            bool signed = aab && ApplySigning(extra);
            if (aab && !signed) extra.AppendLine("signing: 디버그 서명 — Google Play 에 올릴 수 없다(업로드 키는 환경 변수 " + string.Join("·", SigningEnv) + ")");

            BuildReport report;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(output));
                var opts = new BuildPlayerOptions
                {
                    scenes = scenes,
                    locationPathName = output,
                    target = target,
                    targetGroup = group,
                    options = BuildOptions.DetailedBuildReport,
                    extraScriptingDefines = defines,
                };
                report = BuildPipeline.BuildPlayer(opts);
            }
            finally
            {
                if (target == BuildTarget.Android)
                {
                    if (PlayerSettings.Android.splitApplicationBinary != oldSplit) PlayerSettings.Android.splitApplicationBinary = oldSplit;
                    EditorUserBuildSettings.buildAppBundle = false;
                }
                if (signed) ClearSigning();
            }
            bool ok = report.summary.result == BuildResult.Succeeded;
            CleanPerformanceTestArtifacts();
            AabInfo info = null;
            if (ok && aab)
            {
                info = InspectAab(output);
                extra.Append(info.Text);
                if (info.Problems.Count > 0) ok = false;
            }
            return new BuildResultInfo { Ok = ok, Why = report.summary.result.ToString(), Report = report, Extra = extra.ToString(), Aab = info };
        }

        // ── 110 ⑥d 서명 ──────────────────────────────────────────────────
        // 업로드 키(keystore)는 저장소 밖에만 두고(.gitignore *.keystore·*.jks) 경로·암호는 환경 변수로만 넘긴다.
        // PlayerSettings 의 키 경로는 ProjectSettings.asset 에 저장되므로 빌드가 끝나면 비운다(암호는 원래 저장 안 됨).
        public static readonly string[] SigningEnv = { "SAGA_KEYSTORE", "SAGA_KEYSTORE_PASS", "SAGA_KEY_ALIAS", "SAGA_KEY_PASS" };

        private static bool ApplySigning(StringBuilder extra)
        {
            string ks = System.Environment.GetEnvironmentVariable("SAGA_KEYSTORE");
            string ksPass = System.Environment.GetEnvironmentVariable("SAGA_KEYSTORE_PASS");
            string alias = System.Environment.GetEnvironmentVariable("SAGA_KEY_ALIAS");
            string keyPass = System.Environment.GetEnvironmentVariable("SAGA_KEY_PASS");
            if (string.IsNullOrEmpty(ks)) return false;
            if (!File.Exists(ks) || string.IsNullOrEmpty(ksPass) || string.IsNullOrEmpty(alias))
            {
                extra.AppendLine("signing: SAGA_KEYSTORE 는 있는데 파일이 없거나 SAGA_KEYSTORE_PASS·SAGA_KEY_ALIAS 가 비었다");
                return false;
            }
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = Path.GetFullPath(ks);
            PlayerSettings.Android.keystorePass = ksPass;
            PlayerSettings.Android.keyaliasName = alias;
            PlayerSettings.Android.keyaliasPass = string.IsNullOrEmpty(keyPass) ? ksPass : keyPass;
            extra.AppendLine($"signing: 업로드 키 {Path.GetFileName(ks)} · alias {alias}");
            return true;
        }

        private static void ClearSigning()
        {
            PlayerSettings.Android.useCustomKeystore = false;
            PlayerSettings.Android.keystoreName = "";
            PlayerSettings.Android.keystorePass = "";
            PlayerSettings.Android.keyaliasName = "";
            PlayerSettings.Android.keyaliasPass = "";
        }

        // ── 110 ⑥d 앱 번들 검사 ───────────────────────────────────────────
        // Play 한도(압축 크기): 기본 모듈 200MB · 에셋 팩 하나 1.5GB · 설치 시점 전체 4GB.
        public const long BaseLimit = 200L << 20, PackLimit = 1536L << 20, InstallTimeLimit = 4096L << 20;

        public class AabInfo
        {
            public readonly System.Collections.Generic.Dictionary<string, long> Modules = new System.Collections.Generic.Dictionary<string, long>();
            public readonly System.Collections.Generic.List<string> Problems = new System.Collections.Generic.List<string>();
            public string SignerFile = "";   // META-INF/<ALIAS>.RSA 류
            public string Text = "";
        }

        /// <summary>앱 번들(zip)을 열어 모듈(맨 앞 폴더)별 압축 크기를 더하고 Play 한도와 견준다. 에셋 팩은 manifest 로 가린다
        /// (bundletool 이 쓰는 폴더 = 모듈 이름). 서명 파일 이름도 적는다.</summary>
        public static AabInfo InspectAab(string path)
        {
            var info = new AabInfo();
            var sb = new StringBuilder();
            try
            {
                using var zip = new System.IO.Compression.ZipArchive(File.OpenRead(path), System.IO.Compression.ZipArchiveMode.Read);
                foreach (var e in zip.Entries)
                {
                    int slash = e.FullName.IndexOf('/');
                    if (slash <= 0) continue;
                    string top = e.FullName.Substring(0, slash);
                    if (top == "META-INF")
                    {
                        if (e.Name.EndsWith(".RSA") || e.Name.EndsWith(".EC") || e.Name.EndsWith(".DSA")) info.SignerFile = e.Name;
                        continue;
                    }
                    if (top == "BUNDLE-METADATA") continue;
                    info.Modules[top] = (info.Modules.TryGetValue(top, out long b) ? b : 0) + e.CompressedLength;
                }
            }
            catch (System.Exception ex) { info.Problems.Add("앱 번들을 못 읽음: " + ex.Message); }

            long install = 0;
            sb.AppendLine($"app bundle: {new FileInfo(path).Length / (1024f * 1024f):F1} MB · 서명 {(info.SignerFile == "" ? "없음" : info.SignerFile)}");
            foreach (var kv in info.Modules.OrderBy(k => k.Key == "base" ? 0 : 1).ThenBy(k => k.Key))
            {
                bool isBase = kv.Key == "base";
                long limit = isBase ? BaseLimit : PackLimit;
                install += kv.Value;
                sb.AppendLine($"  module {kv.Key,-28} {kv.Value / (1024f * 1024f),8:F1} MB (한도 {limit >> 20} MB)");
                if (kv.Value > limit) info.Problems.Add($"{kv.Key} {kv.Value >> 20}MB > {limit >> 20}MB");
            }
            if (!info.Modules.ContainsKey("base")) info.Problems.Add("base 모듈 없음");
            if (info.Modules.Count < 2) info.Problems.Add("에셋 팩 없음 — 분할이 안 걸렸다");
            if (install > InstallTimeLimit) info.Problems.Add($"설치 시점 전체 {install >> 20}MB > {InstallTimeLimit >> 20}MB");
            foreach (var p in info.Problems) sb.AppendLine("  PROBLEM " + p);
            info.Text = sb.ToString();
            return info;
        }

        /// <summary>"a.b.c" → a·10000 + b·100 + c (0.1.0 → 100, 1.2.3 → 10203). b·c 는 99 까지, 형식이 틀리면 0.</summary>
        public static int VersionCode(string version)
        {
            var parts = (version ?? "").Split('.');
            if (parts.Length != 3) return 0;
            if (!int.TryParse(parts[0], out int a) || !int.TryParse(parts[1], out int b) || !int.TryParse(parts[2], out int c)) return 0;
            if (a < 0 || b < 0 || c < 0 || b > 99 || c > 99) return 0;
            return a * 10000 + b * 100 + c;
        }

        /// <summary>성능 테스트 패키지가 빌드마다 `Assets/Resources/PerformanceTestRun*.json` 을 남긴다 — 저장소에 안 들이게 치운다.</summary>
        private static void CleanPerformanceTestArtifacts()
        {
            foreach (var f in new[] { "Assets/Resources/PerformanceTestRunInfo.json", "Assets/Resources/PerformanceTestRunSettings.json" })
                if (File.Exists(f)) AssetDatabase.DeleteAsset(f);
            if (AssetDatabase.IsValidFolder("Assets/Resources") && Directory.GetFileSystemEntries("Assets/Resources").Length == 0)
                AssetDatabase.DeleteAsset("Assets/Resources");
        }

        private static void Finish(bool ok, string why, BuildReport report, string output, string extra = null)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"result: {why}");
            if (!string.IsNullOrEmpty(extra)) sb.Append(extra);
            if (report != null)
            {
                var s = report.summary;
                sb.AppendLine($"target: {s.platform} · size: {s.totalSize / (1024f * 1024f):F1} MB · time: {s.totalTime.TotalMinutes:F1} min");
                sb.AppendLine($"errors: {s.totalErrors} · warnings: {s.totalWarnings}");
                foreach (var step in report.steps)
                    foreach (var m in step.messages)
                        if (m.type == LogType.Error || m.type == LogType.Exception)
                            sb.AppendLine($"ERROR [{step.name}] {m.content.Split('\n')[0]}");
                var packed = report.packedAssets.SelectMany(p => p.contents)
                    .GroupBy(c => c.sourceAssetPath)
                    .Select(g => (path: g.Key, bytes: g.Sum(c => (long)c.packedSize)))
                    .OrderByDescending(x => x.bytes).Take(20);
                sb.AppendLine("largest assets:");
                foreach (var (path, bytes) in packed) sb.AppendLine($"  {bytes / (1024f * 1024f),7:F1} MB  {path}");

                // 110 ④ 빌드 지문 — 들어간 에셋 전부(경로·바이트, 경로순). 두 PC 의 빌드를 diff 로 대조한다.
                // 빌드 파일은 바이트 단위로 같지 않다(내부 번호 순서) — 같은지는 이 목록으로 본다.
                var all = report.packedAssets.SelectMany(p => p.contents)
                    .GroupBy(c => c.sourceAssetPath)
                    .Select(g => $"{g.Sum(c => (long)c.packedSize)}\t{g.Key}")
                    .OrderBy(l => l.Substring(l.IndexOf('\t') + 1), System.StringComparer.Ordinal);
                var fp = Path.Combine(Path.GetDirectoryName(output), Path.GetFileNameWithoutExtension(output) + "_assets.txt");
                Directory.CreateDirectory(Path.GetDirectoryName(fp));
                File.WriteAllLines(fp, all);
            }
            var dir = Path.GetDirectoryName(output);
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, Path.GetFileNameWithoutExtension(output) + "_report.txt"), sb.ToString());
            Debug.Log($"[SagaPlayerBuild] {(ok ? "OK" : "FAIL")} - {output}\n{sb}");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }
    }
}
