using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// PLAN.md 109-13-2 — 지도·싸움터 위 인물. 몸 표(`RealmBodies`, 씬 빌더가 채움)가 있으면 **사실 몸**(Humanoid + Maria.controller
    /// 리타깃, 109-13-2b), 없으면(묶음 없는 PC) 원시 도형 **대역**(몸통·머리·투구·오른팔 + 손에 든 것)으로 선다.
    /// 동작 이름(`RealmActorPlan.Clips`)은 둘이 같다. 동작은 시간만으로 정한다(같은 시각 같은 자세 — 무작위 없음, 순번 위상 `phase`).
    ///
    /// 사실 몸: 애니메이터 속도 0 에 `Play(상태, 정규화 시각)` 로 시각을 직접 넘긴다(서기·걷기·베기·맞기·쓰러짐 — 주인공 클립).
    /// 컨트롤러에 없는 일 몸짓(괭이질·흥정·읍·망치)은 서기 위에 `LateUpdate` 에서 허리·팔 뼈를 **몸 축으로** 더 돌린다
    /// (DUNGEON `Gesturer` 와 같은 수 — 판끼리 코드는 안 나눈다). 손에 든 것은 오른손 뼈에 단다.
    /// </summary>
    public class RealmFigure : MonoBehaviour
    {
        public string Clip { get; private set; } = "idle";
        public float Height { get; private set; } = 1.8f;
        /// <summary>참이면 제 Update 로 자세를 안 잡는다 — 싸움터처럼 부르는 쪽이 시각을 정해 `Pose` 를 직접 부를 때.</summary>
        public bool External;
        /// <summary>사실 몸인가(아니면 도형 대역).</summary>
        public bool Rigged => _anim != null;
        /// <summary>입은 몸 프리팹 이름(대역이면 null) — 진단.</summary>
        public string BodyName { get; private set; }

        private Transform _body;   // 발끝 기준 몸 전체(대역: 숙이기·쓰러짐 / 사실 몸: 몸 인스턴스)
        private Transform _arm;    // 대역 어깨 축(팔 휘두르기)
        private Transform _tool;   // 손에 든 것의 부모(대역 팔 끝 / 사실 몸 오른손)
        private float _phase;
        private float _clipStart;
        private bool _played;
        private Vector3 _basePos;
        private float _poseT;
        private bool _inUpdate;
        private static readonly Dictionary<Color, Material> Mats = new Dictionary<Color, Material>();

        // 사실 몸
        private Animator _anim;
        private Transform _hips, _head;
        private Transform[] _bones;
        private Quaternion[] _lastSet, _lastBase;
        private static readonly HumanBodyBones[] OverlayBones =
        {
            HumanBodyBones.Spine, HumanBodyBones.RightUpperArm, HumanBodyBones.LeftUpperArm,
        };
        private const int BSpine = 0, BRArm = 1, BLArm = 2;
        private static readonly Dictionary<GameObject, float> BodyHeights = new Dictionary<GameObject, float>();
        private static readonly Dictionary<RuntimeAnimatorController, Dictionary<string, float>> ClipLengths =
            new Dictionary<RuntimeAnimatorController, Dictionary<string, float>>();

        private static readonly Color Skin = new Color(0.86f, 0.7f, 0.56f);
        private static readonly Color Steel = new Color(0.62f, 0.64f, 0.66f);
        private static readonly Color Wood = new Color(0.45f, 0.32f, 0.2f);

        /// <summary>인물 하나를 짓는다 — 옷 빛깔(대역만)·키(m)·몸 역할과 열쇠(무장 id — 없으면 대역), `skipBody` 번째 몸은 피한다.</summary>
        public static RealmFigure Create(string name, Transform parent, Vector3 localPos, float yaw, Color robe, float height, float phase,
            RealmBodies.Role role = RealmBodies.Role.Officer, string bodyKey = null, int skipBody = -1)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            root.transform.localPosition = localPos;
            root.transform.localRotation = Quaternion.Euler(0f, yaw, 0f);
            var f = root.AddComponent<RealmFigure>();
            f.Height = height;
            f._phase = phase;
            f._basePos = localPos;
            var prefab = bodyKey != null ? RealmBodies.Pick(role, bodyKey, skipBody) : null;
            if (!f.BuildBody(prefab)) f.Build(robe);
            return f;
        }

        private bool BuildBody(GameObject prefab)
        {
            var controller = RealmBodies.Current != null ? RealmBodies.Current.Controller : null;
            if (prefab == null || controller == null || prefab.GetComponent<Animator>() == null) return false;
            var inst = Instantiate(prefab, transform, false);
            var anim = inst.GetComponent<Animator>();
            if (!anim.isHuman)
            {
                DestroyImmediate(inst);
                return false;
            }
            inst.name = "Body";
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.identity;
            foreach (var col in inst.GetComponentsInChildren<Collider>(true)) DestroyImmediate(col);
            float h = MeasureHeight(prefab, inst.transform);
            if (h > 0.3f) inst.transform.localScale = Vector3.one * (Height / h);

            anim.runtimeAnimatorController = controller;
            anim.applyRootMotion = false;
            anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            anim.speed = 0f;
            _anim = anim;
            _body = inst.transform;
            BodyName = prefab.name;
            _hips = anim.GetBoneTransform(HumanBodyBones.Hips);
            _head = anim.GetBoneTransform(HumanBodyBones.Head);
            _bones = new Transform[OverlayBones.Length];
            for (int i = 0; i < OverlayBones.Length; i++) _bones[i] = anim.GetBoneTransform(OverlayBones[i]);
            _lastSet = new Quaternion[_bones.Length];
            _lastBase = new Quaternion[_bones.Length];
            var hand = anim.GetBoneTransform(HumanBodyBones.RightHand);
            _tool = new GameObject("Tool").transform;
            _tool.SetParent(hand != null ? hand : _body, false);
            return true;
        }

        /// <summary>몸 키(이 인물 좌표, 몸 배율 1) — 프리팹마다 한 번 BakeMesh 로 잰다(렌더러 bounds 는 넉넉하게 잡혀 있을 수 있다).</summary>
        private float MeasureHeight(GameObject prefab, Transform inst)
        {
            if (BodyHeights.TryGetValue(prefab, out float cached)) return cached;
            float top = 0f;
            var mesh = new Mesh();
            foreach (var smr in inst.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                smr.BakeMesh(mesh, true); // 배율까지 구운 꼭짓점 — 자리·방향만 더한다
                var at = smr.transform;
                foreach (var v in mesh.vertices)
                    top = Mathf.Max(top, transform.InverseTransformPoint(at.position + at.rotation * v).y);
            }
            Kill(mesh);
            BodyHeights[prefab] = top;
            return top;
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

        /// <summary>동작을 바꾼다 — 손에 든 것도 동작마다(괭이·칼·망치·엽전·빈손).</summary>
        public void Play(string clip)
        {
            if (clip == Clip && _played) return;
            _played = true;
            Clip = clip;
            _clipStart = Time.time;
            for (int i = _tool.childCount - 1; i >= 0; i--) Kill(_tool.GetChild(i).gameObject);
            if (Rigged) HoldRigged(clip); else HoldFigure(clip);
        }

        private void HoldFigure(string clip)
        {
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

        /// <summary>사실 몸 손에 쥐기 — Mixamo 손 뼈는 +Y 가 손가락 쪽(GO `WeaponVisual` 과 같은 축). 크기는 몸 배율을 따른다.</summary>
        private void HoldRigged(string clip)
        {
            // 손 뼈의 배율(리그마다 다를 수 있다)을 걷어 내고 몸 배율만 남긴다 — 값은 1.8m 사람 기준 m.
            float s = _body.localScale.x / Mathf.Max(0.0001f, _tool.lossyScale.x / transform.lossyScale.x);
            Transform P(string n, PrimitiveType t, Vector3 pos, Vector3 scale, Color c) => Part(n, t, _tool, pos * s, scale * s, c).transform;
            switch (clip)
            {
                case "hoe":
                    P("Shaft", PrimitiveType.Cylinder, new Vector3(0f, 0.35f, 0f), new Vector3(0.04f, 0.5f, 0.04f), Wood);
                    P("Blade", PrimitiveType.Cube, new Vector3(0f, 0.82f, 0.1f), new Vector3(0.16f, 0.04f, 0.24f), Steel);
                    break;
                case "swing": case "attack":
                    P("Grip", PrimitiveType.Cylinder, new Vector3(0f, 0.02f, 0f), new Vector3(0.04f, 0.1f, 0.04f), Wood);
                    P("Guard", PrimitiveType.Cube, new Vector3(0f, 0.13f, 0f), new Vector3(0.18f, 0.03f, 0.05f), Wood);
                    P("Blade", PrimitiveType.Cube, new Vector3(0f, 0.55f, 0f), new Vector3(0.05f, 0.8f, 0.015f), Steel);
                    break;
                case "hammer":
                    P("Shaft", PrimitiveType.Cylinder, new Vector3(0f, 0.18f, 0f), new Vector3(0.04f, 0.24f, 0.04f), Wood);
                    P("Head", PrimitiveType.Cube, new Vector3(0f, 0.42f, 0f), new Vector3(0.12f, 0.12f, 0.22f), Steel);
                    break;
                case "haggle":
                    P("Coin", PrimitiveType.Cylinder, new Vector3(0f, 0.08f, 0.03f), new Vector3(0.1f, 0.01f, 0.1f), new Color(0.92f, 0.78f, 0.3f));
                    break;
            }
        }

        private void Update()
        {
            if (External) return;
            _inUpdate = true;
            Pose(Time.time - _clipStart);
            _inUpdate = false;
        }

        private void LateUpdate()
        {
            // 애니메이터가 이번 프레임 뼈를 다시 썼다 — 일 몸짓을 그 위에 다시 얹는다.
            if (Rigged) Overlay(_poseT);
        }

        /// <summary>시간(동작 시작부터 초) → 자세. 싸움터·진단이 직접 부른다.</summary>
        public void Pose(float t)
        {
            _poseT = t;
            if (Rigged) { PoseRigged(t); return; }
            float u = t + _phase;
            float arm = 10f, pitch = 0f, roll = 0f, bob = Mathf.Sin(u * 2f) * 0.01f, side = 0f;
            switch (Clip)
            {
                case "walk":
                    arm = Mathf.Sin(u * 6f) * 30f; bob = Mathf.Abs(Mathf.Sin(u * 6f)) * 0.05f; break;
                case "attack":   // 한 번 크게 베기(0.5초) 뒤 겨눔
                    { float c = Mathf.Clamp01(t / 0.5f); arm = Mathf.Lerp(-160f, -10f, c * c); pitch = 10f * c; } break;
                case "hit":      // 맞아 뒤로 젖힘(0.35초) 뒤 돌아옴
                    { float c = Mathf.Clamp01(t / 0.35f); pitch = -25f * Mathf.Sin(c * Mathf.PI); arm = 30f; } break;
                case "die":      // 뒤로 쓰러져 눕기(0.6초)
                    { float c = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(t / 0.6f)); pitch = -90f * c; arm = 30f; bob = 0f; } break;
                default:
                    WorkPose(Clip, u, ref arm, ref pitch, ref side); break;
            }
            _body.localPosition = new Vector3(0f, bob, 0f);
            _body.localRotation = Quaternion.Euler(pitch, 0f, roll);
            _arm.localRotation = Quaternion.Euler(arm, 0f, side);
        }

        /// <summary>일 몸짓(대역·사실 몸 공용) — 오른팔 앞뒤 도(음수 = 앞·위로), 허리 숙임 도(양수 = 앞), 팔 옆 흔들기 도.</summary>
        private static void WorkPose(string clip, float u, ref float arm, ref float pitch, ref float side)
        {
            switch (clip)
            {
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
            }
        }

        // 사실 몸 동작표 — (상태, 클립 안 구간 시작·끝 0~1, 그 구간을 트는 초 — 0 이면 클립 제 길이, 되풀이)
        // 싸움터 컷은 3.6초라 베기·맞기·쓰러짐을 원래보다 빨리, 가운데 구간만 튼다(`RealmBattlefield.GeneralClip` 박자).
        private (string state, float from, float to, float sec, bool loop) RigStep(string clip)
        {
            switch (clip)
            {
                case "walk": return ("Walk", 0f, 1f, 0f, true);
                case "attack": return ("Attack", 0.18f, 0.72f, 0.5f, false);
                case "hit": return ("Hit", 0f, 0.55f, 0.35f, false);
                case "die": return ("Death", 0f, 1f, 1.6f, false);
                case "swing": return ("Attack", 0f, 1f, 0f, true);   // 훈련 — 베기를 제 박자로 되풀이
                default: return ("Idle", 0f, 1f, 0f, true);           // 서기 + 일 몸짓(Overlay)
            }
        }

        private void PoseRigged(float t)
        {
            var (state, from, to, sec, loop) = RigStep(Clip);
            // 되풀이 동작은 순번 위상을 더해 여럿이 한 박자로 안 움직이게 한다.
            if (loop) t += _phase * 3f;
            float len = sec > 0f ? sec : ClipLength(state) * (to - from);
            float c = len <= 0.001f ? 0f : (loop ? Mathf.Repeat(t, len) / len : Mathf.Clamp01(t / len));
            _anim.Play(state, 0, Mathf.Lerp(from, to, c));
            if (_inUpdate || !Application.isPlaying) return; // 제 Update 면 애니메이터가 곧 평가하고 LateUpdate 가 얹는다
            // 부르는 쪽이 시각을 정했다(싸움터·진단) — 지금 바로 자세를 매긴다.
            _anim.Update(0f);
            Overlay(t);
        }

        private float ClipLength(string state)
        {
            var ctrl = _anim.runtimeAnimatorController;
            if (!ClipLengths.TryGetValue(ctrl, out var table))
            {
                table = new Dictionary<string, float>();
                foreach (var c in ctrl.animationClips)
                    if (c != null) table[c.name.ToLowerInvariant()] = c.length;
                ClipLengths[ctrl] = table;
            }
            string key = state == "Death" ? "death" : state.ToLowerInvariant();
            return table.TryGetValue(key, out float len) ? len : 1f;
        }

        /// <summary>일 몸짓을 뼈에 얹는다 — 몸 오른쪽 축으로 허리·팔을 앞으로, 위 축으로 흥정 흔들기.
        /// 애니메이터가 뼈를 안 다시 썼으면(지난번 얹은 그대로) 지난번 바탕에서 다시 얹어 쌓이지 않게 한다.</summary>
        private void Overlay(float t)
        {
            if (!Application.isPlaying || _bones == null) return;
            float arm = 0f, pitch = 0f, side = 0f;
            if (Clip != "swing") WorkPose(Clip, t + _phase, ref arm, ref pitch, ref side); // 훈련은 베기 클립 그대로
            bool any = arm != 0f || pitch != 0f || side != 0f;
            for (int i = 0; i < _bones.Length; i++)
            {
                var b = _bones[i];
                if (b == null) continue;
                var baseRot = b.localRotation == _lastSet[i] ? _lastBase[i] : b.localRotation;
                b.localRotation = baseRot;
                if (!any) { _lastSet[i] = _lastBase[i] = baseRot; continue; }
                Vector3 right = transform.right, up = transform.up;
                if (i == BSpine) b.rotation = Quaternion.AngleAxis(pitch, right) * b.rotation;
                else if (i == BRArm) b.rotation = Quaternion.AngleAxis(side, up) * Quaternion.AngleAxis(arm, right) * b.rotation;
                else if (i == BLArm && (Clip == "bow" || Clip == "haggle")) b.rotation = Quaternion.AngleAxis(arm * 0.8f, right) * b.rotation;
                _lastBase[i] = baseRot;
                _lastSet[i] = b.localRotation;
            }
        }

        /// <summary>눕혔는가(진단) — 대역은 몸 기울기, 사실 몸은 엉덩이→머리 선이 곧추선 데서 기운 도.</summary>
        public float Tilt
        {
            get
            {
                if (!Rigged) return Quaternion.Angle(Quaternion.identity, _body.localRotation);
                if (_hips == null || _head == null) return 0f;
                return Vector3.Angle(Vector3.up, transform.InverseTransformDirection(_head.position - _hips.position));
            }
        }

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
