using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-15 "이야기 동료·고유 스킬 둘·편성"(웹 사가고 ⑲-15 진단 항목) — `PlaytestHeadless` 가 이야기 진단 뒤에 부른다.
    /// 동료 표(도감 밖·도감 수 105 그대로·원소·무기·한 벌) · 합류(2장 끝 은비·알림 글·두 번 안 들임·옛 세이브 조용히 둘·끝내지 않은 장은 안 들임) ·
    /// 편성 다섯(들판 셋 = 순서 뒤 셋·넣기·빼기·앞 자리로·셋 이하면 못 뺌 → 들판 명단이 따라 바뀜) · 도감 다섯째 탭·편성 단추 ·
    /// 스킬 넷(탁본 기력·풀이 반응 12초 ×1.4·그림자 걸음 등 뒤·표식 ×1.25·메아리 셋이 따라감).
    /// 끝나면 동행·이야기 진행·돈·재료·들판·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoStoryAllies
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
            var start = new List<string>(PartyState.MemberIds);
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex, gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var tal0 = TalentState.Snapshot();
            var mats0 = TalentState.SnapshotMats();
            string parts = "";
            try
            {
                CheckTable();
                CheckJoin();
                CheckFormation(fc);
                CheckDex();
                GoKits.OffForTest = false;
                PlayerStats.Restore(1, 0); // 한 번에 적이 쓰러지지 않게(표식·메아리를 볼 적이 살아 있어야)
                pc.Teleport(fc.SafePoint);
                parts = CheckSkills(fc, pc);
            }
            finally
            {
                GoKits.OffForTest = true;
                HeroDexUi.Instance?.Close();
                PartyState.Restore(start);
                StoryState.Restore(ch0, st0);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                TalentState.Restore(tal0, mats0);
                fc.ResetForTest();
                fc.RebuildParty();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] story allies OK - 표·도감 105 그대로 · 합류·옛 세이브·안 끝낸 장 · 편성 다섯 · 도감 탭·단추 · {parts}");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.01f) => Mathf.Abs(a - b) <= eps;

        private static void CheckTable()
        {
            if (!GoHeroes.TryGet("story_scholar", out var s) || s.Era != HeroEra.Story || s.Rarity != 4 || GoHeroes.ElementOf(s) != GoElement.Dendro || s.Trait != HeroTrait.Wisdom) Fail("은비 표");
            if (!GoHeroes.TryGet("story_wanderer", out var w) || w.Rarity != 5 || GoHeroes.ElementOf(w) != GoElement.Cryo || w.Trait != HeroTrait.Might) Fail("나그네 표");
            if (GoHeroes.All.Any(h => h.Era == HeroEra.Story) || HeroDexState.CountOf(null).Total != GoHeroes.All.Length) Fail("이야기 동료가 도감 수에 섞임");
            if (GoElements.ForMember("story_scholar") != GoElement.Dendro || GoElements.ForMember("story_wanderer") != GoElement.Cryo) Fail("동료 원소");
            if (GoWeapons.TypeOf("story_scholar") != GoWeapons.Type.Catalyst || GoWeapons.TypeOf("story_wanderer") != GoWeapons.Type.Sword) Fail("동료 무기 종류");
            GoKits.OffForTest = false;
            var ks = GoKits.KitOf("story_scholar", GoElement.Dendro);
            var kw = GoKits.KitOf("story_wanderer", GoElement.Cryo);
            if (ks == null || !ks.Sig || ks.Skill.Type != KitSkillType.Zone || ks.Burst.Type != KitBurstType.Lore) Fail("은비 한 벌");
            if (kw == null || !kw.Sig || kw.Skill.Type != KitSkillType.Blink || kw.Burst.Type != KitBurstType.Echo) Fail("나그네 한 벌");
            GoKits.OffForTest = true;
            if (GoStory.Chapters[1].Join != "story_scholar" || GoStory.Chapters[4].Join != "story_wanderer") Fail("합류 장");
        }

        private static void CheckJoin()
        {
            PartyState.Restore(new List<string>());
            StoryState.Restore(1, GoStory.Chapters[1].Steps.Length - 1);
            string r = StoryState.Advance();
            if (!PartyState.Has("story_scholar") || r == null || !r.Contains(GoLocalization.T("hero.story_scholar", "은비"))) Fail($"2장 끝 합류 '{r}'");
            if (StoryState.CatchUpJoins() != 0 || PartyState.MemberIds.Count != 1) Fail("이미 든 동료를 또 들임");
            PartyState.Restore(new List<string>());
            StoryState.Restore(1, 0);
            if (StoryState.CatchUpJoins() != 0 || PartyState.Has("story_scholar")) Fail("2장 진행 중인데 은비가 들어옴");
            StoryState.Restore(5, 0);
            if (StoryState.CatchUpJoins() != 2 || !PartyState.Has("story_scholar") || !PartyState.Has("story_wanderer")) Fail("옛 세이브 조용히 둘");
            if (StoryState.CatchUpJoins() != 0 || PartyState.MemberIds.Count != 2) Fail("두 번 불러 두 명씩");
        }

        private static void CheckFormation(FieldCombat fc)
        {
            var ids = GoHeroes.All.Take(5).Select(h => h.Id).ToList();
            string a = ids[0], b = ids[1], c = ids[2], d = ids[3], e = ids[4];
            string F() => string.Join(",", PartyState.FieldIds());
            PartyState.Restore(ids);
            if (F() != $"{e},{d},{c}") Fail("들판 셋 = 뒤 셋 " + F());
            if (!PartyState.ToField(a) || F() != $"{a},{e},{d}") Fail("넣기 " + F());
            if (PartyState.ToField(a)) Fail("둘째 자리를 또 넣음");
            if (!PartyState.Bench(e) || F() != $"{a},{d},{c}") Fail("빼기 " + F());
            if (!PartyState.MoveUp(c) || F() != $"{a},{c},{d}") Fail("앞 자리로 " + F());
            if (PartyState.MoveUp(a) || PartyState.MoveUp(b)) Fail("둘째·대기를 앞으로 옮김");
            fc.RebuildParty();
            string party = string.Join(",", fc.Party.Select(m => m.Id));
            if (party != $"{FieldCombat.HeroId},{a},{c},{d}") Fail("들판 명단이 편성을 안 따름 " + party);
            PartyState.Restore(new List<string> { a, b, c });
            if (PartyState.Bench(a)) Fail("셋 이하인데 뺌");
        }

        private static void CheckDex()
        {
            var dex = HeroDexUi.Instance;
            if (dex == null) { Fail("도감 없음"); return; }
            var ids = GoHeroes.All.Take(3).Select(h => h.Id).ToList();
            ids.Add("story_scholar");
            PartyState.Restore(ids);                                   // 은비 = 둘째 자리
            dex.Open();
            dex.SelectEra(HeroEra.Story);
            if (dex.TabCount != 5 || !dex.TabText(4).Contains("1/2") || !dex.TitleText.Contains("/" + GoHeroes.All.Length)) Fail($"도감 탭 '{dex.TabText(4)}'·'{dex.TitleText}'");
            if (dex.CardCount != 2) Fail("이야기 동료 칸 둘이 아니다");
            dex.Select(1);
            if (!dex.DetailText.Contains(GoStory.ChapterName(GoStory.Chapters[4]))) Fail("나그네 합류 장 안내 " + dex.DetailText);
            dex.Select(0);
            if (dex.SelectedId != "story_scholar" || !dex.DetailText.Contains(HeroDexUi.SlotLine("story_scholar"))) Fail("은비 자리 줄 " + dex.DetailText);
            var bench = dex.FormationButton(0);
            if (!bench.interactable || dex.FormationButton(1).interactable) Fail("둘째 자리 단추(빼기 켬·앞으로 끔)");
            bench.onClick.Invoke();
            if (PartyState.FieldSlotOf("story_scholar") >= 0) Fail("단추로 안 빠짐");
            dex.FormationButton(0).onClick.Invoke();
            if (PartyState.FieldSlotOf("story_scholar") != 0) Fail("단추로 안 들어감");
            dex.Close();
        }

        /// <summary>그 사람만 동행으로 둬 앞에 세운다(PlaytestGoKits 와 같은 틀).</summary>
        private static bool Lead(FieldCombat fc, string id)
        {
            PartyState.Restore(new List<string> { id });
            fc.RebuildParty();
            fc.ResetForTest();
            for (int i = 0; i < fc.Party.Count; i++)
                if (fc.Party[i].Id == id) { if (i == 0 || fc.Swap(i)) { fc.ResetForTest(); if (i != 0) fc.Swap(i); return fc.Active.Id == id; } }
            Fail($"{id} 를 앞에 못 세움");
            return false;
        }

        private static FieldEnemy Foe(FieldCombat fc, PlayerController pc, float ahead, FieldEnemy not = null)
        {
            var e = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe && x.Alive && x != not);
            e.ReviveNow();
            Vector3 fwd = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            fwd.y = 0f; fwd.Normalize();
            e.WarpForTest(fc.transform.position + fwd * ahead);
            if (e.Shielded) e.SetShieldForTest(0f);
            return e;
        }

        private static string CheckSkills(FieldCombat fc, PlayerController pc)
        {
            var parts = new List<string>();
            if (Lead(fc, "story_scholar"))
            {
                Foe(fc, pc, 3f);
                foreach (var m in fc.Party) m.Energy = 0f;
                int hits = fc.Skill();
                var hero = fc.Party.First(m => m.Id == FieldCombat.HeroId);
                if (hits < 1 || fc.LastKit?.Skill.Type != KitSkillType.Zone || !Near(fc.Active.SkillCd, 10f, 0.05f) || hero.Energy < 1.5f * GoKits.EnergyScale - 0.01f)
                    Fail($"비문 탁본 {hits}·대기 {fc.Active.SkillCd}·주인공 기력 {hero.Energy}");
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                if (!Near(fc.LoreLeft, 12f) || !Near(fc.LoreMul, 1.4f)) Fail($"옛 글자 풀이 {fc.LoreLeft}·×{fc.LoreMul}");
                fc.TickTimers(12.1f);
                if (fc.LoreLeft > 0f) Fail("풀이가 12초 뒤에도 남음");
                else parts.Add("탁본 기력·풀이 반응 12초 ×1.4");
            }
            pc.Teleport(fc.SafePoint);
            if (Lead(fc, "story_wanderer"))
            {
                Vector3 p0 = fc.transform.position;
                var e = Foe(fc, pc, 8f);
                fc.Skill();
                Vector3 pe = e.transform.position, pp = fc.transform.position;
                Vector3 ahead = pe - p0; ahead.y = 0f;
                Vector3 past = pp - pe; past.y = 0f;
                if (fc.LastKit?.Skill.Type != KitSkillType.Blink || Vector3.Dot(ahead, past) <= 0f || past.magnitude > 1.5f * GoKits.Dist + 1.5f) Fail($"그림자 걸음 — 적 뒤 {past.magnitude:0.0}m");
                if (!e.Alive) { Fail($"그림자 걸음에 적이 쓰러짐(체력 {e.MaxHp})"); return string.Join(" · ", parts); }
                if (!Near(e.MarkLeft, 8f, 0.05f) || !Near(e.MarkMul, 1.25f) || fc.InvulnLeft <= 0f) Fail($"표식 {e.MarkLeft}·×{e.MarkMul}·무적 {fc.InvulnLeft}");
                e.WarpForTest(fc.transform.position + new Vector3(0f, 0f, 15f)); // 해방 둘레(11m) 밖 — 표식은 남는다, 체력은 가득
                if (e.Shielded) e.SetShieldForTest(0f);
                float dealt = e.TakeHit(100f, GoElement.Physical, 0f, out _);
                if (!Near(dealt, 125f, 0.5f)) Fail($"표식 난 적 피해 {dealt} ≠ 125");
                e.SetHpForTest(e.MaxHp);
                if (e.MarkLeft <= 0f) Fail("옮긴 적의 표식이 사라짐");
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                if (fc.EchoCount != 3) Fail($"메아리 {fc.EchoCount} ≠ 3(표식 난 적 하나)");
                e.WarpForTest(fc.transform.position + new Vector3(10f, 0f, 0f));  // 적이 움직여도 따라간다
                float hp = e.Hp;
                fc.TickTimers(0.35f);
                if (fc.EchoCount != 2 || !(e.Hp < hp)) Fail($"메아리 하나가 움직인 적을 안 침 {fc.EchoCount}·{hp}→{e.Hp}");
                fc.TickTimers(1f);
                if (fc.EchoCount != 0) Fail("메아리가 남음");
                else parts.Add("그림자 걸음 등 뒤·표식 ×1.25·메아리 셋이 따라감");
            }
            return string.Join(" · ", parts);
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] story allies FAIL - {msg}");
        }
    }
}
