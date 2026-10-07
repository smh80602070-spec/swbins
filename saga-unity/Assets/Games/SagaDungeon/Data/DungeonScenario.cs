using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가나락 시나리오 「이름이 지워지는 나라」 진행 — 웹 사가나락 `js/scenario.js` 엔진 결(코드 공유 없음). 표는 <see cref="DungeonScenarioData"/>.
    /// **지금 어느 장 몇째 단계인지**를 적고, 그 단계가 채워졌는지 물어보며 하나씩 넘긴다. 새 판정을 만들지 않는다 — 단계는 이미 나가는 사건만 듣는다:
    /// talk = 대사 장면(<see cref="ScenePlay"/> — UI 가 받는다, **칸(마을·갈림길) 안일 때만**) · kill = 적이 쓰러질 때(이 단계가 시작된 뒤 n 마리) ·
    /// floor = 굴혈에서 닿은 최고 층 · chain = 그 지역 사연 사슬 평정(<see cref="RegionSagaState"/>) · region = 그 지역에 처음 들어섬(사슬이 열림) ·
    /// landmark = 명소 층 답파(<see cref="LandmarkState"/>) · rescue = 갇힌 인물을 구할 때(이 단계가 시작된 뒤 n 번).
    /// **이 트랙 다름**: 웹 `save.dungeon.best`(최고 층)는 이 트랙에 없어 여기서 적는다(굴혈에 있는 동안의 층, <see cref="OnFloor"/>) · 옛 세이브는 저장된
    /// 층으로 지나온 장을 보상 없이 끝낸 것으로 본다(<see cref="RestoreLegacy"/>) · 웹 명소 키 `heaven` 은 여기 `cloud` · 공적은 화폐가 없어 × <see cref="DungeonRegionFoes.GoldPerMerit"/> 냥.
    /// 세이브 <c>SaveData.scenarioJson</c>(버전 그대로 — 없는 세이브는 <see cref="RestoreLegacy"/>).
    /// </summary>
    public static class DungeonScenario
    {
        /// <summary>끄는 법 — 진단이 다른 진단 앞에서 끈다.</summary>
        public static bool Enabled = true;

        /// <summary>진단이 정하면 지금 칸 안인지 대신 이 값. 없으면 <see cref="InTownProvider"/>.</summary>
        public static bool? InTownForTest;
        /// <summary>칸 안인지 — `DungeonScenarioRunner` 가 앉힌다(지역 추적기·컷·시련·난입).</summary>
        public static Func<bool> InTownProvider;

        public struct SceneRequest
        {
            public DungeonScenarioData.Scene Scene;
            public string Title;
        }

        /// <summary>장면을 띄우라는 신호 — 받는 쪽(UI)이 끝나면 <see cref="SceneFinished"/> 를 부른다. 받는 이가 없으면 장면은 안 뜨고 단계는 기다린다.</summary>
        public static event Action<SceneRequest> ScenePlay;
        public static event Action<DungeonScenarioData.Chapter> ChapterStarted;
        /// <summary>장을 끝냈다 — (장, 보상 글).</summary>
        public static event Action<DungeonScenarioData.Chapter, string> ChapterFinished;
        public static event Action Changed;

        [Serializable]
        private class SaveBlob
        {
            public string ch;
            public int step, baseCount, kill, rescue, best;
            public string[] done, said, choiceIds, choiceKeys, titles;
        }

        private static readonly HashSet<string> Done = new HashSet<string>();
        private static readonly HashSet<string> Said = new HashSet<string>();
        private static readonly Dictionary<string, string> Choices = new Dictionary<string, string>();
        private static readonly List<string> Titles = new List<string>();
        private static string _ch;
        private static int _step, _base = -1, _kill, _rescue, _best;
        private static bool _busy, _playing;

        public static int DoneCount => Done.Count;
        public static bool IsDone(string chapterId) => Done.Contains(chapterId);
        public static int BestFloor => _best;
        public static int Kills => _kill;
        public static int Rescues => _rescue;
        public static bool Playing => _playing;
        public static string Choice(string choiceId) => Choices.TryGetValue(choiceId, out var v) ? v : null;
        public static IReadOnlyList<string> AwardedTitles => Titles;
        public static bool HasSaid(string sceneId) => Said.Contains(sceneId);
        public static int StepIndex => _step;
        public static string ChapterId => _ch;

        // ---- 사건 --------------------------------------------------------------------------------------------

        public static void OnKill() { _kill++; Check(); }
        public static void OnRescue() { _rescue++; Check(); }

        /// <summary>굴혈에 서 있는 층 — 최고 층만 기억한다.</summary>
        public static void OnFloor(int floor)
        {
            if (floor <= _best) return;
            _best = floor;
            Check();
        }

        // ---- 판정 --------------------------------------------------------------------------------------------

        public static DungeonScenarioData.Chapter Current()
        {
            foreach (var c in DungeonScenarioData.Chapters) if (!Done.Contains(c.Id)) return c;
            return null;
        }

        private static bool Opened(DungeonScenarioData.Chapter c) => c.After == null || Done.Contains(c.After);

        public static bool InTown() => InTownForTest ?? (InTownProvider != null && InTownProvider());

        /// <summary>장면 id — `by` 가 있으면 앞에서 고른 답에 따라 `장면_답`(안 골랐으면 첫 갈래).</summary>
        public static string SceneIdOf(DungeonScenarioData.Step step)
        {
            if (string.IsNullOrEmpty(step.By)) return step.Scene;
            string pick = Choice(step.By);
            if (pick == null)
            {
                var c = DungeonScenarioData.ChoiceOf(step.By);
                pick = c != null ? c.Options[0].Key : "";
            }
            return step.Scene + "_" + pick;
        }

        private static int LandmarkIndex(string key)
        {
            for (int i = 0; i < DungeonLandmarkData.All.Length; i++) if (DungeonLandmarkData.All[i].Key == key) return i;
            return -1;
        }

        public static bool StepDone(DungeonScenarioData.Step step)
        {
            switch (step.T)
            {
                case "talk": return Said.Contains(SceneIdOf(step));
                case "region": { int r = DungeonWorldMap.IndexOf(step.Key); return r >= 0 && RegionSagaState.Get(r).opened; }
                case "kill": return _base >= 0 && _kill - _base >= step.N;
                case "rescue": return _base >= 0 && _rescue - _base >= step.N;
                case "floor": return _best >= step.N;
                case "chain": { int r = DungeonWorldMap.IndexOf(step.Key); return r >= 0 && RegionSagaState.Get(r).done; }
                case "landmark": { int i = LandmarkIndex(step.Key); return i >= 0 && LandmarkState.IsCleared(i); }
            }
            return true;
        }

        /// <summary>이 단계를 시작한다 — 세는 단계는 기준값을 적고, 장면은 칸 안이면 띄운다.</summary>
        private static void Begin(DungeonScenarioData.Step step)
        {
            if ((step.T == "kill" || step.T == "rescue") && _base < 0) _base = step.T == "kill" ? _kill : _rescue;
            if (step.T != "talk" || _playing || !InTown()) return;
            var scene = DungeonScenarioData.SceneOf(SceneIdOf(step));
            if (scene == null || ScenePlay == null) return;
            _playing = true;
            var ch = DungeonScenarioData.ChapterOf(scene.ChapterId);
            ScenePlay.Invoke(new SceneRequest
            {
                Scene = scene,
                Title = string.Format(DungeonLocalization.T("dscen.chapter_fmt", "제{0}장 · {1}"), ch.No, ChapterTitle(ch)),
            });
        }

        /// <summary>UI 가 장면을 다 봤다고 알린다 — 고르기 장면이면 고른 답 key.</summary>
        public static void SceneFinished(string sceneId, string picked)
        {
            _playing = false;
            Said.Add(sceneId);
            var scene = DungeonScenarioData.SceneOf(sceneId);
            if (scene != null && scene.Choice != null && picked != null)
            {
                Choices[scene.Choice.Id] = picked;
                foreach (var o in scene.Choice.Options)
                {
                    if (o.Key != picked) continue;
                    if (o.Gold > 0) HeroState.AddGold(o.Gold);
                    if (o.Feat > 0) HeroState.AddGold(o.Feat * DungeonRegionFoes.GoldPerMerit);
                    Notify?.Invoke(string.Format(DungeonLocalization.T("dscen.picked", "📖 {0} — 골랐다"), Loc($"dscen.choice.{scene.Choice.Id}.{o.Key}", o.LabelKo)));
                }
            }
            Changed?.Invoke();
            Check();
        }

        /// <summary>토스트 신호(러너가 DialogueLabel 로 보인다) — 진단에선 비어 있다.</summary>
        public static Action<string> Notify;

        /// <summary>장면을 못 띄운 채(UI 없음 등) 접힌 뒤 다시 열어 주게.</summary>
        public static void AbortScene() => _playing = false;

        private static string Grant(DungeonScenarioData.Chapter c)
        {
            var bits = new List<string>();
            if (c.Exp > 0) { HeroState.AddExp(c.Exp); bits.Add(string.Format(DungeonLocalization.T("dscen.reward.exp", "경험치 {0}"), c.Exp)); }
            if (c.Gold > 0) { HeroState.AddGold(c.Gold); bits.Add(string.Format(DungeonLocalization.T("dscen.reward.gold", "금 {0}"), c.Gold)); }
            if (c.Feat > 0)
            {
                int gold = c.Feat * DungeonRegionFoes.GoldPerMerit;
                HeroState.AddGold(gold);
                bits.Add(string.Format(DungeonLocalization.T("dscen.reward.feat", "공적 {0} (금 {1})"), c.Feat, gold));
            }
            if (!string.IsNullOrEmpty(c.AwardKo))
            {
                if (!Titles.Contains(c.AwardKo)) Titles.Add(c.AwardKo);
                bits.Add(string.Format(DungeonLocalization.T("dscen.reward.title", "🏷️ 칭호 「{0}」"), Loc($"dscen.title.{c.Id}", c.AwardKo)));
            }
            return bits.Count > 0 ? string.Join(" · ", bits) : DungeonLocalization.T("dscen.done_none", "끝");
        }

        private static void Finish(DungeonScenarioData.Chapter c)
        {
            string reward = Grant(c);
            Done.Add(c.Id);
            _ch = null; _step = 0; _base = -1;
            ChapterFinished?.Invoke(c, string.Format(DungeonLocalization.T("dscen.done_toast", "📖 제{0}장 · {1} 끝 — {2}"), c.No, ChapterTitle(c), reward));
            Changed?.Invoke();
        }

        /// <summary>지금 단계가 채워졌으면 넘기고, 못 채웠으면 시작만 시켜 둔다 — 걸림돌이 나올 때까지 돈다.</summary>
        public static void Check()
        {
            if (!Enabled || _busy) return;
            _busy = true;
            try
            {
                for (int guard = 0; guard < 60; guard++)
                {
                    var ch = Current();
                    if (ch == null || !Opened(ch)) break;
                    if (_ch != ch.Id)
                    {
                        _ch = ch.Id; _step = 0; _base = -1;
                        ChapterStarted?.Invoke(ch);
                    }
                    if (_step >= ch.Steps.Length) { Finish(ch); continue; }
                    var step = ch.Steps[_step];
                    if (StepDone(step)) { _step++; _base = -1; Changed?.Invoke(); continue; }
                    Begin(step);
                    if (StepDone(step)) continue;
                    break;
                }
            }
            finally { _busy = false; }
        }

        /// <summary>1초쯤마다 러너가 부른다 — 칸으로 돌아온 순간을 잡는다.</summary>
        public static void Poll()
        {
            if (!_playing) Check();
        }

        // ---- 글 ----------------------------------------------------------------------------------------------

        private static string Loc(string key, string ko) => DungeonLocalization.T(key, ko);
        public static string ChapterTitle(DungeonScenarioData.Chapter c) => Loc($"dscen.ch.{c.Id}.title", c.TitleKo);
        public static string ChapterStage(DungeonScenarioData.Chapter c) => Loc($"dscen.ch.{c.Id}.stage", c.StageKo);
        public static string ChapterBlurb(DungeonScenarioData.Chapter c) => Loc($"dscen.ch.{c.Id}.blurb", c.BlurbKo);
        public static string ActName(int act) => Loc($"dscen.act.{act}", act + "막");
        public static string CastName(string who)
        {
            if (who == "me") return DungeonLocalization.T("dscen.you", "나");
            var c = DungeonScenarioData.CastOf(who);
            return c == null ? "?" : Loc($"dscen.cast.{who}", c.NameKo);
        }
        public static string CastEmoji(string who) => who == "me" ? "🧑" : DungeonScenarioData.CastOf(who)?.Emoji ?? "💬";
        public static string LineText(string sceneId, int i) =>
            Loc($"dscen.scene.{sceneId}.{i}", DungeonScenarioData.SceneOf(sceneId).Lines[i].Ko);
        public static string ChoicePrompt(DungeonScenarioData.Choice c) => Loc($"dscen.choice.{c.Id}.prompt", c.PromptKo);
        public static string OptionLabel(DungeonScenarioData.Choice c, DungeonScenarioData.Option o) => Loc($"dscen.choice.{c.Id}.{o.Key}", o.LabelKo);

        /// <summary>목표판 한 줄 — 이야기가 안 열렸거나 다 봤으면 빈 글.</summary>
        public static string HudLine()
        {
            if (!Enabled) return "";
            var ch = Current();
            if (ch == null) return Titles.Count > 0 ? "🏷️ 「" + string.Join("」 「", Titles.ConvertAll(t => t)) + "」" : "";
            if (!Opened(ch)) return "";
            var step = ch.Steps[_ch == ch.Id ? Math.Min(_step, ch.Steps.Length - 1) : 0];
            string text;
            switch (step.T)
            {
                case "talk": text = InTown() ? DungeonLocalization.T("dscen.hint.talk", "💬 이야기를 듣는다") : DungeonLocalization.T("dscen.hint.talk_wait", "💬 마을로 돌아가면 이야기가 이어진다"); break;
                case "region": { int r = DungeonWorldMap.IndexOf(step.Key); text = string.Format(DungeonLocalization.T("dscen.hint.region", "🗺️ 큰 지도에서 「{0}」 에 발을 들인다"), r >= 0 ? DungeonWorldMap.Name(r) : step.Key); break; }
                case "kill": text = string.Format(DungeonLocalization.T("dscen.hint.kill", "⚔️ 몬스터 {0}/{1}"), Math.Min(step.N, Math.Max(0, _base >= 0 ? _kill - _base : 0)), step.N); break;
                case "rescue": text = DungeonLocalization.T("dscen.hint.rescue", "🙏 갇힌 인물을 구한다"); break;
                case "floor": text = string.Format(DungeonLocalization.T("dscen.hint.floor", "🕳️ 굴혈 {0}층에 닿는다 (최고 {1})"), step.N, _best); break;
                case "chain": { int r = DungeonWorldMap.IndexOf(step.Key); text = string.Format(DungeonLocalization.T("dscen.hint.chain", "🗺️ 큰 지도의 사연 「{0}」 를 평정한다"), r >= 0 ? DungeonRegionSagas.Title(r) : step.Key); break; }
                case "landmark": { int i = LandmarkIndex(step.Key); text = string.Format(DungeonLocalization.T("dscen.hint.landmark", "🏛️ 명소 「{0}」 ({1}층)을 답파한다"), i >= 0 ? DungeonLandmarkData.Name(i) : step.Key, i >= 0 ? DungeonLandmarkData.All[i].Floor : 0); break; }
                default: text = DungeonLocalization.T("dscen.hint.finish", "마무리"); break;
            }
            return string.Format(DungeonLocalization.T("dscen.hud", "📖 제{0}장 · {1} — {2}"), ch.No, ChapterTitle(ch), text);
        }

        // ---- 세이브 ------------------------------------------------------------------------------------------

        public static string Snapshot()
        {
            var b = new SaveBlob
            {
                ch = _ch, step = _step, baseCount = _base, kill = _kill, rescue = _rescue, best = _best,
                done = new List<string>(Done).ToArray(), said = new List<string>(Said).ToArray(),
                titles = Titles.ToArray(),
            };
            var ids = new List<string>(); var keys = new List<string>();
            foreach (var kv in Choices) { ids.Add(kv.Key); keys.Add(kv.Value); }
            b.choiceIds = ids.ToArray(); b.choiceKeys = keys.ToArray();
            return JsonUtility.ToJson(b);
        }

        public static void Restore(string json)
        {
            ResetState();
            if (string.IsNullOrEmpty(json)) return;
            var b = JsonUtility.FromJson<SaveBlob>(json);
            if (b == null) return;
            _ch = string.IsNullOrEmpty(b.ch) ? null : b.ch;
            _step = b.step; _base = b.baseCount; _kill = b.kill; _rescue = b.rescue; _best = b.best;
            if (b.done != null) foreach (var s in b.done) if (DungeonScenarioData.ChapterOf(s) != null) Done.Add(s);
            if (b.said != null) foreach (var s in b.said) Said.Add(s);
            if (b.titles != null) Titles.AddRange(b.titles);
            if (b.choiceIds != null && b.choiceKeys != null)
                for (int i = 0; i < b.choiceIds.Length && i < b.choiceKeys.Length; i++) Choices[b.choiceIds[i]] = b.choiceKeys[i];
            Changed?.Invoke();
        }

        /// <summary>시나리오 필드가 없던 옛 세이브 — 저장된 층(층 2 는 새 판 기본이라 '닿아 본 층' 으로 안 친다)으로 지나온 장을 보상 없이 끝낸 것으로 본다.
        /// 웹 `legacy.floor` 표: 1·3·5·7·8·10·11·13·15·20·21·22·23·25·30.</summary>
        public static void RestoreLegacy(int savedFloor)
        {
            ResetState();
            _best = savedFloor > 2 ? savedFloor : 0;
            foreach (var c in DungeonScenarioData.Chapters)
                if (LegacyFloor(c.Id) > 0 && _best >= LegacyFloor(c.Id)) Done.Add(c.Id);
            Changed?.Invoke();
        }

        /// <summary>웹 표의 옛 세이브 문턱 층(0 = 옛 세이브에 없던 장).</summary>
        public static int LegacyFloor(string chapterId)
        {
            switch (chapterId)
            {
                case "a1_moru": return 1;
                case "a1_blackflag": return 3;
                case "a1_tomb": return 5;
                case "a2_factory": return 7;
                case "a2_tideflat": return 8;
                case "a2_watchtower": return 10;
                case "a3_riftgate": return 11;
                case "a3_sunfurnace": return 13;
                case "a3_blackwind": return 15;
                case "a3_palace": return 20;
                case "a4_caravan": return 21;
                case "a4_snowfort": return 22;
                case "a4_scrap": return 23;
                case "a4_hellgate": return 25;
                case "a5_heaven": return 30;
            }
            return 0;
        }

        private static void ResetState()
        {
            Done.Clear(); Said.Clear(); Choices.Clear(); Titles.Clear();
            _ch = null; _step = 0; _base = -1; _kill = 0; _rescue = 0; _best = 0; _playing = false;
        }

        /// <summary>진단 — 새 판 상태로.</summary>
        public static void ResetForTest()
        {
            ResetState();
            Enabled = true;
            InTownForTest = null;
            Notify = null;
        }
    }
}
