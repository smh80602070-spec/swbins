using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0167 5천하 시정 위임 진단 — `PlaytestRealmSlice` 가 불가사의 진단 뒤에 부른다(한 프레임 안).
    /// 고름(치안 45 밑 = 치안 · 가장 모자란 것 · 다 참 = 없음) · 켜면 이 달 성마다 하나(명령 낸 성은 다시 안 냄) · 같은 달 두 번 = 0 ·
    /// 다음 달이면 저절로 다시 · 금 바닥(켠 때 금 밑으로 안 씀) = 0 · 끄면 달이 바뀌어도 안 냄 · 단추. 끝나면 세이브 JSON 으로 되돌린다.
    /// </summary>
    public static class PlaytestRealmAutoRule
    {
        private const string T = "[PlaytestRealmSlice] autorule";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var rule = RealmAutoRule.Instance;
            if (rule == null || rule.ToggleButton == null) { Fail("RealmAutoRule·단추 없음"); return false; }
            string json0 = RealmSaveState.ToJson();
            string m = "";
            try
            {
                rule.SetOn(false);
                // 고름 — 상한 900·치안 100
                System.Func<string, int> cap = k => k == "sec" ? 100 : 900;
                string a = RealmAutoRule.Pick(new RealmCityRecord { Agri = 500, Comm = 500, Tech = 500, Sec = 30 }, cap);
                string b = RealmAutoRule.Pick(new RealmCityRecord { Agri = 100, Comm = 800, Tech = 800, Sec = 80 }, cap);
                string c = RealmAutoRule.Pick(new RealmCityRecord { Agri = 900, Comm = 900, Tech = 900, Sec = 100 }, cap);
                if (a != "sec" || b != "agri" || c != null) Fail($"고름 {a}·{b}·{c ?? "없음"}");

                // 켬 — 이 달 성마다 하나(앞 진단이 이 달 장수를 다 썼을 수 있어 새 달에서)
                RealmCityState.NextMonth();
                RealmCityState.AddGold(20000);
                int cities = RealmCityState.ActiveCityIds.Count;
                string here = RealmCityState.CurrentCity;
                rule.SetOn(true);
                int n1 = rule.LastCount;
                if (n1 < 1)
                {
                    int free = 0;
                    foreach (var id in RealmCityState.ActiveCityIds) if (RealmCityState.OrderThisMonth(id) == null) free++;
                    Fail($"켰는데 명령 0(성 {cities}·이 달 명령 안 낸 성 {free}·금 {RealmCityState.Gold}·바닥 {rule.GoldFloor}·까닭 {rule.LastSkip})");
                }
                int marked = 0;
                foreach (var id in RealmCityState.ActiveCityIds) if (RealmCityState.OrderThisMonth(id) != null) marked++;
                if (marked < n1) Fail($"명령 낸 성 {marked} < {n1}");
                if (RealmCityState.CurrentCity != here) Fail($"지금 성이 바뀜 {here}→{RealmCityState.CurrentCity}");
                m += $" 성 {cities}·이 달 {n1}({string.Join(" / ", rule.LastLines)})";
                if (rule.RunMonth() != 0) Fail("같은 달 두 번째도 냄");

                // 다음 달 — 저절로 다시
                RealmCityState.NextMonth();
                if (rule.LastCount < 1) Fail("다음 달에 다시 안 냄");
                m += $" · 다음 달 {rule.LastCount}";

                // 끄면 달이 바뀌어도 안 냄
                rule.SetOn(false);
                RealmCityState.NextMonth();
                int left = 0;
                foreach (var id in RealmCityState.ActiveCityIds) if (RealmCityState.OrderThisMonth(id) != null) left++;
                if (left != 0) Fail($"끈 뒤 명령 {left}");

                // 금 바닥 — 켠 때 금(10) 밑으로 안 씀
                RealmCityState.TrySpendGold(RealmCityState.Gold - 10);
                rule.SetOn(true);
                if (rule.GoldFloor != 10 || rule.LastCount != 0 || RealmCityState.Gold != 10) Fail($"금 바닥 {rule.GoldFloor}·명령 {rule.LastCount}·금 {RealmCityState.Gold}");
                rule.SetOn(false);

                // 단추
                rule.ToggleButton.onClick.Invoke();
                bool on = rule.On;
                rule.ToggleButton.onClick.Invoke();
                if (!on || rule.On) Fail("단추 켜고 끄기");
            }
            finally
            {
                rule.SetOn(false);
                RealmSaveState.ApplyJson(json0);
            }
            if (_ok) Debug.Log($"{T} OK - 5천하 시정 위임(고름 셋·켜면 성마다 하나·같은 달 0·다음 달 다시·끄면 안 냄·금 바닥·단추) |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
