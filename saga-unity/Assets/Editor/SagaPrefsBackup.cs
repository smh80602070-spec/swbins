using System.Collections.Generic;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 다섯 판 설정 PlayerPrefs(언어·음량 셋·진동·UI 크기·그래픽 품질 + 국지 계승)를 진단 앞에서 떠 두고 끝에 되돌린다.
    /// 진단이 진짜 단추로 설정을 돌리면(타이틀 설정·패널 속 단추 누르기) 사용자의 에디터 설정이 바뀌기 때문.
    /// 키는 판의 `*SettingsState`·`*Localization`·`*Audio` 상수와 같다 — 새 설정 키를 만들면 여기에도.
    /// </summary>
    public static class SagaPrefsBackup
    {
        private static readonly string[] Games = { "go", "dungeon", "forest", "story", "realm" };
        private static readonly Dictionary<string, object> Saved = new Dictionary<string, object>();

        private static IEnumerable<(string key, char kind)> Keys()
        {
            foreach (var g in Games)
            {
                yield return ($"saga_{g}_language", 's');
                yield return ($"saga_{g}_vol_master", 'f');
                yield return ($"saga_{g}_vol_sfx", 'f');
                yield return ($"saga_{g}_vol_bgm", 'f');
                yield return ($"saga_{g}_ui_scale", 'f');
                yield return ($"saga_{g}_vibration_on", 'i');
                yield return ($"saga_{g}_graphics_quality_high", 'i');
            }
            yield return ("saga_realm_succession_on", 'i');
            yield return ("saga_dungeon_loot_filter", 's'); // U-0126
            yield return ("saga_dungeon_loot_hinted", 'i');
        }

        public static int Count => Saved.Count;

        public static void Backup()
        {
            Saved.Clear();
            foreach (var (key, kind) in Keys())
                Saved[key] = !PlayerPrefs.HasKey(key) ? null
                    : kind == 's' ? PlayerPrefs.GetString(key) : kind == 'f' ? (object)PlayerPrefs.GetFloat(key) : PlayerPrefs.GetInt(key);
        }

        public static void Restore()
        {
            foreach (var kv in Saved)
            {
                if (kv.Value == null) PlayerPrefs.DeleteKey(kv.Key);
                else if (kv.Value is string sv) PlayerPrefs.SetString(kv.Key, sv);
                else if (kv.Value is float fv) PlayerPrefs.SetFloat(kv.Key, fv);
                else PlayerPrefs.SetInt(kv.Key, (int)kv.Value);
            }
            PlayerPrefs.Save();
            Saga.Core.SagaUi.Lang = "ko";
        }
    }
}
