import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const $ = id => document.getElementById(id);
const scoreEl=$("score"), coinsEl=$("coins"), livesEl=$("lives"), bestEl=$("best");
const startScreen=$("startScreen"), overScreen=$("overScreen"), pauseScreen=$("pauseScreen");
const finalText=$("finalText");
const shieldTag=$("shieldTag"), magnetTag=$("magnetTag"), boostTag=$("boostTag");

let scene,camera,renderer,player,clock;
let playing=false,paused=false,soundOn=true;
let score=0,coins=0,lives=3,speed=.43,best=Number(localStorage.getItem("temple4Best")||0);
let targetLane=0,jumpV=0,isJump=false,slideTime=0,hitCooldown=0;
let objects=[],tiles=[],decor=[],spawnTimer=0,coinTimer=0,powerTimer=0;
let shield=0,magnet=0,boost=0;
bestEl.textContent=best;

init(); animate();

function beep(freq=420,time=.08){
  if(!soundOn) return;
  try{
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    const o=ac.createOscillator(), g=ac.createGain();
    o.frequency.value=freq; o.type="sine"; g.gain.value=.05;
    o.connect(g); g.connect(ac.destination); o.start();
    setTimeout(()=>{o.stop(); ac.close()},time*1000);
  }catch(e){}
}

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x06140d);
  scene.fog=new THREE.Fog(0x06140d,18,90);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,160);
  camera.position.set(0,6.5,9.5);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  $("game").prepend(renderer.domElement);
  clock=new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xc5ffd4,0x1b120a,1.5));
  const sun=new THREE.DirectionalLight(0xffd37a,2.3);
  sun.position.set(-5,12,6); sun.castShadow=true; scene.add(sun);

  createTemple(); createPlayer(); bind();
  window.addEventListener("resize",onResize);
}

function createTemple(){
  const roadMat=new THREE.MeshStandardMaterial({color:0x9d7650,roughness:.85});
  const lineMat=new THREE.MeshStandardMaterial({color:0xf1dfc8});
  for(let i=0;i<30;i++){
    const tile=new THREE.Mesh(new THREE.BoxGeometry(9,0.18,6),roadMat);
    tile.position.set(0,0,-i*6); tile.receiveShadow=true; scene.add(tile); tiles.push(tile);
    for(const x of [-1.5,1.5]){
      const line=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,5.8),lineMat);
      line.position.set(x,.12,-i*6); scene.add(line); tiles.push(line);
    }
    createPillar(-5.7,-i*6); createPillar(5.7,-i*6);
  }
  const jungleMat=new THREE.MeshStandardMaterial({color:0x0f5a2e});
  for(let i=0;i<85;i++){
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(Math.random()*1.2+.6,12,8),jungleMat);
    leaf.position.set((Math.random()<.5?-1:1)*(6+Math.random()*9),Math.random()*5+1,-Math.random()*170);
    leaf.scale.set(1.7,.35,.8); scene.add(leaf); decor.push(leaf);
  }
}

function createPillar(x,z){
  const stone=new THREE.MeshStandardMaterial({color:0x5b5844,roughness:.9});
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(1,3,1),stone);
  pillar.position.set(x,1.5,z); pillar.castShadow=true; scene.add(pillar); decor.push(pillar);
  const fire=new THREE.PointLight(0xff8a22,1.35,8);
  fire.position.set(x,3.2,z); scene.add(fire); decor.push(fire);
  const flame=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:0xff7b22}));
  flame.position.set(x,3.1,z); scene.add(flame); decor.push(flame);
}

function createPlayer(){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xf0b98e});
  const shirt=new THREE.MeshStandardMaterial({color:0xf4efe4});
  const pant=new THREE.MeshStandardMaterial({color:0x273447});
  const hair=new THREE.MeshStandardMaterial({color:0x101010});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.8,1.25,.45),shirt); body.position.y=1.45; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36,24,16),skin); head.position.y=2.35; head.castShadow=true; g.add(head);
  const hairM=new THREE.Mesh(new THREE.BoxGeometry(.75,.22,.5),hair); hairM.position.y=2.68; g.add(hairM);
  for(const x of [-.22,.22]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.8,.28),pant); leg.position.set(x,.55,0); leg.castShadow=true; g.add(leg);}
  g.position.set(0,0,2); scene.add(g); player=g;
}

