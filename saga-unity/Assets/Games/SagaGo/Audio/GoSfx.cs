using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Go.Data;

namespace Saga.Go.Audio
{
    /// <summary>
    /// U-0048 사가고 효과음 재생 — 이름(`ui_click`·`levelup`·`sword_hit` …, 정본 K-0045 `sfx_<이름>.ogg`)으로 <see cref="SagaSfx"/> 에서 클립을 찾아
    /// <see cref="GoAudio.PlaySfx"/> 로 낸다(음량 = 마스터 × 효과음 설정). 파일이 아직 없으면(K-0076 배치 전) 아무 소리도 안 나고 기록만 남는다.
    /// 같은 이름이 너무 빨리 연달아 불리는 곳(타격·피격)은 <paramref name="minGap"/> 초 안의 재호출을 건너뛴다.
    /// </summary>
    public static class GoSfx
    {
        /// <summary>코드가 부르는 이름 전부 — 진단이 정본 파일 목록에 있는지 대조한다.</summary>
        public static readonly string[] Used =
        {
            "ui_click", "ui_open", "ui_close", "ui_confirm", "levelup", "quest_done", "item_pick", "gacha", "fish_bite",
            "sword_hit", "sword_hurt", "whoosh", "victory", "summon",
            // U-0051 — 무기 종류별 타격(사가고 무기 다섯)·지면별 발소리·점프·착지·입수
            "axe_hit", "spear_hit", "staff_hit", "bow_hit", "step_dirt", "step_grass", "step_sand", "step_snow", "step_stone", "step_wood",
            "jump", "land", "splash",
        };

        /// <summary>U-0051 무기 종류 → 타격음 이름(`GoWeaponModels.Kind` 와 같은 이름 + `_hit`).</summary>
        public static string HitName(GoWeapons.Type t) => Saga.Go.Data.GoWeaponModels.Kind(t) + "_hit";

        private static readonly Dictionary<string, float> Last = new Dictionary<string, float>();

        public static void Play(string name, float volumeScale = 1f, float minGap = 0f)
        {
            if (minGap > 0f)
            {
                float now = Time.realtimeSinceStartup;
                if (Last.TryGetValue(name, out float t) && now - t < minGap) return;
                Last[name] = now;
            }
            GoAudio.PlaySfx(SagaSfx.Pick(name), volumeScale);
        }

        public static void ResetForTest() => Last.Clear();
    }
}
