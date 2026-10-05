using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-9 숨은 터·주간 보스 런타임(웹 사가고 ⑲-9 `domain.js` 도전 흐름) — 입구 셋(돌기둥 둘 + 들보 + 그 종류 빛)·먹구름 제단(검은 단 + 보랏빛 비석)을 세우고,
    /// 도전 하나를 돌린다: 대기 3초 → 파도(들판 전투 적, `FieldSpawner.SpawnDomainFoe`) → 다 쓰러지면 다음 파도 / 보상 나무 → 원기를 써서 받기.
    /// 원판 밖·시간·전멸(`FieldCombat.Wiped`)·물러남이면 실패(원기 안 씀). 진행 중 도전은 세이브하지 않는다(웹과 같다).
    /// `WorldMapBuilder` 가 Play 때 붙인다. 진단은 `Step` 을 직접 부른다.
    /// </summary>
    public class DomainField : MonoBehaviour
    {
        public static DomainField Instance { get; private set; }

        public class Run
        {
            public GoDomain.Site Site;
            public int Stage;
            public string Phase = "wait"; // wait · fight · tree
            public float T, FightT, Left, LeyT;
            public int Wave = -1;
            public bool P2, Asked;
            public readonly List<FieldEnemy> Foes = new List<FieldEnemy>();
            public GameObject Tree;
        }

        public Run Current { get; private set; }
        public bool Running => Current != null;
        /// <summary>마지막 끝맺음 글(진단).</summary>
        public string LastEnd { get; private set; }
        public event System.Action Changed;
        /// <summary>109-14-12 — 도전을 깼다(보상 나무가 자랐다, 웹 `domain:clear`). 이야기 임무가 본다.</summary>
        public static event System.Action<GoDomain.Kind> Cleared;

        private FieldSpawner _spawner;
        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            FieldCombat.Wiped -= OnWiped;
            FieldEnemy.Killed -= OnKilled;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            _spawner = Object.FindFirstObjectByType<FieldSpawner>();
            FieldCombat.Wiped += OnWiped;
            FieldEnemy.Killed += OnKilled;
            foreach (var s in GoDomain.Sites) SpawnSite(s);
            foreach (var s in GoDomain.Echoes) SpawnSite(s); // 109-14-56 메아리 — 1차 결말 뒤에만 보인다(`RefreshEchoes`)
            RefreshEchoes();
        }

        private float _echoWait;
        /// <summary>메아리 입구를 1차 결말 뒤에만 보이게(진단이 직접 부른다).</summary>
        public void RefreshEchoes()
        {
            foreach (var s in GoDomain.Echoes) { var t = transform.Find("Domain_" + s.Id); if (t != null) t.gameObject.SetActive(GoDomain.EchoShown(s) && !StoryState.OffForTest); }
        }
        public bool EchoShown(string id) { var t = transform.Find("Domain_" + id); return t != null && t.gameObject.activeSelf; }

        // ---- 모양 ----

        private Material Mat(string key, Color c, float glow)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Domain_" + key + " (generated)", color = c };
            if (glow > 0f) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", c * glow); }
            _mats[key] = m;
            return m;
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, Vector3 local, Vector3 scale, Material m, bool keepCollider = false)
        {
            var go = GameObject.CreatePrimitive(t);
            if (!keepCollider) Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public static Vector3 SitePos(GoDomain.Site s) => FolkWalker.Grounded(s.Pos);

        private void SpawnSite(GoDomain.Site s)
        {
            var root = new GameObject("Domain_" + s.Id);
            root.transform.SetParent(transform, false);
            root.transform.position = SitePos(s);
            var stone = Mat("stone", new Color(0.36f, 0.34f, 0.33f), 0f);
            var glow = Mat(s.Kind.ToString(), GoDomain.ColorOf(s.Kind), 2.2f);
            if (GoDomain.IsBoss(s.Kind))
            {
                Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 0.3f, 0f), new Vector3(9f, 0.3f, 9f), Mat("altar", new Color(0.12f, 0.11f, 0.14f), 0f));
                Prim(PrimitiveType.Cube, root.transform, new Vector3(0f, 3.4f, 0f), new Vector3(1.4f, 6f, 1.4f), stone, true);
                Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 7.2f, 0f), Vector3.one * 1.6f, glow);
                Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 0.47f, 0f), new Vector3(7.5f, 0.02f, 7.5f), glow);
            }
            else
            {
                Prim(PrimitiveType.Cube, root.transform, new Vector3(-2.6f, 3f, 0f), new Vector3(1.2f, 6f, 1.2f), stone, true);
                Prim(PrimitiveType.Cube, root.transform, new Vector3(2.6f, 3f, 0f), new Vector3(1.2f, 6f, 1.2f), stone, true);
                Prim(PrimitiveType.Cube, root.transform, new Vector3(0f, 6.4f, 0f), new Vector3(7f, 0.9f, 1.5f), stone);
                Prim(PrimitiveType.Cube, root.transform, new Vector3(0f, 3f, 0f), new Vector3(3.8f, 5.6f, 0.15f), glow);
            }
        }

        // ---- 도전 ----

        public static int Rank => PlayerStats.Level;

        /// <summary>발 자리에서 들어갈 수 있는 입구(11m 안, 없으면 null).</summary>
        public static GoDomain.Site? SiteNear(Vector3 feet)
        {
            foreach (var s in GoDomain.Gates())
            {
                if (s.Kind == GoDomain.Kind.Echo && StoryState.OffForTest) continue;
                Vector3 d = SitePos(s) - feet;
                d.y = 0f;
                if (d.magnitude <= GoDomain.EnterR) return s;
            }
            return null;
        }

        public bool CanEnter(GoDomain.Site s, int stage, out string why)
        {
            why = null;
            if (Running) why = GoLocalization.T("domain.why.running", "이미 도전 중");
            else if (FieldCombat.Instance == null || _spawner == null) why = GoLocalization.T("domain.why.no_field", "들판 전투가 없다");
            else if (stage < 0 || stage >= GoDomain.Stages.Length) why = GoLocalization.T("domain.why.stage", "없는 단계");
            else if (!GoDomain.StageOpen(stage, Rank)) why = string.Format(GoLocalization.T("domain.why.rank", "여정 등급 {0} 에 열림"), GoDomain.Stages[stage].Ar);
            else if (WorldMapUi.Fighting()) why = GoLocalization.T("domain.why.fight", "싸우는 중엔 못 들어간다");
            else if (s.Kind == GoDomain.Kind.Echo && !GoDomain.EchoShown(s)) why = s.After > 0 ? string.Format(GoLocalization.T("domain.why.echo_after", "{0}장을 마친 뒤에 열린다"), s.After) : GoLocalization.T("domain.why.echo", "1차 결말 뒤에 열린다");
            return why == null;
        }

        public bool Enter(GoDomain.Site s, int stage)
        {
            if (!CanEnter(s, stage, out string why)) { Toast(why); return false; }
            Current = new Run { Site = s, Stage = stage, Left = GoDomain.LimitOf(s.Kind) };
            Toast(string.Format(GoLocalization.T("domain.enter", "{0} {1} — 곧 적이 나타난다"), s.Name, GoDomain.Stages[stage].N));
            Changed?.Invoke();
            return true;
        }

        private void SpawnWave(int w)
        {
            var r = Current;
            var st = GoDomain.Stages[r.Stage];
            Vector3 c = SitePos(r.Site);
            if (r.Site.Kind == GoDomain.Kind.Echo) { SpawnEcho(r, st, c); return; }
            var foes = GoDomain.Waves(r.Site.Kind)[w];
            for (int i = 0; i < foes.Length; i++)
            {
                float a = i * Mathf.PI * 2f / foes.Length + 0.6f;
                Vector3 home = foes.Length == 1 ? c + Vector3.forward * 8f : c + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * GoDomain.FoeRing;
                var e = _spawner.SpawnDomainFoe(foes[i].Kind, foes[i].Over, home, $"dm:{r.Site.Id}:{w}");
                if (r.Site.Kind == GoDomain.Kind.Weekly) e.MakeWeeklyBoss();
                e.ApplyDomain(st.Hp, st.Atk * (r.Site.Kind == GoDomain.Kind.Forge ? GoDomain.LeyAtk : 1f));
                e.ForceChase();
                r.Foes.Add(e);
            }
            r.Wave = w;
            r.Phase = "fight";
            Toast(r.Site.Kind == GoDomain.Kind.Weekly ? GoLocalization.T("domain.boss_up", "먹구름 이무기가 깨어났다")
                : string.Format(GoLocalization.T("domain.wave", "파도 {0}/{1}"), w + 1, GoDomain.Waves(r.Site.Kind).Length));
            Changed?.Invoke();
        }

        /// <summary>109-14-56 메아리 — 그 이야기 결투 단계의 보스 하나(몸·배율·공격 차례·가면)를 단계 배율로 세운다. 졸개는 없다.</summary>
        private void SpawnEcho(Run r, GoDomain.Stage st, Vector3 c)
        {
            var stp = GoDomain.EchoBoss(r.Site.Id);
            if (stp == null) { Fail("no boss"); return; }
            var f = stp.Foes[0];
            var e = _spawner.SpawnDomainFoe(f.Kind, f.Over, c + Vector3.forward * 8f, $"dm:{r.Site.Id}:0");
            e.ApplyDomain(st.Hp, st.Atk);
            e.MakeStoryBoss(GoLocalization.T(stp.BossKey, stp.BossKo), stp.HpMul, stp.AtkMul, stp.ScaleMul);
            if (stp.Rot != null) e.SetRotation(stp.Rot);
            if (stp.Mask) StoryField.AddMask(e.transform, stp.Crack, stp.Crown);
            if (stp.Crown) StoryField.AddCrown(e.transform);
            e.ForceChase();
            r.Foes.Add(e);
            r.Wave = 0;
            r.Phase = "fight";
            Toast(string.Format(GoLocalization.T("domain.echo_up", "🔮 {0} 이(가) 깨어났다"), r.Site.Name));
            Changed?.Invoke();
        }

        private bool WaveCleared()
        {
            foreach (var e in Current.Foes) if (e != null && e.Alive) return false;
            return true;
        }

        private void Despawn()
        {
            if (Current == null) return;
            foreach (var e in Current.Foes) if (e != null) { e.gameObject.SetActive(false); Destroy(e.gameObject); } // 끄면 곧장 들판 적 목록에서 빠진다(Destroy 는 프레임 끝)
            Current.Foes.Clear();
        }

        private void End(string msg)
        {
            Despawn();
            if (Current != null && Current.Tree != null) Destroy(Current.Tree);
            Current = null;
            LastEnd = msg;
            if (!string.IsNullOrEmpty(msg)) Toast(msg);
            Changed?.Invoke();
        }

        /// <summary>실패 — 원기는 안 쓴다.</summary>
        public bool Fail(string why)
        {
            if (Current == null) return false;
            End(string.Format(GoLocalization.T("domain.fail", "도전 실패 — {0}"), why));
            return true;
        }

        public bool Leave()
        {
            if (Current == null) return false;
            if (Current.Phase == "tree") { End(GoLocalization.T("domain.left_tree", "보상을 두고 숨은 터를 나왔다")); return true; }
            return Fail(GoLocalization.T("domain.why.left", "물러났다"));
        }

        private void OnWiped() { if (Current != null && Current.Phase != "tree") Fail(GoLocalization.T("domain.why.wiped", "모두 쓰러졌다")); }

        private void OnKilled(FieldEnemy e)
        {
            if (Current == null || Current.Site.Kind != GoDomain.Kind.School || !Current.Foes.Contains(e)) return;
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            foreach (var m in fc.Party) if (!m.Down) m.Energy = Mathf.Min(FieldCombat.BurstCost, m.Energy + GoDomain.LeyEnergy);
        }

        private void GrowTree()
        {
            var r = Current;
            r.Phase = "tree";
            Despawn();
            var root = new GameObject("DomainTree");
            root.transform.SetParent(transform, false);
            root.transform.position = SitePos(r.Site);
            Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 1.6f, 0f), new Vector3(0.6f, 1.6f, 0.6f), Mat("bark", new Color(0.35f, 0.24f, 0.15f), 0f));
            Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 4f, 0f), Vector3.one * 3.4f, Mat("tree", new Color(0.55f, 0.95f, 0.6f), 1.6f));
            r.Tree = root;
            AchieveState.Bump("domain"); // 109-14-25 업적 — 숨은 터 돌파
            Cleared?.Invoke(r.Site.Kind);
            Toast(string.Format(GoLocalization.T("domain.tree", "보상 나무가 자랐다 — 가운데로 가서 원기 {0} 쓰면 받는다"), DomainState.CostOf(r.Site.Kind)));
            Changed?.Invoke();
        }

        /// <summary>보상 나무 — 원기를 써서 받는다. 받았으면 알림 글, 아니면 null 과 까닭.</summary>
        public string Claim(out string why)
        {
            why = null;
            if (Current == null || Current.Phase != "tree") { why = GoLocalization.T("domain.why.no_tree", "보상 나무가 없다"); return null; }
            var k = Current.Site.Kind;
            int cost = DomainState.CostOf(k);
            if (!DomainState.Spend(cost)) { why = string.Format(GoLocalization.T("domain.why.resin", "원기가 모자라다({0}/{1})"), DomainState.Resin, cost); return null; }
            int seq = DomainState.MarkClaim(k);
            var r = GoDomain.RewardOf(k, Current.Stage, seq);
            r.Gold += Current.Site.Plus; // 109-14-69 — 11부 메아리는 금 +20(웹 `plus`)
            var parts = new List<string> { string.Format(GoLocalization.T("domain.gold", "금 +{0}"), r.Gold) };
            GoldState.Add(r.Gold);
            foreach (var (rarity, set) in r.Arts) parts.Add(GoArtifacts.Label(ArtifactState.Get(ArtifactState.Add(rarity, set))));
            if (r.Polish > 0) { ArtifactState.AddPolish(r.Polish); parts.Add(string.Format(GoLocalization.T("domain.polish", "연마석 +{0}"), r.Polish)); }
            if (r.Ore > 0) { WeaponState.AddOre(r.Ore); parts.Add(string.Format(GoLocalization.T("weapon.ore_plus", "강화석 +{0}"), r.Ore)); }
            string mats = TalentState.Add(r.Mats);
            if (mats.Length > 0) parts.Add(mats);
            string egg = EggState.Drop(k == GoDomain.Kind.Weekly || k == GoDomain.Kind.Echo ? "weekly" : "domain", $"{Current.Site.Name}|{Current.Stage}|{seq}"); // U-0046 신수 알
            if (egg.Length > 0) parts.Add(egg);
            string text = string.Format(GoLocalization.T("domain.claimed", "{0} {1} 보상 — 원기 {2} · {3}"), Current.Site.Name, GoDomain.Stages[Current.Stage].N, cost, string.Join(" · ", parts));
            End(text);
            return text;
        }

        private void Update()
        {
            _echoWait -= Time.deltaTime;
            if (_echoWait <= 0f) { _echoWait = 1f; RefreshEchoes(); }
            if (Current == null) return;
            Step(Time.deltaTime);
        }

        /// <summary>한 틱 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Step(float dt)
        {
            var r = Current;
            if (r == null) return;
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            r.T += dt;
            Vector3 d = fc.transform.position - SitePos(r.Site);
            d.y = 0f;
            float dist = d.magnitude;
            if (r.Phase == "tree")
            {
                if (dist > GoDomain.ArenaR * 1.5f) { End(GoLocalization.T("domain.left_tree", "보상을 두고 숨은 터를 나왔다")); return; }
                if (dist <= GoDomain.TreeR && !r.Asked) { r.Asked = true; Changed?.Invoke(); }
                return;
            }
            if (dist > GoDomain.ArenaR) { Fail(GoLocalization.T("domain.why.out", "원판을 벗어났다")); return; }
            if (r.Phase == "wait")
            {
                if (r.T >= GoDomain.StartDelay) SpawnWave(0);
                return;
            }
            r.FightT += dt;
            r.Left = GoDomain.LimitOf(r.Site.Kind) - r.FightT;
            if (r.Left <= 0f) { Fail(GoLocalization.T("domain.why.time", "시간이 다 됐다")); return; }
            if (r.Site.Kind == GoDomain.Kind.Tomb)
            {
                r.LeyT += dt;
                if (r.LeyT >= GoDomain.LeyWaterSec)
                {
                    r.LeyT = 0f;
                    foreach (var e in r.Foes) if (e != null) e.SoakAura(GoElement.Hydro, 5f);
                }
            }
            if (r.Site.Kind == GoDomain.Kind.Weekly && !r.P2)
            {
                foreach (var e in r.Foes)
                {
                    if (e == null || !e.Alive || !e.IsWeeklyBoss || e.Hp > e.MaxHp * GoDomain.P2At) continue;
                    r.P2 = true;
                    e.RaiseBossShield(GoElement.Electro, e.MaxHp * GoDomain.P2Shield);
                    e.CdMul = GoDomain.P2Cd;
                    Toast(GoLocalization.T("domain.boss_p2", "먹구름 이무기가 뇌 방패를 둘렀다 — 불·물로 깨라"));
                }
            }
            if (r.Site.Kind == GoDomain.Kind.Echo && !r.P2)
            {
                var stp = GoDomain.EchoBoss(r.Site.Id);
                foreach (var e in r.Foes)
                {
                    if (e == null || !e.Alive || !e.IsStoryBoss || e.Hp > e.MaxHp * GoDomain.P2At) continue;
                    r.P2 = true;
                    e.RaiseBossShield(stp.P2El, e.MaxHp * GoDomain.P2Shield);
                    Toast(string.Format(GoLocalization.T("domain.echo_p2", "🔮 {0} 이(가) 원소 방패를 둘렀다 — 상성 원소로 깨라"), e.DisplayName));
                }
            }
            if (WaveCleared())
            {
                if (r.Site.Kind == GoDomain.Kind.Echo) GrowTree();
                else if (r.Wave + 1 < GoDomain.Waves(r.Site.Kind).Length) SpawnWave(r.Wave + 1);
                else GrowTree();
            }
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 3f);
        }
    }
}
