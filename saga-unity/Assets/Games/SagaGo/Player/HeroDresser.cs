using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Gear = Saga.Go.Data.GoHeroLooks.Gear;

namespace Saga.Go.Player
{
    /// <summary>
    /// PLAN.md 109-7 — 인물 몸 한 벌에 <see cref="GoHeroLooks.Look"/> 를 입힌다: 키(고른 키 × 칸 배율) · 체격(몸 너비 x·z 배율) ·
    /// 등 무기/방패(윗가슴 뼈, 등 살 바로 뒤에 비스듬히) · 허리 소품(엉덩이 뼈, 오른쪽 뒤 허리띠 자리) · 머리 꾸밈(머리 뼈, 정수리 위 모자 / 눈 앞 안경).
    /// 자리는 뼈 위치만 믿지 않고 **그 몸의 살 정점을 한 번 구워** 잰다(갑옷·두건 두께가 몸마다 달라서) — 막 만든 몸은 받은 자세(T 자세)라
    /// 팔이 옆으로 뻗어 가슴·허리·머리 띠를 안 가린다. 꾸밈은 Poly Haven 실측 크기를 사람 키 1.75m 기준으로 몸 키에 맞춰 키운다.
    /// 뼈에 붙이니 걷기·공격·등반 동작을 그대로 따라간다. 동행(`PartyBodies`)·들판에 선 인물(`FieldHeroes`)·겨루기 상대(`FieldEnemy`)가 같이 쓴다.
    /// </summary>
    public static class HeroDresser
    {
        public const string GearPrefix = "HeroGear_";
        /// <summary>꾸밈 실측 크기의 기준 사람 키(m).</summary>
        public const float RealHuman = 1.75f;
        /// <summary>등 무기 기울기(몸 앞뒤 축 둘레, 도).</summary>
        public const float BackTilt = 32f;

        /// <summary>몸 키를 맞추고(<paramref name="baseHeight"/> × 칸 배율) 체격·꾸밈을 입힌다. 꾸밈 모델이 없으면 그 꾸밈만 건너뛴다.</summary>
        public static void Dress(GameObject inst, GoHeroLooks.Look look, float baseHeight, System.Func<Gear, GameObject> gearModel)
        {
            var t = inst.transform;
            float target = baseHeight * look.HeightScale;
            float h = MeasureHeight(inst);
            if (h > 0.01f) t.localScale = t.localScale * (target / h);
            var s = t.localScale;
            t.localScale = new Vector3(s.x * look.WidthScale, s.y, s.z * look.WidthScale);

            AttachGear(inst, look, target, gearModel, head: true);
        }

        /// <summary>
        /// char-forge 제 몸(<see cref="PartyBodies.ForgeHero"/>) — 키·체격·머리·옷이 이미 그 인물 것(레시피 키 m)이라 칸 배율은 안 쓰고
        /// 사람 키 1.75m 에 대한 비로만 맞춘다. 머리 꾸밈은 안 씌운다(투구·관·상투가 몸에 있다). 등·허리 꾸밈은 표 그대로.
        /// </summary>
        public static void DressOwn(GameObject inst, GoHeroLooks.Look look, float baseHeight, System.Func<Gear, GameObject> gearModel)
        {
            var t = inst.transform;
            float h = MeasureHeight(inst);
            float target = baseHeight * (h > 0.01f ? h / t.lossyScale.y : RealHuman) / RealHuman;
            if (h > 0.01f) t.localScale = t.localScale * (target / h);
            AttachGear(inst, look, target, gearModel, head: false);
        }

        private static void AttachGear(GameObject inst, GoHeroLooks.Look look, float target, System.Func<Gear, GameObject> gearModel, bool head)
        {
            if (look.Back == Gear.None && look.Hip == Gear.None && (!head || look.Head == Gear.None)) return;
            var anim = inst.GetComponentInChildren<Animator>();
            if (anim == null || !anim.isHuman) return;
            var pts = SampleSkin(inst);
            if (look.Back != Gear.None) AttachBack(inst, anim, pts, look.Back, target, gearModel);
            if (look.Hip != Gear.None) AttachHip(inst, anim, pts, look.Hip, target, gearModel);
            if (head && look.Head != Gear.None) AttachHead(inst, anim, pts, look.Head, target, gearModel);
        }

