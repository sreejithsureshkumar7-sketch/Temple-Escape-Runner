import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const scoreEl=document.getElementById("score");
const coinsEl=document.getElementById("coins");
const bestEl=document.getElementById("best");
const startScreen=document.getElementById("startScreen");
const overScreen=document.getElementById("overScreen");
const finalText=document.getElementById("finalText");

let scene,camera,renderer,player,clock;
let playing=false,paused=false;
let score=0,coins=0,speed=0.42,best=Number(localStorage.getItem("temple3dBest")||0);
let lane=0,targetLane=0,jumpV=0,isJump=false,slideTime=0;
let objects=[],tiles=[],decor=[];
let spawnTimer=0,coinTimer=0;
bestEl.textContent=best;

init();
animate();

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x06140d);
  scene.fog=new THREE.Fog(0x06140d,18,85);

  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,150);
  camera.position.set(0,6.5,9.5);
  camera.lookAt(0,1.5,-8);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  document.getElementById("game").prepend(renderer.domElement);

  clock=new THREE.Clock();

  const hemi=new THREE.HemisphereLight(0xb8ffcc,0x1b120a,1.6);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd37a,2.2);
  sun.position.set(-5,12,6);
  sun.castShadow=true;
  scene.add(sun);

  createTemple();
  createPlayer();

  window.addEventListener("resize",onResize);
  document.addEventListener("keydown",onKey);
  bindButtons();
}

function createTemple(){
  const roadMat=new THREE.MeshStandardMaterial({color:0x9d7650,roughness:.85});
  const lineMat=new THREE.MeshStandardMaterial({color:0xf1dfc8});
  for(let i=0;i<28;i++){
    const tile=new THREE.Mesh(new THREE.BoxGeometry(9,0.18,6),roadMat);
    tile.position.set(0,0,-i*6);
    tile.receiveShadow=true;
    scene.add(tile); tiles.push(tile);

    for(const x of [-1.5,1.5]){
      const line=new THREE.Mesh(new THREE.BoxGeometry(.05,.22,5.8),lineMat);
      line.position.set(x,.12,-i*6);
      scene.add(line); tiles.push(line);
    }

    createPillars(-5.7,-i*6);
    createPillars(5.7,-i*6);
  }

  const jungleMat=new THREE.MeshStandardMaterial({color:0x0f5a2e});
  for(let i=0;i<70;i++){
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(Math.random()*1.2+.6,12,8),jungleMat);
    leaf.position.set((Math.random()<.5?-1:1)*(6+Math.random()*8),Math.random()*5+1,-Math.random()*150);
    leaf.scale.set(1.7,.35,.8);
    scene.add(leaf); decor.push(leaf);
  }
}

function createPillars(x,z){
  const stone=new THREE.MeshStandardMaterial({color:0x5b5844,roughness:.9});
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(1,3,1),stone);
  pillar.position.set(x,1.5,z);
  pillar.castShadow=true;
  scene.add(pillar); decor.push(pillar);

  const fire=new THREE.PointLight(0xff8a22,1.4,8);
  fire.position.set(x,3.2,z);
  scene.add(fire); decor.push(fire);

  const flame=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:0xff7b22}));
  flame.position.set(x,3.1,z);
  scene.add(flame); decor.push(flame);
}

function createPlayer(){
  const group=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xf0b98e});
  const cloth=new THREE.MeshStandardMaterial({color:0xf3eee3});
  const pant=new THREE.MeshStandardMaterial({color:0x2c3544});
  const hair=new THREE.MeshStandardMaterial({color:0x101010});
  const belt=new THREE.MeshStandardMaterial({color:0x7b3f18});

  const body=new THREE.Mesh(new THREE.BoxGeometry(.8,1.25,.45),cloth);
  body.position.y=1.45; body.castShadow=true; group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36,24,16),skin);
  head.position.y=2.35; head.castShadow=true; group.add(head);
  const hairM=new THREE.Mesh(new THREE.BoxGeometry(.75,.22,.5),hair);
  hairM.position.y=2.68; group.add(hairM);
  const l1=new THREE.Mesh(new THREE.BoxGeometry(.25,.8,.28),pant);
  l1.position.set(-.22,.55,0); l1.castShadow=true; group.add(l1);
  const l2=l1.clone(); l2.position.x=.22; group.add(l2);
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.12,1.55,.08),belt);
  strap.position.set(.05,1.45,.27); strap.rotation.z=-.55; group.add(strap);

  group.position.set(0,0,2);
  scene.add(group);
  player=group;
}

function laneX(n){return n*2.5}

function spawnObstacle(){
  const type=Math.random()<.32?"low":"block";
  const mat=new THREE.MeshStandardMaterial({color:type==="low"?0x3a211a:0x4d3928,roughness:.7});
  const mesh=new THREE.Mesh(type==="low"?new THREE.BoxGeometry(1.9,.55,1):new THREE.BoxGeometry(1.25,1.7,1.1),mat);
  const l=[-1,0,1][Math.floor(Math.random()*3)];
  mesh.position.set(laneX(l),type==="low"?.28:.85,-72);
  mesh.castShadow=true;
  scene.add(mesh);
  objects.push({mesh,type,lane:l});
}

