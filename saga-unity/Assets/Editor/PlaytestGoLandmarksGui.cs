using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 사용자가 "직접 실기해"로 명시적으로 요청했을 때만 쓰는 1회성 GUI
    /// 스크린샷 도구(`PlaytestDungeonEnemiesGui.cs`와 같은 결) — TestVillage
    /// 씬에서 "실기 확인 대기" GO 목록 중 순수 시각 요소(전투·손맛·대사 같은
    /// "느낌"류는 스크린샷으로 못 가린다, 그건 사람 몫으로 남는다)만 순서대로
    /// 텔레포트하며 찍는다: 집 둘(103-1 곁채·굴뚝) 각각, 은닉 보물, 산신당,
    /// 행운 돌탑, 동굴 유물.
    ///
    /// **1차 시도(첫 커밋본) 실패 원인** — `TestMapData.WorldPos()`에 격자
    /// 좌표를 몇 칸 어긋나게 넣어 "남쪽으로 물러난 자리"를 계산했는데
    /// `TileSize=48`(칸 하나가 48유닛!)이라 2~4칸만 어긋나도 대상에서
    /// 96~192유닛 떨어져 화면에 아무것도 안 잡혔다(집은 `WorldPos(gx,3)`인데
    /// `gy=0`으로 잘못 짐작하기도 했다). 이번엔 씬에 이미 지어진 명소
    /// GameObject를 이름으로 직접 찾아 그 `transform.position`에서
    /// **플레이어의 현재 forward 반대 방향으로 8유닛** 물러난 자리에 세운다
    /// (기본 회전이 어느 쪽이든 대상이 항상 정면에 걸린다 — 격자 계산 자체를
    /// 안 쓴다).
    /// </summary>
    public static class PlaytestGoLandmarksGui
    {
        private const string ScenePath = "Assets/Scenes/TestVillage.unity";
        public const string ShotDir =
            "C:/Users/user/AppData/Local/Temp/claude/C--swbins/ed93fe4d-26ed-4226-9dba-82a8fa65cb83/scratchpad/unity_screens/";

        private const float BackDistance = 8f;
        private static string _shotDir = ShotDir;
        private static int _shotWait; // -shotWait 프레임(지역 이름 안내가 사라질 때까지)

        // (씬 GameObject 이름, 파일명) — 이름은 BuildTestVillageScene.cs가 지은 그대로.
        private static (string targetName, string shot)[] Stops =
        {
            ("House_2", "10_go_house2_wing_chimney.png"),   // 103-1 곁채+굴뚝
            ("House_3", "11_go_house3_chimney.png"),        // 103-1 굴뚝만
            ("HiddenTreasure", "12_go_hidden_treasure.png"),
            ("MountainShrine", "13_go_mountain_shrine.png"),
            ("LuckyCairn", "14_go_lucky_cairn.png"),
            ("EastGroveRelic", "15_go_east_grove_relic.png"),
        };

        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;
        private static int _frame;
        private static int _stopIndex;
        private static int _phase; // 0=텔레포트 대기, 1=찍음

        [MenuItem("Saga/Playtest GO Landmarks (GUI Screenshot)")]
        public static void Run()
        {
            // tasks U-0140 — `-shotStops 이름:파일,…`·`-shotDir 폴더/` 를 주면 그 대상만 찍는다(전후 비교). 없으면 위 명소 여섯.
            var args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i + 1 < args.Length; i++)
            {
                if (args[i] == "-shotDir") _shotDir = args[i + 1].Replace('\\', '/').TrimEnd('/') + "/";
                if (args[i] == "-shotWait") int.TryParse(args[i + 1], out _shotWait);
                if (args[i] == "-shotStops")
                {
                    var list = new System.Collections.Generic.List<(string, string)>();
                    foreach (var pair in args[i + 1].Split(','))
                    {
                        int c = pair.IndexOf(':');
                        if (c > 0) list.Add((pair.Substring(0, c), pair.Substring(c + 1)));
                    }
                    if (list.Count > 0) Stops = list.ToArray();
                }
            }
            Directory.CreateDirectory(_shotDir);

            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            EditorSceneManager.OpenScene(ScenePath);
            _frame = 0;
            _stopIndex = -1; // Tick 첫 호출에서 0번으로 넘어간다.
            _phase = 1;      // "이미 찍었다" 취급해 바로 다음(0번)으로 넘어가게.
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += Tick;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;
                Debug.Log($"[PlaytestGoLandmarksGui] done, screenshots in {_shotDir}");
                EditorApplication.Exit(0);
            }
        }

        private static void Tick()
        {
            _frame++;

            if (_phase == 1)
            {
                _stopIndex++;
                if (_stopIndex >= Stops.Length)
                {
                    EditorApplication.update -= Tick;
                    EditorApplication.isPlaying = false;
                    return;
                }
                Teleport(Stops[_stopIndex].targetName);
                _phase = 0;
                _frame = 0;
                return;
            }

            // 셰이더 변형 컴파일 + 카메라 추적 대기(PlaytestDungeonEnemiesGui.cs
            // 클래스 주석의 66-2장 ⑩ 함정과 같은 결 — 첫 지점만 넉넉히, 나머지는 짧게).
            int waitFrames = _shotWait > 0 ? _shotWait : _stopIndex == 0 ? 180 : 40;
            if (_frame >= waitFrames)
            {
                var playerGo = GameObject.FindGameObjectWithTag("Player");
                Debug.Log($"[PlaytestGoLandmarksGui] pre-shot player pos: {(playerGo != null ? playerGo.transform.position.ToString() : "null")}");
                ScreenCapture.CaptureScreenshot(_shotDir + Stops[_stopIndex].shot);
                Debug.Log($"[PlaytestGoLandmarksGui] shot {_stopIndex}: {Stops[_stopIndex].shot}");
                _phase = 1;
                _frame = 0;
            }
        }

        private static void Teleport(string targetName)
        {
            var targetGo = GameObject.Find(targetName);
            var playerGo = GameObject.FindGameObjectWithTag("Player");
            if (targetGo == null || playerGo == null)
            {
                Debug.LogError($"[PlaytestGoLandmarksGui] not found — target={targetName}:{targetGo != null} player={playerGo != null}");
                return;
            }

            // 대상이 항상 플레이어 정면에 걸리도록 "지금 forward의 반대"로 물러난다
            // (기본 스폰 회전이 어느 쪽인지 몰라도 안전 — 클래스 주석 참고).
            Vector3 back = -playerGo.transform.forward;
            back.y = 0f;
            if (back.sqrMagnitude < 0.01f) back = Vector3.back;
            back.Normalize();
            Vector3 target = targetGo.transform.position + back * BackDistance;
            target.y = targetGo.transform.position.y + 0.1f; // 대상 자신이 이미 그 자리 접지 높이 — 그대로 따른다.

            var controller = playerGo.GetComponent<CharacterController>();
            if (controller != null) controller.enabled = false;
            playerGo.transform.position = target;
            if (controller != null) controller.enabled = true;
        }
    }
}
