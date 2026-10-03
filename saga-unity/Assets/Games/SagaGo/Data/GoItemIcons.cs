using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// U-0030 — 무기·재료·보패 아이템 그림(K-0035, `Resources/Icons/icon128/&lt;키&gt;_g&lt;등급&gt;`). 표는 `Icons/map.json` 의
    /// saga-go 항목에서 옮겼다(고돗 G-0016 과 같은 그림·같은 키). 그림이 없는 id 는 null — 호출한 UI 가 글자만 둔다.
    /// 에셋은 K-0019 가 놓는다(이 파일은 안 놓는다).
    /// </summary>
    public static class GoItemIcons
    {
        private const string Dir = "Icons/icon128/";

        // 재료 id → 그림 키(map.json `saga-go:material:*` — 사과·청하란만 `go_` 접두).
        private static readonly Dictionary<string, string> MaterialKeys = new Dictionary<string, string>
        {
            { "mint", "mint" }, { "honey_flower", "honey_flower" }, { "apple", "go_apple" }, { "mushroom", "mushroom" },
            { "clam", "clam" }, { "orchid", "go_orchid" }, { "conch", "conch" }, { "ash_flower", "ash_flower" },
            { "snow_bloom", "snow_bloom" }, { "meat", "meat" },
        };

        // 보패 세트 id → 그림 키(`saga-go:artifact:0..4` = GoArtifacts.SetIds 순서). 세트 등급 3.
        private static readonly Dictionary<string, string> ArtifactKeys = new Dictionary<string, string>
        {
            { "gladiator", "af_gladiator" }, { "crimson", "af_crimson" }, { "viridescent", "af_viridescent" },
            { "emblem", "af_emblem" }, { "depth", "af_depth" },
        };

        private static readonly Dictionary<string, Sprite> Cache = new Dictionary<string, Sprite>();

        /// <summary>무기 한 자루 — 희귀도 1·3·4 = 틀 0·1·2(`w_sword_0` → `gw_sword_0_g0`). 그림 없으면 null.</summary>
        public static Sprite Weapon(string id, int rarity)
        {
            if (string.IsNullOrEmpty(id)) return null;
            int grade = rarity >= 4 ? 2 : rarity >= 3 ? 1 : 0;
            return Load("g" + id + "_g" + grade);
        }

        /// <summary>요리 재료 한 가지(`GoCooking.Items` 의 id). 그림 없으면 null.</summary>
        public static Sprite Material(string id) =>
            id != null && MaterialKeys.TryGetValue(id, out var key) ? Load(key + "_g0") : null;

        /// <summary>보패 세트 하나(`GoArtifacts.SetIds`). 그림 없으면 null.</summary>
        public static Sprite Artifact(string setId) =>
            setId != null && ArtifactKeys.TryGetValue(setId, out var key) ? Load(key + "_g3") : null;

        private static Sprite Load(string name)
        {
            if (Cache.TryGetValue(name, out var s)) return s;
            s = Resources.Load<Sprite>(Dir + name); // 없으면 null — 그것도 캐시해 매 프레임 안 찾는다.
            Cache[name] = s;
            return s;
        }
    }
}
