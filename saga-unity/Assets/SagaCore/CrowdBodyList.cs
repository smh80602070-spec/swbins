using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0040 — 자체툴(K-0024·K-0065) 인물 299명 몸의 런타임 목록. 몸 gltf 는 `Assets/Art/CharactersDex`(로컬 설치·저장소 밖)에 있고, 이 목록 에셋
    /// (`Resources/CrowdBodyList.asset`, 에디터 메뉴 `Saga/Crowd/Build Body List` 가 만든다 — 로컬 전용·`.gitignore`)이 몸과 공용 동작(idle·walk)을
    /// 가리킨다. 목록이 없으면(다른 PC) <see cref="Available"/> 이 false 라 호출한 쪽이 기존 몸을 그대로 쓴다.
    /// </summary>
    public sealed class CrowdBodyList : ScriptableObject
    {
        public GameObject[] bodies;
        public AnimationClip idle;
        public AnimationClip walk;
    }
}
