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
    /// PLAN.md 109-10-5 지역 몬스터·위험도·우두머리(웹 사가블로 §5.13) 진단 — `PlaytestDungeonHeadless` 가 지역 아홉 진단 뒤에 부른다(한 프레임 안, 시각은 `RegionBossState.NowOverride`).
    /// 웹 진단(명단 이름·1단계·몸 / 위험도 중원 0·멀수록·상한·모루골 floor 0 / 명단·단계 밖 0 / 자리·호위·전설·10분)을 이 트랙에 맞춰:
    /// 표(위험 웹 값·중원 1층·우두머리 층 = 위험 + 4·체력 ×3·아홉 이름·빌린 몸 서로 다르고 이 판 몸과 안 겹침·자리가 제 지역 방 안·층 진행기 몸 목록·도감 이름 키) ·
    /// 표식 아홉 · 알림(4m·한 번) · 밟기(우두머리 + 호위 셋·시대대로 몸 이름·엘리트 수치·방 안쪽) · 두 번 안 섬 · 끈(18m 밖 물러남·쉼 없음) ·
    /// 토벌(기록·첫 토벌·공적 금·전설 = 해시·쉼 10분·표식 흐림·쉬는 동안 안 섬·호위도 끈으로 물러남) · 10분 뒤 다시(두 번째 전설·첫 토벌 아님) ·
    /// HUD 지역·위험 줄 · 배너 셋째 줄 · M 지도 ☠·✔·흐림 · 세이브 v13 왕복·옛 세이브 · ko/en 키.
    /// 끝나면 영웅·도감·우두머리 기록·플레이어 자리·배너 상태를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonRegionFoes
    {
        private const string T = "[PlaytestDungeonHeadless] regionfoes";
        private static readonly int[] WebDanger = { 0, 3, 2, 6, 4, 3, 5, 4, 6 };
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var runner = RegionBossRunner.Instance;
            var tracker = DungeonRegionTracker.Instance;
            var map = Object.FindFirstObjectByType<OverworldMapUI>();
            if (playerGo == null || runner == null || tracker == null || map == null)
            {
                Fail($"필요한 것 없음(러너 {runner != null}·추적기 {tracker != null}·지도 {map != null})");
                return false;
            }
            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            var bossRows = RegionBossState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            int announced = tracker.Announced;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                RegionBossState.NowOverride = 1_000_000;
                RegionBossState.Restore(null);
                m += CheckTable() + CheckMarkers(runner) + CheckSummonAndKill(runner) + CheckHud(tracker, playerGo)
                    + CheckBanner(tracker) + CheckMap(map) + CheckSave() + CheckLocalization();
            }
            finally
            {
                for (int r = 0; r < DungeonWorldMap.All.Length; r++) runner.Withdraw(r, toast: false);
                runner.ResetNotices();
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                RegionBossState.NowOverride = -1;
                RegionBossState.Restore(bossRows);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                map.SetVisible(false);
                Place(playerGo, pos);
                tracker.Tick(pos, 0f);
                tracker.ResetState(announced);
            }
            if (_ok) Debug.Log($"{T} OK - 표(위험 웹 값·층·체력 ×3·이름·빌린 몸·자리)·표식 아홉·알림 한 번·밟기(우두머리+호위 셋 시대대로)·끈·토벌(기록·공적·전설·쉼 10분·흐림)·10분 뒤 다시·HUD 위험·배너·M 지도 ☠✔·세이브 v13·ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var bosses = DungeonRegionFoes.Bosses;
            if (bosses.Length != DungeonWorldMap.All.Length || DungeonRegionFoes.Danger.Length != DungeonWorldMap.All.Length)
                Fail($"우두머리 {bosses.Length}·위험 {DungeonRegionFoes.Danger.Length} ≠ 지역 {DungeonWorldMap.All.Length}");
            var names = new HashSet<string>();
            var bodies = new HashSet<string>();
            var own = new HashSet<string>(DungeonEras.OldBodies);
            foreach (var b in DungeonEras.FoeBodies()) own.Add(b);
            own.Add(DungeonEras.ModernPeddlerBody);
            own.Add(DungeonEras.FuturePeddlerBody);
            own.Add("Brute");
            own.Add("Maria");
            for (int i = 0; i < bosses.Length && i < WebDanger.Length; i++)
            {
                var b = bosses[i];
                string key = DungeonWorldMap.All[i].Key;
                if (DungeonRegionFoes.Danger[i] != WebDanger[i]) Fail($"{key} 위험 {DungeonRegionFoes.Danger[i]} ≠ 웹 {WebDanger[i]}");
                if (b.Id != "rb_" + key) Fail($"{key} 우두머리 id {b.Id}");
                if (string.IsNullOrEmpty(b.NameKo) || !names.Add(b.NameKo)) Fail($"{key} 우두머리 이름 '{b.NameKo}' 빔/겹침");
                if (string.IsNullOrEmpty(b.DescKo)) Fail($"{key} 사연 빔");
                if (!bodies.Add(b.Body)) Fail($"{key} 몸 {b.Body} 겹침");
                if (own.Contains(b.Body)) Fail($"{key} 몸 {b.Body} 이 이 판 몸과 겹침(다른 판 몸을 빌려야)");
                if (!DungeonEnemy.HasDisplayNameKey(b.NameKo)) Fail($"{key} 우두머리 이름 번역 키 없음");
                if (DungeonWorldMap.IndexAt(b.Spot) != i) Fail($"{key} 자리 {b.Spot} 가 제 지역이 아님({DungeonWorldMap.IndexAt(b.Spot)})");
                Vector3 c = DungeonRegionFoes.RoomCenterOf(b.Spot);
                float inRoom = Mathf.Max(Mathf.Abs(b.Spot.x - c.x), Mathf.Abs(b.Spot.z - c.z));
                if (inRoom > 8.5f) Fail($"{key} 자리가 방 가운데에서 {inRoom:0.0}m(방 반폭 10 — 벽 가 8.5 안이어야)");
                bool roomOk = false;
                foreach (var path in DungeonWorldMap.All[i].Rooms)
                {
                    var go = GameObject.Find(path);
                    if (go != null && (go.transform.position - c).sqrMagnitude < 1f) roomOk = true;
                }
                if (!roomOk) Fail($"{key} 자리의 방 {c} 이 그 지역 방이 아님");
                if (DungeonRegionFoes.BossFloor(i) != WebDanger[i] + 4) Fail($"{key} 우두머리 층 {DungeonRegionFoes.BossFloor(i)}");
                float hp = Mathf.Round(DungeonFormulas.EnemyHp(WebDanger[i] + 4, true) * 3f);
                if (!Mathf.Approximately(DungeonRegionFoes.BossHp(i), hp)) Fail($"{key} 우두머리 체력 {DungeonRegionFoes.BossHp(i)} ≠ {hp}");
            }
            if (DungeonRegionFoes.RegionFloor(DungeonWorldMap.IndexOf("jungwon")) != 1) Fail("중원 적 층이 1(예전 들판)이 아님");
            if (DungeonRegionFoes.RegionFloor(DungeonWorldMap.IndexOf("scrap")) != 6) Fail("기계 황무지 적 층 ≠ 6");
            if (!DungeonEnemy.HasDisplayNameKey(DungeonRegionFoes.SkeletonNameKo)) Fail("해골 무사 번역 키 없음");

            var floorRunner = DungeonFloorRunner.Instance;
            var want = DungeonRegionFoes.BorrowedBodies();
            var have = floorRunner != null ? floorRunner.RegionBodyNames : new string[0];
            if (have.Length != want.Length) Fail($"층 진행기 빌린 몸 {have.Length} ≠ {want.Length}");
            int loaded = 0;
            for (int i = 0; i < want.Length && i < have.Length; i++)
            {
                if (have[i] != want[i]) Fail($"빌린 몸 {i} {have[i]} ≠ {want[i]}");
                if (floorRunner.RegionBody(want[i]) != null) loaded++;
            }
            return $" 몸 {loaded}/{want.Length}";
        }

        private static string CheckMarkers(RegionBossRunner runner)
        {
            for (int r = 0; r < DungeonWorldMap.All.Length; r++)
            {
                var mk = runner.Marker(r);
                if (mk == null) { Fail($"{DungeonWorldMap.All[r].Key} 표식 없음"); continue; }
                if ((mk.position - DungeonRegionFoes.Bosses[r].Spot).sqrMagnitude > 0.01f) Fail($"{DungeonWorldMap.All[r].Key} 표식 자리 {mk.position}");
                if (runner.GemDim(r)) Fail($"{DungeonWorldMap.All[r].Key} 처음부터 흐림");
            }
            return " 표식 9";
        }

        private static string CheckSummonAndKill(RegionBossRunner runner)
        {
            int r = DungeonWorldMap.IndexOf("heaven");
            Vector3 spot = DungeonRegionFoes.Bosses[r].Spot;
            int lv = DungeonRegionFoes.BossFloor(r);
            runner.ResetNotices();

            // 알림 — 4m 안 한 번, 표식 밖이라 안 섬.
            runner.Tick(spot + new Vector3(3f, 0f, 0f));
            if (!runner.Noticed(r) || runner.IsUp(r)) Fail($"4m 알림 {runner.Noticed(r)}·섬 {runner.IsUp(r)}");
            if (!RegionBossRunner.NoticeText(r).Contains(DungeonRegionFoes.BossName(r))) Fail("알림 글에 이름 없음");
            runner.Tick(spot + new Vector3(6f, 0f, 0f));
            if (runner.IsUp(r)) Fail("6m 에서 섬");

            // 밟기.
            runner.Tick(spot);
            var boss = runner.BossOf(r);
            if (!runner.IsUp(r) || boss == null) { Fail("밟아도 안 섬"); return ""; }
            if (!boss.IsBoss || boss.IsWorldBoss || !Mathf.Approximately(boss.CurrentHp, DungeonRegionFoes.BossHp(r))) Fail($"우두머리 체력 {boss.CurrentHp}/{DungeonRegionFoes.BossHp(r)}");
            if (boss.DisplayNameRaw != DungeonRegionFoes.Bosses[r].NameKo) Fail($"우두머리 이름 {boss.DisplayNameRaw}");
            if (System.Array.IndexOf(DungeonRegionFoes.Legends, boss.RewardItemId) < 0 ||boss.RewardItemId != DungeonRegionFoes.LegendFor(r, 0)) Fail($"전설 {boss.RewardItemId}");
            var guards = runner.GuardsOf(r);
            if (guards.Count != DungeonRegionFoes.Guards) Fail($"호위 {guards.Count}");
            Vector3 center = DungeonRegionFoes.RoomCenterOf(spot);
            string futureName = DungeonEras.FoeFor(lv, DungeonEra.Future).NameKo;
            for (int i = 0; i < guards.Count; i++)
            {
                var g = guards[i];
                string want = DungeonRegionFoes.GuardEra(r, i) == "myth" ? DungeonRegionFoes.SkeletonNameKo : futureName;
                if (g.DisplayNameRaw != want) Fail($"호위 {i} 이름 {g.DisplayNameRaw} ≠ {want}");
                if (g.IsBoss || !Mathf.Approximately(g.CurrentHp, DungeonFormulas.EliteHp(lv))) Fail($"호위 {i} 체력 {g.CurrentHp}/{DungeonFormulas.EliteHp(lv)}");
                Vector3 p = g.transform.position;
                if (Mathf.Abs(p.x - center.x) > 9f || Mathf.Abs(p.z - center.z) > 9f) Fail($"호위 {i} 가 방 밖 {p}");
            }
            if (DungeonRegionFoes.GuardEra(r, 0) != "myth" || DungeonRegionFoes.GuardEra(r, 1) != "future") Fail("천계 호위 시대(신화·미래)");

            runner.Tick(spot);
            if (runner.BossOf(r) != boss) Fail("두 번 섬");

            // 끈 — 18m 밖이면 물러남, 기록·쉼 없음, 다시 밟으면 섬.
            runner.Tick(spot + new Vector3(0f, 0f, -19f));
            if (runner.IsUp(r) || runner.GuardsOf(r).Count != 0) Fail("18m 밖에도 남음");
            if (RegionBossState.Kills(r) != 0 || RegionBossState.IsResting(r)) Fail("물러남이 토벌로 셈");
            runner.Tick(spot);
            boss = runner.BossOf(r);
            if (boss == null || !runner.IsUp(r)) { Fail("물러난 뒤 다시 안 섬"); return ""; }

            // 토벌.
            HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 0, "wp_start", null);
            int goldBefore = HeroState.Gold;
            int pillars = LootMarker.PillarCount;
            string legend = boss.RewardItemId;
            boss.TakeDamage(1e9f);
            if (RegionBossState.Kills(r) != 1 || !runner.LastFirst || runner.LastKilled != r) Fail($"토벌 기록 {RegionBossState.Kills(r)}·첫 {runner.LastFirst}");
            var row = RegionBossState.Get(r);
            if (row.firstAt != RegionBossState.Now || row.lastAt != RegionBossState.Now) Fail($"토벌 시각 {row.firstAt}/{row.lastAt}");
            int merit = DungeonRegionFoes.MeritGold(r);
            if (runner.LastMerit != merit || HeroState.Gold < goldBefore + merit + DungeonRegionFoes.BossGold(r)) Fail($"금 +{HeroState.Gold - goldBefore}(공적 {merit} + 우두머리 {DungeonRegionFoes.BossGold(r)})");
            if (HeroState.EquippedWeaponId != legend) Fail($"전설 {legend} 을 안 갖춤({HeroState.EquippedWeaponId})");
            if (LootMarker.PillarCount != pillars + 1 || LootMarker.LastPillarTier != LootMarker.PillarUnique) Fail("토벌 빛기둥(고유)");
            if (!RegionBossState.IsResting(r) || System.Math.Abs(RegionBossState.RestLeft(r) - 600) > 0.5) Fail($"쉼 {RegionBossState.RestLeft(r)}");
            runner.Tick(spot);
            if (runner.IsUp(r)) Fail("쉬는 동안 섬");
            if (!runner.GemDim(r)) Fail("쉬는 동안 표식이 안 흐림");
            if (runner.GuardsOf(r).Count != DungeonRegionFoes.Guards) Fail("우두머리가 쓰러지자 호위가 사라짐(남아 싸워야)");
            if (!RegionBossRunner.NoticeText(r).Contains("10")) Fail($"쉼 알림 '{RegionBossRunner.NoticeText(r)}'");
            runner.Tick(spot + new Vector3(0f, 0f, -19f));
            if (runner.GuardsOf(r).Count != 0) Fail("남은 호위가 끈으로 안 물러남");

            // 10분 뒤 — 다시 서고 두 번째 전설, 첫 토벌 아님.
            RegionBossState.NowOverride += 601;
            runner.Tick(spot + new Vector3(0f, 0f, -19f));
            if (runner.GemDim(r)) Fail("쉼이 끝나도 흐림");
            runner.Tick(spot);
            boss = runner.BossOf(r);
            if (boss == null) { Fail("10분 뒤 안 섬"); return ""; }
            if (boss.RewardItemId != DungeonRegionFoes.LegendFor(r, 1)) Fail($"두 번째 전설 {boss.RewardItemId}");
            boss.TakeDamage(1e9f);
            if (RegionBossState.Kills(r) != 2 || runner.LastFirst) Fail($"두 번째 토벌 {RegionBossState.Kills(r)}·첫 {runner.LastFirst}");
            if (RegionBossState.Get(r).firstAt != 1_000_000) Fail("첫 토벌 시각이 바뀜");
            runner.Withdraw(r, toast: false);

            // 과거 지역(중원) 호위는 황건 정예 셋.
            int j = DungeonWorldMap.IndexOf("jungwon");
            runner.Summon(j);
            foreach (var g in runner.GuardsOf(j))
                if (g.DisplayNameRaw != DungeonRegionFoes.PastEliteName) Fail($"중원 호위 {g.DisplayNameRaw}");
            if (runner.BossOf(j) == null || !Mathf.Approximately(runner.BossOf(j).CurrentHp, DungeonRegionFoes.BossHp(j))) Fail("중원 우두머리 체력");
            runner.Withdraw(j, toast: false);
            return $" 전설 {legend}·공적 {merit}";
        }

        private static string CheckHud(DungeonRegionTracker tracker, GameObject playerGo)
        {
            var hud = Object.FindFirstObjectByType<PlayerHud>();
            var label = hud != null ? typeof(PlayerHud).GetField("label", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(hud) as TMPro.TextMeshProUGUI : null;
            var refresh = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            if (label == null || refresh == null) { Fail("HUD 글 못 찾음"); return ""; }
            int h = DungeonWorldMap.IndexOf("hellgate");
            Vector3 c = DungeonWorldMap.CellCenter(h);
            Place(playerGo, c);
            tracker.Tick(c, 0f);
            refresh.Invoke(hud, null);
            if (!label.text.Contains(DungeonRegionFoes.DangerLabel(h))) Fail($"HUD 에 위험 없음 '{label.text}'");
            Vector3 dungeon = new Vector3(0f, 0f, 120f);
            Place(playerGo, dungeon);
            tracker.Tick(dungeon, 0f);
            refresh.Invoke(hud, null);
            if (label.text.Contains(DungeonRegionFoes.DangerLabel(h))) Fail("던전 층인데 HUD 에 위험 줄");
            return " HUD";
        }

        private static string CheckBanner(DungeonRegionTracker tracker)
        {
            int s = DungeonWorldMap.IndexOf("silkroad");
            tracker.ResetState(-1);
            Vector3 c = DungeonWorldMap.CellCenter(s);
            tracker.Tick(c, 0f);
            tracker.Tick(c, 1.3f);
            if (!tracker.BannerVisible || !tracker.BannerText.Contains(DungeonRegionFoes.BossName(s)) || !tracker.BannerText.Contains(DungeonRegionFoes.DangerLabel(s)))
                Fail($"배너 셋째 줄 '{tracker.BannerText}'");
            return " 배너";
        }

        private static string CheckMap(OverworldMapUI map)
        {
            map.SetVisible(true);
            int r = DungeonWorldMap.IndexOf("heaven");
            for (int i = 0; i < map.CellCount; i++)
            {
                string t = map.CellText(i);
                if (!t.Contains("☠ " + DungeonRegionFoes.BossName(i))) Fail($"지도 칸 {i} 우두머리 줄 없음 '{t}'");
                if ((i == r) != t.Contains("✔")) Fail($"지도 칸 {i} 토벌 표시(✔) 틀림");
            }
            // 두 번째 토벌이 1_000_601 — 아직 쉬는 중이라 흐림, 쉼이 끝나면 밝게.
            if (!map.CellText(r).Contains("#8c8c8c")) Fail("쉬는 우두머리가 지도에서 안 흐림");
            RegionBossState.NowOverride += 601;
            map.RefreshCellTexts();
            if (map.CellText(r).Contains("#8c8c8c")) Fail("쉼이 끝나도 지도에서 흐림");
            map.SetVisible(false);
            return " 지도";
        }

        private static string CheckSave()
        {
            var saveType = typeof(SaveState);
            var ver = saveType.GetField("SaveVersion", BindingFlags.NonPublic | BindingFlags.Static);
            if (ver == null || (int)ver.GetValue(null) < 13) Fail($"세이브 버전 {(ver != null ? ver.GetValue(null) : "?")} < 13");
            var data = saveType.GetNestedType("SaveData", BindingFlags.NonPublic);
            if (data == null || data.GetField("regionBoss") == null) Fail("SaveData.regionBoss 없음");
            int r = DungeonWorldMap.IndexOf("heaven");
            var w = JsonUtility.FromJson<Wrap>(JsonUtility.ToJson(new Wrap { rows = RegionBossState.Snapshot() }));
            RegionBossState.Restore(null);
            if (RegionBossState.Kills(r) != 0) Fail("옛 세이브(null) 인데 토벌 남음");
            RegionBossState.Restore(w.rows);
            if (RegionBossState.Kills(r) != 2 || RegionBossState.Get(r).firstAt != 1_000_000) Fail($"JSON 왕복 {RegionBossState.Kills(r)}·{RegionBossState.Get(r).firstAt}");
            var shuffled = new[] { new RegionBossState.Entry { key = "nowhere", kills = 5 }, new RegionBossState.Entry { key = "scrap", kills = 3, lastAt = 7 } };
            RegionBossState.Restore(shuffled);
            if (RegionBossState.Kills(DungeonWorldMap.IndexOf("scrap")) != 3 || RegionBossState.Kills(r) != 0) Fail("키로 맞춰 읽기");
            return " 세이브 v13";
        }

        [System.Serializable] private class Wrap { public RegionBossState.Entry[] rows; }

        private static string CheckLocalization()
        {
            int n = 0;
            var keys = new List<string> { "region.danger", "rboss.notice", "rboss.notice_rest", "rboss.appear", "rboss.withdraw", "rboss.kill", "rboss.kill_first", DungeonRegionFoes.SkeletonNameKey };
            foreach (var r in DungeonWorldMap.All) { keys.Add($"rboss.{r.Key}"); keys.Add($"rboss.{r.Key}.desc"); }
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var k in keys) { if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음"); n++; }
            }
            return $" 키 {n}";
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
