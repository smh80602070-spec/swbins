using System;
using System.Collections.Generic;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 101-2 5.1 "축복(祝福) 3택" — 웹판 §5.1(`saga-web/saga-dungeon/PLAN.md`,
    /// 웹 자체도 미착수)의 "은사 3택을 회차 빌드로 재해석" 의도를 이 트랙
    /// 실제 시스템에 맞춰 다시 짠다. 웹판은 무예 4칸·서명 무예·7원소 시너지
    /// 표(36개)를 전제하지만, 이 트랙은 단일 인물·단일 무기(<see cref="HeroState"/>)에
    /// 원소 시스템 자체가 없다 — 대신 이 트랙엔 웹판에 없는 실제 "빌드" 갈림이
    /// 이미 있다(<see cref="Saga.Dungeon.Player.PlayerCombat"/> 클래스 주석, 51장
    /// "하나를 크게(강공격)" 대 "여럿을 조금씩(회전베기)"). SagaGo의
    /// <see cref="PerkState"/>(승급 3택 — 축마다 정확히 하나, 고르면 교체)와
    /// 같은 구조를 그대로 가져오되, 축은 그 축 3개 대신 이 트랙 고유의
    /// 공(攻)/수(守)/선(旋) 셋으로 잡는다 — 선(旋) 축이 51장의 회전베기 빌드를
    /// 직접 강화해 "범위형으로 계속 밀어붙일지" 선택이 실제로 의미 있게 한다.
    ///
    /// 트리거는 <see cref="World.DungeonFloorRunner.FloorDescended"/>(보스층
    /// 진입, <see cref="DungeonFormulas.IsBossFloor"/> — 웹판 "3층마다"와 같은 문턱)
    /// — GameBootstrap이 구독한다. 효과는 배율로만 적용한다(기초 능력치 불변
    /// 원칙 유지): 공은 <see cref="HeroState.HitDamage"/>에, 수는
    /// <see cref="HeroState.TakeDamage"/>가 나누는 값에, 선은 회전베기 쿨다운에.
    /// </summary>
    public static class BlessingState
    {
        public enum Axis { Atk, Def, Sweep }

        public const int RejectGoldPerFloor = 10; // 웹판 "거절 = 금 30×층" 뜻을 이 트랙 통화 규모로.

        public readonly struct BlessingDef
        {
            public readonly Axis Axis;
            public readonly string Id;
            public readonly string Name;
            public readonly float Bonus; // 0.05~0.08 (단일 축 배율 보너스, PerkState.cs와 같은 규모)

            public BlessingDef(Axis axis, string id, string name, float bonus)
            {
                Axis = axis;
                Id = id;
                Name = name;
                Bonus = bonus;
            }
        }

        // 풀 12 = 축 3 × 축당 4, 효과 +5~8%(PerkState.cs 수치 규모 재사용).
        private static readonly BlessingDef[] Pool =
        {
            new BlessingDef(Axis.Atk, "atk_edge", "예리한 날", 0.05f),
            new BlessingDef(Axis.Atk, "atk_might", "억센 완력", 0.06f),
            new BlessingDef(Axis.Atk, "atk_precise", "정확한 급소", 0.07f),
            new BlessingDef(Axis.Atk, "atk_wrath", "분노의 일격", 0.08f),
            new BlessingDef(Axis.Def, "def_ward", "굳센 살갗", 0.05f),
            new BlessingDef(Axis.Def, "def_stance", "버티는 자세", 0.06f),
            new BlessingDef(Axis.Def, "def_scale", "질긴 비늘", 0.07f),
            new BlessingDef(Axis.Def, "def_shell", "단단한 갑주", 0.08f),
            new BlessingDef(Axis.Sweep, "sweep_flow", "이어진 몸놀림", 0.05f),
            new BlessingDef(Axis.Sweep, "sweep_wide", "넓은 휘두름", 0.06f),
            new BlessingDef(Axis.Sweep, "sweep_light", "가벼운 발놀림", 0.07f),
            new BlessingDef(Axis.Sweep, "sweep_gale", "돌개바람", 0.08f),
        };

        private static readonly Dictionary<Axis, BlessingDef> Chosen = new Dictionary<Axis, BlessingDef>();

        public static event Action<BlessingDef> BlessingChosen;
        public static event Action<int> Rejected; // 지급된 골드

        /// <summary>HeroState.HitDamage에 곱한다 — 평타·강공격·회전베기 전부 이 값을
        /// 밑값으로 쓰므로 공(攻) 축은 세 공격 전부를 고르게 키운다.</summary>
        public static float AtkMultiplier => Multiplier(Axis.Atk);

        /// <summary>HeroState.TakeDamage가 이 값으로 나눈다 — 클수록 덜 맞는다.</summary>
        public static float DefMultiplier => Multiplier(Axis.Def);

        /// <summary>PlayerCombat의 회전베기 쿨다운을 이 값으로 나눈다 — 클수록 더 자주 쓴다.</summary>
        public static float SweepMultiplier => Multiplier(Axis.Sweep);

        private static float Multiplier(Axis axis) =>
            (Chosen.TryGetValue(axis, out var b) ? 1f + b.Bonus : 1f) * DungeonFavor.Mul(axis); // tasks U-0194 신의 가호(고른 횟수 3·6 → 단마다 ×1.08, 0단 = 1)

        public static bool HasBlessing(Axis axis) => Chosen.ContainsKey(axis);

        public static BlessingDef? BlessingOf(Axis axis) => Chosen.TryGetValue(axis, out var b) ? b : (BlessingDef?)null;

        /// <summary>축마다 그 축 풀(4개) 중 하나를 무작위로 골라 정확히 3장(축 3개)
        /// 돌려준다 — 이미 그 축에 축복이 있어도 다시 제안한다(고르면 교체).</summary>
        public static BlessingDef[] RollChoice(Random rng = null)
        {
            rng ??= new Random();
            var axes = new[] { Axis.Atk, Axis.Def, Axis.Sweep };
            var result = new BlessingDef[axes.Length];
            for (int i = 0; i < axes.Length; i++)
            {
                result[i] = RandomOfAxis(axes[i], rng);
            }
            return result;
        }

        private static BlessingDef RandomOfAxis(Axis axis, Random rng)
        {
            var candidates = new List<BlessingDef>(4);
            foreach (var b in Pool) if (b.Axis == axis) candidates.Add(b);
            return candidates[rng.Next(candidates.Count)];
        }

        /// <summary>그 축의 축복을 갈아 끼운다(있었으면 교체) — 기초 능력치는 그대로,
        /// 배율만 바뀐다.</summary>
        public static void Choose(BlessingDef blessing)
        {
            Chosen[blessing.Axis] = blessing;
            BlessingChosen?.Invoke(blessing);
        }

        /// <summary>웹판 "거절 = 금 30×층"의 뜻 — 이 트랙 통화 규모로 floor를 곱한다.</summary>
        public static void Reject(int floor)
        {
            int gold = RejectGoldPerFloor * Math.Max(1, floor);
            HeroState.AddGold(gold);
            Rejected?.Invoke(gold);
        }

        /// <summary>SaveState.cs 전용 — 축별로 하나씩 있는 그대로 id만 뽑는다(순서는 Atk/Def/Sweep 고정).</summary>
        public static List<string> SnapshotIds()
        {
            var ids = new List<string>();
            foreach (var axis in new[] { Axis.Atk, Axis.Def, Axis.Sweep })
            {
                if (Chosen.TryGetValue(axis, out var b)) ids.Add(b.Id);
            }
            return ids;
        }

        /// <summary>세이브에서 복원 — id로 풀에서 되찾아 그 축에 앉힌다. 모르는 id는 조용히 무시.</summary>
        public static void Restore(IEnumerable<string> ids)
        {
            Chosen.Clear();
            if (ids == null) return;
            foreach (var id in ids)
            {
                foreach (var b in Pool)
                {
                    if (b.Id == id) { Chosen[b.Axis] = b; break; }
                }
            }
        }
    }
}
