# The Weeknd Concert Transition

Next.js + TypeScript + 原生 WebGL 的图片过场实验。两张用户提供的原图已经放在 `public/images/`。

## Templates

### 纯字幕

6 秒 · 红色磨损字形与动态擦除。

https://github.com/user-attachments/assets/369d4c6f-e119-482d-adf6-df0ecbbdd9f9

### 带字幕

45 秒 · 火焰转场，每首开头的重音显示歌名。

https://github.com/user-attachments/assets/a184b2df-3938-49c5-a301-4005ed6353c4

### 不带字幕（默认）

45 秒 · 保留现场原声，火焰转场，烟花收尾。

https://github.com/user-attachments/assets/05bc28b8-9e71-43b9-bded-33a23b5897cf

## 运行

```bash
cd /Users/lavendashan/Desktop/theweeknd-concert-transition
npm install
npm run dev
```

打开 http://localhost:3017 。项目默认使用 3017 端口。

## 演唱会剪辑 Skill

[theweeknd-highlights](skills/theweeknd-highlights/SKILL.md) 将现场视频剪成高光成片，默认 **45 秒、720×1280、30 fps、火焰转场，不加字幕**。只有明确要求时才添加重音歌名。

Skill 内置渲染资产，可独立于网页运行。将整个 `skills/theweeknd-highlights` 目录复制到 `~/.codex/skills/`（自定义 `CODEX_HOME` 时使用其 `skills/` 目录），即可通过 `$theweeknd-highlights` 使用。依赖安装、配置和导出命令见 Skill 说明；[示例配置](skills/theweeknd-highlights/references/the-weeknd-example.json) 仅引用本地视频路径，使用时按素材位置修改。

## 红字字体实验

打开 `/typography` 预览参考 MV 的红色模板字幕。字母、数字与常用标点采用项目内绘制的矢量字形；其他文字使用系统粗体回退。红色 `#F20808` 由提供的 Display P3 参考转换为 sRGB，字内叠加动态透明擦除、黑白划痕和轻微扫描线错位。

- 支持修改镂空小字、多行主标题，调整字号、磨损量、信号强度和速度。
- 可切换纯黑、现场和透明背景，对照参考图，暂停、拖动时间或前进一帧。
- 导出透明 PNG 只包含当前帧的文字效果。减少动态效果偏好下默认暂停。
- `lib/distressed-title-renderer.ts` 的 `render(time, settings)` 是确定性的透明图层渲染入口，便于后续接入视频逐帧合成；GSAP 负责交互预览的时钟。
- 网页用于预览与调参；视频剪辑、重音检测和可选字幕合成由 `theweeknd-highlights` Skill 完成。

```bash
npm run typecheck
npm run build
npm start
```

`npm start` 用于运行构建后的生产版本；请先停止占用同一端口的开发服务器。

## 操作

- 首次加载后自动播放一次；系统启用“减少动态效果”时等待手动播放。
- 播放／暂停：按钮或空格。重播：右侧重播按钮或 `R`。
- 拖动“转场进度”可逐段查看并暂停火焰。点击图片缩略图可查看对应端点。
- 时长、火焰宽度、焰心宽度和辉光强度实时生效。“焰心宽度”单独调节最亮白色条带的粗细（20%–300%）。“重置”恢复四个参数的默认值。
- “交换”切换图片先后顺序；火焰始终从底部向顶部运动。
- “循环播放”在每次完成后停留 1.3 秒，再交换前后图进行下一次过场。
- 预览右下角进入全屏，支持桌面和移动端布局。

## 效果实现

- 单次 WebGL 绘制同时采样两张图片，用同一条扰动边界完成遮罩与火焰渲染。
- `1 - (1 - progress)^2.4` 提供快速起势、顶部缓慢减速的运动曲线。末尾逐渐消隐，端点直接输出原图。
- 多层分形噪声、域扭曲和向上平移的噪声产生不规则火焰带，叠加红色外焰、金黄火身、黄白焰心、局部热折射与稀疏余烬。
- 图片采用 contain 适配，完整保留原图比例与人物；两张图比例不同，边缘会出现黑色留白。
- 暂停或结束后停止动画帧循环；切到后台不推进时间。设备像素比上限为 1.6，减少高分辨率屏幕的着色开销。
- 纹理、缓冲区、程序、监听器及计时器随组件销毁清理；WebGL 上下文恢复后重新创建渲染器。

## 主要文件

- `components/flame-studio.tsx`：交互、播放状态与页面。
- `lib/flame-renderer.ts`：WebGL 初始化、原图纹理、尺寸适配与资源清理。
- `lib/flame-shaders.ts`：火焰、混合遮罩、颜色、热扰动与运动曲线。
- `app/globals.css`：响应式界面。

素材为本次提供的原图。私有源码仓库：[SummonLav/theweeknd-concert-transition](https://github.com/SummonLav/theweeknd-concert-transition)。
