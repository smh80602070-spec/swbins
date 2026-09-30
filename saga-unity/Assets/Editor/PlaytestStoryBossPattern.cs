using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-11-1 "보스 패턴전"(웹 사가스토리 §5-9) 진단 — `PlaytestStorySlice` 준비 단계(세 시대 진단 뒤)가 부른다. 같은 프레임 안에서 끝낸다.
    /// 웹 진단 항목 그대로: 단계 문턱·목록 · 단계 전환 거둠·광폭 · 내려찍기 맞음/비킴 · 지진 섬/점프/발판 · 휩쓸기 밖/안(안전지대 닿는 거리·판 끝) ·
    /// 잇지 않음·부르기 단계에 한 번 · 실제 사냥터 루프(등장 컷 뒤 예고 그림·판정·체력) + 이 트랙 몫: 플레이어 체력(최대치·무적·회복·레벨업),
    /// 들판 쓰러짐(입구·두목 태세 되돌림·부하 거둠), 실제 비경 두목(방 경계·부하가 방 적·쓰러지면 패퇴).
    /// 109-11-2(웹 §5-10 진단 그대로): 고유 기술 표·첫 기술·후보 / 도넛·쇠뇌 / 화살비·불기둥 두 박자 / 쇠사슬·추적 / 그로기 셈·5초·×1.5 · 실제 들판(도넛 첫 기술·그로기)·비경(관문 수호장 추적).
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
            public int GroggyCount;

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
            public void PullPlayer(float dx) => FeetPos += new Vector2(dx, 0f);
            public void GroggyStarted() => GroggyCount++;
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
                   + CheckSigs() + CheckRingBeam() + CheckVolleyPillar() + CheckPullChase() + CheckGroggy() + CheckGateSig()
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
            if (_ok) Debug.Log($"{T} OK - 단계 문턱·목록·전환 거둠·광폭·내려찍기/낙석 맞음·비킴·지진 섬/점프/발판·휩쓸기 밖/안·잇지 않음·부르기 한 번·체력(최대치·무적·회복)·실제 들판 루프·쓰러짐·비경 두목 · 11-2 고유 기술 열둘·첫 기술·도넛·쇠뇌·화살비·불기둥 두 박자·쇠사슬·추적·그로기(셈·5초·×1.5·실제) · 11-3 관문 대장 돌림·4초·8초·미룸·무반응·실제 갈고리 |{m}");
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

        // ── 109-11-2 고유 기술·그로기(웹 §5-10) ─────────────────────
        private static string CheckSigs()
        {
            var ids = new HashSet<string>();
            var kinds = new Dictionary<StoryBossPattern.Kind, int>();
            foreach (var sg in StoryBossPattern.Sigs)
            {
                if (!ids.Add(sg.Id)) Fail($"고유 기술 id 겹침 {sg.Id}");
                kinds[sg.Kind] = (kinds.TryGetValue(sg.Kind, out var c) ? c : 0) + 1;
            }
            if (StoryBossPattern.Sigs.Length != 12) Fail($"고유 기술 {StoryBossPattern.Sigs.Length}(웹 열둘)");
            foreach (var k in new[] { StoryBossPattern.Kind.Ring, StoryBossPattern.Kind.Volley, StoryBossPattern.Kind.Beam, StoryBossPattern.Kind.Pillar, StoryBossPattern.Kind.Pull, StoryBossPattern.Kind.Chase })
                if (Get(kinds, k) != 2) Fail($"{k} 주인 {Get(kinds, k)}(웹 둘)");
            int field = StoryBossPattern.SigIndex("hwanggeon_chief"), gate = StoryBossPattern.SigIndex("gate_guardian");
            if (field < 0 || StoryBossPattern.Sigs[field].Kind != StoryBossPattern.Kind.Ring || gate < 0 || StoryBossPattern.Sigs[gate].Kind != StoryBossPattern.Kind.Chase
                || StoryBossPattern.SigIndex("nobody") != -1)
                Fail("황건 두목 = 도넛·관문 수호장 = 추적");
            // 첫 기술은 늘 고유 기술, 후보 끝에 낀다, 태세를 되돌리면 다시 첫 기술.
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State { Cd = 0f };
            StoryBossPattern.SetSig(s, StoryBossPattern.SigIndex("steppe_chief"));
            if (string.Join(",", StoryBossPattern.PoolOf(0, s.SigKind)) != "Slam,Rock,Volley") Fail("후보에 고유 기술이 안 낌");
            api.Rng = new System.Random(1);
            StoryBossPattern.Step(s, 0.01f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current != StoryBossPattern.Kind.Volley || s.First != StoryBossPattern.Kind.None) Fail($"첫 기술 {s.Current}(화살비)");
            StoryBossPattern.Clear(s);
            s.Cd = 0f;
            StoryBossPattern.Step(s, 0.01f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current == StoryBossPattern.Kind.Volley) Fail("고유 기술을 잇달아 씀");
            StoryBossPattern.Reset(s);
            if (s.First != StoryBossPattern.Kind.Volley) Fail("되돌린 뒤 첫 기술이 고유 기술이 아님");
            return " 고유 기술 열둘";
        }

        private static string CheckRingBeam()
        {
            var api = new FakeApi { FeetPos = new Vector2(20.5f, 0f) };
            var s = new StoryBossPattern.State();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Ring, api, 22f);
            if (Mathf.Abs(s.Cx - 22f) > 1e-4f || Mathf.Abs(s.T - 1.3f) > 1e-4f) Fail("도넛 가운데·1.3초");
            StoryBossPattern.Resolve(s, api, 10f); // 두목 곁 1.5m — 산다
            if (api.Hurts.Count != 0) Fail("도넛 안(두목 곁)인데 맞음");
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Ring, api, 22f);
            api.FeetPos = new Vector2(24.2f, 0f);
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 11f) Fail($"도넛 밖 {string.Join(",", api.Hurts)}(11)");
            api.Hurts.Clear();
            api.FeetPos = new Vector2(20f, 0.05f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Beam, api, 22f);
            StoryBossPattern.Resolve(s, api, 10f); // 땅에 붙음 — 산다
            if (api.Hurts.Count != 0) Fail("쇠뇌 — 땅에 붙었는데 맞음");
            api.Ground = false;
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Beam, api, 22f);
            StoryBossPattern.Resolve(s, api, 10f);
            api.Ground = true;
            api.FeetPos = new Vector2(20f, FieldMapData.Platforms()[0].Height);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Beam, api, 22f);
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 2 || api.Hurts[0] != 11f) Fail($"쇠뇌 — 뛰었거나 발판 위 {string.Join(",", api.Hurts)}(11 둘)");
            return " 도넛·쇠뇌";
        }

        private static string CheckVolleyPillar()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Volley, api, 25f);
            if (s.Marks.Count != 5) Fail($"화살비 {s.Marks.Count} 점");
            for (int i = 1; i < s.Marks.Count; i++)
                if (Mathf.Abs(s.Marks[i].X - s.Marks[i - 1].X - StoryBossPattern.VolleyGap) > 1e-3f) Fail("화살비 간격 2.2m");
            float j0 = s.Marks[2].X - 20f;
            if (Mathf.Abs(j0) > StoryBossPattern.VolleyJitter / 2f + 1e-4f) Fail($"화살비 흔들림 {j0:F2}");
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 8f) Fail($"화살비 맞음 {string.Join(",", api.Hurts)}(8)");
            api.Hurts.Clear();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Volley, api, 25f);
            api.FeetPos = new Vector2(s.Marks[2].X + StoryBossPattern.VolleyGap / 2f, 0f); // 틈
            StoryBossPattern.Resolve(s, api, 10f);
            if (api.Hurts.Count != 0) Fail("화살비 틈인데 맞음");

            // 불기둥 두 박자 — 첫 박자 홀수 칸(내 칸 빔), 둘째 짝수 칸. 한 칸 옮기면 산다, 두 박자는 그로기 셈 하나.
            api.FeetPos = new Vector2(20f, 0f);
            s = new StoryBossPattern.State { Cd = 100f };
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Pillar, api, 25f);
            if (s.Marks.Count != 4 || s.Wave != 1) Fail($"불기둥 첫 박자 {s.Marks.Count} 칸(넷)");
            foreach (var mk in s.Marks) if (Mathf.Abs(mk.X - 20f) < StoryBossPattern.PillarW) Fail("첫 박자가 내 칸에");
            Steps(s, api, 1.05f, 25f);
            if (s.Wave != 2 || s.Marks.Count != 3 || s.Current != StoryBossPattern.Kind.Pillar || api.Hurts.Count != 0) Fail($"둘째 박자 {s.Wave}·{s.Marks.Count} 칸·맞음 {api.Hurts.Count}");
            api.FeetPos = new Vector2(20f + StoryBossPattern.PillarGap, 0f); // 한 칸 옮겨 딛음
            Steps(s, api, 0.85f, 25f);
            if (s.Current != StoryBossPattern.Kind.None || api.Hurts.Count != 0 || s.Dodge != 1) Fail($"불기둥 비킴 — 맞음 {api.Hurts.Count}·셈 {s.Dodge}(하나)");
            api.FeetPos = new Vector2(20f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Pillar, api, 25f);
            Steps(s, api, 1.9f, 25f); // 가만히 — 둘째 박자에 맞음
            if (api.Hurts.Count != 1 || api.Hurts[0] != 10f || s.Dodge != 0) Fail($"불기둥 제자리 {string.Join(",", api.Hurts)}·셈 {s.Dodge}");
            return " 화살비·불기둥";
        }

        private static string CheckPullChase()
        {
            // 쇠사슬 — 1.4초 3m/s 로 끌리다 둘레 2.6m 폭발. 두목을 넘어가진 않는다. 거슬러 달리면(6m/s) 산다.
            var api = new FakeApi { FeetPos = new Vector2(27f, 0f) };
            var s = new StoryBossPattern.State { Cd = 100f };
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Pull, api, 22f);
            Steps(s, api, 1.45f, 22f);
            if (Mathf.Abs(api.FeetPos.x - (27f - StoryBossPattern.PullV * StoryBossPattern.PullT)) > 0.2f) Fail($"끌림 {api.FeetPos.x:F2}(약 22.8~23)");
            if (api.Hurts.Count != 1 || api.Hurts[0] != 14f) Fail($"쇠사슬 맞음 {string.Join(",", api.Hurts)}(14)");
            api.Hurts.Clear();
            api.FeetPos = new Vector2(22.5f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Pull, api, 22f);
            Steps(s, api, 1.45f, 22f);
            if (Mathf.Abs(api.FeetPos.x - 22f) > 1e-3f) Fail($"두목을 넘어 끌림 {api.FeetPos.x:F2}");
            api.Hurts.Clear();
            api.FeetPos = new Vector2(25f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Pull, api, 22f);
            for (int i = 0; i < 16 && s.Current != StoryBossPattern.Kind.None; i++)
            {
                api.FeetPos += new Vector2(6f * 0.1f, 0f); // 거슬러 달림
                StoryBossPattern.Step(s, 0.1f, api, false, 100f, 100f, 22f, 10f);
            }
            if (api.Hurts.Count != 0) Fail($"쇠사슬 — 거슬러 달렸는데 맞음(끝 자리 {api.FeetPos.x:F2})");

            // 추적 — 1초 따라오다 0.5초 멈춘 뒤 터짐.
            api.FeetPos = new Vector2(20f, 0f);
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Chase, api, 25f);
            for (int i = 0; i < 9; i++) { api.FeetPos += new Vector2(0.1f, 0f); StoryBossPattern.Step(s, 0.1f, api, false, 100f, 100f, 25f, 10f); }
            if (Mathf.Abs(s.Marks[0].X - api.FeetPos.x) > 1e-3f) Fail($"추적이 안 따라옴 {s.Marks[0].X:F2} ≠ {api.FeetPos.x:F2}");
            Steps(s, api, 0.15f, 25f); // 0.45초 남음 — 멈춤
            float locked = s.Marks[0].X;
            api.FeetPos += new Vector2(2f, 0f);
            Steps(s, api, 0.2f, 25f);
            if (s.Current != StoryBossPattern.Kind.Chase || Mathf.Abs(s.Marks[0].X - locked) > 1e-4f) Fail("멈춘 뒤에도 따라옴");
            Steps(s, api, 0.4f, 25f);
            if (api.Hurts.Count != 0 || s.Current != StoryBossPattern.Kind.None) Fail("추적 — 멈춘 뒤 비켰는데 맞음");
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Chase, api, 25f);
            Steps(s, api, 1.55f, 25f);
            if (api.Hurts.Count != 1 || api.Hurts[0] != 14f) Fail($"추적 제자리 {string.Join(",", api.Hurts)}(14)");
            return " 쇠사슬·추적";
        }

        private static string CheckGroggy()
        {
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State { Cd = 100f };
            void Dodge()
            {
                StoryBossPattern.Begin(s, StoryBossPattern.Kind.Slam, api, 25f);
                api.FeetPos = new Vector2(30f, 0f);
                StoryBossPattern.Resolve(s, api, 10f);
                api.FeetPos = new Vector2(20f, 0f);
            }
            Dodge(); Dodge();
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Slam, api, 25f);
            StoryBossPattern.Resolve(s, api, 10f); // 맞음 — 셈 0
            if (s.Dodge != 0 || s.Groggy > 0f) Fail("맞았는데 셈이 남음");
            Dodge(); Dodge();
            // 부르기는 셈에 안 든다.
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Summon, api, 25f);
            Steps(s, api, 0.5f, 25f);
            if (s.Dodge != 2 || s.Groggy > 0f) Fail($"부르기가 셈에 듦 {s.Dodge}");
            Dodge();
            if (s.Groggy != StoryBossPattern.GroggyT || s.Dodge != 0 || s.GroggyCount != 1 || api.GroggyCount != 1) Fail($"셋 잇달아 피해도 그로기 아님({s.Groggy}·셈 {s.Dodge})");
            if (StoryBossPattern.DamageTakenMul(s) != 1.5f) Fail("그로기 받는 피해 ×1.5");
            // 5초 동안 새 패턴 없음 → 끝나면 1초 안에 다시.
            s.Cd = 0f;
            int begun = s.Begun;
            for (int i = 0; i < 49; i++) StoryBossPattern.Step(s, 0.1f, api, true, 100f, 100f, 25f, 10f);
            if (s.Begun != begun || s.Groggy <= 0f) Fail("그로기 중 새 패턴");
            StoryBossPattern.Step(s, 0.11f, api, true, 100f, 100f, 25f, 10f);
            if (s.Groggy != 0f || s.Cd > 1f || StoryBossPattern.DamageTakenMul(s) != 1f) Fail($"그로기가 안 끝남 {s.Groggy}");
            return " 그로기";
        }

        /// <summary>순수 판정을 dt 0.05 로 굴린다(새 패턴은 안 물게 near=false).</summary>
        private static void Steps(StoryBossPattern.State s, FakeApi api, float sec, float bossX)
        {
            for (float t = 0f; t < sec - 1e-4f; t += 0.05f)
                StoryBossPattern.Step(s, Mathf.Min(0.05f, sec - t), api, false, 100f, 100f, bossX, 10f);
        }

        // ── 109-11-3 관문 대장 고유 기술(웹 §5-11) ─────────────────────
        private static string CheckGateSig()
        {
            // 주마다 다섯이 돌아가며, 다섯 주 뒤 처음으로.
            var seen = new HashSet<string>();
            for (int w = 0; w < 5; w++)
            {
                int gi = StoryBossPattern.GateCaptainIndex(3000 + w);
                if (gi < 0) { Fail($"관문 대장 {w} 번이 표에 없음"); continue; }
                seen.Add(StoryBossPattern.Sigs[gi].Id);
            }
            if (seen.Count != 5 || StoryBossPattern.GateCaptainIndex(3000) != StoryBossPattern.GateCaptainIndex(3005) || StoryBossPattern.GateCaptainIndex(-1) < 0)
                Fail($"관문 대장 돌림 {seen.Count}(다섯)");
            foreach (var id in StoryBossPattern.GateCaptains) if (id == "hwanggeon_chief" || id == "gate_guardian") Fail("관문 대장에 두목·수호장이 낌");

            // 첫 4초 뒤 첫 시전, 그 뒤 8초 — 공용 후보엔 안 낀다.
            var api = new FakeApi { FeetPos = new Vector2(20f, 0f) };
            var s = new StoryBossPattern.State();
            StoryBossPattern.SetGateSig(s, StoryBossPattern.SigIndex("khitan_marshal"));
            s.Cd = 100f;
            if (s.First != StoryBossPattern.Kind.None || s.SigCd != StoryBossPattern.GateSigFirst) Fail("관문 대장 첫 기술 강제·첫 시계");
            float t = 0f;
            while (s.Current == StoryBossPattern.Kind.None && t < 6f) { StoryBossPattern.Step(s, 0.02f, api, true, 100f, 100f, 22f, 10f); t += 0.02f; }
            if (s.Current != StoryBossPattern.Kind.Beam || Mathf.Abs(t - 4f) > 0.05f || s.SigCd != StoryBossPattern.GateSigCd) Fail($"첫 시전 {s.Current} {t:F2}초(4)·다음 {s.SigCd}(8)");
            StoryBossPattern.Clear(s);
            s.Cd = 0f;
            s.SigCd = 100f;
            for (int i = 0; i < 60; i++)
            {
                StoryBossPattern.Clear(s);
                s.Cd = 0f;
                StoryBossPattern.Step(s, 0.01f, api, true, 100f, 100f, 22f, 10f);
                if (s.Current == StoryBossPattern.Kind.Beam) { Fail("공용 후보에 관문 대장 기술이 낌"); break; }
            }
            // 다른 패턴이 걸려 있으면 미룬다(그동안 시계도 안 준다).
            StoryBossPattern.Clear(s);
            s.Cd = 100f;
            s.SigCd = 0.5f;
            StoryBossPattern.Begin(s, StoryBossPattern.Kind.Slam, api, 22f);
            api.FeetPos = new Vector2(30f, 0f);
            StoryBossPattern.Step(s, 0.6f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current != StoryBossPattern.Kind.Slam || s.SigCd != 0.5f) Fail($"패턴 중인데 시계가 감 {s.SigCd}");
            StoryBossPattern.Step(s, 0.5f, api, true, 100f, 100f, 22f, 10f); // 내려찍기 판정
            StoryBossPattern.Step(s, 0.3f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current != StoryBossPattern.Kind.None) Fail($"시계 전에 시전 {s.Current}");
            StoryBossPattern.Step(s, 0.3f, api, true, 100f, 100f, 22f, 10f);
            if (s.Current != StoryBossPattern.Kind.Beam) Fail($"미룬 뒤 시전 안 됨 {s.Current}");
            // 태세를 되돌리면 다시 4초, 이름 없는 두목은 무반응.
            StoryBossPattern.Reset(s);
            if (s.SigCd != StoryBossPattern.GateSigFirst || s.First != StoryBossPattern.Kind.None || !s.Gate) Fail("관문 대장 되돌림");
            var none = new StoryBossPattern.State();
            StoryBossPattern.SetGateSig(none, -1);
            none.Cd = 100f;
            for (int i = 0; i < 100; i++) StoryBossPattern.Step(none, 0.1f, api, true, 100f, 100f, 22f, 10f);
            if (none.Begun != 0) Fail("이름 없는 관문 대장이 고유 기술을 씀");
            return " 관문 대장(돌림·4초·8초·미룸·무반응)";
        }

        /// <summary>실제 들판 — 이번 주 관문 대장 기술이 공용 패턴 뒤로 미뤄졌다가 제 시계로 걸린다(쇠사슬로 끌림).</summary>
        private static string CheckFieldGate(Transform player, StoryEnemy boss, StoryBossPatternRunner runner)
        {
            var cc = player.GetComponent<CharacterController>();
            runner.ConfigureSig(StoryBossPattern.SigIndex("pirate_captain"), true);
            runner.RandOverride = () => 0.1f;
            runner.OnGroundOverride = () => true;
            StoryPlayerHp.Refill();
            Place(cc, player, new Vector3(boss.transform.position.x - 3f, 0.05f, 0f));
            TickUntil(runner, () => runner.State.Current != StoryBossPattern.Kind.None, 3.5f);
            if (runner.State.Current != StoryBossPattern.Kind.Slam) Fail($"관문 대장 첫 패턴 {runner.State.Current}(공용 내려찍기 — 고유 기술은 4초 시계)");
            float sigLeft = runner.State.SigCd;
            TickUntil(runner, () => runner.State.Current == StoryBossPattern.Kind.None, 1.2f);
            if (Mathf.Abs(runner.State.SigCd - sigLeft) > 0.06f) Fail($"공용 패턴 중에 고유 기술 시계가 감 {sigLeft:F2}→{runner.State.SigCd:F2}");
            StoryPlayerHp.Tick(1f);
            TickUntil(runner, () => runner.State.Current != StoryBossPattern.Kind.None, sigLeft + 0.2f);
            if (runner.State.Current != StoryBossPattern.Kind.Pull || Mathf.Abs(runner.State.SigCd - StoryBossPattern.GateSigCd) > 1e-3f)
                Fail($"미룬 뒤 고유 기술 {runner.State.Current}(갈고리)·다음 {runner.State.SigCd:F2}(8)");
            float x0 = player.position.x;
            float hp = StoryPlayerHp.Hp;
            TickUntil(runner, () => runner.State.Current == StoryBossPattern.Kind.None, 1.6f);
            if (player.position.x - x0 < 1f) Fail($"갈고리에 안 끌림 {x0:F2}→{player.position.x:F2}");
            if (hp - StoryPlayerHp.Hp != 15f) Fail($"갈고리 피해 {hp - StoryPlayerHp.Hp}(15)");
            runner.RandOverride = null;
            runner.OnGroundOverride = null;
            runner.ApplyOwnerSig();
            return $" 관문 대장 실제(끌림 {player.position.x - x0:F1}m)";
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
            // 109-11-3 — 새 게임은 관문 대장으로 승격해 있다 → 이번 주 관문 대장의 이름·기술(8초 시계). 아니면 황건 두목 도넛.
            if (boss.IsChampion)
            {
                int gi = StoryBossPattern.GateCaptainIndex(StoryLabyrinthState.CurrentWeekIndex());
                if (boss.BossSigId != StoryBossPattern.Sigs[gi].Id || !runner.State.Gate || runner.State.SigIndex != gi || boss.DisplayName != StoryBossPattern.SigBoss(gi))
                    Fail($"관문 대장 {boss.BossSigId}·{boss.DisplayName}·gate {runner.State.Gate}(이번 주 {StoryBossPattern.Sigs[gi].Id})");
            }
            else if (boss.BossSigId != "hwanggeon_chief" || runner.State.SigKind != StoryBossPattern.Kind.Ring || runner.State.Gate)
                Fail($"들판 두목 고유 기술 {boss.BossSigId}·{runner.State.SigKind}(도넛)");
            var cc = player.GetComponent<CharacterController>();
            float hp0 = boss.Hp;
            if (Mathf.Abs(boss.MaxHp - hp0) > 0.01f) Fail($"두목 최대 체력 {boss.MaxHp} ≠ 지금 {hp0}");
            if (runner.MinX != 0f || Mathf.Abs(runner.MaxX - FieldMapData.WidthM) > 1e-3f) Fail($"들판 경계 {runner.MinX}~{runner.MaxX}");
            runner.ConfigureSig(StoryBossPattern.SigIndex("hwanggeon_chief"), false); // 아래 1)~7) 은 보통 두목(도넛) 결로 본다
            runner.RandOverride = () => 0.1f; // 고유 기술 뒤로는 목록 첫째
            runner.OnGroundOverride = () => true;
            StoryPlayerHp.Refill();
            Place(cc, player, new Vector3(boss.transform.position.x - 3f, 0.05f, 0f));

            // 1) 첫 패턴까지 3.2초 — 첫 기술은 고유 기술 도넛(판 전체 붉은 막 + 두목 곁 초록).
            Ticks(runner, 3.1f);
            if (runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0) Fail("3.2초 전에 패턴");
            TickUntil(runner, () => runner.State.Current != StoryBossPattern.Kind.None, 0.3f);
            int red = 0, safe = 0;
            foreach (var w in runner.Warns) if (w != null) { if (w.Kind == StoryBossWarnFx.Look.SweepRed) red++; else if (w.Kind == StoryBossWarnFx.Look.SweepSafe) safe++; }
            if (runner.State.Current != StoryBossPattern.Kind.Ring || safe != 1 || red < 1) Fail($"첫 기술 {runner.State.Current}·붉은 {red}·초록 {safe}(도넛)");
            // 2) 도넛 밖(3m)이면 맞는다 — Lv.1 힘 11 × 1.1 = 12.
            float hpBefore = StoryPlayerHp.Hp;
            TickUntil(runner, () => runner.State.Current == StoryBossPattern.Kind.None, 1.5f);
            if (runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0) Fail("판정 뒤에도 예고가 남음");
            if (hpBefore - StoryPlayerHp.Hp != 12f) Fail($"도넛 피해 {hpBefore - StoryPlayerHp.Hp}(12)");
            // 3) 내려찍기(도넛은 안 잇는다) — 그 자리에 서 있으면 14.
            StoryPlayerHp.Tick(1f);
            TickUntil(runner, () => runner.State.Current != StoryBossPattern.Kind.None, 7f);
            if (runner.State.Current != StoryBossPattern.Kind.Slam || runner.Warns.Count != 1 || runner.Warns[0] == null || runner.Warns[0].Kind != StoryBossWarnFx.Look.Circle)
                Fail($"둘째 패턴 {runner.State.Current}·그림 {runner.Warns.Count}(내려찍기)");
            hpBefore = StoryPlayerHp.Hp;
            TickUntil(runner, () => runner.State.Current == StoryBossPattern.Kind.None, 1.2f);
            if (hpBefore - StoryPlayerHp.Hp != 14f) Fail($"내려찍기 피해 {hpBefore - StoryPlayerHp.Hp}(14)");
            // 4) 낙석 — 비키면 안 맞는다. 셋째로 잇달아 피한 셈이면 그로기.
            StoryPlayerHp.Tick(1f);
            TickUntil(runner, () => runner.State.Current != StoryBossPattern.Kind.None, 7f);
            if (runner.State.Current != StoryBossPattern.Kind.Rock || runner.Warns.Count != 3) Fail($"셋째 패턴 {runner.State.Current}·그림 {runner.Warns.Count}(낙석 셋)");
            Place(cc, player, new Vector3(player.position.x + 1.3f, 0.05f, 0f)); // 줄기 사이
            runner.State.Dodge = 2;
            hpBefore = StoryPlayerHp.Hp;
            TickUntil(runner, () => runner.State.Current == StoryBossPattern.Kind.None, 1.3f);
            if (StoryPlayerHp.Hp != hpBefore) Fail("낙석 비켰는데 맞음");
            if (runner.State.Groggy <= 4.5f || runner.State.GroggyCount != 1 || runner.GroggyLabelText == null || !runner.GroggyLabelText.Contains("★"))
                Fail($"실제 그로기 {runner.State.Groggy:F2}·글자 {runner.GroggyLabelText}");
            float bh = boss.Hp;
            boss.TakeDamage(10f);
            if (Mathf.Abs(bh - boss.Hp - 15f) > 0.01f) Fail($"그로기 받는 피해 {bh - boss.Hp}(15)");
            runner.State.Cd = 0f;
            Ticks(runner, 4.4f);
            if (runner.State.Current != StoryBossPattern.Kind.None || runner.State.Groggy <= 0f) Fail("그로기 중 새 패턴");
            TickUntil(runner, () => runner.State.Groggy <= 0f, 1f);
            if (runner.State.Groggy > 0f || runner.GroggyLabelText != null) Fail("그로기가 안 끝남·글자 남음");

            // 5) 2단계 — 포효·부하 둘(들판 잡졸), 3단계 — 휩쓸기 예고(붉은 막 + 초록 기둥).
            runner.ResetPattern();
            runner.State.First = StoryBossPattern.Kind.None;
            boss.TakeDamage(boss.MaxHp * 0.4f);
            var r = runner.Tick(0.01f);
            if (r == null || !r.Value.Changed || runner.State.Phase != 1) Fail("실제 2단계 전환");
            runner.State.Cd = 0f;
            runner.State.Last = StoryBossPattern.Kind.None;
            runner.RandOverride = () => 0.7f; // 목록 [내려찍기·낙석·지진·부르기·도넛] 넷째
            runner.Tick(0.01f);
            if (runner.State.Current != StoryBossPattern.Kind.Summon || runner.Minions.Count != 2) Fail($"부르기 {runner.State.Current}·부하 {runner.Minions.Count}");
            foreach (var mn in runner.Minions) if (mn.IsBoss || mn.IsLabyrinthEnemy || mn.IsDead) Fail("부하가 두목·비경 적이거나 죽음");
            boss.TakeDamage(boss.MaxHp * 0.3f);
            runner.Tick(0.5f);
            runner.Tick(0.01f);
            if (runner.State.Phase != 2) Fail($"실제 3단계 {runner.State.Phase}");
            runner.State.Cd = 0f;
            runner.State.Last = StoryBossPattern.Kind.None;
            runner.Tick(0.01f); // [내려찍기·낙석·지진·휩쓸기·도넛] 넷째
            red = 0; safe = 0;
            foreach (var w in runner.Warns) if (w != null) { if (w.Kind == StoryBossWarnFx.Look.SweepRed) red++; else if (w.Kind == StoryBossWarnFx.Look.SweepSafe) safe++; }
            if (runner.State.Current != StoryBossPattern.Kind.Sweep || safe != 1 || red < 1) Fail($"휩쓸기 예고 {runner.State.Current}·붉은 {red}·안전 {safe}");
            // 6) 쓰러짐 — 들판 입구에서 일어서고, 두목은 체력 가득·1단계·부하 거둠·첫 기술 다시 도넛.
            StoryPlayerHp.SetForTest(1f);
            int falls = StoryPlayerHp.Falls;
            StoryPlayerHp.Hurt(5f);
            if (StoryPlayerHp.Falls != falls + 1) Fail("쓰러짐 이벤트 없음");
            if (Mathf.Abs(player.position.x - StoryPlayerVitals.FieldRespawn.x) > 0.01f) Fail($"쓰러진 뒤 자리 {player.position.x:F2}(입구 2m)");
            if (StoryPlayerHp.Hp != StoryPlayerHp.HpMax) Fail($"일어선 체력 {StoryPlayerHp.Hp}");
            if (Mathf.Abs(boss.Hp - boss.MaxHp) > 0.01f || runner.State.Phase != 0 || runner.State.Current != StoryBossPattern.Kind.None || runner.Warns.Count != 0
                || runner.State.First != StoryBossPattern.Kind.Ring)
                Fail($"두목 태세 되돌림(체력 {boss.Hp}/{boss.MaxHp}·단계 {runner.State.Phase}·걸림 {runner.State.Current}·첫 기술 {runner.State.First})");
            if (runner.Minions.Count != 0) Fail($"부하가 남음 {runner.Minions.Count}");
            // 7) 멀면(입구) 새 패턴 없음.
            runner.State.Cd = 0f;
            runner.Tick(0.01f);
            if (runner.State.Current != StoryBossPattern.Kind.None) Fail("입구(멀리)에서도 패턴");
            runner.RandOverride = null;
            runner.OnGroundOverride = null;
            runner.ResetPattern();
            string gateM = CheckFieldGate(player, boss, runner);
            if (boss.IsChampion && !runner.State.Gate) Fail("관문 대장 기술이 되돌려지지 않음");
            return $" 들판(피해 {runner.DamageDealt:0}·맞음 {runner.Hits}·그로기 1)" + gateM;
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
            string wantName = StoryBossPattern.SigBoss(StoryBossPattern.SigIndex("gate_guardian"));
            if (boss.BossSigId != "gate_guardian" || boss.DisplayName != wantName) Fail($"비경 두목 {boss.BossSigId}·{boss.DisplayName}(관문 수호장)");
            // 컷 없이 곧장 문다 — 첫 기술 = 수호 인장 추적(보라 원이 발을 따라온다).
            var cc = player.GetComponent<CharacterController>();
            StoryPlayerHp.Refill();
            runner.RandOverride = () => 0.1f;
            runner.State.Cd = 0f;
            var r = runner.Tick(0.01f);
            if (r == null || runner.State.Current != StoryBossPattern.Kind.Chase || runner.Warns.Count != 1) Fail($"비경 두목 첫 기술 {runner.State.Current}(추적)");
            Place(cc, player, new Vector3(player.position.x + 1f, player.position.y, 0f));
            runner.Tick(0.3f);
            if (runner.Warns.Count == 1 && runner.Warns[0] != null && Mathf.Abs(runner.Warns[0].transform.position.x - player.position.x) > 1e-3f)
                Fail($"추적 예고가 안 따라옴 {runner.Warns[0].transform.position.x:F2} ≠ {player.position.x:F2}");
            runner.Tick(0.7f); // 0.5초 남음 — 멈춤(건 걸음은 시간이 안 준다)
            Place(cc, player, new Vector3(player.position.x + 2f, player.position.y, 0f));
            int hits = runner.Hits;
            runner.Tick(0.55f);
            if (runner.Hits != hits || runner.State.Current != StoryBossPattern.Kind.None) Fail("추적 — 멈춘 뒤 비켰는데 맞음");
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
            return " 비경(관문 수호장·추적)";
        }

        /// <summary>조건이 설 때까지 dt 0.05 로 굴린다(부동소수 누적으로 고정 시간이 한 걸음 어긋나지 않게).</summary>
        private static void TickUntil(StoryBossPatternRunner runner, System.Func<bool> done, float maxSec)
        {
            for (float t = 0f; t < maxSec && !done(); t += 0.05f)
            {
                runner.Tick(0.05f);
                StoryPlayerHp.Tick(0f);
            }
            if (!done()) Fail($"{maxSec}초 안에 조건이 안 섬(걸림 {runner.State.Current}·T {runner.State.T:F2}·cd {runner.State.Cd:F2})");
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
