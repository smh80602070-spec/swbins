using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-26 탐사 게시판(웹 사가만리 ⑲-26) — 역참 다섯 곁 가마솥 반대편(서쪽 6.5m)에 판자 게시판(기둥 둘·판·지도 종이)을 도형으로 세운다.
    /// 반경 7.4m 안이 "게시판 곁"(`PlayerAtBoard`). `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음). 땅 높이는 레이로 앉힌다.
    /// </summary>
    public class DispatchField : MonoBehaviour
    {
        public static DispatchField Instance { get; private set; }

        private readonly Dictionary<string, Vector3> _boards = new Dictionary<string, Vector3>();
        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();

        public IReadOnlyDictionary<string, Vector3> Boards => _boards;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }
        private void Start() => Rebuild();

        /// <summary>발 자리가 게시판 곁이면 그 역참 id(아니면 null).</summary>
        public static string BoardNear(Vector3 feet) => GoDispatch.BoardNear(feet);

        public static bool PlayerAtBoard()
        {
            var fc = FieldCombat.Instance;
            return fc != null && GoDispatch.BoardNear(fc.transform.position) != null;
        }

        private Material Mat(string key, Color c)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Dispatch_" + key + " (generated)", color = c };
            _mats[key] = m;
            return m;
        }

        private static void Prim(Transform parent, Vector3 local, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        public void Rebuild()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Dispatch_")) Destroy(c.gameObject);
            _boards.Clear();
            var wood = Mat("wood", new Color(0.42f, 0.29f, 0.18f));
            var paper = Mat("paper", new Color(0.87f, 0.91f, 0.94f));
            foreach (var w in GoWorldMap.Waypoints)
            {
                Vector3 p = FolkWalker.Grounded(GoDispatch.BoardPos(w));
                _boards[w.Id] = p;
                var root = new GameObject("Dispatch_board_" + w.Id);
                root.transform.SetParent(transform, false);
                root.transform.position = p;
                root.transform.rotation = Quaternion.Euler(0f, 90f, 0f); // 글면이 동쪽(역참) 쪽
                foreach (float ox in new[] { -1.2f, 1.2f }) Prim(root.transform, new Vector3(ox, 1.5f, 0f), new Vector3(0.22f, 3f, 0.22f), wood);
                Prim(root.transform, new Vector3(0f, 2.4f, 0f), new Vector3(2.9f, 1.6f, 0.15f), wood);
                Prim(root.transform, new Vector3(0f, 2.4f, 0.1f), new Vector3(2.2f, 1.1f, 0.04f), paper);
            }
        }
    }
}
