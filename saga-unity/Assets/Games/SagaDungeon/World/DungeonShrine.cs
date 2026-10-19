using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 다양화" — saga-dungeon
    /// 웹판 `room.shrine`(js/dungeon.js:340, 2157-2162)을 옮겼다. 웹판은
    /// `shrineBoon()`으로 여러 은사 중 하나를 사람이 직접 고르는 선택
    /// UI인데, 그 선택 화면·은사 목록 전체는 이번 슬라이스 범위 밖(신규
    /// UI·밸런스 표가 필요한 큰 손질)이라 GO의 `MountainShrine.cs`가 이미
    /// 쓴 단순화(가호 = 경험치+돈 확정 지급)를 그대로 재사용했다 — 선택할
    /// 게 하나뿐이니 화면도 필요 없다. `DungeonTrove.cs`와 같은 이유로
    /// `room.cleared` 대신 `DungeonEnemy.CountAliveInRoom(roomId) == 0`을
    /// 씀(2026-09-12 "방 종류 나머지" 슬라이스에서 방별로 갈랐다).
    /// </summary>
    public class DungeonShrine : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const int RewardExp = 30; // GO MountainShrine.cs와 같은 단순화 값
        private const int RewardGold = 20;
        private const float ToastSec = 4f;

        [SerializeField] private string roomId = "room1";

        private static readonly Color ShrineColor = new Color(0.5f, 0.3f, 0.6f);

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
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(0.8f, 1.0f, 0.8f);
            visual.transform.localPosition = new Vector3(0f, 1.0f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonShrine (generated)" };
            mat.color = ShrineColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_used || _player == null) return;
            if (DungeonEnemy.CountAliveInRoom(roomId) > 0) return; // 웹판 room.cleared와 같은 뜻.
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _used = true;
            int levelBefore = HeroState.Level;
            HeroState.AddExp(RewardExp);
            HeroState.AddGold(RewardGold);
            string msg = string.Format(DungeonLocalization.T("shrine.blessed_reward", "성소 · 가호를 받았다 — 경험치 +{0} · 돈 +{1}냥"), RewardExp, RewardGold);
            if (HeroState.Level > levelBefore) msg += string.Format(DungeonLocalization.T("combat.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, HeroState.Level);
            DialogueLabel.Instance?.Show(msg, ToastSec);
        }
    }
}
