using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 66-2장(파이널 판타지 최신작 기준) — PC/Mobile 두 Volume
    /// Profile 중 플랫폼에 맞는 쪽을 골라 Global Volume에 꽂는다. 66-1장의
    /// URP RPAsset은 QualitySettings의 excludedTargetPlatforms로 자동
    /// 전환되지만, Volume Profile엔 그런 메커니즘이 없어 이 스크립트가
    /// 직접 고른다.
    /// </summary>
    [RequireComponent(typeof(Volume))]
    public class PlatformVolumeProfile : MonoBehaviour
    {
        public VolumeProfile pcProfile;
        public VolumeProfile mobileProfile;

        private void Awake()
        {
            var volume = GetComponent<Volume>();
            volume.profile = Application.isMobilePlatform && mobileProfile != null
                ? mobileProfile
                : pcProfile;
        }
    }
}
