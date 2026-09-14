# 配置与时间点

最小配置：

```json
{
  "clips": [
    {"source": "/absolute/path/song-a.mp4"},
    {"source": "/absolute/path/song-b.mp4", "role": "finale"}
  ]
}
```

路径支持 `~`；相对路径基于配置文件所在目录。默认不加字幕，`song` 可省略。只有用户要求字幕时设置 `subtitles: true`，此时每段需提供已核实的 `song`。只提供歌名不会自动开启字幕。默认自动提出高光起点；需精确控制时提供 `start`（原视频秒数）。`role: finale` 只让自动选片偏向素材后半段，不改变输入顺序。

可选顶层字段：

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| duration | 45 | 成片总秒数，量化到整数帧 |
| width / height | 720 / 1280 | 偶数输出尺寸，等比适配并留黑边，不拉伸 |
| fps | 30 | 输出帧率 |
| transition_seconds | 2.4 | 相邻素材重叠时长 |
| subtitles | false | 是否添加字幕，只有明确要求时开启 |
| title_seconds | 1.5 | 每首歌名显示时长 |
| flame | width=1, coreWidth=1, intensity=1.15 | 火焰外带、亮芯和辉光 |
| title | wear=.42, signal=.3, speed=1, size=1.35 | 磨损、老电视错位、纹理速度、字形尺寸 |

片段可选字段：

- `duration`：该片段包括转场重叠在内的时长。未指定的时长自动平分剩余预算。总时长 = 各段时长之和 − 所有转场重叠时长。例如 16 + 16.8 + 17 − 2.4 × 2 = 45。
- `display`：显示用歌名，支持 `\n` 换行；默认使用 `song`。
- `title_at`：相对于此片段裁剪起点的秒数，覆盖自动重音检测。

仅开启字幕时检测重音。自动检测窗口在第一段的 0.18–3.18 秒；后续段位于入场重叠结束后的 0.18–3.18 秒，并受可用画面长度约束。检测结果只用于歌名入点，不改变视频速度。

`edit-plan.json` 记录来源、选片起点、帧数、全局时间与音频起音候选。渲染时 `cues[].frame` 是唯一实际入点；`time`、`source_time` 和 `clip_time` 是便读信息，渲染时会根据 frame 自动回填。

默认计划输出每段的开头、中段、结尾三张预览与 JSON 时间轴，`cues` 为空。渲染生成 `concert-highlights.mp4`、`validation.json` 和 `work/` 中间文件。开启字幕才额外生成字幕入点预览、重音附近 WAV 和 `title-*-preview.png`。旧计划已有明确 cue 且没有 subtitles 字段时，保留其原字幕；要移除则设置 `subtitles: false`，渲染时清空 cues。输出目录应是本次任务独立目录；原视频不会被覆盖。

运行时浏览器默认使用 Chrome。没有 Chrome 时在 skill 目录执行：

```bash
./node_modules/.bin/playwright install chromium
CONCERT_BROWSER=chromium python3 scripts/concert_edit.py render /absolute/path/output/edit-plan.json
```

## 能力边界

- 音频高光评分偏重现场能量，不能单凭算法确认唱到哪一句或烟花画面是否最好。使用生成的预览复核。
- 低频攻击与频谱变化是音乐重音的近似；嘈杂现场可以给 `title_at` 或直接修正 cue.frame。
- 开启字幕时，每个输入片段对应一首歌和一个歌名 cue；多首歌混在一个视频时先按歌曲拆分为多个配置条目（可以引用同一源文件、不同 start）。
- 不下载原唱覆盖现场声，不默认接入付费音乐识别服务。
