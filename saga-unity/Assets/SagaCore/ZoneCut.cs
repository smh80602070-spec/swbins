using System;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0225 구역 넘김 막(웹 W-0414 `zone-cut.js` 이식) — 다른 땅으로 순간이동할 때 그 프레임에 곧장 검은 막을 덮고,
    /// 새 자리가 다 서면(최소 <see cref="HoldSec"/>·<see cref="HoldFrames"/>, 준비 묻기가 있으면 그게 참일 때, 상한 <see cref="MaxSec"/>)
    /// <see cref="RevealSec"/> 동안 걷는다. 덮는 쪽을 페이드로 하지 않고 즉시 덮는 까닭: 순간이동은 부르는 쪽에서 그 자리에서 일어나야
    /// (진단·저장·이야기 흐름이 곧장 새 자리를 본다) 하므로, 같은 프레임에 막이 먼저 그려지면 옛 자리 → 새 자리 튐이 안 보인다.
    /// 덮인 동안 누름은 막이 가로채고(<see cref="Busy"/> — 플레이어 컨트롤러가 이동을 멈춘다). 손잡이 `SAGA_ZONE_CUT=0`·<see cref="On"/>.
    /// </summary>
    public sealed class ZoneCut : MonoBehaviour
    {
        public const int SortingOrder = 32000;     // 모든 HUD·카드 위
        public const float HoldSec = 0.18f;        // 최소로 덮어 두는 시간(셰이더 처음 그리기 끊김을 가림)
        public const int HoldFrames = 2;
        public const float MaxSec = 1.6f;          // 준비 묻기가 안 끝나도 이만큼이면 걷는다(웹 zoneCut.max)
        public const float RevealSec = 0.25f;

        /// <summary>진단 손잡이 — 거짓이면 막을 안 띄운다. 기본은 환경 변수 `SAGA_ZONE_CUT=0` 이 아니면 켬.</summary>
        public static bool On = Environment.GetEnvironmentVariable("SAGA_ZONE_CUT") != "0";

        /// <summary>막이 조금이라도 보이는가(덮는 중·걷는 중).</summary>
        public static bool Covering => Alpha > 0f && _inst != null;
        /// <summary>완전히 덮여 걷기 전 — 이동·누름을 막는 동안.</summary>
        public static bool Busy { get => _busy && _inst != null; private set => _busy = value; }   // 씬이 바뀌어 막이 지워지면 풀림
        private static bool _busy;
        public static float Alpha { get; private set; }
        /// <summary>띄운 횟수(진단).</summary>
        public static int Count { get; private set; }
        /// <summary>마지막으로 부른 쪽 이름(진단).</summary>
        public static string LastTag { get; private set; }
        /// <summary>덮은 곳 이름 모음(진단 — 어느 순간이동 길이 막을 탔나).</summary>
        public static readonly System.Collections.Generic.HashSet<string> Seen = new System.Collections.Generic.HashSet<string>();

        private static ZoneCut _inst;
        private static Image _img;
        private static float _held, _reveal;
        private static int _frames;
        private static Func<bool> _ready;

        /// <summary>곧장 덮고 <paramref name="build"/>(순간이동·짓기)를 부른 뒤 준비되면 걷는다.</summary>
        public static void Run(string tag, Action build, Func<bool> ready = null)
        {
            Cover(tag, ready);
            build?.Invoke();
        }

        /// <summary>곧장 덮기만 한다 — 부르는 쪽이 이어서 순간이동한다. 이미 덮여 있으면 시간을 처음부터 다시 잰다.</summary>
        public static void Cover(string tag, Func<bool> ready = null)
        {
            LastTag = tag;
            if (!On) return;
            Ensure();
            Count++;
            Seen.Add(tag);
            _held = 0f; _frames = 0; _reveal = 0f; _ready = ready;
            Busy = true;
            Alpha = 1f;
            Apply();
        }

        private void Update() => Tick(Time.unscaledDeltaTime);

        /// <summary>한 프레임 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public static void Tick(float dt)
        {
            if (!Covering) return;
            if (Busy)
            {
                _held += dt; _frames++;
                bool ready = _ready == null || SafeReady();
                if ((_held >= HoldSec && _frames >= HoldFrames && ready) || _held >= MaxSec)
                {
                    Busy = false;
                    _ready = null;
                }
                return;
            }
            _reveal += dt;
            Alpha = Mathf.Clamp01(1f - _reveal / RevealSec);
            Apply();
        }

        private static bool SafeReady()
        {
            try { return _ready(); }
            catch (Exception e) { Debug.LogException(e); return true; }
        }

        /// <summary>진단 — 캔버스를 지우고 상태를 처음으로.</summary>
        public static void ResetForTest()
        {
            if (_inst != null) DestroyImmediate(_inst.gameObject);
            _inst = null; _img = null;
            Busy = false; Alpha = 0f; Count = 0; LastTag = null; Seen.Clear();
            _held = 0f; _frames = 0; _reveal = 0f; _ready = null;
        }

        private static void Ensure()
        {
            if (_inst != null) return;
            var go = new GameObject("ZoneCut");
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = SortingOrder;
            go.AddComponent<GraphicRaycaster>(); // 덮인 동안 아래 단추를 못 누르게
            var veil = new GameObject("Veil", typeof(RectTransform));
            veil.transform.SetParent(go.transform, false);
            var rt = (RectTransform)veil.transform;
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            _img = veil.AddComponent<Image>();
            _img.color = new Color(0f, 0f, 0f, 0f);
            _img.raycastTarget = true;
            _img.enabled = false;
            _inst = go.AddComponent<ZoneCut>();
        }

        private static void Apply()
        {
            if (_img == null) return;
            _img.color = new Color(0f, 0f, 0f, Alpha);
            _img.enabled = Alpha > 0f;
            _img.raycastTarget = Busy;
        }
    }
}
