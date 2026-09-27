using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-10 몰이 사냥(웹 사가블로 §5.19 1차·2차 흩어짐) — 떼로 몰아 한 번에 쓸어버리는 맛. 수치·판정만(순수), 쓰는 곳은
    /// 층 진행기(무리)·<c>PlayerCombat</c>(휩쓸기)·<c>DungeonEnemy</c>(경직·움찔·쓰러짐 날림).
    ///
    /// 웹 그대로: 전투방 잡졸 하나마다 졸개 <see cref="PackN"/>=2(체력 55%·피해 70%·작게·첫 공격 0.6~1.4초 어긋남, 자리·박자는 해시 — 무작위 없음),
    /// 방 적 상한 30 · 평타 앞 120° 반경 사거리 × 1.35 곁 60% · 강공격 앞 180° 반경 사거리 × 1.8 곁 강공격 × 0.75 · 경직 0.25초(두목급 제외) ·
    /// 쓰러지면 나에게서 먼 쪽으로 날아가 가라앉음(방향 ±0.45rad 해시 흔들림·힘 0.7~2.4 = 넘친 피해·강공격).
    /// 웹 "드롭 ½" 은 이 판 드롭이 금·경험이라 졸개 보상 절반·무기 없음 · 졸개 반지름 10(잡졸 ≈ 13) → 몸 0.75배.
    /// **해당 없음**: 방 1.5배(이 판 방은 이미 20×20m ≈ 웹 1.5배 뒤 넓이, 방 셸이 구운 GLB) · 들판 상한·무리 보충·세계 소품 밀도·안 보이는 나무
    /// (절차 들판이 없음) · 무예 원뿔·끌어당기기(그런 무예가 없음 — 회전베기는 둘레 그대로).
    /// 웹 손잡이 dg.pack·dg.cleave·dg.stagger·dg.scatter = <see cref="PackN"/>·<see cref="CleaveOn"/>·<see cref="Stagger"/>·<see cref="Scatter"/>(0 이면 옛 동작).
    /// </summary>
    public static class DungeonHunt
    {
        // ── 무리 ──
        public static int PackN = 2;
        public const int PackCap = 30;
        public const float MinionHpMul = 0.55f, MinionDmgMul = 0.7f, MinionRewardMul = 0.5f, MinionScale = 0.75f;
        /// <summary>웹 24 + h × 20 px(24px = 1m).</summary>
        public const float PackRingMin = 1.0f, PackRingSpan = 20f / 24f;
        public const float FirstAttackMin = 0.6f, FirstAttackSpan = 0.8f;

        // ── 휩쓸기 ──
        public static bool CleaveOn = true;
        public const float CleaveHalfDeg = 60f, CleaveR = 1.35f, CleaveMul = 0.6f;
        public const float HeavyHalfDeg = 90f, HeavyR = 1.8f, HeavySide = 0.75f;

        // ── 경직·움찔 ──
        public static float Stagger = 0.25f;
        public const float FlinchSec = 0.28f, FlinchDeg = 10f;

        // ── 쓰러짐 흩어짐 ──
        public static float Scatter = 1f;
        public const float ScatterJitterRad = 0.45f, ForceMin = 0.7f, ForceMax = 2.4f;
        /// <summary>힘 1 = 이만큼 날아간다(m).</summary>
        public const float FlingMeters = 1.1f;
        public const float FlingSec = 0.3f, SinkStartSec = 0.6f, SinkEndSec = 1.2f, SinkDepth = 0.8f;

        /// <summary>고정 입력 → [0, 1) (웹 core.hash2 자리, 이 판 제 해시).</summary>
        public static float Hash01(int a, int b)
        {
            unchecked
            {
                uint h = 2166136261u;
                h = (h ^ (uint)a) * 16777619u;
                h = (h ^ (uint)b) * 16777619u;
                h ^= h >> 13;
                h *= 0x5bd1e995u;
                h ^= h >> 15;
                return (h & 0xFFFFFF) / (float)0x1000000;
            }
        }

        /// <summary>무리 졸개 k(0..K−1) 의 자리 — 우두머리 둘레 고리(웹 addPacks). seed 는 방·층.</summary>
        public static Vector3 PackOffset(int seed, int lead, int k, int K)
        {
            float h1 = Hash01(seed * 97 + lead * 31 + k, 7 + lead * 13), h2 = Hash01(lead * 17 + k * 5, seed * 53 + 3);
            float a = (k / (float)Mathf.Max(1, K) + h1 * 0.4f) * Mathf.PI * 2f, rr = PackRingMin + h2 * PackRingSpan;
            return new Vector3(Mathf.Cos(a) * rr, 0f, Mathf.Sin(a) * rr);
        }

        public static float FirstAttackDelay(int seed, int lead, int k) =>
            FirstAttackMin + Hash01(seed * 97 + lead * 31 + k, 7 + lead * 13) * FirstAttackSpan;

        /// <summary>부채꼴 안인가(바닥 거리 ≤ r, 앞과 이루는 각 ≤ half).</summary>
        public static bool InCone(Vector3 origin, Vector3 forward, Vector3 p, float radius, float halfDeg)
        {
            Vector3 d = p - origin;
            d.y = 0f;
            forward.y = 0f;
            if (d.magnitude > radius) return false;
            if (d.sqrMagnitude < 0.0001f || forward.sqrMagnitude < 0.0001f) return true;
            return Vector3.Angle(forward, d) <= halfDeg;
        }

        /// <summary>쓰러짐 힘 — 넘친 피해가 체력 최대만큼이면 끝까지, 강공격은 +0.5(웹 "밀침·넘친 피해").</summary>
        public static float ScatterForce(float overkill, float maxHp, bool heavy)
        {
            float r = maxHp > 0f ? Mathf.Clamp01(overkill / maxHp) : 0f;
            return Mathf.Clamp(ForceMin + (ForceMax - ForceMin) * r + (heavy ? 0.5f : 0f), ForceMin, ForceMax);
        }

        /// <summary>쓰러짐 방향 흔들림(라디안) — 적 자리로 정한다(같은 자리면 같은 쪽).</summary>
        public static float ScatterJitter(Vector3 at)
        {
            float h = Hash01(Mathf.RoundToInt(at.x * 10f), Mathf.RoundToInt(at.z * 10f));
            return (h * 2f - 1f) * ScatterJitterRad * Scatter;
        }
    }
}
