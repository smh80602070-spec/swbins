using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>"저장" 버튼의 영속 onClick 대상. 영속 리스너는 UnityEngine.Object의 메서드만
    /// 걸 수 있어, 정적 `SaveState.Save()`를 이 컴포넌트가 대신 받는다
    /// (`SagaCore/ButtonWiring.cs` — 2026-09-23 버튼 먹통 발견, STORY `StorySaveButton`과 같은 결).</summary>
    public class GoSaveButton : MonoBehaviour
    {
        public void Save()
        {
            bool ok = SaveState.Save();
            if (ok) Saga.Core.SagaVoice.System("save"); // U-0068
            DialogueLabel.Instance?.Show(ok ? GoLocalization.T("command.save_ok", "저장했다.")
                : GoLocalization.T("command.save_fail_player", "저장 실패 — 플레이어를 못 찾았다."), 3f);
        }
    }
}
