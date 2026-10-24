using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0201 동료 우정 공용 셈·글(고돗 G-0340·G-0341 `saga_core/data/bond.gd` 짝) — 점수를 언제 주고 어디 쌓는지는 판 어댑터(1만리 `GoFriendship`·2나락 `DungeonBond`).
    /// 단계  누적 0·20·50·90·140·200·270·350·440·540·650 → Lv 0~10 · 넷 묶음 🤝 낯섦(0~2)·😊 친근(3~5)·💛 신뢰(6~8)·💞 지기(9~10).
    /// 대사  기질 넷(0 무 might·1 지 wisdom·2 통솔 command·3 덕 virtue)마다 단계 줄 셋(낯섦·친근·신뢰) — 지기면 그 인물 한마디(없으면 신뢰 줄). 실명 없음(이름 정책).
    /// 글은 판 번역 함수(t: 키, 한국어 기본값)로 — 키 `friend.tier{n}`·`friend.line.{trait}{k}`.
    /// </summary>
    public static class Friendship
    {
        public static readonly int[] Need = { 0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650 };
        public const int MaxLv = 10, KnotTier = 3;
        public static readonly int[] TierFrom = { 0, 3, 6, 9 };
        public static readonly string[] TierKo = { "낯섦", "친근", "신뢰", "지기" };
        public static readonly string[] TierEmoji = { "🤝", "😊", "💛", "💞" };
        public static readonly string[] TraitKey = { "might", "wisdom", "command", "virtue" };
        public static readonly string[][] LinesKo =
        {
            new[] { "싸움터에서 등을 맡길 만한지는 아직 모르겠군.", "그대 칼끝이 제법 매섭더군. 다음에도 앞장서지.", "그대와 함께라면 어떤 적진이든 베고 들어가겠다." },
            new[] { "서로를 더 지켜본 뒤에 판단해도 늦지 않겠지요.", "그대의 길 고르는 눈이 예사롭지 않군요.", "그대의 뜻이라면 계책을 아끼지 않겠습니다." },
            new[] { "대열에 선 이상 명은 따르겠소. 그 이상은 두고 봅시다.", "그대와 발을 맞추니 무리가 한결 가볍소.", "그대가 깃발을 들면 내가 그 뒤를 지키겠소." },
            new[] { "함께 걷게 되었군요. 잘 부탁드립니다.", "그대 곁에 있으면 마음이 놓입니다.", "그대를 위해서라면 무엇이든 나누겠습니다." },
        };

        public static int LevelOf(float pts) { int lv = 0; for (int i = 0; i < Need.Length; i++) if (pts >= Need[i]) lv = i; return Mathf.Min(lv, MaxLv); }
        public static int TierOf(int lv) { int t = 0; for (int i = 0; i < TierFrom.Length; i++) if (lv >= TierFrom[i]) t = i; return t; }
        public static int ToNext(float pts) { int lv = LevelOf(pts); return lv >= MaxLv ? 0 : Mathf.CeilToInt(Need[lv + 1] - pts); }

        public static string TierName(int lv, Func<string, string, string> t) { int k = TierOf(lv); return t("friend.tier" + k, TierKo[k]); }
        public static string TierText(int lv, Func<string, string, string> t) => TierEmoji[TierOf(lv)] + " " + TierName(lv, t);

        /// <summary>그 단계 대사 — 지기면 한마디(quote, 비었으면 신뢰 줄).</summary>
        public static string Line(int trait, int lv, string quote, Func<string, string, string> t)
        {
            trait = Mathf.Clamp(trait, 0, 3);
            int tier = TierOf(lv), k = Mathf.Min(tier, 2);
            string fallback = t($"friend.line.{TraitKey[trait]}{k}", LinesKo[trait][k]);
            return tier >= KnotTier && !string.IsNullOrEmpty(quote) ? quote : fallback;
        }

        /// <summary>이름 뒤 와/과(받침 있으면 과) — 끝 글자가 한글(가~힣)이 아니면 이름 그대로(영어 이름 뒤 "와" 없음, U-0210).</summary>
        public static string WithWa(string nm)
        {
            if (string.IsNullOrEmpty(nm)) return nm;
            char c = nm[nm.Length - 1];
            if (c < 0xAC00 || c > 0xD7A3) return nm;
            return nm + ((c - 0xAC00) % 28 != 0 ? "과" : "와");
        }

        /// <summary>오름 알림 — "💛 무사와의 우정 Lv.7 · 신뢰 — "대사"".</summary>
        public static string UpLine(string name, int lv, string line, Func<string, string, string> t) =>
            string.Format(t("friend.up", "{0} {1}의 우정 Lv.{2} · {3} — \"{4}\""), TierEmoji[TierOf(lv)], WithWa(name), lv, TierName(lv, t), line);
    }
}
