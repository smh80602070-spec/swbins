using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md — SagaGo의 UI/DialogueLabel.cs를 그대로
    /// 복사(네임스페이스만 변경) — 처치 보상 토스트(경험치·돈·무기 획득
    /// 문구)를 띄우는 데 그대로 재사용한다.
    /// </summary>
    public class DialogueLabel : MonoBehaviour
    {
        public static DialogueLabel Instance { get; private set; }

        [SerializeField] private TextMeshProUGUI label;

        private Coroutine _hideRoutine;

        private void Awake()
        {
            Instance = this;
            if (label != null)
            {
                ApplyLayout(label);
                label.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// 자리 한 곳 — 씬 빌더와 <see cref="Awake"/> 가 같이 부른다(씬을 다시 안 지어도 실행 때 맞는다).
        /// PLAN.md 110 ⑤c-3: 위 가운데(920 폭)는 목표판·비결·점프·파티 줄과 겹쳤다. 빈 곳은 왼쪽 기둥(파티·미니맵·조이스틱)과
        /// 오른쪽 단추 세 줄 사이뿐이라 그 아래쪽에 — 왼쪽 기준이라 20:9 에서도 그 틈에 남는다.
        /// </summary>
        public static void ApplyLayout(TextMeshProUGUI text)
        {
            var rect = text.rectTransform;
            rect.anchorMin = rect.anchorMax = Vector2.zero;
            rect.pivot = new Vector2(0.5f, 0f);
            rect.anchoredPosition = new Vector2(Saga.Dungeon.World.DungeonRegionTracker.FreeCenterX, 40f);
            rect.sizeDelta = new Vector2(760f, 170f);
            text.fontSize = 30;
            text.alignment = TextAlignmentOptions.Bottom;
        }

        /// <summary>지금 떠 있는 글(없으면 빈 글) — 뒤따르는 알림이 덧붙일 때(PLAN.md 109-10-5 우두머리 토벌).</summary>
        public string CurrentText => label != null && label.gameObject.activeSelf ? label.text : "";

        public void Show(string text, float seconds)
        {
            if (label == null) return;

            label.text = text;
            label.gameObject.SetActive(true);
            if (_hideRoutine != null)
            {
                StopCoroutine(_hideRoutine);
            }
            _hideRoutine = StartCoroutine(HideAfter(seconds));
        }

        private IEnumerator HideAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            label.gameObject.SetActive(false);
            _hideRoutine = null;
        }
    }
}
