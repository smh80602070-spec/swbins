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
            Saga.Realm.UI.RealmTradeUi.Install(); // tasks U-0172 교역로 창(기술 창 아래 오른쪽 단추가 연다)
            Saga.Realm.UI.RealmWonderUi.Install(); // tasks U-0136 불가사의 창(기술 창 아래 왼쪽 단추가 연다)
            Saga.Realm.UI.RealmFocusUi.Install(); // tasks U-0193 방침 — 🎯 방침 단추·창(☰ 메뉴 칸, Play 때)
            Saga.Realm.UI.RealmRegionUi.Install(); // tasks U-0204 천하도 — 🗺 단추·지역 카드 창(☰ 메뉴 칸, Play 때)
            Saga.Realm.UI.RealmLawUi.Install(); // tasks U-0182 법령 — 📜 법령 단추·창(☰ 메뉴 칸, Play 때)
            Saga.Realm.UI.RealmTechUi.Install(); // tasks U-0129 기술 나무 — 📜 연구 단추·창(Play 때, 씬 재빌드 없이)
            Saga.Realm.UI.RealmTodaySource.Install(transform); // tasks U-0215 「이번 달」 창 — 명령·방침·천하 진행 읽기만(☰ 메뉴 칸, Play 때)
        }
    }
}
