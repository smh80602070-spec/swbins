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
    /// PLAN.md 109-14-12 "이야기 임무 1~2장"(웹 사가고 ⑲-12 진단 항목 — 표·자리·흐름 둘·화면) — `PlaytestHeadless` 가 고유 스킬 진단 뒤에 부른다.
    /// 표(인물 셋·1장 8단계·2장 4단계·여정 등급·보상) · 자리(걷는 칸·지역·들판 무리/숨은 터와 떨어짐) · 몸 둘 ·
    /// 1장 흐름(대화 창·고르는 줄·go 도착·수호장·임무 적 넷(경험 없음·다시 안 섬)·옛 제단 원소 신호·장 끝 보상) · 2장 잠김(여정 5)·제단·주간 보스 깸 ·
    /// boss 이미 쓰러짐이면 넘김 · 혼잣말 · 대화 중 `Talking` · 세이브 v28 왕복·v27 로드(1장 처음).
    /// 옛 진단은 `StoryState.OffForTest` 로 돌고 여기서만 켠다. 끝나면 진행·수호장·돈·레벨·재료·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoStory
    {
        private static string _tag;
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
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool d0 = GuardianState.Defeated, b0 = GuardianState.Bloom;
            long p0 = GuardianState.PaidAt;
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var tal0 = TalentState.Snapshot();
            var mats0 = TalentState.SnapshotMats();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                StoryState.OffForTest = false;
                StoryState.Restore(0, 0);
                field.ResetForTest();
                CheckTable();
                CheckPlaces(field);
                CheckChapter1(fc, pc, field, ui, g);
                CheckChapter2(pc, field, ui);
                CheckBossAlreadyDown(field);
                CheckIdle(pc, field);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                ui.ResetForTest();
                StoryState.Restore(ch0, st0);
                StoryState.OffForTest = off0;
                field.ResetForTest();
                ui.ResetForTest();
                GuardianState.Restore(d0, b0, p0);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                TalentState.Restore(tal0, mats0);
                if (!GuardianState.Standing && g.gameObject.activeSelf && g.Alive) g.gameObject.SetActive(false);
                GuardianBloom.Instance?.Refresh();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log("[" + _tag + "] story OK - 인물 셋·1장 8단계·2장 4단계 · 자리·몸 · 대화·고르는 줄·go·수호장·임무 적 넷·옛 제단·장 끝 보상 · 2장 잠김·제단·주간 보스 · 이미 쓰러진 수호장 · 혼잣말 · 세이브 v28 왕복·v27 로드");
            return _ok;
        }

        // ---- 표 -----------------------------------------------------------------------------------------------

        private static void CheckTable()
        {
            if (GoStory.Npcs.Length != 3 || GoStory.Chapters.Length != 2) { Fail($"인물 {GoStory.Npcs.Length}·장 {GoStory.Chapters.Length}"); return; }
            string Types(GoStory.Chapter c) { var s = ""; foreach (var st in c.Steps) s += st.Type.ToString()[0]; return s; }
            // T=Talk G=Go B=Boss K=Kill L=Light D=Domain
            if (Types(GoStory.Chapters[0]) != "TGBTKTLT") Fail("1장 단계 " + Types(GoStory.Chapters[0]));
            if (Types(GoStory.Chapters[1]) != "TGDT") Fail("2장 단계 " + Types(GoStory.Chapters[1]));
            if (GoStory.Chapters[0].Ar != 1 || GoStory.Chapters[1].Ar != 5) Fail("여정 등급");
            if (GoStory.Chapters[0].Gold != 500 || GoStory.Chapters[0].Mats[(int)GoTalent.Mat.Guide] != 2 || GoStory.Chapters[0].Mats[(int)GoTalent.Mat.Knot] != 2) Fail("1장 보상");
            if (GoStory.Chapters[1].Gold != 1000 || GoStory.Chapters[1].Mats[(int)GoTalent.Mat.Secret] != 1 || GoStory.Chapters[1].Mats[(int)GoTalent.Mat.Knot] != 3) Fail("2장 보상");
            foreach (var c in GoStory.Chapters)
                foreach (var st in c.Steps)
                {
                    if (st.Type == GoStory.StepType.Talk && (GoStory.NpcIndex(st.Npc) < 0 || st.Lines == null || st.Lines.Length == 0)) Fail("대화 단계 인물·줄 " + st.TextKo);
                    if (st.Type == GoStory.StepType.Talk)
                        foreach (var l in st.Lines)
                            if (l.IsPick ? l.PickKo.Length != 2 : GoStory.NpcIndex(l.Who) < 0) Fail("대화 줄 " + st.TextKo);
                }
        }

        // ---- 자리 ---------------------------------------------------------------------------------------------

        private static bool Walkable(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char t = TestMapData.TileAt(gx, gy);
            return TestMapData.Legend.TryGetValue(t, out var info) && info.Walkable && !TestMapData.IsWater(t);
        }

        private static void CheckPlaces(StoryField field)
        {
            var spots = new (string name, Vector3 pos, string region)[]
            {
                ("누리", GoStory.NpcPos("elder"), "village"),
                ("버들", GoStory.NpcPos("ferryman"), "village"),
                ("은비", GoStory.NpcPos("scholar"), "north_foot"),
                ("망루 발치", GoStory.GridPos(GoStory.TowerFootGx, GoStory.TowerFootGy), "south_glade"),
                ("임무 적", GoStory.GridPos(GoStory.SquadGx, GoStory.SquadGy), "north_foot"),
                ("옛 제단", GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy), "north_foot"),
            };
            foreach (var s in spots)
            {
                if (!Walkable(s.pos)) Fail(s.name + " 자리가 걷는 칸이 아니다");
                if (GoWorldMap.RegionAt(s.pos) != s.region) Fail($"{s.name} 지역 {GoWorldMap.RegionAt(s.pos)} ≠ {s.region}");
            }
            // 임무 적·제단은 들판 무리(끈 45m 안에 섞이면 싸움이 뒤엉킨다)·숨은 터 입구 카드(11m)에서 떨어져
            Vector3 sq = GoStory.GridPos(GoStory.SquadGx, GoStory.SquadGy);
            foreach (var c in FieldSpawner.GroupCenters()) if (GoStory.Flat(sq, c) < 35f) Fail($"임무 적이 들판 무리 곁 {GoStory.Flat(sq, c):0}m");
            foreach (var s in GoDomain.Sites)
            {
                if (GoStory.Flat(sq, s.Pos) < 20f) Fail("임무 적이 숨은 터 입구 곁 " + s.Id);
                if (GoStory.Flat(GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy), s.Pos) < 20f) Fail("옛 제단이 숨은 터 입구 곁 " + s.Id);
            }
            foreach (var id in new[] { "ferryman", "scholar" })
            {
                var body = field.NpcBody(id);
                if (body == null || !body.activeInHierarchy || body.GetComponentsInChildren<Renderer>().Length == 0) Fail(id + " 몸이 없다");
                else if (GoStory.Flat(body.transform.position, GoStory.NpcPos(id)) > 0.5f) Fail(id + " 몸 자리");
            }
        }

        // ---- 1장 ----------------------------------------------------------------------------------------------

        private static void Near(PlayerController pc, Vector3 p, float dx = 2f) => pc.Teleport(p + new Vector3(dx, 0.4f, 0f));

        /// <summary>곁에서 대화를 열고 끝까지(고르는 줄은 둘째 대답) — 단계가 하나 넘어가야 한다.</summary>
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
            for (int i = 0; i < 4 && e.Alive; i++)
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

            Vector3 sq = GoStory.GridPos(GoStory.SquadGx, GoStory.SquadGy);
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear + 10f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 0) Fail("멀리서 임무 적이 섬");
            pc.Teleport(sq + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) { Fail($"임무 적 {field.Squad.Count} ≠ 4"); return; }
            foreach (var e in field.Squad) if (!e.StoryFoe || e.GroupId != "sq:0_4") Fail($"임무 적 표시 {e.StoryFoe}·{e.GroupId}");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4) Fail("임무 적이 두 번 섬");
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            for (int i = 0; i < 3; i++) Kill(field.Squad[i]);
            Expect(0, 4, "넷 중 셋");
            var last = field.Squad[3];
            Kill(last);
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
            if (GoldState.Gold != gold + 500 ||TalentState.Count(GoTalent.Mat.Guide) != 2 || TalentState.Count(GoTalent.Mat.Knot) != 2)
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
            if (!StoryState.Done) Fail("2장 끝났는데 안 끝남");
            if (GoldState.Gold != gold + 1000 || TalentState.Count(GoTalent.Mat.Secret) != 1 || TalentState.Count(GoTalent.Mat.Knot) != 5) Fail("2장 보상");
            ui.Refresh();
            field.Refresh();
            if (ui.TrackShown || field.Pillar.activeSelf) Fail("다 끝났는데 추적 줄·기둥");
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
