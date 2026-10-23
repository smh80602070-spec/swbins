using System;
using TMPro;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// tasks U-0181 옛 비문(고돗 G-0319 `story_hidden_clue.gd` 짝) — 들판 맨 끝(두목 뒤, x <see cref="ClueX"/>)에 돌판 하나 + 보라 글줄.
    /// 주인공이 <see cref="ReadX"/> 안에 땅 높이로 서면 읽힌다(<see cref="StoryHidden.ReadClue"/>, 처음만 알림). 읽은 뒤엔 글줄 빛이 옅어진다.
    /// 두목이 빨리 쓰러지면 `StoryEnemy` 가 <see cref="Queue"/> 로 숨은 우두머리 세우기를 맡기고, 이 실행기가 <see cref="StoryHidden.DelaySec"/>초를 센다.
    /// 씬 재빌드 없이 `GameBootstrap.Start` 가 <see cref="Install"/> 로 세운다.
    /// </summary>
    public class StoryHiddenClue : MonoBehaviour
    {
        public const float ClueZ = 0.9f, ReadX = 1.4f, ReadY = 1.2f, TickSec = 0.2f;
        public static float ClueX => FieldMapData.WidthM - 0.6f;

        public static StoryHiddenClue Instance { get; private set; }

        private static Func<StoryEnemy> _pending;
        private static float _pendingLeft;

        private Transform _player;
        private Renderer _glyph;
        private TextMeshPro _label;
        private float _tick;

        /// <summary>진단 — 기다리는 숨은 우두머리가 있나.</summary>
        public static bool Pending => _pending != null;
        /// <summary>마지막으로 세운 숨은 우두머리(진단).</summary>
        public static StoryEnemy LastHidden { get; private set; }

        public static StoryHiddenClue Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryHiddenClue").AddComponent<StoryHiddenClue>();
        }

        /// <summary>두목이 맡긴다 — 2초 뒤 세운다(겹치면 새 것으로).</summary>
        public static void Queue(Func<StoryEnemy> spawn)
        {
            _pending = spawn;
            _pendingLeft = StoryHidden.DelaySec;
        }

        private void Awake()
        {
            Instance = this;
            transform.position = new Vector3(ClueX, 0f, ClueZ);
            var slab = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Colliders.Strip(slab);
            slab.name = "Slab";
            slab.transform.SetParent(transform, false);
            slab.transform.localScale = new Vector3(0.8f, 1.4f, 0.2f);
            slab.transform.localPosition = new Vector3(0f, 0.7f, 0f);
            slab.GetComponent<Renderer>().material.color = new Color(0.42f, 0.4f, 0.38f);
            var glyph = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Colliders.Strip(glyph);
            glyph.name = "Glyph";
            glyph.transform.SetParent(transform, false);
            glyph.transform.localScale = new Vector3(0.5f, 0.08f, 0.22f);
            glyph.transform.localPosition = new Vector3(0f, 1.05f, -0.01f);
            _glyph = glyph.GetComponent<Renderer>();
            _glyph.sharedMaterial = new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "HiddenGlyph (generated)" };
            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(transform, false);
            labelGo.transform.localPosition = new Vector3(0f, 1.8f, 0f);
            _label = labelGo.AddComponent<TextMeshPro>();
            _label.fontSize = 3f;
            _label.alignment = TextAlignmentOptions.Center;
            _label.rectTransform.sizeDelta = new Vector2(4f, 1f);
            _label.color = new Color(0.8f, 0.65f, 1f);
            StoryHidden.Changed += Refresh;
            Refresh();
        }

        private void Start()
        {
            var pl = GameObject.FindWithTag("Player");
            _player = pl != null ? pl.transform : null;
        }

        private void OnDestroy()
        {
            StoryHidden.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Refresh()
        {
            if (_glyph == null) return;
            _glyph.sharedMaterial.color = StoryHidden.Read ? new Color(0.45f, 0.35f, 0.55f) : new Color(0.75f, 0.35f, 1f);
            _label.text = StoryLocalization.T("hidden.stele", "📜 옛 비문");
        }

        private void Update()
        {
            StepPending(Time.deltaTime);
            if (_player == null) return;
            _tick += Time.deltaTime;
            if (_tick < TickSec) return;
            _tick = 0f;
            Sense(_player.position);
        }

        /// <summary>한 번 살핌(진단도 부른다) — 이번에 처음 읽었으면 true.</summary>
        public bool Sense(Vector3 p)
        {
            if (Mathf.Abs(p.x - ClueX) > ReadX || p.y > ReadY) return false;
            if (!StoryHidden.ReadClue()) return false;
            DialogueLabel.Instance?.Show(StoryHidden.ClueLine(), 5f);
            return true;
        }

        /// <summary>기다림 세기(진단도 부른다) — 세웠으면 그 적.</summary>
        public static StoryEnemy StepPending(float dt)
        {
            if (_pending == null) return null;
            _pendingLeft -= dt;
            if (_pendingLeft > 0f) return null;
            var spawn = _pending;
            _pending = null;
            LastHidden = spawn();
            DialogueLabel.Instance?.Show(StoryHidden.RiseLine(), 3f);
            return LastHidden;
        }

        public static void ClearForTest()
        {
            _pending = null;
            _pendingLeft = 0f;
            LastHidden = null;
        }
    }
}
