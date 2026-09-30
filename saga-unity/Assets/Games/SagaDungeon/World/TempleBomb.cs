using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" 던전 도구 — 벽력탄. 놓으면 심지가 점점 빨리 깜빡이다
    /// 2초 뒤 반경 3m 로 터진다: 금 간 벽 파괴(`TempleCrackedWall.TryBreak`), 적 피해
    /// (평타×3, `DungeonEnemy.BombHit` — 능묘지기는 갑주가 벗겨진다), 가까이 있던
    /// 플레이어도 휘말린다(피해 4, 회피 무적이면 흘린다). 새 셰이더 없이 Lit 구슬 + 번지는
    /// 반투명 구(`Sprites/Default`)로 그린다.
    /// </summary>
    public class TempleBomb : MonoBehaviour
    {
        public const float FuseSec = 2f;
        public const float Radius = 3f;
        public const float SelfDamage = 4f;
        public const float SelfRadius = 2.2f;
        public const float EnemyDamageMul = 3f;
        private const float BlastSec = 0.35f;

        /// <summary>터진 자리 — `PlayerBombs` 가 카메라를 흔든다.</summary>
        public static event Action<Vector3> Exploded;

        /// <summary>진단용 누계(`HitSpark.SpawnCount` 와 같은 결).</summary>
        public static int ExplodeCount { get; private set; }

        private float _fuseLeft = FuseSec;
        private bool _exploded;
        private Transform _body;
        private Transform _spark;

        public static TempleBomb Spawn(Vector3 position)
        {
            var go = new GameObject("TempleBomb");
            go.transform.position = position;
            var bomb = go.AddComponent<TempleBomb>();
            bomb.BuildVisual();
            return bomb;
        }

        private void BuildVisual()
        {
            _body = TempleVisuals.Primitive(PrimitiveType.Sphere, transform, "Body", Vector3.zero, Vector3.one * 0.45f,
                TempleVisuals.Solid(new Color(0.12f, 0.12f, 0.14f), 0.6f, 0.5f), collider: false);
            _spark = TempleVisuals.Primitive(PrimitiveType.Sphere, transform, "Spark", new Vector3(0f, 0.3f, 0f), Vector3.one * 0.12f,
                TempleVisuals.Glow(new Color(1f, 0.55f, 0.15f)), collider: false);
        }

        private void Update()
        {
            if (_exploded) return;
            _fuseLeft -= Time.deltaTime;
            float rate = Mathf.Lerp(3f, 14f, 1f - Mathf.Clamp01(_fuseLeft / FuseSec));
            if (_spark != null) _spark.localScale = Vector3.one * (0.09f + 0.06f * Mathf.Abs(Mathf.Sin(Time.time * rate)));
            if (_fuseLeft <= 0f) Explode();
        }

        public void Explode()
        {
            if (_exploded) return;
            _exploded = true;
            ExplodeCount++;
            Vector3 pos = transform.position;

            foreach (var wall in new List<TempleCrackedWall>(TempleCrackedWall.All))
            {
                if (wall != null) wall.TryBreak(pos, Radius);
            }

            float damage = HeroState.HitDamage * EnemyDamageMul;
            foreach (var enemy in new List<DungeonEnemy>(DungeonEnemy.Active))
            {
                if (enemy == null || !enemy.IsAlive) continue;
                if (TempleVisuals.FlatDistance(pos, enemy.transform.position) <= Radius) enemy.BombHit(damage);
            }

            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo != null && TempleVisuals.FlatDistance(pos, playerGo.transform.position) <= SelfRadius)
            {
                HeroState.TakeDamage(SelfDamage);
            }

            HitSpark.Spawn(pos + Vector3.up * 0.4f, true);
            GroundDecal.Spawn(pos, GroundDecal.Kind.HitMark);
            SfxPlayer.PlayHeavyHit();
            Exploded?.Invoke(pos);

            if (_body != null) _body.gameObject.SetActive(false);
            if (_spark != null) _spark.gameObject.SetActive(false);
            if (isActiveAndEnabled) StartCoroutine(Blast());
            else Destroy(gameObject);
        }

        private IEnumerator Blast()
        {
            var fx = TempleVisuals.Primitive(PrimitiveType.Sphere, transform, "Blast", Vector3.zero, Vector3.one * 0.5f,
                new Material(Shader.Find("Sprites/Default")) { name = "TempleBlast (generated)" }, collider: false);
            var rend = fx.GetComponent<MeshRenderer>();
            rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            float t = 0f;
            while (t < BlastSec)
            {
                t += Time.deltaTime;
                float k = Mathf.Clamp01(t / BlastSec);
                fx.localScale = Vector3.one * Mathf.Lerp(0.5f, Radius * 2f, Mathf.Sqrt(k));
                rend.material.color = new Color(1f, Mathf.Lerp(0.8f, 0.3f, k), 0.1f, 0.6f * (1f - k));
                yield return null;
            }
            Destroy(gameObject);
        }
    }
}
