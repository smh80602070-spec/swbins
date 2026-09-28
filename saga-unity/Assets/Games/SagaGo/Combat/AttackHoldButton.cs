using UnityEngine;
using UnityEngine.EventSystems;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 109-14-2 강공격 — 화면 공격 단추를 누르고 있는지(`FieldCombatHud` 가 런타임에 붙인다).
    /// 누르는 동안 `FieldCombat.AttackHeldByUi`, 0.4초가 넘어 강공격이 나갔으면 뗄 때 오는 클릭(기본 한 타)을 한 번 먹는다.
    /// 손가락이 단추 밖으로 미끄러지면 뗀 것으로 본다(STORY `HoldButton` 과 같은 결).
    /// </summary>
    public class AttackHoldButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public FieldCombat Combat;
        private bool _swallowClick;

        public void OnPointerDown(PointerEventData eventData) => Set(true);

        public void OnPointerUp(PointerEventData eventData) => Set(false);

        public void OnPointerExit(PointerEventData eventData) => Set(false);

        private void Set(bool held)
        {
            if (Combat == null) return;
            // 누르던 중에서 뗄 때만(터치는 뗀 뒤 Exit 가 또 온다 — 그때 다시 먹을 클릭을 세우면 다음 클릭을 삼킨다)
            if (!held && Combat.AttackHeldByUi && Combat.ChargeFiredThisHold) _swallowClick = true;
            Combat.AttackHeldByUi = held;
        }

        /// <summary>이 클릭을 먹을까(강공격 뒤 뗀 클릭이면 참, 한 번만).</summary>
        public bool ConsumeClick()
        {
            bool s = _swallowClick;
            _swallowClick = false;
            return s;
        }
    }
}
