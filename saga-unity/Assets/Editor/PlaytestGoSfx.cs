using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using Saga.Go.Audio;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0048 효과음 연결 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoSfx.RunBatch`, 장면 없이): `SagaSfx` 규칙(로더를 가짜로 바꿔 — 단일·변형 둘·셋 돌려 가기·없는 이름 null·기록·캐시) ·
    ///    `GoSfx.Used` 의 이름이 정본 `saga-assets/sfx/` 파일 목록에 **실제로 있다** · 최소 간격.
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 신수 알 진단 뒤에 부른다, 장면 안): 진짜 사건에서 이름을 불렀는지(`SagaSfx.History`) —
    ///    단추 클릭 `ui_click`·창 열기 `ui_open`·닫기 `ui_close`·레벨업 `levelup`·진짜 타격 `sword_hit`·진짜 피격 `sword_hurt`·상자 열기 `gacha`/`item_pick`·신수 부화 `summon`.
    ///    소리 파일이 아직 유니티에 없어도(K-0076) 기록은 남는다. 낚시 입질·회피·우두머리는 장면에서 만들기 무거워 소스에 그 호출이 있는지만 본다.
    /// </summary>
    public static class PlaytestGoSfx
    {
        private static string _tag;
        private static bool _ok;

        [MenuItem("Saga/Playtest Go Sfx")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoSfx]");
            var loader = SagaSfx.Loader;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckRules();
                    CheckNamesExist();
                    CheckGap();
                    CheckSourceHooks();
                }
                finally { SagaSfx.Loader = loader; SagaSfx.ResetForTest(); GoSfx.ResetForTest(); }
            }
            PlaytestKit.Summary("PlaytestGoSfx");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void CheckRules()
        {
            var made = new Dictionary<string, AudioClip>();
            AudioClip Fake(string k) { if (!made.TryGetValue(k, out var c)) made[k] = c = AudioClip.Create(k, 1, 1, 44100, false); return c; }
            var have = new HashSet<string> { "sfx_ui_click", "sfx_sword_hit_1", "sfx_sword_hit_2", "sfx_gacha_1", "sfx_gacha_2", "sfx_gacha_3" };
            SagaSfx.Loader = k => have.Contains(k) ? Fake(k) : null;
            SagaSfx.ResetForTest();
            PlaytestKit.Check(SagaSfx.Has("ui_click") && SagaSfx.Variants("ui_click").Length == 1, "단일 파일을 못 찾음");
            PlaytestKit.Check(SagaSfx.Variants("sword_hit").Length == 2 && SagaSfx.Variants("gacha").Length == 3, "변형 개수가 다름");
            PlaytestKit.Check(!SagaSfx.Has("nope") && SagaSfx.Pick("nope") == null, "없는 이름이 클립을 줌");
            PlaytestKit.Check(SagaSfx.LastPlayed == "nope", "없는 이름도 기록은 남아야 함(진단용)");
            var a = SagaSfx.Pick("sword_hit"); var b = SagaSfx.Pick("sword_hit"); var c3 = SagaSfx.Pick("sword_hit");
            PlaytestKit.Check(a != b && a == c3, "변형 둘이 번갈아 안 나옴");
            var g = Enumerable.Range(0, 6).Select(_ => SagaSfx.Pick("gacha")).ToArray();
            PlaytestKit.Check(g[0] == g[3] && g[1] == g[4] && g[2] == g[5] && g[0] != g[1] && g[1] != g[2], "변형 셋 돌려 가기가 다름");
            PlaytestKit.Check(SagaSfx.Pick("ui_click") == SagaSfx.Pick("ui_click"), "단일 파일이 매번 같아야 함");
            PlaytestKit.Check(SagaSfx.History.Count >= 10 && SagaSfx.History.Last() == "ui_click", "기록이 안 쌓임");
            for (int i = 0; i < SagaSfx.HistoryMax + 20; i++) SagaSfx.Note("x");
            PlaytestKit.Check(SagaSfx.History.Count == SagaSfx.HistoryMax, "기록 상한이 안 지켜짐");
            // 캐시 — 로더가 바뀌어도 ResetForTest 전에는 같은 결과
            SagaSfx.Loader = k => null;
            PlaytestKit.Check(SagaSfx.Has("ui_click"), "캐시가 안 쓰임");
            SagaSfx.ResetForTest();
            PlaytestKit.Check(!SagaSfx.Has("ui_click") && SagaSfx.History.Count == 0, "초기화가 캐시·기록을 안 지움");
        }

        private static string SfxDir()
        {
            // 에디터 작업 폴더 = saga-unity — 정본은 한 칸 위 saga-assets/sfx
            foreach (var d in new[] { "../saga-assets/sfx", "saga-assets/sfx", "../../saga-assets/sfx" })
                if (Directory.Exists(d)) return d;
            return null;
        }

        private static void CheckNamesExist()
        {
            string dir = SfxDir();
            if (dir == null) { PlaytestKit.Fail("정본 saga-assets/sfx 폴더를 못 찾음"); return; }
            var files = new HashSet<string>(Directory.GetFiles(dir, "sfx_*.ogg").Select(Path.GetFileNameWithoutExtension));
            PlaytestKit.Check(files.Count >= 90, $"정본 효과음 {files.Count} < 90");
            foreach (var n in GoSfx.Used)
                PlaytestKit.Check(files.Contains("sfx_" + n) || files.Contains("sfx_" + n + "_1"), $"코드가 부르는 이름 '{n}' 이 정본 파일에 없음");
            PlaytestKit.Check(GoSfx.Used.Distinct().Count() == GoSfx.Used.Length, "Used 에 겹친 이름");
        }

        private static void CheckGap()
        {
            SagaSfx.Loader = k => null; SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            GoSfx.Play("sword_hit", 1f, 5f); GoSfx.Play("sword_hit", 1f, 5f); GoSfx.Play("sword_hit", 1f, 5f);
            PlaytestKit.Check(SagaSfx.History.Count(h => h == "sword_hit") == 1, "최소 간격 안의 재호출이 안 걸러짐");
            GoSfx.Play("ui_click"); GoSfx.Play("ui_click");
            PlaytestKit.Check(SagaSfx.History.Count(h => h == "ui_click") == 2, "간격 0 은 모두 불려야 함");
        }

        private static void CheckSourceHooks()
        {
            // 장면에서 만들기 무거운 사건 — 소스에 그 호출이 있는지(깨지면 알림)
            string root = Directory.Exists("Assets/Games/SagaGo") ? "Assets/Games/SagaGo/" : null;
            if (root == null) { PlaytestKit.Fail("Assets/Games/SagaGo 를 못 찾음"); return; }
            void Has(string file, string needle) => PlaytestKit.Check(File.ReadAllText(root + file).Contains(needle), $"{file} 에 {needle} 호출이 없음");
            Has("Data/FishingFlow.cs", "GoSfx.Play(\"fish_bite\")");
            Has("Combat/FieldCombat.cs", "GoSfx.Play(\"whoosh\")");
            Has("Combat/FieldEnemy.cs", "GoSfx.Play(\"victory\")");
            Has("UI/GoSessionTracker.cs", "GoSfx.Play(\"quest_done\")");
            Has("Data/GoCooking.cs", "GoSfx.Play(\"item_pick\")");
            Has("UI/EncounterUiKit.cs", "GoSfx.Play(\"ui_click\")");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var fc = FieldCombat.Instance; var walker = EggWalker.Instance; var help = HelpUi.Instance;
            if (fc == null || walker == null || help == null) { Fail("FieldCombat/EggWalker/HelpUi 없음"); return false; }
            var loader = SagaSfx.Loader;
            int gold = GoldState.Gold; var mats = TalentState.SnapshotMats(); var talent = TalentState.Snapshot();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq, polish = ArtifactState.Polish;
            int ore = WeaponState.Ore; var winv = WeaponState.SnapshotInv(); var weq = WeaponState.SnapshotEquip();
            int lv = PlayerStats.Level; long exp = PlayerStats.Exp; bool lowered = AdventureState.Lowered; int paid = AdventureState.Paid;
            var events = new List<string>(WorldEventState.TriggeredIds);
            var eggs = (EggState.SnapshotBag(), EggState.SnapshotInc(), EggState.Hatched, EggState.WalkTotal, EggState.Buddy, EggState.SnapshotBuddyM(), EggState.SnapshotFriend(), EggState.SnapshotOwned());
            var parts = new List<string>();
            try
            {
                SagaSfx.Loader = k => null; // 소리 파일이 있든 없든 기록은 남는다
                SagaSfx.ResetForTest(); GoSfx.ResetForTest();
                CheckClicks(help, parts);
                CheckCombat(fc, parts);
                CheckChest(events, parts);
                CheckLevelUp(parts);
                CheckHatch(walker, parts);
            }
            finally
            {
                help.Close();
                SagaSfx.Loader = loader; SagaSfx.ResetForTest(); GoSfx.ResetForTest();
                fc.ResetForTest(); foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
                WorldEventState.Restore(events);
                GoldState.Restore(gold); TalentState.Restore(talent, mats); ArtifactState.Restore(arts, seq, polish);
                WeaponState.Restore(winv, weq, ore); PlayerStats.Restore(lv, exp); AdventureState.RestoreSave(lowered, paid);
                EggState.Restore(eggs.Item1, eggs.Item2, eggs.Item3, eggs.Item4, eggs.Item5, eggs.Item6, eggs.Item7, eggs.Item8);
            }
            if (_ok) Debug.Log($"[{_tag}] sfx OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Expect(string name, string what)
        {
            if (!SagaSfx.History.Contains(name)) Fail($"{what} 에서 '{name}' 효과음을 안 부름(기록 {string.Join(",", SagaSfx.History)})");
        }

        private static void CheckClicks(HelpUi help, List<string> parts)
        {
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            help.Close();
            help.OpenButton.onClick.Invoke(); // 단추 클릭 + 창 열기
            Expect("ui_click", "단추 클릭"); Expect("ui_open", "창 열기");
            help.CloseButton.onClick.Invoke();
            Expect("ui_close", "창 닫기");
            parts.Add("단추 클릭 ui_click·창 열기/닫기 ui_open/ui_close");
        }

        private static void CheckCombat(FieldCombat fc, List<string> parts)
        {
            var e = FieldEnemy.All.FirstOrDefault(x => x.Alive && !x.IsGuardian && !x.IsHero);
            if (e == null) { Fail("들판 적이 없음"); return; }
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            e.TakeHit(1f, GoElement.Physical, 1f, out _);
            Expect(GoSfx.HitName(GoWeaponModels.TypeFor(fc.Active.Id)), "진짜 타격(FieldEnemy.TakeHit, 활성 인물 무기 — U-0051)");
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            bool took = fc.ReceiveStrike(1f, null);
            if (took) Expect("sword_hurt", "진짜 피격(FieldCombat.ReceiveStrike)");
            else Fail("피격이 안 받아짐(회피 중?)");
            parts.Add("진짜 타격 sword_hit·진짜 피격 sword_hurt");
        }

        private static void CheckChest(List<string> events, List<string> parts)
        {
            var open = typeof(TreasureChest).GetMethod("Open", BindingFlags.Instance | BindingFlags.NonPublic);
            foreach (var (id, want) in new[] { ("south_glade", "item_pick"), ("target_ledge", "gacha") })
            {
                var chest = Object.FindObjectsByType<TreasureChest>(FindObjectsSortMode.None).FirstOrDefault(c => c.Data.Id == id);
                if (chest == null) { Fail($"씬에 상자 {id} 없음"); continue; }
                WorldEventState.Restore(events.Where(x => x != GoTreasure.EventKey(chest.Data)));
                SagaSfx.ResetForTest(); GoSfx.ResetForTest();
                if (!(bool)open.Invoke(chest, null)) { Fail($"상자 {id} 이 안 열림"); continue; }
                Expect(want, $"상자 {id} 열기");
            }
            parts.Add("진짜 상자 Open(): 평범 item_pick·귀한 gacha");
        }

        private static void CheckLevelUp(List<string> parts)
        {
            PlayerStats.Restore(30, 0); AdventureState.RestoreSave(false, 30);
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            int before = PlayerStats.Level;
            PlayerStats.AddExp(PlayerStats.ExpToNext + 1);
            if (PlayerStats.Level <= before) { Fail("레벨업이 안 일어남"); return; }
            Expect("levelup", "레벨업(PlayerStats.AddExp)");
            parts.Add("레벨업 levelup");
        }

        private static void CheckHatch(EggWalker walker, List<string> parts)
        {
            EggState.ResetForTest(); PlayerStats.Restore(30, 0);
            EggState.AddEgg("e_small"); EggState.Start(0);
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            Vector3 p = new Vector3(6000f, 0f, 6000f);
            walker.Feed(p);
            for (int i = 0; i < 160; i++) { p += new Vector3(0f, 0f, 2f); walker.Feed(p); }
            walker.Flush();
            Expect("summon", "신수 부화");
            parts.Add("신수 부화 summon");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] sfx FAIL - {msg}");
        }
    }
}
