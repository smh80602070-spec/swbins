using TMPro;
using System;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-4 "고정 세계 지역 아홉"(웹 사가블로 §5.12) — 플레이어가 선 칸의 지역(<see cref="DungeonWorldMap"/>)을 매 프레임 재고,
    /// 새 지역에 <see cref="DungeonWorldMap.DwellSeconds"/>(1.2초) 머물면 화면 위쪽에 들어섬 배너 두 줄(이름 한자 / 자리 · 시대 · 사연).
    /// 지역 없는 곳(던전 층·능묘 속·난입/시련 방)에 들어갔다 같은 지역으로 돌아오면 다시 안 띄운다(마지막으로 알린 지역을 붙든다).
    /// 배너는 대사 줄(`DialogueLabel`)과 따로 제 캔버스 — 다른 알림을 덮지 않는다.
    /// 시작 때 한 번 그 칸 방 바닥에 땅빛(<see cref="DungeonWorldMap.FloorTint"/>)을 MaterialPropertyBlock 으로 곱한다(재질 애셋·인스턴스는 안 건드린다).
    /// 씬 빌더가 아니라 `GameBootstrap.Start()` → <see cref="Install"/> 이 Play 때 붙인다(씬 재빌드 없이, 109-10 결).
    /// </summary>
    public class DungeonRegionTracker : MonoBehaviour
    {
        public const float BannerSeconds = 4f;
        private const float FadeSeconds = 0.4f;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");

        public static DungeonRegionTracker Instance { get; private set; }

        /// <summary>지금 선 칸의 지역(-1 = 없음).</summary>
        public int Current { get; private set; } = -1;
        /// <summary>마지막으로 배너를 띄운 지역(-1 = 아직).</summary>
        public int Announced { get; private set; } = -1;
        /// <summary>땅빛을 받은 바닥 수(진단용).</summary>
        public int TintedFloors { get; private set; }
        public string BannerText => _banner != null ? _banner.text : "";
        public bool BannerVisible => _bannerLeft > 0f;

        /// <summary>새 지역 배너를 띄울 때(지역 번호). §5.13·5.14 가 이어 붙는다.</summary>
        public event Action<int> RegionEntered;

        private Transform _player;
        private int _candidate = -1;
        private float _dwell;
        private float _bannerLeft;
        private TextMeshProUGUI _banner;
        private CanvasGroup _bannerGroup;

        public static DungeonRegionTracker Install()
        {
            if (Instance != null) return Instance;
            var t = new GameObject("DungeonRegionTracker").AddComponent<DungeonRegionTracker>();
            return t;
        }

        private void Awake()
        {
            Instance = this;
            var p = GameObject.FindWithTag("Player");
            _player = p != null ? p.transform : null;
            BuildBanner();
            TintFloors();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (_player != null) Tick(_player.position, Time.deltaTime);
        }

        /// <summary>진단이 시간을 넣어 부를 수 있게 따로 뺐다.</summary>
        public void Tick(Vector3 pos, float dt)
        {
            int idx = DungeonWorldMap.IndexAt(pos);
            Current = idx;
            if (idx != _candidate) { _candidate = idx; _dwell = 0f; }
            else _dwell += dt;
            if (idx >= 0 && idx != Announced && _dwell >= DungeonWorldMap.DwellSeconds) Announce(idx);

            if (_bannerLeft > 0f)
            {
                _bannerLeft -= dt;
                float shown = BannerSeconds - _bannerLeft;
                float a = Mathf.Min(1f, shown / FadeSeconds, Mathf.Max(0f, _bannerLeft) / FadeSeconds);
                if (_bannerGroup != null) _bannerGroup.alpha = a;
                if (_bannerLeft <= 0f && _banner != null) _banner.gameObject.SetActive(false);
            }
        }

        /// <summary>진단이 앞뒤로 부른다 — 머묾·배너를 비우고 "마지막으로 알린 지역"을 그 값으로.</summary>
        public void ResetState(int announced)
        {
            Announced = announced;
            _candidate = -1;
            _dwell = 0f;
            _bannerLeft = 0f;
            if (_banner != null) _banner.gameObject.SetActive(false);
        }

        private void Announce(int idx)
        {
            Announced = idx;
            if (_banner != null)
            {
                _banner.text = DungeonWorldMap.BannerTitle(idx) + "\n<size=22>" + DungeonWorldMap.BannerLine(idx) + "</size>";
                _banner.color = BannerColor(idx);
                _banner.gameObject.SetActive(true);
            }
            if (_bannerGroup != null) _bannerGroup.alpha = 0f;
            _bannerLeft = BannerSeconds;
            RegionEntered?.Invoke(idx);
        }

        /// <summary>배너 글빛 — 땅빛 색조를 밝게 띄운 것(어두운 땅색 그대로면 글이 안 읽힌다).</summary>
        public static Color BannerColor(int idx) => Color.Lerp(DungeonWorldMap.FloorTint(idx), Color.white, 0.35f);

        private void TintFloors()
        {
            TintedFloors = 0;
            var block = new MaterialPropertyBlock();
            for (int i = 0; i < DungeonWorldMap.All.Length; i++)
            {
                var tint = DungeonWorldMap.FloorTint(i);
                foreach (var path in DungeonWorldMap.All[i].Rooms)
                {
                    var room = GameObject.Find(path);
                    var floor = room != null ? room.transform.Find("Floor") : null;
                    var r = floor != null ? floor.GetComponent<Renderer>() : null;
                    if (r == null || r.sharedMaterial == null) continue;
                    var baseColor = r.sharedMaterial.HasProperty(BaseColorId) ? r.sharedMaterial.GetColor(BaseColorId) : Color.white;
                    r.GetPropertyBlock(block);
                    block.SetColor(BaseColorId, baseColor * tint);
                    r.SetPropertyBlock(block);
                    TintedFloors++;
                }
            }
        }

        /// <summary>HUD 빈 틈(왼쪽 기둥 ~230 ↔ 오른쪽 단추 1010, 1600×900 기준)의 가운데 x — 지역 배너·대사 줄이 쓴다(110 ⑤c-3).</summary>
        public const float FreeCenterX = 615f;

        private void BuildBanner()
        {
            var canvasGo = new GameObject("RegionBannerCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 15;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);

            var go = new GameObject("RegionBanner", typeof(RectTransform));
            go.transform.SetParent(canvasGo.transform, false);
            var rt = (RectTransform)go.transform;
            // PLAN.md 110 ⑤c-3 — 가운데 1000 폭은 왼쪽 파티 줄·오른쪽 소환·비결 단추와 겹쳤다 → 둘 사이 빈 틈 가운데, 파티 줄 밑.
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0.5f, 1f);
            rt.anchoredPosition = new Vector2(FreeCenterX, -330f);
            rt.sizeDelta = new Vector2(760f, 110f);
            _bannerGroup = go.AddComponent<CanvasGroup>();
            _bannerGroup.blocksRaycasts = false;
            _bannerGroup.interactable = false;
            _banner = go.AddComponent<TextMeshProUGUI>();
            _banner.fontSize = 34;
            _banner.lineSpacing = 10f; // TMP: em/100 더하기(옛 UI.Text 배수 1.1)
            _banner.alignment = TextAlignmentOptions.Top;
            _banner.textWrappingMode = TextWrappingModes.Normal;
            _banner.overflowMode = TextOverflowModes.Overflow;
            _banner.raycastTarget = false;
            _banner.richText = true;
            Saga.Core.TmpEffect.Add(go, Saga.Core.TmpEffect.Kind.Outline, new Color(0f, 0f, 0f, 0.85f), 0.24f);
            go.SetActive(false);
        }
    }
}
