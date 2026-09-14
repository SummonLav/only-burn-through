const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const skill = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.resolve(process.argv[2])));
const root = path.join(path.dirname(path.resolve(process.argv[2])), 'work');
const { vertex, fragment } = JSON.parse(fs.readFileSync(path.join(skill, 'assets/flame-shaders.json')));
const { width, height, fps, transitionFrames: count } = plan;
const frameBytes = width * height * 4;
let active;

const html = `<!doctype html><meta charset="utf-8"><canvas width="${width}" height="${height}"></canvas><script>
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
if (!gl) throw new Error('WebGL unavailable');
function compile(type, source) {
 const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
 if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
 return shader;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, ${JSON.stringify(vertex)}));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, ${JSON.stringify(fragment)}));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
gl.viewport(0,0,${width},${height});
const locations = {};
for (const name of ['uFrom','uTo','uFromSize','uToSize','uResolution','uProgress','uTime','uWidth','uCoreWidth','uIntensity']) locations[name] = gl.getUniformLocation(program,name);
gl.uniform1i(locations.uFrom,0); gl.uniform1i(locations.uTo,1);
for(const name of ['uFromSize','uToSize','uResolution']) gl.uniform2f(locations[name],${width},${height});
gl.uniform1f(locations.uWidth,${plan.settings.width});
gl.uniform1f(locations.uCoreWidth,${plan.settings.coreWidth});
gl.uniform1f(locations.uIntensity,${plan.settings.intensity});
const textures = [0,1].map(i => {
 const t=gl.createTexture(); gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); return t;
});
const pixels=new Uint8Array(${frameBytes});
window.renderFrame = async (frame) => {
 const data=await Promise.all(['a','b'].map(side=>fetch('/frame?side='+side+'&frame='+frame).then(r=>{if(!r.ok)throw new Error('Frame fetch failed');return r.arrayBuffer();})));
 data.forEach((bytes,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,${width},${height},0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(bytes));});
 gl.uniform1f(locations.uProgress,frame/${count - 1}); gl.uniform1f(locations.uTime,frame/${fps});
 gl.drawArrays(gl.TRIANGLES,0,6); gl.readPixels(0,0,${width},${height},gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL render failed');
 const response=await fetch('/output?frame='+frame,{method:'POST',body:pixels});
 if(!response.ok)throw new Error('Output write failed');
 return {frame, progress:frame/${count - 1}};
};
window.ready=true;
</script>`;

function run(args, logPath) {
 const log=fs.openSync(logPath,'w');
 try {const result=spawnSync('ffmpeg',args,{stdio:['ignore','ignore',log]});if(result.status!==0)throw new Error('FFmpeg failed: '+logPath);}
 finally {fs.closeSync(log);}
}

const server = http.createServer(async (req,res) => {
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/titles') {
   res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(path.join(skill,'assets/title-stage.html')));
  } else if(['/assets/stencil-glyphs.js','/assets/distressed-title-renderer.js'].includes(url.pathname)) {
   res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(path.join(skill,url.pathname.slice(1))));
  } else if(url.pathname==='/frame') {
   const frame=Number(url.searchParams.get('frame'));const side=url.searchParams.get('side');
   if(!active || !['a','b'].includes(side) || !Number.isInteger(frame) || frame<0 || frame>=count)throw new Error('Invalid frame');
   const bytes=Buffer.allocUnsafe(frameBytes);const got=fs.readSync(active[side],bytes,0,frameBytes,frame*frameBytes);
   if(got!==frameBytes)throw new Error('Incomplete source frame');
   res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':frameBytes});res.end(bytes);
  } else if(url.pathname==='/output') {
   const chunks=[]; for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
   if(bytes.length!==frameBytes || Number(url.searchParams.get('frame'))!==active.written)throw new Error('Invalid output frame');
   await new Promise((resolve,reject)=>active.encoder.stdin.write(bytes,e=>e?reject(e):resolve()));active.written++;
   res.writeHead(200);res.end('ok');
  } else {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}
 } catch(error){console.error(error);res.writeHead(500);res.end(error.message);}
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({...(process.env.CONCERT_BROWSER==='chromium'?{}:{channel:'chrome'}),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>console.error('Browser error:',e));
  await page.goto('http://127.0.0.1:'+server.address().port); await page.waitForFunction(()=>window.ready);
  for(let index=0;index<plan.clips.length-1;index++) {
   const from=plan.clips[index],to=plan.clips[index+1];
   const rawPaths=['a','b'].map(side=>path.join(root,`transition-${index+1}-${side}.rgba`));
   for(const [side,clip,start] of [[0,from,(from.frames-count)/fps],[1,to,0]]) {
    run(['-hide_banner','-loglevel','error','-ss',String(start),'-i',clip.normalized,'-an','-vf',`trim=end_frame=${count},scale=in_color_matrix=bt709:out_range=full,vflip`,'-frames:v',String(count),'-pix_fmt','rgba','-f','rawvideo','-y',rawPaths[side]],path.join(root,`extract-${index+1}-${side}.log`));
    if(fs.statSync(rawPaths[side]).size!==frameBytes*count)throw new Error('Wrong source frame count');
   }
   const output=path.join(root,`transition-${index+1}.mkv`);
   const log=fs.openSync(path.join(root,`render-${index+1}.log`),'w');
   const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-vf','vflip,scale=in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p','-c:v','ffv1','-level','3','-threads','4','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-y',output],{stdio:['pipe','ignore',log]});
   const finished=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error('Encode failed '+code)));});
   active={a:fs.openSync(rawPaths[0],'r'),b:fs.openSync(rawPaths[1],'r'),encoder,written:0};
   for(let frame=0;frame<count;frame++) {
    await page.evaluate(frame=>window.renderFrame(frame),frame);
    if(frame%18===0 || frame===count-1)console.log(JSON.stringify({transition:index+1,frame:frame+1,total:count}));
   }
   encoder.stdin.end();await finished;fs.closeSync(log);fs.closeSync(active.a);fs.closeSync(active.b);active=null;
   for(const raw of rawPaths) fs.unlinkSync(raw);
   console.log('Rendered '+output);
  }

  if(plan.cues.length){
   await page.goto('http://127.0.0.1:'+server.address().port+'/titles');
   await page.waitForFunction(()=>window.ready);
  }
  for(let i=0;i<plan.cues.length;i++){
   const cue=plan.cues[i];
   const frames=path.join(root,`title-${i+1}-frames`);fs.mkdirSync(frames,{recursive:true});
   for(let frame=0;frame<cue.frames;frame++){
    const png=await page.evaluate(args=>window.renderTitle(args),{frame,frames:cue.frames,fps,width,height,settings:{...plan.titleSettings,text:cue.text}});
    fs.writeFileSync(path.join(frames,`${String(frame).padStart(5,'0')}.png`),Buffer.from(png,'base64'));
   }
   run(['-hide_banner','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%05d.png'),'-frames:v',String(cue.frames),'-c:v','qtrle','-pix_fmt','argb','-threads','2','-y',path.join(root,`title-${i+1}.mov`)],path.join(root,`title-${i+1}-encode.log`));
   console.log(JSON.stringify({title:cue.song,frames:cue.frames,time:cue.frame/fps}));
   fs.rmSync(frames,{recursive:true});
  }
 }finally {if(active?.encoder) active.encoder.kill();await browser.close();server.close();}

})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
