using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-3 시련(試鍊) — 웹 사가나락 §5.11 "대균열식 15분 시간 도전"(규칙·수치는 `TrialState`).
    /// 웹은 굴혈 선택 카드에서 단계를 골라 부적 던전 틀(방·문 하나) 위에서 도는데, 이 트랙엔 굴혈 카드·부적 층이
    /// 없어 **난입(5.5)과 같은 격리 방(HordeArena)** 을 쓴다 — 난입 표식 곁 시련 표식(`TrialGate`)을 밟으면 단계 카드
    /// (`TrialCardUi`, 열린 단계 위 셋·순위표 다섯)가 뜨고, 고르면 그 방으로 간다. 둘은 같은 방이라 동시에 못 연다.
    ///
    /// 방 안: 살아 있는 적이 셋 밑이면 무리(잡졸 넷 + 정예 하나)를 새로 부른다. 잡졸 넷은 과거 황건적·현대·미래 시대
    /// 적(`DungeonEras` 제10층 단계 몸) 과거·현대·미래·과거, 정예는 무리마다 번갈아 과거 황건 정예 / 미래 기계화 정찰병
    /// (§13 세 시대 한 자리). 처치 진척 잡졸 3·정예 8 → 100 이면 그 자리에 수호자(층 주인 몸, 층 두목 공식 × 1.15).
    /// 적은 제10층 공식 × (1 + 0.35 × 단계). 시계는 컷 동안 멈춘다. 쓰러지면 −30초·그 자리에서 일어선다(유품 없음).
    /// 완주 = 순위표·열린 단계(절반 넘게 남기면 +2)·전설 한 점(웹 "비전 붙은 전설" → 명소 무기 여섯 중 하나, §5.10) +
    /// 공적 6+단계(이 판엔 공적 화폐가 없어 × 50 냥). 시간 초과 = 기록 없이 돌아간다.
    ///
    /// 씬 빌더가 아니라 `GameBootstrap.Start()` → <see cref="Install"/> 이 Play 때 붙인다(씬 재빌드는 컷 타임라인 ID 를
    /// 다시 쓴다). 난입 방이 없는 씬이면 아무것도 안 한다.
    /// </summary>
    public class TrialRunner : MonoBehaviour
    {
        public const string RoomId = "trial";
        public const int RefillBelow = 3;
        public const int PackGrunts = 4;
        public const float GuardianHpMul = 1.15f;
        public const int GoldPerMerit = 50;
        private static readonly Vector3 EntryOffset = new Vector3(0f, 0f, -8f);
        private static readonly Vector3 GateOffset = new Vector3(0f, 0f, 5f); // 난입 표식(8,-8) 북쪽 5m — 둘의 반경 2m 가 안 겹친다.
        private static readonly DungeonEra[] SlotEras = { DungeonEra.Past, DungeonEra.Modern, DungeonEra.Future, DungeonEra.Past };
        private static readonly string[] LoreRewards = { "wp_lm_tomb", "wp_lm_fort", "wp_lm_bandit", "wp_lm_palace", "wp_lm_hellgate", "wp_lm_cloud" };

        public static TrialRunner Instance { get; private set; }
        public static bool Busy => Instance != null && Instance.IsActive;

        public bool IsActive { get; private set; }
        public int Stage { get; private set; }
        public float TimeLeft { get; private set; }
        public int Progress { get; private set; }
        public int Deaths { get; private set; }
        public int Packs { get; private set; }
        public DungeonEnemy Guardian { get; private set; }
        public bool GuardianUp => Guardian != null;

        // 진단 — 마지막 판 결과.
        public bool LastCleared { get; private set; }
        public int LastRank { get; private set; }
        public string LastRewardId { get; private set; }
        public int LastGold { get; private set; }

        private readonly Dictionary<DungeonEnemy, int> _points = new Dictionary<DungeonEnemy, int>();
        private readonly List<DungeonEnemy> _live = new List<DungeonEnemy>();
        private System.Random _rng;
        private Transform _player;
        private CharacterController _playerController;
        private Vector3 _returnPos;

        /// <summary>`GameBootstrap.Start()` 가 부른다 — 러너(난입 방에)·표식·카드를 한 번만.</summary>
        public static void Install()
        {
            var horde = HordeRunner.Instance;
            if (horde == null) return;
            if (Instance == null) horde.gameObject.AddComponent<TrialRunner>();
            var hordeGate = UnityEngine.Object.FindFirstObjectByType<HordeGate>();
            if (hordeGate != null && UnityEngine.Object.FindFirstObjectByType<TrialGate>() == null)
            {
                var g = new GameObject("TrialGate");
                g.transform.position = hordeGate.transform.position + GateOffset;
                g.AddComponent<TrialGate>();
            }
            if (TrialCardUi.Instance == null) new GameObject("TrialCardUI").AddComponent<TrialCardUi>();
        }

        private void Awake()
        {
            Instance = this;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _playerController = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
        }

        private void OnDestroy()
        {
            if (IsActive) Unhook();
            if (Instance == this) Instance = null;
        }

        /// <summary>단계 카드가 부른다. 이미 시련·난입 중이거나 안 열린 단계면 false.</summary>
        public bool StartRun(int stage, Vector3 returnPos)
        {
            if (IsActive || _player == null) return false;
            if (HordeRunner.Instance != null && HordeRunner.Instance.IsActive) return false;
            if (stage < 1 || stage > TrialState.Open) return false;

            IsActive = true;
            Stage = stage;
            TimeLeft = TrialState.TrialSec;
            Progress = 0;
            Deaths = 0;
            Packs = 0;
            Guardian = null;
            _points.Clear();
            _live.Clear();
            _rng = new System.Random(20260824 + stage); // 진단 씨앗 관례 + 단계.
            _returnPos = returnPos;
            LastCleared = false;
            LastRank = 0;
            LastRewardId = null;
            LastGold = 0;

            HeroState.GraveSuppressed = true;
            HeroState.Died += OnHeroDied;
            DungeonEnemy.AnyDied += OnEnemyDied;

            Teleport(transform.TransformPoint(EntryOffset));
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("trial.start",
                "시련 {0}단계 — 15분 안에 진척 100 을 채우고 수호자를 쓰러뜨려라 (적 ×{1:0.00})"), stage, TrialState.EnemyMul(stage)), 4f);
            SpawnPack();
            return true;
        }

        private void Update()
        {
            if (!IsActive || DungeonCutscenes.Playing) return;
            Tick(Time.deltaTime);
        }

        /// <summary>한 프레임 — 시계·무리 보충. 헤드리스 진단은 시간을 직접 넣는다.</summary>
        public void Tick(float dt)
        {
            if (!IsActive) return;
            TimeLeft -= dt;
            if (TimeLeft <= 0f)
            {
                TimeLeft = 0f;
                EndRun(false);
                return;
            }
            if (!GuardianUp && Progress < TrialState.Goal && AliveCount() < RefillBelow) SpawnPack();
        }

        public int AliveCount()
        {
            int n = 0;
            for (int i = _live.Count - 1; i >= 0; i--)
            {
                if (_live[i] == null || !_live[i].IsAlive) { _live.RemoveAt(i); continue; }
                n++;
            }
            return n;
        }

        /// <summary>진단 — 지금 방에 산 시련 적.</summary>
        public List<DungeonEnemy> LiveEnemies()
        {
            AliveCount();
            return new List<DungeonEnemy>(_live);
        }

        private void SpawnPack()
        {
            var floorRunner = DungeonFloorRunner.Instance;
            float mul = TrialState.EnemyMul(Stage);
            int f = TrialState.BaseFloor;
            double turn = _rng.NextDouble() * Math.PI * 2.0;
            for (int i = 0; i < PackGrunts; i++)
            {
                var era = SlotEras[i];
                GameObject model = floorRunner != null ? floorRunner.GruntModel : null;
                float scale = 1f;
                string name = "황건적";
                Color color = new Color(0.72f, 0.64f, 0.3f);
                if (era != DungeonEra.Past)
                {
                    var foe = DungeonEras.FoeFor(f, era);
                    name = foe.NameKo;
                    var body = floorRunner != null ? floorRunner.EraFoeBody(foe.Body) : (model: (GameObject)null, scale: 1f);
                    if (body.model != null) { model = body.model; scale = body.scale; color = Color.white; }
                    else color = era == DungeonEra.Future ? EraFusionData.FusionBodyColor : new Color(0.3f, 0.34f, 0.3f);
                }
                var e = Spawn($"Enemy_Trial_{era}", Ring(turn, i, PackGrunts + 1, 6f), model,
                    DungeonFormulas.EnemyHp(f, false) * mul, DungeonFormulas.EnemyDmg(f, false) * mul,
                    DungeonFormulas.RewardExp(f, false), DungeonFormulas.RewardGold(f, false), false, name, color, scale);
                _points[e] = TrialState.GruntPoints;
            }

            bool mech = Packs % 2 == 1;
            GameObject eliteModel = floorRunner != null ? floorRunner.GruntModel : null;
            float eliteScale = 1f;
            Color eliteColor = new Color(0.75f, 0.35f, 0.15f);
            if (mech)
            {
                var body = floorRunner != null ? floorRunner.FusionEliteBody : (model: (GameObject)null, scale: 1f);
                if (body.model != null) { eliteModel = body.model; eliteScale = body.scale; eliteColor = Color.white; }
                else eliteColor = EraFusionData.FusionBodyColor;
            }
            var elite = Spawn("Enemy_Trial_Elite", Ring(turn, PackGrunts, PackGrunts + 1, 6f), eliteModel,
                DungeonFormulas.EliteHp(f) * mul, DungeonFormulas.EliteDmg(f) * mul,
                DungeonFormulas.EliteRewardExp(f), DungeonFormulas.EliteRewardGold(f), false,
                mech ? "기계화 정찰병" : "폐허의 황건 정예", eliteColor, 1.25f * eliteScale);
            _points[elite] = TrialState.ElitePoints;
            Packs++;
        }

        private void SpawnGuardian()
        {
            var floorRunner = DungeonFloorRunner.Instance;
            float mul = TrialState.EnemyMul(Stage);
            int f = TrialState.BaseFloor;
            var body = floorRunner != null ? floorRunner.LordBody : (model: (GameObject)null, scale: 1f);
            bool demon = body.model != null;
            var model = demon ? body.model : floorRunner != null ? floorRunner.EliteModel : null;
            var guardianColor = new Color(0.45f, 0.3f, 0.75f);
            Guardian = Spawn("Enemy_Trial_Guardian", new Vector3(0f, 0f, 3f), model,
                DungeonFormulas.EnemyHp(f, true) * GuardianHpMul * mul, DungeonFormulas.EnemyDmg(f, true) * mul,
                DungeonFormulas.RewardExp(f, true), DungeonFormulas.RewardGold(f, true), true,
                "시련의 수호자", demon ? Color.Lerp(Color.white, guardianColor, DungeonFloorRunner.LordTintMix) : guardianColor,
                2.1f * body.scale, subtitle: DungeonLocalization.T("trial.guardian_sub", "시련의 끝 — 쓰러뜨리면 완주"));
            DialogueLabel.Instance?.Show(DungeonLocalization.T("trial.guardian", "진척 100 — 시련의 수호자가 나타났다!"), 3f);
        }

        private DungeonEnemy Spawn(string goName, Vector3 localPos, GameObject model, float hp, float dmg, int exp, int gold,
            bool boss, string displayName, Color color, float scale, string subtitle = null)
        {
            var go = new GameObject(goName);
            go.SetActive(false);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localPos;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext(RoomId, model);
            e.ConfigureCombat(hp, dmg, exp, gold, null, null, boss, displayName, color, scale);
            if (subtitle != null) e.SetIntroSubtitle(subtitle);
            go.SetActive(true);
            _live.Add(e);
            return e;
        }

        private static Vector3 Ring(double turn, int i, int n, float r)
        {
            double a = turn + i * (Math.PI * 2.0 / n);
            return new Vector3((float)Math.Cos(a) * r, 0f, (float)Math.Sin(a) * r + 2f); // +2 — 남쪽 들어오는 자리(-8)와 떨어지게.
        }

        private void OnEnemyDied(DungeonEnemy e)
        {
            if (!IsActive || e == null || e.RoomId != RoomId) return;
            if (e == Guardian) { EndRun(true); return; }
            if (!_points.TryGetValue(e, out int pts)) return;
            _points.Remove(e);
            Progress = Math.Min(TrialState.Goal, Progress + pts);
            if (Progress >= TrialState.Goal && !GuardianUp) SpawnGuardian();
        }

        private void OnHeroDied(int lostGold)
        {
            if (!IsActive) return;
            Deaths++;
            TimeLeft = Mathf.Max(0f, TimeLeft - TrialState.DeathPenaltySec);
            DialogueLabel.Instance?.Show(DungeonLocalization.T("trial.death", "쓰러졌다 — 시계 −30초, 그 자리에서 다시 일어선다"), 3f);
        }

        private void Unhook()
        {
            HeroState.GraveSuppressed = false;
            HeroState.Died -= OnHeroDied;
            DungeonEnemy.AnyDied -= OnEnemyDied;
        }

        /// <summary>완주(cleared) 또는 시간 초과. 방을 비우고 원래 자리로 돌려보낸 뒤 카드.</summary>
        private void EndRun(bool cleared)
        {
            IsActive = false;
            Unhook();
            foreach (var e in _live) if (e != null) Destroy(e.gameObject);
            _live.Clear();
            _points.Clear();
            Guardian = null;
            HeroState.FullHeal();
            Teleport(_returnPos);

            var card = UnityEngine.Object.FindFirstObjectByType<SessionCard>();
            if (!cleared)
            {
                TrialState.RecordTimeout();
                card?.Show(DungeonLocalization.T("trial.card_timeout", "시련 — 시간이 다 됐다"),
                    string.Format(DungeonLocalization.T("trial.card_progress", "{0}단계 · 진척 {1}/100 · 쓰러짐 {2}"), Stage, Progress, Deaths),
                    DungeonLocalization.T("trial.card_timeout_note", "기록 없음 — 주운 것만 남는다"));
                return;
            }

            int openBefore = TrialState.Open;
            LastCleared = true;
            LastRank = TrialState.RecordClear(Stage, TimeLeft, Deaths, HeroState.Level, DateTime.Now.ToString("yyyy-MM-dd"));
            LastGold = (6 + Stage) * GoldPerMerit;
            HeroState.AddGold(LastGold);
            LastRewardId = LoreRewards[(int)(DungeonEras.Hash($"trial:{TrialState.Runs}:{Stage}") % (uint)LoreRewards.Length)];
            bool equipped = HeroState.EquipIfBetter(LastRewardId);
            var item = ItemData.Get(LastRewardId);
            if (_player != null) LootMarker.Spawn(_player.position + _player.forward * 1.5f, LootMarker.PillarUnique);

            int used = (int)Math.Round(TrialState.TrialSec - TimeLeft);
            string rankLine = LastRank > 0
                ? string.Format(DungeonLocalization.T("trial.card_rank", "순위표 {0}위 · 열린 단계 {1} → {2}"), LastRank, openBefore, TrialState.Open)
                : string.Format(DungeonLocalization.T("trial.card_norank", "순위표 밖 · 열린 단계 {0} → {1}"), openBefore, TrialState.Open);
            string lootLine = string.Format(DungeonLocalization.T(equipped ? "trial.card_loot_equipped" : "trial.card_loot",
                equipped ? "{0} — 바로 갖췄다 · 금 {1}" : "{0} · 금 {1}"), item != null ? item.Name : LastRewardId, LastGold);
            if (item != null && item.Lore != Secret.None) lootLine += "\n" + SecretState.LoreLine(item.Lore);
            card?.Show(string.Format(DungeonLocalization.T("trial.card_clear", "시련 {0}단계 완주!"), Stage),
                string.Format(DungeonLocalization.T("trial.card_time", "{0}:{1:00} · 쓰러짐 {2}"), used / 60, used % 60, Deaths),
                rankLine, lootLine);
        }

        private void Teleport(Vector3 worldPos)
        {
            if (_player == null) return;
            if (_playerController != null) _playerController.enabled = false;
            _player.position = worldPos;
            if (_playerController != null) _playerController.enabled = true;
        }

        /// <summary>HUD 한 줄(시련 중이 아니면 빈 글) — 1분 미만이면 시계를 붉게.</summary>
        public static string HudLine()
        {
            if (!Busy) return "";
            var r = Instance;
            int t = Mathf.CeilToInt(r.TimeLeft);
            string clock = $"{t / 60}:{t % 60:00}";
            if (r.TimeLeft < 60f) clock = $"<color=#ff5a5a>{clock}</color>";
            string tail = r.GuardianUp
                ? DungeonLocalization.T("trial.hud_guardian", "수호자!")
                : string.Format(DungeonLocalization.T("trial.hud_progress", "진척 {0}/100"), r.Progress);
            return string.Format(DungeonLocalization.T("trial.hud", "시련 {0}단계 {1} · {2}"), r.Stage, clock, tail);
        }
    }
}
