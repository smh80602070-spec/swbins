using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0176 4종횡 띄우기·공중 콤보(웹 W-0345 · 고돗 G-0314) 진단 — `PlaytestStorySlice` 준비 단계 끝(자동 퀘스트 뒤)이 부른다(한 프레임 안, 틱은 손으로).
    /// 잡졸 하나를 복제해(다른 적은 잠깐 끔·체력은 크게): ① ↑ 없이 평타 → 안 뜸 ② ↑ 평타 → 뜸 → 손 틱으로 최고 높이·닿기까지 시간·떨어짐 피해 = 마지막 친 힘 × 0.5
    /// ③ 떠 있는 적 추가타 4타까지 튕김·다섯째는 안 튕김 ④ 두목·관문 대장은 안 뜸 ⑤ 손잡이 끄면 안 뜸.
    /// 끝나면 복제 지움·다른 적·판 등급 셈·소환 게이지·자리를 시작 때로.
    /// </summary>
    public static class PlaytestStoryLaunch
    {
        private const string T = "[PlaytestStorySlice] launch";
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private const BindingFlags PI = BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            if (pc == null) { Fail("플레이어 없음"); return false; }
            StoryEnemy src = null, boss = null;
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.IsDead) continue;
                if (src == null && !e.IsBoss && !e.IsChampion && !e.IsLabyrinthEnemy) src = e;
                if (boss == null && e.IsBoss) boss = e;
            }
            if (src == null) { Fail("복제할 잡졸 없음"); return false; }

            Vector3 pos0 = playerGo.transform.position;
            var rank = SnapStatics(typeof(StoryRunRank));
            var summon = SnapStatics(typeof(StorySummonState));
            var cdF = typeof(StoryPlayerController).GetField("_attackCooldownLeft", PI);
            var faceF = typeof(StoryPlayerController).GetField("_facing", PI);
            var hpF = typeof(StoryEnemy).GetField("_hp", PI);
            GameObject dummy = null;
            var decals0 = new HashSet<StoryGroundDecal>(Object.FindObjectsByType<StoryGroundDecal>(FindObjectsSortMode.None));
            var hidden = new List<(GameObject go, Vector3 at)>();
            try
            {
                Vector3 sp = src.transform.position;
                foreach (var e in StoryEnemy.All)
                    if (e != null && e.gameObject.activeSelf) { hidden.Add((e.gameObject, e.transform.position)); e.gameObject.SetActive(false); e.transform.position += new Vector3(5000f, 0f, 0f); }
                dummy = Object.Instantiate(src.gameObject, sp, src.transform.rotation);
                dummy.name = "LaunchDummy";
                dummy.SetActive(true); // 원본을 끈 뒤 복제했으니 켠다
                var foe = dummy.GetComponent<StoryEnemy>();
                hpF.SetValue(foe, 1e6f);
                float groundY = foe.transform.position.y;
                pc.Teleport(new Vector3(foe.transform.position.x - 1f, pos0.y + 0.6f, pos0.z));
                Physics.SyncTransforms();

                // ① ↑ 없이
                Begin();
                StoryLaunch.UpForTest = false;
                Swing(pc, cdF, faceF);
                if (foe.Airborne) Fail("↑ 없이 떴다");
                if (hpF.GetValue(foe) is float h1 && h1 >= 1e6f) Fail("평타가 안 닿음(자리)");
                End("plain OK - ↑ 없이 평타는 안 뜸");

                // ② 띄움·떨어짐
                Begin();
                StoryLaunch.UpForTest = true;
                Swing(pc, cdF, faceF);
                if (!foe.Airborne) Fail("↑ 평타인데 안 뜸");
                else
                {
                    float last = foe.AirState.LastHitDmg, peak = 0f, fall = 0f, t = 0f;
                    float hpBefore = (float)hpF.GetValue(foe);
                    while (foe.Airborne && t < 3f)
                    {
                        fall = foe.StepAir(1f / 60f);
                        t += 1f / 60f;
                        peak = Mathf.Max(peak, foe.transform.position.y - groundY);
                    }
                    float want = Mathf.Max(1f, Mathf.Round(last * StoryLaunch.FallK));
                    float expectPeak = Sq(StoryLaunch.Jump * StoryLaunch.LaunchK) / (2f * StoryLaunch.Gravity);
                    if (foe.Airborne || Mathf.Abs(foe.transform.position.y - groundY) > 1e-3f) Fail($"안 내려옴({t:0.00}초)");
                    if (Mathf.Abs(peak - expectPeak) > 0.15f) Fail($"최고 {peak:0.00}m ≠ {expectPeak:0.00}m");
                    if (fall != want || Mathf.Abs(hpBefore - (float)hpF.GetValue(foe) - want) > 0.01f) Fail($"떨어짐 피해 {fall} ≠ {want}(마지막 {last} × 0.5)");
                    End($"launch OK - ↑ 평타 → 뜸 · 최고 {peak:0.00}m · {t:0.00}초에 닿음 · 떨어짐 피해 {fall}(= {last} × 0.5)");
                }

                // ③ 저글 상한
                Begin();
                StoryLaunch.UpForTest = false;
                if (!foe.OnStrike(true, 10f) || !foe.Airborne) Fail("다시 띄움 실패");
                int bounced = 0;
                for (int i = 0; i < StoryLaunch.MaxHits + 1; i++)
                {
                    float vy0 = foe.AirState.Vy;
                    foe.StepAir(0.05f);
                    int hits0 = foe.AirState != null ? foe.AirState.Hits : -1;
                    foe.OnStrike(false, 20f + i);
                    if (foe.AirState != null && foe.AirState.Hits > hits0) bounced++;
                }
                if (bounced != StoryLaunch.MaxHits) Fail($"저글 튕김 {bounced} ≠ {StoryLaunch.MaxHits}");
                if (foe.AirState == null || foe.AirState.LastHitDmg != 20f + StoryLaunch.MaxHits) Fail("마지막 친 힘이 안 바뀜");
                Swing(pc, cdF, faceF); // 진짜 평타도 떠 있으면 저글(↑ 없이)
                int guard = 0;
                while (foe.Airborne && guard++ < 400) foe.StepAir(1f / 60f);
                if (foe.Airborne) Fail("저글 뒤 안 내려옴");
                End($"juggle OK - 떠 있는 적 추가타 {bounced}타 튕김·다섯째는 그대로 떨어짐 · ↑ 없는 평타도 저글");

                // ④ 두목·관문 대장
                Begin();
                if (boss != null)
                {
                    if (boss.OnStrike(true, 10f) || boss.Airborne) Fail("두목이 떴다");
                }
                if (!foe.LaunchImmune && (foe.IsBoss || foe.IsChampion)) Fail("면역 판정");
                End($"immune OK - 두목{(boss != null ? "" : "(들판에 없음 — 판정만)")}·관문 대장은 안 뜸");

                // ⑤ 손잡이
                Begin();
                StoryLaunch.On = false;
                StoryLaunch.UpForTest = true;
                Swing(pc, cdF, faceF);
                if (foe.Airborne) Fail("손잡이 껐는데 떴다");
                End("off OK - 손잡이 끄면 안 뜸");
            }
            finally
            {
                StoryLaunch.On = true;
                StoryLaunch.UpForTest = null;
                if (dummy != null) Object.DestroyImmediate(dummy);
                // 이 진단이 남긴 땅 표식은 지운다(뒤 KillEnemies 단계가 표식 수가 느는지 본다 — 풀 상한에 걸리지 않게)
                foreach (var d in Object.FindObjectsByType<StoryGroundDecal>(FindObjectsSortMode.None)) if (!decals0.Contains(d)) Object.DestroyImmediate(d.gameObject);
                foreach (var h in hidden) if (h.go != null) { h.go.transform.position = h.at; h.go.SetActive(true); }
                RestoreStatics(rank);
                RestoreStatics(summon);
                cdF.SetValue(pc, 0f);
                pc.Teleport(pos0);
            }
            return _ok;
        }

        private static void Swing(StoryPlayerController pc, FieldInfo cdF, FieldInfo faceF)
        {
            cdF.SetValue(pc, 0f);
            faceF.SetValue(pc, 1f);
            pc.TriggerAttack();
        }

        private static float Sq(float v) => v * v;

        private static Dictionary<FieldInfo, object> SnapStatics(System.Type t)
        {
            var d = new Dictionary<FieldInfo, object>();
            foreach (var f in t.GetFields(PS))
                if (!f.IsLiteral && !f.IsInitOnly && (f.FieldType.IsValueType || f.FieldType == typeof(string))) d[f] = f.GetValue(null);
            return d;
        }

        private static void RestoreStatics(Dictionary<FieldInfo, object> d)
        {
            foreach (var kv in d) kv.Key.SetValue(null, kv.Value);
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
