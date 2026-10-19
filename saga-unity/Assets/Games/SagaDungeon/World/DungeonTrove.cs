using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 다양화" — saga-dungeon
    /// 웹판 `room.chest`(js/dungeon.js:336, 2141-2149)를 옮겼다. 웹판은
    /// `room.cleared`(방의 몬스터를 다 치웠는지)를 봐야 열리는데, 이
    /// 슬라이스는 `DungeonEnemy.CountAliveInRoom(roomId) == 0`을 같은
    /// 뜻으로 쓴다(2026-09-12 "방 종류 나머지" 슬라이스에서 방이 둘로
    /// 늘며 씬 전체 합계였던 `Active.Count`를 방별로 갈랐다 — 안 그러면
    /// Room2 몬스터가 살아 있는 동안 Room1 상자가 안 열리는 버그였다).
    /// 돈 보상은 웹판 `dropGold(room, ..., 3)`의 배율 3을 잡졸 확정
    /// 보상(8골드, `DungeonEnemy.cs`)에 그대로 곱해 24골드로 잡았다 —
    /// 웹판의 절차적 아이템 드랍(quality 22)은 이번 슬라이스 범위 밖
    /// (장비 희귀도·세공은 VERTICAL_SLICE_DUNGEON.md "제외" 참고)이라
    /// 아이템은 안 준다.
    /// </summary>
    public class DungeonTrove : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const int RewardGold = 24; // dropGold 배율 3 × 잡졸 보상 8
        private const float ToastSec = 4f;

        [SerializeField] private string roomId = "room1";

        private static readonly Color ChestColor = new Color(0.55f, 0.42f, 0.12f);

        private bool _used;
        private Transform _player;

        /// <summary>"DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스 —
        /// `DungeonFloorRunner`가 런타임에 즉석으로 만든 POI에 값을 채우는
        /// 정식 API(`DungeonEnemy.SetSpawnContext()`와 같은 결). Awake가
        /// 아직 안 돈 상태(비활성 GameObject)에서만 의미가 있다.</summary>
        public void SetRoomId(string newRoomId) => roomId = newRoomId;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.2f, 0.8f, 0.8f);
            visual.transform.localPosition = new Vector3(0f, 0.4f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonTrove (generated)" };
            mat.color = ChestColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_used || _player == null) return;
            if (DungeonEnemy.CountAliveInRoom(roomId) > 0) return; // 웹판 room.cleared와 같은 뜻.
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _used = true;
            HeroState.AddGold(RewardGold);
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("trove.gold", "보물상자 — 돈 +{0}냥"), RewardGold), ToastSec);
        }
    }
}
