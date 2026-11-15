import { cameraBasis, cameraPose, projectPoint, type Vec3 } from './fieldCamera';

// One static mesh / one draw call. No models, libraries, textures or network requests.
// This miniature is illustrative, not a reconstruction of the farmer's terrain.
const VERTEX = `
attribute vec3 aPosition; attribute vec3 aColor;
uniform vec3 uEye; uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uForward;
uniform float uAspect;
varying vec3 vColor;
void main(){
 vec3 p=aPosition-uEye;
 float z=dot(p,uForward);
 gl_Position=vec4(dot(p,uRight)*3.7320508/uAspect,dot(p,uUp)*3.7320508,1.002002*z-.2002002,z);
 vColor=aColor;
}`;
const FRAGMENT = `precision mediump float; varying vec3 vColor; void main(){gl_FragColor=vec4(vColor,1.);}`;

type Color = [number,number,number];
function buildField(detailed = true) {
  const mesh: number[]=[];
  function triangle(a:Vec3,b:Vec3,c:Vec3,color:Color) { for(const p of [a,b,c]) mesh.push(...p,...color); }
  function quad(a:Vec3,b:Vec3,c:Vec3,d:Vec3,color:Color) {triangle(a,b,c,color);triangle(a,c,d,color);}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:Color) {
    const c=(s:number)=>color.map(v=>v*s) as Color;
    quad([x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d],color);
    quad([x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],c(.68));
    quad([x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d],c(.8));
    quad([x,y,z],[x,y,z+d],[x,y+h,z+d],[x,y+h,z],c(.9));
    quad([x+w,y,z],[x+w,y,z+d],[x+w,y+h,z+d],[x+w,y+h,z],c(.58));
  }
  box(-3.1,-.36,-3.1,6.2,.34,6.2,[.49,.38,.25]);
  // Separate furrows and small plants make the dolly visibly spatial.
  for(let r=0;r<10;r++) for(let c=0;c<10;c++) {
    const x=-3+c*.6+.025,z=-3+r*.6+.025;
    const variation=((r*13+c*7)%11)/100;
    box(x,-.02,z,.55,.055,.55,[.49+variation,.57+variation,.31+variation]);
    const rows=detailed?3:2, plants=detailed?4:3;
    for(let row=0;row<rows;row++) {
      if(detailed)box(x+.055,.036,z+.07+row*.165,.44,.012,.033,[.38,.32,.2]);
      for(let plant=0;plant<plants;plant++) {
        const px=x+.075+plant*(detailed?.127:.18),pz=z+.09+row*(detailed?.165:.3);
        const h=.2+((r*17+c*11+plant*3+row)%9)*.012;
        if(detailed)box(px-.006,.045,pz-.006,.012,h,.012,[.26,.39,.14]);
        for(let leaf=0;leaf<(detailed?3:2);leaf++) {
          const angle=leaf*Math.PI*2/3+(r+c)*.35;
          const dx=Math.cos(angle)*.069,dz=Math.sin(angle)*.069;
          const ax=-Math.sin(angle)*.022,az=Math.cos(angle)*.022;
          const root:Vec3=[px,.05+h*.3,pz],tip:Vec3=[px+dx*1.35,.05+h*.66,pz+dz*1.35];
          const left:Vec3=[px+dx*.6+ax,.05+h,pz+dz*.6+az];
          const right:Vec3=[px+dx*.6-ax,.05+h,pz+dz*.6-az];
          triangle(root,left,tip,[.29+variation,.45+variation,.18]);
          triangle(root,tip,right,[.43+variation,.57+variation,.25]);
        }
      }
    }
  }
  return new Float32Array(mesh);
}

export function createFieldRenderer(canvas: HTMLCanvasElement) {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});
  if(!gl) return createCanvasFieldRenderer(canvas);
  const shaders:WebGLShader[]=[],buffers:WebGLBuffer[]=[];
  let program:WebGLProgram|null=null;
  const dispose=()=>{buffers.forEach(b=>gl.deleteBuffer(b));shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);};
  try {
    function shader(type:number,source:string) {
      const s=gl!.createShader(type); if(!s)throw Error('Shader unavailable');
      shaders.push(s);gl!.shaderSource(s,source);gl!.compileShader(s);
      if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS))throw Error('Shader unavailable');
      return s;
    }
    program=gl.createProgram();if(!program)throw Error('Program unavailable');
    gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program unavailable');
    gl.useProgram(program);
    const mesh=buildField(),buffer=gl.createBuffer();if(!buffer)throw Error('Buffer unavailable');
    buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
    for(const [name,offset] of [['aPosition',0],['aColor',12]] as const) {
      const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,24,offset);
    }
    const uniforms=Object.fromEntries(['uEye','uRight','uUp','uForward','uAspect'].map(n=>[n,gl.getUniformLocation(program!,n)]));
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    return {
      engine:'webgl' as const,
      draw(progress:number) {
        const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
        const ratio=Math.min(window.devicePixelRatio||1,bounds.width<500?1.5:2);
        const w=Math.round(bounds.width*ratio),h=Math.round(bounds.height*ratio);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        const eye=cameraPose(progress),{right,up,forward}=cameraBasis(eye);
        gl.uniform3fv(uniforms.uEye,eye);gl.uniform3fv(uniforms.uRight,right);gl.uniform3fv(uniforms.uUp,up);gl.uniform3fv(uniforms.uForward,forward);
        gl.uniform1f(uniforms.uAspect,w/h);gl.drawArrays(gl.TRIANGLES,0,mesh.length/6);
      },
      dispose,
    };
  } catch {dispose();return null;}
}

/** Same 3D geometry and perspective camera when GPU rendering is unavailable.
 * Fewer plants, 24fps in the host component; stops entirely after the dolly. */
function createCanvasFieldRenderer(canvas:HTMLCanvasElement) {
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const mesh=buildField(false),faces:{points:Vec3[];color:string}[]=[];
  for(let i=0;i<mesh.length;i+=18) faces.push({
    points:[0,6,12].map(j=>[mesh[i+j],mesh[i+j+1],mesh[i+j+2]] as Vec3),
    color:`rgb(${[mesh[i+3],mesh[i+4],mesh[i+5]].map(v=>Math.round(v*255)).join(' ')})`,
  });
  return {
    engine:'canvas' as const,
    draw(progress:number) {
      const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const ratio=Math.min(window.devicePixelRatio||1,1.25);
      const w=Math.round(bounds.width*ratio),h=Math.round(bounds.height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      ctx.clearRect(0,0,w,h);
      const eye=cameraPose(progress),basis=cameraBasis(eye),aspect=w/h;
      const projected=faces.map((f,i)=>{
        const points=f.points.map(p=>projectPoint(p,eye,aspect,basis));
        return {points,color:f.color,depth:(points[0][2]+points[1][2]+points[2][2])/3,layer:i<10?0:1};
      }).sort((a,b)=>a.layer-b.layer||b.depth-a.depth);
      for(const face of projected) {
        ctx.beginPath();face.points.forEach((p,i)=>{const x=(p[0]+1)*w/2,y=(1-p[1])*h/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
        ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
      }
    },
    dispose(){ctx.clearRect(0,0,canvas.width,canvas.height);},
  };
}
