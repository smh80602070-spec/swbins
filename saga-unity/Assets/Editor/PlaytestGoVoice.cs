using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0068 대사 음성 진단(규칙 층, 장면 없이 — `-executeMethod …PlaytestGoVoice.RunBatch`). 장면 층(진짜 공격·필살·상자·레벨업에서 말했는지)은
    /// `PlaytestGoSfx.Run` 끝의 `CheckVoice` 가 본다(PlaytestHeadless 1500줄 상한).
    /// ① 표: 갈래 넷 × 20줄 · 인물 배정 299 · 빠진 줄 31 ② 파일: 목소리 열 × (외침·줍기·인사) − 빠진 줄 + 해설 안내 20 = 589 가 Resources 에서 실제로 열림
    /// ③ 규칙(가짜 시계·로더): 간격 · 확률 0/1 · 순위(말하는 중 낮은 말 버림) · sure 는 끊고 들어감 · SKIP·빠진 줄은 안 고름 · 해시 목소리 고정 · 안내 키 · 끄기
    /// ④ 다섯 판 부르는 자리(소스).
    /// </summary>
    public static class PlaytestGoVoice
    {
        private static readonly string[] Voices = { "M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5" };

        [MenuItem("Saga/Playtest Go Voice")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoVoice]");
            var loader = SagaVoice.Loader; var now = SagaVoice.Now; var rng = SagaVoice.Rng;
            bool en = SagaVoice.Enabled;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    SagaVoice.ResetForTest();
                    CheckTable();
                    CheckFiles();
                    CheckRules();
                    CheckSourceHooks();
                }
                finally
                {
                    SagaVoice.Loader = loader; SagaVoice.Now = now; SagaVoice.Rng = rng; SagaVoice.Enabled = en;
                    SagaVoice.ResetForTest();
                }
            }
            PlaytestKit.Summary("PlaytestGoVoice");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckTable()
        {
            var lines = SagaVoice.Lines;
            foreach (var k in new[] { "shout", "pickup", "greet", "system" })
                PlaytestKit.Check(lines.TryGetValue(k, out var l) && l.Count == 20, $"갈래 {k} 가 20줄이 아님");
            PlaytestKit.Check(SagaVoice.AssignTable.Count == 299, $"인물 배정 {SagaVoice.AssignTable.Count} ≠ 299");
            PlaytestKit.Check(SagaVoice.AssignTable.Values.All(v => Voices.Contains(v)), "배정에 모르는 목소리");
            PlaytestKit.Check(SagaVoice.IsMissing("F1", "shout_07") && !SagaVoice.IsMissing("M1", "shout_01"), "빠진 줄 표를 못 읽음");
            Debug.Log($"[PlaytestGoVoice] table OK - 4 kinds × 20 · assign {SagaVoice.AssignTable.Count}");
        }

        private static void CheckFiles()
        {
            int found = 0, missing = 0;
            var lost = new List<string>();
            foreach (var v in Voices)
                foreach (var k in new[] { "shout", "pickup", "greet" })
                    foreach (var lid in SagaVoice.Lines[k])
                    {
                        if (SagaVoice.IsMissing(v, lid)) { missing++; continue; }
                        if (Resources.Load<AudioClip>(SagaVoice.Dir + SagaVoice.KeyOf(v, lid)) != null) found++; else lost.Add(SagaVoice.KeyOf(v, lid));
                    }
            foreach (var lid in SagaVoice.Lines["system"])
                if (Resources.Load<AudioClip>(SagaVoice.Dir + SagaVoice.KeyOf(SagaVoice.Narrator, lid)) != null) found++; else lost.Add(SagaVoice.KeyOf(SagaVoice.Narrator, lid));
            PlaytestKit.Check(lost.Count == 0, $"표에 있는데 못 여는 음성 {lost.Count}: {string.Join(",", lost.Take(5))}");
            PlaytestKit.Check(missing == 31 && found == 589, $"음성 수 {found}(빠진 줄 {missing}) ≠ 589(31)");
            foreach (var key in SagaVoice.SystemLines.Values.Distinct())
                PlaytestKit.Check(SagaVoice.Lines["system"].Contains(key), $"안내 키 줄 {key} 이 표에 없음");
            Debug.Log($"[PlaytestGoVoice] files OK - {found} clips open from Resources (missing {missing} skipped)");
        }

        private static void CheckRules()
        {
            float t = 100f;
            SagaVoice.Now = () => t;
            SagaVoice.Loader = k => null; // 클립 없이 — 고르기·기록만
            SagaVoice.Rng = new System.Random(20260824);
            SagaVoice.Enabled = true;
            SagaVoice.ResetForTest(); SagaVoice.Always = true;

            // 배정·해시
            PlaytestKit.Check(SagaVoice.VoiceOf("sg_guanyu") == SagaVoice.AssignTable["sg_guanyu"], "배정된 인물 목소리가 다름");
            string h = SagaVoice.VoiceOf("no_such_person");
            PlaytestKit.Check(Voices.Contains(h) && SagaVoice.VoiceOf("no_such_person") == h, "해시 목소리가 고정이 아님");

            // 고르기 — SKIP·빠진 줄은 안 나온다
            var greets = Enumerable.Range(0, 300).Select(_ => SagaVoice.Pick("greet", "M1")).ToList();
            PlaytestKit.Check(!greets.Any(g => SagaVoice.Skip["greet"].Contains(g)) && greets.Distinct().Count() == 14, $"인사 고르기에 SKIP 이 섞임/종류 {greets.Distinct().Count()}");
            PlaytestKit.Check(!Enumerable.Range(0, 300).Any(_ => SagaVoice.Pick("shout", "F1") == "shout_07"), "빠진 줄(F1/shout_07)을 고름");

            // 간격
            string a = SagaVoice.Say("shout", "sg_guanyu");
            PlaytestKit.Check(a.StartsWith("voice_" + SagaVoice.VoiceOf("sg_guanyu") + "_shout_"), $"외침 파일 이름이 다름 {a}");
            t += 1f; SagaVoice.ResetTimingForTest(); SagaVoice.Say("shout", "sg_guanyu");
            t += 1f; PlaytestKit.Check(SagaVoice.Say("shout", "sg_guanyu") == "", "외침 간격(3초) 안인데 또 말함");
            t += 5f; PlaytestKit.Check(SagaVoice.Say("shout", "sg_guanyu") != "", "간격이 지나도 안 말함");

            // 순위 — 안내(3) 중엔 줍기(1) 버림, sure 외침(3)은 들어감
            t += 10f; SagaVoice.ResetTimingForTest();
            PlaytestKit.Check(SagaVoice.System("levelup") == "voice_NA_system_06", "레벨업 안내 줄이 다름");
            PlaytestKit.Check(SagaVoice.Say("pickup") == "", "안내 중인데 줍기 말이 끼어듦");
            PlaytestKit.Check(SagaVoice.Say("shout", "sg_guanyu", true) != "", "필살 외침(sure)이 안내에 막힘");
            t += 2f; PlaytestKit.Check(SagaVoice.Say("pickup") != "", "말이 끝났는데 줍기 말이 안 나옴");

            // 안내 키 · 확률 · 끄기
            PlaytestKit.Check(SagaVoice.System("nope") == "", "모르는 안내 키가 말함");
            t += 10f; SagaVoice.ResetTimingForTest(); SagaVoice.Always = false;
            float c = SagaVoice.Chance["shout"];
            SagaVoice.Chance["shout"] = 0f;
            PlaytestKit.Check(SagaVoice.Say("shout", "x") == "", "확률 0 인데 말함");
            SagaVoice.Chance["shout"] = 1f;
            PlaytestKit.Check(SagaVoice.Say("shout", "x") != "", "확률 1 인데 안 말함");
            SagaVoice.Chance["shout"] = c;
            t += 10f; SagaVoice.ResetTimingForTest(); SagaVoice.Always = true; SagaVoice.Enabled = false;
            PlaytestKit.Check(SagaVoice.Say("greet", "x") == "" && SagaVoice.System("save") == "", "끈 채로 말함");
            SagaVoice.Enabled = true;
            PlaytestKit.Check(SagaVoice.History.Count == SagaVoice.Count && SagaVoice.Count >= 6, "기록이 안 쌓임");
            Debug.Log($"[PlaytestGoVoice] rules OK - gap·chance·prio·sure·skip·missing·hash·system·off ({SagaVoice.Count} lines)");
        }

        private static void CheckSourceHooks()
        {
            void Has(string file, string needle) => PlaytestKit.Check(File.Exists(file) && File.ReadAllText(file).Contains(needle), $"{file} 에 {needle} 이 없음");
            const string G = "Assets/Games/";
            Has(G + "SagaGo/Combat/FieldCombat.cs", "SagaVoice.Say(\"shout\", m.Id, true)");
            Has(G + "SagaGo/Combat/FieldCombat.cs", "SagaVoice.Speaker = Active.Id");
            Has(G + "SagaGo/World/VillagerTalk.cs", "SagaVoice.Say(\"greet\"");
            Has(G + "SagaGo/UI/GoSaveButton.cs", "SagaVoice.System(\"save\")");
            Has(G + "SagaGo/UI/GoSessionTracker.cs", "SagaVoice.System(\"quest\")");
            Has(G + "SagaGo/Combat/FieldEnemy.cs", "SagaVoice.System(\"victory\")");
            Has(G + "SagaGo/Data/GoCooking.cs", "SagaVoice.Say(\"pickup\")");
            Has(G + "SagaGo/World/GameBootstrap.cs", "SagaVoice.MasterVolume");
            Has(G + "SagaDungeon/Player/PlayerCombat.cs", "SagaVoice.Say(\"shout\")");
            Has(G + "SagaStory/Player/StoryPlayerController.cs", "SagaVoice.Say(\"shout\")");
            Has(G + "SagaForest/World/ForestVillager.cs", "SagaVoice.Say(\"greet\"");
            Debug.Log("[PlaytestGoVoice] hooks OK - GO 공격·필살·줍기·인사·안내 넷 · 나락·종횡 외침 · 마을 인사");
        }
    }
}
