using UnityEngine;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "GLB 자산 도입" — SagaGo
    /// `World/CharacterVisual.cs`와 완전히 같은 로직을 그대로 복사(루트
    /// CLAUDE.md "다섯 판은 다섯 벌 복사" 원칙을 이 Unity 트랙에도 적용,
    /// SagaDungeon.asmdef가 SagaGo를 참조하지 않아 타입을 직접 못 씀).
    /// **GLB 파일 자체는 새로 안 받고 SagaGo가 이미 쓰는 Kenney "Blocky
    /// Characters"(`Assets/Art/Characters/character-{a,b,c,d}.glb`)를
    /// 그대로 재사용한다** — PLAN.md 0장·8장이 이미 트랙 간 자산 재사용을
    /// 허용해 뒀고(saga-godot↔saga-unity), 같은 saga-unity 안에서 GO↔
    /// DUNGEON이 에셋 파일(코드 아님)을 공유하는 것도 같은 원칙의 연장.
    /// 실측(SagaGo `MeasureCharacterGlb.cs`)값도 그대로: 1.6×2.7×0.8,
    /// 피벗 발밑.
    /// </summary>
    public static class CharacterVisual
    {
        public const float NativeHeight = 2.7f;

        /// <summary>
        /// modelPrefab을 parent 밑에 심고 targetHeight에 맞춰 균일 스케일한다.
        /// tint가 Color.white가 아니면 URP Lit의 _BaseColor를
        /// MaterialPropertyBlock으로 덮어써(공유 머티리얼은 안 건드림) 같은
        /// 모델을 여러 색으로 구분해 쓸 수 있게 한다.
        /// </summary>
        public static Transform Spawn(GameObject modelPrefab, Transform parent, float targetHeight, Color tint)
        {
            var inst = Object.Instantiate(modelPrefab, parent, false);
            inst.name = "Visual";
            float scale = targetHeight / NativeHeight;
            inst.transform.localScale = Vector3.one * scale;
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.identity;

            if (tint != Color.white) Tint(inst, tint);
            EnsureBlobShadow(parent);
            return inst.transform;
        }

        /// <summary>PLAN.md 102-5 "그림자 계단" — Player에 붙인 것(편집기
        /// 빌드 스크립트의 `playerGo.AddComponent&lt;BlobShadow&gt;()`)과 같은
        /// 보완을 적·NPC에도 준다. Mobile 품질 레벨이 아니면 `BlobShadow.
        /// Awake()`가 스스로 꺼진다 — 여기선 무조건 붙여도 안전하다. 리깅된
        /// 캐릭터(Animator 포함, Abe/Brute)는 이 클래스의 Spawn을 안 타므로
        /// 호출부(DungeonEnemy.cs 등)가 따로 부른다.</summary>
        public static void EnsureBlobShadow(Transform root)
        {
            if (root.GetComponent<BlobShadow>() == null)
            {
                root.gameObject.AddComponent<BlobShadow>();
            }
        }

        /// <summary>산적/두목의 "강타 예고" 텔레그래프처럼 순간적으로 색을
        /// 덮어썼다 되돌리는 연출에도 쓴다 — GLB는 몸통·팔·다리·머리가
        /// 각각 다른 Renderer라 전부 찾아 같이 바꿔야 primitive capsule
        /// 시절(단일 Renderer)과 같은 효과가 난다.</summary>
        public static void Tint(GameObject visualRoot, Color color)
        {
            var block = new MaterialPropertyBlock();
            foreach (var r in visualRoot.GetComponentsInChildren<Renderer>())
            {
                r.GetPropertyBlock(block);
                block.SetColor("_BaseColor", color);
                r.SetPropertyBlock(block);
            }
        }

        public static void ClearTint(GameObject visualRoot)
        {
            var empty = new MaterialPropertyBlock();
            foreach (var r in visualRoot.GetComponentsInChildren<Renderer>())
            {
                r.SetPropertyBlock(empty);
            }
        }

        private const string FallbackSocketName = "WeaponSocket (fallback)";

        /// <summary>PLAN.md 101-3 G "장비 가시화" — 무기를 쥘 소켓. Humanoid
        /// Animator(Maria 등 Mixamo 리깅)는 본 이름이 뭐든 Avatar 매핑이
        /// 같아 `GetBoneTransform` 하나로 리깅된 캐릭터 전부에 공용으로
        /// 쓴다("소켓 공용"의 뜻, PLAN 101-3 표). 리깅 없는 폴백(Kenney
        /// GLB·primitive capsule)은 손 본 자체가 없어 시각 루트 밑에 고정
        /// 오프셋 자식을 하나 즉석으로 만들어 대신한다 — 정확한 손 위치는
        /// 아니지만 무기가 몸에 붙어 있다는 신호는 준다. **`animator.isHuman`로
        /// 먼저 거른다** — Animator 컴포넌트는 있어도 Avatar가 아직 없거나
        /// (Humanoid 리그 세팅 전) Humanoid가 아니면 `GetBoneTransform`이
        /// `InvalidOperationException`을 던진다(2026-09-17 헤드리스 검증
        /// 중 이 PC의 Maria 인스턴스가 실제로 이 상태라 겪음).</summary>
        public static Transform FindOrCreateWeaponSocket(GameObject visualRoot, Animator animator)
        {
            if (animator != null && animator.isHuman)
            {
                var hand = animator.GetBoneTransform(HumanBodyBones.RightHand);
                if (hand != null) return hand;
            }

            // U-0034 — VRoid 몸(일반 리그, `isHuman` 아님)은 손 본을 이름으로 찾는다(`J_Bip_R_Hand`).
            var vroidHand = FindBone(visualRoot.transform, "J_Bip_R_Hand");
            if (vroidHand != null) return vroidHand;

            var existing = visualRoot.transform.Find(FallbackSocketName);
            if (existing != null) return existing;

            var socket = new GameObject(FallbackSocketName).transform;
            socket.SetParent(visualRoot.transform, false);
            socket.localPosition = new Vector3(0.35f, 1.1f, 0.15f);
            return socket;
        }

        private static Transform FindBone(Transform t, string name)
        {
            if (t.name == name) return t;
            foreach (Transform c in t) { var f = FindBone(c, name); if (f != null) return f; }
            return null;
        }

        /// <summary>GLB 모델을 못 찾았을 때(다른 PC에 아직 안 받아 둔 경우 등)
        /// 쓰는 예전 primitive capsule 대체 — 씬 빌드 자체가 깨지지 않게 한다.
        /// targetHeight는 capsule 기본 높이(2m) 기준 스케일로 환산한다.</summary>
        public static Transform SpawnFallbackCapsule(Transform parent, float targetHeight, Color tint)
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            visual.name = "Visual";
            Object.DestroyImmediate(visual.GetComponent<Collider>());
            visual.transform.SetParent(parent, false);
            float scale = targetHeight / 2f; // primitive capsule 기본 높이 2m
            visual.transform.localScale = Vector3.one * scale;
            visual.transform.localPosition = new Vector3(0f, targetHeight * 0.5f, 0f);
            if (tint != Color.white)
            {
                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Fallback (generated)" };
                mat.color = tint;
                visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            }
            Debug.LogWarning($"[CharacterVisual] 캐릭터 GLB를 못 찾아 primitive capsule로 대체함 (parent={parent.name}).");
            EnsureBlobShadow(parent);
            return visual.transform;
        }
    }
}
