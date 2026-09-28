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
    /// 109-14-17(웹 ⑲-17): 촌장·사공 표·6장 끝 촌장·7장 끝 사공·옛 세이브 넷 · 부채 바람(부채꼴 밖·뒤 적은 안 맞음·밀림 방향·명단 +6%·수호장 안 밀림) ·
    /// 순풍(첫 틱 전엔 회복 없음·2초에 두 번·자리 밖이면 없음) · 노 물결(길 위만·앞으로 밀림·나는 제자리) · 뱃노래(맞힌 뒤 둘·1초 안엔 한 번·끝나면 없음).
    /// 끝나면 동행·이야기 진행·돈·재료·들판·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoStoryAllies
    {
        private static string _tag;
        private static bool _ok;
        /// <summary>109-14-17 한 방에 안 쓰러지게 늘린 적의 원래 최대 체력(끝나면 되돌린다).</summary>
        private static readonly List<(FieldEnemy e, float maxHp)> _tough = new List<(FieldEnemy, float)>();

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
                foreach (var (e, hp) in _tough) if (e != null) e.SetMaxHpForTest(hp);
                _tough.Clear();
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
            // 109-14-17 촌장·사공
            if (!GoHeroes.TryGet("story_elder", out var el) || el.Era != HeroEra.Story || el.Rarity != 4 || GoHeroes.ElementOf(el) != GoElement.Anemo || el.Trait != HeroTrait.Virtue) Fail("촌장 표");
            if (!GoHeroes.TryGet("story_ferryman", out var fm) || fm.Rarity != 4 || GoHeroes.ElementOf(fm) != GoElement.Hydro || fm.Trait != HeroTrait.Might) Fail("사공 표");
            if (GoWeapons.TypeOf("story_elder") != GoWeapons.Type.Catalyst || GoWeapons.TypeOf("story_ferryman") != GoWeapons.Type.Polearm) Fail("촌장·사공 무기 종류");
            GoKits.OffForTest = false;
            var ke = GoKits.KitOf("story_elder", GoElement.Anemo);
            var kf = GoKits.KitOf("story_ferryman", GoElement.Hydro);
            if (ke == null || !ke.Sig || ke.Skill.Type != KitSkillType.Gust || ke.Burst.Type != KitBurstType.Feast || !Near(ke.Skill.Heal, 0.06f)) Fail("촌장 한 벌");
            if (kf == null || !kf.Sig || kf.Skill.Type != KitSkillType.Wave || kf.Burst.Type != KitBurstType.Rain) Fail("사공 한 벌");
            GoKits.OffForTest = true;
            if (GoStory.Chapters[5].Join != "story_elder" || GoStory.Chapters[6].Join != "story_ferryman") Fail("촌장·사공 합류 장");
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
            // 109-14-17 6장 끝 촌장 · 7장 끝 사공 · 옛 세이브 넷
            foreach (var (ci, id, ko) in new[] { (5, "story_elder", "누리"), (6, "story_ferryman", "버들") })
            {
                PartyState.Restore(new List<string>());
                StoryState.Restore(ci, GoStory.Chapters[ci].Steps.Length - 1);
                string rr = StoryState.Advance();
                if (!PartyState.Has(id) || rr == null || !rr.Contains(GoLocalization.T("hero." + id, ko))) Fail($"{ci + 1}장 끝 합류 '{rr}'");
            }
            PartyState.Restore(new List<string>());
            StoryState.Restore(7, 0);
            if (StoryState.CatchUpJoins() != 4 || !PartyState.Has("story_elder") || !PartyState.Has("story_ferryman")) Fail("옛 세이브 조용히 넷");
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
            if (dex.TabCount != 5 || !dex.TabText(4).Contains("1/" + GoHeroes.Story.Length) || !dex.TitleText.Contains("/" + GoHeroes.All.Length)) Fail($"도감 탭 '{dex.TabText(4)}'·'{dex.TitleText}'");
            if (dex.CardCount != GoHeroes.Story.Length) Fail("이야기 동료 칸 수");
            dex.Select(3);
            if (!dex.DetailText.Contains(GoStory.ChapterName(GoStory.Chapters[6]))) Fail("사공 합류 장 안내 " + dex.DetailText);
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
            pc.Teleport(fc.SafePoint);
            CheckElder(fc, pc, parts);
            pc.Teleport(fc.SafePoint);
            CheckFerryman(fc, pc, parts);
            return string.Join(" · ", parts);
        }

        private static Vector3 Fwd(PlayerController pc)
        {
            Vector3 f = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            f.y = 0f;
            return f.normalized;
        }

        /// <summary>그 자리에 적 하나(ex 에 든 적은 빼고) — 방패 없이 가득 찬 채.</summary>
        private static FieldEnemy FoeAt(Vector3 pos, List<FieldEnemy> ex)
        {
            var e = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe && x.Alive && !ex.Contains(x));
            e.ReviveNow();
            e.WarpForTest(pos);
            if (e.Shielded) e.SetShieldForTest(0f);
            ex.Add(e);
            return e;
        }

        /// <summary>밀림을 볼 적 — 스킬 한 방에 안 쓰러지게 최대 체력 ×20.</summary>
        private static FieldEnemy Tough(FieldEnemy e)
        {
            _tough.Add((e, e.MaxHp));
            e.SetMaxHpForTest(e.MaxHp * 20f);
            return e;
        }

        /// <summary>적만 dt 초 굴린다(밀려남 확인 — 다른 적·시계는 안 건드린다).</summary>
        private static void Slide(FieldEnemy e, float sec)
        {
            for (float t = 0f; t < sec; t += 0.05f) e.Tick(0.05f);
        }

        private static float Along(FieldEnemy e, Vector3 from, Vector3 dir)
        {
            Vector3 d = e.transform.position - from;
            d.y = 0f;
            return Vector3.Dot(d, dir);
        }

        // 109-14-17 촌장 — 부채 바람(앞 부채꼴·밀어냄·명단 +6%) · 잔칫날 순풍(바람 자리 — 첫 틱은 1초 뒤, 자리 밖이면 회복 없음)
        private static void CheckElder(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            if (!Lead(fc, "story_elder")) return;
            Vector3 p0 = fc.transform.position, f = Fwd(pc);
            var used = new List<FieldEnemy>();
            var front = Tough(FoeAt(p0 + f * 2.5f, used));
            var back = FoeAt(p0 - f * 4f, used);
            float h0 = front.Hp, hb = back.Hp, a0 = Along(front, p0, f);
            foreach (var m in fc.Party) m.Hp = m.MaxHp * 0.5f;
            fc.Skill();
            bool ok = true;
            if (fc.LastKit?.Skill.Type != KitSkillType.Gust || !(front.Hp < h0) || !front.Sliding) { ok = false; Fail($"부채 바람 앞 적 {h0}→{front.Hp}·밀림 {front.Sliding}"); }
            if (back.Hp < hb || back.Sliding) { ok = false; Fail("부채 바람이 뒤 적을 침"); }
            if (fc.Party.Any(m => !Near(m.Hp, m.MaxHp * 0.56f, 0.5f))) { ok = false; Fail("명단 +6% " + string.Join(",", fc.Party.Select(m => $"{m.Hp / m.MaxHp:0.000}"))); }
            if (!Near(fc.Active.SkillCd, 8f, 0.05f)) { ok = false; Fail($"부채 바람 대기 {fc.Active.SkillCd}"); }
            Slide(front, 0.3f);
            float moved = Along(front, p0, f) - a0;
            if (front.Sliding || moved < 3f) { ok = false; Fail($"밀려난 거리 {moved:0.0}m(길 막힘이 아니면 7m×1.85)"); }
            var g = FieldEnemy.All.FirstOrDefault(x => x.IsGuardian && x.Alive);
            if (g != null) { g.KnockBack(f, 10f); if (g.Sliding) { ok = false; Fail("수호장이 밀림"); } }
            if (ok) parts.Add($"부채 바람 부채꼴·밀림 {moved:0.0}m·명단 +6%·수호장 그대로");

            if (!Lead(fc, "story_elder")) return;
            front.WarpForTest(fc.transform.position + f * 3f);
            if (front.Shielded) front.SetShieldForTest(0f);
            fc.Active.Energy = FieldCombat.BurstCost;
            fc.Burst();
            var z = fc.Zones.FirstOrDefault(x => x.Kind == SkillShape.Feast);
            if (z == null) { Fail("잔칫날 순풍 바람 자리 없음"); return; }
            fc.TickTimers(0.9f);
            if (z.Heals != 0 || z.Ticks != 0) { Fail($"첫 틱 전에 회복 {z.Heals}"); return; }
            fc.TickTimers(1.15f);
            if (z.Heals != 2 || z.Hits < 2) { Fail($"2초에 회복 두 번 {z.Heals}·친 {z.Hits}"); return; }
            pc.Teleport(z.Center + f * (z.Radius + 4f));
            fc.TickTimers(1f);
            if (z.Heals != 2 || z.Ticks != 3) { Fail($"자리 밖인데 회복 {z.Heals}·틱 {z.Ticks}"); return; }
            fc.TickTimers(8f);
            if (fc.Zones.Contains(z)) { Fail("바람 자리가 10초 뒤에도 남음"); return; }
            parts.Add("순풍 첫 틱 1초 뒤·2초에 두 번·자리 밖 없음");
        }

        // 109-14-17 사공 — 노 물결(앞 길만·앞으로 밀림·나는 제자리) · 뱃노래(맞힌 뒤 가까운 둘·1초 쉼·15초)
        private static void CheckFerryman(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            if (!Lead(fc, "story_ferryman")) return;
            Vector3 p0 = fc.transform.position, f = Fwd(pc), side = Vector3.Cross(Vector3.up, f);
            var used = new List<FieldEnemy>();
            var onLine = Tough(FoeAt(p0 + f * 8f, used));
            var off = FoeAt(p0 + side * 10f, used);
            float h0 = onLine.Hp, ho = off.Hp, a0 = Along(onLine, p0, f);
            fc.Skill();
            bool ok = true;
            Vector3 dp = fc.transform.position - p0; dp.y = 0f;
            if (fc.LastKit?.Skill.Type != KitSkillType.Wave || !(onLine.Hp < h0) || !onLine.Sliding) { ok = false; Fail($"노 물결 길 위 적 {h0}→{onLine.Hp}·밀림 {onLine.Sliding}"); }
            if (off.Hp < ho || off.Sliding) { ok = false; Fail("노 물결이 길 밖 적을 침"); }
            if (dp.magnitude > 0.1f) { ok = false; Fail($"노 물결에 내가 움직임 {dp.magnitude:0.00}m"); }
            Slide(onLine, 0.3f);
            float moved = Along(onLine, p0, f) - a0;
            if (moved < 3f) { ok = false; Fail($"앞으로 밀린 거리 {moved:0.0}m"); }
            if (ok) parts.Add($"노 물결 길 위만·앞으로 {moved:0.0}m·나는 제자리");

            if (!Lead(fc, "story_ferryman")) return;
            used.Clear();
            p0 = fc.transform.position;
            Tough(FoeAt(p0 + f * 2f, used));
            Tough(FoeAt(p0 + f * 5f, used));
            fc.Active.Energy = FieldCombat.BurstCost;
            fc.Burst();
            if (!Near(fc.RainLeft, 15f) || fc.RainHits != 0) { Fail($"뱃노래 {fc.RainLeft}초·{fc.RainHits}"); return; }
            foreach (var e in used) e.WarpForTest(e.transform.position); // 해방에 깎인 체력을 채운다
            fc.Attack();
            if (fc.RainHits != 2) { Fail($"기본 공격 뒤 물 노 {fc.RainHits} ≠ 2"); return; }
            fc.TickTimers(0.4f);
            int second = fc.Attack();
            if (second < 1 || fc.RainHits != 2) { Fail($"1초 안에 또 따라 침 {fc.RainHits}(맞힌 {second})"); return; }
            fc.TickTimers(0.7f);
            fc.Attack();
            if (fc.RainHits != 4) { Fail($"1초 뒤 따라 치기 {fc.RainHits} ≠ 4"); return; }
            fc.TickTimers(15f);
            foreach (var e in used) if (!e.Alive) e.ReviveNow();
            fc.Attack();
            if (fc.RainLeft > 0f || fc.RainHits != 4) { Fail($"뱃노래가 15초 뒤에도 {fc.RainLeft}·{fc.RainHits}"); return; }
            parts.Add("뱃노래 맞힌 뒤 둘·1초 쉼·15초 끝");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] story allies FAIL - {msg}");
        }
    }
}
