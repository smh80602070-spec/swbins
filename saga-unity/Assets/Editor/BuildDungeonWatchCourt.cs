using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 106-5 "탐험" — `BuildTestDungeonScene.Build()`가 부르는 "옛 감시탑 뜰"(30,0,30).
    /// Room2(0,0,30) 동쪽 문 → 복도(15,30) → 방. 기어오르는 8m 감시탑(담쟁이 네 면, 꼭대기 모서리 상자, 불빛이 방 벽
    /// 너머로 보이는 랜드마크)과 계단식 돌 셋(윗면 0.9·1.8·2.7m, 점프 1.3m 로 한 칸씩)·2m 틈(뛰어야 건넌다) 너머 선반 상자.
    /// 탑에서 달려 뛰면 방 벽(4m)을 넘을 수 있어 이 방 벽 위에만 보이지 않는 막이(4~14m, "Ignore Raycast" 층 — 카메라는 안 당김).
    /// </summary>
    public static class BuildDungeonWatchCourt
    {
        public static readonly Vector3 CorridorCenter = new Vector3(15f, 0f, 30f);
        public static readonly Vector3 CourtCenter = new Vector3(30f, 0f, 30f);

        // 방 안 좌표(가운데 기준)
        public static readonly Vector3 TowerLocal = new Vector3(2f, 0f, 2f);
        public const float TowerSize = 3.6f;
        public const float TowerHeight = 8f;
        public static readonly Vector3 TowerChestLocal = new Vector3(1.0f, 0f, 1.0f); // 탑 가운데에서(윗면 모서리 쪽)
        // 계단식 돌 셋(폭 2.8m, 서로 맞붙음) — 자연스러운 점프(뛰는 거리 ≈3.4m)가 다음 돌 위에 떨어지게 넓게
        public static readonly float[] StoneX = { -7f, -4.2f, -1.4f };
        public static readonly float[] StoneTop = { 0.9f, 1.8f, 2.7f };
        public const float StoneLength = 2.8f, StoneWidth = 1.8f;
        public const float CourseZ = -6f;
        // 틈 2m — 캡슐(반지름 0.4)이 양 모서리에 걸쳐 버티거나 턱을 계단처럼 올라타지 못할 만큼(1.2m 는 걸어서 건넜다)
        public const float LedgeMinX = 2.0f, LedgeMaxX = 7.6f, LedgeDepth = 3f, LedgeTop = 2.7f;
        public static readonly Vector3 LedgeChestLocal = new Vector3(6.0f, 0f, -6f);

        public const int TowerGold = 80, TowerExp = 60, LedgeGold = 40, LedgeExp = 25;

        private static readonly Color IvyColor = new Color(0.22f, 0.36f, 0.16f);

        public static void Build(GameObject corridorGlb, GameObject gateGlb, GameObject roomGlb,
            Material floorMat, Material wallMat, float doorWidth)
        {
            var woodMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Art/Environment/PBR/dark_wooden_planks_URPLit.mat");
            var metalMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Art/Props/Generated/LanternMetal.mat");
            var root = new GameObject("WatchCourt");

            var corGo = new GameObject("WatchCourtCorridor");
            corGo.transform.SetParent(root.transform, false);
            corGo.transform.position = CorridorCenter;
            corGo.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
            var cor = corGo.AddComponent<DungeonCorridorBuilder>();
            SetField(cor, "biome", SagaBiome.Ruins);
            SetField(cor, "corridorModel", corridorGlb);
            SetField(cor, "floorMaterial", floorMat);
            SetField(cor, "wallMaterial", wallMat);
            cor.Build();

            var roomGo = new GameObject("WatchCourt_Room");
            roomGo.transform.SetParent(root.transform, false);
            roomGo.transform.position = CourtCenter;
            var room = roomGo.AddComponent<DungeonRoomBuilder>();
            SetField(room, "biome", SagaBiome.Ruins);
            SetField(room, "decorOffset", new Vector3(-7f, 0f, 7f));
            SetField(room, "gateModel", gateGlb);
            SetField(room, "gateTiledModel", AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/Dungeon/gate_tiled.glb")); // U-0069 PBR 아치
            SetField(room, "roomModel", roomGlb);
            SetField(room, "floorMaterial", floorMat);
            SetField(room, "wallMaterial", wallMat);
            SetField(room, "wearTier", 1);
            room.Build();
            room.OpenWestDoor(doorWidth);

            var court = new GameObject("WatchCourt_Features").transform;
            court.SetParent(root.transform, false);
            court.position = CourtCenter;
            court.gameObject.AddComponent<WatchCourtHint>();

            var stone = wallMat != null ? wallMat : TempleVisuals.Solid(TempleVisuals.StoneColor);
            var ivy = TempleVisuals.Solid(IvyColor, 0f, 0.15f);

            // 옛 감시탑 — 몸통 충돌체에 DungeonClimbable, 네 면에 담쟁이 판(충돌 없음)
            var tower = TempleVisuals.Box(court, "WatchTower", TowerLocal + Vector3.up * (TowerHeight * 0.5f),
                new Vector3(TowerSize, TowerHeight, TowerSize), stone);
            tower.gameObject.AddComponent<DungeonClimbable>();
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI * 0.5f;
                Vector3 n = new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a));
                var panel = TempleVisuals.Box(court, "Ivy", TowerLocal + n * (TowerSize * 0.5f + 0.03f) + Vector3.up * (TowerHeight * 0.45f),
                    new Vector3(Mathf.Abs(n.z) * TowerSize * 0.8f + 0.04f, TowerHeight * 0.85f, Mathf.Abs(n.x) * TowerSize * 0.8f + 0.04f), ivy, collider: false);
                panel.name = "Ivy";
            }
            // 꼭대기 — 모서리 성가퀴 셋(상자 모서리는 비움)·화톳불(방 벽 너머로 보이는 랜드마크)
            float half = TowerSize * 0.5f - 0.3f;
            for (int i = 0; i < 4; i++)
            {
                float sx = (i & 1) == 0 ? -1f : 1f, sz = (i & 2) == 0 ? -1f : 1f;
                if (sx > 0f && sz > 0f) continue;
                TempleVisuals.Box(court, "Merlon", TowerLocal + new Vector3(sx * half, TowerHeight + 0.35f, sz * half), new Vector3(0.6f, 0.7f, 0.6f), stone, collider: false);
            }
            var fire = TempleVisuals.Primitive(PrimitiveType.Sphere, court, "BeaconFire", TowerLocal + new Vector3(-0.8f, TowerHeight + 0.6f, -0.8f),
                Vector3.one * 0.5f, TempleVisuals.Glow(new Color(1f, 0.6f, 0.25f)), collider: false);
            var lightGo = new GameObject("BeaconLight");
            lightGo.transform.SetParent(fire, false);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.66f, 0.35f);
            light.range = 16f;
            light.intensity = 2.2f;
            light.shadows = LightShadows.None;

            // 징검돌 셋 + 선반(오를 수 없는 돌 — DungeonClimbable 없음)
            for (int i = 0; i < StoneX.Length; i++)
                TempleVisuals.Box(court, $"StepStone_{i}", new Vector3(StoneX[i], StoneTop[i] * 0.5f, CourseZ),
                    new Vector3(StoneLength, StoneTop[i], StoneWidth), stone);
            TempleVisuals.Box(court, "Ledge", new Vector3((LedgeMinX + LedgeMaxX) * 0.5f, LedgeTop * 0.5f, CourseZ),
                new Vector3(LedgeMaxX - LedgeMinX, LedgeTop, LedgeDepth), stone);

            Chest(root, "WatchChest_Tower", CourtCenter + TowerLocal + TowerChestLocal + Vector3.up * TowerHeight,
                TempleFlag.WatchTowerChest, TowerGold, TowerExp, woodMat, metalMat, big: false);
            Chest(root, "WatchChest_Ledge", CourtCenter + LedgeChestLocal + Vector3.up * LedgeTop,
                TempleFlag.WatchLedgeChest, LedgeGold, LedgeExp, woodMat, metalMat, big: false);

            // 방 벽 위 보이지 않는 막이(탑에서 달려 뛰어 벽을 넘지 않게)
            var barrier = new GameObject("WatchCourt_Barrier").transform;
            barrier.SetParent(root.transform, false);
            barrier.position = CourtCenter;
            float w = DungeonRoomBuilder.RoomWidth, d = DungeonRoomBuilder.RoomDepth;
            Barrier(barrier, new Vector3(0f, 9f, d * 0.5f), new Vector3(w + 1f, 10f, 1f));
            Barrier(barrier, new Vector3(0f, 9f, -d * 0.5f), new Vector3(w + 1f, 10f, 1f));
            Barrier(barrier, new Vector3(w * 0.5f, 9f, 0f), new Vector3(1f, 10f, d + 1f));
            Barrier(barrier, new Vector3(-w * 0.5f, 9f, 0f), new Vector3(1f, 10f, d + 1f));

            var torch = new GameObject("WatchCourtTorch");
            torch.transform.SetParent(roomGo.transform, false);
            torch.transform.localPosition = new Vector3(-5f, 3.4f, 5f);
            var tl = torch.AddComponent<Light>();
            tl.type = LightType.Point;
            tl.color = new Color(1f, 0.72f, 0.45f);
            tl.range = 15f;
            tl.intensity = 1.2f;
            tl.shadows = LightShadows.None;

            Debug.Log("[BuildDungeonWatchCourt] 옛 감시탑 뜰 — 탑 8m(담쟁이) · 징검돌 3 · 선반 · 상자 2 · 막이 4");
        }

        private static void Barrier(Transform parent, Vector3 local, Vector3 size)
        {
            var go = new GameObject("Barrier");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.layer = 2; // Ignore Raycast — CameraRig 는 이 층을 빼고 쏜다
            go.AddComponent<BoxCollider>().size = size;
        }

        private static void Chest(GameObject root, string name, Vector3 pos, TempleFlag flag, int gold, int exp,
            Material wood, Material metal, bool big)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root.transform, false);
            go.transform.position = pos;
            var c = go.AddComponent<TempleChest>();
            SetField(c, "content", TempleChestContent.Treasure);
            SetField(c, "openedFlag", flag);
            SetField(c, "revealRoomId", null);
            SetField(c, "revealFlag", TempleFlag.None);
            SetField(c, "big", big);
            SetField(c, "woodMaterial", wood);
            SetField(c, "metalMaterial", metal);
            SetField(c, "treasureGold", gold);
            SetField(c, "treasureExp", exp);
            c.Build();
        }

        private static void SetField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildDungeonWatchCourt] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
