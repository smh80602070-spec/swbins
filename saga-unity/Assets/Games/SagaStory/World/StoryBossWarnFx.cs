using UnityEngine;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 109-11-1 보스 패턴 예고(웹 `side-view.js` 덧그림 zonewarn·quakewarn·sweepwarn 자리).
    /// 판에 떨어질 자리를 먼저 그리고, 터질 때가 다가올수록 진해진다. 수명이 다하면 스스로 사라진다.
    ///   · 원(내려찍기·낙석) — 땅 위 붉은 원판 + 테두리, 낙석은 위에서 떨어지는 그림자 기둥까지
    ///   · 지진 — 판 전체 바닥 띠(주황, 일렁임) + "⬆ 점프!"
    ///   · 휩쓸기 — 안전지대 밖 판 전체가 붉은 막, 안전지대는 초록 기둥 + "안전"
    /// 재질은 `Sprites/Default`(HitSpark 와 같은 투명 무조명)라 빌드에 따로 넣을 셰이더가 없다.
    /// </summary>
    public class StoryBossWarnFx : MonoBehaviour
    {
        public static readonly Color Red = new Color(0.95f, 0.18f, 0.12f);
        public static readonly Color Orange = new Color(1f, 0.55f, 0.1f);
        public static readonly Color Green = new Color(0.25f, 0.95f, 0.35f);
        private const float Depth = 3.2f;       // 판 깊이(Z) — 비경 방 4m·들판 길 안쪽
        private const float SweepHeight = 5.5f;
        private const float PillarHeight = 6f;

        public enum Look { Circle, RockCircle, Quake, SweepRed, SweepSafe, Beam, Pillar }
        public static readonly Color Violet = new Color(0.7f, 0.35f, 1f);

        private float _life, _t;
        private Look _look;
        private Color _color;
        private Renderer[] _bodies;
        private float[] _baseAlpha;
        private TMPro.TextMeshPro _text;
        private Camera _cam;
        private static Material _shared;

        public Look Kind => _look;
        public float LifeLeft => _life - _t;
        /// <summary>진단 — 지금 떠 있는 예고 수.</summary>
        public static int ActiveCount { get; private set; }

        private static Material SharedMaterial()
        {
            if (_shared == null) _shared = new Material(Shader.Find("Sprites/Default")) { name = "StoryBossWarn (generated)" };
            return _shared;
        }

        /// <summary>원 — 내려찍기(Circle)·낙석(RockCircle, 그림자 기둥 더함). x·y 는 발 자리, r 은 판정 반지름.</summary>
        public static StoryBossWarnFx Circle(float x, float y, float r, float life, bool rock, Transform parent, Color? color = null)
        {
            var fx = Make(rock ? "BossWarnRock" : "BossWarnSlam", new Vector3(x, y, 0f), life, rock ? Look.RockCircle : Look.Circle, color ?? (rock ? Orange : Red), parent);
            fx.AddPiece(PrimitiveType.Cylinder, new Vector3(0f, 0.04f, 0f), new Vector3(r * 2f, 0.01f, Mathf.Min(r * 2f, Depth)), 0.5f);
            fx.AddPiece(PrimitiveType.Cylinder, new Vector3(0f, 0.05f, 0f), new Vector3(r * 2f + 0.14f, 0.005f, Mathf.Min(r * 2f, Depth) + 0.14f), 0.9f);
            if (rock) fx.AddPiece(PrimitiveType.Cylinder, new Vector3(0f, PillarHeight * 0.5f, 0f), new Vector3(r * 1.2f, PillarHeight * 0.5f, r * 1.2f), 0.18f);
            fx.Tick(0f);
            return fx;
        }

        /// <summary>지진 — 판 전체 바닥 띠.</summary>
        public static StoryBossWarnFx Quake(float minX, float maxX, float floorY, float playerX, float life, string label, Transform parent)
        {
            var fx = Make("BossWarnQuake", new Vector3((minX + maxX) * 0.5f, floorY, 0f), life, Look.Quake, Orange, parent);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, 0.06f, 0f), new Vector3(maxX - minX, 0.12f, Depth), 0.55f);
            fx.AddText(label, new Vector3(playerX - (minX + maxX) * 0.5f, 2.6f, 0f), Orange);
            fx.Tick(0f);
            return fx;
        }

        /// <summary>109-11-2 쇠뇌 — 머리 높이(바닥 위 y)에 판 전체 붉은 띠 + "⬇ 뛰지 마라!".</summary>
        public static StoryBossWarnFx Beam(float minX, float maxX, float floorY, float y, float playerX, float life, string label, Transform parent)
        {
            var fx = Make("BossWarnBeam", new Vector3((minX + maxX) * 0.5f, floorY, 0f), life, Look.Beam, Red, parent);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, y, 0f), new Vector3(maxX - minX, 0.35f, Depth), 0.45f);
            fx.AddText(label, new Vector3(playerX - (minX + maxX) * 0.5f, y + 1.1f, 0f), Red);
            fx.Tick(0f);
            return fx;
        }

        /// <summary>109-11-2 불기둥 한 칸 — 가운데 x, 반폭 halfW 의 불빛 기둥.</summary>
        public static StoryBossWarnFx Pillar(float x, float floorY, float halfW, float life, Transform parent)
        {
            var fx = Make("BossWarnPillar", new Vector3(x, floorY, 0f), life, Look.Pillar, new Color(1f, 0.32f, 0.08f), parent);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, PillarHeight * 0.5f, 0f), new Vector3(halfW * 2f, PillarHeight, 0.3f), 0.3f);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, 0.05f, 0f), new Vector3(halfW * 2f, 0.1f, Depth), 0.55f);
            fx.Tick(0f);
            return fx;
        }

        /// <summary>109-11-2 추적 — 예고가 발을 따라온다.</summary>
        public void MoveTo(float x, float y) => transform.position = new Vector3(x, y, 0f);

        /// <summary>휩쓸기 — 안전지대 [safeX ± w/2] 밖은 붉은 막, 안은 초록 기둥(109-11-2 도넛도 같은 그림 — 두목 곁이 안전).</summary>
        public static void Sweep(float minX, float maxX, float floorY, float safeX, float w, float life, string label, Transform parent, System.Collections.Generic.List<StoryBossWarnFx> into)
        {
            float lo = safeX - w * 0.5f, hi = safeX + w * 0.5f;
            if (lo > minX) into.Add(RedWall(minX, lo, floorY, life, parent));
            if (hi < maxX) into.Add(RedWall(hi, maxX, floorY, life, parent));
            var safe = Make("BossWarnSafe", new Vector3(safeX, floorY, 0f), life, Look.SweepSafe, Green, parent);
            safe.AddPiece(PrimitiveType.Cube, new Vector3(0f, SweepHeight * 0.5f, 0f), new Vector3(w, SweepHeight, 0.2f), 0.28f);
            safe.AddPiece(PrimitiveType.Cylinder, new Vector3(0f, 0.05f, 0f), new Vector3(w, 0.01f, Depth), 0.6f);
            safe.AddText(label, new Vector3(0f, SweepHeight * 0.55f, -0.2f), Green);
            safe.Tick(0f);
            into.Add(safe);
        }

        private static StoryBossWarnFx RedWall(float x0, float x1, float floorY, float life, Transform parent)
        {
            var fx = Make("BossWarnSweep", new Vector3((x0 + x1) * 0.5f, floorY, 0f), life, Look.SweepRed, Red, parent);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, SweepHeight * 0.5f, 0.4f), new Vector3(x1 - x0, SweepHeight, 0.1f), 0.3f);
            fx.AddPiece(PrimitiveType.Cube, new Vector3(0f, 0.05f, 0f), new Vector3(x1 - x0, 0.1f, Depth), 0.4f);
            fx.Tick(0f);
            return fx;
        }

        private static StoryBossWarnFx Make(string name, Vector3 pos, float life, Look look, Color color, Transform parent)
        {
            var go = new GameObject(name);
            if (parent != null) go.transform.SetParent(parent, true);
            go.transform.position = pos;
            var fx = go.AddComponent<StoryBossWarnFx>();
            fx._life = life;
            fx._look = look;
            fx._color = color;
            fx._bodies = new Renderer[0];
            fx._baseAlpha = new float[0];
            fx._cam = Camera.main;
            ActiveCount++;
            return fx;
        }

        private void AddPiece(PrimitiveType type, Vector3 localPos, Vector3 scale, float alpha)
        {
            var p = GameObject.CreatePrimitive(type);
            p.name = "Piece";
            var col = p.GetComponent<Collider>();
            if (col != null) { col.enabled = false; Destroy(col); }
            p.transform.SetParent(transform, false);
            p.transform.localPosition = localPos;
            p.transform.localScale = scale;
            var r = p.GetComponent<Renderer>();
            r.sharedMaterial = SharedMaterial();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            System.Array.Resize(ref _bodies, _bodies.Length + 1);
            System.Array.Resize(ref _baseAlpha, _baseAlpha.Length + 1);
            _bodies[_bodies.Length - 1] = r;
            _baseAlpha[_baseAlpha.Length - 1] = alpha;
        }

        private void AddText(string text, Vector3 localPos, Color color)
        {
            var go = new GameObject("Label");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localPos;
            _text = Saga.Core.SagaWorldText.Add(go, text, 48f * 0.2f, color);
        }

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            _t += dt;
            float k = _life > 0f ? Mathf.Clamp01(_t / _life) : 1f;
            // 터질 때가 다가올수록 진해진다(웹 zonewarn 과 같은 결), 지진 띠는 일렁인다.
            float gain = Mathf.Lerp(0.45f, 1f, k);
            if (_look == Look.Quake) gain *= 0.75f + 0.25f * Mathf.Sin(_t * 18f);
            var block = new MaterialPropertyBlock();
            for (int i = 0; i < _bodies.Length; i++)
            {
                if (_bodies[i] == null) continue;
                block.SetColor("_Color", new Color(_color.r, _color.g, _color.b, Mathf.Clamp01(_baseAlpha[i] * gain)));
                _bodies[i].SetPropertyBlock(block);
            }
            if (_text != null && _cam != null) _text.transform.rotation = _cam.transform.rotation;
            if (_t >= _life) Destroy(gameObject);
        }

        private void OnDestroy() => ActiveCount = Mathf.Max(0, ActiveCount - 1);
    }
}
