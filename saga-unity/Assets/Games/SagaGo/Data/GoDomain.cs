using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-9 "숨은 터·원기·주간 보스"(웹 사가고 ⑲-9 `domain.js` · ⑳ 이름·수치 · saga-godot 106) — 표·식만 모은 순수 정적 클래스.
    /// 숨은 터 셋(잠든 무덤 = 보패 · 옛 서당 = 무예 책 · 쇠부리 터 = 강화석)과 주간 보스 "먹구름 제단" 하나. 웹은 땅 열여섯마다 입구 하나(종류 셋을 돌림)지만
    /// 이 트랙 지도(9×11 칸)는 작아 종류마다 하나 — 들판 무리·역참·수호장에서 55m 넘게 떨어진 뭍에 고정(세이브 없음).
    /// 도전: 단계 I·II·III(여정 등급 1·6·12, 체력 ×1·2·3.5 · 공격 ×1·1.5·2.2) → 3초 뒤 파도 둘(보통 → 정예) 120초(주간은 보스 하나 180초), 원판 40m(웹 30m × 1.85 = 55m 는
    /// 이 트랙 적 끈 45m 를 넘어 줄였다)를 벗어나거나·시간·전멸·물러나면 실패(원기 안 씀). 다 쓰러뜨리면 가운데 보상 나무 — 원기 15(주간 45, 이번 주 처음 둘 25)를 써서 받는다.
    /// 숨은 터 적은 지역 위험 2 고정 × 단계 — 천하 등급·경험·전리품·일과·무리 기록이 없고 다시 서지 않는다. 몸은 이 트랙 옛 몸에 원소(14-1a 졸개 결 — 제 괴물은 14-1b).
    /// 터 기운: 무덤 = 4초마다 적이 물을 띤다 · 서당 = 적을 쓰러뜨리면 명단 기력 +13(웹 8 / 60 → 이 트랙 100) · 쇠부리 = 적 공격 ×1.3.
    /// 주간 = 먹구름 이무기(해골 몸 × 2.2 크기, 체력 = 들판 적 220 × 20 · 공격 20 × 2.2, 내리치기 8.1m · 예고 1.2초 · 간격 3.5초), 체력 절반에서 뇌 방패(최대 체력 10%)·간격 ×0.69.
    /// 원기 상한 120 · 실제 시각 10분에 1(처음·옛 세이브는 가득). 주 = 월요일 새벽 4시 갈림. 보상은 웹 표(부대 경험은 인물 경험이 없어 뺐다) — 주간에 뇌룡 비늘(무예 7 → 8~10).
    /// </summary>
    public static class GoDomain
    {
        public enum Kind { Tomb, School, Forge, Weekly }

        public struct Site
        {
            public string Id;
            public Kind Kind;
            public float Gx, Gy;
            public string NameKo;
            public string Name => GoLocalization.T("domain.site." + Id, NameKo);
            public Vector3 Pos => TestMapData.WorldPos(Gx, Gy) + Vector3.up * TestMapData.GroundHeight(Mathf.RoundToInt(Gx), Mathf.RoundToInt(Gy));
        }

        public static readonly Site[] Sites =
        {
            new Site { Id = "d_tomb", Kind = Kind.Tomb, Gx = 3.9f, Gy = 1.1f, NameKo = "산기슭 잠든 무덤" },
            new Site { Id = "d_school", Kind = Kind.School, Gx = 4.6f, Gy = 4.2f, NameKo = "강가 옛 서당" },
            new Site { Id = "d_forge", Kind = Kind.Forge, Gx = 3.6f, Gy = 9.0f, NameKo = "논밭 쇠부리 터" },
            new Site { Id = "w_altar", Kind = Kind.Weekly, Gx = 1.5f, Gy = 4.35f, NameKo = "먹구름 제단" },
        };

        public struct Stage { public string N; public int Ar; public float Hp, Atk; }
        public static readonly Stage[] Stages =
        {
            new Stage { N = "I", Ar = 1, Hp = 1f, Atk = 1f },
            new Stage { N = "II", Ar = 6, Hp = 2f, Atk = 1.5f },
            new Stage { N = "III", Ar = 12, Hp = 3.5f, Atk = 2.2f },
        };

        /// <summary>파도 한 자리 — 종류 + 덧씌울 원소(물리 = 그 종류 원소 그대로).</summary>
        public struct Foe { public FieldEnemy.Kind Kind; public GoElement Over; public Foe(FieldEnemy.Kind k, GoElement o = GoElement.Physical) { Kind = k; Over = o; } }

        private static readonly Foe Gh = new Foe(FieldEnemy.Kind.DrownedGhost), Im = new Foe(FieldEnemy.Kind.EmberImp), Wr = new Foe(FieldEnemy.Kind.StormWraith),
            Bd = new Foe(FieldEnemy.Kind.Bandit), Sk = new Foe(FieldEnemy.Kind.Skeleton);

        /// <summary>웹 파도 → 이 트랙 몸: 물두꺼비 = 물귀신 · 불도깨비 = 불도깨비 · 거북 = 암 물귀신 · 회오리매 = 풍 번개귀 · 덩굴 = 초 물귀신 · 섬영마·날쌘용 = 번개귀 · 멧돼지 = 산적 · 불씨 정예 = 불도깨비.</summary>
        public static Foe[][] Waves(Kind k) => k switch
        {
            Kind.Tomb => new[] { new[] { Gh, Gh, Im }, new[] { new Foe(FieldEnemy.Kind.DrownedGhost, GoElement.Geo), Gh, Gh } },
            Kind.School => new[] { new[] { new Foe(FieldEnemy.Kind.StormWraith, GoElement.Anemo), new Foe(FieldEnemy.Kind.StormWraith, GoElement.Anemo), new Foe(FieldEnemy.Kind.DrownedGhost, GoElement.Dendro) }, new[] { Wr, Sk, Sk } },
            Kind.Forge => new[] { new[] { Im, Im, Bd }, new[] { Im, Im, Im } },
            _ => new[] { new[] { Wr } },
        };

        public const int DomainDanger = 2;
        public const float ArenaR = 40f, EnterR = 11f, TreeR = 7.4f, FoeRing = 11f, StartDelay = 3f;
        public const float Limit = 120f, WeeklyLimit = 180f;
        public const float LeyWaterSec = 4f, LeyEnergy = 13f, LeyAtk = 1.3f;
        public const int ResinMax = 120, ResinSec = 600, Cost = 15, WeeklyCost = 45, WeeklyHalf = 25, WeeklyHalfN = 2;
        // 주간 보스
        public const float BossHp = 220f * 20f, BossAtk = 20f * 2.2f, BossReach = 4.4f * 1.85f, BossTelegraph = 1.2f, BossRecover = 3.5f, BossScale = 2.2f;
        public const float P2At = 0.5f, P2Shield = 0.1f, P2Cd = 0.69f;

        public static float LimitOf(Kind k) => k == Kind.Weekly ? WeeklyLimit : Limit;
        public static bool StageOpen(int stage, int rank) => stage >= 0 && stage < Stages.Length && rank >= Stages[stage].Ar;

        public static string KindName(Kind k) => k switch
        {
            Kind.Tomb => GoLocalization.T("domain.kind.tomb", "잠든 무덤"),
            Kind.School => GoLocalization.T("domain.kind.school", "옛 서당"),
            Kind.Forge => GoLocalization.T("domain.kind.forge", "쇠부리 터"),
            _ => GoLocalization.T("domain.kind.weekly", "먹구름 제단"),
        };

        public static string LootName(Kind k) => k switch
        {
            Kind.Tomb => GoLocalization.T("domain.loot.tomb", "보패"),
            Kind.School => GoLocalization.T("domain.loot.school", "무예 책"),
            Kind.Forge => GoLocalization.T("domain.loot.forge", "강화석"),
            _ => GoLocalization.T("domain.loot.weekly", "뇌룡 비늘·★5 보패"),
        };

        public static string LeyText(Kind k) => k switch
        {
            Kind.Tomb => GoLocalization.T("domain.ley.tomb", "적이 4초마다 물을 띤다"),
            Kind.School => GoLocalization.T("domain.ley.school", "적을 쓰러뜨리면 명단 기력 +13"),
            Kind.Forge => GoLocalization.T("domain.ley.forge", "적 공격 ×1.3"),
            _ => GoLocalization.T("domain.ley.weekly", "체력 절반에서 뇌 방패를 두르고 빨라진다"),
        };

        public static Color ColorOf(Kind k) => k switch
        {
            Kind.Tomb => new Color(0.5f, 0.83f, 1f),
            Kind.School => new Color(1f, 0.82f, 0.48f),
            Kind.Forge => new Color(1f, 0.6f, 0.35f),
            _ => new Color(0.71f, 0.55f, 1f),
        };

        // ---- 원기·주(순수) ----

        /// <summary>원기 — (값, 기준 시각)을 now 까지 채운 새 값(웹 `resinAt`).</summary>
        public static (int v, long t) ResinAt(int v, long t, long now)
        {
            if (v >= ResinMax) return (v, now);
            long gain = (now - t) / ResinSec;
            if (gain <= 0) return (v, t);
            int nv = (int)Mathf.Min(ResinMax, v + gain);
            return (nv, nv >= ResinMax ? now : t + gain * ResinSec);
        }

        /// <summary>이 주의 키 — 월요일 새벽 4시에 갈린다(유닉스 초, 지역 시각).</summary>
        public static string WeekKey(long unix)
        {
            var d = System.DateTimeOffset.FromUnixTimeSeconds(unix).ToLocalTime().DateTime.AddHours(-4);
            int back = ((int)d.DayOfWeek + 6) % 7;
            return d.Date.AddDays(-back).ToString("yyyy-MM-dd");
        }

        // ---- 보상(순수, 웹 `rewardOf`) ----

        public struct Reward
        {
            public int Gold, Polish, Ore;
            public List<(int rarity, string set)> Arts;
            public int[] Mats; // TalentState 재료 순서(쪽지·교본·비전·매듭·비늘)
        }

        public static Reward RewardOf(Kind k, int stage, int seq)
        {
            int s = Mathf.Clamp(stage, 0, 2);
            bool odd = seq % 2 == 1;
            var r = new Reward { Gold = new[] { 60, 90, 130 }[s], Arts = new List<(int, string)>(), Mats = new int[5] };
            switch (k)
            {
                case Kind.Tomb:
                {
                    string set = odd ? "depth" : "crimson";
                    foreach (int q in new[] { new[] { 4, 4 }, new[] { 4, 4, 5 }, new[] { 4, 5, 5 } }[s]) r.Arts.Add((q, set));
                    r.Polish = new[] { 1, 2, 3 }[s];
                    break;
                }
                case Kind.School:
                    r.Mats = new[] { new[] { 3, 1, 0, 0, 0 }, new[] { 0, 3, 0, 0, 0 }, new[] { 0, 3, 1, 0, 0 } }[s];
                    break;
                case Kind.Forge:
                    r.Ore = new[] { 3, 5, 8 }[s];
                    break;
                default:
                {
                    string ws = odd ? "gladiator" : "emblem";
                    r.Gold = new[] { 150, 200, 260 }[s];
                    r.Mats = new[] { new[] { 0, 2, 0, 0, 1 }, new[] { 0, 3, 0, 0, 2 }, new[] { 0, 0, 2, 1, 3 } }[s];
                    foreach (int q in new[] { new[] { 5 }, new[] { 5 }, new[] { 5, 5 } }[s]) r.Arts.Add((q, ws));
                    break;
                }
            }
            return r;
        }
    }

    /// <summary>109-14-9 원기(값·기준 시각)·받은 수·이 주 주간 보스 받은 수(세이브 v26).</summary>
    public static class DomainState
    {
        private static int _resin = GoDomain.ResinMax;
        private static long _resinT = -1;
        public static int Claims { get; private set; }
        private static string _week = "";
        private static int _weekN;
        public static long NowForTest = -1;
        public static long Now => NowForTest >= 0 ? NowForTest : System.DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        private static void Fill()
        {
            if (_resinT < 0) _resinT = Now;
            var (v, t) = GoDomain.ResinAt(_resin, _resinT, Now);
            _resin = v;
            _resinT = t;
        }

        private static void Week()
        {
            string wk = GoDomain.WeekKey(Now);
            if (_week != wk) { _week = wk; _weekN = 0; }
        }

        public static int Resin { get { Fill(); return _resin; } }

        /// <summary>다음 원기 1 까지 남은 초(가득이면 0).</summary>
        public static long ResinNextSec { get { Fill(); return _resin >= GoDomain.ResinMax ? 0 : System.Math.Max(0, _resinT + GoDomain.ResinSec - Now); } }

        public static int WeeklyUsed { get { Week(); return _weekN; } }
        public static int CostOf(GoDomain.Kind k) => k == GoDomain.Kind.Weekly ? (WeeklyUsed < GoDomain.WeeklyHalfN ? GoDomain.WeeklyHalf : GoDomain.WeeklyCost) : GoDomain.Cost;

        public static bool Spend(int n)
        {
            Fill();
            if (_resin < n) return false;
            if (_resin >= GoDomain.ResinMax) _resinT = Now; // 가득에서 쓰면 그때부터 찬다
            _resin -= n;
            return true;
        }

        /// <summary>받았다고 적는다 — 몇 번째인지(보상 세트 번갈이)를 돌려준다.</summary>
        public static int MarkClaim(GoDomain.Kind k)
        {
            int seq = Claims;
            Claims++;
            if (k == GoDomain.Kind.Weekly) { Week(); _weekN++; }
            return seq;
        }

        public static void SetResinForTest(int v) { _resin = Mathf.Clamp(v, 0, GoDomain.ResinMax); _resinT = Now; }

        public static (int resin, long t, int claims, string week, int weekN) Snapshot()
        {
            Fill();
            return (_resin, _resinT, Claims, _week, _weekN);
        }

        /// <summary>세이브에서 — 기준 시각이 0 이하(옛 세이브)면 가득.</summary>
        public static void Restore(int resin, long t, int claims, string week, int weekN)
        {
            if (t <= 0) { _resin = GoDomain.ResinMax; _resinT = Now; }
            else { _resin = Mathf.Clamp(resin, 0, GoDomain.ResinMax); _resinT = t; }
            Claims = Mathf.Max(0, claims);
            _week = week ?? "";
            _weekN = Mathf.Max(0, weekN);
        }

        public static void ResetForTest() => Restore(0, 0, 0, "", 0);
    }
}
