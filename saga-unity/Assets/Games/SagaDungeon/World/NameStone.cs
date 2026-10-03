using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// 지워진 이름의 비석 하나(tasks U-0028, 웹 `town.js` rewardNameStone) — 마을 방에 서 있다. 가까이 서면 그 마을의 비석 이름이 보이고,
    /// 마을마다 처음 한 번만 사관 묵향의 기록에 적히며 금을 준다(<see cref="DungeonNameStones"/>). 그림은 코드가 만든 얇은 판(에셋 0).
    /// </summary>
    public class NameStone : MonoBehaviour
    {
        public const float Radius = 2.0f;
        private const float RepeatSec = 5f;
        private static readonly Color StoneColor = new Color(0.2f, 0.2f, 0.26f);
        private static readonly Color GlowColor = new Color(0.6f, 0.6f, 0.9f);

        private string _townId;
        private Transform _player;
        private float _cooldownUntil;

        public string TownId => _townId;

        /// <summary>비석을 짓는다(편집 모드에서도 부를 수 있게 그림까지 여기서 만든다).</summary>
        public static NameStone Create(string townId, Vector3 worldPos, Transform parent)
        {
            var go = new GameObject("NameStone_" + townId);
            if (parent != null) go.transform.SetParent(parent, true);
            go.transform.position = worldPos;
            var stone = go.AddComponent<NameStone>();
            stone._townId = townId;
            stone.BuildVisual();
            return stone;
        }

        private void BuildVisual()
        {
            var slab = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slab.name = "Slab";
            DestroyCollider(slab);
            slab.transform.SetParent(transform, false);
            slab.transform.localPosition = new Vector3(0f, 0.85f, 0f);
            slab.transform.localScale = new Vector3(0.9f, 1.7f, 0.28f);
            Tint(slab, StoneColor, false);
            var cap = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cap.name = "Glow";
            DestroyCollider(cap);
            cap.transform.SetParent(transform, false);
            cap.transform.localPosition = new Vector3(0f, 1.72f, 0f);
            cap.transform.localScale = new Vector3(0.55f, 0.06f, 0.3f);
            Tint(cap, GlowColor, true);
        }

        private static void DestroyCollider(GameObject go)
        {
            var c = go.GetComponent<Collider>();
            if (c == null) return;
            if (Application.isPlaying) Destroy(c); else DestroyImmediate(c);
        }

        private static void Tint(GameObject go, Color c, bool glow)
        {
            var r = go.GetComponent<Renderer>();
            if (r == null) return;
            var m = r.sharedMaterial != null ? new Material(r.sharedMaterial) : null;
            if (m == null) return;
            m.color = c;
            if (glow) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", c * 1.6f); }
            r.sharedMaterial = m;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        private void Update()
        {
            if (Time.time < _cooldownUntil) return;
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }
            Vector3 d = _player.position - transform.position;
            d.y = 0f;
            if (d.sqrMagnitude > Radius * Radius) return;
            Touch();
        }

        /// <summary>밟았다 — 알림 글을 돌려준다(진단도 부른다). 처음이면 기록·금.</summary>
        public string Touch()
        {
            bool first = DungeonNameStones.Claim(_townId, out string name);
            _cooldownUntil = Time.time + RepeatSec;
            string text = first
                ? string.Format(DungeonLocalization.T("namestone.first", "🪦 지워진 이름 \"{0}\" — 묵향의 기록에 적었다 · 금 +{1} ({2}번째)"), name, DungeonNameStones.RewardGold, DungeonNameStones.Count)
                : string.Format(DungeonLocalization.T("namestone.again", "🪦 비석에 새겨진 이름 — {0} (이미 기록해 두었다)"), name);
            DialogueLabel.Instance?.Show(text, first ? 5f : 3f);
            return text;
        }
    }

    /// <summary>마을 방마다 비석 하나를 세운다(tasks U-0028) — 씬에 구운 게 아니라 Play 때(`GameBootstrap.Start`) 짓는다(씬 재빌드 없이).
    /// 자리는 방 가운데 둘레 한 바퀴 중 방 안 다른 것(행상·손님·꾸밈 조각)에서 가장 먼저 떨어진 곳 — 마을 id 해시로 시작 각도를 정해 늘 같다.</summary>
    public static class NameStoneSpawner
    {
        private const float Ring = 4.2f;
        private const int Steps = 12;
        private const float MinGap = 2.2f;
        private const float RoomHalf = 9.9f;

        public static List<NameStone> SpawnAll()
        {
            var made = new List<NameStone>();
            foreach (var set in DungeonEraDecor.Towns)
            {
                if (set.Id.StartsWith("Crossroads")) continue;   // 갈림길은 마을이 아니다
                var room = GameObject.Find(set.Id);
                if (room == null) continue;
                if (room.transform.Find("NameStone_" + set.Id) != null) continue;
                Vector3 spot = Pick(room.transform.position, set.Id, Avoid(room));
                made.Add(NameStone.Create(set.Id, spot, room.transform));
            }
            return made;
        }

        /// <summary>같은 방 안에서 비켜야 할 것들 — 씬 뿌리 오브젝트(행상·손님·소품 …)와 꾸밈 조각.</summary>
        public static List<Vector3> Avoid(GameObject room)
        {
            var list = new List<Vector3>();
            Vector3 c = room.transform.position;
            string decorName = "EraDecor_" + room.name;
            foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
            {
                var t = go.transform;
                if (t == room.transform || go.name.StartsWith("Corridor") || go.name.StartsWith("Minimap") || go.name.StartsWith("NameStone_")) continue;
                if (go.name == decorName) { foreach (Transform piece in t) list.Add(piece.position); continue; }
                Vector3 d = t.position - c;
                if (Mathf.Abs(d.x) < RoomHalf && Mathf.Abs(d.z) < RoomHalf) list.Add(t.position);
            }
            return list;
        }

        public static Vector3 Pick(Vector3 center, string townId, List<Vector3> avoid)
        {
            uint h = 2166136261u;
            foreach (char ch in townId) h = (h ^ ch) * 16777619u;
            int start = (int)(h % Steps);
            Vector3 best = center;
            float bestGap = -1f;
            for (int k = 0; k < Steps; k++)
            {
                float a = ((start + k) % Steps) * (360f / Steps) * Mathf.Deg2Rad;
                Vector3 p = center + new Vector3(Mathf.Cos(a) * Ring, 0f, Mathf.Sin(a) * Ring);
                float gap = float.MaxValue;
                foreach (var o in avoid)
                {
                    float dx = o.x - p.x, dz = o.z - p.z;
                    gap = Mathf.Min(gap, Mathf.Sqrt(dx * dx + dz * dz));
                }
                if (gap >= MinGap) return p;
                if (gap > bestGap) { bestGap = gap; best = p; }
            }
            return best;
        }
    }
}
