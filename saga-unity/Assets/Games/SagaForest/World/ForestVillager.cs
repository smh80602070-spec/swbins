using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Core;

namespace Saga.Forest.World
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 4절 "결정 — 포함: 주민 1명
    /// (NPCS 중 하나, 이름 그대로) + 말 걸기(대사만 — 부탁/선물/편지는
    /// 제외)". `js/data-village.js`의 `NPCS.keeper`(숲지기)를 그대로
    /// 썼다 — 역할 이름이지 실존 인물이 아니라 루트 CLAUDE.md 이름
    /// 정책과 무관(같은 문서 4절 "참고" 항목). 대사는 원작 그대로:
    /// "이 숲은 내가 돌본다 — 짐승을 함부로 놀라게 하지 마시게".
    /// 다가갈 때마다 매 프레임 토스트가 스팸되지 않게 짧은 쿨다운만
    /// 얹었다(DUNGEON `DungeonMerchant.cs`의 거절 쿨다운과 같은 결).
    /// </summary>
    public class ForestVillager : MonoBehaviour
    {
        private static string DisplayName => ForestLocalization.T("villager.keeper.name", "숲지기");
        private static string Line => ForestLocalization.T("villager.keeper.line", "이 숲은 내가 돌본다 — 짐승을 함부로 놀라게 하지 마시게.");
        private const float TalkRadius = 2.5f;
        private const float RetalkCooldownSec = 4f;
        private const float ToastSec = 4f;

        [SerializeField] private GameObject modelPrefab; // BuildTestVillageForestScene.cs가 채운다.
        // PLAN.md 106-4 FOREST 몫 — Mixamo 사실 모델(Peasant Man). 로컬 전용이라 없으면 null → 위 Kenney.
        [SerializeField] private GameObject rigPrefab;
        /// <summary>사실 모델은 `ForestWorldCurve` 셰이더를 안 타 짐승·명소처럼 땅 휨만큼 내린다(Kenney 는 셰이더가 휜다).</summary>
        private Transform _rigVisual;

        public Transform RigVisual => _rigVisual;

        private float _cooldownLeft;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            else
            {
                var v = transform.Find("Visual");
                if (v != null && v.GetComponent<Animator>() != null) { _rigVisual = v; _rigBaseY = v.localPosition.y; }
            }
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var rig = NpcIdle.SpawnRigged(rigPrefab, transform, 1.8f, 245f); // 마을 가운데(원점) 쪽을 본다
            if (rig != null)
            {
                _rigVisual = rig.transform;
                _rigBaseY = _rigVisual.localPosition.y;
            }
            else if (modelPrefab != null)
            {
                CharacterVisual.Spawn(modelPrefab, transform, 1.8f, Color.white);
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(transform, 1.8f, new Color(0.3f, 0.55f, 0.35f));
            }
        }

        private void LateUpdate()
        {
            if (_rigVisual != null && _player != null) FollowCurve(_player.position);
        }

        /// <summary>땅 휨 따라 사실 모델을 내린다(`ForestLandmark.Follow` 와 같은 식). 진단도 부른다.</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_rigVisual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            var p = _rigVisual.localPosition;
            _rigVisual.localPosition = new Vector3(p.x, _rigBaseY - (dx * dx + dz * dz) * ForestLandmark.CurveAmount, p.z);
        }

        private float _rigBaseY;

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || _cooldownLeft > 0f) return;
            if (Vector3.Distance(transform.position, _player.position) > TalkRadius) return;

            _cooldownLeft = RetalkCooldownSec;
            Talk();
        }

        /// <summary>tasks U-0143 진단 — 마지막 말(하트 꼬리 포함).</summary>
        public string LastLine { get; private set; }

        /// <summary>말 한 번(다가서면 Update 가, 진단은 직접) — 그 글.</summary>
        public string Talk()
        {
            ForestHearts.Talk(ForestHearts.KeeperId); // tasks U-0143 — 그날 처음 다가서면 +1

            // PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 세배(매달 1일)만
            // 이 숲지기가 맡는다(웹판 "주민 5에게 세배"를 1명으로 좁힘).
            if (ForestFestivalState.TodayKind() == ForestFestivalState.Kind.Sebae &&
                ForestFestivalState.TryComplete(ForestFestivalState.Kind.Sebae, out int reward))
            {
                ForestHearts.Bump(ForestHearts.KeeperId, ForestHearts.DoneGain); // tasks U-0143 세배 완수 +2(웹 축제 하트)
                LastLine = string.Format(ForestLocalization.T("festival.sebae", "{0} — \"새해 복 많이 받으시게 — 세배값이네.\" (과일 +{1})"), DisplayName, reward)
                    + ForestHearts.Tail(ForestHearts.KeeperId);
                DialogueLabel.Instance?.Show(LastLine, ToastSec);
                return LastLine;
            }

            // tasks U-0143 — 10♥ 기념품 한 번 · 5♥ 고유 대화 · 하트 꼬리.
            string memento = ForestHearts.Memento(ForestHearts.KeeperId, DisplayName);
            LastLine = (memento ?? $"{DisplayName} — \"{ForestHearts.UniqLine(ForestHearts.KeeperId) ?? Line}\"") + ForestHearts.Tail(ForestHearts.KeeperId);
            DialogueLabel.Instance?.Show(LastLine, ToastSec);
            Saga.Core.SagaVoice.Say("greet", DisplayName); // U-0068 — 주민 인사 한 마디
            return LastLine;
        }
    }
}
