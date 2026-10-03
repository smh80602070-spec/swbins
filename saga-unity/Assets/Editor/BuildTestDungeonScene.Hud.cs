using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Saga.Dungeon.World;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.Data;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// `BuildTestDungeonScene.cs` 에서 1500줄 한도로 나눈 몫(R-4) — 파티 UI·후처리 볼륨·이벤트 시스템·대사·HUD·미니맵·지도·
    /// 디버그·저장·설정·목표판·모바일 단추·축복 3택. 같은 클래스(partial)라 호출부·`SetPrivateField` 등은 그대로 쓴다.
    /// </summary>
    public static partial class BuildTestDungeonScene
    {
        /// <summary>PLAN.md 106-6 — 파티 명령 버튼 셋(회피·주목 줄 왼쪽 한 줄 더) + 왼쪽 위 파티 줄.</summary>
        private static void BuildPartyUi(PartyCommands party)
        {
            var taunt = BuildActionButton("TauntUI", "TauntButton", new Vector2(1f, 0f), new Vector2(-460f, 180f),
                new Vector2(130f, 130f), new Color(0.75f, 0.55f, 0.15f, 0.55f), "도발", 26, party.OrderGuard, "action.taunt");
            var heal = BuildActionButton("HealUI", "HealButton", new Vector2(1f, 0f), new Vector2(-460f, 330f),
                new Vector2(130f, 130f), new Color(0.25f, 0.6f, 0.35f, 0.55f), "치유", 26, party.OrderMystic, "action.heal");
            var summon = BuildActionButton("SummonUI", "SummonButton", new Vector2(1f, 0f), new Vector2(-460f, 480f),
                new Vector2(130f, 130f), new Color(0.6f, 0.4f, 0.15f, 0.55f), "소환", 26, party.Summon, "action.summon");

            var canvasGo = new GameObject("PartyHudUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            var hud = canvasGo.AddComponent<PartyHud>();
            SetPrivateField(hud, "tauntButton", taunt.GetComponent<Image>());
            SetPrivateField(hud, "healButton", heal.GetComponent<Image>());
            SetPrivateField(hud, "summonButton", summon.GetComponent<Image>());
        }

        /// <summary>PLAN.md 66-2장(파이널 판타지 최신작 기준) "다음에 할 일"
        /// ① 라이팅/색보정/후처리 — BuildFF16VolumeProfiles.cs가 지어 둔
        /// 공유 자산(PC/Mobile) 중 플랫폼에 맞는 쪽을 PlatformVolumeProfile이
        /// 골라 낀다. 에디터 프리뷰는 기본으로 PC 프로파일을 미리 꽂아 둔다.</summary>
        private static void BuildPostProcessingVolume()
        {
            var go = new GameObject("GlobalVolume");
            var volume = go.AddComponent<UnityEngine.Rendering.Volume>();
            volume.isGlobal = true;
            volume.weight = 1f;

            var pcProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildFF16VolumeProfiles.PcProfilePath);
            var mobileProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildFF16VolumeProfiles.MobileProfilePath);
            if (pcProfile == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] FF16Volume_PC.asset 을 못 찾음 — " +
                                  "Saga > Build FF16 Volume Profiles 를 먼저 돌릴 것.");
            }

            var platform = go.AddComponent<PlatformVolumeProfile>();
            platform.pcProfile = pcProfile;
            platform.mobileProfile = mobileProfile;
            volume.sharedProfile = pcProfile; // .profile은 씬에 저장 안 되는 런타임 복사본용(Volume.cs 참고)
        }

        /// <summary>PLAN.md 102-1-2 "판별 색보정 LUT" — 굴혈 톤(청록). 공유
        /// GlobalVolume 위에 우선순위 더 높은 두 번째 Volume 으로 겹쳐
        /// 낀다(`BuildGameToneLuts.cs`, ColorLookup만 담아 다른 값은 안
        /// 건드림). PC·Mobile 둘 다 적용(102-2 표).</summary>
        private static void BuildToneVolume()
        {
            var toneProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildGameToneLuts.DungeonProfilePath);
            if (toneProfile == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] " + BuildGameToneLuts.DungeonProfilePath +
                                  " 를 못 찾음 — Saga > Build Game Tone LUTs 를 먼저 돌릴 것.");
                return;
            }
            var go = new GameObject("ToneVolume");
            var volume = go.AddComponent<UnityEngine.Rendering.Volume>();
            volume.isGlobal = true;
            volume.weight = 1f;
            volume.priority = 1f;
            volume.sharedProfile = toneProfile;
        }

        private static void BuildEventSystem()
        {
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();
            esGo.AddComponent<InputSystemUIInputModule>();
        }

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
            var text = textGo.AddComponent<TextMeshProUGUI>();
            DialogueLabel.ApplyLayout(text); // 자리·크기는 런타임 쪽 한 곳(110 ⑤c-3)
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = "";

            var dialogueLabel = canvasGo.AddComponent<DialogueLabel>();
            SetPrivateField(dialogueLabel, "label", text);
            textGo.SetActive(false);
        }

        private static void BuildPlayerHud()
        {
            var canvasGo = new GameObject("PlayerHudUI");
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
            rect.sizeDelta = new Vector2(700f, 140f); // "퀘스트 시스템" 슬라이스 — 퀘스트 목표 줄 추가로 100→140

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 24;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.color = Color.white;
            text.text = "";

            var hud = canvasGo.AddComponent<PlayerHud>();
            SetPrivateField(hud, "label", text);

            // "HUD 개선" 슬라이스 — 텍스트 줄 바로 아래 체력 게이지.
            var barBgGo = new GameObject("HealthBarBg", typeof(RectTransform));
            barBgGo.transform.SetParent(canvasGo.transform, false);
            var barBgRect = (RectTransform)barBgGo.transform;
            barBgRect.anchorMin = new Vector2(0f, 1f);
            barBgRect.anchorMax = new Vector2(0f, 1f);
            barBgRect.pivot = new Vector2(0f, 1f);
            barBgRect.anchoredPosition = new Vector2(20f, -170f); // Label(y=-20, 높이140) 바로 아래
            barBgRect.sizeDelta = new Vector2(320f, 22f);
            var barBgImg = barBgGo.AddComponent<Image>();
            barBgImg.color = new Color(0f, 0f, 0f, 0.4f);

            var barFillGo = new GameObject("HealthBarFill", typeof(RectTransform));
            barFillGo.transform.SetParent(barBgGo.transform, false);
            var barFillRect = (RectTransform)barFillGo.transform;
            barFillRect.anchorMin = Vector2.zero;
            barFillRect.anchorMax = Vector2.one;
            barFillRect.offsetMin = Vector2.zero;
            barFillRect.offsetMax = Vector2.zero;
            var barFillImg = barFillGo.AddComponent<Image>();
            barFillImg.color = new Color(0.75f, 0.15f, 0.15f);
            barFillImg.type = Image.Type.Filled;
            barFillImg.fillMethod = Image.FillMethod.Horizontal;
            barFillImg.fillOrigin = (int)Image.OriginHorizontal.Left;
            barFillImg.fillAmount = 1f;

            SetPrivateField(hud, "healthBarFill", barFillImg);
        }

        /// <summary>"미니맵" 슬라이스 — 방1~4 중심을 고정 점으로 찍고
        /// 플레이어 위치만 매 프레임 갱신하는 개략도(Minimap.cs 참고,
        /// 렌더텍스처용 카메라 없음). SaveButton(top-right, y=-30~-110)과
        /// 안 겹치게 그 아래에 둔다.</summary>
        private static void BuildMinimap()
        {
            var canvasGo = new GameObject("MinimapUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var areaGo = new GameObject("MapArea", typeof(RectTransform));
            areaGo.transform.SetParent(canvasGo.transform, false);
            var areaRect = (RectTransform)areaGo.transform;
            areaRect.anchorMin = new Vector2(0f, 1f);
            areaRect.anchorMax = new Vector2(0f, 1f);
            areaRect.pivot = new Vector2(0f, 1f);
            areaRect.anchoredPosition = new Vector2(20f, -330f); // 110 ⑤b — 왼쪽 파티 HUD 밑·조이스틱 위(오른쪽 기둥은 전투 버튼 칸과 겹쳤다).
            areaRect.sizeDelta = new Vector2(140f, 220f);

            var bgImg = areaGo.AddComponent<Image>();
            bgImg.color = new Color(0f, 0f, 0f, 0.35f);

            var minimap = areaGo.AddComponent<Minimap>();
            SetPrivateField(minimap, "mapArea", areaRect);

            // 방 넷 중심 — 정적 점(색으로만 구분: 숲/늪/산/사당 바이옴과
            // 같은 색조를 재사용해 방 종류를 굳이 새로 안 만든다).
            BuildMinimapDot(areaRect, Vector3.zero, new Color(0.3f, 0.55f, 0.3f), 14f); // Room1 — 숲
            // "오픈월드 확장 — 마을 여러 개" — 다섯 바이옴 색과 겹치지 않는
            // 황금빛으로 "문명/안전지대"임을 표시.
            BuildMinimapDot(areaRect, Town2Center, new Color(0.75f, 0.65f, 0.35f), 14f); // Town2 — 마을
            // "마을 여러 개 — 셋째·넷째" — 같은 "문명/안전지대" 황금빛.
            BuildMinimapDot(areaRect, Town3Center, new Color(0.75f, 0.65f, 0.35f), 14f); // Town3 — 마을
            BuildMinimapDot(areaRect, Town4Center, new Color(0.75f, 0.65f, 0.35f), 14f); // Town4 — 마을
            // "위성↔위성 지름길" — 마을도 야생도 아닌 순수 경유지, 회색.
            BuildMinimapDot(areaRect, CrossroadsCenter, new Color(0.5f, 0.5f, 0.5f), 10f);
            // "위성↔위성 지름길 후속: Town2↔Town4" — 같은 순수 경유지 회색.
            BuildMinimapDot(areaRect, Crossroads2Center, new Color(0.5f, 0.5f, 0.5f), 10f);
            BuildMinimapDot(areaRect, Room2Center, new Color(0.35f, 0.45f, 0.3f), 14f); // Room2 — 늪
            BuildMinimapDot(areaRect, Room3Center, new Color(0.55f, 0.5f, 0.45f), 14f); // Room3 — 산
            BuildMinimapDot(areaRect, Room4Center, new Color(0.6f, 0.35f, 0.2f), 14f);  // Room4 — 사당
            BuildMinimapDot(areaRect, ProcRoomCenter, new Color(0.35f, 0.32f, 0.28f), 14f); // ProcRoom — 층2부터 100층까지 절차적으로 갈아치워지는 방 하나

            var dotGo = new GameObject("PlayerDot", typeof(RectTransform));
            dotGo.transform.SetParent(areaRect, false);
            var dotRect = (RectTransform)dotGo.transform;
            dotRect.sizeDelta = new Vector2(10f, 10f);
            var dotImg = dotGo.AddComponent<Image>();
            dotImg.color = Color.white;
            SetPrivateField(minimap, "playerDot", dotRect);
        }

        private static void BuildMinimapDot(RectTransform mapArea, Vector3 worldPos, Color color, float size)
        {
            var go = new GameObject("RoomMark", typeof(RectTransform));
            go.transform.SetParent(mapArea, false);
            var rect = (RectTransform)go.transform;
            rect.sizeDelta = new Vector2(size, size);
            rect.anchoredPosition = Minimap.ProjectToMap(worldPos, mapArea.rect.size);
            var img = go.AddComponent<Image>();
            img.color = color;
        }

        /// <summary>"오버월드 지도 UI" 슬라이스 — saga-dungeon 웹판 PLAN.md
        /// 28-1절 "지도 UI — 디아블로 M키 방식"을 옮겼다. 미니맵(항상
        /// 화면 구석의 작은 개략도)과는 목적이 다르다 — M키를 누르면
        /// 화면 중앙에 나침반형 5칸(중심=모루골/Room1, 남/서/동=마을 셋,
        /// 북=던전 굴혈)이 펼쳐져 "지금 어느 지역에 있고 다른 마을이
        /// 어느 방향에 있는지"를 보여준다. **텔레포트 없음 — 보기만
        /// 하는 창**(웹판과 같은 결). 대각선 네 칸은 안 채운다(원작도
        /// 대각선 방향 마을이 없다).</summary>
        private static void BuildOverworldMap()
        {
            var canvasGo = new GameObject("OverworldMapUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var panelGo = new GameObject("MapPanel", typeof(RectTransform));
            panelGo.transform.SetParent(canvasGo.transform, false);
            var panelRect = (RectTransform)panelGo.transform;
            panelRect.anchorMin = panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.anchoredPosition = Vector2.zero;
            panelRect.sizeDelta = new Vector2(460f, 520f);
            var panelBg = panelGo.AddComponent<Image>();
            panelBg.color = new Color(0f, 0f, 0f, 0.72f);

            var titleGo = new GameObject("Title", typeof(RectTransform));
            titleGo.transform.SetParent(panelGo.transform, false);
            var titleRect = (RectTransform)titleGo.transform;
            titleRect.anchorMin = new Vector2(0.5f, 1f);
            titleRect.anchorMax = new Vector2(0.5f, 1f);
            titleRect.pivot = new Vector2(0.5f, 1f);
            titleRect.anchoredPosition = new Vector2(0f, -20f);
            titleRect.sizeDelta = new Vector2(420f, 50f);
            var titleText = titleGo.AddComponent<TextMeshProUGUI>();
            titleText.fontSize = 28;
            titleText.alignment = TextAlignmentOptions.Center;
            titleText.color = Color.white;
            titleText.text = "지역 지도 (M)";

            var gridGo = new GameObject("Grid", typeof(RectTransform));
            gridGo.transform.SetParent(panelGo.transform, false);
            var gridRect = (RectTransform)gridGo.transform;
            gridRect.anchorMin = gridRect.anchorMax = new Vector2(0.5f, 0.5f);
            gridRect.pivot = new Vector2(0.5f, 0.5f);
            gridRect.anchoredPosition = new Vector2(0f, -30f);
            gridRect.sizeDelta = Vector2.zero;

            // PLAN.md 109-10-4 — 지역 아홉 칸은 OverworldMapUI 가 Play 때 이 Grid 밑에 짓는다(DungeonWorldMap 표).
            var mapUi = canvasGo.AddComponent<OverworldMapUI>();
            SetPrivateField(mapUi, "panel", panelGo);

            panelGo.SetActive(false); // OverworldMapUI가 M키로 토글 — 시작은 닫힘.
        }

        /// <summary>화면 왼쪽 위 — 디버그 빌드에서만 렌더러 이름·FPS·레벨·
        /// 층·적 수·사명·좌표(DebugHud.cs 클래스 주석 참고, GO와 같은 결).</summary>
        private static void BuildDebugOverlay()
        {
            var canvasGo = new GameObject("DebugUI");
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
            rect.sizeDelta = new Vector2(700f, 220f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 22;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.color = new Color(1f, 1f, 1f, 0.8f);
            text.text = "";

            var overlay = canvasGo.AddComponent<DebugHud>();
            SetPrivateField(overlay, "label", text);
        }

        private static void BuildSaveButton()
        {
            // 2026-09-23 — 예전 람다 리스너는 씬 저장 때 사라져 폰에서 먹통이었다.
            // 영속 리스너는 UnityEngine.Object 메서드만 되니 DungeonSaveButton이 받는다.
            var button = BuildActionButton("SaveUI", "SaveButton", new Vector2(1f, 1f), new Vector2(-30f, -30f),
                new Vector2(160f, 80f), new Color(1f, 1f, 1f, 0.18f), "저장", 26, null, "action.save");
            var saver = button.gameObject.AddComponent<DungeonSaveButton>();
            ButtonWiring.Wire(button, saver.Save);
        }

        /// <summary>PLAN.md 67~69장 "접근성" — 효과음·진동·UI 크기·그래픽
        /// 품질. 오른쪽 위 미니맵(-30,-130,140×220) 아래, 20px 틈을 두고
        /// 둔다(`DungeonSettingsPanel.cs` 클래스 주석 참고).</summary>
        private static void BuildSettingsUi()
        {
            var go = new GameObject("DungeonSettingsPanel");
            var panel = go.AddComponent<DungeonSettingsPanel>();
            panel.Build();
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B — 목표판 3줄 + 세션 마무리
        /// 카드(DUNGEON 두 번째 이식, GO `BuildTestVillageScene.BuildGoalBoardUi()`와
        /// 완전히 같은 배선). GoalBoard·SessionCard 는 Awake()가 자기 UI를
        /// 다시 짓는 SagaCore 공용 컴포넌트라 [SerializeField] 배선이
        /// 필요 없다 — DungeonSessionTracker(이 판 전용, Saga.Dungeon.UI)
        /// 하나가 IGoalSource 를 구현하면서 SessionCard 표시도 같이 맡는다.
        /// Player가 이미 씬에 있어야 하니 BuildPlayer() 뒤에서만 부른다.</summary>
        private static void BuildGoalBoardUi()
        {
            var cardGo = new GameObject("SessionCard");
            var sessionCard = cardGo.AddComponent<SessionCard>();

            var trackerGo = new GameObject("DungeonSessionTracker");
            var tracker = trackerGo.AddComponent<DungeonSessionTracker>();
            tracker.Init(sessionCard);

            var boardGo = new GameObject("GoalBoard");
            var board = boardGo.AddComponent<GoalBoard>();
            board.Init(tracker);
        }

        /// <summary>화면 오른쪽 아래 — 모바일 공격 버튼(PlayerCombat.TriggerAttack()).
        /// 데스크톱은 스페이스바로도 된다(PlayerCombat.cs 참고).</summary>
        private static void BuildAttackButton(PlayerCombat combat)
        {
            BuildActionButton("AttackUI", "AttackButton", new Vector2(1f, 0f), new Vector2(-100f, 180f),
                new Vector2(160f, 160f), new Color(0.7f, 0.2f, 0.15f, 0.55f), "공격", 30, combat.TriggerAttack, "action.attack");
        }

        /// <summary>"스킬 다양화" 슬라이스 — 공격 버튼 바로 위(20px 간격),
        /// 데스크톱은 Left Alt로도 된다(PlayerCombat.TryHeavyAttack() 참고).</summary>
        private static void BuildHeavyAttackButton(PlayerCombat combat)
        {
            // AttackButton(y=180, 높이160) 바로 위, 20px 간격
            BuildActionButton("HeavyAttackUI", "HeavyAttackButton", new Vector2(1f, 0f), new Vector2(-100f, 360f),
                new Vector2(130f, 130f), new Color(0.75f, 0.4f, 0.05f, 0.55f), "강공격", 26, combat.TriggerHeavyAttack, "action.heavy_attack");
        }

        /// <summary>PLAN.md 51장 "DUNGEON 확장 — 빌드" — 강공격 버튼 위(20px
        /// 간격), 데스크톱은 E키로도 된다(PlayerCombat.TryWhirl() 참고).</summary>
        private static void BuildWhirlButton(PlayerCombat combat)
        {
            // HeavyAttackButton(y=360, 높이130) 바로 위, 20px 간격
            BuildActionButton("WhirlUI", "WhirlButton", new Vector2(1f, 0f), new Vector2(-100f, 510f),
                new Vector2(130f, 130f), new Color(0.5f, 0.15f, 0.55f, 0.55f), "회전베기", 26, combat.TriggerWhirl, "action.whirl");
        }

        /// <summary>"회피" 슬라이스 — 공격 버튼 왼쪽(20px 간격), 데스크톱은
        /// Left Ctrl로도 된다(PlayerController.TryDodge() 참고).</summary>
        private static void BuildDodgeButton(PlayerController controller)
        {
            // AttackButton(-100, 폭160)의 왼쪽, 20px 간격
            BuildActionButton("DodgeUI", "DodgeButton", new Vector2(1f, 0f), new Vector2(-280f, 180f),
                new Vector2(130f, 130f), new Color(0.15f, 0.45f, 0.6f, 0.55f), "회피", 26, controller.TryDodge, "action.dodge");
        }

        /// <summary>PLAN.md 106-2 "벽력탄" — 주목 버튼 바로 위(20px 간격), 데스크톱은 R.
        /// 벽력탄 상자를 열기 전엔 눌러도 "아직 없다" 토스트만(PlayerBombs.TryPlaceBomb).</summary>
        /// <summary>PLAN.md 106-5 "탐험" — 벽력탄 버튼 바로 위(20px 간격), 데스크톱은 F(Space 는 평타).</summary>
        private static void BuildJumpButton(PlayerController controller)
        {
            BuildActionButton("JumpUI", "JumpButton", new Vector2(1f, 0f), new Vector2(-280f, 630f),
                new Vector2(130f, 130f), new Color(0.3f, 0.55f, 0.35f, 0.55f), "점프", 26, controller.RequestJump, "action.jump");
        }

        private static void BuildBombButton(PlayerBombs bombs)
        {
            // LockOnButton(y=330, 높이130) 바로 위, 20px 간격
            BuildActionButton("BombUI", "BombButton", new Vector2(1f, 0f), new Vector2(-280f, 480f),
                new Vector2(130f, 130f), new Color(0.35f, 0.3f, 0.3f, 0.55f), "벽력탄", 24, bombs.TryPlaceBomb, "action.bomb");
        }

        /// <summary>PLAN.md 106-1 "락온" — 회피 버튼 바로 위(20px 간격), 데스크톱은
        /// Q(토글)·Tab(다음 대상)(PlayerLockOn.cs 참고).</summary>
        private static void BuildLockOnButton(PlayerLockOn lockOn)
        {
            // DodgeButton(y=180, 높이130) 바로 위, 20px 간격
            BuildActionButton("LockOnUI", "LockOnButton", new Vector2(1f, 0f), new Vector2(-280f, 330f),
                new Vector2(130f, 130f), new Color(0.85f, 0.65f, 0.15f, 0.55f), "주목", 26, lockOn.Toggle, "action.lockon");
        }

        /// <summary>모바일 화면 버튼 하나(전체화면 캔버스+사각 배경+가운데 정렬
        /// 라벨) — Save/Attack/HeavyAttack/Whirl/Dodge 다섯 버튼이 이 골격
        /// 하나만 다르고(이름·앵커·위치·크기·색·글자·콜백) 전부 같았다(code-review
        /// 지적, PLAN.md 33장 규칙 6·7 "동일한 코드를 복사하지 않는다"). anchor는
        /// anchorMin=anchorMax=pivot으로 쓰인다 — 다섯 버튼 전부 고정점 앵커라
        /// 늘어나는 앵커는 없다.</summary>
        private static Button BuildActionButton(string canvasName, string buttonName, Vector2 anchor,
            Vector2 anchoredPosition, Vector2 size, Color color, string label, int fontSize,
            UnityEngine.Events.UnityAction onClick, string locKey)
        {
            var canvasGo = new GameObject(canvasName);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var btnGo = new GameObject(buttonName, typeof(RectTransform));
            btnGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)btnGo.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var img = btnGo.AddComponent<Image>();
            img.color = color;
            var button = btnGo.AddComponent<Button>();
            button.targetGraphic = img;
            // 2026-09-23 — onClick.AddListener는 런타임 전용이라 씬 저장 때 사라졌다(모바일
            // 버튼 전부 먹통). 영속 리스너로 건다 — SagaCore/ButtonWiring.cs.
            ButtonWiring.Wire(button, onClick);

            var textGo = new GameObject("Text", typeof(RectTransform));
            textGo.transform.SetParent(btnGo.transform, false);
            var textRect = (RectTransform)textGo.transform;
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;
            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.text = DungeonLocalization.T(locKey, label);

            var localized = btnGo.AddComponent<LocalizedButtonLabel>();
            localized.Init(locKey, label);
            return button;
        }

        private static void BuildMobileHud()
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
        }

        /// <summary>PLAN.md 101-2 5.1 "축복 3택"(2026-09-19) — GameBootstrap이
        /// FindFirstObjectByType로 찾아 보스층 진입마다 띄운다(PerkChoiceUi.cs와
        /// 같은 결, 자기 캔버스를 스스로 짓는다). GoalBoardUi 뒤·Bootstrap 앞.</summary>
        private static void BuildBlessingChoiceUi()
        {
            var go = new GameObject("BlessingChoiceUI");
            var ui = go.AddComponent<BlessingChoiceUi>();
            ui.Build();
        }
    }
}
