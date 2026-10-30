"""GPU/서버/실제 _out을 쓰지 않는 생성 재개·실패 계약 회귀 검사."""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

SPEC = importlib.util.spec_from_file_location('saga_gen_test_target', Path(__file__).with_name('gen.py'))
gen = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gen)


def png_bytes(color='red'):
    buffer = io.BytesIO()
    Image.new('RGB', (16, 16), color).save(buffer, format='PNG')
    return buffer.getvalue()


class GenerationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.batch = self.root / 'batch.json'
        self.out = self.root / 'out' / 'sample'
        self.model = 'animagine-xl-4.0-opt'
        self.defaults = {'width': 16, 'height': 16}
        self.item = {'id': 'sample', 'prompt': 'stone tower', 'seed': 7}
        self.write_batch([self.item])
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        for name, value in [('OUT', str(self.root / 'out')), ('PAUSE', 0), ('MAX_ITEMS', 24)]:
            self.stack.enter_context(patch.object(gen, name, value))
        self.ram = self.stack.enter_context(patch.object(gen, 'free_gb', return_value=32))
        self.up = self.stack.enter_context(patch.object(gen, 'up', return_value=True))
        self.api = self.stack.enter_context(patch.object(gen, 'call'))
        self.generate = self.stack.enter_context(patch.object(gen, 'generate', side_effect=self.generated))

    def write_batch(self, items):
        self.batch.write_text(json.dumps({'model': self.model, 'out': 'sample',
                                          'defaults': self.defaults, 'items': items}), encoding='utf-8')

    def generated(self, item, model, defaults):
        _, settings = gen.workflow(item, model, defaults, item.get('seed', 7), dry=True)
        return png_bytes(), settings, model, 1.5

    def run_batch(self, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = gen.main([str(self.batch), *args])
        line = next(line for line in output.getvalue().splitlines() if line.startswith('GEN_RESULT '))
        return code, json.loads(line[len('GEN_RESULT '):])

    def snapshot(self):
        return {p.name: p.read_bytes() for p in self.out.iterdir() if p.is_file()}

    def test_generate_then_reuse_without_server(self):
        code, result = self.run_batch()
        self.assertEqual((code, result['generated'], result['status']), (0, 1, 'complete'))
        before = self.snapshot()
        self.generate.reset_mock()
        self.up.reset_mock()
        self.api.reset_mock()
        code, result = self.run_batch()
        self.assertEqual((code, result['reused']), (0, 1))
        self.generate.assert_not_called()
        self.up.assert_not_called()
        self.api.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_missing_pair_and_corrupt_output_preserved(self):
        for defect in ('missing_json', 'missing_png', 'corrupt_png', 'corrupt_json', 'wrong_hash'):
            with self.subTest(defect=defect):
                with tempfile.TemporaryDirectory(dir=self.root) as destination:
                    with patch.object(gen, 'OUT', destination):
                        self.run_batch()
                        target = Path(destination) / 'sample'
                        png = target / 'sample.png'
                        lic = target / 'sample.license.json'
                        if defect == 'missing_json':
                            lic.unlink()
                        elif defect == 'missing_png':
                            png.unlink()
                        elif defect == 'corrupt_png':
                            png.write_bytes(b'not a png')
                        elif defect == 'corrupt_json':
                            lic.write_text('{', encoding='utf-8')
                        else:
                            png.write_bytes(png_bytes('blue'))
                        before = {p.name: p.read_bytes() for p in target.iterdir()}
                        self.generate.reset_mock()
                        code, result = self.run_batch()
                        self.assertEqual((code, result['failed']), (1, 1))
                        self.generate.assert_not_called()
                        self.assertEqual(before, {p.name: p.read_bytes() for p in target.iterdir()})

    def test_input_change_fails_without_replacing_output(self):
        self.run_batch()
        before = self.snapshot()
        self.write_batch([dict(self.item, prompt='wooden tower')])
        code, result = self.run_batch()
        self.assertEqual((code, result['failed']), (1, 1))
        self.assertEqual(before, self.snapshot())

    def test_input_content_hash_is_path_independent(self):
        left, right = self.root / 'left.png', self.root / 'right.png'
        left.write_bytes(png_bytes())
        right.write_bytes(left.read_bytes())
        a = dict(self.item, init_image=str(left))
        b = dict(self.item, init_image=str(right))
        self.assertEqual(gen.request_hash(a, self.model, self.defaults), gen.request_hash(b, self.model, self.defaults))
        right.write_bytes(png_bytes('blue'))
        self.assertNotEqual(gen.request_hash(a, self.model, self.defaults), gen.request_hash(b, self.model, self.defaults))

    def test_legacy_pair_preserved_and_distinguished(self):
        self.run_batch()
        path = self.out / 'sample.license.json'
        lic = json.loads(path.read_text(encoding='utf-8'))
        del lic['request_sha256'], lic['output_sha256']
        path.write_text(json.dumps(lic), encoding='utf-8')
        before = self.snapshot()
        code, result = self.run_batch()
        self.assertEqual((code, result['legacy'], result['reused']), (0, 1, 0))
        self.assertEqual(before, self.snapshot())

    def test_dry_checks_fourth_item_without_server_or_output(self):
        self.write_batch([dict(self.item, id=f'item{i}', width=17 if i == 3 else 16) for i in range(4)])
        code, result = self.run_batch('--dry')
        self.assertEqual((code, result['checked'], result['failed']), (1, 3, 1))
        self.api.assert_not_called()
        self.generate.assert_not_called()
        self.assertFalse(self.out.exists())

    def test_dry_and_empty_are_not_generation_passes(self):
        code, result = self.run_batch('--dry')
        self.assertEqual((code, result['status'], result['generated'], result['pending']), (0, 'dry', 0, 1))
        code, result = self.run_batch('--only', 'absent', '--judge')
        self.assertEqual((code, result['status'], result['judge']), (0, 'empty', 'not_run'))
        self.up.assert_not_called()
        self.assertFalse(self.out.exists())

    def test_failure_stops_after_two_and_keeps_unattempted_count(self):
        self.write_batch([dict(self.item, id=f'item{i}') for i in range(4)])
        self.generate.side_effect = RuntimeError('mock generation failure')
        code, result = self.run_batch('--judge')
        self.assertEqual((code, result['failed'], result['pending'], result['judge']), (1, 2, 2, 'not_run'))
        self.assertEqual(self.generate.call_count, 2)
        self.assertFalse(list(self.out.glob('*.lock')))

    def test_one_failure_then_success_still_fails_batch(self):
        self.write_batch([self.item, dict(self.item, id='second')])
        self.generate.side_effect = [RuntimeError('mock'), self.generated(self.item, self.model, self.defaults)]
        code, result = self.run_batch()
        self.assertEqual((code, result['failed'], result['generated']), (1, 1, 1))

    def test_ram_stop_and_unavailable_server(self):
        self.ram.return_value = 1
        code, result = self.run_batch()
        self.assertEqual((code, result['status'], result['pending']), (1, 'blocked', 1))
        self.up.assert_not_called()
        self.ram.return_value = 32
        self.up.return_value = False
        code, result = self.run_batch()
        self.assertEqual((code, result['status']), (1, 'blocked'))
        self.generate.assert_not_called()

    def test_ram_drop_between_images(self):
        self.write_batch([self.item, dict(self.item, id='second')])
        self.ram.side_effect = [32, 32, 1]
        code, result = self.run_batch()
        self.assertEqual((code, result['generated'], result['pending'], result['status']), (1, 1, 1, 'blocked'))

    def test_judge_failure_propagates_and_cap_defers_judge(self):
        self.write_batch([self.item, dict(self.item, id='second')])
        with patch.object(gen, 'MAX_ITEMS', 1), patch('subprocess.call', return_value=7) as judge:
            code, result = self.run_batch('--judge')
            self.assertEqual((code, result['status'], result['pending']), (0, 'partial', 1))
            judge.assert_not_called()
            code, result = self.run_batch('--judge')
            self.assertEqual((code, result['status'], result['judge']), (1, 'failed', 'failed'))
            judge.assert_called_once()

    def test_duplicate_or_unsafe_id_fails_before_generation(self):
        for items in ([self.item, dict(self.item, id='SAMPLE')], [dict(self.item, id='../escape')]):
            self.write_batch(items)
            code, result = self.run_batch()
            self.assertEqual(code, 1)
            self.assertGreater(result['failed'], 0)
        self.generate.assert_not_called()

    def test_existing_lock_is_preserved(self):
        self.out.mkdir(parents=True)
        lock = self.out / 'sample.png.lock'
        lock.write_text('another process', encoding='utf-8')
        code, result = self.run_batch()
        self.assertEqual((code, result['failed']), (1, 1))
        self.generate.assert_not_called()
        self.assertEqual(lock.read_text(encoding='utf-8'), 'another process')

    def test_exclusive_save_does_not_overwrite(self):
        self.run_batch()
        before = self.snapshot()
        with self.assertRaises(FileExistsError):
            gen.save_output(str(self.out / 'sample.png'), png_bytes('blue'), {'id': 'sample'})
        self.assertEqual(before, self.snapshot())

    def test_metadata_failure_leaves_no_png(self):
        with patch.object(gen, 'make_license', side_effect=ValueError('bad metadata')):
            code, result = self.run_batch()
        self.assertEqual((code, result['failed']), (1, 1))
        self.assertEqual(list(self.out.iterdir()), [])

    def test_invalid_dimensions_and_missing_input_fail_in_dry(self):
        for change in ({'width': 0}, {'height': -16}, {'init_image': str(self.root / 'absent.png')}):
            self.write_batch([dict(self.item, **change)])
            code, result = self.run_batch('--dry')
            self.assertEqual((code, result['failed']), (1, 1))
        self.generate.assert_not_called()

    def test_judge_launch_failure_propagates(self):
        with patch('subprocess.call', side_effect=FileNotFoundError('bash unavailable')):
            code, result = self.run_batch('--judge')
        self.assertEqual((code, result['judge']), (1, 'failed'))


class RunnerTests(unittest.TestCase):
    def test_local_runner_status_with_mock_commands(self):
        bash = shutil.which('bash')
        if not bash and os.name == 'nt':
            candidate = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git/bin/bash.exe'
            if candidate.is_file():
                bash = str(candidate)
        if not bash:
            self.skipTest('Git Bash not installed')
        runner = Path(__file__).with_name('run_all.sh').resolve().as_posix()
        # cd를 임시 루트로 한정하고 모든 외부 서비스 명령을 함수로 대체한다.
        script = '''
cd() { builtin cd "$TEST_ROOT"; }
curl() { return 0; }
py() { printf '%s\\n' "$MOCK_OUTPUT"; return "$MOCK_EXIT"; }
powershell() { printf unexpected > "$TEST_ROOT/unexpected-service"; return 99; }
sleep() { return 0; }
source "$RUNNER" batch.json state.txt
'''
        cases = [
            ('complete', 0, 'GEN_RESULT {"status": "complete"}', 0),
            ('empty', 0, 'GEN_RESULT {"status": "empty"}', 0),
            ('failed', 1, 'ok one\n실패 two\nGEN_RESULT {"status": "failed"}', 1),
            ('missing_result', 0, 'no progress', 1),
            ('iteration_limit', 0, 'ok one\nGEN_RESULT {"status": "partial"}', 1),
        ]
        for name, mock_exit, output, expected in cases:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                (root / 'tools/ai-art/_out').mkdir(parents=True)
                env = dict(os.environ, TEST_ROOT=root.as_posix(), RUNNER=runner,
                           MOCK_OUTPUT=output, MOCK_EXIT=str(mock_exit))
                result = subprocess.run([bash, '--noprofile', '--norc'], input=script, text=True,
                                        encoding='utf-8', capture_output=True, cwd=root, env=env, timeout=30)
                self.assertEqual(result.returncode, expected, result.stderr)
                self.assertFalse((root / 'unexpected-service').exists())
                state = (root / 'state.txt').read_text(encoding='utf-8')
                self.assertEqual('done' in state.splitlines(), expected == 0)


if __name__ == '__main__':
    unittest.main()
