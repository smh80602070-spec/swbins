using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0158 부서지는 통·항아리(디아블로 — 유니티 전용, `docs/spec/references-1017.md` 2나락) —
    /// 절차 층의 방마다 벽가에 항아리·꽃병·통·궤짝을 둘(전투방 셋) 세운다. 평타·강공격은 그 부채꼴, 회전베기는 반경 안 소품을 한 대에 깨고,
    /// 적이 없어도 평타·강공격이 사거리 안 가까운 소품을 친다. 깨지면 조각이 물리로 튀어 1.4초 뒤 사라지고 금(가끔 약병 = 체력 15%)이 나온다.
    /// 자리·종류·보상은 (층·방 번호) 씨앗으로 정해 다시 지어도 같다. 명소 층은 시대 꾸밈이 방을 채워 세우지 않는다.
    /// 조각 모델은 `World/&lt;모델&gt;_shard_0..3`(K-0174) — 없으면 같은 모델을 작게·찌그러뜨린 사본 다섯으로 대신한다. 깨지는 소리 `prop_break` 도 없으면 타격음.
    /// </summary>
    public class DungeonBreakable : MonoBehaviour
    {
        public static readonly string[] Models = { "jar_01", "vase_tall_01", "barrel_01", "crate_small_01" };
        /// <summary>방 가운데 기준 벽가 자리 여덟 — 북쪽 문 표지(x −3..3 · z 8..9)·들머리(0,−6)·방 기물(−2,−3)·동서 문(z ±4 안)을 비킨다.</summary>
        public static readonly Vector3[] Slots =
        {
            new Vector3(-8.3f, 0f, 8.3f), new Vector3(8.3f, 0f, 8.3f), new Vector3(-8.3f, 0f, -8.3f), new Vector3(8.3f, 0f, -8.3f),
            new Vector3(-8.4f, 0f, 5.6f), new Vector3(8.4f, 0f, -5.6f), new Vector3(-8.4f, 0f, -5.6f), new Vector3(8.4f, 0f, 5.6f),
        };
        public const int FightCount = 3, OtherCount = 2;
        public const float MaxWidth = 1.1f;
        public const float PotionEvery = 5f; // 씨앗 % 5 == 0 이면 약병
        public const float PotionFrac = 0.15f;
        public const int ShardFallbackN = 5;
        public const float ShardLife = 1.4f, ShardFade = 0.4f;
        private const float BodyRadius = 0.5f;

        /// <summary>살아 있는(안 깨진) 소품 — 공격이 훑는다.</summary>
        public static readonly List<DungeonBreakable> Active = new List<DungeonBreakable>();

        public string Model { get; private set; }
        public bool Potion { get; private set; }
        public int Gold { get; private set; }
        public bool Broken { get; private set; }
        /// <summary>진단 — 마지막으로 깬 소품이 낸 조각 수·대신 조각이었는지.</summary>
        public static int LastShards { get; private set; }
        public static bool LastShardsFallback { get; private set; }
        /// <summary>진단 — 지금까지 깬 수(`ResetForTest` 가 0).</summary>
        public static int BrokenCount { get; private set; }

        private GameObject _body;

        /// <summary>방 하나를 지은 뒤 — 씨앗 = 층 × 131 + 방 번호(전투방 무리 씨앗과 같은 꼴).</summary>
        public static void BuildRoom(Transform contentRoot, int floor, int roomIndex, bool fight)
        {
            int seed = floor * 131 + roomIndex;
            int n = fight ? FightCount : OtherCount;
            int start = (int)(Hash(seed) % (uint)Slots.Length);
            for (int i = 0; i < n; i++)
            {
                int slot = (start + i * 3) % Slots.Length; // 3 은 8 과 서로소 — 겹치지 않고 방 둘레로 흩어진다
                uint h = Hash(seed * 7 + i);
                var go = new GameObject("Breakable_" + i);
                go.transform.SetParent(contentRoot, false);
                go.transform.localPosition = Slots[slot];
                go.transform.localRotation = Quaternion.Euler(0f, h % 360u, 0f);
                var b = go.AddComponent<DungeonBreakable>();
                b.Setup(Models[(int)((h >> 9) % (uint)Models.Length)], (seed + i) % (int)PotionEvery == 0, 1 + floor / 2 + (int)((h >> 17) % 3u));
            }
        }

        private static uint Hash(int x)
        {
            uint h = (uint)x * 2654435761u;
            h ^= h >> 15;
            h *= 2246822519u;
            h ^= h >> 13;
            return h;
        }

        private void Setup(string model, bool potion, int gold)
        {
            Model = model;
            Potion = potion;
            Gold = gold;
            _body = Saga.Core.WorldModels.Spawn(model, transform, MaxWidth);
            if (_body == null) { Destroy(gameObject); return; } // 모델 없는 PC — 소품 없이
            var box = gameObject.AddComponent<BoxCollider>(); // 걸어서 뚫고 지나가지 않게
            Bounds lb = LocalBounds(_body);
            box.center = lb.center;
            box.size = lb.size;
        }

        private void OnEnable() { if (!Active.Contains(this)) Active.Add(this); }
        private void OnDisable() => Active.Remove(this);

        /// <summary>origin 에서 fwd 쪽 부채꼴(반경·반각) 안 소품을 모두 깬다 — 깬 수.</summary>
        public static int BreakInCone(Vector3 origin, Vector3 fwd, float radius, float halfDeg)
        {
            int n = 0;
            foreach (var b in Active.ToArray())
            {
                if (b == null || b.Broken) continue;
                if (!DungeonHunt.InCone(origin, fwd, b.transform.position, radius + BodyRadius, halfDeg)) continue;
                b.Break(origin);
                n++;
            }
            return n;
        }

        /// <summary>반경 안 소품을 모두 깬다(회전베기) — 깬 수.</summary>
        public static int BreakAround(Vector3 origin, float radius)
        {
            int n = 0;
            foreach (var b in Active.ToArray())
            {
                if (b == null || b.Broken || Flat(b.transform.position - origin).magnitude > radius + BodyRadius) continue;
                b.Break(origin);
                n++;
            }
            return n;
        }

        /// <summary>사거리 안 가장 가까운 안 깨진 소품(적이 없을 때 평타·강공격이 노린다).</summary>
        public static DungeonBreakable FindNearest(Vector3 pos, float range)
        {
            DungeonBreakable best = null;
            float bd = range + BodyRadius;
            foreach (var b in Active)
            {
                if (b == null || b.Broken) continue;
                float d = Flat(b.transform.position - pos).magnitude;
                if (d <= bd) { bd = d; best = b; }
            }
            return best;
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        /// <summary>깨뜨린다 — 몸을 숨기고 조각을 흩고 보상.</summary>
        public void Break(Vector3 from)
        {
            if (Broken) return;
            Broken = true;
            BrokenCount++;
            Active.Remove(this);
            var col = GetComponent<Collider>();
            if (col != null) col.enabled = false;
            Vector3 at = transform.position;
            float top = 1f;
            if (_body != null)
            {
                top = LocalBounds(_body).max.y;
                SpawnShards(at, from);
                _body.SetActive(false);
            }
            if (SagaSfxHas("prop_break")) SfxPlayer.Play("prop_break", 1f, 0.05f);
            else SfxPlayer.PlayHit();
            Vector3 pop = at + Vector3.up * (top + 0.4f);
            if (Potion)
            {
                int heal = Mathf.Max(1, Mathf.RoundToInt(HeroState.HpMax * PotionFrac));
                HeroState.HealBy(heal);
                Saga.Core.DamagePopup.Spawn(pop, heal, new Color(0.45f, 0.95f, 0.5f));
            }
            else
            {
                HeroState.AddGold(Gold);
                Saga.Core.DamagePopup.Spawn(pop, Gold, new Color(1f, 0.84f, 0.3f));
            }
        }

        private static bool SagaSfxHas(string name) => Saga.Core.SagaSfx.Variants(name).Length > 0;

        private void SpawnShards(Vector3 at, Vector3 from)
        {
            var pieces = new List<GameObject>();
            for (int i = 0; i < 4; i++)
            {
                var s = Saga.Core.WorldModels.Spawn(Model + "_shard_" + i, null, 0f);
                if (s == null) break;
                s.transform.localScale = _body.transform.lossyScale;
                pieces.Add(s);
            }
            LastShardsFallback = pieces.Count == 0;
            if (LastShardsFallback)
            {
                for (int i = 0; i < ShardFallbackN; i++)
                {
                    var s = Instantiate(_body);
                    s.transform.localScale = Vector3.Scale(_body.transform.lossyScale, new Vector3(0.34f, 0.22f + 0.05f * i, 0.3f));
                    pieces.Add(s);
                }
            }
            LastShards = pieces.Count;
            Vector3 away = Flat(at - from);
            away = away.sqrMagnitude > 1e-4f ? away.normalized : Vector3.forward;
            uint h = Hash(Mathf.RoundToInt(at.x * 10f) * 31 + Mathf.RoundToInt(at.z * 10f));
            Collider player = null;
            var pgo = GameObject.FindWithTag("Player");
            if (pgo != null) player = pgo.GetComponent<Collider>();
            for (int i = 0; i < pieces.Count; i++)
            {
                var s = pieces[i];
                s.name = "Shard_" + i;
                s.SetActive(true);
                float ang = (i * 360f / pieces.Count) + (h >> (i * 3)) % 40u;
                Vector3 dir = (Quaternion.Euler(0f, ang, 0f) * Vector3.forward + away * 0.8f).normalized;
                s.transform.position = at + Vector3.up * (0.25f + 0.15f * (i % 3)) + dir * 0.15f;
                s.transform.rotation = Quaternion.Euler((h >> i) % 180u, ang, (h >> (i + 5)) % 90u);
                var box = s.AddComponent<BoxCollider>();
                Bounds lb = LocalBounds(s);
                box.center = lb.center;
                box.size = Vector3.Max(lb.size, Vector3.one * 0.05f);
                if (player != null) Physics.IgnoreCollision(box, player);
                var rb = s.AddComponent<Rigidbody>();
                rb.mass = 0.3f;
                rb.linearVelocity = dir * (2.2f + 0.3f * (i % 3)) + Vector3.up * (2.6f + 0.4f * (i % 2));
                rb.angularVelocity = new Vector3(5f + i, 3f - i, 4f);
                s.AddComponent<Shard>();
            }
        }

        /// <summary>몸 렌더러를 모은 지역 상자(그 몸의 부모 기준이 아니라 이 트랜스폼 기준).</summary>
        private static Bounds LocalBounds(GameObject go)
        {
            var root = go.transform;
            Bounds b = new Bounds(Vector3.zero, Vector3.zero);
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                var wb = r.bounds;
                Vector3 c = root.parent != null ? root.parent.InverseTransformPoint(wb.center) : root.InverseTransformPoint(wb.center);
                Vector3 sz = root.parent != null ? root.parent.InverseTransformVector(wb.size) : root.InverseTransformVector(wb.size);
                var lb = new Bounds(c, new Vector3(Mathf.Abs(sz.x), Mathf.Abs(sz.y), Mathf.Abs(sz.z)));
                if (!any) { b = lb; any = true; } else b.Encapsulate(lb);
            }
            return b;
        }

        public static void ResetForTest()
        {
            BrokenCount = 0;
            LastShards = 0;
            LastShardsFallback = false;
        }

        /// <summary>조각 — 살다가 끝 0.4초에 줄어 사라진다.</summary>
        private class Shard : MonoBehaviour
        {
            private float _t;
            private Vector3 _s0;
            private void Start() => _s0 = transform.localScale;
            private void Update()
            {
                _t += Time.deltaTime;
                float left = ShardLife - _t;
                if (left <= 0f) { Destroy(gameObject); return; }
                if (left < ShardFade) transform.localScale = _s0 * (left / ShardFade);
            }
        }
    }
}
