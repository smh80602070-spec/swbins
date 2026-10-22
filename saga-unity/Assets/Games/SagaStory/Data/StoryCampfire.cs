namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0170 — 웹 사가종횡 W-0300 "모닥불에 모여 쉬기"의 이 트랙 판(규칙 층, 몸·앉기는 `World/StoryCampfireSpot`).
    /// 판(<see cref="StoryRunRank"/>)이 닫혀 있을 때 사냥터 들머리 모닥불에 앉으면 체력이 차고, **앞에 선 동료**
    /// (<see cref="StoryPartyState.Active"/> — 웹 "한 명 골라 말 걸기"를 이 트랙의 교대로: 바꿔 서서 다시 앉으면 고른 동료가 바뀐다)가
    /// 한마디와 함께 "모닥불 온기"를 준다 — 다음 한 판만: 선봉 = 첫 타 ×1.1 · 유격 = 기운 가득 · 호법 = 최대 체력 +10%.
    /// 판이 닫히면(두목 처치·쓰러짐) 온기는 사라진다. 웹의 "요리하면 한 단 더"는 이 트랙 생활 기술이 채집만이라 뺐다.
    /// </summary>
    public static class StoryCampfire
    {
        public const float FirstHitMul = 1.1f, GuardHpMul = 1.1f;

        /// <summary>온기를 준 동료 id(없으면 null) — 세이브 `campWarmth`.</summary>
        public static string Warmth { get; private set; }
        private static bool _firstHitArmed;

        public static bool HasWarmth => !string.IsNullOrEmpty(Warmth);

        /// <summary>최대 체력 배율 — 호법 온기일 때만 1.1.</summary>
        public static float HpMul => Warmth == "guardian" ? GuardHpMul : 1f;

        /// <summary>앉기 — 판이 열려 있으면 거절(false). 체력을 채우고 앞에 선 동료의 온기를 얹는다(전 온기는 갈아끼움).</summary>
        public static bool Sit()
        {
            if (StoryRunRank.Active) return false;
            Warmth = StoryPartyState.Active.Id;
            _firstHitArmed = Warmth == "vanguard";
            StoryPlayerHp.Refill();
            if (Warmth == "skirmisher") StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            return true;
        }

        /// <summary>피해 굴림이 부른다 — 선봉 온기가 남아 있으면 이번 한 번 ×1.1 을 쓰고 끈다.</summary>
        public static float TakeFirstHitMul()
        {
            if (!_firstHitArmed) return 1f;
            _firstHitArmed = false;
            return FirstHitMul;
        }

        /// <summary>판이 닫힘 — 온기 소모.</summary>
        public static void OnRunClosed() { Warmth = null; _firstHitArmed = false; }

        /// <summary>앉았을 때 한 줄 — "🔥 선봉: …한마디… — 모닥불 온기: 첫 타 ×1.1(다음 한 판)".</summary>
        public static string Line()
        {
            if (!HasWarmth) return "";
            string say = StoryLocalization.T("camp.say." + Warmth, Warmth == "vanguard" ? "불 좀 쬐었으니 첫 칼은 내가 맡지." : Warmth == "skirmisher" ? "숨 고르니 기운이 다 돌아왔어." : "등 뒤는 걱정 마. 오늘은 버틴다.");
            string eff = StoryLocalization.T("camp.eff." + Warmth, Warmth == "vanguard" ? "첫 타 ×1.1" : Warmth == "skirmisher" ? "기운 가득" : "최대 체력 +10%");
            return string.Format(StoryLocalization.T("camp.line", "🔥 {0}: {1}\n모닥불 온기 — {2}(다음 한 판)"), StoryPartyState.Active.DisplayName, say, eff);
        }

        public static string Snapshot() => Warmth;

        /// <summary>세이브 — 모르는 id·null 은 온기 없음(옛 세이브).</summary>
        public static void Restore(string warmth)
        {
            Warmth = warmth == "vanguard" || warmth == "skirmisher" || warmth == "guardian" ? warmth : null;
            _firstHitArmed = Warmth == "vanguard";
        }
    }
}
