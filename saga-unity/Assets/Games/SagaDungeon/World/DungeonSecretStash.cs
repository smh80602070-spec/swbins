using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md(saga-dungeon 웹판) 35장 "랜덤 이벤트"의 **Secret Area** —
    /// `DungeonAmbush.cs`의 룰렛 결과 하나("숨겨 둔 주머니")로 얇게만
    /// 대신했던 걸, 진짜 "탐험해서 찾는" 자리로 따로 뒀다. 방을 클리어
    /// 하거나 문을 여는 데 필요 없는 **완전히 선택적인 막다른 구석**에만
    /// 둔다 — Room4(사당, 이 통로의 마지막 방)의 구출·퍼즐·채집·소품과
    /// 다 떨어진 SE 빈 구석. GO `HiddenTreasure.cs`의 "발광 구슬" 시각
    /// 언어를 그대로 재사용(에미션 켠 노란 구체)하되, DUNGEON 관례대로
    /// 트리거 콜라이더 대신 Update() 폴링 거리 판정을 쓴다(WorldEventState
    /// 도 이 프로젝트엔 없어 — 다른 POI처럼 인스턴스 bool 하나로 "한 번뿐"
    /// 을 표현, 세이브에 안 남는 것도 Well/Trove/Shrine과 같은 결).
    /// </summary>
    public class DungeonSecretStash : MonoBehaviour
    {
        private const float PickupRadius = 2.2f;
        private const int RewardExp = 40; // 성소(30)보다 후하게 — 진행에 필요 없는 자리까지 찾아온 보상.
        private const int RewardGold = 30;
        private const float ToastSec = 5f;

        private static readonly Color GlowColor = new Color(1f, 0.85f, 0.2f);
        private static readonly Color EmissionColor = new Color(0.8f, 0.6f, 0.05f);

        private bool _found;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = Vector3.one * 1.0f;
            visual.transform.localPosition = new Vector3(0f, 0.6f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "SecretStash (generated)" };
            mat.color = GlowColor;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", EmissionColor);
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Saga.Core.Colliders.Strip(visual);
        }

        private void Update()
        {
            if (_found || _player == null) return;
            if (Vector3.Distance(transform.position, _player.position) > PickupRadius) return;

            _found = true;
            int levelBefore = HeroState.Level;
            HeroState.AddExp(RewardExp);
            HeroState.AddGold(RewardGold);
            SfxPlayer.PlayDiscovery();

            string msg = string.Format(DungeonLocalization.T("secret_stash.found_reward", "🔍 숨겨진 지역 — 잊혀진 주머니를 찾아냈다! 경험치 +{0} · 돈 +{1}냥"), RewardExp, RewardGold);
            if (HeroState.Level > levelBefore) msg += string.Format(DungeonLocalization.T("combat.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, HeroState.Level);
            DialogueLabel.Instance?.Show(msg, ToastSec);

            Destroy(gameObject);
        }
    }
}
