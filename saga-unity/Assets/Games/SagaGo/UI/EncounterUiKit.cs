using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// BanditEncounter.cs가 원래 자기 안에 private static으로 갖고 있던
    /// "사건 UI 조립" 공통 부품(캔버스/패널/텍스트/버튼/막대)을 뽑아낸
    /// 것 — 두 번째 실시간 전투 사건(World/RareWolfEncounter.cs)이 생기며
    /// 그대로 복붙하면 ~150줄이 그대로 두 벌이 될 상황이라 여기로 옮겼다
    /// (2026-09-11, N=2가 되고서야 뽑음 — N=1일 때 미리 일반화하지 않는다는
    /// 이 저장소 원칙 그대로). 판정(DuelRules.cs)·상태 흐름(각 Encounter의
    /// State 머신)은 안 건드리고 순수 UI 생성 코드만 옮긴 것이라 동작은
    /// 바이트 단위로 그대로다.
    /// </summary>
    public static class EncounterUiKit
    {
        public static Canvas NewCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            GoSettingsState.ApplyUiScale(scaler); // 설정에서 고른 UI 크기를 새 캔버스에도 그대로.
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        public static GameObject NewPanel(Transform parent, Vector2 anchor, Vector2 size, Color color)
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = color;
            return go;
        }

        public static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var text = go.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = content;
            return text;
        }

        public static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject($"Btn_{label}", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var img = go.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0.18f);
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            // 에디터 빌드면 영속 리스너, Play 중이면 런타임 리스너 — SagaCore/ButtonWiring.cs(2026-09-23 먹통 버그).
            Saga.Core.ButtonWiring.Wire(button, onClick);

            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 26);

            return button;
        }

        // PLAN.md 110 ⑤c-3 — 옛 결투(도적·흰 늑대·사당) 화면 자리 한 곳. 늘 있는 HUD 를 피한다:
        // 제목·남은 시간·막대 셋은 왼쪽 위 레벨·돈 줄(위에서 ~195)·두 줄 대사(위에서 112~) 밑, 속공은 조이스틱(왼쪽 아래 70~210) 오른쪽.
        // NewText 는 피벗 = 앵커(왼쪽 위)라 x·y 가 상자의 왼쪽 위 모서리다.
        public const float DuelTitleX = 30f;
        public const float DuelTitleY = -250f;
        public static readonly Vector2 DuelTimerPos = new Vector2(430f, DuelTitleY); // 폭 220, 오른쪽 정렬 = 막대 끝(650)에 맞춤
        public static float DuelRowY(int row) => -320f - 50f * row;
        public static readonly Vector2 DuelQuickPos = new Vector2(380f, 130f);

        /// <summary>왼쪽 라벨 + 오른쪽으로 차는 막대 하나(Image.fillAmount 기반).</summary>
        public static Image NewBarRow(Transform parent, string label, float y, out Image background)
        {
            NewText(parent, label, new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(110f, 40f), 22).alignment = TextAlignmentOptions.Left;

            var bgGo = new GameObject($"{label}Bar", typeof(RectTransform));
            bgGo.transform.SetParent(parent, false);
            var rect = (RectTransform)bgGo.transform;
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 0.5f);
            rect.anchoredPosition = new Vector2(150f, y);
            rect.sizeDelta = new Vector2(500f, 30f);
            background = bgGo.AddComponent<Image>();
            background.color = new Color(1f, 1f, 1f, 0.15f);

            var fillGo = new GameObject("Fill", typeof(RectTransform));
            fillGo.transform.SetParent(bgGo.transform, false);
            var fillRect = (RectTransform)fillGo.transform;
            fillRect.anchorMin = Vector2.zero;
            fillRect.anchorMax = Vector2.one;
            fillRect.offsetMin = Vector2.zero;
            fillRect.offsetMax = Vector2.zero;
            var fill = fillGo.AddComponent<Image>();
            fill.color = new Color(0.85f, 0.25f, 0.2f, 0.9f);
            fill.type = Image.Type.Filled;
            fill.fillMethod = Image.FillMethod.Horizontal;
            fill.fillAmount = 1f;
            return fill;
        }
    }
}
