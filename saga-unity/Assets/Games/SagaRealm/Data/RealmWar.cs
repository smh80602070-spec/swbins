using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 3절 "전쟁 — 첫 전투 슬라이스"(saga-godot
    /// REALM 참고, 개념만) — js/war.js의 armyPower()/stepRound()/fight()
    /// 판정식 그대로(계수 0.055·ROUT 0.35·성벽 배율 0.9·공성 배율 0.045
    /// 전부 원작 값, 새로 안 지어냈다). 일기토·수전·진영(camp)은 이
    /// 슬라이스 범위 밖(문서 "뺀 것" 그대로) — 그 갈래들이 곱하던
    /// 배율은 전부 1로 고정한 것과 같다. **진형·전술은 101-2 5-6
    /// (2026-09-20)으로 `firstRoundPowerMul`·`defPowerMul` 두 자리가
    /// 열렸다** — `RealmWar` 자신은 여전히 숫자만 곱할 뿐, 어느 지형에
    /// 어느 전술이 맞는지는 `RealmWarState.ResolveTactic()`이 정한다
    /// (판정식 자체는 그대로 지킨다는 원래 원칙과 같은 결).
    /// </summary>
    public static class RealmWar
    {
        public const int Rounds = 10; // war.js ROUNDS
        public const float Rout = 0.35f; // war.js ROUT

        public readonly struct FightResult
        {
            public readonly bool Won;
            public readonly bool Routed;
            public readonly int LossA;
            public readonly int LossD;
            public readonly int WallFrom;
            public readonly int WallTo;
            public readonly bool Sortie;

            public FightResult(bool won, bool routed, int lossA, int lossD, int wallFrom, int wallTo, bool sortie)
            {
                Won = won; Routed = routed; LossA = lossA; LossD = lossD;
                WallFrom = wallFrom; WallTo = wallTo; Sortie = sortie;
            }
        }

        /// <summary>부대 전투력 = 병력×훈련×기술×장수 보정. 장수 보정은
        /// 가장 나은 한 사람이 끌고 나머지는 조금씩 보탠다(war.js
        /// armyPower() 그대로 — 진형·수전 보정은 이 슬라이스에 없어
        /// 항상 1).</summary>
        public static float ArmyPower(RealmArmy army, RealmLand land = RealmLand.Plain)
        {
            float trainF = 0.5f + Mathf.Clamp(army.Train, 0, 100) / 200f;
            float techF = 0.7f + Mathf.Clamp(army.Tech, 0, 900) / 900f * 0.6f;

            int bestCmd = 0, bestMight = 0;
            float extra = 0f, braveBonus = 0f;
            foreach (var id in army.OfficerIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o == null) continue;
                if (o.Command > bestCmd) bestCmd = o.Command;
                if (o.Might > bestMight) bestMight = o.Might;
                extra += (o.Command + o.Might) / 2f;
                braveBonus += RealmOfficerTraits.ArmyPowerBonus(id); // 101-2 5-1 "용맹" — 낀 인원수만큼 가산.
            }
            float lead = (1f + bestCmd / 100f * 0.5f + bestMight / 100f * 0.25f +
                         Mathf.Max(0, army.OfficerIds.Count - 1) * 0.03f) * (1f + braveBonus);
            if (extra == 0f) lead = 0.6f; // 장수 없는 군대는 오합지졸이다.

            // PLAN.md 109-15 명마 — 땅 싸움(강가 = 수전 ✕)에서 그 군의 가장 좋은 명마 배율. 안 탔으면 1.
            return army.Troops * trainF * techF * lead * army.Morale * RealmMounts.PowerMul(army.OfficerIds, land == RealmLand.River);
        }

        /// <summary>합(合) 하나 — war.js stepRound() 그대로. `round==0`에만
        /// 거는 `firstRoundPowerMul`(101-2 5-6 "기병 돌격" 같은 첫 합
        /// 한정 전술)과 매 합 거는 `defPowerMul`(같은 5-6 "화공" 같은
        /// 전투 내내 가는 전술) 두 자리를 열었고, 101-2 5-3 "일기토"로
        /// `duelPowerMul`(매 합, atk 쪽) 한 자리를 더 열었다 — 셋 다
        /// 기본값 1이라 안 쓰면 war.js 그대로다.</summary>
        private static string StepRound(RealmArmy atk, RealmArmy def, RealmEnemyRecord wallRef, RealmLand land, bool sortie,
            int round, float firstRoundPowerMul, float defPowerMul, float duelPowerMul)
        {
            float wallF = sortie
                ? RealmCityData.DefMul(land)
                : RealmCityData.DefMul(land) * (1f + (float)wallRef.Wall / Mathf.Max(1, wallRef.MaxWall) * 0.9f);

            float ap = ArmyPower(atk, land) * (round == 0 ? firstRoundPowerMul : 1f) * duelPowerMul;
            float dp = ArmyPower(def, land) * wallF * defPowerMul;

            int lossA = Mathf.RoundToInt(dp * 0.055f * (0.85f + UnityEngine.Random.value * 0.3f));
            int lossD = Mathf.RoundToInt(ap * 0.055f * (0.85f + UnityEngine.Random.value * 0.3f));
            atk.Troops = Mathf.Max(0, atk.Troops - lossA);
            def.Troops = Mathf.Max(0, def.Troops - lossD);

            if (!sortie)
            {
                wallRef.Wall = Mathf.Max(0, Mathf.RoundToInt(wallRef.Wall - atk.Troops * 0.045f * RealmCityData.SiegeMul(land)));
            }

            if (def.Troops <= 0) return "won";
            if (atk.Troops <= atk.Start * Rout) return "routed";
            if (!sortie && wallRef.Wall <= 0 && def.Troops < atk.Troops * 0.5f) return "won";
            if (!sortie && def.Troops <= atk.Troops * 0.08f) return "won";
            if (sortie && def.Troops < atk.Troops * 0.25f) return "won";
            return null;
        }

        /// <summary>한 달치 싸움 — war.js fight() 그대로(최대 10합).
        /// 승부가 안 갈리면(날이 저묾) 이 슬라이스엔 진영(camp) 시스템이
        /// 없어 routed와 같이 취급한다(문서 "뺀 것" 재해석). 101-2 5-6·5-3
        /// 세 배율 자리는 기본값(전부 1)이면 war.js 그대로.</summary>
        public static FightResult Fight(RealmArmy atk, RealmArmy def, RealmEnemyRecord wallRef, RealmLand land,
            float firstRoundPowerMul = 1f, float defPowerMul = 1f, float duelPowerMul = 1f)
        {
            bool sortie = def.Troops > atk.Troops * 0.85f;
            int wallFrom = wallRef.Wall;
            bool won = false, routed = false;

            for (int r = 0; r < Rounds; r++)
            {
                string outcome = StepRound(atk, def, wallRef, land, sortie, r, firstRoundPowerMul, defPowerMul, duelPowerMul);
                if (outcome == "won") { won = true; break; }
                if (outcome == "routed") { routed = true; break; }
            }
            if (!won && !routed) routed = true; // 날이 저묾 — 진영 없이 물러난 것과 같이.

            return new FightResult(won, routed, atk.Start - atk.Troops, def.Start - def.Troops,
                wallFrom, wallRef.Wall, sortie);
        }
    }
}
