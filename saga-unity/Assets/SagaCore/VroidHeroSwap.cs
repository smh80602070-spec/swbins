using System.Reflection;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0058 — 사가나락·사가마을·사가종횡 주인공도 VRoid 로(사용자 2026-10-08 "주인공 vroid로 변경해줘", 사가만리는 U-0056 `PartyBodies`).
    /// 세 판은 씬에 Maria 를 굳혀 두고 PlayerController 가 `visual`(Transform)·`animator`(Animator) 를 들고 있다 — 장면이 뜬 직후(Awake 뒤·Start 전)
    /// Player 의 그 두 칸을 VRoid 주역 몸(`Resources/HeroBody/hero_vroid`, `SetupVroidHero` 가 굽는다, 로컬 전용)으로 갈아 끼운다.
    /// 컨트롤러는 그 판이 쓰던 것을 그대로 옮겨 씌운다(Humanoid 리타깃 — 판마다 다른 상태·파라미터 유지). 몸이 없거나 Humanoid 가 아니면 Maria 그대로.
    /// </summary>
    public static class VroidHeroSwap
    {
        public const string HeroBodyPath = "HeroBody/hero_vroid";
        public const string SwappedName = "HeroVroid";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Hook()
        {
            SceneManager.sceneLoaded -= OnLoaded;
            SceneManager.sceneLoaded += OnLoaded;
        }

        // 플레이 진입 첫 장면(씬 다시 읽기를 끈 편집기 플레이·진단도) — Awake 뒤·Start 전
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void First() => OnLoaded(default, LoadSceneMode.Single);

        private static void OnLoaded(Scene scene, LoadSceneMode mode)
        {
            foreach (var p in GameObject.FindGameObjectsWithTag("Player")) TrySwap(p);
        }

        /// <summary>이 Player 의 주인공 몸을 VRoid 로. 바꿨으면 true(이미 바뀐 몸·사가만리·몸 없음은 false).</summary>
        public static bool TrySwap(GameObject player)
        {
            if (player == null) return false;
            MonoBehaviour owner = null;
            FieldInfo fVisual = null, fAnim = null;
            foreach (var mb in player.GetComponents<MonoBehaviour>())
            {
                if (mb == null) continue;
                var t = mb.GetType();
                if (t.Name == "PartyBodies") return false; // 사가만리는 PartyBodies 가 한다(동료 몸 교체와 같이 돈다)
                var v = t.GetField("visual", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                var a = t.GetField("animator", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                if (owner == null && v != null && a != null && v.FieldType == typeof(Transform) && a.FieldType == typeof(Animator)) { owner = mb; fVisual = v; fAnim = a; }
            }
            if (owner == null) return false;
            var oldVisual = fVisual.GetValue(owner) as Transform;
            var oldAnim = fAnim.GetValue(owner) as Animator;
            if (oldVisual == null || oldAnim == null || oldVisual == player.transform || oldVisual.name == SwappedName) return false;
            if (!oldAnim.isHuman || oldAnim.runtimeAnimatorController == null) return false;
            var prefab = Resources.Load<GameObject>(HeroBodyPath);
            if (prefab == null) return false;

            var inst = Object.Instantiate(prefab, oldVisual.parent);
            inst.name = SwappedName;
            inst.transform.localPosition = oldVisual.localPosition;
            inst.transform.localRotation = oldVisual.localRotation;
            float hOld = Height(oldVisual.gameObject), hNew = Height(inst);
            if (hOld > 0.01f && hNew > 0.01f) inst.transform.localScale = inst.transform.localScale * (hOld / hNew);
            foreach (var col in inst.GetComponentsInChildren<Collider>()) Object.Destroy(col);
            var anim = inst.GetComponent<Animator>();
            if (anim == null || !anim.isHuman) { Object.Destroy(inst); return false; }
            anim.runtimeAnimatorController = oldAnim.runtimeAnimatorController;
            anim.applyRootMotion = oldAnim.applyRootMotion;
            anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;

            fVisual.SetValue(owner, inst.transform);
            fAnim.SetValue(owner, anim);
            oldVisual.gameObject.SetActive(false);
            Debug.Log($"[VroidHeroSwap] {ScenePlayer(player)} 주인공 몸 → VRoid(키 {hOld:0.00}m, 컨트롤러 {anim.runtimeAnimatorController.name})");
            return true;
        }

        private static string ScenePlayer(GameObject p) => p.scene.name + "/" + p.name;

        /// <summary>스킨 메시 경계 높이(애니메이터가 아직 안 돈 바인드 자세 기준).</summary>
        public static float Height(GameObject go)
        {
            bool any = false; Bounds b = default;
            foreach (var r in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any ? b.size.y : 0f;
        }
    }
}
