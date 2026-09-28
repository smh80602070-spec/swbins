using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-12 이야기 임무 — 들판 쪽(웹 `story.js` check·신호·3D). `WorldMapBuilder` 가 Play 때 붙인다.
    /// - 인물: 버들·은비는 옛 마을 사람 몸을 빌려 세운다(촌장 = 사내 몸, 상인 = 여인 몸 — 사람 NPC 공방 몸 교체 때 같이 바뀐다). 누리는 옛 마을 촌장 그대로.
    /// - 0.5초마다: go 도착 · boss 이미 쓰러져 꽃을 기다림(= 안 서 있음)이면 넘김 · kill 60m 안이면 임무 적(`sq:장_단계`) 세우기 · 지금 단계가 아닌 인물 곁 혼잣말.
    /// - 신호: 수호장 쓰러짐(boss) · 임무 적 모두 쓰러짐(kill) · 원소 신호 원이 옛 제단에 걸림(light, 원소는 안 본다) · 먹구름 제단 깸(domain).
    /// - 목표에 금빛 기둥(30m, 숨 쉬듯 밝기), light 단계 동안 동굴 어귀에 옛 제단(석등 몸 — 켜지면 불).
    /// </summary>
    public class StoryField : MonoBehaviour
    {
        public const float CheckSec = 0.5f;
        public const float PillarHeight = 30f;

        public static StoryField Instance { get; private set; }

        private readonly Dictionary<string, GameObject> _npcs = new Dictionary<string, GameObject>();
        private readonly List<FieldEnemy> _squad = new List<FieldEnemy>();
        private readonly Dictionary<string, float> _lastIdle = new Dictionary<string, float>();
        private string _squadKey;
        private GameObject _pillar;
        private Material _pillarMat;
        private ElementTorch _altar;
        private float _wait, _clock;

        public GameObject Pillar => _pillar;
        public ElementTorch Altar => _altar;
        public IReadOnlyList<FieldEnemy> Squad => _squad;
        public GameObject NpcBody(string id) => _npcs.TryGetValue(id, out var g) ? g : null;
        /// <summary>진단용 — 마지막 혼잣말(인물 id).</summary>
        public string LastIdleNpc { get; private set; }

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            FieldEnemy.Killed -= OnKilled;
            FieldCombat.ElementPulse -= OnPulse;
            DomainField.Cleared -= OnDomainCleared;
            StoryState.Changed -= OnChanged;
            StoryState.Advanced -= OnAdvanced;
            StoryState.Talking = false;
        }

        private void Start()
        {
            SpawnNpcs();
            BuildPillar();
            var stone = WorldMapBuilder.Instance != null ? WorldMapBuilder.Instance.StoneMaterial : null;
            _altar = ElementTorch.Spawn(GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy), GoElement.Pyro, transform, stone, "StoryAltar");
            FieldEnemy.Killed += OnKilled;
            FieldCombat.ElementPulse += OnPulse;
            DomainField.Cleared += OnDomainCleared;
            StoryState.Changed += OnChanged;
            StoryState.Advanced += OnAdvanced;
            Refresh();
        }

        // ---- 인물 ---------------------------------------------------------------------------------------------

        private void SpawnNpcs()
        {
            var villagers = Object.FindFirstObjectByType<NpcBuilder>();
            foreach (var n in GoStory.Npcs)
            {
                if (n.Existing) continue;
                var root = new GameObject("StoryNpc_" + n.Id);
                root.transform.SetParent(transform, false);
                root.transform.position = FolkWalker.Grounded(GoStory.NpcPos(n.Id) + Vector3.up * 0.5f);
                Transform src = villagers != null ? villagers.transform.Find("Villager_" + n.BodyFrom) : null;
                bool any = false;
                if (src != null)
                {
                    for (int i = 0; i < src.childCount; i++)
                    {
                        var c = src.GetChild(i);
                        if (c.name == "TalkArea") continue;
                        var copy = Instantiate(c.gameObject, root.transform, false);
                        copy.transform.localPosition = c.localPosition;
                        copy.transform.localRotation = Quaternion.identity; // 몸 쪽 돌림은 아래 root 로
                        any = true;
                    }
                }
                if (!any) CharacterVisual.SpawnFallbackCapsule(root.transform, n.Id == "ferryman" ? new Color(0.3f, 0.4f, 0.53f) : new Color(0.55f, 0.42f, 0.6f));
                // 마을 쪽(마을 역참)을 본다
                Vector3 look = GoWorldMap.WaypointPos(GoWorldMap.Waypoints[0]) - root.transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f) root.transform.rotation = Quaternion.LookRotation(look);
                _npcs[n.Id] = root;
            }
        }

        // ---- 금빛 기둥 ----------------------------------------------------------------------------------------

        private void BuildPillar()
        {
            _pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _pillar.name = "StoryPillar";
            Destroy(_pillar.GetComponent<Collider>());
            _pillar.transform.SetParent(transform, false);
            _pillar.transform.localScale = new Vector3(0.9f, PillarHeight * 0.5f, 0.9f);
            var gold = new Color(1f, 0.82f, 0.29f);
            _pillarMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryPillar (generated)", color = gold };
            _pillarMat.EnableKeyword("_EMISSION");
            _pillarMat.SetColor("_EmissionColor", gold * 3f);
            var r = _pillar.GetComponent<MeshRenderer>();
            r.sharedMaterial = _pillarMat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            _pillar.SetActive(false);
        }

        /// <summary>지금 목표 자리(없으면 false) — boss 는 수호장 발치, talk 는 인물 자리.</summary>
        public static bool Target(out Vector3 pos, out float radius)
        {
            pos = Vector3.zero;
            radius = 0f;
            var st = StoryState.Current;
            if (st == null) return false;
            pos = GoStory.TargetOf(st, out radius);
            if (st.Type == GoStory.StepType.Boss && FieldEnemy.GuardianInstance != null) pos = FieldEnemy.GuardianInstance.Home;
            return true;
        }

        private void Update()
        {
            _clock += Time.deltaTime;
            if (_pillar != null && _pillar.activeSelf)
                _pillarMat.SetColor("_EmissionColor", new Color(1f, 0.82f, 0.29f) * (2.4f + Mathf.Sin(_clock * 2.2f) * 0.8f));
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckSec;
            Check(fc.transform.position);
        }

        /// <summary>한 박자 — go 도착·boss 이미 쓰러짐·kill 무리 세우기·혼잣말. 진단도 부른다.</summary>
        public void Check(Vector3 p)
        {
            Refresh();
            if (StoryState.OffForTest) return;
            var st = StoryState.Current;
            if (st != null)
            {
                Vector3 t = GoStory.TargetOf(st, out float r);
                switch (st.Type)
                {
                    case GoStory.StepType.Go:
                        if (GoStory.Flat(p, t) <= r) { StoryState.Advance(); return; }
                        break;
                    case GoStory.StepType.Boss:
                        if (!GuardianState.Standing) { StoryState.Advance(); return; } // 이미 쓰러져 꽃을 기다린다
                        break;
                    case GoStory.StepType.Kill:
                        if (_squad.Count == 0 && GoStory.Flat(p, t) < GoStory.KillNear) SpawnSquad(st, t);
                        break;
                }
            }
            foreach (var n in GoStory.Npcs)
            {
                if (n.Existing) continue; // 누리는 옛 촌장이 제 말을 한다
                if (st != null && st.Type == GoStory.StepType.Talk && st.Npc == n.Id) continue;
                if (GoStory.Flat(p, GoStory.NpcPos(n.Id)) > GoStory.IdleR) continue;
                if (_lastIdle.TryGetValue(n.Id, out float last) && Time.time - last < GoStory.IdleGap) continue;
                _lastIdle[n.Id] = Time.time;
                LastIdleNpc = n.Id;
                Toast($"{GoStory.NpcName(n.Id)} — {GoStory.NpcIdle(n.Id)}", 3.5f);
            }
        }

        public static string SquadKey => $"sq:{StoryState.Ch}_{StoryState.StepIndex}";

        private void SpawnSquad(GoStory.Step st, Vector3 center)
        {
            var spawner = Object.FindFirstObjectByType<FieldSpawner>();
            if (spawner == null) return;
            _squadKey = SquadKey;
            for (int i = 0; i < st.Kinds.Length; i++)
            {
                float a = i * Mathf.PI * 2f / st.Kinds.Length;
                Vector3 home = FolkWalker.Grounded(center + new Vector3(Mathf.Cos(a), 0.5f, Mathf.Sin(a)) * GoStory.KillSpread);
                _squad.Add(spawner.SpawnStoryFoe(st.Kinds[i], home, _squadKey));
            }
            Toast(GoLocalization.T("story.squad", "먹구름 졸개가 나타났다"), 3f);
        }

        private void ClearSquad()
        {
            foreach (var e in _squad) if (e != null) { e.gameObject.SetActive(false); Destroy(e.gameObject); }
            _squad.Clear();
            _squadKey = null;
        }

        // ---- 신호 ---------------------------------------------------------------------------------------------

        private void OnKilled(FieldEnemy e)
        {
            var st = StoryState.Current;
            if (e == null || st == null) return;
            if (st.Type == GoStory.StepType.Boss && e.IsGuardian) { StoryState.Advance(); return; }
            if (st.Type == GoStory.StepType.Kill && e.StoryFoe && e.GroupId == _squadKey)
            {
                foreach (var m in _squad) if (m != null && m.Alive) return;
                StoryState.Advance();
            }
        }

        private void OnPulse(Vector3 center, float radius, GoElement el)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Light) return;
            if (GoStory.Flat(center, GoStory.TargetOf(st, out _)) > radius + GoStory.LightR) return;
            Toast(GoLocalization.T("story.lit", "옛 제단에 불이 붙었다 — 비문이 빛난다"), 3.5f);
            StoryState.Advance();
        }

        private void OnDomainCleared(GoDomain.Kind k)
        {
            var st = StoryState.Current;
            if (st != null && st.Type == GoStory.StepType.Domain && k == GoDomain.Kind.Weekly) StoryState.Advance();
        }

        private void OnAdvanced(string reward)
        {
            if (reward != null)
            {
                var done = GoStory.Chapters[StoryState.Ch - 1];
                Toast(string.Format(GoLocalization.T("story.chapter_done", "{0} 끝 — {1}"), GoStory.ChapterName(done), reward), 5f);
            }
            else if (StoryState.Current != null) Toast("◆ " + GoStory.StepText(StoryState.Current), 3f);
        }

        private void OnChanged() => Refresh();

        /// <summary>기둥·제단·임무 적을 지금 단계에 맞춘다(단계가 바뀌면 남은 임무 적은 치운다).</summary>
        public void Refresh()
        {
            var st = StoryState.Current;
            if (_squad.Count > 0 && (st == null || st.Type != GoStory.StepType.Kill || _squadKey != SquadKey)) ClearSquad();
            bool has = Target(out Vector3 t, out _);
            if (_pillar != null)
            {
                _pillar.SetActive(has);
                if (has) _pillar.transform.position = FolkWalker.Grounded(t + Vector3.up * 0.5f) + Vector3.up * PillarHeight * 0.5f;
            }
            if (_altar != null)
            {
                bool past = StoryState.Ch > 0 || StoryState.StepIndex > LightStepIndex; // 불을 붙였다 — 켠 채 남는다
                _altar.gameObject.SetActive(!StoryState.OffForTest && (past || (st != null && st.Type == GoStory.StepType.Light)));
                _altar.SetLit(past);
            }
            foreach (var kv in _npcs) kv.Value.SetActive(!StoryState.OffForTest);
        }

        /// <summary>1장 light 단계 번호 — 넘겼으면 제단에 불이 남는다.</summary>
        public static int LightStepIndex
        {
            get
            {
                var steps = GoStory.Chapters[0].Steps;
                for (int i = 0; i < steps.Length; i++) if (steps[i].Type == GoStory.StepType.Light) return i;
                return steps.Length;
            }
        }

        private static void Toast(string text, float sec)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, sec);
        }

        /// <summary>진단용 — 혼잣말 쿨다운·임무 적을 비운다.</summary>
        public void ResetForTest()
        {
            _lastIdle.Clear();
            LastIdleNpc = null;
            ClearSquad();
            Refresh();
        }
    }
}
