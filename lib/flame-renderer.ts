import { fragmentShader, vertexShader } from "./flame-shaders";

export type FlameSettings = { duration: number; width: number; intensity: number };

export class FlameRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private textures: WebGLTexture[] = [];
  private sizes: [number, number][] = [];
  private locations: Record<string, WebGLUniformLocation | null> = {};
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: "high-performance", preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("当前浏览器无法启动 WebGL，请开启硬件加速后重试。");
    this.gl = gl;

    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("无法创建着色器。");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const detail = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        shaders.forEach((item) => gl.deleteShader(item));
        throw new Error(`火焰着色器编译失败：${detail}`);
      }
      shaders.push(shader);
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    if (!program) throw new Error("无法创建 WebGL 程序。");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const detail = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`火焰程序链接失败：${detail}`);
    }
    this.program = program;
    const buffer = gl.createBuffer();
    if (!buffer) { gl.deleteProgram(program); throw new Error("无法创建画布缓冲。"); }
    this.buffer = buffer;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uFrom", "uTo", "uFromSize", "uToSize", "uResolution", "uProgress", "uTime", "uWidth", "uIntensity"]) {
      this.locations[name] = gl.getUniformLocation(program, name);
    }
  }

  async load(urls: [string, string]) {
    const images = await Promise.all(urls.map((url) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("图片加载失败，请刷新重试。"));
      image.src = url;
    })));
    if (this.disposed) return;
    const gl = this.gl;
    for (const image of images) {
      const texture = gl.createTexture();
      if (!texture) throw new Error("无法载入图片纹理。");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      this.textures.push(texture);
      this.sizes.push([image.naturalWidth, image.naturalHeight]);
    }
  }

  render(progress: number, time: number, settings: FlameSettings, reversed = false) {
    if (this.disposed || this.textures.length !== 2) return;
    const gl = this.gl;
    // Cap physical pixels to keep the turbulent fragment shader responsive on retina.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    const from = reversed ? 1 : 0;
    const to = reversed ? 0 : 1;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[from]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[to]);
    gl.uniform1i(this.locations.uFrom, 0);
    gl.uniform1i(this.locations.uTo, 1);
    gl.uniform2f(this.locations.uFromSize, ...this.sizes[from]);
    gl.uniform2f(this.locations.uToSize, ...this.sizes[to]);
    gl.uniform2f(this.locations.uResolution, width, height);
    gl.uniform1f(this.locations.uProgress, progress);
    gl.uniform1f(this.locations.uTime, time);
    gl.uniform1f(this.locations.uWidth, settings.width);
    gl.uniform1f(this.locations.uIntensity, settings.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose() {
    this.disposed = true;
    this.textures.forEach((texture) => this.gl.deleteTexture(texture));
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}
