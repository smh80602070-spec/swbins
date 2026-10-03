using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 101-2 REALM 5-3(전반부) "일기토" — 웹판 §5-3(`saga-web/saga-realm/PLAN.md`
    /// 131행)의 "합마다 베기/찌르기/막기 3택(가위바위보 + 무력 차 보정),
    /// 결과가 배율(이기면×1.3·비기면×1.0·지면×0.8)로 얹힌다"를 옮긴다.
    /// saga-godot REALM(`realm_war.gd` DUEL_* 상수)이 이미 "이 슬라이스의
    /// fight()는 10합을 뭉쳐 도는 집계식이라 합마다가 아니라 싸움 전체에
    /// 한 번 곱한다"로 재해석해 실기 승인을 받았다 — 이 트랙도 같은 결로
    /// 3합 결과를 평균 배율 하나로 뭉쳐 <see cref="RealmWar.Fight"/>의
    /// `duelPowerMul`에 얹는다. "무력 차 보정"은 이 슬라이스엔 AI 쪽
    /// 무력이라는 개념이 없어(적 성엔 무장이 없다) 뺐다 — 순수 3택
    /// 가위바위보로 좁힌다. 실시간 타이밍 입력은 안 넣는다(턴제 판,
    /// PLAN.md 105-Q3와 같은 결).
    /// </summary>
    public static class RealmDuelState
    {
        public const int Rounds = 3;
        public static readonly string[] Moves = { "slash", "stab", "guard" };

        public const float WinMul = 1.3f;
        public const float TieMul = 1.0f;
        public const float LoseMul = 0.8f;

        private static readonly Dictionary<string, string> Beats = new Dictionary<string, string>
        {
            ["slash"] = "guard", // 베기 > 막기
            ["guard"] = "stab",  // 막기 > 찌르기
            ["stab"] = "slash",  // 찌르기 > 베기
        };

        public static string MoveName(string move) => move switch
        {
            "slash" => RealmLocalization.T("duel.move_slash", "베기"),
            "stab" => RealmLocalization.T("duel.move_stab", "찌르기"),
            "guard" => RealmLocalization.T("duel.move_guard", "막기"),
            _ => move,
        };

        public static string RoundResult(string playerMove, string enemyMove)
        {
            if (playerMove == enemyMove) return "tie";
            return Beats[playerMove] == enemyMove ? "win" : "lose";
        }

        public static float RoundMul(string result) => result switch
        {
            "win" => WinMul,
            "lose" => LoseMul,
            _ => TieMul,
        };

        /// <summary>시나리오 일기토(tasks U-0027) — 세 합이 넘어가도 승부가 안 나면 한 합씩 더, 이 합 수까지.</summary>
        public const int MaxRounds = 6;

        /// <summary>이긴 합이 더 많으면 true, 적으면 false, 같으면 null(승부 안 남).</summary>
        public static bool? Decide(List<string> results)
        {
            if (results == null) return null;
            int wins = 0, losses = 0;
            foreach (var r in results) { if (r == "win") wins++; else if (r == "lose") losses++; }
            return wins > losses ? true : wins < losses ? (bool?)false : null;
        }

        public static string AiMove() => Moves[Random.Range(0, Moves.Length)];

        /// <summary>3합 결과를 평균 배율 하나로 뭉친다(godot REALM 참고 설계와
        /// 같은 재해석 — 클래스 주석 참고).</summary>
        public static float AverageMul(List<string> results)
        {
            if (results == null || results.Count == 0) return 1f;
            float sum = 0f;
            foreach (var r in results) sum += RoundMul(r);
            return sum / results.Count;
        }
    }
}
