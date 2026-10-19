using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 101-2 STORY "5-3 비경" 입구 — "마을 문 하나가 비경 입구"를
    /// `StoryNpc.cs`와 같은 트리거 규칙(반경+쿨다운)으로 옮긴다. 다가가면
    /// 기존 `StoryChoiceUi`(두 선택지 UI, "선택" 슬라이스가 이미 만들어
    /// 둔 것을 재사용 — 이 하나 때문에 새 2택 UI를 또 안 만든다)로
    /// "입장한다"/"기억을 새긴다"를 묻는다. 실제 회차 진행·노드 판정은
    /// `StoryLabyrinthRunner.cs` 참고.
    /// </summary>
    public class StoryLabyrinthGate : MonoBehaviour
    {
        private const float TalkRadius = 1.4f;
        private const float TalkGapSec = 5f;
        private const float LineShowSec = 3f;
        private static readonly Color GateColor = new Color(0.35f, 0.15f, 0.5f); // 비경 특유의 보랏빛(아레나 바닥과 같은 계열).

        private float _lastShownTime = -TalkGapSec;

        private void Awake()
        {
            if (transform.Find("Visual") != null) return; // 씬 재로드 시 중복 생성 방지 — StoryNpc.cs와 같은 결.
            BuildVisual();
            BuildTalkArea();
        }

        private void BuildVisual()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = "Visual";
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 1.2f, 0f);
            go.transform.localScale = new Vector3(0.9f, 1.2f, 0.9f);
            Saga.Core.Colliders.Strip(go); // TalkArea(트리거)만 남긴다 — StoryEnemy/StoryNpc Visual과 달리 여긴 시각용 primitive에 물리 콜라이더가 필요 없다.

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryLabyrinthGate (generated)" };
            mat.color = GateColor;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        private void BuildTalkArea()
        {
            var talkGo = new GameObject("TalkArea");
            talkGo.transform.SetParent(transform, false);
            var col = talkGo.AddComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = TalkRadius;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!other.CompareTag("Player")) return;
            if (Time.time - _lastShownTime < TalkGapSec) return;
            _lastShownTime = Time.time;

            if (StoryLabyrinthState.InRun) return; // 이미 회차 중이면(아레나에 있다는 뜻) 조용히 넘어간다.

            var ui = StoryChoiceUi.Instance;
            if (ui == null) return;

            ui.Show(
                StoryLocalization.T("labyrinth.gate_prompt", "비경(祕境) 문이다 — 무엇을 하시겠습니까?"),
                StoryLocalization.T("labyrinth.gate_enter", "입장한다"),
                string.Format(StoryLocalization.T("labyrinth.gate_upgrade", "기억을 새긴다(보유 {0})"), StoryLabyrinthState.MemoryShards),
                choice =>
                {
                    if (choice == 1) StoryLabyrinthRunner.Instance?.StartRun();
                    else TryUpgrade();
                });
        }

        private void TryUpgrade()
        {
            bool ok = StoryLabyrinthState.TryUpgradeMemory();
            DialogueLabel.Instance?.Show(ok
                ? string.Format(StoryLocalization.T("labyrinth.upgrade_ok", "기억을 새겼다 — 영구 강화 {0}단(공격력 소폭 상승)"), StoryLabyrinthState.MemoryTier)
                : StoryLocalization.T("labyrinth.upgrade_fail", "기억 조각이 부족하거나 이미 최대 단계다"), LineShowSec);
        }
    }
}
