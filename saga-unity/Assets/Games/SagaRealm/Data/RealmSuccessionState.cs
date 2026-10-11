using System;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 101-2 5-8 "군주 사망·계승"(웹판 `saga-web/saga-realm/PLAN.md`
    /// 177행) — 무장 풀(<see cref="RealmOfficerPool"/>)이 3명 고정이고 더
    /// 뽑을 후보가 없어(웹판·saga-godot은 무장이 258명이라 이 문제가 없다)
    /// 원작처럼 무장이 죽는 버전을 그대로 옮기면 로스터가 영구히 줄어들
    /// 뿐 회복 방법이 없다. 그렇다고 "일시 능력치 정지"로 죽음 자체를
    /// 빼면 "후계자가 자리를 잇는다"는 계승의 알맹이가 사라진다(2026-09-20
    /// 사용자와 상의).
    ///
    /// **재해석**: 아무도 죽지 않되, "허창(본거지) 배치" 자리 자체가
    /// 실제로 다른 사람에게 넘어간다 — 매달 작은 확률로 허창에 배치된
    /// 무장이 연로해 물러나면, 로스터의 다른 무장 중 통솔(Command) 최고가
    /// 허창을 물려받는다(`RealmCityState.SwapOfficerCities`, 이미 있는
    /// 배치 딕셔너리를 맞바꿀 뿐이라 새 세이브 필드가 필요 없다). 대가로
    /// 허창 치안이 절반으로 깎인다(성 함락 직후와 같은 기존 규칙 재사용
    /// — `RealmCityState.cs` "record.Sec = 30" 대응). 웹판·saga-godot
    /// 둘 다 "위험이 크므로 손잡이 뒤에" 원칙 그대로 기본 꺼짐
    /// (`RealmSettingsState.SuccessionOn`).
    /// </summary>
    public static class RealmSuccessionState
    {
        private const float MonthlyChance = 0.02f;

        /// <summary>완성된 안내 문구 — UI(RealmCommandUi)가 구독해 토스트로 낸다.</summary>
        public static event Action<string> Occurred;

        /// <summary>`RealmSessionTracker`가 "정확히 한 달 넘어갔을 때만"
        /// 부른다(`RealmEventState.RollForMonth()`와 같은 게이트).</summary>
        public static void RollForMonth()
        {
            if (!RealmSettingsState.SuccessionOn) return;
            if (RealmCityState.RosterIds.Count < 2) return; // 물려받을 사람이 없으면 스킵.
            if (UnityEngine.Random.value > MonthlyChance) return;

            string capitalId = FindCapitalOfficer();
            if (capitalId == null) return; // 허창에 아무도 안 남아 있으면(특수 상황) 건너뜀.

            string successorId = FindBestSuccessor(capitalId);
            if (successorId == null) return;

            RealmCityState.SwapOfficerCities(capitalId, successorId);

            var record = RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId);
            if (record != null) record.Sec /= 2;

            string msg = string.Format(
                RealmLocalization.T("succession.occurred", "{0}이(가) 연로하여 허창을 {1}에게 물려주었다. 정권 이양으로 치안이 흔들렸다."),
                OfficerName(capitalId), OfficerName(successorId));
            Occurred?.Invoke(msg);
        }

        public static string FindCapitalOfficer()
        {
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) == RealmOfficerPool.StartingOfficerCityId) return id;
            }
            return null;
        }

        private static string FindBestSuccessor(string excludeId)
        {
            string best = null;
            int bestCommand = -1;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (id == excludeId) continue;
                var officer = RealmOfficerPool.Get(id);
                if (officer != null && officer.Command > bestCommand)
                {
                    bestCommand = officer.Command;
                    best = id;
                }
            }
            return best;
        }

        private static string OfficerName(string id) => RealmOfficerPool.Get(id)?.Name ?? id;
    }
}
