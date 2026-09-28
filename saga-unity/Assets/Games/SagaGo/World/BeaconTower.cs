using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 101-2 GO ① "봉수대(烽燧臺)" — 웹판 PLAN.md §5-①(젤다 BOTW
    /// 탑·원신 탐험도 참고, 27개 권역마다 하나·GPS 반경 1.5km 안 미발견
    /// 자리를 한 번에 노출)을 이 트랙에 맞춰 크게 좁힌다: TestVillage 는
    /// GPS 오버월드가 아니라 9×11 고정 격자 하나뿐이라 "권역"도 "지도
    /// 해제"도 그대로 옮길 게 없다. 대신 이 마을에서 실제로 뜻이 통하는
    /// 부분만 남겼다 — **유일한 봉수대 하나**가 불을 올리기 전까지는
    /// <see cref="HiddenTreasure"/> 등과 같은 자격의 목표판 최근접 후보다.
    /// 불을 올리면 그 뒤로는(웹판 48절 "가 보기 전까지 안 뜬다"의 **예외를
    /// 봉수대만 허용**한다는 규칙의 정신을 "미니맵이 없으니 목표판이 그
    /// 역할을 대신한다"로 재해석) 아직 못 찾은 다른 발견형 랜드마크
    /// (<see cref="HiddenTreasure"/>·<see cref="MountainShrine"/>·
    /// <see cref="EastGroveRelic"/>) 전부가 목표판 최근접 후보로 들어온다
    /// (<see cref="UI.GoSessionTracker.GoalLineNow"/> 참고). 켜는 순간
    /// 한 번, 남은 랜드마크 수를 세어 토스트로 알려준다(표준 G "성장
    /// 가시화" — 진행도가 실제로 눈에 보인다).
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class BeaconTower : MonoBehaviour
    {
        private const int Gx = 4;
        private const int Gy = 4;
        /// <summary>봉수대 자리(월드) — 109-14-3a 봉헌이 쓴다.</summary>
        public static Vector3 Position => TestMapData.WorldPos(Gx, Gy) + new Vector3(0f, TestMapData.Legend[TestMapData.TileAt(Gx, Gy)].Height, 0f);
        private const float LightRadius = 8f;
        private const int RewardExp = 40;
        private const int RewardGold = 30;
        private const float ToastSec = 5f;

        /// <summary>WorldEventState id — GoSessionTracker.GoalLineNow()도 이 값으로 켜졌는지 묻는다.</summary>
        public const string EventId = "beacon_lit";

        private static readonly Color TowerColor = new Color(0.42f, 0.36f, 0.3f);
        private static readonly Color UnlitFireColor = new Color(0.5f, 0.24f, 0.08f);
        private static readonly Color LitFireColor = new Color(1f, 0.55f, 0.12f);

        private MeshRenderer _fireRenderer;

        private void Awake()
        {
            if (transform.childCount > 0)
            {
                // 편집기 빌드 스크립트가 이미 Tower·Fire 자식을 만들어 둔 채
                // 씬이 저장돼 있다(HiddenTreasure.cs 등과 같은 방어) — 다시
                // 만들지 않고, 불꽃 색만 지금 WorldEventState 기준으로 되돌린다.
                var fire = transform.Find("Fire");
                if (fire != null) _fireRenderer = fire.GetComponent<MeshRenderer>();
                RefreshFireTint();
                return;
            }
            Build();
        }

        public void Build()
        {
            float ground = TestMapData.Legend[TestMapData.TileAt(Gx, Gy)].Height;
            transform.position = TestMapData.WorldPos(Gx, Gy) + new Vector3(0, ground, 0);

            var tower = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tower.name = "Tower";
            Object.DestroyImmediate(tower.GetComponent<Collider>());
            tower.transform.SetParent(transform, false);
            tower.transform.localScale = new Vector3(1.0f, 3.2f, 1.0f);
            tower.transform.localPosition = new Vector3(0f, 3.2f, 0f);
            var towerMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BeaconTower (generated)" };
            towerMat.color = TowerColor;
            tower.GetComponent<MeshRenderer>().sharedMaterial = towerMat;

            var fire = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            fire.name = "Fire";
            Object.DestroyImmediate(fire.GetComponent<Collider>());
            fire.transform.SetParent(transform, false);
            fire.transform.localScale = Vector3.one * 1.1f;
            fire.transform.localPosition = new Vector3(0f, 6.8f, 0f);
            var fireMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "BeaconFire (generated)" };
            fireMat.EnableKeyword("_EMISSION");
            _fireRenderer = fire.GetComponent<MeshRenderer>();
            _fireRenderer.sharedMaterial = fireMat;
            RefreshFireTint();

            var col = GetComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = LightRadius;
        }

        /// <summary>GameBootstrap.Start()가 SaveState.TryLoad() 뒤(=Awake보다 늦게,
        /// WorldEventState가 실제로 복원된 뒤) 부른다 — Awake 시점엔 세이브가
        /// 아직 안 얹혀 있어 이미 불을 올린 세이브를 불러와도 Awake만으로는
        /// 꺼진 색으로 보일 수 있다(다른 랜드마크는 자기 자신을 Destroy해서
        /// 이 문제가 없지만, 이 오브젝트는 불을 올린 뒤에도 계속 남는다).</summary>
        public void RefreshVisualFromState() => RefreshFireTint();

        private void RefreshFireTint()
        {
            if (_fireRenderer == null) return;
            bool lit = WorldEventState.IsTriggered(EventId);
            var mat = _fireRenderer.sharedMaterial;
            Color c = lit ? LitFireColor : UnlitFireColor;
            mat.color = c;
            mat.SetColor("_EmissionColor", c * (lit ? 1.4f : 0.3f));
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!other.CompareTag("Player")) return;
            if (!WorldEventState.TryTrigger(EventId)) return;

            RefreshFireTint();
            PlayerStats.AddExp(RewardExp);
            GoldState.Add(RewardGold);

            int remaining = CountRemainingLandmarks();
            string hint = remaining > 0
                ? string.Format(GoLocalization.T("event.beacon_hint", " 아직 못 찾은 명소가 {0}곳 남았다."), remaining)
                : GoLocalization.T("event.beacon_hint_done", " 둘러볼 명소를 전부 찾았다.");
            DialogueLabel.Instance?.Show(
                string.Format(GoLocalization.T("event.beacon_lit", "봉수대에 불을 올렸다 — 경험치 +{0} · 돈 +{1}냥.{2}"),
                    RewardExp, RewardGold, hint), ToastSec);
        }

        private static int CountRemainingLandmarks()
        {
            int n = 0;
            n += Object.FindObjectsByType<HiddenTreasure>(FindObjectsSortMode.None).Length;
            n += Object.FindObjectsByType<MountainShrine>(FindObjectsSortMode.None).Length;
            n += Object.FindObjectsByType<EastGroveRelic>(FindObjectsSortMode.None).Length;
            return n;
        }
    }
}
