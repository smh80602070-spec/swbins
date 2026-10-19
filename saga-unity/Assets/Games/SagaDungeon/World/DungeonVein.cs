using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 마지막"(2026-09-12)
    /// — saga-dungeon 웹판 `room.vein`(채광방, js/dungeon.js:357,
    /// 2163-2172)을 옮겼다. 웹판은 광맥을 캐면 세공 재료 둘이 확정으로
    /// 나오는데, 이때는 세공 시스템 자체가 없어 `DungeonShrine.cs`와
    /// 같은 단순화(재료 대신 경험치·돈 확정 지급)로 대신했었다.
    /// **"세공·행상 재고 굴리기·도감" 슬라이스에서 소켓 시스템이 생겨
    /// 원래 의도대로 되돌렸다** — 돈 대신 보석 하나(`GemData.cs`,
    /// `HeroState.SocketIfBetter()`)를 확정으로 준다(둘째 소켓이 없어
    /// 웹판의 "재료 둘"은 하나로 줄었다), 경험치는 그대로. `DungeonTrove
    /// .cs`와 같은 이유로 `room.cleared` 대신 `DungeonEnemy.
    /// CountAliveInRoom(roomId) == 0`을 씀.
    /// </summary>
    public class DungeonVein : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const int RewardExp = 15;
        private const string RewardGemId = "gem_jade";
        private const float ToastSec = 4f;

        [SerializeField] private string roomId = "room1";

        private static readonly Color VeinColor = new Color(0.42f, 0.4f, 0.38f); // 광석 — 잿빛 바위

        private bool _used;
        private Transform _player;

        /// <summary>"DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스 —
        /// `DungeonFloorRunner`가 런타임에 즉석으로 만든 POI에 값을 채우는
        /// 정식 API. Awake가 아직 안 돈 상태에서만 의미가 있다.</summary>
        public void SetRoomId(string newRoomId) => roomId = newRoomId;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.3f, 0.6f, 1.1f); // 낮게 눌린 광맥 덩어리
            visual.transform.localPosition = new Vector3(0f, 0.3f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonVein (generated)" };
            mat.color = VeinColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_used || _player == null) return;
            if (DungeonEnemy.CountAliveInRoom(roomId) > 0) return; // 웹판 room.cleared와 같은 뜻.
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _used = true;
            HeroState.AddExp(RewardExp);
            bool socketed = HeroState.SocketIfBetter(RewardGemId);
            var gem = GemData.Get(RewardGemId);
            DialogueLabel.Instance?.Show(
                string.Format(DungeonLocalization.T("vein.mined", "광맥 · 캐냈다 — 경험치 +{0}, {1}을(를) 얻었다{2}"), RewardExp, gem.Name,
                    socketed ? DungeonLocalization.T("vein.socketed", " — 바로 세공했다.") : "."),
                ToastSec);
        }
    }
}
