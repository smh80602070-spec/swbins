"""K-0214: 원격 서비스·계정·GPU 없이 워커/수신 완료 계약 검사."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

from PIL import Image


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


worker = load('k214_worker', 'remote/sd_kaggle.py')
receiver = load('k214_receiver', 'remote/push_batch.py')


def process(status='complete', generated=1, failed=0, pending=0, code=0):
    result = dict(status=status, generated=generated, failed=failed, pending=pending)
    return Mock(returncode=code, communicate=Mock(return_value=('GEN_RESULT ' + json.dumps(result), None)))


class WorkerTests(unittest.TestCase):
    def run_chunks(self, processes, limit=3, parts=None):
        with patch.object(worker, 'log'), patch.object(worker.subprocess, 'Popen', side_effect=processes) as launch:
            result = worker.run_chunks(parts or [(1, 'batch.json')], 'gen.py', 2, 'batch', max_chunks=limit)
        return result, launch

    def test_partial_then_complete_and_actual_gpu_port(self):
        result, launch = self.run_chunks([process('partial', pending=1), process()])
        self.assertEqual((result['status'], result['ok'], result['fail']), ('complete', 2, 0))
        self.assertEqual(launch.call_args.kwargs['env']['AI_ART_API'], 'http://127.0.0.1:8189')

    def test_failure_after_partial_success_stops(self):
        result, launch = self.run_chunks([process('failed', generated=1, failed=1, code=1)])
        self.assertEqual((result['status'], result['ok'], result['fail']), ('failed', 1, 1))
        self.assertEqual(launch.call_count, 1)

    def test_nonzero_exit_even_with_complete_summary(self):
        result, _ = self.run_chunks([process(code=1)])
        self.assertEqual(result['status'], 'failed')

    def test_no_summary_or_invalid_counts_cannot_pass(self):
        for output in ('Traceback: mock', 'GEN_RESULT {}', 'GEN_RESULT []',
                       'GEN_RESULT {"generated": -1, "failed": 0, "pending": 0}',
                       'GEN_RESULT {}\nGEN_RESULT {}'):
            with self.subTest(output=output):
                result, _ = self.run_chunks([Mock(returncode=0, communicate=Mock(return_value=(output, None)))])
                self.assertEqual(result['status'], 'failed')

    def test_incomplete_no_progress_and_iteration_limit(self):
        for proc in (process('partial', generated=0, pending=1), process('partial', pending=1), process(pending=1)):
            result, _ = self.run_chunks([proc], limit=1)
            self.assertEqual(result['status'], 'failed')
            self.assertGreater(result['fail'], 0)

    def test_second_launch_failure_drains_started_process(self):
        running = process()
        result, _ = self.run_chunks([running, OSError('mock start failure')], parts=[(0, 'a'), (1, 'b')])
        self.assertEqual(result['status'], 'failed')
        running.communicate.assert_called_once()


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ai = self.root / 'ai'
        self.remote = self.root / 'remote'
        self.remote.mkdir()
        self.batch = self.root / 'batch.json'
        self.item = {'id': 'sample', 'prompt': 'stone tower', 'seed': 7}
        self.data = {'model': 'animagine-xl-4.0-opt', 'out': 'sample',
                     'defaults': {'width': 16, 'height': 16}, 'items': [self.item]}
        self.batch.write_text(json.dumps(self.data), encoding='utf-8')
        self.out = self.ai / '_out/sample'
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(receiver, 'AI', str(self.ai)))
        self.stack.enter_context(patch.object(receiver, 'ROOT', str(self.root)))
        self.user = self.stack.enter_context(patch.object(receiver, 'user', return_value='mock-account'))
        self.stack.enter_context(patch.object(receiver.time, 'sleep'))
        self.stack.enter_context(patch.object(receiver.atexit, 'register'))
        real_mkdtemp = tempfile.mkdtemp
        self.stack.enter_context(patch.object(receiver.tempfile, 'mkdtemp', side_effect=lambda **kw: real_mkdtemp(dir=self.root, **kw)))

    def pair(self, item=None):
        import gen
        item = item or self.item
        path = self.remote / 'sample' / (item['id'] + '.png')
        path.parent.mkdir(parents=True, exist_ok=True)
        image = io.BytesIO()
        Image.new('RGB', (16, 16), 'red').save(image, format='PNG')
        png = image.getvalue()
        _, settings = gen.workflow(item, self.data['model'], self.data['defaults'], item.get('seed', 0), dry=True)
        lic = gen.make_license(item, png, settings, self.data['model'], 1,
                               gen.request_hash(item, self.data['model'], self.data['defaults']))
        gen.save_output(str(path), png, lic)
        return path

    def place(self, nv=0):
        with contextlib.redirect_stdout(io.StringIO()):
            return receiver.place([str(self.batch)], nv, str(self.remote))['batch.json']

    def main_result(self, zip_present=True, times_present=True, kernel='complete', times_status='complete', batch_status='complete'):
        archive = self.root / 'source.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            for p in self.remote.rglob('*'):
                if p.is_file():
                    z.write(p, p.relative_to(self.remote).as_posix())

        def cli(*args, **kwargs):
            if args[:2] == ('kernels', 'status'):
                return 'KernelWorkerStatus.' + kernel
            self.assertEqual(args[:2], ('kernels', 'output'))
            destination = Path(args[args.index('-p') + 1])
            if zip_present:
                shutil.copy(archive, destination / 'result.zip')
            if times_present:
                (destination / 'times.json').write_text(json.dumps({
                    'status': times_status, 'batches': {'batch.json': {'status': batch_status, 'fail': 0}}}), encoding='utf-8')
            return 'mock download'

        state = self.root / 'state.txt'
        with patch.object(receiver, 'kg', side_effect=cli), contextlib.redirect_stdout(io.StringIO()):
            code = receiver.main([str(self.batch), '--no-push', '--state', str(state)])
        return code, state.read_text(encoding='utf-8').splitlines()

    def test_place_then_resume_preserves_existing_bytes(self):
        self.pair()
        result = self.place()
        self.assertEqual((result['placed'], result['failed']), (1, 0))
        before = {p.name: p.read_bytes() for p in self.out.iterdir()}
        result = self.place()
        self.assertEqual((result['placed'], result['reused']), (0, 1))
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.out.iterdir()})

    def test_variants_match_generator_seed_contract(self):
        self.data['defaults']['variants'] = 2
        self.batch.write_text(json.dumps(self.data), encoding='utf-8')
        items = receiver.variant_ids(self.data, 2)
        self.assertEqual([item['seed'] for _, item in items], [7, 8])
        for _, item in items:
            self.pair(item)
        self.assertEqual(self.place()['placed'], 2)

    def test_missing_license_creates_no_local_png(self):
        src = self.pair()
        src.with_suffix('.license.json').unlink()
        result = self.place()
        self.assertEqual(result['failed'], 1)
        self.assertFalse((self.out / 'sample.png').exists())

    def test_mismatched_request_or_output_rejected(self):
        src = self.pair(dict(self.item, prompt='wooden tower'))
        self.assertEqual(self.place()['failed'], 1)
        src.write_bytes(b'corrupt')
        self.assertEqual(self.place()['failed'], 1)
        self.assertFalse((self.out / 'sample.png').exists())

    def test_local_incomplete_pair_is_never_overwritten(self):
        self.pair()
        self.out.mkdir(parents=True)
        target = self.out / 'sample.png'
        target.write_bytes(b'original incomplete output')
        result = self.place()
        self.assertEqual(result['failed'], 1)
        self.assertEqual(target.read_bytes(), b'original incomplete output')

    def test_download_without_request_hash_rejected(self):
        src = self.pair()
        path = src.with_suffix('.license.json')
        lic = json.loads(path.read_text(encoding='utf-8'))
        del lic['request_sha256'], lic['output_sha256']
        path.write_text(json.dumps(lic), encoding='utf-8')
        self.assertEqual(self.place()['failed'], 1)

    def test_missing_zip_never_done(self):
        code, lines = self.main_result(zip_present=False)
        self.assertEqual(code, 1)
        self.assertNotIn('done', lines)

    def test_missing_expected_output_never_done(self):
        code, lines = self.main_result()
        self.assertEqual(code, 1)
        self.assertNotIn('done', lines)

    def test_stale_times_cannot_replace_current_report(self):
        self.pair()
        keep = self.ai / '_out/remote_sd'
        keep.mkdir(parents=True)
        (keep / 'times.json').write_text('{"status":"complete","batches":{}}', encoding='utf-8')
        code, lines = self.main_result(times_present=False)
        self.assertEqual(code, 1)
        self.assertNotIn('done', lines)

    def test_kernel_failure_with_valid_partial_output_still_fails(self):
        self.pair()
        code, lines = self.main_result(kernel='error')
        self.assertEqual(code, 1)
        self.assertNotIn('done', lines)
        self.assertTrue((self.out / 'sample.png').exists())

    def test_worker_failed_report_never_done(self):
        self.pair()
        code, lines = self.main_result(times_status='failed', batch_status='failed')
        self.assertEqual(code, 1)
        self.assertNotIn('done', lines)

    def test_complete_current_result_done(self):
        self.pair()
        code, lines = self.main_result()
        self.assertEqual(code, 0)
        self.assertEqual(lines[-1], 'done')

    def test_empty_request_fails_before_account_lookup(self):
        with contextlib.redirect_stdout(io.StringIO()):
            code = receiver.main([])
        self.assertEqual(code, 1)
        self.user.assert_not_called()

    def prepare_build(self):
        self.ai.mkdir(parents=True, exist_ok=True)
        for name in ('gen.py', 'i2i_meta.py'):
            (self.ai / name).write_text('# mock upload source', encoding='utf-8')
        comfy = self.root / 'comfy'
        (comfy / 'custom_nodes/ComfyUI-GGUF').mkdir(parents=True)
        (comfy / 'custom_nodes/saga_seamless.py').write_text('# mock', encoding='utf-8')
        (comfy / 'custom_nodes/ComfyUI-GGUF/ops.py').write_text('# mock', encoding='utf-8')
        self.stack.enter_context(patch.object(receiver, 'COMFY', str(comfy)))
        self.stack.enter_context(patch.object(receiver, 'git_sha', return_value='0' * 40))

    def test_upload_preflight_reuses_pair_and_blocks_incomplete_pair(self):
        self.pair()
        self.place()
        self.prepare_build()
        with contextlib.redirect_stdout(io.StringIO()):
            _, job, total = receiver.build([str(self.batch)], 0)
        self.assertEqual((job['batches'], total), ([], 0))
        (self.out / 'sample.license.json').unlink()
        with self.assertRaises(ValueError):
            receiver.build([str(self.batch)], 0)

    def test_uploaded_input_relocation_keeps_request_hash(self):
        self.prepare_build()
        image = self.root / 'input.png'
        image.write_bytes(b'mock input bytes')
        item = dict(self.item, init_image=str(image))
        self.data['items'] = [item]
        self.batch.write_text(json.dumps(self.data), encoding='utf-8')
        dataset, job, total = receiver.build([str(self.batch)], 0)
        packed = json.loads((Path(dataset) / job['batches'][0]['file']).read_text(encoding='utf-8'))
        moved = dict(packed['items'][0])
        moved['init_image'] = str(Path(dataset) / moved['init_image'])
        self.assertEqual(total, 1)
        self.assertEqual(receiver.request_hash(item, self.data['model'], self.data['defaults']),
                         receiver.request_hash(moved, self.data['model'], self.data['defaults']))


if __name__ == '__main__':
    unittest.main()
