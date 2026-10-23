using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0176 띄우기·공중 콤보 — 웹 사가종횡 W-0345 `side-launch.js` · 고돗 G-0314 `story_launch.gd` 짝(던전앤파이터·엘소드 — 구조만).
    /// ↑(W·위 화살표·스틱 위 — 밧줄 오르기와 같은 입력, 새 키 없음)를 누른 채 근접으로 치면(평타·근접 무예) 잡졸이 떠오른다(두목·관문 대장 제외).
    /// 떠 있는 적을 또 치면 <see cref="MaxHits"/>타까지 다시 튕기고, 내려와 닿으면 마지막 친 힘 × <see cref="FallK"/> 떨어짐 피해.
    /// 비율은 웹 그대로(띄움 0.7·저글 0.3 × 뛰기 760px/s · 중력 1900px/s²), px → m 는 <see cref="FieldMapData.ScaleMPerPx"/>(고돗과 같은 0.02).
    /// 상태는 적 몸에만(런타임) — 세이브 없음. 이 트랙 잡졸은 원래 걷거나 몸으로 치지 않아 "떠 있는 동안 멈춤"은 따로 없다.
    /// </summary>
    public static class StoryLaunch
    {
        public const float LaunchK = 0.7f, JuggleK = 0.3f, FallK = 0.5f;
        public const int MaxHits = 4;
        public static bool On = true;
        /// <summary>진단 — ↑ 눌림을 붙든다(null 이면 실제 입력).</summary>
        public static bool? UpForTest;

        public static float Jump => 760f * FieldMapData.ScaleMPerPx;
        public static float Gravity => 1900f * FieldMapData.ScaleMPerPx;

        public class Air { public float GroundY, Vy, LastHitDmg; public int Hits; }

        public static Air Launch(float groundY, float dmg) => new Air { GroundY = groundY, Vy = Jump * LaunchK, LastHitDmg = dmg };

        /// <summary>떠 있는 적 추가타 — 다시 튕겼으면 true(상한이면 false — 그대로 떨어진다).</summary>
        public static bool Juggle(Air a, float dmg)
        {
            if (dmg > 0f) a.LastHitDmg = dmg;
            if (a.Hits >= MaxHits) return false;
            a.Hits++;
            a.Vy = Jump * JuggleK;
            return true;
        }

        /// <summary>한 틱 — 닿았으면 떨어짐 피해(≥1), 아니면 0. y 를 옮긴다.</summary>
        public static float Step(Air a, ref float y, float dt)
        {
            if (a == null || dt <= 0f) return 0f;
            y += a.Vy * dt;
            a.Vy -= Gravity * dt;
            if (a.Vy < 0f && y <= a.GroundY)
            {
                y = a.GroundY;
                return Mathf.Max(1f, Mathf.Round(a.LastHitDmg * FallK));
            }
            return 0f;
        }
    }
}
