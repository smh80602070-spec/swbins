using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0092 — 웹 사가나락 W-0102 "은총 자리 + 사망 카드 + 2분 복귀"(엘든링 은총)의 이 트랙 판.
    /// 은총 = **층 들머리**(웹 결론 그대로 — 첫 방은 늘 싸움 방이라 사당이 없다). 쓰러지면 사망 카드가
    /// 어디서(층·방)·누구에게·무슨 피해(<see cref="HeroState.LastHitWho"/>·<see cref="HeroState.LastHitHow"/>) + 유품 줄 +
    /// "남는 것" 을 보이고, 「은총에서 다시」 한 번(카드 → 단추 = 조작 2)이면 그 층 첫 방부터 다시 선다(적 다시 섬, 유품 마커는 그 자리 그대로).
    /// 이 트랙은 원래 쓰러지면 그 자리에서 회복하므로 단추를 안 누르면 예전과 같다. 은총은 저장하지 않는다(층은 이미 저장).
    /// </summary>
    public static class GraceState
    {
        /// <summary>은총에서 다시 선 횟수(진단용).</summary>
        public static int Restarts { get; private set; }

        /// <summary>쓰러진 방의 유품 — 층·방·자리·금. 웹 "유품은 그 자리에 그대로": 이 트랙 유품은 방이 갈리면 사라져서,
        /// 은총에서 다시 설 때 기억해 뒀다가 같은 층 그 방이 다시 지어지면 그 자리에 다시 세운다(다른 층으로 가면 버린다).</summary>
        public static (int floor, int room, Vector3 pos, int gold)? PendingGrave { get; private set; }
        private static DungeonFloorRunner _hooked;

        /// <summary>사망 카드 넷째 줄까지 — 어디서 · 누구 — 무슨 피해 · 유품 · 남는 것.</summary>
        public static string[] DeathLines(string lostLine)
        {
            var runner = DungeonFloorRunner.Instance;
            string where = runner != null
                ? string.Format(DungeonLocalization.T("grace.where", "제 {0}층 · 방 {1}/{2}"), runner.CurrentFloor, runner.RoomIndex + 1, runner.RoomTotal)
                : DungeonLocalization.T("grace.where_unknown", "어딘가에서");
            string who = string.IsNullOrEmpty(HeroState.LastHitWho) ? DungeonLocalization.T("grace.who_unknown", "알 수 없는 것") : HeroState.LastHitWho;
            string how = string.IsNullOrEmpty(HeroState.LastHitHow) ? DungeonLocalization.T("grace.how_unknown", "피해") : HeroState.LastHitHow;
            return new[]
            {
                where,
                string.Format(DungeonLocalization.T("grace.who_how", "{0} — {1}"), who, how),
                lostLine,
                DungeonLocalization.T("grace.keep", "남는 것: 도감·인물·공적은 그대로"),
            };
        }

        /// <summary>「은총에서 다시」 — 그 층 첫 방을 다시 짓고 들머리에 선다. 체력은 이미 가득(쓰러질 때 회복).</summary>
        public static void RestartAtGrace()
        {
            var runner = DungeonFloorRunner.Instance;
            if (runner == null) return;
            var g = GraveMarker.Current;
            PendingGrave = g.gold > 0 ? (runner.CurrentFloor, runner.RoomIndex, g.pos, g.gold) : ((int, int, Vector3, int)?)null;
            if (_hooked != runner) { if (_hooked != null) _hooked.RoomBuilt -= OnRoomBuilt; runner.RoomBuilt += OnRoomBuilt; _hooked = runner; }
            runner.RestartFloorAtEntry();
            HeroState.FullHeal();
            Restarts++;
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("grace.restarted", "제 {0}층 은총 — 다시 일어섰다"), runner.CurrentFloor), 3f);
        }

        private static void OnRoomBuilt(int floor, int room)
        {
            if (!PendingGrave.HasValue) return;
            var p = PendingGrave.Value;
            if (floor != p.floor) { PendingGrave = null; return; }
            if (room != p.room) return;
            PendingGrave = null;
            GraveMarker.Spawn(p.pos, p.gold);
        }
    }
}
