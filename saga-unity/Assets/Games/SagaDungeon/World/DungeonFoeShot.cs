using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0106 — 활·지팡이 잡졸의 투사체(웹 run.foeShots: 속도 260px/s·수명 1.8초·맞는 반경 13+8px). 코드 구체(새 에셋 0).
    /// 수평으로 날아 내 몸 <see cref="DungeonFoeRoster.ShotHitRadius"/> 안이면 맞음 — 회피 무적이면 피해 없이 완벽 회피 신고 후 사라진다.
    /// 수명이 다하거나 방(쏜 이 부모 둘레 RoomWidth) 밖이면 사라진다. 헤드리스 진단은 <see cref="Tick"/> 에 시간을 직접 넣는다.
    /// </summary>
    public class DungeonFoeShot : MonoBehaviour
    {
        public static readonly List<DungeonFoeShot> Active = new List<DungeonFoeShot>();

        private Vector3 _dir;
        private float _life;
        private float _dmg;
        private string _who, _how;
        private Transform _target;
        private Vector3 _roomCenter;
        private float _roomHalf;
        private bool _done;

        public bool Done => _done;
        public float Damage => _dmg;

        public static DungeonFoeShot Fire(Vector3 from, Vector3 to, float dmg, string who, string how, Transform target,
            Transform room, Color color)
        {
            Vector3 dir = to - from;
            dir.y = 0f;
            if (dir.sqrMagnitude < 1e-6f) dir = Vector3.forward;
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "FoeShot";
            var col = go.GetComponent<Collider>();
            col.enabled = false;
            Object.Destroy(col);
            go.transform.position = from;
            go.transform.localScale = Vector3.one * 0.22f;
            go.GetComponent<MeshRenderer>().sharedMaterial = MaterialFor(color);
            // 방 내용 밑에 붙인다 — 방 갈이·층 내려가기·은총 재시작이 적과 함께 지운다(새 방에서 옛 탄에 맞지 않게, R-5).
            if (room != null) go.transform.SetParent(room, true);
            var shot = go.AddComponent<DungeonFoeShot>();
            shot._dir = dir.normalized;
            shot._life = DungeonFoeRoster.ShotLife;
            shot._dmg = dmg;
            shot._who = who;
            shot._how = how;
            shot._target = target;
            shot._roomCenter = room != null ? room.position : from;
            shot._roomHalf = room != null ? DungeonRoomBuilder.RoomWidth * 0.5f + 0.5f : float.MaxValue;
            Active.Add(shot);
            return shot;
        }

        // 색마다 재질 하나를 돌려 쓴다(탄마다 만들면 버려진 재질이 쌓인다 — R-5).
        private static readonly Dictionary<Color, Material> _mats = new Dictionary<Color, Material>();
        private static Material MaterialFor(Color color)
        {
            if (_mats.TryGetValue(color, out var mat) && mat != null) return mat;
            mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "FoeShot (generated)" };
            mat.color = color;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", color * 0.8f);
            _mats[color] = mat;
            return mat;
        }

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            if (_done) return;
            _life -= dt;
            Vector3 p0 = transform.position;
            float step = DungeonFoeRoster.ShotSpeed * dt;
            transform.position += _dir * step;
            Vector3 p = transform.position;
            if (_target != null)
            {
                // 이번 걸음 선분에서 대상에 가장 가까운 점으로 잰다 — 프레임이 튀어 한 걸음이 길어도 뚫고 지나가지 않게(R-5).
                Vector3 d = _target.position - p0;
                float dy = _target.position.y - p.y;
                d.y = 0f;
                d -= _dir * Mathf.Clamp(Vector3.Dot(d, _dir), 0f, step);
                if (d.magnitude <= DungeonFoeRoster.ShotHitRadius && dy > -2.2f && dy < 0.6f)
                {
                    if (HeroState.Invulnerable) Saga.Dungeon.Player.PlayerController.ReportDodgedStrike();
                    else HeroState.TakeDamage(_dmg, _who, _how);
                    End();
                    return;
                }
            }
            if (_life <= 0f || Mathf.Abs(p.x - _roomCenter.x) > _roomHalf || Mathf.Abs(p.z - _roomCenter.z) > _roomHalf) End();
        }

        private void End()
        {
            _done = true;
            Active.Remove(this);
            if (Application.isPlaying) Destroy(gameObject);
            else DestroyImmediate(gameObject);
        }

        private void OnDestroy() => Active.Remove(this);
    }
}
