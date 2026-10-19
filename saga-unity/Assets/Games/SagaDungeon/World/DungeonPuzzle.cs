using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 마지막" — saga-dungeon
    /// 웹판 `room.puzzle`(퍼즐방, js/dungeon.js:366-382, `touchPuzzlePod()`
    /// js/dungeon.js:820-840)을 옮겼다: 제단 셋을 **맞는 순서**로 밟는다,
    /// 틀리면 처음부터(벌은 없다). 웹판은 방마다 순서를 무작위로 섞는데,
    /// 이 프로젝트의 테스트 씬은 전부 고정 좌표라(루트 CLAUDE.md "검증
    /// 습관" — 무작위는 씬 생성에 안 쓴다) 순서를 결정적으로 고정했다
    /// (`Order`). 다른 POI와 달리 `room.cleared`를 안 본다(웹판도 안 봄 —
    /// 몸이 아니라 머리로 푸는 방이라 몬스터와 무관).
    /// </summary>
    public class DungeonPuzzle : MonoBehaviour
    {
        private const float TriggerRadius = 1.8f;
        private const int RewardGold = 20;
        private const float ToastSec = 4f;
        private const string RewardItemId = "wp_saber";

        // 제단을 밟아야 할 순서(고정) — pod 배열 인덱스 기준.
        private static readonly int[] Order = { 1, 2, 0 };

        private static readonly Vector3[] PodOffsets =
        {
            new Vector3(-2f, 0f, 2.5f),
            new Vector3(0f, 0f, -1f),
            new Vector3(-2f, 0f, -2.5f),
        };

        private static readonly Color UnlitColor = new Color(0.32f, 0.3f, 0.34f);
        private static readonly Color LitColor = new Color(0.92f, 0.78f, 0.22f);

        private readonly Transform[] _pods = new Transform[3];
        private readonly Renderer[] _rends = new Renderer[3];
        private readonly bool[] _lit = new bool[3];
        private readonly bool[] _wasNear = new bool[3];

        private int _progress;
        private bool _solved;
        private Transform _player;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            else RestorePods();

            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            for (int i = 0; i < PodOffsets.Length; i++)
            {
                var pod = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pod.name = $"Pod_{i}";
                pod.transform.SetParent(transform, false);
                pod.transform.localScale = new Vector3(0.7f, 0.5f, 0.7f);
                pod.transform.localPosition = PodOffsets[i] + new Vector3(0f, 0.5f, 0f);

                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonPuzzlePod (generated)" };
                mat.color = UnlitColor;
                pod.GetComponent<MeshRenderer>().sharedMaterial = mat;
                Saga.Core.Colliders.Strip(pod);

                _pods[i] = pod.transform;
                _rends[i] = pod.GetComponent<Renderer>();
            }
        }

        // 세이브 로드 후 실제 Play가 다시 시작될 때(Awake는 그 한 번만 불린다) —
        // World/RareWolfEncounter.cs 등이 겪은 것과 같은 부류의 문제를 처음부터
        // 피하려고 자식은 그대로 두고 배열만 다시 채운다.
        private void RestorePods()
        {
            for (int i = 0; i < 3; i++)
            {
                var pod = transform.Find($"Pod_{i}");
                if (pod == null) continue;
                _pods[i] = pod;
                _rends[i] = pod.GetComponent<Renderer>();
            }
        }

        private void Update()
        {
            if (_solved || _player == null) return;

            for (int i = 0; i < 3; i++)
            {
                if (_pods[i] == null) continue;
                bool near = Vector3.Distance(_pods[i].position, _player.position) <= TriggerRadius;
                if (near && !_wasNear[i]) TouchPod(i);
                _wasNear[i] = near;
            }
        }

        private void TouchPod(int podIndex)
        {
            if (Order[_progress] == podIndex)
            {
                _lit[podIndex] = true;
                _rends[podIndex].material.color = LitColor;
                _progress++;
                if (_progress >= Order.Length)
                {
                    _solved = true;
                    HeroState.AddGold(RewardGold);
                    bool equipped = HeroState.EquipIfBetter(RewardItemId);
                    var item = ItemData.Get(RewardItemId);
                    DialogueLabel.Instance?.Show(
                        string.Format(DungeonLocalization.T("puzzle.solved", "퍼즐을 풀었다! — 돈 +{0}냥, {1}을(를) 얻었다{2}"), RewardGold, item.Name,
                            equipped ? DungeonLocalization.T("puzzle.equipped", " — 바로 갖췄다.") : "."),
                        ToastSec);
                }
                else
                {
                    DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("puzzle.next", "✓ 다음 제단 ({0}/{1})"), _progress, Order.Length), ToastSec);
                }
            }
            else if (_progress > 0)
            {
                _progress = 0;
                for (int i = 0; i < 3; i++)
                {
                    _lit[i] = false;
                    _rends[i].material.color = UnlitColor;
                }
                DialogueLabel.Instance?.Show(DungeonLocalization.T("puzzle.wrong", "× 순서가 틀렸다 — 처음부터."), ToastSec);
            }
        }
    }
}
