---
name: theweeknd-highlights
description: 把用户提供的演唱会现场视频剪成高光成片，默认 45 秒竖屏，使用火焰转场，默认不加字幕；用户明确要求时可添加重音歌名。适用于多段演唱会素材的剪辑与卡点歌名；不用于普通对白字幕转写。
---

# The Weeknd Highlights

将本地演唱会视频做成可直接播放的 MP4。首次使用先读本文；需要改配置或时间轴时再读 [配置说明](references/configuration.md)。

## 默认成片

- 45 秒，720×1280，30 fps；用户指定的时长、比例和顺序优先。
- 保留现场原声，按各段响度施加固定增益，转场音频交叉淡化。
- 相邻片段使用内置 WebGL 火焰转场，默认 2.4 秒。视频在转场中继续运动。
- 默认不加字幕，配置省略 `subtitles` 或设置为 `false`。只有用户明确要求字幕或歌名时，才设置 `subtitles: true`。提供歌名、`display` 或 `title_at` 本身不会开启字幕。
- 开启字幕时，每首仅在所选片段开头的一个明显音乐重音显示一次歌名，持续 1.5 秒。优先选择入场火焰结束后紧接着的重音，避免字幕被遮挡；用户给定时间点优先。
- 可选字幕样式：红色 `#F20808`，居中粗重模板字形，动态黑白磨损、透明擦除与轻微信号错位；轻微黑色阴影帮助红色舞台背景上的辨认。没有滚动歌词。超长歌名可主动换行；拉丁字母使用内置矢量字形，其他字符回退到系统粗体。
- 用户要求烟花收尾时，将对应素材放到最后。片段顺序和歌曲名称来自用户或已核实上下文；不要用音量分析猜歌名。

## 工作方式

1. 读取用户的素材路径。默认自动选片并完成无字幕导出；不必询问歌名。只有本次明确要求添加字幕时，才核实歌名、分析重音。现有指令已明确的内容直接沿用，只询问影响成片的未知信息，不设例行审批环节。
2. 创建本次 JSON 配置与独立输出目录。视频通过路径引用，不复制进 skill。当前用户的三段素材已有 [The Weeknd 配置](references/the-weeknd-example.json)：THE HILLS → DIE FOR YOU → STARBOY，烟花收尾。只有继续这组三段素材时才使用它；新视频应创建新配置。
3. 安装一次运行依赖。令 `SKILL_DIR` 指向本 skill 所在目录，使用完整路径调用脚本：

   ```bash
   bash "$SKILL_DIR/scripts/setup.sh"
   python3 "$SKILL_DIR/scripts/concert_edit.py" plan /absolute/path/edit.json --output /absolute/path/new-output
   ```

   需要系统已有 Python 3、Node.js、FFmpeg、FFprobe 和 Chrome。setup 只在 skill 内安装 NumPy 与 Playwright。无 Chrome 时，可安装 Playwright Chromium 并设置 `CONCERT_BROWSER=chromium`，见配置说明。渲染资产已内置，无需运行 Next.js 或访问原仓库。
4. 检查生成的 `edit-plan.json` 与各段开头、中间、结尾的预览图。自动选片只基于音频能量，是候选位置；结合真实画面检查是否包含可用高光。仅开启字幕时，额外检查字幕入点预览与 `cue-*.wav`：重音检测结合低频起音和频谱变化，不保证等于乐理上的强拍；`confidence: low` 时重点复核或调整。不要把欢呼、爆音或剪切起点当作可靠音乐重音。
5. 如需更改选片起点，修改原配置并重新生成新计划；开启字幕后如仅改歌名出现时间，直接修改计划中 `cues[].frame`（输出时间轴绝对帧）。开启字幕时每首维持一个 cue；关闭时 `cues` 为空。为每段保留足够的转场外画面。
6. 用计划导出：

   ```bash
   python3 "$SKILL_DIR/scripts/concert_edit.py" render /absolute/path/new-output/edit-plan.json
   ```

   明确希望一步运行且素材起点已经核实时，可用 `all` 代替 `plan`。已有成片默认不会覆盖；用户要重做当前导出时才使用 `render --overwrite`。修改后的 cue 不应在渲染时重新自动检测。
7. 确认 `validation.json` 检查通过；查看转场前中后与最终画面，检查片段先后、比例、声音衔接和解码情况。默认确认报告中 `subtitles: false`、`titles: []`，且没有额外文字叠加。只有开启字幕时才检查各歌名预览、拼写、字形大小和进出时间。脚本成功只代表技术导出，仍需视觉检查；没有实际听到音频时不要声称已经听验。
8. 直接交付 `concert-highlights.mp4` 的本地媒体预览与绝对路径链接，简述时长、分辨率与必要限制。需要复用时提供配置或 skill 路径。验证后可清理本次 `work/` 的大体积中间文件，保留成片、配置、计划和验证报告。

## 维护范围

主要脚本为 `scripts/concert_edit.py`（选片、重音、音视频合成）和 `scripts/render-effects.cjs`（逐帧火焰与透明字幕）。渲染器来源版本记录在 `assets/source.json`；更新样式时只替换相关资产并跑短样片，再检查实际成片。所有时间由帧号决定，预览与导出不依赖实时录屏速度。