        public static float MeasureHeight(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return 0f;
            var b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b.size.y;
        }

        // ---- 살 정점 -------------------------------------------------------------

        /// <summary>몸 살 정점(월드). 스킨 메시는 지금 자세로 굽는다 — 구운 결과의 좌표계를 두 가지로 풀어 렌더러 경계와 맞는 쪽을 쓴다.</summary>
        public static List<Vector3> SampleSkin(GameObject inst)
        {
            var pts = new List<Vector3>();
            var baked = new Mesh();
            var buf = new List<Vector3>();
            foreach (var smr in inst.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                if (smr.sharedMesh == null) continue;
                smr.BakeMesh(baked, true);
                baked.GetVertices(buf);
                if (buf.Count == 0) continue;
                var tr = smr.transform;
                var full = tr.localToWorldMatrix;
                var noScale = Matrix4x4.TRS(tr.position, tr.rotation, Vector3.one);
                var want = smr.bounds;
                bool useFull = Fit(buf, full, want) <= Fit(buf, noScale, want);
                var m = useFull ? full : noScale;
                int step = Mathf.Max(1, buf.Count / 12000);
                for (int i = 0; i < buf.Count; i += step) pts.Add(m.MultiplyPoint3x4(buf[i]));
            }
            Object.Destroy(baked);
            return pts;
        }

        private static float Fit(List<Vector3> vs, Matrix4x4 m, Bounds want)
        {
            var b = new Bounds(m.MultiplyPoint3x4(vs[0]), Vector3.zero);
            int step = Mathf.Max(1, vs.Count / 400);
            for (int i = 0; i < vs.Count; i += step) b.Encapsulate(m.MultiplyPoint3x4(vs[i]));
            return (b.size - want.size).sqrMagnitude + (b.center - want.center).sqrMagnitude;
        }

        // ---- 꾸밈 만들기 ---------------------------------------------------------

        /// <summary>꾸밈 한 벌 — 겉 틀(이름 `HeroGear_&lt;종류&gt;`)의 원점이 모델 경계 가운데에 오게 안쪽 모델을 옮긴다. 크기는 실측 × 몸 키/1.75.</summary>
        private static Transform MakeGear(Gear g, float bodyHeight, System.Func<Gear, GameObject> gearModel, out Bounds localBounds, out bool wideEndDown)
        {
            localBounds = default;
            wideEndDown = false;
            var prefab = gearModel != null ? gearModel(g) : null;
            if (prefab == null) return null;
            var wrap = new GameObject(GearPrefix + g).transform;
            var model = Object.Instantiate(prefab, wrap);
            model.name = "Model";
            foreach (var col in model.GetComponentsInChildren<Collider>()) Object.DestroyImmediate(col);
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.identity;
            model.transform.localScale = Vector3.one;
            var b = LocalBounds(wrap, model.transform, out wideEndDown);
            model.transform.localPosition = -b.center;
            b.center = Vector3.zero;
            float k = bodyHeight / RealHuman;
            wrap.localScale = Vector3.one * k;
            localBounds = new Bounds(Vector3.zero, b.size * k);
            return wrap;
        }

