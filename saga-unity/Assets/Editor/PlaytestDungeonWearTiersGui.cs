using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using System.Collections.Generic;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// 사용자가 "직접 실기해"로 명시적으로 요청했을 때만 쓰는 1회성 GUI
    /// 스크린샷 도구(`PlaytestDungeonEnemiesGui.cs`와 같은 결) — PLAN.md 103-1
    /// "DUNGEON 방 셸 — 티어별 마모 3단"(2026-09-22)이 실제로 화면에 보이는지
    /// `DungeonFloorRunner.JumpToFloor()`로 층2(0단)·층40(1단)·층70(2단)을
    /// 강제로 오가며 ProcRoom을 세 번 찍는다. 끝나면 스스로 Play 종료+Unity
    /// 프로세스 종료.
    /// </summary>
    public static class PlaytestDungeonWearTiersGui
    {
        private const string ScenePath = "Assets/Scenes/TestDungeon.unity";
        private const string DefaultShotDir =
            "C:/Users/user/AppData/Local/Temp/claude/C--swbins/ed93fe4d-26ed-4226-9dba-82a8fa65cb83/scratchpad/unity_screens/";
        // SAGA_SHOT_DIR 가 있으면 그쪽(U-0077) — 없으면 옛 자리 그대로.
        public static string ShotDir =>
            (System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIR") is string d && d.Length > 0)
                ? d.Replace((char)92, (char)47).TrimEnd((char)47) + "/" : DefaultShotDir;

        private static readonly Vector3 ProcRoomCenter = new Vector3(0f, 0f, 120f); // BuildTestDungeonScene.cs와 같은 값.
        private static readonly Vector3 ShotOffset = new Vector3(0f, 0.1f, -4f);

        private static readonly (int floor, string shot)[] Stops =
        {
            (2, "20_dungeon_wear_tier0.png"),
            (40, "21_dungeon_wear_tier1.png"),
            (70, "22_dungeon_wear_tier2.png"),
        };

        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;
        private static int _frame;
        private static int _stopIndex;
        private static int _phase; // 0=층 이동+텔레포트 대기, 1=찍음
        private static readonly List<GameObject> _hiddenEnemies = new List<GameObject>();
        private static GameObject _fillLight;

        [MenuItem("Saga/Playtest Dungeon Wear Tiers (GUI Screenshot)")]
        public static void Run()
        {
            Directory.CreateDirectory(ShotDir);

            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            EditorSceneManager.OpenScene(ScenePath);
            _frame = 0;
            _stopIndex = -1;
            _phase = 1;
            _hiddenEnemies.Clear();
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                // 첫 장 시나리오 창·쓰러짐 카드가 방을 덮지 않게 촬영 내내 피해를 막는다(U-0077, U-0076 과 같은 칸).
                HeroState.DamageHold++;
                EditorApplication.update += Tick;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;
                Debug.Log($"[PlaytestDungeonWearTiersGui] done, screenshots in {ShotDir}");
                EditorApplication.Exit(0);
            }
        }

        private static void Tick()
        {
            _frame++;

            if (_phase == 2) { TickAfterShot(); return; }

            if (_phase == 1)
            {
                _stopIndex++;
                if (_stopIndex >= Stops.Length)
                {
                    EditorApplication.update -= Tick;
                    HeroState.DamageHold = Mathf.Max(0, HeroState.DamageHold - 1);
                    EditorApplication.isPlaying = false;
                    return;
                }
                GoToFloorAndTeleport(Stops[_stopIndex].floor);
                _phase = 0;
                _frame = 0;
                return;
            }

            int waitFrames = _stopIndex == 0 ? 180 : 40; // 66-2장 ⑩ 셰이더 변형 컴파일 함정, 첫 지점만 넉넉히.
            // 찍기 몇 프레임 전부터 방을 가리는 것(창·카드·대사·적과 공격 예고 고리)을 치운다(U-0077).
            if (_frame >= waitFrames - 10) ClearView();
            if (_frame >= waitFrames)
            {
                ScreenCapture.CaptureScreenshot(ShotDir + Stops[_stopIndex].shot);
                Debug.Log($"[PlaytestDungeonWearTiersGui] shot {_stopIndex}: {Stops[_stopIndex].shot} (적 {_hiddenEnemies.Count} 숨김)");
                _phase = 2;
                _frame = 0;
                return;
            }
        }

        private static void Restore()
        {
            foreach (var go in _hiddenEnemies) if (go != null) go.SetActive(true);
            _hiddenEnemies.Clear();
            if (_fillLight != null) Object.Destroy(_fillLight);
            _fillLight = null;
        }

        /// <summary>시나리오 창·마무리 카드 닫기, 대사 줄 비우기, 그 층 적을 찍는 동안만 끄기.</summary>
        private static void ClearView()
        {
            DungeonScenarioUi.Instance?.Hide();
            foreach (var c in Object.FindObjectsByType<SessionCard>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)) c.Hide();
            if (DialogueLabel.Instance != null && DialogueLabel.Instance.CurrentText.Length > 0) DialogueLabel.Instance.Show("", 0f);
            foreach (var e in DungeonEnemy.Active.ToArray())
            {
                if (e == null || !e.gameObject.activeSelf) continue;
                _hiddenEnemies.Add(e.gameObject);
                e.gameObject.SetActive(false);
            }
            // SAGA_SHOT_LIGHT=1 — 천장이 해를 막아 방이 거의 까맣게 찍힌다(U-0077 첫 촬영) — 마모 결을 보려고 촬영 동안만 카메라 곁 보조등(ShowcaseGui 와 같은 칸).
            if (_fillLight == null && System.Environment.GetEnvironmentVariable("SAGA_SHOT_LIGHT") == "1" && Camera.main != null)
            {
                _fillLight = new GameObject("ShotFillLight");
                var lg = _fillLight.AddComponent<Light>();
                lg.type = LightType.Point; lg.range = 18f; lg.intensity = 6f; lg.shadows = LightShadows.None;
                _fillLight.transform.SetParent(Camera.main.transform, false);
                _fillLight.transform.localPosition = new Vector3(0.6f, 0.8f, -0.4f);
            }
        }

        private static void TickAfterShot()
        {
            // CaptureScreenshot 은 프레임 끝에 쓴다 — 두 프레임 뒤에 적을 되돌린다.
            if (_frame >= 2)
            {
                Restore();
                _phase = 1;
                _frame = 0;
            }
        }

        private static void GoToFloorAndTeleport(int floor)
        {
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            if (runner == null)
            {
                Debug.LogError("[PlaytestDungeonWearTiersGui] DungeonFloorRunner not found");
                return;
            }
            if (floor != 2) runner.JumpToFloor(floor); // 층2는 씬 시작 기본값이라 그대로 둔다(재빌드 비용 절약).

            var playerGo = GameObject.FindGameObjectWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonWearTiersGui] Player not found");
                return;
            }

            // 문 표지 근접 트리거로 방이 또 갈릴 걸 막는다(PlaytestDungeonEnemiesGui.cs와 같은 함정).
            runner.enabled = false;

            var controller = playerGo.GetComponent<CharacterController>();
            if (controller != null) controller.enabled = false;
            playerGo.transform.position = ProcRoomCenter + ShotOffset;
            if (controller != null) controller.enabled = true;

            // WallHeight=4m 천장 — 기본 zoom=6·pitch=55°면 카메라가 뚫고 들어간다
            // (DungeonRoomBuilder.cs 클래스 주석과 같은 함정, PlaytestDungeonEnemiesGui.cs 재사용).
            var rig = playerGo.GetComponentInChildren<CameraRig>();
            if (rig != null)
            {
                var t = typeof(CameraRig);
                t.GetField("_zoom", BindingFlags.NonPublic | BindingFlags.Instance)?.SetValue(rig, 3f);
                t.GetField("_pitchDeg", BindingFlags.NonPublic | BindingFlags.Instance)?.SetValue(rig, 30f);
            }
        }
    }
}
