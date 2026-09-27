using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-5 지역 우두머리 아홉 — 웹 사가블로 §5.13 `stepRegionBoss`·`grantRegionBossReward` 결(수치·규칙은 <see cref="DungeonRegionFoes"/>).
    /// 칸마다 고정 표식(검은 돌기둥 + 우두머리 빛 구슬) 하나. 4m 안에 들면 한 번 알림(위험도·밟으면 선다 / 쉬는 중이면 남은 분),
    /// 표식을 밟으면 우두머리(빌린 몸·키 2.8m)가 호위 정예 셋(지역 시대대로)과 선다 — 등장 컷은 두목급 결대로(세션에 이름마다 한 번, 부제 = 웹 사연).
    /// 플레이어가 표식에서 18m 멀어지면 무리가 제자리로 물러난다(쓰러뜨린 게 아니라 쉼 없음 — 이 판 적 이동은 벽을 안 봐 끝없이 쫓는다).
    /// 우두머리를 쓰러뜨리면 기록(세이브 v13)·공적 금, 10분(실제 시각) 쉬는 동안 표식이 흐려진다. 전설·홍옥·금·경험치는 적 쪽 보상(`DungeonEnemy.Die`).
    /// 씬 빌더가 아니라 `GameBootstrap.Start()` → <see cref="Install"/> 이 Play 때 붙인다(몸만 층 진행기에 실려 있다).
    /// </summary>
    public class RegionBossRunner : MonoBehaviour
    {
        public static RegionBossRunner Instance { get; private set; }

        private sealed class Group
        {
            public DungeonEnemy Boss;
            public readonly List<DungeonEnemy> Guards = new List<DungeonEnemy>();
        }

        private readonly Group[] _groups = new Group[DungeonWorldMap.All.Length];
        private readonly bool[] _noticed = new bool[DungeonWorldMap.All.Length];
        private readonly Renderer[] _gems = new Renderer[DungeonWorldMap.All.Length];
        private readonly bool[] _gemDim = new bool[DungeonWorldMap.All.Length];
        private static readonly Dictionary<GameObject, float> Heights = new Dictionary<GameObject, float>();
        private static readonly Color StoneColor = new Color(0.16f, 0.15f, 0.16f);
        private static readonly Color DimColor = new Color(0.3f, 0.3f, 0.32f);
        private MaterialPropertyBlock _block;
        private Transform _player;

        // 진단
        public int LastKilled { get; private set; } = -1;
        public bool LastFirst { get; private set; }
        public int LastMerit { get; private set; }

        public static RegionBossRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RegionBossRunner").AddComponent<RegionBossRunner>();
        }

        private void Awake()
        {
            Instance = this;
            var p = GameObject.FindWithTag("Player");
            _player = p != null ? p.transform : null;
            _block = new MaterialPropertyBlock();
            BuildMarkers();
            DungeonEnemy.AnyDied += OnEnemyDied;
        }

        private void OnDestroy()
        {
            DungeonEnemy.AnyDied -= OnEnemyDied;
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (_player != null) Tick(_player.position);
        }

        /// <summary>한 번 — 끈·알림·밟기·표식 빛. 진단은 자리를 넣어 부른다.</summary>
        public void Tick(Vector3 playerPos)
        {
            for (int r = 0; r < _groups.Length; r++)
            {
                Vector3 spot = DungeonRegionFoes.Bosses[r].Spot;
                float d = Flat(playerPos, spot);
                bool bossUp = IsUp(r);
                if (AnyAlive(r))
                {
                    // 우두머리가 쓰러져도 호위는 남아 싸우고, 멀어지면 같이 물러난다.
                    if (d > DungeonRegionFoes.LeashRadius) Withdraw(r, toast: bossUp);
                    if (bossUp) continue;
                }
                else _groups[r] = null;
                bool resting = RegionBossState.IsResting(r);
                SetGemDim(r, resting);
                if (d <= DungeonRegionFoes.NoticeRadius && !_noticed[r])
                {
                    _noticed[r] = true;
                    DialogueLabel.Instance?.Show(NoticeText(r), 4f);
                }
                if (d <= DungeonRegionFoes.SummonRadius && !resting && CanSummon()) Summon(r);
            }
        }

        private static bool CanSummon()
        {
            if (DungeonCutscenes.Playing || TrialRunner.Busy) return false;
            return HordeRunner.Instance == null || !HordeRunner.Instance.IsActive;
        }

        public static string NoticeText(int r)
        {
            string name = DungeonRegionFoes.BossName(r);
            if (RegionBossState.IsResting(r))
                return string.Format(DungeonLocalization.T("rboss.notice_rest", "☠ {0} — 쉬는 중 (다시 서기까지 {1}분)"),
                    name, Mathf.CeilToInt((float)RegionBossState.RestLeft(r) / 60f));
            return string.Format(DungeonLocalization.T("rboss.notice", "☠ 지역 우두머리 {0}의 자리 — {1} · 표식을 밟으면 나타난다"),
                name, DungeonRegionFoes.DangerLabel(r));
        }

        /// <summary>그 지역 우두머리가 서 있나.</summary>
        public bool IsUp(int r) => _groups[r] != null && _groups[r].Boss != null && _groups[r].Boss.IsAlive;

        private bool AnyAlive(int r)
        {
            var g = _groups[r];
            if (g == null) return false;
            if (g.Boss != null && g.Boss.IsAlive) return true;
            foreach (var e in g.Guards) if (e != null && e.IsAlive) return true;
            return false;
        }
        public DungeonEnemy BossOf(int r) => _groups[r]?.Boss;

        /// <summary>이 적이 어느 지역 우두머리인가(-1 = 아님) — PLAN.md 109-10-6 사연 ④ 걸음이 본다(쓰러진 뒤에도 다음 Tick 까지는 붙들고 있다).</summary>
        public int RegionOf(DungeonEnemy e)
        {
            if (e == null) return -1;
            for (int r = 0; r < _groups.Length; r++) if (_groups[r] != null && _groups[r].Boss == e) return r;
            return -1;
        }
        public List<DungeonEnemy> GuardsOf(int r) => _groups[r] != null ? new List<DungeonEnemy>(_groups[r].Guards) : new List<DungeonEnemy>();
        public Transform Marker(int r) => transform.Find("RegionBossMark_" + DungeonWorldMap.All[r].Key);
        public bool GemDim(int r) => _gemDim[r];
        public bool Noticed(int r) => _noticed[r];

        /// <summary>진단 — 알림·표식 상태를 비운다.</summary>
        public void ResetNotices()
        {
            for (int i = 0; i < _noticed.Length; i++) _noticed[i] = false;
        }

        /// <summary>표식을 밟았다 — 우두머리 + 호위 셋.</summary>
        public void Summon(int r)
        {
            if (IsUp(r)) return;
            if (_groups[r] != null) Withdraw(r, toast: false); // 앞 판 호위가 남았으면 치운다.
            var floorRunner = DungeonFloorRunner.Instance;
            var b = DungeonRegionFoes.Bosses[r];
            string key = DungeonWorldMap.All[r].Key;
            int lv = DungeonRegionFoes.BossFloor(r);
            var g = new Group();
            _groups[r] = g;

            GameObject body = floorRunner != null ? floorRunner.RegionBody(b.Body) : null;
            GameObject model = body != null ? body : floorRunner != null ? floorRunner.EliteModel : null;
            bool rigged = model != null && model.GetComponent<Animator>() != null;
            Color color = rigged ? Color.Lerp(Color.white, b.Color, DungeonRegionFoes.TintMix) : b.Color;
            g.Boss = Spawn($"RegionBoss_{key}", b.Spot, key, model,
                DungeonRegionFoes.BossHp(r), DungeonRegionFoes.BossDmg(r),
                DungeonFormulas.RewardExp(lv, true), DungeonRegionFoes.BossGold(r),
                DungeonRegionFoes.LegendFor(r, RegionBossState.Kills(r)), DungeonRegionFoes.GemReward, true,
                b.NameKo, color, ScaleFor(model, DungeonRegionFoes.BossHeight), DungeonRegionFoes.BossDesc(r));

            // 호위는 표식에서 방 안쪽(방 가운데 쪽)으로 부채꼴 — 표식이 벽 가라 둘레로 펴면 벽 밖에 선다.
            Vector3 inward = DungeonRegionFoes.RoomCenterOf(b.Spot) - b.Spot;
            inward.y = 0f;
            inward = inward.sqrMagnitude > 0.01f ? inward.normalized : Vector3.forward;
            for (int i = 0; i < DungeonRegionFoes.Guards; i++)
            {
                float yaw = (i - (DungeonRegionFoes.Guards - 1) * 0.5f) * DungeonRegionFoes.GuardFanDeg;
                Vector3 pos = b.Spot + Quaternion.Euler(0f, yaw, 0f) * inward * DungeonRegionFoes.GuardRing;
                GuardLook(DungeonRegionFoes.GuardEra(r, i), lv, floorRunner, out var gm, out var gName, out var gColor, out var gScale);
                var guard = Spawn($"RegionGuard_{key}_{i}", pos, key, gm,
                    DungeonFormulas.EliteHp(lv), DungeonFormulas.EliteDmg(lv),
                    DungeonFormulas.EliteRewardExp(lv), DungeonFormulas.EliteRewardGold(lv), null, null, false,
                    gName, gColor, gScale, null);
                guard.MarkElite(); // PLAN.md 109-10-6 사연 ③ 정예 걸음이 센다.
                g.Guards.Add(guard);
            }
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("rboss.appear", "☠ {0} — {1} · {2}"),
                DungeonRegionFoes.BossName(r), DungeonRegionFoes.BossDesc(r), DungeonRegionFoes.DangerLabel(r)), 4f);
        }

        /// <summary>호위 몸 — 과거 황건 정예 · 현대/미래 그 층 단계 시대 적 · 신화 해골 무사.</summary>
        public static void GuardLook(string era, int floor, DungeonFloorRunner floorRunner,
            out GameObject model, out string name, out Color color, out float scale)
        {
            GameObject grunt = floorRunner != null ? floorRunner.GruntModel : null;
            model = grunt;
            scale = 1.25f;
            switch (era)
            {
                case "modern":
                case "future":
                {
                    var e = era == "future" ? DungeonEra.Future : DungeonEra.Modern;
                    var foe = DungeonEras.FoeFor(floor, e);
                    name = foe.NameKo;
                    var body = floorRunner != null ? floorRunner.EraFoeBody(foe.Body) : (model: (GameObject)null, scale: 1f);
                    if (body.model != null) { model = body.model; scale = 1.25f * body.scale; color = Color.white; }
                    else color = e == DungeonEra.Future ? EraFusionData.FusionBodyColor : new Color(0.3f, 0.34f, 0.3f);
                    return;
                }
                case "myth":
                {
                    name = DungeonRegionFoes.SkeletonNameKo;
                    var sk = floorRunner != null ? floorRunner.RegionBody(DungeonRegionFoes.SkeletonBody) : null;
                    if (sk != null) { model = sk; color = DungeonRegionFoes.SkeletonTint; scale = ScaleFor(sk, DungeonRegionFoes.GuardHeight); }
                    else color = DungeonRegionFoes.SkeletonTint;
                    return;
                }
                default:
                    name = DungeonRegionFoes.PastEliteName;
                    color = DungeonRegionFoes.PastEliteColor;
                    return;
            }
        }

        private DungeonEnemy Spawn(string goName, Vector3 pos, string key, GameObject model, float hp, float dmg, int exp, int gold,
            string itemId, string gemId, bool boss, string displayName, Color color, float scale, string subtitle)
        {
            var go = new GameObject(goName);
            go.SetActive(false);
            go.transform.SetParent(transform, false);
            go.transform.position = pos;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("region_" + key, model);
            e.ConfigureCombat(hp, dmg, exp, gold, itemId, gemId, boss, displayName, color, scale);
            if (subtitle != null) e.SetIntroSubtitle(subtitle);
            go.SetActive(true);
            return e;
        }

        /// <summary>키 맞춤 배율 — 리깅 몸은 실제 키를 재서(한 번, 몸마다), 그 밖(도형·Kenney)은 `DungeonEnemy` 의 2m 기준.</summary>
        public static float ScaleFor(GameObject model, float targetHeight)
        {
            if (model == null || model.GetComponent<Animator>() == null) return targetHeight / 2f;
            if (!Heights.TryGetValue(model, out float h))
            {
                var inst = Instantiate(model, new Vector3(0f, -500f, 0f), Quaternion.identity);
                h = 0f;
                var rs = inst.GetComponentsInChildren<Renderer>();
                if (rs.Length > 0)
                {
                    var bounds = rs[0].bounds;
                    foreach (var rr in rs) bounds.Encapsulate(rr.bounds);
                    h = bounds.size.y;
                }
                DestroyImmediate(inst);
                Heights[model] = h;
            }
            return h > 0.5f ? targetHeight / h : 1f;
        }

        /// <summary>무리가 제자리로 — 쓰러뜨린 게 아니니 기록·쉼 없음.</summary>
        public void Withdraw(int r, bool toast)
        {
            var g = _groups[r];
            _groups[r] = null;
            _noticed[r] = false;
            if (g == null) return;
            if (g.Boss != null && g.Boss.IsAlive) Destroy(g.Boss.gameObject);
            foreach (var e in g.Guards) if (e != null && e.IsAlive) Destroy(e.gameObject);
            if (toast)
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("rboss.withdraw", "{0}이(가) 제자리로 물러났다"),
                    DungeonRegionFoes.BossName(r)), 3f);
        }

        private void OnEnemyDied(DungeonEnemy e)
        {
            if (e == null) return;
            for (int r = 0; r < _groups.Length; r++)
            {
                if (_groups[r] == null || _groups[r].Boss != e) continue;
                bool first = RegionBossState.RecordKill(r);
                int merit = DungeonRegionFoes.MeritGold(r);
                HeroState.AddGold(merit);
                LastKilled = r;
                LastFirst = first;
                LastMerit = merit;
                _noticed[r] = false;
                SetGemDim(r, true);
                string line = string.Format(DungeonLocalization.T(first ? "rboss.kill_first" : "rboss.kill",
                    first ? "🏆 {0} 첫 토벌! — 공적 +{1}냥 · 10분 뒤 다시 선다" : "🏆 {0} 토벌 — 공적 +{1}냥 · 10분 뒤 다시 선다"),
                    DungeonRegionFoes.BossName(r), merit);
                var label = DialogueLabel.Instance;
                if (label != null)
                {
                    string prev = label.CurrentText;
                    label.Show(prev.Length > 0 ? line + "\n" + prev : line, 6f);
                }
                return;
            }
        }

        private void BuildMarkers()
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            var stoneMat = new Material(shader) { name = "RegionBossStone (generated)", color = StoneColor };
            for (int r = 0; r < DungeonRegionFoes.Bosses.Length; r++)
            {
                var b = DungeonRegionFoes.Bosses[r];
                var root = new GameObject("RegionBossMark_" + DungeonWorldMap.All[r].Key);
                root.transform.SetParent(transform, false);
                root.transform.position = b.Spot;

                var stone = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                stone.name = "Stone";
                stone.transform.SetParent(root.transform, false);
                stone.transform.localPosition = new Vector3(0f, 0.8f, 0f);
                stone.transform.localScale = new Vector3(0.55f, 0.8f, 0.55f);
                stone.GetComponent<Renderer>().sharedMaterial = stoneMat;
                Destroy(stone.GetComponent<Collider>());

                var gem = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                gem.name = "Gem";
                gem.transform.SetParent(root.transform, false);
                gem.transform.localPosition = new Vector3(0f, 1.95f, 0f);
                gem.transform.localScale = Vector3.one * 0.42f;
                var gemMat = new Material(shader) { name = "RegionBossGem (generated)" };
                gemMat.EnableKeyword("_EMISSION");
                gem.GetComponent<Renderer>().sharedMaterial = gemMat;
                Destroy(gem.GetComponent<Collider>());
                _gems[r] = gem.GetComponent<Renderer>();
                _gemDim[r] = true; // 아래에서 한 번 칠하게 반대로 둔다.
                SetGemDim(r, false);
            }
        }

        /// <summary>표식 구슬 — 서 있을 수 있으면 우두머리 빛(밝게), 쉬는 중이면 잿빛.</summary>
        private void SetGemDim(int r, bool dim)
        {
            if (_gemDim[r] == dim || _gems[r] == null) return;
            _gemDim[r] = dim;
            var c = dim ? DimColor : Color.Lerp(DungeonRegionFoes.Bosses[r].Color, Color.white, 0.3f);
            _gems[r].GetPropertyBlock(_block);
            _block.SetColor("_BaseColor", c);
            _block.SetColor("_EmissionColor", dim ? Color.black : c * 1.6f);
            _gems[r].SetPropertyBlock(_block);
        }

        private static float Flat(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }
    }
}
