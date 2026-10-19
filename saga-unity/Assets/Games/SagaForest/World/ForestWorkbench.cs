using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0095 제작대(웹 사가마을 W-0103) — 가구 가게 곁 고정 소품 하나(모델 = 가구 표의 서안, 없으면 상자 대역) + 곁에서 F(또는 아래 단추) → 창:
    /// 채집 손 Lv·지금 배율 셋 · 「승급 (열매 n)」 → 3택(빠른 손·넉넉한 손·눈 밝은 손) · 「거절 — 열매 10 돌려받기」 · 닫기.
    /// 씬 재빌드 없이 `ForestBootstrap.Start` 가 <see cref="Install"/> 로 세운다(코드로 짓는 UI — 다른 Install 들과 같은 결).
    /// </summary>
    public class ForestWorkbench : MonoBehaviour
    {
        public const float UseRadius = 3f;
        public static ForestWorkbench Instance { get; private set; }

        private Transform _player;
        private GameObject _panel;
        private TextMeshProUGUI _title, _status;
        private Button _upgrade, _decline, _close, _hint, _lots;
        private readonly List<Button> _axisButtons = new List<Button>();
        private ForestHandState.Axis[] _offer;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public bool HintShown => _hint != null && _hint.gameObject.activeSelf;
        public IReadOnlyList<ForestHandState.Axis> Offer => _offer;

        public static ForestWorkbench Install()
        {
            if (Instance != null) return Instance;
            var go = new GameObject("ForestWorkbench");
            // 집 밖 서쪽 — 집 반폭 2m(동쪽 벽 = 집 x+2, 씬 빌더 주석)·출입 트리거 = 집+(0,0,−2.5) 에서 4m 떨어진 자리.
            // 처음엔 가구 가게 곁에 놓았는데 가구 가게는 집 안 방(IndoorRoom) 속 물건이라 들판에서 안 보이고 벽에 박혔다(U-0095 촬영).
            var house = Object.FindFirstObjectByType<ForestHouse>();
            Vector3 at = house != null ? house.transform.position + new Vector3(-4f, 0f, -2.5f) : new Vector3(11f, 0f, -12.5f);
            go.transform.position = new Vector3(at.x, 0f, at.z);
            return go.AddComponent<ForestWorkbench>();
        }

        private void Awake()
        {
            Instance = this;
            var pl = GameObject.FindWithTag("Player");
            _player = pl != null ? pl.transform : null;
            BuildProp();
            BuildUi();
            ForestHandState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            ForestHandState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void BuildProp()
        {
            var prefab = ForestFurnitureModels.Load("seoan");
            GameObject vis;
            if (prefab != null) vis = Instantiate(prefab, transform);
            else
            {
                vis = GameObject.CreatePrimitive(PrimitiveType.Cube);
                vis.transform.SetParent(transform, false);
                vis.transform.localScale = new Vector3(1.4f, 0.8f, 0.8f);
                vis.transform.localPosition = new Vector3(0f, 0.4f, 0f);
                Colliders.Strip(vis);
            }
            vis.name = "WorkbenchVisual";
        }

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("WorkbenchCanvas", 94, transform);
            _hint = SagaUi.NewButton(canvas.transform, "WorkbenchHint", ForestLocalization.T("hand.hint", "제작대 (F)"), new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(300f, 64f), SagaUi.ButtonAccent, 26f);
            _hint.onClick.AddListener(Toggle);
            _hint.gameObject.SetActive(false);
            _panel = SagaUi.NewPanel(canvas.transform, "WorkbenchPanel", new Vector2(0.5f, 0.5f), new Vector2(0f, 0f), new Vector2(860f, 720f), SagaUi.Panel).gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 34f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -46f), new Vector2(800f, 60f));
            _status = SagaUi.NewText(_panel.transform, "", 24f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -130f), new Vector2(800f, 100f));
            _upgrade = SagaUi.NewButton(_panel.transform, "Upgrade", "", new Vector2(0.5f, 1f), new Vector2(0f, -230f), new Vector2(520f, 72f), SagaUi.ButtonAccent, 26f);
            _upgrade.onClick.AddListener(PressUpgrade);
            for (int i = 0; i < 3; i++)
            {
                int at = i;
                var b = SagaUi.NewButton(_panel.transform, $"Axis{i}", "", new Vector2(0.5f, 1f), new Vector2(0f, -230f - 88f * i), new Vector2(720f, 76f), SagaUi.ButtonIdle, 26f);
                b.onClick.AddListener(() => PressAxis(at));
                _axisButtons.Add(b);
            }
            _decline = SagaUi.NewButton(_panel.transform, "Decline", "", new Vector2(0.5f, 1f), new Vector2(0f, -510f), new Vector2(520f, 64f), SagaUi.ButtonIdle, 24f);
            _decline.onClick.AddListener(PressDecline);
            _close = SagaUi.NewButton(_panel.transform, "Close", ForestLocalization.T("hand.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(240f, 56f), SagaUi.ButtonIdle, 24f);
            _close.onClick.AddListener(Close);
            // tasks U-0127 — 작은 빈 집 창(창 오른쪽 위)
            _lots = SagaUi.NewButton(_panel.transform, "Lots", ForestLocalization.T("lot.open", "🏠 빈 집"), new Vector2(1f, 1f), new Vector2(-18f, -18f), new Vector2(170f, 54f), SagaUi.ButtonIdle, 22f);
            _lots.onClick.AddListener(OpenLots);
            _panel.SetActive(false);
        }

        private void Update()
        {
            if (_player == null) { var pl = GameObject.FindWithTag("Player"); _player = pl != null ? pl.transform : null; if (_player == null) return; }
            bool near = Vector3.Distance(new Vector3(_player.position.x, 0f, _player.position.z), transform.position) <= UseRadius;
            if (_hint.gameObject.activeSelf != (near && !IsOpen)) _hint.gameObject.SetActive(near && !IsOpen);
            if (!near && IsOpen) Close();
            var kb = Keyboard.current;
            if (near && kb != null && kb.fKey.wasPressedThisFrame) Toggle();
        }

        public void Toggle()
        {
            if (IsOpen) Close();
            else { _panel.SetActive(true); Refresh(); }
        }

        public void Close()
        {
            if (_panel != null) _panel.SetActive(false);
        }

        private void OpenLots()
        {
            var r = ForestLotRunner.Instance;
            if (r == null) return;
            Close();
            r.Open();
        }

        /// <summary>창 글·단추를 지금 상태로.</summary>
        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            _title.text = string.Format(ForestLocalization.T("hand.title", "제작대 — 채집 손 Lv.{0}/{1}"), ForestHandState.Level, ForestHandState.MaxLv);
            _status.text = string.Format(ForestLocalization.T("hand.status", "채집 쿨 ×{0:0.00} · 열매 +1 확률 {1:0}% · 새 것 ×{2:0.0}\n열매 {3}개"),
                ForestHandState.CooldownMul, ForestHandState.BonusFruitChance * 100f, ForestHandState.NewItemMul, ForestState.FruitCount);
            bool pending = ForestHandState.Pending;
            if (pending && _offer == null) _offer = ForestHandState.Offer();
            if (!pending) _offer = null;
            _upgrade.gameObject.SetActive(!pending);
            _upgrade.GetComponentInChildren<TMP_Text>().text = ForestHandState.Level >= ForestHandState.MaxLv
                ? ForestLocalization.T("hand.max", "최고 단계")
                : string.Format(ForestLocalization.T("hand.upgrade", "승급 (열매 {0})"), ForestHandState.NextCost);
            _upgrade.interactable = ForestHandState.Level < ForestHandState.MaxLv;
            for (int i = 0; i < _axisButtons.Count; i++)
            {
                bool on = pending && _offer != null && i < _offer.Length;
                _axisButtons[i].gameObject.SetActive(on);
                if (on) _axisButtons[i].GetComponentInChildren<TMP_Text>().text = ForestHandState.AxisName(_offer[i]);
            }
            _decline.gameObject.SetActive(pending);
            _decline.GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("hand.decline", "거절 — 열매 {0} 돌려받기"), ForestHandState.DeclineRefund);
        }

        public void PressUpgrade()
        {
            string why = ForestHandState.Upgrade();
            if (why != null)
            {
                string msg = why == "hand.why_fruit"
                    ? string.Format(ForestLocalization.T("hand.why_fruit", "열매가 모자라다 (필요 {0}개)"), ForestHandState.NextCost)
                    : ForestLocalization.T(why, "지금은 승급할 수 없다");
                DialogueLabel.Instance?.Show(msg, 2.5f);
            }
            Refresh();
        }

        public void PressAxis(int i)
        {
            if (_offer == null || i < 0 || i >= _offer.Length) return;
            var a = _offer[i];
            if (ForestHandState.Choose(a))
                DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("hand.chosen", "채집 손 Lv.{0} — {1}"), ForestHandState.Level, ForestHandState.AxisName(a)), 3f);
            _offer = null;
            Refresh();
        }

        public void PressDecline()
        {
            if (ForestHandState.Decline())
                DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("hand.declined", "채집 손 Lv.{0} — 열매 {1} 돌려받음"), ForestHandState.Level, ForestHandState.DeclineRefund), 3f);
            _offer = null;
            Refresh();
        }
    }
}
