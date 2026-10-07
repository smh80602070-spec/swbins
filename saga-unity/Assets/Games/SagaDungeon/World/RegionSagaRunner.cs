using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-6 지역 사연 사슬 — 웹 사가나락 §5.14 `quest.js`(chainOpen·stepField·onKill·regionboss:kill) 결(글·수치는 <see cref="DungeonRegionSagas"/>, 기록은 <see cref="RegionSagaState"/>).
    /// 들어섬 배너가 뜨면(`DungeonRegionTracker.RegionEntered`) 그 지역 사슬이 열린다(의뢰인·한 줄 사연). 걸음은 순서대로만 — 처치 한 번은 지금 걸음 하나에만 센다:
    /// ① 토벌 = 그 지역에서 쓰러진 적 누구든(처치 자리로 지역 판정, 우두머리는 제 지역) · ② 흔적 = 그 걸음일 때만 빛나는 흔적 1.6m 안 ·
    /// ③ 정예 = 정예 표시 적(사냥터 정예·우두머리 호위)·우두머리 · ④ 우두머리 = 그 지역 우두머리 — ④에 닿으면 우두머리 쉼을 지운다.
    /// 이 트랙 칸엔 들판 몬스터가 없어 ①·③ 걸음 동안 플레이어가 그 칸에 있으면 **사냥터**에 지역 무리가 선다(① 잡졸 셋 · ③ 남은 수만큼 정예, 지역 시대 몸·위험도 층),
    /// 다 쓰러지면 3초 뒤 다시, 칸을 떠나면 물러난다. 무작위 없음. 씬 빌더가 아니라 `GameBootstrap.Start()` → <see cref="Install"/>(Play 때).
    /// </summary>
    public class RegionSagaRunner : MonoBehaviour
    {
        public static RegionSagaRunner Instance { get; private set; }

        private readonly GameObject[] _clues = new GameObject[DungeonWorldMap.All.Length];
        private readonly GameObject[] _flags = new GameObject[DungeonWorldMap.All.Length];
        public bool FlagVisible(int r) => _flags[r] != null && _flags[r].activeSelf;
        private readonly List<DungeonEnemy> _pack = new List<DungeonEnemy>();
        private int _packRegion = -1;
        private float _respawnLeft;
        private Transform _player;
        private DungeonRegionTracker _tracker;
        private float _pulse;

        public const string SkeletonGruntKo = "해골 졸개";

        // 진단
        public int PackRegion => _packRegion;
        public List<DungeonEnemy> Pack() { Prune(); return new List<DungeonEnemy>(_pack); }
        public bool ClueVisible(int r) => _clues[r] != null && _clues[r].activeSelf;
        public Transform ClueOf(int r) => _clues[r] != null ? _clues[r].transform : null;
        public string LastMessage { get; private set; } = "";

        public static RegionSagaRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RegionSagaRunner").AddComponent<RegionSagaRunner>();
        }

        private void Awake()
        {
            Instance = this;
            var p = GameObject.FindWithTag("Player");
            _player = p != null ? p.transform : null;
            BuildClues();
            RefreshMarkers();
            DungeonEnemy.AnyDied += OnEnemyDied;
            RegionSagaState.Changed += RefreshMarkers;
        }

        /// <summary>흔적(② 걸음)·사냥터 깃발(①·③ 걸음)을 기록대로 켜고 끈다 — 기록이 바뀔 때마다(세이브 읽기 포함).</summary>
        private void RefreshMarkers()
        {
            for (int r = 0; r < _clues.Length; r++)
            {
                int st = RegionSagaState.Step(r);
                bool active = RegionSagaState.Active(r);
                if (_clues[r] != null && _clues[r].activeSelf != (active && st == 1)) _clues[r].SetActive(active && st == 1);
                bool flag = active && (st == 0 || st == 2);
                if (_flags[r] != null && _flags[r].activeSelf != flag) _flags[r].SetActive(flag);
            }
        }

        private void Start()
        {
            _tracker = DungeonRegionTracker.Instance;
            if (_tracker != null) _tracker.RegionEntered += OnRegionEntered;
        }

        private void OnDestroy()
        {
            DungeonEnemy.AnyDied -= OnEnemyDied;
            RegionSagaState.Changed -= RefreshMarkers;
            if (_tracker != null) _tracker.RegionEntered -= OnRegionEntered;
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (_player == null) return;
            Tick(_player.position, Time.deltaTime);
            _pulse += Time.deltaTime;
            float s = 1f + 0.15f * Mathf.Sin(_pulse * 3f);
            foreach (var c in _clues)
                if (c != null && c.activeSelf) c.transform.GetChild(1).localScale = Vector3.one * 0.3f * s;
        }

        /// <summary>한 번 — 흔적 표시·찾기, 사냥터 무리. 진단은 자리·시간을 넣어 부른다.</summary>
        public void Tick(Vector3 playerPos, float dt)
        {
            for (int r = 0; r < _clues.Length; r++)
                if (RegionSagaState.Active(r) && RegionSagaState.Step(r) == 1
                    && Flat(playerPos, DungeonRegionSagas.All[r].Clue) <= DungeonRegionSagas.ClueRadius) CompleteStep(r, found: true);

            int here = DungeonWorldMap.IndexAt(playerPos);
            Prune();
            if (_packRegion >= 0 && here != _packRegion) Withdraw();
            if (_respawnLeft > 0f) _respawnLeft -= dt;
            if (here < 0 || !RegionSagaState.Active(here)) return;
            int step = RegionSagaState.Step(here);
            if (step != 0 && step != 2) return;
            if (_pack.Count > 0 || _respawnLeft > 0f) return;
            if (DungeonCutscenes.Playing || TrialRunner.Busy) return;
            // 깃발을 밟아야 선다 — 칸에 들어서기만 해도 서면 시작 방(모루골)에서 곧장 붙는다(우두머리 표식과 같은 결).
            if (Flat(playerPos, DungeonRegionSagas.All[here].Hunt) > DungeonRegionFoes.SummonRadius) return;
            SpawnPack(here, step);
        }

        private void Prune()
        {
            for (int i = _pack.Count - 1; i >= 0; i--) if (_pack[i] == null || !_pack[i].IsAlive) _pack.RemoveAt(i);
            if (_pack.Count == 0 && _packRegion >= 0) { _packRegion = -1; _respawnLeft = DungeonRegionSagas.HuntRespawnSec; }
        }

        /// <summary>사냥터 무리를 물린다(칸을 떠남·진단).</summary>
        public void Withdraw()
        {
            foreach (var e in _pack) if (e != null && e.IsAlive) Destroy(e.gameObject);
            _pack.Clear();
            _packRegion = -1;
            _respawnLeft = 0f;
        }

        private void OnRegionEntered(int r)
        {
            if (!RegionSagaState.Open(r)) return;
            Say(string.Format(DungeonLocalization.T("saga.open", "📜 {0} — {1}: \"{2}\"\n다음: {3}"),
                DungeonRegionSagas.Title(r), DungeonRegionSagas.Giver(r), DungeonRegionSagas.Intro(r), DungeonRegionSagas.StepDesc(r, 0)), 6f);
        }

        /// <summary>처치 — 지금 걸음 하나에만 센다.</summary>
        private void OnEnemyDied(DungeonEnemy e)
        {
            if (e == null) return;
            var rb = RegionBossRunner.Instance;
            int bossOf = rb != null ? rb.RegionOf(e) : -1;
            int r = bossOf >= 0 ? bossOf : DungeonWorldMap.IndexAt(e.transform.position);
            if (r < 0 || !RegionSagaState.Active(r)) return;
            int step = RegionSagaState.Step(r);
            bool counts = step switch
            {
                0 => true,
                2 => e.IsElite || e.IsBoss,
                3 => bossOf == r,
                _ => false,
            };
            if (!counts) return;
            if (RegionSagaState.Add(r, DungeonRegionSagas.Need(r, step))) CompleteStep(r, found: false);
        }

        /// <summary>진단 — 처치 없이 지금 걸음을 채운다.</summary>
        public void ForceComplete(int r) => CompleteStep(r, found: RegionSagaState.Step(r) == 1);

        private void CompleteStep(int r, bool found)
        {
            if (!RegionSagaState.Active(r)) return;
            int step = RegionSagaState.Step(r);
            int gold = DungeonRegionSagas.RewardGold(r, step);
            int exp = DungeonRegionSagas.RewardExp(r, step);
            HeroState.AddGold(gold);
            HeroState.AddExp(exp);
            string msg = found
                ? string.Format(DungeonLocalization.T("saga.found", "🔍 {0} — {1}"), DungeonRegionSagas.Clue(r), DungeonRegionSagas.Found(r)) + "\n"
                : "";
            msg += string.Format(DungeonLocalization.T("saga.step_done", "📜 {0} — {1} 완료 (금 +{2} · 경험치 +{3})"),
                DungeonRegionSagas.Title(r), DungeonRegionSagas.StepName(step), gold, exp);

            if (RegionSagaState.Advance(r))
            {
                int merit = DungeonRegionSagas.MeritGold(r);
                HeroState.AddGold(merit);
                msg += "\n" + string.Format(DungeonLocalization.T("saga.pacified", "🏳 {0} 평정! — {1} (공적 +{2}냥)"),
                    DungeonWorldMap.Name(r), DungeonRegionSagas.Done(r), merit);
                if (RegionSagaState.TryCompleteAll())
                {
                    HeroState.AddGold(DungeonRegionSagas.AllGold + DungeonRegionSagas.AllMeritGold);
                    HeroState.AddExp(DungeonRegionSagas.AllExp);
                    msg += "\n" + string.Format(DungeonLocalization.T("saga.all", "🏳 구주 평정(九州平定)! — 금 +{0} · 경험치 +{1} · 공적 +{2}냥"),
                        DungeonRegionSagas.AllGold, DungeonRegionSagas.AllExp, DungeonRegionSagas.AllMeritGold);
                }
            }
            else
            {
                int next = RegionSagaState.Step(r);
                if (next == 3) RegionBossState.ClearRest(r); // 웹 — 쉬던 우두머리가 곧바로 다시 선다.
                msg += "\n" + string.Format(DungeonLocalization.T("saga.next", "다음: {0}"), DungeonRegionSagas.StepDesc(r, next));
            }
            Say(msg, 6f);
        }

        private void Say(string msg, float sec)
        {
            LastMessage = msg;
            DialogueLabel.Instance?.Show(msg, sec);
        }

        private void SpawnPack(int r, int step)
        {
            var floorRunner = DungeonFloorRunner.Instance;
            int f = DungeonRegionFoes.RegionFloor(r);
            string key = DungeonWorldMap.All[r].Key;
            Vector3 hunt = DungeonRegionSagas.All[r].Hunt;
            int n = step == 0 ? DungeonRegionSagas.HuntPack
                : Mathf.Max(1, DungeonRegionSagas.Need(r, 2) - RegionSagaState.Have(r));
            for (int i = 0; i < n; i++)
            {
                float a = i / (float)n * Mathf.PI * 2f;
                Vector3 pos = hunt + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * 1.8f;
                string era = DungeonRegionFoes.GuardEra(r, i);
                DungeonEnemy e;
                if (step == 2)
                {
                    RegionBossRunner.GuardLook(era, f, floorRunner, out var m, out var name, out var color, out var scale);
                    e = Spawn($"RegionHunt_{key}_{i}", pos, key, m, DungeonFormulas.EliteHp(f), DungeonFormulas.EliteDmg(f),
                        DungeonFormulas.EliteRewardExp(f), DungeonFormulas.EliteRewardGold(f), name, color, scale);
                    e.MarkElite();
                }
                else
                {
                    GruntLook(era, f, floorRunner, out var m, out var name, out var color, out var scale);
                    e = Spawn($"RegionHunt_{key}_{i}", pos, key, m, DungeonFormulas.EnemyHp(f, false), DungeonFormulas.EnemyDmg(f, false),
                        DungeonFormulas.RewardExp(f, false), DungeonFormulas.RewardGold(f, false), name, color, scale);
                }
                _pack.Add(e);
            }
            _packRegion = r;
        }

        /// <summary>사냥터 잡졸 몸 — 과거 황건적 · 현대/미래 그 층 단계 시대 적 · 신화 해골 졸개.</summary>
        public static void GruntLook(string era, int floor, DungeonFloorRunner floorRunner,
            out GameObject model, out string name, out Color color, out float scale)
        {
            model = floorRunner != null ? floorRunner.GruntModel : null;
            scale = 1f;
            switch (era)
            {
                case "modern":
                case "future":
                {
                    var e = era == "future" ? DungeonEra.Future : DungeonEra.Modern;
                    var foe = DungeonEras.FoeFor(floor, e);
                    name = foe.NameKo;
                    var body = floorRunner != null ? floorRunner.EraFoeBody(foe.Body) : (model: (GameObject)null, scale: 1f);
                    if (body.model != null) { model = body.model; scale = body.scale; color = Color.white; }
                    else color = e == DungeonEra.Future ? EraFusionData.FusionBodyColor : new Color(0.3f, 0.34f, 0.3f);
                    return;
                }
                case "myth":
                {
                    name = SkeletonGruntKo;
                    color = DungeonRegionFoes.SkeletonTint;
                    var sk = floorRunner != null ? floorRunner.RegionBody(DungeonRegionFoes.SkeletonBody) : null;
                    if (sk != null) { model = sk; scale = RegionBossRunner.ScaleFor(sk, 1.8f); }
                    return;
                }
                default:
                    name = "황건적";
                    color = new Color(0.72f, 0.64f, 0.3f);
                    return;
            }
        }

        private DungeonEnemy Spawn(string goName, Vector3 pos, string key, GameObject model, float hp, float dmg, int exp, int gold,
            string displayName, Color color, float scale)
        {
            var go = new GameObject(goName);
            go.SetActive(false);
            go.transform.SetParent(transform, false);
            go.transform.position = pos;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("region_hunt_" + key, model);
            e.ConfigureCombat(hp, dmg, exp, gold, null, null, false, displayName, color, scale);
            go.SetActive(true);
            return e;
        }

        /// <summary>HUD 한 줄 — 지금 칸의 사연이 걸음 중이면 "📜 제목 k/4 걸음 n/m"(흔적은 🔍 이름, 우두머리는 ☠ 이름), 아니면 빈 글.
        /// 긴 설명은 알림·M 지도에 — HUD 는 폭 700 한 줄이라 짧게(넘치면 목표판과 겹친다).</summary>
        public static string HudLine(int region)
        {
            if (region < 0 || !RegionSagaState.Active(region)) return "";
            int step = RegionSagaState.Step(region);
            string tail = step switch
            {
                1 => $" 🔍 {DungeonRegionSagas.Clue(region)}",
                3 => $" ☠ {DungeonRegionFoes.BossName(region)}",
                _ => $" {RegionSagaState.Have(region)}/{DungeonRegionSagas.Need(region, step)}",
            };
            return $"📜 {DungeonRegionSagas.Title(region)} {step + 1}/4 {DungeonRegionSagas.StepName(step)}{tail}";
        }

        /// <summary>M 지도 칸 머리 표 — 안 연 곳 ❔ · 흔적 걸음 🔍 · 평정 🏳 · 그 밖 📜.</summary>
        public static string MapMark(int r)
        {
            var e = RegionSagaState.Get(r);
            if (!e.opened) return "❔";
            if (e.done) return "🏳";
            return e.step == 1 ? "🔍" : "📜";
        }

        private void BuildClues()
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            var postMat = new Material(shader) { name = "SagaCluePost (generated)", color = new Color(0.32f, 0.26f, 0.18f) };
            var glowMat = new Material(shader) { name = "SagaClueGlow (generated)", color = new Color(1f, 0.85f, 0.4f) };
            glowMat.EnableKeyword("_EMISSION");
            glowMat.SetColor("_EmissionColor", new Color(1f, 0.8f, 0.3f) * 2f);
            for (int r = 0; r < _clues.Length; r++)
            {
                var root = new GameObject("SagaClue_" + DungeonWorldMap.All[r].Key);
                root.transform.SetParent(transform, false);
                root.transform.position = DungeonRegionSagas.All[r].Clue;
                var post = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                post.name = "Post";
                post.transform.SetParent(root.transform, false);
                post.transform.localPosition = new Vector3(0f, 0.3f, 0f);
                post.transform.localScale = new Vector3(0.35f, 0.3f, 0.35f);
                post.GetComponent<Renderer>().sharedMaterial = postMat;
                Destroy(post.GetComponent<Collider>());
                var glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                glow.name = "Glow";
                glow.transform.SetParent(root.transform, false);
                glow.transform.localPosition = new Vector3(0f, 0.85f, 0f);
                glow.transform.localScale = Vector3.one * 0.3f;
                glow.GetComponent<Renderer>().sharedMaterial = glowMat;
                Destroy(glow.GetComponent<Collider>());
                root.SetActive(false);
                _clues[r] = root;
            }

            // 사냥터 깃발 — 장대 + 붉은 천(①·③ 걸음일 때만).
            var poleMat = new Material(shader) { name = "SagaHuntPole (generated)", color = new Color(0.25f, 0.2f, 0.15f) };
            var clothMat = new Material(shader) { name = "SagaHuntCloth (generated)", color = new Color(0.75f, 0.12f, 0.1f) };
            for (int r = 0; r < _flags.Length; r++)
            {
                var root = new GameObject("SagaHunt_" + DungeonWorldMap.All[r].Key);
                root.transform.SetParent(transform, false);
                root.transform.position = DungeonRegionSagas.All[r].Hunt;
                var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pole.name = "Pole";
                pole.transform.SetParent(root.transform, false);
                pole.transform.localPosition = new Vector3(0f, 1.1f, 0f);
                pole.transform.localScale = new Vector3(0.08f, 1.1f, 0.08f);
                pole.GetComponent<Renderer>().sharedMaterial = poleMat;
                Destroy(pole.GetComponent<Collider>());
                var cloth = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cloth.name = "Cloth";
                cloth.transform.SetParent(root.transform, false);
                cloth.transform.localPosition = new Vector3(0.38f, 1.85f, 0f);
                cloth.transform.localScale = new Vector3(0.7f, 0.45f, 0.03f);
                cloth.GetComponent<Renderer>().sharedMaterial = clothMat;
                Destroy(cloth.GetComponent<Collider>());
                root.SetActive(false);
                _flags[r] = root;
            }
        }

        private static float Flat(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }
    }
}
