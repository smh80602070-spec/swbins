using UnityEngine;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.Story.Player
{
    /// <summary>
    /// PLAN.md 109-11-1 플레이어 체력의 몸 쪽 — `StoryPlayerHp` 를 굴리고(무적·회복), 맞으면 반응(피격 클립·붉은 숫자·흔들림),
    /// 쓰러지면 처리한다: 비경 전투 방이면 패퇴(`StoryLabyrinthRunner.OnPlayerFell`, 재기가 있으면 그 방을 다시),
    /// 들판이면 입구(2m)에서 다시 일어서고 들판 두목은 태세를 되돌린다(체력 가득·단계 처음). 체력·기력은 가득 채운다.
    /// 웹 die() 의 "주운 금 절반"은 이 판에 금이 없어 뺐다. `StoryPlayerController.Awake` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    [DisallowMultipleComponent]
    public class StoryPlayerVitals : MonoBehaviour
    {
        public static readonly Vector3 FieldRespawn = new Vector3(2f, 0.1f, 0f); // BuildTestStoryScene 플레이어 시작 자리
        private static readonly Color HurtColor = new Color(1f, 0.3f, 0.25f);

        private StoryPlayerController _pc;

        private void Awake()
        {
            _pc = GetComponent<StoryPlayerController>();
            StoryPlayerHp.Refill();
        }

        private void OnEnable()
        {
            StoryPlayerHp.Hurted += OnHurt;
            StoryPlayerHp.Fell += OnFell;
        }

        private void OnDisable()
        {
            StoryPlayerHp.Hurted -= OnHurt;
            StoryPlayerHp.Fell -= OnFell;
        }

        private void Update()
        {
            if (StoryCutscenes.Playing) return;
            StoryPlayerHp.Tick(Time.deltaTime);
        }

        private void OnHurt(float amount)
        {
            var animator = _pc != null ? _pc.Animator : null;
            if (animator != null && animator.runtimeAnimatorController != null) animator.SetTrigger("Hit");
            DamagePopup.Spawn(transform.position + Vector3.up * 2f, amount, HurtColor);
            StoryCameraFollow.Instance?.Shake(0.1f, 0.18f);
        }

        private void OnFell()
        {
            var runner = StoryLabyrinthRunner.Instance;
            if (StoryLabyrinthState.InRun && runner != null && runner.NodeActive)
            {
                runner.OnPlayerFell();
            }
            else
            {
                Teleport(FieldRespawn);
                foreach (var e in StoryEnemy.All)
                    if (e != null && e.IsBoss && !e.IsLabyrinthEnemy) e.RegroupAfterPlayerFell();
                DialogueLabel.Instance?.Show(StoryLocalization.T("hp.fell_field", "💀 쓰러졌다 — 들판 입구에서 다시 일어선다"), 3.5f);
            }
            StoryPlayerHp.Refill();
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
        }

        private void Teleport(Vector3 pos)
        {
            var cc = GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            transform.position = pos;
            if (cc != null) cc.enabled = true;
        }
    }
}
