using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.Story.Player
{
    /// <summary>
    /// PLAN.md 101-3 G "성장 가시화" — 전직 차수마다 주인공 옷 빛깔이 갈래 색으로 짙어진다.
    /// 웹판 saga-story(2026-09-23, `toon3d.js jobLook()`·`data-job.js BRANCH_TINT`)를 옮겼다:
    /// 원래 색에 갈래 색을 **차수 × 0.12**(상한 0.6)만큼 섞는다 — 1차 12%, 4차 48%. 무명은 그대로.
    /// `StoryWeaponVisual`의 무기는 갈래 뿌리로만 갈려(2~4차도 같은 무기) 차수 차이가 안 보였는데,
    /// 5-2 3단계로 4차까지 생겨 차수마다 보이는 변화 하나를 더한다(보이는 색뿐, 판정·세이브 무관).
    ///
    /// **재해석 — 옷만**: 웹판은 툰 몸 전체의 세력 색을 물들이지만, 이 트랙 주인공(Maria)은 사실적
    /// PBR이라 피부까지 물들이면 병자처럼 보인다. `BuildMariaSkinSplit`이 이미 나눠 둔 서브메시 중
    /// **피부 재질(이름에 "Skin")은 건너뛰고** 나머지(옷·갑옷) 슬롯의 `_BaseColor`만 바꾼다. 텍스처에
    /// 곱해지는 값이라 무늬는 남고 빛깔만 기운다. 공유 재질을 안 건드리게 `MaterialPropertyBlock`
    /// (슬롯별)으로 건다 — Maria는 다른 판 씬도 같은 `MariaRest.mat`을 쓴다. 손의 무기
    /// (`Weapon (generated)` 밑)는 제외.
    /// </summary>
    [RequireComponent(typeof(StoryPlayerController))]
    public class StoryOutfitTint : MonoBehaviour
    {
        /// <summary>웹판 BRANCH_TINT 그대로(#b8412f·#4f8f3f·#5b4a8c·#2f6fb0).</summary>
        public static Color BranchColor(string root) => root switch
        {
            "warrior" => new Color32(0xb8, 0x41, 0x2f, 0xff),
            "archer" => new Color32(0x4f, 0x8f, 0x3f, 0xff),
            "rogue" => new Color32(0x5b, 0x4a, 0x8c, 0xff),
            "mage" => new Color32(0x2f, 0x6f, 0xb0, 0xff),
            _ => Color.white,
        };

        public const float TintPerTier = 0.12f; // 웹판 world3d.jobTint 기본값
        public const float TintMax = 0.6f;

        /// <summary>그 차수의 섞는 비율 — 무명·모르는 갈래는 0.</summary>
        public static float MixFor(int tier, string root) =>
            root == StoryJobState.NoJob || tier <= 0 ? 0f : Mathf.Min(TintMax, tier * TintPerTier);

        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        // U-0058 VRoid 주인공 몸(glTF 재질)은 `baseColorFactor` — 옷 슬롯 이름이 `…_CLOTH`, 피부·얼굴·눈·머리는 `_SKIN`·`_FACE`·`_EYE`·`_HAIR`
        private static readonly int GltfBaseColorId = Shader.PropertyToID("baseColorFactor");

        private static int ColorIdOf(Material m) => m.HasProperty(BaseColorId) ? BaseColorId : m.HasProperty(GltfBaseColorId) ? GltfBaseColorId : -1;

        /// <summary>물들이지 않는 슬롯 — 피부(Maria "Skin"·VRoid "_SKIN")와 VRoid 얼굴·눈·머리.</summary>
        private static bool IsNotOutfit(string name) =>
            name.IndexOf("Skin", System.StringComparison.OrdinalIgnoreCase) >= 0
            || name.Contains("_FACE") || name.Contains("_EYE") || name.Contains("_HAIR");

        private StoryPlayerController _controller;
        private MaterialPropertyBlock _block;

        /// <summary>테스트 전용 — 마지막으로 건 비율과 옷 슬롯 수·건너뛴 피부 슬롯 수.</summary>
        public float CurrentMix { get; private set; }
        public int TintedSlots { get; private set; }
        public int SkippedSkinSlots { get; private set; }

        private void Awake()
        {
            _controller = GetComponent<StoryPlayerController>();
            _block = new MaterialPropertyBlock();
        }

        private void Start()
        {
            StoryJobState.JobChosen += OnJobChosen;
            Refresh();
        }

        private void OnDestroy()
        {
            StoryJobState.JobChosen -= OnJobChosen;
        }

        private void OnJobChosen(string jobKey) => Refresh();

        public void Refresh()
        {
            if (_controller == null || _controller.Visual == null) return;
            string root = StoryJobState.Root;
            float mix = MixFor(StoryJobState.Tier, root);
            Color branch = BranchColor(root);
            CurrentMix = mix;
            TintedSlots = 0;
            SkippedSkinSlots = 0;

            var mats = new List<Material>();
            foreach (var r in _controller.Visual.GetComponentsInChildren<Renderer>(true))
            {
                if (IsWeaponPart(r.transform)) continue;
                r.GetSharedMaterials(mats);
                for (int i = 0; i < mats.Count; i++)
                {
                    var mat = mats[i];
                    if (mat == null) continue;
                    if (IsNotOutfit(mat.name))
                    {
                        SkippedSkinSlots++;
                        continue;
                    }
                    int colorId = ColorIdOf(mat);
                    if (colorId < 0) continue;
                    r.GetPropertyBlock(_block, i);
                    if (mix > 0f)
                    {
                        _block.SetColor(colorId, Color.Lerp(mat.GetColor(colorId), branch, mix));
                        TintedSlots++;
                    }
                    else
                    {
                        // 무명(되돌리기) — 이 슬롯의 블록을 비워 재질 원래 색으로.
                        _block.Clear();
                    }
                    r.SetPropertyBlock(_block, i);
                }
            }
        }

        private static bool IsWeaponPart(Transform t)
        {
            for (; t != null; t = t.parent)
            {
                if (t.name == "Weapon (generated)") return true;
            }
            return false;
        }

        /// <summary>테스트 전용 — 첫 옷 슬롯에 지금 걸린 색(없으면 null).</summary>
        public Color? FirstTintedColor()
        {
            if (_controller == null || _controller.Visual == null) return null;
            var mats = new List<Material>();
            foreach (var r in _controller.Visual.GetComponentsInChildren<Renderer>(true))
            {
                if (IsWeaponPart(r.transform)) continue;
                r.GetSharedMaterials(mats);
                for (int i = 0; i < mats.Count; i++)
                {
                    var mat = mats[i];
                    if (mat == null || IsNotOutfit(mat.name)) continue;
                    int colorId = ColorIdOf(mat);
                    if (colorId < 0) continue;
                    r.GetPropertyBlock(_block, i);
                    return _block.isEmpty ? mat.GetColor(colorId) : _block.GetColor(colorId);
                }
            }
            return null;
        }
    }
}
