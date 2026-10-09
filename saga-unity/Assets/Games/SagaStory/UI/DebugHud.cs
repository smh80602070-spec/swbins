using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 44~49장 디버그 화면 — GO `UI/DebugHud.cs`와 같은 결(다섯 판
    /// 공용 로직 복사 관례), STORY엔 아직 없어 2026-09-14에 새로 만들었다.
    /// 문서 전체 목록 중 **Current Quest·Player Position**만 얹었다 —
    /// `StoryQuestState.cs`엔 Level 개념이 없고(레벨업 없는 슬라이스),
    /// 적(잡졸·두목)도 `StoryEnemy.All`이 있긴 하지만 이미 화면 상단
    /// `StoryHud`가 사명 진행(kill 카운트)으로 사실상 같은 정보를 보여주고
    /// 있어 중복을 안 늘렸다. GO/DUNGEON/FOREST와 같은 이유로 Draw Calls/
    /// Visible Objects/Memory도 안 넣는다(Unity Profiler 몫).
    /// </summary>
    // 이름 주의 — "DebugOverlay"는 UnityEngine.Rendering.DebugOverlay와
    // 겹쳐 컴파일 에러(CS0104)가 난다. DebugHud로 피했다(GO와 같은 이유).
    public class DebugHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        private float _fpsTimer;
        private int _frameCount;
        private float _fps;
        // U-0067 — 플레이어 HUD 와 같은 자리라 기본 숨김, F3 으로 켜고 끈다.
        // 글자 갱신은 숨겨도 계속한다(진단이 label.text 를 읽는다).
        private bool _shown;
        private Transform _player;

        private void Awake()
        {
            if (!Debug.isDebugBuild)
            {
                gameObject.SetActive(false);
                return;
            }
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void Update()
        {
            if (Keyboard.current != null && Keyboard.current.f3Key.wasPressedThisFrame)
                _shown = !_shown;
            if (label != null && label.enabled != _shown) label.enabled = _shown;
            _frameCount++;
            _fpsTimer += Time.unscaledDeltaTime;
            if (_fpsTimer >= 0.5f)
            {
                _fps = _frameCount / _fpsTimer;
                _frameCount = 0;
                _fpsTimer = 0f;
                Refresh();
            }
        }

        private void Refresh()
        {
            if (label == null) return;
            var pipeline = GraphicsSettings.currentRenderPipeline;
            string rendererName = pipeline != null ? pipeline.name : "(built-in)";
            string pos = _player != null
                ? $"{_player.position.x:F1}, {_player.position.y:F1}, {_player.position.z:F1}"
                : "-";
            label.text = $"renderer: {rendererName}\n{_fps:F0} fps\n" +
                $"quest: {QuestLabel()}\npos: {pos}";
        }

        private static string QuestLabel()
        {
            if (StoryQuestState.QuestBossDone) return "완료(두목까지 처치)";
            if (StoryQuestState.QuestDone) return $"두목 남음(잡졸 {StoryQuestState.Kills}/{StoryQuestState.KillGoal})";
            return $"잡졸 {StoryQuestState.Kills}/{StoryQuestState.KillGoal}";
        }
    }
}
