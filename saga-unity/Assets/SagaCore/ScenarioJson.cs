using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>`JsonUtility` 로 못 담는 것(사전 등)을 읽은 뒤 채우는 훅 — <see cref="ScenarioJson.Load{T}"/> 가 Normalize 뒤에 부른다.</summary>
    public interface IScenarioFile { void Finish(); }

    /// <summary>
    /// 시나리오 표를 코드 밖 JSON(`Resources/scenario_&lt;판&gt;.json`)으로 읽는 공통 로더(tasks U-0009).
    /// `JsonUtility` 는 null 참조를 빈 객체로, null 문자열·배열을 ""·빈 배열로 쓴다 — 그래서 읽은 뒤 <see cref="Normalize"/> 가
    /// "전부 기본값인 중첩 객체"(예: 선택이 없는 `Scene.Choice`)와 빈 문자열 `""`(예: 첫 장의 `Chapter.After`)을 null 로 되돌린다.
    /// 옛 표가 `""` 를 일부러 쓴 필드(`By`·`AwardKo`·`Key`·`Scene`)도 null 이 되지만 소비 코드가 `IsNullOrEmpty` 로 보거나 값이 있을 때만 쓴다.
    /// 배열은 손대지 않는다. <see cref="DeepEqual"/> 은 null ≡ ""·빈 배열로 의미 비교한다.
    /// </summary>
    public static class ScenarioJson
    {
        /// <summary>Resources 의 JSON → T. 없거나 깨졌으면 LogError 하고 빈 T.</summary>
        public static T Load<T>(string resource) where T : class, new()
        {
            var ta = Resources.Load<TextAsset>(resource);
            if (ta == null) { Debug.LogError($"[ScenarioJson] {resource}.json 이 Resources 에 없음"); return new T(); }
            try
            {
                var t = JsonUtility.FromJson<T>(ta.text) ?? new T();
                Normalize(t);
                (t as IScenarioFile)?.Finish();
                return t;
            }
            catch (Exception e)
            {
                Debug.LogError($"[ScenarioJson] {resource}.json 읽기 실패: {e.Message}");
                return new T();
            }
        }

        private static bool Plain(Type t) => t.IsPrimitive || t == typeof(string) || t.IsEnum || t.IsValueType;

        // struct(Line·Fx·Kv) 의 문자열 필드 ""→null — 박싱한 복사본을 고쳐 돌려준다.
        private static object NullEmptyStrings(object boxed)
        {
            foreach (var f in boxed.GetType().GetFields(BindingFlags.Public | BindingFlags.Instance))
                if (f.FieldType == typeof(string) && (string)f.GetValue(boxed) == "") f.SetValue(boxed, null);
            return boxed;
        }

        /// <summary>전부 기본값인 중첩 객체 필드를 null 로(재귀). 값 형식(struct)은 숫자·문자열만 든다고 보고 건드리지 않는다.</summary>
        public static void Normalize(object o)
        {
            if (o == null) return;
            if (o is Array arr)
            {
                for (int i = 0; i < arr.Length; i++)
                {
                    var e = arr.GetValue(i);
                    if (e == null) continue;
                    var et = e.GetType();
                    if (et == typeof(string) || et.IsPrimitive || et.IsEnum) continue;
                    if (et.IsValueType) arr.SetValue(NullEmptyStrings(e), i);
                    else Normalize(e);
                }
                return;
            }
            foreach (var f in o.GetType().GetFields(BindingFlags.Public | BindingFlags.Instance))
            {
                var ft = f.FieldType;
                if (ft == typeof(string)) { if ((string)f.GetValue(o) == "") f.SetValue(o, null); continue; }
                if (ft.IsValueType) { if (!ft.IsPrimitive && !ft.IsEnum) f.SetValue(o, NullEmptyStrings(f.GetValue(o))); continue; }
                var v = f.GetValue(o);
                if (v == null) continue;
                Normalize(v);
                if (!f.FieldType.IsArray && IsDefault(v)) f.SetValue(o, null);
            }
        }

        private static bool IsDefault(object v)
        {
            if (v == null) return true;
            var t = v.GetType();
            if (t == typeof(string)) return ((string)v).Length == 0;
            if (v is System.Collections.ICollection col) return col.Count == 0;
            if (v is System.Collections.IDictionary dic) return dic.Count == 0;
            if (t.IsPrimitive || t.IsEnum) return v.Equals(Activator.CreateInstance(t));
            foreach (var f in t.GetFields(BindingFlags.Public | BindingFlags.Instance))
                if (!IsDefault(f.GetValue(v))) return false;
            return true;
        }

        /// <summary>의미 비교 — null ≡ ""(문자열), null ≡ 빈 배열. 객체 참조는 한쪽만 null 이면 다름. 다른 곳은 diffs 에 경로를 적는다.</summary>
        public static bool DeepEqual(object a, object b, List<string> diffs, string path = "")
        {
            if (a is string || b is string)
            {
                if (((a as string) ?? "") == ((b as string) ?? "")) return true;
                diffs.Add($"{path}: '{a}' ≠ '{b}'"); return false;
            }
            if (a is Array || b is Array)
            {
                var x = a as Array; var y = b as Array;
                int nx = x?.Length ?? 0, ny = y?.Length ?? 0;
                if (nx != ny) { diffs.Add($"{path}: 길이 {nx} ≠ {ny}"); return false; }
                bool ok = true;
                for (int i = 0; i < nx; i++) ok &= DeepEqual(x.GetValue(i), y.GetValue(i), diffs, $"{path}[{i}]");
                return ok;
            }
            if (a is System.Collections.IDictionary || b is System.Collections.IDictionary)
            {
                var x = a as System.Collections.IDictionary; var y = b as System.Collections.IDictionary;
                int nx = x?.Count ?? 0, ny = y?.Count ?? 0;
                if (nx != ny) { diffs.Add($"{path}: 사전 크기 {nx} ≠ {ny}"); return false; }
                bool ok = true;
                if (x != null)
                    foreach (System.Collections.DictionaryEntry e in x)
                    {
                        if (!y.Contains(e.Key)) { diffs.Add($"{path}: 키 {e.Key} 없음"); ok = false; continue; }
                        ok &= DeepEqual(e.Value, y[e.Key], diffs, $"{path}[{e.Key}]");
                    }
                return ok;
            }
            if (a == null || b == null)
            {
                if (a == null && b == null) return true;
                diffs.Add($"{path}: {(a == null ? "null" : "객체")} ≠ {(b == null ? "null" : "객체")}"); return false;
            }
            var t = a.GetType();
            if (t != b.GetType()) { diffs.Add($"{path}: 형식 {t.Name} ≠ {b.GetType().Name}"); return false; }
            if (t.IsPrimitive || t.IsEnum)
            {
                if (a.Equals(b)) return true;
                diffs.Add($"{path}: {a} ≠ {b}"); return false;
            }
            bool all = true;
            foreach (var f in t.GetFields(BindingFlags.Public | BindingFlags.Instance))
                all &= DeepEqual(f.GetValue(a), f.GetValue(b), diffs, path + "." + f.Name);
            return all;
        }
    }
}
