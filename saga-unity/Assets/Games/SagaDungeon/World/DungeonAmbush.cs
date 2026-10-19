using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md(saga-dungeon 웹판) 35장 "랜덤 이벤트" — 목록의 여덟 종류
    /// 중 Merchant·Treasure·NPC Rescue·Elite Monster·Shrine·Mini Boss는
    /// 이미 고정 콘텐츠(행상·트로브·구출·정예·성소·미니보스)로 다 있다.
    /// 남은 **Monster Ambush**·**Secret Area**만 옮겼는데, 이 둘을 각각
    /// 새 방/새 지역으로 만들면 파급이 커서(방 종류 마지막 슬라이스가 이미
    /// 방 넷을 다 채웠다) 대신 GO `LuckyCairn.cs`처럼 **한 자리에서 몇
    /// 번이고 다시 굴릴 수 있는 가중치 룰렛**으로 두 결과를 합쳤다 —
    /// "매복"은 그 자리에서 즉석으로 잡졸 하나가 튀어나오는 것으로,
    /// "비밀 지역"은 새 공간 없이 그 자리에 숨겨 둔 주머니(돈)를 발견하는
    /// 것으로 단순화했다. LuckyCairn과 달리 **기원 비용을 받지 않는다** —
    /// 결과 대부분(55%)이 "아무 일 없음"이고 매복은 돈이 아니라 전투
    /// 하나를 더 던지는 것이라, 반복 방문이 GoldState/HeroState 경제를
    /// 무너뜨릴 만큼 이득이 크지 않다고 판단(자리도 하나뿐이라 실제로는
    /// 25초에 한 번, 15% 확률로 12냥이 전부).
    /// **DUNGEON은 트리거 콜라이더 대신 Update() 폴링 거리 판정을 쓰는
    /// 관례**(DungeonShrine.cs·DungeonMerchant.cs 등)라 LuckyCairn의
    /// SphereCollider 방식을 그대로 베끼지 않고 그 관례를 따랐다.
    /// </summary>
    public class DungeonAmbush : MonoBehaviour
    {
        private const float TriggerRadius = 2.2f;
        private const float CooldownSec = 25f;
        private const float ToastSec = 3.5f;

        [SerializeField] private string roomId = "room2";
        [SerializeField] private GameObject enemyModelPrefab; // BuildTestDungeonScene.cs가 character-d를 채운다.

        private struct Outcome
        {
            public string Key;
            public string Text;
            public bool SpawnAmbush;
            public int Gold;
            public float Weight;
        }

        // 합 100 — 절반 이상은 아무 일 없고, 매복이 보물보다 두 배 잦다
        // (전투가 이 판 정체성이라 "위험"이 "이득"보다 흔한 쪽으로).
        private static readonly Outcome[] Outcomes =
        {
            new Outcome { Key = "ambush.calm", Text = "고요하다 — 아무 일도 없었다.", SpawnAmbush = false, Gold = 0, Weight = 55f },
            new Outcome { Key = "ambush.attack", Text = "매복! 그늘에서 황건적이 튀어나왔다!", SpawnAmbush = true, Gold = 0, Weight = 30f },
            new Outcome { Key = "ambush.purse", Text = "숨겨 둔 주머니를 찾아냈다.", SpawnAmbush = false, Gold = 12, Weight = 15f },
        };

        private static readonly Color MarkerColor = new Color(0.35f, 0.3f, 0.2f); // 낙엽·잔해 더미 — 눈에 덜 띄는 흙빛

        private float _lastRollTime = -CooldownSec;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(0.6f, 0.12f, 0.6f); // 낮고 넓적한 잔해 더미 — 다른 POI보다 눈에 덜 띈다.
            visual.transform.localPosition = new Vector3(0f, 0.12f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonAmbush (generated)" };
            mat.color = MarkerColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_player == null) return;
            if (Time.time - _lastRollTime < CooldownSec) return;
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _lastRollTime = Time.time;
            var outcome = Roll();

            if (outcome.Gold > 0) HeroState.AddGold(outcome.Gold);
            if (outcome.SpawnAmbush) SpawnAmbushEnemy();

            string reward = outcome.Gold > 0 ? string.Format(DungeonLocalization.T("ambush.gold", " (돈 +{0}냥)"), outcome.Gold) : "";
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("ambush.toast", "필드 사건 — {0}{1}"),
                DungeonLocalization.T(outcome.Key, outcome.Text), reward), ToastSec);
        }

        /// <summary>비활성 상태로 만든 뒤 값을 채우고 활성화 — DungeonEnemy
        /// .Awake()가 modelPrefab을 못 본 채로 먼저 도는 걸 막는다
        /// (DungeonEnemy.SetSpawnContext() 클래스 주석 참고).</summary>
        private void SpawnAmbushEnemy()
        {
            var go = new GameObject("Enemy_HwangGeon_Ambush");
            go.SetActive(false);
            go.transform.position = transform.position + new Vector3(1.5f, 0f, 0f);
            var enemy = go.AddComponent<DungeonEnemy>();
            enemy.SetSpawnContext(roomId, enemyModelPrefab);
            go.SetActive(true);
        }

        private static Outcome Roll()
        {
            float total = 0f;
            foreach (var o in Outcomes) total += o.Weight;

            float roll = Random.value * total;
            float acc = 0f;
            foreach (var o in Outcomes)
            {
                acc += o.Weight;
                if (roll <= acc) return o;
            }
            return Outcomes[0];
        }
    }
}