        /// <summary>틀 좌표 경계 + 세로(Y) 양 끝 중 아래쪽이 더 넓은지(칼 = 자루·코등이가 아래). 정점을 못 읽으면 렌더러 경계만.</summary>
        private static Bounds LocalBounds(Transform wrap, Transform model, out bool wideEndDown)
        {
            wideEndDown = false;
            var vs = new List<Vector3>();
            var buf = new List<Vector3>();
            foreach (var mf in model.GetComponentsInChildren<MeshFilter>())
            {
                if (mf.sharedMesh == null || !mf.sharedMesh.isReadable) continue;
                mf.sharedMesh.GetVertices(buf);
                var m = wrap.worldToLocalMatrix * mf.transform.localToWorldMatrix;
                foreach (var v in buf) vs.Add(m.MultiplyPoint3x4(v));
            }
            if (vs.Count == 0)
            {
                var rs = model.GetComponentsInChildren<Renderer>();
                var rb = rs.Length > 0 ? rs[0].bounds : new Bounds(wrap.position, Vector3.one * 0.1f);
                foreach (var r in rs) rb.Encapsulate(r.bounds);
                return new Bounds(wrap.InverseTransformPoint(rb.center), rb.size);
            }
            var b = new Bounds(vs[0], Vector3.zero);
            foreach (var v in vs) b.Encapsulate(v);
            float lo = b.min.y + b.size.y * 0.3f, hi = b.max.y - b.size.y * 0.3f;
            float wLo = 0f, wHi = 0f;
            foreach (var v in vs)
            {
                float w = new Vector2(v.x - b.center.x, v.z - b.center.z).magnitude;
                if (v.y < lo) wLo = Mathf.Max(wLo, w);
                else if (v.y > hi) wHi = Mathf.Max(wHi, w);
            }
            wideEndDown = wLo > wHi;
            return b;
        }

        // ---- 자리 ---------------------------------------------------------------

        private static Transform Bone(Animator a, params HumanBodyBones[] order)
        {
            foreach (var b in order)
            {
                var t = a.GetBoneTransform(b);
                if (t != null) return t;
            }
            return a.transform;
        }

        /// <summary>띠 안 정점 중 방향 <paramref name="dir"/> 으로 가장 먼 거리(원점 기준). 없으면 <paramref name="fallback"/>.</summary>
        private static float Extent(List<Vector3> pts, Vector3 origin, Vector3 dir, Vector3 up, float halfBand, Vector3 side, float halfSide, float fallback)
        {
            float best = float.MinValue;
            foreach (var p in pts)
            {
                var d = p - origin;
                if (Mathf.Abs(Vector3.Dot(d, up)) > halfBand) continue;
                if (Mathf.Abs(Vector3.Dot(d, side)) > halfSide) continue;
                best = Mathf.Max(best, Vector3.Dot(d, dir));
            }
            return best == float.MinValue ? fallback : best;
        }

        private static void AttachBack(GameObject inst, Animator a, List<Vector3> pts, Gear g, float H, System.Func<Gear, GameObject> gearModel)
        {
            var wrap = MakeGear(g, H, gearModel, out var lb, out bool wideDown);
            if (wrap == null) return;
            var root = inst.transform;
            Vector3 fwd = root.forward, up = root.up, right = root.right;
            var chest = Bone(a, HumanBodyBones.UpperChest, HumanBodyBones.Chest, HumanBodyBones.Spine);
            Vector3 c = chest.position;
            float back = Extent(pts, c, -fwd, up, 0.05f * H, right, 0.1f * H, 0.07f * H);
            Quaternion face = Quaternion.LookRotation(fwd, up);
            Quaternion rot;
            float thick;
            if (g == Gear.Shield)
            {
                rot = Quaternion.LookRotation(-fwd, up);    // 방패 앞면(모델 +Z)이 등 밖으로
                thick = lb.size.z;
            }
            else
            {
                rot = face * Quaternion.Euler(0f, 0f, BackTilt) * (wideDown ? Quaternion.Euler(0f, 0f, 180f) : Quaternion.identity);
                thick = Mathf.Min(lb.size.x, lb.size.z);
            }
            wrap.SetPositionAndRotation(c - fwd * (back + thick * 0.5f + 0.01f * H) + up * (0.02f * H), rot);
            wrap.SetParent(chest, true);
        }

