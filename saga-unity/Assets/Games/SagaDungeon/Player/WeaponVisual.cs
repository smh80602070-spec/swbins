using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// PLAN.md 101-3 G "장비 가시화" — 장착 무기가 그동안 순수 스탯
    /// 보너스일 뿐 화면엔 아무 변화가 없던 것을 실제로 손에 들려 보여준다.
    /// 무기 메시 자산이 없어(원작 자산 금지 원칙, 루트 CLAUDE.md) 자루+
    /// 칼날을 코드로 짓는다 — `LootMarker.cs`·`HitSpark.cs`와 같은 결.
    /// 소켓은 `CharacterVisual.FindOrCreateWeaponSocket()`(Humanoid
    /// Animator면 오른손 본, 아니면 시각 루트 밑 고정 오프셋 폴백) — 실제
    /// "쥔" 포즈로 리깅된 게 아니라 손 본 자리에 얹어 두는 근사치다.
    /// 등급 3단(`ItemData.Grade`)에 따라 칼날 길이·이미시브 림만 갈린다
    /// (표의 "등급별 이미시브 림 3단") — 0=무광, 1=옅은 청록, 2=강한 금색.
    /// `HeroState.EquipmentChanged`를 구독해 무기가 바뀔 때만 갱신한다.
    /// PLAN.md 101-2 5.7 "미래 무기 look" — `ItemData.WeaponShape`가
    /// Lance·Gauntlet이면 같은 칼날 메시를 아예 다른 비율로 리사이즈해
    /// 창·건틀릿처럼 보이게 한다(등급 이미시브 림 3단과 별개 축).
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public class WeaponVisual : MonoBehaviour
    {
        private static readonly Color[] GradeEmission =
        {
            Color.black,
            new Color(0.25f, 0.55f, 0.5f) * 0.6f,
            new Color(1f, 0.78f, 0.25f) * 1.6f,
        };

        private const float BladeLength = 0.55f;
        private const float BladeLengthPerGrade = 0.08f; // 등급이 높을수록 살짝 더 큰 무기.
        private const float BladeWidth = 0.08f;
        private const float BladeThickness = 0.02f;

        // PLAN.md 101-2 5.7 "미래 무기 look" — 등급 이미시브 림과 별개로
        // 모양 자체가 갈리는 두 종(ItemData.WeaponShape). 창은 길고 얇게,
        // 건틀릿은 짧고 두껍게 — 등급 배율은 그대로 얹되(칼날 하나만
        // 리사이즈하는 기존 방식 유지) 형태 자체를 다르게 스케일한다.
        private const float LanceExtraLength = 0.5f;
        private const float LanceWidthMul = 0.5f;
        private static readonly Color LanceEmission = new Color(0.3f, 0.9f, 1f) * 1.4f; // 전자창 — 항상 청록 발광(등급 무관).
        private const float GauntletLength = 0.22f;
        private const float GauntletWidthMul = 3.5f;
        private const float GauntletThicknessMul = 3f;
        private static readonly Color GauntletEmission = new Color(0.85f, 0.9f, 0.95f) * 1.1f; // 동력장갑 — 은백색 발광.

        private static readonly Color HandleColor = new Color(0.3f, 0.22f, 0.15f);
        private static readonly Color BladeBaseColor = new Color(0.75f, 0.78f, 0.8f);

        private PlayerController _controller;
        private Transform _blade;
        private MeshRenderer _bladeRenderer;
        private MeshRenderer _handleRenderer;
        private Transform _socket;
        private GameObject _model;      // U-0038 A — 자체툴 무기 GLB(있으면 코드 칼날·손잡이는 숨기고 이것을 쥔다)
        private string _modelName;

        private void Awake()
        {
            _controller = GetComponent<PlayerController>();
        }

        private void Start()
        {
            BuildVisual();
            HeroState.EquipmentChanged += OnEquipmentChanged;
            Refresh();
        }

        private void OnDestroy()
        {
            HeroState.EquipmentChanged -= OnEquipmentChanged;
        }

        private void OnEquipmentChanged(string weaponId) => Refresh();

        private void BuildVisual()
        {
            if (_controller.Visual == null) return;
            var socket = CharacterVisual.FindOrCreateWeaponSocket(_controller.Visual.gameObject, _controller.Animator);

            _socket = socket;
            var handle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            handle.name = "WeaponHandle (generated)";
            Object.Destroy(handle.GetComponent<Collider>());
            handle.transform.SetParent(socket, false);
            handle.transform.localScale = new Vector3(0.05f, 0.12f, 0.05f);
            handle.transform.localPosition = Vector3.zero;
            var handleMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WeaponHandle (generated)" };
            handleMat.color = HandleColor;
            handle.GetComponent<MeshRenderer>().sharedMaterial = handleMat;
            _handleRenderer = handle.GetComponent<MeshRenderer>();

            var blade = GameObject.CreatePrimitive(PrimitiveType.Cube);
            blade.name = "WeaponBlade (generated)";
            Object.Destroy(blade.GetComponent<Collider>());
            blade.transform.SetParent(socket, false);
            var bladeMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WeaponBlade (generated)" };
            bladeMat.color = BladeBaseColor;
            bladeMat.EnableKeyword("_EMISSION");
            blade.GetComponent<MeshRenderer>().sharedMaterial = bladeMat;

            _blade = blade.transform;
            _bladeRenderer = blade.GetComponent<MeshRenderer>();
        }

        private void Refresh()
        {
            if (_blade == null) return;

            var weapon = HeroState.EquippedWeapon;
            int grade = Mathf.Clamp(weapon?.Grade ?? 0, 0, GradeEmission.Length - 1);
            float length = BladeLength + grade * BladeLengthPerGrade;
            var shape = weapon?.Shape ?? ItemData.WeaponShape.Blade;
            Color emission = GradeEmission[grade];

            switch (shape)
            {
                case ItemData.WeaponShape.Lance:
                    length += LanceExtraLength;
                    _blade.localScale = new Vector3(BladeWidth * LanceWidthMul, length, BladeThickness * LanceWidthMul);
                    emission = LanceEmission;
                    break;
                case ItemData.WeaponShape.Gauntlet:
                    length = GauntletLength;
                    _blade.localScale = new Vector3(BladeWidth * GauntletWidthMul, length, BladeThickness * GauntletThicknessMul);
                    emission = GauntletEmission;
                    break;
                default:
                    _blade.localScale = new Vector3(BladeWidth, length, BladeThickness);
                    break;
            }
            _blade.localPosition = new Vector3(0f, length * 0.5f, 0f);
            _bladeRenderer.sharedMaterial.SetColor("_EmissionColor", emission);
            RefreshModel(shape, grade, length);
        }

        /// <summary>U-0038 A — 맞는 무기 GLB 가 있으면 소켓에 세우고 코드 칼날·손잡이는 숨긴다(오브젝트·크기 규칙은 그대로 둔다 — 진단이 읽는다).
        /// 없으면 모델을 걷고 코드 칼날을 다시 보인다.</summary>
        private void RefreshModel(ItemData.WeaponShape shape, int grade, float length)
        {
            string wanted = WeaponModels.ModelName(shape, grade);
            if (_model != null && _modelName == wanted)
            {
                if (WeaponModels.Fit(_model, length, out var r0, out var p0, out var s0)) { /* 같은 모델 — 길이만 갱신 */ ApplyFit(r0, p0, s0); }
                return;
            }
            if (_model != null) { Object.Destroy(_model); _model = null; _modelName = null; }
            var prefab = _socket != null ? WeaponModels.Load(shape, grade) : null;
            if (prefab == null) { SetGeneratedVisible(true); return; }

            var inst = Object.Instantiate(prefab, _socket, false);
            inst.name = "WeaponModel (" + wanted + ")";
            foreach (var c in inst.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            var cache = new System.Collections.Generic.Dictionary<Material, Material>();
            var mats = new System.Collections.Generic.List<Material>();
            foreach (var rend in inst.GetComponentsInChildren<Renderer>(true))
            {
                rend.GetSharedMaterials(mats);
                bool changed = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var made = Saga.Core.Region.RegionMaterials.FromGltf(mats[i], cache, out _);
                    if (made != null && made != mats[i]) { mats[i] = made; changed = true; }
                }
                if (changed) rend.SetSharedMaterials(mats);
            }
            if (!WeaponModels.Fit(inst, length, out var rot, out var pos, out var sc)) { Object.Destroy(inst); SetGeneratedVisible(true); return; }
            _model = inst; _modelName = wanted;
            ApplyFit(rot, pos, sc);
            SetGeneratedVisible(false);
        }

        private void ApplyFit(Quaternion rot, Vector3 pos, float sc)
        {
            _model.transform.localRotation = rot;
            _model.transform.localScale = Vector3.one * sc;
            _model.transform.localPosition = pos;
        }

        private void SetGeneratedVisible(bool visible)
        {
            if (_bladeRenderer != null) _bladeRenderer.enabled = visible;
            if (_handleRenderer != null) _handleRenderer.enabled = visible;
        }
    }
}
