using System.Collections.Generic;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 101-2 5.3 FOREST "마을 번들" — `ForestFruitTree.cs`와 같은
    /// 결(걸어서 가까이 가면 반응, 짧은 쿨다운)이지만 매번 같은 산딸기
    /// 대신 이 존의 갈래 어휘(<see cref="ForestMuseumState.Category"/>)
    /// 중 하나를 무작위로 준다. 네 바이옴 존(`ForestBiomeData.Zones`)에
    /// 하나씩 세운다(`Editor/BuildTestVillageForestScene.cs` `BuildMuseum()`).
    /// </summary>
    public class ForestCollectSpot : MonoBehaviour
    {
        private const float GatherRadius = 2.5f;
        private const float GatherCooldownSec = 2f;
        private const float ToastSec = 3f;

        [SerializeField] private ForestMuseumState.Category category;
        [SerializeField] private string[] pool;
        [SerializeField] private Color spotColor = Color.white;
        [SerializeField] private AudioClip[] gatherClips; // BuildTestVillageForestScene.cs가 채운다 — 101-2 5.8① 라운드로빈.

        private static readonly Dictionary<ForestMuseumState.Category, Vector3> Positions =
            new Dictionary<ForestMuseumState.Category, Vector3>();

        /// <summary>`World/ForestBootstrap.cs`가 완성 시설을 이 자리 근처에
        /// 짓기 위해 읽는다 — 씬에 존별로 하나뿐이라 정적 표로 충분하다.</summary>
        public static Vector3 PositionOf(ForestMuseumState.Category c) =>
            Positions.TryGetValue(c, out var p) ? p : Vector3.zero;

        private readonly System.Random _rng = new System.Random(20260824); // 루트 CLAUDE.md 진단 시드 관례.
        private float _cooldownLeft;
        private Transform _player;
        private Transform _visual;

        private void Awake()
        {
            Positions[category] = transform.position;
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
            visual.transform.localScale = Vector3.one * 1.1f;
            visual.transform.localPosition = new Vector3(0f, 0.55f, 0f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestCollectSpot (generated)" };
            mat.color = spotColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Object.Destroy(visual.GetComponent<Collider>());
        }

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || pool == null || pool.Length == 0 || _cooldownLeft > 0f) return;
            if (Vector3.Distance(transform.position, _player.position) > GatherRadius) return;

            _cooldownLeft = GatherCooldownSec;
            string item = pool[_rng.Next(pool.Length)];
            bool isNew = ForestMuseumState.Record(category, item);

            string key = isNew ? "museum.gather_new_toast" : "museum.gather_toast";
            string fallback = isNew
                ? "{0}을(를) 처음으로 발견했다! (도감에 기록됨)"
                : "{0}을(를) 발견했다(이미 도감에 있음)";
            string shown = ForestMuseumState.DisplayName(item);
            DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T(key, fallback), shown), ToastSec);

            string popupLabel = isNew ? $"NEW! {shown}" : shown;
            ForestGatherFeel.Play(transform.position + Vector3.up * 1.2f, _visual, popupLabel, gatherClips);

            // PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 꽃놀이(매달 8일)만
            // 이 채집 자리 넷이 맡는다(웹판 "1분 안에 꽃 8종류"를 이 트랙의
            // 실제 갈래 수 4로 좁힘).
            // PLAN.md 109-12-1 — 가져오기 손님(낚시 명인·곤충 박사·시간 여행자)을 만났으면 이 채집을 센다.
            string visitLine = ForestVisitors.OnGather(category);
            if (visitLine != null) DialogueLabel.Instance?.Show(visitLine, ToastSec);

            int flowerHuntReward = ForestFestivalState.ReportCollectSpotGather(category);
            if (flowerHuntReward > 0)
            {
                DialogueLabel.Instance?.Show(
                    string.Format(ForestLocalization.T("festival.flowerhunt_done", "🌸 꽃놀이 성사! — 네 갈래를 1분 안에 모두 찾았다 (과일 +{0})"), flowerHuntReward),
                    ToastSec);
            }
        }
    }
}
