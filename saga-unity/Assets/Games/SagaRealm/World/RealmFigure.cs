using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// PLAN.md 109-13-2 — 지도·싸움터 위 인물 **대역**. 몸(Mixamo·공방)은 사실 몸 묶음이 있는 PC 에서 씬 빌더가 붙일 몫이고,
    /// 그 전까지는 원시 도형(몸통·머리·투구·오른팔 + 손에 든 것)으로 서서 동작 이름(`RealmActorPlan.Clips`)을 코드 자세로 흉내 낸다.
    /// 동작은 시간만으로 정한다(같은 시각 같은 자세 — 무작위 없음, 순번 위상 `phase`).
    /// </summary>
    public class RealmFigure : MonoBehaviour
    {
        public string Clip { get; private set; } = "idle";
        public float Height { get; private set; } = 1.8f;
        /// <summary>참이면 제 Update 로 자세를 안 잡는다 — 싸움터처럼 부르는 쪽이 시각을 정해 `Pose` 를 직접 부를 때.</summary>
        public bool External;

        private Transform _body;   // 발끝 기준 몸 전체(숙이기·쓰러짐)
        private Transform _arm;    // 어깨 축(팔 휘두르기)
        private Transform _tool;
        private float _phase;
        private float _clipStart;
        private bool _played;
        private Vector3 _basePos;
        private static readonly Dictionary<Color, Material> Mats = new Dictionary<Color, Material>();

        private static readonly Color Skin = new Color(0.86f, 0.7f, 0.56f);
        private static readonly Color Steel = new Color(0.62f, 0.64f, 0.66f);
        private static readonly Color Wood = new Color(0.45f, 0.32f, 0.2f);

        /// <summary>대역 하나를 짓는다 — 옷 빛깔(세력·신분)과 키(m).</summary>
        public static RealmFigure Create(string name, Transform parent, Vector3 localPos, float yaw, Color robe, float height, float phase)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            root.transform.localPosition = localPos;
            root.transform.localRotation = Quaternion.Euler(0f, yaw, 0f);
            var f = root.AddComponent<RealmFigure>();
            f.Height = height;
            f._phase = phase;
            f._basePos = localPos;
            f.Build(robe);
            return f;
        }

        private void Build(Color robe)
        {
            float k = Height / 1.8f;
            _body = new GameObject("Body").transform;
            _body.SetParent(transform, false);
            _body.localScale = Vector3.one * k;
            Part("Robe", PrimitiveType.Capsule, _body, new Vector3(0f, 0.62f, 0f), new Vector3(0.5f, 0.62f, 0.4f), robe);
            Part("Belt", PrimitiveType.Cylinder, _body, new Vector3(0f, 0.78f, 0f), new Vector3(0.52f, 0.04f, 0.42f), Wood);
            Part("Head", PrimitiveType.Sphere, _body, new Vector3(0f, 1.48f, 0f), new Vector3(0.3f, 0.34f, 0.3f), Skin);
            Part("Helm", PrimitiveType.Sphere, _body, new Vector3(0f, 1.58f, 0f), new Vector3(0.33f, 0.2f, 0.33f), Steel);
            _arm = new GameObject("ArmPivot").transform;
            _arm.SetParent(_body, false);
            _arm.localPosition = new Vector3(0.3f, 1.2f, 0f);
            Part("Arm", PrimitiveType.Capsule, _arm, new Vector3(0f, -0.3f, 0f), new Vector3(0.13f, 0.3f, 0.13f), robe * 0.85f);
            Part("OffArm", PrimitiveType.Capsule, _body, new Vector3(-0.3f, 0.92f, 0f), new Vector3(0.13f, 0.3f, 0.13f), robe * 0.85f);
            _tool = new GameObject("Tool").transform;
            _tool.SetParent(_arm, false);
            _tool.localPosition = new Vector3(0f, -0.6f, 0f);
        }

        /// <summary>동작을 바꾼다 — 손에 든 것도 동작마다(괭이·칼·망치·빈손).</summary>
        public void Play(string clip)
        {
            if (clip == Clip && _played) return;
            _played = true;
            Clip = clip;
            _clipStart = Time.time;
            for (int i = _tool.childCount - 1; i >= 0; i--) Kill(_tool.GetChild(i).gameObject);
            switch (clip)
            {
                case "hoe":
                    Part("Shaft", PrimitiveType.Cylinder, _tool, new Vector3(0f, 0f, 0.35f), new Vector3(0.05f, 0.4f, 0.05f), Wood).transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    Part("Blade", PrimitiveType.Cube, _tool, new Vector3(0f, -0.12f, 0.72f), new Vector3(0.18f, 0.26f, 0.04f), Steel);
                    break;
                case "swing": case "attack":
                    Part("Blade", PrimitiveType.Cube, _tool, new Vector3(0f, 0f, 0.45f), new Vector3(0.05f, 0.05f, 0.9f), Steel);
                    Part("Guard", PrimitiveType.Cube, _tool, new Vector3(0f, 0f, 0.02f), new Vector3(0.22f, 0.05f, 0.05f), Wood);
                    break;
                case "hammer":
                    Part("Shaft", PrimitiveType.Cylinder, _tool, new Vector3(0f, 0f, 0.2f), new Vector3(0.05f, 0.22f, 0.05f), Wood).transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    Part("Head", PrimitiveType.Cube, _tool, new Vector3(0f, 0f, 0.42f), new Vector3(0.22f, 0.13f, 0.13f), Steel);
                    break;
                case "haggle":
                    Part("Coin", PrimitiveType.Cylinder, _tool, new Vector3(0f, -0.05f, 0f), new Vector3(0.14f, 0.015f, 0.14f), new Color(0.92f, 0.78f, 0.3f));
                    break;
            }
        }

        private void Update()
        {
            if (!External) Pose(Time.time - _clipStart);
        }

        /// <summary>시간(동작 시작부터 초) → 자세. 진단이 직접 부른다.</summary>
        public void Pose(float t)
        {
            float u = t + _phase;
            float arm = 10f, pitch = 0f, roll = 0f, bob = Mathf.Sin(u * 2f) * 0.01f, side = 0f;
            switch (Clip)
            {
                case "walk":
                    arm = Mathf.Sin(u * 6f) * 30f; bob = Mathf.Abs(Mathf.Sin(u * 6f)) * 0.05f; break;
                case "hoe":      // 들어 올려 내려찍기, 1.2초
                    { float c = Cycle(u, 1.2f); arm = Mathf.Lerp(-150f, -30f, Strike(c)); pitch = Mathf.Lerp(0f, 22f, Strike(c)); } break;
                case "haggle":   // 손 내밀고 좌우로 흔들며 흥정
                    arm = -75f; side = Mathf.Sin(u * 5f) * 25f; break;
                case "swing":    // 칼 휘두르기, 0.9초
                    { float c = Cycle(u, 0.9f); arm = Mathf.Lerp(-160f, 10f, Strike(c)); } break;
                case "bow":      // 읍 — 천천히 숙였다 일어서기
                    pitch = Mathf.SmoothStep(0f, 35f, Mathf.PingPong(u * 0.7f, 1f)); arm = -40f; break;
                case "hammer":   // 짧고 빠르게 내려치기
                    { float c = Cycle(u, 0.5f); arm = Mathf.Lerp(-110f, -20f, Strike(c)); pitch = 8f; } break;
                case "attack":   // 한 번 크게 베기(0.5초) 뒤 겨눔
                    { float c = Mathf.Clamp01(t / 0.5f); arm = Mathf.Lerp(-160f, -10f, c * c); pitch = 10f * c; } break;
                case "hit":      // 맞아 뒤로 젖힘(0.35초) 뒤 돌아옴
                    { float c = Mathf.Clamp01(t / 0.35f); pitch = -25f * Mathf.Sin(c * Mathf.PI); arm = 30f; } break;
                case "die":      // 뒤로 쓰러져 눕기(0.6초)
                    { float c = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(t / 0.6f)); pitch = -90f * c; arm = 30f; bob = 0f; } break;
            }
            _body.localPosition = new Vector3(0f, bob, 0f);
            _body.localRotation = Quaternion.Euler(pitch, 0f, roll);
            _arm.localRotation = Quaternion.Euler(arm, 0f, side);
        }

        /// <summary>눕혔는가(진단) — 몸 기울기 도.</summary>
        public float Tilt => Quaternion.Angle(Quaternion.identity, _body.localRotation);

        /// <summary>제자리 둘레를 걷는다(재야) — 반지름 r, 한 바퀴 초.</summary>
        public void Wander(float t, float radius, float lap)
        {
            float a = (t + _phase * lap) / lap * Mathf.PI * 2f;
            transform.localPosition = _basePos + new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius);
            transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f); // 원의 접선 쪽을 본다
        }

        private static float Cycle(float u, float period) => Mathf.Repeat(u, period) / period;
        // 0 = 들어 올림, 1 = 내려침 — 앞 70% 는 천천히 들고, 뒤 30% 에 빠르게 내려친다(끝과 처음이 이어진다)
        private static float Strike(float c) => c < 0.7f ? 1f - Mathf.SmoothStep(0f, 1f, c / 0.7f) : (c - 0.7f) / 0.3f;

        private static GameObject Part(string name, PrimitiveType type, Transform parent, Vector3 pos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var col = go.GetComponent<Collider>();
            if (col != null) Kill(col);
            color.a = 1f;
            if (!Mats.TryGetValue(color, out var m) || m == null)
            {
                m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Figure (generated)", color = color };
                m.SetFloat("_Smoothness", 0.25f);
                Mats[color] = m;
            }
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        private static void Kill(Object o)
        {
            if (Application.isPlaying) Destroy(o); else DestroyImmediate(o);
        }
    }
}
