using UnityEngine;
using Saga.Realm.Audio;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>SagaGo/SagaStory GameBootstrap.cs와 같은 역할 — 씬이 다
    /// 올라온 뒤 저장 파일이 있으면 RealmCityState를 되돌린다.</summary>
    public class GameBootstrap : MonoBehaviour
    {
        // 67장 "사운드" BGM(2026-09-15, RealmAudio.cs 참고).
        [SerializeField] private AudioClip bgmClip;

        private void Start()
        {
            RealmSaveState.TryLoad();
            Saga.Core.SagaFlow.Enter("realm", RealmSaveState.Save); // PLAN.md 110 ② — 자동 저장·일시정지 메뉴·타이틀로.
            RealmSettingsState.ApplyToAllScalers();
            RealmSettingsState.ApplyGraphicsQuality();
            RealmAudio.PlayBgm(bgmClip);
            RealmBgmScene.Attach(gameObject); // tasks U-0021 — 장면별 곡(town·field·battle, 파일 없으면 폴백)
            Saga.Realm.UI.RealmMountUi.Install(); // PLAN.md 109-15 명마·비행 — 명마 패널·날기 단추·H 키(Play 때, 씬 재빌드 없이)
        }
    }
}