function spawnCoins(){
  const l=[-1,0,1][Math.floor(Math.random()*3)];
  const mat=new THREE.MeshStandardMaterial({color:0xffcc24,metalness:.7,roughness:.25});
  for(let i=0;i<6;i++){
    const coin=new THREE.Mesh(new THREE.TorusGeometry(.32,.09,12,28),mat);
    coin.position.set(laneX(l),1.1,-72-i*2.2);
    coin.castShadow=true;
    scene.add(coin);
    objects.push({mesh:coin,type:"coin",lane:l});
  }
}

function updateWorld(dt){
  score+=dt*80;
  speed+=dt*.006;
  spawnTimer+=dt; coinTimer+=dt;

  if(spawnTimer>1.05){spawnTimer=0;spawnObstacle()}
  if(coinTimer>2.2){coinTimer=0;spawnCoins()}

  for(const t of tiles){
    t.position.z+=speed;
    if(t.position.z>8)t.position.z-=168;
  }
  for(const d of decor){
    d.position.z+=speed;
    if(d.position.z>10)d.position.z-=168;
  }

  player.position.x+=(laneX(targetLane)-player.position.x)*.18;

  if(isJump){
    player.position.y+=jumpV*dt;
    jumpV-=32*dt;
    if(player.position.y<=0){player.position.y=0;isJump=false;jumpV=0}
  }

  if(slideTime>0){
    slideTime-=dt;
    player.scale.y=.55;
  }else{
    player.scale.y+= (1-player.scale.y)*.2;
  }

  for(const o of objects){
    o.mesh.position.z+=speed;
    if(o.type==="coin")o.mesh.rotation.y+=dt*8;

    const dz=Math.abs(o.mesh.position.z-player.position.z);
    const dx=Math.abs(o.mesh.position.x-player.position.x);

    if(dz<.9 && dx<.9){
      if(o.type==="coin"){
        scene.remove(o.mesh); o.dead=true; coins++; score+=80;
      }else if(o.type==="block"){
        if(!isJump || player.position.y<1.1) endGame();
      }else if(o.type==="low"){
        if(slideTime<=0) endGame();
      }
    }

    if(o.mesh.position.z>10)o.dead=true;
  }

  objects=objects.filter(o=>!o.dead);
  updateUI();
}

function updateUI(){
  scoreEl.textContent=Math.floor(score);
  coinsEl.textContent=coins;
}

function endGame(){
  playing=false;
  best=Math.max(best,Math.floor(score));
  localStorage.setItem("temple3dBest",best);
  bestEl.textContent=best;
  finalText.textContent=`Score: ${Math.floor(score)} | Coins: ${coins}`;
  overScreen.classList.remove("hidden");
}

function resetGame(){
  for(const o of objects)scene.remove(o.mesh);
  objects=[];
  score=0; coins=0; speed=.42; targetLane=0; lane=0; player.position.set(0,0,2);
  player.scale.set(1,1,1); isJump=false; slideTime=0; spawnTimer=0; coinTimer=0;
  updateUI();
}

function start(){
  resetGame();
  playing=true; paused=false;
  startScreen.classList.add("hidden");
  overScreen.classList.add("hidden");
}

function jump(){
  if(!playing||paused||isJump)return;
  isJump=true; jumpV=12.5;
}
function slide(){
  if(!playing||paused)return;
  slideTime=.62;
}
function left(){if(playing&&!paused)targetLane=Math.max(-1,targetLane-1)}
function right(){if(playing&&!paused)targetLane=Math.min(1,targetLane+1)}

function onKey(e){
  if(e.key==="ArrowLeft")left();
  if(e.key==="ArrowRight")right();
  if(e.key==="ArrowUp"||e.code==="Space")jump();
  if(e.key==="ArrowDown")slide();
  if(e.key.toLowerCase()==="p")paused=!paused;
}

function bindButtons(){
  document.getElementById("startBtn").onclick=start;
  document.getElementById("restartBtn").onclick=start;
  document.getElementById("pauseBtn").onclick=()=>{if(playing)paused=!paused};
  document.getElementById("leftBtn").onclick=left;
  document.getElementById("rightBtn").onclick=right;
  document.getElementById("jumpBtn").onclick=jump;
  document.getElementById("slideBtn").onclick=slide;

  let sx=0,sy=0;
  renderer.domElement.addEventListener("touchstart",e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY});
  renderer.domElement.addEventListener("touchend",e=>{
    const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>Math.abs(dy)){dx>30?right():dx<-30&&left()}
    else{dy<-30?jump():dy>30&&slide()}
  });
}

function onResize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  if(playing&&!paused)updateWorld(dt);
  camera.position.x+=(player.position.x*.18-camera.position.x)*.08;
  camera.lookAt(player.position.x,1.5,-8);
  renderer.render(scene,camera);
}
