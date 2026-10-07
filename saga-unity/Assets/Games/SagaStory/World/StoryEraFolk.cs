using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 109-3 들판의 시대 손님(웹 사가종횡 §5-12 `NPC_TALK`) — 현대·미래에서 넘어온 사람 하나. 싸우지 않고 볼일도 없다:
    /// 싸움길 뒤쪽(z = `StoryEras.FolkLaneZ`)에 서 있다가 플레이어가 X 로 가까이 지나갈 때마다 제 대사 넷을 하나씩 돌려 말한다.
    /// 편집기 빌드가 자리·몸을 넣고 씬에 굽는다(`NpcIdle` 로 선다).
    /// </summary>
    public class StoryEraFolk : MonoBehaviour
    {
        private const float Height = 1.7f;
        private const float LineSec = 4.5f;

        [SerializeField] private int folkIndex;
        [SerializeField] private GameObject modelPrefab;

        private Transform _player;
        private bool _near;
        private int _said;

        public int FolkIndex => folkIndex;
        public StoryEras.Folk Data => StoryEras.FolkList[folkIndex];
        public int SaidCount => _said;
        /// <summary>진단 — 말한 수를 처음으로(사연 진단이 대사 차례를 밀어 놓은 걸 되돌린다).</summary>
        public void ResetSaid() => _said = 0;

        public void Init(int index, GameObject model)
        {
            folkIndex = index;
            modelPrefab = model;
        }

        /// <summary>편집기 빌드가 부른다 — 몸을 "Visual" 로 심는다(없으면 캡슐).</summary>
        public void BuildVisual()
        {
            if (transform.Find("Visual") != null) return;
            // 싸움길 쪽(−z, 카메라 쪽)을 비스듬히 본다.
            if (NpcIdle.SpawnRigged(modelPrefab, transform, Height, 200f) != null) return;
            var tint = Data.Era == StoryEra.Future ? new Color(0.5f, 0.6f, 0.7f) : new Color(0.3f, 0.45f, 0.7f);
            CharacterVisual.SpawnFallbackCapsule(transform, Height, tint);
        }

        private void Update()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }
            bool near = Mathf.Abs(_player.position.x - transform.position.x) < StoryEras.FolkTalkRadiusM;
            if (near && !_near) Speak();
            _near = near;
        }

        /// <summary>다음 대사 하나를 띄우고 그 글을 돌려준다(진단도 부른다).</summary>
        public string Speak()
        {
            var data = Data;
            // PLAN.md 109-16 곁가지 side_guests — 사연이 남았으면 그 토막이 먼저(끝 토막에 경험치 한 번), 다 들었으면 예전 대사.
            string story = StoryEras.NextStory(data.Id, out float exp);
            if (story != null)
            {
                string storyText = $"{StoryEras.FolkName(data)} — {story}";
                if (exp > 0f)
                {
                    StoryJobState.GainExp(exp);
                    storyText += $" · {string.Format(StoryLocalization.T("era_folk.story_reward", "경험치 +{0}"), Mathf.RoundToInt(exp))}";
                }
                DialogueLabel.Instance?.Show(storyText, LineSec);
                return storyText;
            }
            string text = $"{StoryEras.FolkName(data)} — {StoryEras.FolkLine(data, _said)}";
            _said++;
            DialogueLabel.Instance?.Show(text, LineSec);
            return text;
        }
    }
}
