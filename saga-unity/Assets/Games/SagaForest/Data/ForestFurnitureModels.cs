using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// U-0033 — 집 가구 id → 자체툴(K-0026) 실내 물건 GLB(`Resources/World/&lt;이름&gt;`). 뜻이 맞는 것만 잇는다 — 표에 없거나
    /// 모델을 못 읽으면 <see cref="Load"/> 가 null 이라 호출한 쪽(`ForestFurniturePlacer`)이 기존 도형을 그대로 쓴다.
    /// 모델은 이 파일이 안 놓는다(K-0019 배치).
    /// </summary>
    public static class ForestFurnitureModels
    {
        private const string Dir = "World/";

        private static readonly Dictionary<string, string> Map = new Dictionary<string, string>
        {
            { "bangseok", "cushion_01" },       // 방석
            { "hwabun", "vase_tall_01" },       // 화분
            { "deungjan", "oil_lamp_01" },      // 등잔
            { "soban", "low_table_01" },        // 소반
            { "mulhang", "kitchen_pot_01" },    // 물항아리
            { "seoan", "desk_01" },             // 서안
            { "hwaro", "hearth_stone_01" },     // 화로
            { "mungab", "cabinet_low_01" },     // 문갑
            { "bandaji", "trunk_01" },          // 반닫이
            { "dokja", "vase_tall_01" },        // 도자기
            { "byeongpung", "screen_folding_01" }, // 병풍
            { "visit_sailor", "trunk_01" },     // 선장의 궤짝
            { "visit_wisp", "hanging_lantern_01" }, // 도깨비 등롱
            { "visit_future", "table_lamp_01" },    // 시간의 탁상시계
            { "visit_dokkaebi", "table_wood_01" },  // 도깨비 방망이 탁자
            // 족자·거문고·바둑판·어탁·나비 표본은 맞는 모델이 없어 도형 유지.
        };

        private static readonly Dictionary<string, GameObject> Cache = new Dictionary<string, GameObject>();

        public static IEnumerable<KeyValuePair<string, string>> All => Map;

        public static string ModelName(string furnitureId) =>
            furnitureId != null && Map.TryGetValue(furnitureId, out var name) ? name : null;

        /// <summary>모델 원본(프리팹). 표에 없거나 못 읽으면 null(없는 것도 캐시).</summary>
        public static GameObject Load(string furnitureId)
        {
            string name = ModelName(furnitureId);
            if (name == null) return null;
            if (Cache.TryGetValue(name, out var prefab)) return prefab;
            prefab = Resources.Load<GameObject>(Dir + name);
            Cache[name] = prefab;
            return prefab;
        }
    }
}
