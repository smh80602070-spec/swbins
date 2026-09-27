using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-6 "도감 105·싸워서 등용" 진단 — `PlaytestHeadless` 가 동료 모델 진단 뒤에 부른다.
    /// 표(105·id 겹침 없음·시대 넷 22/26/20/37·희귀도 3~5·자질·말·원소 셋 고르게·웹 해시 표본) · 명단(105 를 빠짐없이 한 번씩·지역 위험도 = 희귀도 − 2) ·
    /// 자리(설 수 있는 땅·제 지역·무리 30m·수호장 30m·역참·사건 물건 12m) · 서 있는 사람(지역마다·이름표·들판 적 아님) ·
    /// 겨루기(★3 체력·졸개 하나 / ★4 방패 한 겹·졸개 둘·둘째는 다른 시대 / ★5 두 겹 겉 → 속 원소 · 기질 반경 · 굴복 → 동행·이름·원소·다음 사람) ·
    /// 끌고 감 → 같은 사람 · 전멸 → 떠나고 다음 사람. 끝나면 동행·인연·경험치·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoHeroes
    {
        private static string _tag;
        private static bool _ok;

        private static readonly HashSet<string> EventTypes = new HashSet<string>
        {
            "BanditEncounter", "BeaconTower", "EastGroveRelic", "ElementTorch", "Gatherable", "HiddenTreasure", "LuckyCairn",
            "MountainShrine", "RareWolfEncounter", "ShrineTrialEncounter", "TreasureChest", "VillagerTalk", "Watchtower", "WaypointStone",
        };

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            CheckTable();
            CheckRosters();
            CheckStands();
            var heroes = FieldHeroes.Instance;
            var fc = FieldCombat.Instance;
            if (heroes == null || fc == null) { Fail("FieldHeroes/FieldCombat 없음"); return false; }

            var startMembers = new List<string>(PartyState.MemberIds);
            var startWalked = BondState.SnapshotWalked(PartyState.MemberIds);
            var startWins = BondState.SnapshotWins(PartyState.MemberIds);
            int startLevel = PlayerStats.Level, startExp = PlayerStats.Exp;
            var pc = fc.GetComponent<PlayerController>();
            Vector3 startPos = fc.transform.position;
            int enemies = FieldEnemy.All.Count;
            string duel = "";
            try
            {
                CheckIdle(heroes);
                duel = CheckDuels(heroes, fc, pc, enemies);
            }
            finally
            {
                PartyState.Restore(startMembers);
                BondState.Restore(PartyState.MemberIds, startWalked, startWins);
                PlayerStats.Restore(startLevel, startExp);
                foreach (var s in heroes.Slots) { s.Skip = 0; s.Wait = 0f; heroes.Refresh(s); }
                if (pc != null) pc.Teleport(startPos);
                DuelGate.ResetForTest();
            }
            if (FieldEnemy.All.Count != enemies) Fail($"끝난 뒤 들판 적 {FieldEnemy.All.Count} ≠ {enemies}(졸개·인물이 남았다)");
            if (_ok) Debug.Log($"[{_tag}] heroes OK - 도감 105(시대 넷·원소 일곱)·명단·자리·서 있는 사람·겨루기 ★3/★4/★5·기질·굴복→동행·끌고 감·전멸 |{duel}");
            return _ok;
        }

        private static void CheckTable()
        {
            var all = GoHeroes.All;
            if (all.Length != 105) Fail($"도감 {all.Length} ≠ 105");
            var ids = new HashSet<string>();
            var era = new int[4];
            var el = new Dictionary<GoElement, int>();
            foreach (var h in all)
            {
                if (!ids.Add(h.Id)) Fail($"id 겹침 {h.Id}");
                era[(int)h.Era]++;
                if (h.Rarity < 3 || h.Rarity > 5) Fail($"{h.Id} 희귀도 {h.Rarity}");
                foreach (int v in new[] { h.Might, h.Wisdom, h.Command }) if (v < 1 || v > 100) Fail($"{h.Id} 자질 {v}");
                if (string.IsNullOrEmpty(h.NameKo) || string.IsNullOrEmpty(h.QuoteKo)) Fail($"{h.Id} 이름·말 빔");
                var e = GoHeroes.ElementOf(h);
                if (e == GoElement.Physical) Fail($"{h.Id} 원소 없음");
                el.TryGetValue(e, out int n); el[e] = n + 1;
                if (GoElements.ForMember(h.Id) != e) Fail($"{h.Id} 동행 원소 {GoElements.ForMember(h.Id)} ≠ 도감 {e}");
                if (!GoHeroes.Label(h).Contains(GoHeroes.Name(h)) || !GoHeroes.Label(h).StartsWith(new string('★', h.Rarity))) Fail($"{h.Id} 이름표 {GoHeroes.Label(h)}");
            }
            if (era[0] != 22 || era[1] != 26 || era[2] != 20 || era[3] != 37) Fail($"시대 넷 {era[0]}/{era[1]}/{era[2]}/{era[3]} ≠ 22/26/20/37");
            foreach (var kv in el) if (kv.Value < 5) Fail($"원소 {kv.Key} {kv.Value} 명 — 치우침"); // 109-14-1a 일곱(웹 해시 그대로 — 초 여섯이 가장 적다)
            if (el.Count != 7) Fail($"원소 {el.Count} 가지");
            // 웹 elementOf 표본(웹 `field-combat.js` 로 뽑은 값)
            if (GoHeroes.TryGet("sg_guanyu", out var g) && g.WebElement != WebElement.Elec) Fail("웹 원소 표본(sg_guanyu = elec) 다름");
            if (GoHeroes.TryGet("sg_zhangfei", out var z) && z.WebElement != WebElement.Ice) Fail("웹 원소 표본(sg_zhangfei = ice) 다름");
            if (GoHeroes.TryGet("nope", out _)) Fail("없는 id 가 잡힌다");
        }

        private static void CheckRosters()
        {
            var seen = new HashSet<string>();
            var regions = new HashSet<string>();
            foreach (var s in GoHeroes.Stands)
            {
                if (!regions.Add(s.RegionId)) Fail($"지역 {s.RegionId} 자리 둘");
                int danger = GoWorldMap.DangerOf(s.RegionId);
                var roster = GoHeroes.RosterOf(s.RegionId);
                if (roster.Count == 0) Fail($"{s.RegionId} 명단 빔");
                foreach (var id in roster)
                {
                    if (!seen.Add(id)) Fail($"{id} 가 두 지역에");
                    GoHeroes.TryGet(id, out var h);
                    if (h.Rarity - 2 != danger) Fail($"{id} ★{h.Rarity} 가 위험 {danger} 지역 {s.RegionId}");
                }
            }
            if (seen.Count != 105) Fail($"명단에 든 인물 {seen.Count} ≠ 105");
            if (regions.Contains("river")) Fail("너른 강에 자리");
        }

        private static void CheckStands()
        {
            var objects = new List<(string, Vector3)>();
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                if (EventTypes.Contains(mb.GetType().Name)) objects.Add((mb.GetType().Name, mb.transform.position));
            if (objects.Count < 8) Fail($"사건 물건 {objects.Count} 개뿐 — 이름표가 낡았나");
            foreach (var s in GoHeroes.Stands)
            {
                Vector3 p = FieldHeroes.StandPos(s);
                if (!FieldEnemy.CanStandOn(p)) Fail($"{s.RegionId} 자리 {p} 가 설 수 없는 땅");
                if (GoWorldMap.RegionAt(p) != s.RegionId) Fail($"{s.RegionId} 자리가 {GoWorldMap.RegionAt(p)} 지역");
                foreach (var c in FieldSpawner.GroupCenters()) if (Flat(c - p) < 30f) Fail($"{s.RegionId} 자리가 들판 무리에서 {Flat(c - p):F0}m");
                Vector3 guard = TestMapData.WorldPos(FieldSpawner.GuardianGx, FieldSpawner.GuardianGy);
                if (Flat(guard - p) < 30f) Fail($"{s.RegionId} 자리가 수호장에서 {Flat(guard - p):F0}m");
                foreach (var (n, pos) in objects) if (Flat(pos - p) < 12f) Fail($"{s.RegionId} 자리가 {n} 에서 {Flat(pos - p):F0}m");
            }
        }

        private static void CheckIdle(FieldHeroes heroes)
        {
            if (heroes.Slots.Count != GoHeroes.Stands.Length) Fail($"자리 {heroes.Slots.Count} ≠ {GoHeroes.Stands.Length}");
            foreach (var s in heroes.Slots)
            {
                if (s.HeroId == null || s.Idle == null) { Fail($"{s.Stand.RegionId} 에 서 있는 사람이 없다"); continue; }
                if (s.HeroId != FieldHeroes.NextHero(s.Roster, 0)) Fail($"{s.Stand.RegionId} 첫 사람이 {s.HeroId}");
                if (s.Fighter != null) Fail($"{s.Stand.RegionId} 겨루지 않았는데 들판 적이 있다");
                var tag = s.Idle.GetComponentInChildren<TMPro.TextMeshPro>();
                GoHeroes.TryGet(s.HeroId, out var h);
                if (tag == null || tag.text != GoHeroes.Label(h)) Fail($"{s.Stand.RegionId} 이름표 {tag?.text}");
            }
            foreach (var e in FieldEnemy.All) if (e.IsHero) Fail("겨루지 않았는데 인물 들판 적이 있다");
        }

        private static FieldHeroes.Slot SlotAt(FieldHeroes heroes, string region)
        {
            foreach (var s in heroes.Slots) if (s.Stand.RegionId == region) return s;
            return null;
        }

        private static GoElement CounterOf(GoElement e)
        {
            foreach (GoElement a in new[] { GoElement.Pyro, GoElement.Hydro, GoElement.Electro }) if (GoElements.Counters(a, e)) return a;
            return GoElement.Physical;
        }

        private static string CheckDuels(FieldHeroes heroes, FieldCombat fc, PlayerController pc, int enemies)
        {
            string log = "";
            foreach (var (region, rarity) in new[] { ("village", 3), ("west_wood", 4), ("north_foot", 5) })
            {
                var slot = SlotAt(heroes, region);
                if (slot == null || slot.HeroId == null) { Fail($"{region} 자리 없음"); continue; }
                string id = slot.HeroId;
                GoHeroes.TryGet(id, out var hero);
                if (hero.Rarity != rarity) Fail($"{region} 첫 사람 ★{hero.Rarity} ≠ ★{rarity}");
                heroes.StartDuel(slot);
                var f = slot.Fighter;
                if (f == null || !f.IsHero || f.HeroId != id) { Fail($"{region} 겨루기가 안 열림"); continue; }
                if (slot.Idle != null) Fail($"{region} 서 있던 사람이 안 치워짐");
                if (Mathf.Abs(f.MaxHp - GoHeroes.MaxHp(rarity)) > 0.5f) Fail($"{id} 체력 {f.MaxHp} ≠ {GoHeroes.MaxHp(rarity)}");
                if (f.ShieldLayers != GoHeroes.ShieldLayers(rarity)) Fail($"{id} 방패 {f.ShieldLayers} 겹 ≠ {GoHeroes.ShieldLayers(rarity)}");
                if (slot.Minions.Count != GoHeroes.Minions(rarity)) Fail($"{id} 졸개 {slot.Minions.Count}");
                GoElement el = GoHeroes.ElementOf(hero);
                if (f.Element != el) Fail($"{id} 원소 {f.Element} ≠ {el}");
                foreach (var m in slot.Minions) if (m.Element != el) Fail($"{id} 졸개 원소 {m.Element}");
                if (slot.Minions.Count >= 2 && slot.Minions[1].Era == GoEra.Past) Fail($"{id} 둘째 졸개가 옛 시대");
                if (slot.Minions.Count >= 1 && slot.Minions[0].Era != GoEra.Past) Fail($"{id} 첫 졸개가 옛 시대가 아님");
                if (FieldEnemy.All.Count != enemies + 1 + slot.Minions.Count) Fail($"{id} 겨루기 중 들판 적 {FieldEnemy.All.Count}");
                float wantReach = hero.Trait == HeroTrait.Wisdom ? FieldEnemy.HeroWisdomRadius
                    : hero.Trait == HeroTrait.Virtue ? FieldEnemy.StrikeRadius : FieldEnemy.HeroMightRadius;
                if (Mathf.Abs(f.StrikeReach - wantReach) > 0.01f) Fail($"{id} {hero.Trait} 반경 {f.StrikeReach}");

                // 방패 — ★5 는 겉(제 원소) → 속(제 원소가 누르는 원소)
                if (rarity >= 4)
                {
                    f.TakeHit(99999f, CounterOf(el), 50f, out _);
                    if (rarity == 5)
                    {
                        if (f.ShieldLayers != 1 || f.Element != GoHeroes.InnerOf(el)) Fail($"{id} 겉 방패 뒤 {f.ShieldLayers} 겹·{f.Element}(속 {GoHeroes.InnerOf(el)})");
                        f.TakeHit(99999f, CounterOf(f.Element), 50f, out _);
                    }
                    if (f.Shielded) Fail($"{id} 방패가 안 깨짐");
                }
                int partyBefore = PartyState.MemberIds.Count;
                f.TakeHit(999999f, GoElement.Physical, 50f, out _);
                if (!f.Yielded || f.Alive) Fail($"{id} 굴복 안 함(Yielded={f.Yielded})");
                if (slot.YieldLeft < 0f) Fail($"{id} 굴복 시간이 안 걸림");
                heroes.FinishYield(slot);
                if (PartyState.MemberIds.Count != partyBefore + 1 || PartyState.MemberIds[PartyState.MemberIds.Count - 1] != id) Fail($"{id} 동행이 안 됨");
                bool inParty = false;
                foreach (var m in fc.Party) if (m.Id == id) { inParty = true; if (m.Name != GoHeroes.Name(hero) || m.Element != el) Fail($"{id} 곁 이름·원소 {m.Name}/{m.Element}"); }
                if (!inParty) Fail($"{id} 가 곁 셋에 없다(최근 등용)");
                if (FieldEnemy.All.Count != enemies) Fail($"{id} 굴복 뒤 들판 적 {FieldEnemy.All.Count} ≠ {enemies}");
                if (slot.Wait <= 0f) Fail($"{id} 다음 사람 기다림 없음");
                heroes.Refresh(slot);
                if (slot.HeroId == id || slot.HeroId == null) Fail($"{region} 다음 사람 {slot.HeroId}");
                log += $" ★{rarity} {GoHeroes.Name(hero)}({hero.Trait}·{GoElements.NameOf(el)})";
            }

            // 끌고 감 → 제자리 → 같은 사람
            var farm = SlotAt(heroes, "farmland");
            string farmId = farm.HeroId;
            heroes.StartDuel(farm);
            var ff = farm.Fighter;
            ff.ForceReturn();
            ff.Tick(0.1f); // 이미 집 곁이라 곧바로 돌아감 → HeroReset
            if (farm.Fighter != null) Fail("끌고 간 뒤 인물이 안 돌아감");
            heroes.Refresh(farm);
            if (farm.HeroId != farmId) Fail($"돌아간 뒤 다른 사람 {farm.HeroId} ≠ {farmId}");

            // 전멸 → 떠나고 다음 사람
            var east = SlotAt(heroes, "east_grove");
            string eastId = east.HeroId;
            heroes.StartDuel(east);
            fc.WipeAndReturn();
            if (east.Fighter != null || east.Skip != 1) Fail($"전멸 뒤 인물이 안 떠남(skip {east.Skip})");
            heroes.Refresh(east);
            if (east.HeroId == eastId) Fail("전멸 뒤에도 같은 사람");
            if (FieldEnemy.All.Count != enemies) Fail($"끌고 감·전멸 뒤 들판 적 {FieldEnemy.All.Count}");
            return log;
        }

        private static float Flat(Vector3 v) => new Vector2(v.x, v.z).magnitude;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] heroes FAIL - {msg}");
        }
    }
}
