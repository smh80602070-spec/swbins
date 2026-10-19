using System;
using UnityEngine;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// 주민 하나의 말 걸기 판정. saga-godot npc_builder.gd _on_body_entered와
    /// 같은 규칙 — 플레이어가 TalkArea(구 트리거)에 들어오면 쿨다운을 두고
    /// 한 줄을 띄운다. 조우 판정(전투 등)에는 손대지 않는다.
    ///
    /// PLAN.md 70장 Quest — 대사가 매번 같지 않고 퀘스트 진행에 따라 바뀌는
    /// NPC(마을 촌장)를 위해 고정 문자열 대신 Func&lt;string&gt;도 받는다
    /// (호출될 때마다 최신 상태를 반영 — QuestState 시작 같은 부수효과는
    /// 이 클래스가 아니라 NpcBuilder가 넘기는 델리게이트 쪽에 둔다).
    /// </summary>
    public class VillagerTalk : MonoBehaviour
    {
        private const float TalkGapSec = 45f;
        private const float LineShowSec = 4f;

        private string _npcName;
        private Func<string> _lineProvider;
        private float _lastSaidTime = -TalkGapSec;

        public void Init(string npcName, string line) => Init(npcName, () => line);

        public void Init(string npcName, Func<string> lineProvider)
        {
            _npcName = npcName;
            _lineProvider = lineProvider;
        }

        // ---- tasks U-0130 길 행동 — 사람 id(몸 root 이름 "Villager_npc_elder"·"Folk_wp_x_role")·곁 판정 ----
        private static readonly System.Collections.Generic.List<VillagerTalk> _all = new System.Collections.Generic.List<VillagerTalk>();
        public static System.Collections.Generic.IReadOnlyList<VillagerTalk> All => _all;
        /// <summary>몸 root(이끌기는 이걸 옮긴다 — TalkArea 도 따라간다).</summary>
        public Transform Root => transform.parent != null ? transform.parent : transform;
        public string Id => Root.name;
        public string NpcName => string.IsNullOrEmpty(_npcName) ? Id : _npcName;
        private void OnEnable() { if (!_all.Contains(this)) _all.Add(this); }
        private void OnDisable() => _all.Remove(this);

        /// <summary>p 에서 r 안 가장 가까운 주민(없으면 null).</summary>
        public static VillagerTalk Nearest(Vector3 p, float r)
        {
            VillagerTalk best = null; float bd = r * r;
            foreach (var v in _all)
            {
                if (v == null || !v.isActiveAndEnabled) continue;
                Vector3 q = v.Root.position;
                float d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
                if (d <= bd && Mathf.Abs(q.y - p.y) < r) { bd = d; best = v; }
            }
            return best;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!other.CompareTag("Player")) return;
            if (Time.time - _lastSaidTime < TalkGapSec) return;

            _lastSaidTime = Time.time;
            DialogueLabel.Instance?.Show($"{_npcName} — {_lineProvider()}", LineShowSec);
            Saga.Core.SagaVoice.Say("greet", _npcName); // U-0068 — 말을 건 인물이 인사 한 마디(표에 없으면 이름 해시 목소리)
        }
    }
}
