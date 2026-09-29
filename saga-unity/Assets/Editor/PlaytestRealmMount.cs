using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.Player;
using Saga.Realm.UI;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-15 명마·비행(웹 사가국지 T1·T2 진단 항목) — `PlaytestRealmSlice` 가 싸움터 진단 뒤에 부른다(판 상태를 안 건드린다).
    /// 표(다섯·성 수 문턱·힘 배율·돌격·돌아보기 배율·이름) · 열림·날 탈것 고르기(성 1/2/4/5/7/9) ·
    /// 장착(한 필은 한 사람만·한 사람은 한 필만·우리 장수만·돌아가며 얹기·내리기) · 부대 힘(`RealmWar.ArmyPower` ×배율·강가 = 수전 ✕·가장 좋은 말만·안 탔으면 그대로) ·
    /// 싸움 기록 한 줄 · 싸움터 컷 돌격(공격군이 일찍 붙음) · 날기(국토 지도에서만·카메라 낮고 가깝게·돌아보기 빨라짐·내리면 제자리) ·
    /// `RealmMountUi`(명마 패널 줄·날기 단추 켜고 끔·넘치는 로스터는 "외 n명") · 세이브(왕복·옛 세이브는 안 고름·장착 없음).
    /// 끝나면 장착·고르기·지도 보기·세이브 상태를 되돌린다.
    /// </summary>
    public static class PlaytestRealmMount
    {
        private const string T = "[PlaytestRealmSlice] mount";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var ui = RealmMountUi.Instance;
            var roster = RealmCityState.RosterIds.ToList();
            if (ui == null || roster.Count < 2) { Fail($"필요한 것 없음(UI {ui != null}·로스터 {roster.Count})"); return false; }
            string a = roster[0], b = roster[1];
            string json0 = RealmSaveState.ToJson();
            bool viewing0 = RealmMapState.ViewingMap;
            var parts = new List<string>();
            try
            {
                RealmMounts.ResetForTest();
                CheckTable(parts);
                CheckUnlock(parts);
                CheckEquip(a, b, parts);
                CheckPower(a, b, parts);
                CheckBattlefield(a, parts);
                CheckFlight(parts);
                CheckUi(ui, a, b, roster.Count, parts);
                CheckSave(a, parts);
            }
            finally
            {
                RealmBattlefield.Hide();
                RealmMounts.ResetForTest();
                if (RealmMapState.ViewingMap != viewing0) RealmMapState.Toggle();
                RealmSaveState.ApplyJson(json0);
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Cities(int n) => RealmMounts.CitiesForTest = n;

        private static void CheckTable(List<string> parts)
        {
            var all = RealmMounts.All;
            if (all.Length != 5 || all.Select(m => m.Id).Distinct().Count() != 5 || all.Count(m => !m.IsFly) != 3 || all.Count(m => m.IsFly) != 2) Fail("탈것 표(명마 셋·비행 둘)");
            var want = new (string id, int cities, float mul, bool fly, float f)[]
            {
                ("mt_farm", 2, 1.03f, false, 0f), ("mt_brown", 4, 1.06f, false, 0f), ("mt_white", 7, 1.10f, false, 0f),
                ("mt_crane", 5, 1f, true, 1.7f), ("mt_dragon", 9, 1f, true, 2.4f),
            };
            foreach (var w in want)
            {
                var m = RealmMounts.Def(w.id);
                if (m == null || m.Cities != w.cities || Mathf.Abs(m.Mul - w.mul) > 0.0001f || m.IsFly != w.fly || Mathf.Abs(m.Fly - w.f) > 0.0001f) Fail($"탈것 {w.id} 수치");
                else if (m.Name.StartsWith("mount.") || m.Name.Length == 0) Fail($"탈것 {w.id} 이름 글이 없다");
            }
            if (Mathf.Abs(RealmMounts.ChargeOf("mt_white") - 1.3f) > 0.001f || Mathf.Abs(RealmMounts.ChargeOf("mt_farm") - 1.09f) > 0.001f || RealmMounts.ChargeOf("mt_crane") != 1f || RealmMounts.ChargeOf("nope") != 1f) Fail("돌격 배율 = 1 + (mul−1)×3");
            if (RealmMounts.Def("nope") != null || RealmMounts.Def(null) != null) Fail("없는 탈것 id");
            parts.Add("표(명마 셋·비행 둘·성 수 문턱·힘 배율·돌격 ×1.09/1.18/1.3·돌아보기 ×1.7/2.4·이름)");
        }

        private static void CheckUnlock(List<string> parts)
        {
            Cities(1);
            if (RealmMounts.UnlockedList().Count != 0 || RealmMounts.Selected() != null) Fail("성 1곳인데 탈것이 있다");
            if (RealmMounts.CanFly(true, out string why) || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"성 1곳 날 수 없음 이유 '{why}'");
            Cities(2);
            if (RealmMounts.UnlockedList().Count != 1) Fail("성 2곳 = 농마 하나");
            Cities(4);
            if (RealmMounts.UnlockedList().Count != 2 || RealmMounts.Selected() != null) Fail("성 4곳 = 명마 둘·날 것 없음");
            Cities(5);
            if (RealmMounts.UnlockedList().Count != 3 || RealmMounts.Selected()?.Id != "mt_crane") Fail("성 5곳 = 학이 열려 고름");
            Cities(7);
            if (RealmMounts.UnlockedList().Count != 4) Fail("성 7곳 = 흰 말까지 넷");
            Cities(9);
            if (RealmMounts.UnlockedList().Count != 5 || RealmMounts.Selected()?.Id != "mt_dragon") Fail("성 9곳 = 다섯·안 골랐을 땐 가장 빠른 용");
            var first = RealmMounts.CycleFly()?.Id;
            var second = RealmMounts.CycleFly()?.Id;
            if (first != "mt_crane" && first != "mt_dragon" || first == second) Fail($"날 탈것 고르기 차례 {first},{second}");
            RealmMounts.Restore("mt_crane", null, null);
            if (RealmMounts.Selected()?.Id != "mt_crane" || RealmMounts.Sel != "mt_crane") Fail("고른 날 탈것이 안 남음");
            Cities(4);
            if (RealmMounts.Selected() != null) Fail("성이 줄어 못 쓰게 된 날 탈것을 골라 둔 채");
            RealmMounts.Restore("mt_farm", null, null);
            if (RealmMounts.Sel != "") Fail("명마 id 를 날 탈것으로 골라 둠");
            RealmMounts.OffForTest = true;
            Cities(9);
            if (RealmMounts.UnlockedList().Count != 0) Fail("OffForTest 인데 탈것이 있다");
            RealmMounts.OffForTest = false;
            RealmMounts.CitiesForTest = -1;
            if (RealmMounts.CityCount() != RealmCityState.ActiveCityIds.Count) Fail("성 수 손잡이를 풀었는데 다스리는 성 수가 아님");
            parts.Add("열림·고르기(성 1·2·4·5·7·9 — 날 탈것 차례·성이 줄면 못 씀·명마 id 를 날 것으로 못 고름)");
        }

        private static void CheckEquip(string a, string b, List<string> parts)
        {
            RealmMounts.ResetForTest();
            Cities(7);
            if (RealmMounts.Equip("nobody", "mt_farm") == null) Fail("우리 장수가 아닌데 얹힘");
            if (RealmMounts.Equip(a, "mt_crane") == null) Fail("비행 탈것을 장수에게 얹음");
            if (RealmMounts.Equip(a, null) == null) Fail("탄 말이 없는데 내려 주기가 성공");
            if (RealmMounts.Equip(a, "mt_farm") != null || RealmMounts.MountOf(a)?.Id != "mt_farm" || RealmMounts.RiderOf("mt_farm") != a) Fail("농마 장착");
            if (RealmMounts.Equip(b, "mt_farm") == null || RealmMounts.MountOf(b) != null) Fail("이미 다른 장수가 탄 말이 또 얹힘");
            if (RealmMounts.Equip(a, "mt_brown") != null || RealmMounts.RiderOf("mt_farm") != null || RealmMounts.MountOf(a)?.Id != "mt_brown") Fail("한 사람이 한 필만 — 말을 바꾸면 농마가 풀려야");
            // 돌아가며 얹기: 없음 → (농마) → (갈색 말은 a 가 탔으니 b 에겐 안 보임) …
            if (RealmMounts.CycleEquip(b) != null || RealmMounts.MountOf(b)?.Id != "mt_farm") Fail("b 첫 단추 = 남은 첫 말(농마)");
            if (RealmMounts.CycleEquip(b) != null || RealmMounts.MountOf(b)?.Id != "mt_white") Fail("b 둘째 단추 = 흰 말(갈색은 a 가 탔음)");
            if (RealmMounts.CycleEquip(b) != null || RealmMounts.MountOf(b) != null) Fail("b 셋째 단추 = 말 없음");
            Cities(1);
            if (RealmMounts.CycleEquip(b) == null) Fail("쓸 수 있는 말이 없는데 단추가 성공");
            if (RealmMounts.MountOf(a) != null) Fail("성이 줄어 말이 못 쓰게 됐는데 효과가 남음");
            Cities(7);
            if (RealmMounts.MountOf(a)?.Id != "mt_brown") Fail("성이 다시 늘면 말이 돌아와야(장착 표는 남는다)");
            if (RealmMounts.Equip(a, null) != null || RealmMounts.MountOf(a) != null) Fail("내려 주기");
            parts.Add("장착(우리 장수만·비행 못 얹음·한 필은 한 사람만·한 사람은 한 필만·돌아가며 얹기 없음→농마→…→없음·성이 줄면 효과 없음)");
        }

        private static RealmArmy Army(params string[] officers) => new RealmArmy
        {
            Troops = 5000, Start = 5000, Train = 60, Tech = 300, Morale = 1f, OfficerIds = new List<string>(officers),
        };

        private static void CheckPower(string a, string b, List<string> parts)
        {
            RealmMounts.ResetForTest();
            Cities(7);
            float p0 = RealmWar.ArmyPower(Army(a));
            RealmMounts.Equip(a, "mt_white");
            float p1 = RealmWar.ArmyPower(Army(a));
            if (Mathf.Abs(p1 / p0 - 1.10f) > 0.0005f) Fail($"흰 말 부대 힘 {p1 / p0:0.0000} ≠ 1.10");
            float river = RealmWar.ArmyPower(Army(a), RealmLand.River);
            if (Mathf.Abs(river / p0 - 1f) > 0.0005f) Fail($"강가(수전)인데 말 효과 {river / p0:0.0000}");
            RealmMounts.Equip(b, "mt_farm");
            float both = RealmWar.ArmyPower(Army(a, b));
            RealmMounts.Equip(a, null); RealmMounts.Equip(b, null);
            float bare = RealmWar.ArmyPower(Army(a, b));
            RealmMounts.Equip(a, "mt_white"); RealmMounts.Equip(b, "mt_farm");
            if (Mathf.Abs(both / bare - 1.10f) > 0.0005f) Fail($"둘이 탔는데 가장 좋은 말(흰 말) 하나만 곱해야: {both / bare:0.0000}");
            var (best, who) = RealmMounts.BestFor(new List<string> { a, b }, false);
            if (best?.Id != "mt_white" || who != a) Fail("가장 좋은 명마");
            if (RealmMounts.BestFor(new List<string> { a, b }, true).mount != null) Fail("수전인데 명마가 나옴");
            RealmMounts.OffForTest = true;
            if (Mathf.Abs(RealmWar.ArmyPower(Army(a)) / p0 - 1f) > 0.0005f) Fail("OffForTest 인데 말 효과가 남음");
            RealmMounts.OffForTest = false;
            // 싸움 기록 한 줄
            string note = RealmMounts.Note(new List<string> { a, b }, false);
            var oa = RealmOfficerPool.Get(a);
            if (note.Length == 0 || !note.Contains(RealmMounts.Def("mt_white").Name) || (oa != null && !note.Contains(oa.Name)) || !note.Contains("1.1")) Fail($"싸움 기록 '{note}'");
            if (RealmMounts.Note(new List<string> { a }, true).Length != 0) Fail("수전인데 기록이 남음");
            RealmMounts.Equip(a, null); RealmMounts.Equip(b, null);
            if (RealmMounts.Note(new List<string> { a, b }, false).Length != 0) Fail("안 탔는데 기록이 남음");
            parts.Add("부대 힘(흰 말 ×1.10·강가 ×1·둘이 타면 좋은 쪽 하나만·수전 ✕·꺼짐·싸움 기록 한 줄)");
        }

        private static void CheckBattlefield(string a, List<string> parts)
        {
            RealmBattlefield.Hide();
            float ratio = 1f;
            float x1 = 0f, x2 = 0f;
            foreach (float charge in new[] { 1f, RealmMounts.ChargeOf("mt_white") })
            {
                var bf = RealmBattlefield.Show(new RealmWarState.AttackResult(true, "x", true, "jinyang", 12000, 9000, 8000, 0, charge));
                if (bf == null) { Fail("싸움터가 안 뜸"); return; }
                if (Mathf.Abs(bf.Charge - charge) > 0.0001f) Fail($"싸움터 돌격 배율 {bf.Charge} ≠ {charge}");
                bf.SampleForTest(0.5f);
                float xa = Mathf.Abs(bf.AtkGeneral.transform.localPosition.x), xd = Mathf.Abs(bf.DefGeneral.transform.localPosition.x);
                if (charge == 1f) { x1 = xa; ratio = Mathf.Abs(xa - xd); }
                else x2 = xa;
                bf.SampleForTest(1.3f); // 다 붙은 뒤 — 둘 다 같은 자리
                if (Mathf.Abs(bf.AtkGeneral.transform.localPosition.x + bf.DefGeneral.transform.localPosition.x) > 0.01f) Fail("붙은 뒤 두 장수가 대칭이 아님");
                RealmBattlefield.Hide();
            }
            if (ratio > 0.01f) Fail("안 탔는데 양군이 다르게 다가감");
            if (!(x2 < x1 - 0.3f)) Fail($"명마 공격군이 더 일찍 붙어야: 0.5초에 안 탄 {x1:0.00} 탄 {x2:0.00}");
            parts.Add("싸움터 컷 돌격(안 탄 군은 양군 같이 다가감·흰 말 공격군은 0.5초에 더 가까이·붙은 뒤 대칭)");
        }

        private static void CheckFlight(List<string> parts)
        {
            RealmMounts.ResetForTest();
            Cities(9);
            bool viewing0 = RealmMapState.ViewingMap;
            if (viewing0) RealmMapState.Toggle();
            if (RealmMounts.TryFly(RealmMapState.ViewingMap, out string why) || RealmMounts.IsFlying || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"디오라마에서 남/이유 '{why}'");
            var cam = Object.FindFirstObjectByType<RealmWorldMapCamera>(FindObjectsInactive.Include);
            if (cam == null) { Fail("월드맵 카메라 없음"); return; }
            RealmMapState.Toggle(); // 국토 지도 보기
            cam.Tick(0.02f);
            float r0 = cam.DebugRadius, p0 = cam.DebugPitch, y0 = cam.DebugYaw;
            if (!RealmMounts.TryFly(true, out _) || RealmMounts.Flying?.Id != "mt_dragon" || Mathf.Abs(RealmMounts.PanMul - 2.4f) > 0.0001f) Fail("용을 타고 못 남");
            for (int i = 0; i < 80; i++) cam.Tick(0.05f);
            float yawTurn = cam.DebugYaw - y0;
            float want = RealmWorldMapCamera.FlyAutoYawRad * 2.4f * 4f;
            if (Mathf.Abs(cam.DebugRadius - RealmMounts.FlyRadius) > 1.5f || cam.DebugPitch > 0.36f || cam.DebugPitch < 0.34f) Fail($"나는 카메라 거리 {cam.DebugRadius:0} 기울기 {cam.DebugPitch:0.000}");
            if (Mathf.Abs(yawTurn - want) > 0.05f) Fail($"자동 돌기 4초 {yawTurn:0.00}rad ≠ {want:0.00}");
            // 학으로 바꾸면 돌아보기가 느려진다
            RealmMounts.Restore("mt_crane", null, null);
            RealmMounts.TryFly(true, out _);
            float yb = cam.DebugYaw;
            for (int i = 0; i < 40; i++) cam.Tick(0.05f);
            float craneTurn = cam.DebugYaw - yb;
            if (Mathf.Abs(craneTurn - RealmWorldMapCamera.FlyAutoYawRad * 1.7f * 2f) > 0.05f) Fail($"학 자동 돌기 2초 {craneTurn:0.000}rad");
            // 드래그 회전이 배율만큼 빨라진다
            float ya = cam.DebugYaw;
            cam.DebugBeginDrag(Vector2.zero);
            cam.DebugApplyDrag(new Vector2(100f, 0f), new Vector2(100f, 0f));
            float dragTurn = cam.DebugYaw - ya;
            cam.DebugEndDrag(new Vector2(100f, 0f));
            if (Mathf.Abs(dragTurn - 100f * 0.006f * 1.7f) > 0.005f) Fail($"나는 중 드래그 회전 {dragTurn:0.000} ≠ {100f * 0.006f * 1.7f:0.000}");
            // 내리면 날기 전 거리·기울기로 돌아온다
            RealmMounts.Land();
            cam.Tick(0.02f);
            if (Mathf.Abs(cam.DebugRadius - r0) > 0.01f || Mathf.Abs(cam.DebugPitch - p0) > 0.01f) Fail($"내린 뒤 카메라 {cam.DebugRadius:0}/{cam.DebugPitch:0.00} ≠ 날기 전 {r0:0}/{p0:0.00}");
            if (Mathf.Abs(RealmMounts.PanMul - 1f) > 0.0001f) Fail("내렸는데 돌아보기 배율이 남음");
            // 디오라마로 돌아가면 저절로 내린다(RealmMountUi.Update)
            RealmMounts.TryFly(true, out _);
            RealmMapState.Toggle();
            var ui = RealmMountUi.Instance;
            typeof(RealmMountUi).GetMethod("Update", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(ui, null);
            if (RealmMounts.IsFlying) Fail("지도를 떠났는데 안 내림");
            parts.Add("날기(디오라마에선 못 남·국토 지도에서 용 ×2.4 — 카메라 거리 130 기울기 0.35·자동 돌기 0.12rad/초×배율·학 ×1.7·드래그 회전 ×배율·내리면 제자리·지도를 떠나면 내림)");
        }

        private static void CheckUi(RealmMountUi ui, string a, string b, int rosterCount, List<string> parts)
        {
            RealmMounts.ResetForTest();
            Cities(9);
            if (RealmMapState.ViewingMap) RealmMapState.Toggle();
            ui.TogglePanel();
            if (!ui.PanelOpen) Fail("명마 패널이 안 열림");
            int wantRows = Mathf.Min(rosterCount, RealmMountUi.MaxRows);
            if (ui.Rows.Count != wantRows) Fail($"패널 줄 {ui.Rows.Count} ≠ {wantRows}");
            if (rosterCount > RealmMountUi.MaxRows && !ui.MoreText.Contains((rosterCount - RealmMountUi.MaxRows).ToString())) Fail($"넘치는 로스터 안내 '{ui.MoreText}'");
            var rowA = ui.Rows.FirstOrDefault(r => r.officerId == a);
            if (rowA.button == null) { Fail("첫 무장 줄이 없다"); return; }
            if (!rowA.label.text.Contains(RealmLocalization.T("mount.no_horse_row", "말 없음"))) Fail($"처음 줄 글 '{rowA.label.text}'");
            rowA.button.onClick.Invoke();
            if (RealmMounts.MountOf(a)?.Id != "mt_farm") Fail("줄을 누르니 농마가 안 얹힘");
            rowA = ui.Rows.FirstOrDefault(r => r.officerId == a);
            if (rowA.label == null || !rowA.label.text.Contains(RealmMounts.Def("mt_farm").Name)) Fail("줄 글이 안 바뀜");
            RealmMounts.Equip(a, null);
            ui.TogglePanel();
            if (ui.PanelOpen) Fail("명마 패널이 안 닫힘");
            // 날기 단추 — 디오라마에선 숨김, 국토 지도에서 보임, 글이 바뀜
            typeof(RealmMountUi).GetMethod("RefreshButtons", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(ui, null);
            if (ui.FlyButton.gameObject.activeSelf) Fail("디오라마인데 날기 단추가 보임");
            RealmMapState.Toggle();
            typeof(RealmMountUi).GetMethod("RefreshButtons", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(ui, null);
            if (!ui.FlyButton.gameObject.activeSelf) Fail("국토 지도인데 날기 단추가 안 보임");
            if (!ui.ToggleFly() || !RealmMounts.IsFlying) Fail("날기 단추로 못 남");
            typeof(RealmMountUi).GetMethod("RefreshButtons", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(ui, null);
            if (!ui.FlyLabel.Contains(RealmLocalization.T("mount.btn_land", "내리기")) || ui.FlyLabel.Contains("mount.")) Fail($"나는 중 단추 글 '{ui.FlyLabel}'");
            if (!ui.CycleFly() || RealmMounts.Flying == null) Fail("Shift+H 로 나는 채 바꿈");
            if (!ui.ToggleFly() || RealmMounts.IsFlying) Fail("다시 눌러 못 내림");
            Cities(1);
            typeof(RealmMountUi).GetMethod("RefreshButtons", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(ui, null);
            if (ui.FlyButton.gameObject.activeSelf) Fail("날 것이 없는데 단추가 보임");
            RealmMapState.Toggle();
            parts.Add($"화면(명마 패널 줄 {wantRows}/{rosterCount}·줄을 누르면 얹힘·날기 단추는 국토 지도+날 것이 있을 때만·Shift+H 바꿈)");
        }

        private static void CheckSave(string a, List<string> parts)
        {
            RealmMounts.ResetForTest();
            Cities(9);
            RealmMounts.Restore("mt_crane", null, null);
            RealmMounts.Equip(a, "mt_brown");
            string json = RealmSaveState.ToJson();
            if (!json.Contains("\"mountSel\":\"mt_crane\"") || !json.Contains("\"version\":4") || !json.Contains("mt_brown")) Fail("세이브에 탈것이 없다(버전은 4 그대로)");
            RealmMounts.Restore("", null, null);
            if (!RealmSaveState.ApplyJson(json) || RealmMounts.Sel != "mt_crane" || RealmMounts.RiderOf("mt_brown") != a || RealmMounts.IsFlying) Fail("왕복 뒤 고른 것·장착이 달라짐");
            string old = Regex.Replace(json, ",\"mountSel\":\"[^\"]*\",\"mountEqOfficers\":\\[[^\\]]*\\],\"mountEqMounts\":\\[[^\\]]*\\]", "");
            if (old.Contains("mountSel")) { Fail("옛 세이브 가짜 만들기 실패"); return; }
            RealmMounts.Restore("mt_dragon", new[] { a }, new[] { "mt_white" });
            if (!RealmSaveState.ApplyJson(old) || RealmMounts.Sel != "" || RealmMounts.RiderOf("mt_white") != null) Fail("탈것 없는 옛 세이브를 읽었는데 남음");
            // 이상한 값(모르는 말·중복 말·비행을 얹음)은 버린다
            RealmMounts.Restore("mt_farm", new[] { a, "b", "c" }, new[] { "mt_white", "mt_white", "mt_crane" });
            if (RealmMounts.RiderOf("mt_white") != a || RealmMounts.Sel != "" || RealmMounts.RiderOf("mt_crane") != null) Fail("이상한 값을 걸러 내지 못함");
            parts.Add("세이브(고른 날 탈것·장착 표 왕복·나는 채 저장 안 함·옛 세이브는 안 고름·모르는/중복/비행 장착은 버림·버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
