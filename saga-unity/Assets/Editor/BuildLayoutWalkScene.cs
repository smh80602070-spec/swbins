using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Saga.Go.Layout;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// saga-godot games/saga_go/layout/LayoutWalk.tscn 의 Unity 대응판 — 글자 지도 조립 씬
    /// (`Assets/Scenes/Generated/*.unity`, `BuildFromLayout` 산출물)을 걸어 다니는 씬으로
    /// 감싼다. 이 씬 자체는 Player·MobileHUD·토스트·명소 개수 줄과 `LayoutWalk`
    /// 부트스트랩만 들고, 생성 씬은 실행 시점에 `LayoutWalk`가 additive 로 불러 읽는다
    /// (`BuildFromLayout`이 그 씬을 다시 쓰면 통째로 덮이니 이 씬은 손대지 않는다).
    /// 다른 Build*Scene 류처럼 멱등 — 다시 실행하면 씬을 통째로 새로 짠다.
    /// </summary>
    public static class BuildLayoutWalkScene
    {
        private const string ScenePath = "Assets/Scenes/LayoutWalk.unity";
        private const string GeneratedScenePath = "Assets/Scenes/Generated/HebeiLayout.unity";
        private const string InputActionsPath = "Assets/InputSystem_Actions.inputactions";

        [MenuItem("Saga/Layout/Build Layout Walk Scene")]
        public static void Build()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var playerGo = BuildPlayer();
            BuildEventSystem();
            BuildDialogueUi();
            var placeLabel = BuildPlaceCountUi();
            var joystick = BuildMobileHud();
            SetPrivateField(playerGo.GetComponent<PlayerController>(), "joystick", joystick);
            BuildLayoutWalkBootstrap(placeLabel);

            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[BuildLayoutWalkScene] saved to {ScenePath} — generated={GeneratedScenePath}");
        }

        private static GameObject BuildPlayer()
        {
            var playerGo = new GameObject("Player");
            playerGo.tag = "Player";
            playerGo.transform.position = new Vector3(0f, 0.5f, 0f); // 배치표 원점(마을 중심), tools/scene-layout/README.md 참고.

            var controller = playerGo.AddComponent<CharacterController>();
            controller.radius = 0.9f;
            controller.height = 3.4f;
            controller.center = new Vector3(0f, 1.7f, 0f);
            // CharacterController는 자체 캡슐 콜라이더로 트리거 이벤트를 낸다 —
            // Rigidbody를 같이 달면(예전엔 안전망 삼아 넣었다) 오히려 순간이동 이후
            // 트리거 재감지가 막히는 게 실측으로 드러나 뺐다.

            Transform visual = CharacterVisual.SpawnFallbackCapsule(playerGo.transform, Color.white);

            var rigGo = new GameObject("CameraRig");
            rigGo.transform.SetParent(playerGo.transform, false);
            rigGo.transform.localPosition = new Vector3(0f, 1.7f, 0f);
            var cameraRig = rigGo.AddComponent<CameraRig>();

            var camGo = new GameObject("PlayerCamera");
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            camGo.AddComponent<AudioListener>();

            var inputActions = AssetDatabase.LoadAssetAtPath<UnityEngine.InputSystem.InputActionAsset>(InputActionsPath);
            if (inputActions == null)
            {
                Debug.LogWarning($"[BuildLayoutWalkScene] {InputActionsPath} 를 못 찾음 — Move 입력이 안 먹는다.");
            }

            var pc = playerGo.AddComponent<PlayerController>();
            SetPrivateField(pc, "visual", visual);
            SetPrivateField(pc, "cameraRig", cameraRig);
            SetPrivateField(pc, "inputActions", inputActions);

            return playerGo;
        }

        private static void BuildEventSystem()
        {
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();
            esGo.AddComponent<InputSystemUIInputModule>();
        }

        /// <summary>지나가다 듣는 한 마디 자막 자리 — 명소를 찾을 때마다 여기 뜬다
        /// (`BuildTestVillageScene.BuildDialogueUi`와 같은 조립).</summary>
        private static void BuildDialogueUi()
        {
            var canvasGo = new GameObject("DialogueUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0.5f, 1f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(0f, -80f);
            rect.sizeDelta = new Vector2(920f, 140f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 34;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = "";

            var dialogueLabel = canvasGo.AddComponent<DialogueLabel>();
            SetPrivateField(dialogueLabel, "label", text);
            textGo.SetActive(false);
        }

        /// <summary>화면 위 "📍 명소 n/13" 줄 — GO 도감 줄(CodexLabel)과 같은 자리·글꼴,
        /// 이 씬에만 있는 전용 라벨이라 GO 세이브·도감과는 무관하다.</summary>
        private static TextMeshProUGUI BuildPlaceCountUi()
        {
            var canvasGo = new GameObject("PlaceCountUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(20f, -20f);
            rect.sizeDelta = new Vector2(500f, 60f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 28;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.color = Color.white;
            text.text = "";
            return text;
        }

        /// <summary>왼쪽 아래 가상 조이스틱(`BuildTestVillageScene.BuildMobileHud`와 같은 조립).</summary>
        private static VirtualJoystick BuildMobileHud()
        {
            var canvasGo = new GameObject("MobileHUD");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var baseGo = new GameObject("JoystickBase", typeof(RectTransform));
            baseGo.transform.SetParent(canvasGo.transform, false);
            var baseRect = (RectTransform)baseGo.transform;
            baseRect.anchorMin = new Vector2(0f, 0f);
            baseRect.anchorMax = new Vector2(0f, 0f);
            baseRect.pivot = new Vector2(0.5f, 0.5f);
            baseRect.anchoredPosition = new Vector2(140f, 220f);
            baseRect.sizeDelta = new Vector2(140f, 140f);
            var baseImg = baseGo.AddComponent<Image>();
            baseImg.color = new Color(1f, 1f, 1f, 0.18f);

            var knobGo = new GameObject("Knob", typeof(RectTransform));
            knobGo.transform.SetParent(baseGo.transform, false);
            var knobRect = (RectTransform)knobGo.transform;
            knobRect.anchorMin = knobRect.anchorMax = new Vector2(0.5f, 0.5f);
            knobRect.pivot = new Vector2(0.5f, 0.5f);
            knobRect.sizeDelta = new Vector2(64f, 64f);
            var knobImg = knobGo.AddComponent<Image>();
            knobImg.color = new Color(1f, 1f, 1f, 0.55f);

            var joystick = baseGo.AddComponent<VirtualJoystick>();
            SetPrivateField(joystick, "knob", knobRect);
            SetPrivateField(joystick, "radius", 60f);
            return joystick;
        }

        private static void BuildLayoutWalkBootstrap(TextMeshProUGUI placeLabel)
        {
            var go = new GameObject("LayoutWalk");
            var walk = go.AddComponent<LayoutWalk>();
            SetPrivateField(walk, "generatedScenePath", GeneratedScenePath);
            SetPrivateField(walk, "placeCountLabel", placeLabel);
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildLayoutWalkScene] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
