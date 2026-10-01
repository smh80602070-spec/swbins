using UnityEngine;
using Saga.Core;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>
    /// REALM 배경음 장면(tasks U-0021) — 싸움터가 열려 있으면 `battle`, 천하 지도를 보고 있으면 `field`, 성 디오라마(경영)면 `town`.
    /// `GameBootstrap` 이 시작 때 붙인다.
    /// </summary>
    public static class RealmBgmScene
    {
        public static void Attach(GameObject go) => BgmSceneDriver.Attach(go, Pick);

        public static string Pick()
        {
            if (RealmBattlefield.Active != null) return BgmSceneDriver.Battle;
            return RealmMapState.ViewingMap ? "field" : "town";
        }
    }
}
