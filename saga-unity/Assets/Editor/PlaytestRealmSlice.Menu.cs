using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    public static partial class PlaytestRealmSlice
    {
        /// <summary>U-0154 — ☰ 메뉴 화면: ☰ 단추로 열림·칸 ≥3(서고·문답·지도, 명마·연구는 붙은 뒤)·칸을 누르면 화면이 닫히고 그 창이 열림·
        /// 원래 단추는 숨음·☰ 를 다시 누르면 닫힘.</summary>
        private static bool CheckMenuHub()
        {
            const string Tag = "[PlaytestRealmSlice]";
            var hub = RealmMenuHub.Instance;
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (hub == null || ui == null) { Debug.LogError($"{Tag} menu FAIL - RealmMenuHub 없음(RealmCommandUi.Start 연결?)"); return false; }
            hub.Refresh();
            hub.OpenButton.onClick.Invoke();
            if (!hub.IsOpen) { Debug.LogError($"{Tag} menu FAIL - ☰ 단추로 안 열림"); return false; }
            hub.OpenButton.onClick.Invoke();
            if (hub.IsOpen) { Debug.LogError($"{Tag} menu FAIL - ☰ 단추로 안 닫힘"); return false; }
            if (hub.EntryCount < 3) { Debug.LogError($"{Tag} menu FAIL - 칸 {hub.EntryCount} < 3"); return false; }

            var archive = GetPrivateField<GameObject>(ui, "_archivePanel");
            var quiz = GetPrivateField<GameObject>(ui, "_quizPanel");
            System.Func<bool>[] opened = { () => archive != null && archive.activeSelf, () => quiz != null && quiz.activeSelf, () => RealmMapState.ViewingMap };
            string[] names = { "서고", "문답", "지도" };
            for (int i = 0; i < 3; i++)
            {
                hub.Open();
                hub.EntryButton(i).onClick.Invoke();
                if (hub.IsOpen) { Debug.LogError($"{Tag} menu FAIL - {names[i]} 칸을 눌렀는데 메뉴 화면이 안 닫힘"); return false; }
                if (!opened[i]()) { Debug.LogError($"{Tag} menu FAIL - {names[i]} 칸이 그 창을 못 엶"); return false; }
                hub.Open();
                hub.EntryButton(i).onClick.Invoke(); // 같은 토글을 한 번 더 — 창 닫기(지도는 디오라마로)
                if (opened[i]()) { Debug.LogError($"{Tag} menu FAIL - {names[i]} 칸 두 번째로 안 닫힘"); return false; }
            }
            for (int i = 0; i < hub.EntryCount; i++)
                if (hub.Grid.EntryButton(i).gameObject.activeSelf && FindOriginalVisible(i, ui)) { Debug.LogError($"{Tag} menu FAIL - 칸 {i} 의 원래 단추가 안 숨음"); return false; }
            Debug.Log($"{Tag} menu OK - ☰ 열고 닫기 · 칸 {hub.EntryCount} · 서고·문답·지도 칸이 그 창을 열고 닫음 · 원래 단추 숨김");
            return true;
        }

        private static bool FindOriginalVisible(int i, RealmCommandUi ui)
        {
            string field = i == 0 ? "_archiveToggleLabel" : i == 1 ? "_quizToggleLabel" : i == 2 ? "_mapLabel" : null;
            if (field == null) return false;
            var label = GetPrivateField<TMPro.TextMeshProUGUI>(ui, field);
            return label != null && label.gameObject.activeInHierarchy;
        }
    }
}
