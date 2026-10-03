using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0029 — 폐허 곁 돌무더기 하나 = 탑성 조각 하나(`ForestRuinBundle`). 가까이 가면 한 번 줍고
    /// "처음으로 발견했다" 토스트, 이미 주웠으면 빈 무더기다. `ForestCollectSpot`(반경 2.5·팝업·범프)을 본뜨되
    /// **연속 채집 보너스(`ForestGatherFeel.Play` → 과일)·방문객·꽃놀이·시나리오 집계는 안 건드린다**(보너스 갈래).
    /// 자리 = 꽃밭 명소(옛 돌기둥터) 둘레 — 웹 `village.js` 오프셋 여섯 × <see cref="TileM"/>.
    /// 씬 재빌드 없이 `ForestBootstrap.Start` 가 Play 때 <see cref="Install"/> 로 짓는다.
    /// 땅 휨은 `ForestLandmark.Follow` 와 같은 식으로 "Visual" 만 내린다(충돌체 없음 — 가까이선 휨이 거의 0).
    /// </summary>
    public class ForestRubbleSpot : MonoBehaviour
    {
        public const float GatherRadius = 2.5f;
        public const float ToastSec = 3f;
        /// <summary>웹 한 칸(TILE) ≈ 이 미터 — 명소 기둥(`ForestLandmark`)과 안 겹치게 잡은 값.</summary>
        public const float TileM = 1.5f;
        /// <summary>웹 `village.js` 돌무더기 여섯 자리 오프셋(칸, x·z).</summary>
        public static readonly Vector2[] Offsets =
        {
            new Vector2(-2.6f, -0.4f), new Vector2(-0.6f, 1.7f), new Vector2(2.5f, 0.9f),
            new Vector2(1.9f, -0.9f), new Vector2(-1.2f, -1.6f), new Vector2(0.6f, -1.7f),
        };

        public const string RootName = "RuinRubbleSpots";

        [SerializeField] private int index;

        private Transform _player;
        private Transform _visual;
        private Renderer _renderer;

        public int Index => index;
        public string PieceKey => ForestRuinBundle.Keys[index];

        /// <summary>씬에 선 돌무더기 전부(없으면 빈 배열) — 정적 목록 대신 루트 아래를 훑어 편집 모드(Awake 안 돎)에서도 맞다.</summary>
        public static ForestRubbleSpot[] Spots()
        {
            var root = GameObject.Find(RootName);
            return root == null ? new ForestRubbleSpot[0] : root.GetComponentsInChildren<ForestRubbleSpot>();
        }

        /// <summary>꽃밭 명소 자리(옛 돌기둥터) — 폐허가 선 곳.</summary>
        public static Vector3 RuinCenter()
        {
            foreach (var z in ForestBiomeData.Zones)
                if (z.Key == "flower_field") return new Vector3(z.LandmarkPos.x, 0f, z.LandmarkPos.y);
            return Vector3.zero;
        }

        /// <summary>돌무더기 여섯을 세운다. 이미 세웠으면 아무것도 안 하고(두 번 불러도 안 늘어남) 있는 것을 돌려준다.</summary>
        public static ForestRubbleSpot[] Install()
        {
            if (GameObject.Find(RootName) != null) return Spots();
            var root = new GameObject(RootName).transform;
            Vector3 c = RuinCenter();
            for (int i = 0; i < Offsets.Length; i++)
            {
                var go = new GameObject("RuinRubble_" + ForestRuinBundle.Keys[i]);
                go.transform.SetParent(root, false);
                go.transform.position = c + new Vector3(Offsets[i].x * TileM, 0f, Offsets[i].y * TileM);
                go.AddComponent<ForestRubbleSpot>().Init(i);
            }
            return Spots();
        }

        private void Init(int i)
        {
            index = i;
            Refresh();
        }

        private void Awake()
        {
            BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            Refresh();
        }

        // 돌무더기 — 납작한 돌 셋을 쌓은 primitive. 주운 뒤엔 어둡게 식는다(빈 무더기).
        private void BuildVisual()
        {
            _visual = new GameObject("Visual").transform;
            _visual.SetParent(transform, false);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestRubbleSpot (generated)" };
            mat.color = new Color(0.52f, 0.5f, 0.46f);
            Vector3[] pos = { new Vector3(0f, 0.15f, 0f), new Vector3(0.35f, 0.12f, 0.2f), new Vector3(-0.2f, 0.4f, 0.1f) };
            Vector3[] scl = { new Vector3(0.9f, 0.3f, 0.7f), new Vector3(0.5f, 0.25f, 0.45f), new Vector3(0.45f, 0.3f, 0.4f) };
            for (int i = 0; i < pos.Length; i++)
            {
                var rock = GameObject.CreatePrimitive(PrimitiveType.Cube);
                rock.name = "Rock" + i;
                rock.transform.SetParent(_visual, false);
                rock.transform.localPosition = pos[i];
                rock.transform.localScale = scl[i];
                rock.transform.localRotation = Quaternion.Euler(0f, 25f * i + 10f, 6f * i);
                rock.GetComponent<MeshRenderer>().sharedMaterial = mat;
                Destroy(rock.GetComponent<Collider>());
                if (_renderer == null) _renderer = rock.GetComponent<MeshRenderer>();
            }
        }

        /// <summary>주운 뒤엔 색을 어둡게 — 같은 재질을 공유하므로 한 번에 바뀐다.</summary>
        private void Refresh()
        {
            if (_renderer == null) return;
            _renderer.sharedMaterial.color = ForestRuinBundle.IsFound(PieceKey)
                ? new Color(0.3f, 0.29f, 0.27f)
                : new Color(0.52f, 0.5f, 0.46f);
        }

        private void LateUpdate()
        {
            if (_player == null || _visual == null) return;
            Vector3 p = transform.position, q = _player.position;
            float dx = p.x - q.x, dz = p.z - q.z;
            _visual.localPosition = new Vector3(0f, -(dx * dx + dz * dz) * ForestLandmark.CurveAmount, 0f);
        }

        private void Update()
        {
            if (_player == null) return;
            if (Vector3.Distance(transform.position, _player.position) > GatherRadius) { _emptyShown = false; return; }
            TryPick();
        }

        /// <summary>이 무더기를 뒤진다 — 처음 줍는 조각이면 true. 이미 주운 무더기는 "비었다" 만 한 번 띄우고 false
        /// (가까이 서 있는 동안 매 프레임 안 띄우도록 비었다 안내는 반경 밖으로 나갔다 올 때만 — <see cref="_emptyShown"/>).</summary>
        public bool TryPick()
        {
            if (ForestRuinBundle.IsFound(PieceKey))
            {
                if (!_emptyShown)
                {
                    _emptyShown = true;
                    DialogueLabel.Instance?.Show(ForestLocalization.T("ruin.empty_toast", "이미 뒤져 본 돌무더기다 — 비었다."), ToastSec);
                }
                return false;
            }
            _emptyShown = true;
            string shown = ForestRuinBundle.DisplayName(PieceKey);
            // 여섯째면 Record 가 완성 이벤트(정자·완성 토스트)를 쏘므로, 조각 토스트를 먼저 띄워 완성 글이 위에 남게 한다.
            DialogueLabel.Instance?.Show(
                string.Format(ForestLocalization.T("ruin.piece_new_toast", "{0}을(를) 찾았다! (탑성 조각 {1}/{2})"),
                    shown, ForestRuinBundle.FoundCount + 1, ForestRuinBundle.Total), ToastSec);
            ForestGatherPopup.Spawn(transform.position + Vector3.up * 1.2f, "NEW! " + shown, false);
            if (_visual != null) ForestGatherBump.Apply(_visual);
            ForestRuinBundle.Record(PieceKey);
            Refresh();
            return true;
        }

        private bool _emptyShown;
    }
}
