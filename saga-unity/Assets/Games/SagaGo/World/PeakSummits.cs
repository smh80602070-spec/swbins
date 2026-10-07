using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-9 "정상"(웹 사가만리 ⑰) — 봉우리(107-3) 윗면에 처음 서면 발견: 금 80 + 정상 높이(m) · 경험 70(웹 경험 50 + 단사 2 → 이 판 비율로 20),
    /// 기록은 `WorldMapState`(세이브 v18 `peaksFound`), 오른 정상은 M 지도에서 ▲ 를 눌러 순간이동한다(`WorldMapUi.TeleportToPeak`).
    /// `WorldMapBuilder` 가 Play 때 붙이고 0.2초마다 플레이어 자리를 본다.
    /// </summary>
    public class PeakSummits : MonoBehaviour
    {
        public const float CheckEverySec = 0.2f;
        private float _wait;

        public static PeakSummits Instance { get; private set; }
        /// <summary>마지막 발견(진단).</summary>
        public string LastFound { get; private set; }

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Update()
        {
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckEverySec;
            var fc = FieldCombat.Instance;
            if (fc != null) Check(fc.transform.position);
        }

        /// <summary>그 자리에서 새로 오른 정상이 있으면 보상을 주고 그 번호, 없으면 -1.</summary>
        public int Check(Vector3 pos)
        {
            var peaks = GoWorldMap.Peaks;
            for (int i = 0; i < peaks.Length; i++)
            {
                var p = peaks[i];
                if (!GoWorldMap.StandsOn(p, pos) || !WorldMapState.FindPeak(p.Id)) continue;
                int gold = GoWorldMap.PeakGold(p);
                GoldState.Add(gold);
                PlayerStats.AddExp(GoWorldMap.PeakExp);
                LastFound = p.Id;
                FieldRingFx.Spawn(p.Top, TestMapData.PeakTopRadius, new Color(1f, 0.85f, 0.45f), 0.9f);
                if (DialogueLabel.Instance != null)
                    DialogueLabel.Instance.Show(string.Format(GoLocalization.T("map.peak_found", "▲ {0} 정상 — 금 +{1} · 경험 +{2} · 지도에서 이곳으로 순간이동할 수 있다"),
                        GoWorldMap.PeakName(p), gold, GoWorldMap.PeakExp), 3.5f);
                return i;
            }
            return -1;
        }
    }
}
