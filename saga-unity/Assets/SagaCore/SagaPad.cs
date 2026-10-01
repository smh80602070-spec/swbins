using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;

namespace Saga.Core
{
    /// <summary>
    /// 게임패드 읽기 한 곳(tasks U-0017). 게임 코드가 `Keyboard.current` 를 직접 읽던 자리에 `SagaPad.Pressed(Btn.X, kb?.jKey)` 처럼 키와 패드를 함께 넘긴다 —
    /// 키보드가 없어도(패드만) 되고, 패드가 없으면 키 동작이 그대로다. 이동·메뉴 탐색은 `InputSystem_Actions` 의 Move/UI 액션이 이미 패드를 읽는다.
    /// 버튼표: 공격 X · 상호작용 Y · 스킬 LB · 폭발·강공격 RT · 조준 RB · 회피 B · 점프 A · 지도 Select · 메뉴 Start · 십자키 = 칸 1~4 · 대화 A 다음/B 건너뛰기.
    /// </summary>
    public static class SagaPad
    {
        public enum Btn { Attack, Skill, Burst, Heavy, Dodge, Jump, Interact, Aim, Map, Menu, Confirm, Cancel, Slot1, Slot2, Slot3, Slot4, ZoomIn, ZoomOut }
        public enum Side { Left, Right }

        /// <summary>이 값 아래 스틱은 0 — 손 떨림으로 시점이 흘러가지 않게.</summary>
        public const float Deadzone = 0.2f;

        public static bool Connected => Gamepad.current != null;

        /// <summary>그 동작에 묶인 패드 버튼(패드 없으면 null).</summary>
        public static ButtonControl Control(Gamepad pad, Btn b)
        {
            if (pad == null) return null;
            switch (b)
            {
                case Btn.Attack: return pad.buttonWest;
                case Btn.Interact: return pad.buttonNorth;
                case Btn.Skill: return pad.leftShoulder;
                case Btn.Burst: return pad.rightTrigger;
                case Btn.Heavy: return pad.rightTrigger;
                case Btn.Aim: return pad.rightShoulder;
                case Btn.Dodge: return pad.buttonEast;
                case Btn.Jump: return pad.buttonSouth;
                case Btn.Map: return pad.selectButton;
                case Btn.Menu: return pad.startButton;
                case Btn.Confirm: return pad.buttonSouth;   // 대화 다음(tasks U-0018)
                case Btn.Cancel: return pad.buttonEast;     // 건너뛰기·닫기
                case Btn.Slot1: return pad.dpad.up;         // 무예 칸·파티 교대 1~4
                case Btn.Slot2: return pad.dpad.right;
                case Btn.Slot3: return pad.dpad.down;
                case Btn.Slot4: return pad.dpad.left;
                case Btn.ZoomIn: return pad.leftShoulder;   // 카메라 줌
                case Btn.ZoomOut: return pad.rightShoulder;
            }
            return null;
        }

        /// <summary>이번 프레임에 눌렸나 — 키(있으면) 또는 패드 버튼.</summary>
        public static bool Pressed(Btn b, KeyControl key = null)
        {
            if (key != null && key.wasPressedThisFrame) return true;
            var c = Control(Gamepad.current, b);
            return c != null && c.wasPressedThisFrame;
        }

        /// <summary>누르고 있나 — 키(있으면) 또는 패드 버튼.</summary>
        public static bool Held(Btn b, KeyControl key = null)
        {
            if (key != null && key.isPressed) return true;
            var c = Control(Gamepad.current, b);
            return c != null && c.isPressed;
        }

        /// <summary>스틱 값(데드존 아래는 0, 패드 없으면 0).</summary>
        public static Vector2 Stick(Side side)
        {
            var pad = Gamepad.current;
            if (pad == null) return Vector2.zero;
            Vector2 v = side == Side.Left ? pad.leftStick.ReadValue() : pad.rightStick.ReadValue();
            return v.magnitude < Deadzone ? Vector2.zero : v;
        }
    }
}