function laneX(n){return n*2.5}

function spawnObstacle(){
  const type=Math.random()<.32?"low":"block";
  const mat=new THREE.MeshStandardMaterial({color:type==="low"?0x3a211a:0x4d3928,roughness:.7});
  const geo=type==="low"?new THREE.BoxGeometry(1.9,.55,1):new THREE.BoxGeometry(1.25,1.7,1.1);
  const mesh=new THREE.Mesh(geo,mat);
  const l=[-1,0,1][Math.floor(Math.random()*3)];
  mesh.position.set(laneX(l),type==="low"?.28:.85,-78);
  mesh.castShadow=true; scene.add(mesh); objects.push({mesh,type,lane:l});
}

function spawnCoins(){
  const l=[-1,0,1][Math.floor(Math.random()*3)];
  const mat=new THREE.MeshStandardMaterial({color:0xffcc24,metalness:.7,roughness:.25});
  for(let i=0;i<7;i++){
    const coin=new THREE.Mesh(new THREE.TorusGeometry(.32,.09,12,28),mat);
    coin.position.set(laneX(l),1.1,-78-i*2.1); coin.castShadow=true; scene.add(coin);
    objects.push({mesh:coin,type:"coin",lane:l});
  }
}

function spawnPower(){
  const types=["shield","magnet","boost"];
  const type=types[Math.floor(Math.random()*types.length)];
  const color=type==="shield"?0x42a5ff:type==="magnet"?0xff4ec7:0x8dff32;
  const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.48,1),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35}));
  const l=[-1,0,1][Math.floor(Math.random()*3)];
  mesh.position.set(laneX(l),1.25,-82); scene.add(mesh); objects.push({mesh,type,lane:l,power:true});
}

function update(dt){
  score+=dt*85*(boost>0?1.6:1);
  speed+=dt*.006;
  if(hitCooldown>0) hitCooldown-=dt;
  shield=Math.max(0,shield-dt); magnet=Math.max(0,magnet-dt); boost=Math.max(0,boost-dt);
  spawnTimer+=dt; coinTimer+=dt; powerTimer+=dt;
  if(spawnTimer>1.0){spawnTimer=0;spawnObstacle()}
  if(coinTimer>2.0){coinTimer=0;spawnCoins()}
  if(powerTimer>7.0){powerTimer=0;spawnPower()}

  [...tiles,...decor].forEach(obj=>{obj.position.z+=speed*(boost>0?1.18:1); if(obj.position.z>10)obj.position.z-=180;});
  player.position.x+=(laneX(targetLane)-player.position.x)*.18;
  if(isJump){player.position.y+=jumpV*dt; jumpV-=32*dt; if(player.position.y<=0){player.position.y=0; isJump=false; jumpV=0;}}
  if(slideTime>0){slideTime-=dt; player.scale.y=.55}else player.scale.y+=(1-player.scale.y)*.2;

  for(const o of objects){
    o.mesh.position.z+=speed*(boost>0?1.18:1);
    o.mesh.rotation.y+=dt*(o.type==="coin"?8:2);
    if(magnet>0 && o.type==="coin" && Math.abs(o.mesh.position.z-player.position.z)<10){
      o.mesh.position.x+=(player.position.x-o.mesh.position.x)*.12;
      o.mesh.position.y+=(1.2-o.mesh.position.y)*.12;
    }
    const dz=Math.abs(o.mesh.position.z-player.position.z), dx=Math.abs(o.mesh.position.x-player.position.x);
    if(dz<.95 && dx<.95){
      if(o.type==="coin"){collect(o,80,760)}
      else if(o.power){activatePower(o.type); scene.remove(o.mesh); o.dead=true}
      else if(o.type==="block"){
        if(!isJump || player.position.y<1.1) damage(o);
      }else if(o.type==="low"){
        if(slideTime<=0) damage(o);
      }
    }
    if(o.mesh.position.z>11)o.dead=true;
  }
  objects=objects.filter(o=>!o.dead);
  updateUI();
}

