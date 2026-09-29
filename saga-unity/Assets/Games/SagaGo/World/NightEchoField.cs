using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-56b 밤의 잔불 런타임(웹 사가고 ⑲-56 `nightecho.js`) — 밤에만 켜지는 보랏빛 불(도형) + 14m 안에 들면 잔당 셋 + 60m 밖·낮·이미 끈 자리면 거둠 + 다 쓰러뜨리면 보상.
    /// 그날 이미 끈 자리는 안 탄다(`NightEchoState`). `WorldMapBuilder` 가 Play 때 붙인다. 진단은 `Tick` 을 직접 부른다.
    /// </summary>
    public class NightEchoField : MonoBehaviour
    {
        public static NightEchoField Instance { get; private set; }

        private readonly Dictionary<string, List<FieldEnemy>> _camps = new Dictionary<string, List<FieldEnemy>>();
        private readonly Dictionary<string, GameObject> _fires = new Dictionary<string, GameObject>();
        private FieldSpawner _spawner;
        private float _wait;
        /// <summary>마지막 보상 글(진단).</summary>
        public string LastClear { get; private set; }

        public bool CampUp(string id) => _camps.TryGetValue(id, out var l) && l.Count > 0;
        public int CampCount(string id) => _camps.TryGetValue(id, out var l) ? l.Count : 0;
        public List<FieldEnemy> CampFoes(string id) => _camps.TryGetValue(id, out var l) ? l : new List<FieldEnemy>();
        public bool FireShown(string id) => _fires.TryGetValue(id, out var g) && g != null && g.activeSelf;
        public static Vector3 SpotPos(GoNight.Spot s) => FolkWalker.Grounded(s.Pos);

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            FieldEnemy.Killed -= OnKilled;
            FieldCombat.Wiped -= OnWiped;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            _spawner = Object.FindFirstObjectByType<FieldSpawner>();
            FieldEnemy.Killed += OnKilled;
            FieldCombat.Wiped += OnWiped;
            var glow = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "NightEmber (generated)", color = new Color(0.62f, 0.4f, 1f) };
            glow.EnableKeyword("_EMISSION");
            glow.SetColor("_EmissionColor", new Color(0.62f, 0.4f, 1f) * 3f);
            foreach (var s in GoNight.Spots)
            {
                var root = new GameObject("NightEmber_" + s.Id);
                root.transform.SetParent(transform, false);
                root.transform.position = SpotPos(s);
                for (int i = 0; i < 5; i++)
                {
                    var f = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                    Destroy(f.GetComponent<Collider>());
                    f.transform.SetParent(root.transform, false);
                    float a = i * Mathf.PI * 2f / 5f;
                    f.transform.localPosition = new Vector3(Mathf.Cos(a) * 0.7f, 0.6f + (i % 3) * 0.55f, Mathf.Sin(a) * 0.7f);
                    f.transform.localScale = new Vector3(0.45f, 0.8f, 0.45f);
                    f.GetComponent<MeshRenderer>().sharedMaterial = glow;
                }
                root.SetActive(false);
                _fires[s.Id] = root;
            }
        }

        private void Update()
        {
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = 0.5f;
            var fc = FieldCombat.Instance;
            if (fc != null) Tick(fc.transform.position);
        }

        /// <summary>한 박자 — 불을 켜고 끄고, 가까우면 잔당을 세우고 멀면 거둔다. 진단도 부른다.</summary>
        public void Tick(Vector3 feet)
        {
            bool litAll = GoNight.Lit; // 1차 결말 뒤 + 밤(자리별 장은 아래)
            foreach (var s in GoNight.Spots)
            {
                bool done = NightEchoState.Done(s.Id);
                bool lit = litAll && GoNight.SpotOpen(s); // 109-14-69 새 지역 셋은 38장 뒤에만
                if (_fires.TryGetValue(s.Id, out var g) && g != null) g.SetActive(lit && !done);
                Vector3 p = SpotPos(s);
                float d = GoStory.Flat(feet, p);
                if (CampUp(s.Id))
                {
                    if (!lit || done || d > GoNight.FarR) Drop(s.Id);
                    continue;
                }
                if (lit && !done && d <= GoNight.NearR) Spawn(s, p);
            }
        }

        private void Spawn(GoNight.Spot s, Vector3 p)
        {
            var fc = FieldCombat.Instance;
            var dom = DomainField.Instance;
            if (_spawner == null || fc == null || (dom != null && dom.Running)) return;
            var list = new List<FieldEnemy>();
            for (int i = 0; i < s.Foes.Length; i++)
            {
                float a = i * Mathf.PI * 2f / s.Foes.Length + 0.5f;
                Vector3 home = FolkWalker.Grounded(p + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * GoNight.FoeRing + Vector3.up * 0.5f);
                var e = _spawner.SpawnDomainFoe(s.Foes[i].Kind, s.Foes[i].Over, home, "dm:ne:" + s.Id);
                e.ApplyDomain(GoNight.HpMul, GoNight.AtkMul); // 천하 등급은 안 받는다 — 잔당 배율만
                e.ForceChase();
                list.Add(e);
            }
            _camps[s.Id] = list;
            Toast(string.Format(GoLocalization.T("night.up", "🔮 밤의 잔불 — {0}에서 잔당이 일어났다"), s.Name));
        }

        private void Drop(string id)
        {
            if (_camps.TryGetValue(id, out var l)) foreach (var e in l) if (e != null) { e.gameObject.SetActive(false); Destroy(e.gameObject); }
            _camps.Remove(id);
        }

        private void OnWiped() { foreach (var id in new List<string>(_camps.Keys)) Drop(id); }

        private void OnKilled(FieldEnemy e)
        {
            if (e == null || e.GroupId == null || !e.GroupId.StartsWith("dm:ne:")) return;
            string id = e.GroupId.Substring(6);
            if (!_camps.TryGetValue(id, out var l)) return;
            foreach (var m in l) if (m != null && m.Alive) return; // 아직 남았다
            int i = GoNight.IndexOf(id);
            if (i < 0 || NightEchoState.Done(id)) return;
            _camps.Remove(id);
            NightEchoState.MarkDone(id);
            var s = GoNight.Spots[i];
            GoldState.Add(GoNight.RewardGold);
            TalentState.Add(new[] { 0, GoNight.RewardGuide, 0, 0, 0 });
            LastClear = string.Format(GoLocalization.T("night.clear", "🔮 잔불이 꺼졌다 — {0}: \"{1}\" · 금 {2} · 교본 {3}"), GoStory.NpcShort(s.WhoNpc), s.Line, GoNight.RewardGold, GoNight.RewardGuide);
            Toast(LastClear);
            if (_fires.TryGetValue(id, out var g) && g != null) g.SetActive(false);
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 4f);
        }
    }
}
