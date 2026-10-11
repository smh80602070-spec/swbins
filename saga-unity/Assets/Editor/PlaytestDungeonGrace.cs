using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0092 "은총 자리 + 사망 카드 + 「은총에서 다시」"(웹 사가나락 W-0102) 진단 — `PlaytestDungeonHeadless` 가 시나리오 뒤에 부른다(한 프레임 안).
    /// ① 출처 넘긴 피해로 쓰러지면 LastHitWho·How = 그 출처, 카드 줄 넷(어디서·누구 — 무엇·유품·남는 것)·단추 「은총에서 다시」
    /// ② 단추 → 같은 층·방 0·체력 최대·횟수 +1 ③ 유품 들고 방 2 에서 쓰러져 다시 서면 유품을 기억했다가 방 2 를 다시 지을 때 그 자리에 세움
    /// ④ 출처 없는 옛 호출이면 "알 수 없는 것" ⑤ ko/en 키. 끝나면 영웅·층·방 번호·자리·카드를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonGrace
    {
        private const string T = "[PlaytestDungeonHeadless] grace";
        private static bool _ok;
        private static readonly FieldInfo RoomField = typeof(DungeonFloorRunner).GetField("_roomIndex", BindingFlags.NonPublic | BindingFlags.Instance);

        public static bool Run()
        {
            _ok = true;
            var runner = DungeonFloorRunner.Instance;
            var playerGo = GameObject.FindWithTag("Player");
            var card = Object.FindFirstObjectByType<SessionCard>();
            if (runner == null || playerGo == null || card == null || RoomField == null) { Fail($"준비 — 층 {runner != null} · 주인공 {playerGo != null} · 카드 {card != null} · 방 칸 {RoomField != null}"); return false; }
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string wp = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            bool inv = HeroState.Invulnerable; int hold = HeroState.DamageHold; bool sup = HeroState.GraveSuppressed;
            int floor = runner.CurrentFloor, room = runner.RoomIndex;
            var pos = playerGo.transform.position;
            string m = "";
            try
            {
                HeroState.Invulnerable = false; HeroState.DamageHold = 0; HeroState.GraveSuppressed = false;
                if (HordeRunner.Instance != null && HordeRunner.Instance.IsActive) Fail("난입 중 — 시험 불가");

                // ① 출처 있는 사망 → 카드
                HeroState.TakeDamage(HeroState.HpMax * 10f, "시험 도적", "시험 찌르기");
                if (HeroState.LastHitWho != "시험 도적" || HeroState.LastHitHow != "시험 찌르기") Fail($"출처 {HeroState.LastHitWho}/{HeroState.LastHitHow}");
                string text = card.Text;
                if (!card.IsShowing || !card.HasAction) Fail($"카드 떠 있음 {card.IsShowing}·단추 {card.HasAction}");
                if (!text.Contains("시험 도적 — 시험 찌르기")) Fail("카드에 누구 — 무엇 없음");
                if (!text.Contains($"{runner.CurrentFloor}층")) Fail("카드에 층 없음");
                if (!text.Contains(DungeonLocalization.T("grace.keep", "남는 것: 도감·인물·공적은 그대로"))) Fail("카드에 남는 것 없음");
                if (card.ActionLabel != DungeonLocalization.T("grace.restart", "은총에서 다시")) Fail($"단추 글 {card.ActionLabel}");
                m += $" 카드 줄 {text.Split('\n').Length}";

                // ② 단추 → 그 층 첫 방, 체력 최대
                int restarts = GraceState.Restarts;
                card.PressAction();
                if (card.IsShowing) Fail("단추 뒤 카드가 안 닫힘");
                if (runner.CurrentFloor != floor || runner.RoomIndex != 0) Fail($"다시 선 자리 층 {runner.CurrentFloor}·방 {runner.RoomIndex} ≠ {floor}·0");
                if (HeroState.Hp != HeroState.HpMax) Fail($"체력 {HeroState.Hp}/{HeroState.HpMax}");
                if (GraceState.Restarts != restarts + 1) Fail("횟수");
                m += $" · 다시 {floor}층 방 0";

                // ③ 방 2 에서 유품(금 137) 들고 쓰러짐 → 다시 섬 → 방 2 를 지을 때 유품이 그 자리에
                RoomField.SetValue(runner, 2);
                HeroState.AddGold(137);
                int spawns = GraveMarker.SpawnCount;
                HeroState.TakeDamage(HeroState.HpMax * 10f, "시험 도적", "시험 찌르기");
                if (GraveMarker.SpawnCount != spawns + 1 || GraveMarker.Current.gold != 137) Fail($"유품 안 섬(금 {GraveMarker.Current.gold})");
                var gpos = GraveMarker.Current.pos;
                card.PressAction();
                if (!GraceState.PendingGrave.HasValue || GraceState.PendingGrave.Value.room != 2 || GraceState.PendingGrave.Value.gold != 137) Fail("유품 기억 안 함");
                RoomField.SetValue(runner, 2);
                runner.BuildRoomForTest("fight");
                if (GraceState.PendingGrave.HasValue) Fail("방 2 를 지어도 유품 기억이 남음");
                if (GraveMarker.SpawnCount != spawns + 2 || GraveMarker.Current.gold != 137 || (GraveMarker.Current.pos - gpos).sqrMagnitude > 0.01f) Fail($"방 2 유품 다시 섬 {GraveMarker.SpawnCount - spawns}·금 {GraveMarker.Current.gold}");
                m += " · 유품 137 방 2 에 다시";

                // ④ 출처 없는 옛 호출
                card.Hide();
                HeroState.TakeDamage(HeroState.HpMax * 10f);
                if (HeroState.LastHitWho != null) Fail("옛 호출인데 출처가 남음");
                if (!card.Text.Contains(DungeonLocalization.T("grace.who_unknown", "알 수 없는 것"))) Fail("옛 호출 카드에 '알 수 없는 것' 없음");
                card.Hide();

                // ⑤ ko/en
                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                    foreach (var k in new[] { "grace.restart", "grace.where", "grace.who_how", "grace.keep", "grace.restarted", "grave.how_strike", "grave.how_bomb" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
                m += " · ko/en";
            }
            finally
            {
                card.Hide();
                HeroState.Restore(lv, exp, hp, gold, wp, gem);
                HeroState.Invulnerable = inv; HeroState.DamageHold = hold; HeroState.GraveSuppressed = sup;
                if (runner.CurrentFloor != floor) runner.JumpToFloor(floor);
                RoomField.SetValue(runner, room);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 출처(누구·무엇)·카드 줄 넷·단추 → 같은 층 방 0·체력 최대 · 유품 기억 → 그 방에 다시 · 옛 호출 '알 수 없는 것' · ko/en |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
