using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// U-0126 전리품 거르기 창(웹 W-0287 설정 창 조각) — 설정 창의 "🧹 거르기" 단추가 연다. 규칙 줄 열둘 자리를 미리 지어 두고
    /// 켜고 끄며 글만 바꾼다(줄을 지웠다 새로 지으면 같은 프레임에 옛 줄이 남아 배치 점검이 겹침으로 센다).
    /// 줄마다 동작(보이기→숨기기→빛기둥)·▲·▼·켜짐/꺼짐·✕, 아래 빠른 추가 넷 + 기본으로. 실행 때만 짓는다(씬에 굽지 않음).
    /// </summary>
    public class LootFilterPanel : MonoBehaviour
    {
        private const float RowTop = -112f, RowStep = 47f, RowH = 43f;
        private GameObject _panel;
        private TextMeshProUGUI _title, _hint, _closeLabel, _resetLabel;
        private readonly TextMeshProUGUI[] _ruleText = new TextMeshProUGUI[LootFilter.MaxRules];
        private readonly TextMeshProUGUI[] _actLabel = new TextMeshProUGUI[LootFilter.MaxRules];
        private readonly TextMeshProUGUI[] _offLabel = new TextMeshProUGUI[LootFilter.MaxRules];
        private readonly Image[] _actImage = new Image[LootFilter.MaxRules];
        private readonly GameObject[][] _rowParts = new GameObject[LootFilter.MaxRules][];
        private readonly TextMeshProUGUI[] _presetLabel = new TextMeshProUGUI[4];
        private static readonly (string key, string ko)[] Presets =
        {
            ("lootf.preset.hide0", "상품 숨기기"), ("lootf.preset.hide1", "양품 이하 숨기기"),
            ("lootf.preset.better", "센 무기 빛기둥"), ("lootf.preset.beam2", "명품 이상 빛기둥"),
        };

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;

        /// <summary>설정 창 캔버스 밑에 창을 짓는다(닫힌 채).</summary>
        public void Build(Transform canvas)
        {
            if (_panel != null) return;
            _panel = DungeonSettingsPanel.NewPanel(canvas, new Vector2(0.5f, 0.5f), new Vector2(1000f, 820f), new Color(0f, 0f, 0f, 0.88f));
            _panel.name = "LootFilterPanel";
            _title = DungeonSettingsPanel.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, -20f), new Vector2(700f, 44f), 30);
            _title.alignment = TextAlignmentOptions.Left;
            _hint = DungeonSettingsPanel.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, -66f), new Vector2(940f, 34f), 18);
            _hint.alignment = TextAlignmentOptions.Left;
            _hint.color = new Color(0.8f, 0.8f, 0.8f);

            for (int i = 0; i < LootFilter.MaxRules; i++)
            {
                int k = i;
                float y = RowTop - RowStep * i;
                var text = DungeonSettingsPanel.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(480f, RowH), 22);
                text.alignment = TextAlignmentOptions.Left;
                _ruleText[i] = text;
                var act = DungeonSettingsPanel.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-334f, y), new Vector2(120f, RowH), () => Do(LootFilter.CycleAct(k)));
                var up = DungeonSettingsPanel.NewButton(_panel.transform, "▲", new Vector2(1f, 1f), new Vector2(-268f, y), new Vector2(56f, RowH), () => Do(LootFilter.Move(k, -1)));
                var down = DungeonSettingsPanel.NewButton(_panel.transform, "▼", new Vector2(1f, 1f), new Vector2(-202f, y), new Vector2(56f, RowH), () => Do(LootFilter.Move(k, 1)));
                var off = DungeonSettingsPanel.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-96f, y), new Vector2(96f, RowH), () => Do(LootFilter.Toggle(k)));
                var del = DungeonSettingsPanel.NewButton(_panel.transform, "✕", new Vector2(1f, 1f), new Vector2(-30f, y), new Vector2(56f, RowH), () => Do(LootFilter.Remove(k)));
                _actLabel[i] = act.GetComponentInChildren<TextMeshProUGUI>();
                _actImage[i] = act.GetComponent<Image>();
                _offLabel[i] = off.GetComponentInChildren<TextMeshProUGUI>();
                foreach (var b in new[] { act, up, down, off, del }) b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 20;
                _rowParts[i] = new[] { text.gameObject, act.gameObject, up.gameObject, down.gameObject, off.gameObject, del.gameObject };
            }

            float qy = RowTop - RowStep * LootFilter.MaxRules - 2f;
            for (int p = 0; p < Presets.Length; p++)
            {
                int k = p;
                var b = DungeonSettingsPanel.NewButton(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f + 190f * p, qy), new Vector2(180f, 48f), () => Do(LootFilter.AddPreset(k)));
                _presetLabel[p] = b.GetComponentInChildren<TextMeshProUGUI>();
                _presetLabel[p].fontSize = 20;
            }
            var reset = DungeonSettingsPanel.NewButton(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f + 190f * 4, qy), new Vector2(180f, 48f), () => { LootFilter.ResetToDefaults(); Refresh(); });
            _resetLabel = reset.GetComponentInChildren<TextMeshProUGUI>();
            _resetLabel.fontSize = 20;
            var close = DungeonSettingsPanel.NewButton(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 12f), new Vector2(240f, 50f), Close);
            _closeLabel = close.GetComponentInChildren<TextMeshProUGUI>();
            _panel.SetActive(false);
        }

        public void Open() { if (_panel == null) return; _panel.transform.SetAsLastSibling(); _panel.SetActive(true); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        private void Do(bool _) => Refresh();

        public void Refresh()
        {
            if (_panel == null) return;
            var rs = LootFilter.Rules;
            _title.text = string.Format(DungeonLocalization.T("lootf.title", "전리품 거르기  {0}/{1} 규칙"), rs.Count, LootFilter.MaxRules);
            _hint.text = DungeonLocalization.T("lootf.help", "위에서부터 처음 맞는 규칙대로 보입니다. 금·보석은 늘 보입니다. 숨겨도 보상은 그대로 받습니다.");
            for (int i = 0; i < LootFilter.MaxRules; i++)
            {
                bool has = i < rs.Count;
                foreach (var go in _rowParts[i]) if (go.activeSelf != has) go.SetActive(has);
                if (!has) continue;
                var r = rs[i];
                _ruleText[i].text = $"{i + 1}. {LootFilter.Describe(r)}";
                _ruleText[i].color = r.off ? new Color(1f, 1f, 1f, 0.45f) : Color.white;
                _actLabel[i].text = LootFilter.ActName(r.act);
                _actImage[i].color = r.act == LootFilter.Act.Hide ? new Color(1f, 0.4f, 0.35f, 0.4f)
                    : r.act == LootFilter.Act.Beam ? new Color(1f, 0.85f, 0.35f, 0.45f) : new Color(1f, 1f, 1f, 0.18f);
                _offLabel[i].text = DungeonLocalization.T(r.off ? "state.off" : "state.on");
            }
            for (int p = 0; p < Presets.Length; p++) _presetLabel[p].text = DungeonLocalization.T(Presets[p].key, Presets[p].ko);
            _resetLabel.text = DungeonLocalization.T("lootf.reset", "기본으로");
            _closeLabel.text = DungeonLocalization.T("settings.close");
        }
    }
}
