using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Core;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-4 마을의 시대 섞인 사람 하나(`ForestEras.FolkList`) — 광장 둘레 제 길을 36초 주기로 짧게 오가고(시각의 순수 함수),
    /// 플레이어가 곁에 오면 대사 넷을 하나씩 돌려 말한다(숲지기 `ForestVillager` 와 같은 쿨다운). 볼일·부탁은 없다(PLAN 109 C 줄 12).
    /// 사실 모델은 `ForestWorldCurve` 셰이더를 안 타 숲지기처럼 땅 휨만큼 "Visual" 을 내린다. 편집기 빌드가 몸을 넣고 씬에 굽는다.
    /// </summary>
    public class ForestEraFolk : MonoBehaviour
    {
        [SerializeField] private int folkIndex;
        [SerializeField] private GameObject modelPrefab;

        private Transform _visual;
        private float _visualBaseY;
        private Animator _animator;
        private Transform _player;
        private float _cooldownLeft;
        private int _said;

        public int FolkIndex => folkIndex;
        public ForestEras.Folk Data => ForestEras.FolkList[folkIndex];
        public Transform Visual => _visual;
        public int SaidCount => _said;
        public bool Rigged => _animator != null;

        public void Init(int index, GameObject model)
        {
            folkIndex = index;
            modelPrefab = model;
        }

        /// <summary>편집기 빌드가 부른다 — 몸을 "Visual" 로 심는다(없으면 캡슐).</summary>
        public void BuildVisual()
        {
            if (transform.Find("Visual") != null) return;
            var d = Data.Dir.normalized;
            transform.rotation = Quaternion.LookRotation(new Vector3(d.x, 0f, d.y));
            if (NpcIdle.SpawnRigged(modelPrefab, transform, ForestEras.Height) != null) return;
            CharacterVisual.SpawnFallbackCapsule(transform, ForestEras.Height, Data.Fallback);
        }

        private void Awake()
        {
            _visual = transform.Find("Visual");
            if (_visual != null) _visualBaseY = _visual.localPosition.y;
            _animator = GetComponentInChildren<Animator>();
            if (_animator != null && _animator.runtimeAnimatorController == null) _animator = null;
        }

        private void Update()
        {
            Step(Time.time);
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }
            if (_cooldownLeft > 0f) { _cooldownLeft -= Time.deltaTime; return; }
            if (Vector3.Distance(transform.position, _player.position) > ForestEras.TalkRadius) return;
            _cooldownLeft = ForestEras.RetalkCooldownSec;
            Speak();
        }

        private void LateUpdate()
        {
            if (_player != null) FollowCurve(_player.position);
        }

        /// <summary>시각 t 의 자리·방향·걷기 동작. 진단도 부른다.</summary>
        public void Step(float t)
        {
            var f = Data;
            ForestEras.OffsetAt(t + f.Phase, out bool walking, out int sign);
            transform.position = ForestEras.PosAt(f, t);
            var d = f.Dir.normalized * sign;
            var want = Quaternion.LookRotation(new Vector3(d.x, 0f, d.y));
            if (walking) transform.rotation = Quaternion.Slerp(transform.rotation, want, 0.2f);
            if (_animator != null) _animator.SetFloat("Speed", walking ? 0.3f : 0f);
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다(`ForestLandmark.Follow` 와 같은 식). 진단도 부른다.</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_visual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            var p = _visual.localPosition;
            _visual.localPosition = new Vector3(p.x, _visualBaseY - (dx * dx + dz * dz) * ForestLandmark.CurveAmount, p.z);
        }

        /// <summary>다음 대사 하나를 띄우고 그 글을 돌려준다(진단도 부른다).</summary>
        public string Speak()
        {
            var data = Data;
            string text = $"{ForestEras.FolkName(data)} — \"{ForestEras.FolkLine(data, _said)}\"";
            _said++;
            DialogueLabel.Instance?.Show(text, ForestEras.LineSec);
            return text;
        }
    }
}
