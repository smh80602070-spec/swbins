using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-10 몰이 사냥(웹 사가나락 §5.19) 진단 — `PlaytestDungeonHeadless` 가 주인 고유 수 뒤에 부른다(한 프레임 안).
    /// 웹 진단(무리·휩쓸기 / 경직·쓰러짐 / 흩어짐)을 이 트랙에 맞춰: 표(부채꼴 경계·힘·흔들림·고리 자리 순수) ·
    /// 진짜 전투방(잡졸 넷 + 졸개 여덟·체력 55%·피해 70%·몸 0.75·보상 절반·무기 없음·이름·자리·첫 공격 어긋남·두 번 지어도 같음·손잡이 0 = 넷·정예 방엔 없음) ·
    /// 진짜 평타·강공격(앞 120°/180°·반경 1.35/1.8·곁 60%/75%·뒤·먼 적 안 맞음·손잡이) · 경직(잡졸 밀림·두목 안 밀림·손잡이) · 움찔 ·
    /// 쓰러짐 날림(진짜 Die — 휴머노이드 몸 더미, 방향 = 나에게서 먼 쪽 ±0.45rad·힘 × 1.1m·가라앉음·눕힘·흩어짐 0 = 곧게).
    /// 끝나면 층·영웅·도감·비결·자리·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonHunt
    {
        private const string T = "[PlaytestDungeonHeadless] hunt";
        private const string ProcRoomId = "procroom";
        private const string MariaFbx = "Assets/Art/CharactersRealistic/Maria WProp J J Ong.fbx";
        private static readonly Vector3 Far = new Vector3(-9000f, 0f, -9000f);
        private static bool _ok;
        private static readonly List<GameObject> Dummies = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            int floor0 = runner.CurrentFloor;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            int[] secrets = SecretState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            Quaternion rot = playerGo.transform.rotation;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                m += CheckTable() + CheckPacks(runner) + CheckCleave(playerGo) + CheckStagger() + CheckFling(playerGo);
            }
            finally
            {
                DungeonHunt.PackN = 2;
                DungeonHunt.CleaveOn = true;
                DungeonHunt.Stagger = 0.25f;
                DungeonHunt.Scatter = 1f;
                foreach (var d in Dummies) if (d != null) Object.DestroyImmediate(d);
                Dummies.Clear();
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                SecretState.Restore(secrets);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
                Place(playerGo, pos);
                playerGo.transform.rotation = rot;
            }
            if (_ok) Debug.Log($"{T} OK - 표(부채꼴·힘·흔들림·고리)·전투방 무리(넷+여덟·55%·70%·0.75·보상 절반·이름·자리·어긋남·같음·손잡이·정예 방 없음)·평타 120°/강공격 180° 휩쓸기(곁 60%/75%·뒤·먼 적·손잡이)·경직(두목 제외)·움찔·쓰러짐 날림(방향·힘·가라앉음·눕힘·곧게) |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            Vector3 o = Vector3.zero, f = Vector3.forward;
            if (!DungeonHunt.InCone(o, f, Dir(59f) * 2f, 3f, DungeonHunt.CleaveHalfDeg) || DungeonHunt.InCone(o, f, Dir(61f) * 2f, 3f, DungeonHunt.CleaveHalfDeg)) Fail("평타 부채꼴 60° 경계");
            if (!DungeonHunt.InCone(o, f, Dir(89f) * 2f, 3f, DungeonHunt.HeavyHalfDeg) || DungeonHunt.InCone(o, f, Dir(91f) * 2f, 3f, DungeonHunt.HeavyHalfDeg)) Fail("강공격 반원 90° 경계");
            if (DungeonHunt.InCone(o, f, Dir(0f) * 3.1f, 3f, 60f)) Fail("반경 밖이 부채꼴 안");
            if (!Mathf.Approximately(DungeonHunt.ScatterForce(0f, 10f, false), DungeonHunt.ForceMin)
                || !Mathf.Approximately(DungeonHunt.ScatterForce(50f, 10f, false), DungeonHunt.ForceMax)
                || !Mathf.Approximately(DungeonHunt.ScatterForce(0f, 10f, true), DungeonHunt.ForceMin + 0.5f)
                || !Mathf.Approximately(DungeonHunt.ScatterForce(50f, 10f, true), DungeonHunt.ForceMax)) Fail("쓰러짐 힘 0.7~2.4");
            for (int i = 0; i < 30; i++)
            {
                var at = new Vector3(i * 1.7f, 0f, -i * 0.9f);
                float j = DungeonHunt.ScatterJitter(at);
                if (Mathf.Abs(j) > DungeonHunt.ScatterJitterRad + 1e-5f || j != DungeonHunt.ScatterJitter(at)) Fail($"흔들림 {j}");
                var po = DungeonHunt.PackOffset(7, i % 4, i % 2, 2);
                float r = po.magnitude;
                if (r < DungeonHunt.PackRingMin - 1e-4f || r > DungeonHunt.PackRingMin + DungeonHunt.PackRingSpan + 1e-4f || po != DungeonHunt.PackOffset(7, i % 4, i % 2, 2)) Fail($"고리 {r}");
                float d = DungeonHunt.FirstAttackDelay(7, i % 4, i % 2);
                if (d < DungeonHunt.FirstAttackMin || d > DungeonHunt.FirstAttackMin + DungeonHunt.FirstAttackSpan) Fail($"첫 공격 {d}");
            }
            return " 표";
        }

        private static Vector3 Dir(float deg) => Quaternion.AngleAxis(deg, Vector3.up) * Vector3.forward;

        private static List<DungeonEnemy> RoomFoes()
        {
            var list = new List<DungeonEnemy>();
            foreach (var e in DungeonEnemy.Active) if (e != null && e.IsAlive && e.RoomId == ProcRoomId) list.Add(e);
            return list;
        }

        private static string CheckPacks(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(2);
            runner.BuildRoomForTest("fight");
            var foes = RoomFoes();
            var leads = foes.FindAll(e => !e.IsMinion);
            var minions = foes.FindAll(e => e.IsMinion);
            if (leads.Count != 4 || minions.Count != 8) Fail($"전투방 잡졸 {leads.Count}·졸개 {minions.Count} ≠ 4·8");
            float lim = DungeonRoomBuilder.RoomWidth * 0.5f;
            var names = new HashSet<string>();
            foreach (var l in leads) names.Add(l.DisplayNameRaw);
            var lead0 = leads.Count > 0 ? leads[0] : null;
            var seen = new List<Vector3>();
            foreach (var mn in minions)
            {
                var twin = leads.Find(l => l.DisplayNameRaw == mn.DisplayNameRaw);
                if (twin == null) { Fail($"졸개 이름 {mn.DisplayNameRaw} 이 우두머리에 없음"); continue; }
                if (Mathf.Abs(mn.MaxHp / twin.MaxHp - DungeonHunt.MinionHpMul) > 0.01f) Fail($"졸개 체력 {mn.MaxHp / twin.MaxHp:0.00}");
                if (Mathf.Abs(mn.Damage / twin.Damage - DungeonHunt.MinionDmgMul) > 0.01f) Fail($"졸개 피해 {mn.Damage / twin.Damage:0.00}");
                if (Mathf.Abs(mn.VisualScale / twin.VisualScale - DungeonHunt.MinionScale) > 0.01f) Fail($"졸개 몸 {mn.VisualScale / twin.VisualScale:0.00}");
                if (mn.RewardItemId != null || twin.RewardItemId == null) Fail("졸개가 무기를 떨굼");
                if (mn.RewardGold > twin.RewardGold || mn.RewardExp > twin.RewardExp || mn.RewardGold < 1) Fail("졸개 보상이 절반이 아님");
                float cd = mn.AttackCooldownLeft;
                if (cd < DungeonHunt.FirstAttackMin - 1e-3f || cd > DungeonHunt.FirstAttackMin + DungeonHunt.FirstAttackSpan + 1e-3f) Fail($"졸개 첫 공격 {cd}");
                Vector3 lp = mn.transform.localPosition;
                if (Mathf.Abs(lp.x) > lim || Mathf.Abs(lp.z) > lim) Fail($"졸개가 방 밖 {lp}");
                seen.Add(mn.transform.position);
            }
            // 두 번 지어도 같은 자리
            runner.BuildRoomForTest("fight");
            var again = RoomFoes().FindAll(e => e.IsMinion);
            int same = 0;
            foreach (var mn in again) foreach (var p in seen) if ((mn.transform.position - p).sqrMagnitude < 1e-6f) { same++; break; }
            if (again.Count != seen.Count || same != seen.Count) Fail($"다시 지은 졸개 자리 {same}/{seen.Count}");
            // 손잡이 0 → 옛 넷
            DungeonHunt.PackN = 0;
            runner.BuildRoomForTest("fight");
            int old = RoomFoes().Count;
            DungeonHunt.PackN = 2;
            if (old != 4) Fail($"손잡이 0 인데 {old}");
            // 정예 방엔 졸개 없음
            runner.BuildRoomForTest("elite");
            if (RoomFoes().Exists(e => e.IsMinion)) Fail("정예 방에 졸개");
            return $" 방 {leads.Count}+{minions.Count}";
        }

        private static string CheckCleave(GameObject playerGo)
        {
            var combat = playerGo.GetComponent<PlayerCombat>();
            if (combat == null) { Fail("PlayerCombat 없음"); return ""; }
            playerGo.GetComponent<PlayerLockOn>()?.Release();
            SecretState.Restore(null); // 확산·사거리 비결 없이
            Place(playerGo, Far);
            playerGo.transform.rotation = Quaternion.identity;
            // 사거리 2.5: 평타 휩쓸기 3.375·60° / 강공격 4.5·90°
            var main = Dummy(Far + Dir(0f) * 1.5f, false);
            var a = Dummy(Far + Dir(45f) * 2.5f, false);   // 둘 다
            var b = Dummy(Far + Dir(80f) * 2.0f, false);   // 강공격만
            var c = Dummy(Far + Dir(180f) * 1.6f, false);  // 안 맞음
            var d = Dummy(Far + Dir(-5f) * 4.0f, false);   // 강공격만(반경)
            var hp0 = Hps(main, a, b, c, d);
            combat.ResetCooldownsForTest();
            combat.TriggerAttack();
            var hp1 = Hps(main, a, b, c, d);
            float mainHit = hp0[0] - hp1[0];
            if (mainHit <= 0f) { Fail("평타가 첫 대상을 못 때림"); return ""; }
            float ra = (hp0[1] - hp1[1]) / mainHit;
            if (Mathf.Abs(ra - DungeonHunt.CleaveMul) > 0.01f || hp1[2] != hp0[2] || hp1[3] != hp0[3] || hp1[4] != hp0[4] || combat.LastCleaveHits != 1)
                Fail($"평타 휩쓸기 곁 {ra:0.00}·80° {hp0[2] - hp1[2]}·뒤 {hp0[3] - hp1[3]}·먼 {hp0[4] - hp1[4]}·수 {combat.LastCleaveHits}");
            combat.ResetCooldownsForTest();
            combat.TriggerHeavyAttack();
            var hp2 = Hps(main, a, b, c, d);
            float heavyMain = hp1[0] - hp2[0];
            float rb = (hp1[2] - hp2[2]) / heavyMain;
            if (Mathf.Abs(rb - DungeonHunt.HeavySide) > 0.01f || hp1[4] == hp2[4] || hp2[3] != hp1[3] || combat.LastCleaveHits != 3)
                Fail($"강공격 휩쓸기 곁 {rb:0.00}·먼 {hp1[4] - hp2[4]}·뒤 {hp1[3] - hp2[3]}·수 {combat.LastCleaveHits}");
            // 손잡이 끔
            DungeonHunt.CleaveOn = false;
            combat.ResetCooldownsForTest();
            combat.TriggerAttack();
            var hp3 = Hps(main, a, b, c, d);
            DungeonHunt.CleaveOn = true;
            if (hp3[1] != hp2[1] || combat.LastCleaveHits != 0) Fail("손잡이 끔인데 휩쓸기");
            foreach (var e in new[] { main, a, b, c, d }) e.gameObject.SetActive(false);
            combat.ResetCooldownsForTest();
            return $" 평타 곁 ×{ra:0.00}·강공격 곁 ×{rb:0.00}";
        }

        private static float[] Hps(params DungeonEnemy[] es)
        {
            var o = new float[es.Length];
            for (int i = 0; i < es.Length; i++) o[i] = es[i].CurrentHp;
            return o;
        }

        private static string CheckStagger()
        {
            var g = Dummy(Far + new Vector3(50f, 0f, 0f), false);
            var b = Dummy(Far + new Vector3(55f, 0f, 0f), true);
            g.TakeDamage(1f);
            b.TakeDamage(1f);
            if (g.AttackCooldownLeft < DungeonHunt.Stagger - 1e-4f) Fail($"경직 {g.AttackCooldownLeft}");
            if (b.AttackCooldownLeft > 1e-4f) Fail("두목이 경직");
            if (!g.Flinching) Fail("피격 클립 없는 몸이 안 움찔");
            DungeonHunt.Stagger = 0f;
            var g2 = Dummy(Far + new Vector3(60f, 0f, 0f), false);
            g2.TakeDamage(1f);
            DungeonHunt.Stagger = 0.25f;
            if (g2.AttackCooldownLeft > 1e-4f) Fail("손잡이 0 인데 경직");
            return " 경직";
        }

        private static string CheckFling(GameObject playerGo)
        {
            var model = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(MariaFbx);
            if (model == null) return " 날림 몸 없음";
            // 진짜 Die — 애니메이터 있는 몸이라야 날림 길을 탄다
            Vector3 at = Far + new Vector3(100f, 0f, 0f);
            Place(playerGo, at + new Vector3(-2f, 0f, 0f));
            var e = Dummy(at, false, model);
            e.TakeDamage(e.MaxHp * 3f); // 넘친 피해 2배 → 힘 끝까지
            var fling = e.GetComponent<DeathFling>();
            if (fling == null) { Fail("쓰러졌는데 날림 없음"); return ""; }
            if (!Mathf.Approximately(fling.Distance, DungeonHunt.ForceMax * DungeonHunt.FlingMeters)) Fail($"날림 거리 {fling.Distance}");
            float ang = Vector3.Angle(Vector3.right, fling.Direction) * Mathf.Deg2Rad;
            if (ang > DungeonHunt.ScatterJitterRad + 1e-3f) Fail($"날림 방향이 나에게서 먼 쪽 아님({ang:0.00}rad)");
            var visual = e.transform.childCount > 0 ? e.transform.GetChild(0) : null;
            Quaternion vr0 = visual != null ? visual.localRotation : Quaternion.identity;
            fling.Tick(DungeonHunt.FlingSec);
            float moved = Flat(e.transform.position, at);
            if (Mathf.Abs(moved - fling.Distance) > 0.01f || Mathf.Abs(e.transform.position.y - at.y) > 0.01f) Fail($"날림 {moved:0.00}m·높이 {e.transform.position.y - at.y:0.00}");
            fling.Tick(0.6f); // 0.9초 — 가라앉는 중
            float sunk = at.y - e.transform.position.y;
            if (Mathf.Abs(sunk - DungeonHunt.SinkDepth * 0.5f) > 0.01f) Fail($"가라앉음 {sunk:0.00}");
            if (visual != null && Quaternion.Angle(vr0, visual.localRotation) < 1f) Fail("쓰러짐 클립 없는 몸이 안 누움");
            // 흩어짐 0 → 곧게
            DungeonHunt.Scatter = 0f;
            var e2 = Dummy(at + new Vector3(0f, 0f, 7.3f), false, model);
            Place(playerGo, at + new Vector3(0f, 0f, 5.3f));
            e2.TakeDamage(e2.MaxHp * 3f);
            DungeonHunt.Scatter = 1f;
            var f2 = e2.GetComponent<DeathFling>();
            if (f2 == null || Vector3.Angle(Vector3.forward, f2.Direction) > 0.01f) Fail("흩어짐 0 인데 흔들림");
            return $" 날림 {moved:0.00}m·{ang:0.00}rad·가라앉음 {sunk:0.00}";
        }

        private static DungeonEnemy Dummy(Vector3 at, bool boss, GameObject model = null)
        {
            var go = new GameObject("HuntDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("hunt_test", model);
            e.ConfigureCombat(1000f, 0f, 1, 1, null, null, boss, "황건적", Color.white, 1f);
            go.SetActive(true);
            Dummies.Add(go);
            return e;
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
