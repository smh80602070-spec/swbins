using UnityEngine;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 2-8절 "월드맵 첫 슬라이스 — 성 셋을 한 지도로"
    /// (saga-godot REALM 2-8절 참고, 개념만 — 코드는 Unity 관용구로 새로).
    /// 평평한 바닥 + 성마다 표지(기둥+깃발) 하나 + 지금 조망 중인 성 강조.
    /// 지형 기복·해협은 안 옮긴다 — 성 셋(+함락하면 넷) 모두 값 자체가
    /// 없다(RealmCityBuilder.cs의 "없는 값은 안 그린다"와 같은 원칙).
    ///
    /// `RealmCityState.Changed`(성 편입·조망 전환)를 구독해 다시 짓는다 —
    /// RealmCityBuilder.cs와 같은 습관.
    /// </summary>
    public class RealmWorldMap : MonoBehaviour
    {
        // saga-godot REALM 2-8절이 실측으로 고른 축척·바닥 크기(개념만 재사용,
        // 이 프로젝트 단위계에 그대로 대입해도 무해한 순수 상수라 값도 그대로
        // 옮겼다 — 성 셋이 한 덩어리로 안 겹치게 하는 눈금일 뿐).
        private const float WorldScale = 14f;
        private const float GroundSpan = 260f;
        private const float PoleHeight = 4.5f;
        private const float PoleRadius = 0.35f;
        private const float TapColliderRadiusMul = 2.6f; // 손가락 탭을 넉넉히 봐준다(월드 단위 반지름, 기둥 반지름 0.35보다 훨씬 크게).

        private static readonly Color GroundColor = new Color(0.36f, 0.46f, 0.3f);
        private static readonly Color PlainPoleColor = new Color(0.62f, 0.55f, 0.4f);
        private static readonly Color RiverPoleColor = new Color(0.32f, 0.5f, 0.62f);
        private static readonly Color FlagColor = new Color(0.75f, 0.7f, 0.3f);
        private static readonly Color HighlightColor = new Color(0.95f, 0.35f, 0.15f);

        private void Awake()
        {
            RealmCityState.Changed += Rebuild;
        }

        private void OnDestroy()
        {
            RealmCityState.Changed -= Rebuild;
        }

        /// <summary>edit-time 씬 빌드가 직접 부른다(RealmCityBuilder.cs와
        /// 같은 이유 — Awake는 Play 모드에서만 자동으로 돈다).</summary>
        public void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }

            var cityIds = RealmCityState.ActiveCityIds;
            if (cityIds.Count == 0) return; // 씬 첫 로드 등 아직 상태가 없을 때.

            Spawn("Ground", transform, PrimitiveType.Cylinder, new Vector3(0f, -0.1f, 0f),
                new Vector3(GroundSpan, 0.2f, GroundSpan), GroundColor, addCollider: false);

            var (centerX, centerY) = MapCenter(cityIds);
            foreach (var cityId in cityIds)
            {
                var def = RealmCityData.Get(cityId);
                if (def == null) continue;
                BuildMarker(def, WorldPos(def, centerX, centerY), cityId == RealmCityState.CurrentCity);
            }

            // PLAN.md 109-13-2 지도 위 인물 — 태수 몸짓·재야. 에디터 씬 빌드(Play 아님)엔 안 세운다(씬에 대역이 저장되지 않게).
            if (Application.isPlaying)
            {
                var actors = GetComponent<RealmMapActors>();
                if (actors == null) actors = gameObject.AddComponent<RealmMapActors>();
                actors.Rebuild(transform, centerX, centerY);
            }
        }

        /// <summary>성 id의 지도 좌표를 성 셋(+편입 시 더) 중심 기준 월드
        /// 좌표로 — PlaytestRealmSlice.cs가 손 계산으로 그대로 검증한다.</summary>
        public static Vector3 WorldPos(RealmCityDef def, float centerX, float centerY)
        {
            return new Vector3((def.MapX - centerX) * WorldScale, 0f, (centerY - def.MapY) * WorldScale);
        }

        public static (float x, float y) MapCenter(System.Collections.Generic.IReadOnlyList<string> cityIds)
        {
            float sumX = 0f, sumY = 0f;
            int n = 0;
            foreach (var id in cityIds)
            {
                var def = RealmCityData.Get(id);
                if (def == null) continue;
                sumX += def.MapX;
                sumY += def.MapY;
                n++;
            }
            return n > 0 ? (sumX / n, sumY / n) : (0f, 0f);
        }

        private void BuildMarker(RealmCityDef def, Vector3 pos, bool highlighted)
        {
            var poleColor = highlighted ? HighlightColor : (def.Land == RealmLand.River ? RiverPoleColor : PlainPoleColor);
            var pole = Spawn($"Marker_{def.Id}", transform, PrimitiveType.Cylinder,
                pos + new Vector3(0f, PoleHeight / 2f, 0f),
                new Vector3(PoleRadius * 2f, PoleHeight / 2f, PoleRadius * 2f), poleColor, addCollider: false);

            // 탭 판정용 별도 자식 — pole은 (0.7, 2.25, 0.7)처럼 비균등
            // 스케일이라 CapsuleCollider 반지름을 늘리면 Unity가 알아서
            // 안 늘려 준다(height<2*radius면 조용히 구로 뭉개진다, 처음에
            // 이걸로 헤드리스 탭 판정이 실패했었다). 스케일이 (1,1,1)인
            // 별도 자식에 SphereCollider를 두면 world 반지름을 그대로 쓸 수
            // 있다 — pole 자체(부모)는 시각만, 탭은 이 자식이 받는다.
            var tapZoneGo = new GameObject($"TapZone_{def.Id}");
            tapZoneGo.transform.SetParent(transform, false);
            tapZoneGo.transform.position = pos + new Vector3(0f, PoleHeight / 2f, 0f);
            var sphere = tapZoneGo.AddComponent<SphereCollider>();
            sphere.radius = TapColliderRadiusMul;
            var marker = tapZoneGo.AddComponent<RealmCityMarkerId>();
            marker.CityId = def.Id;

            var flagScale = Vector3.Scale(new Vector3(0.8f, 0.5f, 0.06f), highlighted ? new Vector3(1.3f, 1.6f, 1.3f) : Vector3.one);
            Spawn($"Flag_{def.Id}", pole.transform, PrimitiveType.Cube,
                new Vector3(0.5f, 0.6f, 0f), flagScale,
                highlighted ? HighlightColor : FlagColor, addCollider: false);
        }

        private static GameObject Spawn(string name, Transform parent, PrimitiveType type, Vector3 localPos,
            Vector3 scale, Color color, bool addCollider)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            if (!addCollider)
            {
                var col = go.GetComponent<Collider>();
                if (col != null) DestroyImmediate(col);
            }
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = $"{name} (generated)" };
            mat.color = color;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }
    }
}
