using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0181 숨은 우두머리(고돗 G-0319 `story_hidden.gd` 짝, 웹 짝 없음) — 들판 맨 끝(두목 뒤) "옛 비문"을 읽은 뒤
    /// 들판 두목을 첫 타부터 <see cref="FastSec"/>초 안에 쓰러뜨리면 <see cref="DelaySec"/>초 뒤 같은 자리에 숨은 우두머리
    /// (체력 ×<see cref="HpMul"/>·두목 공격 ×<see cref="DmgMul"/>·짙은 보라)가 선다. 잡으면 경험치 두목 ×<see cref="ExpMul"/> · 처치 기록.
    /// 이 트랙은 사냥터가 들판 하나(`FieldMapData` — 고돗 넷)라 비문도 하나, 돈이 없어 고돗 금 +40×lv 대신 경험치.
    /// 관문 대장(주간 강화판)은 그대로 — 숨은 우두머리는 관문 대장이 아니고, 관문 대장을 빨리 잡아도 열린다.
    /// </summary>
    public static class StoryHidden
    {
        public const float FastSec = 60f, DelaySec = 2f, HpMul = 2.5f, DmgMul = 1.5f, ExpMul = 2.5f;

        /// <summary>끄면 비문을 읽어도 안 섬(고돗 `SAGA_HIDDEN=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        private class Store { public bool read; public int kills; }

        private static Store _s = new Store();

        public static bool Read => _s.read;
        public static int Kills => _s.kills;

        public static event Action Changed;

        /// <summary>비문 읽기 — 처음이면 true.</summary>
        public static bool ReadClue()
        {
            if (_s.read) return false;
            _s.read = true;
            Changed?.Invoke();
            return true;
        }

        /// <summary>두목이 쓰러진 순간 — 비문을 읽었고 첫 타부터 60초 안이면 부른다(첫 타 없음 = NaN 이면 안 부름).</summary>
        public static bool ShouldSummon(float firstHitAt, float now) =>
            On && _s.read && !float.IsNaN(firstHitAt) && now - firstHitAt <= FastSec;

        public static void OnKilled()
        {
            _s.kills++;
            Changed?.Invoke();
        }

        public static string ClueLine() => StoryLocalization.T("hidden.clue",
            "📜 옛 비문 — \"땅의 주인을 숨 한 번(60초)에 베면, 그 그림자가 일어선다\"");
        public static string RiseLine() => StoryLocalization.T("hidden.rise", "🟣 숨은 우두머리가 일어섰다!");
        public static string KillLine(float exp) => string.Format(StoryLocalization.T("hidden.kill", "🟣 숨은 우두머리 처치! 경험치 +{0:0} (처치 {1})"), exp, _s.kills);

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.kills = Math.Max(0, _s.kills);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
