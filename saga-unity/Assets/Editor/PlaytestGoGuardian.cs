using System.Reflection;
using Unity.Cinemachine;
using UnityEngine;
using Saga.Go.Cinematics;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-7 "망루 수호장" + 106-9 "GO 두목 등장 컷" 진단 — `PlaytestHeadless` 가 들판 전투 진단 앞에서 부른다.
    /// 표(체력·겹 방패·경험치·키·자리) · 겉(뇌): 화 상성 → 깨짐 → 0.8초 휘청 · 속(화): 체력 그대로·화 면역·물리 0.4·수 상성 → 깨짐 →
    /// 3초 드러눕기 → 체력 · 귀가하면 겉부터 다시 · 등장 컷(카메라 하이브리드·18m 밖 안 틂·안이면 틂·적 멈춤·HUD·이름표·포효·
    /// 가까운 샷·넘김·한 번) · 토벌(금·경험·다시 안 섬·PlannedCount) · 세이브 v18 왕복·v14 로드. 끝나면 수호장·돈·경험·세이브를 되돌린다.
    /// 컷을 여기서 한 번 틀어 두므로(Engaged) 뒤 진단이 수호장 곁을 지나도 컷이 안 돈다.
    /// </summary>
    public static class PlaytestGoGuardian
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            DuelGate.ResetForTest();
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var cuts = GoCutscenes.Instance;
            FieldEnemy g = null;
            foreach (var e in FieldEnemy.All) if (e.IsGuardian) g = e;
            if (fc == null || pc == null || cuts == null || g == null)
            {
                Fail($"필요한 것 없음(전투 {fc != null}, 컷 {cuts != null}, 수호장 {g != null}) — 씬 재빌드?");
                return false;
            }
            Vector3 origin = fc.SafePoint;
            int gold = GoldState.Gold, level = PlayerStats.Level, exp = PlayerStats.Exp;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string savedJson = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string metrics = "";
            try
            {
                cuts.Skip();
                CheckTable(g);
                CheckLayers(g, origin);
                metrics += CheckIntro(g, fc, pc, cuts, origin);
                CheckSlain(g, origin, gold);
                CheckSave(g);
            }
            finally
            {
                cuts.Skip();
                DuelGate.ResetForTest();
                GuardianState.Restore(false);
                if (!g.gameObject.activeSelf) g.gameObject.SetActive(true);
                g.RestoreHomeForTest();
                GoldState.Restore(gold);
                PlayerStats.Restore(level, exp);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                GoStamina.ResetFull();
                if (savedJson != null) System.IO.File.WriteAllText(savePath, savedJson);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
            }
            if (_ok) Debug.Log($"[{_tag}] guardian OK - 표·겉(뇌) 상성 깨짐·0.8초·속(화) 면역/물리/수 상성·3초 드러눕기·귀가 복구·등장 컷(브레인·18m·멈춤·HUD·이름표·포효·가까운 샷·넘김·한 번)·토벌(금·경험·안 섬)·세이브 v18/v14 |{metrics}");
            return _ok;
        }

        private static void CheckTable(FieldEnemy g)
        {
            if (!Near(g.MaxHp, FieldEnemy.GuardianHp) || !Near(g.ShieldMax, FieldEnemy.GuardianShield) || g.ShieldLayers != 2)
                Fail($"수호장 표 — 체력 {g.MaxHp}·방패 {g.ShieldMax}·겹 {g.ShieldLayers}");
            if (g.Element != FieldEnemy.GuardianOuter || g.ExpReward != FieldEnemy.GuardianExp) Fail($"겉 원소 {g.Element}·경험 {g.ExpReward}");
            if (!FieldEnemy.CanStandOn(g.Home)) Fail("수호장 집이 설 수 없는 칸");
            if (g.BodyTop < 5f) Fail($"수호장 키 {g.BodyTop:0.0} — 두목급으로 안 보인다");
            if (g.GroupId != FieldSpawner.GuardianGroupId) Fail($"수호장 무리 id {g.GroupId}");
            // 역참·돌탑에서 컷이 괜히 돌지 않게 발견 반경 밖
            foreach (var wp in GoWorldMap.Waypoints)
            {
                float d = Flat(TestMapData.WorldPos(wp.Gx, wp.Gy) - g.Home).magnitude;
                if (d < FieldEnemy.GuardianDetectRadius + 4f) Fail($"{wp.NameKo} 이 수호장과 {d:0}m — 너무 가깝다");
            }
        }

        private static void CheckLayers(FieldEnemy g, Vector3 origin)
        {
            g.SetEngagedForTest(true); // 겹 진단 중 첫 타격이 등장 컷을 틀지 않게(컷은 CheckIntro 에서 본다).
            g.WarpForTest(origin + new Vector3(60f, 0f, 0f));
            float hp = g.Hp;
            g.TakeHit(100f, GoElement.Pyro, 50f, out _); // 화 → 뇌 방패 상성 ×2.5
            if (!Near(g.ShieldHp, FieldEnemy.GuardianShield - 250f)) Fail($"겉(뇌)에 화 상성 — 방패 {g.ShieldHp}");
            g.TakeHit(100f, GoElement.Pyro, 50f, out _);
            if (g.ShieldLayers != 1 || g.Element != FieldEnemy.GuardianInner || !Near(g.ShieldHp, FieldEnemy.GuardianShield))
                Fail($"겉이 깨진 뒤 속 방패 — 겹 {g.ShieldLayers}·원소 {g.Element}·방패 {g.ShieldHp}");
            if (g.CurrentState != FieldEnemy.State.Stagger) Fail("겉이 깨졌는데 휘청하지 않는다");
            if (!Near(g.Hp, hp)) Fail("겉이 깨질 때 체력이 깎였다");
            g.Tick(FieldEnemy.GuardianOuterStaggerSec - 0.2f);
            if (g.CurrentState != FieldEnemy.State.Stagger) Fail("0.8초 전에 휘청이 끝났다");
            g.Tick(0.3f);
            if (g.CurrentState == FieldEnemy.State.Stagger) Fail("0.8초가 지나도 휘청한다");

            g.TakeHit(100f, GoElement.Pyro, 50f, out _);
            if (!Near(g.ShieldHp, FieldEnemy.GuardianShield)) Fail("속(화) 방패가 주인공 화 원소에 면역이 아니다");
            g.TakeHit(100f, GoElement.Physical, 50f, out _);
            if (!Near(g.ShieldHp, FieldEnemy.GuardianShield - 40f)) Fail($"속 방패 물리 0.4 — {g.ShieldHp}");
            g.TakeHit(200f, GoElement.Hydro, 50f, out _); // 수 상성 ×2.5 = 500 → 깨짐
            if (g.ShieldLayers != 0 || g.Shielded) Fail("수 상성으로 속 방패가 안 깨졌다");
            if (g.CurrentState != FieldEnemy.State.Stagger) Fail("속이 깨졌는데 드러눕지 않는다");
            if (!Near(g.Hp, hp)) Fail("속이 깨질 때 체력이 깎였다");
            g.Tick(FieldEnemy.GuardianDownSec - 0.2f);
            if (g.CurrentState != FieldEnemy.State.Stagger) Fail("3초 전에 일어났다");
            g.Tick(0.3f);
            if (g.CurrentState == FieldEnemy.State.Stagger) Fail("3초가 지나도 누워 있다");
            g.ClearAuraForTest();
            g.TakeHit(100f, GoElement.Physical, 50f, out _);
            if (!(g.Hp < hp)) Fail("방패가 다 깨졌는데 체력이 안 깎인다");

            g.RestoreHomeForTest();
            if (g.ShieldLayers != 2 || g.Element != FieldEnemy.GuardianOuter || !Near(g.ShieldHp, FieldEnemy.GuardianShield) || !Near(g.Hp, g.MaxHp))
                Fail("다시 서면 겉 방패부터가 아니다");
        }

        private static string CheckIntro(FieldEnemy g, FieldCombat fc, PlayerController pc, GoCutscenes cuts, Vector3 origin)
        {
            var cam = Camera.main;
            if (cam == null || cam.GetComponent<CinemachineBrain>() == null) Fail("실제 카메라에 CinemachineBrain 이 없다");
            var rig = Object.FindFirstObjectByType<CameraRig>();
            var view = rig != null ? typeof(CameraRig).GetField("view", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(rig) as Transform : null;
            if (view == null || view.GetComponent<CinemachineCamera>() == null) Fail("CameraRig 가 플레이 가상 카메라를 안 민다");

            pc.Teleport(origin);
            g.SetEngagedForTest(false);
            g.WarpForTest(origin + new Vector3(FieldEnemy.GuardianDetectRadius + 4f, 0f, 0f));
            g.Tick(0.02f);
            if (g.Engaged || GoCutscenes.Playing) Fail("발견 반경 밖에서 등장 컷이 돌았다");

            g.WarpForTest(origin + new Vector3(12f, 0f, 0f));
            int plays = cuts.PlayCount;
            g.Tick(0.02f);
            if (!g.Engaged || !GoCutscenes.Playing) { Fail("12m 로 다가왔는데 등장 컷이 안 돌았다"); return ""; }
            if (cuts.ShownName != g.DisplayName) Fail($"이름표 \"{cuts.ShownName}\" (기대 \"{g.DisplayName}\")");
            var hud = Object.FindFirstObjectByType<FieldCombatHud>();
            var hudCanvas = hud != null ? hud.GetComponentInParent<Canvas>() : null;
            if (hudCanvas != null && hudCanvas.enabled) Fail("컷 동안 전투 HUD 가 켜져 있다");
            Vector3 before = g.transform.position;
            var stateBefore = g.CurrentState;
            g.Tick(1f);
            if ((g.transform.position - before).sqrMagnitude > 0.0001f || g.CurrentState != stateBefore) Fail("컷 동안 수호장이 움직였다");

            cuts.Seek(1.0);
            cuts.Tick(0.01f);
            if (cuts.RoarFired) Fail("포효가 너무 일찍");
            if (cuts.NameAlpha > 0f) Fail("이름표가 넓은 샷에서 벌써 떴다");
            cuts.Seek(2.6);
            cuts.Tick(0.01f);
            if (!cuts.RoarFired) Fail("넓은→가까운 샷 순간 포효 신호가 없다");
            if (cuts.NameAlpha <= 0.5f) Fail($"가까운 샷에서 이름표가 안 떴다 (α {cuts.NameAlpha:0.00})");
            string m = "";
            var close = cuts.CameraOf(true);
            if (close == null || cuts.CameraOf(false) == null) Fail("등장 컷 카메라가 없다");
            else
            {
                Vector3 bp = g.transform.position;
                float d = Vector3.Distance(close.transform.position, bp);
                if (d > 1.6f * g.BodyTop) Fail($"가까운 샷이 수호장에게서 멀다 ({d:0.0}m)");
                if (close.transform.position.y > bp.y + 2f) Fail("가까운 샷이 올려다보지 않는다");
                m = $" 가까운 샷 {d:0.0}m(키 {g.BodyTop:0.0}m)";
            }
            cuts.Skip();
            if (GoCutscenes.Playing) Fail("등장 컷이 안 넘어갔다");
            if (hudCanvas != null && !hudCanvas.enabled) Fail("컷 뒤 HUD 가 안 돌아왔다");
            g.RestoreHomeForTest();
            g.WarpForTest(origin + new Vector3(12f, 0f, 0f));
            g.Tick(0.02f);
            if (GoCutscenes.Playing) Fail("두 번째 만남에 등장 컷이 또 돌았다");
            if (cuts.PlayCount - plays != 1) Fail($"컷 수 {cuts.PlayCount - plays} ≠ 1");
            cuts.Skip();
            return m;
        }

        private static void CheckSlain(FieldEnemy g, Vector3 origin, int goldBefore)
        {
            g.WarpForTest(origin + new Vector3(60f, 0f, 0f));
            int planned = FieldSpawner.PlannedCount;
            int expBefore = PlayerStats.Exp, levelBefore = PlayerStats.Level;
            GoldState.Restore(goldBefore);
            g.SetShieldForTest(0f);
            g.TakeHit(99999f, GoElement.Physical, 50f, out _);
            if (g.Alive) { Fail("수호장이 안 쓰러졌다"); return; }
            if (!GuardianState.Defeated) Fail("토벌이 기록되지 않았다");
            if (GoldState.Gold != goldBefore + FieldEnemy.GuardianGold) Fail($"토벌 금 {GoldState.Gold - goldBefore} ≠ {FieldEnemy.GuardianGold}");
            if (PlayerStats.Level == levelBefore && PlayerStats.Exp == expBefore) Fail("토벌 경험치가 안 들어왔다");
            if (FieldSpawner.PlannedCount != planned - 1) Fail("토벌 뒤에도 세울 적 수에 수호장이 든다");
            g.Tick(FieldEnemy.RespawnSec + 10f);
            if (g.Alive) Fail("수호장이 90초 뒤 다시 섰다(한 번 쓰러뜨리면 안 서야)");
        }

        private static void CheckSave(FieldEnemy g)
        {
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string path = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string json = System.IO.File.ReadAllText(path);
            if (!json.Contains("\"version\":26") || !json.Contains("\"guardianDown\":true")) Fail("세이브 v18 에 토벌이 안 남았다");
            GuardianState.Restore(false);
            if (!SaveState.TryLoad() || !GuardianState.Defeated) Fail("v18 왕복 뒤 토벌이 사라졌다");
            string v14 = json.Replace("\"version\":26", "\"version\":14").Replace(",\"guardianDown\":true", "");
            System.IO.File.WriteAllText(path, v14);
            if (!SaveState.TryLoad()) { Fail("v14 파일 TryLoad 실패"); return; }
            if (GuardianState.Defeated) Fail("v14 파일을 읽었는데 수호장이 쓰러진 걸로 나온다");
        }

        private static bool Near(float a, float b, float eps = 0.05f) => Mathf.Abs(a - b) <= eps;
        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] guardian: {msg}");
            _ok = false;
        }
    }
}
