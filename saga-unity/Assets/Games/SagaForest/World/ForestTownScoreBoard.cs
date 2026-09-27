using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 101-2 5.8② "마을 평가" — `ForestCollectSpot.cs`와 같은
    /// 결(걸어서 가까이 가면 반응, 이 트랙엔 "놓기"류를 뺀 모든 상호작용이
    /// 이 관례를 쓴다)로 별점+조건 2줄을 보여준다. 채집 자리와 달리 상태를
    /// 안 바꾸는 순수 조회라 쿨다운을 길게 둬(가까이 서 있는 동안 계속
    /// 다시 안 뜨게) 도배를 막는다.
    /// </summary>
    public class ForestTownScoreBoard : MonoBehaviour
    {
        private const float ReadRadius = 2.5f;
        private const float ReadCooldownSec = 6f;
        private const float ToastSec = 4f;

        private float _cooldownLeft;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pole.name = "Visual";
            pole.transform.SetParent(transform, false);
            pole.transform.localScale = new Vector3(0.15f, 1.2f, 0.15f);
            pole.transform.localPosition = new Vector3(0f, 1.2f, 0f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestTownScoreBoard (generated)" };
            mat.color = new Color(0.6f, 0.5f, 0.35f);
            pole.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Object.Destroy(pole.GetComponent<Collider>());
        }

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || _cooldownLeft > 0f) return;
            if (Vector3.Distance(transform.position, _player.position) > ReadRadius) return;

            _cooldownLeft = ReadCooldownSec;
            ShowReading();
        }

        private void ShowReading()
        {
            int stars = ForestTownScore.Stars();
            var (homeLine, museumLine) = ForestTownScore.ConditionLines();
            string starText = new string('★', stars) + new string('☆', 5 - stars);
            string text = string.Format(ForestLocalization.T("town_score.board", "마을 평가 {0}\n{1}\n{2}"),
                starText, homeLine, museumLine);
            string guest = ForestTownScore.GuestLine(); // 109-12-2 이웃 손님
            if (guest != null) text += "\n" + guest;
            DialogueLabel.Instance?.Show(text, ToastSec);
        }
    }
}
