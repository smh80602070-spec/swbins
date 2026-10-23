using UnityEngine;
using Saga.Dungeon.Data;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0178 2나락 장비 숙련(고돗 G-0317 짝) 진단 — `PlaytestDungeonHeadless` 가 무예 나무(tree) 뒤에 부른다(한 프레임 안).
    /// ① 문턱(10·30·60·100·150 → 1~5단, 넘어도 5) ② 처치 = 든 무기에만·무기마다 따로·바꿔 들어도 그대로·단계 오를 때만 알림
    /// ③ 공격 ×(1 + 3%×단계) — HitDamage ④ 진짜 TakeDamage 로 갑주 숙련·받는 피해 −2%×단계·무적이면 안 쌓임 ⑤ 저장 왕복·옛 세이브 = 0 ⑥ 손잡이 끄면 쌓기·효과 없음.
    /// 영웅·숙련·무적은 떠 뒀다 되돌린다.
    /// </summary>
    public static class PlaytestDungeonMastery
    {
        private const string T = "[PlaytestDungeonHeadless] mastery";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string w = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId, w2 = HeroState.SecondWeaponId;
            string m0 = DungeonMastery.Snapshot();
            bool inv = HeroState.Invulnerable; int hold = HeroState.DamageHold;
            int ups = 0;
            System.Action<bool, string, int> count = (a, b, c) => ups++;
            DungeonMastery.TierUp += count;
            try
            {
                HeroState.Invulnerable = false; HeroState.DamageHold = 0;
                DungeonMastery.ResetForTest();

                // ① 문턱
                Begin();
                int[] xs = { 0, 9, 10, 29, 30, 60, 99, 100, 149, 150, 999 };
                int[] want = { 0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5 };
                for (int i = 0; i < xs.Length; i++)
                    if (DungeonMastery.Tier(xs[i]) != want[i]) Fail($"숙련 {xs[i]} → {DungeonMastery.Tier(xs[i])}단 ≠ {want[i]}");
                End("tier OK - 10·30·60·100·150 → 1~5단 · 넘어도 5");

                // ② 처치
                Begin();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, "wp_saber");
                for (int i = 0; i < 30; i++) DungeonMastery.OnKill();
                if (DungeonMastery.WeaponXp("wp_axe") != 30 || DungeonMastery.WeaponTier("wp_axe") != 2) Fail($"쇠도끼 30 처치 → {DungeonMastery.WeaponXp("wp_axe")}·{DungeonMastery.WeaponTier("wp_axe")}단");
                if (DungeonMastery.WeaponXp("wp_saber") != 0) Fail("을(환도)에도 쌓임");
                if (ups != 2) Fail($"알림 {ups} ≠ 2(1단·2단에서만)");
                HeroState.Swap(Time.time + 10f);
                DungeonMastery.OnKill();
                if (DungeonMastery.WeaponXp("wp_saber") != 1 || DungeonMastery.WeaponXp("wp_axe") != 30) Fail("바꿔 든 뒤 숙련이 섞임");
                End($"kill OK - 든 무기에만(쇠도끼 30 → 2단, 을 0) · 알림 {ups}번 · 바꿔 들면 환도에 쌓이고 쇠도끼 그대로");

                // ③ 공격
                Begin();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_saber", null, null);
                float baseHit = HeroState.HitDamage;
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, null);
                float axeHit = HeroState.HitDamage;
                DungeonMastery.On = false;
                float axeOff = HeroState.HitDamage;
                DungeonMastery.On = true;
                if (!Mathf.Approximately(axeHit, axeOff * 1.06f)) Fail($"2단 공격 {axeHit} ≠ {axeOff}×1.06");
                End($"atk OK - 쇠도끼 2단 한 타 {axeOff:0.##} → {axeHit:0.##}(×1.06) · 환도(0단) {baseHit:0.##}");

                // ④ 갑주(진짜 TakeDamage)
                Begin();
                int g0 = DungeonMastery.GuardXp;
                HeroState.Invulnerable = true;
                HeroState.TakeDamage(5f);
                HeroState.Invulnerable = false;
                if (DungeonMastery.GuardXp != g0) Fail("무적인데 갑주 숙련");
                for (int i = 0; i < 10; i++) { HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, null); HeroState.TakeDamage(5f); }
                if (DungeonMastery.GuardTier != 1) Fail($"10번 맞고 갑주 {DungeonMastery.GuardXp}·{DungeonMastery.GuardTier}단 ≠ 1");
                HeroState.Restore(20, 0, 999, 0, "wp_axe", null, null); // 체력 144 — 100 피해에 안 쓰러진다
                HeroState.TakeDamage(100f);
                int dealt1 = HeroState.LastDealt;
                DungeonMastery.On = false;
                HeroState.Restore(20, 0, 999, 0, "wp_axe", null, null); // 체력 144 — 100 피해에 안 쓰러진다
                HeroState.TakeDamage(100f);
                int dealt0 = HeroState.LastDealt;
                DungeonMastery.On = true;
                if (dealt1 >= dealt0 || Mathf.Abs(dealt1 - dealt0 * 0.98f) > 1f) Fail($"갑주 1단 피해 {dealt1} ≠ {dealt0}×0.98");
                End($"guard OK - 무적이면 안 쌓임 · 10번 맞고 1단 · 100 피해 {dealt0} → {dealt1}(−2%)");

                // ⑤ 저장
                Begin();
                string snap = DungeonMastery.Snapshot();
                string json = DungeonSave.ToJson();
                if (!json.Contains("\"masteryJson\"")) Fail("세이브에 masteryJson 없음");
                DungeonMastery.ResetForTest();
                if (!DungeonSave.ApplyJson(json) || DungeonMastery.Snapshot() != snap) Fail("저장 왕복");
                DungeonMastery.Restore(null);
                if (DungeonMastery.GuardXp != 0 || DungeonMastery.WeaponXp("wp_axe") != 0) Fail("옛 세이브(null)인데 숙련");
                DungeonMastery.Restore(snap);
                End("save OK - masteryJson 왕복 · 옛 세이브 = 숙련 0");

                // ⑥ 손잡이
                Begin();
                DungeonMastery.On = false;
                int a0 = DungeonMastery.WeaponXp("wp_axe"), gg = DungeonMastery.GuardXp;
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, null);
                DungeonMastery.OnKill();
                HeroState.TakeDamage(5f);
                if (DungeonMastery.WeaponXp("wp_axe") != a0 || DungeonMastery.GuardXp != gg) Fail("껐는데 쌓임");
                if (DungeonMastery.AtkMul != 1f || DungeonMastery.GuardMul != 1f) Fail("껐는데 효과");
                End("off OK - 끄면 쌓기·효과 없음");
            }
            finally
            {
                DungeonMastery.TierUp -= count;
                DungeonMastery.On = true;
                DungeonMastery.Restore(m0);
                HeroState.Invulnerable = inv; HeroState.DamageHold = hold;
                HeroState.Restore(lv, exp, hp, gold, w, gem, w2);
            }
            return _ok;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T} FAIL - {msg}");
            _ok = false;
            _step = false;
        }
    }
}
