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

        private static readonly string[] PerfDefines = { "SAGA_PERF" };

        private static void Run(BuildTarget target, BuildTargetGroup group, string output, string[] defines = null)
        {
            foreach (var s in Scenes)
                if (!File.Exists(s)) { Finish(false, $"씬 없음 {s}", null, output); return; }
            SyncEditorBuildScenes();
            // 110 ④ — git 밖 사실 몸이 목록과 다르거나 씬이 폴백으로 지어졌으면 빌드하지 않는다.
            if (!SagaAssetGate.Check(out var gate)) { Finish(false, "자산 검사 실패\n" + gate, null, output); return; }
            // 110 ⑥ — 버전은 bundleVersion 한 곳, 안드로이드 버전 코드는 거기서 셈(스토어는 올릴 때마다 코드가 커야 한다).
            int code = VersionCode(PlayerSettings.bundleVersion);
            if (code <= 0) { Finish(false, $"버전 형식이 a.b.c 가 아님: {PlayerSettings.bundleVersion}", null, output); return; }
            if (PlayerSettings.Android.bundleVersionCode != code) PlayerSettings.Android.bundleVersionCode = code;
            ApplyIdentity();
            SagaAppIcon.Apply();

            if (EditorUserBuildSettings.activeBuildTarget != target)
                EditorUserBuildSettings.SwitchActiveBuildTarget(group, target);

            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var opts = new BuildPlayerOptions
            {
                scenes = Scenes,
                locationPathName = output,
                target = target,
                targetGroup = group,
                options = BuildOptions.DetailedBuildReport,
                extraScriptingDefines = defines,
            };
            var report = BuildPipeline.BuildPlayer(opts);
            bool ok = report.summary.result == BuildResult.Succeeded;
            CleanPerformanceTestArtifacts();
            Finish(ok, report.summary.result.ToString(), report, output);
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

        private static void Finish(bool ok, string why, BuildReport report, string output)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"result: {why}");
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
