using System;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0231 ① 인재 천거(고돗 G-0383 역이식 · 삼국지 — 구조만). 달 끝에 결정적 12%(달 열쇠 해시 — 240달 중 24) — 지금 성에서 지혜가 가장 높은
    /// 우리 장수가 그 성 숨은 인재 하나(가장 귀한 이)를 드러낸다(`RealmCityState.Recommend` — 수색과 같은 찾은 목록). 숨은 인재가 없으면 아무 일 없음.
    /// **이 판 다름**: 충성 축이 없어(`RealmScenarioData` 가 웹 loyal 을 기술 +2n 으로 바꿔 씀) 웹·고돗 "충성 ≥60 문턱·충성 +5"는 뺐다.
    /// `UnityEngine.Random` 은 안 쓴다(달 넘김 사건 굴림 줄이 밀림 — U-0224 함정). 손잡이 `SAGA_RECOMMEND=0`.
    /// </summary>
    public static class RealmRecommend
    {
        public const int ChancePct = 12;
        public static bool On = Environment.GetEnvironmentVariable("SAGA_RECOMMEND") != "0";

        /// <summary>이 달 끝에 천거가 있나(순수 — 년·월 해시).</summary>
        public static bool Rolls(int year, int month)
        {
            uint h = 2166136261u;
            foreach (char c in $"recommend:{year}:{month}") { h ^= c; h *= 16777619u; }
            h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15; // 낮은 자리 고르게
            return h % 100u < ChancePct;
        }
    }
}
