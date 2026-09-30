using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 106-4 — 서 있기만 하는 사실 모델 NPC(마을 사람·포로·상인)의 대기 동작. 같은 몸이 같은 박자로
    /// 숨 쉬지 않게 시작 위상을 흩고, 컨트롤러의 추가 대기 상태(예: 포로 `Kneel`)를 이름으로 튼다
    /// (`SetupNpcCharacterImports` 의 `ExtraIdles`). 다섯 판 복사본을 합친 것(tasks U-0006) —
    /// `SpawnRigged` 오버로드 둘: 사람 키로 맞춰 심는 것(GO·FOREST·STORY)과 실제 크기로 심는 것(DUNGEON).
    /// </summary>
    public class NpcIdle : MonoBehaviour
    {
        [SerializeField] private string stateName = "Idle";

        private Animator _animator;

        public string StateName => stateName;
        public Animator Animator => _animator;

        public void Init(string state) => stateName = state;

        private void Start()
        {
            _animator = GetComponentInChildren<Animator>();
            if (_animator == null || !_animator.isActiveAndEnabled) return;
            int hash = Animator.StringToHash(stateName);
            if (_animator.HasState(0, hash)) _animator.Play(hash, 0, Random.value);
        }

        /// <summary>다른 대기 상태로 부드럽게 넘어간다(포로가 풀려나면 `Idle`).</summary>
        public void SetState(string state)
        {
            stateName = state;
            if (_animator == null) _animator = GetComponentInChildren<Animator>();
            if (_animator == null) return;
            int hash = Animator.StringToHash(state);
            if (_animator.HasState(0, hash)) _animator.CrossFade(hash, 0.35f, 0);
        }

        /// <summary>리깅 프리팹을 parent 밑 "Visual" 로 심고 키를 `height` 로, 발을 parent 높이에 맞춘다. 리깅이 아니면 null(호출부가 예전 모델로 폴백).</summary>
        public static GameObject SpawnRigged(GameObject prefab, Transform parent, float height, float yawDeg = 0f, string state = "Idle")
        {
            if (prefab == null || prefab.GetComponent<Animator>() == null) return null;
            var inst = Object.Instantiate(prefab, parent, false);
            inst.name = "Visual";
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.Euler(0f, yawDeg, 0f);
            if (TryBounds(inst, out var b) && b.size.y > 0.01f)
            {
                inst.transform.localScale *= height / b.size.y;
                TryBounds(inst, out b);
                inst.transform.position += Vector3.up * (parent.position.y - b.min.y);
            }
            var animator = inst.GetComponent<Animator>();
            animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
            var idle = parent.GetComponent<NpcIdle>();
            if (idle == null) idle = parent.gameObject.AddComponent<NpcIdle>();
            idle.Init(state);
            EnsureShadow(parent);
            return inst;
        }

        /// <summary>리깅 프리팹을 parent 밑에 실제 크기로 심는다(Mixamo 는 사람 크기 단위로 들어온다). 리깅이 아니면 null.</summary>
        public static GameObject SpawnRigged(GameObject prefab, Transform parent, string state, float yawDeg = 0f)
        {
            if (prefab == null || prefab.GetComponent<Animator>() == null) return null;
            var inst = Object.Instantiate(prefab, parent, false);
            inst.name = "Visual";
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.Euler(0f, yawDeg, 0f);
            var idle = parent.GetComponent<NpcIdle>();
            if (idle == null) idle = parent.gameObject.AddComponent<NpcIdle>();
            idle.Init(state);
            EnsureShadow(parent);
            return inst;
        }

        // 판별 `CharacterVisual.EnsureBlobShadow` 와 같은 동작(BlobShadow 는 Mobile 품질이 아니면 스스로 꺼진다).
        private static void EnsureShadow(Transform root)
        {
            if (root.GetComponent<BlobShadow>() == null) root.gameObject.AddComponent<BlobShadow>();
        }

        private static bool TryBounds(GameObject go, out Bounds b)
        {
            b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            return any;
        }
    }
}
