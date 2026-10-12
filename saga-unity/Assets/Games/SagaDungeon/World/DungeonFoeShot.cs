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
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "FoeShot (generated)" };
            mat.color = color;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", color * 0.8f);
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
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

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            if (_done) return;
            _life -= dt;
            transform.position += _dir * DungeonFoeRoster.ShotSpeed * dt;
            Vector3 p = transform.position;
            if (_target != null)
            {
                Vector3 d = _target.position - p;
                float dy = d.y;
                d.y = 0f;
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