        private static void AttachHip(GameObject inst, Animator a, List<Vector3> pts, Gear g, float H, System.Func<Gear, GameObject> gearModel)
        {
            var wrap = MakeGear(g, H, gearModel, out var lb, out bool wideDown);
            if (wrap == null) return;
            var root = inst.transform;
            Vector3 fwd = root.forward, up = root.up;
            var hips = Bone(a, HumanBodyBones.Hips);
            // 오른쪽 뒤 허리띠 자리 — 옆구리는 걸을 때 팔·손이 스쳐서 뒤로 돌린다.
            Vector3 dir = (root.right * 0.45f - fwd * 0.9f).normalized;
            Vector3 side = Vector3.Cross(up, dir).normalized;
            Vector3 c = hips.position;
            float surf = Extent(pts, c, dir, up, 0.04f * H, side, 0.05f * H, 0.08f * H);
            Quaternion rot = Quaternion.LookRotation(dir, up);
            if (g == Gear.Dagger || g == Gear.Hatchet) rot *= Quaternion.Euler(0f, 0f, 18f) * (wideDown ? Quaternion.Euler(0f, 0f, 180f) : Quaternion.identity);
            float half = Mathf.Max(lb.size.z, Mathf.Min(lb.size.x, lb.size.y)) * 0.5f;
            wrap.SetPositionAndRotation(c + dir * (surf + half + 0.004f * H) - up * (0.03f * H), rot);
            wrap.SetParent(hips, true);
        }

        private static void AttachHead(GameObject inst, Animator a, List<Vector3> pts, Gear g, float H, System.Func<Gear, GameObject> gearModel)
        {
            var root = inst.transform;
            Vector3 fwd = root.forward, up = root.up, right = root.right;
            var head = Bone(a, HumanBodyBones.Head);
            Vector3 c = head.position;
            // 머리 살 — 머리 뼈 위, 머리 축에서 0.08H 안.
            float top = 0f, minR = 0f, maxR = 0f;
            bool any = false;
            foreach (var p in pts)
            {
                var d = p - c;
                float y = Vector3.Dot(d, up);
                if (y < -0.01f * H) continue;
                float x = Vector3.Dot(d, right), z = Vector3.Dot(d, fwd);
                if (x * x + z * z > 0.08f * H * 0.08f * H) continue;
                if (!any) { top = y; minR = maxR = x; any = true; continue; }
                top = Mathf.Max(top, y); minR = Mathf.Min(minR, x); maxR = Mathf.Max(maxR, x);
            }
            if (!any) { top = 0.11f * H; minR = -0.05f * H; maxR = 0.05f * H; }
            float width = Mathf.Max(maxR - minR, 0.06f * H);

            var wrap = MakeGear(g, H, gearModel, out var lb, out _);
            if (wrap == null) return;
            Quaternion rot = Quaternion.LookRotation(fwd, up);
            if (g == Gear.Hat)
            {
                float fit = Mathf.Max(1f, width * 1.3f / Mathf.Max(lb.size.x, 1e-4f));
                wrap.localScale *= fit;
                float hatH = lb.size.y * fit;
                wrap.SetPositionAndRotation(c + up * (top - hatH * 0.05f), rot);
            }
            else
            {
                // 안경 — 눈 높이(머리 뼈 → 정수리의 45%) 에서 코를 뺀 눈자리 앞면에 렌즈를 댄다.
                float eyeY = top * 0.45f;
                Vector3 eye = c + up * eyeY;
                float front = float.MinValue;
                foreach (var p in pts)
                {
                    var d = p - eye;
                    if (Mathf.Abs(Vector3.Dot(d, up)) > 0.012f * H) continue;
                    float x = Mathf.Abs(Vector3.Dot(d, right));
                    if (x < 0.008f * H || x > 0.022f * H) continue;
                    front = Mathf.Max(front, Vector3.Dot(d, fwd));
                }
                if (front == float.MinValue) front = 0.05f * H;
                float fit = width * 0.95f / Mathf.Max(lb.size.x, 1e-4f);
                wrap.localScale *= fit;
                // 렌즈 면(모델 앞 끝 +Z)이 눈앞 0.006H 에 오게 — 틀 원점은 경계 가운데라 반 두께만큼 뒤로.
                wrap.SetPositionAndRotation(eye + fwd * (front + 0.006f * H - lb.size.z * fit * 0.5f), rot);
            }
            wrap.SetParent(head, true);
        }
    }
}
