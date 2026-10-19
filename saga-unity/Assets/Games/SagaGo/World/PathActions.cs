using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0130 길 행동(웹 W-0276 · 고돗 G-0240) — 6 키·폰 "길" 단추가 부른다. 규칙은 <see cref="GoPath"/>, 여기는 세계에 잇기만:
    /// 조사 = 가장 가까운 숨은 터 방위·거리 한 줄 · 이끌기 = 그 사람 몸(root, TalkArea 도 따라감)이 40m 넘는 가장 가까운 역참 쪽으로
    /// 땅 따라 앞장서 걷고 30초 뒤 집으로 · 도발 = 그 사람 곁에 산적 하나(체력 = 공격 ×14, 경험·재등장 없는 임무 적), 꺾으면 경험 +30,
    /// 전멸·60초 넘김이면 거절(-1). 도발은 숨은 터·결투 중엔 안 한다. 처음 부를 때 스스로 생긴다(<see cref="Ensure"/>).
    /// </summary>
    public class PathActions : MonoBehaviour
    {
        public static PathActions Instance { get; private set; }

        public static PathActions Ensure()
        {
            if (Instance != null) return Instance;
            var go = new GameObject("PathActions");
            return go.AddComponent<PathActions>();
        }

        /// <summary>마지막 결과 — probe·lead·provoke·refused·used·none·far·busy(진단이 읽는다).</summary>
        public string LastResult { get; private set; }
        public string LastText { get; private set; }
        public Vector3 LastTarget { get; private set; }
        public FieldEnemy Foe { get; private set; }
        private VillagerTalk _foeOf;
        private float _foeLeft;
        private readonly List<FieldEnemy> _spawned = new List<FieldEnemy>();

        private class Lead { public VillagerTalk V; public Vector3 Home, Target; public float T; public FolkWalker Walker; }
        private readonly List<Lead> _leads = new List<Lead>();
        public int LeadCount => _leads.Count;

        private void Awake() => Instance = this;
        private void OnEnable() { FieldEnemy.Killed += OnKilled; FieldCombat.Wiped += OnWiped; }
        private void OnDisable() { FieldEnemy.Killed -= OnKilled; FieldCombat.Wiped -= OnWiped; }
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private static Vector3 PlayerPos() => FieldCombat.Instance != null ? FieldCombat.Instance.transform.position : Vector3.zero;

        /// <summary>플레이어 곁(14m)의 주민 — HUD 단추·6 키.</summary>
        public static VillagerTalk Near() => VillagerTalk.Nearest(PlayerPos(), GoPath.NearRadius);

        public static bool CanProvokeNow() => !DuelGate.Active && !(DomainField.Instance != null && DomainField.Instance.Running);

        /// <summary>6 키 — 곁 주민에게.</summary>
        public GoPath.Act Press() => Do(Near());

        public GoPath.Act Do(VillagerTalk v)
        {
            LastTarget = Vector3.zero;
            if (v == null) return Result("far", GoLocalization.T("path.far", "곁에 말 걸 사람이 없다"));
            var act = GoPath.Current(out string heroId);
            if (act == GoPath.Act.None) return Result("none", GoLocalization.T("path.none", "길 행동을 할 동행이 없다"));
            if (GoPath.Used(v.Id) != 0) return Result("used", string.Format(GoLocalization.T("path.used", "{0} — 오늘은 이미 이야기를 나눴다"), v.NpcName));
            if (act == GoPath.Act.Provoke && (!CanProvokeNow() || Foe != null))
                return Result("busy", GoLocalization.T("path.busy", "지금은 도발할 수 없다(숨은 터·결투 중)"));
            if (GoPath.RollRefuse(act)) { Refuse(v); return GoPath.Act.None; }

            GoPath.Mark(v.Id, 1);
            Vector3 p = PlayerPos();
            string who = v.NpcName;
            switch (act)
            {
                case GoPath.Act.Probe:
                    if (GoPath.NearestGate(p, out var s, out float d))
                    {
                        LastTarget = s.Pos;
                        Result("probe", string.Format(GoLocalization.T("path.probe_hit", "🔎 {0}: \"{1}\" — {2}쪽 {3}m 에 있다더군요"), who, s.Name, GoPath.Compass(p, s.Pos), Mathf.RoundToInt(d)));
                    }
                    else Result("probe", string.Format(GoLocalization.T("path.probe_none", "🔎 {0}: 이 근처엔 숨은 터가 없다고 합니다"), who));
                    break;
                case GoPath.Act.Lead:
                    if (GoPath.LeadTarget(p, out var wp, out Vector3 tp, out float ld))
                    {
                        LastTarget = tp;
                        StartLead(v, tp);
                        Result("lead", string.Format(GoLocalization.T("path.lead_go", "🧭 {0}: \"{1}\"까지 앞장서지요 · {2}m"), who, GoLocalization.T(wp.NameKey, wp.NameKo), Mathf.RoundToInt(ld)));
                    }
                    else Result("lead", string.Format(GoLocalization.T("path.lead_none", "🧭 {0}: 가 볼 만한 곳이 가까이엔 없습니다"), who));
                    break;
                default:
                    var sp = Object.FindFirstObjectByType<FieldSpawner>();
                    if (sp == null) { GoPath.Mark(v.Id, 0); return Result("busy", GoLocalization.T("path.busy", "지금은 도발할 수 없다(숨은 터·결투 중)")); }
                    Vector3 at = v.Root.position, toP = p - at; toP.y = 0f;
                    Vector3 home = FolkWalker.Grounded(at + (toP.sqrMagnitude > 0.01f ? toP.normalized : Vector3.forward) * 3f);
                    Foe = sp.SpawnStoryFoe(FieldEnemy.Kind.Bandit, home, "path_" + v.Id);
                    float atk = FieldCombat.Instance != null ? FieldCombat.Instance.Atk : PartyState.Atk;
                    Foe.SetPathFoe(GoPath.ProvokeHp(atk));
                    _spawned.Add(Foe);
                    _foeOf = v;
                    _foeLeft = GoPath.ProvokeLimitSec;
                    LastTarget = home;
                    Result("provoke", string.Format(GoLocalization.T("path.provoke_go", "⚔️ {0}의 도발 — 산적이 덤빈다({1}초 안에 꺾어라)"), who, Mathf.RoundToInt(GoPath.ProvokeLimitSec)));
                    break;
            }
            return act;
        }

        private GoPath.Act Result(string key, string text)
        {
            LastResult = key;
            LastText = text;
            DialogueLabel.Instance?.Show(text, 4f);
            return GoPath.Act.None;
        }

        private void Refuse(VillagerTalk v)
        {
            GoPath.Mark(v.Id, -1);
            Result("refused", string.Format(GoLocalization.T("path.refuse", "🙅 {0}이(가) 고개를 돌립니다 — 오늘은 말을 섞지 않겠답니다"), v.NpcName));
        }

        // ---- 도발 ----
        private void OnKilled(FieldEnemy e)
        {
            if (e == null || e != Foe) return;
            PlayerStats.AddExp(GoPath.ProvokeExp);
            Result("won", string.Format(GoLocalization.T("path.provoke_win", "⚔️ {0}의 도발을 이겨 냈다 · 경험 +{1}"), _foeOf != null ? _foeOf.NpcName : "", GoPath.ProvokeExp));
            Foe = null; _foeOf = null;
        }

        private void OnWiped() { if (Foe != null) LoseProvoke(); }

        private void LoseProvoke()
        {
            var v = _foeOf;
            if (Foe != null) Destroy(Foe.gameObject);
            Foe = null; _foeOf = null;
            if (v != null) Refuse(v);
        }

        // ---- 이끌기 ----
        private void StartLead(VillagerTalk v, Vector3 target)
        {
            foreach (var l in _leads) if (l.V == v) return;
            var fw = v.Root.GetComponent<FolkWalker>();
            if (fw != null) fw.enabled = false;
            _leads.Add(new Lead { V = v, Home = v.Root.position, Target = target, T = 0f, Walker = fw });
        }

        /// <summary>그 사람이 지금 이끄는 중인가(진단).</summary>
        public bool Leading(VillagerTalk v) { foreach (var l in _leads) if (l.V == v) return true; return false; }

        private void Update() => Tick(Time.deltaTime);

        /// <summary>진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Tick(float dt)
        {
            if (Foe != null)
            {
                _foeLeft -= dt;
                if (_foeLeft <= 0f && Foe.Alive) LoseProvoke();
            }
            for (int i = _leads.Count - 1; i >= 0; i--)
            {
                var l = _leads[i];
                if (l.V == null) { _leads.RemoveAt(i); continue; }
                l.T += dt;
                var root = l.V.Root;
                Vector3 goal = l.T < GoPath.LeadSec ? l.Target : l.Home;
                Vector3 pos = root.position, to = goal - pos; to.y = 0f;
                float step = GoPath.LeadSpeed * dt, dist = to.magnitude;
                if (dist > 0.05f)
                {
                    Vector3 dir = to / dist;
                    pos += dir * Mathf.Min(step, dist);
                    root.position = FolkWalker.Grounded(new Vector3(pos.x, pos.y, pos.z));
                    root.rotation = Quaternion.LookRotation(dir);
                }
                var anim = root.GetComponentInChildren<Animator>();
                if (anim != null && anim.runtimeAnimatorController != null) anim.SetFloat("Speed", dist > 0.05f ? 0.3f : 0f);
                if (l.T >= GoPath.LeadSec && dist <= 0.05f + step)
                {
                    root.position = l.Home;
                    if (l.Walker != null) l.Walker.enabled = true;
                    _leads.RemoveAt(i);
                }
            }
        }

        /// <summary>진단 정리 — 이끌던 사람은 집으로, 도발 적은 지운다.</summary>
        public void ResetForTest()
        {
            foreach (var l in _leads) { if (l.V != null) l.V.Root.position = l.Home; if (l.Walker != null) l.Walker.enabled = true; }
            _leads.Clear();
            foreach (var e in _spawned) if (e != null) Destroy(e.gameObject);
            _spawned.Clear();
            Foe = null; _foeOf = null;
            LastResult = null; LastText = null;
        }
    }
}
