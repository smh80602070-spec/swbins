using UnityEngine;
using Saga.Forest.Audio;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md — GO/DUNGEON의 World/GameBootstrap.cs와
    /// 같은 역할(네임스페이스만 변경) — 씬이 다 올라온 뒤 저장 파일이
    /// 있으면 위치·채집 개수를 되돌린다. 이 슬라이스엔 정적 배칭할
    /// 대상(DUNGEON의 "Room"처럼 매번 새로 만드는 메시)이 따로 없어
    /// `CombineStaticBatches()` 같은 절차는 아직 없다.
    /// </summary>
    public class ForestBootstrap : MonoBehaviour
    {
        // 67장 "사운드" BGM(2026-09-15, ForestAudio.cs 클래스 주석 참고).
        [SerializeField] private AudioClip bgmClip;
        // PLAN.md 109-12-1 떠돌이 방문객 — 빌린 몸 표(다른 판 씬이 이미 쓰는 몸, 이름 순). 없는 PC 는 null → 캡슐.
        [SerializeField] private string[] visitorBodyNames = new string[0];
        [SerializeField] private GameObject[] visitorBodyModels = new GameObject[0];

        private void Start()
        {
            ForestSaveState.TryLoad();
            Saga.Core.SagaFlow.Enter("forest", ForestSaveState.Save); // PLAN.md 110 ② — 자동 저장·일시정지 메뉴·타이틀로.
            ForestSettingsState.ApplyToAllScalers();
            ForestSettingsState.ApplyGraphicsQuality();
            ForestAudio.PlayBgm(bgmClip);
            ForestBgmScene.Attach(gameObject); // tasks U-0021 — 장면별 곡(town·field·battle, 파일 없으면 폴백)
            if (GetComponent<ForestZoneTracker>() == null) gameObject.AddComponent<ForestZoneTracker>(); // PLAN.md 108 ② 존 자막
            ForestVisitorRunner.Install(visitorBodyNames, visitorBodyModels); // PLAN.md 109-12-1 떠돌이 방문객(세이브 뒤라 오늘 기록을 읽는다)
            ForestScenarioRunner.Install(); // PLAN.md 109-16 시나리오 — 장면 상자·목표 한 줄(Play 때, 씬 재빌드 없이)
            MountField.Install(); // PLAN.md 109-15 탈것·비행 — H 타기·Shift+H 고르기(Play 때, 씬 재빌드 없이)

            // PLAN.md 101-2 5.3 "마을 번들" — 실시간 완성은 이벤트로,
            // 로드 직후 "이미 완성돼 있던 것"은 이벤트 없이 상태를 직접
            // 훑어 조용히 다시 세운다(ForestMuseumState.cs 클래스 주석 참고
            // — Restore()가 이벤트를 안 쏘는 이유).
            ForestMuseumState.BundleCompleted += OnBundleCompleted;
            ForestMuseumState.AllBundlesCompleted += OnAllBundlesCompleted;
            foreach (ForestMuseumState.Category c in System.Enum.GetValues(typeof(ForestMuseumState.Category)))
            {
                if (ForestMuseumState.IsBundleDone(c))
                {
                    ForestMuseumDecorator.SpawnBundleDecoration(c, ForestCollectSpot.PositionOf(c));
                }
            }
            if (ForestMuseumState.AllBundlesDone)
            {
                ForestMuseumDecorator.SpawnFlag(Vector3.zero);
            }
        }

        private void OnDestroy()
        {
            ForestMuseumState.BundleCompleted -= OnBundleCompleted;
            ForestMuseumState.AllBundlesCompleted -= OnAllBundlesCompleted;
        }

        private void OnBundleCompleted(ForestMuseumState.Category category)
        {
            ForestMuseumDecorator.SpawnBundleDecoration(category, ForestCollectSpot.PositionOf(category));
            DialogueLabel.Instance?.Show(
                ForestLocalization.T("museum.bundle_done_toast", "🎉 도감 한 갈래를 다 채웠다 — 마을에 새 시설이 생겼다!"), 4f);
        }

        private void OnAllBundlesCompleted()
        {
            ForestMuseumDecorator.SpawnFlag(Vector3.zero);
            DialogueLabel.Instance?.Show(
                ForestLocalization.T("museum.all_done_toast", "🚩 네 갈래를 모두 채웠다 — 마을 어귀에 깃발이 섰다!"), 4f);
        }
    }
}
