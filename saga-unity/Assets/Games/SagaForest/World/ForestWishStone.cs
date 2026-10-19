using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 소원(매달 15일, 웹판
    /// "칠석 소원"의 재해석). 원문 "별똥별 확정"은 하늘 이벤트가 없어
    /// 마을 한복판에 세운 고정 오브젝트로 좁혔다 — <see cref="ForestVillager"/>와
    /// 같은 결(다가가면 반응, 쿨다운으로 스팸 방지)이지만 매번 다른 판정을
    /// 한다: 오늘이 소원날이고 아직 안 빌었으면 완료 처리(24시간 채집
    /// 배율 버프), 그 밖엔 안내만.
    /// </summary>
    public class ForestWishStone : MonoBehaviour
    {
        private const float InteractRadius = 2.5f;
        private const float RetalkCooldownSec = 4f;
        private const float ToastSec = 4f;

        private float _cooldownLeft;
        private Transform _player;
        private Transform _visual;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            _visual = transform.Find("Visual");
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = Vector3.one * 0.8f;
            visual.transform.localPosition = new Vector3(0f, 0.4f, 0f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestWishStone (generated)" };
            mat.color = new Color(0.55f, 0.75f, 0.95f);
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", new Color(0.2f, 0.4f, 0.7f));
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Saga.Core.Colliders.Strip(visual);
            _visual = visual.transform;
        }

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || _cooldownLeft > 0f) return;
            if (Vector3.Distance(transform.position, _player.position) > InteractRadius) return;

            _cooldownLeft = RetalkCooldownSec;

            if (ForestFestivalState.TodayKind() != ForestFestivalState.Kind.Wish)
            {
                DialogueLabel.Instance?.Show(
                    ForestLocalization.T("festival.wish_idle", "소원돌 — 소원날에만 별똥별이 뜬다고 한다."),
                    ToastSec);
                return;
            }

            if (ForestFestivalState.TryComplete(ForestFestivalState.Kind.Wish, out _))
            {
                DialogueLabel.Instance?.Show(
                    ForestLocalization.T("festival.wish_done", "✨ 별똥별에 소원을 빌었다 — 24시간 동안 채집이 잘 될 것 같다(과일 획득 ×1.5)."),
                    ToastSec);
            }
            else
            {
                DialogueLabel.Instance?.Show(
                    ForestLocalization.T("festival.wish_already", "오늘 소원은 이미 빌었다."),
                    ToastSec);
            }
        }
    }
}
