using System.Linq;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0225 구역 넘김 막 진단 — 판마다 헤드리스 진단 끝 무렵에 부른다(한 프레임 안).
    /// ① 그 판 진단이 지나온 순간이동 길이 막을 탔나(`ZoneCut.Seen` 에 그 판 이름표) ② 막 셈(곧장 덮음·최소 시간·준비 묻기·상한 1.6초·걷기)
    /// ③ 끔 손잡이면 안 덮음. 끝나면 막을 지우고 손잡이를 되돌린다.
    /// </summary>
    public static class PlaytestZoneCut
    {
        public static bool Run(string prefix, string game)
        {
            string T = $"[{prefix}] zone-cut";
            bool on0 = ZoneCut.On;
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} FAIL - {why}"); }
            try
            {
                // ① 이 판 순간이동 길
                var mine = ZoneCut.Seen.Where(t => t.StartsWith(game + ".")).OrderBy(t => t).ToArray();
                if (on0 && mine.Length == 0) Fail($"이 진단이 지나온 순간이동 중 막을 탄 길이 없음(본 것: {string.Join(",", ZoneCut.Seen)})");
                else Debug.Log($"{T} wired OK - {ZoneCut.Count}번 · {string.Join(", ", mine)}");

                // ② 셈
                ZoneCut.ResetForTest();
                ZoneCut.On = true;
                ZoneCut.Cover("test");
                if (!ZoneCut.Busy || ZoneCut.Alpha < 1f || ZoneCut.Count != 1) Fail($"곧장 안 덮임 busy={ZoneCut.Busy} a={ZoneCut.Alpha}");
                ZoneCut.Tick(0.05f); ZoneCut.Tick(0.05f);
                if (!ZoneCut.Busy) Fail("최소 시간(0.18초) 전에 걷힘");
                ZoneCut.Tick(0.1f);
                if (ZoneCut.Busy) Fail("0.2초·3프레임인데 아직 덮음");
                ZoneCut.Tick(ZoneCut.RevealSec * 0.5f);
                if (ZoneCut.Alpha <= 0.3f || ZoneCut.Alpha >= 0.7f) Fail($"걷기 반쯤 알파 {ZoneCut.Alpha:0.00}");
                ZoneCut.Tick(ZoneCut.RevealSec);
                if (ZoneCut.Covering) Fail("다 걷었는데 남음");
                bool ready = false;
                ZoneCut.Cover("test", () => ready);
                ZoneCut.Tick(0.5f); ZoneCut.Tick(0.5f);
                if (!ZoneCut.Busy) Fail("준비 안 됐는데 걷힘");
                ready = true;
                ZoneCut.Tick(0.01f);
                if (ZoneCut.Busy) Fail("준비됐는데 안 걷힘");
                ZoneCut.Cover("test", () => false);
                for (int i = 0; i < 20; i++) ZoneCut.Tick(0.1f);
                if (ZoneCut.Busy) Fail("상한 1.6초 넘어도 덮음");
                if (ok) Debug.Log($"{T} timing OK - 곧장 덮음·0.18초/2프레임·준비 기다림·상한 {ZoneCut.MaxSec}초·{ZoneCut.RevealSec}초 걷기");

                // ④ 주머니 땅(U-0225 ③) — 플레이어가 밖이면 렌더러·조명 꺼짐, 그 안으로 가면 켜짐, 충돌체는 그대로
                var player = GameObject.FindWithTag("Player");
                if (player != null && PocketVisibility.On)
                {
                    var p0 = player.transform.position;
                    int n = 0, hidden = 0;
                    foreach (var pv in PocketVisibility.All.ToArray())
                    {
                        if (pv == null) continue;
                        n++;
                        pv.Refresh(p0);
                        if (pv.Contains(p0)) continue;
                        int cols = pv.GetComponentsInChildren<Collider>(false).Count(c => c.enabled);
                        if (pv.Visible || pv.HiddenCount == 0) { Fail($"{pv.name} 밖인데 그려짐(visible={pv.Visible} hidden={pv.HiddenCount})"); continue; }
                        hidden += pv.HiddenCount;
                        pv.Refresh(pv.Center);
                        int on = pv.GetComponentsInChildren<Renderer>(false).Count(r => r.enabled);
                        int cols2 = pv.GetComponentsInChildren<Collider>(false).Count(c => c.enabled);
                        if (!pv.Visible || on == 0 || cols2 != cols) Fail($"{pv.name} 안으로 가도 안 켜짐(렌더러 {on}·충돌체 {cols}→{cols2})");
                        pv.Refresh(p0);
                    }
                    Debug.Log($"{T} pockets OK - 주머니 {n} · 지금 밖이라 끈 렌더러 {hidden} · 들어가면 켜짐·충돌체 그대로");
                }

                // ③ 끔
                ZoneCut.ResetForTest();
                ZoneCut.On = false;
                ZoneCut.Cover("test");
                if (ZoneCut.Covering || ZoneCut.Count != 0) Fail("끔인데 덮음");
                else Debug.Log($"{T} off OK - 손잡이 끄면 막 없음");
            }
            finally
            {
                ZoneCut.On = on0;
                ZoneCut.ResetForTest();
            }
            return ok;
        }
    }
}
