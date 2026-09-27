using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-11-1 "보스 패턴전"(웹 사가스토리 §5-9) 진단 — `PlaytestStorySlice` 준비 단계(세 시대 진단 뒤)가 부른다. 같은 프레임 안에서 끝낸다.
    /// 웹 진단 항목 그대로: 단계 문턱·목록 · 단계 전환 거둠·광폭 · 내려찍기 맞음/비킴 · 지진 섬/점프/발판 · 휩쓸기 밖/안(안전지대 닿는 거리·판 끝) ·
    /// 잇지 않음·부르기 단계에 한 번 · 실제 사냥터 루프(등장 컷 뒤 예고 그림·판정·체력) + 이 트랙 몫: 플레이어 체력(최대치·무적·회복·레벨업),
    /// 들판 쓰러짐(입구·두목 태세 되돌림·부하 거둠), 실제 비경 두목(방 경계·부하가 방 적·쓰러지면 패퇴).
    /// 끝나면 플레이어 자리·체력·기력·비경·두목을 시작 때로. 이 진단이 만든 적(부하·비경)은 곧바로 지운다(뒤 단계 적 수 검사).
    /// </summary>
    public static class PlaytestStoryBossPattern
    {
        private const string T = "[PlaytestStorySlice] bossPattern";
        private static bool _ok;

        /// <summary>가짜 api — 판정을 값으로 굴린다(웹 진단의 가짜 api 와 같은 결).</summary>
        private class FakeApi : StoryBossPattern.IApi
        {
            public Vector2 FeetPos;
            public bool Ground = true;
            public float Min = 0f, Max = 44f;
            public float PlayerHpMax = 162f;
            public System.Random Rng = new System.Random(20260824);
            public readonly List<float> Hurts = new List<float>();
            public readonly List<float> Spawns = new List<float>();
            public readonly List<StoryBossPattern.Kind> Warns = new List<StoryBossPattern.Kind>();
            public readonly List<int> Phases = new List<int>();

            public Vector2 Feet => FeetPos;
            public bool OnGround => Ground;
            public float MinX => Min;
            public float MaxX => Max;
            public float FloorY => 0f;
            public float HpMax => PlayerHpMax;
            public float Rand() => (float)Rng.NextDouble();
            public void Hurt(float amount, StoryBossPattern.Kind kind) => Hurts.Add(amount);
            public void Spawn(float x) => Spawns.Add(x);
            public void Warn(StoryBossPattern.Kind kind, StoryBossPattern.State s) => Warns.Add(kind);
            public void Resolved(StoryBossPattern.Kind kind, int hit) { }
            public void PhaseChanged(int phase) => Phases.Add(phase);
        }

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null) { Fail("플레이어 없음"); return false; }
            var cc = playerGo.GetComponent<CharacterController>();
            Vector3 pos = playerGo.transform.position;
            int level0 = StoryJobState.Level;
            float exp0 = StoryJobState.Exp;
            string job0 = StoryJobState.Job;
            float mp0 = StoryCombat.Mp;
            var enemies0 = new HashSet<StoryEnemy>(StoryEnemy.All);
            var roots0 = new HashSet<GameObject>(UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects());
            string m = "";
            try
            {
                m += CheckPhases() + CheckTransition() + CheckSlamRock() + CheckQuake() + CheckSweep() + CheckPicks()
                   + CheckPlayerHp() + CheckField(playerGo.transform) + CheckLabyrinth(playerGo.transform);
            }
            catch (System.Exception ex)
            {
                Fail("예외 " + ex);
            }
            finally
            {
                StoryLabyrinthState.ResetForTest();
                StoryLabyrinthState.Restore(0, 0);
                StoryJobState.Restore(level0, exp0, job0);
                StoryCombat.RestoreMp(mp0);
                foreach (var e in new List<StoryEnemy>(StoryEnemy.All))
                    if (e != null && !enemies0.Contains(e)) Object.DestroyImmediate(e.gameObject);
                foreach (var e in StoryEnemy.All)
                    if (e != null && e.IsBoss && !e.IsLabyrinthEnemy) e.RegroupAfterPlayerFell();
                foreach (var w in Object.FindObjectsByType<StoryBossWarnFx>(FindObjectsSortMode.None)) Object.DestroyImmediate(w.gameObject);
                // 두목 타격·판정이 남긴 데칼·팝업·전리품 — 뒤 단계의 데칼 캡(32) 검사가 막히지 않게 이 진단이 만든 것만 지운다(세 시대 진단과 같은 결).
                foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
                    if (!roots0.Contains(go) && (go.GetComponent<StoryGroundDecal>() != null || go.GetComponent<StoryLootMarker>() != null
                        || go.GetComponent<DamagePopup>() != null || go.name.StartsWith("HitSpark")))
                        Object.DestroyImmediate(go);
                StoryPlayerHp.Refill();
                Place(cc, playerGo.transform, pos);
            }
            if (_ok) Debug.Log($"{T} OK - 단계 문턱·목록·전환 거둠·광폭·내려찍기/낙석 맞음·비킴·지진 섬/점프/발판·휩쓸기 밖/안·잇지 않음·부르기 한 번·체력(최대치·무적·회복)·실제 들판 루프·쓰러짐·비경 두목 |{m}");
            return _ok;
        }

        private static string CheckPhases()
        {
            if (StoryBossPattern.PhaseOf(100f, 100f) != 0 || StoryBossPattern.PhaseOf(67f, 100f) != 0 || StoryBossPattern.PhaseOf(66f, 100f) != 1
                || StoryBossPattern.PhaseOf(34f, 100f) != 1 || StoryBossPattern.PhaseOf(33f, 100f) != 2 || StoryBossPattern.PhaseOf(0f, 100f) != 2)
                Fail("단계 문턱(66%·33%)");
            string Pool(int ph) => string.Join(",", StoryBossPattern.PoolOf(ph));
            if (Pool(0) != "Slam,Rock" || Pool(1) != "Slam,Rock,Quake,Summon" || Pool(2) != "Slam,Rock,Quake,Sweep") Fail($"목록 {Pool(0)} / {Pool(1)} / {Pool(2)}");
            if (StoryCombat.BossDmgFor(1) != 11f || StoryCombat.BossDmgFor(20) != 72f) Fail($"두목 힘 Lv1 {StoryCombat.BossDmgFor(1)} Lv20 {StoryCombat.BossDmgFor(20)}");
            return " 단계·목록";
        }

        private static string CheckTransition()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State { Cd = 0f };
            var r = StoryBossPattern.Step(s, 0.01f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current == StoryBossPattern.Kind.None || api.Warns.Count != 1) Fail("1단계 첫 패턴이 안 걸림");
            // 걸린 패턴 중 체력이 66% 아래로 → 포효·거둠·1.4초 뒤 새 패턴.
            r = StoryBossPattern.Step(s, 0.01f, api, true, 60f, 100f, 22f, 10f);
            if (!r.Changed || s.Phase != 1 || s.Current != StoryBossPattern.Kind.None || s.Marks.Count != 0 || Mathf.Abs(s.Cd - StoryBossPattern.RoarCd) > 1e-4f
                || api.Phases.Count != 1 || api.Hurts.Count != 0)
                Fail($"2단계 전환(changed {r.Changed} phase {s.Phase} 걸림 {s.Current} cd {s.Cd})");
            // 한 번에 3단계로 뛰어도 한 번 포효, 광폭 ×1.25·간격 ×0.7.
            var s2 = new StoryBossPattern.State();
            var api2 = new FakeApi();
            StoryBossPattern.Step(s2, 0.01f, api2, true, 20f, 100f, 22f, 10f);
            if (s2.Phase != 2 || api2.Phases.Count != 1 || api2.Phases[0] != 2) Fail("3단계 곧장 전환");
            if (StoryBossPattern.DmgOf(s2, 10f) != 13f || StoryBossPattern.DmgOf(s, 10f) != 10f) Fail($"광폭 힘 {StoryBossPattern.DmgOf(s2, 10f)}");
            s2.Cd = 1f;
            StoryBossPattern.Step(s2, 0.5f, api2, false, 20f, 100f, 22f, 10f);
            if (Mathf.Abs(s2.Cd - (1f - 0.5f / 0.7f)) > 1e-3f) Fail($"광폭 간격 {s2.Cd}");
            // 멀면(near=false) 새 패턴을 안 문다.
            var s3 = new StoryBossPattern.State { Cd = 0f };
            StoryBossPattern.Step(s3, 0.1f, new FakeApi(), false, 100f, 100f, 22f, 10f);
            if (s3.Current != StoryBossPattern.Kind.None) Fail("멀어도 패턴");
            if (!StoryBossPattern.IsNear(new Vector2(30f, 0f), new Vector2(22f, 0f)) || StoryBossPattern.IsNear(new Vector2(30f, 0f), new Vector2(21f, 0f))
                || StoryBossPattern.IsNear(new Vector2(30f, 0f), new Vector2(29f, 2.2f)))
                Fail("near(가로 8.4m·높이 1.4m)");
            return " 전환·광폭";
        }

        private static string CheckSlamRock()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Slam, api, 25f);
            if (s.Marks.Count != 1 || Mathf.Abs(s.Marks[0].X - 20f) > 1e-4f || Mathf.Abs(s.T - 1f) > 1e-4f) Fail("내려찍기 표시(내 자리·1.0초)");
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 13f) Fail($"내려찍기 맞음 {string.Join(",", api.Hurts)}");
            api.Hurts.Clear();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Slam, api, 25f);
            api.FeetPos = new Vector2(20f + StoryBossPattern.SlamR + 0.05f, 0f); // 원 밖으로 비킴
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 0) Fail("내려찍기 비켜도 맞음");
            api.FeetPos = new Vector2(20f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Rock, api, 25f);
            if (s.Marks.Count != 3) Fail($"낙석 {s.Marks.Count} 줄기");
            else
            {
                float left = s.Marks[1].X, right = s.Marks[2].X;
                if (Mathf.Abs(s.Marks[0].X - 20f) > 1e-4f || left > 20f - 2.6f + 1e-3f || left < 20f - 3.6f - 1e-3f || right < 20f + 2.6f - 1e-3f || right > 20f + 3.6f + 1e-3f)
                    Fail($"낙석 자리 {s.Marks[0].X:F2}/{left:F2}/{right:F2}");
            }
            api.FeetPos = new Vector2(21.2f, 0f); // 줄기 사이
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 0) Fail("낙석 사이에서도 맞음");
            // 판 끝 — 줄기가 판 밖에 안 떨어진다.
            api.FeetPos = new Vector2(0.5f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Rock, api, 5f);
            foreach (var mk in s.Marks) if (mk.X < StoryBossPattern.RockMargin - 1e-4f) Fail($"낙석이 판 밖 {mk.X:F2}");
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 9f) Fail($"낙석 맞음 {string.Join(",", api.Hurts)}");
            return " 내려찍기·낙석";
        }

        private static string CheckQuake()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0.05f) };
            var s = new StoryBossPattern.State();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Quake, api, 25f);
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 12f) Fail($"지진 섬 {string.Join(",", api.Hurts)}");
            api.Hurts.Clear();
            api.Ground = false; // 뜀
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Quake, api, 25f);
            StoryBossPattern.Resolve(s, api, 10f);
            api.Ground = true;
            api.FeetPos = new Vector2(20f, FieldMapData.Platforms()[0].Height); // 발판 위
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Quake, api, 25f);
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 0) Fail("지진 — 뛰었거나 발판 위인데 맞음");
            return " 지진";
        }

        private static string CheckSweep()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State();
            float runReach = 6f * StoryBossPattern.SweepT; // 달리기 6m/s(StoryPlayerController.RunSpeed)
            for (int i = 0; i < 40; i++)
            {
                api.FeetPos = new Vector2(i % 2 == 0 ? 20f : (i % 4 == 1 ? 0.5f : 43.5f), 0f);
                StoryBossPattern.Begin(s, StoryBossPattern.Kind.Sweep, api, 25f);
                float d = Mathf.Abs(s.SafeX - api.FeetPos.x);
                if (s.SafeX - s.SafeW / 2f < api.Min || s.SafeX + s.SafeW / 2f > api.Max) Fail($"안전지대가 판 밖 {s.SafeX:F2}");
                if (d - s.SafeW / 2f > runReach) Fail($"안전지대에 못 닿음 {d:F2}m");
                if (api.FeetPos.x == 20f && (d < StoryBossPattern.SweepDistMin - 1e-3f || d > StoryBossPattern.SweepDistMin + StoryBossPattern.SweepDistJitter + 1e-3f))
                    Fail($"안전지대 거리 {d:F2}(3~6.4m)");
                StoryBossPattern.Clear(s);
            }
            api.FeetPos = new Vector2(20f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Sweep, api, 25f);
            float safe = s.SafeX;
            api.FeetPos = new Vector2(safe + 0.3f, 0f); // 안
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 0) Fail("휩쓸기 안전지대 안인데 맞음");
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Sweep, api, 25f);
            api.FeetPos = new Vector2(s.SafeX + s.SafeW / 2f + 0.2f, 0f); // 밖
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != Mathf.Round(162f * 0.55f)) Fail($"휩쓸기 밖 {string.Join(",", api.Hurts)}(최대 체력 55% = 89)");
            return " 휩쓸기";
        }

        private static string CheckPicks()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State();
            var counts = new Dictionary<StoryBossPattern.Kind, int>();
            StoryBossPattern.Kind prev = StoryBossPattern.Kind.None;
            for (int phase = 0; phase < 3; phase++)
            {
                float hp = phase == 0 ? 100f : phase == 1 ? 50f : 20f;
                for (int i = 0; i < 200; i++)
                {
                    s.Cd = 0f;
                    int begun = s.Begun;
                    StoryBossPattern.Step(s, 0.01f, api, true, hp, 100f, 22f, 10f);
                    if (s.Begun == begun) continue; // 포효 걸음
                    var k = s.Current;
                    if (k == prev) Fail($"{phase + 1}단계 같은 패턴을 이음 {k}");
                    if (!StoryBossPattern.PoolOf(phase).Contains(k)) Fail($"{phase + 1}단계 목록 밖 {k}");
                    counts[k] = (counts.TryGetValue(k, out var c) ? c : 0) + 1;
                    prev = k;
                    StoryBossPattern.Clear(s);
                }
            }
            if (s.Summoned != 1 || api.Spawns.Count != 2) Fail($"부르기 {s.Summoned}번·부하 {api.Spawns.Count}(단계에 한 번·둘)");
            foreach (var k in new[] { StoryBossPattern.Kind.Slam, StoryBossPattern.Kind.Rock, StoryBossPattern.Kind.Quake, StoryBossPattern.Kind.Sweep })
                if (!counts.ContainsKey(k)) Fail($"{k} 가 한 번도 안 나옴");
            foreach (var x in api.Spawns) if (Mathf.Abs(Mathf.Abs(x - 22f) - StoryBossPattern.SummonDx) > 1e-3f) Fail($"부하 자리 {x:F2}");
            return $" 고르기(내려찍기 {Get(counts, StoryBossPattern.Kind.Slam)}·낙석 {Get(counts, StoryBossPattern.Kind.Rock)}·지진 {Get(counts, StoryBossPattern.Kind.Quake)}·휩쓸기 {Get(counts, StoryBossPattern.Kind.Sweep)})";
        }

        private static int Get(Dictionary<StoryBossPattern.Kind, int> d, StoryBossPattern.Kind k) => d.TryGetValue(k, out var v) ? v : 0;

        private static string CheckPlayerHp()
        {
            StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
            StoryPlayerHp.Refill();
            if (StoryPlayerHp.HpMax != StoryCombat.StartHp || StoryPlayerHp.Hp != StoryCombat.StartHp) Fail($"Lv.1 최대 체력 {StoryPlayerHp.HpMax}(162)");
            if (!StoryPlayerHp.Hurt(10.4f) || StoryPlayerHp.Hp != 152f) Fail($"맞음 {StoryPlayerHp.Hp}");
            if (StoryPlayerHp.Hurt(10f)) Fail("무적 0.7초 안에 또 맞음");
            StoryPlayerHp.Tick(0.71f);
            if (!StoryPlayerHp.Hurt(0.2f) || StoryPlayerHp.Hp != 151f) Fail($"최소 1 {StoryPlayerHp.Hp}");
            StoryPlayerHp.Tick(4f);
            if (StoryPlayerHp.Hp != 151f) Fail("5초 전에 회복");
            StoryPlayerHp.Tick(1.1f);
            if (StoryPlayerHp.Hp <= 151f) Fail("5초 뒤 회복 안 됨");
            float before = StoryPlayerHp.Hp;
            StoryJobState.Restore(3, 0f, StoryJobState.NoJob);
            StoryPlayerHp.Tick(0f);
            if (StoryPlayerHp.HpMax != 186f || Mathf.Abs(StoryPlayerHp.Hp - (before + 24f)) > 0.01f) Fail($"레벨업 최대치 {StoryPlayerHp.HpMax}·체력 {StoryPlayerHp.Hp}");
            StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
            StoryPlayerHp.Refill();
            return " 체력";
        }

        private static string CheckField(Transform player)
        {
            StoryEnemy boss = null;
            foreach (var e in StoryEnemy.All)
                if (e != null && e.IsBoss && !e.IsLabyrinthEnemy && !e.IsDead) { boss = e; break; }
            if (boss == null) { Fail("들판 두목 없음"); return ""; }
            var runner = boss.GetComponent<StoryBossPatternRunner>();
            if (runner == null) { Fail("들판 두목에 패턴 실행기 없음"); return ""; }
            if (!boss.IntroPlayed) { Fail("등장 컷이 먼저 돌지 않음(두목 등장 진단 뒤에 불러야)"); return ""; }
            var cc = player.GetComponent<CharacterController>();
            float hp0 = boss.Hp;
            if (Mathf.Abs(boss.MaxHp - hp0) > 0.01f) Fail($"두목 최대 체력 {boss.MaxHp} ≠ 지금 {hp0}");
            if (runner.MinX != 0f || Mathf.Abs(runner.MaxX - FieldMapData.WidthM) > 1e-3f) Fail($"들판 경계 {runner.MinX}~{runner.MaxX}");
            runner.ResetPattern();
            runner.RandOverride = () => 0.1f; // 첫 패턴 = 목록 첫째(내려찍기)
            runner.OnGroundOverride = () => true;
            StoryPlayerHp.Refill();
            Place(cc, player, new Vector3(boss.transform.position.x - 3f, 0.05f, 0f));

            // 1) 첫 패턴까지 3.2초 — 그 전엔 예고 없음, 뒤엔 예고 그림.
            Ticks(runner, 3.1f);
            if (runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0) Fail("3.2초 전에 패턴");
            Ticks(runner, 0.2f);
            if (runner.State.Current != StoryBossPattern.Kind.Slam || runner.Warns.Count != 1 || runner.Warns[0] == null || runner.Warns[0].Kind != StoryBossWarnFx.Look.Circle)
                Fail($"첫 패턴 예고 {runner.State.Current}·그림 {runner.Warns.Count}");
            // 2) 판정 — 그 자리에 서 있으면 맞는다(Lv.1 힘 11 × 1.3 = 14).
            float hpBefore = StoryPlayerHp.Hp;
            Ticks(runner, 1.05f);
            if (runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0) Fail("판정 뒤에도 예고가 남음");
            if (hpBefore - StoryPlayerHp.Hp != 14f) Fail($"내려찍기 피해 {hpBefore - StoryPlayerHp.Hp}(14)");
            // 3) 낙석(다음 패턴은 같은 것을 안 잇는다) — 비키면 안 맞는다.
            StoryPlayerHp.Tick(1f);
            Ticks(runner, 6.6f);
            if (runner.State.Current != StoryBossPattern.Kind.Rock || runner.Warns.Count != 3) Fail($"둘째 패턴 {runner.State.Current}·그림 {runner.Warns.Count}(낙석 셋)");
            Place(cc, player, new Vector3(player.position.x + 1.3f, 0.05f, 0f)); // 줄기 사이
            hpBefore = StoryPlayerHp.Hp;
            Ticks(runner, 1.15f);
            if (StoryPlayerHp.Hp != hpBefore) Fail("낙석 비켰는데 맞음");
            // 4) 2단계 — 포효·부하 둘(방 적이 아닌 들판 잡졸), 3단계 — 휩쓸기 예고(붉은 막 + 초록 기둥).
            boss.TakeDamage(boss.MaxHp * 0.4f);
            var r = runner.Tick(0.01f);
            if (r == null || !r.Value.Changed || runner.State.Phase != 1) Fail("실제 2단계 전환");
            runner.State.Cd = 0f;
            runner.State.Last = StoryBossPattern.Kind.None;
            runner.RandOverride = () => 0.99f; // 목록 끝 = 부르기
            runner.Tick(0.01f);
            if (runner.State.Current != StoryBossPattern.Kind.Summon || runner.Minions.Count != 2) Fail($"부르기 {runner.State.Current}·부하 {runner.Minions.Count}");
            foreach (var mn in runner.Minions) if (mn.IsBoss || mn.IsLabyrinthEnemy || mn.IsDead) Fail("부하가 두목·비경 적이거나 죽음");
            boss.TakeDamage(boss.MaxHp * 0.3f);
            runner.Tick(0.5f);
            runner.Tick(0.01f);
            if (runner.State.Phase != 2) Fail($"실제 3단계 {runner.State.Phase}");
            runner.State.Cd = 0f;
            runner.State.Last = StoryBossPattern.Kind.None;
            runner.Tick(0.01f);
            int red = 0, safe = 0;
            foreach (var w in runner.Warns) if (w != null) { if (w.Kind == StoryBossWarnFx.Look.SweepRed) red++; else if (w.Kind == StoryBossWarnFx.Look.SweepSafe) safe++; }
            if (runner.State.Current != StoryBossPattern.Kind.Sweep || safe != 1 || red < 1) Fail($"휩쓸기 예고 {runner.State.Current}·붉은 {red}·안전 {safe}");
            // 5) 쓰러짐 — 들판 입구에서 일어서고, 두목은 체력 가득·1단계·부하 거둠.
            StoryPlayerHp.SetForTest(1f);
            int falls = StoryPlayerHp.Falls;
            StoryPlayerHp.Hurt(5f);
            if (StoryPlayerHp.Falls != falls + 1) Fail("쓰러짐 이벤트 없음");
            if (Mathf.Abs(player.position.x - StoryPlayerVitals.FieldRespawn.x) > 0.01f) Fail($"쓰러진 뒤 자리 {player.position.x:F2}(입구 2m)");
            if (StoryPlayerHp.Hp != StoryPlayerHp.HpMax) Fail($"일어선 체력 {StoryPlayerHp.Hp}");
            if (Mathf.Abs(boss.Hp - boss.MaxHp) > 0.01f || runner.State.Phase != 0 || runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0)
                Fail($"두목 태세 되돌림(체력 {boss.Hp}/{boss.MaxHp}·단계 {runner.State.Phase}·걸림 {runner.State.Current})");
            int alive = 0;
            foreach (var mn in runner.Minions) if (mn != null) alive++;
            if (alive != 0) Fail($"부하가 남음 {alive}");
            // 6) 멀면(입구) 새 패턴 없음, 컷 전 두목(등장 안 한 두목)은 안 문다 — 여긴 먼 자리만 본다.
            runner.State.Cd = 0f;
            runner.Tick(0.01f);
            if (runner.State.Current != StoryBossPattern.Kind.None) Fail("입구(멀리)에서도 패턴");
            runner.RandOverride = null;
            runner.OnGroundOverride = null;
            runner.ResetPattern();
            return $" 들판(피해 {runner.DamageDealt:0}·맞음 {runner.Hits})";
        }

        private static string CheckLabyrinth(Transform player)
        {
            var lab = StoryLabyrinthRunner.Instance;
            if (lab == null) { Fail("비경 실행기 없음"); return ""; }
            StoryLabyrinthState.ResetForTest();
            StoryLabyrinthState.Restore(0, 0);
            lab.StartRunWithSeed(20260824);
            lab.EnterNode(StoryLabyrinthData.NodeType.Boss, () => { });
            StoryEnemy boss = null;
            foreach (var e in lab.ActiveArenaEnemies) if (e.IsBoss) boss = e;
            if (boss == null) { Fail("비경 두목 없음"); return ""; }
            var runner = boss.GetComponent<StoryBossPatternRunner>();
            if (runner == null) { Fail("비경 두목에 패턴 실행기 없음"); return ""; }
            if (runner.MinX != StoryLabyrinthRunner.ArenaMinX || runner.MaxX != StoryLabyrinthRunner.ArenaMaxX) Fail($"비경 경계 {runner.MinX}~{runner.MaxX}");
            if (Mathf.Abs(boss.MaxHp - boss.Hp) > 0.01f) Fail($"비경 두목 최대 체력 {boss.MaxHp} ≠ 지금 {boss.Hp}(배율 곱한 값)");
            // 컷 없이 곧장 문다.
            runner.RandOverride = () => 0.1f;
            runner.State.Cd = 0f;
            var r = runner.Tick(0.01f);
            if (r == null || runner.State.Current == StoryBossPattern.Kind.None) Fail("비경 두목이 패턴을 안 문다");
            runner.ResetPattern();
            // 부르기 — 부하 둘이 방 적(비경 적)으로 들어 방이 안 끝난다.
            StoryBossPattern.Begin(runner.State, StoryBossPattern.Kind.Summon, runner, boss.transform.position.x);
            if (lab.ActiveArenaEnemies.Count != 3) Fail($"비경 부하가 방 적으로 안 듦 {lab.ActiveArenaEnemies.Count}");
            foreach (var mn in runner.Minions)
                if (!mn.IsLabyrinthEnemy || mn.transform.position.x < StoryLabyrinthRunner.ArenaMinX || mn.transform.position.x > StoryLabyrinthRunner.ArenaMaxX) Fail("비경 부하가 방 밖이거나 필드 적");
            // 쓰러짐 = 패퇴(재기 없음) — 회차 끝, 입구로.
            StoryPlayerHp.SetForTest(1f);
            StoryPlayerHp.Hurt(5f);
            if (lab.NodeActive || StoryLabyrinthState.InRun) Fail($"비경에서 쓰러졌는데 회차가 안 끝남(방 {lab.NodeActive}·회차 {StoryLabyrinthState.InRun})");
            if (player.position.x > 900f) Fail("비경에서 쓰러진 뒤 방에 남음");
            if (StoryPlayerHp.Hp != StoryPlayerHp.HpMax) Fail("비경에서 쓰러진 뒤 체력이 안 참");
            runner.RandOverride = null;
            return " 비경";
        }

        private static void Ticks(StoryBossPatternRunner runner, float sec)
        {
            const float Dt = 0.05f;
            for (float t = 0f; t < sec - 1e-4f; t += Dt)
            {
                runner.Tick(Mathf.Min(Dt, sec - t));
                StoryPlayerHp.Tick(0f);
            }
        }

        private static void Place(CharacterController cc, Transform player, Vector3 p)
        {
            if (cc != null) cc.enabled = false;
            player.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
