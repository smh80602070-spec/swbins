using System;
using UnityEngine;
using Saga.Core;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0201 2나락 부대 우정(고돗 G-0341 짝 — 공용 셈·글 <see cref="Friendship"/>) — 부대원은 명령 게이지·능력치 보탬뿐이었다(<see cref="PartyState"/>).
    /// 이 트랙 부대는 이름 없는 두 자리(🛡️ 무사 = 무 기질 · ✨ 술사 = 지 기질)라 자리마다 점수. 부대원은 늘 같이 내려가니 처치가 아니라 방 단위:
    /// 방을 깨면(문이 열림) 둘 다 +<see cref="RoomPts"/> · 층 마지막 방을 깨고 계단으로 내려가면 +<see cref="FloorPts"/> 더.
    /// 단이 오르면 공용 알림 · 지기에 처음 닿으면 금 +<see cref="KnotGold"/>(한 번) · 부대 HUD 이름 옆 꼬리표(💛6). 세이브 `bondJson`(버전 그대로).
    /// </summary>
    public static class DungeonBond
    {
        public const float RoomPts = 5f, FloorPts = 10f;
        public const int KnotGold = 500;
        private static readonly int[] Trait = { 0, 1 };   // Guard 무 · Mystic 지

        /// <summary>끄면 점수 없음(고돗 `SAGA_BOND=0` 짝).</summary>
        public static bool On = true;

        [Serializable] private class Store { public float[] pts = new float[2]; public bool[] knot = new bool[2]; }

        private static Store _s = new Store();

        private static string T(string k, string ko) => DungeonLocalization.T(k, ko);

        public static string Name(PartyRole r) => r == PartyRole.Guard ? T("party.hud_guard", "무사") : T("party.hud_mystic", "술사");
        public static float Pts(PartyRole r) => _s.pts[(int)r];
        public static int Level(PartyRole r) => Friendship.LevelOf(Pts(r));
        public static string Line(PartyRole r) => Friendship.Line(Trait[(int)r], Level(r), "", T);

        /// <summary>HUD 꼬리표 — " 💛6"(Lv 0 이면 빈 글).</summary>
        public static string Tag(PartyRole r)
        {
            if (!On) return "";
            int lv = Level(r);
            return lv <= 0 ? "" : " " + Friendship.TierEmoji[Friendship.TierOf(lv)] + lv;
        }

        /// <summary>한 자리에 점수 — 단이 오르면 알림 글(없으면 "").</summary>
        public static string Add(PartyRole r, float amount)
        {
            if (!On || amount <= 0f) return "";
            int i = (int)r, lv0 = Friendship.LevelOf(_s.pts[i]);
            _s.pts[i] += amount;
            int lv1 = Friendship.LevelOf(_s.pts[i]);
            if (lv1 <= lv0) return "";
            string msg = Friendship.UpLine(Name(r), lv1, Line(r), T);
            if (Friendship.TierOf(lv1) >= Friendship.KnotTier && !_s.knot[i])
            {
                _s.knot[i] = true;
                HeroState.AddGold(KnotGold);
                msg += string.Format(T("friend.knot_gold", " · 금 +{0}"), KnotGold);
            }
            return msg;
        }

        private static string Both(float amount)
        {
            string a = Add(PartyRole.Guard, amount), b = Add(PartyRole.Mystic, amount);
            return a.Length > 0 && b.Length > 0 ? a + "\n" + b : a + b;
        }

        /// <summary>방을 깸(문이 열림) — 둘 다 +5. 오른 알림 글.</summary>
        public static string OnRoomCleared() => Both(RoomPts);

        /// <summary>층을 다 깨고 내려감 — 둘 다 +10 더.</summary>
        public static string OnFloorDone() => Both(FloorPts);

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            if (s == null || s.pts == null || s.pts.Length != 2 || s.knot == null || s.knot.Length != 2) s = new Store();
            for (int i = 0; i < 2; i++) s.pts[i] = Mathf.Max(0f, s.pts[i]);
            _s = s;
        }

        public static void ResetForTest() => Restore(null);
    }
}
