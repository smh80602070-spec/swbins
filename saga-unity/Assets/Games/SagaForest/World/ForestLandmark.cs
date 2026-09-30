using System.Collections.Generic;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 108 ② "고정 특색 지역" — 존마다 하나 서는 이름 있는 명소(`ForestBiomeData.Zone.LandmarkPos`).
    /// 모양은 편집기 씬 빌더가 CC0 GLB(돌제단·선돌·돌고리·돌기둥)를 "Visual" 아래에 짜 넣는다.
    /// GLB 는 PBR 재질이라 `ForestWorldCurve` 셰이더를 안 타므로, 땅이 휘는 만큼(거리² × 0.004)
    /// "Visual" 을 통째로 내려 멀리서 떠 보이지 않게 한다(충돌체는 뿌리에 두어 안 움직인다 — 가까이선 휨이 거의 0).
    /// 가까이 오면 이름·사연 자막을 한 번 띄우고, 멀리 벗어났다 다시 오면 또 띄운다. "처음 봄"은 이 판(세션) 안에서만 센다.
    /// </summary>
    public class ForestLandmark : MonoBehaviour
    {
        public const float NoticeRadius = 5f;
        public const float ResetRadius = 9f;
        /// <summary>`ForestWorldCurve.shader` `_CurveAmount` 기본값과 같아야 한다.</summary>
        public const float CurveAmount = 0.004f;
        private const float ToastSec = 4f;

        [SerializeField] private int zoneIndex;

        private static readonly HashSet<int> Seen = new HashSet<int>();
        private Transform _visual;
        private Transform _player;
        private bool _inside;

        public int ZoneIndex => zoneIndex;
        public static int SeenCount => Seen.Count;
        public string LastText { get; private set; }
        public Transform Visual => _visual;

        public static void ResetForTest() => Seen.Clear();

        private void Awake()
        {
            _visual = transform.Find("Visual");
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void LateUpdate()
        {
            if (_player == null) return;
            Follow(_player.position);
            Tick(Vector2.Distance(new Vector2(transform.position.x, transform.position.z), new Vector2(_player.position.x, _player.position.z)));
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다. 진단도 부른다.</summary>
        public void Follow(Vector3 curveCenter)
        {
            if (_visual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            _visual.localPosition = new Vector3(0f, -(dx * dx + dz * dz) * CurveAmount, 0f);
        }

        /// <summary>플레이어와의 수평 거리로 한 틱. 자막을 띄웠으면 true. 진단도 부른다.</summary>
        public bool Tick(float dist)
        {
            if (_inside)
            {
                if (dist > ResetRadius) _inside = false;
                return false;
            }
            if (dist > NoticeRadius) return false;
            _inside = true;
            LastText = NoticeText(zoneIndex, Seen.Add(zoneIndex));
            ForestScenario.OnLandmark(zoneIndex); // PLAN.md 109-16 — 시나리오 go 단계
            DialogueLabel.Instance?.Show(LastText, ToastSec);
            return true;
        }

        public static string NoticeText(int zone, bool first)
        {
            var z = ForestBiomeData.Zones[zone];
            string head = first
                ? string.Format(ForestLocalization.T("landmark.found", "명소 발견! ◆ {0}"), z.LandmarkName)
                : string.Format(ForestLocalization.T("landmark.again", "◆ {0}"), z.LandmarkName);
            return head + "\n" + z.LandmarkLore;
        }
    }
}
