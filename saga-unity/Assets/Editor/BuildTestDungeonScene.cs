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
    /// VERTICAL_SLICE_DUNGEON.md — TestDungeon 씬을 코드로 조립해 저장한다.
    /// `BuildTestVillageScene.cs`(GO)와 같은 결 — 캐릭터는 2026-09-12
    /// "GLB 자산 도입" 슬라이스로 SagaGo의 Kenney Blocky Characters를
    /// 재사용하게 됐지만, Sky/Fog·NPC·조이스틱 세부는 여전히 이번
    /// 슬라이스 범위 밖(문서의 "제외" 참고). 멱등 — 다시 실행하면 씬을
    /// 통째로 새로 짠다.
    /// </summary>
    public static partial class BuildTestDungeonScene
    {
        private const string ScenePath = "Assets/Scenes/TestDungeon.unity";
        private const string InputActionsPath = "Assets/InputSystem_Actions.inputactions";

        // "GLB 자산 도입" 슬라이스 — SagaGo가 이미 쓰는 Kenney Blocky
        // Characters를 그대로 재사용(CharacterVisual.cs 주석 참고). 배역
        // 배정: a=플레이어(무색), b=동행(청색), c=두목(적갈), d=잡졸(황건).
        private const string CharacterAPath = "Assets/Art/Characters/character-a.glb";
        private const string CharacterBPath = "Assets/Art/Characters/character-b.glb";
        private const string CharacterCPath = "Assets/Art/Characters/character-c.glb";
        private const string CharacterDPath = "Assets/Art/Characters/character-d.glb";

        // 44장 우선순위 "Player" 교체 — Kenney character-a 대신 66-2장이
        // 이미 리깅·머티리얼까지 검증한 Maria를 쓴다(BuildTestCharacterRealisticScene
        // 참고). CharactersRealistic/은 .gitignore 대상(로컬 전용, 라이선스
        // 때문에 미커밋)이라 못 찾으면 character-a로 조용히 폴백한다.
        private const string MariaBodyFbxPath = "Assets/Art/CharactersRealistic/Maria WProp J J Ong.fbx";
        private const string MariaControllerPath = "Assets/Animators/Maria.controller";

        // 44장 "주요 Enemy" 교체 — 잡졸(character-d) 자리를 Abe(리깅+Animator
        // 내장 프리팹, SetupAbeCharacterImport.cs 참고)로.
        private const string AbeAnimatedPrefabPath = "Assets/Art/CharactersRealistic/Abe/AbeAnimated.prefab";

        // 44장 "Boss" 교체 — 미니보스/두목(character-c) 자리를 Brute로
        // (SetupBruteCharacterImport.cs 참고).
        private const string BruteAnimatedPrefabPath = "Assets/Art/CharactersRealistic/Brute/BruteAnimated.prefab";

        // "환경/건물 GLB" 슬라이스 — SagaGo가 이미 쓰는 CC0 Kenney Modular
        // Cave Kit(gate-rock.glb와 같은 킷)에서 문·복도 타일만 마저 뽑아
        // saga-godot의 assets/dungeon/에서 그대로 복사(새 다운로드 없음).
        // "방 셸 GLB" 슬라이스(뒤이음)가 room-small.glb(방 셸)도 마저
        // 받아 왔다 — DungeonRoomBuilder.cs 클래스 주석 참고(비균등
        // 스케일 문제를 "방을 셸 원본 정사각 비율에 맞추는 균일 스케일"
        // 로 풀었다).
        private const string CorridorGlbPath = "Assets/Art/Dungeon/corridor.glb";
        private const string GateGlbPath = "Assets/Art/Dungeon/gate.glb";
        private const string RoomGlbPath = "Assets/Art/Dungeon/room-small.glb";

        // 44장 "Environment" 교체 — ⑥이 미리 구워 둔 Poly Haven PBR 재질
        // (BuildEnvironmentPbrSample.cs)을 room-small.glb/corridor.glb 셸
        // 대신 실제로 씬에 물린다. 후보 폴더가 없으면(다른 PC에 아직 안
        // 받아 둔 경우) null로 남아 기존 셸/색상 경로로 조용히 폴백한다.
        private const string DungeonFloorMatPath = "Assets/Art/Environment/PBR/cobblestone_floor_01_URPLit.mat";
        private const string DungeonWallMatPath = "Assets/Art/Environment/PBR/castle_wall_slates_URPLit.mat";

        // 2026-09-14 "사운드" 실클립 전환 — SfxPlayer.cs 클래스 주석 참고.
        // 다섯 판 공유 원본 트리(Assets/Art/Audio) 재사용(hit/death)과
        // 새로 받은 클립(heavyHit/levelUp/discovery) 섞임 — 자세한 선정
        // 기준은 docs/ASSET_GUIDE.md 2026-09-14 항목.
        private const string HitClipPath = "Assets/Art/Audio/Kenney_RPGSounds/chop.ogg";
        private const string HeavyHitClipPath = "Assets/Art/Audio/Kenney_RPGSounds/knifeSlice.ogg";
        private const string EnemyDeathClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_001.ogg";
        private const string LevelUpClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_002.ogg";
        private const string DiscoveryClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_003.ogg";
        private const string BgmClipPath = "Assets/Art/Audio/CC0_BGM/dungeon_ambience.ogg"; // 67장 BGM(2026-09-15).

        private static readonly Vector3 PlayerSpawn = new Vector3(-6f, 0.1f, 0f);

        // "몬스터 무리" 슬라이스 — saga-dungeon 웹판 js/dungeon.js:333
        // makeRoom('fight', ...)의 floor=1 공식 min(12, 4 + rand(0~3))의
        // 최소값 4마리를 무작위 롤 없이 결정적으로 씀(DungeonEnemy.cs
        // 주석 참고). 방(가로 20m, 벽 두께 1m — 세로는 "방 셸 GLB"
        // 슬라이스로 14→20m, 아래 참고) 안쪽에서 서로 안 겹치게
        // 플레이어 스폰(-6,0,0) 반대편에 부채꼴로 흩어 둔다.
        private static readonly Vector3[] EnemySpawns =
        {
            new Vector3(5f, 0f, 0f),
            new Vector3(6.5f, 0f, 3.5f),
            new Vector3(6.5f, 0f, -3.5f),
            new Vector3(3f, 0f, 5f),
        };

        // "엘리트/보스" 슬라이스 — saga-dungeon 웹판 makeRoom('boss', ...)
        // (dungeon.js:327-330)와 같은 구성, floor=1 기준 부하 수 공식
        // min(6, 2 + floor(1/5)) = 2명. 잡졸 무리보다 더 안쪽(동쪽 벽
        // 가까이)에 둬 방을 가로질러야 만나는 "정점" 자리로 삼는다.
        private static readonly Vector3 BossSpawn = new Vector3(9f, 0f, 0f);
        private static readonly Vector3[] BossEscortSpawns =
        {
            new Vector3(8f, 0f, 2.5f),
            new Vector3(8f, 0f, -2.5f),
        };

        // "방 종류 다양화" 슬라이스 — saga-dungeon 웹판 room.well/chest/shrine
        // (dungeon.js:336-341)을 한 방 안에 같이 두는 걸로 옮겼다(웹판은
        // 각각 다른 kind의 방인데, 이 슬라이스는 방이 하나뿐). 몬스터 무리
        // (동쪽, x=3~9)와 안 겹치게 플레이어 스폰(-6,0,0) 주변 서쪽에 흩어
        // 둔다.
        private static readonly Vector3 WellSpawn = new Vector3(-2f, 0f, 5f);
        private static readonly Vector3 TroveSpawn = new Vector3(-2f, 0f, -5f);
        private static readonly Vector3 ShrineSpawn = new Vector3(-8f, 0f, -4f);

        // "오픈월드/필드" 슬라이스 — 방 하나짜리 구조를 벗어나는 첫 조각.
        // Room(방1)의 북쪽 벽에 문을 뚫고 복도(길이 8m)로 Room2와 잇는다.
        //
        // "방 셸 GLB" 슬라이스(뒤이음) — room-small.glb(정사각 12×12)를
        // 왜곡 없이 쓰려고 `DungeonRoomBuilder.RoomDepth`를 14→20으로
        // 올렸다(그 파일 클래스 주석 참고) — halfD가 7→10으로 바뀌어
        // 아래 산출식도 전부 다시 잡음. 문 폭도 셸의 배율(RoomScale)을
        // 그대로 따라 gate.glb(4.4)×5/3 ≈ 7.33으로 넓어졌다(예전 3m는
        // 셸이 없던 시절 임의로 잡은 값 — 이제 셸의 실제 문 구멍 폭을
        // 따라야 어긋나지 않는다, DungeonRoomBuilder.cs 클래스 주석의
        // "확인 안 됨" 가정 참고). 좌표 산출: Room1 북쪽 벽 바깥면
        // z = halfD(10)+두께(1) = 11, 복도 길이 8(안 바뀜 — 복도는
        // room-small.glb가 아니라 corridor.glb 몫, DungeonCorridorBuilder
        // .cs 참고) → Room2 남쪽 벽 바깥면 z = 11+8 = 19, Room2 중심
        // z = 19+halfD(10)+두께(1) = 30. 복도 중심 z = (11+19)/2 = 15.
        private static readonly float RoomDoorWidth =
            DungeonRoomBuilder.GateModelWidth * DungeonRoomBuilder.RoomScale; // ≈7.33 — 방 셸 배율을 그대로 따름
        private static readonly Vector3 CorridorCenter = new Vector3(0f, 0f, 15f);
        private static readonly Vector3 Room2Center = new Vector3(0f, 0f, 30f);

        // Room2 "필드" 콘텐츠 — 잡졸 둘(기본값 그대로, 다음 구역에도
        // 몬스터가 있다는 걸 보여주는 최소 단위). 좌표는 Room2Center 기준
        // 로컬 오프셋을 world로 변환해 둠(월드 좌표를 직접 씀).
        private static readonly Vector3[] FieldEnemySpawns =
        {
            Room2Center + new Vector3(0f, 0f, 2f),
            Room2Center + new Vector3(-4f, 0f, -2f),
        };

        // "방 종류 마지막" 슬라이스 — Room2 북쪽에 복도로 Room3(정예 소굴+
        // 미니보스+채광방)을, 그 북쪽에 다시 복도로 Room4(구출+퍼즐+
        // 채집)를 잇는다. "방 셸 GLB" 슬라이스로 halfD가 7→10이 돼(위
        // 주석 참고) 산출식을 다시 잡음(방 halfD=10, 벽 두께=1, 복도
        // 길이=8은 안 바뀜): Room2 북쪽 벽 바깥면 z=30+10+1=41 →
        // 복도2 중심 z=41+4=45 → Room3 남쪽 벽 바깥면 z=41+8=49 →
        // Room3 중심 z=49+10+1=60 → Room3 북쪽 벽 바깥면 z=60+10+1=71 →
        // 복도3 중심 z=71+4=75 → Room4 남쪽 벽 바깥면 z=71+8=79 →
        // Room4 중심 z=79+10+1=90.
        private static readonly Vector3 Corridor2Center = new Vector3(0f, 0f, 45f);
        private static readonly Vector3 Room3Center = new Vector3(0f, 0f, 60f);
        private static readonly Vector3 Corridor3Center = new Vector3(0f, 0f, 75f);
        private static readonly Vector3 Room4Center = new Vector3(0f, 0f, 90f);

        // Room3 "정예 소굴"(js/dungeon.js:342-347) — 정예 하나(forceElite,
        // ELITES 표의 'fierce' 배율 hp×1.35·dmg×1.9를 그대로 적용,
        // 세공·희귀도 절차 표는 범위 밖이라 고정 한 종만 씀) + 잡졸 둘.
        private static readonly Vector3 EliteSpawn = Room3Center + new Vector3(6f, 0f, 0f);
        private static readonly Vector3[] EliteEscortSpawns =
        {
            Room3Center + new Vector3(5f, 0f, 2.5f),
            Room3Center + new Vector3(5f, 0f, -2.5f),
        };

        // Room3 "미니보스"(js/dungeon.js:348-352) — 부하 없이 혼자, 보스와
        // 같은 노획 흐름(`isBoss=true`)을 그대로 재사용(웹판도 `kill()`이
        // `e.boss`만 보고 이미 보스급 노획을 준다 — 미니보스도 같은 흐름).
        private static readonly Vector3 MinibossSpawn = Room3Center + new Vector3(9f, 0f, 0f);

        // Room3 "채광방"(js/dungeon.js:353-358, `DungeonVein.cs`) — 정예
        // 소굴·미니보스(동쪽)와 안 겹치게 서쪽에.
        private static readonly Vector3 VeinSpawn = Room3Center + new Vector3(-6f, 0f, -4f);

        // Room4 "이벤트방(구출)"(js/dungeon.js:383-393, `DungeonCaptive.cs`) —
        // 지키는 잡졸 둘을 다 잡아야 풀려난다. 동쪽에.
        private static readonly Vector3 CaptiveSpawn = Room4Center + new Vector3(6f, 0f, 0f);
        private static readonly Vector3[] CaptiveGuardSpawns =
        {
            Room4Center + new Vector3(5f, 0f, 2.5f),
            Room4Center + new Vector3(5f, 0f, -2.5f),
        };

        // Room4 "퍼즐방"(js/dungeon.js:366-382, `DungeonPuzzle.cs`) — 서쪽,
        // 구출 자리와 안 겹치게.
        private static readonly Vector3 PuzzleAnchor = Room4Center + new Vector3(-5f, 0f, 0f);

        // Room4 "채집·낚시방"(js/dungeon.js:394-412, `DungeonForage.cs`) —
        // 북쪽(플레이어 진입 방향인 남쪽 문과 안 겹치게). 내부 오프셋(herb
        // z=+3~+3.5)을 더하면 최대 z=2+3.5=5.5로 북쪽 벽(z=10, "방 셸
        // GLB" 슬라이스로 7→10)에서 4.5m 여유를 둔다.
        private static readonly Vector3 ForageAnchor = Room4Center + new Vector3(-2f, 0f, 2f);

        // "Secret Area" 슬라이스 — 구출(6,0)·호위(5,±2.5)·퍼즐(-5,0)·채집
        // (-2,2)·사당 소품(-8,-5)과 다 떨어진 SE 빈 구석. 방 클리어·문
        // 진행에 필요 없는 완전히 선택적인 자리.
        private static readonly Vector3 SecretStashSpawn = Room4Center + new Vector3(8f, 0f, -8f);

        // "DUNGEON 오픈월드 확장 — 절차적 층 진행 전환" (2026-09-12) —
        // Room5~11까지는 "방을 물리적으로 하나씩 이어 붙이는" 방식으로
        // 층2를 채웠는데, 사용자가 "100층까지 진행해줘"로 요청하면서 그
        // 방식은 규모상 불가능해졌다(방 수백~수천 개를 좌표로 손수 배치할
        // 수 없다). saga-dungeon 웹판의 실제 방식(방 하나를 클리어마다
        // 갈아치우며 문 2~3개 중 다음 종류를 고르는 로그라이크식 진행,
        // `js/dungeon.js`)으로 전환 — **Room5~11은 이제 존재하지 않는다**,
        // 그 좌표(Room4Center 90 기준 +30, 105/120)에 복도4 + 방 하나
        // (ProcRoom)만 남고 `DungeonFloorRunner`(World/DungeonFloorRunner.cs)
        // 가 그 방 하나를 100층까지 계속 갈아치운다. 자세한 공식·문 선택
        // 로직은 `Data/DungeonFormulas.cs`·`DungeonFloorRunner.cs` 참고.
        private static readonly Vector3 Corridor4Center = new Vector3(0f, 0f, 105f);
        private static readonly Vector3 ProcRoomCenter = new Vector3(0f, 0f, 120f);

        // "DUNGEON 오픈월드 확장 — 마을 여러 개" (2026-09-12) — saga-dungeon
        // 웹판 PLAN.md 28장은 "오픈월드"를 두 가지 다른 뜻으로 쓴다: (1) 던전
        // 층 하나를 클리어마다 갈아치우는 로그라이크식 진행(위 ProcRoom이
        // 이미 이거다, js/dungeon.js와 일치 확인됨) — (2) **마을이 여럿이고
        // 마을 밖 들판을 걸어서 다른 마을로 건너가는 구조**(28-1~28-8절,
        // 원작은 이걸 위해 "위장된 전환"까지 만들었다 — 마을마다 좌표계가
        // 독립이라 진짜 하나로 이어진 공간이 아니었기 때문). 사용자가
        // "마을 여러 개 — 걸어서 이어지는 진짜 오픈월드"로 (2)를 확정.
        // **이 프로젝트는 원작과 달리 처음부터 Room1~ProcRoom이 전부
        // 하나의 연속 좌표계다** — 원작이 좌표계를 속여야 했던 이유
        // 자체가 여기엔 없다. 그래서 "마을 두 개를 걸어서 잇는다"는 그냥
        // Room1처럼 방 하나를 더 짓고 복도로 잇는 것과 똑같다 — 새로운
        // 이동/좌표 시스템이 필요 없다(세이브도 `SaveState.cs`가 이미
        // playerPos 세 값을 그대로 저장/복원해 Town2에서 저장해도 별도
        // "현재 마을" 필드 없이 저절로 맞다).
        //
        // **첫 슬라이스 범위 — 4개가 아니라 2개.** 원작은 마을 넷(모루골
        // +위성 셋)이지만, Vertical Slice First(PLAN.md 3.1)에 따라
        // "던전 밖으로 나가 다른 마을에 닿는다"는 개념 하나만 먼저
        // 증명한다 — 오버월드 지도 UI·마을 셋 이상·마을 간 분기는 이번엔
        // 범위 밖(다음 슬라이스 후보로 남긴다).
        //
        // Room1의 **남쪽** 문(지금까지 안 쓰던 벽 — 북쪽은 이미 Room2행
        // 진행에 씀)을 열어 마을 방향임을 구분한다. 좌표는 북쪽 진행과
        // 정확히 대칭(부호만 반대) — Room1 남쪽 벽 바깥면 z=-(halfD(10)+
        // 두께(1))=-11, 복도 길이 8 → Town2 남쪽 벽 바깥면 z=-11-8=-19,
        // Town2 중심 z=-19-halfD(10)-두께(1)=-30, 복도 중심 z=(-11-19)/2=-15.
        private static readonly Vector3 TownCorridorCenter = new Vector3(0f, 0f, -15f);
        private static readonly Vector3 Town2Center = new Vector3(0f, 0f, -30f);

        // "마을 여러 개 — 셋째·넷째" (2026-09-12) — saga-dungeon 웹판
        // PLAN.md 28-1절의 별형 구조를 그대로 따른다: 위성 마을은 서로
        // 안 잇고 전부 모루골(Room1)에만 통한다. Room1의 나머지 두 벽
        // (동/서, 지금까지 안 쓰던)을 각각 열어 Town3(서)·Town4(동)로
        // 잇는다 — 좌표 산출은 Town2(남쪽)와 완전히 같은 공식, 축만 X로
        // 바뀐다: Room1 서쪽 벽 바깥면 x=-(halfW(10)+두께(1))=-11, 복도
        // 길이 8 → Town3 동쪽 벽 바깥면 x=-11-8=-19, Town3 중심
        // x=-19-halfW(10)-두께(1)=-30(동쪽 Town4는 부호만 반대로 +30/+15).
        private static readonly Vector3 TownCorridorWestCenter = new Vector3(-15f, 0f, 0f);
        private static readonly Vector3 Town3Center = new Vector3(-30f, 0f, 0f);
        private static readonly Vector3 TownCorridorEastCenter = new Vector3(15f, 0f, 0f);
        private static readonly Vector3 Town4Center = new Vector3(30f, 0f, 0f);

        // "위성↔위성 지름길" (2026-09-12) — saga-dungeon 웹판 PLAN.md §28-3
        // "위성↔위성 통로"를 개념만 참고했다(코드 없음 — 웹판은 화면이 서로
        // 분리된 2D 포털이라 "출구 방향"이 실제 기하학적 방향과 안 맞아도
        // 됐지만, 이 프로젝트는 처음부터 하나의 연속 좌표계라 그 트릭 자체가
        // 필요 없다). §28-3이 "인접 사분면끼리만 잇는다, 정반대(자작재-
        // 소금벌, N-S)는 뺀다"고 정한 것과 같은 논리로 — Town3(서)와
        // Town4(동)는 정반대라 빼고, **인접한 Town2(남)↔Town3(서)** 하나만
        // 첫 지름길로 잇는다(Town2↔Town4(동)는 후속 후보로 남김, §28-3도
        // "갈대나루↔소금벌은 후속"이라 미뤄 뒀던 것과 같은 절제).
        // **거리 자체는 안 줄어든다**(Crossroads까지 30+Town2까지 30=60,
        // Room1을 거치는 것과 정확히 같다 — 이 던전이 사방 30 단위 격자라
        // 축 정렬 통로로는 원래 어느 경로를 골라도 모루골이 이미 최단
        // 경유지다) — 그래도 §28-3 원문 취지("모루골을 안 거치고 옆
        // 사분면으로 바로 질러간다")대로 **Room1 내부(적·POI)를 다시 안
        // 지나도 되는 우회로**로서 가치가 있다고 보고 넣는다. Crossroads
        // 방 자체는 새 축(-30,-30)에 세우고, 기존 방식 그대로 Town3
        // 남쪽 문→복도→Crossroads 북쪽 문(N-S, 회전 없음), Crossroads
        // 동쪽 문→복도→Town2 서쪽 문(E-W, Y축 90도 회전)으로 잇는다.
        private static readonly Vector3 ShortcutCorridorNorthCenter = new Vector3(-30f, 0f, -15f);
        private static readonly Vector3 CrossroadsCenter = new Vector3(-30f, 0f, -30f);
        private static readonly Vector3 ShortcutCorridorEastCenter = new Vector3(-15f, 0f, -30f);

        // "위성↔위성 지름길 후속: Town2↔Town4" (2026-09-13, 열여섯 번째
        // 세션) — 위 §28-3 지름길이 "Town2↔Town4는 후속 후보로 남김"이라
        // 적어 둔 그 두 번째 쌍. Town2(남)·Town4(동)는 인접 사분면(위
        // Town3-Town2와 같은 논리 — Town3(서)·Town4(동)만 정반대라 뺀다)
        // 이라 그대로 잇는다. Crossroads2는 Town4의 x(30)·Town2의 z(-30)가
        // 만나는 자리(-30,-30이 Town3.x·Town2.z였던 것과 완전히 같은 공식) —
        // Town2 동쪽 문→복도(Y축 90도, E-W)→Crossroads2 서쪽 문,
        // Crossroads2 북쪽 문→복도(회전 없음, N-S)→Town4 남쪽 문.
        private static readonly Vector3 ShortcutCorridorWest2Center = new Vector3(15f, 0f, -30f);
        private static readonly Vector3 Crossroads2Center = new Vector3(30f, 0f, -30f);
        private static readonly Vector3 ShortcutCorridorNorth2Center = new Vector3(30f, 0f, -15f);

        // "난입(亂入)" 슬라이스(PLAN.md 101-2 5.5) — 웹판 "모루골 결사비 옆 표식"을
        // Room1(모루골 역할) 빈 구석에 세우되, 파도는 기존 콘텐츠와 안 겹치는
        // 완전히 새로운 고정 방(HordeArena)에서 진행한다(`HordeRunner.cs`
        // 클래스 주석 참고) — 다른 어떤 좌표계와도 안 이어진 완전 격리 좌표.
        // Room1 잡졸(5,0)~(6.5,±3.5)·두목(9,0)·부하(8,±2.5)·우물(-2,5)·상자
        // (-2,-5)·사당(-8,-4)·decorOffset(-8,5)와 안 겹치는 SE 빈 구석에 표식을 둔다.
        private static readonly Vector3 HordeGateSpawn = new Vector3(8f, 0f, -8f);
        private static readonly Vector3 HordeArenaCenter = new Vector3(60f, 0f, 60f);

        // "마을 장식 보강" 슬라이스 — 마을 셋(Town2·3·4) 정주 촌민에 공통으로
        // 쓰는 옷 색(따뜻한 베이지) — 전투원(잡졸=황건, 두목=적갈)과 겹치지
        // 않는 톤으로 "민간인"임을 색으로도 가른다.
        private static readonly Color VillagerTint = new Color(0.72f, 0.62f, 0.42f);

        // Build() 시작에 한 번만 로드해 각 Build* 메서드가 나눠 쓴다.
        private static GameObject _characterA, _characterB, _characterC, _characterD;
        // PLAN.md 106-4 "캐릭터 통일" — `SetupNpcCharacterImports` 가 구운 사실 모델. 없으면 각 자리의 예전 모델.
        private static GameObject _skeleton, _paladin, _peasantMan, _peasantGirl;
        private static GameObject _ninja, _demon, _alienSoldier; // 두목 전용 몸(106-4, 없는 PC 는 null → 옛 몸)
        private static int _villagerCount;
        private static GameObject _corridorGlb, _gateGlb, _roomGlb;
        private static Material _dungeonFloorMat, _dungeonWallMat;

        [MenuItem("Saga/Build TestDungeon Scene")]
        public static void Build()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            LoadCharacterModels();
            LoadDungeonModels();
            BuildLighting();
            var roomGo = BuildRoom();
            BuildEnemy();
            BuildRoomPois();
            BuildCorridorAndTown2();
            BuildCorridorAndTown3();
            BuildCorridorAndTown4();
            BuildEraFolk(); // PLAN.md 109-2 — 마을·갈림길 시대 손님(마을 넷을 다 지은 뒤)
            BuildShortcutCrossroads();
            BuildShortcutCrossroads2();
            BuildTownEraDecor(); // PLAN.md 109-2b — 마을 셋·갈림길 둘 꾸밈에 시대 층(갈림길까지 다 지은 뒤)
            BuildCorridorAndRoom2();
            BuildCorridorAndRoom3();
            BuildCorridorAndRoom4();
            BuildCorridorAndProcRoom();
            // PLAN.md 106-4 — 능묘지기 전용 몸 Ganfaul M Aure(2026-09-24), 없는 PC 는 두목 모델(Brute 1.5배).
            var keeper = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("Ganfaul"));
            BuildDungeonTemple.Build(_corridorGlb, _gateGlb, _roomGlb, _dungeonFloorMat, _dungeonWallMat,
                keeper != null ? keeper : _characterC, _skeleton != null ? _skeleton : _characterD, RoomDoorWidth, keeper != null); // PLAN.md 106-2 "잊힌 능묘"(파수꾼 = 106-4 해골).
            BuildDungeonWatchCourt.Build(_corridorGlb, _gateGlb, _roomGlb, _dungeonFloorMat, _dungeonWallMat, RoomDoorWidth); // PLAN.md 106-5 "탐험".
            var (playerGo, playerCombat, playerController) = BuildPlayer();
            BuildAlly();
            BuildPostProcessingVolume();
            BuildToneVolume();
            BuildEventSystem();
            BuildDialogueUi();
            BuildPlayerHud();
            BuildMinimap();
            BuildOverworldMap();
            BuildDebugOverlay();
            BuildSaveButton();
            BuildSettingsUi();
            BuildGoalBoardUi();
            BuildAttackButton(playerCombat);
            BuildHeavyAttackButton(playerCombat);
            BuildWhirlButton(playerCombat);
            BuildDodgeButton(playerController);
            BuildLockOnButton(playerGo.GetComponent<PlayerLockOn>());
            BuildBombButton(playerGo.GetComponent<PlayerBombs>());
            BuildJumpButton(playerController); // PLAN.md 106-5
            BuildPartyUi(playerGo.GetComponent<PartyCommands>()); // PLAN.md 106-6
            BuildMobileHud();
            BuildBlessingChoiceUi();
            BuildDungeonCinematics.Build(playerGo, BuildDungeonTemple.LastGuardian); // PLAN.md 106-3 — 플레이어·HUD 뒤.
            BuildHordeArena();
            BuildBootstrap();

            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[BuildTestDungeonScene] saved to {ScenePath} — room childCount={roomGo.transform.childCount}");
        }

        private static void LoadCharacterModels()
        {
            _characterA = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterAPath);
            _skeleton = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("Skeleton"));
            _paladin = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("Paladin"));
            _peasantMan = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("PeasantMan"));
            _peasantGirl = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("PeasantGirl"));
            _ninja = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("Ninja"));
            _demon = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("Demon"));
            _alienSoldier = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("AlienSoldier"));
            _villagerCount = 0;
            if (_skeleton == null || _paladin == null || _peasantMan == null || _peasantGirl == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] 106-4 사실 모델 일부 없음(Saga/Setup NPC Character Imports) — 그 자리는 예전 모델");
            }
            _characterB = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterBPath);
            _characterC = AssetDatabase.LoadAssetAtPath<GameObject>(BruteAnimatedPrefabPath)
                ?? AssetDatabase.LoadAssetAtPath<GameObject>(CharacterCPath);
            _characterD = AssetDatabase.LoadAssetAtPath<GameObject>(AbeAnimatedPrefabPath)
                ?? AssetDatabase.LoadAssetAtPath<GameObject>(CharacterDPath);
            if (_characterA == null || _characterB == null || _characterC == null || _characterD == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] character-{a,b,c,d}.glb 중 일부를 못 찾음 — primitive capsule로 대체됨(CharacterVisual.cs 폴백).");
            }
        }

        private static void LoadDungeonModels()
        {
            _corridorGlb = AssetDatabase.LoadAssetAtPath<GameObject>(CorridorGlbPath);
            _gateGlb = AssetDatabase.LoadAssetAtPath<GameObject>(GateGlbPath);
            _roomGlb = AssetDatabase.LoadAssetAtPath<GameObject>(RoomGlbPath);
            if (_corridorGlb == null || _gateGlb == null || _roomGlb == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] corridor.glb/gate.glb/room-small.glb 중 일부를 못 찾음 — primitive 색상으로 대체됨.");
            }

            _dungeonFloorMat = AssetDatabase.LoadAssetAtPath<Material>(DungeonFloorMatPath);
            _dungeonWallMat = AssetDatabase.LoadAssetAtPath<Material>(DungeonWallMatPath);
            if (_dungeonFloorMat == null || _dungeonWallMat == null)
            {
                Debug.LogWarning("[BuildTestDungeonScene] Environment PBR 재질을 못 찾음 — room-small.glb 셸/색상으로 대체됨(Saga/Build Environment PBR Sample Materials 먼저 실행).");
            }
        }

        /// <summary>44장 "Environment" — room/corridor 빌더 하나에 PBR 재질
        /// 둘을 한 번에 배정한다(호출부가 많아 헬퍼로 뺌).</summary>
        private static void AssignEnvironmentMaterials(Object builder)
        {
            SetPrivateField(builder, "floorMaterial", _dungeonFloorMat);
            SetPrivateField(builder, "wallMaterial", _dungeonWallMat);
        }

        /// <summary>PLAN.md 66-2장(파이널 판타지 최신작 기준) 라이팅/무드 —
        /// 던전은 밝기 자체는 그대로 낮게 두되(어두운 분위기가 목적) 색만
        /// 횃불처럼 데워 Bloom(66-2 후처리)이 반응할 여지를 준다. 반대편에서
        /// 차가운 톤 RimLight를 살짝 넣어 벽·몬스터 실루엣에 대비를 만든다
        /// (66-2장 "역광·림라이트로 실루엣 강조").</summary>
        private static void BuildLighting()
        {
            var sunGo = new GameObject("Light");
            var light = sunGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 0.9f;
            light.color = new Color(1f, 0.75f, 0.5f);
            light.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(55f, -20f, 0f);

            var rimGo = new GameObject("RimLight");
            var rim = rimGo.AddComponent<Light>();
            rim.type = LightType.Directional;
            rim.intensity = 0.35f;
            rim.color = new Color(0.5f, 0.55f, 0.9f);
            rim.shadows = LightShadows.None;
            rimGo.transform.rotation = Quaternion.Euler(20f, 160f, 0f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.16f, 0.15f, 0.18f);
        }

        private static GameObject BuildRoom()
        {
            var go = new GameObject("Room");
            var builder = go.AddComponent<DungeonRoomBuilder>();
            // "바이옴 5종" — 황건적 소굴은 웹판 THEME_BIAS의 '산채(山寨)'
            // (forest 1.8 가중치)와 같은 결이라 숲으로 잡음. 우물(-2,5)·
            // 상자(-2,-5)·성소(-8,-4)·잡졸·두목과 안 겹치는 NW 빈 구석.
            SetPrivateField(builder, "biome", SagaBiome.Forest);
            SetPrivateField(builder, "decorOffset", new Vector3(-8f, 0f, 5f));
            SetPrivateField(builder, "gateModel", _gateGlb); // "환경/건물 GLB"
            SetPrivateField(builder, "roomModel", _roomGlb); // "방 셸 GLB"
            AssignEnvironmentMaterials(builder);
            builder.Build();
            builder.OpenNorthDoor(RoomDoorWidth); // "오픈월드/필드" 슬라이스 — 복도로 Room2와 잇는다.
            builder.OpenSouthDoor(RoomDoorWidth); // "오픈월드 확장 — 마을 여러 개" — 들길로 Town2와 잇는다.
            builder.OpenWestDoor(RoomDoorWidth); // "마을 여러 개 — 셋째" — 들길로 Town3와 잇는다.
            builder.OpenEastDoor(RoomDoorWidth); // "마을 여러 개 — 넷째" — 들길로 Town4와 잇는다.
            return go;
        }

        /// <summary>"오픈월드 확장 — 마을 여러 개" 슬라이스 — Room(방1)의
        /// 남쪽 문에서 들길(복도 재사용)을 지나 Town2(첫 위성 마을)로
        /// 이어진다. 전투 없음 — 원작 "필드"와 달리 이번 첫 슬라이스는
        /// 필드 조우도 범위 밖(다음 슬라이스 후보). 좌표 산출은 위
        /// `TownCorridorCenter`/`Town2Center` 주석 참고.</summary>
        private static void BuildCorridorAndTown2()
        {
            var townCorridorGo = new GameObject("TownCorridor");
            townCorridorGo.transform.position = TownCorridorCenter;
            var townCorridorBuilder = townCorridorGo.AddComponent<DungeonCorridorBuilder>();
            // biome=None(기본값) — 이 통로만 일부러 "폐허" 톤(SagaBiome.Ruins,
            // 다른 세 복도)을 안 쓴다. 여기는 무너진 던전 통로가 아니라
            // 마을로 가는 들길이라는 걸 색으로도 가른다.
            SetPrivateField(townCorridorBuilder, "corridorModel", _corridorGlb); // "환경/건물 GLB" 자산 재사용
            AssignEnvironmentMaterials(townCorridorBuilder);
            townCorridorBuilder.Build();

            var town2Go = new GameObject("Town2");
            town2Go.transform.position = Town2Center;
            var town2Builder = town2Go.AddComponent<DungeonRoomBuilder>();
            // biome=None — 다섯 바이옴(숲·늪·산·사당·폐허)은 전부 이 던전
            // "야생" 쪽 정체성이라, 마을(문명)은 일부러 그 다섯에 안 낀다
            // (Colors()의 "예전 색"이 곧 이 방의 고유색이 되는 셈).
            SetPrivateField(town2Builder, "gateModel", _gateGlb); // "환경/건물 GLB"
            SetPrivateField(town2Builder, "roomModel", _roomGlb); // "방 셸 GLB"
            AssignEnvironmentMaterials(town2Builder);
            town2Builder.Build();
            town2Builder.OpenNorthDoor(RoomDoorWidth); // 복도 쪽(Room1 방향).
            town2Builder.OpenWestDoor(RoomDoorWidth); // "위성↔위성 지름길" — Crossroads를 거쳐 Town3와 잇는다.
            town2Builder.OpenEastDoor(RoomDoorWidth); // "위성↔위성 지름길 후속" — Crossroads2를 거쳐 Town4와 잇는다.

            var merchantGo = new GameObject("TownMerchant");
            merchantGo.transform.position = Town2Center + new Vector3(3f, 0f, 0f);
            var merchant = merchantGo.AddComponent<DungeonMerchant>();
            SetPrivateField(merchant, "modelPrefab", _peasantMan); // PLAN.md 106-4
            // roomId="town2" — 이 id로 등록되는 적이 아예 없어 CountAliveInRoom이
            // 항상 0이다(DungeonMerchant.cs Update() 참고) — "방을 다 잡아야
            // 연다"는 조건 자체가 평화로운 마을엔 안 맞아 자연히 항상 열려 있다.
            SetPrivateField(merchant, "roomId", "town2");
            // wp_axe(atk12) — 지금까지 어떤 행상도 안 팔던 재고(Room2=wp_saber18,
            // Room3=gem_sapphire, Room10=wp_glaive26). wp_start(0)보다는 낫지만
            // wp_saber(45냥)보다 낮은 티어라 값도 더 싸게 잡았다 — Town2는 Room1
            // 남쪽 문 바로 너머라 전투 없이도 닿을 수 있어(플레이어가 처음
            // 얼마 안 되는 돈으로도 살 만한 자리가 필요).
            SetPrivateField(merchant, "sellItemId", "wp_axe");
            SetPrivateField(merchant, "price", 20);

            // "마을 장식 보강" — 문(북)·행상(+3,0) 자리와 안 겹치는 좌표.
            BuildTownDecor(Town2Center, new Vector3(-6f, 0f, 5f), new Vector3(-6f, 0f, -5f),
                new Vector3(6f, 0f, -5f), new Vector3(0f, 0f, -7f), VillagerTint);
            // "마을 간 필드 조우" — 들길 한가운데, 지나가면 반드시 마주친다.
            BuildFieldAmbush(TownCorridorCenter, "south");
        }

        /// <summary>"마을 여러 개 — 셋째" 슬라이스 — Room1의 서쪽 문에서
        /// 들길을 지나 Town3로 이어진다. `DungeonCorridorBuilder`는 항상
        /// 로컬 Z를 긴 축으로 짓기 때문에(그 클래스 참고), 이 복도는
        /// GameObject를 Y축 90도 돌려 세우는 것만으로 X축 복도가 된다
        /// (자체 코드 변경 없음 — 대칭 도형이라 회전 방향은 안 따진다).</summary>
        private static void BuildCorridorAndTown3()
        {
            var corridorGo = new GameObject("TownCorridorWest");
            corridorGo.transform.position = TownCorridorWestCenter;
            corridorGo.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
            var corridorBuilder = corridorGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorBuilder);
            corridorBuilder.Build();

            var town3Go = new GameObject("Town3");
            town3Go.transform.position = Town3Center;
            var town3Builder = town3Go.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(town3Builder, "gateModel", _gateGlb);
            SetPrivateField(town3Builder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(town3Builder);
            town3Builder.Build();
            town3Builder.OpenEastDoor(RoomDoorWidth); // 복도 쪽(Room1 방향).
            town3Builder.OpenSouthDoor(RoomDoorWidth); // "위성↔위성 지름길" — Crossroads를 거쳐 Town2와 잇는다.

            var merchantGo = new GameObject("Town3Merchant");
            merchantGo.transform.position = Town3Center + new Vector3(6f, 0f, 0f);
            var merchant = merchantGo.AddComponent<DungeonMerchant>();
            SetPrivateField(merchant, "modelPrefab", _peasantMan); // PLAN.md 106-4
            SetPrivateField(merchant, "roomId", "town3");
            // gem_jade(4) — 광맥(Room3 Vein) 확정 드랍 말고는 지금까지 어떤
            // 행상도 안 팔던 재고. 가장 싼 보석 티어라 위성 마을 초입에 맞다.
            SetPrivateField(merchant, "sellGemId", "gem_jade");
            SetPrivateField(merchant, "price", 15);

            BuildTownDecor(Town3Center, new Vector3(-5f, 0f, 6f), new Vector3(-5f, 0f, -6f),
                new Vector3(2f, 0f, 6f), new Vector3(2f, 0f, -6f), VillagerTint);
            BuildFieldAmbush(TownCorridorWestCenter, "west");
        }

        /// <summary>"마을 여러 개 — 넷째" 슬라이스 — Room1의 동쪽 문에서
        /// 들길을 지나 Town4로 이어진다(Town3와 같은 결, 부호만 반대).</summary>
        private static void BuildCorridorAndTown4()
        {
            var corridorGo = new GameObject("TownCorridorEast");
            corridorGo.transform.position = TownCorridorEastCenter;
            corridorGo.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
            var corridorBuilder = corridorGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorBuilder);
            corridorBuilder.Build();

            var town4Go = new GameObject("Town4");
            town4Go.transform.position = Town4Center;
            var town4Builder = town4Go.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(town4Builder, "gateModel", _gateGlb);
            SetPrivateField(town4Builder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(town4Builder);
            town4Builder.Build();
            town4Builder.OpenWestDoor(RoomDoorWidth); // 복도 쪽(Room1 방향).
            town4Builder.OpenSouthDoor(RoomDoorWidth); // "위성↔위성 지름길 후속" — Crossroads2를 거쳐 Town2와 잇는다. 더는 막다른 마을이 아니다.

            var merchantGo = new GameObject("Town4Merchant");
            merchantGo.transform.position = Town4Center + new Vector3(-6f, 0f, 0f);
            var merchant = merchantGo.AddComponent<DungeonMerchant>();
            SetPrivateField(merchant, "modelPrefab", _peasantMan); // PLAN.md 106-4
            SetPrivateField(merchant, "roomId", "town4");
            // wp_glaive(26) — 원래 Room10(층2 행상) 재고였는데 "절차적 층
            // 진행" 전환으로 Room10 자체가 없어져 이 아이템을 살 자리가
            // 사라졌었다(PROJECT_STATE.md 참고). 그 취지(층1 두목을 못
            // 잡은 플레이어도 중간 이상 티어를 살 수 있게)를 넷째 마을에서
            // 되살렸다 — 가격도 그때와 같은 90냥.
            SetPrivateField(merchant, "sellItemId", "wp_glaive");
            SetPrivateField(merchant, "price", 90);

            BuildTownDecor(Town4Center, new Vector3(5f, 0f, 6f), new Vector3(5f, 0f, -6f),
                new Vector3(-2f, 0f, 6f), new Vector3(-2f, 0f, -6f), VillagerTint);
            BuildFieldAmbush(TownCorridorEastCenter, "east");
        }

        /// <summary>"위성↔위성 지름길" 슬라이스 — Town3 남쪽 문→복도(회전
        /// 없음, N-S)→Crossroads→복도(Y축 90도, E-W)→Town2 서쪽 문.
        /// Crossroads는 새 콘텐츠 없이 순수 경유지(문 둘만, 장식도
        /// 최소한만) — 이 슬라이스의 목적은 "우회로가 뚫린다" 자체를
        /// 증명하는 것이지 세 번째 콘텐츠 마을을 만드는 게 아니다.</summary>
        private static void BuildShortcutCrossroads()
        {
            var corridorNorthGo = new GameObject("ShortcutCorridorNorth");
            corridorNorthGo.transform.position = ShortcutCorridorNorthCenter;
            var corridorNorthBuilder = corridorNorthGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorNorthBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorNorthBuilder);
            corridorNorthBuilder.Build();

            var crossroadsGo = new GameObject("Crossroads");
            crossroadsGo.transform.position = CrossroadsCenter;
            var crossroadsBuilder = crossroadsGo.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(crossroadsBuilder, "gateModel", _gateGlb);
            SetPrivateField(crossroadsBuilder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(crossroadsBuilder);
            crossroadsBuilder.Build();
            crossroadsBuilder.OpenNorthDoor(RoomDoorWidth); // Town3 방향.
            crossroadsBuilder.OpenEastDoor(RoomDoorWidth); // Town2 방향.

            var corridorEastGo = new GameObject("ShortcutCorridorEast");
            corridorEastGo.transform.position = ShortcutCorridorEastCenter;
            corridorEastGo.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
            var corridorEastBuilder = corridorEastGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorEastBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorEastBuilder);
            corridorEastBuilder.Build();

            // 순수 경유지 표시 — 마을(황금빛)도 야생 바이옴도 아닌 중립
            // 이정표 색 하나만 세운다(BuildTownLantern 재사용, 촌민·궤짝
            // 없이 등불 하나로 "여기가 갈림길"이라는 것만 표시).
            BuildTownLantern(CrossroadsCenter);
        }

        /// <summary>"위성↔위성 지름길 후속: Town2↔Town4" 슬라이스 —
        /// 위 BuildShortcutCrossroads()와 완전히 같은 결(경유지 하나 +
        /// 복도 둘), Crossroads2가 새 축(30,-30)에 설 뿐 새 패턴은
        /// 없다. Town2 동쪽 문→복도(Y축 90도, E-W)→Crossroads2 서쪽 문,
        /// Crossroads2 북쪽 문→복도(회전 없음, N-S)→Town4 남쪽 문.</summary>
        private static void BuildShortcutCrossroads2()
        {
            var corridorWestGo = new GameObject("ShortcutCorridorWest2");
            corridorWestGo.transform.position = ShortcutCorridorWest2Center;
            corridorWestGo.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
            var corridorWestBuilder = corridorWestGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorWestBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorWestBuilder);
            corridorWestBuilder.Build();

            var crossroads2Go = new GameObject("Crossroads2");
            crossroads2Go.transform.position = Crossroads2Center;
            var crossroads2Builder = crossroads2Go.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(crossroads2Builder, "gateModel", _gateGlb);
            SetPrivateField(crossroads2Builder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(crossroads2Builder);
            crossroads2Builder.Build();
            crossroads2Builder.OpenWestDoor(RoomDoorWidth); // Town2 방향.
            crossroads2Builder.OpenNorthDoor(RoomDoorWidth); // Town4 방향.

            var corridorNorthGo = new GameObject("ShortcutCorridorNorth2");
            corridorNorthGo.transform.position = ShortcutCorridorNorth2Center;
            var corridorNorthBuilder = corridorNorthGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorNorthBuilder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridorNorthBuilder);
            corridorNorthBuilder.Build();

            BuildTownLantern(Crossroads2Center);
        }

        /// <summary>"마을 장식 보강" 슬라이스 — 방 셸+행상 하나뿐이라 휑해
        /// 보이던 마을 셋(Town2·Town3·Town4) 전부에 등롱 둘·궤짝 하나·
        /// 정주 촌민 하나를 채운다(전투·상호작용 없음 — 순수 시각). 문·
        /// 행상 자리와 안 겹치는 좌표는 마을마다 호출부가 문 방향에 맞게
        /// 넘긴다.</summary>
        private static void BuildTownDecor(Vector3 center, Vector3 lanternAOffset, Vector3 lanternBOffset,
            Vector3 crateOffset, Vector3 villagerOffset, Color villagerTint)
        {
            BuildTownLantern(center + lanternAOffset);
            BuildTownLantern(center + lanternBOffset);
            BuildCrateStack(center + crateOffset);
            BuildVillager(center + villagerOffset, villagerTint);
        }

        private static void BuildTownLantern(Vector3 pos)
        {
            var baseCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseCube.name = "Decor_TownLanternBase";
            baseCube.transform.position = pos + new Vector3(0f, 0.8f, 0f);
            baseCube.transform.localScale = new Vector3(0.6f, 1.6f, 0.6f);
            baseCube.GetComponent<MeshRenderer>().sharedMaterial = MakeDecorMaterial(new Color(0.32f, 0.28f, 0.22f));
            Object.DestroyImmediate(baseCube.GetComponent<Collider>());

            var top = GameObject.CreatePrimitive(PrimitiveType.Cube);
            top.name = "Decor_TownLanternTop";
            top.transform.position = pos + new Vector3(0f, 1.75f, 0f);
            top.transform.localScale = new Vector3(0.9f, 0.3f, 0.9f);
            top.GetComponent<MeshRenderer>().sharedMaterial = MakeDecorMaterial(new Color(0.55f, 0.15f, 0.1f));
            Object.DestroyImmediate(top.GetComponent<Collider>());

            var lightGo = new GameObject("Decor_TownLanternLight");
            lightGo.transform.position = pos + new Vector3(0f, 1.9f, 0f);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.75f, 0.45f);
            light.range = 6f;
            light.intensity = 1.5f;
        }

        private static void BuildCrateStack(Vector3 pos)
        {
            var bottom = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bottom.name = "Decor_Crate";
            bottom.transform.position = pos + new Vector3(0f, 0.4f, 0f);
            bottom.transform.localScale = new Vector3(0.9f, 0.8f, 0.9f);
            bottom.GetComponent<MeshRenderer>().sharedMaterial = MakeDecorMaterial(new Color(0.38f, 0.28f, 0.16f));
            Object.DestroyImmediate(bottom.GetComponent<Collider>());

            var top = GameObject.CreatePrimitive(PrimitiveType.Cube);
            top.name = "Decor_Crate";
            top.transform.position = pos + new Vector3(0.15f, 1.05f, 0.1f);
            top.transform.localScale = new Vector3(0.6f, 0.6f, 0.6f);
            top.transform.rotation = Quaternion.Euler(0f, 20f, 0f);
            top.GetComponent<MeshRenderer>().sharedMaterial = MakeDecorMaterial(new Color(0.42f, 0.31f, 0.18f));
            Object.DestroyImmediate(top.GetComponent<Collider>());
        }

        /// <summary>마을이 사람 사는 곳처럼 보이게 세워 두는 정지 촌민
        /// (전투·대화 없음 — 순수 시각, AllyFighter 같은 컴포넌트 없음.
        /// character-b 모델을 Ally와 다른 톤으로 재사용한다).</summary>
        private static void BuildVillager(Vector3 pos, Color tint)
        {
            var go = new GameObject("Villager");
            go.transform.position = pos;
            // PLAN.md 106-4 — 마을 사람은 남녀를 번갈아, 방향도 조금씩 다르게.
            var real = (_villagerCount++ % 2 == 0) ? _peasantMan : _peasantGirl;
            if (NpcIdle.SpawnRigged(real, go.transform, "Idle", yawDeg: 40f * _villagerCount) != null) return;
            if (_characterB != null) CharacterVisual.Spawn(_characterB, go.transform, 1.7f, tint);
            else CharacterVisual.SpawnFallbackCapsule(go.transform, 1.7f, tint);
        }

        private static Material MakeDecorMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "TownDecor (generated)" };
            mat.color = color;
            return mat;
        }

        /// <summary>"마을 간 필드 조우" 슬라이스 — 원작(28-1절) 필드엔
        /// 로밍 몬스터가 있었는데 첫 마을 슬라이스(Room1↔Town2)는 들길을
        /// 전투 없는 통로로 단순화해 뒀다. 새 시스템 없이 기존
        /// `DungeonAmbush.cs`(랜덤 이벤트 슬라이스, 25초 쿨다운 룰렛 —
        /// 55% 고요·30% 매복·15% 돈주머니)를 들길 한가운데 그대로
        /// 재사용한다 — roomId는 어떤 방·행상도 안 보는 값이라 마을
        /// 클리어·구매 조건에 영향이 없다.</summary>
        private static void BuildFieldAmbush(Vector3 pos, string fieldId)
        {
            var go = new GameObject("Ambush_" + fieldId);
            go.transform.position = pos;
            var ambush = go.AddComponent<DungeonAmbush>();
            SetPrivateField(ambush, "roomId", "field_" + fieldId);
            SetPrivateField(ambush, "enemyModelPrefab", _characterD);
        }

        /// <summary>"오픈월드/필드" 슬라이스 — Room(방1)의 북쪽 문에서
        /// 복도를 지나 Room2(잡졸 둘)로 이어진다. 자세한 좌표 산출은 위
        /// `CorridorCenter`/`Room2Center` 주석 참고.</summary>
        private static void BuildCorridorAndRoom2()
        {
            var corridorGo = new GameObject("Corridor");
            corridorGo.transform.position = CorridorCenter;
            var corridorBuilder = corridorGo.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridorBuilder, "biome", SagaBiome.Ruins); // "바이옴 5종" — 복도 셋은 전부 폐허
            SetPrivateField(corridorBuilder, "corridorModel", _corridorGlb); // "환경/건물 GLB"
            AssignEnvironmentMaterials(corridorBuilder);
            corridorBuilder.Build();

            var room2Go = new GameObject("Room2");
            room2Go.transform.position = Room2Center;
            var room2Builder = room2Go.AddComponent<DungeonRoomBuilder>();
            // "바이옴 5종" — 오픈월드/필드 방은 늪으로 잡음(필드 잡졸(0,2)·
            // (-4,-2)·행상(3,-3)과 안 겹치는 NE 빈 구석).
            SetPrivateField(room2Builder, "biome", SagaBiome.Swamp);
            SetPrivateField(room2Builder, "decorOffset", new Vector3(7f, 0f, 5f));
            SetPrivateField(room2Builder, "gateModel", _gateGlb); // "환경/건물 GLB"
            SetPrivateField(room2Builder, "roomModel", _roomGlb); // "방 셸 GLB"
            AssignEnvironmentMaterials(room2Builder);
            room2Builder.Build();
            room2Builder.OpenSouthDoor(RoomDoorWidth);
            room2Builder.OpenNorthDoor(RoomDoorWidth); // "방 종류 마지막" — 복도2로 Room3와 잇는다.
            room2Builder.OpenWestDoor(RoomDoorWidth); // PLAN.md 106-2 — "잊힌 능묘" 입구 복도.
            room2Builder.OpenEastDoor(RoomDoorWidth); // PLAN.md 106-5 — "옛 감시탑 뜰" 복도.

            for (int i = 0; i < FieldEnemySpawns.Length; i++)
            {
                var go = new GameObject($"Enemy_HwangGeon_Field_{i + 1}");
                go.transform.position = FieldEnemySpawns[i];
                var enemy = go.AddComponent<DungeonEnemy>();
                SetPrivateField(enemy, "roomId", "room2"); // "방 종류 나머지" — Room2 행상이 이 방만 보고 클리어를 판정.
                SetPrivateField(enemy, "modelPrefab", _characterD);
            }

            BuildMerchant();
            BuildAmbush();
        }

        /// <summary>"랜덤 이벤트" 슬라이스 — 필드 사건 자리(DungeonAmbush.cs).
        /// 기존 콘텐츠(필드 잡졸(0,2)·(-4,-2), 행상(3,-3), 늪 소품(7,5))와
        /// 안 겹치는 NW 빈 구석.</summary>
        private static void BuildAmbush()
        {
            var go = new GameObject("Ambush");
            go.transform.position = Room2Center + new Vector3(-6f, 0f, 6f);
            var ambush = go.AddComponent<DungeonAmbush>();
            SetPrivateField(ambush, "roomId", "room2");
            SetPrivateField(ambush, "enemyModelPrefab", _characterD);
        }

        /// <summary>"방 종류 나머지" 슬라이스 — Room2 잡졸 둘을 다 잡아야
        /// 여는 행상 좌판. 웹판 room.merchant를 GO ShopState.cs 방식으로
        /// 단순화(DungeonMerchant.cs 참고).</summary>
        private static void BuildMerchant()
        {
            var merchantGo = new GameObject("Merchant");
            merchantGo.transform.position = Room2Center + new Vector3(3f, 0f, -3f);
            var merchant = merchantGo.AddComponent<DungeonMerchant>();
            SetPrivateField(merchant, "modelPrefab", _peasantMan); // PLAN.md 106-4
            SetPrivateField(merchant, "roomId", "room2");
        }

        /// <summary>"방 종류 마지막" 슬라이스 — Room2 북쪽에서 복도2를 지나
        /// Room3(정예 소굴+미니보스+채광방)로 이어진다.</summary>
        private static void BuildCorridorAndRoom3()
        {
            var corridor2Go = new GameObject("Corridor2");
            corridor2Go.transform.position = Corridor2Center;
            var corridor2Builder = corridor2Go.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridor2Builder, "biome", SagaBiome.Ruins);
            SetPrivateField(corridor2Builder, "corridorModel", _corridorGlb); // "환경/건물 GLB"
            AssignEnvironmentMaterials(corridor2Builder);
            corridor2Builder.Build();

            var room3Go = new GameObject("Room3");
            room3Go.transform.position = Room3Center;
            var room3Builder = room3Go.AddComponent<DungeonRoomBuilder>();
            // "바이옴 5종" — 정예·미니보스·채광방(광산)이 있는 방은 산으로
            // 잡음. 정예(6,0)·호위(5,±2.5)·미니보스(9,0)·광맥(-6,-4)·
            // 신규 행상(-8,4)과 안 겹치는 남쪽 빈 자리(문 폭 밖 x=3).
            SetPrivateField(room3Builder, "biome", SagaBiome.Mountain);
            SetPrivateField(room3Builder, "decorOffset", new Vector3(3f, 0f, -6f));
            SetPrivateField(room3Builder, "gateModel", _gateGlb); // "환경/건물 GLB"
            SetPrivateField(room3Builder, "roomModel", _roomGlb); // "방 셸 GLB"
            AssignEnvironmentMaterials(room3Builder);
            room3Builder.Build();
            room3Builder.OpenSouthDoor(RoomDoorWidth);
            room3Builder.OpenNorthDoor(RoomDoorWidth); // 복도3으로 Room4와 잇는다.

            BuildElite();
            BuildMiniboss();

            var veinGo = new GameObject("Vein");
            veinGo.transform.position = VeinSpawn;
            var vein = veinGo.AddComponent<DungeonVein>();
            SetPrivateField(vein, "roomId", "room3");

            BuildGemMerchant();
        }

        /// <summary>"세공·행상 재고 굴리기·도감" 슬라이스 — Room2 행상(무기)과
        /// 재고를 다르게 배정한 두 번째 행상. 정예·미니보스·채광방과 안
        /// 겹치는 서쪽 빈 자리(EliteSpawn·MinibossSpawn은 동쪽 +X,
        /// VeinSpawn은 -6,-4)에 둔다.</summary>
        private static void BuildGemMerchant()
        {
            var merchantGo = new GameObject("GemMerchant");
            merchantGo.transform.position = Room3Center + new Vector3(-8f, 0f, 4f);
            var merchant = merchantGo.AddComponent<DungeonMerchant>();
            SetPrivateField(merchant, "modelPrefab", _peasantMan); // PLAN.md 106-4
            SetPrivateField(merchant, "roomId", "room3");
            SetPrivateField(merchant, "sellGemId", "gem_sapphire");
            SetPrivateField(merchant, "price", 50); // wp_saber(45)보다 비싸게 — 무기를 대체하지 않고 그 위에 더해지는 능력치라서
        }

        /// <summary>정예 소굴(js/dungeon.js:342-347) — 정예 하나(ELITES
        /// 'fierce' 배율 hp×1.35·dmg×1.9 고정 적용) + 잡졸 둘.</summary>
        private static void BuildElite()
        {
            var eliteGo = new GameObject("Enemy_HwangGeon_Elite");
            eliteGo.transform.position = EliteSpawn;
            var elite = eliteGo.AddComponent<DungeonEnemy>();
            SetPrivateField(elite, "roomId", "room3");
            SetPrivateField(elite, "hp", 32f);   // round(24 * 1.35)
            SetPrivateField(elite, "dmg", 10f);  // round(5 * 1.9)
            SetPrivateField(elite, "rewardExp", 30);
            SetPrivateField(elite, "rewardGold", 16);
            SetPrivateField(elite, "rewardItemId", "wp_saber");
            SetPrivateField(elite, "displayName", "사나운 황건적");
            SetPrivateField(elite, "bodyColor", new Color(0.88f, 0.4f, 0.4f)); // ELITES 'fierce' 색(#e06565)
            SetPrivateField(elite, "visualScale", 1.15f);
            SetPrivateField(elite, "modelPrefab", _characterD);

            for (int i = 0; i < EliteEscortSpawns.Length; i++)
            {
                var go = new GameObject($"Enemy_HwangGeon_EliteEscort_{i + 1}");
                go.transform.position = EliteEscortSpawns[i];
                var escort = go.AddComponent<DungeonEnemy>();
                SetPrivateField(escort, "roomId", "room3");
                SetPrivateField(escort, "modelPrefab", _characterD);
            }
        }

        /// <summary>미니보스(js/dungeon.js:348-352) — 부하 없이 혼자,
        /// 두목과 같은 노획 흐름(`isBoss=true`)을 재사용하되 덩치·색으로만
        /// 구분(두목=3.2m 짙은 적갈, 미니보스=2.6m 자보라).</summary>
        private static void BuildMiniboss()
        {
            var go = new GameObject("Enemy_HwangGeon_Miniboss");
            go.transform.position = MinibossSpawn;
            var miniboss = go.AddComponent<DungeonEnemy>();
            SetPrivateField(miniboss, "roomId", "room3");
            SetPrivateField(miniboss, "hp", 168f);
            SetPrivateField(miniboss, "dmg", 11f);
            SetPrivateField(miniboss, "rewardExp", 100);
            SetPrivateField(miniboss, "rewardGold", 40);
            SetPrivateField(miniboss, "rewardItemId", "wp_glaive");
            SetPrivateField(miniboss, "rewardGemId", "gem_ruby"); // "세공·행상 재고 굴리기·도감" 슬라이스 — GemData.cs 참고
            SetPrivateField(miniboss, "isBoss", true);
            SetPrivateField(miniboss, "displayName", "황건 살수");
            // 사람이 실기로 "두목보다 안 세 보인다"고 제보(2026-09-12) — 웹판
            // spawnEnemy(floor, true) 공식이 두목과 완전히 같은 HP/공격력이라
            // 수치는 그대로 두되(웹판 기준 원래 동급), 진행상 더 나중(Room3)에
            // 만나는 개체가 더 작고 색도 옅어 약해 보였다. 두목(1.6배·3.2m)보다
            // **더 크게(1.8배·3.6m)**·색도 짙고 채도 높은 자보라로 올려 "더
            // 깊이 들어갈수록 더 위협적"으로 읽히게 했다.
            // PLAN.md 106-4 두목 전용 몸(2026-09-24) — 살수 = Ninja, 옛 몸(Brute 1.8배)과 같은 키·제 빛깔. 없는 PC 는 예전 그대로.
            bool ninja = _ninja != null;
            SetPrivateField(miniboss, "bodyColor", ninja ? Color.white : new Color(0.24f, 0.04f, 0.4f));
            SetPrivateField(miniboss, "visualScale", 1.8f * (ninja ? ScaleMulTo(_characterC, _ninja) : 1f));
            SetPrivateField(miniboss, "modelPrefab", ninja ? _ninja : _characterC);
        }

        /// <summary>"방 종류 마지막" 슬라이스 — Room3 북쪽에서 복도3을 지나
        /// Room4(구출+퍼즐+채집)로 이어진다(막다른 방 — 더 북쪽은 없다).</summary>
        private static void BuildCorridorAndRoom4()
        {
            var corridor3Go = new GameObject("Corridor3");
            corridor3Go.transform.position = Corridor3Center;
            var corridor3Builder = corridor3Go.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridor3Builder, "biome", SagaBiome.Ruins);
            SetPrivateField(corridor3Builder, "corridorModel", _corridorGlb); // "환경/건물 GLB"
            AssignEnvironmentMaterials(corridor3Builder);
            corridor3Builder.Build();

            var room4Go = new GameObject("Room4");
            room4Go.transform.position = Room4Center;
            var room4Builder = room4Go.AddComponent<DungeonRoomBuilder>();
            // "바이옴 5종" — 퍼즐 제단·구출을 품은 막다른 방은 사당으로
            // 잡음(제단 셋 = 사당 콘셉트와 그대로 맞음). 구출(6,0)·호위
            // (5,±2.5)·퍼즐(-5,0)·채집(-2,2)과 안 겹치는 SW 빈 자리.
            SetPrivateField(room4Builder, "biome", SagaBiome.Shrine);
            SetPrivateField(room4Builder, "decorOffset", new Vector3(-8f, 0f, -5f));
            SetPrivateField(room4Builder, "gateModel", _gateGlb); // "환경/건물 GLB"
            SetPrivateField(room4Builder, "roomModel", _roomGlb); // "방 셸 GLB"
            AssignEnvironmentMaterials(room4Builder);
            room4Builder.Build();
            room4Builder.OpenSouthDoor(RoomDoorWidth);
            room4Builder.OpenNorthDoor(RoomDoorWidth); // "오픈월드 확장" — 복도4로 ProcRoom(절차적 층 진행)과 잇는다. Room4는 더는 막다른 방이 아니다.

            BuildCaptive();

            var puzzleGo = new GameObject("Puzzle");
            puzzleGo.transform.position = PuzzleAnchor;
            puzzleGo.AddComponent<DungeonPuzzle>();

            var forageGo = new GameObject("Forage");
            forageGo.transform.position = ForageAnchor;
            var forage = forageGo.AddComponent<DungeonForage>();
            SetPrivateField(forage, "roomId", "room4");

            var secretGo = new GameObject("SecretStash");
            secretGo.transform.position = SecretStashSpawn;
            secretGo.AddComponent<DungeonSecretStash>();
        }

        /// <summary>"오픈월드 확장 — 절차적 층 진행 전환" 슬라이스 — Room4
        /// 북쪽에서 복도4를 지나 단 하나의 재사용 방(ProcRoom)으로 이어진다.
        /// `DungeonFloorRunner`(World/DungeonFloorRunner.cs)가 이 방 하나를
        /// 층2부터 100층까지 계속 갈아치운다 — Room5~11이 하던 일을 이제
        /// 이 컴포넌트 하나가 런타임에 대신한다.</summary>
        private static void BuildCorridorAndProcRoom()
        {
            var corridor4Go = new GameObject("Corridor4");
            corridor4Go.transform.position = Corridor4Center;
            var corridor4Builder = corridor4Go.AddComponent<DungeonCorridorBuilder>();
            SetPrivateField(corridor4Builder, "biome", SagaBiome.Ruins);
            SetPrivateField(corridor4Builder, "corridorModel", _corridorGlb);
            AssignEnvironmentMaterials(corridor4Builder);
            corridor4Builder.Build();

            var procRoomGo = new GameObject("ProcRoom");
            procRoomGo.transform.position = ProcRoomCenter;
            var procRoomBuilder = procRoomGo.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(procRoomBuilder, "biome", SagaBiome.Ruins);
            SetPrivateField(procRoomBuilder, "decorOffset", new Vector3(-8f, 0f, 5f));
            SetPrivateField(procRoomBuilder, "gateModel", _gateGlb);
            SetPrivateField(procRoomBuilder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(procRoomBuilder);
            procRoomBuilder.Build();
            procRoomBuilder.OpenSouthDoor(RoomDoorWidth); // 북쪽 문은 없다 — 방이 하나뿐이라 물리적으로 더 이을 필요가 없다.

            var runner = procRoomGo.AddComponent<DungeonFloorRunner>();
            SetPrivateField(runner, "gruntModel", _characterD);
            SetPrivateField(runner, "merchantModel", _peasantMan); // PLAN.md 106-4
            SetPrivateField(runner, "captiveModel", _peasantGirl);
            SetPrivateField(runner, "eliteModel", _characterC);
            // PLAN.md 106-4 두목 전용 몸(2026-09-24) — 살수 Ninja · 층 주인 Demon · 기계화 정찰병 Alien Soldier.
            // 배율 = 옛 몸 키 / 새 몸 키(주인·살수는 Brute, 정찰병은 잡졸 Abe) — 층 공식의 배율(1.8·2.1·1.25)은 그대로 곱한다.
            SetPrivateField(runner, "minibossModel", _ninja);
            SetPrivateField(runner, "minibossScaleMul", ScaleMulTo(_characterC, _ninja));
            SetPrivateField(runner, "lordModel", _demon);
            SetPrivateField(runner, "lordScaleMul", ScaleMulTo(_characterC, _demon));
            SetPrivateField(runner, "fusionEliteModel", _alienSoldier);
            SetPrivateField(runner, "fusionEliteScaleMul", ScaleMulTo(_characterD, _alienSoldier));
            // PLAN.md 109-2 세 시대 — 전투 방 잡졸의 현대·미래 몸 여덟(키는 잡졸 몸에 맞춘다)·행상 몸 둘. 없는 PC 는 null → 옛 몸.
            var eraNames = Saga.Dungeon.Data.DungeonEras.FoeBodies();
            var eraModels = new GameObject[eraNames.Length];
            var eraMuls = new float[eraNames.Length];
            for (int i = 0; i < eraNames.Length; i++)
            {
                eraModels[i] = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(eraNames[i]));
                eraMuls[i] = ScaleMulTo(_characterD, eraModels[i]);
                if (eraModels[i] == null) Debug.LogWarning($"[BuildTestDungeonScene] 시대 잡졸 몸 {eraNames[i]} 없음 — 잡졸 몸으로 폴백");
            }
            SetPrivateField(runner, "eraFoeNames", eraNames);
            SetPrivateField(runner, "eraFoeModels", eraModels);
            SetPrivateField(runner, "eraFoeScaleMuls", eraMuls);
            SetPrivateField(runner, "modernPeddlerModel", AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(Saga.Dungeon.Data.DungeonEras.ModernPeddlerBody)));
            SetPrivateField(runner, "futurePeddlerModel", AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(Saga.Dungeon.Data.DungeonEras.FuturePeddlerBody)));
            // PLAN.md 109-10-5 지역 우두머리 아홉·신화 호위 — 다른 판 몸을 빌린다(키는 `RegionBossRunner` 가 Play 때 재서 맞춘다). 없는 PC 는 null → 옛 몸.
            var regionNames = Saga.Dungeon.Data.DungeonRegionFoes.BorrowedBodies();
            var regionModels = new GameObject[regionNames.Length];
            for (int i = 0; i < regionNames.Length; i++)
            {
                regionModels[i] = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(regionNames[i]));
                if (regionModels[i] == null) Debug.LogWarning($"[BuildTestDungeonScene] 지역 우두머리 몸 {regionNames[i]} 없음 — 옛 몸으로 폴백");
            }
            SetPrivateField(runner, "regionBodyNames", regionNames);
            SetPrivateField(runner, "regionBodyModels", regionModels);

            // PLAN.md 109-2b — 명소 층 꾸밈 여섯 벌(시대 층). 꺼 둔 채 굽고, 층 진행기가 그 층일 때만 켠다.
            var landmarkDecorGo = new GameObject("LandmarkEraDecor");
            landmarkDecorGo.transform.SetParent(procRoomGo.transform, false);
            var landmarkDecor = landmarkDecorGo.AddComponent<EraDecorBuilder>();
            InitEraDecor(landmarkDecor);
            landmarkDecor.BuildLandmarks();
        }

        /// <summary>PLAN.md 109-2b — `DungeonEraDecor.Towns` 순서의 방 가운데.</summary>
        internal static readonly Vector3[] EraDecorTownCenters = { Town2Center, Town3Center, Town4Center, CrossroadsCenter, Crossroads2Center };

        private static void BuildTownEraDecor()
        {
            var go = new GameObject("TownEraDecor");
            var builder = go.AddComponent<EraDecorBuilder>();
            InitEraDecor(builder);
            builder.BuildTowns(EraDecorTownCenters);
        }

        /// <summary>Poly Haven 스캔(GO 108 ① 이 받은 것, `tools/fetch_polyhaven_models.py`)을 불러 넣는다. 없는 모델은 경고 뒤 그 조각만 빠진다.</summary>
        private static void InitEraDecor(EraDecorBuilder builder)
        {
            var ids = DungeonEraDecor.ModelIds;
            var models = new GameObject[ids.Length];
            for (int i = 0; i < ids.Length; i++)
            {
                models[i] = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Art/Props/PolyHaven/{ids[i]}/{ids[i]}_1k.gltf");
                if (models[i] == null) Debug.LogWarning($"[BuildTestDungeonScene] 시대 꾸밈 모델 {ids[i]} 없음");
            }
            builder.Init(ids, models);
        }

        /// <summary>PLAN.md 109-2 — 마을 셋·갈림길의 시대 손님 자리(`DungeonEras.FolkList` 순). 문·행상·등롱·궤짝·촌민과 안 겹친다.</summary>
        internal static readonly Vector3[] EraFolkSpots =
        {
            Town2Center + new Vector3(5f, 0f, 5f),
            Town3Center + new Vector3(-5f, 0f, 0f),
            Town4Center + new Vector3(5f, 0f, 0f),
            CrossroadsCenter + new Vector3(3f, 0f, 3f),
        };

        private static void BuildEraFolk()
        {
            var list = Saga.Dungeon.Data.DungeonEras.FolkList;
            for (int i = 0; i < list.Length && i < EraFolkSpots.Length; i++)
            {
                var go = new GameObject("EraFolk_" + list[i].Id);
                go.transform.position = EraFolkSpots[i];
                // 방 가운데 쪽을 본다(Mixamo 는 +z 를 본다).
                Vector3 toCenter = -new Vector3(EraFolkSpots[i].x - Mathf.Round(EraFolkSpots[i].x / 30f) * 30f, 0f, EraFolkSpots[i].z - Mathf.Round(EraFolkSpots[i].z / 30f) * 30f);
                if (toCenter.sqrMagnitude > 0.01f) go.transform.rotation = Quaternion.LookRotation(toCenter);
                var folk = go.AddComponent<EraFolk>();
                folk.Init(i, AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(list[i].Body)));
                folk.BuildVisual();
            }
        }

        /// <summary>새 몸을 옛 몸 키에 맞추는 배율(둘 다 리깅 모델이어야 실제 키로 잰다 — 아니면 1).</summary>
        internal static float ScaleMulTo(GameObject oldBody, GameObject newBody)
        {
            if (oldBody == null || newBody == null || oldBody.GetComponent<Animator>() == null) return 1f;
            float h = BuildDungeonTemple.MeasureHeight(newBody);
            return h > 0.5f ? BuildDungeonTemple.MeasureHeight(oldBody) / h : 1f;
        }

        /// <summary>이벤트방(구출, js/dungeon.js:383-393) — 지키는 잡졸
        /// 둘을 다 잡아야 풀려난다.</summary>
        private static void BuildCaptive()
        {
            var captiveGo = new GameObject("Captive");
            captiveGo.transform.position = CaptiveSpawn;
            var captive = captiveGo.AddComponent<DungeonCaptive>();
            SetPrivateField(captive, "modelPrefab", _peasantGirl); // PLAN.md 106-4
            SetPrivateField(captive, "roomId", "room4");

            for (int i = 0; i < CaptiveGuardSpawns.Length; i++)
            {
                var go = new GameObject($"Enemy_HwangGeon_CaptiveGuard_{i + 1}");
                go.transform.position = CaptiveGuardSpawns[i];
                var guard = go.AddComponent<DungeonEnemy>();
                SetPrivateField(guard, "roomId", "room4");
                SetPrivateField(guard, "modelPrefab", _characterD);
            }
        }

        private static void BuildEnemy()
        {
            for (int i = 0; i < EnemySpawns.Length; i++)
            {
                var go = new GameObject($"Enemy_HwangGeon_{i + 1}");
                go.transform.position = EnemySpawns[i];
                var enemy = go.AddComponent<DungeonEnemy>();
                SetPrivateField(enemy, "modelPrefab", _characterD);
            }

            BuildBoss();
        }

        /// <summary>두목 하나 + 부하 둘 — 잡졸과 같은 `DungeonEnemy`
        /// 컴포넌트를 재사용하되(다음 슬라이스 코멘트 참고, 값이 다른
        /// 인스턴스라 [SerializeField]로 받는다) 두목만 스탯을 덮어쓴다.
        /// 부하 둘은 잡졸 기본값 그대로(웹판 boss room도 부하는 일반
        /// spawnEnemy).</summary>
        private static void BuildBoss()
        {
            var bossGo = new GameObject("Enemy_HwangGeon_Boss");
            bossGo.transform.position = BossSpawn;
            var boss = bossGo.AddComponent<DungeonEnemy>();
            SetPrivateField(boss, "hp", 168f);            // enemyHp(1, boss=true) = round(24*7)
            SetPrivateField(boss, "dmg", 11f);             // enemyDmg(1, boss=true) = round(5*2.2)
            SetPrivateField(boss, "rewardExp", 100);       // 잡졸(20)의 5배 — dungeon.js dropGold의 boss 배율(5) 재사용
            SetPrivateField(boss, "rewardGold", 40);       // 잡졸(8)의 5배, 같은 이유
            SetPrivateField(boss, "rewardItemId", "wp_glaive");
            SetPrivateField(boss, "isBoss", true);
            SetPrivateField(boss, "isWorldBoss", true); // PLAN.md 101-2 5.4 "월드 보스" — 이 고정 배치 두목도 75초 두목전.
            SetPrivateField(boss, "displayName", "황건적 두목");
            SetPrivateField(boss, "bodyColor", new Color(0.45f, 0.08f, 0.08f)); // 짙은 적갈 — 잡졸의 누런 두건과 구분
            SetPrivateField(boss, "visualScale", 1.6f);
            SetPrivateField(boss, "modelPrefab", _characterC); // 잡졸(character-d)과 실루엣도 구분

            for (int i = 0; i < BossEscortSpawns.Length; i++)
            {
                var go = new GameObject($"Enemy_HwangGeon_Escort_{i + 1}");
                go.transform.position = BossEscortSpawns[i];
                var escort = go.AddComponent<DungeonEnemy>();
                SetPrivateField(escort, "modelPrefab", _characterD);
            }
        }

        private static void BuildRoomPois()
        {
            var wellGo = new GameObject("Well");
            wellGo.transform.position = WellSpawn;
            wellGo.AddComponent<DungeonWell>();

            var troveGo = new GameObject("Trove");
            troveGo.transform.position = TroveSpawn;
            troveGo.AddComponent<DungeonTrove>();

            var shrineGo = new GameObject("Shrine");
            shrineGo.transform.position = ShrineSpawn;
            shrineGo.AddComponent<DungeonShrine>();
        }

        private static (GameObject playerGo, PlayerCombat combat, PlayerController controller) BuildPlayer()
        {
            var playerGo = new GameObject("Player");
            playerGo.tag = "Player";
            playerGo.transform.position = PlayerSpawn;

            var controller = playerGo.AddComponent<CharacterController>();
            controller.radius = 0.4f;
            controller.height = 1.8f;
            controller.center = new Vector3(0f, 0.9f, 0f);

            // 44장 "Player" 교체 — Maria(리깅+Animator)를 먼저 시도, 로컬에
            // CharactersRealistic/이 없으면(라이선스로 미커밋) character-a로,
            // 그마저 없으면 primitive capsule로 순서대로 폴백.
            Animator playerAnimator;
            Transform visual = BuildPlayerVisual(playerGo.transform, out playerAnimator);
            var visualGo = visual.gameObject;

            var rigGo = new GameObject("CameraRig");
            rigGo.transform.SetParent(playerGo.transform, false);
            rigGo.transform.localPosition = new Vector3(0f, 0.9f, 0f);
            var cameraRig = rigGo.AddComponent<CameraRig>();

            // PLAN.md 106-3 — CameraRig 는 이 플레이 가상 카메라를 움직이고, 실제 카메라는
            // CinemachineBrain 이 여기(또는 Timeline 컷 카메라)에 붙인다.
            var viewGo = new GameObject("PlayerView");
            viewGo.transform.SetParent(rigGo.transform, false);
            viewGo.transform.localPosition = new Vector3(0f, 0f, -6f);
            var playerView = viewGo.AddComponent<Unity.Cinemachine.CinemachineCamera>();
            playerView.Priority = 10;
            SetPrivateField(cameraRig, "view", viewGo.transform);

            var camGo = new GameObject("PlayerCamera");
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.03f, 0.03f, 0.04f);
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                .renderPostProcessing = true;
            playerView.Lens = Unity.Cinemachine.LensSettings.FromCamera(cam);
            var brain = camGo.AddComponent<Unity.Cinemachine.CinemachineBrain>();
            brain.DefaultBlend = new Unity.Cinemachine.CinemachineBlendDefinition(
                Unity.Cinemachine.CinemachineBlendDefinition.Styles.EaseInOut, 0.6f);

            var inputActions = AssetDatabase.LoadAssetAtPath<UnityEngine.InputSystem.InputActionAsset>(InputActionsPath);
            if (inputActions == null)
            {
                Debug.LogWarning($"[BuildTestDungeonScene] {InputActionsPath} 를 못 찾음 — Move/Sprint 입력이 안 먹는다.");
            }

            var pc = playerGo.AddComponent<PlayerController>();
            SetPrivateField(pc, "visual", visualGo.transform);
            SetPrivateField(pc, "animator", playerAnimator);
            SetPrivateField(pc, "cameraRig", cameraRig);
            SetPrivateField(pc, "inputActions", inputActions);
            var lockOn = playerGo.AddComponent<PlayerLockOn>(); // PLAN.md 106-1 "락온".
            SetPrivateField(pc, "lockOn", lockOn);
            playerGo.AddComponent<PlayerBombs>(); // PLAN.md 106-2 "벽력탄".
            var party = playerGo.AddComponent<PartyCommands>(); // PLAN.md 106-6 "FF 확장" — 명령 1·2, 소환 V.
            SetPrivateField(party, "summonPrefab", _characterC); // 바위 거신 = 두목 모델 3.2배.
            // 106-6 남은 것 "소환수 전용 모델" — 두목 뼈대에 붙일 CC0 바위 둘 + 돌 재질.
            SetPrivateField(party, "summonRockLarge", AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Rocks/rock_largeA.glb"));
            SetPrivateField(party, "summonRockSmall", AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Rocks/rock_smallA.glb"));
            SetPrivateField(party, "summonStone", RockStoneMaterial.LoadOrCreate());

            var combat = playerGo.AddComponent<PlayerCombat>();
            playerGo.AddComponent<WeaponVisual>(); // PLAN.md 101-3 G "장비 가시화".
            playerGo.AddComponent<BlobShadow>(); // PLAN.md 102-2 "Shadows" — Mobile만 켜진다.

            return (playerGo, combat, pc);
        }

        /// <summary>Maria(Humanoid, Animator 포함) → 실패 시 character-a →
        /// 실패 시 primitive capsule 순으로 폴백. Maria를 쓸 때만
        /// `animator`가 채워진다(PlayerController가 이 값의 null 여부로
        /// "리깅된 캐릭터인가"를 판단해 절차적 구르기 폴백과 갈린다).</summary>
        private static Transform BuildPlayerVisual(Transform parent, out Animator animator)
        {
            animator = null;

            var mariaBody = AssetDatabase.LoadAssetAtPath<GameObject>(MariaBodyFbxPath);
            if (mariaBody != null)
            {
                var maria = (GameObject)PrefabUtility.InstantiatePrefab(mariaBody, parent);
                maria.name = "Visual";
                maria.transform.localPosition = Vector3.zero;
                maria.transform.localRotation = Quaternion.identity;

                animator = maria.GetComponent<Animator>();
                if (animator == null)
                {
                    animator = maria.AddComponent<Animator>();
                }
                var controller = AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>(MariaControllerPath);
                if (controller == null)
                {
                    Debug.LogWarning($"[BuildTestDungeonScene] {MariaControllerPath} 를 못 찾음 — Maria 시각화는 되지만 애니메이션이 안 돎. 'Saga/Build Test Character Realistic Scene'을 먼저 한 번 돌릴 것.");
                }
                animator.runtimeAnimatorController = controller;

                BuildTestCharacterRealisticScene.ApplySkinSplit(maria);
                return maria.transform;
            }

            Debug.LogWarning($"[BuildTestDungeonScene] {MariaBodyFbxPath} 를 못 찾음(로컬 전용 자산, mixamo.com에서 받아야 함) — character-a로 폴백.");
            return _characterA != null
                ? CharacterVisual.Spawn(_characterA, parent, 1.8f, Color.white)
                : CharacterVisual.SpawnFallbackCapsule(parent, 1.8f, Color.white);
        }

        /// <summary>"부대(다중 영웅) 시스템" 슬라이스 — 등용 없이 처음부터
        /// 함께 있는 동행 하나(`AllyFighter.cs` 참고). 플레이어 스폰
        /// 바로 옆에 둔다.</summary>
        private static void BuildAlly()
        {
            var go = new GameObject("Ally");
            go.transform.position = PlayerSpawn + new Vector3(1.5f, 0f, 0f);
            var ally = go.AddComponent<AllyFighter>();
            SetPrivateField(ally, "modelPrefab", _paladin != null ? _paladin : _characterB); // PLAN.md 106-4 — 검방 든 기사.

            // PLAN.md 106-6 — 뒷줄 술사. Peasant Girl 엔 걷기 클립이 없어 Maria.controller 를 씌운다(GO 107-6 리타깃).
            var mysticGo = new GameObject("AllyMystic");
            mysticGo.transform.position = PlayerSpawn + new Vector3(-1.5f, 0f, -1.5f);
            var mystic = mysticGo.AddComponent<AllyMystic>();
            SetPrivateField(mystic, "modelPrefab", _peasantGirl != null ? _peasantGirl : _characterB);
            SetPrivateField(mystic, "bodyController",
                AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>("Assets/Animators/Maria.controller"));
        }

        /// <summary>PLAN.md 101-2 5.5 "난입"(2026-09-20) — Room1의 표식
        /// (`HordeGate`)과 격리된 고정 방(`HordeArena`, `HordeRunner`가 얹힌다)
        /// 둘을 짓는다. 방은 다른 방과 똑같은 표준 셸(문 없이 완전히 막힘 —
        /// 텔레포트로만 드나든다)이라 `Build()`만 부르고 `OpenXDoor()`는 안 부른다.</summary>
        private static void BuildHordeArena()
        {
            var gateGo = new GameObject("HordeGate");
            gateGo.transform.position = HordeGateSpawn;
            gateGo.AddComponent<HordeGate>();

            var arenaGo = new GameObject("HordeArena");
            arenaGo.transform.position = HordeArenaCenter;
            var arenaBuilder = arenaGo.AddComponent<DungeonRoomBuilder>();
            SetPrivateField(arenaBuilder, "biome", SagaBiome.Ruins);
            SetPrivateField(arenaBuilder, "decorOffset", new Vector3(-8f, 0f, 5f));
            SetPrivateField(arenaBuilder, "gateModel", _gateGlb);
            SetPrivateField(arenaBuilder, "roomModel", _roomGlb);
            AssignEnvironmentMaterials(arenaBuilder);
            arenaBuilder.Build();

            var runner = arenaGo.AddComponent<HordeRunner>();
            SetPrivateField(runner, "gruntModel", _characterD);
        }

        private static void BuildBootstrap()
        {
            var go = new GameObject("GameBootstrap");
            var bootstrap = go.AddComponent<GameBootstrap>();
            SetPrivateField(bootstrap, "hitClip", AssetDatabase.LoadAssetAtPath<AudioClip>(HitClipPath));
            SetPrivateField(bootstrap, "heavyHitClip", AssetDatabase.LoadAssetAtPath<AudioClip>(HeavyHitClipPath));
            SetPrivateField(bootstrap, "enemyDeathClip", AssetDatabase.LoadAssetAtPath<AudioClip>(EnemyDeathClipPath));
            SetPrivateField(bootstrap, "levelUpClip", AssetDatabase.LoadAssetAtPath<AudioClip>(LevelUpClipPath));
            SetPrivateField(bootstrap, "discoveryClip", AssetDatabase.LoadAssetAtPath<AudioClip>(DiscoveryClipPath));
            SetPrivateField(bootstrap, "bgmClip", AssetDatabase.LoadAssetAtPath<AudioClip>(BgmClipPath));
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildTestDungeonScene] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
