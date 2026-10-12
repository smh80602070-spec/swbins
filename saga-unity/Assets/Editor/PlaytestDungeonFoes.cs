using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0106 2나락 잡졸 명단·무기별 싸우는 법 진단 — `PlaytestDungeonHeadless` 가 "내가 맞았다" 신호 뒤에 부른다(한 프레임 안).
    /// ① 표 18·단계별 4·4·5·5·무기 일곱 ② Pick 같은 입력 = 같은 종·층 3·8·20·30 이 다른 단계 ③ 층 1~30 진짜 전투방 과거 잡졸 = 명단 종(이름·무기, 황건적만이 아님)·졸개는 우두머리 종 ·
    /// ④ 활 더미: 3m 에선 안 다가옴·7.5m 에서 쿨 0 → 예비동작 → 투사체 1, 닿으면 체력 감소(누구·화살) / 무적이면 그대로 + 완벽 회피 신고 ·
    /// ⑤ 창 판정 = 칼 + 0.58m · 곤봉 들썩임·도끼 흔들림 표 ⑥ 정예·호위·명소 잡졸은 무기 갈래 없음. 끝나면 층·영웅·도감·자리를 되돌린다.
    /// </summary>
    public static class PlaytestDungeonFoes
    {
        private const string T = "[PlaytestDungeonHeadless] foes";
        private const string ProcRoomId = "procroom";
        private static readonly Vector3 Far = new Vector3(-7000f, 0f, -7000f);
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
            string who = HeroState.LastHitWho, how = HeroState.LastHitHow;
            int dealt = HeroState.LastDealt, hold = HeroState.DamageHold;
            bool inv = HeroState.Invulnerable;
            string[] bestiary = BestiaryState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            Quaternion rot = playerGo.transform.rotation;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                m += CheckTable() + CheckRooms(runner) + CheckRanged(playerGo) + CheckMelee() + CheckNone(runner);
            }
            finally
            {
                DungeonEnemy.ShotTargetOverride = null;
                foreach (var s in new List<DungeonFoeShot>(DungeonFoeShot.Active)) if (s != null) Object.DestroyImmediate(s.gameObject);
                DungeonFoeShot.Active.Clear();
                foreach (var d in Dummies) if (d != null) Object.DestroyImmediate(d);
                Dummies.Clear();
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                SetProp(nameof(HeroState.Hp), hp);
                SetProp(nameof(HeroState.LastHitWho), who);
                SetProp(nameof(HeroState.LastHitHow), how);
                SetProp(nameof(HeroState.LastDealt), dealt);
                HeroState.Invulnerable = inv;
                HeroState.DamageHold = hold;
                BestiaryState.Restore(bestiary);
                Place(playerGo, pos);
                playerGo.transform.rotation = rot;
            }
            if (_ok) Debug.Log($"{T} OK - 표 18(4·4·5·5·무기 7)·Pick 같음·단계·전투방 과거 잡졸 = 명단 종·졸개 = 우두머리 종·활 멈춰 쏘기(3m 안 다가옴·투사체·맞음·무적 회피)·창 +0.58·곤봉·도끼·정예/호위/명소 갈래 없음 |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var all = DungeonFoeRoster.All;
            if (all.Length != 18) Fail($"명단 {all.Length} ≠ 18");
            if (DungeonFoeRoster.Keys.Length != all.Length) Fail("번역 키 수가 명단과 다름");
            var perTier = new int[5];
            var weapons = new HashSet<FoeWeapon>();
            var names = new HashSet<string>();
            foreach (var f in all)
            {
                perTier[f.Tier]++;
                weapons.Add(f.Weapon);
                if (!names.Add(f.NameKo)) Fail($"이름 겹침 {f.NameKo}");
                if (!DungeonEnemy.HasDisplayNameKey(f.NameKo)) Fail($"{f.NameKo} 번역 키 없음");
                if (f.Weapon == FoeWeapon.None) Fail($"{f.NameKo} 무기 없음");
            }
            if (perTier[1] != 4 || perTier[2] != 4 || perTier[3] != 5 || perTier[4] != 5) Fail($"단계별 {perTier[1]}·{perTier[2]}·{perTier[3]}·{perTier[4]}");
            if (weapons.Count != 7) Fail($"무기 갈래 {weapons.Count} ≠ 7");
            int[] fl = { 3, 8, 20, 30 };
            for (int i = 0; i < fl.Length; i++)
            {
                if (DungeonFoeRoster.TierOf(fl[i]) != i + 1) Fail($"{fl[i]}층 단계 {DungeonFoeRoster.TierOf(fl[i])}");
                for (int r = 0; r < 4; r++)
                    for (int s = 0; s < 4; s++)
                    {
                        var a = DungeonFoeRoster.Pick(fl[i], r, s);
                        if (a.NameKo != DungeonFoeRoster.Pick(fl[i], r, s).NameKo) Fail("Pick 가 같은 입력에 다른 종");
                        if (a.Tier != i + 1) Fail($"{fl[i]}층 Pick 단계 {a.Tier}");
                    }
            }
            if (!Mathf.Approximately(DungeonFoeRoster.LungeOf(FoeWeapon.Club, Mathf.PI / 1.8f), 1.7f) || DungeonFoeRoster.LungeOf(FoeWeapon.Club, -Mathf.PI / 1.8f) != 1f
                || DungeonFoeRoster.LungeOf(FoeWeapon.Sword, 1f) != 1f) Fail("곤봉 들썩임 1~1.7");
            if (!Mathf.Approximately(DungeonFoeRoster.WobOf(FoeWeapon.Axe, Mathf.PI / 1.2f), 0.5f) || DungeonFoeRoster.WobOf(FoeWeapon.Spear, 1f) != 0f) Fail("도끼 흔들림 ±0.5");
            return $" 표 {all.Length}";
        }

        private static List<DungeonEnemy> RoomFoes()
        {
            var list = new List<DungeonEnemy>();
            foreach (var e in DungeonEnemy.Active) if (e != null && e.IsAlive && e.RoomId == ProcRoomId) list.Add(e);
            return list;
        }

        private static string CheckRooms(DungeonFloorRunner runner)
        {
            var seen = new HashSet<string>();
            int past = 0, ranged = 0;
            for (int f = 2; f <= 30; f++)
            {
                if (DungeonLandmarkData.IndexOfFloor(f) >= 0) continue;
                runner.JumpToFloor(f);
                runner.BuildRoomForTest("fight");
                var foes = RoomFoes();
                var leads = foes.FindAll(e => !e.IsMinion);
                for (int i = 0; i < leads.Count; i++)
                {
                    var era = DungeonEras.GruntEra(f, runner.RoomIndex, i);
                    if (era != DungeonEra.Past)
                    {
                        if (leads[i].Weapon != FoeWeapon.None) Fail($"{f}층 시대 적 {leads[i].DisplayNameRaw} 에 무기 갈래");
                        continue;
                    }
                    var want = DungeonFoeRoster.Pick(f, runner.RoomIndex, i);
                    if (leads[i].DisplayNameRaw != want.NameKo || leads[i].Weapon != want.Weapon)
                        Fail($"{f}층 잡졸 {i} {leads[i].DisplayNameRaw}/{leads[i].Weapon} ≠ {want.NameKo}/{want.Weapon}");
                    if (want.Tier != DungeonFoeRoster.TierOf(f)) Fail($"{f}층 잡졸 단계 {want.Tier}");
                    seen.Add(want.NameKo);
                    past++;
                    if (DungeonFoeRoster.IsRanged(want.Weapon)) ranged++;
                }
                foreach (var mn in foes.FindAll(e => e.IsMinion))
                {
                    var twin = leads.Find(l => l.DisplayNameRaw == mn.DisplayNameRaw);
                    if (twin == null || twin.Weapon != mn.Weapon) Fail($"{f}층 졸개 {mn.DisplayNameRaw}/{mn.Weapon} 가 우두머리 종이 아님");
                }
            }
            if (past == 0) Fail("과거 잡졸이 하나도 안 섬");
            if (seen.Count < 6 || (seen.Count == 1 && seen.Contains("황건적"))) Fail($"과거 잡졸 종 {seen.Count}가지뿐");
            if (ranged == 0) Fail("활·지팡이 잡졸이 한 번도 안 섬");
            return $" 방 과거 {past}·종 {seen.Count}·원거리 {ranged}";
        }

        private static string CheckRanged(GameObject playerGo)
        {
            playerGo.GetComponent<PlayerLockOn>()?.Release();
            HeroState.Invulnerable = false;
            HeroState.DamageHold = 0;
            SetProp(nameof(HeroState.Hp), HeroState.HpMax);
            Place(playerGo, Far);
            // 3m — 물러서지도 다가오지도 않음(6.25m 안), 쏘기는 함
            var a = Dummy(Far + new Vector3(3f, 0f, 0f), FoeWeapon.Bow, 7f);
            Vector3 a0 = a.transform.position;
            for (int i = 0; i < 4; i++) a.Tick(0.05f);
            if (Flat(a.transform.position, a0) > 1e-3f) Fail($"활 잡졸이 3m 에서 {Flat(a.transform.position, a0):0.00}m 움직임");
            if (!a.IsRangedWindup) Fail("활 잡졸이 3m 에서 겨누지 않음");
            a.gameObject.SetActive(false);
            Dummies.Remove(a.gameObject);
            Object.DestroyImmediate(a.gameObject);
            foreach (var s in new List<DungeonFoeShot>(DungeonFoeShot.Active)) Object.DestroyImmediate(s.gameObject);
            DungeonFoeShot.Active.Clear();

            // 7.5m — 쿨 0 → 예비동작 → 투사체 하나 → 닿으면 체력 감소
            var b = Dummy(Far + new Vector3(7.5f, 0f, 0f), FoeWeapon.Bow, 7f);
            b.Tick(0.02f); // Idle → Chase
            b.Tick(0.02f); // 쿨 0 → 예비동작
            if (!b.IsRangedWindup) Fail("7.5m 에서 쿨 0 인데 겨누지 않음");
            int shots0 = DungeonFoeShot.Active.Count;
            for (int i = 0; i < 12 && DungeonFoeShot.Active.Count == shots0; i++) b.Tick(0.05f);
            if (DungeonFoeShot.Active.Count != shots0 + 1) { Fail($"투사체 {DungeonFoeShot.Active.Count - shots0} ≠ 1"); return ""; }
            if (b.AttackCooldownLeft < 0.3f * DungeonFoeRoster.RangedCooldownMul - 1e-3f) Fail($"쏜 뒤 쿨 {b.AttackCooldownLeft:0.00} (×1.4 아님)");
            var shot = DungeonFoeShot.Active[DungeonFoeShot.Active.Count - 1];
            int hp0 = HeroState.Hp;
            float flown = 0f;
            for (int i = 0; i < 60 && !shot.Done; i++) { shot.Tick(0.05f); flown += 0.05f; }
            if (!shot.Done || HeroState.Hp >= hp0) Fail($"투사체가 안 맞음(체력 {hp0}→{HeroState.Hp}, {flown:0.00}초)");
            if (HeroState.LastHitWho != b.DisplayName || HeroState.LastHitHow != DungeonLocalization.T("grave.how_arrow", "화살")) Fail($"사망 카드 출처 {HeroState.LastHitWho}/{HeroState.LastHitHow}");
            int hit = hp0 - HeroState.Hp;

            // 무적 — 피해 없음 + 완벽 회피 신고
            SetProp(nameof(HeroState.Hp), HeroState.HpMax);
            HeroState.Invulnerable = true;
            int dodged = 0;
            System.Action onDodge = () => dodged++;
            PlayerController.PerfectDodged += onDodge;
            try
            {
                var s2 = DungeonFoeShot.Fire(b.transform.position + Vector3.up * 1.1f, playerGo.transform.position, 5f, "진단", "화살", playerGo.transform, null, Color.white);
                for (int i = 0; i < 60 && !s2.Done; i++) s2.Tick(0.05f);
                if (HeroState.Hp != HeroState.HpMax || dodged != 1) Fail($"무적인데 체력 {HeroState.Hp}/{HeroState.HpMax}·회피 신고 {dodged}");
                // 비켜서면 안 맞고 수명이 다해 사라짐
                HeroState.Invulnerable = false;
                var s3 = DungeonFoeShot.Fire(b.transform.position + Vector3.up * 1.1f, playerGo.transform.position + new Vector3(0f, 0f, 30f), 5f, "진단", "화살", playerGo.transform, null, Color.white);
                for (int i = 0; i < 60 && !s3.Done; i++) s3.Tick(0.05f);
                if (!s3.Done || HeroState.Hp != HeroState.HpMax) Fail("빗나간 투사체가 맞거나 안 사라짐");
            }
            finally
            {
                PlayerController.PerfectDodged -= onDodge;
                HeroState.Invulnerable = false;
            }
            b.gameObject.SetActive(false);
            return $" 활 맞음 {hit}·회피 {dodged}";
        }

        private static string CheckMelee()
        {
            var sw = Dummy(Far + new Vector3(0f, 0f, 60f), FoeWeapon.Sword, 0f);
            var sp = Dummy(Far + new Vector3(0f, 0f, 64f), FoeWeapon.Spear, 0f);
            var hb = Dummy(Far + new Vector3(0f, 0f, 68f), FoeWeapon.Halberd, 0f);
            float d1 = sp.StrikeReach - sw.StrikeReach, d2 = hb.StrikeReach - sw.StrikeReach;
            if (Mathf.Abs(d1 - DungeonFoeRoster.ReachBonus) > 1e-4f || Mathf.Abs(d2 - DungeonFoeRoster.ReachBonus) > 1e-4f) Fail($"창 판정 +{d1:0.00}·미늘창 +{d2:0.00}");
            foreach (var e in new[] { sw, sp, hb }) e.gameObject.SetActive(false);
            return $" 창 +{d1:0.00}m";
        }

        private static string CheckNone(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(4);
            runner.BuildRoomForTest("elite");
            foreach (var e in RoomFoes()) if (e.Weapon != FoeWeapon.None) Fail($"정예 방 {e.DisplayNameRaw} 에 무기 갈래");
            int lf = -1;
            for (int f = 2; f <= 80 && lf < 0; f++) if (DungeonLandmarkData.IndexOfFloor(f) >= 0) lf = f;
            if (lf > 0)
            {
                runner.JumpToFloor(lf);
                runner.BuildRoomForTest("fight");
                foreach (var e in RoomFoes()) if (e.Weapon != FoeWeapon.None) Fail($"{lf}층 명소 {e.DisplayNameRaw} 에 무기 갈래");
            }
            return $" 갈래 없음(정예·명소 {lf}층)";
        }

        private static DungeonEnemy Dummy(Vector3 at, FoeWeapon w, float dmg)
        {
            var go = new GameObject("FoeDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("foe_test", null);
            e.ConfigureCombat(1000f, dmg, 1, 1, null, null, false, "오랑캐 궁수", Color.white, 1f);
            e.SetWeapon(w, 0f);
            go.SetActive(true);
            Dummies.Add(go);
            return e;
        }

        private static void SetProp(string name, object v) => typeof(HeroState).GetProperty(name).SetValue(null, v);

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
