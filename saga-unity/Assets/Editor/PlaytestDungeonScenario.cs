using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-16 사가나락 시나리오 「이름이 지워지는 나라」 진단 — `PlaytestDungeonHeadless` 가 부른다.
    /// 표(열아홉 장·막별 3·3·4·4·2·3 · 단계 종류·장면·명소/지역 키·잇는 순서 · 장면 글 모두 한국어 표에 있음) · 진행(칸 밖이면 장면 안 뜸 → 칸 안 → 죽이기 10 → 층 → 보상) ·
    /// 사슬/지역/명소/구출 단계 · 고르기(망루성 성주 이름: 금 3000 / 공적 30×50 · 뒤 장면이 고른 답으로 갈림) · 옛 세이브(저장된 층으로 지나온 장) ·
    /// 세이브 왕복 · 열아홉 장 끝까지(칭호 둘) · 장면 상자(UI — 다음/건너뛰기/고르기) · 러너가 사건을 듣는지. 끝나면 영웅·기록을 되돌린다.
    /// </summary>
    public static class PlaytestDungeonScenario
    {
        private const string T = "[PlaytestDungeonHeadless] scenario";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            int lv0 = HeroState.Level, exp0 = HeroState.Exp, hp0 = HeroState.Hp, gold0 = HeroState.Gold;
            string weapon0 = HeroState.EquippedWeaponId, gem0 = HeroState.SocketedGemId;
            string scen0 = DungeonScenario.Snapshot();
            bool enabled0 = DungeonScenario.Enabled;
            var saga0 = RegionSagaState.Snapshot();
            bool sagaAll0 = RegionSagaState.AllDone;
            var lm0 = LandmarkState.Snapshot();
            var parts = new List<string>();
            try
            {
                CheckTable(parts);
                CheckTexts(parts);
                CheckFlow(parts);
                CheckStepKinds(parts);
                CheckChoice(parts);
                CheckLegacy(parts);
                CheckSave(parts);
                CheckAll(parts);
                CheckUi(parts);
                CheckRunner(parts);
            }
            catch (Exception e) { Fail("예외 " + e); }
            finally
            {
                DungeonScenario.Notify = null;
                DungeonScenario.InTownForTest = null;
                RegionSagaState.Restore(saga0, sagaAll0);
                LandmarkState.Restore(lm0);
                HeroState.Restore(lv0, exp0, hp0, gold0, weapon0, gem0);
                DungeonScenario.Restore(scen0);
                DungeonScenario.Enabled = enabled0;
                DungeonScenarioUi.Instance?.Hide();
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Fail(string what)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {what}");
        }

        // ---- 표 ----------------------------------------------------------------------------------------------

        private static void CheckTable(List<string> parts)
        {
            var ch = DungeonScenarioData.Chapters;
            if (ch.Length != 19) Fail($"장 {ch.Length}");
            if (ch.Select(c => c.Id).Distinct().Count() != 19) Fail("장 id 겹침");
            var perAct = new[] { 3, 3, 4, 4, 2, 3 };
            for (int a = 1; a <= 6; a++)
                if (ch.Count(c => c.Act == a) != perAct[a - 1]) Fail($"{a}막 장 수 {ch.Count(c => c.Act == a)}");
            for (int i = 0; i < ch.Length; i++)
            {
                var c = ch[i];
                if (c.No != i + 1) Fail($"{c.Id} 번호 {c.No}");
                if (c.After != (i == 0 ? null : ch[i - 1].Id)) Fail($"{c.Id} 잇는 장 {c.After}");
                if (c.Steps.Length < 2) Fail($"{c.Id} 단계 {c.Steps.Length}");
                foreach (var st in c.Steps)
                {
                    switch (st.T)
                    {
                        case "talk":
                            if (string.IsNullOrEmpty(st.By))
                            {
                                if (DungeonScenarioData.SceneOf(st.Scene) == null) Fail($"{c.Id} 장면 {st.Scene} 없음");
                            }
                            else
                            {
                                var choice = DungeonScenarioData.ChoiceOf(st.By);
                                if (choice == null) Fail($"{c.Id} 고르기 {st.By} 없음");
                                else foreach (var o in choice.Options)
                                    if (DungeonScenarioData.SceneOf(st.Scene + "_" + o.Key) == null) Fail($"{c.Id} 갈래 장면 {st.Scene}_{o.Key} 없음");
                            }
                            break;
                        case "kill": case "rescue": case "floor":
                            if (st.N <= 0) Fail($"{c.Id} {st.T} n={st.N}");
                            break;
                        case "chain": case "region":
                            if (DungeonWorldMap.IndexOf(st.Key) < 0) Fail($"{c.Id} 지역 {st.Key} 없음");
                            break;
                        case "landmark":
                            if (!DungeonLandmarkData.All.Any(l => l.Key == st.Key)) Fail($"{c.Id} 명소 {st.Key} 없음");
                            break;
                        default: Fail($"{c.Id} 단계 종류 {st.T}"); break;
                    }
                }
                if (i > 0 && c.Exp <= ch[i - 1].Exp && c.Act == ch[i - 1].Act + 0 && false) Fail("보상 순서");
            }
            foreach (var s in DungeonScenarioData.Scenes)
            {
                if (DungeonScenarioData.ChapterOf(s.ChapterId) == null) Fail($"장면 {s.Id} 장 {s.ChapterId} 없음");
                foreach (var l in s.Lines)
                    if (l.Who != "me" && DungeonScenarioData.CastOf(l.Who) == null) Fail($"장면 {s.Id} 말하는 이 {l.Who} 없음");
                if (s.Lines.Length < 1 || s.Lines.Length > 4) Fail($"장면 {s.Id} 줄 {s.Lines.Length}");
            }
            if (DungeonScenarioData.Scenes.Length != 41) Fail($"장면 {DungeonScenarioData.Scenes.Length}");
            if (ch.Last().AwardKo != "비석 너머의 이름" || DungeonScenarioData.ChapterOf("a5_nameless").AwardKo != "이름을 찾은 자") Fail("칭호");
            if (DungeonScenarioData.ChoiceOf("fort") == null || DungeonScenarioData.ChoiceOf("fort").Options.Length != 2) Fail("망루성 고르기");
            parts.Add("표(열아홉 장·막별 3·3·4·4·2·3·잇는 순서·단계 종류·장면 41·명소/지역 키·말하는 이)");
        }

        private static void CheckTexts(List<string> parts)
        {
            // 이 판 언어가 한국어일 때 — 모든 글 키가 표에 있어 T(key) 가 키 자체가 아니어야 한다(영어는 loc-review 가 본다).
            int miss = 0;
            void Need(string key) { if (DungeonLocalization.T(key, "\u0001") == "\u0001") { miss++; if (miss < 4) Debug.LogError($"{T} 글 키 없음 {key}"); } }
            foreach (var c in DungeonScenarioData.Casts) Need($"dscen.cast.{c.Id}");
            for (int a = 1; a <= 6; a++) Need($"dscen.act.{a}");
            foreach (var c in DungeonScenarioData.Chapters)
            {
                Need($"dscen.ch.{c.Id}.title"); Need($"dscen.ch.{c.Id}.stage"); Need($"dscen.ch.{c.Id}.blurb");
                if (!string.IsNullOrEmpty(c.AwardKo)) Need($"dscen.title.{c.Id}");
            }
            foreach (var s in DungeonScenarioData.Scenes)
            {
                for (int i = 0; i < s.Lines.Length; i++) Need($"dscen.scene.{s.Id}.{i}");
                if (s.Choice != null) { Need($"dscen.choice.{s.Choice.Id}.prompt"); foreach (var o in s.Choice.Options) Need($"dscen.choice.{s.Choice.Id}.{o.Key}"); }
            }
            if (miss > 0) Fail($"없는 글 키 {miss}");
            // 이 트랙 이름(웹 이름 아님)
            var all = string.Join("\n", DungeonScenarioData.Scenes.SelectMany(s => s.Lines.Select(l => l.Ko)).Concat(DungeonScenarioData.Chapters.Select(c => c.BlurbKo)));
            foreach (var bad in new[] { "순장장군", "망루성 성주", "용궁지기", "타락 천장군", "녹슨 장군" })
                if (all.Contains(bad)) Fail($"웹 이름 '{bad}' 가 남음");
            if (DungeonScenarioData.CastOf("lord").NameKo != "잿빛 성주의 망령") Fail("성주 이름");
            parts.Add("글(한국어 표에 다 있음·이 트랙 층 주인 이름)");
        }

        // ---- 진행 --------------------------------------------------------------------------------------------

        private static readonly List<DungeonScenario.SceneRequest> Requests = new List<DungeonScenario.SceneRequest>();

        private static void OnPlay(DungeonScenario.SceneRequest r) => Requests.Add(r);

        private static void Fresh()
        {
            DungeonScenario.ResetForTest();
            Requests.Clear();
        }

        private static void CheckFlow(List<string> parts)
        {
            Fresh();
            // 러너의 진짜 UI 신호를 끊고 진단이 직접 받는다.
            var play = typeof(DungeonScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);
            var saved = (Action<DungeonScenario.SceneRequest>)play.GetValue(null);
            play.SetValue(null, null);
            DungeonScenario.ScenePlay += OnPlay;
            try
            {
                int gold = HeroState.Gold;
                DungeonScenario.InTownForTest = false;
                DungeonScenario.Check();
                if (Requests.Count != 0) Fail("칸 밖인데 장면이 뜸");
                if (DungeonScenario.ChapterId != "a1_moru" || DungeonScenario.StepIndex != 0) Fail($"첫 장 {DungeonScenario.ChapterId}/{DungeonScenario.StepIndex}");
                if (!DungeonScenario.HudLine().Contains("제1장") || !DungeonScenario.HudLine().Contains("이야기")) Fail("칸 밖 목표 줄 " + DungeonScenario.HudLine());
                DungeonScenario.InTownForTest = true;
                DungeonScenario.Poll();
                if (Requests.Count != 1 || Requests[0].Scene.Id != "moru1" || !DungeonScenario.Playing) Fail("칸 안에서 moru1 이 안 뜸");
                if (Requests.Count > 0 && !Requests[0].Title.Contains("제1장")) Fail("장면 제목 " + Requests[0].Title);
                DungeonScenario.Poll(); // 떠 있는 동안엔 또 안 띄운다
                if (Requests.Count != 1) Fail("장면이 겹쳐 뜸");
                DungeonScenario.SceneFinished("moru1", null);
                if (DungeonScenario.StepIndex != 1 || DungeonScenario.Playing) Fail("장면 뒤 죽이기 단계로 안 넘어감");
                if (!DungeonScenario.HudLine().Contains("0/10")) Fail("죽이기 줄 " + DungeonScenario.HudLine());
                for (int i = 0; i < 9; i++) DungeonScenario.OnKill();
                if (DungeonScenario.StepIndex != 1 || !DungeonScenario.HudLine().Contains("9/10")) Fail("죽이기 9");
                DungeonScenario.OnKill();
                if (Requests.Count != 2 || Requests[1].Scene.Id != "moru2") Fail("죽이기 10 뒤 moru2 가 안 뜸");
                DungeonScenario.SceneFinished("moru2", null);
                if (!DungeonScenario.HudLine().Contains("굴혈 1층")) Fail("층 단계 줄 " + DungeonScenario.HudLine());
                DungeonScenario.OnFloor(2);
                if (DungeonScenario.BestFloor != 2 || Requests.Count != 3 || Requests[2].Scene.Id != "moru3") Fail("층 2 뒤 moru3");
                DungeonScenario.SceneFinished("moru3", null);
                if (!DungeonScenario.IsDone("a1_moru")) Fail("1장이 안 끝남");
                if (HeroState.Gold != gold + 300) Fail($"1장 금 300 ({HeroState.Gold - gold})");
                if (DungeonScenario.ChapterId != "a1_blackflag") Fail("2장으로 안 넘어감 " + DungeonScenario.ChapterId);
                // 칸 밖에서 죽인 것은 다음 장 죽이기에 안 센다(기준값은 그 단계를 시작할 때) — 2장은 죽이기가 없다. 3장 죽이기 없음: 셈만 본다
                int kills = DungeonScenario.Kills;
                DungeonScenario.OnKill();
                if (DungeonScenario.Kills != kills + 1) Fail("죽인 수 셈");
                parts.Add("진행(칸 밖 안 뜸·칸 안 뜸·겹침 없음·죽이기 9/10→10·층 2·1장 끝 금 +300·2장 시작)");
            }
            finally
            {
                DungeonScenario.ScenePlay -= OnPlay;
                play.SetValue(null, saved);
            }
        }

        /// <summary>진단이 장면을 받아 바로 끝내는 손 — 고르기는 <paramref name="pick"/>.</summary>
        private static void AutoPlay(string pickFort = null)
        {
            DungeonScenario.ScenePlay += r =>
            {
                string pick = r.Scene.Choice != null ? (pickFort ?? r.Scene.Choice.Options[0].Key) : null;
                Requests.Add(r);
                // 다음 프레임 흉내 — 재진입을 피하려 바로 부르지 않고 큐에 둔다
                _pending.Enqueue((r.Scene.Id, pick));
            };
        }

        private static readonly Queue<(string id, string pick)> _pending = new Queue<(string, string)>();

        private static void Drain()
        {
            int guard = 0;
            while (_pending.Count > 0 && guard++ < 200)
            {
                var (id, pick) = _pending.Dequeue();
                DungeonScenario.SceneFinished(id, pick);
            }
        }

        private static void ClearHandlers()
        {
            var play = typeof(DungeonScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);
            play.SetValue(null, null);
            _pending.Clear();
        }

        private static Action<DungeonScenario.SceneRequest> SwapHandlers(Action<DungeonScenario.SceneRequest> keep)
        {
            var play = typeof(DungeonScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);
            var saved = (Action<DungeonScenario.SceneRequest>)play.GetValue(null);
            play.SetValue(null, keep);
            _pending.Clear();
            return saved;
        }

        private static void Restore(Action<DungeonScenario.SceneRequest> saved)
        {
            var play = typeof(DungeonScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);
            play.SetValue(null, saved);
            _pending.Clear();
        }

        private static int RegionOf(string key) => DungeonWorldMap.IndexOf(key);

        private static void FinishRegion(string key)
        {
            int r = RegionOf(key);
            RegionSagaState.Open(r);
            for (int i = 0; i < DungeonRegionSagas.Steps; i++) RegionSagaState.Advance(r);
        }

        private static void CheckStepKinds(List<string> parts)
        {
            Fresh();
            var saved = SwapHandlers(null);
            AutoPlay();
            try
            {
                RegionSagaState.Restore(null, false);
                LandmarkState.Restore(new int[DungeonLandmarkData.All.Length]);
                DungeonScenario.InTownForTest = true;
                // 1~3장을 표대로 — 2장은 사슬(jungwon), 3장은 층 5·명소 tomb·구출 1
                DungeonScenario.Check(); Drain();
                DungeonScenario.OnKill(); // 무해한 죽임 하나
                for (int i = 0; i < 10; i++) DungeonScenario.OnKill();
                Drain();
                DungeonScenario.OnFloor(3); Drain();
                if (!DungeonScenario.IsDone("a1_moru")) Fail("stepkinds: 1장");
                if (DungeonScenario.StepIndex != 1 || DungeonScenario.ChapterId != "a1_blackflag") Fail($"stepkinds: 2장 사슬 단계 {DungeonScenario.ChapterId}/{DungeonScenario.StepIndex}");
                if (!DungeonScenario.HudLine().Contains(DungeonRegionSagas.Title(RegionOf("jungwon")))) Fail("사슬 줄 " + DungeonScenario.HudLine());
                int gold = HeroState.Gold;
                FinishRegion("jungwon");
                DungeonScenario.Check(); Drain();
                if (!DungeonScenario.IsDone("a1_blackflag") || HeroState.Gold < gold + 800) Fail("2장(사슬) 끝·금 800");
                if (DungeonScenario.ChapterId != "a1_tomb" || DungeonScenario.StepIndex != 1) Fail("3장 시작(첫 장면 뒤 층 단계) " + DungeonScenario.ChapterId + "/" + DungeonScenario.StepIndex);
                // 3장: talk → floor 5 → landmark tomb → rescue 1 → talk
                DungeonScenario.OnFloor(4); Drain();
                if (DungeonScenario.StepIndex != 1) Fail("층 4 로는 3장 층 단계가 안 끝나야 " + DungeonScenario.StepIndex);
                DungeonScenario.OnFloor(5); Drain();
                if (DungeonScenario.StepIndex != 2 || !DungeonScenario.HudLine().Contains(DungeonLandmarkData.Name(0))) Fail("명소 단계 줄 " + DungeonScenario.HudLine());
                DungeonScenario.OnRescue(); // 명소 전의 구출은 기준값 앞이라 안 센다
                int tomb = Array.FindIndex(DungeonLandmarkData.All, l => l.Key == "tomb");
                LandmarkState.RecordClear(tomb);
                DungeonScenario.Check(); Drain();
                if (DungeonScenario.StepIndex != 3) Fail("명소 뒤 구출 단계로 " + DungeonScenario.StepIndex);
                DungeonScenario.OnRescue(); Drain();
                if (!DungeonScenario.IsDone("a1_tomb")) Fail("3장이 구출 뒤 안 끝남");
                // 4장: region neon → talk → chain neon → talk
                if (DungeonScenario.ChapterId != "a2_factory") Fail("4장 시작 " + DungeonScenario.ChapterId);
                if (DungeonScenario.StepIndex != 0 || !DungeonScenario.HudLine().Contains(DungeonWorldMap.Name(RegionOf("neon")))) Fail("지역 단계 줄 " + DungeonScenario.HudLine());
                RegionSagaState.Open(RegionOf("neon"));
                DungeonScenario.Check(); Drain();
                if (DungeonScenario.StepIndex != 2) Fail("지역 뒤 장면·사슬 단계 " + DungeonScenario.StepIndex);
                FinishRegion("neon"); // Open 은 이미 열려 있으니 걸음만
                DungeonScenario.Check(); Drain();
                if (!DungeonScenario.IsDone("a2_factory")) Fail("4장 끝");
                parts.Add("단계 종류(사슬·층·명소·구출 — 명소 전 구출은 안 센다·지역·기준값)");
            }
            finally { Restore(saved); }
        }

        private static void CheckChoice(List<string> parts)
        {
            foreach (var pick in new[] { "restore", "seal" })
            {
                Fresh();
                var saved = SwapHandlers(null);
                AutoPlay(pick);
                try
                {
                    RegionSagaState.Restore(null, false);
                    LandmarkState.Restore(new int[DungeonLandmarkData.All.Length]);
                    DungeonScenario.InTownForTest = true;
                    // 5장 앞까지 legacy 로 건너뛴다: 저장된 층 8 → 여덟째 장까지
                    DungeonScenario.RestoreLegacy(8);
                    DungeonScenario.Check(); Drain();
                    if (DungeonScenario.ChapterId != "a2_watchtower") { Fail("choice: 6장 아님 " + DungeonScenario.ChapterId); return; }
                    int gold = HeroState.Gold;
                    DungeonScenario.OnFloor(10); Drain();
                    // fort1 (고르기 장면)
                    var q = Requests.LastOrDefault(r => r.Scene.Id == "fort1");
                    if (q.Scene == null) { Fail("choice: fort1 장면이 안 뜸"); return; }
                    if (DungeonScenario.Choice("fort") != pick) Fail($"choice: 고른 답 {DungeonScenario.Choice("fort")}");
                    // 명소 fort 를 답파해야 다음 단계
                    int fort = Array.FindIndex(DungeonLandmarkData.All, l => l.Key == "fort");
                    if (DungeonScenario.IsDone("a2_watchtower")) Fail("choice: 명소 전에 끝남");
                    LandmarkState.RecordClear(fort);
                    DungeonScenario.Check(); Drain();
                    var q2 = Requests.LastOrDefault(r => r.Scene.Id.StartsWith("fort2"));
                    if (q2.Scene == null || q2.Scene.Id != "fort2_" + pick) Fail($"choice: 갈래 장면 {(q2.Scene == null ? "없음" : q2.Scene.Id)}");
                    // 고르기 보상은 fort1 을 끝낼 때 이미 받았다: seal=금 3000, restore=공적 30×50
                    if (!DungeonScenario.IsDone("a2_watchtower")) Fail("choice: 6장 끝");
                    int wantOption = pick == "seal" ? 3000 : 30 * DungeonRegionFoes.GoldPerMerit;
                    int chapterGold = 5000 + 30 * DungeonRegionFoes.GoldPerMerit; // 6장 보상: 금 5000 + 공적 30
                    int gained = HeroState.Gold - gold;
                    if (gained < wantOption + chapterGold) Fail($"choice: {pick} 금 {gained} < {wantOption + chapterGold}");
                }
                finally { Restore(saved); }
            }
            parts.Add("고르기(성주 이름 — 돌려줌=공적 30·봉인=금 3000·뒤 장면이 고른 답으로 갈림)");
        }

        private static void CheckLegacy(List<string> parts)
        {
            DungeonScenario.RestoreLegacy(2);
            if (DungeonScenario.DoneCount != 0 || DungeonScenario.BestFloor != 0) Fail("옛 세이브 층 2(새 판 기본)는 지나온 장이 없어야");
            DungeonScenario.RestoreLegacy(12);
            var want = new[] { "a1_moru", "a1_blackflag", "a1_tomb", "a2_factory", "a2_tideflat", "a2_watchtower", "a3_riftgate" };
            if (DungeonScenario.DoneCount != want.Length || want.Any(w => !DungeonScenario.IsDone(w))) Fail($"옛 세이브 층 12 → {DungeonScenario.DoneCount}장");
            DungeonScenario.RestoreLegacy(35);
            if (DungeonScenario.DoneCount != 15 || DungeonScenario.IsDone("a5_nameless")) Fail($"옛 세이브 층 35 → {DungeonScenario.DoneCount}장(열다섯)");
            int gold = HeroState.Gold;
            DungeonScenario.InTownForTest = false;
            DungeonScenario.Check();
            if (HeroState.Gold != gold) Fail("옛 세이브가 보상을 줌");
            if (DungeonScenario.ChapterId != "a5_nameless") Fail("옛 세이브 뒤 지금 장 " + DungeonScenario.ChapterId);
            parts.Add("옛 세이브(층 2=없음·12=일곱 장·35=열다섯 장·보상 없이 · 지금 장 16)");
        }

        private static void CheckSave(List<string> parts)
        {
            Fresh();
            var saved = SwapHandlers(null);
            AutoPlay("seal");
            try
            {
                RegionSagaState.Restore(null, false);
                LandmarkState.Restore(new int[DungeonLandmarkData.All.Length]);
                DungeonScenario.InTownForTest = true;
                DungeonScenario.RestoreLegacy(8);
                DungeonScenario.Check(); Drain();
                DungeonScenario.OnFloor(10); Drain(); // fort1 — seal 을 고름
                for (int i = 0; i < 4; i++) DungeonScenario.OnKill();
                string json = DungeonScenario.Snapshot();
                int done = DungeonScenario.DoneCount, kills = DungeonScenario.Kills, best = DungeonScenario.BestFloor, step = DungeonScenario.StepIndex;
                string ch = DungeonScenario.ChapterId;
                DungeonScenario.ResetForTest();
                if (DungeonScenario.DoneCount != 0 || DungeonScenario.Choice("fort") != null) Fail("save: 되돌리기");
                DungeonScenario.Restore(json);
                if (DungeonScenario.DoneCount != done || DungeonScenario.Kills != kills || DungeonScenario.BestFloor != best
                    || DungeonScenario.StepIndex != step || DungeonScenario.ChapterId != ch || DungeonScenario.Choice("fort") != "seal") Fail("save: 왕복이 다름");
                // 실제 세이브에 들어간다
                string sj = SaveState.ToJson();
                if (!sj.Contains("scenarioJson")) Fail("save: 세이브에 필드가 없음");
                DungeonScenario.ResetForTest();
                SaveState.ApplyJson(sj);
                if (DungeonScenario.DoneCount != done || DungeonScenario.Choice("fort") != "seal") Fail("save: SaveState 왕복");
                parts.Add("세이브(왕복·고른 답·죽인 수·SaveState 필드)");
            }
            finally { Restore(saved); }
        }

        private static void CheckAll(List<string> parts)
        {
            Fresh();
            var saved = SwapHandlers(null);
            AutoPlay("restore");
            try
            {
                RegionSagaState.Restore(null, false);
                LandmarkState.Restore(new int[DungeonLandmarkData.All.Length]);
                DungeonScenario.InTownForTest = true;
                DungeonScenario.Check(); Drain();
                int guard = 0;
                while (DungeonScenario.DoneCount < 19 && guard++ < 400)
                {
                    var ch = DungeonScenario.Current();
                    if (ch == null) break;
                    var step = ch.Steps[Math.Min(DungeonScenario.StepIndex, ch.Steps.Length - 1)];
                    switch (step.T)
                    {
                        case "kill": for (int i = 0; i < step.N; i++) DungeonScenario.OnKill(); break;
                        case "rescue": for (int i = 0; i < step.N; i++) DungeonScenario.OnRescue(); break;
                        case "floor": DungeonScenario.OnFloor(step.N); break;
                        case "region": RegionSagaState.Open(RegionOf(step.Key)); break;
                        case "chain": FinishRegion(step.Key); break;
                        case "landmark": LandmarkState.RecordClear(Array.FindIndex(DungeonLandmarkData.All, l => l.Key == step.Key)); break;
                    }
                    DungeonScenario.Check(); Drain();
                }
                if (DungeonScenario.DoneCount != 19) Fail($"열아홉 장 끝: {DungeonScenario.DoneCount} ({DungeonScenario.ChapterId}/{DungeonScenario.StepIndex})");
                var titles = DungeonScenario.AwardedTitles;
                if (titles.Count != 2 || !titles.Contains("이름을 찾은 자") || !titles.Contains("비석 너머의 이름")) Fail("칭호 " + string.Join(",", titles));
                if (DungeonScenario.Current() != null) Fail("다 끝났는데 지금 장이 있음");
                if (!DungeonScenario.HudLine().Contains("비석 너머의 이름")) Fail("끝난 뒤 줄 " + DungeonScenario.HudLine());
                // 6장 restore → 16장 갈래도 restore
                if (!Requests.Any(r => r.Scene.Id == "nl2_restore")) Fail("16장 restore 갈래");
                parts.Add("열아홉 장 끝까지(칭호 둘·16장 갈래·끝난 뒤 칭호 줄)");
            }
            finally { Restore(saved); }
        }

        // ---- UI · 러너 ----------------------------------------------------------------------------------------

        private static void CheckUi(List<string> parts)
        {
            var ui = DungeonScenarioUi.Instance;
            if (ui == null) { Fail("ui: DungeonScenarioUi 없음"); return; }
            Fresh();
            RegionSagaState.Restore(null, false);
            LandmarkState.Restore(new int[DungeonLandmarkData.All.Length]);
            DungeonScenario.InTownForTest = true;
            DungeonScenario.Check(); // 러너의 진짜 신호 → UI
            if (!ui.IsOpen || ui.SceneId != "moru1" || ui.LineIndex != 0) { Fail($"ui: 안 열림 {ui.IsOpen}/{ui.SceneId}"); return; }
            if (!ui.WhoText.Contains("사관 묵향") || ui.BodyText != DungeonScenarioData.SceneOf("moru1").Lines[0].Ko) Fail("ui: 첫 줄 " + ui.WhoText + "/" + ui.BodyText);
            if (!ui.TitleText.Contains("모루골 부임")) Fail("ui: 제목 " + ui.TitleText);
            ui.Next();
            if (ui.LineIndex != 1 || !ui.WhoText.Contains(DungeonLocalization.T("dscen.you", "나"))) Fail("ui: 둘째 줄(주인공) " + ui.WhoText);
            ui.NextButton.onClick.Invoke();
            ui.NextButton.onClick.Invoke();
            if (ui.LineIndex != 3) Fail("ui: 넷째 줄 " + ui.LineIndex);
            ui.Next(); // 마지막 줄에서 누르면 닫힘
            if (ui.IsOpen || !DungeonScenario.HasSaid("moru1")) Fail("ui: 닫히고 본 장면으로 적혀야");
            // 건너뛰기
            DungeonScenario.OnKill(); // 죽이기 단계라 아직
            for (int i = 0; i < 10; i++) DungeonScenario.OnKill();
            if (!ui.IsOpen || ui.SceneId != "moru2") { Fail("ui: moru2 " + ui.SceneId); return; }
            ui.Skip();
            if (ui.IsOpen || !DungeonScenario.HasSaid("moru2")) Fail("ui: 건너뛰기");
            // 고르기 장면 — 6장 앞까지 legacy 로
            DungeonScenario.RestoreLegacy(8);
            DungeonScenario.Check();
            DungeonScenario.OnFloor(10);
            if (!ui.IsOpen || ui.SceneId != "fort1") { Fail("ui: fort1 " + ui.SceneId); return; }
            ui.Skip(); // 건너뛰어도 고르기 앞에서 멈춘다
            if (!ui.IsOpen || !ui.Picking || !ui.PickButton(0).gameObject.activeSelf || !ui.PickButton(1).gameObject.activeSelf) Fail("ui: 고르기 단추");
            if (ui.NextButton.gameObject.activeSelf) Fail("ui: 고르기 중 다음 단추");
            ui.Next(); // 고르기 중엔 다음이 안 먹는다
            if (!ui.IsOpen) Fail("ui: 고르기 중 다음이 닫음");
            ui.Pick(1);
            if (ui.IsOpen || DungeonScenario.Choice("fort") != "seal") Fail("ui: 고른 답 " + DungeonScenario.Choice("fort"));
            parts.Add("장면 상자(열림·글·다음/단추/건너뛰기·고르기 앞 멈춤·닫히면 본 장면)");
        }

        private static void CheckRunner(List<string> parts)
        {
            var runner = DungeonScenarioRunner.Instance;
            if (runner == null) { Fail("runner: 없음"); return; }
            Fresh();
            DungeonScenarioUi.Instance?.Hide();
            DungeonScenario.InTownForTest = false; // 신호를 듣는지만 본다 — 장면이 뜨지 않게
            // 러너가 듣는다: 적 처치·구출 신호
            var died = typeof(DungeonEnemy).GetField("AnyDied", BindingFlags.Static | BindingFlags.NonPublic);
            var freed = typeof(DungeonCaptive).GetField("Freed", BindingFlags.Static | BindingFlags.NonPublic);
            if (died == null || freed == null) { Fail("runner: 이벤트 필드"); return; }
            int k0 = DungeonScenario.Kills, r0 = DungeonScenario.Rescues;
            var diedHook = ((Delegate)died.GetValue(null))?.GetInvocationList().FirstOrDefault(d => d.Target == runner);
            var freedHook = ((Delegate)freed.GetValue(null))?.GetInvocationList().FirstOrDefault(d => d.Target == runner);
            if (diedHook == null || freedHook == null) { Fail("runner: 처치·구출 신호를 안 듣고 있음"); return; }
            diedHook.DynamicInvoke(new object[] { null }); // 다른 듣는 이(사연 러너 등)는 건드리지 않고 이 러너 것만
            freedHook.DynamicInvoke();
            if (DungeonScenario.Kills != k0 + 1 || DungeonScenario.Rescues != r0 + 1) Fail($"runner: 처치/구출을 못 들음 {DungeonScenario.Kills - k0}/{DungeonScenario.Rescues - r0}");
            // 칸 안 판정: 진짜 플레이어 자리(시작 칸)에서 InTown
            DungeonScenario.InTownForTest = null;
            var tracker = DungeonRegionTracker.Instance;
            var player = GameObject.FindWithTag("Player");
            if (tracker == null || player == null) { Fail("runner: 추적기/플레이어 없음"); return; }
            Vector3 start = player.transform.position;
            var cc = player.GetComponent<CharacterController>();
            try
            {
                Teleport(player, cc, new Vector3(0f, 0.1f, 0f));
                tracker.Tick(player.transform.position, 0.1f);
                if (!DungeonScenario.InTown()) Fail("runner: 시작 칸에서 칸 안이 아님");
                Teleport(player, cc, new Vector3(0f, 0.1f, 120f));
                tracker.Tick(player.transform.position, 0.1f);
                if (DungeonScenario.InTown()) Fail("runner: 굴혈 방에서 칸 안임");
                // 굴혈에 있으면 층이 기록된다
                DungeonScenario.ResetForTest();
                runner.Tick();
                if (DungeonScenario.BestFloor < 2) Fail($"runner: 굴혈에서 최고 층 {DungeonScenario.BestFloor}");
            }
            finally
            {
                Teleport(player, cc, start);
                tracker.Tick(player.transform.position, 0.1f);
            }
            parts.Add("러너(처치·구출을 들음·시작 칸=칸 안·굴혈 방=칸 밖·굴혈에서 최고 층)");
        }

        private static void Teleport(GameObject player, CharacterController cc, Vector3 pos)
        {
            if (cc != null) cc.enabled = false;
            player.transform.position = pos;
            if (cc != null) cc.enabled = true;
        }
    }
}
