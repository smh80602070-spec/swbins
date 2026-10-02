"""VRoid 샘플(AvatarSample_A~Z)·직접 만든 VRM 을 들이기 폴더로 모은다 - 이름 정리 + VRM 안 라이선스 메타 표(K-0022).

    py tools/char-forge/vroid_samples.py <VRM 이 있는 폴더 또는 .vrm 파일> [...]    # 기본: 복사 안 하고 표만 (--copy 로 복사)
    py tools/char-forge/vroid_samples.py ~/Downloads --copy

하는 일
  - 각 .vrm 의 JSON 청크에서 VRM 0.x(`extensions.VRM.meta`) 또는 1.0(`VRMC_vrm.meta`)의 제목·제작자·이용 조건을 읽는다.
  - id 를 정한다: 파일 이름·모델 제목에 `AvatarSample_<글자>` 가 있으면 `avatarsample_<글자>`(1.0·0.x 변형이 같이 오면 `_vrm10` 접미사),
    아니면 파일 이름을 영문 소문자·숫자·`_` 로 줄인다(실명 금지 규칙은 표시 글자 한정 - id 는 사람이 정한 이름 그대로).
  - `--copy` 면 `tools/char-forge/_in/vroid/<id>.vrm` 로 복사(이미 있으면 건너뜀). **상업·개작+재배포 허용인 것만** 복사한다(`usable()` — 2026-10-02 판정 규칙). 원본은 안 건드린다.
  - 이용 조건 표를 `tools/char-forge/data/vroid_licenses.json` 에 쓴다(사람이 게임 반영 전 모델별 조건을 확인하는 근거).
의존 없음(표준 라이브러리). VRM 은 GLB 와 같은 컨테이너다.
"""
import json
import os
import re
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
IN_DIR = os.path.join(HERE, '_in', 'vroid')
LIC_OUT = os.path.join(HERE, 'data', 'vroid_licenses.json')
META_KEYS = ('title', 'name', 'author', 'authors', 'licenseName', 'commercialUsage', 'commercialUssageName', 'allowRedistribution',
             'modification', 'avatarPermission', 'violentUssageName', 'sexualUssageName', 'otherLicenseUrl', 'creditNotation',
             'redistribution', 'allowedUserName', 'contactInformation')


def read_meta(path):
    with open(path, 'rb') as f:
        head = f.read(20)
        if head[:4] != b'glTF':
            raise ValueError('glTF/VRM 이 아니다')
        n = struct.unpack('<I', head[12:16])[0]
        j = json.loads(f.read(n).decode('utf-8'))
    ext = j.get('extensions', {})
    if 'VRMC_vrm' in ext:
        ver, meta = '1.0', ext['VRMC_vrm'].get('meta', {})
    elif 'VRM' in ext:
        ver, meta = '0.x', ext['VRM'].get('meta', {})
    else:
        ver, meta = '?', {}
    return ver, {k: meta.get(k) for k in META_KEYS if meta.get(k) is not None}


def usable(ver, meta):
    """우리가 쓸 수 있는 조건인가 → (가능, 이유 목록, 크레딧 필요). 우리는 몸을 가공(툰 GLB·동작·옷 조각)해 게임과 공개 저장소에 싣는다 =
    개작본 재배포라서 "상업 허용 · 개작+재배포 허용 · 아무나 사용" 이어야 한다(개작만 허용이면 안 된다 — VRM 1.0 modification 이 allowModification 인 T 가 그 예).
    VRM 0.x 는 licenseName 과 Hub 조건 문자열(otherLicenseUrl 의 쿼리)로 읽는다."""
    why, credit = [], False
    if ver == '1.0':
        if meta.get('commercialUsage') not in ('personalProfit', 'corporation'):
            why.append('상업 사용 불가(%s)' % meta.get('commercialUsage'))
        if meta.get('modification') != 'allowModificationRedistribution':
            why.append('개작본 재배포 불가(%s)' % meta.get('modification'))
        if meta.get('allowRedistribution') is not True:
            why.append('재배포 불가')
        if meta.get('avatarPermission') not in ('everyone', None):
            why.append('사용자 제한(%s)' % meta.get('avatarPermission'))
        credit = meta.get('creditNotation') == 'required'
    elif ver == '0.x':
        lic = str(meta.get('licenseName') or '')
        url = str(meta.get('otherLicenseUrl') or '')
        if str(meta.get('commercialUssageName') or '') != 'Allow':
            why.append('상업 사용 불가(%s)' % meta.get('commercialUssageName'))
        if lic == 'Redistribution_Prohibited':
            why.append('재배포 불가')
        if 'hub.vroid.com/license?' in url:
            q = dict(kv.split('=', 1) for kv in url.split('?', 1)[1].split('&') if '=' in kv)
            if q.get('allowed_to_use_user') not in (None, 'everyone'):
                why.append('사용자 제한(%s)' % q.get('allowed_to_use_user'))
            if q.get('corporate_commercial_use') not in (None, 'allow'):
                why.append('법인 상업 불가')
            if q.get('modification') not in (None, 'allow'):
                why.append('개작 불가(%s)' % q.get('modification'))
            if q.get('redistribution') not in (None, 'allow'):
                why.append('재배포 불가(%s)' % q.get('redistribution'))
            credit = q.get('credit') == 'necessary'
        elif lic not in ('CC0', 'CC_BY', 'CC_BY_SA'):
            why.append('조건 불명(%s) — 사람이 확인' % (lic or '?'))
        if lic.startswith('CC_BY'):
            credit = True
    else:
        why.append('VRM 메타를 못 읽음')
    return (not why), why, credit


