using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-6 지역 사연 사슬(웹 사가나락 §5.14) 진단 — `PlaytestDungeonHeadless` 가 우두머리 진단 뒤에 부른다(한 프레임 안, 시간은 `Tick`).
    /// 웹 진단(표·자리 / 순서·던전 처치 안 셈·딴 지역 안 셈·먼 흔적 안 됨·쉼 해제·평정 / 구주 평정 한 번 / 화면 값)을 이 트랙에 맞춰:
    /// 표(아홉·글·웹 수치·흔적/사냥터가 제 지역 방 안·서로·우두머리 표식과 4m 밖) · 들어섬 = 열림(한 번) · ① 딴 지역·던전 처치 안 셈·사냥터 셋(시대 몸·위험 층)·3초 뒤 다시·칸 떠나면 물러남·채우면 보상 ·
    /// 우두머리를 먼저 잡아도 안 건너뜀 · ② 흔적(그 걸음만 보임·먼 곳 안 됨) · ③ 사냥터 정예(남은 수)·정예 아닌 적 안 셈 · 쉼 해제 · ④ 호위 안 셈·우두머리 → 평정·공적 ·
    /// 구주 평정 한 번 · HUD 줄 · M 지도 표·평정 수 · 세이브 v14 왕복·옛 세이브 · ko/en 키.
    /// 끝나면 영웅·도감·우두머리/사연 기록·플레이어 자리·배너 상태를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonRegionSagas
    {
        private const string T = "[PlaytestDungeonHeadless] regionsagas";
        private static bool _ok;
        private static readonly List<GameObject> Dummies = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var runner = RegionSagaRunner.Instance;
            var bosses = RegionBossRunner.Instance;
            var tracker = DungeonRegionTracker.Instance;
            var map = Object.FindFirstObjectByType<OverworldMapUI>();
            if (playerGo == null || runner == null || bosses == null || tracker == null || map == null)
            {
                Fail($"필요한 것 없음(사연 {runner != null}·우두머리 {bosses != null}·추적기 {tracker != null}·지도 {map != null})");
                return false;
            }
            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            var bossRows = RegionBossState.Snapshot();
            var sagaRows = RegionSagaState.Snapshot();
            bool sagaAll = RegionSagaState.AllDone;
            Vector3 pos = playerGo.transform.position;
            int announced = tracker.Announced;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                RegionBossState.NowOverride = 2_000_000;
                RegionBossState.Restore(null);
                RegionSagaState.Restore(null, false);
                runner.Withdraw();
                m += CheckTable() + CheckChain(runner, bosses, tracker, playerGo) + CheckAll(runner) + CheckScreen(map, playerGo, tracker) + CheckSave() + CheckLocalization();
            }
            finally
            {
                runner.Withdraw();
                for (int r = 0; r < DungeonWorldMap.All.Length; r++) bosses.Withdraw(r, toast: false);
                bosses.ResetNotices();
                foreach (var d in Dummies) if (d != null) Object.DestroyImmediate(d);
                Dummies.Clear();
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                RegionBossState.NowOverride = -1;
                RegionBossState.Restore(bossRows);
                RegionSagaState.Restore(sagaRows, sagaAll);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                map.SetVisible(false);
                Place(playerGo, pos);
                runner.Tick(pos, 0f);
                tracker.Tick(pos, 0f);
                tracker.ResetState(announced);
            }
            if (_ok) Debug.Log($"{T} OK - 표(아홉·웹 수치·자리)·열림 한 번·① 딴 지역/던전 안 셈·사냥터 셋·다시·물러남·보상 · 우두머리 먼저 잡아도 안 건너뜀 · ② 흔적 · ③ 정예만 · 쉼 해제 · ④ 우두머리만 → 평정 · 구주 평정 한 번 · HUD·M 지도 · 세이브 v14 · ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var all = DungeonRegionSagas.All;
            if (all.Length != DungeonWorldMap.All.Length) Fail($"사연 {all.Length} ≠ 9");
            var titles = new HashSet<string>();
            for (int r = 0; r < all.Length; r++)
            {
                var s = all[r];
                string key = DungeonWorldMap.All[r].Key;
                if (string.IsNullOrEmpty(s.TitleKo) || string.IsNullOrEmpty(s.GiverKo) || string.IsNullOrEmpty(s.IntroKo) || string.IsNullOrEmpty(s.ClueKo)
                    || string.IsNullOrEmpty(s.FoundKo) || string.IsNullOrEmpty(s.EliteKo) || string.IsNullOrEmpty(s.DoneKo)) Fail($"{key} 글 빠짐");
                if (!titles.Add(s.TitleKo)) Fail($"{key} 제목 겹침");
                int L = DungeonRegionFoes.Danger[r];
                if (DungeonRegionSagas.Need(r, 0) != 10 + 2 * L || DungeonRegionSagas.Need(r, 1) != 1 || DungeonRegionSagas.Need(r, 2) != (L > 0 ? 3 : 2) || DungeonRegionSagas.Need(r, 3) != 1)
                    Fail($"{key} 걸음 수");
                if (DungeonRegionSagas.RewardGold(r, 0) != 60 + 30 * L || DungeonRegionSagas.RewardGold(r, 3) != 400 + 200 * L
                    || DungeonRegionSagas.RewardExp(r, 2) != 20 + 8 * L || DungeonRegionSagas.MeritGold(r) != (20 + L) * 50) Fail($"{key} 보상");
                Vector3 boss = DungeonRegionFoes.Bosses[r].Spot;
                foreach (var (name, p) in new[] { ("흔적", s.Clue), ("사냥터", s.Hunt) })
                {
                    if (DungeonWorldMap.IndexAt(p) != r) Fail($"{key} {name} {p} 이 제 지역 아님");
                    Vector3 c = DungeonRegionFoes.RoomCenterOf(p);
                    if ((c - DungeonRegionFoes.RoomCenterOf(boss)).sqrMagnitude > 0.01f) Fail($"{key} {name} 이 우두머리와 딴 방");
                    if (Mathf.Max(Mathf.Abs(p.x - c.x), Mathf.Abs(p.z - c.z)) > 8.5f) Fail($"{key} {name} 이 벽에 붙음");
                    if (Flat(p, boss) < 4f) Fail($"{key} {name} 이 우두머리 표식과 4m 안");
                }
                if (Flat(s.Clue, s.Hunt) < 4f) Fail($"{key} 흔적·사냥터 4m 안");
            }
            return " 표 9";
        }

        private static string CheckChain(RegionSagaRunner runner, RegionBossRunner bosses, DungeonRegionTracker tracker, GameObject playerGo)
        {
            int r = DungeonWorldMap.IndexOf("solar");
            int o = DungeonWorldMap.IndexOf("silkroad");
            int L = DungeonRegionFoes.Danger[r];
            Vector3 center = DungeonWorldMap.CellCenter(r);
            HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 0, HeroState.EquippedWeaponId, HeroState.SocketedGemId);

            // 열림 — 들어섬 배너에서, 한 번만.
            tracker.ResetState(-1);
            Place(playerGo, center);
            tracker.Tick(center, 0f);
            tracker.Tick(center, 1.3f);
            var e0 = RegionSagaState.Get(r);
            if (!e0.opened || e0.step != 0 || e0.have != 0 || e0.at != RegionBossState.Now) Fail($"들어섬에 안 열림 {e0.opened}/{e0.step}");
            if (!runner.LastMessage.Contains(DungeonRegionSagas.Title(r)) || !runner.LastMessage.Contains(DungeonRegionSagas.Giver(r))) Fail($"열림 글 '{runner.LastMessage}'");
            string before = runner.LastMessage;
            tracker.ResetState(-1);
            tracker.Tick(center, 0f);
            tracker.Tick(center, 1.3f);
            if (runner.LastMessage != before || RegionSagaState.Get(o).opened) Fail("두 번 열림/딴 지역이 열림");

            // ① 딴 지역·던전 처치는 안 셈.
            Kill(DungeonWorldMap.CellCenter(o), false);
            Kill(new Vector3(0f, 0f, 120f), false);
            if (RegionSagaState.Have(r) != 0) Fail($"딴 지역·던전 처치를 셈 {RegionSagaState.Have(r)}");

            // 사냥터 셋 — 깃발(①·③ 걸음만)을 밟아야 선다.
            Vector3 hunt = DungeonRegionSagas.All[r].Hunt;
            if (!runner.FlagVisible(r) || runner.FlagVisible(o)) Fail($"사냥터 깃발 {runner.FlagVisible(r)}·딴 지역 {runner.FlagVisible(o)}");
            runner.Tick(center, 5f);
            if (runner.Pack().Count != 0) Fail("깃발을 안 밟았는데 섬");
            runner.Tick(hunt + new Vector3(1f, 0f, 0f), 0f);
            var pack = runner.Pack();
            int f = DungeonRegionFoes.RegionFloor(r);
            string futureName = DungeonEras.FoeFor(f, DungeonEra.Future).NameKo;
            if (pack.Count != DungeonRegionSagas.HuntPack || runner.PackRegion != r) Fail($"사냥터 {pack.Count}·{runner.PackRegion}");
            foreach (var e in pack)
            {
                if (e.DisplayNameRaw != futureName) Fail($"사냥터 이름 {e.DisplayNameRaw} ≠ {futureName}(신도시 = 미래)");
                if (!Mathf.Approximately(e.CurrentHp, DungeonFormulas.EnemyHp(f, false)) || e.IsElite) Fail($"사냥터 체력 {e.CurrentHp}/{DungeonFormulas.EnemyHp(f, false)}");
                if (Flat(e.transform.position, DungeonRegionSagas.All[r].Hunt) > 2f) Fail("사냥터 자리");
            }
            foreach (var e in pack) e.TakeDamage(1e9f);
            if (RegionSagaState.Have(r) != 3) Fail($"사냥터 처치 {RegionSagaState.Have(r)}/3");
            runner.Tick(hunt, 1f);
            if (runner.Pack().Count != 0) Fail("3초 안에 다시 섬");
            runner.Tick(hunt, 2.5f);
            runner.Tick(hunt, 0f);
            if (runner.Pack().Count != DungeonRegionSagas.HuntPack) Fail($"3초 뒤 안 섬 {runner.Pack().Count}");
            runner.Tick(DungeonWorldMap.CellCenter(o), 0f);
            if (runner.Pack().Count != 0 || runner.PackRegion != -1) Fail("칸을 떠나도 사냥터가 남음");

            // 채움 — 보상 후 ② 흔적.
            int need = DungeonRegionSagas.Need(r, 0);
            int goldBefore = HeroState.Gold;
            while (RegionSagaState.Step(r) == 0 && RegionSagaState.Have(r) < need + 1) Kill(center + new Vector3(1f, 0f, 1f), false);
            if (RegionSagaState.Step(r) != 1 || RegionSagaState.Have(r) != 0) Fail($"토벌 {need} 뒤 걸음 {RegionSagaState.Step(r)}");
            if (HeroState.Gold < goldBefore + DungeonRegionSagas.RewardGold(r, 0)) Fail($"토벌 보상 금 {HeroState.Gold - goldBefore}");
            if (!runner.LastMessage.Contains(DungeonRegionSagas.Clue(r))) Fail($"다음 걸음 글 '{runner.LastMessage}'");

            // 우두머리를 먼저 잡아도 안 건너뜀(쉬게 된다).
            bosses.Summon(r);
            bosses.BossOf(r)?.TakeDamage(1e9f);
            if (RegionSagaState.Step(r) != 1 || !RegionBossState.IsResting(r)) Fail($"우두머리 먼저 — 걸음 {RegionSagaState.Step(r)}·쉼 {RegionBossState.IsResting(r)}");
            foreach (var g in bosses.GuardsOf(r)) g.TakeDamage(1e9f);
            if (RegionSagaState.Step(r) != 1) Fail("흔적 걸음에 처치가 셈");
            bosses.Withdraw(r, toast: false);

            // ② 흔적.
            if (!runner.ClueVisible(r) || runner.ClueVisible(o)) Fail($"흔적 보임 {runner.ClueVisible(r)}·딴 지역 {runner.ClueVisible(o)}");
            Vector3 clue = DungeonRegionSagas.All[r].Clue;
            runner.Tick(clue + new Vector3(3f, 0f, 0f), 0f);
            if (RegionSagaState.Step(r) != 1) Fail("3m 밖에서 흔적을 찾음");
            runner.Tick(clue + new Vector3(1f, 0f, 0f), 0f);
            if (RegionSagaState.Step(r) != 2 || runner.ClueVisible(r)) Fail($"흔적 못 찾음 {RegionSagaState.Step(r)}");
            if (!runner.LastMessage.Contains(DungeonRegionSagas.Found(r))) Fail($"찾음 글 '{runner.LastMessage}'");

            // ③ 정예 — 사냥터 정예(남은 수), 정예 아닌 적은 안 셈.
            if (!runner.FlagVisible(r)) Fail("③ 걸음인데 깃발이 없음");
            runner.Tick(hunt, 5f);
            pack = runner.Pack();
            int eliteNeed = DungeonRegionSagas.Need(r, 2);
            if (pack.Count != eliteNeed) Fail($"정예 사냥터 {pack.Count} ≠ {eliteNeed}");
            foreach (var e in pack)
                if (!e.IsElite || !Mathf.Approximately(e.CurrentHp, DungeonFormulas.EliteHp(f))) Fail($"정예 사냥터 {e.DisplayNameRaw} 정예 {e.IsElite}·체력 {e.CurrentHp}");
            Kill(center, false);
            if (RegionSagaState.Have(r) != 0) Fail("정예 걸음에 잡졸을 셈");
            pack[0].TakeDamage(1e9f);
            if (RegionSagaState.Have(r) != 1) Fail($"정예 처치 {RegionSagaState.Have(r)}");
            runner.Withdraw();
            runner.Tick(hunt, 5f);
            if (runner.Pack().Count != eliteNeed - 1) Fail($"남은 정예만 다시 서야 {runner.Pack().Count} ≠ {eliteNeed - 1}");
            if (!RegionBossState.IsResting(r)) Fail("③ 전에 쉼이 벌써 풀림");
            foreach (var e in runner.Pack()) e.TakeDamage(1e9f);
            if (RegionSagaState.Step(r) != 3) Fail($"정예 뒤 걸음 {RegionSagaState.Step(r)}");
            if (RegionBossState.IsResting(r)) Fail("④ 에 닿아도 우두머리 쉼이 안 풀림");
            runner.Tick(hunt, 5f);
            if (runner.Pack().Count != 0 || runner.FlagVisible(r)) Fail("④ 걸음에 사냥터가 섬/깃발이 남음");

            // ④ 호위는 안 셈, 우두머리 → 평정.
            bosses.Summon(r);
            var boss = bosses.BossOf(r);
            if (boss == null) { Fail("쉼이 풀렸는데 우두머리가 안 섬"); return ""; }
            foreach (var g in bosses.GuardsOf(r)) g.TakeDamage(1e9f);
            if (RegionSagaState.Step(r) != 3 || RegionSagaState.Get(r).done) Fail("④ 에서 호위를 셈");
            goldBefore = HeroState.Gold;
            boss.TakeDamage(1e9f);
            var done = RegionSagaState.Get(r);
            if (!done.done || RegionSagaState.Active(r) || RegionSagaState.DoneCount() != 1) Fail($"평정 안 됨 {done.done}");
            int want = DungeonRegionSagas.RewardGold(r, 3) + DungeonRegionSagas.MeritGold(r);
            if (HeroState.Gold < goldBefore + want) Fail($"평정 금 {HeroState.Gold - goldBefore} < {want}");
            if (!runner.LastMessage.Contains(DungeonRegionSagas.Done(r))) Fail($"평정 글 '{runner.LastMessage}'");
            if (RegionSagaState.AllDone) Fail("하나 평정에 구주 평정");
            Kill(center, false);
            if (RegionSagaState.Get(r).have != 0) Fail("평정 뒤에도 셈");
            bosses.Withdraw(r, toast: false);
            return $" 신도시 평정(토벌 {need}·정예 {eliteNeed})";
        }

        private static string CheckAll(RegionSagaRunner runner)
        {
            var rows = RegionSagaState.Snapshot();
            int last = DungeonWorldMap.IndexOf("scrap");
            for (int i = 0; i < rows.Length; i++)
            {
                rows[i].opened = true;
                rows[i].done = i != last;
                rows[i].step = i == last ? 3 : 3;
                rows[i].have = 0;
            }
            RegionSagaState.Restore(rows, false);
            int goldBefore = HeroState.Gold;
            runner.ForceComplete(last);
            if (!RegionSagaState.AllDone || RegionSagaState.DoneCount() != 9) Fail($"구주 평정 {RegionSagaState.AllDone}·{RegionSagaState.DoneCount()}");
            if (HeroState.Gold < goldBefore + DungeonRegionSagas.AllGold + DungeonRegionSagas.AllMeritGold) Fail("구주 평정 금");
            if (RegionSagaState.TryCompleteAll()) Fail("구주 평정이 두 번");
            return " 구주 평정";
        }

        private static string CheckScreen(OverworldMapUI map, GameObject playerGo, DungeonRegionTracker tracker)
        {
            var rows = RegionSagaState.Snapshot();
            int a = DungeonWorldMap.IndexOf("jungwon"), c = DungeonWorldMap.IndexOf("neon"), d = DungeonWorldMap.IndexOf("heaven");
            for (int i = 0; i < rows.Length; i++) { rows[i].opened = false; rows[i].done = false; rows[i].step = 0; rows[i].have = 0; }
            rows[a].opened = true; rows[a].step = 0; rows[a].have = 4;
            rows[c].opened = true; rows[c].step = 1;
            rows[d].opened = true; rows[d].done = true; rows[d].step = 3;
            RegionSagaState.Restore(rows, false);

            if (RegionSagaRunner.MapMark(a) != "📜" || RegionSagaRunner.MapMark(c) != "🔍" || RegionSagaRunner.MapMark(d) != "🏳"
                || RegionSagaRunner.MapMark(DungeonWorldMap.IndexOf("scrap")) != "❔") Fail("지도 표");
            string hud = RegionSagaRunner.HudLine(a);
            if (!hud.Contains(DungeonRegionSagas.Title(a)) || !hud.Contains($"4/{DungeonRegionSagas.Need(a, 0)}")) Fail($"HUD 줄 '{hud}'");
            if (!RegionSagaRunner.HudLine(c).Contains(DungeonRegionSagas.Clue(c))) Fail("흔적 걸음 HUD 줄");
            if (RegionSagaRunner.HudLine(d).Length != 0 || RegionSagaRunner.HudLine(-1).Length != 0) Fail("평정·지역 밖 HUD 줄이 빈 글 아님");

            var hudComp = Object.FindFirstObjectByType<PlayerHud>();
            var label = hudComp != null ? typeof(PlayerHud).GetField("label", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(hudComp) as TMPro.TextMeshProUGUI : null;
            var refresh = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            if (label != null && refresh != null)
            {
                Vector3 p = DungeonWorldMap.CellCenter(a);
                Place(playerGo, p);
                tracker.Tick(p, 0f);
                refresh.Invoke(hudComp, null);
                if (!label.text.Contains(DungeonRegionSagas.Title(a))) Fail($"HUD 에 사연 줄 없음 '{label.text}'");
            }
            else Fail("HUD 글 못 찾음");

            map.SetVisible(true);
            if (!map.CellText(c).StartsWith("🔍") || !map.CellText(d).StartsWith("🏳")) Fail($"지도 칸 표 '{map.CellText(c)}'");
            if (!map.SagaCountText.Contains("1/9")) Fail($"평정 수 '{map.SagaCountText}'");
            map.SetVisible(false);
            return " 화면";
        }

        private static string CheckSave()
        {
            var saveType = typeof(SaveState);
            var ver = saveType.GetField("SaveVersion", BindingFlags.NonPublic | BindingFlags.Static);
            if (ver == null || (int)ver.GetValue(null) < 14) Fail($"세이브 버전 {(ver != null ? ver.GetValue(null) : "?")} < 14");
            var data = saveType.GetNestedType("SaveData", BindingFlags.NonPublic);
            if (data == null || data.GetField("regionSaga") == null || data.GetField("regionSagaAll") == null) Fail("SaveData.regionSaga/All 없음");
            int a = DungeonWorldMap.IndexOf("jungwon");
            var w = JsonUtility.FromJson<Wrap>(JsonUtility.ToJson(new Wrap { rows = RegionSagaState.Snapshot(), all = true }));
            RegionSagaState.Restore(null, false);
            if (RegionSagaState.Get(a).opened || RegionSagaState.DoneCount() != 0) Fail("옛 세이브(null) 인데 열림");
            RegionSagaState.Restore(w.rows, w.all);
            if (RegionSagaState.Have(a) != 4 || RegionSagaState.DoneCount() != 1 || !RegionSagaState.AllDone) Fail("JSON 왕복");
            RegionSagaState.Restore(new[] { new RegionSagaState.Entry { key = "nowhere", opened = true }, new RegionSagaState.Entry { key = "neon", step = 9, done = true } }, false);
            var n = RegionSagaState.Get(DungeonWorldMap.IndexOf("neon"));
            if (!n.done || !n.opened || n.step != 3 || RegionSagaState.Get(a).opened) Fail("키 맞춤·걸음 상한");
            return " 세이브 v14";
        }

        [System.Serializable] private class Wrap { public RegionSagaState.Entry[] rows; public bool all; }

        private static string CheckLocalization()
        {
            var keys = new List<string> { "saga.step.hunt", "saga.step.clue", "saga.step.elite", "saga.step.boss", "saga.desc.hunt", "saga.desc.clue",
                "saga.desc.elite", "saga.desc.boss", "saga.open", "saga.found", "saga.step_done", "saga.pacified", "saga.all", "saga.next", "saga.map_count",
                "enemy.region_skeleton_grunt" };
            foreach (var r in DungeonWorldMap.All)
                foreach (var f in new[] { "title", "giver", "intro", "clue", "found", "elite", "done" }) keys.Add($"saga.{r.Key}.{f}");
            int n = 0;
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var k in keys) { if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음"); n++; }
            }
            if (!DungeonEnemy.HasDisplayNameKey(RegionSagaRunner.SkeletonGruntKo)) Fail("해골 졸개 번역 키");
            return $" 키 {n}";
        }

        /// <summary>그 자리에 잡졸 하나를 세워 곧바로 쓰러뜨린다(처치 자리 판정용).</summary>
        private static void Kill(Vector3 at, bool elite)
        {
            var go = new GameObject("RegionSagaDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("saga_test", null);
            e.ConfigureCombat(10f, 1f, 1, 1, null, null, false, "황건적", Color.white, 1f);
            if (elite) e.MarkElite();
            go.SetActive(true);
            Dummies.Add(go);
            e.TakeDamage(1e9f);
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
