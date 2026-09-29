using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-9 "숨은 터·원기·주간 보스"(웹 사가고 ⑲-9 진단 항목) — `PlaytestHeadless` 가 일일 의뢰 진단 뒤에 부른다.
    /// 표(자리 넷이 뭍·들판 무리·역참·수호장에서 55m 넘게·서로 80m 넘게 · 보상 표 · 원기 채움 · 주 갈림 월요일 새벽 4시 · 주간 값 25·25·45) ·
    /// 들어가기(단계 잠금) · 무덤 I 전체(대기 3초·파도 둘·위험 2 × 단계·천하 0·경험 없음·물 기운·보상 나무·원기 모자람·받기 보상) ·
    /// 실패 셋(원판 밖·시간·전멸, 원기 안 씀) · 쇠부리 공격 ×1.3 · 서당 기력 · 주간 보스(값·절반에서 뇌 방패·간격 ×0.69·받기 25·비늘) ·
    /// 화면(입구 카드·잠긴 단계·도전 단추·줄·물러나기) · 세이브 v26 왕복·v25 로드(가득). 끝나면 원기·돈·보패·재료·강화석·레벨·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoDomain
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var df = DomainField.Instance;
            var ui = DomainUi.Instance;
            if (fc == null || pc == null || df == null || ui == null) { Fail("FieldCombat/PlayerController/DomainField/DomainUi 없음"); return false; }

            var dom0 = DomainState.Snapshot();
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var arts0 = ArtifactState.Snapshot();
            int seq0 = ArtifactState.Seq, pol0 = ArtifactState.Polish;
            var inv0 = WeaponState.SnapshotInv();
            var eq0 = WeaponState.SnapshotEquip();
            int ore0 = WeaponState.Ore;
            var tal0 = TalentState.Snapshot();
            var mat0 = TalentState.SnapshotMats();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            int chE = StoryState.Ch, stE = StoryState.StepIndex;
            try
            {
                DomainState.NowForTest = 1_000_000_000;
                CheckTables();
                PlayerStats.Restore(1, 0);
                CheckTomb(df, fc, pc);
                CheckFails(df, fc, pc);
                CheckWeekly(df, fc, pc);
                CheckUi(df, ui, fc, pc);
                CheckSave(savePath);
                CheckEcho(df, ui, fc, pc);
            }
            finally
            {
                if (df.Running) df.Leave();
                StoryState.Restore(chE, stE);
                df.RefreshEchoes();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                DomainState.NowForTest = -1;
                DomainState.Restore(dom0.resin, dom0.t, dom0.claims, dom0.week, dom0.weekN);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                ArtifactState.Restore(arts0, seq0, pol0);
                WeaponState.Restore(inv0, eq0, ore0);
                TalentState.Restore(tal0, mat0);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] domain OK - 자리 넷(뭍·무리/역참/수호장 55m·서로 80m) · 보상 표 · 원기 10분에 1 · 주 갈림 월요일 4시 · 무덤 I(파도 둘·위험 2·천하 0·경험 없음·물 기운·나무·받기) · 실패 셋(원기 안 씀) · 쇠부리 ×1.3 · 서당 기력 · 주간 보스(4400·뇌 방패·×0.69·25·비늘) · 입구 카드·단추 · 세이브 v26 왕복·v25 로드");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.5f) => Mathf.Abs(a - b) <= eps;

        private static float Flat(Vector3 a, Vector3 b) { a.y = b.y = 0f; return (a - b).magnitude; }

        private static void CheckTables()
        {
            if (GoDomain.Sites.Length != 4) Fail("자리 넷이 아님");
            foreach (var s in GoDomain.Sites)
            {
                Vector3 p = s.Pos;
                var (gx, gy) = TestMapData.WorldToGrid(p);
                char ch = TestMapData.TileAt(gx, gy);
                if (ch == '~' || ch == '^' || ch == 'B' || ch == 'H') Fail($"{s.Id} 가 뭍이 아님('{ch}')");
                foreach (var c in FieldSpawner.GroupCenters()) if (Flat(c, p) < 55f) Fail($"{s.Id} 가 들판 무리와 {Flat(c, p):0}m");
                foreach (var w in GoWorldMap.Waypoints) if (Flat(GoWorldMap.WaypointPos(w), p) < 55f) Fail($"{s.Id} 가 {w.Id} 와 {Flat(GoWorldMap.WaypointPos(w), p):0}m");
                if (Flat(TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy), p) < 55f) Fail($"{s.Id} 가 수호장과 가까움");
                foreach (var o in GoDomain.Sites) if (o.Id != s.Id && Flat(o.Pos, p) < GoDomain.ArenaR * 2f) Fail($"{s.Id}·{o.Id} 원판 겹침");
            }
            var r = GoDomain.RewardOf(GoDomain.Kind.Tomb, 0, 0);
            if (r.Gold != 60 || r.Arts.Count != 2 || r.Arts[0] != (4, "crimson") || r.Polish != 1) Fail("무덤 I 보상 표");
            var w2 = GoDomain.RewardOf(GoDomain.Kind.Weekly, 2, 1);
            if (w2.Gold != 260 || w2.Arts.Count != 2 || w2.Arts[1] != (5, "gladiator") || w2.Mats[2] != 2 || w2.Mats[3] != 1 || w2.Mats[4] != 3) Fail("주간 III 보상 표");
            if (GoDomain.RewardOf(GoDomain.Kind.Forge, 1, 0).Ore != 5 || GoDomain.RewardOf(GoDomain.Kind.School, 2, 0).Mats[2] != 1) Fail("쇠부리·서당 보상 표");
            long t0 = 1_000_000;
            if (GoDomain.ResinAt(100, t0, t0 + 1200) != (102, t0 + 1200) || GoDomain.ResinAt(100, t0, t0 + 1199) != (101, t0 + 600) || GoDomain.ResinAt(119, t0, t0 + 3600).v != 120) Fail("원기 채움");
            long mon3 = new System.DateTimeOffset(new System.DateTime(2026, 9, 28, 3, 0, 0, System.DateTimeKind.Local)).ToUnixTimeSeconds();
            if (GoDomain.WeekKey(mon3) != "2026-09-21" || GoDomain.WeekKey(mon3 + 3600) != "2026-09-28") Fail($"주 갈림 {GoDomain.WeekKey(mon3)}/{GoDomain.WeekKey(mon3 + 3600)}");
            DomainState.ResetForTest();
            if (DomainState.Resin != GoDomain.ResinMax || DomainState.CostOf(GoDomain.Kind.Weekly) != 25 || DomainState.CostOf(GoDomain.Kind.Tomb) != 15) Fail("처음 원기·값");
            DomainState.MarkClaim(GoDomain.Kind.Weekly); DomainState.MarkClaim(GoDomain.Kind.Weekly);
            if (DomainState.CostOf(GoDomain.Kind.Weekly) != 45) Fail("이번 주 셋째 주간 값 45");
            DomainState.ResetForTest();
        }

        private static GoDomain.Site SiteOf(GoDomain.Kind k)
        {
            foreach (var s in GoDomain.Sites) if (s.Kind == k) return s;
            return GoDomain.Sites[0];
        }

        private static void Stand(PlayerController pc, GoDomain.Site s, float off = 3f) => pc.Teleport(DomainField.SitePos(s) + new Vector3(0f, 0.3f, off));

        private static void KillAll(DomainField df)
        {
            foreach (var e in df.Current.Foes.ToArray()) if (e != null && e.Alive) { if (e.Shielded) e.SetShieldForTest(0f); e.TakeRaw(e.Hp + 99999f, Color.white); }
        }

        private static void CheckTomb(DomainField df, FieldCombat fc, PlayerController pc)
        {
            var s = SiteOf(GoDomain.Kind.Tomb);
            Stand(pc, s);
            fc.ResetForTest();
            if (df.CanEnter(s, 1, out string why) || !why.Contains("6")) Fail($"여정 1 에 단계 II '{why}'");
            if (!df.Enter(s, 0)) { Fail("무덤 I 들어가기"); return; }
            df.Step(1f);
            if (df.Current.Phase != "wait" || df.Current.Foes.Count != 0) Fail("3초 전에 적");
            df.Step(2.1f);
            var foes = df.Current.Foes;
            if (df.Current.Phase != "fight" || foes.Count != 3) { Fail($"첫 파도 {foes.Count}"); return; }
            var ghost = foes[0];
            if (!ghost.DomainFoe || ghost.WorldLevel != 0 || !Near(ghost.MaxHp, 300f * GoWorldMap.DangerMul(2)) || ghost.CurrentState != FieldEnemy.State.Chase) Fail($"물귀신 체력 {ghost.MaxHp}·쫓기 {ghost.CurrentState}");
            df.Step(GoDomain.LeyWaterSec + 0.1f);
            if (ghost.Aura != GoElement.Hydro) Fail($"무덤 물 기운 {ghost.Aura}");
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            KillAll(df);
            if (PlayerStats.Exp != exp || PlayerStats.Level != lv) Fail("숨은 터 적이 경험을 줌");
            df.Step(0.1f);
            if (df.Current.Wave != 1 || df.Current.Foes.Count != 6) Fail($"둘째 파도 {df.Current.Wave}");
            else if (df.Current.Foes[3].Element != GoElement.Geo) Fail("둘째 파도 첫 적이 암이 아님");
            KillAll(df);
            df.Step(0.1f); // 나무가 자라고
            df.Step(0.1f); // 다음 틱에 가운데 선 것을 본다
            if (df.Current.Phase != "tree" || !df.Current.Asked) { Fail($"보상 나무 {df.Current.Phase}·가까이 {df.Current.Asked}"); df.Leave(); return; }
            if (ghost != null && ghost.gameObject.activeInHierarchy && ghost.Alive) Fail("나무가 자랐는데 적이 남음");
            DomainState.SetResinForTest(10);
            if (df.Claim(out why) != null || !why.Contains("10")) Fail($"원기 10 으로 받음 '{why}'");
            DomainState.SetResinForTest(120);
            GoldState.Restore(0);
            int arts = ArtifactState.Count, pol = ArtifactState.Polish;
            string got = df.Claim(out why);
            if (got == null || DomainState.Resin != 105 || GoldState.Gold != 60 || ArtifactState.Count != arts + 2 || ArtifactState.Polish != pol + 1 || df.Running) Fail($"무덤 I 받기 '{got ?? why}' 원기 {DomainState.Resin}");
        }

        private static void CheckFails(DomainField df, FieldCombat fc, PlayerController pc)
        {
            DomainState.SetResinForTest(120);
            var school = SiteOf(GoDomain.Kind.School);
            Stand(pc, school);
            fc.ResetForTest();
            if (!df.Enter(school, 0)) { Fail("서당 들어가기"); return; }
            df.Step(3.1f);
            foreach (var m in fc.Party) m.Energy = 0f;
            var f0 = df.Current.Foes[0];
            f0.SetShieldForTest(0f); // 풍 방패부터
            f0.TakeRaw(f0.Hp + 99999f, Color.white);
            if (!Near(fc.Party[0].Energy, GoDomain.LeyEnergy, 0.01f)) Fail($"서당 기력 {fc.Party[0].Energy}");
            pc.Teleport(DomainField.SitePos(school) + new Vector3(GoDomain.ArenaR + 5f, 0.3f, 0f));
            df.Step(0.1f);
            if (df.Running || !df.LastEnd.Contains(GoLocalization.T("domain.why.out", "원판을 벗어났다"))) Fail("원판 밖 실패");
            if (DomainState.Resin != 120) Fail("실패했는데 원기를 씀");

            var forge = SiteOf(GoDomain.Kind.Forge);
            Stand(pc, forge);
            fc.ResetForTest();
            df.Enter(forge, 0);
            df.Step(3.1f);
            var imp = df.Current.Foes[0];
            if (!Near(imp.Atk, 24f * GoWorldMap.DangerMul(2) * GoDomain.LeyAtk, 0.05f)) Fail($"쇠부리 공격 {imp.Atk}");
            df.Step(GoDomain.Limit + 1f);
            if (df.Running || !df.LastEnd.Contains(GoLocalization.T("domain.why.time", "시간이 다 됐다"))) Fail("시간 실패");

            Stand(pc, forge);
            fc.ResetForTest();
            df.Enter(forge, 0);
            df.Step(3.1f);
            fc.WipeAndReturn();
            if (df.Running || !df.LastEnd.Contains(GoLocalization.T("domain.why.wiped", "모두 쓰러졌다"))) Fail("전멸 실패");
            fc.ResetForTest();
        }

        private static void CheckWeekly(DomainField df, FieldCombat fc, PlayerController pc)
        {
            DomainState.SetResinForTest(120);
            var altar = SiteOf(GoDomain.Kind.Weekly);
            Stand(pc, altar, 3f);
            fc.ResetForTest();
            if (!df.Enter(altar, 0)) { Fail("제단 들어가기"); return; }
            df.Step(3.1f);
            if (df.Current.Foes.Count != 1) { Fail("주간 보스가 하나가 아님"); return; }
            var b = df.Current.Foes[0];
            if (!b.IsWeeklyBoss || !Near(b.MaxHp, GoDomain.BossHp) || !Near(b.Atk, GoDomain.BossAtk, 0.05f) || !Near(b.StrikeReach, GoDomain.BossReach, 0.01f) || b.ShieldMax > 0f) Fail($"보스 값 {b.MaxHp}·{b.Atk}·{b.StrikeReach}");
            b.SetHpForTest(b.MaxHp * 0.49f);
            df.Step(0.1f);
            if (!df.Current.P2 || !Near(b.ShieldHp, b.MaxHp * GoDomain.P2Shield) || b.Element != GoElement.Electro || !Near(b.CdMul, GoDomain.P2Cd, 0.001f)) Fail($"2단계 방패 {b.ShieldHp}·{b.Element}·{b.CdMul}");
            KillAll(df);
            df.Step(0.1f);
            int scales = TalentState.Count(GoTalent.Mat.Scale);
            string got = df.Claim(out string why);
            if (got == null || DomainState.Resin != 95 || TalentState.Count(GoTalent.Mat.Scale) != scales + 1 || DomainState.WeeklyUsed != 1) Fail($"주간 받기 '{got ?? why}' 원기 {DomainState.Resin}");
        }

        private static void CheckUi(DomainField df, DomainUi ui, FieldCombat fc, PlayerController pc)
        {
            var s = SiteOf(GoDomain.Kind.Tomb);
            pc.Teleport(fc.SafePoint);
            ui.Refresh();
            if (ui.CardShown) Fail("입구 밖인데 카드");
            Stand(pc, s);
            fc.ResetForTest();
            ui.Refresh();
            if (!ui.CardShown || !ui.CardInfo.Contains(GoDomain.LootName(GoDomain.Kind.Tomb))) Fail($"입구 카드 '{ui.CardInfo}'");
            if (ui.StageButton(1).interactable || !ui.StageButton(0).interactable) Fail("단계 단추 잠금");
            ui.StageButton(0).onClick.Invoke();
            ui.Refresh();
            if (!df.Running || ui.CardShown || !ui.HudShown) Fail("도전 단추 → 줄");
            ui.LeaveButton.onClick.Invoke();
            ui.Refresh();
            if (df.Running || ui.HudShown) Fail("물러나기 단추");
        }

        // ---- 109-14-56 메아리 — 1차 결말 뒤 이야기 보스 재대결(주간 보스 틀) ----
        private static void CheckEcho(DomainField df, DomainUi ui, FieldCombat fc, PlayerController pc)
        {
            StoryState.OffForTest = false;
            var echoes = GoDomain.Echoes;
            if (echoes.Length != 4 || GoDomain.EchoBossKeys.Length != 4) { Fail("메아리가 넷이 아님"); return; }
            // 1차 결말 앞에는 안 보이고 안 열린다
            StoryState.Restore(28, 0);
            df.RefreshEchoes();
            foreach (var s in echoes) if (df.EchoShown(s.Id)) Fail($"결말 앞인데 {s.Id} 입구가 보임");
            pc.Teleport(DomainField.SitePos(echoes[0]) + new Vector3(0f, 0.3f, 3f));
            if (DomainField.SiteNear(pc.transform.position).HasValue) Fail("결말 앞인데 메아리 입구에 들어감");
            StoryState.Restore(29, 0);
            df.RefreshEchoes();
            foreach (var s in echoes) if (!df.EchoShown(s.Id)) Fail($"결말 뒤인데 {s.Id} 입구가 안 보임");
            // 자리 — 그 보스와 싸운 곳(마을 광장 동쪽 · 서리봉 얼음굴 · 갈림길 · 잠긴 도읍 모래밭), 서로 80m 넘게, 숨은 터와도
            var ip = new[] { GoStory.GridPos(4.5f, 0.5f), GoFrost.Center, GoAreas.Crossing.Center, GoAreas.Sunken.Center };
            if (GoFrost.Contains(echoes[0].Pos) || !GoFrost.Contains(echoes[1].Pos) || !GoAreas.Crossing.Contains(echoes[2].Pos) || !GoAreas.Sunken.Contains(echoes[3].Pos)) Fail("메아리 입구 자리가 그 땅 안이 아님");
            for (int i = 0; i < 4; i++)
            {
                foreach (var o in GoDomain.Sites) if (Flat(o.Pos, echoes[i].Pos) < 40f) Fail($"{echoes[i].Id} 입구가 숨은 터 {o.Id} 입구와 너무 가까움");
                for (int j = i + 1; j < 4; j++) if (Flat(echoes[i].Pos, echoes[j].Pos) < 40f) Fail($"{echoes[i].Id}·{echoes[j].Id} 입구가 너무 가까움");
                var stp = GoDomain.EchoBoss(echoes[i].Id);
                if (stp == null || stp.Foes == null || stp.Foes.Length == 0 || stp.BossKo == null) Fail($"{echoes[i].Id} 보스 단계가 없음");
                Vector3 p = DomainField.SitePos(echoes[i]);
                if (!Physics.Raycast(p + new Vector3(4f, 30f, 0f), Vector3.down, out var hit, 80f) || Mathf.Abs(hit.point.y - p.y) > 1f) Fail($"{echoes[i].Id} 입구 땅이 없다");
            }
            if (Mathf.Abs(GoDomain.LimitOf(GoDomain.Kind.Echo) - 240f) > 0.01f || GoDomain.EchoCost != 60) Fail("메아리 제한·원기 값");
            // 네 입구 다 — 들어가면 그 보스 하나(이름·몸)가 서고, 절반에서 그 보스 원소 방패
            PlayerStats.Restore(64, 0);
            DomainState.Restore(120, DomainState.NowForTest, 0, "", 0);
            for (int i = 0; i < 4; i++)
            {
                var site = echoes[i];
                var stp = GoDomain.EchoBoss(site.Id);
                Stand(pc, site, 3f);
                fc.ResetForTest();
                if (!DomainField.SiteNear(pc.transform.position).HasValue) { Fail($"{site.Id} 입구 곁인데 못 들어감"); continue; }
                if (!df.Enter(site, 0)) { Fail($"{site.Id} 들어가기"); continue; }
                df.Step(3.1f);
                if (df.Current == null || df.Current.Foes.Count != 1) { Fail($"{site.Id} 보스가 하나가 아님"); if (df.Running) df.Leave(); continue; }
                var b = df.Current.Foes[0];
                if (!b.IsStoryBoss || b.DisplayName != GoLocalization.T(stp.BossKey, stp.BossKo)) Fail($"{site.Id} 보스 이름 {b.DisplayName}");
                if (GoStory.Flat(b.transform.position, DomainField.SitePos(site)) > 12f) Fail($"{site.Id} 보스가 입구 곁이 아님");
                b.SetHpForTest(b.MaxHp * 0.49f);
                df.Step(0.1f);
                if (!df.Current.P2 || !b.Shielded || !Near(b.ShieldHp, b.MaxHp * GoDomain.P2Shield) || b.Element != stp.P2El) Fail($"{site.Id} 2단계 방패 {b.ShieldHp}·{b.Element}≠{stp.P2El}");
                if (i != 0) { df.Leave(); continue; }
                // 첫 입구 끝까지 — 나무 · 받기(이번 주 처음 둘 반값 30, 주간과 같은 횟수) · 보상
                KillAll(df);
                df.Step(0.1f);
                if (df.Current == null || df.Current.Phase != "tree") { Fail("메아리를 쓰러뜨렸는데 보상 나무가 안 섬"); df.Leave(); continue; }
                int gold = GoldState.Gold, scales = TalentState.Count(GoTalent.Mat.Scale), guides = TalentState.Count(GoTalent.Mat.Guide), arts = ArtifactState.Snapshot().Count;
                string got = df.Claim(out string why);
                if (got == null || DomainState.Resin != 90 || DomainState.WeeklyUsed != 1 || GoldState.Gold != gold + 200 || TalentState.Count(GoTalent.Mat.Scale) != scales + 1 || TalentState.Count(GoTalent.Mat.Guide) != guides + 3) Fail($"메아리 받기 '{got ?? why}' 원기 {DomainState.Resin}·주간 {DomainState.WeeklyUsed}");
                if (ArtifactState.Snapshot().Count != arts + 1) Fail("메아리 보상 ★5 보패 하나");
            }
            // 원기 값 — 이번 주 둘을 채우면 60
            DomainState.Restore(120, DomainState.NowForTest, 0, "", 0);
            DomainState.MarkClaim(GoDomain.Kind.Weekly); DomainState.MarkClaim(GoDomain.Kind.Echo);
            if (DomainState.CostOf(GoDomain.Kind.Echo) != 60 || DomainState.CostOf(GoDomain.Kind.Weekly) != 45) Fail($"이번 주 셋째부터 메아리 60·주간 45 여야 {DomainState.CostOf(GoDomain.Kind.Echo)}·{DomainState.CostOf(GoDomain.Kind.Weekly)}");
            if (GoDomain.RewardOf(GoDomain.Kind.Echo, 2, 0).Arts.Count != 2 || GoDomain.RewardOf(GoDomain.Kind.Echo, 2, 0).Mats[3] != 2 || GoDomain.RewardOf(GoDomain.Kind.Echo, 2, 1).Arts[0].set == GoDomain.RewardOf(GoDomain.Kind.Echo, 2, 0).Arts[0].set) Fail("메아리 단계 III 보상 표(★5 둘·매듭 2·세트 번갈이)");
            // 화면 — 입구 카드에 메아리 글
            Stand(pc, echoes[0], 3f);
            fc.ResetForTest();
            ui.Refresh();
            if (!ui.CardShown || !ui.CardInfo.Contains(GoDomain.LootName(GoDomain.Kind.Echo)) || !ui.CardInfo.Contains("240")) Fail($"메아리 입구 카드 '{ui.CardInfo}'");
            ui.StageButton(0).onClick.Invoke();
            ui.Refresh();
            if (!df.Running || !ui.HudShown) Fail("메아리 도전 단추 → 줄");
            df.Step(3.1f);
            ui.Refresh();
            if (!ui.HudText.Contains(GoLocalization.T("story.boss.kingtrue", "먹구름 임금"))) Fail($"메아리 줄에 보스 체력이 없다 '{ui.HudText}'");
            ui.LeaveButton.onClick.Invoke();
        }

        private static void CheckSave(string savePath)
        {
            DomainState.SetResinForTest(77);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":28") || !json.Contains("\"resin\":77")) Fail("세이브 v26 에 원기가 없다");
            DomainState.ResetForTest();
            if (!SaveState.TryLoad() || DomainState.Resin != 77 || DomainState.Claims != 2) Fail($"v26 왕복 뒤 원기 {DomainState.Resin}·받은 수 {DomainState.Claims}");
            string v25 = Regex.Replace(json.Replace("\"version\":28", "\"version\":28"), ",\"resin\":\\d+,\"resinT\":\\d+,\"domainClaims\":\\d+,\"weeklyWeek\":\"[^\"]*\",\"weeklyN\":\\d+", "");
            if (v25.Contains("resinT")) { Fail("v25 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v25);
            if (!SaveState.TryLoad() || DomainState.Resin != GoDomain.ResinMax || DomainState.Claims != 0) Fail("v25 파일 — 원기가 가득이 아님");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] domain FAIL - {msg}");
        }
    }
}
