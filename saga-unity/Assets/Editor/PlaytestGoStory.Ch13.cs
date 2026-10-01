using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>`PlaytestGoStory` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestGoStory
    {
        private static void CheckChapter13(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch13 = "13장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(32, 0);
            StoryState.Restore(12, 0);
            Vector3 yard = GoStory.YardPos(Vector2.zero);
            foreach (var off in new[] { Vector2.zero, GoStory.YardDaon, GoStory.YardCrane, GoStory.YardWeld, GoStory.YardFight, GoStory.YardBandi })
                if (WaterAt(GoStory.YardPos(off))) Fail($"조선소 자리 {off} 가 물·산");
            if (!WaterAt(yard + new Vector3(0f, 0f, 24f)) && !WaterAt(yard + new Vector3(0f, 0f, 30f))) Fail("조선소가 강 둑에서 30m 안이 아님(물가)");
            field.Refresh();
            if (!field.NpcShown("daon") || !field.NpcShown("bandi") || field.NpcShown("haram") || GoStory.Flat(field.NpcBody("daon").transform.position, GoStory.YardPos(GoStory.YardDaon)) > 0.6f) Fail("13장 첫 단계: 다온 조선소·반디");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.FrostPos(GoStory.BandiShip)) > 0.6f) Fail("13장 첫 단계 반디는 고원 비행선 곁");
            Talk(pc, ui, "bandi", "13장 반디");
            Expect(12, 1, "반디 뒤");                                                           // → 1 go 조선소
            pc.Teleport(yard + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(12, 2, "조선소 도착");                                                        // → 2 talk 다온
            Talk(pc, ui, "daon", "13장 다온");
            Expect(12, 3, "다온 뒤");                                                           // → 3 kill 무리
            Vector3 fight = GoStory.YardPos(GoStory.YardFight);
            pc.Teleport(fight + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => WaterAt(e.transform.position))) Fail($"조선소 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(12, 4, "조선소 무리");                                                        // → 4 talk 다온
            Talk(pc, ui, "daon", "13장 다온 둘째");
            Expect(12, 5, "다온 둘째");                                                         // → 5 climb 기중기
            // 기중기 — 충돌 있는 다리 둘·들보(윗면 = 꼭대기), 땅 위에선 안 넘어감
            var yf = YardField.Instance;
            if (yf == null || yf.Crane == null) { Fail("조선소/기중기가 없다"); return; }
            var cols = yf.Crane.GetComponentsInChildren<Collider>();
            Vector3 top = GoStory.CraneTop;
            if (cols.Length != 3 || Mathf.Abs(cols.Max(c => c.bounds.max.y) - top.y) > 0.05f) Fail($"기중기 충돌 {cols.Length}·윗면 {cols.Max(c => c.bounds.max.y):0.00} ≠ {top.y:0.00}");
            if (!Physics.Raycast(top + Vector3.up * 3f, Vector3.down, out var hit, 6f) || Mathf.Abs(hit.point.y - top.y) > 0.05f) Fail("들보 윗면 레이");
            if (!Physics.Raycast(top + new Vector3(-5.35f - 4f, -8f, 0f), Vector3.right, 4f)) Fail("기중기 다리가 곧은 벽이 아니다(옆 레이)");
            pc.Teleport(yard + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(12, 5, "땅에서 기중기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(12, 6, "들보 위");                                                           // → 6 talk 반디
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.YardPos(GoStory.YardBandi)) > 0.6f) Fail("반디가 조선소로 안 옴");
            Talk(pc, ui, "bandi", "13장 반디 조각");
            Expect(12, 7, "조각 뒤");                                                           // → 7 defend 용접대
            Vector3 weld = GoStory.YardPos(GoStory.YardWeld);
            pc.Teleport(weld + new Vector3(0f, 0.4f, -GoStory.DefendStart - 10f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(weld + new Vector3(0f, 0.4f, -GoStory.DefendStart + 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"용접대 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (WaterAt(e.transform.position)) Fail("물결이 물·산 위에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 7; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(12, 8, "용접대 물결 셋");                                                     // → 8 talk 다온
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "daon", "13장 끝 다온");
            if (StoryState.Ch != 13 || GoldState.Gold != gold + 3750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("13장 끝·보상(금 3750·매듭 6·비급 5)");
            _ch13 = "13장 조선소(강 서쪽 뭍)·다온·무리 넷·기중기 다리 벽 둘 + 들보 꼭대기(땅에선 안 넘어감)·반디 자리 옮김·용접대 물결 셋(물 위 아님)·보상";
        }

        // ---- 14장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter14(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch14 = "14장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(34, 0);
            StoryState.Restore(13, 0);
            var obs = ObsField.Instance;
            if (obs == null || obs.Deck == null) { Fail("관측소/관측대가 없다"); return; }
            obs.Refresh();
            Vector3 g = GoStory.ObsPos(Vector2.zero), deck = GoStory.DeckCenter;
            foreach (var off in new[] { Vector2.zero, GoStory.ObsPillar, GoStory.ObsGaon })
                if (WaterAt(GoStory.ObsPos(off))) Fail($"관측소 자리 {off} 가 물·산");
            if (Mathf.Abs(deck.y - g.y - GoStory.ObsRise) > 0.01f) Fail("관측대 높이");
            if (!Physics.Raycast(deck + Vector3.up * 3f, Vector3.down, out var dh, 6f) || Mathf.Abs(dh.point.y - deck.y) > 0.05f) Fail("관측대 윗면 충돌");
            if (PlayerController.InDraft(GoStory.ObsPillarPos + Vector3.up * 5f) || obs.PillarOpen) Fail("석등 전인데 시간 기둥이 섰다");
            field.Refresh();
            if (!field.NpcShown("gaon") || GoStory.Flat(field.NpcBody("gaon").transform.position, GoStory.ObsPos(GoStory.ObsGaon)) > 0.6f) Fail("가온이 관측소 발치에 안 섬");
            Talk(pc, ui, "bandi", "14장 반디");
            Expect(13, 1, "반디 뒤");                                                            // → 1 go 관측소
            pc.Teleport(g + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(13, 2, "관측소 도착");                                                         // → 2 talk 가온
            Talk(pc, ui, "gaon", "14장 가온");
            Expect(13, 3, "가온 뒤");                                                            // → 3 kill 무리
            pc.Teleport(g + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => GoStory.OnSkyTop(e.transform.position) || e.transform.position.y > g.y + 6f)) Fail($"관측소 무리 {field.Squad.Count}(땅 위여야)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(13, 4, "관측소 무리");                                                         // → 4 talk 가온
            Talk(pc, ui, "gaon", "14장 가온 둘째");
            Expect(13, 5, "가온 둘째");                                                          // → 5 seal 별·해·달
            field.Refresh();
            if (!field.SealCenterOf(13).gameObject.activeSelf || field.SealLampOf(13, 0).Lit) Fail("틈 석등이 꺼진 채 안 섰다");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(13, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                 // 틀림(첫째는 별)
            if (StoryState.Progress != 0 || field.SealLampOf(13, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(별·해·달)");
            Pulse(L("star"), 1f);
            Pulse(L("sun"), 1f);
            Expect(13, 5, "둘 켰는데 넘어감");
            Pulse(L("moon"), 1f);
            Expect(13, 6, "별·해·달");                                                            // → 6 talk 가온
            obs.Refresh();
            if (!obs.PillarOpen || !PlayerController.InDraft(GoStory.ObsPillarPos + Vector3.up * 5f) || PlayerController.InDraft(GoStory.ObsPillarPos + new Vector3(GoStory.DraftR + 2f, 5f, 0f))) Fail("석등 뒤 시간 기둥이 안 섬(기둥 안 솟음·밖 안 솟음)");
            if (Mathf.Abs(PlayerController.DraftTopAt(GoStory.ObsPillarPos + Vector3.up * 5f) - GoStory.ObsDraftTop) > 0.01f) Fail("시간 기둥 솟는 높이");
            Talk(pc, ui, "gaon", "14장 가온 석등 뒤");
            Expect(13, 7, "가온 석등 뒤");                                                        // → 7 sky 시간 기둥
            pc.Teleport(g + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(13, 7, "땅에서 하늘 단계가 넘어감");
            pc.Teleport(deck + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(13, 8, "관측대에 내려앉음");                                                    // → 8 kill 관측대 파수
            field.Check(pc.transform.position);
            if (field.Squad.Count != 3 || field.Squad.Any(e => !GoStory.OnSkyTop(e.transform.position))) { Fail($"관측대 파수 {field.Squad.Count}(관측대 위여야)"); return; }
            var e0 = field.Squad[0];
            if (e0.CanStep(deck + new Vector3(GoStory.DeckR + 3f, 0f, 0f)) || !e0.CanStep(deck + new Vector3(3f, 0f, 3f))) Fail("관측대 파수가 난간을 넘거나 못 걷는다");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(13, 9, "관측대 파수");                                                         // → 9 talk 반디
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.DeckPos(new Vector2(3f, 3f))) > 0.6f) Fail("반디가 관측대로 안 옴");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot);
            Talk(pc, ui, "bandi", "14장 끝 반디");
            if (StoryState.Ch != 14 || GoldState.Gold != gold + 4000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6) Fail("14장 끝·보상(금 4000·매듭 6)");
            obs.Refresh();
            if (!obs.PillarOpen) Fail("14장 뒤에도 시간 기둥이 늘 켜져 있어야");
            _ch14 = "14장 관측소(마을 서북쪽 뭍)·가온·무리 넷(땅 위)·석등 별·해·달(틀리면 꺼짐)·시간 기둥(석등 뒤 솟음·밖 안 솟음)·관측대 착지·파수 셋(난간 안)·반디 관측대·보상";
        }

        // ---- 15장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter15(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch15 = "15장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(36, 0);
            StoryState.Restore(14, 0);
            Vector3 stn = GoStory.StationPos(Vector2.zero);
            foreach (var off in new[] { Vector2.zero, GoStory.StationHorse, GoStory.StationDareum, GoStory.StationFight, GoStory.StationDuel })
                if (WaterAt(GoStory.StationPos(off))) Fail($"역참 자리 {off} 가 물·산");
            foreach (var p in GoStory.HorsePath)
            {
                char ch = TestMapData.TileAt(Mathf.RoundToInt(p.x), Mathf.RoundToInt(p.y));
                if (ch == '^' || ch == '~' || ch == 'B') Fail($"역마 길 {p} 가 뭍이 아님('{ch}')");
            }
            foreach (var off in new[] { FrostPosOf(GoStory.DareumShip), FrostPosOf(GoStory.WingSeam) })
                if (!GoFrost.Contains(off) || Mathf.Abs(off.x - GoFrost.Center.x) > GoFrost.HalfX - 25f) Fail($"15장 고원 자리 {off} 가 고원 밖·가장자리");
            field.Refresh();
            if (!field.NpcShown("horse") || field.NpcShown("dareum") || !field.NpcShown("bandi")) Fail("15장 첫 단계: 역마·반디만");
            Talk(pc, ui, "bandi", "15장 반디");
            Expect(14, 1, "반디 뒤");                                                            // → 1 go 역참
            pc.Teleport(stn + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(14, 2, "역참 도착");                                                          // → 2 talk 달음
            field.Refresh();
            if (!field.NpcShown("dareum") || GoStory.Flat(field.NpcBody("dareum").transform.position, GoStory.StationPos(GoStory.StationDareum)) > 0.6f) Fail("달음이 역참에 안 섬");
            Talk(pc, ui, "dareum", "15장 달음");
            Expect(14, 3, "달음 뒤");                                                            // → 3 chase 역마
            // 평균 빠르기 — 걷기 6 과 달리기 10 사이
            float len = 0f;
            for (int i = 1; i < GoStory.HorsePath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("horse", i - 1), GoStory.RunPoint("horse", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.HorsePath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"역마 평균 {avg:0.0}m/초");
            Vector3 t0 = GoStory.RunPoint("horse", 0);
            Vector3 me = t0 + new Vector3(-10f, 0f, 0f);
            bool caught = RunAfter(field, ref me, 6f);                                          // 걷기
            if (caught || StoryState.StepIndex != 3) Fail($"걸어서 쫓았는데 {(caught ? "잡음" : "단계가 바뀜")}");
            me = t0 + new Vector3(-10f, 0f, 0f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 역마가 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 역마를 못 잡음");                   // 달리기
            Expect(14, 4, "역마 잡음");                                                          // → 4 talk 달음
            Talk(pc, ui, "dareum", "15장 달음 둘째");
            Expect(14, 5, "달음 둘째");                                                          // → 5 kill 여우불 무리
            Vector3 fight = GoStory.StationPos(GoStory.StationFight);
            pc.Teleport(fight + new Vector3(0f, 0.4f, -(GoStory.KillNear - 15f)));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Count(e => e.Element == GoElement.Pyro) != 2 || field.Squad.Any(e => WaterAt(e.transform.position))) Fail($"여우불 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(14, 6, "여우불 무리");                                                        // → 6 duel 구미호
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"여우불 구미호 {field.Squad.Count}"); return; }
            var fox = field.Squad[0];
            if (!fox.IsStoryBoss || fox.DisplayName != GoLocalization.T("story.boss.emberfox", "여우불 구미호") || fox.Element != GoElement.Pyro || fox.CurrentMove != FieldEnemy.BossMove.Rift) Fail($"구미호 이름·화·첫 수 {fox.DisplayName}·{fox.Element}·{fox.CurrentMove}");
            fox.SetShieldForTest(0f);
            fox.TakeRaw(fox.Hp - fox.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!fox.Shielded || fox.Element != GoElement.Pyro || field.Squad.Count != 3) Fail($"2단계 화 방패·졸개 {fox.Element}·{field.Squad.Count}");
            Kill(fox);
            Expect(14, 7, "여우불 구미호");                                                      // → 7 talk 달음
            Talk(pc, ui, "dareum", "15장 달음 조각");
            Expect(14, 8, "달음 조각");                                                          // → 8 go 별배
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("dareum").transform.position, GoStory.FrostPos(GoStory.DareumShip)) > 0.6f) Fail("달음이 별배 곁으로 안 감");
            pc.Teleport(GoStory.FrostPos(GoStory.FrostAt("ship", 0f, 14f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(14, 9, "별배 도착");                                                          // → 9 light 날개 이음매
            field.Refresh();
            var seam = field.AltarOf(14);
            if (seam == null || !seam.gameObject.activeSelf || seam.Lit || GoStory.Flat(seam.transform.position, GoStory.FrostPos(GoStory.WingSeam)) > 0.6f) Fail("날개 이음매 불이 꺼진 채 선체 밖에 안 섬");
            var frost = FrostField.Instance;
            frost.TickShip(10f);
            if (frost.ShipHeight != 0f) Fail("별배가 떠 있는데 15장 안");
            Pulse(GoStory.FrostPos(GoStory.WingSeam), 2f);
            Expect(14, 10, "날개 이음매 불");                                                    // → 10 talk 반디
            if (!seam.Lit) Fail("날개 이음매 불이 안 켜짐");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide);
            Talk(pc, ui, "bandi", "15장 끝 반디");
            if (StoryState.Ch != 15 || GoldState.Gold != gold + 4250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 5) Fail("15장 끝·보상(금 4250·교본 5·매듭 6)");
            if (!PartyState.Has("story_dareum")) Fail("달음이 합류 안 함");
            frost.TickShip(1f);
            if (frost.ShipHeight <= 0f || frost.ShipHeight >= FrostField.ShipLift) Fail($"별배가 천천히 안 뜸 {frost.ShipHeight}");
            frost.TickShip(10f);
            if (Mathf.Abs(frost.ShipHeight - FrostField.ShipLift) > 0.01f || Mathf.Abs(frost.SiteObject("ship").transform.position.y - (Site15("ship").Pos.y + FrostField.ShipLift)) > 0.05f) Fail("별배가 9m 위에 안 뜸");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_dareum", GoElement.Geo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_dareum", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Geo || hh.Trait != HeroTrait.Might || GoWeapons.TypeOf("story_dareum") != GoWeapons.Type.Polearm) Fail("달음 표(★4 암 창 무)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Dash || kit.Burst.Type != KitBurstType.Ward || Mathf.Abs(kit.Burst.Taken - 0.75f) > 0.01f) Fail("달음 한 벌(파발 질주 dash·마패 호령 ward)");
            _ch15 = "15장 역참 터·역마 평균 빠르기(걷기 못 잡고 달리기 잡음)·여우불 무리 화 둘·구미호 화 방패 2단계·날개 이음매·별배 뜸(9m)·달음 합류(★4 암 창)·보상";
        }

        private static Vector3 FrostPosOf(Vector2 off) => GoStory.FrostPos(off);
        private static GoFrost.Site Site15(string id) { GoFrost.TrySite(id, out var s); return s; }

        // ---- 16장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter16(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch16 = "16장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(38, 0);
            StoryState.Restore(15, 0);
            var area = AreaField.Instance;
            var sky = GoAreas.Skyport;
            if (area == null || !GoAreas.TrySite("skyport:port", out var port)) { Fail("은하 나루/별배 나루가 없다"); return; }
            area.Refresh();
            field.Refresh();
            if (area.PartObject("skyport:ship").activeSelf) Fail("16장 앞인데 별배가 나루에 매였다");
            if (!field.NpcShown("ara") || !field.NpcShown("bandi") || GoStory.Flat(field.NpcBody("ara").transform.position, GoStory.AreaPos("skyport:port", GoStory.PortAra)) > 0.6f) Fail("아라가 부스 곁에 안 섬");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.FrostPos(GoStory.BandiShip)) > 0.6f) Fail("16장 첫 단계 반디는 고원 별배 곁");
            Talk(pc, ui, "bandi", "16장 반디");
            Expect(15, 1, "반디 뒤");                                                            // → 1 go 나루
            Vector3 fromMap = GoStory.GridPos(2f, 2f);
            var st = StoryState.Current;
            if (GoStory.TargetOf(st, fromMap, out _) != sky.MapGate()) Fail("땅 밖에서 화살표가 지도 쪽 돌기둥이 아니다");
            pc.Teleport(GoStory.AreaPos("skyport:gate", new Vector2(0f, -8f)) + new Vector3(0f, 0.4f, 0f));
            if (GoStory.TargetOf(st, fc.transform.position, out _) == sky.MapGate()) Fail("땅 안에서 화살표가 돌기둥을 가리킴");
            field.Check(pc.transform.position);
            Expect(15, 2, "나루 도착");                                                          // → 2 talk 아라
            Talk(pc, ui, "ara", "16장 아라");
            Expect(15, 3, "아라 뒤");                                                            // → 3 kill 착륙판
            Vector3 pad = GoStory.AreaPos("skyport:port", GoStory.PortFight);
            pc.Teleport(pad + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !sky.Contains(e.transform.position))) Fail($"착륙판 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(15, 4, "착륙판 무리");                                                        // → 4 talk 아라
            Talk(pc, ui, "ara", "16장 아라 둘째");
            Expect(15, 5, "아라 둘째");                                                          // → 5 climb 계류 탑
            var tower = area.SiteObject("skyport", "port").transform.Find("Port_tower");
            Vector3 top = GoStory.TowerTop;
            Physics.SyncTransforms();
            if (tower == null || tower.GetComponent<Collider>() == null || Mathf.Abs(tower.GetComponent<Collider>().bounds.max.y - top.y) > 0.05f) Fail("계류 탑 기둥 충돌·윗면");
            if (!Physics.Raycast(top + Vector3.up * 3f, Vector3.down, out var th, 6f) || Mathf.Abs(th.point.y - top.y) > 0.05f) Fail("계류 탑 윗면 레이");
            if (!Physics.Raycast(top + new Vector3(-GoStory.TowerHalf - 4f, -8f, 0f), Vector3.right, 4f)) Fail("계류 탑이 곧은 벽이 아니다(옆 레이)");
            pc.Teleport(GoStory.AreaPos("skyport:port", Vector2.zero) + new Vector3(0f, 0.4f, 6f));
            field.Check(pc.transform.position);
            Expect(15, 5, "땅에서 탑 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(15, 6, "탑 꼭대기");                                                          // → 6 talk 반디
            area.Refresh();
            field.Refresh();
            FrostField.Instance.TickShip(0.01f);
            if (!area.PartObject("skyport:ship").activeSelf || area.PartObject("skyport:beacon").GetComponent<MeshRenderer>().sharedMaterial.name.Contains("off")) Fail("탑 뒤 별배가 매이고 빛 공이 켜져야");
            if (FrostField.Instance.SiteObject("ship").activeSelf) Fail("별배가 나루에 매였는데 고원 선체가 남음");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("skyport:port", GoStory.PortBandi)) > 0.6f) Fail("반디가 나루로 안 옴");
            Talk(pc, ui, "bandi", "16장 반디 둘째");
            Expect(15, 7, "반디 둘째");                                                          // → 7 defend
            Vector3 altar = GoStory.AreaPos("skyport:port", GoStory.PortAltar);
            pc.Teleport(altar + new Vector3(0f, 0.4f, -GoStory.DefendStart - 10f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(altar + new Vector3(0f, 0.4f, -GoStory.DefendStart + 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"계류 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!sky.Contains(e.transform.position) || e.transform.position.x - altar.x > GoStory.DefendRing * 0.75f) Fail("물결이 땅 밖·동쪽(부스 쪽)에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 7; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(15, 8, "계류 물결 셋");                                                       // → 8 talk 아라
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide);
            Talk(pc, ui, "ara", "16장 끝 아라");
            if (StoryState.Ch != 16 || GoldState.Gold != gold + 4500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 5) Fail("16장 끝·보상(금 4500·교본 5·매듭 6)");
            _ch16 = "16장 은하 나루(땅 밖 화살표는 돌기둥)·아라·무리 넷·계류 탑 벽 18m 꼭대기(땅에선 안 넘어감)·탑 뒤 빛 공/매인 별배/고원 선체 떠남·반디 자리·계류 물결 셋(동쪽 뺌)·보상";
        }

        // ---- 17장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter17(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch17 = "17장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(40, 0);
            StoryState.Restore(16, 0);
            var area = AreaField.Instance;
            var sky = GoAreas.Skyport;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (area.PartObject("skyport:bell").activeSelf || !area.PartObject("skyport:bell_fallen").activeSelf) Fail("17장 앞인데 종이 걸려 있다");
            if (!field.NpcShown("hangyeol") || GoStory.Flat(field.NpcBody("hangyeol").transform.position, GoStory.AreaPos("skyport:temple", GoStory.Hangyeol)) > 0.6f) Fail("한결이 절터 종각 남쪽에 안 섬");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("skyport:port", GoStory.PortBandi)) > 0.6f) Fail("17장 첫 단계 반디는 나루");
            Talk(pc, ui, "ara", "17장 아라");
            Expect(16, 1, "아라 뒤");                                                            // → 1 go 절터
            pc.Teleport(GoStory.AreaPos("skyport:temple", Vector2.zero) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(16, 2, "절터 도착");                                                          // → 2 talk 한결
            Talk(pc, ui, "hangyeol", "17장 한결");
            Expect(16, 3, "한결 뒤");                                                            // → 3 kill 쓰러진 종 곁
            Vector3 fight = GoStory.AreaPos("skyport:bell", GoStory.BellFight);
            pc.Teleport(fight + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Count(e => e.Element == GoElement.Dendro) != 2 || field.Squad.Any(e => !sky.Contains(e.transform.position))) Fail($"종 곁 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(16, 4, "종 곁 무리");                                                         // → 4 talk 한결(종 곁)
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("hangyeol").transform.position, GoStory.AreaPos("skyport:bell", GoStory.HgBell)) > 0.6f) Fail("한결이 쓰러진 종 곁으로 안 감");
            Talk(pc, ui, "hangyeol", "17장 한결 둘째");
            Expect(16, 5, "한결 둘째");                                                          // → 5 duel 이무기
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"이끼 이무기 {field.Squad.Count}"); return; }
            var snake = field.Squad[0];
            if (!snake.IsStoryBoss || snake.DisplayName != GoLocalization.T("story.boss.mossserpent", "이끼 이무기") || snake.Element != GoElement.Dendro || snake.CurrentMove != FieldEnemy.BossMove.Spit) Fail($"이무기 이름·초·첫 수 {snake.DisplayName}·{snake.Element}·{snake.CurrentMove}");
            snake.SetShieldForTest(0f);
            snake.TakeRaw(snake.Hp - snake.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!snake.Shielded || snake.Element != GoElement.Dendro || field.Squad.Count != 3) Fail($"2단계 초 방패·졸개 {snake.Element}·{field.Squad.Count}");
            Kill(snake);
            Expect(16, 6, "이끼 이무기");                                                        // → 6 talk 한결
            Talk(pc, ui, "hangyeol", "17장 한결 종");
            Expect(16, 7, "한결 종");                                                            // → 7 talk 반디(종 곁, 종이 걸림)
            area.Refresh();
            field.Refresh();
            if (!area.PartObject("skyport:bell").activeSelf || area.PartObject("skyport:bell_fallen").activeSelf) Fail("반디 단계에 종이 걸리고 누운 종이 사라져야");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("skyport:bell", GoStory.BellBandi)) > 0.6f) Fail("반디가 종 곁으로 안 옴");
            Talk(pc, ui, "bandi", "17장 반디");
            Expect(16, 8, "반디 뒤");                                                            // → 8 light 종각
            field.Refresh();
            if (field.AltarOfKey("16_8") != null) Fail("종각 종 울리기에 등롱 몸이 섰다(등롱 없이여야)");
            Vector3 belfry = GoStory.AreaPos("skyport:temple", GoStory.Belfry);
            Pulse(belfry + new Vector3(30f, 0f, 0f), 2f);
            Expect(16, 8, "멀리서 종이 울림");
            Pulse(belfry, 2f);
            Expect(16, 9, "종 울림");                                                            // → 9 talk 한결
            if (!area.Ringing) Fail("종이 흔들리지 않음");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("hangyeol").transform.position, GoStory.AreaPos("skyport:temple", GoStory.Hangyeol)) > 0.6f) Fail("한결이 종각 곁으로 안 돌아옴");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide);
            Talk(pc, ui, "hangyeol", "17장 끝 한결");
            if (StoryState.Ch != 17 || GoldState.Gold != gold + 4750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 5) Fail("17장 끝·보상(금 4750·교본 5·매듭 6)");
            _ch17 = "17장 절터·한결(종 곁으로 옮김)·종 곁 무리(초 둘)·이끼 이무기(초·풍 방패 2단계)·종이 걸리면 누운 종 사라짐·반디 자리·종각 종 울림(등롱 없이)·보상";
        }

        // ---- 18장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter18(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch18 = "18장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(42, 0);
            StoryState.Restore(17, 0);
            var area = AreaField.Instance;
            var sky = GoAreas.Skyport;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (GoStory.TrainPowered || !area.PartObject("skyport:train_lamp_a").GetComponent<MeshRenderer>().sharedMaterial.name.Contains("off")) Fail("18장 앞인데 막차에 불이 들어옴");
            if (!field.NpcShown("dodam") || field.NpcShown("captain") || GoStory.Flat(field.NpcBody("dodam").transform.position, GoStory.AreaPos("skyport:station", GoStory.DodamAt)) > 0.6f) Fail("도담이 승강장 끝에 안 섬·잔상은 아직 안 보여야");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("skyport:temple", GoStory.TempleBandi)) > 0.6f) Fail("18장 첫 단계 반디는 종각 곁");
            Talk(pc, ui, "bandi", "18장 반디");
            Expect(17, 1, "반디 뒤");                                                            // → 1 go 은하역
            pc.Teleport(GoStory.AreaPos("skyport:station", Vector2.zero) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(17, 2, "은하역 도착");                                                        // → 2 talk 도담
            Talk(pc, ui, "dodam", "18장 도담");
            Expect(17, 3, "도담 뒤");                                                            // → 3 kill 태양광 밭
            Vector3 fight = GoStory.AreaPos("skyport:farm", GoStory.FarmFight);
            pc.Teleport(fight + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !sky.Contains(e.transform.position))) Fail($"태양광 밭 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(17, 4, "태양광 밭 무리");                                                     // → 4 light 변전함
            if (field.AltarOfKey("17_4") != null) Fail("변전함에 등롱 몸이 섰다(등롱 없이여야)");
            Vector3 sub = GoStory.AreaPos("skyport:farm", GoStory.SubstationOff);
            Pulse(sub + new Vector3(30f, 0f, 0f), 2f);
            Expect(17, 4, "멀리서 전기가 들어감");
            Pulse(sub, 2f);
            Expect(17, 5, "변전함 전기");                                                        // → 5 talk 도담
            area.Refresh();
            if (!GoStory.TrainPowered || area.PartObject("skyport:train_lamp_a").GetComponent<MeshRenderer>().sharedMaterial.name.Contains("off") || !area.PartObject("skyport:substation_lamp").GetComponent<MeshRenderer>().sharedMaterial.name.Contains("green")) Fail("전기 뒤 막차 전조등·변전함 표시등이 안 켜짐");
            Talk(pc, ui, "dodam", "18장 도담 둘째");
            Expect(17, 6, "도담 둘째");                                                          // → 6 chase 잔상
            field.Refresh();
            if (!field.NpcShown("captain")) Fail("잔상이 선로 위에 안 섬");
            float len = 0f;
            for (int i = 1; i < GoStory.CaptainPath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("captain", i - 1), GoStory.RunPoint("captain", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.CaptainPath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"잔상 평균 {avg:0.0}m/초");
            Vector3 t0 = GoStory.RunPoint("captain", 0);
            Vector3 me = t0 + new Vector3(-10f, 0f, 0f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 6) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(-10f, 0f, 0f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 잔상이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 잔상을 못 잡음");
            Expect(17, 7, "잔상 잡음");                                                          // → 7 talk 도담(선로 끝)
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("dodam").transform.position, GoStory.AreaPos("skyport:station", GoStory.DodamEnd)) > 0.6f) Fail("도담이 선로 끝으로 안 옴");
            Talk(pc, ui, "dodam", "18장 선로 끝 도담");
            Expect(17, 8, "선로 끝 도담");                                                       // → 8 defend 막차
            Vector3 train = GoStory.AreaPos("skyport:station", GoStory.TrainAt);
            pc.Teleport(train + new Vector3(0f, 0.4f, -GoStory.DefendStart - 10f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(train + new Vector3(0f, 0.4f, -GoStory.DefendStart + 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"막차 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!sky.Contains(e.transform.position) || e.transform.position.z - train.z < -GoStory.DefendRing * 0.75f) Fail("물결이 땅 밖·북쪽(객차 쪽)에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 8; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(17, 9, "막차 물결 셋");                                                       // → 9 talk 도담
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide);
            Talk(pc, ui, "dodam", "18장 끝 도담");
            if (StoryState.Ch != 18 || GoldState.Gold != gold + 5000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6) Fail("18장 끝·보상(금 5000·교본 6·매듭 6)");
            if (!PartyState.Has("story_dodam")) Fail("도담이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_dodam", GoElement.Electro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_dodam", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Electro || hh.Trait != HeroTrait.Might || GoWeapons.TypeOf("story_dodam") != GoWeapons.Type.Claymore) Fail("도담 표(★4 뇌 대도 무)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Wave || kit.Burst.Type != KitBurstType.Haste || Mathf.Abs(kit.Skill.Knock - 4f) > 0.01f) Fail("도담 한 벌(선로 전류 wave·막차 출발 신호 haste)");
            _ch18 = "18장 은하역·도담(선로 끝으로 옮김)·태양광 밭 무리·변전함(등롱 없이) 전기 → 막차 전조등/표시등·잔상 쫓기(평균 빠르기 걷기 못 잡고 달리기 잡음)·막차 물결 셋(북쪽 뺌)·도담 합류(★4 뇌 대도)·보상";
        }

        // ---- 19장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter19(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch19 = "19장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(44, 0);
            StoryState.Restore(18, 0);
            var area = AreaField.Instance;
            var cr = GoAreas.Crossing;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (GoStory.ClockRunning || area.ClockOn) Fail("19장 앞인데 시계 바늘이 돈다");
            if (!field.NpcShown("dodam") || field.NpcShown("hanbyeol")) Fail("19장 첫 단계: 도담 은하역·한별은 아직");
            Talk(pc, ui, "dodam", "19장 도담");
            Expect(18, 1, "도담 뒤");                                                            // → 1 sail 막차
            Talk(pc, ui, "dodam", "19장 막차");
            Expect(18, 2, "막차 뒤");                                                            // → 2 talk 반디
            if (!cr.Contains(pc.transform.position) || GoStory.Flat(pc.transform.position, GoStory.AreaPos("crossing:platform", GoStory.CrossArrive)) > 8f) Fail($"막차가 틈새 갈림길 승강장에 안 닿음 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("crossing:platform", GoStory.CrossBandi)) > 0.6f) Fail("반디가 승강장에 안 섬");
            Talk(pc, ui, "bandi", "19장 반디");
            Expect(18, 3, "반디 뒤");                                                            // → 3 kill 갈림목
            Vector3 fork = GoStory.AreaPos("crossing:clock", GoStory.CrossFork);
            pc.Teleport(fork + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !cr.Contains(e.transform.position))) Fail($"갈림목 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(18, 4, "갈림목 무리");                                                        // → 4 climb 시계탑
            Physics.SyncTransforms();
            Vector3 ctop = GoStory.ClimbTopOf("crossing:clock");
            var clockT = area.SiteObject("crossing", "clock").transform.Find("Clock_tower");
            if (clockT == null || clockT.GetComponent<Collider>() == null || Mathf.Abs(clockT.GetComponent<Collider>().bounds.max.y - ctop.y) > 0.05f) Fail("시계탑 기둥 충돌·윗면");
            if (!Physics.Raycast(ctop + new Vector3(-GoStory.ClockHalf - 4f, -8f, 0f), Vector3.right, 4f)) Fail("시계탑이 곧은 벽이 아니다");
            pc.Teleport(GoStory.AreaPos("crossing:clock", Vector2.zero) + new Vector3(4f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(18, 4, "땅에서 시계탑 단계가 넘어감");
            pc.Teleport(ctop + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(18, 5, "시계탑 꼭대기");                                                      // → 5 talk 반디
            area.Refresh();
            field.Refresh();
            if (!GoStory.ClockRunning || !area.ClockOn) Fail("태엽을 푼 뒤 시계 바늘이 안 돎");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("crossing:clock", GoStory.CrossClockBandi)) > 0.6f) Fail("반디가 시계탑 발치에 안 섬");
            Talk(pc, ui, "bandi", "19장 반디 시계");
            Expect(18, 6, "반디 시계");                                                          // → 6 climb 섬돌
            // 섬돌 — 열다섯 원판이 1.1m 씩(걸어 오르는 턱 안) 나선, 꼭대기 = 마지막 돌 위
            Vector3 stop = GoStory.ClimbTopOf("crossing:steps");
            var stones = area.SiteObject("crossing", "steps").GetComponentsInChildren<Collider>().Where(c => c.name == "Steps_stone").OrderBy(c => c.bounds.max.y).ToArray();
            if (stones.Length != GoStory.StepN || Mathf.Abs(stones.Last().bounds.max.y - stop.y) > 0.1f) Fail($"섬돌 {stones.Length}·꼭대기 {stones.Last().bounds.max.y:0.00} ≠ {stop.y:0.00}");
            for (int i = 1; i < stones.Length; i++)
                if (stones[i].bounds.max.y - stones[i - 1].bounds.max.y > 1.15f) Fail($"섬돌 {i} 틈이 걸어 오르는 턱(1.1m)보다 큼");
            pc.Teleport(GoStory.AreaPos("crossing:steps", new Vector2(0f, 8f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(18, 6, "땅에서 섬돌 단계가 넘어감");
            pc.Teleport(stop + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(18, 7, "섬돌 꼭대기");                                                        // → 7 talk 한별
            field.Refresh();
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("crossing:steps", GoStory.CrossStepsHanbyeol)) > 0.6f) Fail("한별이 섬돌 밑에 안 섬");
            Talk(pc, ui, "hanbyeol", "19장 한별");
            Expect(18, 8, "한별 뒤");                                                            // → 8 duel 파수꾼
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"멈춘 시간의 파수꾼 {field.Squad.Count}"); return; }
            var warden = field.Squad[0];
            if (!warden.IsStoryBoss || warden.DisplayName != GoLocalization.T("story.boss.timewarden", "멈춘 시간의 파수꾼") || warden.Element != GoElement.Anemo || warden.CurrentMove != FieldEnemy.BossMove.Halo) Fail($"파수꾼 이름·풍·첫 수 {warden.DisplayName}·{warden.Element}·{warden.CurrentMove}");
            warden.SetShieldForTest(0f);
            warden.TakeRaw(warden.Hp - warden.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!warden.Shielded || warden.Element != GoElement.Anemo || field.Squad.Count != 3) Fail($"2단계 풍 방패·졸개 {warden.Element}·{field.Squad.Count}");
            Kill(warden);
            Expect(18, 9, "멈춘 시간의 파수꾼");                                                 // → 9 talk 한별
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "hanbyeol", "19장 끝 한별");
            if (StoryState.Ch != 19 || GoldState.Gold != gold + 5250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("19장 끝·보상(금 5250·교본 6·비급 5·매듭 6)");
            field.Refresh();
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("crossing:platform", GoStory.CrossHanbyeol)) > 0.6f) Fail("19장 뒤 한별이 승강장에 안 섬");
            _ch19 = "19장 막차 sail(승강장 도착)·반디 자리 옮김·갈림목 무리·시계탑 16m 벽/꼭대기(땅에선 안 넘어감)·시계 바늘 돎·섬돌 열다섯(걸어 오르는 턱 안)·한별 섬돌 밑·파수꾼 풍/2단계 풍 방패·한별 승강장·보상";
        }

        // ---- 20장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter20(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch20 = "20장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(46, 0);
            StoryState.Restore(19, 0);
            var area = AreaField.Instance;
            var cr = GoAreas.Crossing;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 rc = GoStory.RiftCenter;
            Physics.SyncTransforms();
            if (!Physics.Raycast(rc + Vector3.up * 3f, Vector3.down, out var rh, 6f) || Mathf.Abs(rh.point.y - rc.y) > 0.05f) Fail("갈림길 끝 섬 윗면 충돌");
            if (!GoStory.OnSkyTop(rc + Vector3.up * 0.3f) || !GoStory.OnSkyLayer(rc + Vector3.up * 0.3f) || GoStory.OnSkyTop(GoStory.AreaPos("crossing:platform", Vector2.zero))) Fail("갈림길 끝 섬이 하늘 층 판정에 안 듦");
            if (area.TearNow != 0 || area.RiftPillarOpen || PlayerController.InDraft(GoStory.RiftPillarPos + Vector3.up * 5f)) Fail("20장 앞인데 틈이 오므라들거나 바람 기둥이 섬");
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("crossing:platform", GoStory.CrossHanbyeol)) > 0.6f) Fail("한별이 첫 정거장에 안 섬");
            Talk(pc, ui, "hanbyeol", "20장 한별");
            Expect(19, 1, "한별 뒤");                                                            // → 1 sail 섬
            Talk(pc, ui, "dodam", "20장 막차");
            Expect(19, 2, "막차 뒤");                                                            // → 2 talk 반디
            if (!GoStory.OnRiftTop(pc.transform.position) && GoStory.Flat(pc.transform.position, GoStory.RiftPos(GoStory.RiftArrive)) > 8f) Fail($"막차가 섬 위에 안 닿음 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.RiftPos(GoStory.RiftBandi)) > 0.6f || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.RiftPos(GoStory.RiftHanbyeol)) > 0.6f) Fail("반디·한별이 섬 위에 안 섬");
            Talk(pc, ui, "bandi", "20장 반디");
            Expect(19, 3, "반디 뒤");                                                            // → 3 kill 섬 위
            pc.Teleport(GoStory.RiftPos(new Vector2(0f, GoStory.KillNear - 15f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 5 || field.Squad.Any(e => !GoStory.OnSkyTop(e.transform.position))) Fail($"섬 위 무리 {field.Squad.Count}(섬 위여야)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(19, 4, "섬 위 무리");                                                         // → 4 talk 한별
            Talk(pc, ui, "hanbyeol", "20장 한별 매듭");
            Expect(19, 5, "한별 매듭");                                                          // → 5 seal 달·별·해
            field.Refresh();
            if (!field.SealCenterOf(19).gameObject.activeSelf || field.SealLampOf(19, 0).Lit) Fail("매듭 석등이 꺼진 채 안 섬");
            if (field.SealLampOf(19, 0).transform.position.y < rc.y - 1f || !GoStory.OnSkyTop(field.SealLampOf(19, 0).transform.position)) Fail("매듭 석등이 섬 위에 안 앉음");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(19, Lamp(id)).transform.position;
            Pulse(L("star"), 1f);                                                                // 틀림(첫째는 달)
            if (StoryState.Progress != 0 || field.SealLampOf(19, Lamp("star")).Lit) Fail("차례 틀린 별이 켜짐(달·별·해)");
            Pulse(L("moon"), 1f);
            Pulse(L("star"), 1f);
            Expect(19, 5, "둘 켰는데 넘어감");
            Pulse(L("sun"), 1f);
            Expect(19, 6, "달·별·해");                                                            // → 6 talk 한별
            area.Refresh();
            if (area.TearNow != 1) Fail($"석등 뒤 틈이 오므라들어야 {area.TearNow}");
            Talk(pc, ui, "hanbyeol", "20장 한별 오므라듦");
            Expect(19, 7, "한별 오므라듦");                                                      // → 7 defend
            Vector3 altar = GoStory.RiftPos(Vector2.zero);
            pc.Teleport(altar + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(altar + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"매듭 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!GoStory.OnSkyTop(e.transform.position)) Fail("물결이 섬 밖에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 7; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(19, 8, "매듭 물결 셋");                                                       // → 8 talk 한별
            Talk(pc, ui, "hanbyeol", "20장 한별 까마귀");
            Expect(19, 9, "한별 까마귀");                                                        // → 9 duel 별까마귀
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"별까마귀 {field.Squad.Count}"); return; }
            var crow = field.Squad[0];
            if (!crow.IsStoryBoss || crow.DisplayName != GoLocalization.T("story.boss.riftcrow", "틈 삼킨 별까마귀") || crow.Element != GoElement.Cryo || crow.CurrentMove != FieldEnemy.BossMove.Rift) Fail($"별까마귀 이름·빙·첫 수 {crow.DisplayName}·{crow.Element}·{crow.CurrentMove}");
            crow.SetShieldForTest(0f);
            crow.TakeRaw(crow.Hp - crow.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!crow.Shielded || crow.Element != GoElement.Cryo || field.Squad.Count != 3) Fail($"2단계 빙 방패·졸개 {crow.Element}·{field.Squad.Count}");
            Kill(crow);
            Expect(19, 10, "틈 삼킨 별까마귀");                                                 // → 10 talk 한별
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide);
            Talk(pc, ui, "hanbyeol", "20장 끝 한별");
            if (StoryState.Ch != 20 || GoldState.Gold != gold + 5500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6) Fail("20장 끝·보상(금 5500·교본 6·매듭 6)");
            if (!PartyState.Has("story_hanbyeol")) Fail("한별이 합류 안 함");
            area.Refresh();
            if (area.TearNow != 2 || !area.RiftPillarOpen || !PlayerController.InDraft(GoStory.RiftPillarPos + Vector3.up * 5f) || PlayerController.InDraft(GoStory.RiftPillarPos + new Vector3(GoStory.DraftR + 2f, 5f, 0f))) Fail("20장 뒤 틈이 닫히고 바람 기둥이 서야");
            if (Mathf.Abs(PlayerController.DraftTopAt(GoStory.RiftPillarPos + Vector3.up * 5f) - GoStory.RiftDraftTop) > 0.01f) Fail("바람 기둥 솟는 높이");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_hanbyeol", GoElement.Anemo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_hanbyeol", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 5 || GoHeroes.ElementOf(hh) != GoElement.Anemo || hh.Trait != HeroTrait.Command || GoWeapons.TypeOf("story_hanbyeol") != GoWeapons.Type.Bow) Fail("한별 표(★5 풍 활 통솔)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Updraft || kit.Burst.Type != KitBurstType.Vortex || Mathf.Abs(kit.Skill.Lift - 15f) > 0.01f || Mathf.Abs(kit.Skill.Pull - 6f) > 0.01f) Fail("한별 한 벌(별배 견인줄 updraft·틈 닫기 vortex)");
            _ch20 = "20장 갈림길 끝 섬 층 판정·막차 sail 섬 위·반디/한별/도담 섬 위 자리·섬 위 무리 다섯·매듭 석등 달·별·해(틀리면 꺼짐, 섬 위)·틈 오므라듦/닻·매듭 제단 물결 셋(섬 안)·별까마귀 빙 2단계·한별 합류(★5 풍 활)·틈 닫힘/별빛/바람 기둥·보상";
        }

        // ---- 21장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter21(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch21 = "21장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(48, 0);
            StoryState.Restore(20, 0);
            var area = AreaField.Instance;
            var sk = GoAreas.Sunken;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("skyport:port", GoStory.SunkPortHanbyeol)) > 0.6f) Fail("21장 첫 단계: 한별이 은하 나루 별배 곁에 안 섬");
            if (!field.NpcShown("yeoul") || GoStory.Flat(field.NpcBody("yeoul").transform.position, GoStory.AreaPos("sunken:lab", GoStory.LabYeoul)) > 0.6f) Fail("여울이 연구 기지 서쪽에 안 섬");
            Talk(pc, ui, "hanbyeol", "21장 한별");
            Expect(20, 1, "한별 뒤");                                                            // → 1 sail 별배
            Talk(pc, ui, "hanbyeol", "21장 별배");
            Expect(20, 2, "별배 뒤");                                                            // → 2 talk 반디
            if (!sk.Contains(pc.transform.position) || GoStory.Flat(pc.transform.position, GoStory.AreaPos("sunken:gate", GoStory.SandArrive)) > 8f) Fail($"별배가 잠긴 도읍 모래밭에 안 닿음 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:gate", GoStory.SandBandi)) > 0.6f) Fail("반디가 모래밭에 안 섬");
            if (GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("sunken:gate", GoStory.SandHanbyeol)) > 0.6f) Fail("한별이 모래밭에 안 섬");
            Talk(pc, ui, "bandi", "21장 반디");
            Expect(20, 3, "반디 뒤");                                                            // → 3 kill 기지 앞
            Vector3 front = GoStory.AreaPos("sunken:lab", GoStory.LabFront);
            pc.Teleport(front + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !sk.Contains(e.transform.position))) Fail($"기지 앞 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(20, 4, "기지 앞 무리");                                                       // → 4 go 선착장
            Vector3 dock = GoStory.AreaPos("sunken:lab", GoStory.LabDock);
            pc.Teleport(GoStory.AreaPos("sunken:gate", Vector2.zero) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(20, 4, "멀리서 선착장 단계가 넘어감");
            pc.Teleport(dock + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(20, 5, "선착장");                                                             // → 5 talk 여울
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("yeoul").transform.position, dock) > 0.6f) Fail("여울이 선착장에 안 섬");
            Talk(pc, ui, "yeoul", "21장 여울");
            Expect(20, 6, "여울 뒤");                                                            // → 6 sail 잠수정
            Talk(pc, ui, "yeoul", "21장 잠수정");
            Expect(20, 7, "잠수정 뒤");                                                          // → 7 talk 여울
            if (!sk.Contains(pc.transform.position) || GoStory.Flat(pc.transform.position, GoStory.AreaPos("sunken:palace", GoStory.PlinthArrive)) > 8f) Fail($"잠수정이 궁궐 기단에 안 닿음 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("yeoul").transform.position, GoStory.AreaPos("sunken:palace", GoStory.PlinthYeoul)) > 0.6f) Fail("여울이 궁궐 기단에 안 섬");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:palace", GoStory.PlinthBandi)) > 0.6f) Fail("반디가 궁궐 기단에 안 섬");
            Physics.SyncTransforms();
            Vector3 plinthTop = FolkWalker.Grounded(GoStory.AreaPos("sunken:palace", GoStory.PlinthYeoul) + Vector3.up * 0.5f);
            if (plinthTop.y < 0.5f) Fail($"궁궐 기단 앞마당 바닥 높이 {plinthTop.y:0.00}");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "yeoul", "21장 끝 여울");
            if (StoryState.Ch != 21 || GoldState.Gold != gold + 5750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("21장 끝·보상(금 5750·교본 6·비급 5·매듭 6)");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:palace", GoStory.PlinthBandi)) > 0.6f || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("sunken:gate", GoStory.SandHanbyeol)) > 0.6f) Fail("21장 뒤 반디·한별 자리");
            _ch21 = "21장 별배 sail(잠긴 도읍 모래밭 도착)·한별 별배 곁→모래밭·반디 자리 옮김·기지 앞 무리 넷(땅 안)·선착장 go(멀리선 안 넘어감)·여울 선착장→기단·잠수정 sail(궁궐 기단 도착)·기단 바닥·보상";
        }

        // ---- 22장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter22(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch22 = "22장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(50, 0);
            StoryState.Restore(21, 0);
            var area = AreaField.Instance;
            var sk = GoAreas.Sunken;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            var domeSite = area.SiteObject("sunken", "dome");
            var door = domeSite != null ? domeSite.transform.Find("Dome_door") : null;
            if (door == null || !door.gameObject.activeSelf || GoStory.DomeOpen) Fail("22장 앞인데 돔 문이 열림");
            if (field.NpcShown("mulsae")) Fail("22장 첫 단계: 물새는 아직");
            if (GoStory.Flat(field.NpcBody("yeoul").transform.position, GoStory.AreaPos("sunken:palace", GoStory.PlinthYeoul)) > 0.6f) Fail("여울이 궁궐 기단에 안 섬");
            Talk(pc, ui, "yeoul", "22장 여울");
            Expect(21, 1, "여울 뒤");                                                            // → 1 talk 물새
            field.Refresh();
            if (!field.NpcShown("mulsae") || GoStory.Flat(field.NpcBody("mulsae").transform.position, GoStory.AreaPos("sunken:palace", GoStory.AnnexMulsae)) > 0.6f) Fail("물새가 곁채 앞에 안 섬");
            Talk(pc, ui, "mulsae", "22장 물새 곁채");
            Expect(21, 2, "물새 곁채");                                                          // → 2 gather 바지락
            var clams = GoCooking.SunkenNodes;
            if (clams.Length != 6 || clams.Any(n => n.Item != "clam" || !sk.Contains(n.Pos))) { Fail($"잠긴 도읍 바지락 포기 {clams.Length}"); return; }
            pc.Teleport(clams[0].Pos + new Vector3(30f, 0.4f, 0f));
            field.Refresh();
            StoryField.Target(out Vector3 ct, out _);
            if (clams.All(n => GoStory.Flat(ct, n.Pos) > 0.5f)) Fail("gather 기둥이 잠긴 도읍 바지락 포기가 아니다");
            CookState.Pick(clams[0]);
            CookState.Pick(clams[1]);
            ui.Refresh();
            if (StoryState.Progress != 2 || !ui.TrackText.Contains("2/3")) Fail($"바지락 2 — 셈 {StoryState.Progress}·줄 '{ui.TrackText}'");
            CookState.Pick(clams[2]);
            Expect(21, 3, "바지락 셋");                                                          // → 3 talk 물새
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("mulsae").transform.position, GoStory.AreaPos("sunken:dome", GoStory.FrontMulsae)) > 0.6f) Fail("물새가 돔 문 앞에 안 섬");
            if (GoStory.Flat(field.NpcBody("yeoul").transform.position, GoStory.AreaPos("sunken:dome", GoStory.FrontYeoul)) > 0.6f || GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:dome", GoStory.FrontBandi)) > 0.6f) Fail("여울·반디가 돔 문 앞에 안 섬");
            Talk(pc, ui, "mulsae", "22장 물새 문 앞");
            Expect(21, 4, "물새 문 앞");                                                         // → 4 seal 해·별·달
            field.Refresh();
            Vector3 front = GoStory.AreaPos("sunken:dome", GoStory.DomeFront);
            if (!field.SealCenterOf(21).gameObject.activeSelf || field.SealLampOf(21, 0).Lit) Fail("물길 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++)
                if (GoStory.Flat(field.SealLampOf(21, i).transform.position, front) > GoStory.SealR + 1f || !sk.Contains(field.SealLampOf(21, i).transform.position)) Fail($"물길 석등 {i} 자리");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(21, Lamp(id)).transform.position;
            Pulse(L("star"), 1f);                                                                // 틀림(첫째는 해)
            if (StoryState.Progress != 0 || field.SealLampOf(21, Lamp("star")).Lit) Fail("차례 틀린 별이 켜짐(해·별·달)");
            Pulse(L("sun"), 1f);
            Pulse(L("star"), 1f);
            Expect(21, 4, "둘 켰는데 넘어감");
            Pulse(L("moon"), 1f);
            Expect(21, 5, "해·별·달");                                                           // → 5 talk 물새
            Talk(pc, ui, "mulsae", "22장 물새 자물쇠");
            Expect(21, 6, "물새 자물쇠");                                                        // → 6 defend
            if (GoStory.DomeOpen) Fail("자물쇠 지키는 중인데 돔 문이 열림");
            pc.Teleport(front + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(front + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"자물쇠 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!sk.Contains(e.transform.position)) Fail("물결이 잠긴 도읍 밖에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 6; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(21, 7, "자물쇠 물결 셋");                                                     // → 7 talk 여울(문이 열린다)
            area.Refresh();
            field.Refresh();
            if (!GoStory.DomeOpen || door.gameObject.activeSelf) Fail("여덟째 단계부터 돔 문이 열려야");
            if (GoStory.Flat(field.NpcBody("yeoul").transform.position, GoStory.AreaPos("sunken:dome", GoStory.InYeoul)) > 0.6f || GoStory.Flat(field.NpcBody("mulsae").transform.position, GoStory.AreaPos("sunken:dome", GoStory.InMulsae)) > 0.6f || GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:dome", GoStory.InBandi)) > 0.6f) Fail("여울·물새·반디가 돔 안에 안 섬");
            Talk(pc, ui, "yeoul", "22장 여울 돔");
            Expect(21, 8, "여울 돔");                                                            // → 8 duel 등불아귀
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"심해 등불아귀 {field.Squad.Count}"); return; }
            var angler = field.Squad[0];
            if (!angler.IsStoryBoss || angler.DisplayName != GoLocalization.T("story.boss.angler", "심해 등불아귀") || angler.Element != GoElement.Hydro || angler.CurrentMove != FieldEnemy.BossMove.Spit) Fail($"등불아귀 이름·수·첫 수 {angler.DisplayName}·{angler.Element}·{angler.CurrentMove}");
            if (!sk.Contains(angler.transform.position)) Fail("등불아귀가 잠긴 도읍 밖");
            angler.SetShieldForTest(0f);
            angler.TakeRaw(angler.Hp - angler.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!angler.Shielded || angler.Element != GoElement.Hydro || field.Squad.Count != 3) Fail($"2단계 수 방패·졸개 {angler.Element}·{field.Squad.Count}");
            Kill(angler);
            Expect(21, 9, "심해 등불아귀");                                                     // → 9 talk 물새
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "mulsae", "22장 끝 물새");
            if (StoryState.Ch != 22 || GoldState.Gold != gold + 6000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("22장 끝·보상(금 6000·교본 6·비급 5·매듭 6)");
            field.Refresh();
            if (!field.NpcShown("mulsae") || GoStory.Flat(field.NpcBody("mulsae").transform.position, GoStory.AreaPos("sunken:dome", GoStory.InMulsae)) > 0.6f) Fail("22장 뒤 물새가 돔 안에 안 섬");
            _ch22 = "22장 여울 5~8째 자리·물새 곁채→문 앞→돔 안·바지락 포기 여섯(잠긴 도읍 안, 기둥·셈)·물길 석등 해·별·달(틀리면 꺼짐)·문 자물쇠 물결 셋(땅 안)·돔 문 8째 단계부터 열림·등불아귀 수 2단계 방패·보상";
        }

        // ---- 23장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter23(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch23 = "23장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(52, 0);
            StoryState.Restore(22, 0);
            var area = AreaField.Instance;
            var sk = GoAreas.Sunken;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (GoStory.LighthouseLit) Fail("23장 앞인데 등대 불이 켜짐");
            if (!field.NpcShown("parang") || GoStory.Flat(field.NpcBody("parang").transform.position, GoStory.AreaPos("sunken:dome", GoStory.ParangAt)) > 0.6f) Fail("파랑이 기록실 앞에 안 섬");
            Talk(pc, ui, "parang", "23장 파랑");
            Expect(22, 1, "파랑 뒤");                                                            // → 1 climb 등대
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:lighthouse", GoStory.LightBandi)) > 0.6f) Fail("반디가 등대 발치에 안 섬");
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("sunken:lighthouse");
            var tower = area.SiteObject("sunken", "lighthouse").transform.Find("Light_tower");
            if (tower == null || tower.GetComponent<Collider>() == null || Mathf.Abs(tower.GetComponent<Collider>().bounds.max.y - top.y) > 0.1f) Fail($"등대 돌탑 충돌·윗면 {(tower == null ? -1f : tower.GetComponent<Collider>() == null ? -2f : tower.GetComponent<Collider>().bounds.max.y):0.00} ≠ {top.y:0.00}");
            if (!Physics.Raycast(top + new Vector3(-GoStory.LightHalf - 4f, -8f, 0f), Vector3.right, 4f)) Fail("등대가 곧은 벽이 아니다");
            pc.Teleport(GoStory.AreaPos("sunken:lighthouse", Vector2.zero) + new Vector3(6f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(22, 1, "땅에서 등대 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(22, 2, "등대 난간 판");                                                       // → 2 light 등롱
            Vector3 lamp = GoStory.AreaPos("sunken:lighthouse", Vector2.zero);
            pc.Teleport(lamp + new Vector3(3f, 0.4f, 0f));                                       // 땅에서는 불이 안 닿는다
            Pulse(lamp, 4f);
            Expect(22, 2, "땅에서 쏜 원소로 등롱에 불이 붙음");
            if (GoStory.LighthouseLit) Fail("땅에서 쏘았는데 등대 불이 켜짐");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            Pulse(lamp, 1f);
            Expect(22, 3, "난간 판 위 등롱 불");                                                 // → 3 talk 반디
            area.Refresh();
            if (!GoStory.LighthouseLit) Fail("등롱에 불을 넣었는데 등대가 안 켜짐");
            Talk(pc, ui, "bandi", "23장 반디");
            Expect(22, 4, "반디 뒤");                                                            // → 4 talk 파랑
            Talk(pc, ui, "parang", "23장 파랑 기록");
            Expect(22, 5, "파랑 기록 뒤");                                                       // → 5 duel 파수 거신
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.AreaPos("sunken:dome", GoStory.InBandi)) > 0.6f) Fail("반디가 돔 안으로 안 돌아옴");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"돔 파수 거신 {field.Squad.Count}"); return; }
            var colo = field.Squad[0];
            if (!colo.IsStoryBoss || colo.DisplayName != GoLocalization.T("story.boss.colossus", "돔 파수 거신") || colo.Element != GoElement.Geo || colo.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"파수 거신 이름·암·첫 수 {colo.DisplayName}·{colo.Element}·{colo.CurrentMove}");
            if (!sk.Contains(colo.transform.position)) Fail("파수 거신이 잠긴 도읍 밖");
            colo.SetShieldForTest(0f);
            colo.TakeRaw(colo.Hp - colo.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!colo.Shielded || colo.Element != GoElement.Geo || field.Squad.Count != 3) Fail($"2단계 암 방패·졸개 {colo.Element}·{field.Squad.Count}");
            Kill(colo);
            Expect(22, 6, "돔 파수 거신");                                                       // → 6 talk 물새
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "mulsae", "23장 끝 물새");
            if (StoryState.Ch != 23 || GoldState.Gold != gold + 6250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("23장 끝·보상(금 6250·교본 6·비급 5·매듭 6)");
            if (!PartyState.Has("story_mulsae")) Fail("물새가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_mulsae", GoElement.Hydro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_mulsae", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Hydro || hh.Trait != HeroTrait.Might || GoWeapons.TypeOf("story_mulsae") != GoWeapons.Type.Sword) Fail("물새 표(★4 수 검 무용)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Blink || kit.Burst.Type != KitBurstType.Feast || Mathf.Abs(kit.Skill.Reach - 9f) > 0.01f) Fail("물새 한 벌(자맥질 blink·숨비소리 feast)");
            field.Refresh();
            if (!field.NpcShown("mulsae") || !field.NpcShown("parang")) Fail("23장 뒤 물새·파랑이 돔 안에 안 섬");
            _ch23 = "23장 파랑·등대 돌탑 벽/꼭대기(땅에선 안 넘어감)·등롱은 난간 판에서만(땅에서 쏘면 안 켜짐)·등대 불·반디 등대 발치→돔·파수 거신 암 2단계 방패·물새 합류(★4 수 검)·보상";
        }

        // ---- 24장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter24(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch24 = "24장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(54, 0);
            StoryState.Restore(23, 0);
            var area = AreaField.Instance;
            var sk = GoAreas.Sunken;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            if (!area.RouteShown || !area.ShrineCloudsShown || GoStory.ShrineClear) Fail("24장 첫 단계: 하늘 섬이 서고 사당 위 먹구름이 끼어 있어야");
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(field.NpcBody("hanbyeol").transform.position, GoStory.AreaPos("sunken:gate", GoStory.SandHanbyeol)) > 0.6f) Fail("한별이 모래밭에 안 섬");
            if (field.NpcShown("saebyeok")) Fail("24장 첫 단계: 새벽은 아직");
            Talk(pc, ui, "hanbyeol", "24장 한별");
            Expect(23, 1, "한별 뒤");                                                            // → 1 sail 별배
            Talk(pc, ui, "hanbyeol", "24장 별배");
            Expect(23, 2, "별배 뒤");                                                            // → 2 talk 새벽
            if (!GoStory.OnRouteTop(0, pc.transform.position) || GoStory.Flat(pc.transform.position, GoStory.RoutePos(0, GoStory.ShrineLand)) > 8f) Fail($"별배가 하늘 사당 섬에 안 닿음 {pc.transform.position}");
            field.Refresh();
            Vector3 D(string n) => field.NpcBody(n).transform.position;
            if (!field.NpcShown("saebyeok") || GoStory.Flat(D("saebyeok"), GoStory.RoutePos(0, GoStory.ShrineSaebyeok)) > 0.6f || !GoStory.OnRouteTop(0, D("saebyeok") + Vector3.up * 0.1f)) Fail("새벽이 사당 앞 섬 위에 안 섬");
            if (GoStory.Flat(D("hanbyeol"), GoStory.RoutePos(0, GoStory.ShrineHanbyeol)) > 0.6f || GoStory.Flat(D("bandi"), GoStory.RoutePos(0, GoStory.ShrineBandi)) > 0.6f) Fail("한별·반디가 사당 섬에 안 섬");
            Talk(pc, ui, "saebyeok", "24장 새벽");
            Expect(23, 3, "새벽 뒤");                                                            // → 3 kill 마당
            pc.Teleport(GoStory.RoutePos(0, new Vector2(0f, GoStory.KillNear - 15f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !GoStory.OnRouteTop(0, e.transform.position))) Fail($"사당 마당 무리 {field.Squad.Count}(섬 위여야)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(23, 4, "사당 마당 무리");                                                     // → 4 talk 새벽
            Talk(pc, ui, "saebyeok", "24장 새벽 방울");
            Expect(23, 5, "새벽 방울");                                                          // → 5 seal 별·해·달
            field.Refresh();
            if (!field.SealCenterOf(23).gameObject.activeSelf || field.SealLampOf(23, 0).Lit) Fail("바람 방울 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++) if (!GoStory.OnRouteTop(0, field.SealLampOf(23, i).transform.position + Vector3.up * 0.1f)) Fail($"바람 방울 석등 {i} 이 섬 위가 아님");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(23, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                 // 틀림(첫째는 별)
            if (StoryState.Progress != 0 || field.SealLampOf(23, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(별·해·달)");
            Pulse(L("star"), 1f);
            Pulse(L("sun"), 1f);
            Expect(23, 5, "둘 켰는데 넘어감");
            if (!area.ShrineCloudsShown) Fail("방울을 다 울리기 전에 먹구름이 걷힘");
            Pulse(L("moon"), 1f);
            Expect(23, 6, "별·해·달");                                                           // → 6 talk 새벽
            area.Refresh();
            if (area.ShrineCloudsShown || !GoStory.ShrineClear) Fail("방울을 다 울린 뒤 먹구름이 안 걷힘");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "saebyeok", "24장 끝 새벽");
            if (StoryState.Ch != 24 || GoldState.Gold != gold + 6500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("24장 끝·보상(금 6500·교본 6·비급 5·매듭 6)");
            area.Refresh();
            field.Refresh();
            if (area.ShrineCloudsShown) Fail("24장 뒤 먹구름이 다시 낌");
            if (!field.NpcShown("saebyeok") || GoStory.Flat(D("saebyeok"), GoStory.RoutePos(0, GoStory.ShrineSaebyeok)) > 0.6f) Fail("24장 뒤 새벽이 사당 앞에 안 섬");
            if (!GoStory.RoutePillarOpen(0) || !GoStory.RoutePillarOpen(1) || GoStory.RoutePillarOpen(2)) Fail("24장 뒤 등대·사당 기둥만 열려야");
            area.Refresh();
            if (!area.RoutePillarOn(0) || !area.RoutePillarOn(1) || area.RoutePillarOn(2)) Fail("24장 뒤 바람 기둥 둘이 안 섬");
            _ch24 = "24장 한별 모래밭→별배 sail(하늘 사당 섬 도착)·새벽/한별/반디 섬 위 자리·사당 마당 무리 넷(섬 위)·바람 방울 석등 별·해·달(틀리면 꺼짐, 섬 위)·먹구름 걷힘 7째부터·바람 기둥 둘 열림·보상";
        }

        // ---- 25장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter25(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch25 = "25장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(56, 0);
            StoryState.Restore(24, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string n) => field.NpcBody(n).transform.position;
            if (!area.RoutePillarOn(1) || area.RoutePillarOn(2)) Fail("25장 앞: 사당 바람 기둥은 서고 잔해 기둥은 아직");
            if (area.WreckLiveNow || GoStory.WreckLive) Fail("25장 앞인데 프로펠러가 돎");
            if (!field.NpcShown("saebyeok") || GoStory.Flat(D("saebyeok"), GoStory.RoutePos(0, GoStory.ShrineSaebyeok)) > 0.6f) Fail("새벽이 사당 앞에 안 섬");
            if (!field.NpcShown("haneul") || GoStory.Flat(D("haneul"), GoStory.RoutePos(1, GoStory.WreckHaneul)) > 0.6f || !GoStory.OnRouteTop(1, D("haneul") + Vector3.up * 0.1f)) Fail("하늬가 잔해 섬 조종실 앞에 안 섬");
            if (field.NpcShown("seeddrone")) Fail("쫓기 전인데 드론이 보임");
            Talk(pc, ui, "saebyeok", "25장 새벽");
            Expect(24, 1, "새벽 뒤");                                                            // → 1 sky 기둥 타고 잔해 섬
            StoryField.Target(out Vector3 st, out _);
            if (GoStory.Flat(st, GoStory.RoutePillarPos(1)) > 0.5f) Fail("sky 기둥이 사당 서쪽 바람 기둥이 아님");
            pc.Teleport(GoStory.RoutePos(0, new Vector2(0f, 5f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(24, 1, "사당 섬 위에서 잔해 섬 단계가 넘어감");
            pc.Teleport(GoAreas.Sunken.Center + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(24, 1, "땅에서 잔해 섬 단계가 넘어감");
            // 기둥을 실제로 — 기둥 안에서 솟는 높이가 잔해 섬 윗면 + DraftOver, 거기서 활공해 잔해 섬 가장자리 안에 닿을 수 있어야
            Vector3 pil = GoStory.RoutePillarPos(1);
            if (!PlayerController.InDraft(pil + Vector3.up * 5f) || Mathf.Abs(PlayerController.DraftTopAt(pil + Vector3.up * 5f) - (GoStory.RouteCenter(1).y + GoStory.DraftOver)) > 0.01f) Fail("사당 바람 기둥이 안 솟음");
            float reach = (GoStory.RoutePillarTop(1) - GoStory.RouteCenter(1).y) / PlayerController.GlideFallSpeed * PlayerController.GlideSpeed;
            float need = Mathf.Abs(GoStory.RouteCenter(1).x - pil.x) - (GoAreas.RouteR[1] - 1.5f);
            if (reach < need) Fail($"기둥 끝에서 활공 {reach:0.0}m 로 잔해 섬 가장자리(밖 {need:0.0}m)에 못 닿음");
            pc.Teleport(GoStory.RoutePos(1, new Vector2(0f, 8f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(24, 2, "잔해 섬 윗면");                                                       // → 2 talk 하늬
            field.Refresh();
            if (GoStory.Flat(D("bandi"), GoStory.RoutePos(1, GoStory.WreckBandi)) > 0.6f) Fail("반디가 잔해 섬에 안 섬");
            Talk(pc, ui, "haneul", "25장 하늬");
            Expect(24, 3, "하늬 뒤");                                                            // → 3 chase 드론
            field.Refresh();
            if (!field.NpcShown("seeddrone")) Fail("드론이 잔해 섬에 안 섬");
            float len = 0f;
            for (int i = 1; i < GoStory.SeedPath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("seeddrone", i - 1), GoStory.RunPoint("seeddrone", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.SeedPath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"드론 평균 {avg:0.0}m/초");
            for (int i = 0; i < GoStory.SeedPath.Length; i++)
                if (!GoStory.OnRouteTop(1, GoStory.RunPoint("seeddrone", i))) Fail($"드론 길 {i} 이 섬 밖");
            Vector3 t0 = GoStory.RunPoint("seeddrone", 0);
            Vector3 me = t0 + new Vector3(3f, 0f, 8f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 3) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(3f, 0f, 8f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 드론이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 드론을 못 잡음");
            Expect(24, 4, "드론 잡음");                                                          // → 4 talk 하늬
            Talk(pc, ui, "haneul", "25장 하늬 씨앗");
            Expect(24, 5, "하늬 씨앗");                                                          // → 5 defend 기관
            Vector3 eng = GoStory.RoutePos(1, GoStory.WreckEngine);
            pc.Teleport(eng + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(eng + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"기관 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (GoStory.Flat(e.transform.position, GoStory.RouteCenter(1)) > GoAreas.RouteR[1] - 0.5f || Mathf.Abs(e.transform.position.y - GoStory.RouteCenter(1).y) > 3f) Fail("물결이 섬 밖에서 나옴");
            if (area.WreckLiveNow) Fail("기관을 지키는 중인데 프로펠러가 돎");
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 5; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(24, 6, "기관 물결 셋");                                                       // → 6 talk 하늬
            area.Refresh();
            if (!area.WreckLiveNow || !GoStory.WreckLive) Fail("기관을 지킨 뒤 프로펠러가 안 돎");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haneul", "25장 끝 하늬");
            if (StoryState.Ch != 25 || GoldState.Gold != gold + 6750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("25장 끝·보상(금 6750·교본 6·비급 5·매듭 6)");
            area.Refresh();
            field.Refresh();
            if (!GoStory.RoutePillarOpen(2) || !area.RoutePillarOn(2)) Fail("25장 뒤 잔해 서쪽 바람 기둥이 안 섬");
            if (!field.NpcShown("haneul") || GoStory.Flat(D("haneul"), GoStory.RoutePos(1, GoStory.WreckHaneul)) > 0.6f) Fail("25장 뒤 하늬가 잔해 섬에 안 섬");
            _ch25 = "25장 사당 기둥 sky(사당 섬·땅에선 안 넘어감, 잔해 섬 윗면에서만)·기둥 솟는 높이·활공 거리·하늬/반디 잔해 섬 자리·드론 길 섬 위·평균 빠르기(걷기 못 잡고 달리기 잡음)·기관 지키기 물결 셋(섬 안, 바깥 12m)·프로펠러 7째 단계부터·잔해 기둥 열림·보상";
        }

        // ---- 26장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter26(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch26 = "26장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(58, 0);
            StoryState.Restore(25, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string n) => field.NpcBody(n).transform.position;
            if (!area.RoutePillarOn(2)) Fail("26장 앞: 잔해 서쪽 바람 기둥이 서 있어야");
            if (area.SeederOffNow(0) || area.SeederOffNow(1) || area.SeederOffNow(2)) Fail("26장 앞인데 씨앗 장치가 꺼져 있음");
            if (!field.NpcShown("haneul") || GoStory.Flat(D("haneul"), GoStory.RoutePos(1, GoStory.WreckHaneul)) > 0.6f) Fail("하늬가 잔해 섬에 안 섬");
            if (field.NpcShown("gamyeon")) Fail("가면 그림자가 처음부터 보임");
            Talk(pc, ui, "haneul", "26장 하늬");
            Expect(25, 1, "하늬 뒤");                                                            // → 1 sky 기둥 타고 정거장
            StoryField.Target(out Vector3 st, out _);
            if (GoStory.Flat(st, GoStory.RoutePillarPos(2)) > 0.5f) Fail("sky 기둥이 잔해 서쪽 바람 기둥이 아님");
            pc.Teleport(GoStory.RoutePos(1, new Vector2(0f, 8f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(25, 1, "잔해 섬 위에서 정거장 단계가 넘어감");
            Vector3 pil = GoStory.RoutePillarPos(2);
            if (!PlayerController.InDraft(pil + Vector3.up * 5f) || Mathf.Abs(PlayerController.DraftTopAt(pil + Vector3.up * 5f) - (GoStory.RouteCenter(2).y + GoStory.DraftOver)) > 0.01f) Fail("잔해 바람 기둥이 안 솟음");
            float reach = (GoStory.RoutePillarTop(2) - GoStory.RouteCenter(2).y) / PlayerController.GlideFallSpeed * PlayerController.GlideSpeed;
            float need = Mathf.Abs(GoStory.RouteCenter(2).x - pil.x) - (GoAreas.RouteR[2] - 1.5f);
            if (reach < need) Fail($"기둥 끝에서 활공 {reach:0.0}m 로 정거장 섬 가장자리(밖 {need:0.0}m)에 못 닿음");
            pc.Teleport(GoStory.RoutePos(2, new Vector2(0f, 8f)) + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(25, 2, "정거장 섬 윗면");                                                     // → 2 talk 하늬
            field.Refresh();
            if (GoStory.Flat(D("haneul"), GoStory.RoutePos(2, GoStory.OrbitHaneul)) > 0.6f || GoStory.Flat(D("bandi"), GoStory.RoutePos(2, GoStory.OrbitBandi)) > 0.6f) Fail("하늬·반디가 정거장 섬에 안 섬");
            Talk(pc, ui, "haneul", "26장 하늬 정거장");
            Expect(25, 3, "하늬 정거장");                                                        // → 3 light 남동
            var seeds = new[] { GoStory.SeedSE, GoStory.SeedN, GoStory.SeedSW };
            Vector3 SP(int k) => GoStory.RoutePos(2, seeds[k]);
            Pulse(SP(1), 1f);                                                                    // 엉뚱한 장치(북)
            Expect(25, 3, "엉뚱한 장치에 불이 붙음");
            Pulse(SP(0) + new Vector3(30f, 0f, 0f), 1f);                                          // 먼 곳
            Expect(25, 3, "먼 곳에서 장치가 꺼짐");
            for (int k = 0; k < 3; k++)
            {
                pc.Teleport(SP(k) + new Vector3(0f, 0.3f, 3f));
                if (area.SeederOffNow(k)) Fail($"장치 {k} 를 끄기 전에 꺼져 있음");
                Pulse(SP(k), 1f);
                Expect(25, 4 + k, $"장치 {k} 끔");                                                // → 4·5·6
                area.Refresh();
                for (int j = 0; j < 3; j++) if (area.SeederOffNow(j) != (j <= k)) Fail($"장치 {k} 를 끈 뒤 코어 상태 {j}");
            }
            field.Refresh();
            if (!field.NpcShown("gamyeon") || GoStory.Flat(D("gamyeon"), GoStory.RoutePos(2, GoStory.OrbitGamyeon)) > 0.6f) Fail("가면 그림자가 정거장 서쪽 끝에 안 섬");
            Talk(pc, ui, "gamyeon", "26장 가면 그림자");
            Expect(25, 7, "가면 그림자 뒤");                                                     // → 7 duel 그림자 임금
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"먹구름 임금의 그림자 {field.Squad.Count}"); return; }
            var sh = field.Squad[0];
            if (!sh.IsStoryBoss || sh.DisplayName != GoLocalization.T("story.boss.stormshadow", "먹구름 임금의 그림자") || sh.CurrentMove != FieldEnemy.BossMove.Melee) Fail($"그림자 임금 이름·첫 수 {sh.DisplayName}·{sh.Element}·{sh.CurrentMove}");
            if (!GoStory.OnRouteLayer(sh.transform.position)) Fail("그림자 임금이 섬 밖");
            sh.SetShieldForTest(0f);
            sh.TakeRaw(sh.Hp - sh.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!sh.Shielded || field.Squad.Count != 3) Fail($"2단계 뇌 방패·졸개 {sh.Element}·{field.Squad.Count}");
            foreach (var e in field.Squad) if (!GoStory.OnRouteLayer(e.transform.position)) Fail("졸개가 섬 밖");
            Kill(sh);
            Expect(25, 8, "먹구름 임금의 그림자");                                              // → 8 talk 하늬
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haneul", "26장 끝 하늬");
            if (StoryState.Ch != 26 || GoldState.Gold != gold + 7000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("26장 끝·보상(금 7000·교본 6·비급 5·매듭 6)");
            if (!PartyState.Has("story_haneul")) Fail("하늬가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_haneul", GoElement.Cryo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_haneul", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Cryo || hh.Trait != HeroTrait.Command || GoWeapons.TypeOf("story_haneul") != GoWeapons.Type.Polearm) Fail("하늬 표(★4 빙 장병기 통솔)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Shells || kit.Burst.Type != KitBurstType.Lore || kit.Skill.N != 3) Fail("하늬 한 벌(얼음 관측 풍선 shells·한파 예보 lore)");
            area.Refresh();
            field.Refresh();
            if (!area.SeederOffNow(0) || !area.SeederOffNow(1) || !area.SeederOffNow(2)) Fail("26장 뒤 씨앗 장치가 다시 켜짐");
            if (field.NpcShown("gamyeon")) Fail("26장 뒤 가면 그림자가 남음");
            if (!field.NpcShown("haneul") || GoStory.Flat(D("haneul"), GoStory.RoutePos(2, GoStory.OrbitHaneul)) > 0.6f) Fail("26장 뒤 하늬가 정거장 섬에 안 섬");
            _ch26 = "26장 잔해 기둥 sky(정거장 섬 윗면에서만·활공 거리)·하늬/반디 정거장 섬 자리·씨앗 장치 셋 차례로만(엉뚱한 곳·먼 곳은 안 꺼짐, 끈 다음 코어 꺼짐)·가면 그림자·그림자 임금 뇌 2단계 방패(섬 안)·하늬 합류(★4 빙 장병기)·보상";
        }

        // ---- 27장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter27(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch27 = "27장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(60, 0);
            StoryState.Restore(26, 0);
            var kf = KnotField.Instance;
            if (kf == null) { Fail("KnotField 없음"); return; }
            kf.Refresh();
            field.Refresh();
            Vector3 D(string n) => field.NpcBody(n).transform.position;
            for (int k = 0; k < 6; k++) if (!kf.KnotShown(k) || kf.FireShown(k)) Fail($"27장 앞: 매듭 {k} 이 풀린 채 보여야");
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), GoStory.GridPos(4.5f, 0.5f)) > 0.6f) Fail("8부 반디가 마을에 안 섬");
            if (field.NpcShown("wanderer") || field.NpcShown("haesol")) Fail("27장 첫 단계: 나그네·해솔은 아직");
            Talk(pc, ui, "elder", "27장 촌장");
            Expect(26, 1, "촌장 뒤");                                                            // → 1 talk 은비
            Talk(pc, ui, "scholar", "27장 은비");
            Expect(26, 2, "은비 뒤");                                                            // → 2 kill 첫째 매듭 졸개
            Vector3 alt = GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy);
            pc.Teleport(alt + new Vector3(0f, 0.4f, GoStory.KillNear + 20f));
            field.Check(pc.transform.position);
            Expect(26, 2, "멀리서 졸개 단계가 넘어감");
            pc.Teleport(alt + new Vector3(0f, 0.4f, 6f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) { Fail($"첫째 매듭 졸개 {field.Squad.Count}"); return; }
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(26, 3, "첫째 매듭 졸개");                                                     // → 3 light 첫째 매듭
            Pulse(alt + new Vector3(40f, 0f, 0f), 1f);                                           // 먼 곳
            Expect(26, 3, "먼 곳에서 첫째 매듭에 불이 붙음");
            kf.Refresh();
            if (kf.FireShown(0)) Fail("불을 붙이기 전에 첫째 매듭이 묶임");
            Pulse(alt, 2f);
            Expect(26, 4, "첫째 매듭 불");                                                       // → 4 seal 둘째 매듭 석등
            kf.Refresh();
            if (!kf.FireShown(0) || kf.SmokeShown(0) || kf.BeamNow(0) != 1) Fail("첫째 매듭 불 뒤 묶임·금빛 줄");
            for (int k = 1; k < 6; k++) if (kf.FireShown(k)) Fail($"첫째 매듭만 묶여야 — 매듭 {k}");
            field.Refresh();
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(26, Lamp(id)).transform.position;
            if (!field.SealCenterOf(26).gameObject.activeSelf || field.SealLampOf(26, 0).Lit) Fail("둘째 매듭 석등이 꺼진 채 안 섬");
            Pulse(L("sun"), 1f);                                                                 // 틀림(첫째는 달)
            if (StoryState.Progress != 0 || field.SealLampOf(26, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(달·별·해)");
            Pulse(L("moon"), 1f);
            Pulse(L("star"), 1f);
            Expect(26, 4, "둘 켰는데 넘어감");
            Pulse(L("sun"), 1f);
            Expect(26, 5, "달·별·해");                                                           // → 5 talk 나그네
            kf.Refresh();
            if (!kf.FireShown(1) || kf.BeamNow(1) != 1 || kf.FireShown(2)) Fail("둘째 매듭 석등 뒤 묶임");
            field.Refresh();
            if (!field.NpcShown("wanderer") || GoStory.Flat(D("wanderer"), GoStory.GridPos(GoStory.Altar2Gx + 7f / 48f, GoStory.Altar2Gy + 5f / 48f)) > 0.6f) Fail("나그네가 둘째 매듭 곁에 안 섬");
            Talk(pc, ui, "wanderer", "27장 나그네");
            Expect(26, 6, "나그네 뒤");                                                          // → 6 climb 봉우리
            var peak = GoStory.DuelPeak;
            pc.Teleport(GoStory.ArenaPos(GoStory.ArenaDuel) + Vector3.up * 0.5f);
            field.Check(pc.transform.position);
            Expect(26, 6, "고원만 올랐는데 넘어감");
            pc.Teleport(GoWorldMap.PeakArrival(peak));
            field.Check(pc.transform.position);
            Expect(26, 7, "봉우리 꼭대기");                                                      // → 7 light 셋째 매듭
            Vector3 palt = GoStory.ArenaPos(GoStory.ArenaAltar);
            Pulse(palt + new Vector3(40f, 0f, 0f), 1f);
            Expect(26, 7, "먼 곳에서 셋째 매듭에 불이 붙음");
            Pulse(palt, 2f);
            Expect(26, 8, "셋째 매듭 불");                                                       // → 8 talk 해솔
            kf.Refresh();
            if (!kf.FireShown(2) || kf.BeamNow(2) != 1 || kf.FireShown(3) || kf.FireShown(4) || kf.FireShown(5)) Fail("셋째 매듭 뒤: 앞 셋만 묶여야");
            field.Refresh();
            if (!field.NpcShown("haesol") || GoStory.Flat(D("haesol"), GoStory.ArenaPos(new Vector2(-14f, -12f))) > 0.6f) Fail("해솔이 봉우리 셋째 매듭 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haesol", "27장 끝 해솔");
            if (StoryState.Ch != 27 || GoldState.Gold != gold + 7250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("27장 끝·보상(금 7250·교본 6·비급 5·매듭 7)");
            kf.Refresh();
            if (!kf.FireShown(0) || !kf.FireShown(1) || !kf.FireShown(2) || kf.FireShown(3)) Fail("27장 끝: 매듭 셋만 묶여 있어야");
            _ch27 = "27장 반디 마을·촌장→은비→첫째 매듭 졸개 넷(먼 곳 ✕)→첫째 매듭 불(먼 곳 ✕, 묶임·금빛 줄)→둘째 매듭 석등 달·별·해(틀리면 꺼짐, 묶임)→나그네 둘째 매듭 곁→봉우리 오르기(고원만 ✕)→셋째 매듭 불(먼 곳 ✕)→해솔 봉우리→보상(🪢 7)·매듭 셋 묶임";
        }

        // ---- 28장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter28(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch28 = "28장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(62, 0);
            StoryState.Restore(27, 0);
            var kf = KnotField.Instance;
            if (kf == null) { Fail("KnotField 없음"); return; }
            kf.Refresh();
            field.Refresh();
            Vector3 D(string n) => field.NpcBody(n).transform.position;
            Vector3 cape = GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy);
            if (!kf.FireShown(0) || !kf.FireShown(1) || !kf.FireShown(2) || kf.FireShown(3) || kf.FireShown(4) || kf.FireShown(5)) Fail("28장 앞: 매듭 셋만 묶여 있어야");
            if (!field.NpcShown("ferryman") || GoStory.Flat(D("ferryman"), GoStory.GridPos(GoStory.CapeGx - 6f / 48f, GoStory.CapeGy - 6f / 48f)) > 0.6f) Fail("사공이 곶에 안 섬");
            Talk(pc, ui, "ferryman", "28장 버들");
            Expect(27, 1, "버들 뒤");                                                            // → 1 defend 곶
            field.Refresh();
            var altar = field.AltarOf(27);
            if (altar == null || !altar.gameObject.activeSelf || altar.Lit) Fail("지키기 동안 넷째 매듭 제단 몸이 없다");
            pc.Teleport(cape + new Vector3(0f, 0.4f, -GoStory.DefendStart - 10f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(cape + new Vector3(0f, 0.4f, -4f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"곶 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 1; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(27, 2, "곶 물결 셋");                                                         // → 2 light 넷째 매듭
            Pulse(cape + new Vector3(40f, 0f, 0f), 1f);
            Expect(27, 2, "먼 곳에서 넷째 매듭에 불이 붙음");
            Pulse(cape, 2f);
            Expect(27, 3, "넷째 매듭 불");                                                       // → 3 sail 바위섬
            kf.Refresh();
            if (!kf.FireShown(3) || kf.BeamNow(3) != 1 || kf.FireShown(4)) Fail("넷째 매듭 불 뒤 묶임");
            field.Refresh();
            Talk(pc, ui, "ferryman", "28장 배");
            Expect(27, 4, "배 뒤");                                                              // → 4 seal 바위섬
            if (!GoStory.OnIsle(pc.transform.position)) Fail($"배가 바위섬에 안 닿음 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(D("ferryman"), GoStory.IslePos(GoStory.IsleFerry)) > 0.6f) Fail("사공이 섬 북쪽에 안 섬");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(27, Lamp(id)).transform.position;
            if (!field.SealCenterOf(27).gameObject.activeSelf || field.SealLampOf(27, 0).Lit) Fail("다섯째 매듭 석등이 꺼진 채 안 섬");
            Pulse(L("star"), 1f);                                                                // 틀림(첫째는 해)
            if (StoryState.Progress != 0 || field.SealLampOf(27, Lamp("star")).Lit) Fail("차례 틀린 별이 켜짐(해·별·달)");
            Pulse(L("sun"), 1f);
            Pulse(L("star"), 1f);
            Expect(27, 4, "둘 켰는데 넘어감");
            Pulse(L("moon"), 1f);
            Expect(27, 5, "해·별·달");                                                           // → 5 sky 구름섬
            kf.Refresh();
            if (!kf.FireShown(4) || kf.BeamNow(4) != 1 || kf.FireShown(5)) Fail("다섯째 매듭 석등 뒤 묶임");
            StoryField.Target(out Vector3 st, out _);
            if (GoStory.Flat(st, GoStory.DuelPeak.Top) > 0.5f) Fail("sky 화살표가 봉우리 바람 기둥이 아님");
            pc.Teleport(GoStory.GridPos(3f, 3f) + Vector3.up * 0.4f);
            field.Check(pc.transform.position);
            Expect(27, 5, "땅에서 구름섬 단계가 넘어감");
            pc.Teleport(GoStory.SkyCenter + Vector3.up * 0.3f);
            field.Check(pc.transform.position);
            Expect(27, 6, "구름섬 윗면");                                                        // → 6 kill 구름섬 무리
            Vector3 sq = GoStory.SkyPos(GoStory.SkySquad);
            pc.Teleport(sq + new Vector3(0f, 0.3f, 3f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 5 || field.Squad.Any(e => !GoStory.OnSkyLayer(e.transform.position))) Fail($"구름섬 무리 {field.Squad.Count}(섬 위여야)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(27, 7, "구름섬 무리");                                                        // → 7 light 여섯째 매듭
            Pulse(GoStory.SkyPos(Vector2.zero) + new Vector3(40f, 0f, 0f), 1f);
            Expect(27, 7, "먼 곳에서 여섯째 매듭에 불이 붙음");
            Pulse(GoStory.SkyPos(Vector2.zero), 2f);
            Expect(27, 8, "여섯째 매듭 불");                                                     // → 8 talk 가면 그림자
            kf.Refresh();
            for (int j = 0; j < 6; j++) if (!kf.FireShown(j) || kf.BeamNow(j) != 2) Fail($"여섯 다 묶인 뒤 매듭 {j} 줄이 눈 등불로 안 감 ({kf.BeamNow(j)})");
            if (!kf.LanternGold) Fail("여섯 다 묶였는데 눈 등불이 안 금빛");
            if (kf.EyeShown) Fail("28장 끝나기 전인데 눈이 섬");
            field.Refresh();
            if (!field.NpcShown("gamyeon") || GoStory.Flat(D("gamyeon"), GoStory.SkyPos(new Vector2(7f, -7f))) > 0.6f) Fail("가면 그림자가 구름섬 북동쪽에 안 섬");
            Talk(pc, ui, "gamyeon", "28장 가면 그림자");
            Expect(27, 9, "가면 그림자 뒤");                                                     // → 9 talk 나그네
            field.Refresh();
            if (field.NpcShown("gamyeon") || !field.NpcShown("wanderer") || GoStory.Flat(D("wanderer"), GoStory.SkyPos(GoStory.SkyWanderer)) > 0.6f) Fail("나그네가 구름섬에 안 섬(그림자는 사라짐)");
            kf.Refresh();
            if (!kf.EyeShown) Fail("28장 9째 단계부터 먹구름 눈이 서야");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "wanderer", "28장 끝 나그네");
            if (StoryState.Ch != 28 || GoldState.Gold != gold + 7500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("28장 끝·보상(금 7500·교본 6·비급 5·매듭 7)");
            kf.Refresh();
            if (!kf.EyeShown || !kf.PillarOn || kf.BeamNow(0) != 2) Fail("28장 뒤 먹구름 눈·눈 바람 기둥이 서고 줄은 눈으로");
            _ch28 = "28장 사공 곶→바위섬·곶 지키기 물결 셋→넷째 매듭 불(먼 곳 ✕, 묶임)→배 sail 바위섬→석등 해·별·달(틀리면 꺼짐, 묶임)→구름섬(땅 ✕)→구름섬 무리 다섯(섬 위)→여섯째 매듭 불→여섯 줄이 눈 등불로→가면 그림자→나그네→보상(🪢 7)·먹구름 눈/기둥 섬";
        }
    }
}
