using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.Story.Player
{
    /// <summary>
    /// PLAN.md 101-3 G "장비 가시화" — DUNGEON/GO `WeaponVisual`과 같은
    /// 목적(장착 무기를 실제로 손에 들려 보여준다)이지만 **재해석**이
    /// 필요했다(PLAN.md 101-3 표·docs/PROJECT_STATE.md "여기만 사용자 결정
    /// 필요" 항목, 2026-09-18 사용자가 "직업별 무기 소켓" 선택). STORY엔
    /// `ItemData`/등급 시스템 자체가 없다(순수 job 스탯) — "무기 등급"이
    /// 아니라 "직업별 다른 무기"로 갈린다: 무사→검, 궁수→활, 협객→표창,
    /// 방사→지팡이. 전직 전(NoJob)엔 무기 없이 맨손.
    ///
    /// 무기 메시 자산이 없어(원작 자산 금지) DUNGEON/GO와 같은 결로
    /// primitive를 코드로 짜 맞춘다. 소켓은 `CharacterVisual.
    /// FindOrCreateWeaponSocket()`(Humanoid Animator면 오른손 본, 아니면
    /// 시각 루트 밑 고정 오프셋 폴백). `StoryJobState.JobChosen`을 구독해
    /// 전직 순간(딱 한 번)에만 다시 짓는다.
    /// </summary>
    [RequireComponent(typeof(StoryPlayerController))]
    public class StoryWeaponVisual : MonoBehaviour
    {
        private static readonly Color HandleColor = new Color(0.3f, 0.22f, 0.15f);
        private static readonly Color SwordColor = new Color(0.75f, 0.78f, 0.8f);
        private static readonly Color BowColor = new Color(0.42f, 0.28f, 0.14f);
        private static readonly Color BowStringColor = new Color(0.9f, 0.9f, 0.85f);
        private static readonly Color DaggerColor = new Color(0.7f, 0.72f, 0.75f);
        private static readonly Color StaffShaftColor = new Color(0.35f, 0.24f, 0.12f);
        private static readonly Color StaffOrbColor = new Color(0.45f, 0.65f, 1f);

        private StoryPlayerController _controller;
        private Transform _socket;
        private Transform _weaponRoot;

        private void Awake()
        {
            _controller = GetComponent<StoryPlayerController>();
        }

        private void Start()
        {
            BuildSocket();
            StoryJobState.JobChosen += OnJobChosen;
            Refresh();
        }

        private void OnDestroy()
        {
            StoryJobState.JobChosen -= OnJobChosen;
        }

        private void OnJobChosen(string jobKey) => Refresh();

        private void BuildSocket()
        {
            if (_controller.Visual == null) return;
            _socket = CharacterVisual.FindOrCreateWeaponSocket(_controller.Visual.gameObject, _controller.Animator);
        }

        /// <summary>테스트 전용(리플렉션 대신) — 지금 손에 들린 무기 루트.
        /// null이면 맨손(전직 전).</summary>
        public Transform CurrentWeaponRoot => _weaponRoot;

        private void Refresh()
        {
            if (_socket == null) return;
            if (_weaponRoot != null) Destroy(_weaponRoot.gameObject);

            if (!StoryJobState.HasJob) return; // 전직 전 — 맨손 그대로.

            var root = new GameObject("Weapon (generated)").transform;
            root.SetParent(_socket, false);
            _weaponRoot = root;

            switch (StoryJobState.Root) // 2차(장군 등)도 갈래 뿌리의 무기를 든다(2026-09-23)
            {
                case "warrior": BuildSword(root); break;
                case "archer": BuildBow(root); break;
                case "rogue": BuildDagger(root); break;
                case "mage": BuildStaff(root); break;
            }
        }

        private static void BuildSword(Transform root)
        {
            const float bladeLength = 0.55f;
            AddHandle(root);
            var blade = CreatePart(root, PrimitiveType.Cube, SwordColor);
            blade.transform.localScale = new Vector3(0.08f, bladeLength, 0.02f);
            blade.transform.localPosition = new Vector3(0f, bladeLength * 0.5f, 0f);
        }

        /// <summary>활(弓) — 굽은 활을 표현할 primitive가 없어(CreatePrimitive는
        /// 원기둥·구·정육면체뿐) 시위가 걸린 활대(수직 원기둥)로 근사한다.</summary>
        private static void BuildBow(Transform root)
        {
            const float staveLength = 0.9f;
            var stave = CreatePart(root, PrimitiveType.Cylinder, BowColor);
            stave.transform.localScale = new Vector3(0.03f, staveLength * 0.5f, 0.03f);
            stave.transform.localPosition = new Vector3(0f, 0f, 0.1f);

            var stringPart = CreatePart(root, PrimitiveType.Cylinder, BowStringColor);
            stringPart.transform.localScale = new Vector3(0.006f, staveLength * 0.5f, 0.006f);
            stringPart.transform.localPosition = Vector3.zero;
        }

        /// <summary>표창(標槍) — 협객의 투척 무기, 자루 없이 회전한 얇은
        /// 사각판 하나로 별 모양을 흉내낸다.</summary>
        private static void BuildDagger(Transform root)
        {
            var blade = CreatePart(root, PrimitiveType.Cube, DaggerColor);
            blade.transform.localScale = new Vector3(0.18f, 0.18f, 0.015f);
            blade.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            blade.transform.localRotation = Quaternion.Euler(0f, 0f, 45f);
        }

        private static void BuildStaff(Transform root)
        {
            const float shaftLength = 0.9f;
            var shaft = CreatePart(root, PrimitiveType.Cylinder, StaffShaftColor);
            shaft.transform.localScale = new Vector3(0.03f, shaftLength * 0.5f, 0.03f);
            shaft.transform.localPosition = new Vector3(0f, shaftLength * 0.5f, 0f);

            var orb = CreatePart(root, PrimitiveType.Sphere, StaffOrbColor);
            orb.transform.localScale = Vector3.one * 0.14f;
            orb.transform.localPosition = new Vector3(0f, shaftLength + 0.05f, 0f);
            var orbMat = orb.GetComponent<MeshRenderer>().sharedMaterial;
            orbMat.EnableKeyword("_EMISSION");
            orbMat.SetColor("_EmissionColor", StaffOrbColor * 0.8f);
        }

        private static void AddHandle(Transform root)
        {
            var handle = CreatePart(root, PrimitiveType.Cylinder, HandleColor);
            handle.transform.localScale = new Vector3(0.05f, 0.12f, 0.05f);
            handle.transform.localPosition = Vector3.zero;
        }

        private static GameObject CreatePart(Transform parent, PrimitiveType type, Color color)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = $"Weapon{type} (generated)";
            Saga.Core.Colliders.Strip(go);
            go.transform.SetParent(parent, false);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = $"Weapon{type} (generated)" };
            mat.color = color;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }
    }
}
