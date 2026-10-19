using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 101-2 5.5 "난입" — 웹판 "모루골 결사비 옆 난입 표식"을 Room1
    /// (이 트랙의 중심 마을 역할, `HordeRunner` 클래스 주석 참고) 빈 구석에
    /// 세운다. `DungeonWell.cs`와 같은 결(걸어서 가까이 가면 반응)이지만
    /// 한 번 쓰면 없어지지 않는다 — 난입은 반복 입장하는 모드라서.
    /// </summary>
    public class HordeGate : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const float ToastSec = 3f;

        private static readonly Color GateColor = new Color(0.55f, 0.1f, 0.6f);

        private Transform _player;
        private bool _triggeredThisVisit;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.2f, 1.1f, 1.2f);
            visual.transform.localPosition = new Vector3(0f, 1.1f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "HordeGate (generated)" };
            mat.color = GateColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_player == null) return;
            bool inRange = Vector3.Distance(transform.position, _player.position) <= TriggerRadius;

            if (!inRange) { _triggeredThisVisit = false; return; }
            if (_triggeredThisVisit) return;
            _triggeredThisVisit = true;

            if (HordeRunner.Instance == null) return;
            if (TrialRunner.Busy) return; // PLAN.md 109-10-3 — 시련이 같은 방을 쓰는 중.
            if (HordeRunner.Instance.IsActive)
            {
                DialogueLabel.Instance?.Show(DungeonLocalization.T("horde.busy", "이미 난입 중이다."), ToastSec);
                return;
            }
            HordeRunner.Instance.StartRun(_player.position);
        }
    }
}
