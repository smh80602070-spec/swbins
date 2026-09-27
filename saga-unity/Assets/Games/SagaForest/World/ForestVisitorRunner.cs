using System.Collections.Generic;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-12-1 떠돌이 방문객 실행기 — `ForestBootstrap.Start` 가 Play 때 설치한다(씬 재빌드 없음).
    /// 오늘 손님 하나를 광장(`ForestVisitors.Spot`)에 세우고, 조각 손님이면 존 넷에 조각을 흩는다(주운 것은 빼고).
    /// 날이 바뀌면(자정을 넘겨 켜 두면) 다시 세운다. 몸은 부트스트랩의 빌린 몸 표(`visitorBodyNames/Models`)에서 이름으로 찾는다.
    /// </summary>
    public class ForestVisitorRunner : MonoBehaviour
    {
        public static ForestVisitorRunner Instance { get; private set; }

        private string[] _bodyNames = new string[0];
        private GameObject[] _bodyModels = new GameObject[0];
        private int _builtDay = int.MinValue;
        private string _builtKey = "";
        private ForestVisitorNpc _npc;
        private readonly List<ForestVisitorPiece> _pieces = new List<ForestVisitorPiece>();
        private List<Vector2> _spots = new List<Vector2>();
        private float _checkLeft;

        public ForestVisitorNpc Npc => _npc;
        public IReadOnlyList<ForestVisitorPiece> Pieces => _pieces;
        /// <summary>오늘 조각 자리 전부(주운 것 포함) — 진단·방위 힌트.</summary>
        public IReadOnlyList<Vector2> Spots => _spots;

        /// <summary>부트스트랩이 부른다. 이미 있으면 몸 표만 바꾸고 다시 세운다.</summary>
        public static ForestVisitorRunner Install(string[] bodyNames, GameObject[] bodyModels)
        {
            if (Instance == null)
            {
                var go = new GameObject("ForestVisitors");
                Instance = go.AddComponent<ForestVisitorRunner>();
            }
            Instance._bodyNames = bodyNames ?? new string[0];
            Instance._bodyModels = bodyModels ?? new GameObject[0];
            Instance.Rebuild();
            return Instance;
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            _checkLeft -= Time.deltaTime;
            if (_checkLeft > 0f) return;
            _checkLeft = 1f;
            if (ForestVisitors.Today != _builtDay || ForestVisitors.TodayVisitor.Key != _builtKey) Rebuild();
        }

        /// <summary>오늘 손님·조각을 새로 세운다(진단도 날짜를 바꾼 뒤 부른다).</summary>
        public void Rebuild()
        {
            if (_npc != null) DestroyImmediate(_npc.gameObject);
            foreach (var p in _pieces) if (p != null) DestroyImmediate(p.gameObject);
            _pieces.Clear();
            _spots.Clear();

            var v = ForestVisitors.TodayVisitor;
            var rec = ForestVisitors.Rec;
            _builtDay = ForestVisitors.Today;
            _builtKey = v.Key;

            var npcGo = new GameObject("Visitor_" + v.Key);
            npcGo.transform.SetParent(transform, false);
            npcGo.transform.position = new Vector3(ForestVisitors.Spot.x, 0f, ForestVisitors.Spot.y);
            npcGo.transform.rotation = Quaternion.LookRotation(Vector3.back); // 스폰(남쪽)에서 걸어오는 쪽을 본다
            _npc = npcGo.AddComponent<ForestVisitorNpc>();
            _npc.Build(v, BodyOf(v.Body), this);

            if (v.Type != ForestVisitors.Kind.Collect) return;
            _spots = ForestVisitors.PieceSpots(ForestVisitors.Today, v.N, AvoidSpots());
            if (rec.Done) return;
            for (int i = 0; i < _spots.Count; i++)
            {
                if ((rec.GotMask & (1 << i)) != 0) continue;
                var go = new GameObject($"VisitorPiece_{v.Key}_{i}");
                go.transform.SetParent(transform, false);
                go.transform.position = new Vector3(_spots[i].x, 0f, _spots[i].y);
                var piece = go.AddComponent<ForestVisitorPiece>();
                piece.Build(i, v.Key);
                _pieces.Add(piece);
            }
        }

        private GameObject BodyOf(string body)
        {
            if (string.IsNullOrEmpty(body)) return null;
            int k = System.Array.IndexOf(_bodyNames, body);
            return k >= 0 && k < _bodyModels.Length ? _bodyModels[k] : null;
        }

        /// <summary>남은 조각의 방위(광장 가운데에서) — 손님이 알려 준다.</summary>
        public List<int> RemainingDirs()
        {
            var dirs = new List<int>();
            var rec = ForestVisitors.Rec;
            for (int i = 0; i < _spots.Count; i++)
            {
                if ((rec.GotMask & (1 << i)) != 0) continue;
                int d = ForestVisitors.DirIndex(_spots[i]);
                if (!dirs.Contains(d)) dirs.Add(d);
            }
            return dirs;
        }

        /// <summary>조각이 피할 자리 — 존 소품·채집 자리·명소·우체통·마을 물건(같은 씬이면 늘 같다).</summary>
        public static List<Vector2> AvoidSpots()
        {
            var list = new List<Vector2>();
            foreach (var c in ForestZoneProps.Clusters)
                foreach (var p in c.Pieces)
                {
                    var w = ForestZoneProps.PiecePos(c, p);
                    list.Add(new Vector2(w.x, w.z));
                }
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.InstanceID))
            {
                if (mb is ForestCollectSpot || mb is ForestLandmark || mb is ForestDeliveryMailbox || mb is ForestFruitTree
                    || mb is ForestWishStone || mb is ForestHouse || mb is ForestVillager || mb is ForestEraFolk)
                    list.Add(new Vector2(mb.transform.position.x, mb.transform.position.z));
            }
            return list;
        }

        /// <summary>조각을 주웠다 — 알림, 목록에서 뺀다.</summary>
        public void OnPicked(ForestVisitorPiece piece)
        {
            string text = ForestVisitors.Pick(piece.Index);
            if (text != null) DialogueLabel.Instance?.Show(text, ForestVisitors.LineSec);
            _pieces.Remove(piece);
            Destroy(piece.gameObject);
        }
    }
}
