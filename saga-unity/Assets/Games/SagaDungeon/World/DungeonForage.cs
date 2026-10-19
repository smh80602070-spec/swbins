using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 마지막" — saga-dungeon
    /// 웹판 `room.forage`(채집·낚시방, js/dungeon.js:394-412, 2223-2243)를
    /// 옮겼다. 약초 셋은 **항아리와 같은 손짓**(방을 안 치워도, 닿기만
    /// 하면)인데, 웹판은 단약(인벤 아이템)을 주는 반면 이번 슬라이스엔
    /// 인벤토리 시스템이 없어 그 자리를 `DungeonWell.cs`와 같은 결로
    /// 대신했다(체력 소량 회복 — "약초=치유"라는 뜻은 그대로 산다). 못은
    /// **우물·사당과 같은 손짓**(방을 다 치운 뒤 한 번)인데, 웹판의
    /// 확률 노획(금/재료/아이템)도 인벤 없이는 그대로 못 옮겨 `DungeonVein
    /// .cs`와 같은 단순화(확정 경험치·돈)로 갈랐다.
    /// </summary>
    public class DungeonForage : MonoBehaviour
    {
        private const float HerbTriggerRadius = 1.6f;
        private const int HerbHeal = 6; // 단약 대신 즉석 소량 회복 — 3개 다 캐면 18(우물 40%보다 훨씬 적다)
        private const float PondTriggerRadius = 2.0f;
        private const int PondRewardExp = 8;
        private const int PondRewardGold = 14;
        private const float ToastSec = 3.5f;

        [SerializeField] private string roomId = "room1";

        /// <summary>"DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스 —
        /// `DungeonFloorRunner`가 런타임에 즉석으로 만든 POI에 값을 채우는
        /// 정식 API. Awake가 아직 안 돈 상태에서만 의미가 있다.</summary>
        public void SetRoomId(string newRoomId) => roomId = newRoomId;

        private static readonly Vector3[] HerbOffsets =
        {
            new Vector3(-2f, 0f, 3f),
            new Vector3(0f, 0f, 3.5f),
            new Vector3(2f, 0f, 3f),
        };

        private static readonly Vector3 PondOffset = new Vector3(4f, 0f, 3f);

        private static readonly Color HerbColor = new Color(0.35f, 0.62f, 0.28f); // 산나물 — 초록
        private static readonly Color PondColor = new Color(0.25f, 0.45f, 0.6f); // 못 — 짙은 청색

        private readonly Transform[] _herbs = new Transform[3];
        private readonly bool[] _picked = new bool[3];
        private Transform _pond;
        private bool _pondUsed;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            else RestoreChildren();

            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            for (int i = 0; i < HerbOffsets.Length; i++)
            {
                var herb = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                herb.name = $"Herb_{i}";
                herb.transform.SetParent(transform, false);
                herb.transform.localScale = Vector3.one * 0.4f;
                herb.transform.localPosition = HerbOffsets[i] + new Vector3(0f, 0.3f, 0f);
                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonForageHerb (generated)" };
                mat.color = HerbColor;
                herb.GetComponent<MeshRenderer>().sharedMaterial = mat;
                Saga.Core.Colliders.Strip(herb);
                _herbs[i] = herb.transform;
            }

            var pond = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pond.name = "Pond";
            pond.transform.SetParent(transform, false);
            pond.transform.localScale = new Vector3(1.6f, 0.1f, 1.6f);
            pond.transform.localPosition = PondOffset + new Vector3(0f, 0.05f, 0f);
            var pondMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonForagePond (generated)" };
            pondMat.color = PondColor;
            pond.GetComponent<MeshRenderer>().sharedMaterial = pondMat;
            Saga.Core.Colliders.Strip(pond);
            _pond = pond.transform;
        }

        private void RestoreChildren()
        {
            for (int i = 0; i < 3; i++)
            {
                var herb = transform.Find($"Herb_{i}");
                if (herb != null) _herbs[i] = herb;
            }
            var pond = transform.Find("Pond");
            if (pond != null) _pond = pond;
        }

        private void Update()
        {
            if (_player == null) return;

            for (int i = 0; i < 3; i++)
            {
                if (_picked[i] || _herbs[i] == null) continue;
                if (Vector3.Distance(_herbs[i].position, _player.position) > HerbTriggerRadius) continue;

                _picked[i] = true;
                _herbs[i].gameObject.SetActive(false);
                HeroState.HealBy(HerbHeal);
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("forage.herb", "산나물을 캤다 — 체력 +{0}"), HerbHeal), ToastSec);
            }

            if (!_pondUsed && _pond != null && DungeonEnemy.CountAliveInRoom(roomId) == 0
                && Vector3.Distance(_pond.position, _player.position) <= PondTriggerRadius)
            {
                _pondUsed = true;
                HeroState.AddExp(PondRewardExp);
                HeroState.AddGold(PondRewardGold);
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("forage.pond", "손맛 · 무언가 걸렸다 — 경험치 +{0} · 돈 +{1}냥"), PondRewardExp, PondRewardGold), ToastSec);
            }
        }
    }
}
