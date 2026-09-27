using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ⑥d 진단 — Google Play 앱 번들 길을 작게 한 번 지어 본다(타이틀 + 국지 두 씬, 자산 검사 끔 —
    /// 사실 몸 묶음이 없는 PC 에서도 돈다. 스토어 빌드는 늘 <see cref="SagaPlayerBuild.BuildAndroidAab"/>).
    /// 검사: 빌드 성공 · base + 설치 시점 에셋 팩 둘 이상 · 한도 안 · 임시 업로드 키로 서명됨(환경 변수 길) ·
    /// 끝난 뒤 분할·서명 설정이 원래대로(ProjectSettings 에 키 경로가 안 남음) · bundletool validate 통과 · targetSdk 기록.
    /// 임시 키는 Temp 에 만들고 끝나면 지운다. 결과 `[PlaytestSagaAab] OK/FAIL`, 배치면 종료 코드.
    /// </summary>
    public static class PlaytestSagaAab
    {
        private const string T = "[PlaytestSagaAab]";
        private const string Output = "Build/AabTest/SAGA-test.aab";
        private const string Alias = "sagatest";

        [MenuItem("Saga/Check/Android App Bundle (small test build)")]
        public static void Run()
        {
            bool ok = true;
            var notes = new System.Text.StringBuilder();
            void Fail(string m) { ok = false; Debug.LogError($"{T} {m}"); }

            string dir = Path.GetFullPath("Temp/saga_aab_test");
            string ks = Path.Combine(dir, "test.keystore");
            string pass = "sagatest-" + System.Guid.NewGuid().ToString("N").Substring(0, 8);
            var oldEnv = SagaPlayerBuild.SigningEnv.ToDictionary(k => k, System.Environment.GetEnvironmentVariable);
            bool oldSplit = PlayerSettings.Android.splitApplicationBinary;
            try
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
                Directory.CreateDirectory(dir);
                string jdk = Path.Combine(EditorApplication.applicationContentsPath, "PlaybackEngines/AndroidPlayer/OpenJDK/bin");
                var (code, log) = Exec(Path.Combine(jdk, "keytool.exe"),
                    $"-genkeypair -noprompt -keystore \"{ks}\" -storepass {pass} -keypass {pass} -alias {Alias} -keyalg RSA -keysize 2048 -validity 400 -dname \"CN=SAGA Test\"");
                if (code != 0 || !File.Exists(ks)) { Fail("임시 키 만들기 실패 " + log); return; }
                System.Environment.SetEnvironmentVariable("SAGA_KEYSTORE", ks);
                System.Environment.SetEnvironmentVariable("SAGA_KEYSTORE_PASS", pass);
                System.Environment.SetEnvironmentVariable("SAGA_KEY_ALIAS", Alias);
                System.Environment.SetEnvironmentVariable("SAGA_KEY_PASS", pass);

                var r = SagaPlayerBuild.Build(BuildTarget.Android, BuildTargetGroup.Android, Output,
                    scenes: new[] { Saga.Core.SagaFlow.TitleScenePath, "Assets/Scenes/TestCity.unity" }, gate: false);
                notes.Append(r.Extra);
                if (!r.Ok) { Fail($"빌드 실패 {r.Why}\n{r.Extra}"); return; }
                var aab = r.Aab;
                if (aab == null) { Fail("앱 번들 검사 없음"); return; }
                if (!aab.Modules.ContainsKey("base")) Fail("base 모듈 없음");
                var packs = aab.Modules.Keys.Where(k => k != "base").ToList();
                if (packs.Count == 0) Fail("에셋 팩 없음 — 분할 안 됨");
                aab.Modules.TryGetValue("base", out long baseBytes);
                if (packs.Sum(p => aab.Modules[p]) < baseBytes / 20)
                    Fail("에셋 팩이 거의 비었다 — 데이터가 base 에 남았나");
                if (!aab.SignerFile.StartsWith(Alias.ToUpperInvariant() + ".")) Fail($"임시 키로 서명 안 됨 (서명 파일 {aab.SignerFile})");

                // 되돌림 — 키 경로·분할이 설정에 남으면 커밋에 새어 나간다.
                if (PlayerSettings.Android.useCustomKeystore || PlayerSettings.Android.keystoreName != "" || PlayerSettings.Android.keyaliasName != "")
                    Fail("서명 설정이 안 비워짐");
                if (PlayerSettings.Android.splitApplicationBinary != oldSplit) Fail("분할 설정이 안 되돌려짐");
                if (EditorUserBuildSettings.buildAppBundle) Fail("buildAppBundle 이 켜진 채");

                // bundletool — Play 가 받는 형식인지, targetSdk 는 몇인지.
                string tools = Path.Combine(EditorApplication.applicationContentsPath, "PlaybackEngines/AndroidPlayer/Tools");
                string jar = Directory.Exists(tools) ? Directory.GetFiles(tools, "bundletool-all-*.jar").FirstOrDefault() : null;
                if (jar == null) Fail("bundletool 없음");
                else
                {
                    string java = Path.Combine(jdk, "java.exe");
                    var v = Exec(java, $"-jar \"{jar}\" validate --bundle=\"{Path.GetFullPath(Output)}\"");
                    if (v.code != 0) Fail("bundletool validate 실패\n" + v.log);
                    var m = Exec(java, $"-jar \"{jar}\" dump manifest --bundle=\"{Path.GetFullPath(Output)}\" --xpath=/manifest/uses-sdk/@android:targetSdkVersion");
                    var p = Exec(java, $"-jar \"{jar}\" dump manifest --bundle=\"{Path.GetFullPath(Output)}\" --module={packs.FirstOrDefault()}");
                    notes.AppendLine($"bundletool {Path.GetFileName(jar)} validate {(v.code == 0 ? "OK" : "FAIL")} · targetSdk {m.log.Trim()} · {packs.FirstOrDefault()} 배달 {(p.log.Contains("install-time") ? "install-time" : "?")}");
                    if (!p.log.Contains("install-time")) Fail("에셋 팩이 install-time 이 아님\n" + p.log);
                }
            }
            catch (System.Exception e) { Fail("예외 " + e); }
            finally
            {
                foreach (var kv in oldEnv) System.Environment.SetEnvironmentVariable(kv.Key, kv.Value);
                try { if (Directory.Exists(dir)) Directory.Delete(dir, true); } catch { }
                Debug.Log($"{T} {(ok ? "OK" : "FAIL")} — {Output}\n{notes}");
                if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        private static (int code, string log) Exec(string exe, string args)
        {
            var psi = new ProcessStartInfo(exe, args)
            {
                UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            string outp = proc.StandardOutput.ReadToEnd() + proc.StandardError.ReadToEnd();
            proc.WaitForExit(600000);
            return (proc.ExitCode, outp);
        }
    }
}
