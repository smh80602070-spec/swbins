using UnityEngine;
using Saga.Core;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.Player
{
    /// <summary>
    /// PLAN.md 101-3 G "장비 가시화" — DUNGEON `WeaponVisual`과 같은 로직을
    /// 이 asmdef용으로 새로 짠다(SagaGo가 SagaDungeon을 참조하지 않아
    /// 타입을 직접 못 씀, 루트 CLAUDE.md "다섯 판은 다섯 벌 복사" 원칙).
    /// 장착 무기가 그동안 순수 스탯 보너스일 뿐 화면엔 아무 변화가 없던
    /// 것을 실제로 손에 들려 보여준다. 무기 메시 자산이 없어 자루+칼날을
    /// 코드로 짓는다.
    ///
    /// GO는 DUNGEON과 달리 시작 무기 개념이 없다(`Inventory.EquippedWeaponId`
    /// 기본값 null — "닫힌 빈 손", `Inventory.cs` 클래스 주석 참고) — 미장착
    /// 상태는 0등급(무광)으로 그냥 표시한다(칼을 안 든 것치곤 어색하지만,
    /// 이 슬라이스는 장비 유무 자체를 감추는 손 모델이 없어 범위 밖).
    /// `Inventory.ItemGained`(무기 슬롯만 필터링)로 갱신 — DUNGEON의
    /// `HeroState.EquipmentChanged`와 달리 재장착이 아니라 "주웠다"
    /// 이벤트라 무기가 아닌 방어구를 주웠을 때는 무시해야 한다.
    ///
    /// **U-0049** — 지금 몸이 든 인물의 무기(`WeaponState.Equipped` 종류·희귀도)를 자체툴 GLB(`wpn_*`, <see cref="GoWeaponModels"/>)로 손에 쥔다:
    /// 편성을 바꿔 몸이 바뀌면(`PartyBodies.Shown`) 새 몸 손으로 옮기고 그 인물 무기로 다시 고른다(그전엔 첫 몸 손에만 있었다). 모델이 없으면 코드 칼날 그대로.
    /// 모델이 보이면 코드 칼날·자루는 렌더러만 끈다(`WeaponBlade (generated)` 길이 규칙은 불변).
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
        private const float BladeLengthPerGrade = 0.08f;
        private const float BladeWidth = 0.08f;
        private const float BladeThickness = 0.02f;

        private static readonly Color HandleColor = new Color(0.3f, 0.22f, 0.15f);
        private static readonly Color BladeBaseColor = new Color(0.75f, 0.78f, 0.8f);

        private PlayerController _controller;
        private Transform _blade;
        private MeshRenderer _bladeRenderer;
        private Transform _handle;
        private GameObject _model;
        private string _modelName = "";
        private string _shownId = "hero";

        /// <summary>지금 쥔 모델 이름(없으면 코드 칼날).</summary>
        public string ModelName => _model != null ? _modelName : "";
        public GameObject ModelInstance => _model;
        public bool BladeShown => _bladeRenderer != null && _bladeRenderer.enabled;

        private void Awake()
        {
            _controller = GetComponent<PlayerController>();
        }

        private void Start()
        {
            BuildVisual();
            Inventory.ItemGained += OnItemGained;
            WeaponState.Changed += OnWeaponChanged;
            Saga.Go.Player.PartyBodies.Shown += OnShown;
            Refresh();
            RefreshModel();
        }

        private void OnDestroy()
        {
            Inventory.ItemGained -= OnItemGained;
            WeaponState.Changed -= OnWeaponChanged;
            Saga.Go.Player.PartyBodies.Shown -= OnShown;
        }

        private void OnWeaponChanged() => RefreshModel();

        /// <summary>편성 교체로 몸이 바뀜 — 새 몸 손으로 옮기고 그 인물 무기로.</summary>
        private void OnShown(string memberId)
        {
            _shownId = string.IsNullOrEmpty(memberId) ? "hero" : memberId;
            RefreshModel();
        }

        private void OnItemGained(ItemData item, bool equipped)
        {
            if (item.Slot != ItemSlot.Weapon || !equipped) return;
            Refresh();
        }

        private void BuildVisual()
        {
            if (_controller.Visual == null) return;
            var socket = CharacterVisual.FindOrCreateWeaponSocket(_controller.Visual.gameObject, _controller.Animator);

            var handle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            handle.name = "WeaponHandle (generated)";
            Colliders.Strip(handle);
            handle.transform.SetParent(socket, false);
            handle.transform.localScale = new Vector3(0.05f, 0.12f, 0.05f);
            handle.transform.localPosition = Vector3.zero;
            _handle = handle.transform;
            var handleMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WeaponHandle (generated)" };
            handleMat.color = HandleColor;
            handle.GetComponent<MeshRenderer>().sharedMaterial = handleMat;

            var blade = GameObject.CreatePrimitive(PrimitiveType.Cube);
            blade.name = "WeaponBlade (generated)";
            Colliders.Strip(blade);
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

            int grade = Mathf.Clamp(ItemData.Get(Inventory.EquippedWeaponId)?.Grade ?? 0, 0, GradeEmission.Length - 1);
            float length = BladeLength + grade * BladeLengthPerGrade;
            _blade.localScale = new Vector3(BladeWidth, length, BladeThickness);
            _blade.localPosition = new Vector3(0f, length * 0.5f, 0f);
            _bladeRenderer.sharedMaterial.SetColor("_EmissionColor", GradeEmission[grade]);
        }

        // ---- U-0049 모델 ----

        /// <summary>쥘 모델을 지금 몸 손에 맞춘다 — 같은 모델이 이미 이 손에 있으면 그대로, 몸·무기가 바뀌었으면 새로 세운다. 모델이 없으면 코드 칼날.</summary>
        public void RefreshModel(string memberIdForTest = null)
        {
            if (memberIdForTest != null) _shownId = memberIdForTest;
            if (_controller == null || _controller.Visual == null || _blade == null) return;
            var socket = CharacterVisual.FindOrCreateWeaponSocket(_controller.Visual.gameObject, _controller.Animator);
            // 코드 칼날·자루도 지금 손으로 옮긴다(몸이 바뀌어도 옛 몸에 남지 않게)
            if (_blade.parent != socket) { _blade.SetParent(socket, false); if (_handle != null) _handle.SetParent(socket, false); }

            string name = GoWeaponModels.ModelFor(_shownId);
            if (_model != null && _modelName == name && _model.transform.parent == socket) { SetCodeBladeShown(false); ApplyGlow(); return; }
            DestroyModel();
            if (WorldModels.Load(name) == null) { SetCodeBladeShown(true); return; }
            var go = WorldModels.Spawn(name, socket, 0f);
            if (go == null) { SetCodeBladeShown(true); return; }
            var type = GoWeapons.TypeOf(_shownId);
            float parentScale = Mathf.Max(0.01f, socket.lossyScale.y);
            if (GoWeaponModels.Fit(go, GoWeaponModels.Length(type) / parentScale, out var rot, out var pos, out var sc))
            {
                go.transform.localRotation = rot; go.transform.localScale = Vector3.one * sc; go.transform.localPosition = pos;
            }
            _model = go; _modelName = name;
            SetCodeBladeShown(false);
            ApplyGlow();
        }

        /// <summary>tasks U-0096(웹 weapon.js 빛) — 강화 5 마다 한 단 + 승급, 0~11 단계로 외곽선·테 빛 색을 어둠→금빛으로(재질 값만, 에셋 0).
        /// 공유 재질은 안 건드리고 MaterialPropertyBlock 으로. 그 속성이 없는 셰이더는 그냥 둔다.</summary>
        public int GlowTier { get; private set; }
        /// <summary>U-0120 단계 1 → 11 외곽선 월드 두께(m)·림 세기·림 폭(작을수록 넓다) — 촬영으로 정함.</summary>
        private const float GlowOutlineMin = 0.004f, GlowOutlineMax = 0.012f, GlowRimMin = 0.5f, GlowRimMax = 1.4f, GlowRimPowMin = 3.5f, GlowRimPowMax = 2f;
        /// <summary>U-0121 — 몸 틴트 지우기(`CharacterVisual.ClearTint`, 빈 블록)가 손 무기 블록까지 덮은 뒤 빛만 다시 칠한다(모델은 그대로).</summary>
        public void ReapplyGlow() => ApplyGlow();
        private void ApplyGlow()
        {
            if (_model == null || string.IsNullOrEmpty(_shownId)) return;
            string wid = WeaponState.Equipped(_shownId);
            if (string.IsNullOrEmpty(wid)) return;
            var rec = WeaponState.RecOf(wid);
            GlowTier = Saga.Go.Data.GoTrack.GlowTier(rec.lv, rec.asc);
            var c = Saga.Go.Data.GoTrack.GlowColor(GlowTier);
            var mpb = new MaterialPropertyBlock();
            foreach (var r in _model.GetComponentsInChildren<Renderer>())
            {
                var mat = r.sharedMaterial;
                if (mat == null) continue;
                r.GetPropertyBlock(mpb);
                if (mat.HasProperty("_OutlineColor")) mpb.SetColor("_OutlineColor", c);
                if (mat.HasProperty("_RimColor")) mpb.SetColor("_RimColor", c);
                if (mat.HasProperty("_GlowStrength")) mpb.SetFloat("_GlowStrength", GlowTier / 11f);
                // U-0120 — 손 무기 CelToon 은 외곽선 두께 기본 0·정점 알파 1 이라 위 셋만으론 림 색 차이뿐(촬영 △). 단계 ≥ 1 이면 금빛 쪽 외곽선(월드 두께 → 물체 공간)과
                // 넓고 센 림을 켠다. 단계 0 은 재질 값 그대로(지금과 같음 — 블록에 남은 옛 값도 재질 값으로 덮는다).
                float k = GlowTier / 11f, sc = Mathf.Max(1e-4f, r.transform.lossyScale.x);
                if (mat.HasProperty("_OutlineWidth")) mpb.SetFloat("_OutlineWidth", GlowTier > 0 ? Mathf.Lerp(GlowOutlineMin, GlowOutlineMax, k) / sc : mat.GetFloat("_OutlineWidth"));
                if (mat.HasProperty("_RimStrength")) mpb.SetFloat("_RimStrength", GlowTier > 0 ? Mathf.Lerp(GlowRimMin, GlowRimMax, k) : mat.GetFloat("_RimStrength"));
                if (mat.HasProperty("_RimPower")) mpb.SetFloat("_RimPower", GlowTier > 0 ? Mathf.Lerp(GlowRimPowMin, GlowRimPowMax, k) : mat.GetFloat("_RimPower"));
                r.SetPropertyBlock(mpb);
            }
        }

        private void DestroyModel()
        {
            if (_model != null) Object.Destroy(_model);
            _model = null; _modelName = "";
        }

        private void SetCodeBladeShown(bool shown)
        {
            if (_bladeRenderer != null) _bladeRenderer.enabled = shown;
            if (_handle != null) { var r = _handle.GetComponent<MeshRenderer>(); if (r != null) r.enabled = shown; }
        }
    }
}
