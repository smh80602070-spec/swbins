using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0218 발소리(고돗 G-0369 probe_step_sounds · G-0368 probe_move_sounds ⑤ 짝) — `-executeMethod Saga.EditorTools.PlaytestStepSounds.Run`(-quit 없이).
    /// ① 셈: 서면 0 · 걸으면 거리만큼(6 m/s 10초 = 25) · 달리면 촘촘(10 m/s 10초 = 31) · 공중·탈것 0 · 순간이동 0 · 끄면 0
    /// ② 물 튐: 젖음 0.3 → 0 · 0.6 → 발소리 수와 같음(음량 = 발소리 × 0.316 × 젖음) · 눈밭·집 안 나무·겨울 0
    /// ③ 세 판 플레이어에 `Steps` · 바닥(2나락 stone · 3마을 grass/집 안 wood · 4종횡 grass) ④ 1만리 `FootstepSfx` 젖으면 물 튐 = 발소리 · 마르면 0
    /// ⑤ 소리 파일 step 여섯 땅 × 1·2 = 12 + splash 불러옴.
    /// </summary>
    public static class PlaytestStepSounds
    {
        private const string Tag = "[PlaytestStepSounds]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckCount();
                    CheckSplash();
                    CheckPlayers();
                    CheckGo();
                    CheckFiles();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally
                {
                    StepSounds.ForcedEnabled = null;
                    StepSounds.ForcedWet = null;
                    WetGround.ForcedNoPuddles = null;
                }
            }
            PlaytestKit.Summary("PlaytestStepSounds");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private sealed class Rec
        {
            public readonly List<(string n, float v)> Calls = new List<(string, float)>();
            public void Add(string n, float v) => Calls.Add((n, v));
            public int Count(string n) => Calls.Count(c => c.n == n);
        }

        /// <summary>speed m/s 로 sec 초 걷기(60 프레임/초) — 소리 기록.</summary>
        private static Rec Walk(float speed, float sec, string surface = StepSounds.Grass, bool grounded = true, bool blocked = false, StepSounds s = null)
        {
            var rec = new Rec();
            s ??= new StepSounds(null);
            s.Play = rec.Add;
            const float dt = 1f / 60f;
            var p = Vector3.zero;
            int n = Mathf.RoundToInt(sec / dt);
            s.Tick(p, grounded, blocked, surface, dt);
            for (int i = 0; i < n; i++) { p.x += speed * dt; s.Tick(p, grounded, blocked, surface, dt); }
            return rec;
        }

        private static void CheckCount()
        {
            StepSounds.ForcedEnabled = true; StepSounds.ForcedWet = 0f; WetGround.ForcedNoPuddles = false;
            int stand = Walk(0f, 2f).Calls.Count;
            int walk = Walk(6f, 10f).Count("step_grass");
            int run = Walk(10f, 10f).Count("step_grass");
            int air = Walk(6f, 10f, grounded: false).Calls.Count;
            int ride = Walk(6f, 10f, blocked: true).Calls.Count;
            int warp = Walk(400f, 1f).Calls.Count;
            StepSounds.ForcedEnabled = false;
            int off = Walk(6f, 10f).Calls.Count;
            StepSounds.ForcedEnabled = true;
            PlaytestKit.Check(stand == 0, $"서면 {stand} ≠ 0");
            PlaytestKit.Check(walk == 24 || walk == 25, $"걷기 6m/s 10초 {walk} ≠ 25(2.4m 마다, 끝수 반올림 24)");
            PlaytestKit.Check(run == 31, $"달리기 10m/s 10초 {run} ≠ 31(3.2m 마다)");
            PlaytestKit.Check(run > walk, "달리면 촘촘하지 않음");
            PlaytestKit.Check(air == 0 && ride == 0, $"공중 {air}·탈것 {ride} ≠ 0");
            PlaytestKit.Check(warp == 0, $"순간이동 {warp} ≠ 0");
            PlaytestKit.Check(off == 0, $"SAGA_STEP_SOUND=0 인데 {off}");
            Debug.Log($"{Tag} count OK - 서면 0 · 걷기 10초 {walk} · 달리기 {run} · 공중·탈것·순간이동 0 · 끄면 0");
        }

        private static void CheckSplash()
        {
            StepSounds.ForcedEnabled = true; WetGround.ForcedNoPuddles = false;
            StepSounds.ForcedWet = 0.3f;
            var dry = Walk(6f, 10f);
            StepSounds.ForcedWet = 0.6f;
            var wet = Walk(6f, 10f);
            var snow = Walk(6f, 10f, StepSounds.Snow);
            var wood = Walk(6f, 10f, StepSounds.Wood);
            WetGround.ForcedNoPuddles = true;
            var winter = Walk(6f, 10f);
            WetGround.ForcedNoPuddles = false;
            int steps = wet.Count("step_grass");
            float vol = wet.Calls.Where(c => c.n == "splash").Select(c => c.v).DefaultIfEmpty(0f).First();
            PlaytestKit.Check(dry.Count("splash") == 0, $"젖음 0.3 물 튐 {dry.Count("splash")} ≠ 0");
            PlaytestKit.Check(wet.Count("splash") == steps && steps > 0, $"젖음 0.6 물 튐 {wet.Count("splash")} ≠ 발소리 {steps}");
            PlaytestKit.Check(Mathf.Abs(vol - StepSounds.StepVolume * StepSounds.SplashRatio * 0.6f) < 1e-4f && vol < StepSounds.StepVolume, $"물 튐 음량 {vol}");
            PlaytestKit.Check(snow.Count("splash") == 0 && snow.Count("step_snow") == steps, $"눈밭 물 튐 {snow.Count("splash")}");
            PlaytestKit.Check(wood.Count("splash") == 0, $"집 안 나무 물 튐 {wood.Count("splash")}");
            PlaytestKit.Check(winter.Count("splash") == 0, $"겨울 물 튐 {winter.Count("splash")}");
            Debug.Log($"{Tag} splash OK - 젖음 0.3 → 0 · 0.6 → {wet.Count("splash")} = 발소리 {steps} · 음량 {vol:0.000} · 눈밭·나무·겨울 0");
        }

        private static void CheckPlayers()
        {
            var types = new[] { typeof(Saga.Dungeon.Player.PlayerController), typeof(Saga.Forest.Player.PlayerController), typeof(Saga.Story.Player.StoryPlayerController) };
            foreach (var t in types) PlaytestKit.Check(t.GetProperty("Steps")?.PropertyType == typeof(StepSounds), $"{t.FullName} 에 Steps 없음");
            string dg = Saga.Dungeon.Player.PlayerController.StepSurface(Vector3.zero);
            string fs = Saga.Forest.Player.PlayerController.StepSurface(Vector3.zero);
            string fsIn = Saga.Forest.Player.PlayerController.StepSurface(new Vector3(0f, 0f, 500f));
            string st = Saga.Story.Player.StoryPlayerController.StepSurface(Vector3.zero);
            PlaytestKit.Check(dg == "stone", $"2나락 바닥 {dg}");
            PlaytestKit.Check(fs == "grass" && fsIn == "wood", $"3마을 바닥 {fs}·집 안 {fsIn}");
            PlaytestKit.Check(st == "grass", $"4종횡 바닥 {st}");
            Debug.Log($"{Tag} players OK - 세 판 Steps · 2나락 {dg} · 3마을 {fs}(집 안 {fsIn}) · 4종횡 {st}");
        }

        private static void CheckGo()
        {
            StepSounds.ForcedEnabled = true; WetGround.ForcedNoPuddles = false;
            int Steps(float wet, out int splash)
            {
                StepSounds.ForcedWet = wet;
                var f = new Saga.Go.Player.FootstepSfx();
                const float dt = 1f / 60f;
                var p = new Vector3(0f, 0f, 0f);
                for (int i = 0; i <= 600; i++) { p.x += 6f * dt; f.Tick(p, Saga.Go.Player.PlayerController.MoveMode.Ground, true, false, dt); }
                splash = f.SplashCount;
                Debug.Log($"{Tag} go 젖음 {wet} 땅 {f.LastSurface} 발소리 {f.StepCount} 물 튐 {f.SplashCount}");
                return f.StepCount;
            }
            int dry = Steps(0f, out int drySplash);
            int wet = Steps(0.8f, out int wetSplash);
            PlaytestKit.Check(dry == wet && dry >= 24 && dry <= 25, $"1만리 박자 바뀜 {dry}·{wet} ≠ 25");
            PlaytestKit.Check(drySplash == 0, $"1만리 마름 물 튐 {drySplash}");
            PlaytestKit.Check(wetSplash == wet, $"1만리 젖음 물 튐 {wetSplash} ≠ 발소리 {wet}");
            Debug.Log($"{Tag} go OK - 1만리 박자 그대로 {dry} · 마름 물 튐 0 · 젖음 {wetSplash} = 발소리");
        }

        private static void CheckFiles()
        {
            int n = 0;
            foreach (var s in new[] { "dirt", "grass", "sand", "snow", "stone", "wood" }) n += SagaSfx.Variants(StepSounds.StepName(s)).Length;
            bool splash = SagaSfx.Has("splash");
            PlaytestKit.Check(n == 12, $"발소리 파일 {n} ≠ 12");
            PlaytestKit.Check(splash, "sfx_splash 없음");
            Debug.Log($"{Tag} files OK - 발소리 {n} · splash {splash}");
        }
    }
}
