using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0199 1만리 동료 우정(고돗 G-0340 `saga_core/data/bond.gd`·`go_bond.gd` 짝, 웹 짝 없음 — 원신 호감도·스타듀 하트 구조만).
    /// 옛 「인연」(<see cref="BondState"/> — 옛 슬라이스 등용 인물, 걸은 거리·이긴 토벌로 0~3·공방 +2%)과 따로 — 들판 편성 동료마다 점수.
    /// 점수   적이 쓰러질 때 지금 앞에 선 동료 +2 · 편성의 다른 동료 +1(주인공 빼고) · 탐사에서 돌아온 동료 +15(`DispatchState.Claim`).
    /// 단계   누적 0·20·50·90·140·200·270·350·440·540·650 → Lv 0~10 · 넷 묶음 🤝 낯섦(0~2)·😊 친근(3~5)·💛 신뢰(6~8)·💞 지기(9~10).
    /// 대사   기질(<see cref="HeroTrait"/>)마다 단계 줄 셋(실명 없음 — 이름 정책) · 지기면 그 인물 한마디(<see cref="GoHeroes.Quote"/>).
    /// 지기에 처음 닿으면 인연 매듭 1(한 번). 도감 상세 동행 줄 밑에 우정 줄. 세이브 `friendJson`(버전 그대로).
    /// </summary>
    public static class GoFriendship
    {
        public const float KillActive = 2f, KillParty = 1f, Dispatch = 15f;
        // 단계·글은 공용 Saga.Core.Friendship(tasks U-0201 — 2나락 DungeonBond 와 같이 씀).
        public static int[] Need => Friendship.Need;
        public const int MaxLv = Friendship.MaxLv;
        public static string[] TierKo => Friendship.TierKo;
        public static string[] TierEmoji => Friendship.TierEmoji;

        /// <summary>끄면 점수 없음(고돗 `SAGA_BOND=0` 짝).</summary>
        public static bool On = true;

        [Serializable] private class Row { public string id; public float pts; }
        [Serializable] private class Store { public List<Row> rows = new List<Row>(); public List<string> knot = new List<string>(); }

        private static Store _s = new Store();

        /// <summary>단이 오를 때 알림 글 — UI 가 듣는다(토스트).</summary>
        public static event Action<string> RankedUp;

        public static float Pts(string id) { var r = _s.rows.Find(x => x.id == id); return r != null ? r.pts : 0f; }
        public static int LevelOf(float pts) => Friendship.LevelOf(pts);
        public static int Level(string id) => LevelOf(Pts(id));
        public static int TierOf(int lv) => Friendship.TierOf(lv);
        public static string TierText(int lv) => Friendship.TierText(lv, GoLocalization.T);
        public static int ToNext(float pts) => Friendship.ToNext(pts);

        /// <summary>그 단계 대사 — 지기면 인물 한마디, 없으면 기질 신뢰 줄.</summary>
        public static string Line(string id)
        {
            int trait = 3;   // 기질 없으면 덕(Friendship.TraitKey 순서)
            string quote = "";
            if (GoHeroes.TryGet(id, out var h)) { trait = TraitIndex(h.Trait); quote = GoHeroes.Quote(h); }
            return Friendship.Line(trait, Level(id), quote, GoLocalization.T);
        }

        private static int TraitIndex(HeroTrait t) => t == HeroTrait.Might ? 0 : t == HeroTrait.Wisdom ? 1 : t == HeroTrait.Command ? 2 : 3;

        public static string NameOf(string id) => GoHeroes.TryGet(id, out var h) ? GoHeroes.Name(h) : id;

        /// <summary>이름 뒤 와/과(받침 있으면 과).</summary>
        public static string WithWa(string nm) => Friendship.WithWa(nm);

        /// <summary>점수를 더한다 — 단이 오르면 알림 글(없으면 ""). 주인공·빈 id·끔이면 없음.</summary>
        public static string Add(string id, float amount)
        {
            if (!On || string.IsNullOrEmpty(id) || id == "hero" || amount <= 0f) return "";
            var r = _s.rows.Find(x => x.id == id);
            if (r == null) { r = new Row { id = id }; _s.rows.Add(r); }
            int lv0 = LevelOf(r.pts);
            r.pts += amount;
            int lv1 = LevelOf(r.pts);
            if (lv1 <= lv0) return "";
            int t = TierOf(lv1);
            string msg = Friendship.UpLine(NameOf(id), lv1, Line(id), GoLocalization.T);
            if (t >= 3 && !_s.knot.Contains(id))
            {
                _s.knot.Add(id);
                TalentState.Add(new[] { 0, 0, 0, 1, 0 });   // 인연 매듭 1(GoTalent.Mat.Knot)
                msg += GoLocalization.T("friend.knot", " · 인연 매듭 +1");
            }
            RankedUp?.Invoke(msg);
            return msg;
        }

        /// <summary>적이 쓰러짐 — 앞에 선 동료 +2 · 편성 다른 동료 +1. 오른 알림 글들.</summary>
        public static List<string> OnKill(string activeId, IEnumerable<string> partyIds)
        {
            var ups = new List<string>();
            if (!On) return ups;
            foreach (var id in partyIds)
            {
                string m = Add(id, id == activeId ? KillActive : KillParty);
                if (m.Length > 0) ups.Add(m);
            }
            return ups;
        }

        /// <summary>도감 상세 줄 — "💛 우정 Lv.7 신뢰 · 다음까지 m — "대사"".</summary>
        public static string DexLine(string id)
        {
            if (!On) return "";
            float p = Pts(id);
            int lv = LevelOf(p), n = ToNext(p);
            return string.Format(GoLocalization.T("friend.dex", "{0} 우정 Lv.{1} {2}{3} — \"{4}\""), TierEmoji[TierOf(lv)], lv, GoLocalization.T("friend.tier" + TierOf(lv), TierKo[TierOf(lv)]),
                n > 0 ? string.Format(GoLocalization.T("friend.next", " · 다음까지 {0}"), n) : "", Line(id));
        }

        public static bool KnotGiven(string id) => _s.knot.Contains(id);

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.rows = (_s.rows ?? new List<Row>()).FindAll(r => r != null && !string.IsNullOrEmpty(r.id) && r.pts > 0f);
            _s.knot = _s.knot ?? new List<string>();
        }

        public static void ResetForTest() => Restore(null);
    }
}
