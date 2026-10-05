using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using Saga.Go.Audio;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0051 무기별 타격음·지면별 발소리·점프·착지·입수 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoSfxMove.RunBatch`, 장면 없이): 지역 → 지면 표(전 지역·서리봉·독립 땅·모르는 id) · 무기 종류 다섯 → 타격음 이름 ·
    ///    <see cref="FootstepSfx"/> 규칙(걷기·달리기 박자·멈춤 0·프레임이 느려도 같은 걸음 수·공중 누적 0·착지 소리·짧은 뜀은 착지 없음·입수 한 번·탈것 위 무음) · 새 이름 전부가 정본 `saga-assets/sfx/` 에 실제로 있다.
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 효과음 진단 앞에 부른다, 장면 안): 진짜 `TakeHit` 이 활성 인물 무기 종류의 `&lt;kind&gt;_hit` 를 부르고,
    ///    진짜 `PlayerController.Step` 으로 걸으면 `step_&lt;지면&gt;`·점프하면 `jump`. 소리 파일이 없어도(K-0076) 기록(`SagaSfx.History`)은 남는다.
    /// </summary>
    public static class PlaytestGoSfxMove
    {
        private static string _tag;
        private static bool _ok;

        [MenuItem("Saga/Playtest Go Sfx Move")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoSfxMove]");
            var loader = SagaSfx.Loader;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckSurfaceTable();
                    CheckHitNames();
                    CheckFootstepRules();
                    CheckNamesExist();
                }
                finally { SagaSfx.Loader = loader; SagaSfx.ResetForTest(); GoSfx.ResetForTest(); }
            }
            PlaytestKit.Summary("PlaytestGoSfxMove");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void CheckSurfaceTable()
        {
            var want = new Dictionary<string, string>
            {
                ["village"] = "dirt", ["farmland"] = "dirt", ["west_wood"] = "grass", ["east_grove"] = "grass", ["south_glade"] = "grass",
                ["north_foot"] = "stone", ["river"] = "sand", ["frost"] = "snow", ["skyport"] = "stone", ["vault"] = "grass", ["unknown_place"] = "dirt",
            };
            foreach (var kv in want) PlaytestKit.Check(GoSurface.OfRegion(kv.Key) == kv.Value, $"지역 {kv.Key} 의 지면이 {GoSurface.OfRegion(kv.Key)} (기대 {kv.Value})");
            foreach (var r in GoWorldMap.Regions)
                PlaytestKit.Check(GoSurface.All.Contains(GoSurface.OfRegion(r.Id)), $"지역 {r.Id} 가 모르는 지면 이름을 줌");
            PlaytestKit.Check(GoSurface.All.Length == 6 && GoSurface.All.Distinct().Count() == 6, "지면 여섯이 아님");
            PlaytestKit.Check(GoSurface.StepName("grass") == "step_grass", "걸음 이름 규칙");
            PlaytestKit.Check(GoWorldMap.Regions.Select(r => GoSurface.OfRegion(r.Id)).Distinct().Count() >= 4, "일곱 지역의 지면이 4종 미만(표가 무의미)");
        }

        private static void CheckHitNames()
        {
            var want = new[] { (GoWeapons.Type.Sword, "sword_hit"), (GoWeapons.Type.Claymore, "axe_hit"), (GoWeapons.Type.Polearm, "spear_hit"), (GoWeapons.Type.Catalyst, "staff_hit"), (GoWeapons.Type.Bow, "bow_hit") };
            foreach (var (t, n) in want) PlaytestKit.Check(GoSfx.HitName(t) == n, $"{t} 의 타격음이 {GoSfx.HitName(t)} (기대 {n})");
            PlaytestKit.Check(want.Select(w => GoSfx.HitName(w.Item1)).Distinct().Count() == 5, "무기 종류별 타격음이 서로 달라야 함");
            foreach (var n in want.Select(w => w.Item2)) PlaytestKit.Check(GoSfx.Used.Contains(n), $"Used 에 {n} 없음");
        }

        private static int Count(string name) => SagaSfx.History.Count(h => h == name);

        private static int StepNames() => GoSurface.All.Sum(s => Count(GoSurface.StepName(s)));

        private static void CheckFootstepRules()
        {
            SagaSfx.Loader = k => null; SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            var G = PlayerController.MoveMode.Ground; var A = PlayerController.MoveMode.Air; var S = PlayerController.MoveMode.Swim;
            // 서 있기 — 소리 없음
            var f = new FootstepSfx(); Vector3 p = new Vector3(100f, 0f, 100f);
            for (int i = 0; i < 40; i++) f.Tick(p, G, true, false, 0.1f);
            PlaytestKit.Check(f.StepCount == 0 && StepNames() == 0, "서 있는데 걸음 소리");
            // 걷기 6m/s, 0.1s 틱 → 25.2m(경계 24m 는 부동소수라 피함)에 10걸음
            f = new FootstepSfx(); p = new Vector3(100f, 0f, 100f); SagaSfx.ResetForTest();
            for (int i = 0; i < 43; i++) { f.Tick(p, G, true, false, 0.1f); p.x += 0.6f; }
            PlaytestKit.Check(f.StepCount == 10 && StepNames() == 10, $"걷기 박자가 다름(걸음 {f.StepCount}·기록 {StepNames()}, 기대 10)");
            // 프레임이 두 배 느려도(0.2s 틱, 같은 속도) 같은 걸음 수 — 거리 기준
            var slow = new FootstepSfx(); p = new Vector3(100f, 0f, 100f);
            for (int i = 0; i < 22; i++) { slow.Tick(p, G, true, false, 0.2f); p.x += 1.2f; }
            PlaytestKit.Check(slow.StepCount == 10, $"프레임이 느리면 걸음 수가 달라짐({slow.StepCount})");
            // 달리기 10m/s → 걸음이 더 성김(3.2m): 100m 에 31걸음
            var run = new FootstepSfx(); p = new Vector3(100f, 0f, 100f);
            for (int i = 0; i < 101; i++) { run.Tick(p, G, true, false, 0.1f); p.x += 1f; }
            PlaytestKit.Check(run.StepCount == 31, $"달리기 박자가 다름({run.StepCount}, 기대 31)");
            // 공중 — 걸음 누적이 끊기고, 길게 뜬 뒤 닿으면 land 한 번
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            f = new FootstepSfx(); p = new Vector3(100f, 10f, 100f);
            for (int i = 0; i < 8; i++) { f.Tick(p, A, false, false, 0.1f); p.y -= 1.2f; }
            PlaytestKit.Check(f.StepCount == 0 && Count("land") == 0, "공중에서 걸음·착지 소리");
            f.Tick(p, G, true, false, 0.1f);
            PlaytestKit.Check(Count("land") == 1, $"긴 낙하 뒤 착지음 {Count("land")}회(기대 1)");
            f.Tick(p, G, true, false, 0.1f);
            PlaytestKit.Check(Count("land") == 1, "착지음이 두 번 남");
            // 짧은 뜀(0.1s)은 착지음 없음
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            f = new FootstepSfx(); p = new Vector3(100f, 0f, 100f);
            f.Tick(p, G, true, false, 0.1f); f.Tick(p, A, false, false, 0.1f); f.Tick(p, G, true, false, 0.1f);
            PlaytestKit.Check(Count("land") == 0, "짧은 뜀에 착지음");
            // 입수 한 번(헤엄 내내 아님)
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            f = new FootstepSfx(); p = new Vector3(100f, 0f, 100f);
            f.Tick(p, G, true, false, 0.1f);
            for (int i = 0; i < 10; i++) { f.Tick(p, S, false, false, 0.1f); p.x += 0.4f; }
            PlaytestKit.Check(Count("splash") == 1 && f.StepCount == 0, $"입수음 {Count("splash")}회·헤엄 걸음 {f.StepCount}");
            // 탈것 위 — 걸음·착지 무음
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            f = new FootstepSfx(); p = new Vector3(100f, 0f, 100f);
            for (int i = 0; i < 41; i++) { f.Tick(p, G, true, true, 0.1f); p.x += 0.6f; }
            PlaytestKit.Check(f.StepCount == 0, "탈것 위에서 걸음 소리");
        }

        private static string SfxDir()
        {
            foreach (var d in new[] { "../saga-assets/sfx", "saga-assets/sfx", "../../saga-assets/sfx" })
                if (Directory.Exists(d)) return d;
            return null;
        }

        private static void CheckNamesExist()
        {
            string dir = SfxDir();
            if (dir == null) { PlaytestKit.Fail("정본 saga-assets/sfx 폴더를 못 찾음"); return; }
            var files = new HashSet<string>(Directory.GetFiles(dir, "sfx_*.ogg").Select(Path.GetFileNameWithoutExtension));
            foreach (var n in GoSfx.Used)
                PlaytestKit.Check(files.Contains("sfx_" + n) || files.Contains("sfx_" + n + "_1"), $"코드가 부르는 이름 '{n}' 이 정본 파일에 없음");
            foreach (var s in GoSurface.All)
                PlaytestKit.Check(GoSfx.Used.Contains(GoSurface.StepName(s)), $"지면 {s} 의 걸음 이름이 Used 에 없음");
            string root = Directory.Exists("Assets/Games/SagaGo") ? "Assets/Games/SagaGo/" : null;
            if (root == null) { PlaytestKit.Fail("Assets/Games/SagaGo 를 못 찾음"); return; }
            string pc = File.ReadAllText(root + "Player/PlayerController.cs");
            PlaytestKit.Check(pc.Contains("GoSfx.Play(\"jump\""), "PlayerController 에 jump 호출 없음");
            PlaytestKit.Check(pc.Contains("Footsteps.Tick("), "PlayerController 가 Footsteps.Tick 을 안 부름");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var fc = FieldCombat.Instance; var pc = Object.FindFirstObjectByType<PlayerController>();
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
            var loader = SagaSfx.Loader;
            var parts = new List<string>();
            try
            {
                SagaSfx.Loader = k => null; // 소리 파일이 있든 없든 기록은 남는다
                SagaSfx.ResetForTest(); GoSfx.ResetForTest();
                CheckHit(fc, parts);
                CheckWalkJump(pc, parts);
            }
            finally
            {
                pc.ClearTestInput();
                SagaSfx.Loader = loader; SagaSfx.ResetForTest(); GoSfx.ResetForTest();
                fc.ResetForTest(); foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] sfx-move OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckHit(FieldCombat fc, List<string> parts)
        {
            var e = FieldEnemy.All.FirstOrDefault(x => x.Alive && !x.IsGuardian && !x.IsHero);
            if (e == null || fc.Active == null) { Fail("들판 적 또는 활성 인물이 없음"); return; }
            string want = GoSfx.HitName(GoWeaponModels.TypeFor(fc.Active.Id));
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            e.TakeHit(1f, GoElement.Physical, 1f, out _);
            if (!SagaSfx.History.Contains(want)) Fail($"진짜 타격(FieldEnemy.TakeHit)이 활성 인물({fc.Active.Id}) 무기의 '{want}' 를 안 부름(기록 {string.Join(",", SagaSfx.History)})");
            parts.Add($"진짜 타격 {want}(활성 {fc.Active.Id})");
        }

        private static void CheckWalkJump(PlayerController pc, List<string> parts)
        {
            if (pc.Mode != PlayerController.MoveMode.Ground) { Fail($"플레이어가 땅 모드가 아님({pc.Mode})"); return; }
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            pc.Footsteps.Reset();
            int c0 = pc.Footsteps.StepCount;
            pc.SetTestInput(new Vector2(0f, 1f), false);
            for (int i = 0; i < 60; i++) pc.Step(0.05f);
            pc.SetTestInput(Vector2.zero, false);
            pc.Step(0.05f);
            string surf = pc.Footsteps.LastSurface;
            int walked = pc.Footsteps.StepCount - c0;
            // 3초 × 걷기 6m/s = 18m → 한 걸음 2.4m 면 약 7걸음(벽·경사로 덜 갈 수 있어 넉넉히 1~12)
            if (walked == 0) Fail("진짜 PlayerController.Step 으로 3초 걸었는데 걸음 소리가 없음(땅에 안 닿았나)");
            else if (walked > 12) Fail($"3초에 {walked}걸음 — 박자가 너무 빠름");
            else if (!SagaSfx.History.Contains("step_" + surf)) Fail($"걸음 기록에 step_{surf} 없음");
            else parts.Add($"진짜 걷기 3초 {walked}걸음 step_{surf}");

            for (int i = 0; i < 10; i++) pc.Step(0.05f); // 서서 땅에 붙음
            SagaSfx.ResetForTest(); GoSfx.ResetForTest();
            pc.RequestJump(); pc.Step(0.05f);
            if (!SagaSfx.History.Contains("jump")) Fail("진짜 점프(RequestJump+Step)가 jump 를 안 부름");
            else parts.Add("진짜 점프 jump");
            for (int i = 0; i < 60; i++) pc.Step(0.05f); // 내려앉기(착지음은 기록만 — 파일 없이도 남음)
            if (SagaSfx.History.Contains("land")) parts.Add("착지 land");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] sfx-move FAIL - {msg}");
        }
    }
}
