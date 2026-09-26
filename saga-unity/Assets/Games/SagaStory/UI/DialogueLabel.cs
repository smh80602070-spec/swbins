using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 51장 "STORY 확장 — NPC" 첫 슬라이스 — GO `UI/DialogueLabel.cs`와
    /// 같은 결(다섯 판 공용 로직 복사 관례, 루트 CLAUDE.md). 지나가다 듣는
    /// 한 마디를 띄우는 화면 상단 자막. `StoryHud.cs`(사명/MP 상시 표시)와는
    /// 별개 Text — 겹쳐 쓰면 퀘스트 진행이 대사에 덮인다.
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
        /// PLAN.md 110 ⑤c-3: 위 가운데(920 폭)는 왼쪽 위 상태 글·목표판·무예 칸 줄과 겹쳤다. 빈 곳은 아래 가운데 —
        /// 왼쪽 방향 단추(~320)와 오른쪽 행동 단추(오른쪽 끝에서 ~510) 사이, 왼쪽 기준이라 20:9 에서도 그 틈에 남는다.
        /// </summary>
        public static void ApplyLayout(TextMeshProUGUI text)
        {
            var rect = text.rectTransform;
            rect.anchorMin = rect.anchorMax = Vector2.zero;
            rect.pivot = new Vector2(0.5f, 0f);
            rect.anchoredPosition = new Vector2(705f, 30f);
            rect.sizeDelta = new Vector2(720f, 170f);
            text.fontSize = 30;
            text.alignment = TextAlignmentOptions.Bottom;
        }

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
