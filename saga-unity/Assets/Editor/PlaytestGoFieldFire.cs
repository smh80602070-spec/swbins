using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0175 1만리 환경 연쇄(웹 W-0374 · 고돗 G-0303) 진단 — `PlaytestHeadless` 가 무리 토벌 등급 뒤에 부른다(한 프레임 안, 틱은 손으로).
    /// 적 셋(east_grove_s 둘 + 하나)을 옮겨: ① 들 칸 위 적에 불 타격 → 불길 1·둘레 적 피해·불 묻힘·0.5초 뒤 2(번짐 한 번만)·꺼짐 ② 길 `=`·마을 `H` 칸은 안 탐
    /// ③ 강 `~` 위 적에 번개 → 강 위 다른 적 피해·뭍 적은 안 받음 ④ 물 타격 → 불길 꺼짐 ⑤ 주인공 체력 그대로 ⑥ 손잡이 끄면 불길 없음.
    /// 끝나면 적(최대 체력·집)·불길·등급 셈을 시작 때로.
    /// </summary>
    public static class PlaytestGoFieldFire
    {
        private const string T = "[PlaytestHeadless] fieldfire";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var ff = FieldFire.Instance;
            var fc = FieldCombat.Instance;
            var foes = new List<FieldEnemy>();
            foreach (var e in FieldEnemy.All)
                if (!e.IsHero && !e.IsGuardian && !e.IsElemental && !e.DomainFoe && !e.StoryFoe && foes.Count < 3) foes.Add(e);
            if (ff == null || fc == null || fc.Active == null || foes.Count < 3) { Fail($"FieldFire·FieldCombat·적 셋 없음({foes.Count})"); return false; }
            var max0 = new List<float>();
            foreach (var e in foes) max0.Add(e.MaxHp);
            FieldEnemy e1 = foes[0], e2 = foes[1], e3 = foes[2];
            float php = fc.Active.Hp;
            try
            {
                foreach (var e in foes) e.SetMaxHpForTest(100000f);
                ff.ClearForTest();

                // ① 풀불
                Begin();
                Vector3 grass = TestMapData.WorldPos(1, 2); // '.'
                e1.WarpForTest(grass);
                e2.WarpForTest(grass + new Vector3(2f, 0f, 0f));
                e3.WarpForTest(grass + new Vector3(0f, 0f, 30f));
                float h2 = e2.Hp, h3 = e3.Hp;
                e1.TakeHit(100f, GoElement.Pyro, 100f, out _);
                if (ff.Fires.Count != 1) Fail($"들 칸 불 타격인데 불길 {ff.Fires.Count}");
                ff.Step(0.5f);
                if (ff.Fires.Count != 2) Fail($"0.5초 뒤 번짐 — 불길 {ff.Fires.Count} ≠ 2");
                float d2 = h2 - e2.Hp;
                if (Mathf.Abs(d2 - 100f * FieldFire.DpsMul * FieldFire.Tick) > 0.5f) Fail($"둘레 피해 {d2:0.0} ≠ {100f * FieldFire.DpsMul * FieldFire.Tick:0.0}");
                if (e2.Aura != GoElement.Pyro) Fail($"불 안 묻음({e2.Aura})");
                if (e3.Hp != h3) Fail("반경 밖 적이 다침");
                for (int i = 0; i < 4; i++) ff.Step(0.5f);
                int mid = ff.Fires.Count;
                for (int i = 0; i < 4; i++) ff.Step(0.5f);
                if (mid < 1 || ff.Fires.Count != 0) Fail($"꺼짐 — 2.5초 {mid}·4.5초 {ff.Fires.Count}");
                End($"grass OK - 불 타격 → 불길 1 · 0.5초 번짐 2(한 번만) · 둘레 피해 {d2:0.0}/틱·불 묻힘 · 반경 밖 그대로 · {FieldFire.Life:0}초 꺼짐");

                // ② 안 타는 땅
                Begin();
                foreach (var g in new[] { (3, 2, '='), (2, 3, 'H') })
                {
                    e1.WarpForTest(TestMapData.WorldPos(g.Item1, g.Item2));
                    e1.TakeHit(100f, GoElement.Pyro, 100f, out _);
                    if (ff.Fires.Count != 0) Fail($"'{g.Item3}' 칸이 탐");
                    ff.ClearForTest();
                }
                End("ground OK - 길 = ·마을 H 은 안 탐");

                // ③ 강물 전류
                Begin();
                Vector3 river = TestMapData.WorldPos(1, 5) + new Vector3(0f, 0f, -16f); // '~' 북쪽 가장자리 근처
                e1.WarpForTest(river);
                e2.WarpForTest(river + new Vector3(6f, 0f, 0f));
                e3.WarpForTest(river + new Vector3(0f, 0f, -12f)); // 뭍(4행 '.')
                if (!FieldFire.IsWet(e1.transform.position) || !FieldFire.IsWet(e2.transform.position) || FieldFire.IsWet(e3.transform.position)) Fail("자리 잡기 — 강·강·뭍 아님");
                h2 = e2.Hp; h3 = e3.Hp;
                e1.TakeHit(100f, GoElement.Electro, 100f, out _);
                float s2 = h2 - e2.Hp;
                if (Mathf.Abs(s2 - 100f) > 0.5f) Fail($"강 위 다른 적 피해 {s2:0.0} ≠ 100");
                if (e3.Hp != h3) Fail("뭍 적이 전류를 받음");
                End($"shock OK - 강 위 번개 → 강 위 둘째 적 {s2:0} 한 번 · 뭍(12m) 적 그대로");

                // ④ 끔
                Begin();
                e1.WarpForTest(grass);
                ff.Ignite(grass, 100f, false);
                e1.TakeHit(50f, GoElement.Hydro, 50f, out _);
                if (ff.Fires.Count != 0) Fail($"물 타격에 불길 {ff.Fires.Count} 남음");
                End("douse OK - 물 타격 → 불길 꺼짐");

                // ⑤·⑥
                Begin();
                if (Mathf.Abs(fc.Active.Hp - php) > 1e-3f) Fail($"주인공 체력 {php} → {fc.Active.Hp}");
                FieldFire.On = false;
                e1.WarpForTest(grass);
                e1.TakeHit(100f, GoElement.Pyro, 100f, out _);
                if (ff.Fires.Count != 0) Fail("손잡이 껐는데 불길");
                End("safe OK - 주인공 체력 그대로 · 손잡이 끄면 불길 없음");
            }
            finally
            {
                FieldFire.On = true;
                ff.ClearForTest();
                for (int i = 0; i < foes.Count; i++) { foes[i].SetMaxHpForTest(max0[i]); foes[i].RestoreHomeForTest(); }
                GoRunRank.ClearForTest();
            }
            return _ok;
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
