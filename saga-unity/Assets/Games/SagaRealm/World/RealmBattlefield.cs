using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>
    /// PLAN.md 109-13 ① "싸움터 땅" — 웹 사가국지 §5-11(`battle3d.js` 바닥 그리기)의 이 트랙 판.
    /// 이 트랙엔 전투 장면이 따로 없어(결과는 알림 한 줄) 출진하면 **그 성의 고정 싸움터로 잠깐 컷**한다:
    /// 바닥빛·하늘·가장자리 소품(`RealmBattleLook`)·강가면 앞쪽 물줄기, 그 위에 양군 머릿수 기둥
    /// (천 명당 하나, 한쪽 3~24)이 다가가 맞붙고, 잃은 만큼 쓰러진 뒤 이긴 쪽이 나아간다(진 쪽은 물러난다).
    /// 판정은 이미 끝난 값(`RealmWarState.AttackResult`)을 그릴 뿐이다 — 화면 층, 세이브 없음.
    /// 씬을 다시 짓지 않게 런타임에 지도 밖 먼 자리(`Origin`)에 짓고 제 카메라(깊이 50)로 덮었다가
    /// `Duration` 뒤(누르면 바로) 통째로 지운다. 원시 도형만(새 GLB 없음 — 웹도 원시 도형, 다음은 CC0 GLB).
    /// 5-10(지도 위 실제 인물·모션)이 이 자리에 장수 몸을 세운다.
    /// </summary>
    public class RealmBattlefield : MonoBehaviour
    {
        public static readonly Vector3 Origin = new Vector3(4000f, 0f, 4000f);
        public const float Duration = 3.6f;
        public const int MinPerSide = 3, MaxPerSide = 24;
        public const float GroundRadius = 11f;
        private const float AdvanceEnd = 1.1f, ClashEnd = 2.3f;
        private const float StartX = 6f, MeetX = 1.3f, Spacing = 0.75f;

        public static RealmBattlefield Active { get; private set; }

        public string CityId { get; private set; }
        public RealmBattleLook.Look Look { get; private set; }
        public int AtkCount { get; private set; }
        public int AtkAlive { get; private set; }
        public int DefCount { get; private set; }
        public int DefAlive { get; private set; }
        public bool Won { get; private set; }
        /// <summary>PLAN.md 109-15 명마 — 공격군이 달려 붙는 속도 배율(1 = 그대로). 공격군이 그만큼 일찍 맞붙는 자리에 서서 기다린다.</summary>
        public float Charge { get; private set; } = 1f;
        public Camera Cam { get; private set; }
        public int PropCount { get; private set; }

        public RealmFigure AtkGeneral { get; private set; }
        public RealmFigure DefGeneral { get; private set; }

        private readonly List<Transform> _atk = new List<Transform>();
        private readonly List<Transform> _def = new List<Transform>();
        private readonly List<Vector3> _atkHome = new List<Vector3>();
        private readonly List<Vector3> _defHome = new List<Vector3>();
        private float _t;
        private static readonly Dictionary<Color, Material> Mats = new Dictionary<Color, Material>();
        private static Mesh _cone;

        private static readonly Color AtkColor = new Color(0.22f, 0.4f, 0.78f);
        private static readonly Color DefColor = new Color(0.72f, 0.2f, 0.16f);
        private static readonly Color BannerGold = new Color(0.92f, 0.78f, 0.3f);
        private static readonly Color StreamColor = new Color(0.35f, 0.66f, 0.85f);

        /// <summary>머릿수 기둥 수 — 천 명당 하나, 한쪽 3~24(웹 5-10 "배우 상한 24" 와 같은 눈금).</summary>
        public static int Heads(int troops) => Mathf.Clamp(Mathf.CeilToInt(troops / 1000f), MinPerSide, MaxPerSide);

        /// <summary>살아남은 기둥 — 시작 머릿수 × 남은 비율, 올림(살아 있으면 적어도 하나).</summary>
        public static int Alive(int heads, int start, int left)
        {
            if (start <= 0 || left <= 0) return 0;
            return Mathf.Clamp(Mathf.CeilToInt(heads * (float)left / start), 1, heads);
        }

        /// <summary>출진 결과를 싸움터로 그린다. 무효 출진(Ok=false)·목표 없음이면 아무것도 안 한다.</summary>
        public static RealmBattlefield Show(RealmWarState.AttackResult r)
        {
            if (!r.Ok || string.IsNullOrEmpty(r.EnemyId)) return null;
            Hide();
            var go = new GameObject("RealmBattlefield");
            go.transform.position = Origin;
            var bf = go.AddComponent<RealmBattlefield>();
            bf.Build(r);
            Active = bf;
            return bf;
        }

        public static void Hide()
        {
            if (Active == null) return;
            var go = Active.gameObject;
            Active = null;
            if (Application.isPlaying) Destroy(go); else DestroyImmediate(go);
        }

        /// <summary>진단용 — 시간을 t 초로 옮겨 자세를 맞춘다(끝나도 안 지운다).</summary>
        public void SampleForTest(float t) { _t = t; Pose(); }

        private void Build(RealmWarState.AttackResult r)
        {
            CityId = r.EnemyId;
            Look = RealmBattleLook.For(r.EnemyId);
            Won = r.Won;
            Charge = Mathf.Max(1f, r.Charge);

            Spawn("Ground", PrimitiveType.Cylinder, new Vector3(0f, -0.05f, 0f), new Vector3(GroundRadius * 2f, 0.05f, GroundRadius * 2f), Look.Ground);
            if (Look.Stream)
                Spawn("Stream", PrimitiveType.Cube, new Vector3(0f, 0.01f, -6.2f), new Vector3(GroundRadius * 1.9f, 0.02f, 2.2f), StreamColor);
            foreach (var p in Look.Props) SpawnProp(p);
            PropCount = Look.Props.Length;

            AtkCount = Heads(r.AtkStart);
            DefCount = Heads(r.DefStart);
            AtkAlive = Alive(AtkCount, r.AtkStart, r.AtkLeft);
            DefAlive = Alive(DefCount, r.DefStart, r.DefLeft);
            Army("Atk", AtkCount, -1f, AtkColor, _atk, _atkHome);
            Army("Def", DefCount, 1f, DefColor, _def, _defHome);

            // PLAN.md 109-13-2 — 양군 앞줄에서 두 장수가 맞붙는다(웹 §5-10 ③). 사실 몸(없으면 대역 도형), 부르는 쪽이 시각을 정한다.
            AtkGeneral = RealmFigure.Create("Gen_Atk", transform, new Vector3(-GeneralStartX, 0f, GeneralZ), 90f, AtkColor, 1.9f, 0f, RealmBodies.Role.Officer, CityId + ":atk");
            DefGeneral = RealmFigure.Create("Gen_Def", transform, new Vector3(GeneralStartX, 0f, GeneralZ), -90f, DefColor, 1.9f, 0.5f, RealmBodies.Role.Officer, CityId + ":def",
                AtkGeneral.BodyName != null ? RealmBodies.Index(RealmBodies.Current.OfficerCount, CityId + ":atk") : -1);
            AtkGeneral.External = DefGeneral.External = true;

            var camGo = new GameObject("BattleCam");
            camGo.transform.SetParent(transform, false);
            camGo.transform.localPosition = new Vector3(0f, 8.5f, -12.5f);
            camGo.transform.LookAt(transform.position + new Vector3(0f, 0.4f, 0f));
            Cam = camGo.AddComponent<Camera>();
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = Look.Sky;
            Cam.fieldOfView = 42f;
            Cam.nearClipPlane = 0.3f;
            Cam.farClipPlane = 80f;
            Cam.depth = 50f;
            Pose();
        }

        /// <summary>한쪽 군 — 네 줄 종대, 첫 기둥은 장수(금빛 깃발).</summary>
        private void Army(string name, int count, float side, Color color, List<Transform> list, List<Vector3> homes)
        {
            const int rows = 4;
            for (int i = 0; i < count; i++)
            {
                int col = i / rows, row = i % rows;
                var home = new Vector3(side * (StartX + col * Spacing), 0.45f, (row - (rows - 1) / 2f) * Spacing * 1.1f);
                var body = Spawn($"{name}_{i}", PrimitiveType.Capsule, home, new Vector3(0.36f, 0.45f, 0.36f), color);
                if (i == 0)
                {
                    Spawn("Pole", PrimitiveType.Cylinder, new Vector3(0f, 1.6f, 0f), new Vector3(0.12f, 1.1f, 0.12f), BannerGold, body.transform);
                    Spawn("Banner", PrimitiveType.Cube, new Vector3(-side * 0.9f, 3.2f, 0f), new Vector3(1.6f, 0.9f, 0.1f), color, body.transform);
                }
                list.Add(body.transform);
                homes.Add(home);
            }
        }

        private void Update()
        {
            _t += Time.deltaTime;
            Pose();
            bool pressed = (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame) ||
                           (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.wasPressedThisFrame);
            if (_t >= Duration || (pressed && _t > 0.3f)) Hide();
        }

        /// <summary>시간 → 자세. 다가감(0~1.1s) → 맞붙음·쓰러짐(~2.3s) → 이긴 쪽 나아감·진 쪽 물러남.</summary>
        private void Pose()
        {
            float advance = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(_t / AdvanceEnd));
            float advanceAtk = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(_t * Charge / AdvanceEnd)); // 명마 — 공격군만 일찍 붙는다
            float clash = Mathf.Clamp01((_t - AdvanceEnd) / (ClashEnd - AdvanceEnd));
            float after = Mathf.Clamp01((_t - ClashEnd) / (Duration - ClashEnd));
            PoseSide(_atk, _atkHome, -1f, AtkAlive, advanceAtk, clash, after, Won);
            PoseSide(_def, _defHome, 1f, DefAlive, advance, clash, after, !Won);
            PoseGeneral(AtkGeneral, -1f, true, advanceAtk);
            PoseGeneral(DefGeneral, 1f, false, advance);
        }

        public const float GeneralStartX = 4.2f, GeneralMeetX = 1.0f, GeneralZ = -2.6f;

        /// <summary>두 장수 순서표(순수) — 다가감(걷기) → 첫 합: 공격 쪽 베기·지키는 쪽 맞음 → 둘째 합: 이긴 쪽 베기·진 쪽 쓰러짐.
        /// 돌려주는 값 = (동작, 그 동작 시작부터 초).</summary>
        public static (string clip, float local) GeneralClip(bool attackerSide, bool attackerWon, float t)
        {
            if (t < AdvanceEnd) return ("walk", t);
            bool winner = attackerSide == attackerWon;
            if (t < 1.6f)
            {
                if (attackerSide) return ("attack", t - AdvanceEnd);
                return t < 1.25f ? ("idle", t - AdvanceEnd) : ("hit", t - 1.25f);
            }
            if (winner) return t < 2.1f ? ("attack", t - 1.6f) : ("idle", t - 2.1f);
            return t < 1.75f ? ("idle", t - 1.6f) : ("die", t - 1.75f);
        }

        private void PoseGeneral(RealmFigure g, float side, bool attackerSide, float advance)
        {
            if (g == null) return;
            var (clip, local) = GeneralClip(attackerSide, Won, _t);
            g.transform.localPosition = new Vector3(side * Mathf.Lerp(GeneralStartX, GeneralMeetX, advance), 0f, GeneralZ);
            g.Play(clip);
            g.Pose(local);
        }

        private static void PoseSide(List<Transform> list, List<Vector3> homes, float side, int alive, float advance, float clash, float after, bool winner)
        {
            float shift = -side * (StartX - MeetX) * advance;
            float tail = (winner ? -side * 1.2f : side * 2.5f) * Mathf.SmoothStep(0f, 1f, after);
            for (int i = 0; i < list.Count; i++)
            {
                var tr = list[i];
                var p = homes[i] + new Vector3(shift + tail, 0f, 0f);
                // 맞붙는 동안 앞뒤로 들썩(순번마다 위상만 다르게 — 무작위 없음)
                p.x += Mathf.Sin(clash * Mathf.PI * 6f + i * 1.7f) * 0.12f * (clash > 0f && clash < 1f ? 1f : 0f);
                bool falls = i >= alive;
                // 쓰러질 몫은 맞붙음 동안 순번대로 넘어진다(뒷줄부터)
                float fall = falls ? Mathf.Clamp01(clash * 1.6f - (list.Count - 1 - i) / (float)Mathf.Max(1, list.Count) * 0.6f) : 0f;
                p.y = 0.45f - 0.25f * fall;
                tr.localPosition = falls ? new Vector3(p.x - tail, p.y, p.z) : p; // 쓰러진 기둥은 제자리에 남는다
                tr.localRotation = Quaternion.Euler(0f, 0f, side * 90f * fall);
            }
        }

        private void SpawnProp(RealmBattleLook.PropSpot p)
        {
            var at = new Vector3(p.X, 0f, p.Z);
            float s = p.Scale;
            switch (p.Kind)
            {
                case RealmBattleLook.Prop.Grass:
                    for (int k = 0; k < 3; k++)
                        Cone("Grass", at + new Vector3((k - 1) * 0.3f * s, 0f, (k % 2) * 0.25f * s), 0.18f * s, 0.9f * s, new Color(0.46f, 0.62f, 0.3f));
                    break;
                case RealmBattleLook.Prop.Mound:
                    Spawn("Mound", PrimitiveType.Sphere, at, new Vector3(3f * s, 1.1f * s, 2.4f * s), Look.Ground * 0.85f);
                    break;
                case RealmBattleLook.Prop.Reed:
                    for (int k = 0; k < 4; k++)
                        Spawn("Reed", PrimitiveType.Cylinder, at + new Vector3((k - 1.5f) * 0.22f * s, 0.8f * s, (k % 2) * 0.2f * s),
                            new Vector3(0.07f, 0.8f * s, 0.07f), new Color(0.55f, 0.6f, 0.35f));
                    break;
                case RealmBattleLook.Prop.Peak:
                    Cone("Peak", at, 1.9f * s, 4.2f * s, new Color(0.52f, 0.54f, 0.5f));
                    Cone("Snow", at + new Vector3(0f, 3.15f * s, 0f), 0.5f * s, 1.05f * s, new Color(0.93f, 0.94f, 0.95f));
                    break;
                case RealmBattleLook.Prop.Dune:
                    Spawn("Dune", PrimitiveType.Sphere, at, new Vector3(3.6f * s, 0.9f * s, 2f * s), Look.Ground * 1.05f);
                    break;
                case RealmBattleLook.Prop.Crystal:
                    Cone("Crystal", at, 0.45f * s, 2.2f * s, new Color(0.62f, 0.45f, 0.95f));
                    break;
                case RealmBattleLook.Prop.Rubble:
                    Spawn("Rubble", PrimitiveType.Cube, at + new Vector3(0f, 0.3f * s, 0f), new Vector3(1.1f * s, 0.6f * s, 0.8f * s), new Color(0.55f, 0.53f, 0.5f))
                        .transform.localRotation = Quaternion.Euler(0f, p.X * 37f, 12f);
                    break;
                case RealmBattleLook.Prop.Grave:
                    Spawn("Grave", PrimitiveType.Cube, at + new Vector3(0f, 0.55f * s, 0f), new Vector3(0.55f * s, 1.1f * s, 0.16f * s), new Color(0.6f, 0.62f, 0.58f));
                    break;
            }
        }

        private GameObject Spawn(string name, PrimitiveType type, Vector3 localPos, Vector3 scale, Color color, Transform parent = null)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent != null ? parent : transform, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            var col = go.GetComponent<Collider>();
            if (col != null) { if (Application.isPlaying) Destroy(col); else DestroyImmediate(col); }
            go.GetComponent<MeshRenderer>().sharedMaterial = Mat(color);
            return go;
        }

        private void Cone(string name, Vector3 localPos, float radius, float height, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = new Vector3(radius, height, radius);
            go.AddComponent<MeshFilter>().sharedMesh = ConeMesh();
            go.AddComponent<MeshRenderer>().sharedMaterial = Mat(color);
        }

        private static Material Mat(Color c)
        {
            c.a = 1f;
            if (Mats.TryGetValue(c, out var m) && m != null) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Battlefield (generated)", color = c };
            m.SetFloat("_Smoothness", 0.15f);
            Mats[c] = m;
            return m;
        }

        /// <summary>밑 반지름 1·높이 1 여덟모 뿔(봉우리·풀·결정).</summary>
        private static Mesh ConeMesh()
        {
            if (_cone != null) return _cone;
            const int n = 8;
            var v = new List<Vector3>();
            var tri = new List<int>();
            for (int i = 0; i < n; i++)
            {
                float a0 = i * Mathf.PI * 2f / n, a1 = (i + 1) * Mathf.PI * 2f / n;
                int b = v.Count;
                v.Add(new Vector3(Mathf.Cos(a0), 0f, Mathf.Sin(a0)));
                v.Add(new Vector3(0f, 1f, 0f));
                v.Add(new Vector3(Mathf.Cos(a1), 0f, Mathf.Sin(a1)));
                tri.Add(b); tri.Add(b + 1); tri.Add(b + 2);
            }
            _cone = new Mesh { name = "BattlefieldCone" };
            _cone.SetVertices(v);
            _cone.SetTriangles(tri, 0);
            _cone.RecalculateNormals();
            _cone.RecalculateBounds();
            return _cone;
        }
    }
}
