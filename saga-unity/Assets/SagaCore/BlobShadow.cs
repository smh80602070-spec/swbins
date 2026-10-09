using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 102-2 "Shadows" 행 — Mobile 프로파일은 Cascade 1이라(102-5
    /// "그림자 계단") 그림자 경계가 계단져 보인다. 표에 이미 적힌 보완책
    /// "접지 blob 그림자 프리팹(모바일 캐릭터)"을 짠다 — PC는 Cascade 4로
    /// 충분해 붙이지 않는다.
    ///
    /// `SessionCard`의 DoF처럼 "내용이 없으면 안 켜진다" 트릭을 쓸 자리가
    /// 없어(그림자는 Volume 오버라이드가 아니라 오브젝트 자체다) 여기가 이
    /// 트랙 첫 런타임 플랫폼 분기 — `QualitySettings`의 두 레벨 이름
    /// ("PC"/"Mobile", `ProjectSettings/QualitySettings.asset`)로 판별한다.
    ///
    /// 텍스처는 에셋 없이 코드로 굽는다(이 트랙의 procgen 관례) — 64×64
    /// 흑백 원형 그라디언트 하나를 공유 텍스처·머티리얼로 캐릭터 전부가
    /// 재사용한다.
    /// </summary>
    public class BlobShadow : MonoBehaviour
    {
        private const float Diameter = 0.9f;
        private const float GroundOffset = 0.02f;
        private const float MaxDropDistance = 3f;
        private const int TextureSize = 64;
        private const float MaxOpacity = 0.55f;

        private static Material _sharedMaterial;

        private Transform _quad;

        private void Awake()
        {
            if (!IsMobileQualityLevel())
            {
                enabled = false;
                return;
            }
            BuildQuad();
        }

        private static bool IsMobileQualityLevel()
        {
            int level = QualitySettings.GetQualityLevel();
            string[] names = QualitySettings.names;
            return level >= 0 && level < names.Length && names[level] == "Mobile";
        }

        private void BuildQuad()
        {
            var quadGo = GameObject.CreatePrimitive(PrimitiveType.Quad);
            quadGo.name = "BlobShadow";
            // U-0073 — Destroy 는 프레임 끝에 지워, 만든 프레임 동안 발밑 레이가 이 판을 맞혔다(캐릭터 발밑 자식이라). 바로 지운다.
            DestroyImmediate(quadGo.GetComponent<Collider>());
            quadGo.transform.SetParent(transform, false);
            quadGo.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            quadGo.transform.localScale = new Vector3(Diameter, Diameter, 1f);

            var renderer = quadGo.GetComponent<MeshRenderer>();
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            renderer.material = SharedMaterial();

            _quad = quadGo.transform;
        }

        private static Material SharedMaterial()
        {
            if (_sharedMaterial != null) return _sharedMaterial;

            var shader = Shader.Find("Universal Render Pipeline/Unlit");
            var mat = new Material(shader) { name = "BlobShadowMat" };
            mat.SetTexture("_BaseMap", BuildGradientTexture());
            mat.SetFloat("_Surface", 1f); // 0=Opaque, 1=Transparent
            mat.SetFloat("_Blend", 0f); // Alpha
            mat.SetOverrideTag("RenderType", "Transparent");
            mat.SetInt("_ZWrite", 0);
            mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");

            _sharedMaterial = mat;
            return mat;
        }

        private static Texture2D BuildGradientTexture()
        {
            var tex = new Texture2D(TextureSize, TextureSize, TextureFormat.RGBA32, false)
            {
                name = "BlobShadowGradient",
                wrapMode = TextureWrapMode.Clamp,
            };
            var center = new Vector2(TextureSize / 2f, TextureSize / 2f);
            float maxDist = TextureSize / 2f;
            for (int y = 0; y < TextureSize; y++)
            {
                for (int x = 0; x < TextureSize; x++)
                {
                    float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), center) / maxDist;
                    float falloff = Mathf.Clamp01(1f - dist);
                    float alpha = falloff * falloff * MaxOpacity;
                    tex.SetPixel(x, y, new Color(0f, 0f, 0f, alpha));
                }
            }
            tex.Apply();
            return tex;
        }

        private void LateUpdate()
        {
            if (_quad == null) return;
            if (Physics.Raycast(transform.position + Vector3.up * 0.5f, Vector3.down,
                    out RaycastHit hit, MaxDropDistance))
            {
                _quad.position = hit.point + Vector3.up * GroundOffset;
            }
        }
    }
}
