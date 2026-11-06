(() => {
  'use strict';
  const canvas = document.querySelector('#view');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = 480, H = 270, FOV = Math.PI / 3;
  const buffer = document.createElement('canvas'); buffer.width = W; buffer.height = H;
  const g = buffer.getContext('2d');
  const ui = id => document.getElementById(id);
  const screen = { intro:ui('introScreen'), pause:ui('pauseScreen'), death:ui('deathScreen'), ending:ui('endingScreen') };
  let active = false, ended = false, audioOn = false, audioCtx = null, last = performance.now(), elapsed = 0, toastTimer = 0, captionTimer = 0;
  const player = { x:15, y:15, a:-Math.PI/2, bob:0, moving:false };
  const keys = new Set(), touch = new Set();
  const grid = Array.from({length:31},()=>Array(31).fill(1));
  const carve = (x1,y1,x2,y2) => { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) grid[y][x]=0; };
  carve(11,2,19,9); carve(2,2,9,9); carve(2,11,9,19); carve(21,11,28,19); carve(11,21,19,28);
  carve(14,9,16,14); carve(14,16,16,21); carve(9,14,14,16); carve(16,14,21,16); carve(6,9,8,12);
  carve(12,12,18,18); // central gallery
  // Wall furniture niches and columns are represented by set dressing, not blocked routes.
  const memories = [
    {id:'regret', name:'REGRET', x:5.7,y:5.8, entity:{x:7.3,y:6.7}, color:'#8e785f', title:'THE LETTER NEVER SENT', line:'The ink has run. The words are still yours.', text:'A hand reaches through a paper-thin wall, trying to return a letter to the moment before it was written.'},
    {id:'fear', name:'FEAR', x:15,y:4.7, entity:{x:16.5,y:7}, color:'#78909a', title:'THE WATCHER AT THE DOOR', line:'You learned to listen before you learned to sleep.', text:'A narrow silhouette folds itself into every doorway. Its many eyes are shut; it still knows when you look away.'},
    {id:'desire', name:'LONGING', x:5.3,y:15, entity:{x:7.2,y:16.5}, color:'#a87865', title:'THE VELVET HUNGER', line:'Wanting is not the same as being wanted.', text:'A faceless figure unspools red thread from its chest, leading toward a room that is always just out of reach.'},
    {id:'failure', name:'FAILURE', x:25.5,y:15, entity:{x:23.1,y:16.5}, color:'#a78a55', title:'THE UNFINISHED', line:'A thousand almosts. None of them the measure of you.', text:'A body of broken frames carries a small golden crown that can never quite sit straight.'},
    {id:'depression', name:'THE LONG QUIET', x:15,y:25.3, entity:{x:16.8,y:23.3}, color:'#697481', title:'THE HEAVY SLEEPER', line:'Even the dark changes, eventually.', text:'A seated shape wears the room like a wet coat. Under its weight, one small patch of floor remains warm.'}
  ];
  memories.forEach(m=>{m.state='waiting';m.exposure=0;m.chase=0;m.found=false;});
  const decor=[];
  // Every frame is empty. Their subjects have gone somewhere inside the house.
  memories.forEach(m=>decor.push({type:'painting',x:m.x,y:m.y,mem:m}));
  [[12.2,12.2],[17.8,12.2],[12.2,17.8],[17.8,17.8],[15,11.4],[15,18.6],[11.3,15],[18.7,15]].forEach((p,i)=>decor.push({type:i%2?'vase':'lamp',x:p[0],y:p[1]}));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);}
  addEventListener('resize',resize); resize();
  function makeArt(m,monster=false){
    const c=document.createElement('canvas');c.width=monster?160:120;c.height=monster?200:174;const q=c.getContext('2d');
    if(!monster){q.fillStyle='#211a16';q.fillRect(0,0,120,174);q.fillStyle='#49392d';q.fillRect(7,7,106,160);q.fillStyle='#151311';q.fillRect(12,12,96,150);q.strokeStyle='#97764e';q.lineWidth=4;q.strokeRect(4,4,112,166);q.strokeStyle='#c19c66';q.lineWidth=1;q.strokeRect(10,10,100,154);q.fillStyle='rgba(205,186,153,.08)';q.fillRect(15,18,90,132);q.font='9px Georgia';q.fillStyle='#776c5e';q.textAlign='center';q.fillText('—  —  —',60,87);q.fillStyle='#837461';q.beginPath();q.arc(60,79,1,0,7);q.fill();q.fillStyle='#8c775d';q.fillRect(20,143,80,2);return c;}
    q.fillStyle='#14110f';q.fillRect(0,0,160,200);
    const glow=q.createRadialGradient(80,115,3,80,115,95);glow.addColorStop(0,m.color+'88');glow.addColorStop(1,'#0c0a09');q.fillStyle=glow;q.fillRect(0,0,160,200);
    q.save();q.translate(80,122);
    if(m.id==='regret'){
      q.strokeStyle='#aaa18e';q.lineWidth=8;q.beginPath();q.moveTo(-2,16);q.bezierCurveTo(-35,0,-34,-22,-55,-33);q.moveTo(2,18);q.bezierCurveTo(32,0,37,-17,56,-27);q.stroke();q.fillStyle='#39352f';q.beginPath();q.ellipse(0,6,24,44,-.15,0,7);q.fill();q.fillStyle='#a39378';q.beginPath();q.ellipse(0,-45,15,20,0,0,7);q.fill();q.fillStyle='#1b1815';q.fillRect(-8,-48,16,3);q.fillRect(-3,-32,7,2);q.strokeStyle='#d5c6a9';q.lineWidth=1;q.beginPath();q.moveTo(0,-24);q.lineTo(5,30);q.stroke();
    }else if(m.id==='fear'){
      q.fillStyle='#20272a';q.beginPath();q.moveTo(-35,68);q.lineTo(-27,-27);q.quadraticCurveTo(-20,-65,0,-70);q.quadraticCurveTo(21,-60,27,-27);q.lineTo(39,70);q.closePath();q.fill();for(let i=0;i<5;i++){q.fillStyle=i%2?'#b8a98f':'#ddd0b5';q.beginPath();q.ellipse(-17+i*8,-37+Math.sin(i)*5,3,2,0,0,7);q.fill();}q.strokeStyle='#64717a';q.lineWidth=3;q.beginPath();q.moveTo(-20,5);q.lineTo(-48,47);q.moveTo(20,5);q.lineTo(50,42);q.stroke();
    }else if(m.id==='desire'){
      q.strokeStyle='#9b514b';q.lineWidth=3;for(let i=0;i<7;i++){q.beginPath();q.moveTo(-60+i*20,75);q.bezierCurveTo(-75+i*23,18,50-i*15,-8,-45+i*16,-61);q.stroke();}q.fillStyle='#60413c';q.beginPath();q.ellipse(0,-5,22,55,.1,0,7);q.fill();q.fillStyle='#151312';q.beginPath();q.arc(0,-55,19,0,7);q.fill();q.fillStyle='#bf7770';q.beginPath();q.arc(0,-58,7,0,7);q.fill();q.strokeStyle='#bd7970';q.lineWidth=2;q.beginPath();q.moveTo(-10,32);q.lineTo(-31,69);q.moveTo(10,32);q.lineTo(33,70);q.stroke();
    }else if(m.id==='failure'){
      q.fillStyle='#645642';q.beginPath();q.moveTo(-36,70);q.lineTo(-29,-22);q.lineTo(-18,-31);q.lineTo(-13,-3);q.lineTo(0,-50);q.lineTo(9,-10);q.lineTo(30,-29);q.lineTo(24,7);q.lineTo(39,68);q.closePath();q.fill();q.strokeStyle='#bba369';q.lineWidth=3;q.beginPath();q.moveTo(-45,-42);q.lineTo(-22,-55);q.lineTo(-9,-42);q.lineTo(9,-60);q.lineTo(26,-43);q.lineTo(46,-52);q.stroke();q.fillStyle='#d1b877';q.beginPath();q.arc(0,-19,4,0,7);q.fill();q.beginPath();q.arc(-13,15,3,0,7);q.arc(14,24,3,0,7);q.fill();
    }else{
      q.fillStyle='#4b535b';q.beginPath();q.ellipse(0,24,48,55,0,0,7);q.fill();q.fillStyle='#353b42';q.beginPath();q.arc(0,-32,27,0,7);q.fill();q.fillStyle='#131416';q.beginPath();q.arc(0,-26,15,0,7);q.fill();q.strokeStyle='#777b7b';q.lineWidth=2;for(let i=0;i<7;i++){q.beginPath();q.moveTo(-38+i*12,42);q.lineTo(-30+i*13,91);q.stroke();}q.fillStyle='#b9aa8a';q.beginPath();q.arc(-5,-28,2,0,7);q.fill();
    }
    q.restore();
    // Brushlike scratches and edge decay.
    q.globalAlpha=.35;q.strokeStyle='#c1ab84';q.lineWidth=1;for(let i=0;i<8;i++){q.beginPath();q.moveTo((i*37)%160,30+i*16);q.lineTo((i*37)%160+8,23+i*16);q.stroke();}return c;
  }
  const sprites=new Map();memories.forEach(m=>{sprites.set(m.id+':painting',makeArt(m));sprites.set(m.id+':monster',makeArt(m,true));});
  // A low-resolution, tileable walnut-and-damask wall texture keeps the raycaster atmospheric without external assets.
  function makeWallTexture(){
    const c=document.createElement('canvas');c.width=64;c.height=64;const q=c.getContext('2d');
    q.fillStyle='#49382b';q.fillRect(0,0,64,64);
    q.fillStyle='#382a22';q.fillRect(0,0,5,64);q.fillRect(59,0,5,64);
    q.fillStyle='#74583c';q.fillRect(5,2,54,2);q.fillRect(5,60,54,2);
    q.fillStyle='#2c211b';q.fillRect(7,7,50,50);
    q.fillStyle='#4b392b';q.fillRect(9,9,46,46);
    q.strokeStyle='rgba(183,145,96,.38)';q.lineWidth=1;q.strokeRect(11.5,11.5,41,41);
    q.strokeStyle='rgba(194,157,107,.22)';q.beginPath();q.moveTo(32,12);q.lineTo(32,52);q.moveTo(12,32);q.lineTo(52,32);q.stroke();
    q.strokeStyle='rgba(185,143,93,.3)';q.lineWidth=1.5;
    for(let cy=0;cy<2;cy++)for(let cx=0;cx<2;cx++){
      const x=22+cx*20,y=22+cy*20;q.beginPath();q.moveTo(x,y-6);q.bezierCurveTo(x+7,y-3,x+7,y+3,x,y+6);q.bezierCurveTo(x-7,y+3,x-7,y-3,x,y-6);q.stroke();
      q.fillStyle='rgba(191,151,99,.42)';q.beginPath();q.arc(x,y,1.3,0,Math.PI*2);q.fill();
    }
    q.fillStyle='rgba(16,11,8,.22)';for(let i=0;i<24;i++){let x=(i*37)%64,y=(i*53)%64;q.fillRect(x,y,1+(i%3),1);}
    return c;
  }
  const wallTexture=makeWallTexture();
  function castRay(angle){let rx=Math.cos(angle),ry=Math.sin(angle),mx=Math.floor(player.x),my=Math.floor(player.y);let ddx=Math.abs(1/(rx||.00001)),ddy=Math.abs(1/(ry||.00001));let sx,sy,sdx,sdy;if(rx<0){sx=-1;sdx=(player.x-mx)*ddx}else{sx=1;sdx=(mx+1-player.x)*ddx}if(ry<0){sy=-1;sdy=(player.y-my)*ddy}else{sy=1;sdy=(my+1-player.y)*ddy}let side=0;for(let i=0;i<80;i++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}if(mx<0||my<0||mx>=31||my>=31||grid[my][mx])break;}let d=side===0?sdx-ddx:sdy-ddy;let wallX=side===0?player.y+d*ry:player.x+d*rx;wallX-=Math.floor(wallX);return {d:Math.max(.05,d*Math.cos(angle-player.a)),mx,my,side,wallX};}
  function floorAndCeiling(){let h=H/2;let cg=g.createLinearGradient(0,0,0,h);cg.addColorStop(0,'#100d0b');cg.addColorStop(.7,'#29211b');cg.addColorStop(1,'#44372b');g.fillStyle=cg;g.fillRect(0,0,W,h);let fg=g.createLinearGradient(0,h,0,H);fg.addColorStop(0,'#4c3b2b');fg.addColorStop(.55,'#251d17');fg.addColorStop(1,'#100d0c');g.fillStyle=fg;g.fillRect(0,h,W,H-h);
    // Perspective seams in aged parquet, softened by darkness.
    g.save();g.strokeStyle='rgba(188,151,103,.13)';g.lineWidth=.6;for(let y=h+5;y<H;y+=Math.max(3,(y-h)*.12)){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}for(let x=-W;x<W*2;x+=34){g.beginPath();g.moveTo(W/2+(x-W/2)*.08,h+1);g.lineTo(x,H);g.stroke();}g.restore();
  }
  function drawWorld(){floorAndCeiling();const zbuf=new Float32Array(W);for(let x=0;x<W;x++){let a=player.a-FOV/2+(x/W)*FOV;const hit=castRay(a),d=hit.d;zbuf[x]=d;let wallH=Math.min(H*2,H/d),top=H/2-wallH/2;let light=Math.max(.12,1-d/12);let shade=light*(hit.side?.72:1);const texX=Math.min(63,Math.floor(hit.wallX*64));g.drawImage(wallTexture,texX,0,1,64,x,top,1,wallH);g.fillStyle=`rgba(12,9,7,${1-shade})`;g.fillRect(x,top,1,wallH);if((Math.floor(hit.wallX*8)===0)&&wallH>15){g.fillStyle=`rgba(190,153,108,${.12*light})`;g.fillRect(x,top,1,wallH);}if(wallH>60){g.fillStyle=`rgba(12,9,7,${.14*light})`;g.fillRect(x,top+wallH*.08,1,2);g.fillRect(x,top+wallH*.92,1,2);}}
    // Chandelier glow pools and drifting dust.
    for(let i=0;i<3;i++){let x=(i*173+80-player.x*8)%W;if(x<0)x+=W;let grad=g.createRadialGradient(x,58,1,x,58,42);grad.addColorStop(0,'rgba(188,145,91,.12)');grad.addColorStop(1,'rgba(188,145,91,0)');g.fillStyle=grad;g.fillRect(x-42,16,84,84);}
    const all=[];decor.forEach(d=>{if(d.type==='painting'&&d.mem.found)return;all.push({obj:d,x:d.x,y:d.y,dist:Math.hypot(d.x-player.x,d.y-player.y)});});
    memories.forEach(m=>{if(m.state==='hunting'){all.push({obj:{type:'monster',mem:m},x:m.entity.x,y:m.entity.y,dist:Math.hypot(m.entity.x-player.x,m.entity.y-player.y)});}});
    all.sort((a,b)=>b.dist-a.dist);all.forEach(item=>drawSprite(item,zbuf));
  }
  function drawSprite(item,zbuf){const o=item.obj,dx=item.x-player.x,dy=item.y-player.y,dist0=item.dist,angle=Math.atan2(dy,dx)-player.a;let rel=((angle+Math.PI*3)%(Math.PI*2))-Math.PI;if(Math.abs(rel)>FOV*.72||dist0<.3)return;let sx=W/2+Math.tan(rel)/(Math.tan(FOV/2))*(W/2),size=H/dist0*(o.type==='painting'?.68:o.type==='monster'?1.3:.24);let iw=o.type==='painting'?size*.65:o.type==='monster'?size*.8:size*.4,ih=o.type==='painting'?size:o.type==='monster'?size*1.35:size*.8;let sy=o.type==='monster'?H/2+size*.1-ih/2:o.type==='painting'?H/2-ih*.54:H/2+ih*.3;let img;
    if(o.type==='painting')img=sprites.get(o.mem.id+':painting');else if(o.type==='monster')img=sprites.get(o.mem.id+':monster');
    if(img){const start=Math.max(0,Math.floor(sx-iw/2)),end=Math.min(W,Math.ceil(sx+iw/2));for(let x=start;x<end;x++){if(dist0<zbuf[x]+.12){let u=(x-(sx-iw/2))/iw;g.drawImage(img,Math.floor(u*img.width),0,1,img.height,x,sy,1,ih);}}}
    else{g.fillStyle=o.type==='lamp'?'rgba(207,163,99,.3)':'rgba(55,43,32,.65)';g.beginPath();g.ellipse(sx,H/2+ih*.42,iw*.55,ih*.08,0,0,7);g.fill();if(o.type==='lamp'){g.fillStyle='rgba(217,171,105,.55)';g.fillRect(sx-iw*.08,sy,iw*.16,ih*.38);}}
  }
  function setToast(text){const t=ui('toast');t.textContent=text;t.classList.add('show');toastTimer=3.1;}
  function setCaption(text,duration=4){const c=ui('caption');c.textContent=text;c.style.opacity='1';captionTimer=duration;}
  function startHunt(m){m.state='hunting';m.chase=0;m.entity.x=m.entity.x;m.entity.y=m.entity.y;player.a=Math.atan2(m.entity.y-player.y,m.entity.x-player.x)+Math.PI;setToast('THE FRAME IS NOT EMPTY');setCaption(m.line,5);ui('roomName').textContent=m.name;}
  function interact(){if(!active||ended)return;const m=memories.find(it=>!it.found&&Math.hypot(it.x-player.x,it.y-player.y)<1.9);if(!m)return;if(m.state==='waiting'){startHunt(m)}else if(m.state==='quiet'){m.found=true;m.state='found';ui('foundCount').textContent=memories.filter(a=>a.found).length;[...ui('memoryPips').children][memories.filter(a=>a.found).length-1].classList.add('found');setToast('REMEMBERED: '+m.name);setCaption(m.text,6);ui('objectiveTitle').textContent=memories.every(a=>a.found)?'THE LAST ROOM':'THE FRAMES ARE CHANGING';ui('objectiveText').textContent=memories.every(a=>a.found)?'Something waits beneath the house.':'The house has not finished speaking.';if(memories.every(a=>a.found))beginEnding();}}
  function beginEnding(){ended=true;active=false;document.exitPointerLock?.();ui('fade').classList.add('on');setTimeout(()=>{ui('fade').classList.remove('on');Object.values(screen).forEach(s=>s.hidden=true);screen.ending.hidden=false;ui('endingLine').textContent='The little white tablet rests in your palm. Outside, morning comes without permission.';},1400);}
  function update(dt){if(!active)return;elapsed+=dt;const forward=(keys.has('KeyW')||keys.has('ArrowUp')||touch.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||touch.has('back')?1:0);const side=(keys.has('KeyD')||touch.has('right')?1:0)-(keys.has('KeyA')||touch.has('left')?1:0);player.moving=!!(forward||side);let sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');const speed=sprint?3.9:2.55;
    if(keys.has('ArrowLeft'))player.a-=dt*1.8;if(keys.has('ArrowRight'))player.a+=dt*1.8;let vx=(Math.cos(player.a)*forward+Math.cos(player.a+Math.PI/2)*side)*speed*dt,vy=(Math.sin(player.a)*forward+Math.sin(player.a+Math.PI/2)*side)*speed*dt;if(vx||vy){let nx=player.x+vx,ny=player.y+vy;if(!grid[Math.floor(player.y)][Math.floor(nx)]&&isSafe(nx,player.y))player.x=nx;if(!grid[Math.floor(ny)][Math.floor(player.x)]&&isSafe(player.x,ny))player.y=ny;player.bob+=dt*(sprint?13:9);}else player.bob*=.92;
    let inHunt=false,nearest=Infinity,visibleThreat=false;
    memories.forEach(m=>{if(m.state!=='hunting')return;inHunt=true;m.chase+=dt;const dx=player.x-m.entity.x,dy=player.y-m.entity.y,d=Math.hypot(dx,dy);nearest=Math.min(nearest,d);const turn=Math.atan2(dy,dx);m.entity.x+=Math.cos(turn)*Math.min(.62*dt,d);m.entity.y+=Math.sin(turn)*Math.min(.62*dt,d);let look=Math.abs(((Math.atan2(m.entity.y-player.y,m.entity.x-player.x)-player.a+Math.PI*3)%(Math.PI*2))-Math.PI);let facing=look<FOV*.64;if(d<7&&facing){m.exposure+=dt*(d<2.6?18:8);visibleThreat=true;}else m.exposure-=dt*8;m.exposure=clamp(m.exposure,0,100);if(m.exposure>=100){die();}if(m.chase>7&&d>5){m.state='quiet';m.exposure=0;setToast('THE WHISPERS RECEDЕ');setCaption('The room is yours again.',3);}});
    const exposure=Math.max(0,...memories.map(m=>m.exposure));ui('exposureFill').style.width=exposure+'%';ui('exposureWord').textContent=exposure<12?'QUIET':exposure<38?'UNEASY':exposure<70?'DISTORTED':'OVERWHELMED';ui('exposureHint').textContent=exposure<12?'The silence is never empty.':exposure<38?'Something has noticed you.':exposure<70?'Do not let it get close.':'You need to get away.';
    const near=memories.find(m=>!m.found&&Math.hypot(m.x-player.x,m.y-player.y)<1.9);ui('interactPrompt').hidden=!near; if(near)ui('interactPrompt').innerHTML=`<kbd>${isTouch?'TOUCH':'E'}</kbd><span>${near.state==='quiet'?'RECLAIM MEMORY':'OPEN THE EMPTY FRAME'}</span>`;
    const room=roomAt(player.x,player.y);ui('roomName').textContent=room;const prog=memories.filter(m=>m.found).length;ui('objectiveTitle').textContent=prog?'FOLLOW THE EMPTY FRAMES':'FIND THE EMPTY FRAMES';
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui('toast').classList.remove('show');}if(captionTimer>0){captionTimer-=dt;if(captionTimer<=0)ui('caption').style.opacity='0';}
    if(audioOn&&audioCtx&&elapsed%7<dt)ambientPulse();
  }
  function isSafe(x,y){return x>.25&&y>.25&&x<30.7&&y<30.7;}
  function roomAt(x,y){if(x<10&&y<10)return 'THE PORTRAIT GALLERY';if(x>10&&x<20&&y<10)return 'THE NORTH WING';if(x<10&&y>10&&y<20)return 'THE VELVET ROOM';if(x>20&&y<20)return 'THE EAST GALLERY';if(y>20)return 'THE SOUTH WING';return 'THE ATELIER';}
  function die(){if(!active)return;active=false;document.exitPointerLock?.();setTimeout(()=>{screen.death.hidden=false;ui('hud').hidden=true;},500);}
  const isTouch=('ontouchstart'in window)||navigator.maxTouchPoints>0;ui('touchControls').hidden=!isTouch;
  function render(){let bob=player.bob?Math.sin(player.bob)*1.5:0;g.save();g.translate(0,bob);drawWorld();g.restore();const exposure=Math.max(0,...memories.map(m=>m.exposure));if(exposure>10){g.fillStyle=`rgba(70,13,16,${Math.min(.22,(exposure-10)/400)})`;g.fillRect(0,0,W,H);if(exposure>40&&Math.random()<.14){g.fillStyle='rgba(210,186,154,.12)';g.fillRect(Math.random()*W,Math.random()*H,Math.random()*35+5,Math.random()*3+1);}}
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(buffer,0,0,canvas.width,canvas.height);
  }
  function frame(now){let dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
  function begin(){Object.values(screen).forEach(s=>s.hidden=true);ui('hud').hidden=false;ui('controlsHint').hidden=isTouch;active=true;player.x=15;player.y=15;player.a=-Math.PI/2;elapsed=0;memories.forEach(m=>{m.state='waiting';m.found=false;m.exposure=0;m.chase=0;});ui('foundCount').textContent='0';[...ui('memoryPips').children].forEach(p=>p.classList.remove('found'));ui('objectiveText').textContent='Listen for what the house has kept.';if(!isTouch)canvas.requestPointerLock?.();setCaption('I painted them here. I know I did.',4);}
  ui('startButton').addEventListener('click',begin);ui('restartButton').addEventListener('click',()=>{screen.death.hidden=true;begin();});ui('resumeButton').addEventListener('click',()=>{screen.pause.hidden=true;active=true;if(!isTouch)canvas.requestPointerLock?.();});ui('endingButton').addEventListener('click',()=>{screen.ending.hidden=true;screen.intro.hidden=false;screen.intro.classList.add('active');});
  document.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyE'||e.code==='Enter')interact();if(e.code==='Escape'&&active){active=false;document.exitPointerLock?.();screen.pause.hidden=false;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});document.addEventListener('keyup',e=>keys.delete(e.code));
  document.addEventListener('mousemove',e=>{if(active&&document.pointerLockElement===canvas)player.a+=e.movementX*.0022;});canvas.addEventListener('click',()=>{if(active&&!isTouch)canvas.requestPointerLock?.();});
  document.addEventListener('pointerlockchange',()=>{if(active&&document.pointerLockElement!==canvas&&!isTouch&&elapsed>1){active=false;screen.pause.hidden=false;}});
  document.querySelectorAll('[data-move]').forEach(b=>{const val=b.dataset.move;b.addEventListener('pointerdown',e=>{e.preventDefault();touch.add(val);b.setPointerCapture(e.pointerId);});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,()=>touch.delete(val)));});
  let lookTouch=null;ui('touchLookLeft').addEventListener('pointerdown',()=>lookTouch=-1);ui('touchLookRight').addEventListener('pointerdown',()=>lookTouch=1);['pointerup','pointercancel'].forEach(ev=>{ui('touchLookLeft').addEventListener(ev,()=>lookTouch=null);ui('touchLookRight').addEventListener(ev,()=>lookTouch=null);});setInterval(()=>{if(active&&lookTouch)player.a+=lookTouch*.08;},40);ui('touchInteract').addEventListener('click',interact);
  ui('soundButton').addEventListener('click',()=>{audioOn=!audioOn;ui('soundState').textContent=audioOn?'ON':'OFF';if(audioOn){audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();ambientPulse();}});
  function ambientPulse(){if(!audioOn||!audioCtx)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=45+Math.random()*15;gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.035,audioCtx.currentTime+1.5);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+5);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+5);}
})();
