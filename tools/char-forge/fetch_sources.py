"""char-forge 입력 팩 받기 — sources.json 대로 _src/ 에 받아 sha256 을 맞추고 푼다.

    py tools/char-forge/fetch_sources.py          # 없는 것만 받는다
    py tools/char-forge/fetch_sources.py --force  # 다시 받는다

itch.io 무료(최소 0원) 팩은 로그인 없이 받는다: 페이지 csrf → download_url → 파일 id 로 CDN 주소.
사람 클릭이 필요 없다. 사이트가 바뀌어 막히면 사람이 받아 _src/ 에 zip 이름대로 두면 된다(sha256 만 맞으면 쓴다).

팩의 "install" 칸(단계 3, 사실 몸):
- blender_extension — Blender 확장(MPFB)을 _blender/(gitignore, BLENDER_USER_RESOURCES)에 설치한다. 사용자 Blender 설정은 안 건드린다.
- mpfb_user_data — MakeHuman 에셋 팩을 그 MPFB 의 사용자 데이터 폴더에 푼다.
"item_licenses" 면 팩 목록 json 의 항목마다 CC0 여야 하고, "exclude" 항목(CC-BY·원작 캐릭터 옷 등)은 풀지 않는다.
"license_must_contain" 이 없으면 라이선스 파일에 CC0 가 있어야 하고, "license_must_not_contain" 에 든 글자가 있으면 멈춘다.
"""
import hashlib, http.cookiejar, json, os, re, subprocess, sys, urllib.parse, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '_src')
BLENDER_HOME = os.path.join(HERE, '_blender')
MPFB_USER_DATA = os.path.join(BLENDER_HOME, 'extensions', '.user', 'user_default', 'mpfb', 'data')
BLENDER = os.environ.get('BLENDER', r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
UA = {'User-Agent': 'Mozilla/5.0 (char-forge fetch_sources)'}


def opener():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def get(op, url, data=None, headers=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={**UA, **(headers or {})})
    with op.open(req, timeout=120) as r:
        return r.read()


def itch_free_url(game, upload_name):
    op = opener()
    page_url = 'https://' + game
    html = get(op, page_url).decode('utf-8', 'replace')
    csrf = re.search(r'name="csrf_token" value="([^"]+)"', html) or re.search(r'csrf_token" value="([^"]+)"', html)
    if not csrf:
        sys.exit('itch: csrf_token 을 못 찾았다 — 사람이 받아 _src/ 에 두기')
    dl = json.loads(get(op, page_url + '/download_url', {'csrf_token': csrf.group(1)}))['url']
    dl_html = get(op, dl).decode('utf-8', 'replace')
    # 속성 순서가 요청마다 바뀐다(title·class) — 올림 칸마다 잘라 이름을 찾는다
    m = None
    for blk in dl_html.split('class="upload"')[1:]:
        if f'title="{upload_name}"' in blk:
            m = re.search(r'data-upload_id="(\d+)"', blk)
            break
    if not m:
        sys.exit(f'itch: 올림 파일 "{upload_name}" 을 못 찾았다')
    csrf2 = re.search(r'csrf_token" value="([^"]+)"', dl_html).group(1)
    # 무료 팩은 key 없이 요청해야 한다(key 를 붙이면 "invalid key")
    j = json.loads(get(op, f'{page_url}/file/{m.group(1)}?source=game_download', {'csrf_token': csrf2},
                       {'Referer': dl, 'X-Requested-With': 'XMLHttpRequest'}))
    return j['url']


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    sys.stdout.reconfigure(errors='replace')  # Windows 콘솔(cp949)이 못 찍는 글자(—)에서 멈추지 않게
    force = '--force' in sys.argv
    os.makedirs(SRC, exist_ok=True)
    packs = json.load(open(os.path.join(HERE, 'sources.json'), encoding='utf-8'))['packs']
    for key, p in packs.items():
        zp = os.path.join(SRC, p['zip'])
        if force or not os.path.exists(zp) or sha256(zp) != p['sha256']:
            d = p['download']
            url = d['url'] if d['kind'] == 'direct' else itch_free_url(d['game'], d['upload_name'])
            print('받기', key)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r, open(zp, 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
        got = sha256(zp)
        if got != p['sha256']:
            sys.exit(f'{key}: sha256 불일치 {got} — 팩이 바뀌었다. 라이선스를 다시 확인하고 sources.json 을 고친다')
        with zipfile.ZipFile(zp) as z:
            lic = z.read(p['license_file']).decode('utf-8', 'replace')
            must = p.get('license_must_contain', 'CC0')
            if must not in lic or any(bad in lic for bad in p.get('license_must_not_contain', [])):
                sys.exit(f'{key}: 라이선스 파일({p["license_file"]})이 기대와 다르다 — 쓰지 않는다')
            inst = p.get('install')
            skip = set(p.get('exclude', []))
            if p.get('item_licenses'):  # 팩 목록 json 의 항목마다 CC0 인지(뺄 항목은 exclude)
                items = json.loads(lic)
                bad = [k for k, v in items.items() if k not in skip
                       and not str(v.get('license', '')).upper().replace('-', '').replace(' ', '').startswith('CC0')]
                if bad:
                    sys.exit(f'{key}: CC0 아닌 항목 {bad} — exclude 에 넣거나 쓰지 않는다')
            if inst == 'mpfb_user_data':
                if not os.path.exists(os.path.join(MPFB_USER_DATA, p['license_file'])):
                    os.makedirs(MPFB_USER_DATA, exist_ok=True)
                    # exclude 항목 폴더(<종류>/<항목>/)는 풀지 않는다
                    z.extractall(MPFB_USER_DATA, [n for n in z.namelist() if not (n.count('/') >= 2 and n.split('/')[1] in skip)])
            elif inst != 'blender_extension' and not os.path.exists(os.path.join(SRC, p['license_file'])):
                z.extractall(SRC)
        if inst == 'blender_extension' and not os.path.isdir(os.path.join(BLENDER_HOME, 'extensions', 'user_default', p['extension_id'])):
            env = dict(os.environ, BLENDER_USER_RESOURCES=BLENDER_HOME)
            subprocess.run([BLENDER, '-b', '--command', 'extension', 'install-file', '-r', 'user_default', '-e', zp],
                           env=env, stdin=subprocess.DEVNULL, check=True)
        print('ok', key, p['license'])



def fetch_polyhaven(force=False):
    """옷 결 사진(09-28) — sources.json "polyhaven" 칸, api.polyhaven.com/files/<id> 의 1k Diffuse(jpg)·Displacement(png). 전부 CC0."""
    ph = json.load(open(os.path.join(HERE, 'sources.json'), encoding='utf-8')).get('polyhaven')
    if not ph:
        return
    out = os.path.join(SRC, 'polyhaven')
    os.makedirs(out, exist_ok=True)
    for tid, it in ph['items'].items():
        files = None
        for kind, ext, key in (('Diffuse', 'jpg', 'diff_1k_jpg'), ('Displacement', 'png', 'disp_1k_png')):
            fp = os.path.join(out, f'{tid}_{kind[:4].lower()}_1k.{ext}')
            if force or not os.path.exists(fp) or sha256(fp) != it[key]:
                files = files or json.loads(get(opener(), f'https://api.polyhaven.com/files/{tid}'))
                print('받기', tid, kind)
                open(fp, 'wb').write(get(opener(), files[kind]['1k'][ext]['url']))
            if sha256(fp) != it[key]:
                sys.exit(f'polyhaven {tid} {kind}: sha256 불일치 — 사진이 바뀌었다. 확인하고 sources.json 을 고친다')
    print('ok polyhaven', len(ph['items']), ph['license'])


if __name__ == '__main__':
    main()
    fetch_polyhaven('--force' in sys.argv)
