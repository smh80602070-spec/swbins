using System;
using System.IO;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// Playtest 들이 저마다 하던 일 셋 — 세이브 파일 백업·복원, FAIL 집계, 로그 오류 세기 — 을 한 곳에 모은 것(tasks U-0001).
    /// 쓰는 법은 `docs/HOW_TO_PLAYTEST.md` 13장. 플레이 모드로 여러 프레임 도는 Playtest 는 `using` 대신
    /// 객체를 들고 있다가 끝날 때 <see cref="IDisposable.Dispose"/> 를 부른다.
    /// </summary>
    public static class PlaytestKit
    {
        private const string BackupFolder = "_playtest_saves_backup";

        /// <summary>이름표 — `FAIL` 줄 앞에 붙는다. <see cref="Begin"/> 이 정한다.</summary>
        public static string Tag { get; private set; } = "[Playtest]";

        /// <summary>지금까지 센 실패 수(Check·Fail·ErrorCounter 합).</summary>
        public static int Fails { get; private set; }

        private static bool _ownLog;

        /// <summary>한 판 시작 — 이름표를 정하고 실패 수를 0 으로.</summary>
        public static void Begin(string tag)
        {
            Tag = tag;
            Fails = 0;
        }

        /// <summary>실패 하나를 센다(오류 로그도 남긴다). <see cref="ErrorCounter"/> 가 이 로그를 또 세지 않는다.</summary>
        public static void Fail(string msg)
        {
            Fails++;
            _ownLog = true;
            try { Debug.LogError($"{Tag} FAIL {msg}"); }
            finally { _ownLog = false; }
        }

        /// <summary>이미 로그를 남긴 실패를 세기만 한다(옛 `_hadError = true` 자리).</summary>
        public static void Mark() => Fails++;

        public static void Check(bool cond, string msg)
        {
            if (!cond) Fail(msg);
        }

        /// <summary>끝 한 줄 — `[이름] OK` 또는 `[이름] FAIL n`. 검증 명령이 이 줄을 grep 한다.</summary>
        public static void Summary(string name) => Debug.Log($"[{name}] {(Fails == 0 ? "OK" : "FAIL " + Fails)}");

        /// <summary>
        /// 세이브 파일을 잠깐 치워 두고(이름 없으면 `save*.json` 전부) Dispose 에서 되돌린다. 실행 중 새로 생긴 세이브는 지운다.
        /// 치워 둔 파일은 `persistentDataPath/_playtest_saves_backup` 에 있어, 중간에 프로세스가 죽었으면 다음 호출이 먼저 되돌려 준다.
        /// 파일을 옮기기만 하므로 수정 시각이 그대로다.
        /// </summary>
        public static IDisposable IsolatedSaves(params string[] names) => new SaveIsolation(names);

        /// <summary>
        /// Error·Exception 로그를 세어 <see cref="Fails"/> 에 더한다. `Fail` 이 남긴 로그와 에디터 검색 색인 로그는 세지 않는다.
        /// 플레이 모드 도중에도 <see cref="Fails"/> 가 바로 오른다.
        /// </summary>
        public static IDisposable ErrorCounter() => new ErrorWatch();

        private sealed class SaveIsolation : IDisposable
        {
            private readonly string _dir = Application.persistentDataPath;
            private readonly string _backup = Path.Combine(Application.persistentDataPath, BackupFolder);
            private readonly string[] _names;
            private bool _done;

            public SaveIsolation(string[] names)
            {
                RestoreLeftover();
                Directory.CreateDirectory(_backup);
                _names = names != null && names.Length > 0 ? names : null;
                foreach (string f in Targets())
                    File.Move(f, Path.Combine(_backup, Path.GetFileName(f)));
            }

            // 격리 대상 — 이름을 줬으면 그 파일만, 아니면 save*.json 전부.
            private string[] Targets() => _names != null
                ? Array.FindAll(Array.ConvertAll(_names, n => Path.Combine(_dir, n)), File.Exists)
                : Directory.GetFiles(_dir, "save*.json");

            private void RestoreLeftover()
            {
                if (!Directory.Exists(_backup)) return;
                foreach (string f in Directory.GetFiles(_backup)) MoveBack(f);
                Directory.Delete(_backup, true);
            }

            private void MoveBack(string backupFile)
            {
                string dest = Path.Combine(_dir, Path.GetFileName(backupFile));
                if (File.Exists(dest)) File.Delete(dest);
                File.Move(backupFile, dest);
            }

            public void Dispose()
            {
                if (_done) return;
                _done = true;
                // 실행 중 만든 세이브(격리 대상과 같은 이름들)를 지우고 치워 둔 것을 되돌린다.
                foreach (string f in Targets()) File.Delete(f);
                RestoreLeftover();
            }
        }

        private sealed class ErrorWatch : IDisposable
        {
            private bool _on = true;

            public ErrorWatch() => Application.logMessageReceived += OnLog;

            private void OnLog(string condition, string stackTrace, LogType type)
            {
                if (type != LogType.Error && type != LogType.Exception) return;
                if (_ownLog) return;
                if (stackTrace != null && stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;
                Fails++;
            }

            public void Dispose()
            {
                if (!_on) return;
                _on = false;
                Application.logMessageReceived -= OnLog;
            }
        }
    }
}
