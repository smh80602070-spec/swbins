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
            Object.Destroy(handle.GetComponent<Collider>());
            handle.transform.SetParent(socket, false);
            handle.transform.localScale = new Vector3(0.05f, 0.12f, 0.05f);
            handle.transform.localPosition = Vector3.zero;
            _handle = handle.transform;
            var handleMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WeaponHandle (generated)" };
            handleMat.color = HandleColor;
            handle.GetComponent<MeshRenderer>().sharedMaterial = handleMat;

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
            if (_model != null && _modelName == name && _model.transform.parent == socket) { SetCodeBladeShown(false); return; }
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
