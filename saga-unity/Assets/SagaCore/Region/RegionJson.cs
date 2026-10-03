using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Saga.Core.Region
{
    /// <summary>지역 배치표(layout.json)를 읽는 최소 JSON 파서(tasks U-0023). JsonUtility 는 숫자 배열 속의 null(지형 구멍)·
    /// 길이가 다른 배열 행(나무·꽃)·열린 키를 못 읽어서 직접 만든다. 값은 Dictionary&lt;string,object&gt;·List&lt;object&gt;·double·string·bool·null.</summary>
    public static class RegionJson
    {
        public static object Parse(string text)
        {
            var p = new Reader(text);
            object v = p.Value();
            p.SkipWhite();
            if (!p.AtEnd) throw new FormatException("JSON 끝에 남는 글자가 있다(" + p.Pos + "번째)");
            return v;
        }

        private sealed class Reader
        {
            private readonly string _s;
            private int _i;
            public Reader(string s) { _s = s; }
            public int Pos => _i;
            public bool AtEnd => _i >= _s.Length;

            public void SkipWhite()
            {
                while (_i < _s.Length && char.IsWhiteSpace(_s[_i])) _i++;
            }

            public object Value()
            {
                SkipWhite();
                if (_i >= _s.Length) throw new FormatException("JSON 이 갑자기 끝났다");
                char c = _s[_i];
                switch (c)
                {
                    case '{': return Obj();
                    case '[': return Arr();
                    case '"': return Str();
                    case 't': Expect("true"); return true;
                    case 'f': Expect("false"); return false;
                    case 'n': Expect("null"); return null;
                    default: return Num();
                }
            }

            private void Expect(string word)
            {
                if (string.CompareOrdinal(_s, _i, word, 0, word.Length) != 0) throw new FormatException(_i + "번째에 '" + word + "' 가 와야 한다");
                _i += word.Length;
            }

            private Dictionary<string, object> Obj()
            {
                var d = new Dictionary<string, object>();
                _i++; // {
                SkipWhite();
                if (_s[_i] == '}') { _i++; return d; }
                while (true)
                {
                    SkipWhite();
                    string k = Str();
                    SkipWhite();
                    if (_s[_i] != ':') throw new FormatException(_i + "번째에 ':' 가 와야 한다");
                    _i++;
                    d[k] = Value();
                    SkipWhite();
                    if (_s[_i] == ',') { _i++; continue; }
                    if (_s[_i] == '}') { _i++; return d; }
                    throw new FormatException(_i + "번째에 ',' 나 '}' 가 와야 한다");
                }
            }

            private List<object> Arr()
            {
                var l = new List<object>();
                _i++; // [
                SkipWhite();
                if (_s[_i] == ']') { _i++; return l; }
                while (true)
                {
                    l.Add(Value());
                    SkipWhite();
                    if (_s[_i] == ',') { _i++; continue; }
                    if (_s[_i] == ']') { _i++; return l; }
                    throw new FormatException(_i + "번째에 ',' 나 ']' 가 와야 한다");
                }
            }

            private string Str()
            {
                if (_s[_i] != '"') throw new FormatException(_i + "번째에 '\"' 가 와야 한다");
                _i++;
                var sb = new StringBuilder();
                while (true)
                {
                    char c = _s[_i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    char e = _s[_i++];
                    switch (e)
                    {
                        case 'n': sb.Append('\n'); break;
                        case 't': sb.Append('\t'); break;
                        case 'r': sb.Append('\r'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'u':
                            sb.Append((char)Convert.ToInt32(_s.Substring(_i, 4), 16));
                            _i += 4;
                            break;
                        default: sb.Append(e); break; // " \ /
                    }
                }
            }

            private double Num()
            {
                int start = _i;
                while (_i < _s.Length && "+-0123456789.eE".IndexOf(_s[_i]) >= 0) _i++;
                if (start == _i) throw new FormatException(_i + "번째에 값이 와야 한다");
                return double.Parse(_s.Substring(start, _i - start), NumberStyles.Float, CultureInfo.InvariantCulture);
            }
        }
    }
}
