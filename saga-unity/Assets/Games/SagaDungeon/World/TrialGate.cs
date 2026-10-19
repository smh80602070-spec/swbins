using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-3 시련 표식 — 난입 표식(`HordeGate`)과 같은 결(걸어서 가까이 가면 반응, 쓰고도 안 없어짐).
    /// 제10층에 닿기 전엔 안내만, 뒤로는 단계 카드(`TrialCardUi`)를 연다. 금빛 돌기둥 + 위에 뜬 모래시계 꼴 두 원뿔.
    /// `TrialRunner.Install` 이 Play 때 세운다.
    /// </summary>
    public class TrialGate : MonoBehaviour
    {
        public const float TriggerRadius = 2.0f;
        private static readonly Color GateColor = new Color(0.8f, 0.62f, 0.2f);

        private Transform _player;
        private bool _triggeredThisVisit;
        private Transform _glass;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "TrialGate (generated)", color = GateColor };
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", GateColor * 0.35f);
            var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            post.name = "Visual";
            post.transform.SetParent(transform, false);
            post.transform.localScale = new Vector3(0.9f, 0.9f, 0.9f);
            post.transform.localPosition = new Vector3(0f, 0.9f, 0f);
            post.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Saga.Core.Colliders.Strip(post);

            _glass = new GameObject("Hourglass").transform;
            _glass.SetParent(transform, false);
            _glass.localPosition = new Vector3(0f, 2.5f, 0f);
            for (int i = 0; i < 2; i++)
            {
                var bulb = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                bulb.name = i == 0 ? "Top" : "Bottom";
                bulb.transform.SetParent(_glass, false);
                bulb.transform.localScale = new Vector3(0.45f, 0.35f, 0.45f);
                bulb.transform.localPosition = new Vector3(0f, i == 0 ? 0.22f : -0.22f, 0f);
                bulb.GetComponent<MeshRenderer>().sharedMaterial = mat;
                Saga.Core.Colliders.Strip(bulb);
            }
        }

        private void Update()
        {
            if (_glass != null) _glass.Rotate(Vector3.forward, 40f * Time.deltaTime, Space.Self);
            if (_player == null) return;
            bool inRange = Vector3.Distance(transform.position, _player.position) <= TriggerRadius;
            if (!inRange) { _triggeredThisVisit = false; return; }
            if (_triggeredThisVisit) return;
            _triggeredThisVisit = true;
            Arrive();
        }

        /// <summary>표식에 닿았을 때(진단도 부른다).</summary>
        public void Arrive()
        {
            if (TrialRunner.Busy || (HordeRunner.Instance != null && HordeRunner.Instance.IsActive)) return;
            int floor = DungeonFloorRunner.Instance != null ? DungeonFloorRunner.Instance.CurrentFloor : 1;
            if (!TrialState.IsUnlocked(floor))
            {
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("trial.locked",
                    "시련의 모래시계 — 지하 {0}층에 닿으면 열린다(지금 {1}층)"), TrialState.UnlockFloor, floor), 3f);
                return;
            }
            TrialCardUi.Instance?.Show(_player != null ? _player.position : transform.position);
        }
    }
}
