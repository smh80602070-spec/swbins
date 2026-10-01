using System.Collections.Generic;
using UnityEngine;
using Saga.Core;

namespace Saga.Forest.Data
{
    /// <summary>
    /// 첫 10분 사명 — FOREST(tasks U-0023). 목표판 첫 줄(`ForestSessionTracker.GoalLineNow`)에 다섯 단계가 차례로 뜬다:
    /// 걷기(시작 자리에서 30m) → 마을 밖 존에 들어서기 → 도감 아이템 하나 모으기 → 택배 한 건 → 저장. 판정은 기존 상태를 읽는다(폴링).
    /// 세이브 `tutV`·`tutDone`(버전 그대로) — `tutV`==0(없는 세이브)은 옛 세이브라 전부 끝난 것으로 본다.
    /// </summary>
    public static class ForestTutorial
    {
        public const float WalkMeters = 30f;

        private static Transform _player;
        private static Vector3 _start;
        private static bool _started;

        public static readonly TutorialSteps Steps = new TutorialSteps(
            new TutorialSteps.Step { Id = "walk", Ko = "걸어서 시작한 곳에서 30m 떨어져 보세요", En = "Walk 30 m away from where you started", Done = Walked },
            new TutorialSteps.Step { Id = "zone", Ko = "마을 밖 들판에 들어가 보세요", En = "Step out of the village into the wild", Done = InWildZone },
            new TutorialSteps.Step { Id = "gather", Ko = "곤충·버섯·꽃·화석을 하나 모아 보세요", En = "Collect an insect, mushroom, flower or fossil", Done = AnyDiscovered },
            new TutorialSteps.Step { Id = "deliver", Ko = "택배를 한 건 배달해 보세요", En = "Deliver a parcel", Done = () => ForestDeliveryState.DeliveredCount >= 1 },
            new TutorialSteps.Step { Id = "save", Ko = "일시정지(Ⅱ)로 저장해 보세요", En = "Save the game with Pause (Ⅱ)", Done = () => SagaFlow.LastAutoSaveReason != null });

        public static bool Enabled { get => Steps.Enabled; set => Steps.Enabled = value; }

        /// <summary>목표판 첫 줄 — 끝났거나 꺼졌으면 null.</summary>
        public static string Line() => Steps.Line();

        public static List<string> Ids() => Steps.Ids();
        public static List<string> AllIds() => Steps.AllIds();
        public static void Restore(IEnumerable<string> ids) { Steps.Restore(ids); _started = false; }

        private static bool FindPlayer()
        {
            if (_player != null) return true;
            var go = GameObject.FindWithTag("Player");
            if (go == null) return false;
            _player = go.transform;
            return true;
        }

        private static bool Walked()
        {
            if (!FindPlayer()) return false;
            if (!_started) { _start = _player.position; _started = true; return false; }
            var d = _player.position - _start;
            d.y = 0f;
            return d.magnitude >= WalkMeters;
        }

        private static bool InWildZone() =>
            FindPlayer() && ForestBiomeData.ZoneAt(_player.position.x, _player.position.z) >= 0;

        private static bool AnyDiscovered()
        {
            foreach (ForestMuseumState.Category c in System.Enum.GetValues(typeof(ForestMuseumState.Category)))
                if (ForestMuseumState.DiscoveredCountOf(c) > 0) return true;
            return false;
        }
    }
}
