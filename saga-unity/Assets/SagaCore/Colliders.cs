using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// 장식 도형(`CreatePrimitive`)의 충돌체를 바로 지운다. `Destroy` 는 프레임 끝까지
    /// 남아 발밑 레이·캐릭터 컨트롤러가 걸리므로 Immediate(U-0073·U-0122).
    /// </summary>
    public static class Colliders
    {
        public static void Strip(GameObject go)
        {
            if (go == null) return;
            var c = go.GetComponent<Collider>();
            if (c != null) Object.DestroyImmediate(c);
        }
    }
}
