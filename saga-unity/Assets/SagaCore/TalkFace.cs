using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0233 얼굴(고돗 G-0287 짝) — VRoid 얼굴 모프(`Fcl_EYE_Close`·`Fcl_ALL_Joy`·`Fcl_ALL_Surprised`·`Fcl_MTH_A~O`)로
    /// 눈 깜박임(2.5~6초 간격·0.12초) · <see cref="Flash"/>(감정 무게 1 → sec 동안 잦아듦) · 말하는 동안 입 모양(0.09초마다 A·I·U·E·O).
    /// 몸 Visual 에 붙는다(<see cref="Attach"/>) — 얼굴 메시에 그 모프가 없으면 안 붙는다(공방 동료 몸 등은 지금처럼).
    /// LOD 사본(Face·Face.001 …)이 여럿이면 다 같이 움직인다. 군중은 깜박임만(<c>blinkOnly</c>) · 카메라 20m 밖이면 멈춤(폰 비용).
    /// 깜박임 간격은 몸 이름 해시 시드 xorshift — `UnityEngine.Random` 은 안 쓴다(판 진단 굴림 줄이 밀림, U-0224 함정).
    /// 주인공(<see cref="Hero"/>)은 `HurtVignette.Flash()`(붉은 번쩍 = 맞음)에 놀람 0.45초 · 판이 부르는 <see cref="HeroJoy"/> 에 웃음 2초.
    /// 손잡이 `SAGA_FACE=0`.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class TalkFace : MonoBehaviour
    {
        public enum Mood { None, Joy, Surprised, Angry, Sorrow, Fun }

        public const float BlinkMin = 2.5f, BlinkMax = 6f, BlinkClose = 0.12f;
        public const float SurpriseSec = 0.45f, JoySec = 2f, MouthStep = 0.09f, FarCull = 20f;
        public static bool On = Environment.GetEnvironmentVariable("SAGA_FACE") != "0";
        /// <summary>지금 주인공 얼굴(판이 몸을 바꾸면 새 몸으로).</summary>
        public static TalkFace Hero { get; private set; }

        private static readonly string[] MouthNames = { "MTH_A", "MTH_I", "MTH_U", "MTH_E", "MTH_O" };
        private readonly List<(SkinnedMeshRenderer r, int i)> _eye = new List<(SkinnedMeshRenderer, int)>();
        private readonly Dictionary<Mood, List<(SkinnedMeshRenderer r, int i)>> _mood = new Dictionary<Mood, List<(SkinnedMeshRenderer, int)>>();
        private readonly List<(SkinnedMeshRenderer r, int i)>[] _mouth = new List<(SkinnedMeshRenderer, int)>[5];
        private uint _rng;
        private float _nextBlink, _blinkLeft, _moodLeft, _moodSec, _mouthT;
        private int _mouthI = -1;
        private Mood _moodNow;

        public bool BlinkOnly { get; private set; }
        /// <summary>대화 입 모양 — 대사창이 열린 동안 판이 켠다.</summary>
        public bool Talking { get; set; }
        /// <summary>진단 — 눈 감김·지금 감정·그 무게·입 모양 번호.</summary>
        public float EyeWeight { get; private set; }
        public Mood MoodNow => _moodNow;
        public float MoodWeight { get; private set; }
        public int MouthNow => _mouthI;
        public int MorphCount { get; private set; }

        /// <summary>몸에 얼굴을 붙인다 — 모프가 없거나 손잡이가 꺼졌으면 null(붙이지 않음).</summary>
        public static TalkFace Attach(GameObject body, bool blinkOnly = false)
        {
            if (!On || body == null) return null;
            var f = body.GetComponent<TalkFace>();
            if (f == null)
            {
                f = body.AddComponent<TalkFace>();
                if (!f.Scan()) { DestroyImmediate(f); return null; }
            }
            f.BlinkOnly = blinkOnly;
            return f;
        }

        /// <summary>주인공 몸 — 맞음·레벨업 신호가 이 얼굴로 간다.</summary>
        public static TalkFace AttachHero(GameObject body)
        {
            var f = Attach(body);
            if (f != null) Hero = f;
            return f;
        }

        /// <summary>판의 레벨업 신호에서 부른다(1만리·4종횡).</summary>
        public static void HeroJoy() { if (Hero != null && Hero.isActiveAndEnabled) Hero.Flash(Mood.Joy, JoySec); }

        /// <summary>HurtVignette 의 붉은 번쩍(맞음)에서.</summary>
        public static void HeroHurt() { if (Hero != null && Hero.isActiveAndEnabled) Hero.Flash(Mood.Surprised, SurpriseSec); }

        private bool Scan()
        {
            foreach (Mood m in Enum.GetValues(typeof(Mood))) if (m != Mood.None) _mood[m] = new List<(SkinnedMeshRenderer, int)>();
            for (int k = 0; k < 5; k++) _mouth[k] = new List<(SkinnedMeshRenderer, int)>();
            int n = 0;
            foreach (var smr in GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                var mesh = smr.sharedMesh;
                if (mesh == null || mesh.blendShapeCount == 0) continue;
                for (int i = 0; i < mesh.blendShapeCount; i++)
                {
                    string s = mesh.GetBlendShapeName(i);
                    if (s.EndsWith("EYE_Close")) { _eye.Add((smr, i)); n++; continue; }
                    bool hit = false;
                    foreach (var kv in _mood) if (s.EndsWith("ALL_" + kv.Key)) { kv.Value.Add((smr, i)); n++; hit = true; break; }
                    if (hit) continue;
                    for (int k = 0; k < 5; k++) if (s.EndsWith(MouthNames[k])) { _mouth[k].Add((smr, i)); n++; break; }
                }
            }
            MorphCount = n;
            if (_eye.Count == 0) return false;
            _rng = Hash(gameObject.name) ^ 0x9E3779B9u ^ (uint)(transform.parent != null ? transform.parent.GetSiblingIndex() * 7919 : 0);
            if (_rng == 0) _rng = 1;
            _nextBlink = NextGap();
            return true;
        }

        private static uint Hash(string s)
        {
            uint h = 2166136261u;
            foreach (char c in s ?? "") { h ^= c; h *= 16777619u; }
            return h;
        }

        private float Rand01()
        {
            _rng ^= _rng << 13; _rng ^= _rng >> 17; _rng ^= _rng << 5;
            return (_rng & 0xFFFFFF) / (float)0x1000000;
        }

        private float NextGap() => BlinkMin + (BlinkMax - BlinkMin) * Rand01();

        /// <summary>그 감정 무게 1 → sec 동안 잦아듦(다른 감정이 있으면 바꿈).</summary>
        public void Flash(Mood mood, float sec)
        {
            if (BlinkOnly || mood == Mood.None || sec <= 0f) return;
            if (_moodNow != Mood.None && _moodNow != mood) Set(_mood[_moodNow], 0f);
            _moodNow = mood;
            _moodSec = _moodLeft = sec;
            Tick(0f);
        }

        private void Update()
        {
            if (!On) return;
            if (Hero != this) // 주인공 말고는 카메라 20m 밖이면 멈춤(폰 비용)
            {
                var cam = Camera.main;
                if (cam != null && (cam.transform.position - transform.position).sqrMagnitude > FarCull * FarCull) return;
            }
            Tick(Time.deltaTime);
        }

        /// <summary>한 걸음(진단이 시간을 건너뛰려고 직접 부른다).</summary>
        public void Tick(float dt)
        {
            // 감정
            if (_moodNow != Mood.None)
            {
                _moodLeft -= dt;
                // 앞 70% 는 꽉, 뒤 30% 에 잦아듦
                float t = _moodSec > 0f ? Mathf.Clamp01(_moodLeft / (_moodSec * 0.3f)) : 0f;
                MoodWeight = _moodLeft > 0f ? t : 0f;
                Set(_mood[_moodNow], MoodWeight * 100f);
                if (_moodLeft <= 0f) { _moodNow = Mood.None; MoodWeight = 0f; }
            }
            // 깜박임(감정 중엔 쉼 — 놀람·웃음 눈이 그 모양을 지킨다)
            if (_blinkLeft > 0f)
            {
                _blinkLeft -= dt;
                float half = BlinkClose * 0.5f;
                EyeWeight = _blinkLeft > half ? 1f - (_blinkLeft - half) / half : Mathf.Max(0f, _blinkLeft / half);
                if (_blinkLeft <= 0f) { EyeWeight = 0f; _nextBlink = NextGap(); }
            }
            else if (_moodNow == Mood.None)
            {
                _nextBlink -= dt;
                if (_nextBlink <= 0f) _blinkLeft = BlinkClose;
                EyeWeight = 0f;
            }
            else EyeWeight = 0f;
            Set(_eye, EyeWeight * 100f);
            // 입
            if (!BlinkOnly)
            {
                if (Talking)
                {
                    _mouthT -= dt;
                    if (_mouthT <= 0f || _mouthI < 0)
                    {
                        if (_mouthI >= 0) Set(_mouth[_mouthI], 0f);
                        _mouthI = (int)(Rand01() * 5f) % 5;
                        Set(_mouth[_mouthI], 60f + 40f * Rand01());
                        _mouthT = MouthStep;
                    }
                }
                else if (_mouthI >= 0) { Set(_mouth[_mouthI], 0f); _mouthI = -1; }
            }
        }

        /// <summary>그 모프의 꽉 찬 무게 — 임포트(glTF)에 따라 마지막 프레임 무게가 100 이 아니라 1 일 수 있다(100 을 넣으면 100배로 뒤틀림).</summary>
        public static float FullWeight(SkinnedMeshRenderer r, int i)
        {
            var m = r.sharedMesh;
            int n = m != null ? m.GetBlendShapeFrameCount(i) : 0;
            float fw = n > 0 ? m.GetBlendShapeFrameWeight(i, n - 1) : 100f;
            return fw > 0f ? fw : 100f;
        }

        /// <summary>w = 0~100(%) — 모프의 꽉 찬 무게에 맞춰 넣는다.</summary>
        private static void Set(List<(SkinnedMeshRenderer r, int i)> list, float w)
        {
            foreach (var (r, i) in list) if (r != null) r.SetBlendShapeWeight(i, w * 0.01f * FullWeight(r, i));
        }

        private static float Pct(SkinnedMeshRenderer r, int i) => r.GetBlendShapeWeight(i) * 100f / FullWeight(r, i);

        /// <summary>진단 — 그 감정 모프 무게(첫 메시).</summary>
        public float WeightOf(Mood m) => m != Mood.None && _mood.TryGetValue(m, out var l) && l.Count > 0 && l[0].r != null ? Pct(l[0].r, l[0].i) : 0f;
        public float EyeMorphWeight => _eye.Count > 0 && _eye[0].r != null ? Pct(_eye[0].r, _eye[0].i) : 0f;
        /// <summary>진단 — 눈 모프의 꽉 찬 무게(1 이면 glTF 식).</summary>
        public float EyeFullWeight => _eye.Count > 0 && _eye[0].r != null ? FullWeight(_eye[0].r, _eye[0].i) : 0f;

        private void OnDestroy() { if (Hero == this) Hero = null; }
    }
}
