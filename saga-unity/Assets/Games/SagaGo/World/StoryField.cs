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
            CookState.Picked -= OnPicked;
            CookState.Cooked -= OnCooked;
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
            CookState.Picked += OnPicked;
            CookState.Cooked += OnCooked;
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
                if (!any) CharacterVisual.SpawnFallbackCapsule(root.transform, n.Id == "ferryman" ? new Color(0.3f, 0.4f, 0.53f) : n.Id == "wanderer" ? new Color(0.22f, 0.22f, 0.29f) : new Color(0.55f, 0.42f, 0.6f));
                if (n.Mask) AddMask(root.transform);
                // 마을 쪽(마을 역참)을 본다
                Vector3 look = GoWorldMap.WaypointPos(GoWorldMap.Waypoints[0]) - root.transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f) root.transform.rotation = Quaternion.LookRotation(look);
                _npcs[n.Id] = root;
            }
        }

        /// <summary>109-14-13 가면 — 머리뼈(휴머노이드면)에 검은 탈 하나(흰 눈구멍 둘). 뼈가 없으면 키 1.6m 앞.</summary>
        private static void AddMask(Transform root)
        {
            Transform head = null;
            var anim = root.GetComponentInChildren<Animator>();
            if (anim != null && anim.isHuman) head = anim.GetBoneTransform(HumanBodyBones.Head);
            var mask = new GameObject("Mask");
            mask.transform.SetParent(root, false);
            mask.transform.localPosition = new Vector3(0f, 1.62f, 0.14f);
            if (head != null)
            {
                mask.transform.position = head.position + root.forward * 0.11f + Vector3.up * 0.04f;
                mask.transform.SetParent(head, true);
            }
            var black = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryMask (generated)", color = new Color(0.08f, 0.08f, 0.1f) };
            black.SetFloat("_Smoothness", 0.7f);
            var white = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryMaskEye (generated)", color = new Color(0.9f, 0.9f, 0.85f) };
            MaskPart(mask.transform, PrimitiveType.Sphere, Vector3.zero, new Vector3(0.2f, 0.26f, 0.09f), black, root);
            MaskPart(mask.transform, PrimitiveType.Sphere, new Vector3(-0.045f, 0.035f, 0.035f), new Vector3(0.045f, 0.02f, 0.02f), white, root);
            MaskPart(mask.transform, PrimitiveType.Sphere, new Vector3(0.045f, 0.035f, 0.035f), new Vector3(0.045f, 0.02f, 0.02f), white, root);
        }

        private static void MaskPart(Transform parent, PrimitiveType t, Vector3 local, Vector3 size, Material m, Transform root)
        {
            var go = GameObject.CreatePrimitive(t);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.rotation = root.rotation;
            go.transform.localPosition = local;
            // 뼈의 크기에 끌려가지 않게 월드 크기로
            Vector3 ls = parent.lossyScale;
            go.transform.localScale = new Vector3(size.x / Mathf.Max(0.0001f, ls.x), size.y / Mathf.Max(0.0001f, ls.y), size.z / Mathf.Max(0.0001f, ls.z));
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        /// <summary>인물 몸이 서 있나(나그네는 4장 둘째~여섯째 단계만).</summary>
        public bool NpcShown(string id) => _npcs.TryGetValue(id, out var g) && g.activeSelf;

        /// <summary>대화할 때 그 인물이 말 거는 이를 본다.</summary>
        public void Face(string id, Vector3 at)
        {
            if (!_npcs.TryGetValue(id, out var g)) return;
            Vector3 d = at - g.transform.position;
            d.y = 0f;
            if (d.sqrMagnitude > 0.01f) g.transform.rotation = Quaternion.LookRotation(d);
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
            var fc = FieldCombat.Instance;
            pos = GoStory.TargetOf(st, fc != null ? fc.transform.position : Vector3.zero, out radius);
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
            Follow(fc.transform.position, Time.deltaTime);
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckSec;
            Check(fc.transform.position);
        }

        /// <summary>109-14-13 follow — 따라가는 이가 12m 안이면 인물이 초당 2.6m 길을 걷는다(멀면 선다). 길 끝이면 넘긴다. 진단도 부른다.</summary>
        public void Follow(Vector3 p, float dt)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Follow || StoryState.Talking || !_npcs.TryGetValue(st.Npc, out var body)) return;
            var n = GoStory.NpcOf(st.Npc);
            float len = GoStory.PathLength(n);
            bool walking = GoStory.Flat(p, GoStory.NpcPos(st.Npc)) <= GoStory.FollowNear;
            Vector3 before = GoStory.NpcPos(st.Npc);
            if (walking) StoryState.FollowDist = Mathf.Min(len, StoryState.FollowDist + GoStory.FollowSpeed * dt);
            Vector3 now = GoStory.NpcPos(st.Npc);
            body.transform.position = FolkWalker.Grounded(now + Vector3.up * 0.5f);
            Vector3 d = now - before;
            d.y = 0f;
            if (d.sqrMagnitude > 0.0001f) body.transform.rotation = Quaternion.LookRotation(d);
            var anim = body.GetComponentInChildren<Animator>();
            if (anim != null && anim.runtimeAnimatorController != null && HasParam(anim, "Speed")) anim.SetFloat("Speed", walking ? 0.3f : 0f);
            if (StoryState.FollowDist >= len - 0.01f)
            {
                if (anim != null && anim.runtimeAnimatorController != null && HasParam(anim, "Speed")) anim.SetFloat("Speed", 0f);
                Toast(GoLocalization.T("story.follow_arrive", "나그네가 걸음을 멈췄다"), 3f);
                StoryState.Advance();
            }
        }

        private static bool HasParam(Animator a, string name)
        {
            foreach (var prm in a.parameters) if (prm.name == name) return true;
            return false;
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
                if (n.Existing || !NpcShown(n.Id)) continue; // 누리는 옛 촌장이 제 말을 한다
                if (st != null && (st.Type == GoStory.StepType.Talk || st.Type == GoStory.StepType.Follow) && st.Npc == n.Id) continue;
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
            for (int i = 0; i < st.Foes.Length; i++)
            {
                // 이야기 보스는 가운데, 졸개는 둘레
                bool boss = i == 0 && st.BossKo != null;
                float a = i * Mathf.PI * 2f / st.Foes.Length;
                Vector3 off = boss ? Vector3.up * 0.5f : new Vector3(Mathf.Cos(a), 0.5f, Mathf.Sin(a)) * GoStory.KillSpread;
                var e = spawner.SpawnStoryFoe(st.Foes[i].Kind, FolkWalker.Grounded(center + off), _squadKey, st.Foes[i].Over);
                if (boss) e.MakeStoryBoss(GoLocalization.T(st.BossKey, st.BossKo), GoStory.BossHp, GoStory.BossAtk, GoStory.BossScale);
                _squad.Add(e);
            }
            Toast(st.BossKo != null
                ? string.Format(GoLocalization.T("story.boss_up", "{0}가 나타났다"), GoLocalization.T(st.BossKey, st.BossKo))
                : GoLocalization.T("story.squad", "먹구름 졸개가 나타났다"), 3f);
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
            if (st != null && st.Type == GoStory.StepType.Domain && k == GoStory.SiteKind(st.Site)) StoryState.Advance();
        }

        /// <summary>109-14-13 gather — 그 채집물을 주울 때마다 하나(단계 동안만 센다).</summary>
        private void OnPicked(string item)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Gather || item != st.Item) return;
            StoryState.Progress++;
            if (StoryState.Progress >= st.Count) StoryState.Advance();
            else Toast(string.Format(GoLocalization.T("story.gather_n", "{0} {1}/{2}"), GoCooking.ItemName(item), StoryState.Progress, st.Count), 2f);
        }

        /// <summary>109-14-13 cook — 아무 요리 하나.</summary>
        private void OnCooked(string dish)
        {
            var st = StoryState.Current;
            if (st != null && st.Type == GoStory.StepType.Cook) StoryState.Advance();
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
            foreach (var kv in _npcs)
            {
                bool shown = !StoryState.OffForTest && GoStory.Shown(kv.Key, StoryState.Ch, StoryState.StepIndex);
                kv.Value.SetActive(shown);
                // 장·단계마다 옮겨 선다(따라가기 동안은 Follow 가 옮긴다)
                bool walking = st != null && st.Type == GoStory.StepType.Follow && st.Npc == kv.Key;
                if (shown && !walking)
                {
                    Vector3 want = GoStory.NpcPos(kv.Key);
                    if (GoStory.Flat(kv.Value.transform.position, want) > 0.3f) kv.Value.transform.position = FolkWalker.Grounded(want + Vector3.up * 0.5f);
                }
            }
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
