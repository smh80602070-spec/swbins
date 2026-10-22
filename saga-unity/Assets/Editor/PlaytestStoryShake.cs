using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0159(웹 W-0240) 4종횡 흔들림 규격 — `PlaytestStorySlice` 가 부른다. 보통 4px/120ms · 거함타(100 이상) 5px/160ms · 급소 8px/220ms 를
    /// 급소 0.12 기준 비례로 — 표(`StoryCombat.ShakeFor`)만 본다(순수).
    /// </summary>
    public static class PlaytestStoryShake
    {
        private const string T = "[PlaytestStorySlice] shake";

        public static bool Run()
        {
            bool ok = true;
            void Want(float dmg, bool crit, float px, float sec)
            {
                var s = StoryCombat.ShakeFor(dmg, crit);
                float wantMag = StoryCombat.CritShakeMag * px / 8f;
                if (Mathf.Abs(s.mag - wantMag) > 1e-4f || Mathf.Abs(s.sec - sec) > 1e-4f)
                {
                    ok = false;
                    Debug.LogError($"{T} FAIL - 피해 {dmg}·급소 {crit} → {s.mag}/{s.sec} ≠ {wantMag}/{sec}");
                }
            }
            Want(40f, false, 4f, 0.12f);
            Want(StoryCombat.BigHitDmg - 0.01f, false, 4f, 0.12f);
            Want(StoryCombat.BigHitDmg, false, 5f, 0.16f);
            Want(300f, false, 5f, 0.16f);
            Want(10f, true, 8f, 0.22f);
            Want(300f, true, 8f, 0.22f);
            if (ok) Debug.Log($"{T} OK - 보통 {StoryCombat.HitShakeMag}/{StoryCombat.HitShakeSec}s · 거함타(≥{StoryCombat.BigHitDmg}) {StoryCombat.BigShakeMag}/{StoryCombat.BigShakeSec}s · 급소 {StoryCombat.CritShakeMag}/{StoryCombat.CritShakeSec}s");
            return ok;
        }
    }
}
