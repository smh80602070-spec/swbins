using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-16 사가마을 시나리오 「하늘 금 우체통」 진단 — `PlaytestForestHeadless` 가 부른다.
    /// 표(스물아홉 장·계절별 4·3·4·4·4·3·3·4 · 잇는 순서 · 단계 종류/키 · 장면 58) · 글(한국어 표에 다 있음) · 진행(장면 → 가구 → 장면 → 택배 → 과일 보상) ·
    /// 단계 종류(구역·명소·채집·기념 놀이(행사 날이 아니어도 열리고 끝나면 닫힘)·정·기증·눌러앉기) · 고르기(마을 이름·금 → 뒤 장면이 고른 답으로 갈림) ·
    /// 스물아홉 장 끝까지(칭호 다섯) · 세이브 · 장면 상자(UI) · 러너(구역·명소·장면 판정). 끝나면 과일·집·도감·손님·택배·행사를 되돌린다.
    /// </summary>
    public static class PlaytestForestScenario
    {
        private const string T = "[PlaytestForestHeadless] scenario";
        private static bool _ok;
        private static readonly List<ForestScenario.SceneRequest> Requests = new List<ForestScenario.SceneRequest>();
        private static readonly Queue<(string id, string pick)> Pending = new Queue<(string, string)>();
        private static string _pickCrack = "open", _pickName = "tell";

        public static bool Run()
        {
            _ok = true;
            string scen0 = ForestScenario.Snapshot();
            bool enabled0 = ForestScenario.Enabled;
            int fruit0 = ForestState.FruitCount;
            var placements0 = ForestHomeState.SnapshotPlacements();
            int delivered0 = ForestDeliveryState.Snapshot();
            var museum0 = ForestMuseumState.Snapshot();
            var bonds0 = ForestVisitors.SnapshotBonds();
            string json0 = ForestSaveState.ToJson();
            string festDone0 = ForestFestivalState.SnapshotDoneDate();
            var stories0 = ForestVisitors.SnapshotStories();
            long wish0 = ForestFestivalState.SnapshotWishUntilTicks();
            var parts = new List<string>();
            try
            {
                CheckTable(parts);
                CheckTexts(parts);
                CheckFlow(parts);
                CheckStepKinds(parts);
                CheckAll("open", "tell", parts);
                CheckAll("quiet", "secret", null);
                CheckSave(parts);
                CheckUi(parts);
                CheckRunner(parts);
                CheckGuestStory(parts);
            }
            catch (Exception e) { Fail("예외 " + e); }
            finally
            {
                ForestScenario.InTownForTest = null;
                ForestScenario.Notify = null;
                ForestScenarioUi.Instance?.Hide();
                ForestFestivalState.MemorialKind = null;
                ForestFestivalState.Restore(festDone0, wish0);
                ForestVisitors.RestoreStories(stories0);
                ForestState.Restore(fruit0);
                ForestHomeState.RestorePlacements(placements0.X, placements0.Y, placements0.Ids);
                ForestDeliveryState.Restore(delivered0);
                ForestMuseumState.Restore(museum0);
                ForestVisitors.RestoreBonds(bonds0.BondKeys, bonds0.BondCounts, bonds0.Settled, bonds0.GiftDay, bonds0.GiftGot, bonds0.AskSettle);
                ForestSaveState.ApplyJson(json0);
                ForestScenario.Restore(scen0);
                ForestScenario.Enabled = enabled0;
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Fail(string what)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {what}");
        }

        // ---- 표 · 글 -----------------------------------------------------------------------------------------

        private static readonly string[] Cats = { "Insect", "Mushroom", "Fossil", "Flower" };
        private static readonly string[] Kinds = { "Sebae", "FlowerHunt", "Wish" };

        private static void CheckTable(List<string> parts)
        {
            var ch = ForestScenarioData.Chapters;
            if (ch.Length != 29 || ch.Select(c => c.Id).Distinct().Count() != 29) Fail($"장 {ch.Length}");
            var perSeason = new[] { 4, 3, 4, 4, 4, 3, 3, 4 };
            for (int i = 0; i < ForestScenarioData.Seasons.Length; i++)
                if (ch.Count(c => c.Season == ForestScenarioData.Seasons[i]) != perSeason[i]) Fail($"{ForestScenarioData.Seasons[i]} 장 수");
            for (int i = 0; i < ch.Length; i++)
            {
                var c = ch[i];
                if (c.No != i + 1) Fail($"{c.Id} 번호");
                if (c.After != (i == 0 ? null : ch[i - 1].Id)) Fail($"{c.Id} 잇는 장");
                if (c.Steps.Length < 2) Fail($"{c.Id} 단계");
                foreach (var st in c.Steps)
                {
                    switch (st.T)
                    {
                        case "talk":
                            if (string.IsNullOrEmpty(st.By)) { if (ForestScenarioData.SceneOf(st.Scene) == null) Fail($"{c.Id} 장면 {st.Scene}"); }
                            else
                            {
                                var choice = ForestScenarioData.ChoiceOf(st.By);
                                if (choice == null) Fail($"{c.Id} 고르기 {st.By}");
                                else foreach (var o in choice.Options) if (ForestScenarioData.SceneOf(st.Scene + "_" + o.Key) == null) Fail($"{c.Id} 갈래 {st.Scene}_{o.Key}");
                            }
                            break;
                        case "place": case "deliver": case "heart": case "settle": if (st.N <= 0) Fail($"{c.Id} {st.T} n"); break;
                        case "forest": case "go":
                            if (!ForestBiomeData.Zones.Any(z => z.Key == st.Key)) Fail($"{c.Id} 구역 {st.Key}");
                            break;
                        case "gather": case "donate":
                            if (!Cats.Contains(st.Key) || st.N <= 0 || st.N > 5) Fail($"{c.Id} {st.T} {st.Key}/{st.N}");
                            if (st.T == "donate" && st.N > 3) Fail($"{c.Id} 기증 {st.N} 은 갈래당 셋을 넘음");
                            break;
                        case "fest": if (!Kinds.Contains(st.Key)) Fail($"{c.Id} 행사 {st.Key}"); break;
                        default: Fail($"{c.Id} 단계 종류 {st.T}"); break;
                    }
                }
            }
            foreach (var s in ForestScenarioData.Scenes)
            {
                if (ForestScenarioData.ChapterOf(s.ChapterId) == null) Fail($"장면 {s.Id} 장");
                foreach (var l in s.Lines) if (l.Who != "me" && ForestScenarioData.CastOf(l.Who) == null) Fail($"장면 {s.Id} 말하는 이 {l.Who}");
            }
            if (ForestScenarioData.Scenes.Length != 58) Fail($"장면 {ForestScenarioData.Scenes.Length}");
            if (ch.Count(c => !string.IsNullOrEmpty(c.AwardKo)) != 5) Fail("칭호 다섯");
            if (ch.Any(c => c.Id == "su_sailor" || c.Id == "y2_album" || c.Id == "y2_record")) Fail("물 없는 장이 들어옴");
            parts.Add("표(스물아홉 장·계절별 4/3/4/4/4/3/3/4·잇는 순서·단계 종류/키·장면 58·칭호 다섯)");
        }

        private static void CheckTexts(List<string> parts)
        {
            int miss = 0;
            void Need(string key) { if (ForestLocalization.T(key, "\u0001") == "\u0001") { miss++; if (miss < 4) Debug.LogError($"{T} 글 키 없음 {key}"); } }
            foreach (var s in ForestScenarioData.Seasons) Need($"fscen.season.{s}");
            foreach (var c in ForestScenarioData.Casts) Need($"fscen.cast.{c.Id}");
            foreach (var c in ForestScenarioData.Chapters)
            {
                Need($"fscen.ch.{c.Id}.title"); Need($"fscen.ch.{c.Id}.blurb");
                if (!string.IsNullOrEmpty(c.AwardKo)) Need($"fscen.title.{c.Id}");
            }
            foreach (var s in ForestScenarioData.Scenes)
            {
                for (int i = 0; i < s.Lines.Length; i++) Need($"fscen.scene.{s.Id}.{i}");
                if (s.Choice != null) { Need($"fscen.choice.{s.Choice.Id}.prompt"); foreach (var o in s.Choice.Options) Need($"fscen.choice.{s.Choice.Id}.{o.Key}"); }
            }
            if (miss > 0) Fail($"없는 글 키 {miss}");
            parts.Add("글(한국어 표에 다 있음)");
        }

        // ---- 진행 --------------------------------------------------------------------------------------------

        private static FieldInfo PlayField => typeof(ForestScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);

        private static Action<ForestScenario.SceneRequest> SwapToAuto()
        {
            var saved = (Action<ForestScenario.SceneRequest>)PlayField.GetValue(null);
            PlayField.SetValue(null, (Action<ForestScenario.SceneRequest>)(r =>
            {
                Requests.Add(r);
                string pick = null;
                if (r.Scene.Choice != null)
                {
                    string want = r.Scene.Choice.Id == "crack" ? _pickCrack : _pickName;
                    pick = r.Scene.Choice.Options.Any(o => o.Key == want) ? want : r.Scene.Choice.Options[0].Key;
                }
                Pending.Enqueue((r.Scene.Id, pick));
            }));
            return saved;
        }

        private static void Drain()
        {
            int guard = 0;
            while (Pending.Count > 0 && guard++ < 300)
            {
                var (id, pick) = Pending.Dequeue();
                ForestScenario.SceneFinished(id, pick);
            }
        }

        /// <summary>새 판 상태로 — 러너가 듣는 상태 이벤트가 진짜 장면을 못 띄우게 시나리오를 끈 채 되돌린다.</summary>
        private static void Fresh()
        {
            ForestScenario.Enabled = false;
            ForestScenarioUi.Instance?.Hide();
            ForestHomeState.RestorePlacements(null, null, null);
            ForestDeliveryState.Restore(0);
            ForestMuseumState.Restore(null);
            ForestVisitors.RestoreBonds(null, null, null, int.MinValue, null, false);
            ForestFestivalState.Restore("", 0);
            ForestState.Restore(0);
            ForestScenario.ResetForTest();
            ForestScenario.InTownForTest = false;
            Requests.Clear();
            Pending.Clear();
        }

        private static int ZoneIdx(string key) => Array.FindIndex(ForestBiomeData.Zones, z => z.Key == key);

        private static void CheckFlow(List<string> parts)
        {
            Fresh();
            var saved = SwapToAuto();
            try
            {
                ForestScenario.Check();
                if (Requests.Count != 0) Fail("마을 밖인데 장면이 뜸");
                if (ForestScenario.ChapterId != "sp_move" || !ForestScenario.HudLine().Contains("1장")) Fail("첫 장 " + ForestScenario.HudLine());
                ForestScenario.InTownForTest = true;
                ForestScenario.Poll(); Drain();
                if (Requests.Count != 1 || Requests[0].Scene.Id != "move1" || !Requests[0].Title.Contains("1장")) Fail("move1");
                if (ForestScenario.StepIndex != 1 || !ForestScenario.HudLine().Contains("가구")) Fail("가구 단계 " + ForestScenario.HudLine());
                ForestHomeState.RestorePlacements(new[] { 0 }, new[] { 0 }, new[] { FurnitureItem.Catalog[0].Id });
                ForestScenario.Check(); Drain();
                if (Requests.Count != 2 || Requests[1].Scene.Id != "move2" || ForestScenario.StepIndex != 3) Fail("move2 · 택배 단계 " + ForestScenario.StepIndex);
                if (!ForestScenario.HudLine().Contains("0/1")) Fail("택배 줄 " + ForestScenario.HudLine());
                int fruit = ForestState.FruitCount;
                ForestDeliveryState.Restore(ForestDeliveryState.DeliveredCount + 1);
                ForestScenario.Check(); Drain();
                if (!ForestScenario.IsDone("sp_move") || ForestState.FruitCount != fruit + 6) Fail($"1장 끝·과일 +6 ({ForestState.FruitCount - fruit})");
                if (ForestScenario.ChapterId != "sp_postbox") Fail("2장 시작 " + ForestScenario.ChapterId);
                parts.Add("진행(마을 밖 안 뜸·장면→가구→장면→택배→1장 끝 과일 +6·2장 시작)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
        }

        private static void CheckStepKinds(List<string> parts)
        {
            Fresh();
            var saved = SwapToAuto();
            try
            {
                ForestScenario.InTownForTest = true;
                ForestHomeState.RestorePlacements(new[] { 0 }, new[] { 0 }, new[] { FurnitureItem.Catalog[0].Id });
                ForestScenario.Check(); Drain();
                ForestDeliveryState.Restore(ForestDeliveryState.DeliveredCount + 1);
                ForestScenario.Check(); Drain(); // 1장 끝 → 2장: post1 → forest(eoksae = 꽃밭)
                int flower = ZoneIdx("flower_field");
                if (ForestScenario.ChapterId != "sp_postbox" || ForestScenario.StepIndex != 1 || !ForestScenario.HudLine().Contains(ForestBiomeData.Zones[flower].DisplayName)) Fail("구역 단계 " + ForestScenario.HudLine());
                ForestScenario.OnZone(ZoneIdx("rocky")); Drain();
                if (ForestScenario.StepIndex != 1) Fail("다른 구역이 셈에 들어감");
                ForestScenario.OnZone(flower); Drain();
                if (ForestScenario.StepIndex != 2 || !ForestScenario.HudLine().Contains(ForestBiomeData.Zones[flower].LandmarkName)) Fail("명소 단계 " + ForestScenario.HudLine());
                ForestScenario.OnLandmark(ZoneIdx("rocky")); Drain();
                if (ForestScenario.StepIndex != 2) Fail("다른 명소가 셈에 들어감");
                ForestScenario.OnLandmark(flower); Drain(); // post2 → deliver
                ForestDeliveryState.Restore(ForestDeliveryState.DeliveredCount + 1);
                ForestScenario.Check(); Drain();
                if (!ForestScenario.IsDone("sp_postbox")) Fail("2장 끝");
                // 3장 sp_fox: talk → gather flower 5 → fest samjin(꽃놀이) → heart 1 → talk
                if (ForestScenario.ChapterId != "sp_fox" || ForestScenario.StepIndex != 1) Fail("3장 채집 단계 " + ForestScenario.StepIndex);
                for (int i = 0; i < 4; i++) ForestScenario.OnGather(ForestMuseumState.Category.Flower);
                ForestScenario.OnGather(ForestMuseumState.Category.Fossil); Drain(); // 다른 갈래는 안 센다
                if (ForestScenario.StepIndex != 1 || !ForestScenario.HudLine().Contains("4/5")) Fail("채집 4/5 " + ForestScenario.HudLine());
                if (ForestFestivalState.MemorialKind.HasValue) Fail("행사 단계 전에 기념 놀이가 열림");
                ForestScenario.OnGather(ForestMuseumState.Category.Flower); Drain();
                if (ForestScenario.StepIndex != 3 || ForestFestivalState.MemorialKind != ForestFestivalState.Kind.FlowerHunt) Fail($"기념 놀이 열림 {ForestScenario.StepIndex}/{ForestFestivalState.MemorialKind}");
                if (ForestFestivalState.TodayKind() != ForestFestivalState.Kind.FlowerHunt) Fail("기념 놀이인데 오늘 행사가 아님");
                if (!ForestFestivalState.TryComplete(ForestFestivalState.Kind.FlowerHunt, out _)) Fail("기념 놀이 완료 못 함");
                if (ForestFestivalState.MemorialKind.HasValue || ForestScenario.StepIndex != 4) Fail($"기념 놀이 뒤 닫힘·다음 단계 {ForestScenario.StepIndex}");
                if (ForestFestivalState.IsDoneToday()) Fail("기념 놀이가 오늘 치른 것으로 적힘");
                if (ForestScenario.StepIndex == 4 && !ForestScenario.HudLine().Contains("정")) Fail("정 단계 줄 " + ForestScenario.HudLine());
                SetBond("fox", 1);
                ForestScenario.Check(); Drain();
                if (!ForestScenario.IsDone("sp_fox")) Fail("3장(정 1) 끝");
                // 4장 sp_museum: 기증(화석 셋) + 고르기(마을 이름)
                if (ForestScenario.ChapterId != "sp_museum" || ForestScenario.StepIndex != 1) Fail("4장 기증 단계 " + ForestScenario.StepIndex);
                ForestMuseumState.Restore(new[] { "나선화석", "이빨화석" });
                ForestScenario.Check(); Drain();
                if (ForestScenario.StepIndex != 1) Fail("화석 둘로 기증이 끝남");
                ForestMuseumState.Restore(new[] { "나선화석", "이빨화석", "발자국화석" });
                ForestScenario.Check(); Drain();
                if (!ForestScenario.IsDone("sp_museum") || ForestScenario.Choice("name") == null) Fail("4장 끝·고른 답");
                parts.Add("단계 종류(구역·명소·다른 것은 안 셈·채집 갈래별·기념 놀이 열림/닫힘·오늘 행사로 안 적힘·정·기증 셋)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); ForestFestivalState.MemorialKind = null; }
        }

        private static void SetBond(string key, int n) =>
            ForestVisitors.RestoreBonds(new[] { key }, new[] { n }, ForestVisitors.SnapshotBonds().Settled, int.MinValue, null, false);

        private static void Settle(int n)
        {
            var keys = ForestVisitors.List.Take(n).Select(v => v.Key).ToArray();
            ForestVisitors.RestoreBonds(keys, keys.Select(_ => 3).ToArray(), keys, int.MinValue, null, false);
        }

        /// <summary>표대로 스물아홉 장을 끝까지 — 고르기는 <paramref name="crack"/>·<paramref name="name"/>.</summary>
        private static void CheckAll(string crack, string name, List<string> parts)
        {
            Fresh();
            _pickCrack = crack; _pickName = name;
            var saved = SwapToAuto();
            try
            {
                ForestScenario.InTownForTest = true;
                ForestScenario.Check(); Drain();
                int guard = 0;
                int fruit = ForestState.FruitCount;
                while (ForestScenario.DoneCount < 29 && guard++ < 800)
                {
                    var ch = ForestScenario.Current();
                    if (ch == null) break;
                    var step = ch.Steps[Math.Min(ForestScenario.StepIndex, ch.Steps.Length - 1)];
                    switch (step.T)
                    {
                        case "place":
                        {
                            var xs = Enumerable.Range(0, step.N).ToArray();
                            ForestHomeState.RestorePlacements(xs, xs.Select(_ => 0).ToArray(), xs.Select(_ => FurnitureItem.Catalog[0].Id).ToArray());
                            break;
                        }
                        case "deliver": ForestDeliveryState.Restore(ForestDeliveryState.DeliveredCount + step.N); break;
                        case "forest": ForestScenario.OnZone(ZoneIdx(step.Key)); break;
                        case "go": for (int i = 0; i < step.N; i++) ForestScenario.OnLandmark(ZoneIdx(step.Key)); break;
                        case "gather": for (int i = 0; i < step.N; i++) ForestScenario.OnGather((ForestMuseumState.Category)Array.IndexOf(Cats, step.Key)); break;
                        case "fest": ForestFestivalState.TryComplete((ForestFestivalState.Kind)Array.IndexOf(Kinds, step.Key), out _); break;
                        case "heart": SetBond("fox", step.N); break;
                        case "settle": Settle(step.N); break;
                        case "donate":
                        {
                            var cat = (ForestMuseumState.Category)Array.IndexOf(Cats, step.Key);
                            ForestMuseumState.Restore(ForestMuseumState.ItemsOf(cat).Take(step.N).ToArray());
                            break;
                        }
                    }
                    ForestScenario.Check(); Drain();
                }
                if (ForestScenario.DoneCount != 29) { Fail($"스물아홉 장 끝: {ForestScenario.DoneCount} ({ForestScenario.ChapterId}/{ForestScenario.StepIndex})"); return; }
                if (ForestScenario.AwardedTitles.Count != 5) Fail("칭호 " + string.Join(",", ForestScenario.AwardedTitles));
                if (ForestScenario.Current() != null || ForestScenario.HudLine().Length != 0) Fail("끝난 뒤 줄");
                if (ForestFestivalState.MemorialKind.HasValue) Fail("끝났는데 기념 놀이가 열려 있음");
                int want = ForestScenarioData.Chapters.Sum(c => ForestScenario.FruitOf(c));
                if (ForestState.FruitCount - fruit < want) Fail($"과일 합계 {ForestState.FruitCount - fruit} < {want}");
                if (ForestScenario.Choice("crack") != crack || !Requests.Any(r => r.Scene.Id == "moon2_" + crack) || Requests.Any(r => r.Scene.Id == "moon2_" + (crack == "open" ? "quiet" : "open"))) Fail("대보름 갈래가 고른 답과 다름");
                parts?.Add("스물아홉 장 끝까지(칭호 다섯·과일 합계·대보름 갈래가 고른 답 open/quiet 둘 다·기념 놀이 닫힘)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); ForestFestivalState.MemorialKind = null; }
        }

        private static void CheckSave(List<string> parts)
        {
            Fresh();
            var saved = SwapToAuto();
            try
            {
                ForestScenario.InTownForTest = true;
                ForestHomeState.RestorePlacements(new[] { 0 }, new[] { 0 }, new[] { FurnitureItem.Catalog[0].Id });
                ForestScenario.Check(); Drain();
                ForestDeliveryState.Restore(1);
                ForestScenario.Check(); Drain();
                ForestScenario.OnZone(ZoneIdx("flower_field")); Drain();
                for (int i = 0; i < 3; i++) ForestScenario.OnGather(ForestMuseumState.Category.Flower);
                string json = ForestScenario.Snapshot();
                int done = ForestScenario.DoneCount, step = ForestScenario.StepIndex, flowers = ForestScenario.GatherCount(ForestMuseumState.Category.Flower);
                string ch = ForestScenario.ChapterId;
                ForestScenario.ResetForTest();
                ForestScenario.InTownForTest = false;
                ForestScenario.Restore(json);
                if (ForestScenario.DoneCount != done || ForestScenario.StepIndex != step || ForestScenario.ChapterId != ch || ForestScenario.GatherCount(ForestMuseumState.Category.Flower) != flowers) Fail("왕복");
                string sj = ForestSaveState.ToJson();
                if (!sj.Contains("scenarioJson")) Fail("세이브 필드");
                ForestScenario.ResetForTest();
                ForestScenario.InTownForTest = false;
                ForestSaveState.ApplyJson(sj);
                if (ForestScenario.DoneCount != done || ForestScenario.StepIndex != step) Fail("ForestSaveState 왕복");
                parts.Add("세이브(왕복·채집 셈·ForestSaveState 필드)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
        }

        // ---- UI · 러너 ----------------------------------------------------------------------------------------

        private static void CheckUi(List<string> parts)
        {
            var ui = ForestScenarioUi.Instance;
            if (ui == null) { Fail("ui: 없음"); return; }
            Fresh();
            ui.Hide();
            ForestScenario.InTownForTest = true;
            ForestScenario.Check(); // 러너의 진짜 신호 → UI
            if (!ui.IsOpen || ui.SceneId != "move1") { Fail($"ui: 안 열림 {ui.IsOpen}/{ui.SceneId}"); return; }
            if (!ui.WhoText.Contains("숲지기 솔바람") || ui.BodyText != ForestScenarioData.SceneOf("move1").Lines[0].Ko) Fail("ui: 첫 줄 " + ui.WhoText);
            if (!ui.TitleText.Contains("이사 오던 날")) Fail("ui: 제목 " + ui.TitleText);
            ui.Next();
            if (ui.LineIndex != 1 || !ui.WhoText.Contains(ForestLocalization.T("fscen.you", "나"))) Fail("ui: 둘째 줄 " + ui.WhoText);
            ui.NextButton.onClick.Invoke();
            ui.Next();
            if (ui.IsOpen || !ForestScenario.HasSaid("move1")) Fail("ui: 닫힘");
            // 고르기 장면(마을 이름) — 마지막 줄 뒤 답 단추, 건너뛰어도 고르기 앞에서 멈춘다
            var scene = ForestScenarioData.SceneOf("mus2");
            ui.Play(new ForestScenario.SceneRequest { Scene = scene, Title = "t" });
            ui.Skip();
            if (!ui.IsOpen || !ui.Picking || !ui.PickButton(0).gameObject.activeSelf || !ui.PickButton(1).gameObject.activeSelf || ui.NextButton.gameObject.activeSelf) Fail("ui: 고르기 단추");
            ui.Next();
            if (!ui.IsOpen) Fail("ui: 고르기 중 다음이 닫음");
            ui.Pick(1);
            if (ui.IsOpen || ForestScenario.Choice("name") != "secret") Fail("ui: 고른 답 " + ForestScenario.Choice("name"));
            parts.Add("장면 상자(열림·글·다음·닫히면 본 장면·고르기 단추/건너뛰기 멈춤/고른 답)");
        }

        // ---- 곁가지 side_guest_* — 눌러앉은 손님 각자 사연 -------------------------------------------------------

        private static void CheckGuestStory(List<string> parts)
        {
            ForestVisitors.RestoreStories(null);
            ForestState.Restore(0);
            foreach (var v in ForestVisitors.List)
                if (!ForestVisitors.HasStory(v.Key) || ForestVisitors.Story(v.Key).Length < 40) Fail("사연이 없는 손님 " + v.Key);
            string line = ForestVisitors.TalkSettled("fox");
            if (line == null || !line.Contains("방울") || ForestState.FruitCount != ForestVisitors.StoryFruit || !ForestVisitors.StoryHeard("fox")) Fail($"첫 말에 사연 · 과일 +{ForestVisitors.StoryFruit} ({line} / {ForestState.FruitCount})");
            string again = ForestVisitors.TalkSettled("fox");
            if (again == null || again.Contains("방울") || ForestState.FruitCount > ForestVisitors.StoryFruit + 3) Fail("두 번째 말은 사연이 아니라 하루 선물이어야 " + again);
            string other = ForestVisitors.TalkSettled("sailor");
            if (other == null || !other.Contains("돛대")) Fail("다른 손님은 자기 사연 " + other);
            var snap = ForestVisitors.SnapshotStories();
            ForestVisitors.RestoreStories(null);
            if (ForestVisitors.StoryHeard("fox")) Fail("되돌리기");
            ForestVisitors.RestoreStories(snap);
            if (!ForestVisitors.StoryHeard("fox") || !ForestVisitors.StoryHeard("sailor") || ForestVisitors.StoryHeard("wisp")) Fail("사연 왕복");
            string sj = ForestSaveState.ToJson();
            if (!sj.Contains("visitStoryDone")) Fail("세이브 필드");
            ForestVisitors.RestoreStories(null);
            ForestSaveState.ApplyJson(sj);
            if (!ForestVisitors.StoryHeard("fox")) Fail("ForestSaveState 왕복");
            parts.Add("손님 사연(여덟 다 있음·눌러앉은 뒤 첫 말에 한 번 과일 +40·다음 말은 하루 선물·손님마다 제 사연·세이브 왕복)");
        }

        private static void CheckRunner(List<string> parts)
        {
            var runner = ForestScenarioRunner.Instance;
            if (runner == null) { Fail("runner: 없음"); return; }
            Fresh();
            ForestScenarioUi.Instance?.Hide();
            ForestScenario.InTownForTest = null;
            if (!ForestScenario.InTown()) Fail("runner: 마을에서 마을이 아님");
            if (ForestScenario.ZoneProvider == null) { Fail("runner: 구역 판정 없음"); return; }
            // 진짜 명소 — 다가서면 시나리오에 알린다(다가섰다 물러나야 다시)
            var lm = UnityEngine.Object.FindObjectsByType<ForestLandmark>(FindObjectsSortMode.None).FirstOrDefault();
            if (lm == null) { Fail("runner: 명소 없음"); return; }
            int z = lm.ZoneIndex;
            lm.Tick(ForestLandmark.ResetRadius + 5f);
            int before = ForestScenario.LandmarkCount(z);
            lm.Tick(1f);
            if (ForestScenario.LandmarkCount(z) != before + 1) Fail("runner: 명소 신호");
            lm.Tick(ForestLandmark.ResetRadius + 5f);
            parts.Add("러너(마을 판정·구역 판정 훅·명소 신호)");
        }
    }
}
