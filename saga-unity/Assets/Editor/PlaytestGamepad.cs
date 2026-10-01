using UnityEditor;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// `SagaPad`(tasks U-0017) 진단 — 가짜 게임패드(`InputSystem.AddDevice`)로 버튼·스틱을 눌러 본다. ① 패드가 없으면 눌림·스틱이 모두 꺼짐(키보드 동작은 키 인자로 그대로)
    /// ② 동작마다 묶인 버튼이 눌림/유지/뗌을 정확히 알림 ③ 다른 버튼은 안 반응 ④ 스틱은 데드존 아래 0·그 위는 값 ⑤ 끝에 장치를 제거.
    /// `-executeMethod Saga.EditorTools.PlaytestGamepad.Run` → "[PlaytestGamepad] OK/FAIL".
    /// </summary>
    public static class PlaytestGamepad
    {
        private static readonly (SagaPad.Btn btn, GamepadButton pad)[] Map =
        {
            (SagaPad.Btn.Attack, GamepadButton.West), (SagaPad.Btn.Interact, GamepadButton.North), (SagaPad.Btn.Skill, GamepadButton.LeftShoulder),
            (SagaPad.Btn.Burst, GamepadButton.RightTrigger), (SagaPad.Btn.Heavy, GamepadButton.RightTrigger), (SagaPad.Btn.Aim, GamepadButton.RightShoulder),
            (SagaPad.Btn.Dodge, GamepadButton.East), (SagaPad.Btn.Jump, GamepadButton.South), (SagaPad.Btn.Map, GamepadButton.Select), (SagaPad.Btn.Menu, GamepadButton.Start),
        };

        [MenuItem("Saga/Playtest Gamepad")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestGamepad]");
            Gamepad pad = null;
            // 편집기(플레이 밖)에선 `wasPressedThisFrame` 의 프레임이 안 돈다 — 테스트 전용 설정(수동 업데이트)으로 바꾸고 끝에 원래 설정으로.
            var oldSettings = InputSystem.settings;
            var testSettings = ScriptableObject.CreateInstance<InputSettings>();
            testSettings.updateMode = InputSettings.UpdateMode.ProcessEventsManually;
            testSettings.SetInternalFeatureFlag("RUN_PLAYER_UPDATES_IN_EDIT_MODE", true); // 편집기에서도 플레이어 업데이트(프레임)를 돌린다
            InputSystem.settings = testSettings;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckNoPad();
                    pad = InputSystem.AddDevice<Gamepad>();
                    PlaytestKit.Check(Gamepad.current == pad && SagaPad.Connected, "gamepad: 가짜 패드가 current 가 아님");
                    CheckButtons(pad);
                    CheckSticks(pad);
                }
                finally
                {
                    if (pad != null) InputSystem.RemoveDevice(pad);
                    InputSystem.Update();
                    // 원래 설정이 없었으면(null) 돌려놓을 수 없다 — 그땐 테스트 설정을 남긴다(배치 프로세스는 곧 끝난다).
                    if (oldSettings != null) { InputSystem.settings = oldSettings; Object.DestroyImmediate(testSettings); }
                }
                PlaytestKit.Check(Gamepad.current == null || Gamepad.current != pad, "gamepad: 장치 제거 뒤에도 가짜 패드가 남음");
            }
            PlaytestKit.Summary("PlaytestGamepad");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Set(Gamepad pad, GamepadState state)
        {
            InputSystem.QueueStateEvent(pad, state);
            InputSystem.Update();
        }

        private static GamepadState Press(GamepadButton b)
        {
            var s = new GamepadState();
            s.buttons = 1u << (int)b;
            if (b == GamepadButton.RightTrigger) s.rightTrigger = 1f;
            if (b == GamepadButton.LeftTrigger) s.leftTrigger = 1f;
            return s;
        }

        private static void CheckNoPad()
        {
            if (Gamepad.current != null) { PlaytestKit.Fail("gamepad: 시작부터 패드가 있어 '패드 없음' 검사를 못 함"); return; }
            PlaytestKit.Check(!SagaPad.Connected, "gamepad: 패드가 없는데 Connected");
            foreach (var m in Map)
                PlaytestKit.Check(!SagaPad.Pressed(m.btn) && !SagaPad.Held(m.btn) && SagaPad.Control(null, m.btn) == null, $"gamepad: 패드 없음인데 {m.btn} 이 눌림/컨트롤이 있음");
            PlaytestKit.Check(SagaPad.Stick(SagaPad.Side.Left) == Vector2.zero && SagaPad.Stick(SagaPad.Side.Right) == Vector2.zero, "gamepad: 패드 없음인데 스틱 값이 0 이 아님");
        }

        private static void CheckButtons(Gamepad pad)
        {
            foreach (var m in Map)
            {
                Set(pad, new GamepadState());
                PlaytestKit.Check(!SagaPad.Pressed(m.btn) && !SagaPad.Held(m.btn), $"gamepad: {m.btn} 아무것도 안 눌렀는데 눌림");
                Set(pad, Press(m.pad));
                PlaytestKit.Check(SagaPad.Pressed(m.btn) && SagaPad.Held(m.btn), $"gamepad: {m.pad} 를 눌렀는데 {m.btn} 이 안 눌림(Pressed={SagaPad.Pressed(m.btn)} Held={SagaPad.Held(m.btn)})");
                // 같은 상태로 한 번 더 — 눌린 채라 Held 는 유지, Pressed(이번 프레임)는 꺼진다.
                Set(pad, Press(m.pad));
                PlaytestKit.Check(!SagaPad.Pressed(m.btn) && SagaPad.Held(m.btn), $"gamepad: {m.btn} 누른 채 다음 프레임에 Pressed 가 안 꺼지거나 Held 가 풀림");
                // 다른 동작은 그 버튼에 안 반응(같은 버튼에 묶인 동작은 제외).
                foreach (var other in Map)
                    if (other.pad != m.pad) PlaytestKit.Check(!SagaPad.Held(other.btn), $"gamepad: {m.pad} 가 {other.btn} 도 누른 것으로 읽힘");
                Set(pad, new GamepadState());
                PlaytestKit.Check(!SagaPad.Held(m.btn), $"gamepad: {m.btn} 뗐는데 Held 가 남음");
            }
        }

        private static void CheckSticks(Gamepad pad)
        {
            Set(pad, new GamepadState { leftStick = new Vector2(0.05f, 0.05f), rightStick = new Vector2(0.1f, -0.1f) });
            PlaytestKit.Check(SagaPad.Stick(SagaPad.Side.Left) == Vector2.zero && SagaPad.Stick(SagaPad.Side.Right) == Vector2.zero, "gamepad: 데드존 안 스틱이 0 이 아님");
            Set(pad, new GamepadState { leftStick = new Vector2(0f, 1f), rightStick = new Vector2(-0.8f, 0f) });
            var l = SagaPad.Stick(SagaPad.Side.Left); var r = SagaPad.Stick(SagaPad.Side.Right);
            PlaytestKit.Check(Mathf.Approximately(l.y, 1f) && Mathf.Approximately(l.x, 0f), $"gamepad: 왼쪽 스틱 {l}");
            PlaytestKit.Check(r.x < -0.7f && r.x > -1f && Mathf.Approximately(r.y, 0f), $"gamepad: 오른쪽 스틱 {r}(왼쪽으로 밀었는데 값 이상)");
            Set(pad, new GamepadState());
        }
    }
}
