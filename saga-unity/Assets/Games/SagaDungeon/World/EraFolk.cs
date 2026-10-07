using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-2 마을의 시대 손님(웹 사가나락 §5.20 `ERA_FOLK`) — 현대·미래에서 넘어온 사람 하나. 싸우지 않고 볼일도 없다:
    /// 가까이 다가설 때마다 제 대사 넷을 하나씩 돌려 말한다. 편집기 빌드가 자리·몸을 넣고 씬에 굽는다(`NpcIdle` 로 선다).
    /// </summary>
    public class EraFolk : MonoBehaviour
    {
        public const float TalkRadius = 3.2f;
        private const float LineSec = 4.5f;

        [SerializeField] private int folkIndex;
        [SerializeField] private GameObject modelPrefab;

        private Transform _player;
        private bool _near;
        private int _said;

        public int FolkIndex => folkIndex;
        public DungeonEras.Folk Data => DungeonEras.FolkList[folkIndex];
        /// <summary>진단 — 지금까지 말한 수.</summary>
        public int SaidCount => _said;
        /// <summary>진단 — 말한 수를 처음으로(사연 진단이 대사 차례를 밀어 놓은 걸 되돌린다).</summary>
        public void ResetSaid() => _said = 0;

        public void Init(int index, GameObject model)
        {
            folkIndex = index;
            modelPrefab = model;
        }

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            Gesturer.Attach(gameObject, Gesturer.NpcKey(Data.Id, transform.position), npc: true); // PLAN.md 109-10-7 몸짓 — 인사·틈틈이 제 일.
        }

        public void BuildVisual()
        {
            if (NpcIdle.SpawnRigged(modelPrefab, transform, "Idle") != null) return;
            CharacterVisual.SpawnFallbackCapsule(transform, 1.7f,
                Data.Era == DungeonEra.Future ? new Color(0.45f, 0.75f, 0.85f) : new Color(0.35f, 0.4f, 0.55f));
        }

        /// <summary>다음 한 마디를 띄우고 차례를 넘긴다(진단도 부른다).</summary>
        public string Speak()
        {
            // PLAN.md 109-16 곁가지 side_visitors — 사연이 남았으면 그 토막이 먼저(끝 토막에 금 한 번), 다 들었으면 예전 대사.
            string story = DungeonEras.NextStory(Data.Id, out int gold);
            if (story != null)
            {
                string storyLine = $"{DungeonEras.FolkName(Data)} — {story}";
                if (gold > 0)
                {
                    HeroState.AddGold(gold);
                    storyLine += $" · {string.Format(DungeonLocalization.T("era_folk.story_gold", "금 +{0}"), gold)}";
                }
                DialogueLabel.Instance?.Show(storyLine, LineSec);
                return storyLine;
            }
            string line = $"{DungeonEras.FolkName(Data)} — {DungeonEras.FolkLine(Data, _said)}";
            _said++;
            DialogueLabel.Instance?.Show(line, LineSec);
            return line;
        }

        private void Update()
        {
            if (_player == null) return;
            bool near = Vector3.Distance(transform.position, _player.position) <= TalkRadius;
            if (near && !_near) Speak();
            _near = near;
        }
    }
}
