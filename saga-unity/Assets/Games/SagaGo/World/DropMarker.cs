using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 101-2 GO ⑧ "패배 비용과 회수" — 실제 저장소는
    /// <see cref="DropState"/>, 이건 그 항목 하나를 3D로 보여주는 화면
    /// 층(<see cref="LootMarker"/>와 같은 경계 — 다만 저건 시각적 잔향뿐이고
    /// 이건 실제로 주우면 돈을 돌려준다). 10분 창을 스스로도 재서
    /// (DropState.TryRecover도 같은 판정을 하니 이중 방어) 만료되면 조용히
    /// 사라진다.
    /// </summary>
    public class DropMarker : MonoBehaviour
    {
        private const float PickupRadius = 2.5f;
        private const float BobHeight = 0.1f;
        private const float BobSpeed = 2f;

        private static readonly Color GlowColor = new Color(1f, 0.82f, 0.25f);
        private static readonly Color EmissionColor = new Color(0.9f, 0.6f, 0.05f);

        private string _id;
        private long _expiresAtTicks;
        private Transform _player;
        private Transform _visual;
        private float _age;

        public static void Spawn(DropState.Drop drop)
        {
            var go = new GameObject("DropMarker_" + drop.Id);
            go.transform.position = drop.Position;
            var marker = go.AddComponent<DropMarker>();
            marker._id = drop.Id;
            marker._expiresAtTicks = drop.ExpiresAtTicks;
        }

        private void Awake()
        {
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            BuildVisual();
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            Saga.Core.Colliders.Strip(visual);
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = Vector3.one * 0.45f;
            visual.transform.localPosition = new Vector3(0f, 0.5f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DropMarker (generated)" };
            mat.color = GlowColor;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", EmissionColor);
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            _visual = visual.transform;
        }

        private void Update()
        {
            _age += Time.deltaTime;
            if (_visual != null)
            {
                float bob = Mathf.Sin(_age * BobSpeed) * BobHeight;
                _visual.localPosition = new Vector3(0f, 0.5f + bob, 0f);
            }

            if (System.DateTime.Now.Ticks > _expiresAtTicks)
            {
                DropState.Expire(_id);
                Destroy(gameObject);
                return;
            }

            if (_player != null && Vector3.Distance(transform.position, _player.position) <= PickupRadius)
            {
                if (DropState.TryRecover(_id, out int gold) && gold > 0)
                {
                    GoldState.Add(gold);
                    DialogueLabel.Instance?.Show(
                        string.Format(GoLocalization.T("event.drop_recovered", "떨어뜨렸던 짐을 되찾았다 — 돈 +{0}냥."), gold), 3f);
                }
                Destroy(gameObject);
            }
        }
    }
}
