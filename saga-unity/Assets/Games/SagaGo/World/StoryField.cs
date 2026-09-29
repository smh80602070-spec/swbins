using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
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
        private float _wait, _clock;
        // light 단계마다 옛 제단 하나("장_단계") · 5장 둘째 제단(가운데 + 둘레 석등 셋, 이름표) · 6장 결투 2단계
        private readonly Dictionary<string, ElementTorch> _altars = new Dictionary<string, ElementTorch>();
        // 석등 틀 한 벌 = seal 단계 하나("장_단계" — 5장 둘째 제단·8장 바위섬)
        private readonly Dictionary<string, ElementTorch> _sealCenters = new Dictionary<string, ElementTorch>();
        private readonly Dictionary<string, ElementTorch[]> _sealSets = new Dictionary<string, ElementTorch[]>();
        private readonly List<Transform> _labels = new List<Transform>();
        private bool _duelP2;

        public GameObject Pillar => _pillar;
        /// <summary>1장 옛 제단(동굴 어귀).</summary>
        public ElementTorch Altar => AltarOf(0);
        public ElementTorch AltarOf(int ch)
        {
            foreach (var kv in _altars) if (kv.Key.StartsWith(ch + "_")) return kv.Value;
            return null;
        }
        /// <summary>5장 둘째 제단 석등(옛 진단) · 장마다(109-14-19 8장 바위섬).</summary>
        public ElementTorch SealLamp(int i) => SealLampOf(4, i);
        public ElementTorch SealCenter => SealCenterOf(4);
        public ElementTorch SealLampOf(int ch, int i)
        {
            foreach (var kv in _sealSets) if (kv.Key.StartsWith(ch + "_")) return kv.Value[i];
            return null;
        }
        /// <summary>109-14-22 활 조준이 잠길 점 — 지금 단계가 light 면 그 제단, seal 이면 안 켠 석등(웹 story aimPoints).</summary>
        public List<Vector3> AimPoints()
        {
            var list = new List<Vector3>();
            var st = StoryState.Current;
            if (st == null) return list;
            if (st.Type == GoStory.StepType.Light && _altars.TryGetValue(StoryState.LineKey, out var a) && a != null && a.gameObject.activeInHierarchy && !a.Lit)
                list.Add(a.transform.position + Vector3.up * 1.5f);
            if (st.Type == GoStory.StepType.Seal && _sealSets.TryGetValue(StoryState.LineKey, out var lamps))
                foreach (var l in lamps) if (l != null && l.gameObject.activeInHierarchy && !l.Lit) list.Add(l.transform.position + Vector3.up * 1.5f);
            return list;
        }

        /// <summary>109-14-21 줄 열쇠("wq1_4")로 — 세계 임무 제단 불·석등.</summary>
        public ElementTorch AltarOfKey(string key) => _altars.TryGetValue(key, out var a) ? a : null;
        public ElementTorch SealLampOfKey(string key, int i) => _sealSets.TryGetValue(key, out var l) ? l[i] : null;
        public ElementTorch SealCenterOf(int ch)
        {
            foreach (var kv in _sealCenters) if (kv.Key.StartsWith(ch + "_")) return kv.Value;
            return null;
        }
        /// <summary>109-14-19 바위섬(강 한가운데, Play 때 짓는다).</summary>
        public GameObject Isle { get; private set; }
        public bool DuelPhase2 => _duelP2;
        public IReadOnlyList<FieldEnemy> Squad => _squad;
        public GameObject NpcBody(string id) => _npcs.TryGetValue(id, out var g) ? g : null;
        /// <summary>진단용 — 마지막 혼잣말(인물 id).</summary>
        public string LastIdleNpc { get; private set; }

        private void Awake()
        {
            Instance = this;
            // 109-14-19·20 섬 둘은 Awake 에 — 불러온 자리(섬 위)에서 첫 프레임에 떨어지지 않게(`GameBootstrap.Start` 가 세이브 자리를 앉힌다)
            var stone = WorldMapBuilder.Instance != null ? WorldMapBuilder.Instance.StoneMaterial : null;
            BuildIsle(stone);
            BuildSky(stone);
        }

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
            FieldEnemy.SiegeHit -= OnSiegeHit;
            FieldCombat.Wiped -= OnWiped;
            StoryState.Talking = false;
        }

        private void Start()
        {
            var stone = WorldMapBuilder.Instance != null ? WorldMapBuilder.Instance.StoneMaterial : null;
            SpawnNpcs();
            BuildPillar();
            // 제단 불·석등 틀 — 줄(이야기 장 "c" · 109-14-21 세계 임무 "wqN")마다. 석등: 해 = 화 빛(주황) · 달 = 빙 빛(옅은 푸름) · 별 = 암 빛(금빛)
            foreach (var (line, steps) in Lines())
                for (int i = 0; i < steps.Length; i++)
                {
                    if (steps[i].Type == GoStory.StepType.Light)
                        _altars[$"{line}_{i}"] = ElementTorch.Spawn(FolkWalker.Grounded(GoStory.StepPos(steps[i]) + Vector3.up * 0.5f), GoElement.Pyro, transform, stone, $"StoryAltar_{line}_{i}");
                    if (steps[i].Type == GoStory.StepType.Seal) BuildSeal(line, i, steps[i], stone);
                }
            FieldEnemy.Killed += OnKilled;
            FieldCombat.ElementPulse += OnPulse;
            DomainField.Cleared += OnDomainCleared;
            StoryState.Changed += OnChanged;
            StoryState.Advanced += OnAdvanced;
            CookState.Picked += OnPicked;
            CookState.Cooked += OnCooked;
            FieldEnemy.SiegeHit += OnSiegeHit;
            FieldCombat.Wiped += OnWiped;
            Refresh();
        }

        /// <summary>줄 전부 — 이야기 장("0"~) · 세계 임무("wq0"~).</summary>
        private static IEnumerable<(string, GoStory.Step[])> Lines()
        {
            for (int c = 0; c < GoStory.Chapters.Length; c++) yield return (c.ToString(), GoStory.Chapters[c].Steps);
            for (int q = 0; q < GoWorldQuests.Quests.Length; q++) yield return ("wq" + q, GoWorldQuests.Quests[q].Steps);
        }

        /// <summary>"줄_단계" 열쇠 → (줄, 단계).</summary>
        private static (string line, int step) SplitKey(string key)
        {
            int k = key.LastIndexOf('_');
            return (key.Substring(0, k), int.Parse(key.Substring(k + 1)));
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
                if (n.Pet) any = BuildDrone(root.transform); // 109-14-21 둥실이 — 떠 있는 배달 기계
                else if (n.FolkBody != null && FolkBuilder.Instance != null) // 109-14-19 노 도둑 = 나무꾼 몸 · 해솔 = 파수꾼 몸
                    any = NpcIdle.SpawnRigged(FolkBuilder.Instance.BodyModel(n.FolkBody), root.transform, CharacterVisual.HumanHeight) != null;
                else if (src != null)
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
                if (!any) CharacterVisual.SpawnFallbackCapsule(root.transform, n.Id == "ferryman" ? new Color(0.3f, 0.4f, 0.53f) : n.Id == "wanderer" ? new Color(0.22f, 0.22f, 0.29f)
                    : n.Id == "haesol" ? new Color(0.15f, 0.13f, 0.18f) : n.Id == "thief" ? new Color(0.35f, 0.29f, 0.23f) : new Color(0.55f, 0.42f, 0.6f));
                if (n.Mask) _masks[n.Id] = AddMask(root.transform, n.Crack);
                if (n.EraKo != null) AddBangs(n.Id, root.transform); // 109-14-21 세계 임무 인물 머리 위 푸른 !
                // 마을 쪽(마을 역참)을 본다
                Vector3 look = GoWorldMap.WaypointPos(GoWorldMap.Waypoints[0]) - root.transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f) root.transform.rotation = Quaternion.LookRotation(look);
                _npcs[n.Id] = root;
            }
        }

        // ---- 109-14-21 세계 임무 — 머리 위 푸른 !(맡을 것 밝게 · 따라가지 않는 임무를 이어 갈 사람 흐리게) · 둥실이 기계 몸 ----
        private readonly Dictionary<string, (GameObject bright, GameObject dim)> _bangs = new Dictionary<string, (GameObject, GameObject)>();

        private void AddBangs(string id, Transform root)
        {
            GameObject Make(string name, Color c)
            {
                var g = new GameObject(name);
                g.transform.SetParent(root, false);
                g.transform.localPosition = new Vector3(0f, 4.4f, 0f);
                Saga.Core.SagaWorldText.Add(g, "!", 7f, c);
                _labels.Add(g.transform);
                return g;
            }
            _bangs[id] = (Make("QuestBang", new Color(0.35f, 0.7f, 1f)), Make("QuestBangDim", new Color(0.35f, 0.55f, 0.8f, 0.45f)));
        }

        /// <summary>그 인물 머리 위 ! — 2 = 맡을 임무의 맡길 사람(밝게) · 1 = 따라가지 않는 맡은 임무의 다음 대화 상대(흐리게) · 0 = 없음.</summary>
        public static int BangOf(string id)
        {
            for (int q = 0; q < GoWorldQuests.Quests.Length; q++)
                if (GoWorldQuests.Quests[q].Giver == id && WorldQuestState.Available(q)) return 2;
            for (int q = 0; q < GoWorldQuests.Quests.Length; q++)
            {
                if (!WorldQuestState.Taken(q) || (StoryState.TrackingQuest && StoryState.Track == q)) continue;
                var st = WorldQuestState.Current(q);
                if ((st.Type == GoStory.StepType.Talk || st.Type == GoStory.StepType.Sail) && st.Npc == id) return 1;
            }
            return 0;
        }

        public bool BangShown(string id, bool bright) => _bangs.TryGetValue(id, out var b) && (bright ? b.bright : b.dim).activeInHierarchy;

        private static bool BuildDrone(Transform root)
        {
            var body = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryDrone (generated)", color = new Color(0.82f, 0.88f, 0.92f) };
            body.SetFloat("_Metallic", 0.6f);
            body.SetFloat("_Smoothness", 0.7f);
            var glow = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryDroneEye (generated)", color = new Color(0.55f, 0.85f, 0.95f) };
            glow.EnableKeyword("_EMISSION");
            glow.SetColor("_EmissionColor", new Color(0.35f, 0.85f, 1f) * 3f);
            var d = new GameObject("Drone");
            d.transform.SetParent(root, false);
            d.transform.localPosition = new Vector3(0f, 1.8f, 0f);
            GameObject Part(PrimitiveType t, Vector3 pos, Vector3 scale, Material m)
            {
                var g = GameObject.CreatePrimitive(t);
                DestroyImmediate(g.GetComponent<Collider>());
                g.transform.SetParent(d.transform, false);
                g.transform.localPosition = pos;
                g.transform.localScale = scale;
                g.GetComponent<MeshRenderer>().sharedMaterial = m;
                return g;
            }
            Part(PrimitiveType.Sphere, Vector3.zero, new Vector3(1.1f, 0.8f, 1.1f), body);
            Part(PrimitiveType.Cylinder, Vector3.zero, new Vector3(1.9f, 0.04f, 1.9f), body);
            Part(PrimitiveType.Sphere, new Vector3(0f, 0.05f, 0.5f), new Vector3(0.35f, 0.25f, 0.2f), glow);
            for (int i = 0; i < 4; i++)
            {
                float a = (i + 0.5f) * Mathf.PI * 0.5f;
                Part(PrimitiveType.Cylinder, new Vector3(Mathf.Sin(a) * 0.95f, 0.12f, Mathf.Cos(a) * 0.95f), new Vector3(0.55f, 0.02f, 0.55f), glow);
            }
            return true;
        }

        /// <summary>109-14-13 가면 — 머리뼈(휴머노이드면)에 검은 탈 하나(흰 눈구멍 둘). 뼈가 없으면 키 1.6m 앞.</summary>
        private static bool SquadStep(GoStory.StepType t) => t == GoStory.StepType.Kill || t == GoStory.StepType.Duel || t == GoStory.StepType.Defend;

        private readonly Dictionary<string, GameObject> _masks = new Dictionary<string, GameObject>();

        private static GameObject AddMask(Transform root, bool crack = false, bool storm = false)
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
            var white = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryMaskEye (generated)", color = storm ? new Color(0.85f, 0.62f, 0.2f) : new Color(0.9f, 0.9f, 0.85f) };
            if (storm) { white.EnableKeyword("_EMISSION"); white.SetColor("_EmissionColor", new Color(1f, 0.7f, 0.2f) * 2f); } // 109-14-20 먹구름 임금 — 어두운 금빛 눈
            MaskPart(mask.transform, PrimitiveType.Sphere, Vector3.zero, new Vector3(0.2f, 0.26f, 0.09f), black, root);
            MaskPart(mask.transform, PrimitiveType.Sphere, new Vector3(-0.045f, 0.035f, 0.035f), new Vector3(0.045f, 0.02f, 0.02f), white, root);
            MaskPart(mask.transform, PrimitiveType.Sphere, new Vector3(0.045f, 0.035f, 0.035f), new Vector3(0.045f, 0.02f, 0.02f), white, root);
            if (crack)
            {
                // 109-14-16 금 간 가면 — 눈 사이로 비스듬히 흰 금 하나
                var c = MaskPart(mask.transform, PrimitiveType.Cube, new Vector3(0.01f, -0.02f, 0.046f), new Vector3(0.012f, 0.22f, 0.01f), white, root);
                c.transform.rotation = root.rotation * Quaternion.Euler(0f, 0f, 24f);
                c.name = "Crack";
            }
            return mask;
        }

        /// <summary>109-14-20 먹구름 임금 왕관 — 가면 위(머리뼈 곁)에 금빛 테 + 뿔 다섯.</summary>
        private static void AddCrown(Transform root)
        {
            var mask = FindDeep(root, "Mask");
            if (mask == null) return;
            var gold = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryCrown (generated)", color = new Color(0.85f, 0.66f, 0.2f) };
            gold.SetFloat("_Metallic", 0.9f);
            gold.SetFloat("_Smoothness", 0.75f);
            var crown = new GameObject("Crown");
            crown.transform.SetParent(mask.parent, false);
            crown.transform.position = mask.position + Vector3.up * 0.22f * root.lossyScale.y - root.forward * 0.1f * root.lossyScale.y;
            var band = MaskPart(crown.transform, PrimitiveType.Cylinder, Vector3.zero, new Vector3(0.3f, 0.035f, 0.3f) * root.lossyScale.y, gold, root);
            band.name = "CrownBand";
            for (int i = 0; i < 5; i++)
            {
                float a = i * Mathf.PI * 2f / 5f;
                var tip = MaskPart(crown.transform, PrimitiveType.Cube, new Vector3(Mathf.Sin(a) * 0.13f, 0.07f, Mathf.Cos(a) * 0.13f), // 부모(몸) 크기를 따른다
                    new Vector3(0.05f, 0.12f, 0.05f) * root.lossyScale.y, gold, root);
                tip.transform.rotation = root.rotation * Quaternion.Euler(0f, a * Mathf.Rad2Deg + 45f, 45f);
            }
        }

        private static Transform FindDeep(Transform t, string name)
        {
            if (t.name == name) return t;
            for (int i = 0; i < t.childCount; i++) { var r = FindDeep(t.GetChild(i), name); if (r != null) return r; }
            return null;
        }

        private static GameObject MaskPart(Transform parent, PrimitiveType t, Vector3 local, Vector3 size, Material m, Transform root)
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
            return go;
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
            var cam = Camera.main;
            if (cam != null)
                foreach (var l in _labels) if (l != null && l.gameObject.activeInHierarchy) l.rotation = Quaternion.LookRotation(l.position - cam.transform.position);
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            Follow(fc.transform.position, Time.deltaTime);
            ChaseTick(fc.transform.position, Time.deltaTime); // 109-14-19
            TickDraftRings(Time.deltaTime); // 109-14-20
            IsleAssist(fc);
            DuelTick();
            DefendTick(fc.transform.position, Time.deltaTime);
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
            if (walking) StoryState.FollowDist = Mathf.Min(len, StoryState.FollowDist + (st.Speed > 0f ? st.Speed : GoStory.FollowSpeed) * dt); // 109-14-28 단계마다 걷는 빠르기
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
                Toast(st.ArriveKey != null ? GoLocalization.T(st.ArriveKey, st.ArriveKo) : GoLocalization.T("story.follow_arrive", "나그네가 걸음을 멈췄다"), 3f);
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
                    case GoStory.StepType.Duel:
                        if (_squad.Count == 0 && GoStory.Flat(p, t) < GoStory.KillNear) SpawnSquad(st, t);
                        break;
                    case GoStory.StepType.Sky:
                        if (GoStory.OnSkyTop(p)) // 109-14-20 섬 윗면에 내려섰다
                        {
                            Toast(GoLocalization.T("story.sky_landed", "☁️ 구름섬에 올라섰다 — 먹구름 무리가 지키고 있다"), 3f);
                            StoryState.Advance();
                            return;
                        }
                        break;
                    case GoStory.StepType.Climb:
                        if (GoWorldMap.StandsOn(GoStory.DuelPeak, p))
                        {
                            Toast(st.EnterKo != null ? GoLocalization.T(st.EnterKey, st.EnterKo) : GoLocalization.T("story.climbed", "봉우리 꼭대기 — 고원 아래 나그네가 보인다"), 3f);
                            StoryState.Advance();
                            return;
                        }
                        break;
                }
            }
            foreach (var n in GoStory.Npcs)
            {
                if (n.Existing || !NpcShown(n.Id)) continue; // 누리는 옛 촌장이 제 말을 한다
                if (st != null && (st.Type == GoStory.StepType.Talk || st.Type == GoStory.StepType.Follow || st.Type == GoStory.StepType.Sail || st.Type == GoStory.StepType.Chase) && st.Npc == n.Id) continue;
                if (GoStory.Flat(p, GoStory.NpcPos(n.Id)) > GoStory.IdleR) continue;
                if (_lastIdle.TryGetValue(n.Id, out float last) && Time.time - last < GoStory.IdleGap) continue;
                _lastIdle[n.Id] = Time.time;
                LastIdleNpc = n.Id;
                Toast($"{GoStory.NpcName(n.Id)} — {GoStory.NpcIdle(n.Id)}", 3.5f);
            }
        }

        public static string SquadKey => "sq:" + StoryState.LineKey; // 109-14-21 따라가는 줄의 단계

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
                if (boss)
                {
                    e.MakeStoryBoss(GoLocalization.T(st.BossKey, st.BossKo), st.HpMul > 0f ? st.HpMul : GoStory.BossHp,
                        st.AtkMul > 0f ? st.AtkMul : GoStory.BossAtk, st.ScaleMul > 0f ? st.ScaleMul : GoStory.BossScale);
                    if (st.Rot != null) e.SetRotation(st.Rot);
                    if (st.Mask) AddMask(e.transform, st.Crack, st.Crown);
                    if (st.Crown) AddCrown(e.transform); // 109-14-20 먹구름 임금
                }
                _squad.Add(e);
            }
            _duelP2 = false;
            if (st.EnterKo != null) Toast(GoLocalization.T(st.EnterKey, st.EnterKo), 3f);
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
            if (st.Type == GoStory.StepType.Duel && e.IsStoryBoss && e.GroupId == _squadKey)
            {
                Toast(st.WinKo != null ? GoLocalization.T(st.WinKey, st.WinKo) : GoLocalization.T("story.duel_fled", "검은 가면이 먹구름 속으로 달아났다"), 3.5f);
                StoryState.Advance();
                return;
            }
            if (st.Type == GoStory.StepType.Kill && e.StoryFoe && e.GroupId == _squadKey)
            {
                foreach (var m in _squad) if (m != null && m.Alive) return;
                StoryState.Advance();
            }
        }

        private void OnPulse(Vector3 center, float radius, GoElement el)
        {
            var st = StoryState.Current;
            if (st != null && st.Type == GoStory.StepType.Seal) { SealPulse(center, radius); return; }
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

        /// <summary>109-14-14 seal — 원소 신호 원에 걸린 가장 가까운 꺼진 석등 하나. 비문 차례(해·달·별)면 켜지고, 틀리면 모두 꺼진다.
        /// 켠 수는 `StoryState.Progress`(저장 안 함). 셋이면 넘긴다.</summary>
        private void SealPulse(Vector3 center, float radius)
        {
            var st = StoryState.Current;
            if (!_sealSets.TryGetValue(StoryState.LineKey, out var lamps)) return;
            string[] order = GoStory.OrderOf(st);
            int best = -1;
            float bd = float.MaxValue;
            for (int i = 0; i < 3; i++)
            {
                var lamp = lamps[i];
                if (lamp == null || lamp.Lit) continue;
                float d = GoStory.Flat(center, lamp.transform.position);
                if (d <= radius + GoStory.LightR && d < bd) { bd = d; best = i; }
            }
            if (best < 0) return;
            string id = GoStory.SealLayout[best];
            if (id != order[StoryState.Progress])
            {
                StoryState.Progress = 0;
                RefreshSeal();
                Toast(GoLocalization.T("story.seal_wrong", "차례가 틀렸다 — 석등이 모두 꺼졌다"), 3f);
                return;
            }
            StoryState.Progress++;
            RefreshSeal();
            if (StoryState.Progress >= order.Length)
            {
                Toast(order == GoStory.SealOrder ? GoLocalization.T("story.seal_done", "해·달·별 — 봉인이 풀렸다")
                    : string.Format(GoLocalization.T("story.seal_done_order", "{0} — 봉인이 풀렸다"), string.Join("·", System.Array.ConvertAll(order, GoStory.SealName))), 3.5f);
                StoryState.Advance();
            }
            else Toast(string.Format(GoLocalization.T("story.seal_lit", "{0} 석등에 불이 붙었다 ({1}/3)"), GoStory.SealName(id), StoryState.Progress), 2.5f);
        }

        /// <summary>석등 틀 한 벌 — 가운데 + 둘레 셋(이름표).</summary>
        private void BuildSeal(string line, int i, GoStory.Step st, Material stone)
        {
            string key = $"{line}_{i}";
            Vector3 a2 = FolkWalker.Grounded(GoStory.SealPos(st) + Vector3.up * 0.5f);
            string nm = line == "4" ? "StorySeal" : "StorySeal" + key; // 5장은 옛 이름 그대로
            _sealCenters[key] = ElementTorch.Spawn(a2, GoElement.Pyro, transform, stone, nm);
            var lamps = new ElementTorch[3];
            for (int k = 0; k < 3; k++)
            {
                string id = GoStory.SealLayout[k];
                var el = id == "sun" ? GoElement.Pyro : id == "moon" ? GoElement.Cryo : GoElement.Geo;
                lamps[k] = ElementTorch.Spawn(FolkWalker.Grounded(GoStory.SealLampPos(a2, k) + Vector3.up * 0.5f), el, transform, stone, nm + "_" + id);
                var label = new GameObject("Label");
                label.transform.SetParent(lamps[k].transform, false);
                label.transform.localPosition = new Vector3(0f, 5.2f, 0f);
                Saga.Core.SagaWorldText.Add(label, GoStory.SealName(id), 4.5f, GoElements.ColorOf(el));
                _labels.Add(label.transform);
            }
            _sealSets[key] = lamps;
        }

        /// <summary>석등 불 — 차례에서 앞선 것만 켜진다(seal 단계를 넘겼으면 모두). 그 단계에 닿기 전엔 안 선다.</summary>
        private void RefreshSeal()
        {
            foreach (var kv in _sealSets)
            {
                var (line, i) = SplitKey(kv.Key);
                bool shown = !StoryState.OffForTest && StoryState.Reached(line, i);
                bool past = StoryState.Reached(line, i + 1);
                if (_sealCenters.TryGetValue(kv.Key, out var center) && center != null) { center.gameObject.SetActive(shown); center.SetLit(past); }
                var order = GoStory.OrderOf(StoryState.StepOf(line, i));
                for (int k = 0; k < 3; k++)
                {
                    if (kv.Value[k] == null) continue;
                    kv.Value[k].gameObject.SetActive(shown);
                    int o = System.Array.IndexOf(order, GoStory.SealLayout[k]);
                    kv.Value[k].SetLit(past || (StoryState.LineKey == kv.Key && o < StoryState.Progress));
                }
            }
        }


        /// <summary>109-14-14 duel 2단계 — 체력 절반에서 뇌 방패(최대 체력 12%) + 불도깨비 졸개 둘.</summary>
        private void DuelTick()
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Duel || _duelP2 || _squad.Count == 0) return;
            var boss = _squad[0];
            if (boss == null || !boss.Alive || boss.Hp > boss.MaxHp * GoStory.DuelP2At) return;
            _duelP2 = true;
            boss.RaiseBossShield(st.P2El, boss.MaxHp * GoStory.DuelP2Shield);
            var spawner = Object.FindFirstObjectByType<FieldSpawner>();
            var adds = st.Adds ?? new[] { new GoDomain.Foe(FieldEnemy.Kind.EmberImp), new GoDomain.Foe(FieldEnemy.Kind.EmberImp) };
            if (spawner != null)
                for (int i = 0; i < adds.Length; i++)
                {
                    Vector3 off = new Vector3(i == 0 ? -3.5f : 3.5f, 0.5f, 2.5f);
                    _squad.Add(spawner.SpawnStoryFoe(adds[i].Kind, FolkWalker.Grounded(boss.transform.position + off), _squadKey, adds[i].Over));
                }
            Toast(st.P2Ko != null ? GoLocalization.T(st.P2Key, st.P2Ko) : GoLocalization.T("story.duel_p2", "검은 가면이 먹구름을 둘렀다 — 불로 깨라!"), 3f);
        }

        // ---- 109-14-16 제단 지키기(웹 ⑲-16 defend) — 가까이 오면 첫 물결, 다 잡았거나 28초면 다음, 마지막까지 다 잡으면 넘김.
        // 무리는 제단으로 곧장(`FieldEnemy.SetSiege`), 제단이 무너지거나 전멸하면 무리가 흩어지고 4초 쉰 뒤 처음부터. 저장 안 함.
        private string _defKey;
        private int _defWave = -1;
        private float _defT, _defRest, _defHp, _defHpMax;
        private bool _defWarned;
        private readonly List<List<FieldEnemy>> _defWaves = new List<List<FieldEnemy>>();
        public int DefendWave => _defWave;
        public float DefendHp => _defHp;
        public float DefendHpMax => _defHpMax;
        public float DefendRest => _defRest;
        public float DefendT => _defT;

        /// <summary>한 박자(프레임마다 · 진단도 부른다).</summary>
        public void DefendTick(Vector3 p, float dt)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Defend || StoryState.OffForTest) { _defKey = null; return; }
            Vector3 c = GoStory.StepPos(st);
            if (_defKey != SquadKey)
            {
                _defKey = SquadKey;
                _defWave = -1; _defT = 0f; _defRest = 0f; _defWarned = false; _defWaves.Clear();
                _defHpMax = _defHp = GoStory.DefendHpMax(c);
            }
            if (_defRest > 0f) { _defRest = Mathf.Max(0f, _defRest - dt); return; }
            var W = st.Waves ?? GoStory.DefendWaves;
            if (_defWave < 0)
            {
                if (GoStory.Flat(p, c) <= GoStory.DefendStart) SpawnWave(st, 0);
                return;
            }
            _defT += dt;
            if (_defWave + 1 < W.Length)
            {
                if (WaveCleared(_defWave) || _defT >= GoStory.DefendWaveSec) SpawnWave(st, _defWave + 1);
                return;
            }
            for (int n = 0; n < W.Length; n++) if (!WaveCleared(n)) return;
            Toast(string.Format(GoLocalization.T("story.defend_held", "{0}을 지켜 냈다 — 무리가 물러간다"), GoLocalization.T(st.NameKey, st.NameKo)), 3.5f);
            StoryState.Advance();
        }

        public bool WaveCleared(int n)
        {
            if (n < 0 || n >= _defWaves.Count) return false;
            foreach (var e in _defWaves[n]) if (e != null && e.Alive) return false;
            return true;
        }

        private void SpawnWave(GoStory.Step st, int n)
        {
            var spawner = Object.FindFirstObjectByType<FieldSpawner>();
            var W = st.Waves ?? GoStory.DefendWaves;
            if (spawner == null || n >= W.Length) return;
            Vector3 c = GoStory.StepPos(st);
            _squadKey = SquadKey;
            var wave = new List<FieldEnemy>();
            for (int i = 0; i < W[n].Length; i++)
            {
                Vector3 home = FolkWalker.Grounded(GoStory.DefendSlot(c, st.Dirs ?? GoStory.CapeDirs, n, i) + Vector3.up * 0.5f);
                var e = spawner.SpawnStoryFoe(W[n][i].Kind, home, $"{_squadKey}:w{n}", W[n][i].Over);
                e.SetSiege(c);
                wave.Add(e);
                _squad.Add(e);
            }
            while (_defWaves.Count <= n) _defWaves.Add(new List<FieldEnemy>());
            _defWaves[n] = wave;
            _defWave = n;
            _defT = 0f;
            Toast(string.Format(GoLocalization.T("story.defend_wave", "물결 {0}/{1} — 가면 무리가 {2}으로 몰려온다"), n + 1, W.Length, GoLocalization.T(st.NameKey, st.NameKo)), 3f);
        }

        private void OnSiegeHit(FieldEnemy e, float dmg)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Defend || _defKey == null || _defRest > 0f || !_squad.Contains(e)) return;
            _defHp = Mathf.Max(0f, _defHp - dmg);
            string nm = GoLocalization.T(st.NameKey, st.NameKo);
            if (_defHp <= 0f) { ResetDefend(string.Format(GoLocalization.T("story.defend_broken", "{0}이 무너졌다 — 무리가 흩어진다. {1}초 뒤 처음부터"), nm, GoStory.DefendRest)); return; }
            if (!_defWarned && _defHp <= _defHpMax * 0.5f) { _defWarned = true; Toast(string.Format(GoLocalization.T("story.defend_half", "{0}이 흔들린다 — 절반이 깎였다!"), nm), 2.5f); }
        }

        private void OnWiped()
        {
            var st = StoryState.Current;
            if (st != null && st.Type == GoStory.StepType.Defend && _defKey == SquadKey && _defWave >= 0)
                ResetDefend(string.Format(GoLocalization.T("story.defend_wiped", "물러난 사이 무리가 흩어졌다 — {0}초 뒤 처음부터"), GoStory.DefendRest));
        }

        private void ResetDefend(string msg)
        {
            ClearSquad();
            _defWaves.Clear();
            _defWave = -1;
            _defT = 0f;
            _defRest = GoStory.DefendRest;
            _defHp = _defHpMax;
            _defWarned = false;
            _defKey = SquadKey;
            Toast(msg, 3.5f);
        }

        /// <summary>진단용 — 제단을 친 한 대 · 전멸을 곧장 넣는다.</summary>
        public void SiegeHitForTest(FieldEnemy e, float dmg) => OnSiegeHit(e, dmg);
        public void WipedForTest() => OnWiped();

        /// <summary>진단용 — 2단계를 지금 본다(프레임을 안 기다리게).</summary>
        public void DuelTickForTest() => DuelTick();

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
                Toast(StoryState.LastDoneQuest ? string.Format(GoLocalization.T("wq.done", "🔷 {0} 끝 — {1}"), StoryState.LastDoneName, reward)
                    : string.Format(GoLocalization.T("story.chapter_done", "{0} 끝 — {1}"), StoryState.LastDoneName, reward), 5f);
            else if (StoryState.Current != null) Toast("◆ " + GoStory.StepText(StoryState.Current), 3f);
        }

        private void OnChanged() => Refresh();

        /// <summary>기둥·제단·임무 적을 지금 단계에 맞춘다(단계가 바뀌면 남은 임무 적은 치운다).</summary>
        public void Refresh()
        {
            var st = StoryState.Current;
            if (_squad.Count > 0 && (st == null || !SquadStep(st.Type) || _squadKey != SquadKey)) ClearSquad(); // 109-14-16 결투·지키기 무리도 그 단계 동안은 남긴다(14-14 땐 결투를 0.5초마다 치웠다)
            bool has = Target(out Vector3 t, out _);
            if (_pillar != null)
            {
                _pillar.SetActive(has);
                if (has) _pillar.transform.position = FolkWalker.Grounded(t + Vector3.up * 0.5f) + Vector3.up * PillarHeight * 0.5f;
            }
            foreach (var kv in _altars)
            {
                var (line, i) = SplitKey(kv.Key);
                bool past = StoryState.Reached(line, i + 1); // 불을 붙였다 — 켠 채 남는다
                int from = StoryState.StepOf(line, i).AltarFrom; // 109-14-16 지키기·결투 동안에도 제단 몸이 선다
                kv.Value.gameObject.SetActive(!StoryState.OffForTest && StoryState.Reached(line, from >= 0 ? from : i));
                kv.Value.SetLit(past);
            }
            RefreshSeal();
            RefreshSky();
            foreach (var kv in _bangs) // 109-14-21 푸른 !
            {
                int b = !StoryState.OffForTest && GoStory.Shown(kv.Key, StoryState.Ch, StoryState.StepIndex) ? BangOf(kv.Key) : 0;
                kv.Value.bright.SetActive(b == 2);
                kv.Value.dim.SetActive(b == 1);
            }
            foreach (var kv in _masks)
            {
                var sp = GoStory.SpotNow(kv.Key);
                if (kv.Value != null) kv.Value.SetActive(!(sp.HasValue && sp.Value.Unmask)); // 109-14-20 가면 벗은 해솔
            }
            foreach (var kv in _npcs)
            {
                bool shown = !StoryState.OffForTest && GoStory.Shown(kv.Key, StoryState.Ch, StoryState.StepIndex);
                kv.Value.SetActive(shown);
                // 장·단계마다 옮겨 선다(따라가기 동안은 Follow 가 옮긴다)
                bool walking = st != null && (st.Type == GoStory.StepType.Follow || (st.Type == GoStory.StepType.Chase && _chaseKey == SquadKey)) && st.Npc == kv.Key;
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

        /// <summary>진단용 — 혼잣말 쿨다운·임무 적·쫓기를 비운다.</summary>
        public void ResetForTest()
        {
            _lastIdle.Clear();
            LastIdleNpc = null;
            ClearSquad();
            _chaseKey = null;
            StoryState.ChasePos = null;
            Refresh();
        }

        // ---- 109-14-20 구름섬 — 봉우리 북쪽 하늘에 뜬 섬(돌 몸 + 거꾸로 선 바위 뿔 + 풀 윗면 + 돌 난간 1.6m + 북쪽 돌 단).
        // 9장이 열리기 전엔 먹구름 덮개(검은 구름 덩이)에 싸여 있고, 열린 뒤엔 봉우리 정상에서 바람 기둥(흰 고리가 솟는다)이 선다 ----
        public GameObject Sky { get; private set; }
        public GameObject SkyCover { get; private set; }
        public GameObject DraftRings { get; private set; }
        private readonly List<LineRenderer> _draftRings = new List<LineRenderer>();
        private float _draftT;
        private bool _skyWasOpen;

        private void BuildSky(Material stone)
        {
            Sky = new GameObject("StorySky");
            Sky.transform.SetParent(transform, false);
            Vector3 c = GoStory.SkyCenter;
            float r = GoStory.SkyR, th = 6f;
            var rock = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            rock.name = "SkyRock";
            DestroyImmediate(rock.GetComponent<Collider>());
            rock.transform.SetParent(Sky.transform, false);
            rock.transform.position = c - Vector3.up * th * 0.5f;
            rock.transform.localScale = new Vector3(r * 2f, th * 0.5f, r * 2f);
            rock.AddComponent<MeshCollider>().sharedMesh = rock.GetComponent<MeshFilter>().sharedMesh;
            rock.AddComponent<NoClimb>();
            if (stone != null) rock.GetComponent<MeshRenderer>().sharedMaterial = stone;
            var horn = GameObject.CreatePrimitive(PrimitiveType.Sphere); // 거꾸로 선 바위 뿔(밑면)
            horn.name = "SkyHorn";
            DestroyImmediate(horn.GetComponent<Collider>());
            horn.transform.SetParent(Sky.transform, false);
            horn.transform.position = c - Vector3.up * (th + 7f);
            horn.transform.localScale = new Vector3(r * 1.5f, 18f, r * 1.5f);
            if (stone != null) horn.GetComponent<MeshRenderer>().sharedMaterial = stone;
            var grass = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StorySkyGrass (generated)", color = new Color(0.36f, 0.5f, 0.24f) };
            grass.SetFloat("_Smoothness", 0.08f);
            var top = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            top.name = "SkyGrass";
            DestroyImmediate(top.GetComponent<Collider>());
            top.transform.SetParent(Sky.transform, false);
            top.transform.position = c + Vector3.up * 0.02f;
            top.transform.localScale = new Vector3((r - 1f) * 2f, 0.04f, (r - 1f) * 2f);
            top.GetComponent<MeshRenderer>().sharedMaterial = grass;
            // 돌 난간 — 가장자리 0.8m 안쪽에 토막 스물넷(걸어서는 못 넘고 뛰어넘는다)
            const int seg = 24;
            float rr = r - 0.8f, len = 2f * Mathf.PI * rr / seg + 0.2f;
            for (int i = 0; i < seg; i++)
            {
                float a = (i + 0.5f) * Mathf.PI * 2f / seg;
                var w = GameObject.CreatePrimitive(PrimitiveType.Cube);
                w.name = "SkyRail";
                w.transform.SetParent(Sky.transform, false);
                w.transform.position = c + new Vector3(Mathf.Sin(a) * rr, GoStory.SkyRail * 0.5f, Mathf.Cos(a) * rr);
                w.transform.rotation = Quaternion.Euler(0f, a * Mathf.Rad2Deg + 90f, 0f);
                w.transform.localScale = new Vector3(len, GoStory.SkyRail, 0.5f);
                w.AddComponent<NoClimb>();
                if (stone != null) w.GetComponent<MeshRenderer>().sharedMaterial = stone;
            }
            var dais = GameObject.CreatePrimitive(PrimitiveType.Cube); // 북쪽 돌 단(여섯째 자리)
            dais.name = "SkyDais";
            DestroyImmediate(dais.GetComponent<Collider>());
            dais.transform.SetParent(Sky.transform, false);
            dais.transform.position = c + new Vector3(0f, 0.3f, -r + 4f);
            dais.transform.localScale = new Vector3(7f, 0.6f, 3.5f);
            if (stone != null) dais.GetComponent<MeshRenderer>().sharedMaterial = stone;
            // 먹구름 덮개 — 검은 구름 덩이 다섯(충돌 없음)
            SkyCover = new GameObject("SkyCover");
            SkyCover.transform.SetParent(Sky.transform, false);
            var cloud = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StorySkyCloud (generated)", color = new Color(0.2f, 0.2f, 0.25f) };
            cloud.SetFloat("_Smoothness", 0f);
            for (int i = 0; i < 5; i++)
            {
                var b = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                b.name = "Cloud";
                DestroyImmediate(b.GetComponent<Collider>());
                b.transform.SetParent(SkyCover.transform, false);
                float a = i * Mathf.PI * 2f / 5f;
                b.transform.position = c + (i == 0 ? Vector3.up * 2f : new Vector3(Mathf.Sin(a) * r * 0.75f, -1f, Mathf.Cos(a) * r * 0.75f));
                b.transform.localScale = i == 0 ? new Vector3(r * 2.3f, 16f, r * 2.3f) : new Vector3(r * 1.3f, 12f, r * 1.3f);
                b.GetComponent<MeshRenderer>().sharedMaterial = cloud;
            }
            // 바람 기둥 — 정상에서 섬 윗면 + 12m 까지, 흰 고리 여덟이 솟는다
            DraftRings = new GameObject("DraftRings");
            DraftRings.transform.SetParent(Sky.transform, false);
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "StoryDraft (generated)" };
            for (int i = 0; i < 8; i++)
            {
                var go = new GameObject("DraftRing");
                go.transform.SetParent(DraftRings.transform, false);
                var lr = go.AddComponent<LineRenderer>();
                lr.useWorldSpace = false;
                lr.loop = true;
                lr.positionCount = 32;
                lr.widthMultiplier = 0.25f;
                lr.material = lineMat;
                lr.startColor = lr.endColor = new Color(1f, 1f, 1f, 0.55f);
                lr.shadowCastingMode = ShadowCastingMode.Off;
                for (int k = 0; k < 32; k++)
                {
                    float a = k * Mathf.PI * 2f / 32f;
                    lr.SetPosition(k, new Vector3(Mathf.Cos(a) * GoStory.DraftR, 0f, Mathf.Sin(a) * GoStory.DraftR));
                }
                _draftRings.Add(lr);
            }
            Physics.SyncTransforms();
        }

        /// <summary>9장이 열렸나에 맞춰 덮개·기둥·몸 기둥 판정을 켠다(열리는 순간 알림).</summary>
        private void RefreshSky()
        {
            bool open = !StoryState.OffForTest && GoStory.SkyOpen;
            if (SkyCover != null) SkyCover.SetActive(!open);
            if (DraftRings != null) DraftRings.SetActive(open);
            PlayerController.DraftOn = open;
            PlayerController.DraftBase = GoStory.DuelPeak.Top;
            PlayerController.DraftR = GoStory.DraftR;
            PlayerController.DraftTop = GoStory.DraftTop;
            PlayerController.DraftRise = GoStory.DraftRise;
            if (open && !_skyWasOpen && StoryState.Ch == 8 && StoryState.StepIndex == 0 && Application.isPlaying)
                Toast(GoLocalization.T("story.sky_open", "🌬️ 봉우리 꼭대기에서 하늘로 바람 기둥이 솟았다 — 먹구름 덮개가 걷힌다"), 4f);
            _skyWasOpen = open;
        }

        private void TickDraftRings(float dt)
        {
            if (DraftRings == null || !DraftRings.activeSelf) return;
            _draftT += dt;
            Vector3 b = GoStory.DuelPeak.Top;
            float h = GoStory.DraftTop - b.y;
            for (int i = 0; i < _draftRings.Count; i++)
            {
                float f = Mathf.Repeat(_draftT * GoStory.DraftRise / h + i / (float)_draftRings.Count, 1f);
                _draftRings[i].transform.position = b + Vector3.up * (f * h);
            }
        }

        // ---- 109-14-19 바위섬 — 강 칸 한가운데 둥근 바위(돌 몸 + 풀 윗면 + 가장자리 바위 셋). 헤엄쳐 가장자리에 오면 섬 위로 올린다 ----

        private void BuildIsle(Material stone)
        {
            Isle = new GameObject("StoryIsle");
            Isle.transform.SetParent(transform, false);
            Vector3 c = GoStory.IslePos(Vector2.zero);
            float bottom = TestMapData.RiverBedHeight - 0.5f, h = c.y - bottom, r = GoStory.IsleR;
            var rock = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            rock.name = "IsleRock";
            DestroyImmediate(rock.GetComponent<Collider>()); // 원통 기본 충돌체는 캡슐이라 윗면이 둥글다
            rock.transform.SetParent(Isle.transform, false);
            rock.transform.position = new Vector3(c.x, bottom + h * 0.5f, c.z);
            rock.transform.localScale = new Vector3(r * 2f, h * 0.5f, r * 2f);
            rock.AddComponent<MeshCollider>().sharedMesh = rock.GetComponent<MeshFilter>().sharedMesh;
            if (stone != null) rock.GetComponent<MeshRenderer>().sharedMaterial = stone;
            var grass = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryIsleGrass (generated)", color = new Color(0.3f, 0.4f, 0.19f) };
            grass.SetFloat("_Smoothness", 0.08f);
            var top = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            top.name = "IsleGrass";
            DestroyImmediate(top.GetComponent<Collider>());
            top.transform.SetParent(Isle.transform, false);
            top.transform.position = c + Vector3.up * 0.02f;
            top.transform.localScale = new Vector3((r - 1.4f) * 2f, 0.04f, (r - 1.4f) * 2f);
            top.GetComponent<MeshRenderer>().sharedMaterial = grass;
            foreach (float deg in new[] { 60f, 180f, 300f }) // 석등(0·120·240°) 사이 가장자리
            {
                var b = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                b.name = "IsleBoulder";
                DestroyImmediate(b.GetComponent<Collider>());
                b.transform.SetParent(Isle.transform, false);
                float a = deg * Mathf.Deg2Rad;
                b.transform.position = c + new Vector3(Mathf.Sin(a), 0.4f, -Mathf.Cos(a)) * (r - 1.6f);
                b.transform.rotation = Quaternion.Euler(12f, deg, 7f);
                b.transform.localScale = new Vector3(3.4f, 2.3f, 2.9f);
                if (stone != null) b.GetComponent<MeshRenderer>().sharedMaterial = stone;
            }
            Physics.SyncTransforms();
        }

        private PlayerController _pc;

        /// <summary>헤엄쳐 섬 가장자리(2.5m 안)에 오면 섬 위로 — 물속 돌 벽은 오를 턱이 없다(배를 놓쳤거나 쓰러져 마을로 돌아간 뒤에도 닿게).</summary>
        private void IsleAssist(FieldCombat fc)
        {
            if (_pc == null) _pc = fc.GetComponent<PlayerController>();
            if (_pc == null || _pc.Mode != PlayerController.MoveMode.Swim) return;
            Vector3 c = GoStory.IslePos(Vector2.zero), d = _pc.transform.position - c;
            d.y = 0f;
            if (d.magnitude > GoStory.IsleR + 2.5f || d.magnitude < 0.1f) return;
            _pc.Teleport(c + d.normalized * (GoStory.IsleR - 2.5f) + Vector3.up * 0.4f);
        }

        // ---- 109-14-19 쫓기 — 노 도둑(웹 chase). 가까이 오면 달아나고, 길 점마다 숨 고르기, 길 끝이면 놓친 것(처음 자리로). 저장 안 함 ----
        private string _chaseKey;
        private int _chaseI;
        private Vector3 _chasePos;
        private bool _chaseRun;
        private float _chasePause;
        public bool ChaseRunning => _chaseKey != null && _chaseKey == SquadKey && _chaseRun;
        public int ChaseIndex => _chaseI;
        public Vector3 ChasePos => _chasePos;

        /// <summary>한 박자(프레임마다 · 진단도 부른다) — 잡혔나 먼저 본다.</summary>
        public void ChaseTick(Vector3 p, float dt)
        {
            var st = StoryState.Current;
            if (st == null || st.Type != GoStory.StepType.Chase)
            {
                if (_chaseKey != null) { _chaseKey = null; StoryState.ChasePos = null; }
                return;
            }
            if (StoryState.Talking) return;
            string who = st.Npc; // 109-14-21 노 도둑·둥실이 — 그 인물의 길(RunPath)
            if (_chaseKey != SquadKey) { _chaseKey = SquadKey; _chaseI = 0; _chasePos = GoStory.RunPoint(who, 0); _chaseRun = false; _chasePause = 0f; }
            StoryState.ChasePos = _chasePos;
            float d = GoStory.Flat(p, _chasePos);
            if (d <= GoStory.ChaseCatch)
            {
                _chaseKey = null;
                StoryState.ChasePos = null;
                PlaceThief(who, Vector3.zero, false);
                Toast(st.WinKo != null ? GoLocalization.T(st.WinKey, st.WinKo) : GoLocalization.T("story.chase_caught", "🏃 노 도둑을 붙잡았다 — 노를 되찾았다"), 3f);
                StoryState.Advance();
                return;
            }
            if (!_chaseRun)
            {
                if (d <= GoStory.ChaseStart)
                {
                    _chaseRun = true;
                    _chasePause = 0f;
                    Toast(st.EnterKo != null ? GoLocalization.T(st.EnterKey, st.EnterKo) : GoLocalization.T("story.chase_run", "🏃 도둑이 노를 메고 달아난다 — 달려라!"), 2.5f);
                }
                PlaceThief(who, p - _chasePos, false);
                return;
            }
            if (_chasePause > 0f) { _chasePause = Mathf.Max(0f, _chasePause - dt); PlaceThief(who, _chasePos - p, false); return; }
            Vector3 next = GoStory.RunPoint(who, _chaseI + 1), to = next - _chasePos;
            to.y = 0f;
            float nd = to.magnitude, step = GoStory.ChaseSpeed * dt;
            if (nd <= step) { _chasePos = next; _chaseI++; _chasePause = GoStory.ChasePause; }
            else _chasePos += to / nd * step;
            if (_chaseI >= GoStory.RunCount(who) - 1)
            {
                _chaseI = 0; _chasePos = GoStory.RunPoint(who, 0); _chaseRun = false; _chasePause = 0f;
                Toast(st.LostKo != null ? GoLocalization.T(st.LostKey, st.LostKo) : GoLocalization.T("story.chase_lost", "💨 놓쳤다 — 도둑이 처음 자리로 숨어들었다. 다시 가까이 가면 달아난다"), 3.5f);
            }
            StoryState.ChasePos = _chasePos;
            PlaceThief(who, to, _chaseRun && _chasePause <= 0f);
        }

        private void PlaceThief(string who, Vector3 face, bool running)
        {
            if (!_npcs.TryGetValue(who, out var body)) return;
            body.transform.position = FolkWalker.Grounded(_chasePos + Vector3.up * 0.5f);
            face.y = 0f;
            if (face.sqrMagnitude > 0.0001f) body.transform.rotation = Quaternion.LookRotation(face);
            var anim = body.GetComponentInChildren<Animator>();
            if (anim != null && anim.runtimeAnimatorController != null && HasParam(anim, "Speed")) anim.SetFloat("Speed", running ? 1f : 0f);
        }

        // ---- 109-14-19 배 — sail 대화가 끝나면 그 자리로(웹 키보드 판 순간이동 길, 화면 전환 없이 알림) ----
        public static void Sail(GoStory.Step st)
        {
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (pc != null) pc.Teleport(FolkWalker.Grounded(GoStory.SailDest(st) + Vector3.up * 1.5f) + Vector3.up * 0.1f);
            Toast(st.ToIsle ? GoLocalization.T("story.sail_isle", "⛵ 사공의 배가 물살을 가른다 — 바위섬에 닿았다") : GoLocalization.T("story.sail_dock", "⛵ 배가 강가 나루에 닿았다"), 3.5f);
        }
    }
}
