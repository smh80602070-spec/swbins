using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가종횡 시나리오 「이름 없는 떠돌이」 진행 — 웹 사가종횡 `js/scenario.js` 엔진 결(코드 공유 없음). 표는 <see cref="StoryScenarioData"/>.
    /// 지금 어느 장 몇째 단계인지를 적고 그 단계가 채워졌는지 물어보며 하나씩 넘긴다. 새 판정을 만들지 않는다 — talk = 대사 장면(<see cref="ScenePlay"/> → UI, **들판에 서 있을 때만**) ·
    /// mission = 이미 있는 사명 둘(`q_field` 첫 사냥 = <see cref="StoryQuestState.QuestDone"/> · `q_boss1` 두목의 목 = <see cref="StoryQuestState.QuestBossDone"/>) ·
    /// job = 전직(<see cref="StoryJobState.HasJob"/>) · rift = 비경을 이 단계가 시작된 뒤 한 번 끝까지(<see cref="OnRiftCleared"/>).
    /// **이 트랙 다름**: 사냥터가 들판 하나뿐이라 웹 `stage`·`gate` 단계는 없고 표는 세 장뿐 · 돈·두루마리가 없어 보상은 경험치·기억 조각·칭호 · 옛 세이브는 레벨/전직으로 지나온 장을 보상 없이 끝냄 ·
    /// 세이브 `scenarioJson`(버전 그대로 — 없는 세이브는 <see cref="RestoreLegacy"/>).
    /// </summary>
    public static class StoryScenario
    {
        public static bool Enabled = true;
        public static bool? InFieldForTest;
        public static Func<bool> InFieldProvider;

        public struct SceneRequest
        {
            public StoryScenarioData.Scene Scene;
            public string Title;
        }

        public static event Action<SceneRequest> ScenePlay;
        public static event Action<StoryScenarioData.Chapter> ChapterStarted;
        public static event Action<StoryScenarioData.Chapter, string> ChapterFinished;
        public static event Action Changed;

        [Serializable]
        private class SaveBlob
        {
            public string ch;
            public int step, rifts, riftBase, killBase, bossBase;
            public string[] done, said, titles, choiceIds, choiceKeys;
        }

        private static readonly HashSet<string> Done = new HashSet<string>();
        private static readonly HashSet<string> Said = new HashSet<string>();
        private static readonly List<string> Titles = new List<string>();
        private static readonly Dictionary<string, string> Choices = new Dictionary<string, string>();
        private static string _ch;
        private static int _step, _rifts, _riftBase = -1, _killBase = -1, _bossBase = -1;
        private static bool _busy, _playing;

        public static int DoneCount => Done.Count;
        public static bool IsDone(string chapterId) => Done.Contains(chapterId);
        public static bool HasSaid(string sceneId) => Said.Contains(sceneId);
        public static bool Playing => _playing;
        public static int StepIndex => _step;
        public static string ChapterId => _ch;
        public static int Rifts => _rifts;
        public static IReadOnlyList<string> AwardedTitles => Titles;

        public static bool InField() => InFieldForTest ?? (InFieldProvider != null && InFieldProvider());

        public static void OnRiftCleared() { _rifts++; Check(); }

        public static StoryScenarioData.Chapter Current()
        {
            foreach (var c in StoryScenarioData.Chapters) if (!Done.Contains(c.Id)) return c;
            return null;
        }

        private static bool Opened(StoryScenarioData.Chapter c) =>
            (c.After == null || Done.Contains(c.After)) && StoryJobState.Level >= c.Need;

        public static bool StepDone(StoryScenarioData.Step step)
        {
            switch (step.T)
            {
                case "talk": return Said.Contains(SceneIdOf(step));
                case "mission": return step.Key == "q_field" ? StoryQuestState.QuestDone : step.Key == "q_boss1" ? StoryQuestState.QuestBossDone : true;
                case "job": return step.N <= 1 ? StoryJobState.HasJob : StoryJobState.Tier >= step.N;
                case "gate": return StorySaveState.ChampionEverClaimed;
                case "kills": return _killBase >= 0 && StoryQuestState.Kills - _killBase >= step.N;
                case "boss": return _bossBase >= 0 && StoryQuestState.BossKills - _bossBase >= Math.Max(1, step.N);
                case "rift": return _riftBase >= 0 && _rifts - _riftBase >= 1;
            }
            return true;
        }

        private static void Begin(StoryScenarioData.Step step)
        {
            if (step.T == "rift" && _riftBase < 0) _riftBase = _rifts;
            if (step.T == "kills" && _killBase < 0) _killBase = StoryQuestState.Kills;
            if (step.T == "boss" && _bossBase < 0) _bossBase = StoryQuestState.BossKills;
            if (step.T != "talk" || _playing || !InField()) return;
            var scene = StoryScenarioData.SceneOf(SceneIdOf(step));
            if (scene == null || ScenePlay == null) return;
            _playing = true;
            var ch = StoryScenarioData.ChapterOf(scene.ChapterId);
            ScenePlay.Invoke(new SceneRequest { Scene = scene, Title = ChapterFullTitle(ch) });
        }

        /// <summary>단계가 뜻하는 장면 id — `By` 가 있으면 그 고르기의 답(없으면 첫 답)에 따라 `장면_답`.</summary>
        public static string SceneIdOf(StoryScenarioData.Step step)
        {
            if (string.IsNullOrEmpty(step.By)) return step.Scene;
            string key = ChoiceOf(step.By) ?? DefaultChoiceKey(step.By);
            return step.Scene + "_" + key;
        }

        private static StoryScenarioData.Choice ChoiceDef(string choiceId)
        {
            foreach (var s in StoryScenarioData.Scenes) if (s.Choice != null && s.Choice.Id == choiceId) return s.Choice;
            return null;
        }

        private static string DefaultChoiceKey(string choiceId)
        {
            var c = ChoiceDef(choiceId);
            return c != null && c.Options.Length > 0 ? c.Options[0].Key : "";
        }

        /// <summary>고른 답의 key — 아직 안 골랐으면 null.</summary>
        public static string ChoiceOf(string choiceId) => Choices.TryGetValue(choiceId, out var k) ? k : null;

        /// <summary>장면 끝 고르기 — 답을 적고, 답에 칭호가 있으면 칭호로 받는다. 이미 골랐으면 무시(true 는 새로 기록).</summary>
        public static bool Choose(string choiceId, string key)
        {
            var def = ChoiceDef(choiceId);
            if (def == null || Choices.ContainsKey(choiceId)) return false;
            StoryScenarioData.ChoiceOption opt = null;
            foreach (var o in def.Options) if (o.Key == key) opt = o;
            if (opt == null) return false;
            Choices[choiceId] = key;
            if (!string.IsNullOrEmpty(opt.TitleKo))
            {
                string title = Loc($"sscen.choice.{choiceId}.{key}.title", opt.TitleKo);
                if (!Titles.Contains(title)) Titles.Add(title);
            }
            Changed?.Invoke();
            return true;
        }

        public static string ChoicePrompt(StoryScenarioData.Choice c) => Loc($"sscen.choice.{c.Id}.prompt", c.PromptKo);
        public static string ChoiceLabel(StoryScenarioData.Choice c, StoryScenarioData.ChoiceOption o) => Loc($"sscen.choice.{c.Id}.{o.Key}", o.LabelKo);

        public static void SceneFinished(string sceneId)
        {
            _playing = false;
            var fin = StoryScenarioData.SceneOf(sceneId);
            if (fin != null && fin.Choice != null && !Choices.ContainsKey(fin.Choice.Id)) Choose(fin.Choice.Id, fin.Choice.Options[0].Key); // 건너뛰면 첫 답
            Said.Add(sceneId);
            Changed?.Invoke();
            Check();
        }

        public static void AbortScene() => _playing = false;

        private static string Finish(StoryScenarioData.Chapter c)
        {
            var bits = new List<string>();
            if (c.Exp > 0) { StoryJobState.GainExp(c.Exp); bits.Add(string.Format(StoryLocalization.T("sscen.reward.exp", "경험치 {0}"), c.Exp)); }
            if (c.Shards > 0) { StoryLabyrinthState.AddShards(c.Shards); bits.Add(string.Format(StoryLocalization.T("sscen.reward.shard", "기억 조각 {0}"), c.Shards)); }
            if (c.JobTitle && StoryJobState.HasJob)
            {
                string job = StoryLocalization.T($"job.{StoryJobState.Job}", StoryJobState.JobDisplayName);
                string title = string.Format(StoryLocalization.T("sscen.title.nameless_job", "이름 없는 {0}"), job);
                if (!Titles.Contains(title)) Titles.Add(title);
                bits.Add(string.Format(StoryLocalization.T("sscen.reward.title", "🏷️ 칭호 「{0}」"), title));
            }
            return bits.Count > 0 ? string.Join(" · ", bits) : StoryLocalization.T("sscen.done_none", "끝");
        }

        private static void Complete(StoryScenarioData.Chapter c)
        {
            string reward = Finish(c);
            Done.Add(c.Id);
            _ch = null; _step = 0; _riftBase = -1; _killBase = -1; _bossBase = -1;
            ChapterFinished?.Invoke(c, string.Format(StoryLocalization.T("sscen.done_toast", "📖 제{0}장 · {1} 끝 — {2}"), c.No, ChapterTitle(c), reward));
            Changed?.Invoke();
        }

        public static void Check()
        {
            if (!Enabled || _busy) return;
            _busy = true;
            try
            {
                for (int guard = 0; guard < 40; guard++)
                {
                    var ch = Current();
                    if (ch == null || !Opened(ch)) break;
                    if (_ch != ch.Id)
                    {
                        _ch = ch.Id; _step = 0; _riftBase = -1; _killBase = -1; _bossBase = -1;
                        ChapterStarted?.Invoke(ch);
                    }
                    if (_step >= ch.Steps.Length) { Complete(ch); continue; }
                    var step = ch.Steps[_step];
                    if (StepDone(step)) { _step++; _riftBase = -1; _killBase = -1; _bossBase = -1; Changed?.Invoke(); continue; }
                    Begin(step);
                    if (StepDone(step)) continue;
                    break;
                }
            }
            finally { _busy = false; }
        }

        public static void Poll()
        {
            if (!_playing) Check();
        }

        // ---- 글 ----------------------------------------------------------------------------------------------

        private static string Loc(string key, string ko) => StoryLocalization.T(key, ko);
        public static string ChapterTitle(StoryScenarioData.Chapter c) => Loc($"sscen.ch.{c.Id}.title", c.TitleKo);
        public static string ChapterBlurb(StoryScenarioData.Chapter c) => Loc($"sscen.ch.{c.Id}.blurb", c.BlurbKo);
        public static string ChapterFullTitle(StoryScenarioData.Chapter c) =>
            string.Format(StoryLocalization.T("sscen.chapter_fmt", "제{0}장 · {1}"), c.No, ChapterTitle(c));
        public static string CastName(string who)
        {
            if (who == "me") return StoryLocalization.T("sscen.you", "나");
            var c = StoryScenarioData.CastOf(who);
            return c == null ? "?" : Loc($"sscen.cast.{who}", c.NameKo);
        }
        public static string CastEmoji(string who) => who == "me" ? "🧑" : StoryScenarioData.CastOf(who)?.Emoji ?? "💬";
        public static string LineText(string sceneId, int i) => Loc($"sscen.scene.{sceneId}.{i}", StoryScenarioData.SceneOf(sceneId).Lines[i].Ko);

        /// <summary>HUD 한 줄 — 이야기가 안 열렸거나 다 봤으면 빈 글(다 본 칭호는 안 보인다).</summary>
        public static string HudLine()
        {
            if (!Enabled) return "";
            var ch = Current();
            if (ch == null) return "";
            if (!Opened(ch))
            {
                if (ch.After != null && !Done.Contains(ch.After)) return "";
                return string.Format(StoryLocalization.T("sscen.hud", "📖 제{0}장 · {1} — {2}"), ch.No, ChapterTitle(ch),
                    string.Format(StoryLocalization.T("sscen.hint.level", "레벨 {0} 이 되면 이어진다"), ch.Need));
            }
            var step = ch.Steps[_ch == ch.Id ? Math.Min(_step, ch.Steps.Length - 1) : 0];
            string text;
            switch (step.T)
            {
                case "talk": text = StoryLocalization.T("sscen.hint.talk", "💬 이야기를 듣는다"); break;
                case "mission": text = step.Key == "q_field" ? StoryLocalization.T("sscen.hint.kill", "🗡️ 「첫 사냥」을 마친다") : StoryLocalization.T("sscen.hint.boss", "👺 「두목의 목」을 벤다"); break;
                case "job": text = step.N <= 1 ? StoryLocalization.T("sscen.hint.job", "🥋 전직관에게 첫 전직을 배운다") : string.Format(StoryLocalization.T("sscen.hint.job_n", "🥋 전직관에게 {0}차 전직을 배운다"), step.N); break;
                case "gate": text = StoryLocalization.T("sscen.hint.gate", "🛡️ 관문 대장을 쓰러뜨린다"); break;
                case "kills": text = string.Format(StoryLocalization.T("sscen.hint.kills", "🗡️ 잡졸을 쓰러뜨린다 ({0}/{1})"), _ch == ch.Id && _killBase >= 0 ? Math.Min(step.N, StoryQuestState.Kills - _killBase) : 0, step.N); break;
                case "boss": text = StoryLocalization.T("sscen.hint.boss_n", "👺 두목을 쓰러뜨린다"); break;
                case "rift": text = StoryLocalization.T("sscen.hint.rift", "🌀 비경을 한 번 끝까지 깬다"); break;
                default: text = StoryLocalization.T("sscen.hint.finish", "마무리"); break;
            }
            return string.Format(StoryLocalization.T("sscen.hud", "📖 제{0}장 · {1} — {2}"), ch.No, ChapterTitle(ch), text);
        }

        // ---- 세이브 ------------------------------------------------------------------------------------------

        public static string Snapshot() => JsonUtility.ToJson(new SaveBlob
        {
            ch = _ch, step = _step, rifts = _rifts, riftBase = _riftBase, killBase = _killBase, bossBase = _bossBase,
            done = new List<string>(Done).ToArray(), said = new List<string>(Said).ToArray(), titles = Titles.ToArray(),
            choiceIds = new List<string>(Choices.Keys).ToArray(), choiceKeys = new List<string>(Choices.Values).ToArray(),
        });

        public static void Restore(string json)
        {
            ResetState();
            if (string.IsNullOrEmpty(json)) return;
            var b = JsonUtility.FromJson<SaveBlob>(json);
            if (b == null) return;
            _ch = string.IsNullOrEmpty(b.ch) ? null : b.ch;
            _step = b.step; _rifts = b.rifts; _riftBase = b.riftBase;
            _killBase = b.killBase; _bossBase = b.bossBase; // 옛 세이브(필드 없음)는 0 — 다음 단계 넘김에서 -1 로 돌아온다(kills·boss 단계는 그 뒤에야 시작)
            if (b.choiceIds != null && b.choiceKeys != null)
                for (int i = 0; i < b.choiceIds.Length && i < b.choiceKeys.Length; i++) Choices[b.choiceIds[i]] = b.choiceKeys[i];
            if (b.done != null) foreach (var s in b.done) if (StoryScenarioData.ChapterOf(s) != null) Done.Add(s);
            if (b.said != null) foreach (var s in b.said) Said.Add(s);
            if (b.titles != null) Titles.AddRange(b.titles);
            Changed?.Invoke();
        }

        /// <summary>시나리오 필드가 없던 옛 세이브 — 레벨이 문턱 이상이거나 전직을 했으면 그 장은 보상 없이 지나온 길로 본다.</summary>
        public static void RestoreLegacy(int level, bool hasJob)
        {
            ResetState();
            foreach (var c in StoryScenarioData.Chapters)
                if (level >= c.LegacyLevel || (hasJob && c.LegacyTier <= 1)) Done.Add(c.Id);
            Changed?.Invoke();
        }

        private static void ResetState()
        {
            Done.Clear(); Said.Clear(); Titles.Clear(); Choices.Clear();
            _ch = null; _step = 0; _rifts = 0; _riftBase = -1; _killBase = -1; _bossBase = -1; _playing = false;
        }

        public static void ResetForTest()
        {
            ResetState();
            Enabled = true;
            InFieldForTest = null;
        }
    }
}
