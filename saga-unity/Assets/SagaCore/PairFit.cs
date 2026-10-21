using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0151 — 빌린 소품 자리에 자체 짝을 세울 때의 맞춤(편집기 `SelfPairs.PairFitModels` 가 잰 값). 키는 소품 표의 `Model`(`#조각` 포함 그대로),
    /// 맞춤 = 옛 모델 상자 가운데에 짝 상자 가운데가 오게 옮김 + 배율(보통 같은 배율 = 옛 최대 변 / 짝 최대 변, 가는 통나무만 축마다). 빌더 셋(1만리·3마을·2나락)이 같이 쓴다.
    /// </summary>
    public static class PairFit
    {
        [System.Serializable]
        public struct Fit
        {
            public Vector3 Offset;
            public Vector3 Scale;
        }

        /// <summary>키가 있으면 그 칸, 없으면 −1.</summary>
        public static int Find(string[] keys, string key)
        {
            if (keys == null) return -1;
            for (int i = 0; i < keys.Length; i++)
                if (keys[i] == key) return i;
            return -1;
        }

        /// <summary>짝 모델을 `parent` 밑에 세우고 맞춤을 입힌다.</summary>
        public static GameObject Spawn(GameObject model, Transform parent, Fit fit)
        {
            var go = Object.Instantiate(model, parent);
            go.transform.localPosition = fit.Offset;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = fit.Scale;
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(c);
            return go;
        }
    }
}
