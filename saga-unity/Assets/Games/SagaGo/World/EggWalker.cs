using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0046 걸음 세기(saga-godot `world/egg_incubator.gd`) — 플레이어가 걸은 거리(m)를 부화기·동행에게 준다. 한 프레임에 `GoEggs.StepCapM`(3m)
    /// 넘게 움직인 것(순간이동·지점 이동·집 입장)은 안 센다. 탈것·날개도 센다(빨리 갈수록 빨리 부화). 1m 모일 때마다 `EggState.Walk` 로 넘기고,
    /// 부화하면 알림 글을 띄운다. 동행 몸(`GoEggs.BodyName`, K-0075)이 `Resources/World` 에 있으면 뒤따르게 세운다 — 없으면 아무것도 안 세운다.
    /// `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class EggWalker : MonoBehaviour
    {
        public static EggWalker Instance { get; private set; }

        private const float FlushM = 1f, FollowDist = 2.2f;

        private Transform _player;
        private Vector3 _last;
        private bool _has;
        private float _acc;
        private GameObject _body;
        private string _bodyFor = "";

        /// <summary>마지막으로 알린 부화들(진단이 읽는다).</summary>
        public readonly List<EggState.Hatch> LastHatches = new List<EggState.Hatch>();

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        /// <summary>새 자리를 받는다 — 지난 자리와의 수평 거리만큼 쌓는다(순간이동은 버림). 진단도 부른다.</summary>
        public float Feed(Vector3 pos)
        {
            float counted = 0f;
            if (_has)
            {
                float d = Vector2.Distance(new Vector2(pos.x, pos.z), new Vector2(_last.x, _last.z));
                if (d > 0f && d <= GoEggs.StepCapM) { _acc += d; counted = d; }
            }
            _last = pos; _has = true;
            if (_acc >= FlushM) Flush();
            return counted;
        }

        /// <summary>쌓인 걸음을 부화기에 넘긴다 — 부화한 것들을 알린다.</summary>
        public void Flush()
        {
            float m = _acc; _acc = 0f;
            if (m <= 0f) return;
            LastHatches.Clear();
            foreach (var h in EggState.Walk(m)) { LastHatches.Add(h); Announce(h); }
        }

        public float Pending => _acc;

        private static void Announce(EggState.Hatch h)
        {
            var pet = GoEggs.Find(h.Pet);
            string name = pet != null ? pet.Value.Name : h.Pet;
            string tier = GoEggs.TierOf(h.Tier)?.Name ?? h.Tier;
            string text = h.Dup
                ? string.Format(GoLocalization.T("egg.hatch_dup", "{0}이 부화했다 — {1} (이미 만난 신수: 금 +{2} · 경험치 +{3})"), tier, name, GoEggs.DupGold, GoEggs.DupExp)
                : string.Format(GoLocalization.T("egg.hatch_new", "{0}이 부화했다 — 새 신수 {1}! 도감에 올랐다 (I)"), tier, name);
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(text, 4f);
        }

        private void Update()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go != null) _player = go.transform;
            }
            if (_player == null) return;
            Feed(_player.position);
            FollowBody();
        }

        // ---- 동행 몸(에셋이 놓이면) ----

        private void FollowBody()
        {
            string id = EggState.Buddy;
            if (id != _bodyFor)
            {
                if (_body != null) Destroy(_body);
                _body = null; _bodyFor = id;
                if (id.Length > 0)
                {
                    _body = Saga.Core.WorldModels.Spawn(GoEggs.BodyName(id), null, 1.4f); // 없으면 null — 몸 없이 간다(K-0075)
                    if (_body != null) _body.transform.position = _player.position - _player.forward * FollowDist;
                }
            }
            if (_body == null) return;
            var target = _player.position - _player.forward * FollowDist;
            _body.transform.position = Vector3.Lerp(_body.transform.position, target, 1f - Mathf.Exp(-4f * Time.deltaTime));
            var look = _player.position - _body.transform.position; look.y = 0f;
            if (look.sqrMagnitude > 0.01f) _body.transform.rotation = Quaternion.Slerp(_body.transform.rotation, Quaternion.LookRotation(look), 1f - Mathf.Exp(-8f * Time.deltaTime));
        }
    }
}
