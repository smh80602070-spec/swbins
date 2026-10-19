using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0126 2나락 전리품 거르기 진단 — `PlaytestDungeonHeadless` 가 대상 적 카드(foecard) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 기본 셋(전설·보물 빛기둥, 나머지 보이기 · 빠른 추가 센 무기 빛기둥 = 명품 아래라도 명품 기둥) ② 상품 숨기기(표식 안 섬·보석 함께면
    /// 기둥 없는 표식) ③ 금·보석만이면 "모든 물건 숨기기" 에도 보임 ④ 위에서부터 첫 일치·순서 바꾸면 뜻이 바뀜 ⑤ 저장 왕복·4층 추천 한 번·
    /// 설정 창 거르기 창(줄 수 = 규칙 수). 거르기 PlayerPrefs 둘은 떠 뒀다 되돌리고, 만든 표식은 지운다.
    /// </summary>
    public static class PlaytestDungeonLootFilter
    {
        private const string T = "[PlaytestDungeonHeadless] lootfilter";
        private const string PrefKey = "saga_dungeon_loot_filter", HintKey = "saga_dungeon_loot_hinted";
        private static readonly Vector3 Far = new Vector3(-7000f, 0f, -7000f);
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string pf = PlayerPrefs.HasKey(PrefKey) ? PlayerPrefs.GetString(PrefKey) : null;
            int hint = PlayerPrefs.HasKey(HintKey) ? PlayerPrefs.GetInt(HintKey) : -1;
            ItemData common = ItemData.Get("wp_axe"), fine = ItemData.Get("wp_saber"), treasure = ItemData.Get("wp_glaive"), legend = ItemData.Get("wp_lm_tomb");
            try
            {
                LootFilter.ResetForTest();

                // ① 기본 셋
                Begin();
                if (LootFilter.Rules.Count != 2) Fail($"기본 규칙 {LootFilter.Rules.Count} ≠ 2");
                Want(legend, false, LootFilter.Act.Beam, "전설");
                Want(treasure, false, LootFilter.Act.Beam, "보물");
                Want(fine, false, LootFilter.Act.Show, "명품(안 센)");
                Want(common, true, LootFilter.Act.Show, "센 상품(기본엔 없음)");
                LootFilter.AddPreset(2);
                Want(common, true, LootFilter.Act.Beam, "센 무기 빛기둥 뒤 센 상품");
                Want(common, false, LootFilter.Act.Show, "센 무기 빛기둥 뒤 안 센 상품");
                int p0 = LootMarker.PillarCount;
                LootMarker.SpawnFiltered(Far, common, true, false);
                if (LootMarker.PillarCount != p0 + 1 || LootMarker.LastPillarTier != LootMarker.PillarFine) Fail($"센 상품 빛기둥 {LootMarker.LastPillarTier} ≠ 명품 기둥");
                End("defaults OK - 기본 전설·보물 빛기둥 · 센 무기 빛기둥(빠른 추가)은 명품 기둥 · 나머지 보이기");
                LootFilter.ResetForTest();

                // ② 상품 숨기기
                Begin();
                LootFilter.AddPreset(0);
                Want(common, false, LootFilter.Act.Hide, "상품 숨기기 뒤 상품");
                Want(fine, false, LootFilter.Act.Show, "상품 숨기기 뒤 명품");
                Want(legend, false, LootFilter.Act.Beam, "상품 숨기기 뒤 전설");
                int s0 = LootMarker.SpawnCount, h0 = LootMarker.HiddenCount;
                LootMarker.SpawnFiltered(Far, common, false, false);
                if (LootMarker.SpawnCount != s0 || LootMarker.HiddenCount != h0 + 1) Fail("숨긴 상품에 표식이 섬");
                p0 = LootMarker.PillarCount;
                LootMarker.SpawnFiltered(Far, common, false, true);
                if (LootMarker.SpawnCount != s0 + 1 || LootMarker.PillarCount != p0) Fail("보석이 함께인데 표식이 없거나 기둥이 섬");
                End("hide OK - 상품 숨김(표식 0)·보석 함께면 기둥 없는 표식·명품 보임");

                // ③ 금·보석만 늘 보임
                Begin();
                LootFilter.Add(new LootFilter.Rule { act = LootFilter.Act.Hide });
                if (LootFilter.Decide(null, false) != LootFilter.Act.Show) Fail("물건 없는 떨굼(금·보석)이 숨겨짐");
                Want(legend, false, LootFilter.Act.Hide, "모든 물건 숨기기 뒤 전설");
                s0 = LootMarker.SpawnCount;
                LootMarker.SpawnFiltered(Far, null, false, true);
                if (LootMarker.SpawnCount != s0 + 1) Fail("금·보석 표식이 안 섬");
                End("gold OK - 모든 물건 숨기기에도 금·보석 표식");

                // ④ 첫 일치·순서
                Begin();
                LootFilter.ResetForTest();
                while (LootFilter.Rules.Count > 0) LootFilter.Remove(0);
                LootFilter.Add(new LootFilter.Rule { act = LootFilter.Act.Hide });
                LootFilter.Add(new LootFilter.Rule { minTier = 2, act = LootFilter.Act.Show });
                Want(treasure, false, LootFilter.Act.Show, "명품 이상 보이기가 위");
                Want(common, false, LootFilter.Act.Hide, "아래 전부 숨기기");
                LootFilter.Move(0, 1);
                Want(treasure, false, LootFilter.Act.Hide, "순서 바꾼 뒤 보물");
                LootFilter.Toggle(0);
                Want(treasure, false, LootFilter.Act.Show, "윗줄 끈 뒤 보물");
                LootFilter.CycleAct(1);
                if (LootFilter.Rules[1].act != LootFilter.Act.Hide) Fail($"동작 돌리기 보이기→{LootFilter.Rules[1].act}");
                End("order OK - 위에서부터 첫 일치·순서·끄기·동작 돌리기");

                // ⑤ 저장 왕복·추천·창
                Begin();
                string before = Dump();
                LootFilter.Reload();
                if (Dump() != before) Fail($"저장 왕복 {Dump()} ≠ {before}");
                if (LootFilter.HintIfDeep(3) != null) Fail("3층에서 추천");
                if (LootFilter.HintIfDeep(4) == null) Fail("4층에서 추천 안 함");
                if (LootFilter.HintIfDeep(5) != null) Fail("추천이 두 번");
                LootFilter.ResetToDefaults();
                var settings = Object.FindFirstObjectByType<DungeonSettingsPanel>();
                var panel = settings != null ? settings.LootPanel : null;
                if (panel == null) Fail("설정 창에 거르기 창이 없음");
                else
                {
                    panel.Open();
                    int rows = 0;
                    foreach (var t in panel.GetComponentsInChildren<TMPro.TextMeshProUGUI>(false)) if (t.text.StartsWith("1. ") || t.text.StartsWith("2. ") || t.text.StartsWith("3. ")) rows++;
                    if (!panel.IsOpen || rows != 2) Fail($"거르기 창 열림 {panel.IsOpen} · 줄 {rows} ≠ 2");
                    LootFilter.AddPreset(3);
                    panel.Refresh();
                    rows = 0;
                    foreach (var t in panel.GetComponentsInChildren<TMPro.TextMeshProUGUI>(false)) if (t.text.Length > 2 && char.IsDigit(t.text[0]) && t.text[1] == '.') rows++;
                    if (rows != 3) Fail($"빠른 추가 뒤 줄 {rows} ≠ 3");
                    while (LootFilter.AddPreset(0)) { }
                    panel.Refresh();
                    int bad = Overlaps(panel.Root);
                    if (LootFilter.Rules.Count != LootFilter.MaxRules || bad != 0) Fail($"규칙 {LootFilter.Rules.Count} 줄 꽉 찬 창 겹침·밖 {bad}");
                    panel.Close();
                }
                End($"save OK - 저장 왕복·4층 추천 한 번·설정 거르기 창 줄 = 규칙 · {LootFilter.MaxRules}줄 꽉 찬 창 겹침·밖 0");
            }
            finally
            {
                if (pf == null) PlayerPrefs.DeleteKey(PrefKey); else PlayerPrefs.SetString(PrefKey, pf);
                if (hint < 0) PlayerPrefs.DeleteKey(HintKey); else PlayerPrefs.SetInt(HintKey, hint);
                LootFilter.Reload();
                foreach (var m in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if ((m.transform.position - Far).sqrMagnitude < 1f) Object.DestroyImmediate(m.gameObject);
            }
            return _ok;
        }

        /// <summary>창 바로 밑 위젯(단추·글)끼리 겹친 쌍 + 창 밖으로 나간 수 — 창 좌표로 잰다(UiLayoutCheck 는 설정 창 속 단추를 안 누른다).</summary>
        private static int Overlaps(RectTransform root)
        {
            if (root == null) return 1;
            var rects = new System.Collections.Generic.List<Rect>();
            var c = new Vector3[4];
            Rect Local(RectTransform t)
            {
                t.GetWorldCorners(c);
                Vector3 a = root.InverseTransformPoint(c[0]), b = root.InverseTransformPoint(c[2]);
                return Rect.MinMaxRect(a.x, a.y, b.x, b.y);
            }
            Rect box = Local(root);
            int bad = 0;
            foreach (RectTransform t in root)
            {
                if (!t.gameObject.activeSelf) continue;
                Rect r = Local(t);
                if (r.xMin < box.xMin - 0.5f || r.xMax > box.xMax + 0.5f || r.yMin < box.yMin - 0.5f || r.yMax > box.yMax + 0.5f) bad++;
                foreach (var o in rects) if (r.xMin < o.xMax - 0.5f && o.xMin < r.xMax - 0.5f && r.yMin < o.yMax - 0.5f && o.yMin < r.yMax - 0.5f) bad++;
                rects.Add(r);
            }
            return bad;
        }

        private static string Dump()
        {
            var sb = new System.Text.StringBuilder();
            foreach (var r in LootFilter.Rules) sb.Append($"{r.minTier},{r.maxTier},{r.lore},{r.better},{r.act},{r.off};");
            return sb.ToString();
        }

        private static void Want(ItemData item, bool better, LootFilter.Act want, string what)
        {
            if (item == null) { Fail($"{what} — 물건 없음"); return; }
            var got = LootFilter.Decide(item, better);
            if (got != want) Fail($"{what} {item.Id} → {got} ≠ {want}");
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
