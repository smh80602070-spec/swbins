using System.Collections.Generic;
using UnityEngine;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 107-3 — Play 시작 때 순간이동 지점 다섯·옛 망루·보물 상자 열여섯(107-4)을 세우고 지도 화면(`WorldMapUi`)을 붙인다.
    /// 씬 빌더는 돌 재질만 넘긴다(`FieldSpawner` 와 같은 결 — 상태를 가진 런타임 존재라 씬에 굳히지 않는다).
    /// </summary>
    public class WorldMapBuilder : MonoBehaviour
    {
        [SerializeField] private Material stoneMaterial;

        public readonly List<WaypointStone> Stones = new List<WaypointStone>();
        public Watchtower Tower { get; private set; }
        public readonly List<TreasureChest> Chests = new List<TreasureChest>();

        public static WorldMapBuilder Instance { get; private set; }

        private void Awake() => Instance = this;

        private void Start()
        {
            foreach (var w in Saga.Go.Data.GoWorldMap.Waypoints)
            {
                Stones.Add(WaypointStone.Spawn(w, transform, stoneMaterial));
            }
            Tower = Watchtower.Spawn(transform, stoneMaterial);
            foreach (var c in Saga.Go.Data.GoTreasure.Chests) // 107-4 보물 상자
            {
                Chests.Add(TreasureChest.Spawn(c, transform, stoneMaterial));
            }
            if (GetComponent<WorldMapUi>() == null) gameObject.AddComponent<WorldMapUi>();
            if (GetComponent<RegionAtmosphere>() == null) gameObject.AddComponent<RegionAtmosphere>(); // 107-3 지역 바이옴
            if (GetComponent<RegionMissionHud>() == null) gameObject.AddComponent<RegionMissionHud>(); // 107-8 지역 사명 사슬
            if (GetComponent<PeakSummits>() == null) gameObject.AddComponent<PeakSummits>(); // 109-9 정상 발견
            if (GetComponent<GoOrbField>() == null) gameObject.AddComponent<GoOrbField>(); // 109-14-3a 수집 구슬·봉헌
            if (GetComponent<ElementalSight>() == null) gameObject.AddComponent<ElementalSight>(); // 109-14-3b 원소 시야
            if (GetComponent<CookField>() == null) gameObject.AddComponent<CookField>(); // 109-14-6 채집·솥
            if (GetComponent<Saga.Go.UI.CookingUi>() == null) gameObject.AddComponent<Saga.Go.UI.CookingUi>(); // 109-14-6 요리 창(G)
        }
    }
}
