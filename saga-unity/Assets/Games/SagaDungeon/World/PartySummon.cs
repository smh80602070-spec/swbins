using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 106-6 "소환수 대형 연출" — 소환 게이지가 차면 부르는 "바위 거신"(가상, 원작 소환수 이름 없음).
    /// 두목 모델(Brute)을 3.2배로 키워 돌빛을 입히고, 발밑 금빛 진·큰 점광과 함께 땅에서 솟아(0~1.4초) 주먹으로
    /// 땅을 내리친다(3.2초 — 14m 안 살아 있는 적 전부에 플레이어 한 타 × 15, 강공격 판정이라 예비동작도 끊긴다).
    /// 4.2초부터 가라앉아 5초에 사라진다. 컷(`DungeonCutscenes.PlaySummon`)은 카메라·제목만 맡고, 시간은 이 개체가
    /// 스스로 센다 — 컷이 넘겨지거나 없으면 `ResolveNow()` 가 내리치기를 그 자리에서 끝낸다(피해는 한 번만).
    /// </summary>
    public class PartySummon : MonoBehaviour
    {
        public const float Radius = 14f;
        public const float DamageMul = 15f;
        public const float Scale = 3.2f;
        public const float RiseSec = 1.4f;
        public const float SwingSec = 2.7f;  // 공격 클립을 틀어 내리치는 순간이 SlamSec 에 닿게.
        public const float SlamSec = 3.2f;
        public const float SinkStartSec = 4.2f;
        public const float EndSec = 5.0f;
        public const float StandOffM = 4f;
        private const float FallbackHeight = 6f;

        private static readonly Color StoneTint = new Color(0.78f, 0.7f, 0.55f);
        private static readonly Color RuneColor = new Color(1f, 0.8f, 0.35f);

        private Transform _body;
        private Animator _animator;
        private Light _light;
        private LineRenderer _circle;
        private LineRenderer _shock;
        private float _t;
        private float _height;
        private bool _swung;
        private bool _slammed;
        private float _shockT = -1f;

        public bool Slammed => _slammed;
        public int LastHitCount { get; private set; }
        public float Elapsed => _t;
        public static int SlamCount { get; private set; } // 진단용 누적.

        /// <summary>PLAN.md 106-6 남은 것 "소환수 전용 모델·발광 재질"(2026-09-24) — 두목(Brute) 뼈대 위에 CC0 바위(Kenney
        /// rock_largeA/smallA, 돌 재질 PolyHaven rock_boulder_dry)를 마디마다 붙여 걷고 내리치는 바위 거신으로 만든다.
        /// 가슴 한가운데·두 주먹에 금빛으로 달아오른 돌 조각(발광 재질). 사람 뼈대가 아니거나 바위가 없으면 예전 돌빛 틴트.</summary>
        public struct Look
        {
            public GameObject RockLarge;
            public GameObject RockSmall;
            public Material Stone;
        }

        public int GolemChunks { get; private set; }
        public int GolemRunes { get; private set; }

        /// <summary>플레이어 앞 `StandOffM`(벽이 가까우면 벽 앞)에 세운다.</summary>
        public static PartySummon Spawn(GameObject modelPrefab, Vector3 playerPos, Vector3 playerForward) =>
            Spawn(modelPrefab, playerPos, playerForward, default);

        public static PartySummon Spawn(GameObject modelPrefab, Vector3 playerPos, Vector3 playerForward, Look look)
        {
            Vector3 fwd = playerForward;
            fwd.y = 0f;
            fwd = fwd.sqrMagnitude > 0.01f ? fwd.normalized : Vector3.forward;
            float d = StandOffM;
            Vector3 chest = playerPos + Vector3.up * 1.2f;
            if (Physics.Raycast(chest, fwd, out RaycastHit hit, StandOffM + 1.5f, ~0, QueryTriggerInteraction.Ignore))
            {
                d = Mathf.Clamp(hit.distance - 1.5f, 1.5f, StandOffM);
            }
            var go = new GameObject("PartySummon");
            go.transform.position = new Vector3(playerPos.x, playerPos.y, playerPos.z) + fwd * d;
            go.transform.rotation = Quaternion.LookRotation(fwd);
            var s = go.AddComponent<PartySummon>();
            s.Build(modelPrefab, look);
            return s;
        }

        private void Build(GameObject modelPrefab, Look look)
        {
            var bodyRoot = new GameObject("Body").transform;
            bodyRoot.SetParent(transform, false);
            _body = bodyRoot;
            if (modelPrefab != null && modelPrefab.GetComponent<Animator>() != null)
            {
                var inst = Instantiate(modelPrefab, bodyRoot, false);
                inst.name = "Visual";
                inst.transform.localScale = Vector3.one * Scale;
                _animator = inst.GetComponent<Animator>();
                if (!BuildGolem(inst, look)) CharacterVisual.Tint(inst, StoneTint);
                _height = 1.9f * Scale;
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(bodyRoot, FallbackHeight, StoneTint);
                _height = FallbackHeight;
            }
            _body.localPosition = new Vector3(0f, -_height, 0f);

            _light = gameObject.AddComponent<Light>();
            _light.type = LightType.Point;
            _light.color = RuneColor;
            _light.range = 18f;
            _light.intensity = 0f;

            _circle = Ring("SummonCircle", 3.5f, 0.12f);
            _shock = Ring("SlamShock", 1f, 0.25f);
            _shock.enabled = false;
            SfxPlayer.PlayHeavyHit();
        }

        // 마디(시작 뼈 → 끝 뼈)마다 바위 한 덩이 — 굵기는 마디 길이에 곱한다. 손·머리·발은 끝 뼈가 없어 앞 마디를 늘여 쓴다.
        private static readonly (HumanBodyBones From, HumanBodyBones To, bool Large, float Thick)[] Segments =
        {
            (HumanBodyBones.Hips, HumanBodyBones.Neck, true, 0.85f),
            (HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, true, 0.55f),
            (HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, true, 0.55f),
            (HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand, true, 0.5f),
            (HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand, true, 0.5f),
            (HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, true, 0.55f),
            (HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, true, 0.55f),
            (HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot, true, 0.5f),
            (HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot, true, 0.5f),
        };

        // 끝 마디: (뼈, 방향을 잡을 앞 뼈, 앞 마디 대비 길이, 굵기, 큰 바위?) — 주먹은 크게, 머리는 작게.
        private static readonly (HumanBodyBones Bone, HumanBodyBones Prev, float LenMul, float Thick, bool Large)[] Tips =
        {
            (HumanBodyBones.Head, HumanBodyBones.Neck, 2.2f, 0.9f, false),
            (HumanBodyBones.LeftHand, HumanBodyBones.LeftLowerArm, 0.45f, 1.5f, true),
            (HumanBodyBones.RightHand, HumanBodyBones.RightLowerArm, 0.45f, 1.5f, true),
            (HumanBodyBones.LeftFoot, HumanBodyBones.LeftLowerLeg, 0.4f, 1.2f, false),
            (HumanBodyBones.RightFoot, HumanBodyBones.RightLowerLeg, 0.4f, 1.2f, false),
        };

        /// <summary>두목 몸을 숨기고 뼈마다 바위를 붙인다. 붙였으면 true.</summary>
        private bool BuildGolem(GameObject inst, Look look)
        {
            if (_animator == null || !_animator.isHuman || look.RockLarge == null || look.RockSmall == null) return false;
            Material stone = look.Stone != null ? look.Stone : new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = StoneTint };
            var rune = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "SummonRune (generated)", color = new Color(0.25f, 0.18f, 0.1f) };
            rune.EnableKeyword("_EMISSION");
            rune.SetColor("_EmissionColor", RuneColor * 4f);
            rune.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;

            int chunks = 0;
            foreach (var s in Segments)
            {
                var a = _animator.GetBoneTransform(s.From);
                var b = _animator.GetBoneTransform(s.To);
                if (a == null || b == null) continue;
                if (Chunk(s.Large ? look.RockLarge : look.RockSmall, stone, a, a.position, b.position, s.Thick, chunks)) chunks++;
            }
            foreach (var t in Tips)
            {
                var bone = _animator.GetBoneTransform(t.Bone);
                var prev = _animator.GetBoneTransform(t.Prev);
                if (bone == null || prev == null) continue;
                Vector3 dir = bone.position - prev.position;
                Vector3 end = bone.position + dir * t.LenMul;
                if (Chunk(t.Large ? look.RockLarge : look.RockSmall, stone, bone, bone.position, end, t.Thick, chunks)) chunks++;
            }
            if (chunks < 10) return false; // 뼈가 모자란 모델 — 반쯤 붙은 괴물보다 예전 틴트가 낫다.

            // 발광: 가슴 한가운데 하나, 두 주먹에 하나씩.
            int runes = 0;
            var chest = _animator.GetBoneTransform(HumanBodyBones.Chest) ?? _animator.GetBoneTransform(HumanBodyBones.Spine);
            var hips = _animator.GetBoneTransform(HumanBodyBones.Hips);
            var neck = _animator.GetBoneTransform(HumanBodyBones.Neck);
            if (chest != null && hips != null && neck != null)
            {
                float torso = Vector3.Distance(hips.position, neck.position);
                Vector3 front = inst.transform.forward * torso * 0.45f;
                if (Chunk(look.RockSmall, rune, chest, chest.position + front, chest.position + front + Vector3.up * torso * 0.25f, 1.2f, 100)) runes++;
            }
            foreach (var hb in new[] { HumanBodyBones.LeftHand, HumanBodyBones.RightHand })
            {
                var hand = _animator.GetBoneTransform(hb);
                var lower = _animator.GetBoneTransform(hb == HumanBodyBones.LeftHand ? HumanBodyBones.LeftLowerArm : HumanBodyBones.RightLowerArm);
                if (hand == null || lower == null) continue;
                Vector3 dir = hand.position - lower.position;
                if (Chunk(look.RockSmall, rune, hand, hand.position + dir * 0.3f, hand.position + dir * 0.55f, 1.3f, 200 + runes)) runes++;
            }

            foreach (var r in inst.GetComponentsInChildren<SkinnedMeshRenderer>(true)) r.enabled = false;
            GolemChunks = chunks;
            GolemRunes = runes;
            return true;
        }

        /// <summary>`from`→`to` 를 따라 누운 바위 한 덩이를 월드 크기로 맞춰 `bone` 에 붙인다(뼈를 따라 움직인다).</summary>
        private static bool Chunk(GameObject prefab, Material mat, Transform bone, Vector3 from, Vector3 to, float thick, int seed)
        {
            Vector3 dir = to - from;
            float len = dir.magnitude;
            if (len < 0.01f) return false;
            var rock = Instantiate(prefab);
            rock.name = "GolemRock";
            foreach (var c in rock.GetComponentsInChildren<Collider>(true)) Destroy(c);
            var mesh = rock.GetComponentInChildren<MeshFilter>();
            Vector3 size = mesh != null && mesh.sharedMesh != null ? Vector3.Scale(mesh.sharedMesh.bounds.size, mesh.transform.lossyScale) : Vector3.one;
            size = new Vector3(Mathf.Max(size.x, 0.01f), Mathf.Max(size.y, 0.01f), Mathf.Max(size.z, 0.01f));
            float w = len * thick;
            rock.transform.rotation = Quaternion.LookRotation(dir / len) * Quaternion.Euler(0f, 0f, seed * 67f % 360f);
            rock.transform.localScale = new Vector3(w / size.x, w / size.y, len * 1.15f / size.z);
            rock.transform.position = Vector3.zero;
            var renderers = rock.GetComponentsInChildren<MeshRenderer>(true);
            // 기울어진 상자의 AABB 가운데 = 상자 가운데 — 모델 원점이 바닥에 있어도 마디 한가운데로 맞춘다.
            Vector3 center = renderers.Length > 0 ? renderers[0].bounds.center : Vector3.zero;
            rock.transform.position = (from + to) * 0.5f - center;
            foreach (var r in renderers)
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++) mats[i] = mat;
                r.sharedMaterials = mats;
            }
            rock.transform.SetParent(bone, true);
            return true;
        }

        private LineRenderer Ring(string name, float radius, float width)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 0.07f, 0f);
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = false;
            lr.loop = true;
            lr.widthMultiplier = width;
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.startColor = lr.endColor = RuneColor;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            SetRadius(lr, radius);
            return lr;
        }

        private static void SetRadius(LineRenderer lr, float radius)
        {
            const int seg = 48;
            lr.positionCount = seg;
            for (int i = 0; i < seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                lr.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius));
            }
        }

        private void Update() => Tick(Time.deltaTime);

        /// <summary>한 프레임 — 진단이 시간을 직접 넣는다. 끝나면 스스로 사라진다.</summary>
        public void Tick(float dt)
        {
            _t += dt;
            float rise = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(_t / RiseSec));
            float sink = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((_t - SinkStartSec) / (EndSec - SinkStartSec)));
            if (_body != null) _body.localPosition = new Vector3(0f, -_height * (1f - rise + sink), 0f);
            if (_light != null) _light.intensity = 8f * rise * (1f - sink);

            if (!_swung && _t >= SwingSec)
            {
                _swung = true;
                if (_animator != null) _animator.SetTrigger("Attack");
            }
            if (!_slammed && _t >= SlamSec) Slam();

            if (_shockT >= 0f && _shock != null)
            {
                _shockT += dt;
                float k = Mathf.Clamp01(_shockT / 0.5f);
                SetRadius(_shock, Mathf.Lerp(1f, Radius, k));
                _shock.startColor = _shock.endColor = new Color(RuneColor.r, RuneColor.g, RuneColor.b, 1f - k);
                if (k >= 1f) _shock.enabled = false;
            }
            if (_t >= EndSec) Destroy(gameObject);
        }

        /// <summary>컷이 넘겨졌거나 없을 때 — 아직 안 내리쳤으면 지금 내리치고 곧바로 사라진다.</summary>
        public void ResolveNow()
        {
            if (this == null) return;
            if (!_slammed) Slam();
            Destroy(gameObject);
        }

        private void Slam()
        {
            _slammed = true;
            SlamCount++;
            float damage = HeroState.HitDamage * DamageMul;
            int n = 0;
            Vector3 c = transform.position;
            // 목록을 베껴 돈다 — 죽는 적이 OnDisable 로 Active 에서 빠진다.
            foreach (var e in DungeonEnemy.Active.ToArray())
            {
                if (e == null || !e.IsAlive) continue;
                Vector3 d = e.transform.position - c;
                d.y = 0f;
                if (d.magnitude > Radius) continue;
                e.TakeDamage(damage, heavy: true);
                n++;
            }
            LastHitCount = n;
            if (_shock != null)
            {
                _shock.enabled = true;
                _shockT = 0f;
            }
            if (_circle != null) _circle.enabled = false;
            GroundDecal.Spawn(c, GroundDecal.Kind.HitMark);
            HitSpark.Spawn(c + Vector3.up * 0.5f, heavy: true);
            SfxPlayer.PlayHeavyHit();
        }
    }
}
