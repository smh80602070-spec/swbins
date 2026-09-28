using System.Collections.Generic;
using System.Linq;
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
    /// PLAN.md 109-14-24 "낚시"(웹 사가고 ⑲-24 진단 항목) — `PlaytestHeadless` 가 지도 표식 진단 뒤에 부른다.
    /// 표(낚시터 넷 = 서는 자리 땅·앞 4·9·14m 물·물고기 다섯·게시판 하나, 물고기 여덟, 작살 무기, 조합 여섯) · 판정(고리 조이기·물 밖이면 제자리·칸) ·
    /// 흐름(멀거나 싸우는 중이면 못 시작 · 미끼 없으면 못 던짐 · 던지기 → 입질 → 너무 일찍 당기면 달아남 · 입질 1초 넘기면 놓침 · 줄다리기로 잡음 →
    /// 가방·기록·잡은 자리 비움 · 30분 뒤 다시 · 멀어지거나 싸움이 붙으면 끝) · 조합(금·강화석·쪽지·매듭·작살 얻기→울림 5 뒤 막힘) · 세이브 왕복(옛 세이브는 빈 채) ·
    /// 화면(낚시·게시판 단추 · 낚시 칸 · 줄다리기 막대 · 게시판 창 · 낚시 중엔 공격이 막힘). 끝나면 가방·무기·돈·시각·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoFishing
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = FishingField.Instance;
            var ui = FishingUi.Instance;
            if (fc == null || pc == null || field == null || ui == null) { Fail("FieldCombat/PlayerController/FishingField/FishingUi 없음"); return false; }

            var cookBag = CookState.SnapshotBag();
            var cookProf = CookState.SnapshotProf();
            var cookGather = CookState.SnapshotGather();
            var fishBag = FishState.SnapshotBag();
            var fishLog = FishState.SnapshotLog();
            var fishGone = FishState.SnapshotGone();
            var inv = WeaponState.SnapshotInv();
            var equip = WeaponState.SnapshotEquip();
            int ore = WeaponState.Ore;
            var talent = TalentState.Snapshot();
            var mats = TalentState.SnapshotMats();
            int gold = GoldState.Gold;
            long now0 = CookState.NowForTest;
            bool paused0 = field.Paused;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                field.Paused = true;
                CookState.NowForTest = 1_000_000;
                CheckTables(field, parts);
                CheckFlow(field.Flow, parts);
                CheckExchange(parts);
                CheckSave(savePath, parts);
                CheckUi(fc, pc, field, ui, parts);
            }
            finally
            {
                ui.CloseBoard();
                field.Flow.End();
                field.Flow.ResetForTest();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                CookState.NowForTest = now0;
                CookState.Restore(cookBag, cookProf, cookGather);
                FishState.Restore(fishBag, fishLog, fishGone);
                WeaponState.Restore(inv, equip, ore);
                TalentState.Restore(talent, mats);
                GoldState.Restore(gold);
                field.Paused = paused0;
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] fishing OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        // ---- 표·판정 ----

        private static void CheckTables(FishingField field, List<string> parts)
        {
            var flow = field.Flow;
            flow.ResetForTest();
            var spots = GoFishing.Spots;
            if (spots.Length != 4 || spots.Select(s => s.Id).Distinct().Count() != 4) Fail("낚시터가 넷이 아님");
            foreach (var s in spots)
            {
                var (gx, gy) = TestMapData.WorldToGrid(new Vector3(s.Stand.x, 0f, s.Stand.y));
                char tile = TestMapData.TileAt(gx, gy);
                if (GoFishing.WetAt(s.Stand) || ".=FT".IndexOf(tile) < 0) Fail($"{s.Id} 서는 자리가 땅이 아님 '{tile}'");
                foreach (float d in new[] { GoFishing.CastMin, GoFishing.CastOff, GoFishing.CastMax })
                    if (!GoFishing.WetAt(s.Stand + s.Dir * d)) Fail($"{s.Id} 앞 {d:0.0}m 가 물이 아님");
                if (!GoFishing.WetAt(s.Cast)) Fail($"{s.Id} 던지는 물 가운데가 물이 아님");
                if (s.Fish.Length != GoFishing.FishPerSpot || s.Fish.Any(id => !GoFishing.TryFish(id, out _))) Fail($"{s.Id} 물고기 표");
                if (s.Name.StartsWith("fish.spot.")) Fail($"{s.Id} 이름 글이 없음");
                foreach (var f in flow.Fish(s))
                    if (!GoFishing.WetAt(f.P) || !GoFishing.WetAt(f.Target)) Fail($"{s.Id} 물고기 {f.Idx} 가 물 밖에서 시작");
                float y = field.StandPos(s.Id).y;
                if (y < -0.3f || y > 1.2f) Fail($"{s.Id} 서는 자리 높이 {y:0.00} — 땅에 안 앉음");
                foreach (var o in spots) if (o != s && Vector2.Distance(o.Cast, s.Cast) < GoFishing.SwimR * 2f) Fail($"{s.Id}·{o.Id} 물고기 물이 겹침");
            }
            var boards = spots.Where(s => s.Board).ToList();
            if (boards.Count != 1) Fail($"게시판 {boards.Count} ≠ 1");
            else
            {
                var b = boards[0];
                if (GoFishing.WetAt(b.BoardPos) || GoFishing.NearSpot(b.BoardPos) != null || !GoFishing.NearBoard(b.BoardPos)) Fail("게시판 자리(뭍·낚시터와 안 겹침·곁 판정)");
                if (GoFishing.NearBoard(b.Stand)) Fail("서는 자리에서 게시판까지 곁이면 낚시 단추와 겹침");
            }
            if (GoFishing.Fishes.Length != 8 || GoFishing.Fishes.Any(f => f.Zone <= 0f || f.Zone >= 1f || f.Star < 1 || f.Star > 3 || !GoFishing.Baits.Contains(f.Bait))) Fail("물고기 표");
            foreach (var f in GoFishing.Fishes)
                if (f.Name.StartsWith("fish.name.") || GoEras.EraName(f.Era).Length == 0) Fail($"{f.Id} 이름·시대 글");
            foreach (var b in GoFishing.Baits) if (!GoCooking.TryItem(b, out _)) Fail($"미끼 {b} 가 요리 재료가 아님");
            if (GoFishing.Fishes.Select(f => f.Era).Distinct().Count() != 3) Fail("과거·현대·미래가 한 물에 안 섞임");

            var s0 = spots[0];
            Vector2 prev = s0.Cast;
            if (GoFishing.ClampReticle(s0, s0.Stand - s0.Dir * 2f, prev) != prev) Fail("물 밖이면 제자리여야 함");
            float near = Vector2.Distance(GoFishing.ClampReticle(s0, s0.Stand + s0.Dir * 1f, prev), s0.Stand);
            float far = Vector2.Distance(GoFishing.ClampReticle(s0, s0.Stand + s0.Dir * 100f, prev), s0.Stand);
            if (Mathf.Abs(near - GoFishing.CastMin) > 0.01f || Mathf.Abs(far - GoFishing.CastMax) > 0.01f) Fail($"고리 조이기 {near:0.0}~{far:0.0}");
            if (!GoFishing.InZone(0.5f, 0.5f, 0.2f) || GoFishing.InZone(0.7f, 0.5f, 0.19f)) Fail("칸 판정");

            if (!GoWeapons.TryGet("w_polearm_catch", out var w) || w.Type != GoWeapons.Type.Polearm || w.Rarity != 4 || w.Atk != 41f || GoWeapons.IsShared(w.Id) || w.Sub != "energy" || w.Pas != "b") Fail("갯바람 작살 표");
            if (GoFishing.Exchange.Length != 6 || GoFishing.Exchange.Any(r => r.Cost.Any(c => !GoFishing.TryFish(c.fish, out _)) || r.Name.StartsWith("fish.row."))) Fail("조합 표");
            parts.Add("표(낚시터 넷 땅·물 4·9·14m·물고기 다섯·게시판 하나 · 물고기 여덟 세 시대 · 작살 · 조합 여섯 · 고리 조이기)");
        }

        // ---- 흐름 ----

        private static bool RunTo(FishingFlow f, FishingFlow.Phase want, float maxSec, Vector2 p)
        {
            for (float t = 0f; t < maxSec; t += 0.05f)
            {
                if (f.State == want) return true;
                f.Step(0.05f, p, false);
            }
            return f.State == want;
        }

        private static bool CastUntilNibble(FishingFlow f, Vector2 p)
        {
            for (int a = 0; a < 8; a++)
            {
                if (f.State == FishingFlow.Phase.Aim && !f.Cast()) return false;
                if (RunTo(f, FishingFlow.Phase.Nibble, 20f, p)) return true;
            }
            return false;
        }

        private static bool ToBite(FishingFlow f, Vector2 p) => CastUntilNibble(f, p) && RunTo(f, FishingFlow.Phase.Bite, 10f, p);

        private static void CheckFlow(FishingFlow f, List<string> parts)
        {
            CookState.ResetForTest();
            FishState.ResetForTest();
            f.ResetForTest();
            var sp = GoFishing.Spots[0];
            Vector2 p = sp.Stand;
            var caught = new List<string>();
            f.Caught += caught.Add;
            try
            {
                if (f.Begin(p + new Vector2(0f, -60f), false) || f.State != FishingFlow.Phase.Idle) Fail("멀리서 낚시가 시작됨");
                if (f.Begin(p, true) || f.Busy) Fail("싸우는 중에 낚시가 시작됨");
                if (!f.Begin(p, false) || f.State != FishingFlow.Phase.Aim || f.Reticle != sp.Cast) Fail("낚시터 곁에서 시작(고리는 물 가운데)");
                if (f.Begin(p, false)) Fail("낚시 중에 또 시작됨");
                if (f.Cast() || f.Last != "no_bait" || f.State != FishingFlow.Phase.Aim) Fail("미끼 없이 던져짐");
                CookState.Add("honey_flower", 10);
                if (!f.MoveReticle(sp.Dir, 0.1f) || Vector2.Distance(f.Reticle, sp.Stand) <= GoFishing.CastOff) Fail("고리가 멀리 안 감");
                for (int i = 0; i < 100; i++) f.Nudge(-1f, 0f, 0.05f); // 가까이 단추를 누른 채 5초 — 서는 자리 쪽으로 오다 CastMin 에서 멈춘다
                if (Mathf.Abs(Vector2.Distance(f.Reticle, sp.Stand) - GoFishing.CastMin) > 0.01f) Fail($"가까이 단추가 CastMin 에서 안 멈춤({Vector2.Distance(f.Reticle, sp.Stand):0.00})");
                float sideX = f.Reticle.x;
                f.Nudge(0f, 1f, 0.1f);
                if (f.Reticle.x <= sideX) Fail("오른쪽 단추가 고리를 오른쪽(+x)으로 안 옮김");
                f.Reticle = sp.Cast; // 물고기가 도는 물 가운데로 되돌려 던진다
                if (!f.Cast() || f.State != FishingFlow.Phase.Wait || CookState.Count("honey_flower") != 9 || f.Float != f.Reticle) Fail("던지기(미끼 하나·찌 자리)");
                if (f.Cast()) Fail("기다리는 중에 또 던져짐");
                f.Press(true);
                if (f.State != FishingFlow.Phase.Aim || f.Last != "reeled" || CookState.Count("honey_flower") != 8 + 1) Fail("일찍 거두면 고리로 돌아가야 함(미끼는 씀)");
                CookState.Add("honey_flower", 1);
                bool baitBefore = f.SetBait("apple") && f.Bait == "apple";
                f.SetBait("honey_flower");
                if (!baitBefore || f.Bait != "honey_flower") Fail("미끼 바꾸기");

                // 입질 → 너무 일찍 당김 = 달아남
                if (!CastUntilNibble(f, p)) { Fail("던졌는데 입질이 안 옴(8번)"); return; }
                if (f.SetBait("apple")) Fail("입질 중에 미끼가 바뀜");
                f.Press(true);
                if (f.State != FishingFlow.Phase.Aim || f.Last != "scared" || !f.Fish(sp).Any(x => x.Scared > 0f)) Fail("건드릴 때 당기면 달아나야 함");
                for (float t = 0f; t < GoFishing.Scare + 0.5f; t += 0.05f) f.Step(0.05f, p, false);
                if (f.Fish(sp).Any(x => x.Scared > 0f)) Fail("놀란 물고기가 8초 뒤에도 놀란 채");

                // 입질을 놓침
                if (!ToBite(f, p)) { Fail("입질(Bite)까지 안 감"); return; }
                for (float t = 0f; t < GoFishing.BiteWindow + 0.3f && f.State == FishingFlow.Phase.Bite; t += 0.05f) f.Step(0.05f, p, false);
                if (f.State != FishingFlow.Phase.Aim || f.Last != "escaped") Fail("입질 1초를 넘기면 놓쳐야 함");
                for (float t = 0f; t < GoFishing.Scare + 0.5f; t += 0.05f) f.Step(0.05f, p, false);

                // 잡기
                bool done = false;
                for (int attempt = 0; attempt < 4 && !done; attempt++)
                {
                    if (f.Bait != "honey_flower") f.SetBait("honey_flower");
                    if (CookState.Count("honey_flower") < 3) CookState.Add("honey_flower", 5);
                    if (!ToBite(f, p)) continue;
                    f.Press(true);
                    if (f.State != FishingFlow.Phase.Reel || !f.Holding) { Fail("당기면 줄다리기가 안 됨"); return; }
                    for (float t = 0f; t < 90f && f.State == FishingFlow.Phase.Reel; t += 0.05f)
                    {
                        f.Press(f.Cursor < f.ZoneC);
                        f.Step(0.05f, p, false);
                    }
                    done = f.Last.StartsWith("caught:");
                    for (float t = 0f; t < GoFishing.Scare + 0.5f && !done; t += 0.05f) f.Step(0.05f, p, false);
                }
                if (!done) { Fail("줄다리기로 못 잡음(4번)"); return; }
                string id = f.Last.Substring("caught:".Length);
                if (id != "crucian" || FishState.Count(id) != 1 || FishState.LogOf(id) != 1 || FishState.Left(sp.Id) != 4 || caught.Count != 1 || caught[0] != id) Fail($"잡은 뒤 가방·기록·자리({id} {FishState.Count(id)} 자리 {FishState.Left(sp.Id)}/5)");
                if (f.State != FishingFlow.Phase.Aim || f.Hooked != -1) Fail("잡은 뒤 고리로 돌아가야 함");
                CookState.NowForTest += GoFishing.RespawnSec - 1;
                if (FishState.Left(sp.Id) != 4) Fail("30분이 안 됐는데 다시 나옴");
                CookState.NowForTest += 2;
                if (FishState.Left(sp.Id) != 5) Fail("30분 뒤에도 다시 안 나옴");
                if (FishState.Count("crucian") != 1) Fail("다시 나와도 가방은 그대로여야 함");

                // 멀어지면·싸움이 붙으면 끝
                f.Step(0.05f, p + new Vector2(GoFishing.StandR * 2f + 1f, 0f), false);
                if (f.Busy || f.Last != "left") Fail("멀어졌는데 낚시가 안 끝남");
                if (!f.Begin(p, false)) { Fail("다시 시작 안 됨"); return; }
                f.Step(0.05f, p, true);
                if (f.Busy || f.Last != "fight") Fail("싸움이 붙었는데 낚시가 안 끝남");
                parts.Add("흐름(못 시작 셋 · 미끼 · 던지기 · 일찍 당김 달아남 · 입질 놓침 · 줄다리기 잡음 · 30분 뒤 다시 · 멀어짐·싸움 끝)");
            }
            finally
            {
                f.Caught -= caught.Add;
                f.End();
            }
        }

        // ---- 조합 ----

        private static void CheckExchange(List<string> parts)
        {
            WeaponState.ResetForTest();
            GoldState.Restore(0);
            var big = new List<CookState.Entry>();
            foreach (var fs in GoFishing.Fishes) big.Add(new CookState.Entry { id = fs.Id, n = 60 });
            FishState.Restore(big, null, null);
            if (FishState.CanExchange(-1, out _) || FishState.CanExchange(99, out _)) Fail("없는 조합이 바뀜");
            string t = FishState.Exchange(1);
            if (t.Length == 0 || GoldState.Gold != 800 || FishState.Count("crucian") != 57) Fail($"금 조합 '{t}' 금 {GoldState.Gold}");
            FishState.Exchange(2);
            if (GoldState.Gold != 1600 || FishState.Count("gizzard") != 57) Fail("바다 금 조합");
            int note0 = TalentState.Count(GoTalent.Mat.Note), knot0 = TalentState.Count(GoTalent.Mat.Knot);
            FishState.Exchange(3);
            if (TalentState.Count(GoTalent.Mat.Note) != note0 + 2 || FishState.Count("mandarin") != 58) Fail("쪽지 조합");
            FishState.Exchange(5);
            if (TalentState.Count(GoTalent.Mat.Knot) != knot0 + 1 || FishState.Count("neonhairtail") != 59 || FishState.Count("moonjelly") != 59) Fail("매듭 조합");
            int ore0 = WeaponState.Ore;
            FishState.Exchange(4);
            if (WeaponState.Ore != ore0 + 3 || FishState.Count("clockcarp") != 59) Fail("강화석 조합");
            // 작살 — 처음엔 얻고, 또 바꾸면 울림, 울림 5 뒤엔 막힘
            string first = FishState.Exchange(0);
            if (!WeaponState.Owned("w_polearm_catch") || WeaponState.RecOf("w_polearm_catch").refine != 1 || !first.Contains("★4")) Fail($"작살 처음 얻기 '{first}'");
            for (int i = 0; i < 4; i++) FishState.Exchange(0);
            if (WeaponState.RecOf("w_polearm_catch").refine != GoWeapons.RefineMax) Fail($"작살 울림 {WeaponState.RecOf("w_polearm_catch").refine}");
            if (FishState.CanExchange(0, out string why) || why != GoLocalization.T("fish.why.maxed", "이 작살은 울림이 끝났다") || FishState.Exchange(0).Length != 0) Fail("울림 5 뒤에도 작살이 바뀜");
            if (FishState.Count("gizzard") != 57 - 30 || FishState.Count("lanternpuffer") != 60 - 15 || FishState.Count("steelflounder") != 60 - 10) Fail("작살 값(전어 6·복어 3·넙치 2 × 5)");
            FishState.Restore(new List<CookState.Entry>(), null, null);
            if (FishState.CanExchange(1, out string lack) || lack != string.Format(GoLocalization.T("fish.why.lack", "{0} 부족"), GoFishing.FishOf("crucian").Name)) Fail($"물고기 없이 바뀜 '{lack}'");
            parts.Add("조합(금 800 둘 · 쪽지 2 · 강화석 3 · 매듭 1 · 작살 얻기→울림 5→막힘 · 부족 글)");
        }

        // ---- 세이브 ----

        private static void CheckSave(string savePath, List<string> parts)
        {
            long now = CookState.Now;
            FishState.Restore(
                new List<CookState.Entry> { new CookState.Entry { id = "crucian", n = 2 }, new CookState.Entry { id = "gizzard", n = 1 }, new CookState.Entry { id = "bogus", n = 3 } },
                new List<CookState.Entry> { new CookState.Entry { id = "crucian", n = 5 } },
                new List<CookState.TimeEntry> { new CookState.TimeEntry { id = "river_w_0", t = now - 10 }, new CookState.TimeEntry { id = "dock_1", t = now - GoFishing.RespawnSec - 5 } });
            if (FishState.Count("bogus") != 0 || FishState.Total() != 3) Fail("없는 물고기 id 가 가방에 들어옴");
            if (FishState.SnapshotGone().Count != 1 || FishState.Present("river_w", 0) || !FishState.Present("dock", 1)) Fail("잡은 자리 시각(30분 지난 것은 안 적음)");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"fishBag\":[") || !json.Contains("\"fishGone\":[") || !json.Contains("river_w_0") || !json.Contains("\"version\":28")) Fail("세이브에 낚시가 없다(버전은 28 그대로)");
            FishState.ResetForTest();
            if (!SaveState.TryLoad() || FishState.Count("crucian") != 2 || FishState.LogOf("crucian") != 5 || FishState.Present("river_w", 0)) Fail("왕복 뒤 낚시가 달라짐");
            string old = Regex.Replace(json, ",\"fishBag\":\\[[^\\]]*\\],\"fishLog\":\\[[^\\]]*\\],\"fishGone\":\\[[^\\]]*\\]", "");
            if (old.Contains("fishBag")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("낚시 없는 옛 파일 TryLoad 실패"); return; }
            if (FishState.Total() != 0 || FishState.Left("river_w") != 5) Fail("낚시 없는 옛 세이브를 읽었는데 비어 있지 않음");
            parts.Add("세이브(가방·기록·잡은 자리 왕복 · 옛 세이브는 빈 채 · 버전 그대로)");
        }

        // ---- 화면 ----

        private static void CheckUi(FieldCombat fc, PlayerController pc, FishingField field, FishingUi ui, List<string> parts)
        {
            var f = field.Flow;
            fc.ResetForTest(); // 싸우는 중 표시(3초)를 비운다 — 낚시는 싸움이 붙으면 못 시작
            FishState.ResetForTest();
            CookState.ResetForTest();
            f.ResetForTest();
            var sp = GoFishing.Spots[0];
            var dock = GoFishing.BoardSpot();

            pc.Teleport(field.StandPos(sp.Id));
            ui.UpdateShown();
            if (!ui.OpenButton.gameObject.activeSelf || ui.BoardButton.gameObject.activeSelf || ui.HudOpen) Fail("낚시터 곁: 낚시 단추만 보여야 함");
            ui.ToggleFishing();
            if (!f.Busy || !ui.HudOpen || ui.BarOpen || !FishingField.Busy) Fail("낚시 단추가 낚시를 못 시작함");
            if (!ui.StateText.Contains(sp.Name) || ui.ActionLabel != GoLocalization.T("fish.act.aim", "던지기 (F)")) Fail($"낚시 칸 글 '{ui.StateText}' / '{ui.ActionLabel}'");
            if (!ui.CloserButton.interactable || !ui.FartherButton.interactable || !ui.LeftButton.interactable || !ui.RightButton.interactable) Fail("겨누는 중엔 단추 넷이 열려야 함");
            ui.BaitButton(1).onClick.Invoke();
            if (f.Bait != "apple") Fail("미끼 단추");
            ui.BaitButton(0).onClick.Invoke();
            if (fc.Attack() != -1) Fail("낚시 중에 공격이 나감");
            ui.ActionDown();
            ui.ActionUp();
            if (f.State != FishingFlow.Phase.Aim) Fail("미끼 없이 던져짐");
            CookState.Add("honey_flower", 20);
            ui.ActionDown();
            ui.ActionUp();
            if (f.State != FishingFlow.Phase.Wait || ui.ActionLabel != GoLocalization.T("fish.act.wait", "거두기 (F)") || ui.CloserButton.interactable) Fail("던진 뒤 낚시 칸");
            ui.ActionDown();
            ui.ActionUp();
            if (f.State != FishingFlow.Phase.Aim) Fail("거두기 단추");
            var p = sp.Stand;
            if (!ToBite(f, p)) { Fail("화면 진단: 입질까지 안 감"); return; }
            ui.Refresh();
            if (ui.ActionLabel != GoLocalization.T("fish.act.bite", "당겨! (F)")) Fail("입질 단추 글");
            ui.ActionDown();
            if (f.State != FishingFlow.Phase.Reel || !ui.BarOpen) Fail("당기면 줄다리기 막대가 떠야 함");
            ui.ActionUp();
            if (f.Holding) Fail("단추를 떼도 당기는 중");
            ui.Quit();
            if (f.Busy || ui.HudOpen || ui.BarOpen || FishingField.Busy) Fail("그만 단추");

            pc.Teleport(field.BoardPos(dock));
            ui.UpdateShown();
            if (ui.OpenButton.gameObject.activeSelf || !ui.BoardButton.gameObject.activeSelf) Fail("게시판 곁: 게시판 단추만 보여야 함");
            ui.OpenBoard();
            if (!ui.BoardOpen || !ui.RowText(0).Contains(GoFishing.Exchange[0].Name)) Fail("게시판 창");
            if (ui.SwapButton(1).interactable) Fail("물고기 없는데 바꾸기가 열림");
            var bag = new List<CookState.Entry> { new CookState.Entry { id = "crucian", n = 3 } };
            FishState.Restore(bag, null, null);
            if (!ui.SwapButton(1).interactable || !ui.BagText.Contains(GoFishing.FishOf("crucian").Name + " ★ ×3")) Fail("게시판 가방 글·바꾸기 열림");
            int g0 = GoldState.Gold;
            ui.SwapButton(1).onClick.Invoke();
            if (GoldState.Gold != g0 + 800 || FishState.Count("crucian") != 0 || ui.SwapButton(1).interactable) Fail("게시판 바꾸기 단추");
            ui.CloseBoard();
            if (ui.BoardOpen) Fail("게시판 닫기");

            // 지도 — 낚시터 "~ 이름" 넷(못 가 본 땅이면 숨고 밝혀지면 보임)
            var map = WorldMapUi.Instance;
            if (map == null) Fail("WorldMapUi 없음");
            else
            {
                var wp0 = WorldMapState.SnapshotWaypoints();
                var rg0 = WorldMapState.SnapshotRegions();
                bool rev0 = WorldMapState.Revealed;
                var pk0 = WorldMapState.SnapshotPeaks();
                try
                {
                    WorldMapState.Restore(null, null, false);
                    WorldMapState.RestorePeaks(null);
                    map.Open();
                    if (map.FishLabelCount != 4) Fail($"지도 낚시터 글 {map.FishLabelCount} ≠ 4");
                    // 낚시터 넷은 다 마을 들판 둑 — 그 땅(또는 너른 강)을 밟았을 때만 보인다
                    int shown0 = Enumerable.Range(0, map.FishLabelCount).Count(i => map.FishLabelShown(i));
                    int want0 = WorldMapState.IsVisited("village") || WorldMapState.IsVisited("river") ? 4 : 0;
                    WorldMapState.Restore(null, null, true);
                    map.Open();
                    int shown = Enumerable.Range(0, map.FishLabelCount).Count(i => map.FishLabelShown(i));
                    if (shown != 4 || shown0 != want0) Fail($"지도 낚시터 글 보임 {shown0}(기대 {want0}) → 밝힌 뒤 {shown}/4");
                }
                finally
                {
                    map.Close();
                    WorldMapState.Restore(wp0, rg0, rev0);
                    WorldMapState.RestorePeaks(pk0);
                }
            }
            parts.Add("화면(낚시·게시판 단추 곁에서만 · 낚시 칸 글·단추 · 미끼 · 던지기·거두기 · 줄다리기 막대 · 그만 · 낚시 중 공격 막힘 · 게시판 창 바꾸기)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] fishing FAIL - {msg}");
        }
    }
}
