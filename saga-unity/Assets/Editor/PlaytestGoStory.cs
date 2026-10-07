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
    /// PLAN.md 109-14-12·13 "이야기 임무 1~4장"(웹 사가만리 ⑲-12·13 진단 항목 — 표·자리·흐름·화면) — `PlaytestHeadless` 가 고유 스킬 진단 뒤에 부른다.
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
    public static partial class PlaytestGoStory
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
            if (!fox.Shielded || fox.Element != GoElement.Cryo || field.Squad.Count != 3 || field.Squad[2].EnemyKind != FieldEnemy.Kind.WindHawk) Fail($"2단계 빙 방패·졸개 {fox.Element}·{field.Squad.Count}");
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

        // ---- 29장 ---------------------------------------------------------------------------------------------

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] story FAIL - {msg}");
        }
    }
}
