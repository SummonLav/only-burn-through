#!/usr/bin/env python3
"""Plan and render local concert highlights with deterministic WebGL/Canvas effects."""
import argparse
import concurrent.futures
import datetime
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys

SKILL = Path(__file__).resolve().parent.parent
try:
    import numpy as np
except ImportError:
    python = SKILL / '.venv/bin/python'
    if python.exists() and Path(sys.prefix).resolve() != python.parent.parent.resolve():
        os.execv(str(python), [str(python), str(Path(__file__).resolve()), *sys.argv[1:]])
    raise SystemExit('Run bash scripts/setup.sh from the skill directory first.')


def emit(message):
    print(json.dumps(message, ensure_ascii=False), flush=True)


def run(args, log=None):
    if log:
        with Path(log).open('w') as output:
            result = subprocess.run(args, stdout=output, stderr=output)
        if result.returncode:
            raise RuntimeError(f'Command failed; see {log}')
        return result
    return subprocess.run(args, capture_output=True, check=True)


def ffmpeg(*args):
    return ['ffmpeg', '-hide_banner', '-loglevel', 'error', *map(str, args)]


def probe(source, count=False):
    args = ['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json']
    if count:
        args += ['-count_frames']
    return json.loads(run([*args, str(source)]).stdout)


def audio(source, start=0, duration=None):
    args = ffmpeg('-ss', start, '-i', source)
    if duration is not None:
        args += ['-t', str(duration)]
    return np.frombuffer(run([*args, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']).stdout, dtype='<f4').copy()


def envelope(samples):
    """10 ms onset envelope: bass attacks plus positive spectral change, not BPM guessing."""
    length, hop, sr = 1024, 160, 16000
    samples = np.pad(samples, (length // 2, length // 2))
    windows = np.lib.stride_tricks.sliding_window_view(samples, length)[::hop]
    spectrum = np.abs(np.fft.rfft(windows * np.hanning(length), axis=1))
    frequencies = np.fft.rfftfreq(length, 1 / sr)
    bass = np.sqrt(np.mean(spectrum[:, (frequencies >= 40) & (frequencies <= 240)] ** 2, axis=1))
    band = np.log1p(spectrum[:, (frequencies >= 80) & (frequencies <= 5000)])
    flux = np.maximum(0, np.diff(band, axis=0, prepend=band[:1])).mean(axis=1)
    attack = np.maximum(0, np.diff(bass, prepend=bass[0]))
    normalize = lambda value: value / max(float(np.percentile(value, 95)), 1e-8)
    strength = 0.6 * normalize(attack) + 0.4 * normalize(flux)
    return np.arange(len(strength)) * hop / sr, np.convolve(strength, [0.2, 0.6, 0.2], 'same'), bass


def pick_start(source, source_duration, duration, finale=False):
    """Audio-based candidate only; the operator inspects generated contact frames."""
    samples = audio(source)
    block = 8000
    padded = np.pad(samples, (0, (-len(samples)) % block))
    energy = np.sqrt(np.mean(padded.reshape(-1, block) ** 2, axis=1))
    count = max(1, round(duration * 2))
    scores = np.convolve(energy, np.ones(count) / count, 'valid')
    latest = max(0, int((source_duration - duration) * 2))
    scores = scores[:latest + 1]
    first = int(len(scores) * 0.55) if finale else 0
    candidates = np.argsort(scores[first:])[::-1] + first
    distinct = []
    for candidate in candidates:
        if all(abs(int(candidate) - item) >= max(2, count // 2) for item in distinct):
            distinct.append(int(candidate))
        if len(distinct) == 3:
            break
    if not distinct:
        raise ValueError(f'No usable audio highlight candidate: {source}')
    return min(distinct[0] / 2, source_duration - duration), [round(v / 2, 2) for v in distinct]


def onset_cue(samples, lo, hi):
    times, strength, bass = envelope(samples)
    indices = np.flatnonzero((times >= lo) & (times <= hi))
    peaks = [int(i) for i in indices if 0 < i < len(strength) - 1 and strength[i] >= strength[i-1] and strength[i] > strength[i+1]]
    if not peaks:
        return lo, 'low', []
    best = max(strength[i] for i in peaks)
    # The earliest clearly pronounced attack near the beginning, rather than the loudest shout.
    eligible = [i for i in peaks if strength[i] >= best * 0.85 and bass[i] >= np.percentile(bass[indices], 25)]
    chosen = eligible[0] if eligible else max(peaks, key=lambda i: strength[i])
    background = max(float(np.median(strength[indices])), 1e-5)
    confidence = 'strong' if strength[chosen] / background >= 2 and best > 0.05 else 'low'
    candidates = sorted(peaks, key=lambda i: strength[i], reverse=True)[:6]
    return float(times[chosen]), confidence, [{'time': round(float(times[i]), 3), 'strength': round(float(strength[i]), 3)} for i in sorted(candidates)]


def make_plan(config_path, output):
    config_path = Path(config_path).expanduser().resolve()
    config = json.loads(config_path.read_text())
    output = Path(output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    if (output / 'edit-plan.json').exists():
        raise ValueError('This output directory already has a plan. Use a new directory or render its existing plan.')
    (output / 'input.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    width, height, fps = (int(config.get(k, d)) for k, d in [('width', 720), ('height', 1280), ('fps', 30)])
    if width < 16 or height < 16 or width % 2 or height % 2 or not 1 <= fps <= 120:
        raise ValueError('Use even positive dimensions and FPS between 1 and 120.')
    subtitles = config.get('subtitles', False)
    if not isinstance(subtitles, bool):
        raise ValueError('subtitles must be true or false.')
    clips = config.get('clips', [])
    if not clips:
        raise ValueError('Supply at least one clip.')
    total = round(float(config.get('duration', 45)) * fps)
    overlap = round(float(config.get('transition_seconds', 2.4)) * fps) if len(clips) > 1 else 0
    if total <= 0 or (len(clips) > 1 and overlap < 2):
        raise ValueError('Duration must be positive; transitions need at least two frames.')
    budget = total + overlap * (len(clips) - 1)
    durations = [round(float(c['duration']) * fps) if 'duration' in c else None for c in clips]
    missing = [i for i, value in enumerate(durations) if value is None]
    remaining = budget - sum(v for v in durations if v is not None)
    for j, i in enumerate(missing):
        durations[i] = remaining // len(missing) + (1 if j < remaining % len(missing) else 0)
    if sum(durations) != budget:
        raise ValueError('Clip durations minus transition overlaps must equal the requested total duration.')
    plan = {'version': 1, 'subtitles': subtitles, 'width': width, 'height': height, 'fps': fps, 'frames': total, 'duration': total / fps,
            'transitionFrames': overlap, 'settings': {'width': 1, 'coreWidth': 1, 'intensity': 1.15} | config.get('flame', {}),
            'titleSettings': {'eyebrow': '', 'wear': 0.42, 'signal': 0.3, 'speed': 1, 'size': 1.35} | config.get('title', {}),
            'clips': [], 'cues': []}
    work = output / 'work'
    work.mkdir(exist_ok=True)
    timeline = 0
    for index, (entry, frames) in enumerate(zip(clips, durations)):
        if frames <= overlap * (1 if index in (0, len(clips)-1) else 2):
            raise ValueError('Each clip needs visible footage beyond its transition overlaps.')
        source = Path(entry['source']).expanduser()
        if not source.is_absolute():
            source = config_path.parent / source
        source = source.resolve(strict=True)
        info = probe(source)
        if not any(s['codec_type'] == 'video' for s in info['streams']) or not any(s['codec_type'] == 'audio' for s in info['streams']):
            raise ValueError(f'Video and audio streams are required: {source}')
        duration = frames / fps
        source_duration = float(info['format']['duration'])
        if source_duration + 1 / fps < duration:
            raise ValueError(f'Clip too short for allocated duration: {source}')
        song = str(entry.get('song', '')).strip()
        if subtitles and not song:
            raise ValueError(f'Supply a verified song title for {source.name}; filenames alone are not reliable.')
        candidates = []
        if 'start' in entry:
            start = float(entry['start'])
        else:
            start, candidates = pick_start(source, source_duration, duration, entry.get('role') == 'finale')
        start = round(start * fps) / fps
        if start < 0 or start + duration > source_duration + 1 / fps:
            raise ValueError(f'Trim is outside source duration: {source}')
        clip = {'slot': index + 1, 'source': str(source), 'song': song, 'start': start, 'frames': frames,
                'duration': duration, 'timeline_start': timeline / fps, 'normalized': str(work / f'clip-{index+1}.mkv'),
                'start_candidates': candidates, 'selection': 'manual' if 'start' in entry else 'audio_candidate'}
        title = None
        if subtitles:
            samples = audio(source, start, duration)
            # Incoming footage is fully visible after the overlap; use its first clear musical attack.
            lo = (overlap / fps if index else 0) + 0.18
            title_frames = round(float(config.get('title_seconds', 1.5)) * fps)
            if title_frames < 2:
                raise ValueError('Titles need at least two frames.')
            latest = duration - (overlap / fps if index < len(clips)-1 else 0) - title_frames / fps
            hi = min(lo + 3, latest)
            if hi <= lo:
                raise ValueError('Not enough clear footage for an opening title. Reduce transition/title duration.')
            if 'title_at' in entry:
                cue, confidence, choices = float(entry['title_at']), 'manual', []
            else:
                cue, confidence, choices = onset_cue(samples, lo, hi)
            cue_frame = round(cue * fps)
            if cue_frame < 0 or cue_frame + title_frames > frames:
                raise ValueError('title_at must keep the entire title inside its source clip.')
            title = {'clip': index + 1, 'song': song, 'text': entry.get('display', song), 'frame': timeline + cue_frame,
                     'frames': title_frames, 'time': (timeline + cue_frame) / fps, 'source_time': start + cue_frame / fps,
                     'clip_time': cue_frame / fps, 'confidence': confidence, 'candidates': choices}
        plan['clips'].append(clip)
        if title:
            plan['cues'].append(title)
        # Frames for visual inspection are real source images, never substitutes for the output.
        previews = [('start', 0.1), ('middle', duration / 2), ('end', duration - 0.2)]
        if title:
            previews.append(('title', cue_frame / fps))
        for label, offset in previews:
            run(ffmpeg('-ss', start + offset, '-i', source, '-frames:v', 1, '-vf', 'scale=270:-2', '-y', output / f'clip-{index+1}-{label}.jpg'))
        if title:
            run(ffmpeg('-ss', max(start, title['source_time']-0.5), '-i', source, '-t', 2.5, '-vn', '-c:a', 'pcm_s16le', '-y', output / f'cue-{index+1}.wav'))
        timeline += frames - overlap
        emit({'planned': song or source.name, 'source_start': start, 'subtitles': subtitles} | ({'title_time': title['time'], 'onset_confidence': confidence} if title else {}))
    target = output / 'edit-plan.json'
    target.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    emit({'plan': str(target), 'duration': plan['duration'], 'review': 'Inspect contact frames.' + (' Review cue audio; edit cue.frame for a manual timing correction.' if subtitles else '')})
    return target


def prepare_clip(clip, plan, work):
    prefix = ['ffmpeg', '-hide_banner', '-ss', str(clip['start']), '-t', str(clip['duration']), '-i', clip['source']]
    measure = run([*prefix, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    stderr = measure.stderr.decode(errors='replace')
    loudness = json.JSONDecoder().raw_decode(stderr[stderr.rfind('{'):])[0]
    integrated, peak = float(loudness['input_i']), float(loudness['input_tp'])
    gain = min(-16-integrated, -1.5-peak) if math.isfinite(integrated) and math.isfinite(peak) else 0
    width, height, fps = plan['width'], plan['height'], plan['fps']
    vf = f"fps={fps},trim=end_frame={clip['frames']},setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1"
    af = f"aresample=48000,volume={gain:.3f}dB,apad,atrim=duration={clip['duration']},asetpts=PTS-STARTPTS"
    run([*prefix, '-map', '0:v:0', '-map', '0:a:0', '-vf', vf, '-af', af, '-frames:v', str(clip['frames']), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv420p', '-threads', '4', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-y', clip['normalized']], work / f"prepare-{clip['slot']}.log")
    (work / f"loudness-{clip['slot']}.json").write_text(json.dumps(loudness | {'appliedGainDb': gain}, indent=2))
    emit({'normalized': clip['slot'], 'gainDb': round(gain, 3)})


def render(plan_path, overwrite=False):
    plan_path = Path(plan_path).expanduser().resolve()
    root = plan_path.parent
    plan = json.loads(plan_path.read_text())
    output = root / 'concert-highlights.mp4'
    if output.exists() and not overwrite:
        raise ValueError('Output already exists. Use --overwrite only to replace this generated edit.')
    width, height, fps, overlap = (plan[k] for k in ['width', 'height', 'fps', 'transitionFrames'])
    if not (SKILL / 'node_modules/playwright').exists():
        raise ValueError('Run scripts/setup.sh before rendering.')
    work = root / 'work'
    work.mkdir(exist_ok=True)
    clips = plan['clips']
    expected = sum(c['frames'] for c in clips) - overlap * (len(clips)-1)
    if expected != plan['frames']:
        raise ValueError('Edited plan duration no longer matches clip overlaps.')
    # Preserve existing explicit cue plans, while newly generated plans default to no titles.
    plan['subtitles'] = plan.get('subtitles', bool(plan.get('cues')))
    if not plan['subtitles']:
        plan['cues'] = []
    elif len(plan['cues']) != len(clips) or sorted(c['clip'] for c in plan['cues']) != list(range(1, len(clips)+1)):
        raise ValueError('With subtitles enabled, use exactly one title cue per clip.')
    for cue in plan['cues']:
        if not 0 <= cue['frame'] < cue['frame'] + cue['frames'] <= expected:
            raise ValueError('Subtitle is outside output duration.')
        clip = clips[cue['clip']-1]
        cue['time'] = cue['frame'] / fps
        cue['clip_time'] = cue['time'] - clip['timeline_start']
        cue['source_time'] = clip['start'] + cue['clip_time']
        if cue['clip_time'] < 0 or cue['clip_time'] + cue['frames']/fps > clip['duration'] + 1e-6:
            raise ValueError('Title cue must stay inside its corresponding clip.')
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, len(clips))) as pool:
        list(pool.map(lambda c: prepare_clip(c, plan, work), clips))
    subprocess.run(['node', str(SKILL / 'scripts/render-effects.cjs'), str(plan_path)], check=True)
    inputs = [c['normalized'] for c in clips]
    transition_base = len(inputs)
    inputs += [str(work / f'transition-{i+1}.mkv') for i in range(len(clips)-1)]
    title_base = len(inputs)
    inputs += [str(work / f'title-{i+1}.mov') for i in range(len(plan['cues']))]
    filters, parts = [], []
    for i, clip in enumerate(clips):
        first = overlap if i else 0
        last = clip['frames'] - (overlap if i < len(clips)-1 else 0)
        filters.append(f'[{i}:v]trim=start_frame={first}:end_frame={last},setpts=PTS-STARTPTS[p{i}]')
        parts.append(f'[p{i}]')
        if i < len(clips)-1:
            filters.append(f'[{transition_base+i}:v]setpts=PTS-STARTPTS[t{i}]')
            parts.append(f'[t{i}]')
    filters.append(''.join(parts) + f'concat=n={len(parts)}:v=1:a=0[base]')
    current = 'base'
    for i, cue in enumerate(plan['cues']):
        filters.append(f'[{title_base+i}:v]format=rgba,setpts=PTS-STARTPTS+{cue["frame"]}/{fps}/TB[title{i}]')
        filters.append(f'[{current}][title{i}]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[v{i}]')
        current = f'v{i}'
    duration = expected / fps
    filters.append(f'[{current}]fade=t=in:st=0:d=0.15,fade=t=out:st={duration-0.6}:d=0.6,format=yuv420p[v]')
    for i, clip in enumerate(clips):
        filters.append(f'[{i}:a]apad,atrim=duration={clip["duration"]},asetpts=PTS-STARTPTS[a{i}]')
    current = 'a0'
    for i in range(1, len(clips)):
        filters.append(f'[{current}][a{i}]acrossfade=d={overlap/fps}:c1=qsin:c2=qsin[mix{i}]')
        current = f'mix{i}'
    filters.append(f'[{current}]afade=t=in:st=0:d=0.1,afade=t=out:st={duration-0.8}:d=0.8,alimiter=limit=0.891251:level=false:latency=true,atrim=duration={duration}[a]')
    (work / 'final-filter.txt').write_text(';\n'.join(filters))
    command = ffmpeg()
    for source in inputs:
        command += ['-i', source]
    command += ['-filter_complex_threads', '2', '-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-threads', '6', '-r', str(fps), '-fps_mode', 'cfr', '-frames:v', str(expected), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-t', str(duration), '-y' if overwrite else '-n', str(output)]
    run(command, work / 'final-encode.log')
    info = probe(output, count=True)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    sound = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    if (int(video['width']), int(video['height']), int(video['nb_read_frames'])) != (width, height, expected):
        raise RuntimeError('Encoded dimensions or frame count do not match the plan.')
    if abs(float(info['format']['duration'])-duration) > 1/fps or int(sound['sample_rate']) != 48000:
        raise RuntimeError('Encoded duration or audio format differs from the plan.')
    run(ffmpeg('-i', output, '-f', 'null', '-'), work / 'decode-check.log')
    report = {'output': str(output), 'bytes': output.stat().st_size, 'duration': duration, 'frames': expected, 'width': width, 'height': height, 'fps': fps, 'audio': 'AAC 48 kHz stereo', 'subtitles': plan['subtitles'], 'titles': [{'song': c['song'], 'time': c['frame']/fps, 'duration': c['frames']/fps, 'source_time': c['source_time'], 'confidence': c['confidence']} for c in plan['cues']], 'decode_check': 'passed'}
    (root / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    for i, cue in enumerate(plan['cues']):
        run(ffmpeg('-ss', (cue['frame']+min(8, cue['frames']-1))/fps, '-i', output, '-frames:v', 1, '-y', root / f'title-{i+1}-preview.png'))
    emit(report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ['plan', 'all']:
        option = sub.add_parser(command)
        option.add_argument('config')
        option.add_argument('--output', default=str(Path.home() / 'Movies' / ('Concert-Highlights-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))))
    option = sub.add_parser('render')
    option.add_argument('plan')
    option.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    for binary in ['ffmpeg', 'ffprobe', 'node']:
        if not shutil.which(binary):
            raise ValueError(f'Missing executable: {binary}')
    if args.command == 'render':
        render(args.plan, args.overwrite)
    else:
        plan = make_plan(args.config, args.output)
        if args.command == 'all':
            render(plan)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
