"""사가나락 — 위성 마을 새 집 확인용: 로드 후 새 프로필을 만들고
DG.town._reset()/_put() 으로 그 마을·좌표로 순간 이동시킨 뒤 스크린샷.
_cdp_shot.py 의 WS 클래스를 그대로 쓴다.

쓰는 법:
    python _cdp_town_shot.py <url> <townId> <x> <y> out.png [load_wait] [after_wait]
"""
import socket, base64, struct, json, time, sys, urllib.request

PORT = 9333
URL = sys.argv[1]
TOWN = sys.argv[2]
X = sys.argv[3]
Y = sys.argv[4]
OUT = sys.argv[5]
LOAD_WAIT = float(sys.argv[6]) if len(sys.argv) > 6 else 8.0
AFTER_WAIT = float(sys.argv[7]) if len(sys.argv) > 7 else 6.0


def http_get_json(path):
    with urllib.request.urlopen('http://127.0.0.1:%d%s' % (PORT, path), timeout=10) as r:
        return json.loads(r.read().decode('utf-8'))


class WS:
    def __init__(self, url):
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
        header.append(0x81)
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
        raise TimeoutError('no response for %s' % method)

    def wait_event(self, name, timeout=20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.recv().decode('utf-8'))
            if msg.get('method') == name:
                return msg
        raise TimeoutError('event %s not seen' % name)

    def eval(self, expr, timeout=20):
        r = self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}, timeout=timeout)
        res = r.get('result', {}).get('result', {})
        return res.get('value', res)


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
    ws.call('Runtime.enable')
    ws.call('Page.navigate', {'url': URL})
    try:
        ws.wait_event('Page.loadEventFired', timeout=20)
    except TimeoutError:
        pass
    time.sleep(LOAD_WAIT)
    print('name-screen:', ws.eval(
        "(function(){var i=document.getElementById('acc-name');"
        "if(i){i.value='테스트';document.getElementById('acc-go').click();return 'submitted';}"
        "return 'no-name-screen';})()"
    ))
    time.sleep(3.0)
    print('eval:', ws.eval(
        "(function(){try{DG.town._reset(%r);DG.town._put(%s,%s);return 'ok';}"
        "catch(e){return 'err:'+e;}})()" % (TOWN, X, Y)
    ))
    time.sleep(AFTER_WAIT)
    r = ws.call('Page.captureScreenshot', {'format': 'png'}, timeout=20)
    data = r['result']['data']
    with open(OUT, 'wb') as f:
        f.write(base64.b64decode(data))
    print('saved', OUT)


if __name__ == '__main__':
    main()
