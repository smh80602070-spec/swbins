using System.Globalization;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// 화면 위 항상 보이는 최소 상태 표시줄 — 레벨/경험치/돈/장비. 새
    /// 인벤토리·장비창 화면을 만드는 대신(PLAN.md 63~65장, 이 슬라이스는
    /// 그 화면 없이 Inventory.cs의 "더 센 장비 자동 장착"으로 조작을
    /// 대신한다) 지금 뭘 끼고 있는지 최소한은 눈에 보이게 한다.
    /// DebugHud.cs(개발자용, 디버그 빌드에서만)와 달리 이건 릴리즈
    /// 빌드에서도 항상 보인다.
    /// </summary>
    public class PlayerHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        private const float RefreshGapSec = 0.5f;
        private float _timer;

        private void Start()
        {
            Refresh();
        }

        private void Update()
        {
            _timer += Time.unscaledDeltaTime;
            if (_timer < RefreshGapSec) return;
            _timer = 0f;
            Refresh();
        }

        private void Refresh()
        {
            if (label == null) return;
            string weapon = ItemData.Get(Inventory.EquippedWeaponId)?.Name ?? GoLocalization.T("item.bare_hands");
            string armor = ItemData.Get(Inventory.EquippedArmorId)?.Name ?? GoLocalization.T("item.plain_clothes");
            string exp = string.Format(GoLocalization.T("hud.exp"), PlayerStats.Exp.ToString("N0", CultureInfo.InvariantCulture), PlayerStats.ExpToNext.ToString("N0", CultureInfo.InvariantCulture));
            string gold = string.Format(GoLocalization.T("hud.gold"), GoldState.Gold);
            label.text = $"Lv.{PlayerStats.Level}  ({exp})  {gold}\n" +
                         $"{weapon} · {armor}";
        }
    }
}
