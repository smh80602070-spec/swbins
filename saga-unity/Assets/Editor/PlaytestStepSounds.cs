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
    /// ⑥ tasks U-0219 점프·착지(고돗 G-0370): 점프 1(0.8) · 착지 1(낙하 속도만큼 0.5~1) · 짧은 뜸·탈것·처음 바닥 전·끄면 0 · 착지 뒤 첫 발소리 반 걸음 미룸.
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
                    CheckJumpLand();
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

        /// <summary>tasks U-0219 — 땅 걷기 <paramref name="before"/>초 → 공중 <paramref name="air"/>초(중력 20 으로 떨어짐) → 땅 걷기 <paramref name="after"/>초.
        /// <paramref name="firstStepX"/> = 다시 닿은 뒤 첫 발소리까지 간 거리.</summary>
        private static Rec Hop(float speed, float before, float air, float after, out float firstStepX, bool blockedAir = false, StepSounds s = null)
        {
            var rec = new Rec();
            s ??= new StepSounds(null);
            s.Play = rec.Add;
            const float dt = 1f / 60f;
            var p = Vector3.zero;
            if (before > 0f) s.Tick(p, true, false, StepSounds.Grass, dt);
            for (int i = 0; i < Mathf.RoundToInt(before / dt); i++) { p.x += speed * dt; s.Tick(p, true, false, StepSounds.Grass, dt); }
            float vy = 0f;
            for (int i = 0; i < Mathf.RoundToInt(air / dt); i++) { vy -= 20f * dt; p.x += speed * dt; p.y += vy * dt; s.Tick(p, false, blockedAir, StepSounds.Grass, dt); }
            int stepsBefore = rec.Count("step_grass");
            firstStepX = -1f;
            float x0 = p.x;
            s.Tick(p, true, false, StepSounds.Grass, dt);
            for (int i = 0; i < Mathf.RoundToInt(after / dt); i++)
            {
                p.x += speed * dt;
                s.Tick(p, true, false, StepSounds.Grass, dt);
                if (firstStepX < 0f && rec.Count("step_grass") > stepsBefore) firstStepX = p.x - x0;
            }
            return rec;
        }

        private static void CheckJumpLand()
        {
            StepSounds.ForcedEnabled = true; StepSounds.ForcedWet = 0f; WetGround.ForcedNoPuddles = false;
            var js = new StepSounds(null); var jr = new Rec(); js.Play = jr.Add;
            js.Jumped();
            StepSounds.ForcedEnabled = false; js.Jumped(); StepSounds.ForcedEnabled = true;
            float jv = jr.Calls.Where(c => c.n == "jump").Select(c => c.v).DefaultIfEmpty(0f).First();
            PlaytestKit.Check(jr.Count("jump") == 1 && js.JumpCount == 1, $"점프 {jr.Count("jump")} ≠ 1(끄면 0)");
            PlaytestKit.Check(Mathf.Abs(jv - 0.8f) < 1e-4f, $"점프 음량 {jv} ≠ 0.8(1만리)");

            var land = Hop(0f, 0.5f, 0.6f, 0.5f, out _);
            float lv = land.Calls.Where(c => c.n == "land").Select(c => c.v).DefaultIfEmpty(0f).First();
            var high = Hop(0f, 0.5f, 1.2f, 0.5f, out _);
            float hv = high.Calls.Where(c => c.n == "land").Select(c => c.v).DefaultIfEmpty(0f).First();
            int shortHop = Hop(0f, 0.5f, 0.15f, 0.5f, out _).Count("land");
            int ride = Hop(0f, 0.5f, 0.6f, 0.5f, out _, blockedAir: true).Count("land");
            int spawn = Hop(0f, 0f, 0.6f, 0.5f, out _).Count("land");
            StepSounds.ForcedEnabled = false;
            int off = Hop(6f, 0.5f, 0.6f, 2f, out _).Calls.Count;
            StepSounds.ForcedEnabled = true;
            PlaytestKit.Check(land.Count("land") == 1, $"착지 {land.Count("land")} ≠ 1");
            PlaytestKit.Check(lv >= 0.5f && lv < hv && hv <= 1f, $"착지 음량 {lv:0.00}·높이 {hv:0.00} — 낙하 속도만큼 0.5~1 아님");
            PlaytestKit.Check(shortHop == 0, $"짧은 뜸(0.15초) 착지 {shortHop} ≠ 0");
            PlaytestKit.Check(ride == 0, $"탈것 착지 {ride} ≠ 0");
            PlaytestKit.Check(spawn == 0, $"처음 바닥 닿기 전 착지 {spawn} ≠ 0");
            PlaytestKit.Check(off == 0, $"SAGA_STEP_SOUND=0 인데 {off}");

            // 착지 뒤 첫 발소리 반 걸음 미룸 — 6 m/s 로 뛰어 착지 → 첫 걸음 3.6m(2.4 + 1.2) · 짧은 뜸(착지 아님)은 2.4m
            Hop(6f, 1f, 0.6f, 2f, out float delayed);
            Hop(6f, 1f, 0.15f, 2f, out float normal);
            PlaytestKit.Check(Mathf.Abs(delayed - 3.6f) < 0.15f, $"착지 뒤 첫 발소리 {delayed:0.00}m ≠ 3.6");
            PlaytestKit.Check(Mathf.Abs(normal - 2.4f) < 0.15f, $"짧은 뜸 뒤 첫 발소리 {normal:0.00}m ≠ 2.4");
            Debug.Log($"{Tag} jumpland OK - 점프 1(음량 {jv:0.0}) · 착지 1(음량 {lv:0.00}·높이 {hv:0.00}) · 짧은 뜸 0 · 탈것 0 · 처음 0 · 끄면 0 · 첫 발소리 {normal:0.0}m → 착지 뒤 {delayed:0.0}m");
        }

        private static void CheckPlayers()
        {
            PlaytestKit.Check(SagaSfx.Has("jump") && SagaSfx.Has("land"), "sfx_jump·sfx_land 없음");
            Debug.Log($"{Tag} jump files OK - sfx_jump·sfx_land · 점프 판 2나락·4종횡 · 3마을 착지만(점프 없음)");
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
