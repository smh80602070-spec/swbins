using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" — `BuildTestDungeonScene.Build()`가 부르는 젤다식 던전 조립.
    /// 1,700줄 씬 빌더에 더 얹지 않으려고 따로 뺐다. Room2(0,0,30) 서쪽 문에서 시작해
    /// 30m 격자에 방 다섯을 놓는다(좌표는 PLAN 106-2 그림 그대로):
    /// 입구 홀(-30,30) · 시련의 방(-60,30) · 벽력탄 방(-30,60) · 보스 열쇠 방(-60,60) · 보스방(-30,90).
    /// </summary>
    public static class BuildDungeonTemple
    {
        private const string WoodMatPath = "Assets/Art/Environment/PBR/dark_wooden_planks_URPLit.mat";
        private const string MetalMatPath = "Assets/Art/Props/Generated/LanternMetal.mat";

        public static readonly Vector3 EntranceCenter = new Vector3(-30f, 0f, 30f);
        public static readonly Vector3 TrialCenter = new Vector3(-60f, 0f, 30f);
        public static readonly Vector3 BombRoomCenter = new Vector3(-30f, 0f, 60f);
        public static readonly Vector3 VaultCenter = new Vector3(-60f, 0f, 60f);
        public static readonly Vector3 BossRoomCenter = new Vector3(-30f, 0f, 90f);

        private static readonly Color WardenTint = new Color(0.5f, 0.55f, 0.62f);
        private static readonly Color SkeletonTint = new Color(0.88f, 0.9f, 0.96f);
        private static readonly Color GuardianTint = new Color(0.36f, 0.36f, 0.44f);

        private static GameObject _corridorGlb, _gateGlb, _roomGlb, _guardianModel, _wardenModel;
        private static Material _floorMat, _wallMat, _woodMat, _metalMat;
        private static float _doorWidth;
        private static bool _dedicatedGuardian;

        /// <summary>능묘지기 키(m) — 옛 몸 Brute(2.34m) × 1.5 와 같게 전용 몸도 맞춘다.</summary>
        public const float GuardianHeight = 3.5f;

        /// <summary>마지막 `Build()` 가 만든 능묘지기 — `BuildDungeonCinematics` 가 등장 컷 포효에 쓴다.</summary>
        public static DungeonEnemy LastGuardian { get; private set; }

        public static void Build(GameObject corridorGlb, GameObject gateGlb, GameObject roomGlb,
            Material floorMat, Material wallMat, GameObject guardianModel, GameObject wardenModel, float roomDoorWidth,
            bool dedicatedGuardian = false)
        {
            _dedicatedGuardian = dedicatedGuardian;
            _corridorGlb = corridorGlb;
            _gateGlb = gateGlb;
            _roomGlb = roomGlb;
            _floorMat = floorMat;
            _wallMat = wallMat;
            _guardianModel = guardianModel;
            _wardenModel = wardenModel;
            _doorWidth = roomDoorWidth;
            _woodMat = AssetDatabase.LoadAssetAtPath<Material>(WoodMatPath);
            _metalMat = AssetDatabase.LoadAssetAtPath<Material>(MetalMatPath);
            if (_woodMat == null || _metalMat == null)
            {
                Debug.LogWarning("[BuildDungeonTemple] 나무/금속 재질을 못 찾음 — 단색으로 대신한다.");
            }

            var root = new GameObject("Temple_ForgottenTomb");

            // Room2 ↔ 입구 홀
            Corridor(root, "TempleCorridor_Room2", new Vector3(-15f, 0f, 30f), 90f);

            // 입구 홀 — 동(Room2)·서(시련)·북(잠긴 문 → 벽력탄 방)
            var entrance = Room(root, "Temple_Entrance", EntranceCenter, new Vector3(7f, 0f, -7f));
            entrance.OpenEastDoor(_doorWidth);
            entrance.OpenWestDoor(_doorWidth);
            entrance.OpenNorthDoor(_doorWidth);
            new GameObject("TempleEntrance").AddComponent<TempleEntrance>().transform.SetParent(entrance.transform, false);
            Torch(entrance.transform);

            // 입구 ↔ 시련
            Corridor(root, "TempleCorridor_Trial", new Vector3(-45f, 0f, 30f), 90f);
            var trial = Room(root, "Temple_Trial", TrialCenter, new Vector3(-7f, 0f, 7f));
            trial.OpenEastDoor(_doorWidth);
            Torch(trial.transform);
            Warden(root, "temple_trial", TrialCenter + new Vector3(-4f, 0f, 4f), 1);
            Warden(root, "temple_trial", TrialCenter + new Vector3(4f, 0f, 4f), 2);
            Warden(root, "temple_trial", TrialCenter + new Vector3(0f, 0f, -5f), 3);
            Chest(root, "TempleChest_SmallKey", TrialCenter, TempleChestContent.SmallKey, TempleFlag.KeyChest,
                revealRoomId: "temple_trial", revealFlag: TempleFlag.None, big: false);

            // 입구 ↔ 벽력탄 방: 잠긴 문
            var smallDoorCorridor = Corridor(root, "TempleCorridor_SmallDoor", new Vector3(-30f, 0f, 45f), 0f);
            Door(smallDoorCorridor, "TempleDoor_SmallKey", TempleDoorKind.SmallKey, TempleFlag.SmallDoor);

            var bombRoom = Room(root, "Temple_BombRoom", BombRoomCenter, new Vector3(-7f, 0f, 7f));
            bombRoom.OpenSouthDoor(_doorWidth);
            bombRoom.OpenNorthDoor(_doorWidth);
            bombRoom.OpenWestDoor(_doorWidth);
            Torch(bombRoom.transform);
            var puzzleGo = new GameObject("TemplePushBlock");
            puzzleGo.transform.SetParent(root.transform, false);
            puzzleGo.transform.position = BombRoomCenter;
            var puzzle = puzzleGo.AddComponent<TemplePushBlock>();
            SetField(puzzle, "blockStartLocal", new Vector3(-4f, 0f, -4f));
            SetField(puzzle, "plateLocal", new Vector3(4f, 0f, -4f));
            SetField(puzzle, "stoneMaterial", _wallMat);
            SetField(puzzle, "metalMaterial", _metalMat);
            puzzle.Build();
            Chest(root, "TempleChest_Bombs", BombRoomCenter + new Vector3(0f, 0f, 5f), TempleChestContent.Bombs, TempleFlag.BombChest,
                revealRoomId: null, revealFlag: TempleFlag.BlockSolved, big: false);
            Warden(root, "temple_bomb", BombRoomCenter + new Vector3(6f, 0f, 4f), 4);

            // 벽력탄 방 ↔ 보스 열쇠 방: 금 간 벽
            var wallCorridor = Corridor(root, "TempleCorridor_Cracked", new Vector3(-45f, 0f, 60f), 90f);
            var wallGo = new GameObject("TempleCrackedWall");
            wallGo.transform.SetParent(wallCorridor.transform, false);
            var wall = wallGo.AddComponent<TempleCrackedWall>();
            SetField(wall, "stoneMaterial", _wallMat);
            wall.Build();

            var vault = Room(root, "Temple_Vault", VaultCenter, new Vector3(-7f, 0f, -7f));
            vault.OpenEastDoor(_doorWidth);
            Torch(vault.transform);
            Warden(root, "temple_vault", VaultCenter + new Vector3(3f, 0f, 4f), 5);
            Warden(root, "temple_vault", VaultCenter + new Vector3(3f, 0f, -4f), 6);
            Chest(root, "TempleChest_BossKey", VaultCenter + new Vector3(-5f, 0f, 0f), TempleChestContent.BossKey, TempleFlag.BossKeyChest,
                revealRoomId: null, revealFlag: TempleFlag.None, big: true);

            // 벽력탄 방 ↔ 보스방: 보스 문
            var bossCorridor = Corridor(root, "TempleCorridor_BossDoor", new Vector3(-30f, 0f, 75f), 0f);
            Door(bossCorridor, "TempleDoor_Boss", TempleDoorKind.BossKey, TempleFlag.BossDoor);

            var bossRoom = Room(root, "Temple_BossRoom", BossRoomCenter, new Vector3(7f, 0f, 7f));
            bossRoom.OpenSouthDoor(_doorWidth);
            Torch(bossRoom.transform, intensity: 1.6f);
            LastGuardian = Guardian(root, BossRoomCenter + new Vector3(0f, 0f, 4f));
            var introGo = new GameObject("TempleBossIntro"); // PLAN.md 106-3 — 보스방 첫 발에 등장 컷.
            introGo.transform.SetParent(bossRoom.transform, false);
            SetField(introGo.AddComponent<TempleBossIntro>(), "boss", LastGuardian);

            Debug.Log("[BuildDungeonTemple] 잊힌 능묘 — 방 5 · 복도 5 · 상자 3 · 문 2 · 금 간 벽 1 · 블록 1 · 파수꾼 6 · 능묘지기 1");
        }

        private static DungeonCorridorBuilder Corridor(GameObject root, string name, Vector3 center, float yaw)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root.transform, false);
            go.transform.position = center;
            go.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            var b = go.AddComponent<DungeonCorridorBuilder>();
            SetField(b, "biome", SagaBiome.Ruins);
            SetField(b, "corridorModel", _corridorGlb);
            SetField(b, "floorMaterial", _floorMat);
            SetField(b, "wallMaterial", _wallMat);
            b.Build();
            return b;
        }

        private static DungeonRoomBuilder Room(GameObject root, string name, Vector3 center, Vector3 decorOffset)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root.transform, false);
            go.transform.position = center;
            var b = go.AddComponent<DungeonRoomBuilder>();
            SetField(b, "biome", SagaBiome.Shrine);
            SetField(b, "decorOffset", decorOffset);
            SetField(b, "gateModel", _gateGlb);
            SetField(b, "gateTiledModel", AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Dungeon/gate_tiled.glb")); // U-0069 PBR 아치
            SetField(b, "roomModel", _roomGlb);
            SetField(b, "floorMaterial", _floorMat);
            SetField(b, "wallMaterial", _wallMat);
            SetField(b, "wearTier", 1); // 오래 버려진 능묘 — 103-1 마모 1단.
            b.Build();
            return b;
        }

        /// <summary>방마다 따뜻한 불빛 하나 — 66-2 "횃불처럼 데운" 던전 톤과 같은 결.</summary>
        private static void Torch(Transform room, float intensity = 1.2f)
        {
            var go = new GameObject("TempleTorchLight");
            go.transform.SetParent(room, false);
            go.transform.localPosition = new Vector3(0f, 3.4f, 0f);
            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.72f, 0.45f);
            light.range = 15f;
            light.intensity = intensity;
            light.shadows = LightShadows.None;
        }

        private static void Chest(GameObject root, string name, Vector3 pos, TempleChestContent content, TempleFlag openedFlag,
            string revealRoomId, TempleFlag revealFlag, bool big)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root.transform, false);
            go.transform.position = pos;
            var c = go.AddComponent<TempleChest>();
            SetField(c, "content", content);
            SetField(c, "openedFlag", openedFlag);
            SetField(c, "revealRoomId", revealRoomId);
            SetField(c, "revealFlag", revealFlag);
            SetField(c, "big", big);
            SetField(c, "woodMaterial", _woodMat);
            SetField(c, "metalMaterial", _metalMat);
            c.Build();
        }

        private static void Door(DungeonCorridorBuilder corridor, string name, TempleDoorKind kind, TempleFlag flag)
        {
            var go = new GameObject(name);
            go.transform.SetParent(corridor.transform, false);
            var d = go.AddComponent<TempleDoor>();
            SetField(d, "kind", kind);
            SetField(d, "openedFlag", flag);
            SetField(d, "woodMaterial", _woodMat);
            SetField(d, "metalMaterial", _metalMat);
            d.Build();
        }

        private static void Warden(GameObject root, string roomId, Vector3 pos, int index)
        {
            var go = new GameObject($"Enemy_TempleWarden_{index}");
            go.transform.SetParent(root.transform, false);
            go.transform.position = pos;
            var e = go.AddComponent<DungeonEnemy>();
            SetField(e, "roomId", roomId);
            SetField(e, "hp", 40f);
            SetField(e, "dmg", 7f);
            SetField(e, "rewardExp", 25);
            SetField(e, "rewardGold", 10);
            SetField(e, "rewardItemId", "wp_saber");
            SetField(e, "displayName", "능묘 파수꾼");
            // 106-4 해골 파수꾼은 뼈 색이 살도록 옅게만 칠한다(Abe 폴백은 예전 회청색).
            bool skeleton = _wardenModel != null && _wardenModel.name.StartsWith("Skeleton");
            SetField(e, "bodyColor", skeleton ? SkeletonTint : WardenTint);
            SetField(e, "modelPrefab", _wardenModel);
        }

        private static DungeonEnemy Guardian(GameObject root, Vector3 pos)
        {
            var go = new GameObject("Enemy_TempleGuardian");
            go.transform.SetParent(root.transform, false);
            go.transform.position = pos;
            go.transform.rotation = Quaternion.Euler(0f, 180f, 0f); // 문(남쪽)을 본다.
            var e = go.AddComponent<DungeonEnemy>();
            SetField(e, "roomId", "temple_boss");
            SetField(e, "hp", 480f);
            SetField(e, "dmg", 14f);
            SetField(e, "aggroRadius", 11f);
            SetField(e, "chaseSpeed", 3f);
            SetField(e, "attackRange", 3f);
            SetField(e, "attackInterval", 1.4f);
            SetField(e, "rewardExp", 300);
            SetField(e, "rewardGold", 150);
            SetField(e, "rewardItemId", "wp_greatblade");
            SetField(e, "isBoss", true);
            SetField(e, "displayName", "능묘지기");
            // 전용 몸(Ganfaul)은 제 빛깔 그대로·키를 재서 3.5m 로, 옛 두목 몸(Brute)은 검푸른 칠·1.5배.
            SetField(e, "bodyColor", _dedicatedGuardian ? Color.white : GuardianTint);
            SetField(e, "visualScale", _dedicatedGuardian ? GuardianHeight / Mathf.Max(0.5f, MeasureHeight(_guardianModel)) : 1.5f);
            SetField(e, "modelPrefab", _guardianModel);
            SetField(e, "bombArmored", true);
            SetField(e, "deathFlag", TempleFlag.BossDefeated);
            return e;
        }

        /// <summary>프리팹을 잠깐 세워 렌더러 키를 잰다(리깅 모델은 실제 크기 단위 — `DungeonEnemy.BuildVisual`).</summary>
        internal static float MeasureHeight(GameObject prefab)
        {
            if (prefab == null) return 1f;
            var inst = Object.Instantiate(prefab);
            float h = 0f;
            var rs = inst.GetComponentsInChildren<Renderer>();
            if (rs.Length > 0)
            {
                var b = rs[0].bounds;
                foreach (var r in rs) b.Encapsulate(r.bounds);
                h = b.size.y;
            }
            Object.DestroyImmediate(inst);
            return h;
        }

        private static void SetField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildDungeonTemple] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
