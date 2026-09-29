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
    /// <summary>
    /// PLAN.md 109-14-12·13 "이야기 임무 1~4장"(웹 사가고 ⑲-12·13 진단 항목 — 표·자리·흐름·화면) — `PlaytestHeadless` 가 고유 스킬 진단 뒤에 부른다.
    /// 표(인물 넷·1장 8·2장 4·3장 9·4장 8단계·여정 등급·보상) · 자리(걷는 칸·지역·들판 무리/숨은 터와 떨어짐) · 몸 셋·가면 ·
    /// 1장(대화 창·고르는 줄·go·수호장·임무 적 넷(경험 없음·다시 안 섬)·옛 제단 원소 신호·장 끝 보상) · 2장 잠김(여정 5)·제단·주간 보스 ·
    /// 3장(청하란 셋 — 다른 채집물 안 셈·요리·불도깨비 우두머리(몸 ×1.8·체력 ×6)·잠든 무덤만·잔치 마당) · 4장(나그네가 둘째 단계부터 섬·따라가기 멀면 섬·
    /// 가까우면 걷고 길 끝에서 넘김·가면 졸개 빙·암) · 글 흘러나옴(한 번 = 줄 전체)·고른 대답 한 줄·대화 카메라 ·
    /// boss 이미 쓰러짐이면 넘김 · 혼잣말 · 대화 중 `Talking` · 세이브 v28 왕복·v27 로드(1장 처음).
    /// 109-14-19 8장: 섬(강 칸 가운데·석등·무리·인물 자리가 섬 위)·도둑 길(걷는 칸·평균 빠르기가 걷기와 달리기 사이) · 멀면 안 달아남 ·
    /// 걸어서 쫓으면 놓치고 처음 자리 · 달리면 잡음 · 배(대화 뒤 섬 북쪽·돌아오는 배는 나루) · 섬 무리는 섬 안에서만 · 별·달·해 석등 · 해솔 금 간 가면.
    /// 109-14-20 9장: 덮개·기둥(9장이 열려야) · 몸(땅에선 안 뜸·점프하면 저절로 활공·기력 안 쓰고 기둥 끝까지·접으면 안 폄·섬에 내림) · 난간 높이 ·
    /// 층(섬 위에선 땅 적이 못 쫓음) · 섬 무리 난간 안 · 먹구름 가면 해솔 · 가면 벗은 해솔 이름 · 먹구름 임금(×2·왕관·고리 안쪽 빔) · 해솔 합류.
    /// 옛 진단은 `StoryState.OffForTest` 로 돌고 여기서만 켠다. 끝나면 진행·수호장·돈·레벨·재료·요리·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoStory
    {
        private static string _tag;
        private static string _ch8 = "", _ch9 = "", _ch10 = "", _ch11 = "", _ch12 = "", _ch13 = "", _ch14 = "", _ch15 = "", _ch16 = "", _ch17 = "", _ch18 = "", _ch19 = "", _ch20 = "", _ch21 = "", _ch22 = "", _ch23 = "", _ch24 = "", _ch25 = "", _ch26 = "", _ch27 = "", _ch28 = "", _ch29 = "", _ch30 = "", _ch31 = "", _ch32 = "", _ch33 = "", _ch34 = "", _ch35 = "", _ch36 = "", _ch37 = "", _ch38 = "", _ch39 = "", _ch40 = "", _ch41 = "";
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = StoryField.Instance;
            var ui = StoryUi.Instance;
            var g = FieldEnemy.GuardianInstance;
            if (fc == null || pc == null || field == null || ui == null || g == null) { Fail("FieldCombat/PlayerController/StoryField/StoryUi/수호장 없음"); return false; }

            bool off0 = StoryState.OffForTest;
            var members0 = new System.Collections.Generic.List<string>(PartyState.MemberIds); // 109-14-15 장 끝 합류가 동행을 바꾼다
            float cps0 = StoryUi.RevealCps;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool d0 = GuardianState.Defeated, b0 = GuardianState.Bloom;
            long p0 = GuardianState.PaidAt;
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var tal0 = TalentState.Snapshot();
            var mats0 = TalentState.SnapshotMats();
            var bag0 = CookState.SnapshotBag();
            var prof0 = CookState.SnapshotProf();
            var gat0 = CookState.SnapshotGather();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                StoryState.OffForTest = false;
                StoryUi.RevealCps = 0f;
                CookState.NowForTest = 2_000_000_000;
                StoryState.Restore(0, 0);
                field.ResetForTest();
                CheckTable();
                CheckPlaces(field);
                CheckChapter1(fc, pc, field, ui, g);
                CheckChapter2(pc, field, ui);
                CheckChapter3(pc, field, ui);
                CheckChapter4(pc, field, ui);
                CheckChapter5(pc, field, ui);
                CheckChapter6(fc, pc, field, ui);
                CheckChapter7(pc, field, ui);
                CheckChapter8(pc, field, ui);
                CheckChapter9(fc, pc, field, ui);
                CheckChapter10(fc, pc, field, ui);
                CheckChapter11(fc, pc, field, ui);
                CheckChapter12(fc, pc, field, ui);
                CheckChapter13(fc, pc, field, ui);
                CheckChapter14(fc, pc, field, ui);
                CheckChapter15(fc, pc, field, ui);
                CheckChapter16(fc, pc, field, ui);
                CheckChapter17(fc, pc, field, ui);
                CheckChapter18(fc, pc, field, ui);
                CheckChapter19(fc, pc, field, ui);
                CheckChapter20(fc, pc, field, ui);
                CheckChapter21(fc, pc, field, ui);
                CheckChapter22(fc, pc, field, ui);
                CheckChapter23(fc, pc, field, ui);
                CheckChapter24(fc, pc, field, ui);
                CheckChapter25(fc, pc, field, ui);
                CheckChapter26(fc, pc, field, ui);
                CheckChapter27(fc, pc, field, ui);
                CheckChapter28(fc, pc, field, ui);
                CheckChapter29(fc, pc, field, ui);
                CheckChapter30(fc, pc, field, ui);
                CheckChapter31(fc, pc, field, ui);
                CheckChapter32(fc, pc, field, ui);
                CheckChapter33(fc, pc, field, ui);
                CheckChapter34(fc, pc, field, ui);
                CheckChapter35(fc, pc, field, ui);
                CheckChapter36(fc, pc, field, ui);
                CheckChapter37(fc, pc, field, ui);
                CheckChapter38(fc, pc, field, ui);
                CheckChapter39(fc, pc, field, ui);
                CheckChapter40(fc, pc, field, ui);
                CheckChapter41(fc, pc, field, ui);
                CheckReveal(pc, ui);
                CheckBossAlreadyDown(field);
                CheckIdle(pc, field);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                ui.ResetForTest();
                StoryUi.RevealCps = cps0;
                CookState.NowForTest = -1;
                CookState.Restore(bag0, prof0, gat0);
                StoryState.Restore(ch0, st0);
                ObsField.Instance?.Refresh();
                FrostField.Instance?.TickShip(100f);
                AreaField.Instance?.Refresh();
                StoryState.OffForTest = off0;
                field.ResetForTest();
                ui.ResetForTest();
                GuardianState.Restore(d0, b0, p0);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                TalentState.Restore(tal0, mats0);
                PartyState.Restore(members0);
                fc.RebuildParty();
                if (!GuardianState.Standing && g.gameObject.activeSelf && g.Alive) g.gameObject.SetActive(false);
                GuardianBloom.Instance?.Refresh();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log("[" + _tag + "] story OK - " + _ch8 + " · " + _ch9 + " · " + _ch10 + " · " + _ch11 + " · " + _ch12 + " · " + _ch13 + " · " + _ch14 + " · " + _ch15 + " · " + _ch16 + " · " + _ch17 + " · " + _ch18 + " · " + _ch19 + " · " + _ch20 + " · " + _ch21 + " · " + _ch22 + " · " + _ch23 + " · " + _ch24 + " · " + _ch25 + " · " + _ch26 + " · " + _ch27 + " · " + _ch28 + " · " + _ch29 + " · " + _ch30 + " · " + _ch31 + " · " + _ch32 + " · " + _ch33 + " · " + _ch34 + " · " + _ch35 + " · " + _ch36 + " · " + _ch37 + " · " + _ch38 + " · " + _ch39 + " · " + _ch40 + " · " + _ch41 + " · 인물 여섯·1~4장 · 자리·몸·가면 · 1장 대화·go·수호장·임무 적·옛 제단 · 2장 잠김·주간 보스 · 3장 청하란·요리·우두머리·무덤·잔치 마당 · 4장 나그네·따라가기·가면 졸개 · 글 흘러나옴·고른 대답·대화 카메라 · 이미 쓰러진 수호장 · 혼잣말 · 세이브 v28 왕복·v27 로드");
            return _ok;
        }

        // ---- 표 -----------------------------------------------------------------------------------------------

        private static char Letter(GoStory.StepType t) => t switch
        {
            GoStory.StepType.Talk => 'T', GoStory.StepType.Go => 'G', GoStory.StepType.Boss => 'B', GoStory.StepType.Kill => 'K',
            GoStory.StepType.Light => 'L', GoStory.StepType.Domain => 'D', GoStory.StepType.Gather => 'H', GoStory.StepType.Cook => 'C',
            GoStory.StepType.Seal => 'S', GoStory.StepType.Climb => 'M', GoStory.StepType.Duel => 'X', GoStory.StepType.Defend => 'E',
            GoStory.StepType.Chase => 'R', GoStory.StepType.Sail => 'V', GoStory.StepType.Sky => 'Y', GoStory.StepType.Party => 'P', _ => 'F',
        };

        private static void CheckTable()
        {
            if (GoStory.Npcs.Length != 43 || GoStory.Chapters.Length != 41) { Fail($"인물 {GoStory.Npcs.Length}·장 {GoStory.Chapters.Length}"); return; }
            string Types(GoStory.Chapter c) { var s = ""; foreach (var st in c.Steps) s += Letter(st.Type); return s; }
            string[] want = { "TGBTKTLT", "TGDT", "THCTKTDKT", "TTFTKTTT", "TGKTSKTTT", "TMTXTLTT", "TTGTEXTLTT", "TTRTVKTSTTVT", "TMTYKXTXTTGT", "TGGKTFTGT", "TGTSKTETT", "TTGKXTLTT", "TGTKTMTET", "TGTKTSTYKT", "TGTRTKXTGLT", "TGTKTMTET", "TGTKTXTTLT", "TGTKLTRTET", "TVTKMTMTXT", "TVTKTSTETXT", "TVTKGTVT", "TTHTSTETXT", "TMLTTXT", "TVTKTST", "TYTRTET", "TYTLLLTXT", "TTKLSTMLT", "TELVSYKLTT", "TPYTEXTGT", "TGKTLLLT", "TSTRTET", "TMLTXT", "TTGKRT", "TSTELLT", "TGTMTXT", "TVTKFT", "TLTELMLT", "TXTXTGT", "TTTKT", "TGETT", "TTGXTT" };
            int[] ar = { 1, 5, 7, 10, 12, 15, 18, 20, 25, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 83, 84, 85 }, gold = { 500, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000, 5250, 5500, 5750, 6000, 6250, 6500, 6750, 7000, 7250, 7500, 12000, 7750, 8000, 9000, 8500, 8750, 9750, 9000, 9250, 12000, 9500, 10250, 12500 };
            int[][] mats = { new[] { 0, 2, 0, 2, 0 }, new[] { 0, 0, 1, 3, 0 }, new[] { 0, 2, 1, 3, 0 }, new[] { 0, 2, 2, 3, 0 }, new[] { 0, 3, 2, 3, 0 }, new[] { 0, 3, 2, 4, 0 }, new[] { 0, 3, 2, 4, 0 }, new[] { 0, 3, 3, 4, 0 }, new[] { 0, 3, 4, 5, 0 }, new[] { 0, 3, 4, 5, 0 }, new[] { 0, 3, 4, 5, 0 }, new[] { 0, 4, 5, 6, 0 }, new[] { 0, 4, 5, 6, 0 }, new[] { 0, 4, 5, 6, 0 }, new[] { 0, 5, 5, 6, 0 }, new[] { 0, 5, 5, 6, 0 }, new[] { 0, 5, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 6, 0 }, new[] { 0, 6, 5, 7, 0 }, new[] { 0, 6, 5, 7, 0 }, new[] { 0, 10, 8, 10, 0 }, new[] { 0, 7, 6, 7, 0 }, new[] { 0, 7, 6, 7, 0 }, new[] { 0, 8, 7, 8, 0 }, new[] { 0, 8, 6, 8, 0 }, new[] { 0, 8, 6, 8, 0 }, new[] { 0, 9, 7, 9, 0 }, new[] { 0, 9, 6, 9, 0 }, new[] { 0, 9, 6, 9, 0 }, new[] { 0, 10, 8, 10, 0 } , new[] { 0, 6, 6, 6, 0 }, new[] { 0, 7, 6, 7, 0 }, new[] { 0, 10, 8, 10, 0 }};
            for (int c = 0; c < 41; c++)
            {
                var ch = GoStory.Chapters[c];
                if (Types(ch) != want[c]) Fail($"{c + 1}장 단계 {Types(ch)}");
                if (ch.Ar != ar[c] || ch.Gold != gold[c]) Fail($"{c + 1}장 여정·금");
                for (int i = 0; i < 5; i++) if (ch.Mats[i] != mats[c][i]) Fail($"{c + 1}장 재료 {i}");
            }
            foreach (var c in GoStory.Chapters)
                foreach (var st in c.Steps)
                {
                    bool talky = st.Type == GoStory.StepType.Talk || st.Type == GoStory.StepType.Sail;
                    if ((talky || st.Type == GoStory.StepType.Follow || st.Type == GoStory.StepType.Chase) && GoStory.NpcIndex(st.Npc) < 0) Fail("인물 없는 단계 " + st.TextKo);
                    if (talky && (st.Lines == null || st.Lines.Length == 0)) Fail("대화 줄 없음 " + st.TextKo);
                    if (talky)
                        foreach (var l in st.Lines)
                            if (l.IsPick ? l.PickKo.Length != 2 : GoStory.NpcIndex(l.Who) < 0) Fail("대화 줄 " + st.TextKo);
                    if (st.Type == GoStory.StepType.Kill && (st.Foes == null || st.Foes.Length == 0)) Fail("임무 적 없음 " + st.TextKo);
                    if (st.Type == GoStory.StepType.Domain && st.Site != null && GoStory.SitePos(st.Site) == Vector3.zero) Fail("없는 숨은 터 " + st.Site);
                }
        }

        // ---- 자리 ---------------------------------------------------------------------------------------------

        private static bool Walkable(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char t = TestMapData.TileAt(gx, gy);
            return TestMapData.Legend.TryGetValue(t, out var info) && info.Walkable && (!TestMapData.IsWater(t) || t == 'B');
        }

        private static void CheckPlaces(StoryField field)
        {
            var wander = GoStory.NpcOf("wanderer");
            var spots = new (string name, Vector3 pos, string region)[]
            {
                ("누리", GoStory.NpcPos("elder"), "village"),
                ("버들", GoStory.NpcPos("ferryman"), "village"),
                ("은비", GoStory.NpcPos("scholar"), "north_foot"),
                ("망루 발치", GoStory.GridPos(GoStory.TowerFootGx, GoStory.TowerFootGy), "south_glade"),
                ("임무 적", GoStory.GridPos(GoStory.SquadGx, GoStory.SquadGy), "north_foot"),
                ("옛 제단", GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy), "north_foot"),
                ("우두머리", GoStory.GridPos(GoStory.ChiefGx, GoStory.ChiefGy), "farmland"),
                ("잔치 마당", GoStory.GridPos(GoStory.FeastGx, GoStory.FeastGy), "village"),
                ("가면 졸개", GoStory.GridPos(GoStory.MaskSquadGx, GoStory.MaskSquadGy), "south_glade"),
                ("나그네 다리목", GoStory.GridPos(GoStory.WanderGx, GoStory.WanderGy), "village"),
                ("나그네 길 끝", GoStory.PathPos(wander, float.MaxValue), "south_glade"),
                ("옛길", GoStory.GridPos(GoStory.RoadGx, GoStory.RoadGy), "west_wood"),
                ("옛길 어귀", GoStory.GridPos(GoStory.RoadGoGx, GoStory.RoadGoGy), "west_wood"),
                ("옛길 졸개", GoStory.GridPos(GoStory.RoadSquadGx, GoStory.RoadSquadGy), "west_wood"),
                ("둘째 제단", GoStory.GridPos(GoStory.Altar2Gx, GoStory.Altar2Gy), "west_wood"),
                ("제단 졸개", GoStory.GridPos(GoStory.Altar2SquadGx, GoStory.Altar2SquadGy), "west_wood"),
                ("은비 둘째 제단", GoStory.NpcPosAt("scholar", 4, 4, 0f), "west_wood"),
                ("나그네 둘째 제단", GoStory.NpcPosAt("wanderer", 4, 6, 0f), "west_wood"),
            };
            for (int i = 0; i < 3; i++)
                if (!Walkable(GoStory.SealLampPos(GoStory.GridPos(GoStory.Altar2Gx, GoStory.Altar2Gy), i))) Fail($"석등 {GoStory.SealLayout[i]} 자리가 걷는 칸이 아니다");
            // 6장 봉우리 — 안쪽 산 칸에 봉우리가 있고, 고원 위 자리는 제 칸 안(가장자리 3m 안쪽)·봉우리 밑동 밖
            if (GoWorldMap.PeakIndex($"peak_{GoStory.DuelPeakGx}_{GoStory.DuelPeakGy}") < 0 || TestMapData.IsBorder(GoStory.DuelPeakGx, GoStory.DuelPeakGy)) Fail("6장 봉우리가 없다");
            Vector3 cell = TestMapData.WorldPos(GoStory.DuelPeakGx, GoStory.DuelPeakGy), pb = TestMapData.PeakBase(GoStory.DuelPeakGx, GoStory.DuelPeakGy);
            foreach (var off in new[] { GoStory.ArenaDuel, GoStory.ArenaWanderer, GoStory.ArenaScholar, GoStory.ArenaAltar })
            {
                Vector3 p = GoStory.ArenaPos(off);
                if (Mathf.Abs(p.x - cell.x) > TestMapData.TileSize * 0.5f - 3f || Mathf.Abs(p.z - cell.z) > TestMapData.TileSize * 0.5f - 3f) Fail($"고원 자리 {off} 가 칸 가장자리");
                if (GoStory.Flat(p, pb) < TestMapData.PeakBaseRadius + 3f) Fail($"고원 자리 {off} 가 봉우리 밑동 곁 {GoStory.Flat(p, pb):0.0}m");
            }
            foreach (var s in spots)
            {
                if (!Walkable(s.pos)) Fail(s.name + " 자리가 걷는 칸이 아니다");
                if (GoWorldMap.RegionAt(s.pos) != s.region) Fail($"{s.name} 지역 {GoWorldMap.RegionAt(s.pos)} ≠ {s.region}");
            }
            for (float d = 0f; d < GoStory.PathLength(wander); d += 4f) if (!Walkable(GoStory.PathPos(wander, d))) Fail($"나그네 길 {d:0}m 가 못 걷는 칸");
            // 109-14-19 섬 — 강 칸 한가운데(둘레 3m 까지 물), 석등·무리·인물·배 닿는 곳이 섬 위 · 나루는 뭍 · 도둑 길은 걷는 칸
            Vector3 isle = GoStory.IslePos(Vector2.zero);
            for (int k = 0; k < 8; k++)
            {
                float a = k * Mathf.PI / 4f;
                if (!TestMapData.IsWater(TestMapData.TileAt(TestMapData.WorldToGrid(isle + new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * (GoStory.IsleR + 3f)).gx,
                    TestMapData.WorldToGrid(isle + new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * (GoStory.IsleR + 3f)).gy))) Fail("섬 둘레가 물이 아니다");
            }
            for (int i = 0; i < 3; i++) if (!GoStory.OnIsle(GoStory.SealLampPos(isle, i))) Fail("섬 석등이 섬 밖");
            foreach (var off in new[] { GoStory.IsleLand, GoStory.IsleFerry, GoStory.IsleWanderer, GoStory.IsleHaesol, GoStory.IsleSquad })
                if (!GoStory.OnIsle(GoStory.IslePos(off))) Fail($"섬 자리 {off} 가 섬 밖");
            if (!GoStory.OnIsle(GoStory.IslePos(GoStory.IsleSquad) + new Vector3(GoStory.KillSpread, 0f, 0f))) Fail("섬 무리 둘레가 섬 밖");
            if (!Walkable(GoStory.GridPos(GoStory.DockGx, GoStory.DockGy))) Fail("나루가 뭍이 아니다");
            for (int i = 0; i < GoStory.ThiefPath.Length; i++) if (!Walkable(GoStory.ThiefPoint(i))) Fail($"도둑 길 {i} 가 못 걷는 칸");
            var isleBody = field.Isle;
            if (isleBody == null || isleBody.GetComponentInChildren<MeshCollider>() == null) Fail("바위섬 몸·충돌체가 없다");
            else if (Mathf.Abs(FolkWalker.Grounded(isle + Vector3.up * 2f).y - isle.y) > 0.3f) Fail($"섬 윗면 {FolkWalker.Grounded(isle + Vector3.up * 2f).y:0.00} ≠ {isle.y:0.00}");
            // 임무 적·제단은 들판 무리(끈 45m 안에 섞이면 싸움이 뒤엉킨다)·숨은 터 입구 카드(11m)에서 떨어져
            var squads = new[] { (GoStory.SquadGx, GoStory.SquadGy), (GoStory.ChiefGx, GoStory.ChiefGy), (GoStory.FeastGx, GoStory.FeastGy), (GoStory.MaskSquadGx, GoStory.MaskSquadGy),
                (GoStory.RoadSquadGx, GoStory.RoadSquadGy), (GoStory.Altar2SquadGx, GoStory.Altar2SquadGy), (GoStory.CapeGx, GoStory.CapeGy) };
            // 7장 곶 — 제단·물결 다섯 방향이 걷는 뭍(강 칸이 아니다)
            Vector3 cape = GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy);
            if (!Walkable(cape) || !Walkable(GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy - 12f / 48f))) Fail("곶 제단·결투 자리가 뭍이 아니다");
            for (int i = 0; i < GoStory.CapeDirs.Length; i++)
                if (!Walkable(GoStory.DefendSlot(cape, GoStory.CapeDirs, 0, i))) Fail($"물결 자리 {GoStory.CapeDirs[i]}° 가 뭍이 아니다");
            foreach (var (x, y) in squads)
            {
                Vector3 sq = GoStory.GridPos(x, y);
                foreach (var c in FieldSpawner.GroupCenters()) if (GoStory.Flat(sq, c) < 35f) Fail($"임무 적({x},{y})이 들판 무리 곁 {GoStory.Flat(sq, c):0}m");
                foreach (var s in GoDomain.Sites) if (GoStory.Flat(sq, s.Pos) < 20f) Fail($"임무 적({x},{y})이 숨은 터 입구 곁 " + s.Id);
            }
            foreach (var s in GoDomain.Sites)
                if (GoStory.Flat(GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy), s.Pos) < 20f) Fail("옛 제단이 숨은 터 입구 곁 " + s.Id);
            foreach (var id in new[] { "ferryman", "scholar" })
            {
                var body = field.NpcBody(id);
                if (body == null || !body.activeInHierarchy || body.GetComponentsInChildren<Renderer>().Length == 0) Fail(id + " 몸이 없다");
                else if (GoStory.Flat(body.transform.position, GoStory.NpcPos(id)) > 0.5f) Fail(id + " 몸 자리");
            }
            var w = field.NpcBody("wanderer");
            if (w == null || FindDeep(w.transform, "Mask") == null) Fail("나그네 몸·가면이 없다");
            if (field.NpcShown("wanderer")) Fail("1장인데 나그네가 섰다");
        }

        private static Transform FindDeep(Transform t, string name)
        {
            if (t.name == name) return t;
            for (int i = 0; i < t.childCount; i++) { var r = FindDeep(t.GetChild(i), name); if (r != null) return r; }
            return null;
        }

        // ---- 공통 ---------------------------------------------------------------------------------------------

        private static void Near(PlayerController pc, Vector3 p, float dx = 2f) => pc.Teleport(p + new Vector3(dx, 0.4f, 0f));

        /// <summary>곁에서 대화를 열고 끝까지(고르는 줄은 둘째 대답 → "나"의 줄) — 단계가 하나 넘어가야 한다.</summary>
        private static void Talk(PlayerController pc, StoryUi ui, string npc, string label)
        {
            int ch = StoryState.Ch, step = StoryState.StepIndex;
            pc.Teleport(GoStory.NpcPos(npc) + new Vector3(0f, 0.4f, 30f));
            ui.Refresh();
            if (ui.TalkShown || ui.StartTalk()) Fail(label + " — 멀리서 대화가 열림");
            Near(pc, GoStory.NpcPos(npc));
            ui.Refresh();
            if (!ui.TalkShown) { Fail(label + " — 곁인데 대화 단추 없음"); return; }
            ui.TalkButton.onClick.Invoke();
            if (!ui.TalkOpen || !StoryState.Talking) { Fail(label + " — 대화 창이 안 열림"); return; }
            var lines = StoryState.Current.Lines;
            for (int i = 0; i < lines.Length; i++)
            {
                if (lines[i].IsPick)
                {
                    if (ui.Next(-1)) Fail(label + " — 고르는 줄을 안 고르고 넘어감");
                    if (!ui.PickButton(1).gameObject.activeSelf || ui.NextButton.gameObject.activeSelf) Fail(label + " — 고르는 줄 단추");
                    ui.PickButton(1).onClick.Invoke();
                    if (ui.WhoText != GoLocalization.T("story.me", "나") || ui.LineText != GoStory.PickText(lines[i], 1) || !ui.NextButton.gameObject.activeSelf)
                        Fail($"{label} — 고른 대답 줄 '{ui.WhoText}: {ui.LineText}'");
                    ui.NextButton.onClick.Invoke();
                }
                else
                {
                    if (ui.WhoText != GoStory.NpcShort(lines[i].Who) || ui.LineText != GoStory.LineText(lines[i])) Fail($"{label} — {i + 1}째 줄 '{ui.WhoText}: {ui.LineText}'");
                    ui.NextButton.onClick.Invoke();
                }
            }
            if (ui.TalkOpen || StoryState.Talking) Fail(label + " — 끝났는데 창이 남음");
            bool moved = StoryState.Ch > ch || StoryState.StepIndex == step + 1;
            if (!moved) Fail($"{label} — 단계가 안 넘어감({StoryState.Ch}_{StoryState.StepIndex})");
        }

        private static void Kill(FieldEnemy e)
        {
            for (int i = 0; i < 6 && e.Alive; i++)
            {
                if (e.Shielded) e.SetShieldForTest(0f);
                e.TakeRaw(e.Hp + 99999f, Color.white);
            }
        }

        private static void Expect(int ch, int step, string label)
        {
            if (StoryState.Ch != ch || StoryState.StepIndex != step) Fail($"{label} — {StoryState.Ch}_{StoryState.StepIndex} ≠ {ch}_{step}");
        }

        private static void Pulse(Vector3 c, float r)
        {
            var f = typeof(FieldCombat).GetField("ElementPulse", BindingFlags.Static | BindingFlags.NonPublic);
            (f?.GetValue(null) as System.Action<Vector3, float, GoElement>)?.Invoke(c, r, GoElement.Hydro);
        }

        private static void DomainClear(GoDomain.Kind k)
        {
            var f = typeof(DomainField).GetField("Cleared", BindingFlags.Static | BindingFlags.NonPublic);
            (f?.GetValue(null) as System.Action<GoDomain.Kind>)?.Invoke(k);
        }

        /// <summary>임무 적 자리 60m 안으로 가서 세우고 모두 쓰러뜨린다 — 몇이 섰나.</summary>
        private static int ClearSquad(PlayerController pc, StoryField field, float gx, float gy, string label)
        {
            Vector3 sq = GoStory.GridPos(gx, gy);
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear + 10f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 0) Fail(label + " — 멀리서 임무 적이 섬");
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            int n = field.Squad.Count;
            foreach (var e in field.Squad) if (!e.StoryFoe || e.GroupId != StoryField.SquadKey) Fail($"{label} — 임무 적 표시 {e.StoryFoe}·{e.GroupId}");
            var copy = new System.Collections.Generic.List<FieldEnemy>(field.Squad);
            foreach (var e in copy) Kill(e);
            return n;
        }

        // ---- 1장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter1(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui, FieldEnemy g)
        {
            StoryState.Restore(0, 0);
            PlayerStats.Restore(1, 0);
            GuardianState.Restore(false);
            GuardianBloom.Instance?.Refresh();
            GoldState.Restore(0);
            TalentState.Restore(null, new int[5]);
            field.ResetForTest();
            ui.ResetForTest();
            pc.Teleport(fc.SafePoint);
            ui.Refresh();
            if (!ui.TrackShown || !ui.TrackText.Contains(GoStory.ChapterName(GoStory.Chapters[0])) || !ui.TrackText.Contains(GoStory.StepText(GoStory.Chapters[0].Steps[0])))
                Fail($"추적 줄 '{ui.TrackText}'");
            if (field.Pillar == null || !field.Pillar.activeSelf || GoStory.Flat(field.Pillar.transform.position, GoStory.NpcPos("elder")) > 0.5f) Fail("금빛 기둥이 누리 자리에 없다");
            ui.TrackButton.onClick.Invoke();
            if (!ui.ListOpen || !ui.ListText.Contains("◆") || !ui.ListText.Contains(GoStory.ChapterName(GoStory.Chapters[1]))) Fail($"목록 '{ui.ListText}'");
            ui.ListClose.onClick.Invoke();
            if (ui.ListOpen) Fail("목록이 안 닫힘");

            Talk(pc, ui, "elder", "1장 누리");                                                  // → 1 go
            Expect(0, 1, "누리 뒤");
            pc.Teleport(GoStory.GridPos(GoStory.TowerFootGx, GoStory.TowerFootGy) + new Vector3(0f, 0.4f, -GoStory.GoR - 8f));
            field.Check(pc.transform.position);
            Expect(0, 1, "망루 멀리");
            pc.Teleport(GoStory.GridPos(GoStory.TowerFootGx, GoStory.TowerFootGy) + new Vector3(0f, 0.4f, -GoStory.GoR + 3f));
            field.Check(pc.transform.position);
            Expect(0, 2, "망루 도착");                                                          // → 2 boss
            field.Check(pc.transform.position);
            Expect(0, 2, "수호장이 서 있는데 넘어감");
            if (GoStory.Flat(field.Pillar.transform.position, g.Home) > 1f) Fail("boss 기둥이 수호장 자리에 없다");
            if (!g.gameObject.activeSelf) g.gameObject.SetActive(true);
            Kill(g);
            Expect(0, 3, "수호장 쓰러뜨림");                                                    // → 3 talk 버들
            Talk(pc, ui, "ferryman", "1장 버들");
            Expect(0, 4, "버들 뒤");                                                            // → 4 kill

            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            Vector3 sq = GoStory.GridPos(GoStory.SquadGx, GoStory.SquadGy);
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) { Fail($"임무 적 {field.Squad.Count} ≠ 4"); return; }
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) Fail("임무 적이 두 번 섬");
            for (int i = 0; i < 3; i++) Kill(field.Squad[i]);
            Expect(0, 4, "넷 중 셋");
            Kill(field.Squad[3]);
            Expect(0, 5, "임무 적 다 쓰러뜨림");                                                // → 5 talk 은비
            if (PlayerStats.Level != lv || PlayerStats.Exp != exp) Fail("임무 적이 경험을 줬다");
            if (field.Squad.Count != 0) Fail("단계가 넘어갔는데 임무 적이 남음");

            Talk(pc, ui, "scholar", "1장 은비");
            Expect(0, 6, "은비 뒤");                                                            // → 6 light
            if (field.Altar == null || !field.Altar.gameObject.activeSelf || field.Altar.Lit) Fail("옛 제단이 꺼진 채 안 섰다");
            Vector3 altar = GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy);
            Pulse(altar + new Vector3(12f, 0f, 0f), 3f);
            Expect(0, 6, "먼 원소 신호로 불이 붙음");
            Pulse(altar + new Vector3(4f, 0f, 0f), 3f);
            Expect(0, 7, "옛 제단 원소 신호");                                                  // → 7 talk 누리
            if (!field.Altar.gameObject.activeSelf || !field.Altar.Lit) Fail("불 붙은 제단이 안 켜짐");

            int gold = GoldState.Gold; // 수호장 첫 토벌 금은 이미 들어왔다
            Talk(pc, ui, "elder", "1장 끝 누리");
            Expect(1, 0, "1장 끝");
            if (GoldState.Gold != gold + 500 || TalentState.Count(GoTalent.Mat.Guide) != 2 || TalentState.Count(GoTalent.Mat.Knot) != 2)
                Fail($"1장 보상 금 {GoldState.Gold - gold}·교본 {TalentState.Count(GoTalent.Mat.Guide)}·매듭 {TalentState.Count(GoTalent.Mat.Knot)}");
        }

        // ---- 2장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter2(PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(4, 0);
            field.Refresh();
            ui.Refresh();
            if (StoryState.Current != null || !StoryState.Locked) Fail("여정 4 인데 2장이 열림");
            if (!ui.TrackText.Contains("5") || field.Pillar.activeSelf) Fail($"잠긴 2장 추적 줄 '{ui.TrackText}'·기둥");
            Near(pc, GoStory.NpcPos("scholar"));
            ui.Refresh();
            if (ui.TalkShown) Fail("잠긴 장인데 대화 단추");
            PlayerStats.Restore(5, 0);
            field.Refresh();
            Talk(pc, ui, "scholar", "2장 은비");
            Expect(1, 1, "2장 은비 뒤");                                                        // → 1 go 제단
            pc.Teleport(GoStory.WeeklyAltarPos() + new Vector3(0f, 0.4f, -8f));
            field.Check(pc.transform.position);
            Expect(1, 2, "먹구름 제단 도착");                                                   // → 2 domain
            DomainClear(GoDomain.Kind.Tomb);
            Expect(1, 2, "무덤 터를 깼는데 넘어감");
            DomainClear(GoDomain.Kind.Weekly);
            Expect(1, 3, "주간 보스 깸");                                                       // → 3 talk 누리
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "2장 끝 누리");
            Expect(2, 0, "2장 끝");
            if (GoldState.Gold != gold + 1000 || TalentState.Count(GoTalent.Mat.Secret) != 1 || TalentState.Count(GoTalent.Mat.Knot) != 5) Fail("2장 보상");
            field.Refresh();
            ui.Refresh();
            if (!StoryState.Locked || !ui.TrackText.Contains("7") || field.Pillar.activeSelf) Fail($"여정 5 인데 3장 잠김 줄 '{ui.TrackText}'·기둥");
        }

        // ---- 3장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter3(PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(7, 0);
            field.Refresh();
            Talk(pc, ui, "elder", "3장 누리");
            Expect(2, 1, "3장 누리 뒤");                                                        // → 1 gather
            CookState.Restore(null, null, null);
            GoCooking.Node other = default; bool hasOther = false;
            var orchids = new System.Collections.Generic.List<GoCooking.Node>();
            foreach (var n in GoCooking.Nodes)
            {
                if (n.Item == "orchid") orchids.Add(n);
                else if (!hasOther) { other = n; hasOther = true; }
            }
            if (orchids.Count < 3 || !hasOther) { Fail($"청하란 포기 {orchids.Count}"); return; }
            pc.Teleport(orchids[0].Pos + new Vector3(30f, 0.4f, 0f));
            field.Refresh();
            StoryField.Target(out Vector3 t, out _);
            if (GoStory.Flat(t, orchids[0].Pos) > 40f) Fail("gather 기둥이 가까운 청하란 곁이 아니다");
            CookState.Pick(other);
            if (StoryState.Progress != 0) Fail("다른 채집물을 셈");
            CookState.Pick(orchids[0]);
            CookState.Pick(orchids[1]);
            ui.Refresh();
            if (StoryState.Progress != 2 || !ui.TrackText.Contains("2/3")) Fail($"청하란 2 — 셈 {StoryState.Progress}·줄 '{ui.TrackText}'");
            CookState.Pick(orchids[2]);
            Expect(2, 2, "청하란 셋");                                                          // → 2 cook
            var r = GoCooking.Recipes[0];
            foreach (var (item, n) in r.Ing) CookState.Add(item, n);
            if (CookState.Cook(0, 1, true) == null) Fail("요리가 안 됨");
            Expect(2, 3, "요리 하나");                                                          // → 3 talk 버들
            Talk(pc, ui, "ferryman", "3장 버들");
            Expect(2, 4, "3장 버들 뒤");                                                        // → 4 우두머리

            Vector3 chief = GoStory.GridPos(GoStory.ChiefGx, GoStory.ChiefGy);
            pc.Teleport(chief + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 3) { Fail($"우두머리 무리 {field.Squad.Count} ≠ 3"); return; }
            var boss = field.Squad[0];
            if (!boss.IsStoryBoss || boss.DisplayName != GoLocalization.T("story.boss.chief", "불도깨비 우두머리") || Mathf.Abs(boss.transform.localScale.x - GoStory.BossScale) > 0.01f)
                Fail($"우두머리 표시 {boss.IsStoryBoss}·{boss.DisplayName}·×{boss.transform.localScale.x}");
            if (Mathf.Abs(boss.MaxHp - field.Squad[1].MaxHp * GoStory.BossHp) > 1f) Fail($"우두머리 체력 {boss.MaxHp} ≠ {field.Squad[1].MaxHp} × {GoStory.BossHp}");
            var copy = new System.Collections.Generic.List<FieldEnemy>(field.Squad);
            foreach (var e in copy) Kill(e);
            Expect(2, 5, "우두머리 쓰러뜨림");                                                  // → 5 talk 은비
            Talk(pc, ui, "scholar", "3장 은비");
            Expect(2, 6, "3장 은비 뒤");                                                        // → 6 무덤
            field.Refresh();
            if (GoStory.Flat(field.Pillar.transform.position, GoStory.SitePos("d_tomb")) > 1f) Fail("domain 기둥이 잠든 무덤에 없다");
            DomainClear(GoDomain.Kind.Weekly);
            Expect(2, 6, "주간 보스를 깼는데 넘어감");
            DomainClear(GoDomain.Kind.Tomb);
            Expect(2, 7, "잠든 무덤 깸");                                                       // → 7 잔치 마당
            if (ClearSquad(pc, field, GoStory.FeastGx, GoStory.FeastGy, "잔치 마당") != 4) Fail("잔치 마당 임무 적 넷이 아니다");
            Expect(2, 8, "잔치 마당");                                                          // → 8 talk 누리
            int gold = GoldState.Gold, secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "elder", "3장 끝 누리");
            Expect(3, 0, "3장 끝");
            if (GoldState.Gold != gold + 1250 || TalentState.Count(GoTalent.Mat.Secret) != secret + 1) Fail("3장 보상");
        }

        // ---- 4장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter4(PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(10, 0);
            field.Refresh();
            if (field.NpcShown("wanderer")) Fail("4장 첫 단계에 나그네가 섰다");
            Talk(pc, ui, "elder", "4장 누리");
            Expect(3, 1, "4장 누리 뒤");                                                        // → 1 talk 나그네
            field.Refresh();
            var body = field.NpcBody("wanderer");
            if (!field.NpcShown("wanderer") || GoStory.Flat(body.transform.position, GoStory.GridPos(GoStory.WanderGx, GoStory.WanderGy)) > 0.5f) Fail("나그네가 다리목에 안 섰다");
            Talk(pc, ui, "wanderer", "4장 나그네");
            Expect(3, 2, "나그네 뒤");                                                          // → 2 follow
            var n = GoStory.NpcOf("wanderer");
            float len = GoStory.PathLength(n);
            pc.Teleport(GoStory.NpcPos("wanderer") + new Vector3(0f, 0.4f, -GoStory.FollowLost - 10f));
            field.Follow(pc.transform.position, 2f);
            ui.Refresh();
            if (StoryState.FollowDist > 0f) Fail("멀리 있는데 나그네가 걸음");
            if (!ui.TrackText.Contains(GoLocalization.T("story.follow_lost", " · 너무 멀어졌다").Trim(' ', '·'))) Fail($"멀어짐 줄 '{ui.TrackText}'");
            for (int i = 0; i < 400 && StoryState.StepIndex == 2; i++)
            {
                Near(pc, GoStory.NpcPos("wanderer"), 3f);
                float before = StoryState.FollowDist;
                field.Follow(pc.transform.position, 1f);
                if (StoryState.StepIndex == 2 && Mathf.Abs(StoryState.FollowDist - before - GoStory.FollowSpeed) > 0.01f && StoryState.FollowDist < len - 0.01f)
                { Fail($"따라가기 한 걸음 {StoryState.FollowDist - before}"); break; }
            }
            Expect(3, 3, "길 끝");                                                              // → 3 talk 나그네(길 끝)
            field.Refresh();
            if (GoStory.Flat(body.transform.position, GoStory.PathPos(n, float.MaxValue)) > 0.5f) Fail("길 끝에 나그네가 없다");
            Talk(pc, ui, "wanderer", "4장 길 끝 나그네");
            Expect(3, 4, "길 끝 나그네 뒤");                                                    // → 4 가면 졸개
            Vector3 sq = GoStory.GridPos(GoStory.MaskSquadGx, GoStory.MaskSquadGy);
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad[2].Element != GoElement.Cryo || field.Squad[3].Element != GoElement.Geo) Fail("가면 졸개 넷·빙·암");
            var copy = new System.Collections.Generic.List<FieldEnemy>(field.Squad);
            foreach (var e in copy) Kill(e);
            Expect(3, 5, "가면 졸개");                                                          // → 5 talk 나그네
            Talk(pc, ui, "wanderer", "4장 조각 나그네");
            field.Refresh();
            if (field.NpcShown("wanderer")) Fail("여섯째 단계 뒤에도 나그네가 섬");
            Talk(pc, ui, "scholar", "4장 은비");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "4장 끝 누리");
            Expect(4, 0, "4장 끝");
            if (GoldState.Gold != gold + 1500) Fail("4장 보상");
            if (!StoryState.Locked) Fail("여정 10 인데 5장이 열림");
        }

        // ---- 5장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter5(PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(12, 0);
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("scholar").transform.position, GoStory.GridPos(GoStory.RoadGx, GoStory.RoadGy)) > 0.5f) Fail("5장 은비가 옛길로 안 옮김");
            Talk(pc, ui, "elder", "5장 누리");
            pc.Teleport(GoStory.GridPos(GoStory.RoadGoGx, GoStory.RoadGoGy) + new Vector3(0f, 0.4f, 2f));
            field.Check(pc.transform.position);
            Expect(4, 2, "옛길 어귀");                                                          // → 2 kill
            if (ClearSquad(pc, field, GoStory.RoadSquadGx, GoStory.RoadSquadGy, "옛길 졸개") != 4) Fail("옛길 졸개 넷이 아니다");
            Expect(4, 3, "옛길 졸개");
            Talk(pc, ui, "scholar", "5장 옛길 은비");
            Expect(4, 4, "옛길 은비 뒤");                                                       // → 4 seal
            field.Refresh();
            if (!field.SealCenter.gameObject.activeSelf || field.SealLamp(0).Lit || field.SealLamp(1).Lit || field.SealLamp(2).Lit) Fail("석등이 꺼진 채 안 섰다");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLamp(Lamp(id)).transform.position;
            Pulse(L("moon"), 1f);                                                               // 틀림(첫째는 해)
            if (StoryState.Progress != 0 || field.SealLamp(Lamp("moon")).Lit) Fail("차례 틀린 달이 켜짐");
            Pulse(L("sun"), 1f);
            if (StoryState.Progress != 1 || !field.SealLamp(Lamp("sun")).Lit) Fail("해가 안 켜짐");
            Pulse(L("sun"), 1f);
            if (StoryState.Progress != 1) Fail("켜진 해를 또 셈");
            Pulse(L("star"), 1f);                                                               // 틀림(둘째는 달) → 모두 꺼짐
            if (StoryState.Progress != 0 || field.SealLamp(Lamp("sun")).Lit) Fail("틀렸는데 안 꺼짐");
            Pulse(L("sun"), 1f);
            Pulse(L("moon"), 1f);
            Expect(4, 4, "둘 켰는데 넘어감");
            Pulse(L("star"), 1f);
            Expect(4, 5, "해·달·별");                                                           // → 5 kill
            if (!field.SealCenter.Lit || !field.SealLamp(0).Lit || !field.SealLamp(1).Lit || !field.SealLamp(2).Lit) Fail("봉인 뒤 석등이 다 안 켜짐");
            if (ClearSquad(pc, field, GoStory.Altar2SquadGx, GoStory.Altar2SquadGy, "제단 무리") != 5) Fail("제단 무리 다섯이 아니다");
            Expect(4, 6, "제단 무리");
            field.Refresh();
            if (!field.NpcShown("wanderer")) Fail("둘째 제단에 나그네가 안 섰다");
            Talk(pc, ui, "wanderer", "5장 나그네");
            Talk(pc, ui, "scholar", "5장 제단 은비");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "5장 끝 누리");
            Expect(5, 0, "5장 끝");
            if (GoldState.Gold != gold + 1750) Fail("5장 보상");
        }

        // ---- 6장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter6(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(15, 0);
            field.Refresh();
            Talk(pc, ui, "scholar", "6장 은비");
            Expect(5, 1, "6장 은비 뒤");                                                        // → 1 climb
            var peak = GoStory.DuelPeak;
            pc.Teleport(GoStory.ArenaPos(GoStory.ArenaDuel) + Vector3.up * 0.5f);
            field.Check(pc.transform.position);
            Expect(5, 1, "고원만 올랐는데 넘어감");
            pc.Teleport(GoWorldMap.PeakArrival(peak));
            field.Check(pc.transform.position);
            Expect(5, 2, "봉우리 꼭대기");                                                      // → 2 talk 나그네
            Talk(pc, ui, "wanderer", "6장 나그네");
            Expect(5, 3, "6장 나그네 뒤");                                                      // → 3 duel
            Vector3 arena = GoStory.ArenaPos(GoStory.ArenaDuel);
            pc.Teleport(arena + new Vector3(0f, 0.5f, -5f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"검은 가면 {field.Squad.Count} ≠ 1"); return; }
            var boss = field.Squad[0];
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1 || field.Squad[0] != boss) Fail("한 박자 뒤 검은 가면이 치워지거나 다시 섰다"); // 14-14 회귀
            if (!boss.IsStoryBoss || boss.DisplayName != GoLocalization.T("story.boss.mask", "검은 가면") || FindDeep(boss.transform, "Mask") == null) Fail("검은 가면 표시·가면");
            if (Mathf.Abs(boss.transform.position.y - arena.y) > 2f) Fail($"검은 가면이 고원 위에 없다({boss.transform.position.y:0.0} ≠ {arena.y:0.0})");
            Vector3 cell = TestMapData.WorldPos(GoStory.DuelPeakGx, GoStory.DuelPeakGy);
            if (boss.CanStep(cell + new Vector3(TestMapData.TileSize, arena.y, 0f)) || boss.CanStep(TestMapData.PeakBase(GoStory.DuelPeakGx, GoStory.DuelPeakGy)) || !boss.CanStep(arena + new Vector3(3f, 0f, -3f)))
                Fail("검은 가면이 고원 밖·봉우리에 서거나 고원에 못 선다");
            if (boss.CurrentMove != FieldEnemy.BossMove.Shadow) Fail("첫 수가 그림자 걸음이 아니다");
            typeof(FieldEnemy).GetMethod("BeginTelegraph", BindingFlags.Instance | BindingFlags.NonPublic)?.Invoke(boss, null);
            float back = GoStory.Flat(boss.transform.position, pc.transform.position);
            if (Mathf.Abs(back - FieldEnemy.ShadowBack) > 0.6f || Mathf.Abs(boss.StrikeReach - FieldEnemy.MoveSpec(FieldEnemy.BossMove.Shadow).r) > 0.01f) Fail($"그림자 걸음 — 등 뒤 {back:0.0}m·원 {boss.StrikeReach}");
            pc.Teleport(arena + new Vector3(-6f, 0.5f, 8f)); // 원 밖에서 한 수를 넘긴다(맞아 쓰러지면 마을로 돌아가 버린다)
            boss.ResolveStrike();
            if (boss.CurrentMove != FieldEnemy.BossMove.Spit || boss.MoveIndex != 1) Fail("둘째 수가 침이 아니다");
            boss.TakeRaw(boss.Hp - boss.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!field.DuelPhase2 || !boss.Shielded || boss.Element != GoElement.Electro || field.Squad.Count != 3) Fail($"2단계 — 방패 {boss.Shielded}·{boss.Element}·무리 {field.Squad.Count}");
            if (Mathf.Abs(boss.ShieldHp - boss.MaxHp * GoStory.DuelP2Shield) > 1f) Fail($"뇌 방패 {boss.ShieldHp}");
            Kill(boss);
            Expect(5, 4, "검은 가면 쓰러뜨림");                                                 // → 4 talk 나그네
            if (field.Squad.Count != 0) Fail("결투 뒤 졸개가 남음");
            Talk(pc, ui, "wanderer", "6장 결투 뒤 나그네");
            Expect(5, 5, "6장 나그네 뒤");                                                      // → 5 light
            var altar3 = field.AltarOf(5);
            if (altar3 == null || !altar3.gameObject.activeSelf || altar3.Lit) Fail("셋째 제단이 꺼진 채 안 섰다");
            Pulse(GoStory.ArenaPos(GoStory.ArenaAltar), 2f);
            Expect(5, 6, "셋째 제단");
            if (altar3 == null || !altar3.Lit) Fail("셋째 제단 불");
            Talk(pc, ui, "scholar", "6장 고원 은비");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "6장 끝 누리");
            Expect(6, 0, "6장 끝");
            if (GoldState.Gold != gold + 2000) Fail("6장 보상");
            if (!StoryState.Locked) Fail("여정 15 인데 7장이 열림");
        }

        // ---- 7장 ----------------------------------------------------------------------------------------------

        private static void CheckChapter7(PlayerController pc, StoryField field, StoryUi ui)
        {
            PlayerStats.Restore(18, 0);
            field.Refresh();
            Talk(pc, ui, "scholar", "7장 은비");
            Talk(pc, ui, "ferryman", "7장 버들");
            Expect(6, 2, "7장 버들 뒤");                                                        // → 2 go 곶
            pc.Teleport(GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy - 22f / 48f) + new Vector3(3f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(6, 3, "곶 도착");
            field.Refresh();
            if (!field.NpcShown("wanderer")) Fail("곶에 나그네가 안 섰다");
            Talk(pc, ui, "wanderer", "7장 나그네");
            Expect(6, 4, "7장 나그네 뒤");                                                      // → 4 defend
            field.Refresh();
            var altar = field.AltarOf(6);
            if (altar == null || !altar.gameObject.activeSelf || altar.Lit) Fail("지키기 동안 넷째 제단 몸이 없다");
            Vector3 cape = GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy);
            Vector3 near = cape + new Vector3(0f, 0.4f, -4f);

            pc.Teleport(cape + new Vector3(0f, 0.4f, -GoStory.DefendStart - 10f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(near);
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
                if (!e.StoryFoe || !e.Siege.HasValue || GoStory.Flat(e.Siege.Value, cape) > 0.5f) Fail("물결 적이 제단을 안 노린다");
            if (Mathf.Abs(field.DefendHpMax - GoStory.DefendHpMax(cape)) > 0.5f || field.DefendHp != field.DefendHpMax) Fail($"제단 체력 {field.DefendHp}/{field.DefendHpMax}");
            ui.Refresh();
            if (!ui.TrackText.Contains("100%") || !ui.TrackText.Contains("1/3")) Fail($"지키기 추적 줄 '{ui.TrackText}'");

            // 제단으로 곧장 — 내가 멀면 제단 쪽으로 걷고, 곁에 닿으면 제단을 친다
            var foe = field.Squad[0];
            pc.Teleport(cape + new Vector3(0f, 0.4f, -GoStory.DefendStart + 2f));
            float d0 = GoStory.Flat(foe.transform.position, cape);
            foe.Tick(1f);
            if (GoStory.Flat(foe.transform.position, cape) >= d0 - 0.5f) Fail($"물결 적이 제단 쪽으로 안 감 {d0:0.0} → {GoStory.Flat(foe.transform.position, cape):0.0}");
            foe.transform.position = FolkWalker.Grounded(cape + new Vector3(2.5f, 1f, 0f));
            foe.Tick(0.01f);
            if (foe.CurrentState != FieldEnemy.State.Telegraph) Fail("제단 곁에서 예고를 안 함 " + foe.CurrentState);
            float hp0 = field.DefendHp;
            foe.ResolveStrike();
            if (Mathf.Abs(hp0 - field.DefendHp - foe.Atk) > 0.5f) Fail($"제단을 친 한 대 {hp0 - field.DefendHp} ≠ {foe.Atk}");

            field.SiegeHitForTest(field.Squad[1], field.DefendHpMax * 0.2f);
            field.SiegeHitForTest(field.Squad[1], field.DefendHpMax);
            if (field.DefendWave != -1 || field.Squad.Count != 0 || Mathf.Abs(field.DefendRest - GoStory.DefendRest) > 0.01f || field.DefendHp != field.DefendHpMax) Fail("무너졌는데 처음부터가 아니다");
            pc.Teleport(near);
            field.DefendTick(pc.transform.position, GoStory.DefendRest - 0.5f);
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1) Fail("쉬는 4초 안에 물결이 옴");
            field.DefendTick(pc.transform.position, 0.5f);
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0) Fail("쉰 뒤 첫 물결이 안 옴");
            field.DefendTick(pc.transform.position, GoStory.DefendWaveSec + 0.1f);
            if (field.DefendWave != 1 || field.Squad.Count != 7) Fail($"28초 뒤 둘째 물결 {field.DefendWave}·{field.Squad.Count}");
            field.WipedForTest();
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("전멸했는데 처음부터가 아니다");
            field.DefendTick(pc.transform.position, GoStory.DefendRest + 0.1f);
            for (int guard = 0; guard < 20 && StoryState.StepIndex == 4; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(6, 5, "물결 셋을 다 막음");                                                  // → 5 duel
            if (field.Squad.Count != 0) Fail("지키기 뒤 무리가 남음");

            Vector3 dp = GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy - 12f / 48f);
            pc.Teleport(dp + new Vector3(0f, 0.4f, -6f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"금 간 검은 가면 {field.Squad.Count} ≠ 1"); return; }
            var boss = field.Squad[0];
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1 || field.Squad[0] != boss) Fail("한 박자 뒤 금 간 검은 가면이 치워지거나 다시 섰다");
            if (!boss.IsStoryBoss || FindDeep(boss.transform, "Crack") == null || boss.CurrentMove != FieldEnemy.BossMove.Tide) Fail("금 간 가면·첫 수 밀물");
            typeof(FieldEnemy).GetMethod("BeginTelegraph", BindingFlags.Instance | BindingFlags.NonPublic)?.Invoke(boss, null);
            var tp = boss.TidePoints;
            if (tp.Count != FieldEnemy.TideN || GoStory.Flat(tp[0], tp[1]) < FieldEnemy.TideGap - 0.3f || GoStory.Flat(tp[0], tp[1]) > FieldEnemy.TideGap + 0.3f)
                Fail($"밀물 원 {tp.Count}");
            else if (!boss.InStrike(tp[3]) || boss.InStrike(tp[3] + (tp[3] - tp[0]).normalized * 8f)) Fail("밀물 원 판정");
            pc.Teleport(dp + new Vector3(15f, 0.4f, -15f));
            boss.ResolveStrike();
            if (boss.TidePoints.Count != 0 || boss.CurrentMove != FieldEnemy.BossMove.Shadow) Fail("밀물 뒤 원이 남거나 다음 수가 아니다");
            boss.TakeRaw(boss.Hp - boss.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!boss.Shielded || boss.Element != GoElement.Hydro || field.Squad.Count != 3 || field.Squad[2].EnemyKind != FieldEnemy.Kind.DrownedGhost) Fail($"2단계 물 방패·졸개 {boss.Element}·{field.Squad.Count}");
            Kill(boss);
            Expect(6, 6, "금 간 검은 가면");
            Talk(pc, ui, "wanderer", "7장 가면 반쪽 나그네");
            Pulse(cape + new Vector3(2f, 0f, 0f), 2f);
            Expect(6, 8, "넷째 제단 불");
            if (!altar.Lit) Fail("넷째 제단 불이 안 켜짐");
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("ferryman").transform.position, cape) > 12f) Fail("버들이 곶에 안 옴");
            Talk(pc, ui, "ferryman", "7장 곶 버들");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "7장 끝 누리");
            if (StoryState.Ch != 7 || !StoryState.Locked || GoldState.Gold != gold + 2250) Fail("7장 끝·보상·8장 잠김(여정 20)");
            ui.Refresh();
            field.Refresh();
            if (!ui.TrackShown || field.Pillar.activeSelf) Fail("7장 끝 — 8장 잠김 줄·기둥");
        }

        // ---- 8장(109-14-19) ------------------------------------------------------------------------------------

        /// <summary>쫓는 이를 speed 로 도둑 쪽에 곧장 달리게 한다(모퉁이를 가로질러도) — 잡았으면 true, 놓쳤으면(처음 자리로) false.</summary>
        private static bool RunAfter(StoryField field, ref Vector3 me, float speed)
        {
            const float dt = 0.05f;
            bool ran = false;
            for (float t = 0f; t < 60f; t += dt)
            {
                Vector3 to = field.ChasePos - me;
                to.y = 0f;
                if (to.magnitude > 0.01f) me += to.normalized * Mathf.Min(speed * dt, to.magnitude);
                field.ChaseTick(me, dt);
                if (StoryState.Current == null || StoryState.Current.Type != GoStory.StepType.Chase) return true;
                if (field.ChaseRunning) ran = true;
                else if (ran) return false;
            }
            Fail($"{speed}m/초 쫓기가 60초에 안 끝남");
            return false;
        }

        private static void CheckChapter8(PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch8 = "8장 중단";
            PlayerStats.Restore(20, 0);
            field.Refresh();
            Talk(pc, ui, "elder", "8장 누리");
            Talk(pc, ui, "ferryman", "8장 버들");
            Expect(7, 2, "8장 버들 뒤");                                                        // → 2 chase
            field.Refresh();
            if (!field.NpcShown("thief")) Fail("도둑이 안 섰다");
            // 평균 빠르기 — 걷기 6 과 달리기 10 사이
            float len = 0f;
            for (int i = 1; i < GoStory.ThiefPath.Length; i++) len += GoStory.Flat(GoStory.ThiefPoint(i - 1), GoStory.ThiefPoint(i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.ThiefPath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"도둑 평균 {avg:0.0}m/초");
            Vector3 t0 = GoStory.ThiefPoint(0);
            field.ChaseTick(t0 + new Vector3(0f, 0f, 30f), 0.1f);
            if (field.ChaseRunning || GoStory.Flat(field.ChasePos, t0) > 0.01f) Fail("멀리서 도둑이 달아남");
            ui.Refresh();
            if (!ui.TrackText.Contains(GoLocalization.T("story.chase_idle", " (가까이 가면 달아난다)").Trim())) Fail("쫓기 전 추적 줄 " + ui.TrackText);
            Vector3 me = t0 + new Vector3(-10f, 0f, 0f);
            bool caught = RunAfter(field, ref me, 6f);                                         // 걷기
            if (caught || StoryState.StepIndex != 2 || field.ChaseRunning || GoStory.Flat(field.ChasePos, t0) > 0.01f) Fail($"걸어서 쫓았는데 {(caught ? "잡음" : "처음 자리가 아님")}");
            me = t0 + new Vector3(-10f, 0f, 0f);
            field.ChaseTick(me, 0.05f);
            ui.Refresh();
            if (!field.ChaseRunning || !ui.TrackText.Contains(GoStory.NpcShort("thief")) || ui.TrackText.Contains(GoLocalization.T("story.chase_idle", " (가까이 가면 달아난다)").Trim())) Fail("달아나는 추적 줄 " + ui.TrackText);
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 못 잡음");                        // 달리기
            Expect(7, 3, "도둑 잡음");
            if (StoryState.ChasePos != null) Fail("잡은 뒤 도둑 자리가 남음");
            Talk(pc, ui, "ferryman", "8장 노 돌려주기");
            Talk(pc, ui, "ferryman", "8장 배 타기");                                            // sail → 섬
            Expect(7, 5, "배 뒤");
            Vector3 isle = GoStory.IslePos(Vector2.zero);
            if (!GoStory.OnIsle(pc.transform.position)) Fail($"배가 섬에 안 닿음 {GoStory.Flat(pc.transform.position, isle):0}m");
            field.Refresh();
            if (!GoStory.OnIsle(field.NpcBody("ferryman").transform.position)) Fail("섬에 버들이 안 옴");
            // 섬 무리 — 섬 위에 서고 섬 안에서만 걷는다
            pc.Teleport(isle + new Vector3(0f, 0.4f, -8f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) { Fail($"섬 무리 {field.Squad.Count} ≠ 4"); return; }
            foreach (var e in field.Squad)
            {
                if (!GoStory.OnIsle(e.transform.position) || Mathf.Abs(e.transform.position.y - isle.y) > 1f) Fail($"섬 무리가 섬 위에 없다 {e.transform.position}");
                if (e.CanStep(isle + new Vector3(0f, 0f, GoStory.IsleR + 3f)) || !e.CanStep(isle + new Vector3(2f, 0f, 2f))) Fail("섬 무리가 물로 걷거나 섬에서 못 걷는다");
            }
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(7, 6, "섬 무리");
            field.Refresh();
            if (!field.NpcShown("wanderer") || !GoStory.OnIsle(field.NpcBody("wanderer").transform.position)) Fail("섬에 나그네가 안 섰다");
            Talk(pc, ui, "wanderer", "8장 섬 나그네");
            Expect(7, 7, "섬 나그네 뒤");                                                        // → 7 seal 별·달·해
            field.Refresh();
            if (field.SealCenterOf(7) == null || !field.SealCenterOf(7).gameObject.activeSelf || field.SealLampOf(7, 0).Lit) Fail("섬 석등이 꺼진 채 안 섰다");
            if (!field.SealCenter.Lit) Fail("5장 석등이 꺼짐");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(7, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                // 틀림(첫째는 별)
            if (StoryState.Progress != 0) Fail("섬 — 해가 먼저 켜짐");
            Pulse(L("star"), 1f);
            Pulse(L("moon"), 1f);
            if (StoryState.Progress != 2 || !field.SealLampOf(7, Lamp("moon")).Lit) Fail("섬 — 별·달");
            Pulse(L("sun"), 1f);
            Expect(7, 8, "별·달·해");                                                           // → 8 talk 해솔
            field.Refresh();
            var hs = field.NpcBody("haesol");
            if (!field.NpcShown("haesol") || hs == null || FindDeep(hs.transform, "Crack") == null || !GoStory.OnIsle(hs.transform.position)) Fail("해솔 — 섬·금 간 가면");
            Talk(pc, ui, "haesol", "8장 해솔");
            field.Refresh();
            if (field.NpcShown("haesol")) Fail("해솔이 대화 뒤에도 섰다");
            Talk(pc, ui, "wanderer", "8장 해솔 뒤 나그네");
            Talk(pc, ui, "ferryman", "8장 돌아오는 배");                                        // sail → 나루
            Expect(7, 11, "돌아오는 배 뒤");
            if (GoStory.Flat(pc.transform.position, GoStory.GridPos(GoStory.DockGx, GoStory.DockGy)) > 3f) Fail("돌아오는 배가 나루에 안 닿음");
            field.Refresh();
            if (GoStory.OnIsle(field.NpcBody("ferryman").transform.position)) Fail("버들이 섬에 남음");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "8장 끝 누리");
            if (StoryState.Ch != 8 || !StoryState.Locked || GoldState.Gold != gold + 2500) Fail("8장 끝·보상·9장 잠김(여정 25)");
            ui.Refresh();
            field.Refresh();
            if (!ui.TrackShown || field.Pillar.activeSelf) Fail("8장 끝 — 9장 잠김 줄·기둥");
            if (!field.SkyCover.activeSelf || field.DraftRings.activeSelf || PlayerController.DraftOn) Fail("9장이 잠겼는데 덮개가 걷히거나 기둥이 섰다");
            _ch8 = $"8장 도둑 평균 {avg:0.0}m/초·걸어선 놓침·달려서 잡음·배 섬/나루·섬 무리 넷(섬 안만)·별·달·해·해솔 금 간 가면·보상";
        }

        // ---- 9장(109-14-20) ------------------------------------------------------------------------------------

        private static void Steps(PlayerController pc, float sec) { for (float t = 0f; t < sec; t += 0.05f) pc.Step(0.05f); }

        private static void CheckChapter9(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch9 = "9장 중단";
            PlayerStats.Restore(25, 0);
            field.Refresh();
            if (field.SkyCover.activeSelf || !field.DraftRings.activeSelf || !PlayerController.DraftOn) Fail("9장이 열렸는데 덮개·기둥");
            foreach (var pk in GoWorldMap.Peaks) // 섬이 다른 봉우리 위에 뜨면 위에서 내리쏘는 광선(정상 윗면·등반)이 섬에 걸린다
                if (GoStory.Flat(pk.Top, GoStory.SkyCenter) < GoStory.SkyR + TestMapData.PeakTopRadius + 3f) Fail($"구름섬이 봉우리 {pk.Id} 위");
            if (GoStory.Flat(TestMapData.WorldPos(GoWorldMap.TowerGx, GoWorldMap.TowerGy), GoStory.SkyCenter) < GoStory.SkyR + 10f) Fail("구름섬이 망루 위");
            Talk(pc, ui, "scholar", "9장 은비");
            var peak = GoStory.DuelPeak;
            pc.Teleport(GoWorldMap.PeakArrival(peak));
            field.Check(pc.transform.position);
            Expect(8, 2, "9장 봉우리 꼭대기");
            field.Refresh();
            if (!field.NpcShown("wanderer") || GoStory.Flat(field.NpcBody("wanderer").transform.position, peak.Top) > 5f) Fail("기둥 곁에 나그네가 없다");
            Talk(pc, ui, "wanderer", "9장 기둥 나그네");
            Expect(8, 3, "9장 나그네 뒤");                                                      // → 3 sky
            // 몸 — 땅에선 안 뜸 · 점프하면 저절로 활공 · 기력 안 쓰고 기둥 끝까지 · 접으면 안 폄 · 섬에 내림
            string body = "";
            pc.Teleport(peak.Top + Vector3.up * 0.3f);
            Steps(pc, 0.5f);
            float y0 = pc.transform.position.y;
            if (pc.Mode != PlayerController.MoveMode.Ground || Mathf.Abs(y0 - peak.Top.y) > 1f) Fail($"기둥 안 땅에서 {pc.Mode}·{y0 - peak.Top.y:0.0}m");
            GoStamina.SetForTest(50f);
            pc.RequestJump();
            Steps(pc, 0.4f);
            if (pc.Mode != PlayerController.MoveMode.Glide) Fail($"기둥 안 점프가 저절로 활공이 아니다({pc.Mode})");
            Steps(pc, 12f);
            float st0 = GoStamina.Value;
            if (Mathf.Abs(pc.transform.position.y - GoStory.DraftTop) > 0.6f || pc.Mode != PlayerController.MoveMode.Glide) Fail($"기둥 끝 {pc.transform.position.y - GoStory.DraftTop:0.0}m·{pc.Mode}");
            Steps(pc, 2f);
            if (GoStamina.Value < st0 - 0.01f) Fail("기둥 안 활공이 기력을 씀");
            else body += "땅에선 안 뜸·저절로 활공·기둥 끝·기력 그대로";
            pc.RequestJump();
            Steps(pc, 0.6f);
            if (pc.Mode == PlayerController.MoveMode.Glide || pc.transform.position.y > GoStory.DraftTop - 0.5f) Fail($"기둥 안에서 접었는데 다시 폄({pc.Mode})");
            else body += "·접으면 안 폄";
            pc.Teleport(GoStory.SkyPos(new Vector2(0f, 8f)) + Vector3.up * 5f);
            Steps(pc, 2f);
            if (pc.Mode != PlayerController.MoveMode.Ground || !GoStory.OnSkyTop(pc.transform.position)) Fail($"섬에 못 내림 {pc.Mode}·{pc.transform.position.y - GoStory.SkyCenter.y:0.0}m");
            else body += "·섬에 내림";
            field.Check(pc.transform.position);
            Expect(8, 4, "구름섬에 오름");                                                      // → 4 kill
            // 난간 — 걸어 오르는 턱보다 높고 점프보다 낮다
            var cc = pc.GetComponent<CharacterController>();
            if (cc != null && (GoStory.SkyRail <= cc.stepOffset || GoStory.SkyRail >= PlayerController.JumpVelocity * PlayerController.JumpVelocity / 40f)) Fail($"난간 {GoStory.SkyRail}m — 턱 {cc.stepOffset}");
            int rails = 0;
            foreach (Transform t in field.Sky.transform) if (t.name == "SkyRail" && t.GetComponent<Collider>() != null && t.GetComponent<NoClimb>() != null) rails++;
            if (rails != 24) Fail($"난간 토막 {rails}");
            // 층 — 섬 위에선 땅 적이 못 쫓는다
            var ground = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe && x.Alive);
            ground.WarpForTest(new Vector3(pc.transform.position.x, peak.Top.y - 30f, pc.transform.position.z));
            ground.ForceChase();
            ground.Tick(0.05f);
            if (ground.CurrentState == FieldEnemy.State.Chase || GoStory.SameLayer(ground.transform.position, pc.transform.position)) Fail($"섬 밑 땅 적이 나를 쫓음({ground.CurrentState})");
            ground.RestoreHomeForTest();
            // 섬 무리 — 난간 안
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) { Fail($"구름섬 무리 {field.Squad.Count} ≠ 4"); return; }
            Vector3 sc = GoStory.SkyCenter;
            foreach (var e in field.Squad)
            {
                if (!GoStory.OnSkyTop(e.transform.position)) Fail($"구름섬 무리가 섬 위에 없다 {e.transform.position - sc}");
                if (e.CanStep(sc + new Vector3(0f, 0f, GoStory.SkyR + 2f)) || !e.CanStep(sc + new Vector3(3f, 0f, 3f))) Fail("구름섬 무리가 난간을 넘거나 섬에서 못 걷는다");
            }
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(8, 5, "구름섬 무리");                                                        // → 5 duel 해솔
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"먹구름 가면 해솔 {field.Squad.Count}"); return; }
            var hs = field.Squad[0];
            if (!hs.IsStoryBoss || hs.DisplayName != GoLocalization.T("story.boss.haesol", "먹구름 가면 해솔") || FindDeep(hs.transform, "Crack") == null || !GoStory.OnSkyTop(hs.transform.position)) Fail("먹구름 가면 해솔 — 이름·금 간 가면·섬 위");
            Kill(hs);
            Expect(8, 6, "먹구름 가면 해솔");
            field.Refresh();
            var hb = field.NpcBody("haesol");
            if (!field.NpcShown("haesol") || hb == null || !GoStory.OnSkyTop(hb.transform.position)) Fail("가면 벗은 해솔이 섬에 없다");
            else if (FindDeep(hb.transform, "Mask") != null && FindDeep(hb.transform, "Mask").gameObject.activeSelf) Fail("해솔이 가면을 안 벗음");
            if (GoStory.NpcName("haesol") != GoLocalization.T("story.npc.haesol2", "해솔")) Fail("가면 벗은 해솔 이름 " + GoStory.NpcName("haesol"));
            Talk(pc, ui, "haesol", "9장 해솔");
            Expect(8, 7, "해솔 뒤");                                                             // → 7 duel 임금
            pc.Teleport(GoStory.SkyPos(new Vector2(0f, 10f)) + Vector3.up * 0.4f);
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"먹구름 임금 {field.Squad.Count}"); return; }
            var king = field.Squad[0];
            if (FindDeep(king.transform, "Crown") == null || Mathf.Abs(king.transform.localScale.x / hs.transform.localScale.x - 2f / 1.05f) > 0.05f) Fail($"임금 왕관·크기 {king.transform.localScale.x}");
            if (king.CurrentMove != FieldEnemy.BossMove.Slam) Fail("임금 첫 수가 내려찍기가 아니다");
            pc.Teleport(sc + new Vector3(12f, 0.4f, 12f));                                    // 원 밖에서 한 수를 넘긴다
            typeof(FieldEnemy).GetMethod("BeginTelegraph", BindingFlags.Instance | BindingFlags.NonPublic)?.Invoke(king, null);
            king.ResolveStrike();
            typeof(FieldEnemy).GetMethod("BeginTelegraph", BindingFlags.Instance | BindingFlags.NonPublic)?.Invoke(king, null); // 고리는 예고가 시작될 때 입는다
            if (king.CurrentMove != FieldEnemy.BossMove.Halo || Mathf.Abs(king.HaloInnerNow - FieldEnemy.HaloInner) > 0.01f) Fail($"둘째 수가 고리가 아니다 {king.CurrentMove}·{king.HaloInnerNow}");
            else
            {
                Vector3 kp = king.transform.position;
                if (!king.InStrike(kp + new Vector3(10f, 0f, 0f)) || king.InStrike(kp + new Vector3(2f, 0f, 0f)) || king.InStrike(kp + new Vector3(20f, 0f, 0f))) Fail("고리 판정(10m 맞음·2m·20m 안 맞음)");
            }
            Kill(king);
            Expect(8, 8, "먹구름 임금");
            Talk(pc, ui, "wanderer", "9장 나그네와 해솔");
            Talk(pc, ui, "haesol", "9장 내려갈 채비");
            Expect(8, 10, "내려갈 채비 뒤");                                                     // → 10 go 마을
            pc.Teleport(GoStory.GridPos(1.2f, 3.2f) + new Vector3(2f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(8, 11, "마을 도착");
            int gold = GoldState.Gold;
            Talk(pc, ui, "elder", "9장 끝 누리");
            if (StoryState.Ch != 9 || GoldState.Gold != gold + 2750) Fail("9장 끝·보상");
            if (!PartyState.Has("story_haesol")) Fail("해솔이 합류 안 함");
            ui.Refresh();
            field.Refresh();
            if (StoryState.Done || !StoryState.Locked || field.Pillar.activeSelf) Fail("9장 뒤 10장이 여정 등급 26 에 열리는 잠김이어야 함(기둥 없음)");
            if (!ui.TrackShown || !ui.TrackText.Contains("26")) Fail($"10장 잠김 줄 '{ui.TrackText}'");
            if (field.SkyCover.activeSelf || !PlayerController.DraftOn) Fail("다 끝났는데 덮개가 돌아오거나 기둥이 꺼짐");
            _ch9 = "9장 " + body + "·난간·층·구름섬 무리 난간 안·해솔·가면 벗음·임금 ×2 왕관·고리 안쪽 빔·해솔 합류";
        }

        // ---- 10장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter10(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch10 = "10장 중단";
            foreach (var off in new[] { GoStory.HaramObs, GoStory.HaramShip, GoStory.BandiShip, GoStory.HaramFort })
                if (!GoFrost.Contains(GoStory.FrostPos(off)) || Mathf.Abs(off.x) > GoFrost.HalfX - 5f || Mathf.Abs(off.y) > GoFrost.HalfZ - 5f) Fail($"10장 인물 자리 {off} 가 고원 밖·가장자리");
            var hn = GoStory.NpcOf("haram");
            for (float d = 0f; d < GoStory.PathLength(hn); d += 4f) if (!GoFrost.Contains(GoStory.PathPos(hn, d))) Fail($"하람 길 {d:0}m 가 고원 밖");
            if (GoStory.Flat(GoStory.FrostPos(GoStory.HaramObs), GoFrost.Center + new Vector3(GoStory.FrostAt("obs", 0f, 0f).x, 0f, GoStory.FrostAt("obs", 0f, 0f).y)) < 6f) Fail("하람이 관측소 건물 속");
            StoryState.OffForTest = false;
            PlayerStats.Restore(26, 0);
            StoryState.Restore(9, 0);
            field.Refresh();
            if (field.NpcShown("haram") || field.NpcShown("bandi")) Fail("10장 첫 단계에 하람·반디가 섰다");
            Talk(pc, ui, "elder", "10장 누리");
            Expect(9, 1, "10장 누리 뒤");                                                       // → 1 go 경계비
            var go = StoryState.Current;
            pc.Teleport(GoStory.GridPos(1.2f, 3.2f) + new Vector3(2f, 0.4f, 0f));
            if (GoStory.Flat(GoStory.TargetOf(go, pc.transform.position, out _), GoFrost.GatePos) > 0.01f) Fail("고원 밖에서 화살표가 서리 고개 돌기둥을 안 가리킴");
            if (!GoFrost.Contains(GoStory.TargetOf(go, out _))) Fail("실제 목표가 고원 안이 아님");
            pc.Teleport(GoStory.FrostPos(GoStory.FrostAt("stele", 0f, -4f)) + new Vector3(0f, 0.4f, 0f));
            if (GoStory.Flat(GoStory.TargetOf(go, pc.transform.position, out _), GoStory.FrostPos(GoStory.FrostAt("stele", 0f, -4f))) > 0.01f) Fail("고원 안에서는 실제 목표를 가리켜야 함");
            field.Check(pc.transform.position);
            Expect(9, 2, "서리 고개 넘음");                                                     // → 2 go 고원 가운데
            pc.Teleport(GoStory.FrostPos(new Vector2(0f, 8f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(9, 3, "고원 가운데");                                                        // → 3 kill 관측소 무리
            Vector3 sq = GoStory.FrostPos(GoStory.FrostAt("obs", 0f, 20f));
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad[0].Element != GoElement.Cryo || field.Squad[2].Element != GoElement.Anemo || field.Squad.Any(e => !GoFrost.Contains(e.transform.position))) Fail($"관측소 무리 {field.Squad.Count}·빙·풍·고원 안");
            var copy = new System.Collections.Generic.List<FieldEnemy>(field.Squad);
            foreach (var e in copy) Kill(e);
            Expect(9, 4, "관측소 무리");                                                        // → 4 talk 하람
            field.Refresh();
            var hb = field.NpcBody("haram");
            if (!field.NpcShown("haram") || hb == null || GoStory.Flat(hb.transform.position, GoStory.FrostPos(GoStory.HaramObs)) > 0.6f) Fail("하람이 관측소 곁에 안 섰다");
            if (field.NpcShown("bandi")) Fail("반디가 일찍 섰다");
            Talk(pc, ui, "haram", "10장 하람");
            Expect(9, 5, "하람 뒤");                                                            // → 5 follow
            var n = GoStory.NpcOf("haram");
            float len = GoStory.PathLength(n);
            if (len < 100f || len > 300f || !n.FrostPath) Fail($"하람 길 {len:0}m");
            pc.Teleport(GoStory.NpcPos("haram") + new Vector3(0f, 0.4f, -GoStory.FollowLost - 10f));
            field.Follow(pc.transform.position, 2f);
            if (StoryState.FollowDist > 0f) Fail("멀리 있는데 하람이 걸음");
            for (int i = 0; i < 400 && StoryState.StepIndex == 5; i++)
            {
                Near(pc, GoStory.NpcPos("haram"), 3f);
                float before = StoryState.FollowDist;
                field.Follow(pc.transform.position, 1f);
                if (StoryState.StepIndex == 5 && Mathf.Abs(StoryState.FollowDist - before - 6f) > 0.01f && StoryState.FollowDist < len - 0.01f) { Fail($"하람 한 걸음 {StoryState.FollowDist - before}(6 기대)"); break; }
            }
            Expect(9, 6, "비행선 도착");                                                        // → 6 talk 반디
            field.Refresh();
            if (GoStory.Flat(hb.transform.position, GoStory.FrostPos(GoStory.HaramShip)) > 0.6f) Fail("하람이 비행선 곁에 안 섰다");
            if (!field.NpcShown("bandi") || GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.FrostPos(GoStory.BandiShip)) > 0.6f) Fail("반디가 비행선 곁에 안 섰다");
            Talk(pc, ui, "bandi", "10장 반디");
            Expect(9, 7, "반디 뒤");                                                            // → 7 go 산성
            pc.Teleport(GoStory.FrostPos(GoStory.FrostAt("fort", 0f, 30f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(9, 8, "산성 앞");                                                            // → 8 talk 하람
            field.Refresh();
            if (GoStory.Flat(hb.transform.position, GoStory.FrostPos(GoStory.HaramFort)) > 0.6f) Fail("하람이 산성 문 안쪽에 안 섰다");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haram", "10장 끝 하람");
            if (StoryState.Ch != 10 || GoldState.Gold != gold + 3000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 5 || TalentState.Count(GoTalent.Mat.Guide) != guide + 3 || TalentState.Count(GoTalent.Mat.Secret) != secret + 4) Fail("10장 끝·보상(금 3000·교본 3·비급 4·매듭 5)");
            field.Refresh();
            if (StoryState.Done) Fail("10장 뒤에 이야기가 끝남(11장이 있다)");
            _ch10 = "10장 고원 자리·화살표는 돌기둥·무리 빙 셋 풍 하나·하람 따라가기 초당 6·관측소→비행선→산성·반디·보상";
        }

        // ---- 11장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter11(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch11 = "11장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(28, 0);
            StoryState.Restore(10, 0);
            foreach (var off in new[] { GoStory.BawooGate, GoStory.LakeSeal, GoStory.BawooLake, GoStory.BeaconAltar })
                if (!GoFrost.Contains(GoStory.FrostPos(off)) || Mathf.Abs(off.x) > GoFrost.HalfX - 25f || Mathf.Abs(off.y) > GoFrost.HalfZ - 5f) Fail($"11장 자리 {off} 가 고원 밖·가장자리");
            field.Refresh();
            if (!field.NpcShown("haram") || !field.NpcShown("bandi") || field.NpcShown("bawoo")) Fail("11장 첫 단계: 하람·반디만 서야 함");
            Talk(pc, ui, "haram", "11장 하람");
            Expect(10, 1, "하람 뒤");                                                           // → 1 go 문루
            pc.Teleport(GoStory.FrostPos(GoStory.FrostAt("fort", 0f, 30f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(10, 2, "문루 도착");                                                          // → 2 talk 바우
            field.Refresh();
            var bb = field.NpcBody("bawoo");
            if (!field.NpcShown("bawoo") || bb == null || GoStory.Flat(bb.transform.position, GoStory.FrostPos(GoStory.BawooGate)) > 0.6f) Fail("바우가 문루에 안 섰다");
            Talk(pc, ui, "bawoo", "11장 문루 바우");
            Expect(10, 3, "바우 뒤");                                                           // → 3 seal 호숫가
            field.Refresh();
            if (!field.SealCenterOf(10).gameObject.activeSelf || field.SealLampOf(10, 0).Lit) Fail("호숫가 석등이 꺼진 채 안 섰다");
            if (GoStory.Flat(field.SealCenterOf(10).transform.position, GoStory.FrostPos(GoStory.LakeSeal)) > 0.6f) Fail("석등 가운데가 호숫가 자리가 아님");
            if (GoStory.Flat(bb.transform.position, GoStory.FrostPos(GoStory.BawooLake)) > 0.6f) Fail("바우가 호숫가로 안 옮김");
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(10, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                // 틀림(첫째는 달)
            if (StoryState.Progress != 0 || field.SealLampOf(10, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(달·해·별)");
            Pulse(L("moon"), 1f);
            if (StoryState.Progress != 1 || !field.SealLampOf(10, Lamp("moon")).Lit) Fail("달이 안 켜짐");
            Pulse(L("star"), 1f);                                                               // 틀림(둘째는 해) → 모두 꺼짐
            if (StoryState.Progress != 0 || field.SealLampOf(10, Lamp("moon")).Lit) Fail("틀렸는데 안 꺼짐");
            Pulse(L("moon"), 1f);
            Pulse(L("sun"), 1f);
            Expect(10, 3, "둘 켰는데 넘어감");
            Pulse(L("star"), 1f);
            Expect(10, 4, "달·해·별");                                                           // → 4 kill 파수
            Vector3 lake = GoStory.FrostPos(GoStory.FrostAt("lake", 0f, 0f));
            pc.Teleport(lake + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Count(e => e.Element == GoElement.Geo) != 1 || field.Squad.Count(e => e.Element == GoElement.Cryo) != 2 || field.Squad.Any(e => !GoFrost.Contains(e.transform.position)))
                Fail($"파수 무리 {field.Squad.Count}·{string.Join(",", field.Squad.Select(e => e.Element + "@" + e.transform.position.x.ToString("0") + "," + e.transform.position.z.ToString("0")))} (암 1·빙 2·고원 안 기대)");
            var copy = new System.Collections.Generic.List<FieldEnemy>(field.Squad);
            foreach (var e in copy) Kill(e);
            Expect(10, 5, "파수 짐승");                                                          // → 5 talk 바우
            Talk(pc, ui, "bawoo", "11장 호숫가 바우");
            Expect(10, 6, "불씨 받음");                                                          // → 6 defend
            Vector3 altar = GoStory.FrostPos(GoStory.BeaconAltar);
            pc.Teleport(altar + new Vector3(0f, 0.4f, GoStory.DefendStart + 15f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(altar + new Vector3(0f, 0.4f, GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"봉화 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!GoFrost.Contains(e.transform.position)) Fail("물결이 고원 밖에서 나옴");
            for (int guard = 0; guard < 30 && StoryState.StepIndex == 6; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(10, 7, "봉화 물결 셋");                                                       // → 7 talk 바우
            field.Refresh();
            if (GoStory.Flat(bb.transform.position, GoStory.FrostPos(GoStory.BawooGate)) > 0.6f) Fail("바우가 문루로 안 돌아옴");
            Talk(pc, ui, "bawoo", "11장 문루 바우 끝");
            Expect(10, 8, "바우 끝");                                                           // → 8 talk 반디
            field.Refresh();
            if (field.NpcShown("bawoo") || GoStory.Flat(field.NpcBody("haram").transform.position, GoStory.FrostPos(GoStory.HaramShip)) > 0.6f) Fail("바우가 남거나 하람이 비행선 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot);
            Talk(pc, ui, "bandi", "11장 끝 반디");
            if (StoryState.Ch != 11 || GoldState.Gold != gold + 3250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 5) Fail("11장 끝·보상(금 3250·매듭 5)");
            _ch11 = "11장 바우 문루·호숫가·석등 달·해·별(틀리면 꺼짐)·파수 암·빙·봉화 제단 물결 셋(고원 안)·바우 자리 옮김·보상";
        }

        // ---- 12장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter12(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch12 = "12장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(30, 0);
            StoryState.Restore(11, 0);
            foreach (var off in new[] { GoStory.CaveFight, GoStory.BandiCave, GoStory.HeartAt })
                if (!GoFrost.Contains(GoStory.FrostPos(off)) || Mathf.Abs(off.x) > GoFrost.HalfX - 25f || Mathf.Abs(off.y) > GoFrost.HalfZ - 5f) Fail($"12장 자리 {off} 가 고원 밖·가장자리");
            field.Refresh();
            if (!field.NpcShown("haram") || !field.NpcShown("bandi") || GoStory.Flat(field.NpcBody("haram").transform.position, GoStory.FrostPos(GoStory.HaramObs)) > 0.6f) Fail("12장 첫 단계: 하람 관측소·반디");
            Talk(pc, ui, "haram", "12장 하람");
            Expect(11, 1, "하람 뒤");                                                           // → 1 talk 반디
            Talk(pc, ui, "bandi", "12장 반디");
            Expect(11, 2, "반디 뒤");                                                           // → 2 go 얼음굴
            pc.Teleport(GoStory.FrostPos(GoStory.FrostAt("cave", 0f, 0f)) + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(11, 3, "얼음굴 도착");                                                        // → 3 kill 서리 무리
            Vector3 fight = GoStory.FrostPos(GoStory.CaveFight);
            pc.Teleport(fight + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Count(e => e.Element == GoElement.Cryo) != 3 || field.Squad.Count(e => e.Element == GoElement.Anemo) != 1 || field.Squad.Any(e => !GoFrost.Contains(e.transform.position)))
                Fail($"서리 무리 {field.Squad.Count}·{string.Join(",", field.Squad.Select(e => e.Element + "@" + e.transform.position.x.ToString("0") + "," + e.transform.position.z.ToString("0")))} (빙 3·풍 1·고원 안 기대)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(11, 4, "서리 무리");                                                          // → 4 duel 구미호
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"틈새 서리 구미호 {field.Squad.Count}"); return; }
            var fox = field.Squad[0];
            if (!fox.IsStoryBoss || fox.DisplayName != GoLocalization.T("story.boss.riftfox", "틈새 서리 구미호") || fox.Element != GoElement.Cryo || fox.CurrentMove != FieldEnemy.BossMove.Rift) Fail($"구미호 이름·빙·첫 수 틈새 질주 {fox.DisplayName}·{fox.Element}·{fox.CurrentMove}");
            typeof(FieldEnemy).GetMethod("BeginTelegraph", BindingFlags.Instance | BindingFlags.NonPublic)?.Invoke(fox, null);
            var tp = fox.TidePoints;
            if (tp.Count != FieldEnemy.RiftN || Mathf.Abs(GoStory.Flat(tp[0], tp[1]) - FieldEnemy.RiftGap) > 0.5f) Fail($"틈새 질주 원 {tp.Count}");
            else if (!fox.InStrike(tp[4]) || fox.InStrike(tp[4] + (tp[4] - tp[0]).normalized * 8f)) Fail("틈새 질주 원 판정");
            Vector3 before = fox.transform.position, end = tp.Count > 0 ? tp[tp.Count - 1] : before;
            pc.Teleport(fight + new Vector3(15f, 0.4f, -15f));
            fox.ResolveStrike();
            bool blinked = GoStory.Flat(fox.transform.position, end) < 1.5f, stayed = GoStory.Flat(fox.transform.position, before) < 0.1f;
            if (fox.TidePoints.Count != 0 || fox.CurrentMove != FieldEnemy.BossMove.Melee || (!blinked && !stayed)) Fail($"틈새 질주 뒤 — 원 {fox.TidePoints.Count}·다음 수 {fox.CurrentMove}·줄 끝 {blinked}·제자리 {stayed}");
            fox.SetShieldForTest(0f); // 빙 원소라 처음부터 방패가 있다 — 벗겨야 체력이 깎인다
            fox.TakeRaw(fox.Hp - fox.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!fox.Shielded || fox.Element != GoElement.Cryo || field.Squad.Count != 3 || field.Squad[2].EnemyKind != FieldEnemy.Kind.StormWraith) Fail($"2단계 빙 방패·졸개 {fox.Element}·{field.Squad.Count}");
            Kill(fox);
            Expect(11, 5, "틈새 서리 구미호");                                                   // → 5 talk 반디
            field.Refresh();
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.FrostPos(GoStory.BandiCave)) > 0.6f) Fail("반디가 굴 앞에 안 옴");
            Talk(pc, ui, "bandi", "12장 굴 앞 반디");
            Expect(11, 6, "굴 앞 반디 뒤");                                                      // → 6 light 심장 받침
            field.Refresh();
            var heart = field.AltarOf(11);
            if (heart == null || !heart.gameObject.activeSelf || heart.Lit || GoStory.Flat(heart.transform.position, GoStory.FrostPos(GoStory.HeartAt)) > 0.6f) Fail("심장 받침이 꺼진 채 비행선 곁에 안 섬");
            if (GoStory.Flat(field.NpcBody("bandi").transform.position, GoStory.FrostPos(GoStory.BandiShip)) > 0.6f || GoStory.Flat(field.NpcBody("haram").transform.position, GoStory.FrostPos(GoStory.HaramShip)) > 0.6f) Fail("반디·하람이 비행선 곁으로 안 옴");
            Pulse(GoStory.FrostPos(GoStory.HeartAt), 2f);
            Expect(11, 7, "심장 받침 불");                                                       // → 7 talk 반디
            if (!heart.Lit) Fail("심장 받침 불이 안 켜짐");
            Talk(pc, ui, "bandi", "12장 뛰는 심장");
            Expect(11, 8, "뛰는 심장 뒤");                                                       // → 8 talk 하람
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haram", "12장 끝 하람");
            if (StoryState.Ch != 12 || GoldState.Gold != gold + 3500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 5) Fail("12장 끝·보상(금 3500·매듭 6·비급 5)");
            if (!PartyState.Has("story_haram")) Fail("하람이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_haram", GoElement.Pyro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_haram", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Pyro || hh.Trait != HeroTrait.Wisdom || GoWeapons.TypeOf("story_haram") != GoWeapons.Type.Bow) Fail("하람 표(★4 화 활 지)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Zone || kit.Burst.Type != KitBurstType.Rally || Mathf.Abs(kit.Skill.Every - 1.2f) > 0.01f || Mathf.Abs(kit.Burst.Atk - 1.25f) > 0.01f) Fail("하람 한 벌(관측기 zone·맑음 예보 rally)");
            _ch12 = "12장 서리 무리 빙 셋·풍 하나·구미호 틈새 질주(원 다섯·줄 끝 옮김)·2단계 빙 방패·심장 받침·하람 합류(★4 화 활)·보상";
        }


        // ---- 13장 ---------------------------------------------------------------------------------------------

        private static bool WaterAt(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char c = TestMapData.TileAt(Mathf.Clamp(gx, 0, TestMapData.Cols - 1), Mathf.Clamp(gy, 0, TestMapData.RowCount - 1));
            return c == '~' || c == '^' || c == 'B';
        }

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

        // ---- 29장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter29(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch29 = "29장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(64, 0);
            StoryState.Restore(28, 0);
            var kf = KnotField.Instance;
            if (kf == null) { Fail("KnotField 없음"); return; }
            var party0 = new System.Collections.Generic.List<string>(PartyState.MemberIds);
            try
            {
                kf.Refresh();
                field.Refresh();
                Vector3 D(string n) => field.NpcBody(n).transform.position;
                if (!kf.EyeShown || !kf.PillarOn || !kf.SwirlShown || kf.MeadowShown) Fail("29장 앞: 먹구름 눈·기둥이 서고 소용돌이가 돌아야");
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 2) Fail($"29장 앞 매듭 {j} 줄이 눈 등불로 안 감");
                PartyState.Restore(new[] { "story_wanderer", "story_scholar" });
                Talk(pc, ui, "elder", "29장 촌장");
                Expect(28, 1, "촌장 뒤");                                                        // → 1 party 편성
                field.Check(pc.transform.position);
                Expect(28, 1, "두 시대뿐인데 편성 시험이 넘어감");
                ui.Refresh();
                if (!ui.TrackText.Contains("✗") || !ui.TrackText.Contains("✔")) Fail($"편성 줄에 시대 ✔/✗ 가 없음 '{ui.TrackText}'");
                PartyState.Restore(new[] { "story_wanderer", "story_scholar", "story_hanbyeol" });
                field.Check(pc.transform.position);
                Expect(28, 2, "세 시대 편성");                                                   // → 2 sky 눈
                StoryField.Target(out Vector3 st, out _);
                if (GoStory.Flat(st, GoStory.EyePillarPos) > 0.5f) Fail("sky 화살표가 구름섬 서쪽 눈 기둥이 아님");
                pc.Teleport(GoStory.GridPos(3f, 3f) + Vector3.up * 0.4f);
                field.Check(pc.transform.position);
                Expect(28, 2, "땅에서 눈 단계가 넘어감");
                pc.Teleport(GoStory.SkyCenter + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 2, "구름섬 위에서 눈 단계가 넘어감");
                float reach = (GoStory.EyePillarTop - GoStory.EyeCenter.y) / PlayerController.GlideFallSpeed * PlayerController.GlideSpeed;
                if (reach < Mathf.Abs(GoStory.EyeCenter.x - GoStory.EyePillarPos.x) - (GoStory.EyeR - 1.5f)) Fail("눈 기둥 활공이 눈에 못 닿음");
                pc.Teleport(GoStory.EyePos(new Vector2(0f, 8f)) + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 3, "먹구름 눈 윗면");                                                 // → 3 talk 임금
                field.Refresh();
                if (!field.NpcShown("gamyeon") || GoStory.Flat(D("gamyeon"), GoStory.EyePos(GoStory.EyeKing)) > 0.6f || !GoStory.OnEyeTop(D("gamyeon") + Vector3.up * 0.1f)) Fail("임금이 눈 북쪽에 안 섬");
                if (GoStory.NpcName("gamyeon") != GoLocalization.T("story.npc.king", "먹구름 임금") || GoStory.NpcShort("gamyeon") != GoLocalization.T("story.npc.king", "먹구름 임금")) Fail($"임금 이름 '{GoStory.NpcName("gamyeon")}'·'{GoStory.NpcShort("gamyeon")}'");
                Talk(pc, ui, "gamyeon", "29장 임금");
                Expect(28, 4, "임금 뒤");                                                        // → 4 defend 등불
                Vector3 lamp = GoStory.EyePos(Vector2.zero);
                pc.Teleport(lamp + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
                pc.Teleport(lamp + new Vector3(0f, 0.3f, 3f));
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"등불 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
                foreach (var e in field.Squad) if (!GoStory.OnEyeTop(e.transform.position) && GoStory.Flat(e.transform.position, GoStory.EyeCenter) > GoStory.EyeR - 0.5f) Fail("물결이 눈 밖에서 나옴");
                for (int guard = 0; guard < 40 && StoryState.StepIndex == 4; guard++)
                {
                    field.DefendTick(pc.transform.position, 0.1f);
                    foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
                }
                Expect(28, 5, "등불 물결 셋");                                                   // → 5 duel 참몸
                field.Check(pc.transform.position);
                if (field.Squad.Count != 1) { Fail($"먹구름 임금 참몸 {field.Squad.Count}"); return; }
                var king = field.Squad[0];
                if (!king.IsStoryBoss || king.DisplayName != GoLocalization.T("story.boss.kingtrue", "먹구름 임금") || king.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"참몸 이름·첫 수 {king.DisplayName}·{king.CurrentMove}");
                if (GoStory.Flat(king.transform.position, GoStory.EyePos(GoStory.EyeDuel)) > 3f || !GoStory.OnSkyLayer(king.transform.position)) Fail("참몸이 눈 남쪽에 안 섬");
                king.SetShieldForTest(0f);
                king.TakeRaw(king.Hp - king.MaxHp * 0.45f, Color.white);
                field.DuelTickForTest();
                if (!king.Shielded || field.Squad.Count != 3) Fail($"2단계 뇌 방패·졸개 {field.Squad.Count}");
                foreach (var e in field.Squad) if (!GoStory.OnSkyLayer(e.transform.position)) Fail("졸개가 눈 밖");
                Kill(king);
                Expect(28, 6, "먹구름 임금 참몸");                                              // → 6 talk 해솔
                kf.Refresh();
                if (kf.SwirlShown || !kf.MeadowShown) Fail("보스 뒤 소용돌이가 걷혀 맑은 뜰이어야");
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 0 || !kf.FireShown(j)) Fail($"보스 뒤 매듭 {j}: 줄을 거두고 불만 남아야");
                field.Refresh();
                if (!field.NpcShown("haesol") || GoStory.Flat(D("haesol"), GoStory.EyePos(GoStory.EyeHaesol)) > 0.6f) Fail("해솔이 눈 북동쪽에 안 섬");
                if (field.NpcShown("gamyeon")) Fail("보스 뒤 임금이 남음");
                Talk(pc, ui, "haesol", "29장 해솔");
                Expect(28, 7, "해솔 뒤");                                                        // → 7 go 광장
                Vector3 plaza = GoStory.GridPos(1.2f, 3.2f);
                pc.Teleport(GoStory.EyePos(Vector2.zero) + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 7, "눈 위에서 광장 단계가 넘어감");
                pc.Teleport(plaza + Vector3.up * 0.4f);
                field.Check(pc.transform.position);
                Expect(28, 8, "청하 광장");                                                      // → 8 talk 촌장
                int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
                Talk(pc, ui, "elder", "29장 끝 촌장");
                if (StoryState.Ch != 29 || GoldState.Gold != gold + 12000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("29장 끝·보상(금 12000·교본 10·비급 8·매듭 10)");
                if (StoryState.Done || !StoryState.Locked) Fail("29장 뒤 30장이 여정 등급 66 에 열리는 잠김이어야 함(1차 결말 — 9부가 이어진다)");
                kf.Refresh();
                if (kf.SwirlShown || !kf.MeadowShown) Fail("29장 뒤 눈이 맑은 뜰로 남아야");
                _ch29 = "29장 편성 시험(두 시대 ✕·세 시대 ○·줄에 시대 ✔/✗)·눈 기둥 sky(땅·구름섬 ✕·눈 윗면 ○)·임금 이름 덮음·등불 지키기 물결 셋(눈 안)·참몸 뇌 2단계 방패(눈 남쪽)·소용돌이 걷힘·줄 거둠·해솔 눈 북동쪽·광장 go(눈 위 ✕)·보상(🪢 10)·이야기 표 끝";
            }
            finally { PartyState.Restore(party0); }
        }

        // ---- 30장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter30(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch30 = "30장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(66, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            StoryState.Restore(28, 0);
            field.Refresh();
            if (field.NpcShown("chorong")) Fail("30장 앞인데 초롱이 섬");
            StoryState.Restore(29, 0);
            area.Refresh();
            field.Refresh();
            if (StoryState.Done) Fail("30장 앞이 끝으로 셈");
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(D("hanbyeol"), GoStory.AreaPos("skyport:port", GoStory.SunkPortHanbyeol)) > 0.6f) Fail("30장 첫 단계: 한별이 은하 나루 별배 곁에 안 섬");
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), GoStory.AreaPos("skyport:port", GoStory.PortBandi)) > 0.6f) Fail("30장 첫 단계: 반디가 착륙판에 안 섬");
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f || !am.Contains(D("chorong"))) Fail("초롱이 시계방 서쪽 앞에 안 섬");
            for (int i = 0; i < 3; i++) if (!area.AmberPartOn("amber:crystal" + i)) Fail($"30장 앞인데 굳은 자리 {i} 가 녹아 있음");
            Talk(pc, ui, "hanbyeol", "30장 한별");
            Expect(29, 1, "한별 뒤");                                                            // → 1 go 고개 어귀
            field.Refresh();
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("한별 뒤 반디가 시계방 남서쪽으로 안 옮김");
            Vector3 mouth = GoStory.AreaPos("amber:pass", GoStory.AmberPassGo);
            if (!am.Contains(mouth) || GoStory.Flat(mouth, am.GateSiteObj.Pos) < 20f) Fail("고개 어귀 자리가 땅 안·경계비 곁이 아님");
            pc.Teleport(GoAreas.Skyport.Center + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 1, "은하 나루에서 어귀 단계가 넘어감");
            pc.Teleport(am.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 1, "돌기둥으로 막 들어섰는데 어귀 단계가 넘어감(경계비 곁은 어귀가 아님)");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 2, "고개 어귀");                                                          // → 2 kill 네거리
            Vector3 cross = GoStory.AreaPos("amber:cross", GoStory.AmberCrossKill);
            pc.Teleport(cross + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !am.Contains(e.transform.position))) Fail($"네거리 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(29, 3, "네거리 결정 짐승");                                                   // → 3 talk 초롱
            Talk(pc, ui, "chorong", "30장 초롱");
            Expect(29, 4, "초롱 뒤");                                                            // → 4 light 신호등 앞
            for (int i = 0; i < 3; i++)
            {
                Vector3 spot = GoStory.AreaPos("amber:cross", GoStory.AmberCrystalAt[i]);
                if (GoStory.Flat(GoStory.TargetOf(StoryState.Current, out _), spot) > 0.1f) Fail($"굳은 자리 {i} 단계 목표 자리");
                area.Refresh();
                for (int k = 0; k < 3; k++) if (area.AmberPartOn("amber:crystal" + k) != (k >= i)) Fail($"굳은 자리 {i} 앞인데 결정 {k} 상태 {area.AmberPartOn("amber:crystal" + k)}");
                pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(29, 4 + i, $"굳은 자리 {i} — 멀리서 쏜 원소로 녹음");
                Pulse(spot, 3f);
                Expect(29, 5 + i, $"굳은 자리 {i} 녹임");
                area.Refresh();
                if (area.AmberPartOn("amber:crystal" + i)) Fail($"굳은 자리 {i} 를 녹였는데 결정이 남음");
                for (int k = i + 1; k < 3; k++) if (!area.AmberPartOn("amber:crystal" + k)) Fail($"굳은 자리 {i} 뒤에 결정 {k} 가 미리 녹음");
            }
            if (area.AmberLampsGreen || !area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart")) Fail("굳은 자리 셋 뒤 신호등·돔·심장이 벌써 풀림(다음 장 몫)");
            Expect(29, 7, "굳은 자리 셋 뒤");                                                    // → 7 talk 초롱
            field.Refresh();
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "30장 끝 초롱");
            if (StoryState.Ch != 30 || GoldState.Gold != gold + 7750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("30장 끝·보상(금 7750·교본 7·비급 6·매듭 7)");
            field.Refresh();
            if (!field.NpcShown("chorong") || !field.NpcShown("bandi") || !field.NpcShown("hanbyeol")) Fail("30장 뒤 초롱·반디·한별이 안 섬");
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f || GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("30장 뒤 초롱·반디 자리");
            _ch30 = "30장 한별 나루 곁·반디 착륙판→시계방·고개 어귀 go(나루·경계비 곁에선 안 넘어감)·네거리 무리 넷(땅 안)·초롱 시계방 서쪽·굳은 자리 셋 차례로 녹음(멀리서 쏜 원소 ✕·다음 결정 미리 안 녹음)·신호등·돔·심장 그대로·보상";
        }

        // ---- 31장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter31(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch31 = "31장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(68, 0);
            StoryState.Restore(30, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 market = GoStory.AreaPos("amber:market", Vector2.zero);
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f) Fail("31장 첫 단계: 초롱이 시계방 앞에 안 섬");
            if (field.NpcShown("neoul") || field.NpcShown("partthief")) Fail("31장 앞인데 너울·도둑이 섬");
            if (!area.AmberPartOn("amber:dome") || area.AmberLampsGreen || area.AmberWinding) Fail("31장 앞 돔·신호등·바늘 처음 모습");
            Talk(pc, ui, "chorong", "31장 초롱");
            Expect(30, 1, "초롱 뒤");                                                            // → 1 seal 석등
            field.Refresh();
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:market", GoStory.ChorongMarket)) > 0.6f) Fail("초롱이 장터 동쪽 앞으로 안 옮김");
            if (!field.SealCenterOf(30).gameObject.activeSelf || field.SealLampOf(30, 0).Lit) Fail("장터 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++)
            {
                Vector3 lp = field.SealLampOf(30, i).transform.position;
                if (GoStory.Flat(lp, market) > GoStory.SealR + 1f || GoStory.Flat(lp, market) < GoStory.AmberDomeR + 2f || !am.Contains(lp)) Fail($"장터 석등 {i} 자리(돔 밖 고리) {GoStory.Flat(lp, market):0.0}m");
            }
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(30, Lamp(id)).transform.position;
            Pulse(L("star"), 1f);                                                                // 틀림(첫째는 해)
            if (StoryState.Progress != 0 || field.SealLampOf(30, Lamp("star")).Lit) Fail("차례 틀린 별이 켜짐(해·달·별)");
            Pulse(L("sun"), 1f);
            Pulse(L("moon"), 1f);
            Expect(30, 1, "둘 켰는데 넘어감");
            Pulse(L("star"), 1f);
            Expect(30, 2, "해·달·별");                                                           // → 2 talk 너울(돔이 깨진다)
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("석등을 켠 뒤 돔만 깨져야(심장·신호등은 그대로)");
            if (!field.NpcShown("neoul") || GoStory.Flat(D("neoul"), GoStory.AreaPos("amber:market", GoStory.NeoulAt)) > 0.6f) Fail("너울이 장터 가운데에 안 섬");
            Talk(pc, ui, "neoul", "31장 너울");
            Expect(30, 3, "너울 뒤");                                                            // → 3 chase 조각 도둑
            field.Refresh();
            if (!field.NpcShown("partthief")) Fail("조각 도둑이 안 보임");
            float len = 0f;
            for (int i = 1; i < GoStory.AmberThiefPath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("partthief", i - 1), GoStory.RunPoint("partthief", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.AmberThiefPath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"도둑 평균 {avg:0.0}m/초");
            Physics.SyncTransforms();
            for (int i = 0; i < GoStory.AmberThiefPath.Length; i++)
            {
                Vector3 a0 = GoStory.RunPoint("partthief", i), a1 = GoStory.RunPoint("partthief", (i + 1) % GoStory.AmberThiefPath.Length);
                if (!am.Contains(a0)) Fail($"도둑 길 {i} 이 땅 밖");
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"도둑 길 {i} 곁에 충돌(시계방·신상·결정·장터…) {pt}"); break; }
                }
            }
            Vector3 t0 = GoStory.RunPoint("partthief", 0);
            Vector3 me = t0 + new Vector3(3f, 0f, 8f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 3) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(3f, 0f, 8f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 도둑이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 도둑을 못 잡음");
            Expect(30, 4, "도둑 잡음");                                                          // → 4 talk 너울
            field.Refresh();
            if (field.NpcShown("partthief")) Fail("잡은 뒤 도둑이 남음");
            Talk(pc, ui, "neoul", "31장 너울 저울추");
            Expect(30, 5, "너울 저울추");                                                        // → 5 defend 괘종시계
            area.Refresh();
            if (!area.AmberWinding) Fail("괘종시계 지키기 중인데 바늘이 안 돎");
            Vector3 clockAlt = GoStory.AreaPos("amber:clock", GoStory.ClockDefend);
            pc.Teleport(clockAlt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(clockAlt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"괘종시계 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - clockAlt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!am.Contains(e.transform.position)) Fail("물결이 굳은 거리 밖에서 나옴");
                if (bearing > 50f && bearing < 130f) Fail($"물결이 시계방 쪽(동)에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 5; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(30, 6, "괘종시계 물결 셋");                                                   // → 6 talk 초롱
            area.Refresh();
            field.Refresh();
            if (area.AmberWinding) Fail("지킨 뒤에도 바늘이 돎");
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f) Fail("초롱이 시계방 앞에 안 돌아옴");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "31장 끝 초롱");
            if (StoryState.Ch != 31 || GoldState.Gold != gold + 8000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("31장 끝·보상(금 8000·교본 7·비급 6·매듭 7)");
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("31장 뒤 돔은 깨진 채·심장·신호등은 그대로");
            if (!field.NpcShown("neoul") || !field.NpcShown("chorong") || GoStory.Flat(D("neoul"), GoStory.AreaPos("amber:market", GoStory.NeoulAt)) > 0.6f) Fail("31장 뒤 너울·초롱 자리");
            _ch31 = "31장 초롱 시계방→장터 동쪽·장터 석등 해·달·별(틀린 차례 ✕·돔 밖 고리)·돔 깨짐·너울 장터 가운데·조각 도둑 길(11점 땅 안·충돌 없음·평균 속도)·걸어선 못 잡고 달려서 잡음·괘종시계 지키기 물결 셋(동쪽 뺌·굳은 거리 안)·바늘 돎(그 단계만)·보상";
        }

        // ---- 32장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter32(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch32 = "32장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(70, 0);
            StoryState.Restore(31, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 towerPos = GoStory.AreaPos("amber:tower", Vector2.zero);
            if (!field.NpcShown("saegil") || GoStory.Flat(D("saegil"), GoStory.AreaPos("amber:tower", GoStory.SaegilAt)) > 0.6f) Fail("새길이 탑 발치 남쪽에 안 섬");
            if (!area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("32장 앞 심장·신호등 처음 모습");
            Talk(pc, ui, "saegil", "32장 새길");
            Expect(31, 1, "새길 뒤");                                                            // → 1 climb 탑
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("amber:tower");
            var core = area.SiteObject("amber", "tower").transform.Find("Tower_core");
            if (Mathf.Abs(top.y - GoStory.AmberTowerHeight - towerPos.y) > 0.1f) Fail("탑 꼭대기 높이 표");
            if (core == null || core.GetComponent<Collider>() == null || Mathf.Abs(core.GetComponent<Collider>().bounds.max.y - top.y) > 0.1f) Fail("부양탑 심 충돌·윗면이 꼭대기 표와 안 맞음");
            if (!Physics.Raycast(top + new Vector3(-GoStory.AmberTowerHalf - 4f, -6f, 0f), Vector3.right, 4f)) Fail("부양탑이 곧은 벽이 아니다");
            pc.Teleport(towerPos + new Vector3(8f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(31, 1, "땅에서 탑 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(31, 2, "탑 꼭대기");                                                          // → 2 light 태엽 심장
            pc.Teleport(towerPos + new Vector3(8f, 0.4f, 0f));                                   // 땅에서는 불이 안 닿는다
            Pulse(towerPos, 4f);
            Expect(31, 2, "땅에서 쏜 원소로 태엽 심장이 녹음");
            area.Refresh();
            if (!area.AmberPartOn("amber:heart")) Fail("땅에서 쏘았는데 심장이 녹음");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            Pulse(towerPos, 1f);
            Expect(31, 3, "꼭대기에서 태엽 심장");                                               // → 3 talk 새길
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("심장을 녹인 뒤 심장만 꺼지고 신호등은 아직 빨강이어야");
            Talk(pc, ui, "saegil", "32장 새길 발치");
            Expect(31, 4, "새길 발치");                                                          // → 4 duel 거북
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"호박 등딱지 거북 {field.Squad.Count}"); return; }
            var turtle = field.Squad[0];
            if (!turtle.IsStoryBoss || turtle.DisplayName != GoLocalization.T("story.boss.turtle", "호박 등딱지 거북") || turtle.Element != GoElement.Geo || turtle.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"거북 이름·암·첫 수 {turtle.DisplayName}·{turtle.Element}·{turtle.CurrentMove}");
            if (!am.Contains(turtle.transform.position) || GoStory.Flat(turtle.transform.position, GoStory.AreaPos("amber:tower", GoStory.AmberTurtleAt)) > 12f) Fail("거북이 탑 밑 광장이 아님");
            turtle.SetShieldForTest(0f);
            turtle.TakeRaw(turtle.Hp - turtle.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!turtle.Shielded || turtle.Element != GoElement.Geo || field.Squad.Count != 3) Fail($"2단계 암 방패·졸개 {turtle.Element}·{field.Squad.Count}");
            Kill(turtle);
            Expect(31, 5, "호박 등딱지 거북");                                                   // → 5 talk 초롱
            area.Refresh();
            field.Refresh();
            if (!area.AmberLampsGreen) Fail("거북을 쓰러뜨린 뒤 신호등이 초록이 안 됨");
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:tower", GoStory.ChorongTower)) > 0.6f) Fail("초롱이 탑 밑 광장에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "32장 끝 초롱");
            if (StoryState.Ch != 32 || GoldState.Gold != gold + 9000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 7) Fail("32장 끝·보상(금 9000·교본 8·비급 7·매듭 8)");
            if (!PartyState.Has("story_chorong")) Fail("초롱이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_chorong", GoElement.Geo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_chorong", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Geo || hh.Trait != HeroTrait.Wisdom || GoWeapons.TypeOf("story_chorong") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_chorong") != GoEra.Modern) Fail("초롱 표(★4 암 법구 지략·현대)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Zone || kit.Burst.Type != KitBurstType.Rain || Mathf.Abs(kit.Skill.R - 5f) > 0.01f) Fail("초롱 한 벌(태엽 괘종 zone·되감은 시간 rain)");
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:heart") || !area.AmberLampsGreen) Fail("9부 뒤 태엽 심장은 꺼지고 신호등은 초록이어야");
            if (!field.NpcShown("saegil") || !field.NpcShown("chorong") || !field.NpcShown("neoul") || !field.NpcShown("bandi") || !field.NpcShown("hanbyeol")) Fail("9부 뒤 새길·초롱·너울·반디·한별이 안 섬");
            _ch32 = "32장 새길 탑 발치·부양탑 12m 벽/꼭대기(땅에선 안 넘어감)·태엽 심장은 꼭대기에서만(땅에서 쏘면 안 녹음)·심장 꺼짐(신호등은 아직 빨강)·호박 등딱지 거북 암 2단계 방패·신호등 초록·초롱 탑 밑 광장·초롱 합류(★4 암 법구 zone·rain)·보상";
        }

        // ---- 33장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter33(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch33 = "33장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(72, 0);
            StoryState.Restore(32, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("33장 첫 단계: 반디가 굳은 거리 시계방 곁에 안 섬");
            if (!field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f || !vt.Contains(D("maru"))) Fail("마루가 야적장 창고 앞에 안 섬");
            if (field.NpcShown("carrier") || field.NpcShown("haram")) Fail("33장 첫 단계인데 드론·하람이 섬");
            if (!vt.Open()) Fail("9부 뒤인데 갈무리 벌이 안 열림");
            Talk(pc, ui, "bandi", "33장 반디");
            Expect(32, 1, "반디 뒤");                                                            // → 1 talk 하람
            field.Refresh();
            if (!field.NpcShown("haram") || GoStory.Flat(D("haram"), GoStory.FrostPos(GoStory.HaramObs)) > 0.6f || !GoFrost.Contains(D("haram"))) Fail("하람이 고원 관측소에 안 섬");
            if (GoStory.Flat(D("bandi"), GoStory.FrostPos(GoStory.BandiObs)) > 0.6f) Fail("반디가 하람 곁에 안 섬");
            Talk(pc, ui, "haram", "33장 하람");
            Expect(32, 2, "하람 뒤");                                                            // → 2 go 벌 어귀
            field.Refresh();
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("vault:yard", GoStory.VaultBandi)) > 0.6f) Fail("반디가 벌 창고 앞에 안 섬");
            Vector3 mouth = GoStory.AreaPos("vault:pass", GoStory.VaultPassGo);
            if (!vt.Contains(mouth) || GoStory.Flat(mouth, vt.ArrivalPos) < GoStory.GoR + 2f) Fail("벌 어귀 자리가 땅 안·돌기둥 도착 자리에서 걸어갈 거리가 아님");
            pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 2, "고원에서 어귀 단계가 넘어감");
            pc.Teleport(vt.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 2, "돌기둥으로 막 들어섰는데 어귀 단계가 넘어감");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 3, "벌 어귀");                                                            // → 3 kill 야적장
            Vector3 yardKill = GoStory.AreaPos("vault:yard", GoStory.VaultYardKill);
            pc.Teleport(yardKill + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !vt.Contains(e.transform.position))) Fail($"야적장 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(32, 4, "야적장 결정 짐승");                                                   // → 4 chase 운반 드론
            field.Refresh();
            if (!field.NpcShown("carrier")) Fail("운반 드론이 야적장에 안 섬");
            float len = 0f;
            for (int i = 1; i < GoStory.VaultDronePath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("carrier", i - 1), GoStory.RunPoint("carrier", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.VaultDronePath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"드론 평균 {avg:0.0}m/초");
            Physics.SyncTransforms();
            for (int i = 0; i + 1 < GoStory.VaultDronePath.Length; i++)
            {
                Vector3 a0 = GoStory.RunPoint("carrier", i), a1 = GoStory.RunPoint("carrier", i + 1);
                if (!vt.Contains(a0)) Fail($"드론 길 {i} 이 땅 밖");
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"드론 길 {i} 곁에 충돌(창고·컨테이너·동력 기둥·금고 벽…) {pt}"); break; }
                }
            }
            vt.TrySite("vault", out var vaultSite);
            if (GoStory.Flat(GoStory.RunPoint("carrier", GoStory.VaultDronePath.Length - 1), vaultSite.Pos + new Vector3(0f, 0f, GoStory.VaultR)) > 6f) Fail("드론 길 끝이 금고 문 앞이 아님");
            Vector3 t0 = GoStory.RunPoint("carrier", 0);
            Vector3 me = t0 + new Vector3(3f, 0f, 8f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 4) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(3f, 0f, 8f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 드론이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 드론을 못 잡음");
            Expect(32, 5, "드론 잡음");                                                          // → 5 talk 마루
            field.Refresh();
            if (field.NpcShown("carrier")) Fail("잡은 뒤 드론이 남음");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "maru", "33장 끝 마루");
            if (StoryState.Ch != 33 || GoldState.Gold != gold + 8500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("33장 끝·보상(금 8500·교본 8·비급 6·매듭 8)");
            area.Refresh();
            field.Refresh();
            if (!field.NpcShown("maru") || !field.NpcShown("bandi") || !field.NpcShown("chorong") || !field.NpcShown("neoul") || !field.NpcShown("saegil") || !field.NpcShown("hanbyeol")) Fail("33장 뒤 마루·반디·초롱·너울·새길·한별이 안 섬(장 이어 서기 ChTo)");
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("vault:yard", GoStory.VaultBandi)) > 0.6f || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("33장 뒤 반디·마루 자리");
            _ch33 = "33장 반디 굳은 거리→고원 관측소(하람 곁)→벌 창고 앞·하람 관측소·벌 어귀 go(고원·돌기둥 도착 자리에선 안 넘어감)·야적장 무리 넷(땅 안)·운반 드론 길(11점 땅 안·충돌 없음·끝 = 금고 문 앞·평균 속도)·걸어선 못 잡고 달려서 잡음·마루 창고 앞·보상·9부 인물이 장을 이어 섬";
        }

        // ---- 34장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter34(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch34 = "34장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(74, 0);
            StoryState.Restore(33, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("34장 첫 단계: 마루가 야적장 창고 앞에 안 섬");
            if (field.NpcShown("sodam")) Fail("34장 앞인데 소담이 섬");
            foreach (var k in new[] { "vault:granary_door", "vault:pylon0orb", "vault:pylon1orb", "vault:door" }) if (!area.VaultPartOn(k)) Fail($"34장 처음 모습: {k} 가 없음");
            Talk(pc, ui, "maru", "34장 마루");
            Expect(33, 1, "마루 뒤");                                                            // → 1 seal 곳간 석등
            field.Refresh();
            Vector3 granary = GoStory.AreaPos("vault:granary", Vector2.zero);
            if (GoStory.Flat(D("maru"), GoStory.AreaPos("vault:granary", GoStory.MaruGranary)) > 0.6f) Fail("마루가 곳간 동남쪽에 안 섬");
            if (!field.SealCenterOf(33).gameObject.activeSelf || field.SealLampOf(33, 0).Lit) Fail("곳간 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++)
            {
                Vector3 lp = field.SealLampOf(33, i).transform.position;
                if (GoStory.Flat(lp, granary) > GoStory.SealR + 1f || GoStory.Flat(lp, granary) < 5f || !vt.Contains(lp)) Fail($"곳간 석등 {i} 자리 {GoStory.Flat(lp, granary):0.0}m");
            }
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(33, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                 // 틀림(첫째는 별)
            if (StoryState.Progress != 0 || field.SealLampOf(33, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(별·해·달)");
            Pulse(L("star"), 1f);
            Pulse(L("sun"), 1f);
            Expect(33, 1, "둘 켰는데 넘어감");
            Pulse(L("moon"), 1f);
            Expect(33, 2, "별·해·달");                                                           // → 2 talk 소담(곳간 문이 열린다)
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:granary_door") || !area.VaultPartOn("vault:pylon0orb") || !area.VaultPartOn("vault:door")) Fail("석등을 켠 뒤 곳간 문만 열려야(동력 기둥·금고 문은 그대로)");
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:granary", GoStory.SodamGranary)) > 0.6f) Fail("소담이 곳간 문 앞 서쪽에 안 섬");
            Talk(pc, ui, "sodam", "34장 소담");
            Expect(33, 3, "소담 뒤");                                                            // → 3 defend 곳간
            Vector3 alt = GoStory.AreaPos("vault:granary", GoStory.GranaryDefend);
            pc.Teleport(alt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(alt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"곳간 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - alt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!vt.Contains(e.transform.position)) Fail("물결이 갈무리 벌 밖에서 나옴");
                if (bearing < 40f || bearing > 320f) Fail($"물결이 곳간(북) 쪽에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 3; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(33, 4, "곳간 물결 셋");                                                       // → 4 light 서쪽 동력 기둥
            for (int p = 0; p < 2; p++)
            {
                Vector3 spot = GoStory.AreaPos("vault:pylon" + p, Vector2.zero);
                area.Refresh();
                if (area.VaultPartOn("vault:pylon" + (1 - p) + "orb") != (p == 0)) Fail($"동력 기둥 {p} 앞 알 상태");
                pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(33, 4 + p, $"동력 기둥 {p} — 멀리서 쏜 원소로 꺼짐");
                Pulse(spot, 3f);
                Expect(33, 5 + p, $"동력 기둥 {p} 끔");
                area.Refresh();
                if (area.VaultPartOn("vault:pylon" + p + "orb")) Fail($"동력 기둥 {p} 를 껐는데 알이 남음");
            }
            Expect(33, 6, "동력 기둥 둘 뒤");                                                    // → 6 talk 소담(금고 문이 열린다)
            field.Refresh();
            if (area.VaultPartOn("vault:pylon0orb") || area.VaultPartOn("vault:pylon1orb") || area.VaultPartOn("vault:door")) Fail("동력 기둥 둘을 끈 뒤 알 둘·금고 문이 사라져야");
            if (!area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:deep")) Fail("34장에 핵·해미 진열장·깊은 진열장이 바뀜(35장 몫)");
            vt.TrySite("vault", out var vs);
            Physics.SyncTransforms();
            if (Physics.Raycast(vs.Pos + new Vector3(1.5f, 1.5f, 20f), Vector3.back, 9f)) Fail("금고 문이 열렸는데 충돌이 남음");
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamDoor)) > 0.6f) Fail("소담이 금고 문 앞에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "sodam", "34장 끝 소담");
            if (StoryState.Ch != 34 || GoldState.Gold != gold + 8750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("34장 끝·보상(금 8750·교본 8·비급 6·매듭 8)");
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:door") || area.VaultPartOn("vault:pylon0orb") || !area.VaultPartOn("vault:core")) Fail("34장 뒤 금고 문은 열린 채·핵은 그대로");
            if (!field.NpcShown("sodam") || !field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("34장 뒤 소담·마루 자리");
            _ch34 = "34장 마루 곳간 동남쪽·곳간 석등 별·해·달(틀린 차례 ✕·둘 켠 채 안 넘어감)·곳간 문 열림·소담 곳간 서쪽→금고 문 앞·곳간 지키기 물결 셋(곳간 북쪽 뺌·갈무리 벌 안)·동력 기둥 둘 차례로 끔(멀리서 쏜 원소 ✕·알 사라짐)·금고 문 열림(충돌 사라짐)·핵·해미·깊은 진열장 그대로·보상";
        }

        // ---- 35장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter35(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch35 = "35장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(76, 0);
            StoryState.Restore(34, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            vt.TrySite("vault", out var vs);
            Vector3 vp = vs.Pos;
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamDoor)) > 0.6f) Fail("35장 첫 단계: 소담이 금고 문 앞에 안 섬");
            if (field.NpcShown("haemi") || field.NpcShown("garmuri")) Fail("35장 첫 단계인데 해미·갈무리가 섬");
            if (area.VaultPartOn("vault:door") || !area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:deep")) Fail("35장 처음 모습: 문 열림·핵·해미 진열장 그대로·깊은 진열장 없음");
            Talk(pc, ui, "sodam", "35장 소담");
            Expect(34, 1, "소담 뒤");                                                            // → 1 go 금고 안
            field.Refresh();
            if (GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamVault)) > 0.6f) Fail("소담이 금고 안으로 안 들어감");
            Vector3 inside = GoStory.AreaPos("vault:vault", GoStory.VaultGoIn);
            pc.Teleport(vp + new Vector3(0f, 0.4f, 15f));                                        // 문 앞
            field.Check(pc.transform.position);
            Expect(34, 1, "문 앞에서 금고 안 단계가 넘어감");
            pc.Teleport(inside + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 2, "금고 안");                                                            // → 2 talk 해미
            field.Refresh();
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiAt)) > 0.6f) Fail("해미가 진열장 속에 안 섬");
            Talk(pc, ui, "haemi", "35장 해미");
            Expect(34, 3, "해미 뒤");                                                            // → 3 climb 기록 기둥
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("vault:vault");
            var pillar = area.SiteObject("vault", "vault").transform.Find("Vault_pillar");
            if (Mathf.Abs(top.y - GoStory.VaultPillarH - vp.y) > 0.1f) Fail("기록 기둥 꼭대기 높이 표");
            if (pillar == null || pillar.GetComponent<Collider>() == null || Mathf.Abs(pillar.GetComponent<Collider>().bounds.max.y - top.y) > 0.1f) Fail("기록 기둥 충돌·윗면이 꼭대기 표와 안 맞음");
            if (!Physics.Raycast(top + new Vector3(-GoStory.VaultPillarW * 0.5f - 3f, -4f, 0f), Vector3.right, 3f)) Fail("기록 기둥이 곧은 벽이 아니다");
            pc.Teleport(vp + new Vector3(6f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 3, "땅에서 기둥 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 4, "기둥 꼭대기");                                                        // → 4 talk 갈무리
            field.Refresh();
            if (!field.NpcShown("garmuri") || GoStory.Flat(D("garmuri"), GoStory.AreaPos("vault:vault", GoStory.VaultGarmuriAt)) > 0.6f) Fail("갈무리가 기둥 곁에 안 섬");
            if (GoStory.Flat(top, D("garmuri")) > GoStory.TalkR) Fail("기둥 꼭대기에서 갈무리 대화 거리 밖");
            if (!area.VaultPartOn("vault:core")) Fail("갈무리와 이야기하기 전에 핵이 꺼짐");
            Talk(pc, ui, "garmuri", "35장 갈무리");
            Expect(34, 5, "갈무리 뒤");                                                          // → 5 duel 여왕
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi")) Fail("갈무리 뒤 핵만 꺼지고 해미 진열장은 그대로여야");
            if (field.NpcShown("garmuri")) Fail("갈무리 대화 뒤 갈무리가 남음");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"금고 파수 드론 여왕 {field.Squad.Count}"); return; }
            var queen = field.Squad[0];
            if (!queen.IsStoryBoss || queen.DisplayName != GoLocalization.T("story.boss.queen", "금고 파수 드론 여왕") || queen.Element != GoElement.Anemo || queen.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"여왕 이름·풍·첫 수 {queen.DisplayName}·{queen.Element}·{queen.CurrentMove}");
            if (!vt.Contains(queen.transform.position) || GoStory.Flat(queen.transform.position, GoStory.AreaPos("vault:vault", GoStory.VaultQueenAt)) > 14f) Fail("여왕이 금고 문 앞 광장이 아님");
            queen.SetShieldForTest(0f);
            queen.TakeRaw(queen.Hp - queen.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!queen.Shielded || queen.Element != GoElement.Anemo || field.Squad.Count != 3) Fail($"2단계 풍 방패·졸개 {queen.Element}·{field.Squad.Count}");
            Kill(queen);
            Expect(34, 6, "금고 파수 드론 여왕");                                                // → 6 talk 해미(진열장이 깨진다)
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:core")) Fail("여왕을 쓰러뜨린 뒤 해미 진열장이 깨지고 핵은 꺼진 채여야");
            if (!field.NpcShown("haemi")) Fail("진열장이 깨졌는데 해미가 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haemi", "35장 끝 해미");
            if (StoryState.Ch != 35 || GoldState.Gold != gold + 9750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 7) Fail("35장 끝·보상(금 9750·교본 9·비급 7·매듭 9)");
            if (!PartyState.Has("story_haemi")) Fail("해미가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_haemi", GoElement.Dendro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_haemi", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Dendro || hh.Trait != HeroTrait.Command || GoWeapons.TypeOf("story_haemi") != GoWeapons.Type.Sword || GoStory.MemberEra("story_haemi") != GoEra.Future) Fail("해미 표(★4 초 한손검 통솔·미래)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Dash || kit.Burst.Type != KitBurstType.Infuse || Mathf.Abs(kit.Skill.Len - 5f) > 0.01f) Fail("해미 한 벌(씨앗 가르기 dash·싹 틔우는 칼 infuse)");
            area.Refresh();
            field.Refresh();
            if (!area.VaultPartOn("vault:deep") || area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:core") || area.VaultPartOn("vault:door")) Fail("10부 뒤 가장 깊은 진열장이 드러나고 해미 진열장·핵·문은 열린 채여야");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiDeep)) > 0.6f || field.NpcShown("garmuri")) Fail("10부 뒤 해미는 가장 깊은 진열장 곁(36장 첫 단계 자리)·갈무리는 없음");
            if (!field.NpcShown("sodam") || !field.NpcShown("maru")) Fail("10부 뒤 소담·마루가 안 섬");
            _ch35 = "35장 소담 금고 문 앞→안·금고 안 go(문 앞에선 안 넘어감)·해미 진열장 속·기록 기둥 9m 벽/꼭대기(땅에선 안 넘어감)·갈무리 기둥 곁(꼭대기에서 대화 거리 안)·핵 꺼짐(갈무리 뒤)·금고 파수 드론 여왕 풍 2단계 방패·해미 진열장 깨짐·해미 합류(★4 초 한손검 dash·infuse)·깊은 진열장 드러남·보상";
        }

        // ---- 36장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter36(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch36 = "36장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(78, 0);
            StoryState.Restore(35, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            vt.TrySite("vault", out var vs);
            fk.TrySite("gate", out var gate);
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiDeep)) > 0.6f) Fail("36장 첫 단계: 해미가 가장 깊은 진열장 곁에 안 섬");
            if (!area.VaultPartOn("vault:deep")) Fail("10부 뒤 가장 깊은 진열장이 안 드러남");
            if (GoStory.Flat(D("haemi"), vs.Pos + new Vector3(0f, 0f, -GoStory.VaultDeepR)) > 8f) Fail("해미가 가장 깊은 진열장에서 너무 멂");
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:gate", GoStory.ByeoriGate)) > 0.6f) Fail("벼리가 성문 안쪽에 안 섬");
            Talk(pc, ui, "haemi", "36장 해미");
            Expect(35, 1, "해미 뒤");                                                            // → 1 sail 진열장 속으로
            Talk(pc, ui, "haemi", "36장 진열장 속으로");
            Expect(35, 2, "진열장 속으로");                                                      // → 2 talk 벼리
            if (!fk.Contains(pc.transform.position) || GoStory.Flat(pc.transform.position, fk.ArrivalPos) > 6f) Fail($"진열장 속에서 성문 남쪽에 안 내림 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:gate", GoStory.ByeoriGate)) > 0.6f) Fail("벼리가 성문 안쪽에 안 섬");
            Talk(pc, ui, "byeori", "36장 벼리");
            Expect(35, 3, "벼리 뒤");                                                            // → 3 kill 성문 앞
            Vector3 killAt = GoStory.AreaPos("fork:gate", GoStory.ForkGateKill);
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !fk.Contains(e.transform.position))) Fail($"성문 앞 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(35, 4, "성문 앞 결정 짐승");                                                  // → 4 follow 대장간
            field.Refresh();
            var n = GoStory.NpcOf("byeori");
            float len = GoStory.PathLength(n);
            fk.TrySite("forge", out var forge);
            if (GoStory.Flat(D("byeori"), forge.Pos + new Vector3(GoStory.ForkForgePath[0].x, 0f, GoStory.ForkForgePath[0].y)) > 0.6f) Fail("따라가기 전 벼리가 길 시작점에 안 섬");
            if (GoStory.Flat(GoStory.NpcPos("byeori"), gate.Pos) > 12f) Fail("길 시작점이 성문 안쪽이 아님");
            Physics.SyncTransforms();
            for (int i = 0; i + 1 < GoStory.ForkForgePath.Length; i++)
            {
                Vector3 a0 = GoStory.AreaPos("fork:forge", GoStory.ForkForgePath[i]), a1 = GoStory.AreaPos("fork:forge", GoStory.ForkForgePath[i + 1]);
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"벼리 길 {i} 곁에 충돌(성문·성벽·대장간·우물…) {pt}"); break; }
                }
            }
            if (Mathf.Abs(len - 35.7f) > 1f) Fail($"벼리 길이 {len:0.0}m");
            pc.Teleport(GoStory.NpcPos("byeori") + new Vector3(0f, 0.4f, -GoStory.FollowLost - 10f));
            field.Follow(pc.transform.position, 2f);
            if (StoryState.FollowDist > 0f) Fail("멀리 있는데 벼리가 걸음");
            for (int i = 0; i < 400 && StoryState.StepIndex == 4; i++)
            {
                Near(pc, GoStory.NpcPos("byeori"), 3f);
                float before = StoryState.FollowDist;
                field.Follow(pc.transform.position, 1f);
                if (StoryState.StepIndex == 4 && Mathf.Abs(StoryState.FollowDist - before - GoStory.FollowSpeed) > 0.01f && StoryState.FollowDist < len - 0.01f)
                { Fail($"따라가기 한 걸음 {StoryState.FollowDist - before}"); break; }
            }
            Expect(35, 5, "대장간 화덕 앞");                                                     // → 5 talk 벼리
            field.Refresh();
            if (GoStory.Flat(D("byeori"), GoStory.PathPos(n, float.MaxValue)) > 0.6f || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("벼리가 화덕 앞에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "byeori", "36장 끝 벼리");
            if (StoryState.Ch != 36 || GoldState.Gold != gold + 9000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("36장 끝·보상(금 9000·교본 9·비급 6·매듭 9)");
            field.Refresh();
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("36장 뒤 벼리가 화덕 앞에 안 섬");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiAt)) > 0.6f) Fail("36장 뒤 해미가 깨진 진열장 자리에 안 섬");
            _ch36 = "36장 해미 가장 깊은 진열장 곁·진열장 속으로 sail(성문 남쪽 도착)·벼리 성문 안쪽·성문 앞 무리 넷(고을 안)·벼리 따라 대장간(길 다섯 점 충돌 없음·길이·멀면 안 걸음·한 걸음 속도)·화덕 앞·보상·해미 진열장 자리 복귀";
        }

        // ---- 37장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter37(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch37 = "37장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(80, 0);
            StoryState.Restore(36, 0);
            var area = AreaField.Instance;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            fk.TrySite("forge", out var forge);
            fk.TrySite("tower", out var tower);
            fk.TrySite("loco", out var loco);
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.PathPos(GoStory.NpcOf("byeori"), float.MaxValue)) > 0.6f || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("37장 첫 단계: 벼리가 화덕 앞에 안 섬");
            if (field.NpcShown("narae")) Fail("37장 앞인데 나래가 섬");
            foreach (var k in new[] { "fork:lat0", "fork:lat1", "fork:lat2", "fork:crow", "fork:rift", "fork:veil" }) if (!area.ForkPartOn(k)) Fail($"37장 처음 모습: {k} 가 없음");
            Talk(pc, ui, "byeori", "37장 벼리");
            Expect(36, 1, "벼리 뒤");                                                            // → 1 light 역참길 말뚝
            field.Refresh();
            fk.TrySite("junction", out var junc);
            if (GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f || GoStory.Flat(D("byeori"), junc.Pos) > 14f) Fail("벼리가 길목 동남쪽에 안 섬");
            // 격자 말뚝 셋 차례로(0 역참길·1 선로 — 땅, 2 종루 위 — 꼭대기에서만)
            void Lattice(int k, string label)
            {
                string at = k == 2 ? "fork:tower" : "fork:lat" + k;
                Vector3 spot = GoStory.AreaPos(at, Vector2.zero);
                area.Refresh();
                for (int q = 0; q < 3; q++) if (area.ForkPartOn("fork:lat" + q) != (q >= k)) Fail($"{label} 앞인데 말뚝 {q} 상태 {area.ForkPartOn("fork:lat" + q)}");
                if (k < 2) pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                int step0 = StoryState.StepIndex;
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(36, step0, $"{label} — 멀리서 쏜 원소로 꺼짐");
                Pulse(spot, 3f);
                Expect(36, step0 + 1, $"{label} 끔");
                area.Refresh();
                if (area.ForkPartOn("fork:lat" + k)) Fail($"{label} 를 껐는데 빛 틀이 남음");
            }
            Lattice(0, "역참길 말뚝");
            Expect(36, 2, "역참길 말뚝 뒤");                                                     // → 2 talk 나래
            field.Refresh();
            if (!field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:works", GoStory.NaraeWorks)) > 0.6f) Fail("나래가 공사장에 안 섬");
            Talk(pc, ui, "narae", "37장 나래");
            Expect(36, 3, "나래 뒤");                                                            // → 3 defend 기관차
            field.Refresh();
            if (GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("나래가 기관차 서쪽 끝에 안 섬");
            Vector3 alt = GoStory.AreaPos("fork:loco", GoStory.ForkLocoDefend);
            pc.Teleport(alt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(alt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"기관차 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - alt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!fk.Contains(e.transform.position)) Fail("물결이 세갈래 고을 밖에서 나옴");
                if (bearing < 40f || bearing > 320f) Fail($"물결이 기관차(북) 쪽에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 3; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(36, 4, "기관차 물결 셋");                                                     // → 4 light 선로 말뚝
            Lattice(1, "선로 말뚝");
            Expect(36, 5, "선로 말뚝 뒤");                                                       // → 5 climb 종루
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("fork:tower");
            if (Mathf.Abs(top.y - GoStory.ForkTowerH - tower.Pos.y) > 0.1f) Fail("종루 꼭대기 높이 표");
            pc.Teleport(tower.Pos + new Vector3(6f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(36, 5, "땅에서 종루 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(36, 6, "종루 꼭대기");                                                        // → 6 light 종루 말뚝
            // 종루 말뚝은 땅에서 쏘면 안 붙는다(꼭대기에서만)
            Vector3 lat2 = GoStory.AreaPos("fork:tower", Vector2.zero);
            pc.Teleport(tower.Pos + new Vector3(6f, 0.4f, 0f));
            Pulse(lat2, 4f);
            Expect(36, 6, "땅에서 쏜 원소로 종루 말뚝이 꺼짐");
            area.Refresh();
            if (!area.ForkPartOn("fork:lat2")) Fail("땅에서 쏘았는데 종루 말뚝이 꺼짐");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            Pulse(lat2, 1f);
            Expect(36, 7, "꼭대기에서 종루 말뚝");                                               // → 7 talk 벼리
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat1") || area.ForkPartOn("fork:lat2")) Fail("말뚝 셋을 껐는데 빛 틀이 남음");
            if (!area.ForkPartOn("fork:crow") || !area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil")) Fail("37장에서 별까마귀·하늘 틈·장막이 바뀜(38장 몫)");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "byeori", "37장 끝 벼리");
            if (StoryState.Ch != 37 || GoldState.Gold != gold + 9250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("37장 끝·보상(금 9250·교본 9·비급 6·매듭 9)");
            area.Refresh();
            field.Refresh();
            if (!field.NpcShown("byeori") || !field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("37장 뒤 벼리·나래 자리");
            if (area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat2") || !area.ForkPartOn("fork:crow")) Fail("37장 뒤 말뚝은 꺼진 채·별까마귀는 그대로");
            _ch37 = "37장 벼리 화덕 앞→길목 동남쪽·격자 말뚝 셋 차례로 끔(멀리서 쏜 원소 ✕·종루 말뚝은 땅에서 ✕)·나래 공사장→기관차 서쪽·기관차 지키기 물결 셋(기관차 북쪽 뺌·고을 안)·종루 10m 벽 타기(땅에선 안 넘어감)·별까마귀·하늘 틈·장막 그대로·보상";
        }

        // ---- 38장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter38(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch38 = "38장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(82, 0);
            StoryState.Restore(37, 0);
            var area = AreaField.Instance;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            GoStory.ForkPassForTest = false;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            fk.TrySite("junction", out var junc);
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f) Fail("38장 첫 단계: 벼리가 길목 동남쪽에 안 섬");
            if (field.NpcShown("garmuri")) Fail("38장 첫 단계인데 갈무리가 섬");
            if (!area.ForkPartOn("fork:crow") || !area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil") || fk.Open()) Fail("38장 처음 모습: 별까마귀 모형·하늘 틈·장막이 서 있고 고개는 닫힘");
            Talk(pc, ui, "byeori", "38장 벼리");
            Expect(37, 1, "벼리 뒤");                                                            // → 1 duel 처음의 별까마귀
            area.Refresh();
            if (area.ForkPartOn("fork:crow")) Fail("별까마귀 싸움이 시작됐는데 멈춘 모형이 남음");
            if (!area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil")) Fail("별까마귀 싸움 중인데 하늘 틈·장막이 벌써 걷힘");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"처음의 별까마귀 {field.Squad.Count}"); return; }
            var crow = field.Squad[0];
            if (!crow.IsStoryBoss || crow.DisplayName != GoLocalization.T("story.boss.firstcrow", "처음의 별까마귀") || crow.Element != GoElement.Electro || crow.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"별까마귀 이름·뇌·첫 수 {crow.DisplayName}·{crow.Element}·{crow.CurrentMove}");
            if (!fk.Contains(crow.transform.position) || GoStory.Flat(crow.transform.position, GoStory.AreaPos("fork:junction", GoStory.ForkCrowAt)) > 14f) Fail("별까마귀가 길목 남쪽이 아님");
            crow.SetShieldForTest(0f);
            crow.TakeRaw(crow.Hp - crow.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!crow.Shielded || crow.Element != GoElement.Electro || field.Squad.Count != 3) Fail($"2단계 뇌 방패·졸개 {crow.Element}·{field.Squad.Count}");
            Kill(crow);
            Expect(37, 2, "처음의 별까마귀");                                                    // → 2 talk 갈무리
            field.Refresh();
            if (!field.NpcShown("garmuri") || GoStory.Flat(D("garmuri"), GoStory.AreaPos("fork:junction", GoStory.GarmuriJunction)) > 0.6f) Fail("갈무리가 길목 위에 안 섬");
            Talk(pc, ui, "garmuri", "38장 갈무리");
            Expect(37, 3, "갈무리 뒤");                                                          // → 3 duel 갈무리 참몸
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"갈무리 참몸 {field.Squad.Count}"); return; }
            var body = field.Squad[0];
            if (!body.IsStoryBoss || body.DisplayName != GoLocalization.T("story.boss.garmuritrue", "갈무리 참몸") || body.Element != GoElement.Geo || body.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"참몸 이름·암·첫 수 {body.DisplayName}·{body.Element}·{body.CurrentMove}");
            body.SetShieldForTest(0f);
            body.TakeRaw(body.Hp - body.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!body.Shielded || body.Element != GoElement.Geo || field.Squad.Count != 3) Fail($"2단계 암 방패·졸개 {body.Element}·{field.Squad.Count}");
            area.Refresh();
            if (!area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil") || fk.Open()) Fail("참몸을 쓰러뜨리기 전에 순간이 풀림");
            Kill(body);
            Expect(37, 4, "갈무리 참몸");                                                        // → 4 talk 해미(순간이 풀렸다)
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:rift") || area.ForkPartOn("fork:veil") || !fk.Open()) Fail("참몸을 쓰러뜨린 뒤 하늘 틈·호박 장막이 걷히고 고개가 열려야");
            if (area.ForkPartOn("fork:crow") || area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat1") || area.ForkPartOn("fork:lat2")) Fail("38장 뒤 별까마귀 모형·격자 말뚝이 남음");
            if (!GoStory.VaultMomentFree) Fail("고을 순간이 풀렸는데 금고 깊은 진열장 유리가 안 깨짐(같은 때)");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("fork:junction", GoStory.HaemiJunction)) > 0.6f) Fail("해미가 길목 서쪽에 안 섬");
            Talk(pc, ui, "haemi", "38장 해미");
            Expect(37, 5, "해미 뒤");                                                            // → 5 go 서리봉 고개
            Vector3 mouth = GoStory.FrostPos(GoStory.FrostNorthGo);
            if (!GoFrost.Contains(mouth) || GoStory.Flat(mouth, fk.MapGate()) < 12f + 5f) Fail("고원 고개 자리가 서리봉 안·돌기둥에서 걸어갈 거리가 아님");
            pc.Teleport(fk.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(37, 5, "고을에서 고원 고개 단계가 넘어감");
            var stTarget = GoStory.TargetOf(StoryState.Current, pc.transform.position, out _);
            if (GoStory.Flat(stTarget, fk.SteleGround) > 0.5f) Fail($"고을 안에서 안내 화살표가 나가는 돌기둥이 아님 {stTarget}");
            pc.Teleport(fk.MapGate() + new Vector3(0f, 0.4f, 5f));
            field.Check(pc.transform.position);
            Expect(37, 5, "돌기둥으로 나온 자리에서 고원 고개 단계가 넘어감");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(37, 6, "서리봉 고원 고개");                                                   // → 6 talk 촌장
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "elder", "38장 끝 촌장");
            if (StoryState.Ch != 38 || GoldState.Gold != gold + 12000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("38장 끝·보상(금 12000·교본 10·비급 8·매듭 10)");
            if (StoryState.Done) Fail("12부(39~41장)가 이어지는데 이야기가 끝으로 셈");
            if (!PartyState.Has("story_byeori")) Fail("벼리가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_byeori", GoElement.Pyro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_byeori", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Pyro || hh.Trait != HeroTrait.Might || GoWeapons.TypeOf("story_byeori") != GoWeapons.Type.Claymore || GoStory.MemberEra("story_byeori") != GoEra.Past) Fail("벼리 표(★4 화 양손검 무용·과거)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Updraft || kit.Burst.Type != KitBurstType.Rally || Mathf.Abs(kit.Skill.Lift - 12f) > 0.01f) Fail("벼리 한 벌(담금질 올려베기 updraft·처음의 불 rally)");
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:rift") || area.ForkPartOn("fork:veil") || area.ForkPartOn("fork:crow") || !fk.Open()) Fail("2차 결말 뒤 고을이 풀린 채여야");
            if (!field.NpcShown("byeori") || !field.NpcShown("haemi") || !field.NpcShown("narae")) Fail("2차 결말 뒤 벼리·해미·나래가 안 섬");
            _ch38 = "38장 벼리 길목→처음의 별까마귀(뇌 2단계 방패·시작하면 멈춘 모형 사라짐)→갈무리 길목 위→갈무리 참몸(암 2단계 방패·쓰러뜨리기 전엔 하늘 틈·장막 그대로)→순간이 풀림(하늘 틈·알갱이·장막 걷힘·고개 열림·금고 유리 같은 때)→해미 길목 서쪽·고원 고개 go(고을·돌기둥 도착 자리에선 안 넘어감·안내 화살표는 나가는 돌기둥)·촌장 보상·벼리 합류(★4 화 양손검 updraft·rally)·이야기 끝";
        }

        // ---- 39장 (12부 「돌아가는 별배」 — 웹 ⑲-70) ----------------------------------------------------------

        private static void CheckChapter39(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch39 = "39장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(83, 0);
            StoryState.Restore(38, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Talk(pc, ui, "elder", "39장 촌장");
            Expect(38, 1, "촌장 뒤");                                                            // → 1 talk 하람
            Talk(pc, ui, "haram", "39장 하람");
            Expect(38, 2, "하람 뒤");                                                            // → 2 talk 반디(별배 곁)
            field.Refresh();
            Vector3 ship = GoStory.FrostPos(GoStory.BandiShip);
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), ship) > 0.6f) Fail("39장 3째: 반디가 고원 별배 곁에 안 섬");
            Talk(pc, ui, "bandi", "39장 반디");
            Expect(38, 3, "반디 뒤");                                                            // → 3 kill 결정 짐승
            Vector3 killAt = GoStory.StepPos(StoryState.Current);
            if (!GoFrost.Contains(killAt) || GoStory.Flat(killAt, ship) > 25f) Fail("결정 짐승 자리가 고원 별배 곁이 아님");
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear + 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 0) Fail("멀리서 결정 짐승 무리가 섬");
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !GoFrost.Contains(e.transform.position))) { Fail($"결정 짐승 무리 {field.Squad.Count}"); return; }
            var els = new System.Collections.Generic.HashSet<GoElement>();
            foreach (var e in field.Squad) els.Add(e.Element);
            if (!els.Contains(GoElement.Geo) || !els.Contains(GoElement.Cryo) || !els.Contains(GoElement.Electro) || !els.Contains(GoElement.Anemo)) Fail("결정 짐승 원소(암·빙·뇌·풍)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(38, 4, "결정 짐승");                                                          // → 4 talk 한별
            field.Refresh();
            area.Refresh();
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(D("hanbyeol"), GoStory.AreaPos("skyport:port", GoStory.SunkPortHanbyeol)) > 0.6f) Fail("한별이 은하 나루 착륙판 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "hanbyeol", "39장 끝 한별");
            if (StoryState.Ch != 39 || GoldState.Gold != gold + 9500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("39장 끝·보상(금 9500·교본 6·비급 6·매듭 6)");
            _ch39 = "39장 촌장→하람→반디 별배 곁→결정 짐승 넷(고원·암빙뇌풍)→한별 착륙판 곁·보상";
        }

        // ---- 40장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter40(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch40 = "40장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(84, 0);
            StoryState.Restore(39, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            var fk = GoAreas.Fork;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 ship = GoStory.FrostPos(GoStory.BandiShip);
            Talk(pc, ui, "hanbyeol", "40장 한별");
            Expect(39, 1, "한별 뒤");                                                            // → 1 go 나침 제단
            Vector3 altar = GoStory.StepPos(StoryState.Current);
            if (!GoFrost.Contains(altar) || GoStory.Flat(altar, ship) > 12f || GoStory.Flat(altar, GoStory.StepPos(GoStory.Chapters[38].Steps[3])) < 8f) Fail("나침 제단 자리(고원 별배 곁·결정 짐승 자리와 떨어짐)");
            pc.Teleport(altar + new Vector3(0f, 0.4f, 40f));
            field.Check(pc.transform.position);
            Expect(39, 1, "멀리서 나침 제단 단계가 넘어감");
            pc.Teleport(altar + new Vector3(0f, 0.4f, 2f));
            field.Check(pc.transform.position);
            Expect(39, 2, "나침 제단");                                                          // → 2 defend
            pc.Teleport(altar + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(altar + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"나침 제단 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!GoFrost.Contains(e.transform.position)) Fail("물결이 서리봉 고원 밖에서 나옴");
            int[] sizes = { 3, 4, 5 };
            int wave = 0;
            for (int guard = 0; guard < 60 && StoryState.StepIndex == 2; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave > wave) { wave = field.DefendWave; if (wave < 3 && field.Squad.Count(e => e.Alive) != sizes[wave]) Fail($"물결 {wave + 1} 수 {field.Squad.Count(e => e.Alive)}"); }
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(39, 3, "나침 제단 물결 셋");                                                  // → 3 talk 반디(나침을 살핀 뒤)
            field.Refresh();
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), ship) > 0.6f) Fail("40장 4째: 반디가 별배 곁에 안 섬");
            Talk(pc, ui, "bandi", "40장 반디");
            Expect(39, 4, "반디 뒤");                                                            // → 4 talk 나래
            field.Refresh();
            fk.TrySite("loco", out var loco);
            if (!field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("나래가 기관차 서쪽 끝에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "narae", "40장 끝 나래");
            if (StoryState.Ch != 40 || GoldState.Gold != gold + 10250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("40장 끝·보상(금 10250·교본 7·비급 6·매듭 7)");
            if (!PartyState.Has("story_narae")) Fail("나래가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_narae", GoElement.Hydro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_narae", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Hydro || hh.Trait != HeroTrait.Wisdom || GoWeapons.TypeOf("story_narae") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_narae") != GoEra.Modern) Fail("나래 표(★4 수 법구 지혜·현대)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Zone || kit.Burst.Type != KitBurstType.Lore || Mathf.Abs(kit.Burst.RMul - 1.4f) > 0.001f) Fail("나래 한 벌(측량선 긋기 zone·삼각측량 lore)");
            _ch40 = "40장 한별→나침 제단 가기(멀리서 안 넘어감)·지키기 물결 셋(3·4·5, 고원 안)→반디 별배 곁→나래 기관차 서쪽·합류(수 법구 zone·lore)·보상";
        }

        // ---- 41장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter41(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch41 = "41장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(85, 0);
            StoryState.Restore(40, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            var fk = GoAreas.Fork;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("fork:junction", GoStory.HaemiJunction)) > 0.6f) Fail("41장 첫 단계: 해미가 길목 서쪽에 안 섬");
            Talk(pc, ui, "haemi", "41장 해미");
            Expect(40, 1, "해미 뒤");                                                            // → 1 talk 소담(곳간 마을)
            field.Refresh();
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:granary", GoStory.SodamGranary40)) > 0.6f) Fail("41장 2째: 소담이 곳간 문 앞에 안 섬");
            Talk(pc, ui, "sodam", "41장 소담");
            Expect(40, 2, "소담 뒤");                                                            // → 2 go 고을 마당
            field.Refresh();
            if (GoStory.Flat(D("sodam"), GoStory.AreaPos("fork:junction", GoStory.SodamJunction)) > 0.6f) Fail("41장 3째: 소담이 같이 고을 길목에 안 섬");
            Vector3 go = GoStory.StepPos(StoryState.Current);
            if (!fk.Contains(go)) Fail("고을 마당 가기 자리가 세갈래 고을 안이 아님");
            pc.Teleport(go + new Vector3(0f, 0.4f, 30f));
            field.Check(pc.transform.position);
            Expect(40, 2, "멀리서 고을 마당 단계가 넘어감");
            pc.Teleport(go + new Vector3(0f, 0.4f, 1f));
            field.Check(pc.transform.position);
            Expect(40, 3, "고을 마당");                                                          // → 3 duel 갈무리의 싹
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"갈무리의 싹 {field.Squad.Count}"); return; }
            var sprout = field.Squad[0];
            if (!sprout.IsStoryBoss || sprout.DisplayName != GoLocalization.T("story.boss.seedgiant", "갈무리의 싹") || sprout.Element != GoElement.Dendro || sprout.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"싹 이름·초·첫 수 {sprout.DisplayName}·{sprout.Element}·{sprout.CurrentMove}");
            if (!fk.Contains(sprout.transform.position) || GoStory.Flat(sprout.transform.position, GoStory.AreaPos("fork:junction", GoStory.ForkCrowAt)) > 14f) Fail("싹이 고을 마당(길목 남쪽)이 아님");
            sprout.SetShieldForTest(0f);
            sprout.TakeRaw(sprout.Hp - sprout.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!sprout.Shielded || sprout.Element != GoElement.Dendro || field.Squad.Count != 3) Fail($"2단계 초 방패·졸개 {sprout.Element}·{field.Squad.Count}");
            Kill(sprout);
            Expect(40, 4, "갈무리의 싹");                                                        // → 4 talk 벼리
            field.Refresh();
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f) Fail("벼리가 길목 동남쪽에 안 섬");
            Talk(pc, ui, "byeori", "41장 벼리");
            Expect(40, 5, "벼리 뒤");                                                            // → 5 talk 촌장
            field.Refresh();
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.GridPos(0.94f, 3.03f)) > 0.6f) Fail("소담이 촌장 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "elder", "41장 끝 촌장");
            if (StoryState.Ch != 41 || GoldState.Gold != gold + 12500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("41장 끝·보상(금 12500·교본 10·비급 8·매듭 10)");
            if (!StoryState.Done) Fail("이야기 표 끝(3차 결말)인데 Done 이 아님");
            if (!PartyState.Has("story_sodam")) Fail("소담이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_sodam", GoElement.Anemo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_sodam", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Anemo || hh.Trait != HeroTrait.Virtue || GoWeapons.TypeOf("story_sodam") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_sodam") != GoEra.Past) Fail("소담 표(★4 풍 법구 덕·과거)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Shells || kit.Burst.Type != KitBurstType.Vortex || kit.Skill.N != 4) Fail("소담 한 벌(낟알 흩뿌리기 shells·곳간 노래 vortex)");
            if (GoHeroes.Story.Length != 16) Fail($"이야기 동료 {GoHeroes.Story.Length} ≠ 16");
            _ch41 = "41장 해미 길목 서쪽→소담 곳간 문 앞→고을 마당 가기(멀리서 안 넘어감)→갈무리의 싹(초 2단계 방패·졸개 둘)→벼리→촌장·소담 합류(풍 법구 shells·vortex)·이야기 끝";
        }

        // ---- 글 흘러나옴·대화 카메라 -------------------------------------------------------------------------

        private static void CheckReveal(PlayerController pc, StoryUi ui)
        {
            var rig = Object.FindFirstObjectByType<CameraRig>();
            StoryState.Restore(0, 0);
            PlayerStats.Restore(1, 0);
            StoryUi.RevealCps = GoStory.RevealCps;
            Near(pc, GoStory.NpcPos("elder"));
            ui.Refresh();
            float zoom0 = rig != null ? rig.CurrentZoom : 0f;
            if (!ui.StartTalk()) { Fail("대화가 안 열림(흘러나옴)"); return; }
            if (!ui.Revealing) Fail("글이 한 번에 다 나옴");
            if (rig != null && (!rig.TalkShot || Mathf.Abs(rig.CurrentZoom - CameraRig.TalkZoom) > 0.01f)) Fail("대화 카메라가 안 붙음");
            string first = ui.LineText;
            ui.Next(-1);
            if (ui.Revealing || ui.LineText != first) Fail("한 번 누르면 줄 전체가 나와야");
            ui.Next(-1);
            if (ui.LineText == first) Fail("두 번째 누르면 다음 줄");
            ui.ResetForTest();
            if (StoryState.Talking || (rig != null && (rig.TalkShot || Mathf.Abs(rig.CurrentZoom - zoom0) > 0.01f))) Fail("대화를 닫아도 카메라가 안 돌아옴");
            StoryUi.RevealCps = 0f;
        }

        private static void CheckBossAlreadyDown(StoryField field)
        {
            StoryState.Restore(0, 2);
            GuardianState.Restore(true, true, 0);
            field.Check(FieldCombat.Instance.transform.position);
            Expect(0, 3, "이미 쓰러진 수호장");
            GuardianState.Restore(false);
            GuardianBloom.Instance?.Refresh();
        }

        private static void CheckIdle(PlayerController pc, StoryField field)
        {
            StoryState.Restore(0, 0);
            field.ResetForTest();
            Near(pc, GoStory.NpcPos("ferryman"));
            field.Check(pc.transform.position);
            if (field.LastIdleNpc != "ferryman") Fail("버들 혼잣말이 없다");
            StoryState.Restore(0, 3);
            field.ResetForTest();
            field.Check(pc.transform.position);
            if (field.LastIdleNpc != null) Fail("버들과 이야기할 단계인데 혼잣말");
        }

        private static void CheckSave(string savePath)
        {
            StoryState.Restore(1, 2);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":28") || !json.Contains("\"storyCh\":1,\"storyStep\":2")) Fail("세이브 v28 에 이야기가 없다");
            StoryState.Restore(0, 0);
            if (!SaveState.TryLoad() || StoryState.Ch != 1 || StoryState.StepIndex != 2) Fail("v28 왕복 뒤 이야기가 달라짐");
            string v27 = Regex.Replace(json.Replace("\"version\":28", "\"version\":27"), ",\"storyCh\":\\d+,\"storyStep\":\\d+", "");
            if (v27.Contains("storyCh")) { Fail("v27 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v27);
            StoryState.Restore(1, 2);
            if (!SaveState.TryLoad() || StoryState.Ch != 0 || StoryState.StepIndex != 0) Fail("v27 파일 — 1장 처음으로 안 읽힘");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] story FAIL - {msg}");
        }
    }
}
