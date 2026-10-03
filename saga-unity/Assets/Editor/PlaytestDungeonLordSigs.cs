using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-9 명소 층 주인 고유 수(웹 사가블로 §5.18) 진단 — `PlaytestDungeonHeadless` 가 동행 서명 뒤에 부른다(한 프레임 안, 시간은 넣어서).
    /// 웹 진단 넷(표 / 화살비 서면 맞음·비키면 안 맞음·쿨·게임 틱이 부름 / 삼연돌 세 번·소용돌이 끌림 / 장판 틱·꺼짐·호령 두 번·손잡이)을 이 트랙에 맞춰,
    /// 명소 층 여섯을 차례로 뛰어 **진짜 주인 방**(`BuildRoomForTest(lord)`)의 주인으로 본다: 표(여섯 = 명소 키·갈래 여섯·px→m·모양·순수·예고 원 크기 고정) ·
    /// 붙임(주인마다 제 수) · 화살비(원 셋·첫 알림 한 번·서면 맞음·비키면 안 맞음·재사용 7·방향 돎)·주인 Tick 이 부르고 그동안 강타 안 함 ·
    /// 삼연돌(세 번 뛰어듦·주인이 내 자리로·재사용 8) · 소용돌이(끌림 2.5m/s·멈춤 거리·구르면 안 끌림·안 맞음) · 장판(불바닥 0.5초 틱·넷까지·6초 뒤 꺼짐·주인 쓰러지면 지움) ·
    /// 십자(원 스물·+/× 번갈아) · 호령(⅔·⅓ 에 둘씩 = 방 적 +4·한 문턱 한 번·강타 안 쉼) · 손잡이 끔 · ko/en.
    /// 끝나면 층·명소 기록·영웅·도감·자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonLordSigs
    {
        private const string T = "[PlaytestDungeonHeadless] lordsigs";
        private static bool _ok;
        private const string ProcRoomId = "procroom"; // DungeonFloorRunner.RoomId(비공개)

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            int[] clears0 = LandmarkState.Snapshot();
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                DungeonLordSigs.Enabled = true;
                HeroState.Restore(60, 0, 999999, gold, weapon, gem); // 깊은 층 주인 한 방에 안 쓰러지게
                m += CheckTable();
                for (int i = 0; i < DungeonLandmarkData.All.Length; i++) m += CheckLord(runner, playerGo, i);
                m += CheckLocalization();
            }
            finally
            {
                DungeonLordSigs.Enabled = true;
                HeroState.Invulnerable = false;
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                LandmarkState.Restore(clears0);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                foreach (var z in Object.FindObjectsByType<LordZoneFx>(FindObjectsSortMode.None)) Object.DestroyImmediate(z.gameObject);
                Place(playerGo, pos);
            }
            if (_ok) Debug.Log($"{T} OK - 표(여섯·갈래·px→m·모양·순수)·주인마다 제 수 · 화살비(원 셋·알림 한 번·서면 맞음·비키면 안 맞음·쿨·방향 돎·주인 틱·강타 쉼) · 삼연돌 세 번 · 소용돌이 끌림·구르기 · 장판 틱·넷·꺼짐·쓰러지면 지움 · 십자 스물·번갈아 · 호령 두 번 · 손잡이 · ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var all = DungeonLordSigs.All;
            if (all.Length != 7) Fail($"고유 수 {all.Length} ≠ 7");
            var kinds = new HashSet<DungeonLordSigs.Kind>();
            for (int i = 0; i < DungeonLandmarkData.All.Length; i++)
            {
                if (!DungeonLordSigs.TryFor(i, out var s) || s.Key != DungeonLandmarkData.All[i].Key) { Fail($"명소 {i} 에 수 없음"); continue; }
                kinds.Add(s.Kind);
                if (s.Kind != DungeonLordSigs.Kind.Summon && (s.Cd <= 0f || s.Warn <= 0f || s.R <= 0f || s.Mul <= 0f)) Fail($"{s.Key} 수치 빔");
            }
            if (kinds.Count != 6) Fail($"갈래 {kinds.Count} ≠ 6");
            if (DungeonLordSigs.TryFor(-1, out _) || DungeonLordSigs.TryFor(7, out _)) Fail("명소 밖에 수");
            DungeonLordSigs.TryFor(1, out var rain);
            if (Mathf.Abs(rain.R - 1.75f) > 0.001f || Mathf.Abs(rain.Spread - 55f / 24f) > 0.001f) Fail($"화살비 px→m {rain.R}·{rain.Spread}");
            // 모양 — 순수·크기 고정
            Vector3 g = new Vector3(10f, 0f, 10f), p = new Vector3(14f, 0f, 10f);
            var z0 = DungeonLordSigs.Zones(rain, g, p, 0);
            var z0b = DungeonLordSigs.Zones(rain, g, p, 0);
            var z1 = DungeonLordSigs.Zones(rain, g, p, 1);
            if (z0.Count != 3 || (z0[0].C - p).sqrMagnitude > 1e-6f) Fail("화살비 원 셋·첫 원 = 내 자리");
            for (int i = 0; i < z0.Count; i++)
            {
                if ((z0[i].C - z0b[i].C).sqrMagnitude > 1e-9f) Fail("같은 입력에 다른 자리(순수 아님)");
                if (!Mathf.Approximately(z0[i].R, rain.R)) Fail("원 크기가 고정이 아님");
            }
            if (Mathf.Abs(Vector3.Distance(z0[1].C, p) - rain.Spread) > 0.001f || Vector3.Dot(z0[1].C - p, z0[2].C - p) >= 0f) Fail("양옆 원 자리");
            if ((z0[1].C - z1[1].C).sqrMagnitude < 0.01f) Fail("시전마다 방향이 안 돎");
            DungeonLordSigs.TryFor(5, out var cross);
            var c0 = DungeonLordSigs.Zones(cross, g, p, 0);
            var c1 = DungeonLordSigs.Zones(cross, g, p, 1);
            if (c0.Count != 20 || c1.Count != 20) Fail($"십자 원 {c0.Count} ≠ 20");
            if (!DungeonLordSigs.InZones(c0, g + new Vector3(cross.Gap, 0f, 0f)) || DungeonLordSigs.InZones(c1, g + new Vector3(cross.Gap, 0f, 0f)))
                Fail("십자 + / × 번갈아가 아님");
            DungeonLordSigs.TryFor(3, out var vortex);
            var v = DungeonLordSigs.Zones(vortex, g, p, 0);
            if (v.Count != 1 || Mathf.Abs(v[0].C.x - g.x) > 1e-4f) Fail("소용돌이 원 = 주인 자리");
            return " 표";
        }

        private static string CheckLord(DungeonFloorRunner runner, GameObject playerGo, int li)
        {
            var lm = DungeonLandmarkData.All[li];
            runner.JumpToFloor(lm.Floor);
            runner.BuildRoomForTest(DungeonLandmarkData.LordKind);
            var lord = runner.Lord;
            if (lord == null || lord.LordSig == null) { Fail($"{lm.Key} 주인·고유 수 없음"); return ""; }
            var sig = lord.LordSig;
            if (sig.Sig.Key != lm.Key) Fail($"{lm.Key} 주인에 {sig.Sig.Key} 수");
            var pc = playerGo.GetComponent<PlayerController>();
            var pt = playerGo.transform;
            Vector3 L = lord.transform.position;
            Vector3 fwd = lord.transform.forward;
            Vector3 right = lord.transform.right;
            HeroState.FullHeal();
            HeroState.Invulnerable = false;
            switch (sig.Sig.Kind)
            {
                case DungeonLordSigs.Kind.Rain: return CheckRain(lord, sig, playerGo, pc, L + fwd * 3f);
                case DungeonLordSigs.Kind.Hops:
                {
                    Place(playerGo, L + fwd * 4f);
                    sig.SetCooldownForTest(0f);
                    int hits0 = sig.PlayerHits;
                    sig.Tick(0.01f, true, pt);
                    for (int k = 0; k < 3; k++) sig.Tick(sig.Sig.Warn, true, pt);
                    Vector3 lp = lord.transform.position;
                    if (sig.Casts != 3 || sig.Busy || !Mathf.Approximately(sig.CooldownLeft, sig.Sig.Cd)) Fail($"삼연돌 {sig.Casts}번·재사용 {sig.CooldownLeft}");
                    if (Flat(lp, pt.position) > 0.01f) Fail("삼연돌 — 주인이 내 자리로 안 뜀");
                    if (sig.PlayerHits - hits0 != 3) Fail($"삼연돌 맞음 {sig.PlayerHits - hits0} ≠ 3");
                    return " 삼연돌 3";
                }
                case DungeonLordSigs.Kind.Vortex:
                {
                    Place(playerGo, L + fwd * 3.5f);
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    float d0 = Flat(pt.position, L);
                    sig.Tick(0.5f, true, pt);
                    float pulled = d0 - Flat(pt.position, L);
                    float want = Mathf.Min(d0 - DungeonLordSigs.VortexStop, sig.Sig.Pull * 0.5f);
                    if (Mathf.Abs(pulled - want) > 0.05f) Fail($"끌림 {pulled:0.00}m ≠ {want:0.00}");
                    sig.Tick(5f, true, pt); // 터짐 — 원 안
                    if (sig.PlayerHits != 1) Fail("소용돌이 안 맞음");
                    // 구르는 중엔 안 끌리고 안 맞는다
                    Place(playerGo, L + fwd * 3.5f);
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    pc.TryDodge();
                    string dodge = " 구르기 확인 못 함(재사용)";
                    if (pc.IsDodging)
                    {
                        Vector3 before = pt.position;
                        sig.Tick(0.3f, true, pt);
                        if (Flat(before, pt.position) > 0.001f) Fail("구르는데 끌림");
                        HeroState.Invulnerable = true;
                        int h = sig.PlayerHits;
                        sig.Tick(5f, true, pt);
                        if (sig.PlayerHits != h) Fail("구르기 무적인데 맞음");
                        dodge = " 구르기 OK";
                    }
                    pc.Teleport(pt.position);
                    HeroState.Invulnerable = false;
                    return $" 끌림 {pulled:0.00}m{dodge}";
                }
                case DungeonLordSigs.Kind.Pool:
                {
                    Place(playerGo, L + fwd * 3f);
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    sig.Tick(sig.Sig.Warn, true, pt);
                    if (sig.PoolCount != 1 || sig.PlayerHits != 1) Fail($"장판 {sig.PoolCount}·맞음 {sig.PlayerHits}");
                    int h = sig.PlayerHits;
                    sig.Tick(0.01f, false, pt);                   // 불바닥 첫 틱
                    sig.Tick(DungeonLordSigs.PoolTickSec, false, pt); // 둘째
                    if (sig.PlayerHits - h != 2) Fail($"불바닥 틱 {sig.PlayerHits - h} ≠ 2");
                    // 넷까지 — 자리를 옮기며 다섯 번
                    for (int k = 0; k < 5; k++)
                    {
                        Place(playerGo, L + fwd * 3f + right * (k * 2.5f - 5f));
                        sig.SetCooldownForTest(0f);
                        sig.Tick(0.01f, false, pt);
                        sig.Tick(0.01f, true, pt);
                        sig.Tick(sig.Sig.Warn, true, pt);
                    }
                    if (sig.PoolCount != sig.Sig.MaxPools) Fail($"불바닥 {sig.PoolCount} ≠ {sig.Sig.MaxPools}");
                    sig.SetCooldownForTest(999f);
                    sig.Tick(sig.Sig.Last + 0.1f, true, pt);
                    if (sig.PoolCount != 0) Fail("6초 뒤에도 불바닥");
                    // 주인이 쓰러지면 지움
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    sig.Tick(sig.Sig.Warn, true, pt);
                    int fx = Object.FindObjectsByType<LordZoneFx>(FindObjectsSortMode.None).Length;
                    lord.TakeDamage(1e9f);
                    if (sig.PoolCount != 0) Fail("주인이 쓰러졌는데 불바닥");
                    return $" 장판 넷(고리 {fx})";
                }
                case DungeonLordSigs.Kind.Cross:
                {
                    Place(playerGo, L + new Vector3(sig.Sig.Gap, 0f, 0f));
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    if (sig.WarnRings != 20) Fail($"십자 예고 원 {sig.WarnRings}");
                    bool even = (sig.Casts - 1) % 2 == 0;
                    sig.Tick(sig.Sig.Warn, true, pt);
                    int h = sig.PlayerHits;
                    sig.SetCooldownForTest(0f);
                    sig.Tick(0.01f, true, pt);
                    sig.Tick(sig.Sig.Warn, true, pt);
                    int h2 = sig.PlayerHits - h;
                    if ((even ? h : 1 - h) != 1 || (even ? h2 : 1 - h2) != 0) Fail($"십자 번갈아 맞음 {h}·{h2}");
                    return " 십자 20";
                }
                case DungeonLordSigs.Kind.Summon:
                {
                    int room0 = DungeonEnemy.CountAliveInRoom(ProcRoomId);
                    Place(playerGo, L + fwd * 3f);
                    if (sig.Tick(0.01f, true, pt)) Fail("호령이 강타를 쉬게 함");
                    lord.TakeDamage(lord.CurrentHp - lord.MaxHp * 0.6f);
                    sig.Tick(0.01f, true, pt);
                    sig.Tick(0.01f, true, pt);
                    int n = Mathf.Max(1, sig.Sig.N);   // tomb = 2, nameless(31층) = 3
                    if (sig.Adds != n || sig.Phase != 1) Fail($"⅔ 호령 {sig.Adds}(기대 {n})");
                    if (!sig.LastToast.Contains(DungeonLordSigs.Line(sig.Sig))) Fail("호령 알림");
                    lord.TakeDamage(lord.CurrentHp - lord.MaxHp * 0.3f);
                    sig.Tick(0.01f, true, pt);
                    int room1 = DungeonEnemy.CountAliveInRoom(ProcRoomId);
                    if (sig.Adds != 2 * n || sig.Phase != 2 || room1 - room0 != 2 * n) Fail($"⅓ 호령 {sig.Adds}·방 적 +{room1 - room0}(기대 {2 * n})");
                    lord.TakeDamage(lord.CurrentHp - 1f);
                    sig.Tick(0.01f, true, pt);
                    if (sig.Adds != 2 * n) Fail("문턱 셋째에 또 호령");
                    return $" 호령 {sig.Adds}";
                }
            }
            return "";
        }

        private static string CheckRain(DungeonEnemy lord, LordSigRunner sig, GameObject playerGo, PlayerController pc, Vector3 stand)
        {
            var pt = playerGo.transform;
            Place(playerGo, stand);
            // 첫 3초 전엔 안 씀 → 주인 Tick 으로 달려들게 한 뒤(등장 컷은 넘김) 고유 수가 주인 틱에서 돈다
            lord.Tick(0.01f);
            DungeonCutscenes.Instance?.Skip();
            sig.SetCooldownForTest(0.05f);
            lord.Tick(0.01f);
            if (sig.Busy) Fail("재사용 전에 시작");
            lord.Tick(0.05f);
            if (!sig.Busy || sig.WarnRings != 3) Fail($"주인 틱이 화살비를 안 부름(예고 원 {sig.WarnRings})");
            if (lord.IsWindingUp) Fail("고유 수 예고 중에 강타 예비동작");
            if (sig.Toasts != 1 || !sig.LastToast.Contains(DungeonLordSigs.Name(sig.Sig))) Fail($"첫 알림 '{sig.LastToast}'");
            int hp0 = HeroState.Hp;
            lord.Tick(sig.Sig.Warn);
            if (sig.PlayerHits != 1 || HeroState.Hp >= hp0) Fail($"화살비 서 있는데 안 맞음(hp {hp0}→{HeroState.Hp})");
            if (sig.Busy || !Mathf.Approximately(sig.CooldownLeft, sig.Sig.Cd) || sig.WarnRings != 0) Fail($"재사용 {sig.CooldownLeft}·원 {sig.WarnRings}");
            // 재사용 동안 안 씀
            sig.Tick(sig.Sig.Cd - 0.1f, true, pt);
            if (sig.Busy) Fail("재사용 중에 화살비");
            // 비키면 안 맞음
            sig.Tick(0.2f, true, pt);
            if (!sig.Busy) Fail("재사용 뒤 화살비 없음");
            Place(playerGo, stand + (stand - lord.transform.position).normalized * 12f);
            int h = sig.PlayerHits;
            sig.Tick(sig.Sig.Warn, true, pt);
            if (sig.PlayerHits != h) Fail("비켰는데 맞음");
            if (sig.Toasts != 1) Fail($"알림 {sig.Toasts}번(첫 시전만)");
            // 손잡이
            DungeonLordSigs.Enabled = false;
            sig.SetCooldownForTest(0f);
            bool on = sig.Tick(0.01f, true, pt);
            DungeonLordSigs.Enabled = true;
            if (on || sig.Busy) Fail("손잡이 끔인데 고유 수");
            return " 화살비";
        }

        private static string CheckLocalization()
        {
            var keys = new List<string> { "lordsig.tomb.line" };
            foreach (var s in DungeonLordSigs.All) keys.Add($"lordsig.{s.Key}");
            int n = 0;
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var k in keys) { if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음"); n++; }
            }
            return $" 키 {n}";
        }

        private static float Flat(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }

        private static void Place(GameObject playerGo, Vector3 p)
        {
            var cc = playerGo.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            playerGo.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
