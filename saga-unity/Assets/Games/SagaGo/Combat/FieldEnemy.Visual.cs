using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>`FieldEnemy` 의 일부(partial) — tasks U-0010 분할.</summary>
    public partial class FieldEnemy
    {
        private void BuildVisual()
        {
            if (model != null)
            {
                var inst = Instantiate(model, transform);
                inst.name = "Visual";
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                var an0 = inst.GetComponentInChildren<Animator>();
                _animalBody = IsBeastKind(kind) && EraBody == null && an0 != null && (an0.avatar == null || !an0.avatar.isHuman);
                float h = MeasureHeight(inst);
                if (_animalBody)
                {
                    float len = MeasureLength(inst);
                    if (len > 0.01f) { float k = AnimalSize(kind) / len; inst.transform.localScale = Vector3.one * k; _animalTop = h * k; }
                    else _animalBody = false;
                }
                else if (h > 0.01f) inst.transform.localScale = Vector3.one * (BodyHeight * HeightFactor() / h);
                _animator = inst.GetComponentInChildren<Animator>();
                if (_animator != null) _animator.applyRootMotion = false;
                if (IsBeastKind(kind) && EraBody == null && _animator != null && _animator.isHuman && _beastController != null)
                    _animator.runtimeAnimatorController = _beastController; // 사람형 몸에 Idle·걷기·달리기·Attack·Hit·Death 를 리타깃
                if (IsHero)
                {
                    if (_dresser != null) _dresser.Dress(inst, HeroId, BodyHeight * HeightFactor()); // 109-7 선 인물·동행과 같은 겉모습
                    foreach (var col in inst.GetComponentsInChildren<Collider>()) Destroy(col); // 동행 몸 프리팹 — 제 충돌은 뺀다(PartyBodies 와 같은 결)
                    if (_animator != null && _animator.isHuman && _controllerOverride != null) _animator.runtimeAnimatorController = _controllerOverride;
                }
                _visual = inst.transform;
                if (BaseTint(out Color tint)) CharacterVisual.Tint(inst, tint);
            }
            else
            {
                _visual = CharacterVisual.SpawnFallbackCapsule(transform,
                    kind == Kind.Bandit ? new Color(0.5f, 0.2f, 0.15f) : BaseTint(out Color t) ? t : new Color(0.85f, 0.85f, 0.8f));
            }
        }

        private float HeightFactor()
        {
            switch (kind)
            {
                case Kind.Skeleton: return 1.05f;
                case Kind.EmberImp: return 0.85f;
                case Kind.DrownedGhost: return 1.15f;
                case Kind.WindHawk: return 0.7f;
                case Kind.IceFox: return 0.8f;
                case Kind.RockBear: return 1.45f;
                case Kind.GrassSnake: return 1.1f;
                case Kind.Guardian: return FrostKing ? FrostKingHeight : 1.6f;
                default: return 1f;
            }
        }

        /// <summary>몸에 늘 입히는 빛깔 — 해골은 바랜 흰빛, 원소 쓰는 적은 원소 빛(산적은 없음).</summary>
        private bool BaseTint(out Color c)
        {
            if (kind == Kind.Skeleton && EraBody == null) { c = new Color(0.88f, 0.9f, 0.96f); return true; } // 바랜 뼈빛은 옛 해골 몸에만
            if (IsHero) { c = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.15f); return true; } // 109-6 — 제 몸은 그대로, 원소만 옅게
            // 수호장 — 전용 몸(Maw, 2026-09-24)의 제 빛깔 위에 지금 겹의 원소가 은은히 밴다(옛 Brute 몸 때의 돌빛은 뺐다).
            if (IsGuardian) { c = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.3f); return true; }
            if (IsBeastKind(kind) && EraBody == null) { c = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.45f); return true; } // 제 몸의 살갗 위에 원소 빛만 옅게
            if (IsElemental) { c = Color.Lerp(new Color(0.35f, 0.33f, 0.32f), GoElements.ColorOf(Element), 0.75f); return true; }
            c = Color.white;
            return false;
        }

        /// <summary>107 ⑤ — 방패 거품(반투명)·몸 둘레를 도는 원소 구슬 셋·원소 빛. 몸(`_visual`) 밖에 붙여 빛깔 입히기와 섞이지 않게.</summary>
        private void BuildElementFx()
        {
            Color c = GoElements.ColorOf(Element);
            float h = BodyTop;
            _shieldBubble = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            _shieldBubble.name = "ShieldBubble";
            Destroy(_shieldBubble.GetComponent<Collider>());
            _shieldBubble.transform.SetParent(transform, false);
            _shieldBubble.transform.localPosition = new Vector3(0f, h * 0.5f, 0f);
            _shieldBubble.transform.localScale = new Vector3(2.8f, h * 1.15f, 2.8f);
            var bubbleMat = new Material(Shader.Find("Sprites/Default")) { name = "ShieldBubble (generated)" };
            bubbleMat.color = new Color(c.r, c.g, c.b, 0.22f);
            _bubbleMat = bubbleMat;
            if (IsGuardian) _shieldBubble.transform.localScale = new Vector3(4.2f, h * 1.15f, 4.2f);
            var br = _shieldBubble.GetComponent<MeshRenderer>();
            br.sharedMaterial = bubbleMat;
            br.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            br.receiveShadows = false;

            _orbit = new GameObject("ElementOrbit").transform;
            _orbit.SetParent(transform, false);
            _orbit.localPosition = new Vector3(0f, h * 0.6f, 0f);
            var orbMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ElementOrb (generated)" };
            orbMat.color = c;
            orbMat.EnableKeyword("_EMISSION");
            orbMat.SetColor("_EmissionColor", c * 2.5f);
            _orbMat = orbMat;
            for (int i = 0; i < 3; i++)
            {
                var orb = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                orb.name = "Orb";
                Destroy(orb.GetComponent<Collider>());
                orb.transform.SetParent(_orbit, false);
                float a = i * Mathf.PI * 2f / 3f;
                float orbR = IsGuardian ? 2.6f : 1.6f;
                orb.transform.localPosition = new Vector3(Mathf.Cos(a) * orbR, (i - 1) * 0.35f, Mathf.Sin(a) * orbR);
                orb.transform.localScale = Vector3.one * 0.35f;
                orb.GetComponent<MeshRenderer>().sharedMaterial = orbMat;
            }
            var lightGo = new GameObject("ElementLight");
            lightGo.transform.SetParent(_orbit, false);
            _elementLight = lightGo.AddComponent<Light>();
            _elementLight.type = LightType.Point;
            _elementLight.color = c;
            _elementLight.range = 7f;
            _elementLight.intensity = 1.6f;
            RefreshElementFx();
        }

        private void RefreshElementFx()
        {
            if (!IsElemental || _orbit == null) return;
            _shieldBubble.SetActive(Alive && Shielded);
            _orbit.gameObject.SetActive(Alive);
            _elementLight.intensity = Shielded ? 1.6f : 0.7f;
        }

        private static float MeasureLength(GameObject go)
        {
            var renderers = go.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return 0f;
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            return Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
        }

        private static float MeasureHeight(GameObject go)
        {
            var renderers = go.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return 0f;
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            return b.size.y;
        }

        private void BuildHeadUi()
        {
            _block = new MaterialPropertyBlock();
            var head = new GameObject("HeadUI");
            head.transform.SetParent(transform, false);
            head.transform.localPosition = new Vector3(0f, (_animalBody ? _animalTop : BodyHeight * (IsGuardian ? HeightFactor() : 1f)) + 0.9f, 0f);
            _headUi = head.transform;

            _nameText = NewText(_headUi, DisplayName, new Vector3(0f, 0.45f, 0f), 0.035f, Color.white);
            _alertText = NewText(_headUi, "!", new Vector3(0f, 1.2f, 0f), 0.09f, new Color(1f, 0.35f, 0.2f));
            _alertText.gameObject.SetActive(false);

            NewQuad(_headUi, "HpBack", new Vector3(0f, 0f, 0.01f), new Vector3(2.0f, 0.22f, 1f), new Color(0f, 0f, 0f, 0.6f));
            var fillPivot = new GameObject("HpFillPivot").transform;
            fillPivot.SetParent(_headUi, false);
            fillPivot.localPosition = new Vector3(-0.97f, 0f, 0f);
            var fill = NewQuad(fillPivot, "HpFill", new Vector3(0.5f, 0f, 0f), Vector3.one, new Color(0.9f, 0.25f, 0.2f));
            fill.localScale = Vector3.one;
            fillPivot.localScale = new Vector3(1.94f, 0.16f, 1f);
            _hpFill = fillPivot;
            _auraDot = NewQuad(_headUi, "AuraDot", new Vector3(-1.3f, 0f, 0f), new Vector3(0.3f, 0.3f, 1f), Color.clear).GetComponent<Renderer>();
            _auraDot.enabled = false;
            if (IsElemental) _nameText.color = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.6f);
            if (ShieldMax > 0f)
            {
                // 방패 막대 — 체력 막대 바로 위, 원소 빛깔
                _shieldBar = new GameObject("ShieldBar");
                _shieldBar.transform.SetParent(_headUi, false);
                _shieldBar.transform.localPosition = new Vector3(0f, 0.2f, 0f);
                NewQuad(_shieldBar.transform, "ShieldBack", new Vector3(0f, 0f, 0.01f), new Vector3(2.0f, 0.14f, 1f), new Color(0f, 0f, 0f, 0.6f));
                var sp = new GameObject("ShieldFillPivot").transform;
                sp.SetParent(_shieldBar.transform, false);
                sp.localPosition = new Vector3(-0.97f, 0f, 0f);
                _shieldFillRenderer = NewQuad(sp, "ShieldFill", new Vector3(0.5f, 0f, 0f), Vector3.one, GoElements.ColorOf(Element)).GetComponent<Renderer>();
                sp.localScale = new Vector3(1.94f, 0.1f, 1f);
                _shieldFill = sp;
            }
        }

        private static TMPro.TextMeshPro NewText(Transform parent, string text, Vector3 local, float size, Color color)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            var t = Saga.Core.SagaWorldText.Add(go, text, 64f * size, color);
            return t;
        }

        private static Material _unlitMat;

        private static Transform NewQuad(Transform parent, string name, Vector3 local, Vector3 scale, Color color)
        {
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
            q.name = name;
            var col = q.GetComponent<Collider>();
            if (Application.isPlaying) Destroy(col); else DestroyImmediate(col);
            q.transform.SetParent(parent, false);
            q.transform.localPosition = local;
            q.transform.localScale = scale;
            if (_unlitMat == null) _unlitMat = new Material(Shader.Find("Sprites/Default")) { name = "FieldEnemyUi (generated)" };
            var r = q.GetComponent<MeshRenderer>();
            r.sharedMaterial = _unlitMat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            var block = new MaterialPropertyBlock();
            block.SetColor("_Color", color);
            r.SetPropertyBlock(block);
            return q.transform;
        }

        private void BuildWarnRing()
        {
            var go = new GameObject("WarnRing");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 0.15f, 0f);
            _warnRing = go.AddComponent<LineRenderer>();
            _warnRing.useWorldSpace = false;
            _warnRing.loop = true;
            _warnRing.positionCount = 40;
            _warnRing.widthMultiplier = 0.18f;
            _warnRing.material = _unlitMat != null ? _unlitMat : new Material(Shader.Find("Sprites/Default"));
            _warnRing.startColor = _warnRing.endColor = new Color(1f, 0.3f, 0.15f, 0.85f);
            _warnRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _warnRing.enabled = false;
        }

        private void SetRingRadius(float r)
        {
            for (int i = 0; i < _warnRing.positionCount; i++)
            {
                float a = i * Mathf.PI * 2f / _warnRing.positionCount;
                _warnRing.SetPosition(i, new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r));
            }
        }
    }
}
