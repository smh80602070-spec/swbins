using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0131 2나락 무기 두 벌 진단 — `PlaytestDungeonHeadless` 가 전리품 거르기(lootfilter) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 줍기 — wp_start 는 버리고 센 무기는 손 무기를 을로 ② 맞바꿈·쿨 거절(진짜 PlayerCombat.TriggerSwap)·을 없으면 거절
    /// ③ 첫 타 한 번 ×1.15 ④ 을은 공격력 합에 안 듦·줍기는 max(갑, 을) 비교 ⑤ 저장 왕복·옛 세이브(weapon2Id 없음) = 한 벌·폰 단추.
    /// 영웅 상태(레벨·경험·체력·돈·무기·보석·을)는 떠 뒀다 되돌린다.
    /// </summary>
    public static class PlaytestDungeonWeaponSwap
    {
        private const string T = "[PlaytestDungeonHeadless] swap";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string w = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId, w2 = HeroState.SecondWeaponId;
            try
            {
                // ① 줍기
                Begin();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_start", null, null);
                if (!HeroState.EquipIfBetter("wp_axe") || HeroState.EquippedWeaponId != "wp_axe" || HeroState.SecondWeaponId != null)
                    Fail($"목검 → 쇠도끼: 갑 {HeroState.EquippedWeaponId} · 을 {HeroState.SecondWeaponId ?? "없음"}(목검은 버려야)");
                if (!HeroState.EquipIfBetter("wp_saber") || HeroState.EquippedWeaponId != "wp_saber" || HeroState.SecondWeaponId != "wp_axe")
                    Fail($"쇠도끼 → 환도: 갑 {HeroState.EquippedWeaponId} · 을 {HeroState.SecondWeaponId ?? "없음"}");
                if (!HeroState.EquipIfBetter("wp_glaive") || HeroState.SecondWeaponId != "wp_saber")
                    Fail($"환도 → 귀두도: 을 {HeroState.SecondWeaponId ?? "없음"} ≠ 환도(옛 을 쇠도끼는 버림)");
                End("pick OK - 목검 버림·손 무기는 을로·옛 을 버림");

                // ② 맞바꿈·쿨
                Begin();
                var combat = Object.FindFirstObjectByType<PlayerCombat>();
                if (combat == null) Fail("PlayerCombat 없음");
                else
                {
                    HeroState.ResetSwapForTest();
                    HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_glaive", null, "wp_saber");
                    combat.TriggerSwap();
                    if (HeroState.EquippedWeaponId != "wp_saber" || HeroState.SecondWeaponId != "wp_glaive") Fail($"G 맞바꿈: 갑 {HeroState.EquippedWeaponId} · 을 {HeroState.SecondWeaponId}");
                    combat.TriggerSwap();
                    if (HeroState.EquippedWeaponId != "wp_saber") Fail("쿨 1초 안에 또 바뀜");
                    float now = Time.time + HeroState.SwapCooldown + 0.01f;
                    if (!HeroState.Swap(now) || HeroState.EquippedWeaponId != "wp_glaive") Fail("쿨 지난 뒤 안 바뀜");
                    HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, null);
                    combat.TriggerSwap();
                    if (HeroState.EquippedWeaponId != "wp_axe" || HeroState.Swap(now + 5f)) Fail("을 없는데 바뀜");
                }
                End("swap OK - G 맞바꿈·쿨 1초 거절·쿨 뒤 다시·을 없으면 거절");

                // ③ 첫 타 한 번
                Begin();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_glaive", null, "wp_saber");
                if (HeroState.TakeFirstHit() != 1f) Fail("안 바꿨는데 첫 타 배율");
                HeroState.Swap(Time.time + 10f);
                float a = HeroState.TakeFirstHit(), b = HeroState.TakeFirstHit();
                if (!Mathf.Approximately(a, HeroState.SwapFirstMul) || b != 1f) Fail($"첫 타 {a}·둘째 {b} ≠ 1.15·1");
                End("first OK - 바꾼 뒤 첫 타만 ×1.15");

                // ④ 을은 공격력에 안 듦·max 비교
                Begin();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, null);
                float atkOne = HeroState.Atk;
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_axe", null, "wp_greatblade");
                if (!Mathf.Approximately(HeroState.Atk, atkOne)) Fail($"을이 공격력에 듦 {HeroState.Atk} ≠ {atkOne}");
                if (HeroState.EquipIfBetter("wp_glaive")) Fail("을(흑철중검 31)보다 약한 귀두도(26)로 바뀜");
                if (!HeroState.EquipIfBetter("wp_lance_e") || HeroState.SecondWeaponId != "wp_greatblade") Fail($"둘보다 센 전자창: 을 {HeroState.SecondWeaponId} ≠ 흑철중검(손 쇠도끼보다 센 을은 남는다 — R-5)");
                End("atk OK - 을은 공격력 합 밖·줍기는 갑·을 중 센 것보다 세야·손·을 중 센 쪽이 을로 남음");

                // ⑤ 저장 왕복·옛 세이브·단추
                Begin();
                HeroState.Restore(3, 4, HeroState.HpMax, 50, "wp_saber", null, "wp_axe");
                string json = DungeonSave.ToJson();
                HeroState.Restore(1, 0, HeroState.HpMax, 0, "wp_start", null, null);
                if (!DungeonSave.ApplyJson(json) || HeroState.SecondWeaponId != "wp_axe" || HeroState.EquippedWeaponId != "wp_saber") Fail($"저장 왕복 을 {HeroState.SecondWeaponId}");
                string old = json.Replace("\"weapon2Id\":\"wp_axe\",", "");
                if (old == json) Fail("세이브 json 에 weapon2Id 가 없음");
                else if (!DungeonSave.ApplyJson(old) || HeroState.SecondWeaponId != null) Fail($"옛 세이브(을 없음)인데 을 {HeroState.SecondWeaponId}");
                var btn = WeaponSwapButton.Instance;
                if (btn == null) Fail("폰 바꿔 들기 단추 없음");
                else
                {
                    btn.SendMessage("Refresh");
                    if (!btn.Dim) Fail("을 없는데 단추가 안 흐림");
                    HeroState.Restore(3, 4, HeroState.HpMax, 50, "wp_saber", null, "wp_axe");
                    btn.SendMessage("Refresh");
                    string name = ItemData.Get("wp_axe").Name;
                    if (btn.Dim || btn.Label == null || !btn.Label.Contains(name)) Fail($"을 있는데 단추 흐림 {btn.Dim} · 글 {btn.Label}");
                }
                End("save OK - weapon2Id 왕복·옛 세이브 한 벌·폰 단추 흐림/을 이름");
            }
            finally
            {
                HeroState.Restore(lv, exp, hp, gold, w, gem, w2); // 을·쿨·첫 타도 함께 되돌린다
            }
            return _ok;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
