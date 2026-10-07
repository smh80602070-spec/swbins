using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// U-0036 A — 사가마을 흩어진 자연 소품 자리를 자체툴(K-0052) 통일 세트로. 씬을 다시 짓지 않고 런타임에 갈아 끼운다
    /// (씬에 구워진 procgen 모델 위에). 모델이 없으면 null 이라 호출한 쪽이 구워진 것을 그대로 둔다.
    /// 모델은 이 파일이 안 놓는다(K-0019 배치).
    /// </summary>
    public static class ForestNatureModels
    {
        public const string FruitTreeModel = "World/tree_broadleaf_01";

        private static GameObject _fruitTree;
        private static bool _fruitTreeLoaded;

        public static GameObject FruitTree()
        {
            if (_fruitTreeLoaded && _fruitTree != null) return _fruitTree;
            _fruitTree = Resources.Load<GameObject>(FruitTreeModel);
            _fruitTreeLoaded = _fruitTree != null;
            return _fruitTree;
        }
    }
}
