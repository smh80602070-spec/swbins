using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0180 물약 달이기 창(고돗 G-0320 `craft_bench.gd` open_brew 짝) — `ForestBootstrap.Start` 가 Play 때 세우고, 제작대 창의 "⚗️ 물약" 단추가 연다.
    /// 머리 = 주머니(약초·재료 수)·오늘 마신 물약 · 재료 넷마다 줄 하나(밝혀졌으면 물약 이름, 아니면 ❔) + 「달이기」 · 닫기.
    /// </summary>
    public class ForestBrewPanel : MonoBehaviour
    {
        public static ForestBrewPanel Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title, _today;
        private readonly TextMeshProUGUI[] _line = new TextMeshProUGUI[4];
        private readonly Button[] _brew = new Button[4];

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;
        public string Line(int i) => _line[i] != null ? _line[i].text : "";
        public Button BrewButton(int i) => _brew[i];

        public static ForestBrewPanel Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestBrew").AddComponent<ForestBrewPanel>();
        }

        private void Awake()
        {
            Instance = this;
            BuildUi();
            ForestBrew.Changed += Refresh;
        }

        private void OnDestroy()
        {
            ForestBrew.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("BrewCanvas", 95, transform);
            _panel = SagaUi.NewPanel(canvas.transform, "BrewPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(940f, 640f), SagaUi.Panel, "window").gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 28f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(880f, 56f));
            _today = SagaUi.NewText(_panel.transform, "", 22f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -88f), new Vector2(880f, 44f));
            for (int i = 0; i < 4; i++)
            {
                int k = i;
                float y0 = -150f - 96f * i;
                _line[i] = SagaUi.NewText(_panel.transform, "", 21f, SagaUi.Ink, new Vector2(0f, 1f), new Vector2(30f, y0), new Vector2(640f, 80f));
                _line[i].alignment = TextAlignmentOptions.Left;
                _brew[i] = SagaUi.NewButton(_panel.transform, $"Brew{i}", "", new Vector2(1f, 1f), new Vector2(-30f, y0 - 12f), new Vector2(200f, 56f), SagaUi.ButtonAccent, 22f);
                _brew[i].onClick.AddListener(() => PressBrew(k));
            }
            var close = SagaUi.NewButton(_panel.transform, "BrewClose", ForestLocalization.T("hand.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(240f, 56f), SagaUi.ButtonIdle, 24f);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        public void Open() { if (_panel == null) return; _panel.SetActive(true); _panel.transform.SetAsLastSibling(); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            _title.text = string.Format(ForestLocalization.T("brew.title", "⚗️ 물약 달이기 — 🌿 약초 {0} + 재료 하나 (버섯을 캐면 약초)"), ForestBrew.Herbs);
            _today.text = string.Format(ForestLocalization.T("brew.today", "오늘: {0}"), ForestBrew.PotionName(ForestBrew.Active));
            for (int i = 0; i < 4; i++)
            {
                var m = ForestBrew.Mats[i];
                _line[i].text = $"{ForestBrew.MatName(m)} ×{ForestBrew.Count(m)}\n<size=85%>{ForestBrew.RecipeLine(m)}</size>";
                _brew[i].GetComponentInChildren<TMP_Text>().text = ForestLocalization.T("brew.go", "⚗️ 달이기");
                _brew[i].interactable = ForestBrew.Herbs > 0 && ForestBrew.Count(m) > 0;
            }
        }

        private static string Why(string key)
        {
            switch (key)
            {
                case "brew.why_herb": return ForestLocalization.T(key, "약초가 없다 — 버섯을 캐 오자");
                case "brew.why_mat": return ForestLocalization.T(key, "그 재료가 없다");
                case "brew.why_off": return ForestLocalization.T(key, "물약 양조가 꺼져 있다");
                default: return ForestLocalization.T("brew.why_none", "달일 수 없다");
            }
        }

        public void PressBrew(int i)
        {
            var m = ForestBrew.Mats[i];
            bool knew = ForestBrew.Known(m);
            string why = ForestBrew.Brew(m, ForestVisitors.Today);
            string line = why != null ? Why(why)
                : string.Format(ForestLocalization.T(knew ? "brew.drank" : "brew.found", knew ? "⚗️ 달여 마셨다 — {0}" : "✨ 새 물약을 찾았다! — {0}"), ForestBrew.PotionName(ForestBrew.Active));
            DialogueLabel.Instance?.Show(line, 3f);
            Refresh();
        }
    }
}