function collect(o,points,freq){scene.remove(o.mesh); o.dead=true; coins++; score+=points; beep(freq,.05)}
function activatePower(type){
  if(type==="shield") shield=7;
  if(type==="magnet") magnet=7;
  if(type==="boost") boost=5;
  beep(980,.09);
}
function damage(o){
  if(hitCooldown>0)return;
  if(shield>0){shield=0; scene.remove(o.mesh); o.dead=true; beep(220,.08); return;}
  lives--; hitCooldown=1.2; beep(120,.15);
  if(lives<=0) endGame();
}

function updateUI(){
  scoreEl.textContent=Math.floor(score); coinsEl.textContent=coins; livesEl.textContent=lives;
  shieldTag.classList.toggle("hidden",shield<=0);
  magnetTag.classList.toggle("hidden",magnet<=0);
  boostTag.classList.toggle("hidden",boost<=0);
}

function endGame(){
  playing=false; best=Math.max(best,Math.floor(score)); localStorage.setItem("temple4Best",best); bestEl.textContent=best;
  finalText.textContent=`Score: ${Math.floor(score)} | Coins: ${coins}`;
  overScreen.classList.remove("hidden");
}

function reset(){
  for(const o of objects)scene.remove(o.mesh);
  objects=[]; score=0; coins=0; lives=3; speed=.43; targetLane=0; player.position.set(0,0,2); player.scale.set(1,1,1);
  shield=0; magnet=0; boost=0; hitCooldown=0; spawnTimer=0; coinTimer=0; powerTimer=0; isJump=false; slideTime=0;
  updateUI();
}
function start(){reset(); playing=true; paused=false; startScreen.classList.add("hidden"); overScreen.classList.add("hidden"); pauseScreen.classList.add("hidden");}
function pauseToggle(){if(!playing)return; paused=!paused; pauseScreen.classList.toggle("hidden",!paused)}
function jump(){if(!playing||paused||isJump)return; isJump=true; jumpV=12.5}
function slide(){if(!playing||paused)return; slideTime=.62}
function left(){if(playing&&!paused)targetLane=Math.max(-1,targetLane-1)}
function right(){if(playing&&!paused)targetLane=Math.min(1,targetLane+1)}

function bind(){
  $("startBtn").onclick=start; $("restartBtn").onclick=start; $("pauseBtn").onclick=pauseToggle; $("resumeBtn").onclick=pauseToggle;
  $("soundBtn").onclick=()=>{soundOn=!soundOn; $("soundBtn").textContent=soundOn?"🔊":"🔇"};
  $("leftBtn").onclick=left; $("rightBtn").onclick=right; $("jumpBtn").onclick=jump; $("slideBtn").onclick=slide;
  document.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")left(); if(e.key==="ArrowRight")right(); if(e.key==="ArrowUp"||e.code==="Space")jump(); if(e.key==="ArrowDown")slide(); if(e.key.toLowerCase()==="p")pauseToggle();});
  let sx=0,sy=0;
  renderer.domElement.addEventListener("touchstart",e=>{sx=e.changedTouches[0].clientX; sy=e.changedTouches[0].clientY});
  renderer.domElement.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy; if(Math.abs(dx)>Math.abs(dy)){dx>30?right():dx<-30&&left()}else{dy<-30?jump():dy>30&&slide()}});
}

function onResize(){camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);}
function animate(){requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),.04); if(playing&&!paused)update(dt); camera.position.x+=(player.position.x*.18-camera.position.x)*.08; camera.lookAt(player.position.x,1.5,-8); renderer.render(scene,camera);}
