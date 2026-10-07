"""사가나락 — CDP(devtools 프로토콜)로 실제 벽시계 시간을 기다렸다 찍는 스크린샷.

`chrome --headless=new --screenshot`은 `load` 이벤트 직후 바로 찍는다. 이 판의
3D 인물(`asset3d.js`의 `buildHero`)은 몸·옷·머리·애니메이션 GLB 넷을 `load` 뒤에
비동기로 받아 조립하므로, 그 방식으로 찍으면 매번 조립 전 placeholder 상자만
찍힌다. `--virtual-time-budget`을 더해도 이 페이지에서는 멈춘다(짐작 — 주기적
네트워크 요청 때문에 "네트워크 유휴" 판정이 안 되는 것 같다).

그래서 이 스크립트는 헤드리스 크롬에 원격 디버깅 포트로 직접 붙어(표준 라이브러리
소켓으로 WebSocket 핸드셰이크까지 손으로 뜬다 — 별도 pip 설치가 필요 없다),
Page.navigate → load 이벤트 대기 → **진짜 몇 초 그냥 기다림(time.sleep)** →
Page.captureScreenshot 순서로 찍는다. GLB 조립이 끝날 시간을 벌어 준다.

쓰는 법:
    1) 크롬을 원격 디버깅 포트로 먼저 띄운다(스크린샷 플래그 없이):
       chrome --headless=new --disable-gpu --use-angle=swiftshader \
         --enable-unsafe-swiftshader --disable-gpu-sandbox \
         --remote-debugging-port=9333 --remote-allow-origins=* \
         --window-size=900,700 --user-data-dir=<임시폴더> about:blank

    2) http://127.0.0.1:9333/json/version 이 응답하면 준비된 것

    3) 이 스크립트로 원하는 장면을 찍는다:
       python _cdp_shot.py "http://127.0.0.1:8792/_demo.html#camp" out.png 8

       (마지막 인자는 load 이벤트 뒤 기다릴 초 — 기본 5, 인물 GLB는 8 정도면 충분했다)

찍은 뒤에는 Read 툴로 out.png 를 바로 볼 수 있다. 인물처럼 화면 한구석에 작게
나오는 대상은 PIL로 잘라 확대하면 더 잘 보인다(`Image.crop().resize(..., Image.LANCZOS)`).
"""
import socket, base64, struct, json, time, sys, urllib.request

import os
PORT = int(os.environ.get('CDP_PORT', '9333'))
URL = sys.argv[1]
OUT = sys.argv[2]
WAIT_S = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0


def http_get_json(path):
    with urllib.request.urlopen('http://127.0.0.1:%d%s' % (PORT, path), timeout=10) as r:
        return json.loads(r.read().decode('utf-8'))


class WS:
    def __init__(self, url):
        # url 은 ws://127.0.0.1:9333/devtools/page/XXXX 꼴
        assert url.startswith('ws://')
        rest = url[len('ws://'):]
        host, path = rest.split('/', 1)
        path = '/' + path
        if ':' in host:
            h, p = host.split(':')
            p = int(p)
        else:
            h, p = host, 80
        self.sock = socket.create_connection((h, p), timeout=10)
        key = base64.b64encode(b'0123456789012345').decode()
        req = (
            'GET %s HTTP/1.1\r\n'
            'Host: %s:%d\r\n'
            'Upgrade: websocket\r\n'
            'Connection: Upgrade\r\n'
            'Sec-WebSocket-Key: %s\r\n'
            'Sec-WebSocket-Version: 13\r\n\r\n'
        ) % (path, h, p, key)
        self.sock.sendall(req.encode())
        resp = b''
        while b'\r\n\r\n' not in resp:
            resp += self.sock.recv(4096)
        self._id = 0
        self._buf = resp.split(b'\r\n\r\n', 1)[1]

    def send(self, obj):
        payload = json.dumps(obj).encode('utf-8')
        header = bytearray()
        header.append(0x81)  # FIN + text frame
        mask_bit = 0x80
        length = len(payload)
        if length < 126:
            header.append(mask_bit | length)
        elif length < 65536:
            header.append(mask_bit | 126)
            header += struct.pack('>H', length)
        else:
            header.append(mask_bit | 127)
            header += struct.pack('>Q', length)
        mask = bytes([5, 7, 9, 11])
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def _recv_exact(self, n):
        while len(self._buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise EOFError('socket closed')
            self._buf += chunk
        data, self._buf = self._buf[:n], self._buf[n:]
        return data

    def recv(self):
        b1b2 = self._recv_exact(2)
        b1, b2 = b1b2[0], b1b2[1]
        opcode = b1 & 0x0F
        masked = (b2 & 0x80) != 0
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack('>H', self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack('>Q', self._recv_exact(8))[0]
        if masked:
            mask = self._recv_exact(4)
            payload = bytearray(self._recv_exact(length))
            for i in range(length):
                payload[i] ^= mask[i % 4]
            payload = bytes(payload)
        else:
            payload = self._recv_exact(length)
        if opcode == 0x8:
            raise EOFError('closed by peer')
        return payload

    def call(self, method, params=None, timeout=20):
        self._id += 1
        mid = self._id
        self.send({'id': mid, 'method': method, 'params': params or {}})
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.recv().decode('utf-8'))
            if msg.get('id') == mid:
                return msg
            # else: 이벤트 알림 — 무시하고 계속 기다린다
        raise TimeoutError('no response for %s' % method)

    def wait_event(self, name, timeout=20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.recv().decode('utf-8'))
            if msg.get('method') == name:
                return msg
        raise TimeoutError('event %s not seen' % name)


def main():
    tabs = http_get_json('/json')
    tab = None
    for t in tabs:
        if t.get('type') == 'page':
            tab = t
            break
    if not tab:
        tab = http_get_json('/json/new?' + URL)
    ws = WS(tab['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Page.navigate', {'url': URL})
    try:
        ws.wait_event('Page.loadEventFired', timeout=20)
    except TimeoutError:
        pass
    time.sleep(WAIT_S)
    r = ws.call('Page.captureScreenshot', {'format': 'png'}, timeout=20)
    data = r['result']['data']
    with open(OUT, 'wb') as f:
        f.write(base64.b64decode(data))
    print('saved', OUT)


if __name__ == '__main__':
    main()
