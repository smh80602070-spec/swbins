using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-7 몸짓(웹 사가나락 §5.16) 진단 — `PlaytestDungeonHeadless` 가 사연 진단 뒤에 부른다(한 프레임 안, 시각은 넣어서).
    /// 웹 진단 넷(표 / 수명·틈틈이 / 사건 / 손잡이)을 이 트랙에 맞춰:
    /// 표(일 여섯·시대 손님 넷이 다 일이 있음·갈래 초·FNV 웹 값) · 수명(끝나면 지움)·걷는 중 글자만·튐 · 틈틈이(7~11초·1.4초·키 고정·일 없는 키 없음·볼일 두 번 안 겹침) ·
    /// 사건(잡졸 안 됨·두목급/레벨업 환호·회전베기 호응 — 진짜 더미 처치·진짜 회전베기로) · 붙임(촌민·행상 주인·시대 손님·동행 둘) ·
    /// 화면(다가섬 한 번·나갔다 오면 또·머리 위 글자·트리거 한 번·휴머노이드 팔이 들렸다 제자리·폴백 숙임·튐 제자리) · 손잡이 끄면 없음 · ko/en 키.
    /// 끝나면 영웅·도감·비결·자리·몸짓 상태를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonGestures
    {
        private const string T = "[PlaytestDungeonHeadless] gestures";
        private const string MariaFbx = "Assets/Art/CharactersRealistic/Maria WProp J J Ong.fbx";
        private static bool _ok;
        private static readonly List<GameObject> Dummies = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null || GestureRunner.Instance == null)
            {
                Fail($"필요한 것 없음(플레이어 {playerGo != null}·묶음 {GestureRunner.Instance != null})");
                return false;
            }
            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            int[] secrets = SecretState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                GestureState.Reset();
                m += CheckTable() + CheckLife() + CheckEvents(playerGo) + CheckAttached() + CheckScreen(playerGo) + CheckSwitch() + CheckLocalization();
            }
            finally
            {
                GestureState.NowOverride = -1f;
                GestureState.Enabled = true;
                GestureState.Reset();
                foreach (var d in Dummies) if (d != null) Object.DestroyImmediate(d);
                Dummies.Clear();
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                SecretState.Restore(secrets);
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
                Place(playerGo, pos);
            }
            if (_ok) Debug.Log($"{T} OK - 표(일 여섯·손님 넷·웹 FNV)·수명·걷는 중 글자만·튐·틈틈이 7~11초·볼일 한 번 · 사건(잡졸 안 됨·두목급/레벨업 환호·회전베기 호응) · 붙임 · 화면(다가섬·글자·트리거 한 번·팔 들고 제자리·폴백) · 손잡이 · ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var keys = new HashSet<string>();
            foreach (var j in GestureState.Jobs)
            {
                if (!keys.Add(j.Key)) Fail($"일 키 겹침 {j.Key}");
                if (string.IsNullOrEmpty(j.TextKo) || string.IsNullOrEmpty(j.TextKey)) Fail($"{j.Key} 글자 없음");
                if (j.TextKo.Contains("️")) Fail($"{j.Key} 변형 선택자(대체 글꼴에 없음)");
            }
            if (GestureState.Jobs.Length != 6) Fail($"일 {GestureState.Jobs.Length} ≠ 6");
            foreach (var f in DungeonEras.FolkList)
                if (!GestureState.TryJob(f.Id + "@0,0", out _)) Fail($"시대 손님 {f.Id} 일 없음");
            if (!GestureState.TryJob("villager@3,-4", out var v) || v.Work != GestureState.Slot.Attack) Fail("촌민 일 = 망치질 아님");
            if (!GestureState.TryJob("merchant", out var mc) || mc.Work != GestureState.Slot.Interaction) Fail("행상 일 = 흥정 아님");
            if (GestureState.TryJob(GestureState.AllyKey, out _)) Fail("동행에 일이 있음");
            // 갈래 초(웹 KIND)
            var dur = new Dictionary<GestureState.Kind, float>
            { { GestureState.Kind.Greet, 1.0f }, { GestureState.Kind.Serve, 1.6f }, { GestureState.Kind.Rally, 0.8f }, { GestureState.Kind.Cheer, 1.4f } };
            foreach (var kv in dur)
            {
                GestureState.Reset();
                GestureState.Start("merchant@1,1", kv.Key, 10f);
                if (!GestureState.TryActive("merchant@1,1", 10f, out var c) || !Mathf.Approximately(c.Dur, kv.Value)) Fail($"{kv.Key} 초 ≠ {kv.Value}");
            }
            GestureState.Reset();
            // FNV-1a — 웹 hash() 로 뽑은 값(node)
            if (GestureState.Hash("villager@0,0") != 243876975u || GestureState.Hash("merchant@12,-5") != 3315866562u || GestureState.Hash("ally") != 3770038919u)
                Fail($"해시가 웹과 다름 {GestureState.Hash("villager@0,0")}");
            GestureState.WorkCycle("merchant@12,-5", out float per, out float off);
            if (!Mathf.Approximately(per, 9f) || Mathf.Abs(off - 7.47f) > 0.001f) Fail($"주기 {per}·어긋남 {off} ≠ 9·7.47(웹)");
            for (int i = 0; i < 40; i++)
            {
                GestureState.WorkCycle($"villager@{i},{-i}", out per, out off);
                if (per < 7f || per > 11f || off < 0f || off >= per) Fail($"주기 {per}·{off} 범위 밖");
            }
            return " 표";
        }

        private static string CheckLife()
        {
            const string K = "courier@5,5";
            GestureState.Reset();
            GestureState.OnGreet(K, 100f);
            var p = GestureState.Plan(K, 100.5f, false, true);
            if (p.Kind != GestureState.Kind.Greet || p.Slot != GestureState.Slot.Wave || p.Text != "👋" || Mathf.Abs(p.K - 0.5f) > 0.001f)
                Fail($"인사 {p.Kind}·{p.Slot}·{p.Text}·{p.K}");
            var busy = GestureState.Plan(K, 100.5f, true, true);
            if (busy.Slot != GestureState.Slot.Idle || busy.Text != "👋") Fail("걷는 중인데 몸짓을 덮음 / 글자가 없음");
            GestureState.Plan(K, 101.01f, false, false);
            if (GestureState.TryActive(K, 101.01f, out _) || GestureState.CueCount != 0) Fail("끝난 몸짓이 안 지워짐");
            // 볼일 — 제 일 글자, 두 번 안 겹침
            if (!GestureState.OnServe(K, 200f) || GestureState.OnServe(K, 200.5f)) Fail("볼일이 연달아 겹침");
            p = GestureState.Plan(K, 200.5f, false, true);
            if (p.Kind != GestureState.Kind.Serve || p.Slot != GestureState.Slot.Interaction || p.Text != DungeonLocalization.T("gesture.job.courier", "📦 배달"))
                Fail($"볼일 {p.Slot}·{p.Text}");
            // 환호 튐
            GestureState.Start(GestureState.AllyKey, GestureState.Kind.Cheer, 300f);
            var ch = GestureState.Plan(GestureState.AllyKey, 300f + 1.4f / 6f, false, false);
            if (ch.Bob < 0.99f || ch.Slot != GestureState.Slot.Jump) Fail($"환호 튐 {ch.Bob}");
            if (GestureState.Plan(GestureState.AllyKey, 300f + 1.4f / 6f, true, false).Bob != 0f) Fail("걷는 중에 튐");
            // 틈틈이
            const string V = "villager@0,0";
            GestureState.Reset();
            GestureState.WorkCycle(V, out float per, out float off);
            float inside = per - off + 0.7f, outside = per - off + 3f;
            p = GestureState.Plan(V, inside, false, true);
            if (p.Kind != GestureState.Kind.Work || p.Slot != GestureState.Slot.Attack || p.Text != "" || Mathf.Abs(p.K - 0.5f) > 0.01f)
                Fail($"틈틈이 {p.Kind}·{p.Slot}·'{p.Text}'·{p.K}");
            if (GestureState.Plan(V, outside, false, true).Kind != GestureState.Kind.None) Fail("틈틈이 1.4초 밖인데 일함");
            if (GestureState.Plan(V, inside, false, false).Kind != GestureState.Kind.None) Fail("마을 사람 아닌데 틈틈이");
            if (GestureState.Plan(V, inside, true, true).Kind != GestureState.Kind.None) Fail("걷는 중에 틈틈이");
            if (GestureState.InWork(GestureState.AllyKey, 0f) || GestureState.InWork("stranger@0,0", 0.1f)) Fail("일 없는 키가 틈틈이");
            int work = 0;
            for (int s = 0; s < 1100; s++) if (GestureState.InWork(V, s * 0.1f)) work++;
            float share = work / 1100f;
            if (share < WorkShareMin(per) || share > WorkShareMax(per)) Fail($"틈틈이 비율 {share:0.00} (주기 {per})");
            return $" 틈틈이 {per}초/{share:0.00}";
        }

        private static float WorkShareMin(float per) => GestureState.WorkDur / per - 0.03f;
        private static float WorkShareMax(float per) => GestureState.WorkDur / per + 0.03f;

        private static string CheckEvents(GameObject playerGo)
        {
            GestureState.Reset();
            if (GestureState.OnKill(false, 10f) || GestureState.CueCount != 0) Fail("잡졸 처치에 환호");
            GestureState.OnKill(true, 10f);
            if (!GestureState.TryActive(GestureState.AllyKey, 10f, out var c) || c.Kind != GestureState.Kind.Cheer
                || c.Text != DungeonLocalization.T("gesture.cheer_win", "🎉 이겼다")) Fail($"두목급 처치 환호 {c.Text}");
            GestureState.OnLevelUp(20f);
            if (!GestureState.TryActive(GestureState.AllyKey, 20f, out c) || c.Text != DungeonLocalization.T("gesture.cheer_level", "🎉 경하")) Fail("레벨업 환호");
            GestureState.OnLeadSignature(30f);
            if (!GestureState.TryActive(GestureState.AllyKey, 30f, out c) || c.Kind != GestureState.Kind.Rally || c.Slot != GestureState.Slot.Attack) Fail("호응");

            // 진짜 사건 — 묶음이 DungeonEnemy.AnyDied 를 듣는다(멀리, 지역 밖에서).
            GestureState.Reset();
            Kill(new Vector3(5000f, 0f, 5000f), boss: false);
            if (GestureState.TryActive(GestureState.AllyKey, GestureState.Now, out _)) Fail("묶음: 잡졸 처치에 환호");
            Kill(new Vector3(5004f, 0f, 5000f), boss: true);
            if (!GestureState.TryActive(GestureState.AllyKey, GestureState.Now, out c) || c.Kind != GestureState.Kind.Cheer) Fail("묶음: 두목 처치에 환호 없음");
            // 진짜 회전베기 — 곁에 튼튼한 더미 하나.
            GestureState.Reset();
            var combat = playerGo.GetComponent<PlayerCombat>();
            if (combat == null) { Fail("PlayerCombat 없음"); return " 사건"; }
            var near = Dummy(playerGo.transform.position + playerGo.transform.forward * 1.2f, 1e6f, boss: false);
            combat.ResetCooldownsForTest();
            combat.TriggerWhirl();
            if (!GestureState.TryActive(GestureState.AllyKey, GestureState.Now, out c) || c.Kind != GestureState.Kind.Rally) Fail("회전베기에 호응 없음");
            Object.DestroyImmediate(near.gameObject);
            combat.ResetCooldownsForTest();
            return " 사건";
        }

        private static string CheckAttached()
        {
            int villagers = 0;
            foreach (var t in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
            {
                if (t.name != "Villager") continue;
                villagers++;
                var g = t.GetComponent<Gesturer>();
                if (g == null || !g.IsNpc || GestureState.RoleOf(g.Key) != "villager") Fail($"촌민 {t.position} 몸짓 없음");
            }
            if (villagers == 0 || GestureRunner.Instance.Villagers != villagers) Fail($"촌민 {GestureRunner.Instance.Villagers}/{villagers}");
            int folk = 0;
            foreach (var f in Object.FindObjectsByType<EraFolk>(FindObjectsSortMode.None))
            {
                var g = f.GetComponent<Gesturer>();
                if (g == null || GestureState.RoleOf(g.Key) != f.Data.Id) Fail($"시대 손님 {f.Data.Id} 몸짓 없음");
                else folk++;
            }
            int keepers = 0, merchants = 0;
            foreach (var mc in Object.FindObjectsByType<DungeonMerchant>(FindObjectsSortMode.None))
            {
                merchants++;
                var keeper = mc.transform.Find("Keeper");
                if (keeper == null) continue;
                var g = keeper.GetComponent<Gesturer>();
                if (g == null || GestureState.RoleOf(g.Key) != "merchant") Fail($"행상 주인 {mc.name} 몸짓 없음");
                else keepers++;
            }
            var keys = new HashSet<string>();
            foreach (var g in Object.FindObjectsByType<Gesturer>(FindObjectsSortMode.None))
                if (g.IsNpc && !keys.Add(g.Key)) Fail($"마을 사람 키 겹침 {g.Key}");
            string allies = "";
            if (AllyFighter.Instance != null)
            {
                var g = AllyFighter.Instance.GetComponent<Gesturer>();
                if (g == null || g.Key != GestureState.AllyKey || g.IsNpc) Fail("무사 몸짓 없음");
                allies += "무사";
            }
            if (AllyMystic.Instance != null)
            {
                var g = AllyMystic.Instance.GetComponent<Gesturer>();
                if (g == null || g.Key != GestureState.AllyKey || g.IsNpc) Fail("술사 몸짓 없음");
                allies += "·술사";
            }
            if (allies == "") Fail("동행이 없음");
            return $" 촌민 {villagers}·손님 {folk}·행상 주인 {keepers}/{merchants}·{allies}";
        }

        private static string CheckScreen(GameObject playerGo)
        {
            string m = "";
            // 다가섬 — 촌민 하나(자리를 넣어서)
            Gesturer vg = null;
            foreach (var t in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                if (t.name == "Villager" && (vg = t.GetComponent<Gesturer>()) != null) break;
            if (vg != null)
            {
                GestureState.Reset();
                Vector3 at = vg.transform.position;
                Vector3 far = at + new Vector3(Gesturer.GreetRadius + 3f, 0f, 0f), close = at + new Vector3(Gesturer.GreetRadius - 1f, 0f, 0f);
                int before = vg.Greets;
                vg.CheckApproach(far, 50f);
                bool first = vg.CheckApproach(close, 50.1f), again = vg.CheckApproach(close, 50.2f);
                vg.CheckApproach(far, 50.3f);
                bool back = vg.CheckApproach(close, 50.4f);
                if (!first || again || !back || vg.Greets != before + 2) Fail($"다가섬 인사 {first}·{again}·{back}");
                vg.Apply(50.5f);
                if (vg.LabelText != "👋") Fail($"머리 위 글자 '{vg.LabelText}'");
                GestureState.Reset();
                vg.Apply(WorkFree(vg.Key, 60f));
                if (vg.LabelText != "") Fail("몸짓이 끝났는데 글자가 남음");
            }
            else Fail("몸짓 붙은 촌민이 없음");

            // 동행 트리거 — 몸짓 하나에 한 번(제 Attack 트리거가 있을 때만 — 없는 PC 는 몸짓 없이 글자만)
            if (AllyFighter.Instance != null && AllyFighter.Instance.IsUp)
            {
                var g = AllyFighter.Instance.GetComponent<Gesturer>();
                GestureState.Reset();
                GestureState.OnLeadSignature(70f);
                int n0 = g.Triggers;
                g.Apply(70.1f);
                g.Apply(70.2f);
                bool hasClip = AllyFighter.Instance.Animator != null && HasTrigger(AllyFighter.Instance.Animator, "Attack");
                if (hasClip && g.Triggers != n0 + 1 && !g.LastBusy) Fail($"호응 트리거 {g.Triggers - n0}번");
                if (g.LabelText != DungeonLocalization.T("gesture.rally", "❗ 호응")) Fail($"호응 글자 '{g.LabelText}'");
                m += hasClip ? $" 무사 베기 {g.Triggers - n0}" : " 무사 클립 없음(글자만)";
            }

            // 걷는 중 — 글자만
            var busyRoot = new GameObject("GestureBusyDummy");
            busyRoot.transform.position = new Vector3(-5000f, 0f, -5000f);
            Dummies.Add(busyRoot);
            Saga.Dungeon.World.CharacterVisual.SpawnFallbackCapsule(busyRoot.transform, 1.7f, Color.gray);
            bool walking = true;
            var bg = Gesturer.Attach(busyRoot, "busy_dummy", npc: false, () => walking);
            bg.Bind();
            var capsule = busyRoot.transform.GetChild(0);
            Quaternion capRot = capsule.localRotation;
            GestureState.Reset();
            GestureState.OnGreet("busy_dummy", 80f);
            bg.Apply(80.5f);
            if (bg.LastPose.Slot != GestureState.Slot.Idle || bg.LabelText != "👋" || Quaternion.Angle(capsule.localRotation, capRot) > 0.01f)
                Fail("걷는 중인데 몸이 움직임 / 글자 없음");
            // 폴백 몸 숙임 → 끝나면 제자리
            walking = false;
            bg.Apply(80.125f); // K = 1/8 — 손짓 숙임 sin(K·4π) 이 꼭대기
            float lean = Quaternion.Angle(capsule.localRotation, capRot);
            bg.Apply(81.5f);
            if (lean < 1f || Quaternion.Angle(capsule.localRotation, capRot) > 0.01f) Fail($"폴백 숙임 {lean:0.0}° / 제자리 안 됨");
            // 폴백 튐 → 제자리
            Vector3 capPos = capsule.localPosition;
            GestureState.Start("busy_dummy", GestureState.Kind.Cheer, 90f);
            bg.Apply(90f + 1.4f / 6f);
            float hop = capsule.localPosition.y - capPos.y;
            bg.Apply(92f);
            if (hop < 0.1f || (capsule.localPosition - capPos).sqrMagnitude > 1e-6f) Fail($"튐 {hop:0.00}m / 제자리 안 됨");

            // 휴머노이드 — 플레이어 몸을 하나 떠서. 몸 프리팹이 빠진 PC(Missing Prefab)면 디스크의 Maria FBX(휴머노이드 리그)를.
            var playerAnim = playerGo.GetComponentInChildren<Animator>();
            GameObject humanSrc = playerAnim != null && playerAnim.isHuman ? playerAnim.gameObject
                : UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(MariaFbx);
            if (humanSrc != null)
            {
                var root = new GameObject("GestureHumanDummy");
                root.transform.position = new Vector3(-5010f, 0f, -5000f);
                Dummies.Add(root);
                var body = Object.Instantiate(humanSrc, root.transform, false);
                body.transform.localPosition = Vector3.zero;
                body.transform.localRotation = Quaternion.identity;
                foreach (var mb in body.GetComponentsInChildren<MonoBehaviour>()) mb.enabled = false;
                var anim = body.GetComponentInChildren<Animator>();
                if (anim != null) anim.enabled = false; // 이 진단 안에선 애니메이터가 안 쓴다 — 쌓이지 않고 되돌리는지 본다
                var hg = Gesturer.Attach(root, "human_dummy", npc: false);
                hg.Bind();
                if (!hg.Humanoid) Fail("휴머노이드 뼈를 못 찾음");
                else
                {
                    var lower = anim.GetBoneTransform(HumanBodyBones.RightLowerArm);
                    var upper = anim.GetBoneTransform(HumanBodyBones.RightUpperArm);
                    Vector3 rest = lower.position;
                    Quaternion restRot = upper.localRotation;
                    GestureState.Reset();
                    GestureState.OnGreet("human_dummy", 100f);
                    hg.Apply(100.5f);
                    float rise = lower.position.y - rest.y;
                    Vector3 once = lower.position;
                    hg.Apply(100.5f);
                    float drift = (lower.position - once).magnitude;
                    hg.Apply(102f);
                    float back = Quaternion.Angle(upper.localRotation, restRot);
                    if (rise < 0.1f || drift > 0.001f || back > 0.05f) Fail($"손짓 팔 들림 {rise:0.00}m·쌓임 {drift:0.0000}·제자리 {back:0.00}°");
                    // 망치질 — 오른팔이 앞으로
                    GestureState.Start("human_dummy", GestureState.Kind.Rally, 110f); // Rally = attack 슬롯 — 애니메이터를 꺼 둬 트리거 대신 뼈 망치질
                    hg.Apply(110.2f);
                    hg.Apply(112f);
                    if (Quaternion.Angle(upper.localRotation, restRot) > 0.05f) Fail("망치질 뒤 제자리 안 됨");
                    m += $" 팔 {rise:0.00}m({(humanSrc == playerAnim?.gameObject ? "주인공" : "Maria FBX")})";
                }
            }
            else m += " 휴머노이드 없음";
            return m;
        }

        private static string CheckSwitch()
        {
            GestureState.Reset();
            GestureState.Enabled = false;
            bool started = GestureState.OnGreet("merchant@0,0", 5f) | GestureState.OnKill(true, 5f) | GestureState.OnLevelUp(5f);
            var p = GestureState.Plan("villager@0,0", 1.5f, false, true);
            GestureState.Enabled = true;
            if (started || GestureState.CueCount != 0 || p.Kind != GestureState.Kind.None || p.Text != "") Fail("손잡이 끔인데 몸짓");
            return " 손잡이";
        }

        private static string CheckLocalization()
        {
            var keys = new List<string> { "gesture.greet", "gesture.rally", "gesture.cheer", "gesture.cheer_level", "gesture.cheer_win" };
            foreach (var j in GestureState.Jobs) keys.Add(j.TextKey);
            int n = 0;
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var k in keys) { if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음"); n++; }
            }
            return $" 키 {n}";
        }

        /// <summary>틈틈이 일 창 밖의 시각(from 부터 0.5초씩).</summary>
        private static float WorkFree(string key, float from)
        {
            float t = from;
            while (GestureState.InWork(key, t)) t += 0.5f;
            return t;
        }

        private static bool HasTrigger(Animator a, string name)
        {
            if (a.runtimeAnimatorController == null) return false;
            foreach (var p in a.parameters) if (p.name == name && p.type == AnimatorControllerParameterType.Trigger) return true;
            return false;
        }

        private static DungeonEnemy Dummy(Vector3 at, float hp, bool boss)
        {
            var go = new GameObject("GestureDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("gesture_test", null);
            e.ConfigureCombat(hp, 0f, 0, 0, null, null, boss, "황건적", Color.white, 1f);
            go.SetActive(true);
            Dummies.Add(go);
            return e;
        }

        private static void Kill(Vector3 at, bool boss) => Dummy(at, 10f, boss).TakeDamage(1e9f);

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
