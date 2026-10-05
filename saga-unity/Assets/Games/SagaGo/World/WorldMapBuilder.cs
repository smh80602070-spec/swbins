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
        public Material StoneMaterial => stoneMaterial;

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
            if (GetComponent<DomainField>() == null) gameObject.AddComponent<DomainField>(); // 109-14-9 숨은 터·주간 보스
            if (GetComponent<Saga.Go.UI.DomainUi>() == null) gameObject.AddComponent<Saga.Go.UI.DomainUi>();
            if (GetComponent<GuardianBloom>() == null) gameObject.AddComponent<GuardianBloom>(); // 109-14-10 들판 보스 보상 꽃
            if (GetComponent<StoryField>() == null) gameObject.AddComponent<StoryField>(); // 109-14-12 이야기 임무 — 인물·기둥·제단·임무 적
            if (GetComponent<Saga.Go.UI.StoryUi>() == null) gameObject.AddComponent<Saga.Go.UI.StoryUi>(); // 추적 줄·대화 창·목록(F·O)
            if (GetComponent<FishingField>() == null) gameObject.AddComponent<FishingField>(); // 109-14-24 낚시터·물고기·찌·게시판
            if (GetComponent<Saga.Go.UI.FishingUi>() == null) gameObject.AddComponent<Saga.Go.UI.FishingUi>(); // 낚시 칸·게시판 창(F·T)
            if (GetComponent<DispatchField>() == null) gameObject.AddComponent<DispatchField>(); // 109-14-26 탐사 게시판
            if (GetComponent<Saga.Go.UI.DispatchUi>() == null) gameObject.AddComponent<Saga.Go.UI.DispatchUi>(); // 탐사 창(F)
            if (GetComponent<FrostField>() == null) gameObject.AddComponent<FrostField>(); // 109-14-27a 서리봉 고원(지도 밖 눈밭)
            if (GetComponent<AreaField>() == null) gameObject.AddComponent<AreaField>(); // 109-14-37 은하 나루 같은 지도 밖 독립 땅
            if (GetComponent<YardField>() == null) gameObject.AddComponent<YardField>(); // 109-14-34 갈대 나루 물가 녹슨 조선소(기중기)
            if (GetComponent<ObsField>() == null) gameObject.AddComponent<ObsField>(); // 109-14-35 시간 틈 관측소(관측대·시간 기둥)
            if (GetComponent<StationField>() == null) gameObject.AddComponent<StationField>(); // 109-14-36 옛 역참 터(돌담·마구간)
            if (GetComponent<KnotField>() == null) gameObject.AddComponent<KnotField>(); // 109-14-52 8부 무대 — 여섯 매듭·먹구름 눈
            if (GetComponent<NightEchoField>() == null) gameObject.AddComponent<NightEchoField>(); // 109-14-56b 결말 뒤 밤의 잔불
            if (GetComponent<MountField>() == null) gameObject.AddComponent<MountField>(); // 109-15 탈것·비행
            if (GetComponent<Saga.Go.UI.AchieveUi>() == null) gameObject.AddComponent<Saga.Go.UI.AchieveUi>(); // 109-14-25 업적 창(Y)·알림
            if (GetComponent<Saga.Go.UI.HuntLogUi>() == null) gameObject.AddComponent<Saga.Go.UI.HuntLogUi>(); // U-0031 사냥 기록 창(K)·알림
            if (GetComponent<Saga.Go.UI.HelpUi>() == null) gameObject.AddComponent<Saga.Go.UI.HelpUi>(); // U-0043 도움말 창(F1)
            if (GetComponent<Saga.Go.UI.WeeklyUi>() == null) gameObject.AddComponent<Saga.Go.UI.WeeklyUi>(); // U-0044 주간 도전 창(U)·알림
            if (GetComponent<Saga.Go.UI.CycleUi>() == null) gameObject.AddComponent<Saga.Go.UI.CycleUi>(); // U-0045 별배 재출항 창(N)
            if (GetComponent<EggWalker>() == null) gameObject.AddComponent<EggWalker>(); // U-0046 신수 알 걸음 세기·동행 몸(에셋이 놓이면)
            if (GetComponent<Saga.Go.UI.EggUi>() == null) gameObject.AddComponent<Saga.Go.UI.EggUi>(); // U-0046 신수 알·동행 창(I)
            if (GetComponent<Saga.Go.UI.MenuHubUi>() == null) gameObject.AddComponent<Saga.Go.UI.MenuHubUi>(); // 사냥 기록·도움말·주간 도전·재출항·신수 알 단추를 "메뉴" 하나로(오른쪽 가장자리 겹침 해소)
            if (GetComponent<HomesteadField>() == null) gameObject.AddComponent<HomesteadField>(); // U-0032 쉼터 마당(표지·놓은 소품)
            if (GetComponent<Saga.Go.UI.HomesteadUi>() == null) gameObject.AddComponent<Saga.Go.UI.HomesteadUi>(); // U-0032 쉼터 창(J)
        }
    }
}
