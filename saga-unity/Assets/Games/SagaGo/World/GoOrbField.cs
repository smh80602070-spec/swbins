using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-3a 수집 구슬·봉헌(웹 사가고 ⑲-3) — 안 주운 구슬(`GoOrbs.All`)을 떠서 도는 하늘빛 구슬로 세우고,
    /// 0.1초마다 플레이어 발 자리로 줍기(`GoOrbs.CanReach`)·봉헌(불 올린 봉수대 14m 안)을 본다. 모델 없이 빛만(웹 "효과 층").
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음). 땅 높이는 표 값 대신 실제 땅에 레이를 쏴 앉힌다(강 구슬은 수면 기준 그대로).
    /// </summary>
    public class GoOrbField : MonoBehaviour
    {
        public const float CheckEverySec = 0.1f;
        public static GoOrbField Instance { get; private set; }

        private static readonly Color OrbColor = new Color(0.55f, 0.85f, 1f);
        private readonly Dictionary<string, Transform> _orbs = new Dictionary<string, Transform>();
        private readonly Dictionary<string, Vector3> _pos = new Dictionary<string, Vector3>();
        private float _wait;
        private Material _mat;

        /// <summary>마지막으로 주운 구슬·봉헌으로 오른 등급(진단).</summary>
        public string LastPicked { get; private set; }
        public int LastOfferLevels { get; private set; }

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start() => Rebuild();

        /// <summary>월드 자리(땅에 앉힌 뒤) — 진단·시야가 쓴다.</summary>
        public Vector3 PosOf(string id) => _pos.TryGetValue(id, out var p) ? p : Vector3.zero;

        /// <summary>안 주운 구슬만 다시 세운다(세이브를 읽은 뒤에도 부른다).</summary>
        public void Rebuild()
        {
            foreach (var t in _orbs.Values) if (t != null) Destroy(t.gameObject);
            _orbs.Clear();
            _pos.Clear();
            if (_mat == null)
            {
                _mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "CollectOrb (generated)", color = OrbColor };
                _mat.EnableKeyword("_EMISSION");
                _mat.SetColor("_EmissionColor", OrbColor * 2.2f);
            }
            foreach (var o in GoOrbs.All)
            {
                Vector3 p = WorldPos(o);
                _pos[o.Id] = p;
                if (OrbState.Has(o.Id)) continue;
                var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                go.name = "Orb_" + o.Id;
                Destroy(go.GetComponent<Collider>());
                go.transform.SetParent(transform, false);
                go.transform.position = p;
                go.transform.localScale = Vector3.one * 0.9f;
                go.GetComponent<MeshRenderer>().sharedMaterial = _mat;
                var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                ring.name = "Halo";
                Destroy(ring.GetComponent<Collider>());
                ring.transform.SetParent(go.transform, false);
                ring.transform.localScale = new Vector3(1.9f, 0.02f, 1.9f);
                ring.GetComponent<MeshRenderer>().sharedMaterial = _mat;
                _orbs[o.Id] = go.transform;
            }
        }

        /// <summary>표 자리 → 실제 땅(강은 수면 기준 그대로).</summary>
        public static Vector3 WorldPos(GoOrbs.Orb o)
        {
            if (o.Kind == GoOrbs.Kind.River) return o.Pos;
            float above = o.Kind == GoOrbs.Kind.Ridge ? GoOrbs.RidgeAbove : o.Kind == GoOrbs.Kind.Tree ? GoOrbs.TreeAbove : GoOrbs.FieldAbove;
            Vector3 table = o.Pos - Vector3.up * above;
            return FolkWalker.Grounded(table) + Vector3.up * above;
        }

        private void Update()
        {
            float t = Time.time;
            foreach (var kv in _orbs)
            {
                if (kv.Value == null) continue;
                Vector3 p = _pos[kv.Key];
                kv.Value.position = p + Vector3.up * Mathf.Sin(t * 2f + p.x) * 0.25f;
                kv.Value.rotation = Quaternion.Euler(20f, t * 90f, 0f);
            }
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckEverySec;
            var fc = FieldCombat.Instance;
            if (fc != null) Check(fc.transform.position);
        }

        /// <summary>발 자리에서 줍기·봉헌 — 주운 구슬 수를 돌려준다. 진단이 직접 부른다.</summary>
        public int Check(Vector3 feet)
        {
            int picked = 0;
            foreach (var o in GoOrbs.All)
            {
                if (OrbState.Has(o.Id) || !GoOrbs.CanReach(_pos.TryGetValue(o.Id, out var p) ? p : o.Pos, feet)) continue;
                if (!OrbState.Collect(o.Id)) continue;
                picked++;
                LastPicked = o.Id;
                if (_orbs.TryGetValue(o.Id, out var tr) && tr != null) Destroy(tr.gameObject);
                _orbs.Remove(o.Id);
                FieldRingFx.Spawn(feet, 2.5f, OrbColor, 0.5f);
                Toast(string.Format(GoLocalization.T("orb.picked", "◆ 구슬 {0}/{1} — 불 올린 봉수대에 바치면 스태미나 상한이 오른다"), OrbState.GotCount, GoOrbs.All.Length), 3f);
            }
            TryOffer(feet);
            return picked;
        }

        /// <summary>불 올린 봉수대 14m 안이면 지닌 구슬을 바친다 — 오른 등급 수.</summary>
        public int TryOffer(Vector3 feet)
        {
            LastOfferLevels = 0;
            if (OrbState.Held <= 0 || !WorldEventState.IsTriggered(BeaconTower.EventId)) return 0;
            Vector3 d = feet - BeaconTower.Position;
            d.y = 0f;
            if (d.magnitude > GoOrbs.OfferRadius) return 0;
            int levels = OrbState.OfferAll();
            LastOfferLevels = levels;
            string knots = "";
            if (levels > 0)
            {
                knots = TalentState.Add(new[] { 0, 0, 0, GoTalent.KnotPerShrineLevel, 0 }, levels); // 109-14-4 신상 등급마다 인연 매듭
                GoldState.Add(GoOrbs.GoldPerLevel * levels);
                PlayerStats.AddExp(GoOrbs.ExpPerLevel * levels);
                GoStamina.ResetFull();
                FieldRingFx.Spawn(BeaconTower.Position, GoOrbs.OfferRadius, OrbColor, 0.9f);
            }
            Toast((levels > 0
                ? string.Format(GoLocalization.T("orb.offered", "◆ 봉헌 — 신상 {0}단 · 스태미나 상한 {1} · 금 +{2}"), OrbState.Level, Mathf.RoundToInt(GoStamina.Max), GoOrbs.GoldPerLevel * levels)
                : string.Format(GoLocalization.T("orb.offered_half", "◆ 봉헌 — 구슬 하나를 더 바치면 신상 {0}단"), OrbState.Level + 1)) + (knots.Length > 0 ? " · " + knots : ""), 3.5f);
            return levels;
        }

        private static void Toast(string text, float sec)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(text, sec);
        }
    }
}
