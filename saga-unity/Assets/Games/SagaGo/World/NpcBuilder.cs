using System;
using UnityEngine;
using Saga.Go.Data;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// VERTICAL_SLICE.md 26절 — 주민 1~2명(대화만, 등용 대상 아님). saga-godot
    /// npc_builder.gd와 같은 범위로 좁힌다: 하루 일과·날씨·LOD는 이번 슬라이스
    /// 밖. saga-godot이 "대화가 전투보다 먼저"로 순서를 정정했던 교훈 그대로
    /// Combat보다 먼저 구현한다(PROJECT_STATE.md 참고). 아직 GLB 전이라
    /// Player와 같은 크기의 primitive Capsule + 옷 색만 다르게(PLAN.md 8장).
    /// </summary>
    public class NpcBuilder : MonoBehaviour
    {
        private const float TalkRadius = 14f;
        private const string TravelerEventId = "traveler_met";
        private const int TravelerRewardExp = 15;
        private const int TravelerRewardGold = 10;

        private struct VillagerDef
        {
            public string Id;
            public string Name;
            public Func<string> LineFn;
            public int Gx;
            public int Gy;
            public Color Color;
        }

        // 자리는 saga-godot과 동일한 좌표(같은 7x7 지도) — 마을집 좌우 평지.
        // 2026-09-14 "Localization" — 이름을 static 배열 리터럴로 한 번만
        // 굳히지 않고 메서드로 뒀다. Build()가 부를 때마다(씬을 다시 열 때
        // 마다) GoLocalization.T()를 다시 불러 그 시점의 언어를 반영한다.
        private static VillagerDef[] BuildVillagerDefs() => new[]
        {
            new VillagerDef
            {
                Id = "npc_elder", Name = GoLocalization.T("npc.elder_name", "마을 촌장"),
                LineFn = ElderLine,
                Gx = 1, Gy = 3, Color = new Color(0.25f, 0.32f, 0.55f),
            },
            new VillagerDef
            {
                Id = "npc_merchant", Name = GoLocalization.T("npc.merchant_name", "떠돌이 상인"),
                LineFn = MerchantLine,
                Gx = 4, Gy = 3, Color = new Color(0.55f, 0.32f, 0.18f),
            },
            new VillagerDef
            {
                // PLAN.md 24~27장 "NPC 이벤트" — 2026-09-12 지도 확장으로 생긴
                // 둘째 남쪽 공터(row9)에 세운 한 번뿐인 만남. 촌장(퀘스트)·
                // 상인(거래)과 달리 진행 상태가 없는 "말 걸면 한 번, 그걸로
                // 끝"인 가장 단순한 형태 — WorldEventState(2026-09-12에 id
                // 집합으로 일반화된 것)를 그대로 재사용.
                Id = "npc_traveler", Name = GoLocalization.T("npc.traveler_name", "나그네"),
                LineFn = TravelerLine,
                Gx = 4, Gy = 9, Color = new Color(0.42f, 0.4f, 0.36f),
            },
        };

        /// <summary>PLAN.md 66장 Reward — 상인은 새 상점 화면 없이 "말을 걸면
        /// 살 수 있으면 판다"로 거래를 끝낸다(Inventory.cs의 "더 센 장비는
        /// 자동 장착"과 같은 결). 딱 한 번만 판다.</summary>
        private static string MerchantLine()
        {
            string itemName = ItemData.Get(ShopState.MerchantItemId)?.Name ?? ShopState.MerchantItemId;

            if (ShopState.MerchantSold)
            {
                return GoLocalization.T("npc.merchant_thanks", "덕분에 짐이 줄어 고맙네. 좋은 길 되시게.");
            }
            if (ShopState.TryBuyFromMerchant())
            {
                return string.Format(GoLocalization.T("npc.merchant_sell", "짐이 무거워 골치였는데 — {0}을 {1}냥에 내주지. 가져가시게."), itemName, ShopState.MerchantPrice);
            }
            return string.Format(GoLocalization.T("npc.merchant_offer", "북쪽 산길은 요즘 값이 오르오. {0}을 {1}냥에 넘기고 싶은데, 자네 주머니 사정이 넉넉지 않아 보이는군."), itemName, ShopState.MerchantPrice);
        }

        /// <summary>PLAN.md 70장 — 도적 퀘스트를 내주고, 진행 중이면 재촉하고,
        /// 끝났으면 사례한다. 말을 거는 순간이 곧 "퀘스트 수락"이라 여기서
        /// QuestState.StartBanditQuest()를 직접 부른다(VillagerTalk.cs는 그냥
        /// 이 함수가 돌려주는 문장을 보여주기만 하는 화면 층).</summary>
        private static string ElderLine()
        {
            switch (QuestState.BanditQuest)
            {
                case QuestStage.NotStarted:
                    QuestState.StartBanditQuest();
                    return GoLocalization.T("npc.elder_start", "이 근처에 도적 떼가 나온다더군. 처치해 주면 사례하지.");
                case QuestStage.Active:
                    return GoLocalization.T("npc.elder_active", "아직인가? 도적 놈들 때문에 다들 걱정이 크네.");
                default:
                    return GoLocalization.T("npc.elder_done", "고맙네, 자네 덕에 길이 편해졌어.");
            }
        }

        /// <summary>PLAN.md 24~27장 "NPC 이벤트" — 처음 말을 걸면 소소한 보상과
        /// 함께 흘려듣는 정보 한 마디, 그다음부턴 그냥 지나가는 인사말뿐이다
        /// (촌장의 3단계 퀘스트 대사·상인의 거래 상태 분기보다 훨씬 가벼운
        /// "한 번뿐인 만남").</summary>
        private static string TravelerLine()
        {
            if (WorldEventState.IsTriggered(TravelerEventId))
            {
                return GoLocalization.T("npc.traveler_again", "또 만났군. 좋은 길 되시게.");
            }
            WorldEventState.TryTrigger(TravelerEventId);
            PlayerStats.AddExp(TravelerRewardExp);
            GoldState.Add(TravelerRewardGold);
            return string.Format(GoLocalization.T("npc.traveler_first", "이 근처 지리를 좀 아네. 도움이 될 만한 걸 나눠 주지 — 경험치 +{0} · 돈 +{1}냥"), TravelerRewardExp, TravelerRewardGold);
        }

        // 편집기 빌드 스크립트가 Init()으로 채워 준다 — Gatherable.cs와 같은
        // 이유(런타임 Awake()는 AssetDatabase를 못 써 GLB를 직접 못 불러온다,
        // 씬에 이미 저장된 참조를 그대로 쓴다).
        [SerializeField] private GameObject elderModel;
        [SerializeField] private GameObject merchantModel;
        [SerializeField] private GameObject travelerModel;

        public void Init(GameObject elder, GameObject merchant, GameObject traveler)
        {
            elderModel = elder;
            merchantModel = merchant;
            travelerModel = traveler;
        }

        // PLAN.md 106-4 "캐릭터 통일" GO 몫 — Mixamo 사실 모델(촌장 Peasant Man · 상인 Peasant Girl · 나그네 궁수).
        // 로컬 전용 자산이라 없는 PC 면 null → 위 Kenney 모델로 폴백.
        [SerializeField] private GameObject elderRig;
        [SerializeField] private GameObject merchantRig;
        [SerializeField] private GameObject travelerRig;

        public void InitRigs(GameObject elder, GameObject merchant, GameObject traveler)
        {
            elderRig = elder;
            merchantRig = merchant;
            travelerRig = traveler;
        }

        /// <summary>사실 모델 NPC 가 마을 쪽을 보게 돌리는 각도(Mixamo 는 +z 를 본다).</summary>
        private static float YawFor(string id) => id == "npc_elder" ? 90f : id == "npc_merchant" ? 270f : 180f; // 촌장·상인은 마을 가운데, 나그네는 북쪽 문

        private void Awake()
        {
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식들을 만들어 둔
            // 뒤라 그대로 두면 주민이 두 벌씩 겹쳐 생긴다 — Gatherable.cs가
            // 쓰는 것과 같은 방어.
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            foreach (var v in BuildVillagerDefs())
            {
                Spawn(v);
            }
        }

        private GameObject RigFor(string id)
        {
            switch (id)
            {
                case "npc_elder": return elderRig;
                case "npc_merchant": return merchantRig;
                case "npc_traveler": return travelerRig;
                default: return null;
            }
        }

        private GameObject ModelFor(string id)
        {
            switch (id)
            {
                case "npc_elder": return elderModel;
                case "npc_merchant": return merchantModel;
                case "npc_traveler": return travelerModel;
                default: return null;
            }
        }

        private void Spawn(VillagerDef v)
        {
            char tile = TestMapData.TileAt(v.Gx, v.Gy);
            float ground = TestMapData.Legend[tile].Height;
            Vector3 pos = TestMapData.WorldPos(v.Gx, v.Gy) + new Vector3(0, ground, 0);

            var root = new GameObject($"Villager_{v.Id}");
            root.transform.SetParent(transform, false);
            root.transform.position = pos;

            var model = ModelFor(v.Id);
            if (NpcIdle.SpawnRigged(RigFor(v.Id), root.transform, CharacterVisual.HumanHeight, YawFor(v.Id)) == null)
            {
                if (model != null) CharacterVisual.Spawn(model, root.transform, CharacterVisual.HumanHeight, v.Color);
                else CharacterVisual.SpawnFallbackCapsule(root.transform, v.Color);
            }

            var talkGo = new GameObject("TalkArea");
            talkGo.transform.SetParent(root.transform, false);
            var col = talkGo.AddComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = TalkRadius;

            var talk = talkGo.AddComponent<VillagerTalk>();
            talk.Init(v.Name, v.LineFn);
        }
    }
}
