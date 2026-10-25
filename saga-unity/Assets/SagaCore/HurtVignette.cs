using System;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0105(고돗 G-0203 `saga_core/ui/hurt_vignette.gd` 짝) — "내가 맞았다·위험하다" 화면 신호.
    ///   <see cref="Flash"/>   — 맞은 순간 화면 가장자리가 붉게 번쩍(알파 0.45 → 0, 0.4초).
    ///   <see cref="Bind"/>    — 지금 인물 체력 비율을 넘겨 두면 30% 밑(0 은 빼고)에서 가장자리가 옅게 맥박(0.6~1.2Hz, 알파 0.15~0.3).
    ///   <see cref="SetLow"/>  — 손으로 맥박을 켜고 끈다(Bind 없이 쓰는 판용).
    /// 처음 부를 때 지금 장면에 Screen Space Overlay 캔버스 하나 + 가장자리만 붉은 RawImage 를 만든다(텍스처는 코드로 — 새 에셋 0).
    /// 가운데는 늘 투명(가장자리 25% 폭만), 레이캐스트 안 받음. 장면이 바뀌면 같이 사라지고 다음 부름에 다시 생긴다.
    /// 시간은 <c>Time.unscaledDeltaTime</c> — 치명 멈춤(timeScale 0) 중에도 사라진다. 진단은 <see cref="Tick"/> 을 손으로 부른다.
    /// </summary>
    [DisallowMultipleComponent]
    public class HurtVignette : MonoBehaviour
    {
        public const float FlashSec = 0.4f;
        public const float FlashA = 0.45f;
        public const float LowFrac = 0.3f;
        public const float PulseMinA = 0.15f, PulseMaxA = 0.3f;
        public const float PulseHzSlow = 0.6f, PulseHzFast = 1.2f;
        /// <summary>가장자리 띠가 시작하는 자리(가운데 0 ~ 가장자리 1, 상자 거리) — 바깥 25% 폭만 붉다.</summary>
        public const float Inner = 0.75f;
        /// <summary>판 HUD(0~4) 위, 창·패널(5~) 아래 — 열어 둔 창은 물들이지 않는다.</summary>
        public const int SortingOrder = 4;
        private const int TexSize = 128;
        private const float LowRampPerSec = 4f;
        public static readonly Color Red = new Color(0.85f, 0.05f, 0.04f, 1f);

        private static HurtVignette _inst;
        private static RawImage _img;
        private static Texture2D _tex;
        private static float _flashT, _lowW, _phase;
        private static Color _tint = Red;
        private static bool _manualLow;
        private static Func<float> _bind;
        private static UnityEngine.Object _owner;
        private static bool _hasOwner;

        /// <summary>진단 — 지금 그리는 알파(번쩍·맥박 중 큰 것).</summary>
        public static float Alpha { get; private set; }
        /// <summary>진단 — 번쩍 부른 횟수(이번 켬).</summary>
        public static int FlashCount { get; private set; }
        /// <summary>진단 — 지금 장면의 신호 캔버스(없으면 null).</summary>
        public static Canvas CanvasNow => _inst != null ? _inst.GetComponent<Canvas>() : null;
        public static RawImage ImageNow => _inst != null ? _img : null;
        public static Texture2D EdgeTexture => _tex != null ? _tex : (_tex = BuildTexture());
        /// <summary>진단 — 지금 Bind 를 건 쪽(판 컴포넌트).</summary>
        public static UnityEngine.Object BoundOwner => _bind != null ? _owner : null;
        public static Func<float> BoundFunc => _bind;

        /// <summary>맞은 순간 — 가장자리 붉게 번쩍.</summary>
        public static void Flash() { Flash(Red); TalkFace.HeroHurt(); } // tasks U-0233 붉은 번쩍 = 맞음 → 주인공 얼굴 놀람

        /// <summary>tasks U-0142 — 색만 다른 번쩍(4종횡 저스트 회피 = 금빛). 번쩍이 끝나도 그 색이 맥박까지 남지 않게 다음 Flash()·맥박은 붉게.</summary>
        public static Color Tint => _tint;
        public static void Flash(Color tint)
        {
            _tint = tint;
            FlashCount++;
            _flashT = FlashSec;
            Ensure();
            Alpha = Mathf.Max(Alpha, FlashA);
            Apply();
        }

        /// <summary>손으로 맥박 켜고 끄기(Bind 와 함께면 둘 중 하나라도 낮으면 켜짐).</summary>
        public static void SetLow(bool on)
        {
            _manualLow = on;
            if (on) Ensure();
        }

        /// <summary>체력 비율(0~1)을 주는 함수를 건다. owner 가 사라지면(장면이 바뀜) 저절로 풀린다.</summary>
        public static void Bind(Func<float> hpFrac, UnityEngine.Object owner = null)
        {
            _bind = hpFrac;
            _owner = owner;
            _hasOwner = owner != null;
            if (hpFrac != null && Application.isPlaying) Ensure();
        }

        /// <summary>그 owner 가 건 Bind 만 푼다(다른 판·다른 인물이 새로 건 것은 그대로).</summary>
        public static void Unbind(UnityEngine.Object owner)
        {
            if (_bind != null && _owner == owner) { _bind = null; _owner = null; _hasOwner = false; }
        }

        /// <summary>지금 체력 비율(Bind 없거나 owner 가 사라졌으면 1).</summary>
        public static float BoundFrac()
        {
            if (_bind == null) return 1f;
            if (_hasOwner && _owner == null) { _bind = null; _owner = null; _hasOwner = false; return 1f; }
            try { return _bind(); }
            catch (Exception) { return 1f; }
        }

        /// <summary>맥박을 켤 때인가 — 손 SetLow 거나, Bind 한 체력이 0 보다 크고 30% 밑.</summary>
        public static bool LowNow
        {
            get
            {
                if (_manualLow) return true;
                float f = BoundFrac();
                return f > 0f && f < LowFrac;
            }
        }

        /// <summary>한 걸음(초) — 평소엔 캔버스가 unscaledDeltaTime 으로, 진단은 손으로 부른다.</summary>
        public static void Tick(float dt)
        {
            if (dt < 0f) dt = 0f;
            _flashT = Mathf.Max(0f, _flashT - dt);
            bool low = LowNow;
            _lowW = Mathf.MoveTowards(_lowW, low ? 1f : 0f, dt * LowRampPerSec);
            float f = Mathf.Clamp01(BoundFrac() / LowFrac);
            float hz = Mathf.Lerp(PulseHzFast, PulseHzSlow, f); // 낮을수록 빠르게
            _phase = Mathf.Repeat(_phase + dt * hz * Mathf.PI * 2f, Mathf.PI * 2f);
            float pulse = _lowW > 0f ? _lowW * Mathf.Lerp(PulseMinA, PulseMaxA, 0.5f + 0.5f * Mathf.Sin(_phase)) : 0f;
            float flash = FlashA * (_flashT / FlashSec);
            if (_flashT <= 0f) _tint = Red;
            Alpha = Mathf.Max(flash, pulse);
            Apply();
        }

        /// <summary>진단 — 캔버스를 지우고 상태를 처음으로(Bind 도 푼다).</summary>
        public static void ResetForTest()
        {
            if (_inst != null) DestroyImmediate(_inst.gameObject);
            _inst = null; _img = null;
            _flashT = 0f; _lowW = 0f; _phase = 0f; _manualLow = false; _tint = Red;
            _bind = null; _owner = null; _hasOwner = false;
            Alpha = 0f; FlashCount = 0;
        }

        private static void Ensure()
        {
            if (_inst != null) return;
            var go = new GameObject("HurtVignette");
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = SortingOrder;
            // GraphicRaycaster 는 붙이지 않는다 — 누름·끌기를 하나도 가로채지 않게.
            var edge = new GameObject("Edge", typeof(RectTransform));
            edge.transform.SetParent(go.transform, false);
            var rt = (RectTransform)edge.transform;
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            _img = edge.AddComponent<RawImage>();
            _img.texture = EdgeTexture;
            _img.raycastTarget = false;
            _img.color = new Color(Red.r, Red.g, Red.b, 0f);
            _img.enabled = false;
            _inst = go.AddComponent<HurtVignette>();
            Apply();
        }

        private static void Apply()
        {
            if (_img == null) return;
            _img.color = new Color(_tint.r, _tint.g, _tint.b, Alpha);
            _img.enabled = Alpha > 0.001f;
        }

        /// <summary>흰색 + 알파만 가장자리 — 상자 거리 e = max(|dx|,|dy|)·2, a = smoothstep(Inner, 1, e)²(고돗 셰이더와 같은 모양).</summary>
        private static Texture2D BuildTexture()
        {
            var tex = new Texture2D(TexSize, TexSize, TextureFormat.RGBA32, false)
            {
                name = "HurtVignetteEdge (generated)",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                hideFlags = HideFlags.DontSave,
            };
            var px = new Color32[TexSize * TexSize];
            for (int y = 0; y < TexSize; y++)
            {
                for (int x = 0; x < TexSize; x++)
                {
                    float dx = Mathf.Abs((x + 0.5f) / TexSize - 0.5f) * 2f;
                    float dy = Mathf.Abs((y + 0.5f) / TexSize - 0.5f) * 2f;
                    float e = Mathf.Max(dx, dy);
                    float a = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(Inner, 1f, e));
                    a *= a;
                    px[y * TexSize + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(a * 255f));
                }
            }
            tex.SetPixels32(px);
            tex.Apply(false, false);
            return tex;
        }

        private void Update()
        {
            if (_inst != this) return;
            Tick(Time.unscaledDeltaTime);
        }

        private void OnDestroy()
        {
            if (_inst == this) { _inst = null; _img = null; }
        }
    }
}
