using System.Reflection;
using TMPro;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0075 — 네 판 설정 창(만리·나락·마을·종횡)의 "음성" 줄: 실행 때 생겼는지 · 누르면 `SagaVoice.Enabled` 가 뒤집히고 다시 누르면 돌아오는지 ·
    /// 일곱째 자리(82 간격, y −622)에 섰는지. 판 장면 판이 설정 창 점검 뒤에 한 줄로 부른다(장면 안, 플레이 중). 실패는 LogError(판 러너가 오류로 센다).
    /// 끝나면 Enabled 를 원래 값으로.
    /// </summary>
    public static class PlaytestSettingsVoice
    {
        private const BindingFlags Any = BindingFlags.NonPublic | BindingFlags.Instance;

        public static bool Check(string tag, System.Type panelType)
        {
            var panel = Object.FindFirstObjectByType(panelType) as MonoBehaviour;
            if (panel == null) return Fail(tag, $"{panelType.Name} 없음");
            var value = panelType.GetField("_voiceValueLabel", Any)?.GetValue(panel) as TextMeshProUGUI;
            var name = panelType.GetField("_voiceNameLabel", Any)?.GetValue(panel) as TextMeshProUGUI;
            var choose = panelType.GetMethod("ChooseVoice", Any);
            if (value == null || name == null || choose == null) return Fail(tag, "음성 줄이 안 생김(EnsureVoiceRow)");
            bool before = SagaVoice.Enabled;
            try
            {
                choose.Invoke(panel, null);
                if (SagaVoice.Enabled == before) return Fail(tag, "음성 줄을 눌러도 SagaVoice.Enabled 가 안 바뀜");
                string flipped = value.text;
                choose.Invoke(panel, null);
                if (SagaVoice.Enabled != before) return Fail(tag, "다시 눌러도 원래 값으로 안 돌아옴");
                if (string.IsNullOrEmpty(flipped) || flipped == value.text) return Fail(tag, $"값 글이 안 바뀜 '{flipped}'→'{value.text}'");
            }
            finally { SagaVoice.Enabled = before; }
            float y = name.rectTransform.anchoredPosition.y;
            if (Mathf.Abs(y - (-130f - 82f * 6)) > 0.5f) return Fail(tag, $"음성 줄 자리 y {y:0} ≠ −622");
            Debug.Log($"[{tag}] settings voice OK - 음성 줄 생김·눌러 켬/끔 뒤집힘·되돌림·자리 y {y:0}");
            return true;
        }

        private static bool Fail(string tag, string msg)
        {
            Debug.LogError($"[{tag}] settings voice FAIL - {msg}");
            return false;
        }
    }
}
