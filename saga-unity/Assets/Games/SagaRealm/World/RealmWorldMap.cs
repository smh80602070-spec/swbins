using System.Collections.Generic;
using TMPro;
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

        // tasks U-0102 성 이름표 — 기둥 위, 카메라를 보고 화면 크기가 거의 같게(글 크기 = 카메라 거리 × LabelPerMeter).
        // 지금 성 이름은 늘, 나머지는 카메라가 LabelNearRadius 안으로 다가왔을 때만(먼 줌에서 55곳 글이 겹치지 않게).
        public const float LabelHeight = 6f, LabelNearRadius = 160f, LabelPerMeter = 0.32f;
        public static RealmWorldMap Instance { get; private set; }
        private readonly List<(string cityId, TextMeshPro label)> _labels = new List<(string, TextMeshPro)>();
        private Saga.Realm.Player.RealmWorldMapCamera _mapCam;
        public int LabelCount => _labels.Count;
        public int VisibleLabels { get; private set; }

        private void Awake()
        {
            Instance = this;
            RealmCityState.Changed += Rebuild;
        }

        /// <summary>tasks U-0102 — 지도를 켤 때마다 다시 짓는다. 꺼진 채 판을 불러오면 Awake 전이라 `Changed` 를 못 들어
        /// 씬에 구운 첫 세 성 표지만 남아 있었다(카메라가 고른 성을 보면 빈 하늘).</summary>
        private void OnEnable()
        {
            if (Application.isPlaying) Rebuild();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            RealmCityState.Changed -= Rebuild;
        }

        /// <summary>tasks U-0102 — 성의 월드 자리(표지와 같은 중심 `MapCenter(우리 성)` 기준, 지도 Transform 반영). 지도·성이 없으면 null. 지도 카메라 중심이 쓴다.
        /// 중심은 매번 다시 센다 — 씬에 구운 표지로 시작하면 Play 첫 Rebuild 전이라 저장해 둔 값이 없다.</summary>
        public static Vector3? CityWorldPos(string cityId)
        {
            var def = cityId != null ? RealmCityData.Get(cityId) : null;
            if (Instance == null || def == null || !RealmCityState.OwnsCity(cityId)) return null;
            var (cx, cy) = MapCenter(RealmCityState.ActiveCityIds);
            return Instance.transform.TransformPoint(WorldPos(def, cx, cy));
        }

        private void LateUpdate()
        {
            if (_labels.Count == 0) return;
            if (_mapCam == null) _mapCam = FindFirstObjectByType<Saga.Realm.Player.RealmWorldMapCamera>();
            var c = _mapCam != null ? _mapCam.Cam : null;
            if (c == null) return;
            RefreshLabels(c, _mapCam.DebugRadius);
        }

        /// <summary>이름표 보이기·크기·방향 — LateUpdate 와 진단이 부른다.</summary>
        public void RefreshLabels(Camera c, float radius)
        {
            int vis = 0;
            foreach (var (cityId, label) in _labels)
            {
                if (label == null) continue;
                bool show = cityId == RealmCityState.CurrentCity || radius <= LabelNearRadius;
                if (label.gameObject.activeSelf != show) label.gameObject.SetActive(show);
                if (!show) continue;
                vis++;
                if (label.outlineWidth < 0.2f) { label.outlineWidth = 0.22f; label.outlineColor = new Color32(0, 0, 0, 255); }
                label.transform.rotation = c.transform.rotation;
                label.fontSize = Mathf.Max(1.5f, Vector3.Distance(c.transform.position, label.transform.position) * LabelPerMeter);
            }
            VisibleLabels = vis;
        }

        /// <summary>edit-time 씬 빌드가 직접 부른다(RealmCityBuilder.cs와
        /// 같은 이유 — Awake는 Play 모드에서만 자동으로 돈다).</summary>
        public void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }
            _labels.Clear();
            if (Application.isPlaying) Instance = this; // 꺼진 채 시작하면 Awake 가 아직 안 돌았다(U-0091) — 직접 부른 Rebuild 에서도 잡는다

            var cityIds = RealmCityState.ActiveCityIds;
            if (cityIds.Count == 0) return; // 씬 첫 로드 등 아직 상태가 없을 때.

            var (centerX, centerY) = MapCenter(cityIds);
            // tasks U-0102 — 땅 원판이 성을 다 덮게(끝판 55성은 중심에서 800m 넘게 퍼져 260m 원판 밖 표지가 하늘에 떠 있었다).
            float span = GroundSpan;
            foreach (var cityId in cityIds)
            {
                var d = RealmCityData.Get(cityId);
                if (d != null) span = Mathf.Max(span, WorldPos(d, centerX, centerY).magnitude * 2f + 60f);
            }
            Spawn("Ground", transform, PrimitiveType.Cylinder, new Vector3(0f, -0.1f, 0f),
                new Vector3(span, 0.2f, span), GroundColor, addCollider: false);

            foreach (var cityId in cityIds)
            {
                var def = RealmCityData.Get(cityId);
                if (def == null) continue;
                BuildMarker(def, WorldPos(def, centerX, centerY), cityId == RealmCityState.CurrentCity);
            }

            // tasks U-0134 진 — 출진한 성 곁 천막(보급 이어짐 갈색 · 끊김 붉은색). 적 성은 지도에 없어 우리 성 옆에 세운다.
            foreach (var camp in RealmCamp.Camps)
            {
                var from = RealmCityData.Get(camp.from);
                if (from == null) continue;
                var at = WorldPos(from, centerX, centerY) + new Vector3(PoleRadius * 6f, 0f, 0f);
                Spawn($"Camp_{camp.from}", transform, PrimitiveType.Cylinder, at + new Vector3(0f, 1.2f, 0f), new Vector3(2.4f, 1.2f, 2.4f),
                    RealmCamp.Connected(camp) ? new Color(0.62f, 0.5f, 0.32f) : new Color(0.8f, 0.2f, 0.15f), addCollider: false);
            }

            // tasks U-0136 불가사의 — 우리가 다 지은 성 곁에 도형 탑(에셋 없이).
            foreach (var w in RealmWonder.All)
            {
                var b = RealmWonder.BuiltOf(w.Id);
                var at = b != null && b.by == RealmWonder.Me ? RealmCityData.Get(b.city) : null;
                if (at == null) continue;
                var p = WorldPos(at, centerX, centerY) + new Vector3(-PoleRadius * 6f, 0f, 0f);
                Spawn($"Wonder_{w.Id}", transform, PrimitiveType.Cylinder, p + new Vector3(0f, 3f, 0f), new Vector3(1.6f, 3f, 1.6f), new Color(0.85f, 0.75f, 0.45f), addCollider: false);
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

            // tasks U-0102 이름표 — 에디터 씬 빌드엔 안 세운다(배우와 같은 결, 씬에 저장되지 않게).
            if (!Application.isPlaying) return;
            var lgo = new GameObject($"Label_{def.Id}");
            lgo.transform.SetParent(transform, false);
            lgo.transform.localPosition = pos + new Vector3(0f, LabelHeight, 0f);
            var t = lgo.AddComponent<TextMeshPro>();
            t.text = def.Name;
            t.alignment = TextAlignmentOptions.Center;
            t.textWrappingMode = TextWrappingModes.NoWrap;
            t.rectTransform.sizeDelta = new Vector2(30f, 6f);
            t.color = highlighted ? new Color(1f, 0.85f, 0.55f) : Color.white;
            t.fontSize = 24f; // 외곽선은 보일 때 RefreshLabels 가 건다 — 꺼진 지도(디오라마 보기)에서 지으면 재질이 없어 외곽선 설정이 터진다
            _labels.Add((def.Id, t));
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
