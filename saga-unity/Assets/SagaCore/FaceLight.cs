using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0217 인물 얼굴 그림자(원신식, 고돗 G-0248 이식). 얼굴도 몸과 같은 법선 띠 명암이라 코·입가·턱에 얼룩 그늘이 졌다 →
    /// 얼굴 표면 재질만 `Saga/CelToon` 의 `_FaceMode` 1 + 머리 앞(`_HeadFwd`, 월드)을 받아 수평 법선을 머리 앞과 섞은 반쪽 그늘로 낸다(셰이더 `FaceNdotL`).
    ///   얼굴 표면 = Animator 아래 렌더러 중 물체 이름이 `Face…` 이거나 재질 이름에 `_face` 가 든 것의 살갗·얼굴 부품(`_skin`·`_face`·`_eye` — 머리카락 아님) ·
    ///   재질이 툰(`_FaceMode` 있음). 몸 살갗(…_Body_00_SKIN — 손·목)·옷·머리카락은 그대로. 괴물·옛 몸(얼굴 메시 없음)은 0.
    ///   머리 = Humanoid `HumanBodyBones.Head`, 아니면 뼈 이름 `J_Bip_C_Head`·`Head`. 머리 뼈 공간의 얼굴 앞은 붙일 때 오른발목→발끝(수평)으로 정한다.
    /// `_HeadFwd` 는 몸마다 달라 **얼굴 재질만 몸마다 사본**(MaterialPropertyBlock 은 그 렌더러를 SRP Batcher 밖으로 뺀다 — 사본은 같은 셰이더 변형이라 SetPass·draw 그대로).
    /// 툰 변환(ToonScenePass)·외곽선(CharacterOutline) 뒤에 1초마다 Animator 를 다시 훑는다(이미 붙인 몸은 사본이 그대로인지만). 갱신은 LateUpdate·화면 안 몸만·머리가 ~1.8° 넘게 돌 때만.
    /// 끄기: `SAGA_FACE_LIGHT=0`(옛 법선 띠 그대로). 배치 모드(헤드리스 진단)는 기본으로 안 돈다(켜려면 `SAGA_FACE_LIGHT=1`) — 진단은 <see cref="ApplyTo"/>·<see cref="TickAll"/> 를 직접 부른다.
    /// SDF 문턱(원신 얼굴 그림 한 장)은 K-0191 그림이 오면 셰이더에 한 줄로 켠다.
    /// </summary>
    public static class FaceLight
    {
        public const float Flatten = 0.65f;
        private const float MoveDot = 0.9995f; // 약 1.8° 안쪽 흔들림은 안 보낸다
        private static readonly string[] HeadBones = { "J_Bip_C_Head", "Head" };
        public static readonly int FaceModeId = Shader.PropertyToID("_FaceMode");
        public static readonly int HeadFwdId = Shader.PropertyToID("_HeadFwd");
        private static readonly int FlattenId = Shader.PropertyToID("_FaceFlatten");

        public sealed class Body
        {
            public Animator anim;
            public Transform head;
            public Vector3 localFwd;
            public Vector3 last;
            public readonly List<Renderer> renderers = new List<Renderer>();
            public readonly List<Material> mats = new List<Material>();
        }

        private static readonly Dictionary<Animator, Body> Bodies = new Dictionary<Animator, Body>();
        private static readonly HashSet<Material> Owned = new HashSet<Material>();
        /// <summary>바꿔 끼운 사본 → 원본(진단·되돌리기).</summary>
        private static readonly Dictionary<Material, Material> Source = new Dictionary<Material, Material>();

        public static bool Enabled() => System.Environment.GetEnvironmentVariable("SAGA_FACE_LIGHT") != "0";

        public static bool ActiveByEnvironment()
        {
            if (!Enabled()) return false;
            if (Application.isBatchMode && System.Environment.GetEnvironmentVariable("SAGA_FACE_LIGHT") != "1") return false;
            return true;
        }

        /// <summary>진단 — 붙은 몸들.</summary>
        public static IEnumerable<Body> All => Bodies.Values;
        public static bool TryGet(Animator a, out Body b) => Bodies.TryGetValue(a, out b);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            Bodies.Clear(); Owned.Clear(); Source.Clear();
            if (!ActiveByEnvironment()) return;
            var go = new GameObject("FaceLight") { hideFlags = HideFlags.HideAndDontSave };
            Object.DontDestroyOnLoad(go);
            go.AddComponent<Runner>();
        }

        private sealed class Runner : MonoBehaviour
        {
            private IEnumerator Start()
            {
                var wait = new WaitForSeconds(1f);
                yield return null; yield return null; yield return null; // ToonScenePass(첫 프레임·두 프레임 뒤) 다음
                while (true)
                {
                    foreach (var a in FindObjectsByType<Animator>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                        if (a != null) ApplyTo(a);
                    yield return null; // CharacterOutline 이 같은 초에 사본을 갈아 끼웠으면 다음 훑기에서 받아들인다
                    yield return wait;
                }
            }

            private void LateUpdate() => TickAll(false);
        }

        /// <summary>재질 이름이 살갗·얼굴 부품인가(머리카락·옷 아님) — 고돗 `_surface_kind` 의 skin·face.</summary>
        public static bool FacePartName(string matName)
        {
            if (string.IsNullOrEmpty(matName)) return false;
            string n = matName.ToLowerInvariant();
            if (n.Contains("hair")) return false;
            return n.StartsWith("skin") || n.Contains("_skin") || n.Contains("_eye") || n.Contains("_face");
        }

        /// <summary>이 렌더러의 이 재질이 얼굴 표면인가(툰 재질만).</summary>
        public static bool IsFaceSurface(Renderer r, Material m)
        {
            if (r == null || m == null || m.shader == null || !m.HasProperty(FaceModeId)) return false;
            if (!FacePartName(m.name)) return false;
            return r.gameObject.name.ToLowerInvariant().StartsWith("face") || m.name.ToLowerInvariant().Contains("_face");
        }

        public static Transform FindHead(Animator a)
        {
            if (a == null) return null;
            if (a.isHuman && a.avatar != null)
            {
                var h = a.GetBoneTransform(HumanBodyBones.Head);
                if (h != null) return h;
            }
            foreach (var n in HeadBones)
            {
                var t = FindDeep(a.transform, n);
                if (t != null) return t;
            }
            return null;
        }

        private static Transform FindDeep(Transform t, string name)
        {
            if (t.name == name) return t;
            for (int i = 0; i < t.childCount; i++)
            {
                var f = FindDeep(t.GetChild(i), name);
                if (f != null) return f;
            }
            return null;
        }

        /// <summary>몸 앞(월드, 수평) — 오른발목 → 발끝(고돗 `_setup` 과 같은 법), 없으면 Animator 앞.</summary>
        private static Vector3 BodyForward(Animator a)
        {
            Transform foot = null, toe = null;
            if (a.isHuman && a.avatar != null) { foot = a.GetBoneTransform(HumanBodyBones.RightFoot); toe = a.GetBoneTransform(HumanBodyBones.RightToes); }
            if (foot == null) foot = FindDeep(a.transform, "J_Bip_R_Foot");
            if (toe == null) toe = FindDeep(a.transform, "J_Bip_R_ToeBase");
            if (foot != null && toe != null)
            {
                var d = toe.position - foot.position; d.y = 0f;
                if (d.sqrMagnitude > 1e-6f) return d.normalized;
            }
            var f = a.transform.forward; f.y = 0f;
            return f.sqrMagnitude > 1e-6f ? f.normalized : Vector3.forward;
        }

        /// <summary>한 몸에 붙인다 — 얼굴 표면 재질을 몸마다 사본(`_FaceMode` 1)으로 바꿔 끼우고 등록. 바꾼 칸 수(이미 붙은 칸은 셈 안 함). 손잡이 0·머리 없음·얼굴 없음이면 0.</summary>
        public static int ApplyTo(Animator a)
        {
            if (a == null || !Enabled()) return 0;
            Bodies.TryGetValue(a, out var body);
            if (body != null && body.head == null) { Bodies.Remove(a); body = null; }
            var head = body != null ? body.head : FindHead(a);
            if (head == null) return 0;
            int changed = 0;
            var mats = new List<Material>();
            foreach (var r in a.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                if (r.GetComponentInParent<Animator>(true) != a) continue; // 안쪽 다른 몸(탄 짐승·든 인형)은 그 몸 차례
                r.GetSharedMaterials(mats);
                bool any = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var m = mats[i];
                    if (m == null || Owned.Contains(m)) continue;
                    if (!IsFaceSurface(r, m)) continue;
                    if (body == null)
                    {
                        body = new Body { anim = a, head = head };
                        body.localFwd = Quaternion.Inverse(head.rotation) * BodyForward(a);
                        Bodies[a] = body;
                    }
                    Material mine;
                    if (m.GetFloat(FaceModeId) > 0.5f && !Source.ContainsKey(m))
                        mine = m;                              // 우리 사본을 외곽선이 다시 베낀 것(몸마다 하나) — 그대로 받아들인다
                    else
                    {
                        // 외곽선이 켜진 판이면 외곽선 사본을 먼저 거쳐 베낀다 — 그래야 CharacterOutline 이 우리 사본을 다시 갈아 끼우지 않는다.
                        var basis = CharacterOutline.ActiveByEnvironment() ? CharacterOutline.Outlined(m) : m;
                        mine = new Material(basis) { name = m.name + " (face)" };
                        mine.SetFloat(FaceModeId, 1f);
                        if (mine.HasProperty(FlattenId)) mine.SetFloat(FlattenId, Flatten);
                        Source[mine] = m;
                    }
                    if (body.last.sqrMagnitude > 0.5f) mine.SetVector(HeadFwdId, body.last);
                    Owned.Add(mine);
                    if (!body.mats.Contains(mine)) body.mats.Add(mine);
                    if (!body.renderers.Contains(r)) body.renderers.Add(r);
                    if (mine != m) { mats[i] = mine; any = true; changed++; }
                }
                if (any) r.SetSharedMaterials(mats);
            }
            if (body != null) body.mats.RemoveAll(m => m == null);
            return changed;
        }

        /// <summary>머리 앞을 얼굴 재질에 보낸다. force = 화면 밖·작은 회전도(진단·촬영).</summary>
        public static void TickAll(bool force)
        {
            List<Animator> dead = null;
            foreach (var kv in Bodies)
            {
                var b = kv.Value;
                if (kv.Key == null || b.head == null) { (dead ??= new List<Animator>()).Add(kv.Key); continue; }
                if (!force)
                {
                    bool seen = false;
                    foreach (var r in b.renderers) if (r != null && r.isVisible) { seen = true; break; }
                    if (!seen) continue;
                }
                var f = (b.head.rotation * b.localFwd).normalized;
                if (!force && Vector3.Dot(f, b.last) > MoveDot) continue;
                b.last = f;
                var v = new Vector4(f.x, f.y, f.z, 0f);
                foreach (var m in b.mats) if (m != null) m.SetVector(HeadFwdId, v);
            }
            if (dead != null) foreach (var a in dead) Bodies.Remove(a);
        }

        /// <summary>진단·촬영 — 붙인 사본의 `_FaceMode` 를 한꺼번에 켬/끔(같은 프레임·같은 자세 전후 비교). 바꾼 재질 수.</summary>
        public static int SetModeForTest(bool on)
        {
            int n = 0;
            foreach (var b in Bodies.Values) foreach (var m in b.mats) if (m != null) { m.SetFloat(FaceModeId, on ? 1f : 0f); n++; }
            return n;
        }

        /// <summary>진단·촬영 — 붙인 사본을 원본으로 되돌린다(전후 비교). 되돌린 칸 수.</summary>
        public static int DetachAll()
        {
            int n = 0;
            var mats = new List<Material>();
            foreach (var b in Bodies.Values)
                foreach (var r in b.renderers)
                {
                    if (r == null) continue;
                    r.GetSharedMaterials(mats);
                    bool any = false;
                    for (int i = 0; i < mats.Count; i++)
                        if (mats[i] != null && Source.TryGetValue(mats[i], out var src)) { mats[i] = src; any = true; n++; }
                    if (any) r.SetSharedMaterials(mats);
                }
            Bodies.Clear(); Owned.Clear(); Source.Clear();
            return n;
        }
    }
}
