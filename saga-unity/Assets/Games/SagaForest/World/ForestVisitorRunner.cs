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
    ///
    /// 109-12-2(웹 §5.10·5.11) — 찾은 도깨비 꼬마는 대장 곁에 서서 춤추고, 눌러앉은 손님은 제자리(`SettleSpots`)에 선다
    /// (제 손님 날엔 광장 한가운데). 손님이 이 트랙 마을 사람이면(루미) 광장에 나와 있는 동안 평소 자리에선 숨긴다.
    /// 광장에 둘 이상이면 날짜 해시로 한 쌍이 마주 보고 수다.
    /// </summary>
    public class ForestVisitorRunner : MonoBehaviour
    {
        public static ForestVisitorRunner Instance { get; private set; }

        private string[] _bodyNames = new string[0];
        private GameObject[] _bodyModels = new GameObject[0];
        private int _builtDay = int.MinValue;
        private string _builtKey = "";
        private int _builtSettled = -1;
        private ForestVisitorNpc _npc;
        private readonly List<ForestVisitorPiece> _pieces = new List<ForestVisitorPiece>();
        private readonly List<ForestVisitorNpc> _kids = new List<ForestVisitorNpc>();
        private readonly List<ForestVisitorNpc> _settled = new List<ForestVisitorNpc>();
        private readonly List<ForestEraFolk> _hiddenFolk = new List<ForestEraFolk>();
        private List<Vector2> _spots = new List<Vector2>();
        private float _checkLeft;

        public ForestVisitorNpc Npc => _npc;
        public IReadOnlyList<ForestVisitorPiece> Pieces => _pieces;
        public IReadOnlyList<ForestVisitorNpc> Kids => _kids;
        public IReadOnlyList<ForestVisitorNpc> SettledNpcs => _settled;
        public IReadOnlyList<ForestEraFolk> HiddenFolk => _hiddenFolk;
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
            if (ForestVisitors.Today != _builtDay || ForestVisitors.TodayVisitor.Key != _builtKey
                || ForestVisitors.SettledList.Count != _builtSettled) Rebuild();
        }

        /// <summary>오늘 손님·꼬마·눌러앉은 손님·조각을 새로 세운다(진단도 날짜를 바꾼 뒤 부른다).</summary>
        public void Rebuild()
        {
            if (_npc != null) DestroyImmediate(_npc.gameObject);
            foreach (var p in _pieces) if (p != null) DestroyImmediate(p.gameObject);
            foreach (var k in _kids) if (k != null) DestroyImmediate(k.gameObject);
            foreach (var n in _settled) if (n != null) DestroyImmediate(n.gameObject);
            foreach (var f in _hiddenFolk) if (f != null) f.gameObject.SetActive(true);
            _pieces.Clear();
            _kids.Clear();
            _settled.Clear();
            _hiddenFolk.Clear();
            _spots.Clear();

            var v = ForestVisitors.TodayVisitor;
            var rec = ForestVisitors.Rec;
            _builtDay = ForestVisitors.Today;
            _builtKey = v.Key;
            _builtSettled = ForestVisitors.SettledList.Count;

            _npc = SpawnNpc(v, ForestVisitors.Spot, ForestVisitorNpc.Role.Today, "Visitor_" + v.Key);
            HideFolk(v);

            // 눌러앉은 손님 — 제자리(제 손님 날엔 위 한가운데).
            var settled = ForestVisitors.SettledList;
            for (int i = 0; i < settled.Count; i++)
            {
                if (settled[i] == v.Key) continue;
                int idx = ForestVisitors.IndexOf(settled[i]);
                if (idx < 0) continue;
                var sv = ForestVisitors.List[idx];
                _settled.Add(SpawnNpc(sv, ForestVisitors.SettleSpots[i % ForestVisitors.SettleSpots.Length], ForestVisitorNpc.Role.Settled, "Settled_" + sv.Key));
                HideFolk(sv);
            }
            AssignChat();

            if (v.Type != ForestVisitors.Kind.Collect) return;
            _spots = ForestVisitors.PieceSpots(ForestVisitors.Today, v.N, AvoidSpots());
            for (int i = 0; i < _spots.Count; i++)
            {
                if ((rec.GotMask & (1 << i)) != 0)
                {
                    if (v.Back) SpawnKid(v);
                    continue;
                }
                if (rec.Done) continue;
                var go = new GameObject($"VisitorPiece_{v.Key}_{i}");
                go.transform.SetParent(transform, false);
                go.transform.position = new Vector3(_spots[i].x, 0f, _spots[i].y);
                var piece = go.AddComponent<ForestVisitorPiece>();
                piece.Build(i, v.Key);
                _pieces.Add(piece);
            }
        }

        private ForestVisitorNpc SpawnNpc(ForestVisitors.Visitor v, Vector2 at, ForestVisitorNpc.Role role, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(at.x, 0f, at.y);
            go.transform.rotation = Quaternion.LookRotation(Vector3.back); // 스폰(남쪽)에서 걸어오는 쪽을 본다
            var npc = go.AddComponent<ForestVisitorNpc>();
            npc.Build(v, BodyOf(v.Body), this, role);
            return npc;
        }

        /// <summary>찾은 도깨비 꼬마 — 대장 곁(앞쪽 줄)에 작게 서서 춤춘다.</summary>
        private void SpawnKid(ForestVisitors.Visitor v)
        {
            int j = _kids.Count;
            var at = ForestVisitors.Spot + new Vector2(-1.4f - j * 1.0f, -1.3f);
            _kids.Add(SpawnNpc(v, at, ForestVisitorNpc.Role.Kid, $"VisitorKid_{j}"));
        }

        private void HideFolk(ForestVisitors.Visitor v)
        {
            if (string.IsNullOrEmpty(v.FolkId)) return;
            foreach (var f in Object.FindObjectsByType<ForestEraFolk>(FindObjectsSortMode.None))
            {
                if (f.Data.Id != v.FolkId) continue;
                f.gameObject.SetActive(false);
                _hiddenFolk.Add(f);
            }
        }

        /// <summary>수다 한 쌍 — 오늘 손님 + 눌러앉은 손님 중 날짜 해시로.</summary>
        private void AssignChat()
        {
            var people = new List<ForestVisitorNpc> { _npc };
            people.AddRange(_settled);
            var keys = new List<string>();
            foreach (var p in people) keys.Add(p.Data.Key);
            var (a, b) = ForestVisitors.ChatPair(keys, ForestVisitors.Today);
            if (a < 0) return;
            string text = ForestVisitors.ChatText(keys[a], keys[b]);
            people[a].ChatWith = people[b];
            people[b].ChatWith = people[a];
            people[a].Chat = people[b].Chat = text;
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
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Include, FindObjectsSortMode.InstanceID))
            {
                if (mb is ForestCollectSpot || mb is ForestLandmark || mb is ForestDeliveryMailbox || mb is ForestFruitTree
                    || mb is ForestWishStone || mb is ForestHouse || mb is ForestVillager || mb is ForestEraFolk)
                    list.Add(new Vector2(mb.transform.position.x, mb.transform.position.z));
            }
            return list;
        }

        /// <summary>조각을 주웠다 — 알림, 목록에서 뺀다. 도깨비 꼬마면 대장 곁으로 뛰어온다.</summary>
        public void OnPicked(ForestVisitorPiece piece)
        {
            string text = ForestVisitors.Pick(piece.Index);
            if (text != null)
            {
                DialogueLabel.Instance?.Show(text, ForestVisitors.LineSec);
                var v = ForestVisitors.TodayVisitor;
                if (v.Back) SpawnKid(v);
            }
            _pieces.Remove(piece);
            Destroy(piece.gameObject);
        }
    }
}