def make_id(path, meta, ver):
    base = os.path.splitext(os.path.basename(path))[0]
    text = base + ' ' + str(meta.get('title') or meta.get('name') or '')
    m = re.search(r'AvatarSample[_\s]*([A-Za-z])(?![A-Za-z])', text, re.I)
    if m:
        i = 'avatarsample_' + m.group(1).lower()
        if re.search(r'vrm\s*_?1\.?0|vrm10', text, re.I) or ver == '1.0':
            i += '_vrm10'
        return i
    s = re.sub(r'[^a-z0-9]+', '_', base.lower()).strip('_')
    return s or 'model'


def collect(args):
    files = []
    for a in args:
        a = os.path.expanduser(a)
        if os.path.isdir(a):
            for dp, _dn, fns in os.walk(a):
                for fn in fns:
                    if fn.lower().endswith('.vrm'):
                        files.append(os.path.join(dp, fn))
        elif a.lower().endswith('.vrm') and os.path.exists(a):
            files.append(a)
    return sorted(files)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    do_copy = '--copy' in sys.argv
    if not args:
        print(__doc__)
        return 2
    files = collect(args)
    if not files:
        print('VRM 파일이 없다')
        return 1
    table = {}
    if os.path.exists(LIC_OUT):
        table = json.load(open(LIC_OUT, encoding='utf-8')).get('models', {})
    seen = {}
    for p in files:
        try:
            ver, meta = read_meta(p)
        except Exception as e:
            print('건너뜀', p, e)
            continue
        i = make_id(p, meta, ver)
        if i in seen:
            print('id 겹침 건너뜀: %s (%s)' % (i, os.path.basename(p)))
            continue
        seen[i] = p
        status = ''
        ok, why, credit = usable(ver, meta)
        if do_copy:
            os.makedirs(IN_DIR, exist_ok=True)
            dst = os.path.join(IN_DIR, i + '.vrm')
            if not ok:
                status = '복사 안 함(' + '; '.join(why) + ')'
            elif os.path.exists(dst):
                status = '있음'
            else:
                shutil.copyfile(p, dst)
                status = '복사'
        else:
            status = ('사용 O' + (' · 크레딧 표기 필요' if credit else '')) if ok else '사용 X(' + '; '.join(why) + ')'
        if ok and credit and do_copy:
            status += ' · 크레딧 표기 필요'
        table[i] = {'source_file': os.path.basename(p), 'vrm': ver, 'size_mb': round(os.path.getsize(p) / 1048576, 1), 'meta': meta,
                    'usable': ok, 'why_not': why, 'credit_required': credit}
        print('%-24s VRM %-4s %5.1fMB  상업:%-6s 재배포:%-6s 개작:%-6s %s' % (
            i, ver, table[i]['size_mb'],
            meta.get('commercialUsage') or meta.get('commercialUssageName') or '?',
            meta.get('allowRedistribution') or meta.get('redistribution') or '?',
            meta.get('modification') or '?', status))
    os.makedirs(os.path.dirname(LIC_OUT), exist_ok=True)
    out = {'note': '생성: py tools/char-forge/vroid_samples.py - VRM 안 메타 그대로. 게임에 넣기 전 모델별 이용 조건을 사람이 확인(K-0022).', 'models': dict(sorted(table.items()))}
    open(LIC_OUT, 'wb').write((json.dumps(out, ensure_ascii=False, indent=1) + '\n').encode('utf-8'))
    print('\n%d 개 · 표: %s' % (len(seen), os.path.relpath(LIC_OUT, os.path.dirname(HERE))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
