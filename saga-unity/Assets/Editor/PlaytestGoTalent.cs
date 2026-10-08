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
    /// PLAN.md 109-14-4 "무예 단계·깨달음"(웹 사가만리 ⑲-4 진단 항목) — `PlaytestHeadless` 가 시야 진단 뒤에 부른다.
    /// 상한 표(부대 레벨)·배율 표 · 올리기 값·재료 모자라면 거절·상한이면 거절·비늘 없으면 7단이 끝·쓰면 빠짐 · 깨달음 열기(매듭 1)·5 에서 멈춤·③ 스킬·해방 +2 ·
    /// 들판 피해가 출처별로 단계를 탄다(기본) · ① 대기 ×0.85 · ④ 체력 ×1.15 · ⑤ 해방 뒤 8초 공격 ×1.2 · 얻는 곳(상자 화려·정예 쓰러뜨림) · 도감 무예 칸(진짜 단추) ·
    /// 세이브 v21 왕복·v19 로드. 끝나면 동행·무예·재료·돈·레벨·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoTalent
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var dex = HeroDexUi.Instance;
            if (fc == null || pc == null || dex == null) { Fail("FieldCombat/PlayerController/HeroDexUi 없음"); return false; }

            var startMembers = new List<string>(PartyState.MemberIds);
            var startSeen = HeroDexState.Snapshot();
            var startTalent = TalentState.Snapshot();
            var startMats = TalentState.SnapshotMats();
            int startGold = GoldState.Gold, startLevel = PlayerStats.Level; long startExp = PlayerStats.Exp;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            GoHeroes.Hero h = default;
            foreach (var x in GoHeroes.All) if (!HeroDexState.IsRecruited(x.Id)) { h = x; break; }
            if (h.Id == null) { Fail("안 들인 도감 인물이 없음"); return false; }
            string combat = "";
            try
            {
                CheckTables();
                CheckUpAndCon(h.Id);
                combat = CheckCombat(fc, pc, h.Id);
                CheckSources();
                CheckDexPanel(dex, h);
                CheckSave(savePath, h.Id);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                PartyState.Restore(startMembers);
                HeroDexState.Restore(startSeen);
                TalentState.Restore(startTalent, startMats);
                GoldState.Restore(startGold);
                PlayerStats.Restore(startLevel, startExp);
                fc.ResetForTest();
                fc.RebuildParty();
                dex.Close();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] talent OK - 상한(부대 Lv 1·5·10·15·20·25 → 3·4·5·7·9·10)·배율·값·거절(상한·금·비늘) · 깨달음 5·③ +2 · {combat} · 얻는 곳(상자·정예) · 도감 무예 칸 · 세이브 v21 왕복·v19 로드");
            return _ok;
        }

        private static void CheckTables()
        {
            int[] lv = { 1, 4, 5, 10, 15, 20, 25, 40 };
            int[] cap = { 3, 3, 4, 5, 7, 9, 10, 10 };
            for (int i = 0; i < lv.Length; i++)
                if (GoTalent.CapOf(lv[i]) != cap[i]) Fail($"부대 Lv {lv[i]} 상한 {GoTalent.CapOf(lv[i])} ≠ {cap[i]}");
            if (GoTalent.LevelFor(8) != 20 || GoTalent.LevelFor(4) != 5) Fail("단계를 여는 부대 레벨");
            if (Mathf.Abs(GoTalent.MulAt(1) - 1f) > 0.001f || Mathf.Abs(GoTalent.MulAt(10) - 1.78f) > 0.001f || Mathf.Abs(GoTalent.MulAt(12) - 1.98f) > 0.001f) Fail("배율 표");
            if (GoTalent.Costs.Length != 9 || GoTalent.Costs[5].Scale != 0 || GoTalent.Costs[6].Scale != 1) Fail("값 표(7 → 8 부터 비늘)");
        }

        private static void CheckUpAndCon(string id)
        {
            TalentState.ResetForTest();
            if (TalentState.Trainable(id) || TalentState.Up(id, GoTalent.Kind.Normal)) Fail("안 들인 인물이 올라감");
            PartyState.Recruit(id);
            if (!TalentState.Trainable(id)) { Fail("들였는데 무예를 못 올림"); return; }
            if (TalentState.Trainable("hero") || TalentState.Trainable("산적")) Fail("주인공·도감 밖이 무예를 가짐");

            PlayerStats.Restore(1, 0);
            GoldState.Restore(20000);
            TalentState.Restore(null, new[] { 10, 20, 30, 6, 0 });
            if (!TalentState.Up(id, GoTalent.Kind.Normal) || GoldState.Gold != 19900 || TalentState.Count(GoTalent.Mat.Note) != 8) Fail("1 → 2 값(금 100·쪽지 2)이 안 빠짐");
            if (!TalentState.Up(id, GoTalent.Kind.Normal) || TalentState.Count(GoTalent.Mat.Guide) != 18) Fail("2 → 3 값(교본 2)");
            if (TalentState.CanUp(id, GoTalent.Kind.Normal, out string why, out _) || why == null || !why.Contains("5")) Fail($"Lv 1 에 3 → 4 가 됨({why})");
            PlayerStats.Restore(25, 0);
            for (int i = 0; i < 4; i++) if (!TalentState.Up(id, GoTalent.Kind.Normal)) Fail($"Lv 25 에 {3 + i} → {4 + i} 안 됨");
            if (TalentState.BaseLevel(id, GoTalent.Kind.Normal) != 7) Fail($"기본 {TalentState.BaseLevel(id, GoTalent.Kind.Normal)} ≠ 7");
            if (TalentState.CanUp(id, GoTalent.Kind.Normal, out why, out _) || why == null || !why.Contains(GoTalent.MatName(GoTalent.Mat.Scale))) Fail($"비늘 없이 7 → 8 이 됨({why})");
            GoldState.Restore(0);
            if (TalentState.CanUp(id, GoTalent.Kind.Skill, out why, out _)) Fail("금 0 인데 올라감");
            GoldState.Restore(20000);

            for (int c = 1; c <= GoTalent.ConMax; c++) if (!TalentState.UnlockCon(id) || TalentState.Con(id) != c) Fail($"깨달음 {c} 안 열림");
            if (TalentState.UnlockCon(id) || TalentState.Count(GoTalent.Mat.Knot) != 1) Fail("깨달음 6 이 열리거나 매듭이 안 빠짐");
            if (TalentState.Level(id, GoTalent.Kind.Skill) != 3 || TalentState.Level(id, GoTalent.Kind.Normal) != 7) Fail("③ 이 스킬·해방에만 +2 가 아님");
            if (Mathf.Abs(TalentState.SkillCdMul(id) - 0.85f) > 0.001f || Mathf.Abs(TalentState.ReactMul(id) - 1.2f) > 0.001f
                || Mathf.Abs(TalentState.HpMul(id) - 1.15f) > 0.001f || !TalentState.BurstBuff(id)) Fail("깨달음 효과 넷");
        }

        private static string CheckCombat(FieldCombat fc, PlayerController pc, string id)
        {
            fc.RebuildParty();
            fc.ResetForTest();
            int idx = -1;
            for (int i = 0; i < fc.Party.Count; i++) if (fc.Party[i].Id == id) idx = i;
            if (idx < 0) { Fail("들인 인물이 명단에 없음"); return "명단 없음"; }
            if (Mathf.Abs(fc.Party[idx].MaxHp - fc.Party[0].MaxHp * 1.15f) > 0.5f) Fail($"④ 체력 {fc.Party[idx].MaxHp} ≠ {fc.Party[0].MaxHp} × 1.15");
            if (!fc.Swap(idx)) { Fail("그 인물로 교체 안 됨"); return "교체 안 됨"; }

            var e = FieldEnemy.All.Count > 0 ? FieldEnemy.All[0] : null;
            if (e == null) { Fail("적 없음"); return "적 없음"; }
            e.ReviveNow();
            Vector3 fwd = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            fwd.y = 0f; fwd.Normalize();
            e.WarpForTest(fc.transform.position + fwd * 2.5f);
            float atk = fc.Atk, hp0 = e.Hp;
            fc.Attack();
            float want = atk * GoWeapons.Kits[(int)GoWeapons.TypeOf(id)].Mul[0] * GoTalent.MulAt(7); // 109-14-5a 그 인물 무기 모양 1타
            if (Mathf.Abs(hp0 - e.Hp - want) > 0.5f) Fail($"기본 무예 7단 피해 {hp0 - e.Hp} ≠ {want}");
            e.ReviveNow();
            e.WarpForTest(fc.transform.position + new Vector3(60f, 0f, 60f));

            fc.Skill();
            if (Mathf.Abs(fc.Active.SkillCd - FieldCombat.SkillCooldownSec * 0.85f) > 0.01f) Fail($"① 스킬 대기 {fc.Active.SkillCd}");
            float atk0 = fc.Atk;
            fc.Active.Energy = FieldCombat.BurstCost;
            fc.Burst();
            if (Mathf.Abs(fc.Active.BuffLeft - GoTalent.C5Sec) > 0.01f || Mathf.Abs(fc.Atk - atk0 * GoTalent.C5Atk) > 0.01f) Fail($"⑤ 해방 뒤 {fc.Active.BuffLeft}초·공격 {fc.Atk} ≠ {atk0 * GoTalent.C5Atk}");
            fc.TickTimers(GoTalent.C5Sec + 0.1f);
            if (Mathf.Abs(fc.Atk - atk0) > 0.01f) Fail("⑤ 8초 뒤에도 공격이 오름");
            return $"기본 7단 ×{GoTalent.MulAt(7):0.00}·① 대기 ×0.85·④ 체력 ×1.15·⑤ 8초 ×1.2";
        }

        private static void CheckSources()
        {
            TalentState.Restore(null, null);
            TalentState.Add(GoTalent.ChestMats[(int)GoTreasure.Grade.Luxurious]);
            if (TalentState.Count(GoTalent.Mat.Guide) != 3 || TalentState.Count(GoTalent.Mat.Secret) != 1 || TalentState.Count(GoTalent.Mat.Knot) != 2) Fail("화려 상자 재료(교본 3·비전 1·매듭 2)");
            FieldEnemy elite = null;
            foreach (var e in FieldEnemy.All) if (e.IsElemental && e.ShieldMax > 0f && !e.IsGuardian && !e.IsHero && e.Alive) { elite = e; break; }
            if (elite == null) { Fail("방패 두른 원소 괴물이 없음"); return; }
            int note0 = TalentState.Count(GoTalent.Mat.Note);
            elite.SetShieldForTest(0f);
            elite.TakeRaw(elite.Hp + 999f, Color.white);
            if (elite.Alive || TalentState.Count(GoTalent.Mat.Note) != note0 + 1) Fail("정예를 쓰러뜨렸는데 쪽지가 안 들어옴");
            elite.ReviveNow();
        }

        private static void CheckDexPanel(HeroDexUi dex, GoHeroes.Hero h)
        {
            TalentState.Restore(null, new[] { 10, 10, 0, 1, 0 });
            GoldState.Restore(20000);
            dex.Open();
            dex.SelectEra(h.Era);
            int k = 0, idx = -1;
            foreach (var x in GoHeroes.All) { if (x.Era != h.Era) continue; if (x.Id == h.Id) idx = k; k++; }
            dex.Select(idx);
            if (!dex.TalentPanelShown) { Fail("동행을 골랐는데 무예 칸이 안 뜸"); return; }
            if (!dex.TalentRowText(1).Contains("1/10")) Fail($"스킬 줄 '{dex.TalentRowText(1)}'");
            dex.TalentButton(1).onClick.Invoke();
            if (TalentState.BaseLevel(h.Id, GoTalent.Kind.Skill) != 2 || !dex.TalentRowText(1).Contains("2/10")) Fail("스킬 올리기 단추가 안 먹음");
            dex.ConButton.onClick.Invoke();
            if (TalentState.Con(h.Id) != 1 || !dex.ConText.Contains("◆")) Fail("깨달음 단추가 안 먹음");
            // 안 들인 사람을 고르면 칸이 없다
            foreach (var x in GoHeroes.All)
            {
                if (x.Era != h.Era || HeroDexState.IsRecruited(x.Id)) continue;
                int j = 0, ix = -1;
                foreach (var y in GoHeroes.All) { if (y.Era != h.Era) continue; if (y.Id == x.Id) ix = j; j++; }
                HeroDexState.MarkSeen(x.Id);
                dex.Select(ix);
                if (dex.TalentPanelShown) Fail("안 들인 사람에 무예 칸");
                break;
            }
            dex.Close();
        }

        private static void CheckSave(string savePath, string id)
        {
            TalentState.Restore(new List<TalentState.Entry> { new TalentState.Entry { id = id, n = 5, s = 3, b = 2, con = 2 } }, new[] { 1, 2, 3, 4, 0 });
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":29") || !json.Contains("\"talents\":[") || !json.Contains("\"talentMats\":[1,2,3,4,0]")) Fail("세이브 v20 에 무예가 없다");
            TalentState.ResetForTest();
            if (!SaveState.TryLoad() || TalentState.BaseLevel(id, GoTalent.Kind.Normal) != 5 || TalentState.Con(id) != 2 || TalentState.Count(GoTalent.Mat.Knot) != 4) Fail("v20 왕복 뒤 무예가 달라짐");
            string v19 = Regex.Replace(json.Replace("\"version\":29", "\"version\":19"), ",\"talents\":\\[[^\\]]*\\],\"talentMats\":\\[[^\\]]*\\]", "");
            if (v19.Contains("talents")) { Fail("v19 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v19);
            if (!SaveState.TryLoad()) { Fail("v19 파일 TryLoad 실패"); return; }
            if (TalentState.BaseLevel(id, GoTalent.Kind.Normal) != 1 || TalentState.Count(GoTalent.Mat.Knot) != 0) Fail("v19 파일을 읽었는데 무예가 비어 있지 않음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] talent FAIL - {msg}");
        }
    }
}
