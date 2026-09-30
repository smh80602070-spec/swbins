using UnityEngine;
using UnityEngine.EventSystems;

namespace Saga.Core
{
    /// <summary>
    /// VERTICAL_SLICE.md Phase 4 — 왼쪽 아래 가상 조이스틱. saga-godot의
    /// virtual_joystick.gd와 같은 감각(반경 안에서만 움직이고, 놓으면
    /// 중앙으로). Unity UI(uGUI)의 EventSystem 포인터 인터페이스를 쓰므로
    /// Godot처럼 터치 index를 손으로 추적할 필요가 없다(엔진이 대신 해 준다).
    /// Value: x=오른쪽(+), y=앞(+) — PlayerController가 매 프레임 읽는다.
    /// </summary>
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [SerializeField] private RectTransform knob;
        [SerializeField] private float radius = 60f;

        public Vector2 Value { get; private set; } = Vector2.zero;

        private RectTransform _rect;

        private void Awake()
        {
            _rect = (RectTransform)transform;
            CenterKnob();
        }

        private void CenterKnob()
        {
            if (knob != null) knob.anchoredPosition = Vector2.zero;
        }

        public void OnPointerDown(PointerEventData eventData) => UpdateKnob(eventData);
        public void OnDrag(PointerEventData eventData) => UpdateKnob(eventData);

        public void OnPointerUp(PointerEventData eventData)
        {
            CenterKnob();
            Value = Vector2.zero;
        }

        private void UpdateKnob(PointerEventData eventData)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                _rect, eventData.position, eventData.pressEventCamera, out Vector2 local);
            if (local.magnitude > radius) local = local.normalized * radius;
            if (knob != null) knob.anchoredPosition = local;
            Value = new Vector2(local.x / radius, local.y / radius);
        }
    }
}
