using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0198 2나락 천장 보이기 — U-0191 은 천장을 늘 그림자만으로 두어(게임 카메라 55°·6m 는 천장 위라 윗면만 보였다) 두목 등장 컷 같은 낮은 시점에선
    /// 벽 위가 검은 허공이었다(R-3 10-24 촬영). 이제 천장마다 카메라 높이로 정한다: 카메라가 천장 밑면보다 아래면 보임(밑면이 지붕), 위면 그림자만.
    /// 천장은 <see cref="DungeonRoomBuilder.HideCeiling"/> 가 등록한다(구운 천장·새로 지은 천장 모두). `GameBootstrap.Start` 가 붙인다.
    /// </summary>
    public class CeilingView : MonoBehaviour
    {
        private static readonly List<MeshRenderer> Ceilings = new List<MeshRenderer>();

        public static int Count => Ceilings.Count;

        public static void Register(MeshRenderer r)
        {
            if (r != null && !Ceilings.Contains(r)) Ceilings.Add(r);
        }

        public static CeilingView Install()
        {
            var have = FindFirstObjectByType<CeilingView>();
            return have != null ? have : new GameObject("CeilingView").AddComponent<CeilingView>();
        }

        private void LateUpdate()
        {
            var cam = Camera.main;
            if (cam != null) Apply(cam.transform.position.y);
        }

        /// <summary>카메라 높이 camY 로 천장마다 보임/그림자만 — 보이는 천장 수를 돌려준다(진단).</summary>
        public static int Apply(float camY)
        {
            int shown = 0;
            for (int i = Ceilings.Count - 1; i >= 0; i--)
            {
                var r = Ceilings[i];
                if (r == null) { Ceilings.RemoveAt(i); continue; }
                bool below = camY < r.bounds.min.y - 0.05f;
                var want = below ? ShadowCastingMode.On : ShadowCastingMode.ShadowsOnly;
                if (r.shadowCastingMode != want) r.shadowCastingMode = want;
                if (below) shown++;
            }
            return shown;
        }
    }
}
