using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 다양화" — saga-dungeon
    /// 웹판 `room.well`(js/dungeon.js:339, 2151-2156)을 그대로 옮겼다:
    /// 체력 40% 회복, 한 번뿐, **방을 다 치우지 않아도 된다**(웹판도
    /// `room.cleared`를 안 봄 — 상자·사당과 다른 점). GO의 `Gatherable.cs`
    /// 와 같은 결(트리거 한 번, 작은 표지)이지만 무기·경험치가 아니라
    /// 체력 회복이라 새 트리거 클래스로 뺐다.
    /// </summary>
    public class DungeonWell : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const float HealFraction = 0.4f; // dungeon.js:2153 healBy(hpMax * 0.4)
        private const float ToastSec = 4f;

        private static readonly Color WellColor = new Color(0.2f, 0.45f, 0.75f);

        private bool _used;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.4f, 0.4f, 1.4f);
            visual.transform.localPosition = new Vector3(0f, 0.4f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonWell (generated)" };
            mat.color = WellColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_used || _player == null) return;
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _used = true;
            int healAmount = Mathf.RoundToInt(HeroState.HpMax * HealFraction);
            HeroState.HealBy(healAmount);
            DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("well.heal", "우물 — 체력 {0} 회복."), healAmount), ToastSec);
        }
    }
}
