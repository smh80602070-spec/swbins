using Saga.Core;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 1·2절 — 허창 들판을 FieldMapData로 짓는다.
    /// 2.5D라 모든 발판·바닥은 Z축으로 얕은 깊이(PlatformDepth)만 갖는다 —
    /// 플레이어가 Z=0에 고정이라(2절) 더 깊을 필요가 없다. saga-godot
    /// `story_terrain_builder.gd`와 같은 값 — primitive 박스뿐(GLB 없음,
    /// 이 판은 이제 막 첫 슬라이스라 GO/FOREST의 "primitive는 프로토타입
    /// 에서만" 원칙 그대로).
    /// </summary>
    public class StoryTerrainBuilder : MonoBehaviour
    {
        private const float PlatformDepth = 4f;
        private const float PlatformThickness = 0.4f;

        /// <summary>발판 밑을 지나는 로프 좌우로 남기는 틈(반폭) —
        /// 2026-09-12 "STORY 콘텐츠 확장" 발견·수정. Platform[0](X 3.8~9.0)
        /// 이 하필 로프(X=6.8) 바로 위를 지나(PROJECT_STATE.md 열다섯 번째
        /// 세션 기록) 로프 위쪽 절반을 오르면 CharacterController가 발판
        /// 밑면(Y 2.2)에 박혔다. 로프가 원래 발판 높이(Y 2.6)까지 그대로
        /// 오르게 설계돼 있어(Top==platform Height) 로프를 옮기거나
        /// 짧게 자르는 대신, **발판 쪽에 로프가 지나갈 틈을 낸다** — 오르는
        /// 높이는 그대로 두고 발판 두 조각 사이로 통과시킨다. 반폭은
        /// 플레이어 CharacterController 반지름(0.4, BuildPlayer() 참고)
        /// +여유 0.1.</summary>
        private const float RopeGapHalfWidth = 0.5f;
        private static readonly Color GroundColor = new Color(0.435f, 0.686f, 0.333f); // data-side.js field.ground '#6faf55'
        private static readonly Color PlatColor = new Color(0.55f, 0.42f, 0.28f);
        private static readonly Color RopeColor = new Color(0.6f, 0.5f, 0.35f);
        private const float WallHeight = 20f;

        // 44장 "Environment" 교체 — 편집기 빌드 스크립트가 채워 준다(런타임
        // Awake()는 AssetDatabase를 못 쓴다, DungeonRoomBuilder.cs와 같은
        // 결). 비어 있으면 기존 GroundColor/PlatColor 평면색 그대로.
        [SerializeField] private Material groundMaterial;
        [SerializeField] private Material platformMaterial;

        private void Awake()
        {
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            BuildGround();
            foreach (var p in FieldMapData.Platforms()) BuildPlatform(p);
            BuildRope();
            BuildBoundaryWalls();
        }

        private void BuildGround()
        {
            float width = FieldMapData.WidthM;
            BuildBox(width * 0.5f, -PlatformThickness * 0.5f, width, PlatformThickness, GroundColor, "Ground", groundMaterial);
        }

        private void BuildPlatform(FieldMapData.Platform p)
        {
            var rope = FieldMapData.Rope();
            float left = p.X - p.HalfWidth;
            float right = p.X + p.HalfWidth;
            bool ropePassesUnder = rope.X > left && rope.X < right;

            if (!ropePassesUnder)
            {
                BuildBox(p.X, p.Height - PlatformThickness * 0.5f, p.HalfWidth * 2f, PlatformThickness, PlatColor, "Platform", platformMaterial);
                return;
            }

            // 위 RopeGapHalfWidth 주석 참고 — 발판을 로프 좌우 두 조각으로 쪼갠다.
            float gapLeft = rope.X - RopeGapHalfWidth;
            float gapRight = rope.X + RopeGapHalfWidth;
            if (gapLeft > left) BuildPlatformSpan(left, gapLeft, p.Height);
            if (gapRight < right) BuildPlatformSpan(gapRight, right, p.Height);
        }

        private void BuildPlatformSpan(float left, float right, float height)
        {
            float width = right - left;
            if (width <= 0f) return;
            BuildBox((left + right) * 0.5f, height - PlatformThickness * 0.5f, width, PlatformThickness, PlatColor, "Platform", platformMaterial);
        }

        private void BuildBox(float centerX, float centerY, float width, float thickness, Color color, string boxName, Material materialOverride = null)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = boxName;
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(centerX, centerY, 0f);
            go.transform.localScale = new Vector3(width, thickness, PlatformDepth);
            go.GetComponent<MeshRenderer>().sharedMaterial = materialOverride != null
                ? EnvironmentMaterial.MakeTiled(materialOverride, width, PlatformDepth)
                : MakeMaterial(color);
        }

        /// <summary>웹판 ropes[0](kind:'rope') — 오르내리는 동안 옆으로 못
        /// 움직이게 `StoryPlayerController`가 이 트리거 안에서만 "on_rope"
        /// 상태로 바뀐다(`StoryRope.cs` 참고).</summary>
        private void BuildRope()
        {
            var r = FieldMapData.Rope();
            float height = r.Top - r.Bottom;
            float midY = r.Bottom + height * 0.5f;

            var ropeGo = new GameObject("Rope");
            ropeGo.transform.SetParent(transform, false);
            ropeGo.transform.localPosition = new Vector3(r.X, midY, 0f);

            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(ropeGo.transform, false);
            visual.transform.localScale = new Vector3(0.12f, height * 0.5f, 0.12f); // primitive Cylinder 기본 높이 2 기준.
            Object.DestroyImmediate(visual.GetComponent<Collider>());
            visual.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(RopeColor);

            var trigger = ropeGo.AddComponent<BoxCollider>();
            trigger.isTrigger = true;
            trigger.size = new Vector3(0.6f, height, 1.2f);

            var rope = ropeGo.AddComponent<StoryRope>();
            rope.Configure(r.X, r.Top, r.Bottom);
        }

        /// <summary>문(portal)이 없는 이번 슬라이스에서 양 끝으로 걸어
        /// 나가지 못하게 막는다(1절 "제외" — 사냥터 이동 자체가 범위 밖).</summary>
        private void BuildBoundaryWalls()
        {
            float width = FieldMapData.WidthM;
            BuildWall(-0.5f);
            BuildWall(width + 0.5f);
        }

        private void BuildWall(float x)
        {
            var go = new GameObject("Boundary");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(x, WallHeight * 0.5f, 0f);
            var col = go.AddComponent<BoxCollider>();
            col.size = new Vector3(1f, WallHeight, PlatformDepth);
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryTerrain (generated)" };
            mat.color = color;
            return mat;
        }
    }
}
