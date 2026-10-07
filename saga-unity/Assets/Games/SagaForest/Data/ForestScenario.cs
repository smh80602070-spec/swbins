using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가마을 시나리오 「하늘 금 우체통」 진행 — 웹 사가마을 `js/scenario.js` 엔진 결(코드 공유 없음). 표는 <see cref="ForestScenarioData"/>.
    /// 지금 어느 장 몇째 단계인지를 적고 그 단계가 채워졌는지 물어보며 하나씩 넘긴다. 새 판정을 만들지 않는다 — talk = 대사 장면(<see cref="ScenePlay"/> → UI, 마을 어디서나) ·
    /// place = 집 가구 수 · deliver = 택배 배달(이 단계가 시작된 뒤) · forest = 그 구역에 들어선 적 있음 · go = 그 구역 명소 곁에 섬(<see cref="OnLandmark"/>) ·
    /// gather = 채집 갈래별 횟수(<see cref="OnGather"/>) · fest = 행사 놀이(그날이 아니어도 그 단계 동안 <see cref="ForestFestivalState.MemorialKind"/> 로 열린다) ·
    /// heart = 손님과의 정(<see cref="ForestVisitors.BondOf"/>) · donate = 박물관 도감 · settle = 눌러앉은 손님.
    /// **이 트랙 다름**: 낚시·조개 장 셋은 뺐고(물이 없다), 숲·명소·행사는 <see cref="ForestScenarioData"/> 머리 글의 매핑대로 · 보상은 과일(금 ÷ 50 + 공적)·칭호 ·
    /// 세이브 `scenarioJson`(버전 그대로 — 없으면 처음부터).
    /// </summary>
    public static class ForestScenario
    {
        public const int GoldPerFruit = 50;
        public static bool Enabled = true;
        public static bool? InTownForTest;
        public static Func<bool> InTownProvider;
        /// <summary>지금 선 구역 번호(<see cref="ForestBiomeData.Zones"/>), 구역 밖이면 -1 — `ForestScenarioRunner` 가 앉힌다.</summary>
        public static Func<int> ZoneProvider;

        public struct SceneRequest
        {
            public ForestScenarioData.Scene Scene;
            public string Title;
        }

        public static event Action<SceneRequest> ScenePlay;
        public static event Action<ForestScenarioData.Chapter> ChapterStarted;
        public static event Action<ForestScenarioData.Chapter, string> ChapterFinished;
        public static event Action Changed;
        /// <summary>토스트 신호(러너가 DialogueLabel 로) — 진단에선 비어 있다.</summary>
        public static Action<string> Notify;

        [Serializable]
        private class SaveBlob
        {
            public string ch;
            public int step, baseCount, zonesSeen;
            public int[] gather, landmark, fest;
            public string[] done, said, choiceIds, choiceKeys, titles;
        }

        private static readonly HashSet<string> Done = new HashSet<string>();
        private static readonly HashSet<string> Said = new HashSet<string>();
        private static readonly Dictionary<string, string> Choices = new Dictionary<string, string>();
        private static readonly List<string> Titles = new List<string>();
        private static readonly int[] Gather = new int[4];
        private static readonly int[] Landmark = new int[4];
        private static readonly int[] Fest = new int[3];
        private static int _zonesSeen;
        private static string _ch;
        private static int _step, _base = -1;
        private static bool _busy, _playing;

        public static int DoneCount => Done.Count;
        public static bool IsDone(string chapterId) => Done.Contains(chapterId);
        public static bool HasSaid(string sceneId) => Said.Contains(sceneId);
        public static bool Playing => _playing;
        public static int StepIndex => _step;
        public static string ChapterId => _ch;
        public static string Choice(string choiceId) => Choices.TryGetValue(choiceId, out var v) ? v : null;
        public static IReadOnlyList<string> AwardedTitles => Titles;
        public static int GatherCount(ForestMuseumState.Category c) => Gather[(int)c];
        public static int LandmarkCount(int zone) => zone >= 0 && zone < Landmark.Length ? Landmark[zone] : 0;

        public static bool InTown() => InTownForTest ?? (InTownProvider == null || InTownProvider());

        // ---- 사건 --------------------------------------------------------------------------------------------

        public static void OnGather(ForestMuseumState.Category category) { Gather[(int)category]++; Check(); }
        public static void OnLandmark(int zone) { if (zone >= 0 && zone < Landmark.Length) Landmark[zone]++; Check(); }
        public static void OnFestival(ForestFestivalState.Kind kind) { Fest[(int)kind]++; Check(); }

        /// <summary>지금 서 있는 구역을 알린다(러너가 반 초마다) — 들어선 적 있는 구역으로 적는다.</summary>
        public static void OnZone(int zone)
        {
            if (zone < 0 || zone > 30) return;
            int bit = 1 << zone;
            if ((_zonesSeen & bit) != 0) return;
            _zonesSeen |= bit;
            Check();
        }

        // ---- 판정 --------------------------------------------------------------------------------------------

        public static ForestScenarioData.Chapter Current()
        {
            foreach (var c in ForestScenarioData.Chapters) if (!Done.Contains(c.Id)) return c;
            return null;
        }

        private static bool Opened(ForestScenarioData.Chapter c) => c.After == null || Done.Contains(c.After);

        public static string SceneIdOf(ForestScenarioData.Step step)
        {
            if (string.IsNullOrEmpty(step.By)) return step.Scene;
            string pick = Choice(step.By);
            if (pick == null)
            {
                var c = ForestScenarioData.ChoiceOf(step.By);
                pick = c != null ? c.Options[0].Key : "";
            }
            return step.Scene + "_" + pick;
        }

        private static int ZoneIndex(string key)
        {
            for (int i = 0; i < ForestBiomeData.Zones.Length; i++) if (ForestBiomeData.Zones[i].Key == key) return i;
            return -1;
        }

        private static ForestMuseumState.Category CategoryOf(string key) => (ForestMuseumState.Category)Enum.Parse(typeof(ForestMuseumState.Category), key);
        private static ForestFestivalState.Kind KindOf(string key) => (ForestFestivalState.Kind)Enum.Parse(typeof(ForestFestivalState.Kind), key);

        /// <summary>손님 누구든 가장 깊은 정.</summary>
        public static int BestBond()
        {
            int best = 0;
            foreach (var v in ForestVisitors.List) best = Math.Max(best, ForestVisitors.BondOf(v.Key));
            return best;
        }

        public static int PlacedCount() => ForestHomeState.AllPlacements().Count();

        /// <summary>단계가 세는 값(진행 표시용) — 세지 않는 단계는 0.</summary>
        private static int Counted(ForestScenarioData.Step step)
        {
            switch (step.T)
            {
                case "deliver": return _base >= 0 ? ForestDeliveryState.DeliveredCount - _base : 0;
                case "gather": return _base >= 0 ? Gather[(int)CategoryOf(step.Key)] - _base : 0;
                case "go": { int z = ZoneIndex(step.Key); return _base >= 0 && z >= 0 ? Landmark[z] - _base : 0; }
            }
            return 0;
        }

        public static bool StepDone(ForestScenarioData.Step step)
        {
            switch (step.T)
            {
                case "talk": return Said.Contains(SceneIdOf(step));
                case "place": return PlacedCount() >= step.N;
                case "deliver": return _base >= 0 && Counted(step) >= step.N;
                case "forest": { int z = ZoneIndex(step.Key); return z >= 0 && (_zonesSeen & (1 << z)) != 0; }
                case "go": return _base >= 0 && Counted(step) >= Math.Max(1, step.N);
                case "gather": return _base >= 0 && Counted(step) >= step.N;
                case "fest": return _base >= 0 && Fest[(int)KindOf(step.Key)] - _base >= 1;
                case "heart": return BestBond() >= step.N;
                case "donate": return ForestMuseumState.DiscoveredCountOf(CategoryOf(step.Key)) >= step.N;
                case "settle": return ForestVisitors.SettledList.Count >= step.N;
            }
            return true;
        }

        private static void Begin(ForestScenarioData.Step step)
        {
            if (_base < 0)
            {
                switch (step.T)
                {
                    case "deliver": _base = ForestDeliveryState.DeliveredCount; break;
                    case "gather": _base = Gather[(int)CategoryOf(step.Key)]; break;
                    case "go": { int z = ZoneIndex(step.Key); _base = z >= 0 ? Landmark[z] : 0; break; }
                    case "fest": _base = Fest[(int)KindOf(step.Key)]; break;
                }
            }
            if (step.T != "talk" || _playing || !InTown()) return;
            var scene = ForestScenarioData.SceneOf(SceneIdOf(step));
            if (scene == null || ScenePlay == null) return;
            _playing = true;
            ScenePlay.Invoke(new SceneRequest { Scene = scene, Title = ChapterFullTitle(ForestScenarioData.ChapterOf(scene.ChapterId)) });
        }

        public static void SceneFinished(string sceneId, string picked)
        {
            _playing = false;
            Said.Add(sceneId);
            var scene = ForestScenarioData.SceneOf(sceneId);
            if (scene != null && scene.Choice != null && picked != null)
            {
                Choices[scene.Choice.Id] = picked;
                foreach (var o in scene.Choice.Options)
                    if (o.Key == picked)
                        Notify?.Invoke(string.Format(ForestLocalization.T("fscen.picked", "📖 {0} — 골랐다"), Loc($"fscen.choice.{scene.Choice.Id}.{o.Key}", o.LabelKo)));
            }
            Changed?.Invoke();
            Check();
        }

        public static void AbortScene() => _playing = false;

        public static int FruitOf(ForestScenarioData.Chapter c) => c.Gold / GoldPerFruit + c.Feat;

        private static void Complete(ForestScenarioData.Chapter c)
        {
            var bits = new List<string>();
            int fruit = FruitOf(c);
            if (fruit > 0) { ForestState.AddFruit(fruit); bits.Add(string.Format(ForestLocalization.T("fscen.reward.fruit", "과일 {0}"), fruit)); }
            if (!string.IsNullOrEmpty(c.AwardKo))
            {
                if (!Titles.Contains(c.AwardKo)) Titles.Add(c.AwardKo);
                bits.Add(string.Format(ForestLocalization.T("fscen.reward.title", "🏷️ 칭호 「{0}」"), Loc($"fscen.title.{c.Id}", c.AwardKo)));
            }
            Done.Add(c.Id);
            _ch = null; _step = 0; _base = -1;
            string reward = bits.Count > 0 ? string.Join(" · ", bits) : ForestLocalization.T("fscen.done_none", "끝");
            ChapterFinished?.Invoke(c, string.Format(ForestLocalization.T("fscen.done_toast", "📖 {0}장 · {1} 끝 — {2}"), c.No, ChapterTitle(c), reward));
            Changed?.Invoke();
        }

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
                    if (_step >= ch.Steps.Length) { Complete(ch); continue; }
                    var step = ch.Steps[_step];
                    if (StepDone(step)) { _step++; _base = -1; Changed?.Invoke(); continue; }
                    Begin(step);
                    if (StepDone(step)) continue;
                    break;
                }
            }
            finally
            {
                _busy = false;
                UpdateMemorial();
            }
        }

        /// <summary>fest 단계가 걸려 있는 동안만 그 종류의 행사를 오늘 열린 것으로 친다(기념 놀이).</summary>
        private static void UpdateMemorial()
        {
            ForestFestivalState.Kind? want = null;
            if (Enabled)
            {
                var ch = Current();
                if (ch != null && Opened(ch) && _ch == ch.Id && _step < ch.Steps.Length && ch.Steps[_step].T == "fest" && !StepDone(ch.Steps[_step]))
                    want = KindOf(ch.Steps[_step].Key);
            }
            if (ForestFestivalState.MemorialKind != want) ForestFestivalState.MemorialKind = want;
        }

        public static void Poll()
        {
            if (ZoneProvider != null) OnZone(ZoneProvider());
            if (!_playing) Check();
        }

        // ---- 글 ----------------------------------------------------------------------------------------------

        private static string Loc(string key, string ko) => ForestLocalization.T(key, ko);
        public static string ChapterTitle(ForestScenarioData.Chapter c) => Loc($"fscen.ch.{c.Id}.title", c.TitleKo);
        public static string ChapterBlurb(ForestScenarioData.Chapter c) => Loc($"fscen.ch.{c.Id}.blurb", c.BlurbKo);
        public static string SeasonName(string season) => Loc($"fscen.season.{season}", season);
        public static string ChapterFullTitle(ForestScenarioData.Chapter c) =>
            string.Format(ForestLocalization.T("fscen.chapter_fmt", "{0}장 · {1}"), c.No, ChapterTitle(c));
        public static string CastName(string who)
        {
            if (who == "me") return ForestLocalization.T("fscen.you", "나");
            var c = ForestScenarioData.CastOf(who);
            return c == null ? "?" : Loc($"fscen.cast.{who}", c.NameKo);
        }
        public static string CastEmoji(string who) => who == "me" ? "🧑" : ForestScenarioData.CastOf(who)?.Emoji ?? "💬";
        public static string LineText(string sceneId, int i) => Loc($"fscen.scene.{sceneId}.{i}", ForestScenarioData.SceneOf(sceneId).Lines[i].Ko);
        public static string ChoicePrompt(ForestScenarioData.Choice c) => Loc($"fscen.choice.{c.Id}.prompt", c.PromptKo);
        public static string OptionLabel(ForestScenarioData.Choice c, ForestScenarioData.Option o) => Loc($"fscen.choice.{c.Id}.{o.Key}", o.LabelKo);

        private static string CategoryLabel(string key) => ForestMuseumState.CategoryName(CategoryOf(key));

        /// <summary>목표판 한 줄 — 이야기가 안 열렸거나 다 봤으면 빈 글.</summary>
        public static string HudLine()
        {
            if (!Enabled) return "";
            var ch = Current();
            if (ch == null || !Opened(ch)) return "";
            var step = ch.Steps[_ch == ch.Id ? Math.Min(_step, ch.Steps.Length - 1) : 0];
            string text;
            switch (step.T)
            {
                case "talk": text = ForestLocalization.T("fscen.hint.talk", "💬 이야기를 듣는다"); break;
                case "place": text = string.Format(ForestLocalization.T("fscen.hint.place", "🛋️ 집에 가구를 {0}개 놓는다"), step.N); break;
                case "deliver": text = string.Format(ForestLocalization.T("fscen.hint.deliver", "📦 택배를 {0}/{1}번 배달한다"), Math.Min(step.N, Counted(step)), step.N); break;
                case "forest": { int z = ZoneIndex(step.Key); text = string.Format(ForestLocalization.T("fscen.hint.forest", "🌲 「{0}」 에 든다"), z >= 0 ? ForestBiomeData.Zones[z].DisplayName : step.Key); break; }
                case "go":
                {
                    int z = ZoneIndex(step.Key);
                    string name = z >= 0 ? ForestBiomeData.Zones[z].LandmarkName : step.Key;
                    text = step.N > 1
                        ? string.Format(ForestLocalization.T("fscen.hint.cave", "🗿 명소 「{0}」 곁에 {1}/{2}번 선다"), name, Math.Min(step.N, Counted(step)), step.N)
                        : string.Format(ForestLocalization.T("fscen.hint.go", "🗿 명소 「{0}」 곁에 선다"), name);
                    break;
                }
                case "gather": text = string.Format(ForestLocalization.T("fscen.hint.gather", "🧺 「{0}」 채집 {1}/{2}"), CategoryLabel(step.Key), Math.Min(step.N, Counted(step)), step.N); break;
                case "fest": text = string.Format(ForestLocalization.T("fscen.hint.fest", "🎉 「{0}」 기념 놀이를 치른다"), ForestFestivalState.DisplayLabel(KindOf(step.Key))); break;
                case "heart": text = string.Format(ForestLocalization.T("fscen.hint.heart", "💗 손님과 정 {0} 이상 (지금 {1})"), step.N, BestBond()); break;
                case "donate": text = string.Format(ForestLocalization.T("fscen.hint.donate", "🏛️ 사고에 「{0}」 {1}점을 채운다 (지금 {2})"), CategoryLabel(step.Key), step.N, ForestMuseumState.DiscoveredCountOf(CategoryOf(step.Key))); break;
                case "settle": text = string.Format(ForestLocalization.T("fscen.hint.settle", "🏠 손님 {0}명을 눌러앉힌다 (지금 {1})"), step.N, ForestVisitors.SettledList.Count); break;
                default: text = ForestLocalization.T("fscen.hint.finish", "마무리"); break;
            }
            return string.Format(ForestLocalization.T("fscen.hud", "📖 {0}장 · {1} — {2}"), ch.No, ChapterTitle(ch), text);
        }

        // ---- 세이브 ------------------------------------------------------------------------------------------

        public static string Snapshot()
        {
            var b = new SaveBlob
            {
                ch = _ch, step = _step, baseCount = _base, zonesSeen = _zonesSeen,
                gather = (int[])Gather.Clone(), landmark = (int[])Landmark.Clone(), fest = (int[])Fest.Clone(),
                done = new List<string>(Done).ToArray(), said = new List<string>(Said).ToArray(), titles = Titles.ToArray(),
            };
            var ids = new List<string>(); var keys = new List<string>();
            foreach (var kv in Choices) { ids.Add(kv.Key); keys.Add(kv.Value); }
            b.choiceIds = ids.ToArray(); b.choiceKeys = keys.ToArray();
            return JsonUtility.ToJson(b);
        }

        public static void Restore(string json)
        {
            ResetState();
            if (!string.IsNullOrEmpty(json))
            {
                var b = JsonUtility.FromJson<SaveBlob>(json);
                if (b != null)
                {
                    _ch = string.IsNullOrEmpty(b.ch) ? null : b.ch;
                    _step = b.step; _base = b.baseCount; _zonesSeen = b.zonesSeen;
                    Copy(b.gather, Gather); Copy(b.landmark, Landmark); Copy(b.fest, Fest);
                    if (b.done != null) foreach (var s in b.done) if (ForestScenarioData.ChapterOf(s) != null) Done.Add(s);
                    if (b.said != null) foreach (var s in b.said) Said.Add(s);
                    if (b.titles != null) Titles.AddRange(b.titles);
                    if (b.choiceIds != null && b.choiceKeys != null)
                        for (int i = 0; i < b.choiceIds.Length && i < b.choiceKeys.Length; i++) Choices[b.choiceIds[i]] = b.choiceKeys[i];
                }
            }
            UpdateMemorial();
            Changed?.Invoke();
        }

        private static void Copy(int[] from, int[] to)
        {
            if (from == null) return;
            for (int i = 0; i < to.Length && i < from.Length; i++) to[i] = from[i];
        }

        private static void ResetState()
        {
            Done.Clear(); Said.Clear(); Choices.Clear(); Titles.Clear();
            Array.Clear(Gather, 0, Gather.Length); Array.Clear(Landmark, 0, Landmark.Length); Array.Clear(Fest, 0, Fest.Length);
            _zonesSeen = 0; _ch = null; _step = 0; _base = -1; _playing = false;
        }

        public static void ResetForTest()
        {
            ResetState();
            Enabled = true;
            InTownForTest = null;
            Notify = null;
            ForestFestivalState.MemorialKind = null;
        }
    }
}
