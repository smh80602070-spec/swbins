using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 110 ⑥ 오류 기록 — 빌드에서 난 예외·오류 로그를 `persistentDataPath/error_log.txt` 에 남긴다(최근 <see cref="MaxEntries"/> 건,
    /// 같은 글이 거듭되면 횟수만 올림). 폰 시험에서 "멈췄다·이상하다"를 들으면 타이틀 설정의 "오류 기록"으로 복사해 받는다.
    /// 앱이 통째로 죽는 네이티브 충돌은 여기 안 남는다(스토어 콘솔 몫).
    /// 에디터·배치에선 진단이 일부러 내는 오류가 많아 켜지지 않는다 — 진단은 <see cref="StartForTest"/> 로 경로를 따로 준다.
    /// </summary>
    public static class SagaCrashLog
    {
        public const int MaxEntries = 40;
        private const int MaxStackLines = 14;
        private const string FileName = "error_log.txt";
        private const string Sep = "\n----\n";

        private static readonly object Gate = new object();
        private static readonly List<Entry> Entries = new List<Entry>();
        private static string _path;
        private static string _scene = "";
        private static bool _loaded;

        private sealed class Entry
        {
            public string Head;   // 처음 시각 · 판 · 종류
            public string Key;    // 같은 오류 가림(메시지 + 스택 첫 줄)
            public string Body;
            public int Count = 1;
            public string Last;
        }

        public static bool Enabled => _path != null;
        public static string LogPath => _path;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Boot()
        {
            if (Application.isEditor || Application.isBatchMode) return;
            Start(Path.Combine(Application.persistentDataPath, FileName));
        }

        /// <summary>진단용 — 에디터에서 따로 둔 파일로 켠다(끝나면 <see cref="Stop"/>).</summary>
        public static void StartForTest(string path, bool keepFile = false)
        {
            Stop();
            if (!keepFile && File.Exists(path)) File.Delete(path);
            Start(path);
        }

        public static void Stop()
        {
            Application.logMessageReceivedThreaded -= OnLog;
            SceneManager.activeSceneChanged -= OnScene;
            lock (Gate) { Entries.Clear(); _path = null; _loaded = false; }
        }

        private static void Start(string path)
        {
            lock (Gate) { _path = path; _loaded = false; }
            _scene = SceneManager.GetActiveScene().name;
            SceneManager.activeSceneChanged += OnScene;
            Application.logMessageReceivedThreaded += OnLog;
        }

        private static void OnScene(Scene from, Scene to) => _scene = to.name;

        private static void OnLog(string message, string stack, LogType type)
        {
            if (type != LogType.Exception && type != LogType.Error && type != LogType.Assert) return;
            try
            {
                string now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") + "Z";
                string firstStack = FirstLine(stack);
                string key = message + "|" + firstStack;
                lock (Gate)
                {
                    if (_path == null) return;
                    LoadLocked();
                    var hit = Entries.Find(e => e.Key == key);
                    if (hit != null) { hit.Count++; hit.Last = now; Entries.Remove(hit); Entries.Add(hit); }
                    else
                    {
                        Entries.Add(new Entry
                        {
                            Head = $"{now} · v{Application.version} · {_scene} · {type}",
                            Key = key,
                            Body = message.Trim() + "\n" + TrimStack(stack),
                            Last = now,
                        });
                        while (Entries.Count > MaxEntries) Entries.RemoveAt(0);
                    }
                    File.WriteAllText(_path, ComposeLocked(), new UTF8Encoding(false));
                }
            }
            catch
            {
                // 기록이 기록 오류를 낳지 않게(디스크 가득 등) 삼킨다.
            }
        }

        /// <summary>지금까지 모인 글(앞에 기기 한 줄). 없으면 빈 글.</summary>
        public static string Read()
        {
            lock (Gate)
            {
                if (_path == null) return "";
                LoadLocked();
                return Entries.Count == 0 ? "" : ComposeLocked();
            }
        }

        public static int Count
        {
            get { lock (Gate) { if (_path == null) return 0; LoadLocked(); return Entries.Count; } }
        }

        public static void Clear()
        {
            lock (Gate)
            {
                Entries.Clear();
                if (_path != null && File.Exists(_path)) File.Delete(_path);
            }
        }

        /// <summary>앱을 다시 켰을 때 지난 기록을 이어 받는다(파일 형식 = <see cref="ComposeLocked"/>).</summary>
        private static void LoadLocked()
        {
            if (_loaded) return;
            _loaded = true;
            if (_path == null || !File.Exists(_path)) return;
            var parts = File.ReadAllText(_path).Replace("\r\n", "\n").Split(new[] { Sep }, StringSplitOptions.None);
            for (int i = 1; i < parts.Length; i++) // 0 = 기기 줄
            {
                var lines = parts[i].Split(new[] { '\n' }, 3);
                if (lines.Length < 3) continue;
                var e = new Entry { Head = lines[0], Body = lines[2], Last = "" };
                // 둘째 줄 "×n · 마지막 …"
                var meta = lines[1];
                if (meta.StartsWith("×") && int.TryParse(meta.Substring(1).Split(' ')[0], out int n)) e.Count = n;
                int at = meta.IndexOf("마지막 ", StringComparison.Ordinal);
                if (at >= 0) e.Last = meta.Substring(at + 4);
                var bodyLines = e.Body.Split('\n');
                e.Key = bodyLines[0] + "|" + (bodyLines.Length > 1 ? bodyLines[1].Trim() : "");
                Entries.Add(e);
            }
        }

        private static string ComposeLocked()
        {
            var sb = new StringBuilder();
            sb.Append($"SAGA v{Application.version} · {SystemInfo.deviceModel} · {SystemInfo.operatingSystem} · {SystemInfo.systemMemorySize}MB");
            foreach (var e in Entries)
                sb.Append(Sep).Append(e.Head).Append('\n').Append('×').Append(e.Count).Append(" · 마지막 ").Append(e.Last).Append('\n').Append(e.Body.TrimEnd());
            return sb.ToString();
        }

        private static string FirstLine(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            int nl = s.IndexOf('\n');
            return (nl >= 0 ? s.Substring(0, nl) : s).Trim();
        }

        private static string TrimStack(string stack)
        {
            if (string.IsNullOrEmpty(stack)) return "";
            var lines = stack.Replace("\r\n", "\n").Split('\n');
            var sb = new StringBuilder();
            int n = 0;
            foreach (var l in lines)
            {
                if (l.Trim().Length == 0) continue;
                if (n++ >= MaxStackLines) { sb.Append("  …\n"); break; }
                sb.Append("  ").Append(l.Trim()).Append('\n');
            }
            return sb.ToString();
        }
    }
}
