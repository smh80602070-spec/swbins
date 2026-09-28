using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// PLAN.md 109-13-2b — 지도·싸움터 인물(`RealmFigure`)이 입을 사실 몸 표. 씬 빌더(`BuildTestCityScene`)가 프리팹
    /// (`SetupNpcCharacterImports.PrefabPath`)과 주인공 컨트롤러(Maria.controller — 몸이 전부 Humanoid 라 아바타 리타깃)를 채운다.
    /// 무장(태수·장수)은 갑옷·두건 사내 몸, 재야는 베옷·무도복 몸. 표가 비었거나(묶음 없는 PC) 몸이 Humanoid 가 아니면 대역 도형으로 선다.
    /// 인물마다 몸은 id 해시로 늘 같다(무작위 없음).
    /// </summary>
    public class RealmBodies : MonoBehaviour
    {
        public enum Role { Officer, Wanderer }

        [SerializeField] private GameObject[] officerBodies;
        [SerializeField] private GameObject[] wandererBodies;
        [SerializeField] private RuntimeAnimatorController controller;

        /// <summary>진단 손잡이 — 참이면 표가 있어도 대역 도형으로 선다.</summary>
        public static bool ForceFallback;

        private static RealmBodies _current;

        /// <summary>씬의 몸 표(없으면 null). 편집기 씬 빌드(월드맵 `Rebuild`)에서도 찾는다.</summary>
        public static RealmBodies Current
        {
            get
            {
                if (_current == null) _current = FindAnyObjectByType<RealmBodies>(FindObjectsInactive.Include);
                return _current;
            }
        }

        public RuntimeAnimatorController Controller => controller;
        public int OfficerCount => officerBodies?.Length ?? 0;
        public int WandererCount => wandererBodies?.Length ?? 0;

        public void Init(GameObject[] officers, GameObject[] wanderers, RuntimeAnimatorController animatorController)
        {
            officerBodies = officers;
            wandererBodies = wanderers;
            controller = animatorController;
        }

        /// <summary>역할·열쇠(무장 id 등) → 프리팹. `skip` 번째 몸은 건너뛴다(맞붙는 두 장수가 같은 몸이 안 되게). 없으면 null.</summary>
        public static GameObject Pick(Role role, string key, int skip = -1)
        {
            var b = Current;
            if (ForceFallback || b == null || b.controller == null) return null;
            var list = role == Role.Officer ? b.officerBodies : b.wandererBodies;
            int i = Index(list?.Length ?? 0, key, skip);
            return i < 0 ? null : list[i];
        }

        /// <summary>몸 번호(순수) — 빈 표면 -1. `skip` 과 겹치면 다음 몸.</summary>
        public static int Index(int count, string key, int skip = -1)
        {
            if (count <= 0) return -1;
            int i = (int)(Hash(key ?? "") % (uint)count);
            if (i == skip && count > 1) i = (i + 1) % count;
            return i;
        }

        /// <summary>FNV-1a — string.GetHashCode 는 실행마다 달라질 수 있어 쓰지 않는다.</summary>
        public static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }
}
