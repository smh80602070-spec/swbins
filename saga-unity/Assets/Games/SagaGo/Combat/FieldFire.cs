using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>
    /// tasks U-0175 환경 연쇄 — 웹 사가만리 W-0374 `field-env.js` · 고돗 G-0303 `field_env.gd` 짝. 원소 반응은 적 몸에만 걸리니 땅이 한 번 더 받아친다.
    /// 불: 불(화) 타격·불붙음(들불) 반응이 **풀 땅**(칸 `.` 들·`T` 숲·`F` 논밭) 위 적에 닿으면 발밑에 불길 — <see cref="Life"/>초 동안 반경 <see cref="Radius"/> 안
    /// 적에게 초당 <see cref="DpsMul"/> × 그 타격 기본 피해(불 원소 묻힘), <see cref="SpreadAt"/>초 뒤 <see cref="SpreadM"/> 옆 풀 땅 한 곳으로 한 번 번짐(번진 불은 안 번짐).
    /// 강물 전류(웹·고돗 "물벼락" — 이 트랙은 감전 반응 이름이 물벼락이라 바꿈): 번개(뇌) 타격이 강(`~`) 위 적에 닿으면 <see cref="ShockR"/> 안 강 위 다른 적에게 같은 기본 피해 한 번. 물(수) 타격은 반경 <see cref="DouseR"/> 불길을 끈다.
    /// 땅 피해는 `TakeRaw`(반응·되부름·연타 셈 없음)라 다시 여기로 안 온다. 주인공은 안 다친다. 거리는 고돗 m × 1.85(이 트랙 사람 키 3.4m).
    /// **이 트랙 다름**: 들판 적은 강 칸에 서지 않아(`FieldEnemy.CanStandOn`) 강물 전류는 밀려 들어간 적에게만 — 젖은 적끼리 번지는 감전은 이미 있다(`ChargedSpreadRadius`).
    /// </summary>
    public class FieldFire : MonoBehaviour
    {
        public const float Life = 3f, Radius = 4.6f, DpsMul = 0.3f, Tick = 0.5f, SpreadAt = 0.5f, SpreadM = 7.4f, ShockR = 14.8f, DouseR = 5.5f;
        public const int MaxFires = 12;
        public static bool On = true;
        public static FieldFire Instance { get; private set; }

        public class Spot { public Vector3 Pos; public float T, TickT, Base; public bool Spread; public GameObject Body; }

        private readonly List<Spot> _fires = new List<Spot>();
        public IReadOnlyList<Spot> Fires => _fires;
        private static Material _flameMat, _coreMat, _scorchMat;
        private static readonly Color FireColor = new Color(1f, 0.45f, 0.15f);
        private static readonly Vector3 CoreSize = new Vector3(1.1f, 2.2f, 1.1f), PetalSize = new Vector3(0.8f, 1.5f, 0.8f);

        private void Awake() => Instance = this;
        private void OnEnable() => FieldEnemy.Reacted += OnReacted;
        private void OnDisable() => FieldEnemy.Reacted -= OnReacted;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private static bool Grassy(char c) => c == '.' || c == 'T' || c == 'F';

        public static bool IsGrass(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            return Grassy(TestMapData.TileAt(gx, gy));
        }

        public static bool IsWet(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            return TestMapData.TileAt(gx, gy) == '~';
        }

        private void OnReacted(FieldEnemy e, GoElement element, GoReaction reaction, float amount)
        {
            if (!On || e == null) return;
            Vector3 p = e.transform.position;
            if (element == GoElement.Hydro) Douse(p);
            else if (element == GoElement.Pyro || reaction == GoReaction.Burning) { if (IsGrass(p)) Ignite(p, amount, true); }
            else if (element == GoElement.Electro && IsWet(p)) Shock(e, amount);
        }

        public void Ignite(Vector3 p, float baseDmg, bool spread)
        {
            p.y = 0f;
            foreach (var f in _fires)
                if (Flat(f.Pos - p) < Radius) { f.T = 0f; return; } // 같은 자리는 다시 타오름만
            if (_fires.Count >= MaxFires) { Drop(_fires[0]); _fires.RemoveAt(0); }
            _fires.Add(new Spot { Pos = p, Base = baseDmg, Spread = spread, Body = Flames(p) });
            if (spread) FieldDamageText.Spawn(Ground(p) + Vector3.up * 3f, GoLocalization.T("env.fire", "풀불"), FireColor, 1f);
            FieldRingFx.Spawn(Ground(p), Radius, FireColor, 0.5f);
        }

        public int Douse(Vector3 p)
        {
            int n = 0;
            for (int i = _fires.Count - 1; i >= 0; i--)
            {
                if (Flat(_fires[i].Pos - p) > DouseR) continue;
                Drop(_fires[i]);
                _fires.RemoveAt(i);
                n++;
            }
            return n;
        }

        public int Shock(FieldEnemy from, float baseDmg)
        {
            int hit = 0;
            Vector3 p = from.transform.position;
            Color c = GoElements.ColorOf(GoElement.Electro);
            foreach (var o in new List<FieldEnemy>(FieldEnemy.All))
            {
                if (o == from || !o.Alive || Flat(o.transform.position - p) > ShockR || !IsWet(o.transform.position)) continue;
                o.TakeRaw(baseDmg, c);
                FieldLineFx.Spawn(p + Vector3.up * 1.2f, o.transform.position + Vector3.up * 1.2f, 0.4f, c, 0.35f);
                hit++;
            }
            if (hit > 0) FieldDamageText.Spawn(p + Vector3.up * 4.2f, GoLocalization.T("env.shock", "강물 전류"), c, 1f);
            return hit;
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>한 틱 — 둘레 피해·번짐·꺼짐. 진단이 직접 부른다.</summary>
        public void Step(float dt)
        {
            if (_fires.Count == 0) return;
            var born = new List<Spot>();
            foreach (var f in _fires)
            {
                f.T += dt;
                f.TickT += dt;
                while (f.TickT >= Tick)
                {
                    f.TickT -= Tick;
                    foreach (var e in new List<FieldEnemy>(FieldEnemy.All))
                    {
                        if (!e.Alive || Flat(e.transform.position - f.Pos) > Radius) continue;
                        e.TakeRaw(f.Base * DpsMul * Tick, FireColor);
                        e.TouchAura(GoElement.Pyro);
                    }
                    FieldRingFx.Spawn(Ground(f.Pos), Radius * 0.5f, FireColor, 0.45f);
                }
                if (f.Spread && f.T >= SpreadAt)
                {
                    f.Spread = false;
                    if (SpreadSpot(f.Pos, out var q)) born.Add(new Spot { Pos = q, Base = f.Base });
                }
                if (f.Body != null) // 일렁임 + 끝 0.6초 사그라짐
                {
                    float k = Mathf.Clamp01((Life - f.T) / 0.6f);
                    int i = 0;
                    foreach (Transform c in f.Body.transform)
                        if (c.name.StartsWith("Flame")) c.localScale = (c.name == "Flame0" ? CoreSize : PetalSize) * k * (0.8f + 0.3f * Mathf.Sin(f.T * 11f + (i++) * 1.7f));
                }
            }
            for (int i = _fires.Count - 1; i >= 0; i--)
                if (_fires[i].T >= Life) { Drop(_fires[i]); _fires.RemoveAt(i); }
            foreach (var b in born) Ignite(b.Pos, b.Base, false);
        }

        /// <summary>옆 풀 땅 한 곳 — 여덟 방향 중 풀이고 다른 불길과 안 겹치는 첫 자리.</summary>
        private bool SpreadSpot(Vector3 from, out Vector3 q)
        {
            for (int i = 0; i < 8; i++)
            {
                float a = i * Mathf.PI / 4f;
                q = from + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * SpreadM;
                if (!IsGrass(q)) continue;
                bool near = false;
                foreach (var f in _fires) if (Flat(f.Pos - q) < Radius) { near = true; break; }
                if (!near) return true;
            }
            q = Vector3.zero;
            return false;
        }

        public void ClearForTest() { foreach (var f in _fires) Drop(f); _fires.Clear(); }

        private static void Drop(Spot f) { if (f.Body != null) Destroy(f.Body); }

        private static float Flat(Vector3 d) { d.y = 0f; return d.magnitude; }

        private static Vector3 Ground(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            p.y = Physics.Raycast(new Vector3(p.x, 80f, p.z), Vector3.down, out var hit, 200f, ~0, QueryTriggerInteraction.Ignore) ? hit.point.y : TestMapData.GroundHeight(gx, gy);
            return p;
        }

        /// <summary>불꽃 몸 — 발밑 그을음 판 하나 + 빛나는 공 다섯(그림자 없음, 머티리얼 한 벌 나눠 씀). 그림 에셋 없이 코드 효과(웹·고돗과 같음).</summary>
        private GameObject Flames(Vector3 p)
        {
            if (_flameMat == null)
            {
                var sh = Shader.Find("Universal Render Pipeline/Unlit");
                _flameMat = new Material(sh) { name = "FieldFire (generated)", color = new Color(1f, 0.5f, 0.12f) };
                _coreMat = new Material(sh) { name = "FieldFireCore (generated)", color = new Color(1f, 0.85f, 0.35f) };
                _scorchMat = new Material(sh) { name = "FieldScorch (generated)", color = new Color(0.08f, 0.05f, 0.03f) };
            }
            var root = new GameObject("FireSpot");
            root.transform.SetParent(transform, false);
            root.transform.position = Ground(p);
            var disc = Part(PrimitiveType.Cylinder, "Scorch", root.transform, _scorchMat);
            disc.transform.localPosition = new Vector3(0f, 0.04f, 0f);
            disc.transform.localScale = new Vector3(Radius * 1.6f, 0.02f, Radius * 1.6f);
            for (int i = 0; i < 5; i++)
            {
                float a = i * Mathf.PI * 2f / 5f + 0.4f;
                float r = i == 0 ? 0f : Radius * 0.45f;
                var fl = Part(PrimitiveType.Sphere, "Flame" + i, root.transform, i == 0 ? _coreMat : _flameMat);
                fl.transform.localPosition = new Vector3(Mathf.Cos(a) * r, 0.7f, Mathf.Sin(a) * r);
                fl.transform.localScale = i == 0 ? CoreSize : PetalSize;
            }
            return root;
        }

        private static GameObject Part(PrimitiveType t, string name, Transform parent, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.name = name;
            go.transform.SetParent(parent, false);
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }
    }
}
