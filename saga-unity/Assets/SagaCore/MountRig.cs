using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// 탈것 "모양" 공통부(tasks U-0007) — 네 판(GO·DUNGEON·FOREST·STORY) `MountField` 가 복사하던 것을 합쳤다.
    /// 코드로 그린 기본 도형(말·사슴·학·용 — 원작 모양 아님)을 플레이어 밑에 붙이고, 플레이어 그림(visual)을 그 등 높이로 올리며,
    /// 날개 달린 탈것은 날개를 흔든다. 입력·화면(UI)·싸움/피격 훅은 각 판 `MountField` 가 맡고 매 LateUpdate 에 <see cref="Tick"/> 만 부른다.
    /// </summary>
    public class MountRig : MonoBehaviour
    {
        private GameObject _body;
        private string _bodyId = "";
        private Transform _visual;
        private Vector3 _visualBase;
        private bool _lifted;
        private Transform _wingL, _wingR;
        private float _wingT;

        public bool BodyShown => _body != null && _body.activeSelf;
        public string BodyId => _body != null ? _bodyId : "";
        public float RiderLiftNow { get; private set; }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(string mountId, bool isFly) => string.IsNullOrEmpty(mountId) ? 0f : mountId == "mt_dragon" ? 1.45f : isFly ? 1.25f : 0.85f;

        /// <summary>
        /// 매 LateUpdate 한 번. mountId 가 null/빈 값이면 안 탄 것(몸을 숨기고 플레이어 높이를 되돌린다).
        /// player = 플레이어 루트(몸이 붙는 자리), visual = 플레이어 그림, airborne = 날아오르는 중(날개를 빨리 흔든다).
        /// </summary>
        public void Tick(Transform player, Transform visual, string mountId, bool isFly, bool airborne)
        {
            if (visual != _visual) { RestoreRider(); _visual = visual; _visualBase = _visual != null ? _visual.localPosition : Vector3.zero; }
            if (string.IsNullOrEmpty(mountId))
            {
                RestoreRider();
                if (_body != null && _body.activeSelf) _body.SetActive(false);
                RiderLiftNow = 0f;
                return;
            }
            if (_body == null || _bodyId != mountId) RebuildBody(mountId);
            if (!_body.activeSelf) _body.SetActive(true);
            float lift = LiftOf(mountId, isFly);
            RiderLiftNow = lift;
            if (_visual != null)
            {
                if (!_lifted) { _visualBase = _visual.localPosition; _lifted = true; }
                _visual.localPosition = _visualBase + Vector3.up * lift;
                _body.transform.rotation = Quaternion.Euler(0f, _visual.eulerAngles.y, 0f);
            }
            _body.transform.position = player.position;
            if (isFly && _wingL != null)
            {
                _wingT += Time.deltaTime * (airborne ? 6f : 1.2f);
                float a = airborne ? Mathf.Sin(_wingT) * 28f : 8f;
                _wingL.localRotation = Quaternion.Euler(0f, 0f, a);
                _wingR.localRotation = Quaternion.Euler(0f, 0f, -a);
            }
        }

        private void RestoreRider()
        {
            if (_lifted && _visual != null) _visual.localPosition = _visualBase;
            _lifted = false;
        }

        private void RebuildBody(string id)
        {
            if (_body != null) Destroy(_body);
            _bodyId = id;
            _body = new GameObject("Mount_" + id);
            var t = _body.transform;
            _wingL = _wingR = null;
            switch (id)
            {
                case "mt_crane": BuildCrane(t); break;
                case "mt_dragon": BuildDragon(t); break;
                case "mt_deer": BuildHorse(t, new Color(0.66f, 0.5f, 0.3f)); BuildAntlers(t); break;
                default: BuildHorse(t, id == "mt_white" ? new Color(0.93f, 0.93f, 0.95f) : id == "mt_brown" ? new Color(0.45f, 0.28f, 0.16f) : new Color(0.66f, 0.5f, 0.3f)); break;
            }
        }

        private static Material Mat(Color c, float smooth = 0.25f)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = c };
            mat.SetFloat("_Smoothness", smooth);
            return mat;
        }

        private static GameObject Part(Transform parent, PrimitiveType t, string name, Vector3 local, Vector3 scale, Material mat, Vector3 euler = default)
        {
            var g = GameObject.CreatePrimitive(t);
            g.name = name;
            var col = g.GetComponent<Collider>();
            if (col != null) Object.Destroy(col); // 나(CharacterController)와 부딪히지 않게 — 모양만
            g.transform.SetParent(parent, false);
            g.transform.localPosition = local;
            g.transform.localRotation = Quaternion.Euler(euler);
            g.transform.localScale = scale;
            g.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return g;
        }

        /// <summary>사슴 뿔 — 머리 위 가지 둘.</summary>
        private static void BuildAntlers(Transform t)
        {
            var bone = Mat(new Color(0.82f, 0.74f, 0.58f));
            foreach (float x in new[] { -0.12f, 0.12f })
            {
                Part(t, PrimitiveType.Cube, "Antler", new Vector3(x, 2.15f, 1.15f), new Vector3(0.05f, 0.5f, 0.05f), bone, new Vector3(-15f, 0f, x * 200f));
                Part(t, PrimitiveType.Cube, "AntlerTip", new Vector3(x * 1.8f, 2.4f, 1.1f), new Vector3(0.05f, 0.3f, 0.05f), bone, new Vector3(-10f, 0f, x * 260f));
            }
        }

        /// <summary>말 — 몸통·목·머리·다리 넷·꼬리·갈기(앞이 +z).</summary>
        private static void BuildHorse(Transform t, Color coat)
        {
            var body = Mat(coat);
            var dark = Mat(coat * 0.55f);
            Part(t, PrimitiveType.Cube, "Body", new Vector3(0f, 1.0f, 0f), new Vector3(0.7f, 0.7f, 1.5f), body);
            Part(t, PrimitiveType.Cube, "Neck", new Vector3(0f, 1.5f, 0.85f), new Vector3(0.3f, 0.75f, 0.35f), body, new Vector3(28f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Head", new Vector3(0f, 1.8f, 1.25f), new Vector3(0.3f, 0.35f, 0.62f), body, new Vector3(-10f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Mane", new Vector3(0f, 1.62f, 0.7f), new Vector3(0.1f, 0.7f, 0.2f), dark, new Vector3(28f, 0f, 0f));
            foreach (float x in new[] { -0.25f, 0.25f })
                foreach (float z in new[] { -0.55f, 0.55f })
                    Part(t, PrimitiveType.Cylinder, "Leg", new Vector3(x, 0.4f, z), new Vector3(0.14f, 0.4f, 0.14f), dark);
            Part(t, PrimitiveType.Cube, "Tail", new Vector3(0f, 1.05f, -0.9f), new Vector3(0.12f, 0.6f, 0.15f), dark, new Vector3(-25f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Saddle", new Vector3(0f, 1.4f, -0.05f), new Vector3(0.6f, 0.08f, 0.5f), Mat(new Color(0.35f, 0.15f, 0.1f)));
        }

        /// <summary>학 — 가는 몸통·긴 목과 다리·큰 날개 둘(날갯짓).</summary>
        private void BuildCrane(Transform t)
        {
            var white = Mat(new Color(0.96f, 0.96f, 0.94f));
            var black = Mat(new Color(0.1f, 0.1f, 0.12f));
            var red = Mat(new Color(0.85f, 0.15f, 0.1f));
            Part(t, PrimitiveType.Sphere, "Body", new Vector3(0f, 1.15f, 0f), new Vector3(0.75f, 0.6f, 1.5f), white);
            Part(t, PrimitiveType.Cylinder, "Neck", new Vector3(0f, 1.75f, 0.85f), new Vector3(0.14f, 0.55f, 0.14f), white, new Vector3(25f, 0f, 0f));
            Part(t, PrimitiveType.Sphere, "Head", new Vector3(0f, 2.3f, 1.15f), new Vector3(0.25f, 0.25f, 0.35f), white);
            Part(t, PrimitiveType.Cube, "Beak", new Vector3(0f, 2.28f, 1.5f), new Vector3(0.06f, 0.06f, 0.45f), black);
            Part(t, PrimitiveType.Cube, "Crest", new Vector3(0f, 2.45f, 1.1f), new Vector3(0.12f, 0.05f, 0.12f), red);
            foreach (float x in new[] { -0.15f, 0.15f }) Part(t, PrimitiveType.Cylinder, "Leg", new Vector3(x, 0.55f, -0.1f), new Vector3(0.05f, 0.55f, 0.05f), black);
            Part(t, PrimitiveType.Cube, "Tail", new Vector3(0f, 1.2f, -0.95f), new Vector3(0.3f, 0.06f, 0.7f), black);
            _wingL = WingRoot(t, "WingL", new Vector3(-0.35f, 1.4f, 0.05f)); _wingR = WingRoot(t, "WingR", new Vector3(0.35f, 1.4f, 0.05f));
            Part(_wingL, PrimitiveType.Cube, "Wing", new Vector3(-1.1f, 0f, 0f), new Vector3(2.2f, 0.06f, 1.1f), white);
            Part(_wingR, PrimitiveType.Cube, "Wing", new Vector3(1.1f, 0f, 0f), new Vector3(2.2f, 0.06f, 1.1f), white);
            Part(_wingL, PrimitiveType.Cube, "Tip", new Vector3(-2.15f, 0f, 0f), new Vector3(0.5f, 0.07f, 1.0f), black);
            Part(_wingR, PrimitiveType.Cube, "Tip", new Vector3(2.15f, 0f, 0f), new Vector3(0.5f, 0.07f, 1.0f), black);
        }

        /// <summary>푸른 용 — 긴 몸통·머리와 뿔·꼬리·큰 날개 둘·발톱.</summary>
        private void BuildDragon(Transform t)
        {
            var azure = Mat(new Color(0.15f, 0.45f, 0.75f), 0.4f);
            var deep = Mat(new Color(0.08f, 0.22f, 0.45f), 0.4f);
            var gold = Mat(new Color(0.95f, 0.8f, 0.25f), 0.5f);
            Part(t, PrimitiveType.Cube, "Body", new Vector3(0f, 1.2f, 0f), new Vector3(0.95f, 0.85f, 2.6f), azure);
            Part(t, PrimitiveType.Cube, "Neck", new Vector3(0f, 1.6f, 1.5f), new Vector3(0.45f, 0.5f, 0.9f), azure, new Vector3(-20f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Head", new Vector3(0f, 1.85f, 2.2f), new Vector3(0.6f, 0.5f, 0.95f), azure);
            foreach (float x in new[] { -0.2f, 0.2f }) Part(t, PrimitiveType.Cube, "Horn", new Vector3(x, 2.25f, 2.0f), new Vector3(0.08f, 0.5f, 0.08f), gold, new Vector3(-30f, 0f, x * 60f));
            Part(t, PrimitiveType.Cube, "Tail1", new Vector3(0f, 1.1f, -1.8f), new Vector3(0.6f, 0.5f, 1.4f), azure);
            Part(t, PrimitiveType.Cube, "Tail2", new Vector3(0f, 1.0f, -2.9f), new Vector3(0.35f, 0.3f, 1.2f), deep);
            foreach (float x in new[] { -0.4f, 0.4f })
                foreach (float z in new[] { -0.7f, 0.8f }) Part(t, PrimitiveType.Cube, "Claw", new Vector3(x, 0.55f, z), new Vector3(0.2f, 0.5f, 0.3f), deep);
            _wingL = WingRoot(t, "WingL", new Vector3(-0.5f, 1.6f, 0.2f)); _wingR = WingRoot(t, "WingR", new Vector3(0.5f, 1.6f, 0.2f));
            Part(_wingL, PrimitiveType.Cube, "Wing", new Vector3(-1.5f, 0f, 0f), new Vector3(3f, 0.06f, 1.7f), deep);
            Part(_wingR, PrimitiveType.Cube, "Wing", new Vector3(1.5f, 0f, 0f), new Vector3(3f, 0.06f, 1.7f), deep);
        }

        private static Transform WingRoot(Transform parent, string name, Vector3 local)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = local;
            return g.transform;
        }
    }
}
