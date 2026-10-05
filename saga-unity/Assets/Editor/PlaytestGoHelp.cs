using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0043 도움말 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoHelp.RunBatch`, 장면 없이): 표(갈래 셋·줄 키 중복 없음·모든 줄이 "키 | 설명") ·
    ///    번역(ko·en json 에 표의 키가 전부 있고 값이 "키 | 설명" 꼴) · **표에 적힌 코드 키가 소스에서 정말 읽힌다**(`jKey`·`f1Key` 등) ·
    ///    고돗 전용 키(알 I·사진 P)가 표에 없다 — 주간 도전은 U-0044(U)·재출항은 U-0045(N)로 들어옴.
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 사냥 기록 진단 뒤에 부른다, 장면 안): 창이 붙어 있고 단추·닫는다로 열고 닫히며 세 칸에 갈래 이름과
    ///    줄이 다 들어간다. 세이브 파일은 건드리지 않는다.
    /// </summary>
    public static class PlaytestGoHelp
    {
        private static string _tag;
        private static bool _ok;

        private static readonly string LocDir = "Assets/Games/SagaGo/Resources/Localization/";
        private static readonly string GoRoot = "Assets/Games/SagaGo";

        [MenuItem("Saga/Playtest Go Help")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoHelp]");
            using (PlaytestKit.ErrorCounter())
            {
                CheckTable();
                CheckTranslations();
                CheckCodeKeys();
            }
            PlaytestKit.Summary("PlaytestGoHelp");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void CheckTable()
        {
            var secs = GoHelp.Sections;
            PlaytestKit.Check(secs.Length == 3, $"갈래 {secs.Length} ≠ 3");
            var all = GoHelp.AllKeys().ToList();
            PlaytestKit.Check(all.Count == all.Distinct().Count(), "줄 키가 겹침");
            foreach (var s in secs)
            {
                PlaytestKit.Check(s.Lines.Length >= 5, $"{s.NameKey} 줄이 5 미만");
                foreach (var l in s.Lines)
                {
                    PlaytestKit.Check(l.Key.StartsWith(s.NameKey + "."), $"{l.Key} 가 {s.NameKey} 밑이 아님");
                    var (keys, text) = GoHelp.Split(l.Fallback);
                    PlaytestKit.Check(keys.Length > 0 && text.Length > 0, $"{l.Key} 가 '키 | 설명' 꼴이 아님");
                }
            }
            // 고돗 전용 시스템이 이 트랙 표에 새어 들어오지 않았다 — 알·주머니·재출항·회차·사진첩·주간 도전
            string joined = string.Join("\n", secs.SelectMany(s => s.Lines).Select(l => l.Fallback));
            foreach (var bad in new[] { "알 주머니", "부화", "사진첩" })
                PlaytestKit.Check(!joined.Contains(bad), $"고돗 전용 '{bad}' 가 표에 있음");
            Debug.Log($"[PlaytestGoHelp] table 갈래 {secs.Length} · 줄 {secs.Sum(s => s.Lines.Length)}");
        }

        private static void CheckTranslations()
        {
            foreach (var lang in new[] { "ko", "en" })
            {
                string path = LocDir + "go_" + lang + ".json";
                var map = new Dictionary<string, string>();
                foreach (var m in System.Text.RegularExpressions.Regex.Matches(File.ReadAllText(path), "\"key\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"\\s*,\\s*\"value\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").Cast<System.Text.RegularExpressions.Match>())
                    map[m.Groups[1].Value] = m.Groups[2].Value;
                foreach (var l in GoHelp.Sections.SelectMany(s => s.Lines))
                {
                    if (!map.TryGetValue(l.Key, out var v)) { PlaytestKit.Fail($"go_{lang}.json 에 {l.Key} 없음"); continue; }
                    PlaytestKit.Check(v.Contains("|"), $"go_{lang}.json {l.Key} 가 '키 | 설명' 꼴이 아님");
                }
                foreach (var s in GoHelp.Sections)
                    PlaytestKit.Check(map.ContainsKey(s.NameKey), $"go_{lang}.json 에 {s.NameKey} 없음");
                foreach (var k in new[] { "help.button", "help.title" })
                    PlaytestKit.Check(map.ContainsKey(k), $"go_{lang}.json 에 {k} 없음");
            }
        }

        private static void CheckCodeKeys()
        {
            var src = new System.Text.StringBuilder();
            foreach (var f in Directory.GetFiles(GoRoot, "*.cs", SearchOption.AllDirectories))
                if (!f.EndsWith("GoHelp.cs")) src.Append(File.ReadAllText(f)).Append((char)10);
            string text = src.ToString();
            int checkedKeys = 0;
            foreach (var l in GoHelp.Sections.SelectMany(s => s.Lines))
                foreach (var code in l.Code)
                {
                    checkedKeys++;
                    PlaytestKit.Check(text.Contains("." + code), $"{l.Key} 의 {code} 를 소스가 읽지 않는다 — 표가 낡았다");
                }
            Debug.Log($"[PlaytestGoHelp] code keys {checkedKeys} 개 소스에서 읽힘 확인");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var ui = HelpUi.Instance;
            if (ui == null) { Fail("HelpUi 없음(WorldMapBuilder 연결?)"); return false; }
            string savePath = Path.Combine(Application.persistentDataPath, "save.json");
            var before = File.Exists(savePath) ? File.GetLastWriteTimeUtc(savePath) : System.DateTime.MinValue;
            var parts = new List<string>();
            try
            {
                if (ui.OpenButton == null || ui.CloseButton == null) Fail("단추 없음");
                else
                {
                    if (ui.IsOpen) Fail("처음부터 열려 있음");
                    ui.OpenButton.onClick.Invoke();
                    if (!ui.IsOpen) Fail("단추로 안 열림");
                    if (ui.ColumnCount != GoHelp.Sections.Length) Fail($"칸 {ui.ColumnCount} ≠ {GoHelp.Sections.Length}");
                    else
                    {
                        for (int i = 0; i < ui.ColumnCount; i++)
                        {
                            var s = GoHelp.Sections[i];
                            string t = ui.ColumnText(i);
                            if (!t.Contains(GoHelp.SectionName(s))) Fail($"칸 {i} 에 갈래 이름 없음");
                            foreach (var l in s.Lines)
                            {
                                var (keys, _) = GoHelp.Read(l);
                                if (!t.Contains(keys)) Fail($"칸 {i} 에 '{keys}' 줄 없음");
                            }
                        }
                    }
                    ui.CloseButton.onClick.Invoke();
                    if (ui.IsOpen) Fail("닫는다로 안 닫힘");
                    ui.Toggle();
                    if (!ui.IsOpen) Fail("Toggle 로 안 열림");
                    ui.Toggle();
                    if (ui.IsOpen) Fail("Toggle 로 안 닫힘");
                    parts.Add($"창 열고 닫기(단추·닫는다·Toggle)·칸 {ui.ColumnCount}·줄 {GoHelp.Sections.Sum(s => s.Lines.Length)}");
                }
                var after = File.Exists(savePath) ? File.GetLastWriteTimeUtc(savePath) : System.DateTime.MinValue;
                if (after != before) Fail("도움말이 세이브 파일을 건드림");
                else parts.Add("세이브 불변");
            }
            finally { ui.Close(); }
            if (_ok) Debug.Log($"[{_tag}] help OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] help FAIL - {msg}");
        }
    }
}
