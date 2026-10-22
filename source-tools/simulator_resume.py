#!/usr/bin/env python3
"""Run one real background/foreground check on a booted iOS Simulator only."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = 'cn.jimmy.nightlens'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--flutter', default=shutil.which('flutter') or str(Path.home()/'.local/share/nightlens/flutter/bin/flutter'))
    args = parser.parse_args()
    devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'booted', '--json']))
    booted = [d for rows in devices['devices'].values() for d in rows if d['state'] == 'Booted' and d.get('isAvailable')]
    if len(booted) != 1:
        parser.error('请只启动一台 iOS 模拟器；本工具不选择或安装真实手机。')
    device = booted[0]['udid']
    def session_path():
        p = subprocess.run(['xcrun', 'simctl', 'get_app_container', device, BUNDLE, 'data'], capture_output=True, text=True)
        return Path(p.stdout.strip())/'Library/Application Support/session.json' if p.returncode == 0 else None
    original = session_path()
    had_session = bool(original and original.exists())
    env = os.environ.copy()
    env.setdefault('PUB_HOSTED_URL', 'https://pub.flutter-io.cn')
    env.setdefault('FLUTTER_STORAGE_BASE_URL', 'https://storage.flutter-io.cn')
    with tempfile.TemporaryDirectory(prefix='nightlens-simulator-') as temp:
        backup = Path(temp)/'session.json'
        if had_session:
            shutil.copy2(original, backup)
        try:
            command = [args.flutter, 'test', 'integration_test/resume_test.dart', '-d', device, '--no-pub', '--reporter', 'expanded']
            with subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1) as process:
                backgrounded = False
                for line in process.stdout:
                    print(line, end='', flush=True)
                    if line.rstrip().endswith('NIGHTLENS_SIM_READY_FOR_BACKGROUND') and not backgrounded:
                        backgrounded = True
                        subprocess.run(['xcrun', 'simctl', 'launch', device, 'com.apple.Preferences'], check=True)
                        time.sleep(4)
                        subprocess.run(['xcrun', 'simctl', 'launch', device, BUNDLE], check=True)
                return process.wait()
        finally:
            current = session_path()
            if current:
                if had_session:
                    current.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(backup, current)
                else:
                    current.unlink(missing_ok=True)
            print('已恢复模拟器原有记录。测试版入口可用 flutter build ios --simulator --debug -t lib/main.dart 重建后替换。')

if __name__ == '__main__':
    raise SystemExit(main())
