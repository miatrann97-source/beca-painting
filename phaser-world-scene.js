/* ============================================================================
   PHASER WORLD — round 4 + GỘP round 5 + motion sprite + nền 3D (đợt sửa #1, 20/11/2026).
   Phaser 4.2.1. Chạy BÊN TRONG file game chính (dùng chung CONFIG/state/beca/
   npcs/bonePoseFor/boneFK/hitsSolid/groundTopY/depthScale...). Không redesign
   bé cá, không DragonBones, không Godot/Unity.
   GỘP (đợt sửa #1 — quy định An 18:20 19/11: tối đa 3 lần sửa trên 1 cách làm):
   - Round 5 (kiểm live 17:29): body 36x36, tách NPC, nhãn tên/bong bóng, minimap,
     ngày-đêm 240s, mưa start/stop, bóng xe, vòng đài thứ 3, crossfade 120px.
   - Motion sprite bé cá (An 17:17): 3 sheet đi/đứng/nhảy, KHÔNG rig xương.
   - Nền 3D Claude+Blender (An 18:16 'Dùng claude đi'): 3 ảnh nền 1600x1400 vẽ 1:1
     thay panorama (hết đường nối, hết khoảng be tây chợ) + 18 sprite tiền cảnh
     crop theo bbox (manifest.json), depth = foot_y (che khuất thật).
   Sửa so với bản DOM round 3 (xem tests/round4-diagnosis.md):
   - Nhảy đúng dấu: jumpZ >= 0, hiển thị y - jumpZ (không chìm xuống đất).
   - Va chạm NPC: tách theo bề rộng HÌNH VẼ (không phải r=22), NPC nhường +
     bé cá bị chặn (không đi xuyên, không kẹt trong NPC).
   - Che khuất: FG = ảnh khu + GeometryMask đúng hình vật, Y-sort theo chân.
   - Seam: chồng mép 48px + crossfade alpha ở x=1600, x=3200.
   - Dải đi: kẹp "đầu thoát tán" gần cây (chân y >= ~1000 trong bán kính tán).
   - Bé Mai: ĐÃ XOÁ HẲN (chỉ đạo An 16:56) — khỏi cả thế giới mở lẫn khách
     vẽ tranh; không NPC/marker/bong bóng/nhiệm vụ map, không thẻ tĩnh Quest
     Panel, không còn trong CUSTOMERS. Chỉ giữ biển hiệu tiệm "Trà Sữa Bé Mai"
     (tên địa điểm) + file sheet RIGS.mai lưu trữ, không spawn.
   ========================================================================== */
(function(){
'use strict';
/* ---- cover transform: ảnh khu hiển thị 1600x1400 bằng CSS cover ----
   plaza 1920x1120 -> scale 1.25, crop source x 320..1600
   street/market 2048x1152 -> scale 1400/1152, crop source x ~365.7..1682.3 */
function coverFor(zoneId){
  if(zoneId==='plaza') return {scale:1.25, cropX:320, sw:1920, sh:1120};
  var sc = 1400/1152;
  return {scale:sc, cropX:(2048*sc-1600)/2/sc, sw:2048, sh:1152};
}
/* zone-local display (1600x1400) -> source px */
function dispToSrc(zoneId, dx, dy){
  var c = coverFor(zoneId);
  return {x: dx/c.scale + c.cropX, y: dy/c.scale};
}
/* parse clip-path CSS (ellipse / polygon / inset) -> {kind, ...} (zone-local display px) */
function parseClip(clip){
  var m;
  m = clip.match(/ellipse\(\s*([\d.]+)px\s+([\d.]+)px\s+at\s+([\d.]+)px\s+([\d.]+)px\s*\)/);
  if(m) return {kind:'ellipse', rx:+m[1], ry:+m[2], cx:+m[3], cy:+m[4]};
  m = clip.match(/polygon\(([^)]+)\)/);
  if(m){
    var pts = m[1].split(',').map(function(s){
      var p = s.trim().split(/\s+/); return {x:+p[0].replace('px',''), y:+p[1].replace('px','')};
    });
    return {kind:'polygon', pts:pts};
  }
  m = clip.match(/inset\(\s*([\d.]+)px\s+([\d.]+)px\s+([\d.]+)px\s+([\d.]+)px\s*\)/);
  if(m){
    var t=+m[1], r=+m[2], b=+m[3], l=+m[4];
    return {kind:'rect', x:l, y:t, w:1600-l-r, h:1400-t-b};
  }
  return null;
}
function clipBBox(c){
  if(!c) return {x:0, y:0, w:1600, h:1400};
  if(c.kind==='ellipse') return {x:c.cx-c.rx, y:c.cy-c.ry, w:c.rx*2, h:c.ry*2};
  if(c.kind==='rect') return {x:c.x, y:c.y, w:c.w, h:c.h};
  var xs=c.pts.map(function(p){return p.x;}), ys=c.pts.map(function(p){return p.y;});
  var x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs), y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
  return {x:x0, y:y0, w:x1-x0, h:y1-y0};
}
/* làm texture mây mềm (vài ellipse trắng mờ) để parallax */
function makeCloudTexture(scene){
  if(scene.textures.exists('cloudSoft')) return;
  var c = document.createElement('canvas'); c.width=280; c.height=100;
  var x = c.getContext('2d');
  function blob(cx, cy, rx, ry, a){
    var g = x.createRadialGradient(cx, cy, 2, cx, cy, rx);
    g.addColorStop(0, 'rgba(255,255,255,'+a+')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.save(); x.translate(cx, cy); x.scale(1, ry/rx); x.translate(-cx, -cy);
    x.beginPath(); x.arc(cx, cy, rx, 0, Math.PI*2); x.fill(); x.restore();
  }
  blob(70, 60, 70, 34, 0.85); blob(140, 48, 85, 38, 0.9); blob(215, 62, 65, 30, 0.85); blob(110, 72, 60, 26, 0.7);
  scene.textures.addCanvas('cloudSoft', c);
}
/* cắt sheet NPC theo đúng nội dung từng khung, căn ĐÁY (port cropRigSheetContent) */
function cropSheetBottomAligned(srcCanvas, frames){
  var fw = Math.floor(srcCanvas.width/frames), fh = srcCanvas.height;
  var sx = srcCanvas.getContext('2d');
  var data = sx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  var boxes = [];
  for(var f=0; f<frames; f++){
    var x0=fw, x1=-1, y0=fh, y1=-1;
    for(var y=0; y<fh; y++){
      for(var xx=0; xx<fw; xx++){
        var a = data[((y*srcCanvas.width)+f*fw+xx)*4+3];
        if(a>10){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(y<y0)y0=y; if(y>y1)y1=y; }
      }
    }
    if(x1<0){ x0=0; x1=fw-1; y0=0; y1=fh-1; }
    boxes.push({x0:x0, x1:x1, y0:y0, y1:y1});
  }
  var cw = Math.max.apply(null, boxes.map(function(b){return b.x1-b.x0+1;}));
  var ch = Math.max.apply(null, boxes.map(function(b){return b.y1-b.y0+1;}));
  var out = document.createElement('canvas'); out.width=cw*frames; out.height=ch;
  var ox = out.getContext('2d');
  boxes.forEach(function(b, f){
    var w=b.x1-b.x0+1, h=b.y1-b.y0+1;
    ox.drawImage(srcCanvas, f*fw+b.x0, b.y0, w, h, f*cw+Math.floor((cw-w)/2), ch-h, w, h);
  });
  return out;
}

var PH = {
  scene:null, ready:false, playerBody:null, rig:null, npcObjs:{}, fgs:[],
  zones:[], clouds:[], signs:[], bldZones:[], questMarker:null, landlord:null,
  jumpZ:0, jumpV:0, dragId:null, dragStart:null, dragMode:null, camDrag:null,
  dragT0:0, lastTapT:0, joyBase:null,
};
/* dải "đầu thoát tán": tán cây vẽ thõng xuống tới y~875 (cây lớn quảng trường),
   đầu bé cá (cao ~104px ở y~1000) sẽ chui vào lá nếu chân lên quá cao. Kẹp chân
   tối thiểu gần cây để đầu luôn ở DƯỚI mép tán — chân có đất, đầu không ở trong lá.
   minFoot = mép dưới tán + chiều cao đầu (~100-125px). */
var CANOPY = []; /* SINGLE-TOWN (đợt #6): không còn tán cây trên dải đi — cây giờ vẽ trong nền bg-town.png (tán cao nhất y<760, ngoài dải đi). walkMinY = groundTopY. */
function canopyMinY(x, headH){
  headH = headH || 125; /* chiều cao từ chân tới đỉnh đầu (bé cá 125px; NPC lấy RIGS[id].height) — tán cây ở cố định, người cao hơn thì chân phải thấp hơn (nam hơn) để đầu không chui vào lá */
  var m = -Infinity;
  for(var i=0;i<CANOPY.length;i++){
    var c = CANOPY[i], dx = Math.abs(x - c.x);
    if(dx < c.r){
      var t = 1 - (dx/c.r)*(dx/c.r); /* 1 ở tâm -> 0 ở mép tán */
      var v = (c.minFoot - 125 + headH) - (1-t)*160; /* mép tán: nới xuống 160px (lá thưa) */
      if(v > m) m = v;
    }
  }
  return m;
}
/* mép trên vùng đi được THẬT (chân tường + tán cây): NPC + bé cá đều kẹp qua đây */
function walkMinY(x, headH){
  return Math.max(groundTopY(x), canopyMinY(x, headH));
}
window.__phaserWorld = PH;
/* ĐỢT SỬA #2 (A25): debug hooks LW (mưa/xe/đèn/thú) để kiểm chứng. */
window.__phaserLW = function(){
  var cam = PH.scene.cameras.main;
  return {
    weather: LW.weather, rainT: Math.round(LW.rainT||0), rainVisible: !!(LW.rain && LW.rain.visible),
    rainPos: LW.rain ? [Math.round(LW.rain.x), Math.round(LW.rain.y)] : null,
    camScroll: [Math.round(cam.scrollX), Math.round(cam.scrollY)],
    vehicles: LW.vehicles.map(function(v){ return {kind:v.kind, x:Math.round(v.x), y:v.y, dir:v.dir}; }),
    lights: LW.lights.map(function(g){ return [Math.round(g.x), Math.round(g.y), +g.alpha.toFixed(2)]; }),
    strays: LW.strays.map(function(s){ return {id:s.id, x:Math.round(s.x), y:Math.round(s.y), dir:s.dir, state:s.state}; })
  };
};
window.__phaserForceRain = function(){ LW.weather='rainy'; LW.rainT=50; /* đợt #3: theo chu kỳ mưa mới 40-60s */ if(LW.rain){ LW.rain.setVisible(true); if(LW.rain.start) LW.rain.start(); } return 'rainy'; };
window.__phaserSetPhase = function(n){ state.timePhase = n; LW.phase = n; lwApplyPhase(PH.scene); if(typeof updateDayNight==='function') updateDayNight(); return 'phase '+n; }; /* ĐỢT SỬA #4 (A47): hook ép buổi cũng cập nhật nền trang DOM */


/* ---- BONE RIG (Phaser) — port y hệt boneSliceFacing/boneApply (DOM) ----
   Mỗi facing = 1 container chứa 14 part Image (crop từ sheet đã de-white).
   place() trong boneApply -> setPosition/setRotation/setOrigin y hệt. */
var BONE_SLOTS = null; /* lấy từ CONFIG.BECA_BONES.slots khi build */
function bonePartSpecs(facing){
  /* port boneSliceFacing: tính rect crop + pivot + display size, KHÔNG tạo canvas */
  var cfg = CONFIG.BECA_BONES.parts[facing];
  var SL = CONFIG.BECA_BONES.slots;
  var OV = 14;
  function cut(rect, slotH){
    var sc = slotH / rect.h;
    return {rect:{x:rect.x, y:rect.y, w:rect.w, h:rect.h}, sc:sc, dw:rect.w*sc, dh:slotH};
  }
  function split(rect, slotH, ball, upper){
    var by = ball.y - rect.y;
    var r = upper ? {x:rect.x, y:rect.y, w:rect.w, h:by+OV}
                  : {x:rect.x, y:rect.y+by-OV, w:rect.w, h:rect.h-(by-OV)};
    var part = cut(r, slotH*(r.h/rect.h));
    part.pivot = {x:(ball.x-rect.x)*part.sc, y:(upper ? by+OV : OV)*part.sc};
    return part;
  }
  var out = {};
  out.head = cut(cfg.head, SL.head);
  out.torso = cut(cfg.torso, SL.torso);
  out.tail = cut(cfg.tail, SL.tail);
  out.pack = cut(cfg.pack, SL.pack);
  out.palette = cut(cfg.palette, SL.palette);
  out.board = cut(cfg.board, SL.board);
  out.legNearUpper = split(cfg.legNear, SL.leg, cfg.legNear.ball, true);
  out.legNearLower = split(cfg.legNear, SL.leg, cfg.legNear.ball, false);
  out.legFarUpper = split(cfg.legFar, SL.leg, cfg.legFar.ball, true);
  out.legFarLower = split(cfg.legFar, SL.leg, cfg.legFar.ball, false);
  out.armNearUpper = split(cfg.armNear, SL.arm, cfg.armNear.ball, true);
  out.armNearLower = split(cfg.armNear, SL.arm, cfg.armNear.ball, false);
  out.armFarUpper = split(cfg.armFar, SL.arm, cfg.armFar.ball, true);
  out.armFarLower = split(cfg.armFar, SL.arm, cfg.armFar.ball, false);
  return out;
}
/* áp 1 pose lên 1 facing (port boneApply) — parts: {name: Image} */
function boneApplyPhaser(parts, specs, pose, facing){
  var L = BONE_LIMB, fk = boneFK(pose, facing);
  var W = 92, cx = W/2;
  function place(name, x, y, rotDeg, ox, oy){
    var img = parts[name]; if(!img) return;
    var sp = specs[name];
    img.setOrigin(ox/sp.dw, oy/sp.dh);
    img.setPosition(x - cx, y - 140); /* rig box 92x140, chân ở (0,0) local */
    img.setRotation(rotDeg * Math.PI/180);
  }
  var hipY = L.hipY - pose.bob, shY = L.shoulderY - pose.bob, neckY = L.neckY - pose.bob;
  var lean = pose.lean;
  /* thứ tự vẽ: xa -> gần (như boneApply) — thứ tự add đã đúng, chỉ cần đặt vị trí */
  place('tail', cx-6, hipY+6, pose.tail, specs.tail.dw*0.8, specs.tail.dh*0.5);
  place('legFarUpper', cx+fk.hip.x, hipY, pose.hipR+lean, specs.legFarUpper.dw/2, 2);
  place('legFarLower', cx+fk.kR.x, fk.kR.y, pose.hipR-pose.kneeR+lean, specs.legFarLower.pivot.x, specs.legFarLower.pivot.y);
  place('armFarUpper', cx+fk.sh.x, shY, pose.shR+lean, specs.armFarUpper.dw/2, 2);
  place('armFarLower', cx+fk.eR.x, fk.eR.y, pose.shR-pose.elR+lean, specs.armFarLower.pivot.x, specs.armFarLower.pivot.y);
  place('torso', cx, hipY, lean, specs.torso.dw/2, specs.torso.dh);
  place('pack', cx, shY, lean, specs.pack.dw*0.5, specs.pack.dh*0.5);
  place('head', cx, neckY, pose.neck+lean*0.5, specs.head.dw/2, specs.head.dh*0.85);
  place('legNearUpper', cx+fk.hip.x, hipY, pose.hipL+lean, specs.legNearUpper.dw/2, 2);
  place('legNearLower', cx+fk.kL.x, fk.kL.y, pose.hipL-pose.kneeL+lean, specs.legNearLower.pivot.x, specs.legNearLower.pivot.y);
  place('armNearUpper', cx+fk.sh.x, shY, pose.shL+lean, specs.armNearUpper.dw/2, 2);
  place('armNearLower', cx+fk.eL.x, fk.eL.y, pose.shL-pose.elL+lean, specs.armNearLower.pivot.x, specs.armNearLower.pivot.y);
  place('palette', cx+fk.hR.x-8, fk.hR.y+4, pose.shR-pose.elR+lean, specs.palette.dw/2, specs.palette.dh/2);
  place('board', cx+fk.hR.x+10, fk.hR.y-6, pose.shR-pose.elR+lean, specs.board.dw/2, specs.board.dh/2);
}
/* build 1 facing: tạo 14 part Image từ texture đã de-white.
   MỖI PART LÀ 1 TEXTURE CANVAS RIÊNG (cắt từ sheet) — KHÔNG dùng setCrop.
   Lý do: Phaser tính origin/displayWidth theo KHUNG ĐẦY ĐỦ (1600×1600),
   không theo vùng crop; dùng setCrop khiến mỗi part lệch theo rect.x/rect.y
   của nó (renderer: x = -displayOriginX + crop.x) -> rig vỡ vụn trên màn hình.
   Texture riêng thì khung chính là part -> setOrigin/setScale/setPosition
   (boneApplyPhaser) đúng như bản DOM. */
function buildBoneFacing(scene, rigRoot, facing, texKey){
  var specs = bonePartSpecs(facing);
  var cont = scene.add.container(0, 0);
  rigRoot.add(cont);
  var parts = {};
  var order = ['tail','legFarUpper','legFarLower','armFarUpper','armFarLower','torso','pack','head','legNearUpper','legNearLower','armNearUpper','armNearLower','palette','board'];
  var src = null;
  var stex = scene.textures.get(texKey);
  if(stex) src = stex.getSourceImage();
  order.forEach(function(name){
    var sp = specs[name];
    var img;
    if(src && sp.rect.w > 1 && sp.rect.h > 1){
      var partKey = texKey + '-p-' + name;
      if(!scene.textures.exists(partKey)){
        var cw = Math.max(1, Math.round(sp.rect.w)), ch = Math.max(1, Math.round(sp.rect.h));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var cx2 = cv.getContext('2d');
        cx2.drawImage(src, sp.rect.x, sp.rect.y, sp.rect.w, sp.rect.h, 0, 0, cw, ch);
        scene.textures.addCanvas(partKey, cv);
      }
      img = scene.add.image(0, 0, partKey);
    } else {
      img = scene.add.image(0, 0, texKey);
      img.setCrop(sp.rect.x, sp.rect.y, sp.rect.w, sp.rect.h);
    }
    img.setScale(sp.sc);
    img.setOrigin(0.5, 0.5);
    cont.add(img);
    parts[name] = img;
  });
  /* khay + bảng CHỈ ở chế độ vẽ — trên map tay trống (luật live 19/11) */
  parts.palette.setVisible(false);
  parts.board.setVisible(false);
  return {cont:cont, parts:parts, specs:specs, ready:true};
}
/* trạng thái rig bé cá (port becaBone, bỏ DOM) */
var rigState = {
  state:'idle', phase:0, facing:'sideR', turnTo:'sideR', turnT:0,
  blendT:1, blendFrom:null, blendDur:0.16, cur:null, lastNow:0,
};
function boneFacingForPhaser(dir){
  if(dir==='right') return 'sideR';
  if(dir==='left') return 'sideL';
  if(dir==='up') return 'front';
  if(dir==='down') return 'front';
  return rigState.facing;
}
function rigSetStatePhaser(next){
  if(next===rigState.state) return;
  rigState.blendFrom = rigState.cur ? JSON.parse(JSON.stringify(rigState.cur)) : bonePoseFor(rigState.state, rigState.phase);
  rigState.state = next;
  rigState.blendT = 0;
  rigState.blendDur = next==='jump' ? 0.24 : 0.16;
}
function rigPose(){
  var p = rigState.cur || {};
  return {facing:rigState.facing, facingNext:rigState.turnTo, facingMix:rigState.turnT>0?Math.min(1,rigState.turnT/0.2):0,
    state:rigState.state, phase:rigState.phase, hipL:p.hipL||0, kneeL:p.kneeL||0, hipR:p.hipR||0, kneeR:p.kneeR||0,
    shoulderL:p.shL||0, elbowL:p.elL||0, blendT:rigState.blendT};
}
/* nhảy — DẤU ĐÚNG (khác boneJumpTick DOM): jumpZ += -vy*dt, vy âm = đi LÊN */
function phaserJumpTick(dt){
  if(!becaJump) return;
  becaJump.t += dt;
  if(becaJump.phase==='crouch'){
    PH.jumpZ = 0;
    if(becaJump.t<=0.05) PH.jumpMax = 0; /* đầu nhảy mới: reset đỉnh (để probe đọc chắc, không phụ thuộc nhịp lấy mẫu) */
    if(becaJump.t>=0.18){ becaJump.phase='air'; becaJump.t=0; becaJump.vy=-511; }
  } else if(becaJump.phase==='air'){
    becaJump.vy += 1900*dt;
    PH.jumpZ -= becaJump.vy*dt; /* vy=-511 -> jumpZ tăng (bay LÊN) */
    if(PH.jumpZ>(PH.jumpMax||0)) PH.jumpMax = PH.jumpZ; /* đỉnh nhảy cao nhất của lần này */
    if(PH.jumpZ<=0){ PH.jumpZ=0; becaJump.phase='land'; becaJump.t=0; }
  } else if(becaJump.phase==='land' && becaJump.t>=0.22){
    becaJump=null; PH.jumpZ=0;
  }
}

/* ---- SCENE ---- */
function buildZoneImages(scene){
  /* SINGLE-TOWN (đợt #6): 1 nền duy nhất 1600x1400 tại (0,0), depth -100. */
  var img = scene.add.image(0, 0, 'bg-town');
  img.setOrigin(0, 0);
  img.setDepth(-100);
  PH.zones.push(img);
}
/* KHÔNG còn dùng với nền 3D (không có đường nối) — giữ lại để rollback panorama. */
function makeSeamStrip(scene, zid, bx){
  var z = CONFIG.ZONES.find(function(zz){return zz.id===zid;});
  if(!z) return;
  var c = coverFor(zid);
  var src = scene.textures.get('zone-'+zid).getSourceImage();
  var key = 'seamStrip-'+zid;
  if(scene.textures.exists(key)) scene.textures.remove(key);
  var s0 = dispToSrc(zid, -48, 0), s1 = dispToSrc(zid, 0, 0);
  var cv = document.createElement('canvas'); cv.width=48; cv.height=1400;
  var x = cv.getContext('2d');
  x.drawImage(src, s0.x, s0.y, s1.x-s0.x, c.sh, 0, 0, 48, 1400);
  x.globalCompositeOperation = 'destination-in';
  var g = x.createLinearGradient(0, 0, 48, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = g; x.fillRect(0, 0, 48, 1400);
  scene.textures.addCanvas(key, cv);
  var im = scene.add.image(bx - 48, 0, key);
  im.setOrigin(0, 0);
  im.setDepth(-99);
}
/* ---- TIỀN CẢNH (đợt sửa #6 — SINGLE-TOWN): FG3D RỖNG — bỏ hết 18 sprite
   3D cũ (cây/cọ/chậu/đài/xe/bàn/ghế/đèn). Mọi vật giờ vẽ trong nền duy nhất
   bg-town.png; buildForeground không vẽ gì, PH.fgs rỗng (tint đài phun ở
   lwApplyPhase thành no-op). */
/* ---- TIỀN CẢNH (đợt #8 — SINGLE-TOWN FG): 18 sprite fg-town
   crop từ bg-town.png FINAL (sha d031ee1a, composite 0 pixel khác nền).
   add.image(anchor).setDepth(foot_y) — Y-sort thật (LAYOUT-FG.md §2/§4). */
var FG3D = [
  {id:'fgtower', key:'fg3d-tower', file:'map3d/fg-town-tower-c.png?v=r11.2', ax:1336, ay:1138, depth:1830, zone:'town'},
  {id:'fgpalace', key:'fg3d-palace', file:'map3d/fg-town-palace-c.png?v=r11.2', ax:146, ay:2784, depth:3252, zone:'town'},
  {id:'fgpagoda', key:'fg3d-pagoda', file:'map3d/fg-town-pagoda-c.png?v=r11.2', ax:2638, ay:1238, depth:1922, zone:'town'},
  {id:'fghousesbitexco', key:'fg3d-houses-bitexco', file:'map3d/fg-town-houses-bitexco-c.png?v=r11.2', ax:1899, ay:1135, depth:1281, zone:'town'},
  {id:'fghousesleft', key:'fg3d-houses-left', file:'map3d/fg-town-houses-left-c.png?v=r11.2', ax:546, ay:2151, depth:2383, zone:'town'},
  {id:'fghousesmid', key:'fg3d-houses-mid', file:'map3d/fg-town-houses-mid-c.png?v=r11.2', ax:2835, ay:2189, depth:2392, zone:'town'},
  {id:'fghousesbr', key:'fg3d-houses-br', file:'map3d/fg-town-houses-br-c.png?v=r11.2', ax:1596, ay:2789, depth:2972, zone:'town'},
  {id:'fghousessq', key:'fg3d-houses-sq', file:'map3d/fg-town-houses-sq-c.png?v=r11.2', ax:2076, ay:2108, depth:2317, zone:'town'},
  {id:'fgbushpalace', key:'fg3d-bush-palace', file:'map3d/fg-town-bush-palace-c.png?v=r11.2', ax:216, ay:2684, depth:2885, zone:'town'},
  {id:'fgtreetower1', key:'fg3d-tree-tower-1', file:'map3d/fg-town-tree-tower-1-c.png?v=r11.2', ax:945, ay:1696, depth:1806, zone:'town'},
  {id:'fgtreetower2', key:'fg3d-tree-tower-2', file:'map3d/fg-town-tree-tower-2-c.png?v=r11.2', ax:1318, ay:1718, depth:1810, zone:'town'},
  {id:'fgtreetower3', key:'fg3d-tree-tower-3', file:'map3d/fg-town-tree-tower-3-c.png?v=r11.2', ax:1506, ay:1718, depth:1803, zone:'town'},
  {id:'fgtreetower4', key:'fg3d-tree-tower-4', file:'map3d/fg-town-tree-tower-4-c.png?v=r11.2', ax:1709, ay:1718, depth:1803, zone:'town'},
  {id:'fgtreetower5', key:'fg3d-tree-tower-5', file:'map3d/fg-town-tree-tower-5-c.png?v=r11.2', ax:1899, ay:1726, depth:1810, zone:'town'},
  {id:'fgtreemidl', key:'fg3d-tree-mid-l', file:'map3d/fg-town-tree-mid-l-c.png?v=r11.2', ax:2799, ay:2262, depth:2352, zone:'town'},
  {id:'fgtreemidr', key:'fg3d-tree-mid-r', file:'map3d/fg-town-tree-mid-r-c.png?v=r11.2', ax:3097, ay:2278, depth:2359, zone:'town'},
  {id:'fgtreebrl', key:'fg3d-tree-br-l', file:'map3d/fg-town-tree-br-l-c.png?v=r11.2', ax:1623, ay:2815, depth:2929, zone:'town'},
  {id:'fgtreebrr', key:'fg3d-tree-br-r', file:'map3d/fg-town-tree-br-r-c.png?v=r11.2', ax:2366, ay:2815, depth:2929, zone:'town'},
  {id:'fgtreebitexco3', key:'fg3d-tree-bitexco-3', file:'map3d/fg-town-tree-bitexco-3-c.png?v=r11.2', ax:2566, ay:951, depth:1171, zone:'town'},
];
function buildForeground(scene){
  FG3D.forEach(function(f){
    var img = scene.add.image(f.ax, f.ay, f.key);
    img.setOrigin(0, 0);
    img.setDepth(f.depth);
    PH.fgs.push({id:f.id, zone:f.zone, y:f.depth, img:img});
  });
}
function buildClouds(scene){
  makeCloudTexture(scene);
  [[788,105,390,135],[2813,225,330,120]] /* SINGLE-TOWN: 2 mây trong khu 2400 (R9 x1.5) */.forEach(function(cd){
    var im = scene.add.image(cd[0], cd[1], 'cloudSoft');
    im.setOrigin(0, 0);
    im.setDisplaySize(cd[2], cd[3]);
    im.setScrollFactor(0.38);
    im.setDepth(-50);
    im.setAlpha(0.9);
    PH.clouds.push(im);
  });
}
function buildSignsAndBuildings(scene){
  (CONFIG.BUILDINGS||[]).forEach(function(b){
    if(b.sign){
      /* ĐỢT SỬA #1: chữ dài (>16 ký tự: 'Cơm Tấm Ba Ghiền', 'Quán Ốc Chú Bảy') dùng
         22px để vừa bảng 3D (rộng = shop w*0.8 = 272px); 26px tràn 16-37px. */
      var signFs = b.sign.text.length > 16 ? '22px' : '26px';
      var t = scene.add.text(b.sign.x, b.sign.y, b.sign.text, {
        fontFamily:'system-ui, sans-serif', fontSize:signFs, fontStyle:'bold',
        color:'#fff', backgroundColor:b.sign.bg, padding:{x:12, y:6},
      });
      t.setOrigin(0.5, 0.5);
      t.setDepth(700);
      PH.signs.push(t);
    }
    if(b.nohot || b.action==='none') return;
    var zn = scene.add.zone(b.rect[0]+b.rect[2]/2, b.rect[1]+b.rect[3]/2, b.rect[2], b.rect[3]);
    zn.setInteractive({useHandCursor:true});
    zn.setData('bldId', b.id);
    PH.bldZones.push(zn);
  });
}
/* texture NPC: de-white lan/nam/mimi (+ crop Mimi căn đáy), trả về key texture dùng được */
function npcTextureKey(scene, id, sheet){
  var cfg = RIGS[id];
  var url = cfg[sheet];
  var baseKey = 'rig-'+id+'-'+sheet;
  var needsWhite = (id==='lan'||id==='nam'||id==='mimi');
  if(!needsWhite) return baseKey;
  var cleanKey = baseKey+'-clean';
  if(scene.textures.exists(cleanKey)) return cleanKey;
  var tex = scene.textures.get(baseKey);
  if(!tex || !tex.getSourceImage()) return baseKey;
  var img = tex.getSourceImage();
  if(!img.naturalWidth && !img.width) return baseKey;
  var clean = boneDeWhite(img);
  if(id==='mimi' && sheet==='walk'){
    clean = cropSheetBottomAligned(clean, cfg.walkFrames);
  }
  scene.textures.addCanvas(cleanKey, clean);
  return cleanKey;
}
/* ĐỢT SỬA #2 (A15): parse sheet thành spritesheet frames, KHÔNG dùng setCrop.
   addSpriteSheet với source là Texture: gắn frames vào texture ĐÃ CÓ (không nhân
   đôi GPU). setFrame(i) chọn khung, căn giữa đúng tâm game object. */
function ensureSheetFrames(scene, sheetKey, frames){
  var tex = scene.textures.get(sheetKey);
  if(!tex || tex._m2frames) return;
  var src = tex.getSourceImage();
  if(!src) return;
  var w = src.width || tex.width, h = src.height || tex.height;
  var fw = Math.max(1, Math.floor(w/Math.max(1, frames)));
  if(!fw || !h) return;
  scene.textures.addSpriteSheet(sheetKey, tex, {frameWidth: fw, frameHeight: h});
  tex._m2frames = true;
}
function npcAspect(scene, id, sheet){
  var key = npcTextureKey(scene, id, sheet);
  var tex = scene.textures.get(key);
  if(!tex) return 0.62;
  var fr = tex.getSourceImage();
  var w = fr.width || tex.width, h = fr.height || tex.height;
  var frames = sheet==='walk' ? RIGS[id].walkFrames : RIGS[id].jumpFrames;
  if(!w || !h || !frames) return 0.62;
  return (w/frames)/h;
}

/* ---- NPC (Phaser) ---- */
function buildNpc(scene, id){
  var n = npcs[id];
  var cfg = RIGS[id];
  var cont = scene.add.container(n.x, n.y);
  var key = npcTextureKey(scene, id, 'walk');
  var tex = scene.textures.get(key);
  var fr = tex ? tex.getSourceImage() : null;
  var fw = fr ? (fr.width||tex.width)/cfg.walkFrames : 60;
  var fh = fr ? (fr.height||tex.height) : 100;
  var asp = fw/Math.max(1, fh);
  var dispH = cfg.height, dispW = Math.round(dispH*asp);
  var img = scene.add.image(0, 0, key);
  img.setOrigin(0.5, 1);
  ensureSheetFrames(scene, key, cfg.walkFrames); /* ĐỢT SỬA #2 (A15): spritesheet, không setCrop */
  img.setFrame(0);
  /* scale theo KHUNG CROP (fw×fh), KHÔNG dùng setDisplaySize — nó tính scale
     theo cả sheet (fw×frames) nên NPC chỉ còn 1/frames chiều rộng = vệt mảnh */
  img.setScale(dispW/fw, dispH/fh);
  cont.add(img);
  /* ĐỢT SỬA #4 (A44): bóng ellipse dưới chân NPC — tạo NGAY trong buildNpc.
     Gốc: vòng lặp bóng ở cuối buildLivingWorld chạy TRƯỚC buildNpc nên
     PH.npcObjs còn rỗng, không bóng nào được tạo (live đợt #3: NPC không có
     bóng). livingWorldTick đã có sẵn code đặt vị trí/tỉ lệ/alpha cho
     LW.npcShadows theo hướng nắng. */
  var _sh = scene.add.ellipse(0, 4, Math.round(dispW*0.7), 11, 0x000000, 0.22);
  cont.addAt(_sh, 0);
  LW.npcShadows[id] = _sh;
  /* Zone chạm đúng cỡ thân (ảnh crop có hitArea = cả sprite sheet nên bắt tap từ xa).
     Zone phải là con của SCENE (Zone trong Container không được hit-test) -> cập nhật
     vị trí + tỉ lệ mỗi khung trong syncNpcPhaser. */
  var zn = scene.add.zone(n.x, n.y, dispW+16, dispH+8);
  zn.setOrigin(0.5, 1);
  zn.setInteractive({useHandCursor:true});
  zn.setData('npcId', id);
  zn.setDepth(Math.round(n.y)+1);
  var name = scene.add.text(0, -dispH-20, '', {fontFamily:'system-ui, sans-serif', fontSize:'12px', fontStyle:'bold', color:'#fff', stroke:'#5C3D1E', strokeThickness:4, shadow:{offsetX:1, offsetY:1, color:'#000', blur:2, fill:true}}); /* ĐỢT SỬA #2 (A24): viền đậm + bóng để đọc được trên nền sáng (đau mắt) */
  name.setOrigin(0.5, 0);
  cont.add(name);
  var bubble = scene.add.text(0, -dispH-44, '', {fontFamily:'system-ui, sans-serif', fontSize:'12px', color:'#5C3D1E', backgroundColor:'#FFF8E7', padding:{x:6, y:4}}); /* bong bong TREN ten (cu -dispH-8, chong len ten) */
  bubble.setOrigin(0.5, 1);
  bubble.setVisible(false);
  cont.add(bubble);
  var chat = scene.add.text(0, -dispH-44, '', {fontFamily:'system-ui, sans-serif', fontSize:'12px', color:'#5C3D1E', backgroundColor:'#FFFFFF', padding:{x:6, y:4}});
  chat.setOrigin(0.5, 1);
  chat.setVisible(false);
  cont.add(chat);
  cont.setDepth(Math.round(n.y));
  PH.npcObjs[id] = {cont:cont, img:img, name:name, bubble:bubble, chat:chat, zone:zn, dispW:dispW, dispH:dispH, frame:-1, sheet:'', lastName:'', lastBubble:'', lastChat:''};
  return PH.npcObjs[id];
}
/* đồng bộ 1 NPC từ state game (gọi mỗi khung trong npcTick) — port logic renderMap */
function syncNpcPhaser(n){
  var o = PH.npcObjs[n.id];
  if(!o || !PH.scene || !PH.ready) return;
  var cfg = RIGS[n.id];
  var sheet = n.rig.sheet || 'walk';
  var key = npcTextureKey(PH.scene, n.id, sheet);
  var tex = PH.scene.textures.get(key);
  if(tex){
    var fr = tex.getSourceImage();
    var frames = sheet==='walk' ? cfg.walkFrames : cfg.jumpFrames;
    var fw = (fr.width||tex.width)/frames, fh = fr.height||tex.height;
    if(o.sheet!==sheet){
      ensureSheetFrames(PH.scene, key, sheet==='walk' ? cfg.walkFrames : cfg.jumpFrames);
      o.img.setTexture(key);
      o.img.setScale(o.dispW/fw, o.dispH/fh);
      o.sheet = sheet; o.frame = -1;
    }
    if(o.frame!==n.rig.frame){
      o.img.setFrame(n.rig.frame); /* ĐỢT SỬA #2 (A15): setFrame thay setCrop */
      o.frame = n.rig.frame;
    }
  }
  var sc = n.rig.scale || depthScale(n.y);
  var sy = n.rig.sy || 1;
  var chatting = !!(n.chat && performance.now() < n.chat.until);
  if(chatting) sy = 1 + 0.03*Math.sin(performance.now()/90);
  o.cont.setScale(sc, sc*sy);
  o.cont.setPosition(n.x, n.y - (n.rig.yOff||0));
  o.cont.setDepth(Math.round(n.y));
  if(o.zone){ o.zone.setPosition(n.x, n.y - (n.rig.yOff||0)); o.zone.setDepth(Math.round(n.y)+1); o.zone.setScale(sc, sc*sy); }
  o.img.setFlipX(!!n.rig.flip);
  o.img.setRotation((n.rig.lean||0)*Math.PI/180);
  var c = null;
  for(var i=0;i<CUSTOMERS.length;i++) if(CUSTOMERS[i].id===n.id) c=CUSTOMERS[i];
  var nm = c ? c.name : (n.id==='chu' ? 'Ông chủ nhà' : n.id);
  /* ĐỢT SỬA #4 (A42): dấu ✅ của khách đã phục vụ gắn vào TÊN NPC (như badge nhiệm
     vụ) thay vì bong bóng trôi nổi trên nền đất trống (live đợt #3). */
  var _cIdx = state.customersToday.indexOf(n.id);
  var _served = _cIdx>=0 && state.served.indexOf(_cIdx)>=0;
  var qg = questByGiver(n.id);
  var badge = '';
  if(qg){ var st = questState(qg.id); badge = st.status==='done' ? ' ✅' : st.status==='active' ? ' ⭐' : ' ❗'; }
  else if(_served) badge = ' ✅';
  var nameTxt = nm + badge;
  if(nameTxt!==o.lastName){ o.name.setText(nameTxt); o.lastName=nameTxt; }
  var bubTxt = '';
  if(n.id==='chu'){ bubTxt = 'Bán tiệm 5.000đ!'; }
  else if(c){
    var idx = state.customersToday.indexOf(n.id);
    var isToday = idx>=0, served = isToday && state.served.indexOf(idx)>=0;
    if(isToday && !served && idx===state.custIdx && Math.hypot(n.x-beca.x, n.y-beca.y) < 300){ /* bong bong yeu cau chi hien khi Be Ca o gan NPC (cu hien moi luc, trong nhu tren dau Be Ca) */
      var rq = state.requestsToday[idx];
      var base = rq ? REQUESTS.find(function(r){return r.id===rq.id;}) : null;
      if(base) bubTxt = state.lang==='vi' ? base.vi : base.en;
    } /* ĐỢT SỬA #4 (A42): khách đã phục vụ không còn bong bóng '✅' riêng — dấu ✅ đã gắn vào tên NPC ở trên. */
  }
  if(bubTxt!==o.lastBubble){ o.bubble.setText(bubTxt); o.bubble.setVisible(!!bubTxt); o.lastBubble=bubTxt; }
  var chatTxt = chatting ? n.chat.text : '';
  if(chatTxt!==o.lastChat){ o.chat.setText(chatTxt); o.chat.setVisible(!!chatTxt); o.lastChat=chatTxt; }
}
/* ĐỢT SỬA #3 (A26): tách NPC CỨNG theo biên sprite THẤY ĐƯỢC (GỐC live đợt #2:
   bé cá đi xuyên/chồng lên NPC — minD tròn cũ chỉ dùng NỬA RỘNG (rx~110px) nên
   khi đi dọc (lên/xuống) 2 sprite cao ~180px vẫn chồng nhau ~70px theo chiều
   dọc, nhìn như đi xuyên vào người. Ellipse: rx = nửa rộng cộng lại (ngang),
   ry = 0,85 x chiều cao lớn hơn (dọc, cho phép che chân ~15% như che khuất
   tự nhiên). Đẩy dọc gradient ellipse, không đẩy tròn. NPC trên cầu thang/
   sân thượng: chỉ đẩy bé cá (không đẩy NPC ra khỏi đường đi của nó). */
function npcEllipse(a, b){
  var rx = (a.halfW + b.halfW) * 1.08 + 6;
  var ry = Math.max(a.dispH*a.scale, b.dispH*b.scale) * 0.85 + 10;
  return {rx:rx, ry:ry};
}
function ellipsePush(e, dx, dy){
  /* trả về {gx, gy, push} để đưa q=sqrt((dx/rx)^2+(dy/ry)^2) về 1 dọc gradient;
     null nếu đã tách (q>=1). q~0 (chồng khít): đẩy thẳng xuống nam 1 ry. */
  var q0 = Math.hypot(dx/e.rx, dy/e.ry);
  if(q0 >= 1) return null;
  if(q0 < 0.01) return {gx:0, gy:1, push:Math.min(e.ry, 40)}; /* ĐỢT SỬA #4 (A37): kẹp đẩy chồng khít ≤40px */
  var gx = (dx/e.rx)/e.rx, gy = (dy/e.ry)/e.ry;
  var gl = Math.hypot(gx, gy) || 1;
  gx/=gl; gy/=gl;
  var push = (1 - q0) * q0 / gl;
  /* ĐỢT SỬA #3 (A26c): đẩy tối thiểu 10px/khung — 20px cũ gây NHẢY vị trí
     (kiểm CDP đợt #3: bé cá nhảy 228px/0,5s khi bị kẹt gần Bà Tư, nhìn như
     teleport). 10px thắng xâm nhập 6px/khung ở 60fps; phần còn lại do trượt
     tiếp tuyến (A26b) đưa bé cá vòng qua NPC, không cần đẩy mạnh. */
  if(push < 10) push = 10;
  /* ĐỢT SỬA #4 (A37): kẹp đẩy tối đa 40px/khung — xem ghi chú A37 ở trên. */
  if(push > 40) push = 40;
  return {gx:gx, gy:gy, push:push};
}
function slideAlongNpcs(dt){
  var body = PH.playerBody && PH.playerBody.body;
  if(!body) return;
  var vx = body.velocity.x, vy = body.velocity.y;
  if(!vx && !vy) return;
  var ovx = vx, ovy = vy, sp = Math.hypot(vx, vy);
  var near = null, nearD = 1e9;
  for(var id in npcs){
    var n = npcs[id];
    if(!n) continue;
    var o = PH.npcObjs[id];
    if(!o) continue;
    var e = npcEllipse(
      {halfW:46*depthScale(beca.y), dispH:140, scale:depthScale(beca.y)},
      {halfW:(o.dispW/2)*(n.rig.scale || depthScale(n.y)), dispH:o.dispH, scale:(n.rig.scale || depthScale(n.y))});
    var ep = ellipsePush(e, beca.x - n.x, beca.y - n.y);
    if(!ep) continue;
    var dd = Math.hypot(beca.x - n.x, beca.y - n.y);
    if(dd < nearD){ nearD = dd; near = n; }
    var vr = vx*ep.gx + vy*ep.gy;
    if(vr < 0){ vx -= ep.gx*vr; vy -= ep.gy*vr; }
  }
  /* ĐỢT SỬA #3 (A26b): đi thẳng tâm NPC (không còn tiếp tuyến) thì lệch tiếp
     tuyến 110px/s về phía thoáng hơn — cũ: vận tốc bị triệt tiêu hẳn, bé cá
     đứng yên trước mặt NPC (kẹt, kiểm CDP đợt #3: đâm bắc vào Hoa 3s không
     nhúc nhích, kéo đông ở y=1300 kẹt ở x=420; live đợt #2: qua 1 khu 60-90s). */
  var sp2 = Math.hypot(vx, vy);
  if(sp2 < 40 && sp > 40){
    var tx = -ovy/sp, ty = ovx/sp;
    var px = beca.x + tx*70, py = beca.y + ty*70;
    var qx = beca.x - tx*70, qy = beca.y - ty*70;
    var pOk = !hitsSolid(px, py) && px>=WALK.x0 && px<=WALK.x1 && py>=walkMinY(px) && py<=WALK.y1;
    var qOk = !hitsSolid(qx, qy) && qx>=WALK.x0 && qx<=WALK.x1 && qy>=walkMinY(qx) && qy<=WALK.y1;
    if(!pOk && qOk){ tx = -tx; ty = -ty; }
    else if(pOk && qOk && near){
      var dp = Math.hypot(px-near.x, py-near.y), dq = Math.hypot(qx-near.x, qy-near.y);
      if(dq > dp){ tx = -tx; ty = -ty; }
    }
    vx += tx*110; vy += ty*110;
  }
  body.setVelocity(vx, vy);
}
/* ĐỢT SỬA #3 (A27): trượt dọc vật cản — bé cá không kẹt sau gốc cọ/bồn đá.
   Arcade collider chỉ tách vị trí, không đổi hướng vận tốc: kéo thẳng vào
   thân cây thì vận tốc vẫn chĩa vào cây -> đứng yên (kẹt, live đợt #2: kéo
   bắc vào gốc cọ 3s chỉ đi được 80px). Loại bỏ thành phần vận tốc xuyên vào
   vật cản, giữ thành phần tiếp tuyến; nếu đi thẳng tâm (không còn tiếp tuyến)
   thì thêm độ lệch tiếp tuyến 110px/s về phía thoáng hơn -> trượt vòng qua. */
function slideAlongObstacles(dt){
  var body = PH.playerBody && PH.playerBody.body;
  if(!body) return;
  var vx = body.velocity.x, vy = body.velocity.y;
  if(!vx && !vy) return;
  var ovx = vx, ovy = vy, sp = Math.hypot(vx, vy);
  var near = null, nearD = 1e9;
  var i, j;
  for(i=0; i<OBSTACLES.length; i++){
    var o = OBSTACLES[i];
    var dx = beca.x - o.x, dy = beca.y - o.y;
    var d = Math.hypot(dx, dy);
    var min = o.r + 18 + 8;
    if(d >= min || d < 0.01) continue;
    if(d < nearD){ nearD = d; near = o; }
    var nx = dx/d, ny = dy/d;
    var vr = vx*nx + vy*ny;
    if(vr < 0){ vx -= nx*vr; vy -= ny*vr; }
  }
  for(j=0; j<CONFIG.BUILDINGS.length; j++){
    var b = CONFIG.BUILDINGS[j];
    if(!b.solid) continue;
    var r = b.rect;
    var ex0 = r[0]-18-8, ey0 = r[1]-18-8, ex1 = r[0]+r[2]+18+8, ey1 = r[1]+r[3]+18+8;
    if(beca.x < ex0 || beca.x > ex1 || beca.y < ey0 || beca.y > ey1) continue;
    var dl = beca.x - ex0, dr = ex1 - beca.x, dt2 = beca.y - ey0, db = ey1 - beca.y;
    var m = Math.min(dl, dr, dt2, db);
    var nx2 = 0, ny2 = 0;
    if(m===dl){ nx2=-1; } else if(m===dr){ nx2=1; } else if(m===dt2){ ny2=-1; } else { ny2=1; }
    var vr2 = vx*nx2 + vy*ny2;
    if(vr2 < 0){ vx -= nx2*vr2; vy -= ny2*vr2; }
  }
  var sp2 = Math.hypot(vx, vy);
  if(sp2 < 40 && sp > 40){
    /* đi thẳng tâm vật cản: lệch tiếp tuyến (vuông góc hướng kéo gốc) */
    var tx = -ovy/sp, ty = ovx/sp;
    var px = beca.x + tx*70, py = beca.y + ty*70;
    var qx = beca.x - tx*70, qy = beca.y - ty*70;
    var pOk = !hitsSolid(px, py) && px>=WALK.x0 && px<=WALK.x1 && py>=walkMinY(px) && py<=WALK.y1;
    var qOk = !hitsSolid(qx, qy) && qx>=WALK.x0 && qx<=WALK.x1 && qy>=walkMinY(qx) && qy<=WALK.y1;
    if(!pOk && qOk){ tx = -tx; ty = -ty; }
    else if(pOk && qOk && near){
      /* cả 2 thoáng: chọn phía xa tâm vật cản hơn */
      var dp = Math.hypot(px-near.x, py-near.y), dq = Math.hypot(qx-near.x, qy-near.y);
      if(dq > dp){ tx = -tx; ty = -ty; }
    }
    vx += tx*110; vy += ty*110;
  }
  body.setVelocity(vx, vy);
}
function separateNpcs(scene){
  for(var id in npcs){
    var n = npcs[id];
    if(!n) continue;
    var o = PH.npcObjs[id];
    if(!o) continue;
    var e = npcEllipse(
      {halfW:46*depthScale(beca.y), dispH:140, scale:depthScale(beca.y)},
      {halfW:(o.dispW/2)*(n.rig.scale || depthScale(n.y)), dispH:o.dispH, scale:(n.rig.scale || depthScale(n.y))});
    var ep = ellipsePush(e, n.x - beca.x, n.y - beca.y);
    if(!ep) continue;
    /* ĐỢT #7 (An 00:09): NPC đứng yên — KHÔNG đẩy NPC. Toàn bộ ep.push dồn vào
       beca (beca bị đẩy lùi, trượt vòng qua NPC nhờ slideAlongNpcs). Gốc lỗi
       đợt #6: đẩy NPC 0.7*push mỗi khung -> Bà Tư trôi 428px, Mimi 320px. */
    var moved = 0;
    var remain = ep.push - moved;
    if(remain > 0.5){
      beca.x = Math.min(WALK.x1, Math.max(WALK.x0, beca.x - ep.gx*remain));
      beca.y = Math.min(WALK.y1, Math.max(walkMinY(beca.x), beca.y - ep.gy*remain));
      /* ĐỢT SỬA #3 (A26c): GIỮ vận tốc khi reset body — body.reset() của Phaser
         đặt vận tốc về 0, làm slideAlongNpcs (chạy sau) thấy vel=(0,0) và bỏ qua
         -> bé cá đứng yên trước mặt NPC (kẹt, kiểm CDP đợt #3: vel=0 suốt 1s
         gần Bà Tư, kéo đông y=1300 kẹt ở x=420). Lưu/khôi phục vận tốc. */
      if(PH.playerBody){
        var _pvx = PH.playerBody.body.velocity.x, _pvy = PH.playerBody.body.velocity.y;
        PH.playerBody.body.reset(beca.x, beca.y);
        PH.playerBody.body.setVelocity(_pvx, _pvy);
      }
    }
  }
  /* ĐỢT #7 (An 00:09): bỏ tách NPC<->NPC — 6 NPC đứng yên, cách nhau >=250px, không bao giờ chồng lên nhau nên không cần tách. */
}

/* ---- PLAYER (rig + physics body) ---- */
/* đổi sheet/khung của bé cá (kiểu syncNpcPhaser của NPC): đổi texture thì
   setScale theo khung crop rồi mới setCrop — KHÔNG dùng setDisplaySize vì
   Phaser tính theo khung đầy đủ của sheet. Ảnh đã trong suốt sẵn, không de-white. */
function becaSpriteSet(scene, sheet, frame){
  var o = PH.rig; if(!o || !o.img) return;
  var cfg = RIGS.beca;
  var key = sheet==='idle' ? 'rig-beca-idle' : 'rig-beca-'+sheet;
  var tex = scene.textures.get(key);
  if(!tex || !tex.getSourceImage() || !tex.getSourceImage().width){
    o.img.setVisible(false); o.fallback.setVisible(true); return;
  }
  o.img.setVisible(true); o.fallback.setVisible(false);
  var fr = tex.getSourceImage();
  var frames = (sheet==='walk' || sheet==='walkfront' || sheet==='walkback') ? cfg.walkFrames : sheet==='jump' ? cfg.jumpFrames : 1; /* ĐỢT SỬA #2 (A21): sheet dọc dùng 6 khung như walk ngang */
  var fw = fr.width/frames, fh = fr.height;
  var dispH = cfg.height, dispW = Math.round(dispH*fw/Math.max(1, fh));
  if(o.sheet!==sheet){
    ensureSheetFrames(PH.scene, key, frames);
    o.img.setTexture(key);
    o.img.setScale(dispW/fw, dispH/fh);
    o.sheet = sheet; o.frame = -1; o.dispW = dispW; o.dispH = dispH;
  }
  if(o.frame!==frame){
    o.img.setFrame(frame); /* ĐỢT SỬA #2 (A15): setFrame thay setCrop */
    o.frame = frame;
  }
}
function buildPlayer(scene){
  /* texture 1x1 cho body vật lý (vô hình) */
  if(!scene.textures.exists('__dot')){
    var c = document.createElement('canvas'); c.width=36; c.height=36; // 36x36 NOT 1x1: the player Arcade body inherits the GameObject scale, so a 1x1 dot scaled to 36px made the body 36*36=1296px wide (measured bodyW=1296, halfW=648) - root cause of slow/erratic movement, wrong teleports and getting stuck. With a 36x36 texture, scale=1 and setCircle(18) is a true r18 body.
    scene.textures.addCanvas('__dot', c);
  }
  var body = scene.add.image(beca.x, beca.y, '__dot');
  body.setVisible(false);
  body.setDisplaySize(36, 36);
  scene.physics.add.existing(body);
  body.body.setCircle(18);
  body.body.setCollideWorldBounds(false);
  PH.playerBody = body;
  /* vật cản tĩnh (tròn + hộp) — Arcade collider thật */
  var statics = [];
  OBSTACLES.forEach(function(o){
    var cc = scene.add.circle(o.x, o.y, o.r);
    scene.physics.add.existing(cc, true);
    cc.body.setCircle(o.r);
    statics.push(cc);
  });
  CONFIG.BUILDINGS.forEach(function(b){
    if(!b.solid) return;
    var r = scene.add.rectangle(b.rect[0]+b.rect[2]/2, b.rect[1]+b.rect[3]/2, b.rect[2], b.rect[3]);
    scene.physics.add.existing(r, true);
    statics.push(r);
  });
  scene.physics.add.collider(body, statics);
  /* bé cá = sprite sheet (đi 6 khung / nhảy 3 khung / đứng mặt trước),
     KHÔNG còn rig xương (An 17:17, 19/11). Ảnh đã tách nền sẵn trong suốt —
     bụng trắng, tai nghe trắng, giày trắng giữ nguyên màu, không de-white. */
  var root = scene.add.container(beca.x, beca.y);
  root.setDepth(Math.round(beca.y));
  var shadow = scene.add.ellipse(beca.x, beca.y+4, 60, 14, 0x000000, 0.25);
  shadow.setDepth(Math.round(beca.y)-1);
  var pimg = scene.add.image(0, 0, 'rig-beca-idle');
  pimg.setOrigin(0.5, 1);
  root.add(pimg);
  var fb = scene.add.image(0, 0, 'becaEmpty');
  fb.setOrigin(0.5, 1);
  fb.setDisplaySize(85, 140);
  fb.setVisible(false);
  root.add(fb);
  var name = scene.add.text(0, -148, '🐟 Bé Cá', {fontFamily:'system-ui, sans-serif', fontSize:'12px', fontStyle:'bold', color:'#fff', stroke:'#5C3D1E', strokeThickness:4, shadow:{offsetX:1, offsetY:1, color:'#000', blur:2, fill:true}}); /* ĐỢT SỬA #2 (A24): viền đậm + bóng */
  name.setOrigin(0.5, 1);
  root.add(name);
  PH.rig = {root:root, shadow:shadow, name:name, fallback:fb, img:pimg, sheet:'', frame:-1, dispW:0, dispH:0};
  /* ĐỢT SỬA #3 (A35): nhãn 'Bé Cá' lên lớp trên cùng (depth 2200) — cũ là con
     của container (depth = beca.y) nên lá cọ FG (depth ~1140) che mất khi bé
     cá đứng sau cọ (live đợt #2). Nhãn cũ trong container ẩn đi. */
  name.setVisible(false);
  var nameTop = scene.add.text(beca.x, beca.y - 148, '🐟 Bé Cá', {fontFamily:'system-ui, sans-serif', fontSize:'12px', fontStyle:'bold', color:'#fff', stroke:'#5C3D1E', strokeThickness:4, shadow:{offsetX:1, offsetY:1, color:'#000', blur:2, fill:true}});
  nameTop.setOrigin(0.5, 1);
  nameTop.setDepth(2200);
  PH.rig.nameTop = nameTop;
  becaSpriteSet(scene, 'idle', 0);
}
function dewhiteBoneFacing(scene, facing){
  var cleanKey = 'bone-'+facing+'-clean';
  if(scene.textures.exists(cleanKey)) return true;
  var tex = scene.textures.get('bone-'+facing);
  if(!tex) return false;
  var img = tex.getSourceImage();
  if(!img || (!img.naturalWidth && !img.width)) return false;
  var clean = boneDeWhite(img);
  scene.textures.addCanvas(cleanKey, clean);
  return true;
}

/* ================= THẾ GIỚI SỐNG (An 16:09 / 16:13 / 16:15) =================
   Lõi đợt này: chu kỳ ngày–đêm thật + bóng đổ theo hướng nắng + mây thời tiết
   + đèn đêm. Tiếp: chim + chó mèo hoang + giao thông + sông (nếu kịp, không ẩu).
   Âm thanh: tổng hợp bằng WebAudio trong code ($0, không cần file ngoài).
   Krita/Blender: sandbox KHÔNG chạy được GUI/render -> cần máy thật (ghi rõ
   ở báo cáo, không giả vờ). */
var LW = {
  phase: 0,            // 0 sáng, 1 hoàng hôn, 2 đêm (theo state.timePhase)
  weather: 'sunny',    // sunny | rainy
  rainT: 0, rainCool: 120, /* ĐỢT SỬA #3 (A33): mưa đầu tiên sau ~2 phút, không mưa ngay khi vào game */
  sun: null, moon: null, sunCore: null,
  skyline: null, riverBoat: null, riverRipples: [],
  lights: [],          // glow đèn đêm
  birds: [],           // {g, vx, flap, baseY}
  strays: [],          // mèo/chó hoang
  vehicles: [],        // {g, vx, kind, head}
  rain: null,          // rain particles
  season: 0,           // 0 Xuân 1 Hạ 2 Thu 3 Đông (đổi theo ngày)
  seasonT: 0,
  birdT: 10, ambientT: 25, petT: 0,
  musicT: 0, musicOn: false,
  interactZones: [],
  npcShadows: {},      // id -> ellipse bóng
};
/* --- textures dùng chung cho thế giới sống (canvas, không cần file) --- */
function lwGlowTexture(scene, key, inner, outer){
  if(scene.textures.exists(key)) return key;
  var c = document.createElement('canvas'); c.width = 128; c.height = 128;
  var x = c.getContext('2d');
  var g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  scene.textures.addCanvas(key, c);
  return key;
}
function lwMakeTextures(scene){
  lwGlowTexture(scene, 'lw-sun', 'rgba(255,240,180,1)', 'rgba(255,200,80,0)');
  lwGlowTexture(scene, 'lw-moon', 'rgba(235,240,255,1)', 'rgba(180,200,255,0)');
  lwGlowTexture(scene, 'lw-lamp', 'rgba(255,210,110,0.95)', 'rgba(255,180,60,0)');
  lwGlowTexture(scene, 'lw-ripple', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)');
  /* vệt mưa */
  if(!scene.textures.exists('lw-rain')){
    var rc = document.createElement('canvas'); rc.width = 4; rc.height = 30;
    var rx = rc.getContext('2d');
    var rg = rx.createLinearGradient(0, 0, 0, 30);
    rg.addColorStop(0, 'rgba(180,200,230,0)'); rg.addColorStop(0.5, 'rgba(180,200,230,0.8)'); rg.addColorStop(1, 'rgba(180,200,230,0)');
    rx.fillStyle = rg; rx.fillRect(0.5, 0, 3, 30); /* ĐỢT SỬA #3 (A33): vệt mưa dày/dài/đậm hơn (cũ 2px, mờ nhất là ban ngày) */
    scene.textures.addCanvas('lw-rain', rc);
  }
  /* chim: hình chữ V đơn giản */
  if(!scene.textures.exists('lw-bird')){
    var bc = document.createElement('canvas'); bc.width = 36; bc.height = 16;
    var bx = bc.getContext('2d');
    bx.strokeStyle = '#3A3A3A'; bx.lineWidth = 3; bx.lineCap = 'round';
    bx.beginPath(); bx.moveTo(2, 12); bx.quadraticCurveTo(18, 2, 34, 12); bx.stroke();
    scene.textures.addCanvas('lw-bird', bc);
  }
}
/* --- skyline Sài Gòn xa (phối cảnh khí quyển: nhạt, xanh-tím, mờ) ---
   Bến Thành (tháp đồng hồ) + Bitexco + Nhà thờ Đức Bà (2 tháp) + sông Sài Gòn.
   Vẽ 1 lần thành texture, cuộn chậm (scrollFactor 0.15) ở đỉnh màn hình. */
function lwSkylineTexture(scene){
  if(scene.textures.exists('lw-skyline')) return 'lw-skyline';
  var W = 3600, H = 90;
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d');
  /* dãy nhà xa mờ (rất nhạt — phối cảnh khí quyển) */
  function block(bx, bw, bh, a){
    x.fillStyle = 'rgba(150,165,205,'+a+')';
    x.fillRect(bx, H-10-bh, bw, bh);
  }
  var bx = 0;
  while(bx < W){
    var bw = 60 + Math.random()*90, bh = 14 + Math.random()*26;
    block(bx, bw, bh, 0.32 + Math.random()*0.15);
    bx += bw + 14;
  }
  /* sông Sài Gòn: chỉ 1 đường mỏng ở chân trời (không phải dải to) */
  x.fillStyle = 'rgba(140,170,210,0.7)';
  x.fillRect(0, H-8, W, 5);
  x.fillStyle = 'rgba(255,255,255,0.4)';
  for(var w=0; w<W; w+=110){ x.fillRect(w+20, H-6, 40, 1); }
  /* tháp đồng hồ Bến Thành (1912-1914) */
  x.fillStyle = 'rgba(140,155,200,0.65)';
  x.fillRect(495, H-10-58, 40, 58);
  x.beginPath(); x.moveTo(490, H-10-58); x.lineTo(525, H-10-76); x.lineTo(560, H-10-58); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,250,230,0.9)';
  x.beginPath(); x.arc(525, H-10-44, 10, 0, Math.PI*2); x.fill();
  /* Bitexco (2010): tháp vát */
  x.fillStyle = 'rgba(135,150,195,0.6)';
  x.beginPath(); x.moveTo(1320, H-10); x.lineTo(1338, H-10-78); x.lineTo(1377, H-10-78); x.lineTo(1395, H-10); x.closePath(); x.fill();
  /* Nhà thờ Đức Bà (1877-1880): 2 tháp chuông */
  x.fillStyle = 'rgba(145,160,200,0.65)';
  [2250, 2328].forEach(function(tx){
    x.fillRect(tx, H-10-48, 26, 48);
    x.beginPath(); x.moveTo(tx-2, H-10-48); x.lineTo(tx+13, H-10-68); x.lineTo(tx+28, H-10-48); x.closePath(); x.fill();
  });
  x.fillRect(2244, H-10-30, 82, 30);
  scene.textures.addCanvas('lw-skyline', c);
  return 'lw-skyline';
}
function buildSkyline(scene){
  lwMakeTextures(scene);
  var key = lwSkylineTexture(scene);
  var im = scene.add.image(0, 58, key);
  im.setOrigin(0, 0);
  im.setScrollFactor(0.15, 0);
  im.setDepth(-95);
  im.setAlpha(0.7);
  LW.skyline = im;
  /* thuyền trên sông Sài Gòn (nhỏ, xa, ở đường chân trời) */
  if(!scene.textures.exists('lw-boat')){
    var bc2 = document.createElement('canvas'); bc2.width = 90; bc2.height = 34;
    var b2 = bc2.getContext('2d');
    b2.fillStyle = 'rgba(90,110,160,0.9)';
    b2.beginPath(); b2.moveTo(4, 20); b2.lineTo(86, 20); b2.lineTo(76, 32); b2.lineTo(14, 32); b2.closePath(); b2.fill();
    b2.fillStyle = 'rgba(120,140,190,0.9)';
    b2.fillRect(28, 8, 34, 12);
    b2.fillStyle = 'rgba(255,240,180,0.95)';
    b2.fillRect(34, 11, 8, 6); b2.fillRect(48, 11, 8, 6);
    scene.textures.addCanvas('lw-boat', bc2);
  }
  /* SINGLE-TOWN (đợt #6): bỏ thuyền trên sông — nền mới không có sông (LAYOUT-SINGLE.md: sông bỏ).
     Skyline xa + đường sông mỏng ở chân trời giữ nguyên (nền xa, không phải thực thể). */
}
/* --- mặt trời / mặt trăng (cố định theo màn hình, không parallax — ở xa vô cùng) --- */
function buildSkyBodies(scene){
  var sun = scene.add.image(0, 0, 'lw-sun');
  sun.setDisplaySize(190, 190);
  sun.setDepth(-90);
  sun.setScrollFactor(0);
  var moon = scene.add.image(0, 0, 'lw-moon');
  moon.setDisplaySize(120, 120);
  moon.setDepth(1850); /* trên tint đêm để trăng sáng */
  moon.setBlendMode(Phaser.BlendModes.ADD);
  moon.setScrollFactor(0);
  moon.setVisible(false);
  LW.sun = sun; LW.moon = moon;
}
/* --- đèn đêm: đèn đường + cửa sổ nhà + biển hiệu phát sáng --- */
function buildNightLights(scene){
  /* SINGLE-TOWN (đợt #6): chỉ quầng cửa sổ — KHÔNG còn cột đèn (đã xóa).
     48 quầng khớp cửa sổ thật trong bg-town.png (đo bằng pixel, LAYOUT-SINGLE.md §3):
     nhà phố trái / chân Bitexco / giữa-phải / dưới-phải, tháp đồng hồ, rose window
     + cửa vòm nhà thờ, Dinh Độc Lập. s = cỡ quầng (cửa nhỏ 45, tháp/Dinh 50, rose 90). */
  var spots = [
    {x:619, y:2272, s:68}, {x:703, y:2272, s:68}, {x:777, y:2272, s:68}, {x:845, y:2272, s:68}, {x:931, y:2272, s:68},
    {x:655, y:2324, s:68}, {x:739, y:2324, s:68}, {x:844, y:2324, s:68}, {x:2072, y:1209, s:68}, {x:2144, y:1209, s:68},
    {x:2204, y:1209, s:68}, {x:2418, y:1209, s:68}, {x:2491, y:1209, s:68}, {x:2554, y:1209, s:68}, {x:2094, y:1240, s:68},
    {x:2438, y:1240, s:68}, {x:2898, y:2260, s:68}, {x:2969, y:2260, s:68}, {x:3051, y:2260, s:68}, {x:3121, y:2260, s:68},
    {x:2934, y:2311, s:68}, {x:3085, y:2311, s:68}, {x:1734, y:2851, s:68}, {x:1844, y:2851, s:68}, {x:1918, y:2851, s:68},
    {x:2072, y:2851, s:68}, {x:2160, y:2851, s:68}, {x:2252, y:2851, s:68}, {x:2330, y:2851, s:68}, {x:1918, y:2907, s:68},
    {x:2216, y:2907, s:68}, {x:2292, y:2907, s:68}, {x:1552, y:1351, s:75}, {x:1766, y:1351, s:75}, {x:1620, y:1422, s:75},
    {x:1699, y:1423, s:75}, {x:1452, y:1657, s:75}, {x:1855, y:1654, s:75}, {x:574, y:1365, s:135}, {x:294, y:1545, s:75},
    {x:462, y:1545, s:75}, {x:680, y:1545, s:75}, {x:662, y:2904, s:75}, {x:722, y:2904, s:75}, {x:663, y:3033, s:75},
    {x:760, y:3033, s:75}, {x:256, y:3003, s:75}, {x:1116, y:3003, s:75},
  ];
  spots.forEach(function(sp){
    var g = scene.add.image(sp.x, sp.y, 'lw-lamp');
    g.setDisplaySize(sp.s, sp.s);
    g.setDepth(1850); /* trên tint đêm để đèn nổi lên */
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setAlpha(0);
    LW.lights.push(g);
  });
}
/* --- tiền cảnh: cỏ/hoa ở mép dưới, cuộn nhanh hơn thế giới (gần camera) --- */
function buildForegroundTufts(scene){
  /* R9 (An 05:58 20/11): BO HET lum co/bui co tren mat dat — khong ve
     5 bui co 'lw-tuft' nua (de dat trong thoang). Ham giu lai de
     buildLivingWorld khong loi; khong tao texture, khong dat anh. */
  return;
}
/* --- bóng đổ theo hướng nắng: trả về {dx, len, alpha} theo pha ngày ---
   Sáng: nắng cao phía đông -> bóng ngắn, đổ sang tây (trái).
   Hoàng hôn: nắng thấp phía tây -> bóng dài, đổ sang đông (phải).
   Đêm: không có nắng -> chỉ còn bóng mờ môi trường. */
function lwSunShadow(){
  if(LW.phase===0) return {dx:-12, len:1.0, alpha:0.25};
  if(LW.phase===1) return {dx:30, len:1.8, alpha:0.30};
  return {dx:0, len:0.7, alpha:0.08};
}
/* --- áp pha ngày–đêm vào mặt trời/mặt trăng/mây/đèn/bóng --- */
function lwApplyPhase(scene){
  var ph = LW.phase;
  var cam = scene.cameras.main;
  var cw = cam.width, ch = cam.height;
  /* mặt trời: sáng cao phải, hoàng hôn thấp gần chân trời (cam), đêm lặn
     (scrollFactor 0 = cố định theo màn hình -> tọa độ = screen/zoom, KHÔNG cộng scroll) */
  if(LW.sun){
    if(ph===2){ LW.sun.setVisible(false); }
    else {
      LW.sun.setVisible(true);
      var sx = ph===0 ? cw*0.86 : cw*0.14;
      var sy = ph===0 ? ch*0.10 : ch*0.40;
      LW.sun.setPosition(sx/cam.zoom, sy/cam.zoom);
      LW.sun.setTint(ph===0 ? 0xFFFFFF : 0xFFB060); /* ĐỢT SỬA #3 (A32): nắng chiều bớt cam đậm (cũ 0xFF9A3C — 1 phần sương be-đào buổi Chiều) */
      LW.sun.setDisplaySize(ph===0 ? 130 : 200, ph===0 ? 130 : 200);
      LW.sun.setAlpha(ph===0 ? 0.95 : 0.85);
    }
  }
  if(LW.moon){
    LW.moon.setVisible(ph===2);
    if(ph===2) LW.moon.setPosition((cw*0.2)/cam.zoom, (ch*0.14)/cam.zoom);
  }
  /* mây đổi sắc theo pha/thời tiết */
  var tint = LW.weather==='rainy' ? 0x8A8F9E : (ph===0 ? 0xFFFFFF : ph===1 ? 0xFFE8C8 : 0x5A5E78); /* ĐỢT SỬA #3 (A32): mây chiều bớt cam (cũ 0xFFC890) */
  var a = LW.weather==='rainy' ? 0.95 : (ph===2 ? 0.55 : 0.9);
  PH.clouds.forEach(function(c){ c.setTint(tint); c.setAlpha(a); });
  /* đèn đêm chỉ sáng khi tối */
  var nightA = ph===2 ? 0.85 : (ph===1 ? 0.25 : 0);
  LW.lights.forEach(function(g){ g.setAlpha(nightA); });
  /* tint phủ tối: ngày trong, hoàng hôn cam nhẹ, đêm xanh đậm */
  if(LW.tint){
    if(ph===2){ LW.tint.setFillStyle(0x0A1030, 0.30); } /* dem sang hon (cu 0.42 toi dot ngot) */
    else if(ph===1){ LW.tint.setFillStyle(0xFF8830, 0.05); } /* ĐỢT SỬA #3 (A32): tint chiều 0.14->0.05 (cũ phủ cam cả cảnh — gốc sương be buổi Chiều, live đợt #2) */
    else { LW.tint.setFillStyle(0x0A1030, 0); }
  }
  /* biển hiệu phát sáng về đêm (đổi màu nền sáng hơn) */
  PH.signs.forEach(function(t){ t.setAlpha(ph===2 ? 1 : 0.95); });
  /* ĐỢT SỬA #5 (A45-revert, mục 4): nước đài phun TỐI theo đêm — tint phủ toàn cảnh
     (alpha 0.30) không đủ làm tối nước xanh sáng (live đợt #3: nước vẫn xanh
     rực ban đêm). Tint trực tiếp sprite đài phun theo buổi (phase 2 = Tối). */
  if(PH.fgs){ for(var _fi=0; _fi<PH.fgs.length; _fi++){ if(PH.fgs[_fi].id==='fgFountain'){ var _ft = PH.fgs[_fi].img; if(ph===2) _ft.setTint(0x3D4557); else if(ph===1) _ft.setTint(0xC9CEDB); else _ft.clearTint(); break; } } }
  /* ĐỢT SỬA #5 (A45-revert, mục 4): nền camera tối theo đêm (khu vực ngoài world). */
  cam.setBackgroundColor(ph===2 ? '#12182E' : '#E8C99A');
}
/* --- mây sống: trôi + đổi màu; mưa rào ngẫu nhiên --- */
function lwCloudTick(scene, dt){
  var cam = scene.cameras.main;
  var span = cam.width / cam.zoom;
  /* ĐỢT SỬA #2 (A17): emitter mưa bám camera (x = giữa viewport, y = trên viewport 30px). */
  if(LW.rain && LW.rain.visible){
    LW.rain.setPosition(cam.scrollX + span/2, cam.scrollY - 30);
  }
  PH.clouds.forEach(function(c, i){
    c.x += (6 + i*2.5) * dt; /* trôi chậm sang phải */
    var sx = (c.x - cam.scrollX*0.38) * cam.zoom;
    if(sx > cam.width + 320) c.x = cam.scrollX*0.38 - 320/cam.zoom;
    if(sx < -340) c.x = cam.scrollX*0.38 + (cam.width+320)/cam.zoom;
  });
  /* mưa rào ngẫu nhiên (chỉ ban ngày/hoàng hôn, không mưa đêm) */
  LW.rainCool -= dt;
  if(LW.weather==='sunny' && LW.rainCool<=0 && LW.phase!==2 && Math.random()<0.35){
    LW.weather = 'rainy'; LW.rainT = 40 + Math.random()*20; /* ĐỢT SỬA #3 (A33): mưa dài 40-60s (cũ 18-28s) */
    LW.rainCool = 150 + Math.random()*150; /* chờ 150-300s mới mưa lại (cũ 60-120s — live đợt #2: mưa bắt đầu/dứt trong ~1 phút, lặp nhiều) */
    if(LW.rain){ LW.rain.setVisible(true); if(LW.rain.start) LW.rain.start(); }
    toast(state.lang==='vi' ? '🌧️ Trời mưa rào! Mây xám kéo tới.' : '🌧️ A rain shower! Grey clouds roll in.');
    lwApplyPhase(scene);
  }
  if(LW.weather==='rainy'){
    LW.rainT -= dt;
    if(LW.rainT<=0){
      LW.weather = 'sunny';
      if(LW.rain){ LW.rain.setVisible(false); if(LW.rain.stop) LW.rain.stop(); } /* dung han emitter (cu chi setVisible(false): hat mua van sinh ra (an) + banner co the hien lai) */
      toast(state.lang==='vi' ? '🌤️ Hết mưa, trời lại nắng!' : '🌤️ The rain stopped, sunny again!');
      lwApplyPhase(scene);
    }
  }
}
function buildRain(scene){
  var p = scene.add.particles(0, 0, 'lw-rain', {
    x: {min: -700, max: 700}, y: -20, /* ĐỢT SỬA #2 (A17): dải mưa hẹp theo camera (vị trí cập nhật mỗi khung ở lwCloudTick) */
    lifespan: 900, speedY: {min: 700, max: 900}, speedX: -120,
    scale: {min: 1.0, max: 1.6}, alpha: 0.75, quantity: 10, frequency: 20, /* ĐỢT SỬA #3 (A33): mưa đậm hơn (cũ mờ, nhất là ban ngày) */
  });
  p.setDepth(1900);
  p.setVisible(false);
  LW.rain = p;
}
/* --- chim bay + hót (ban ngày) --- */
function buildBirds(scene){
  for(var i=0;i<3;i++){
    var g = scene.add.image(400 + i*900, 180 + (i%2)*70, 'lw-bird');
    g.setScrollFactor(0.2, 0);
    g.setDepth(-40);
    g.setScale(0.9 + i*0.15);
    LW.birds.push({g:g, vx: 28 + i*9, flap: Math.random()*6, baseY: g.y});
  }
}
function lwBirdTick(scene, dt){
  var cam = scene.cameras.main;
  var day = LW.phase!==2;
  LW.birds.forEach(function(b, i){
    b.g.setVisible(day);
    if(!day) return;
    b.flap += dt*9;
    b.g.x += b.vx * dt;
    b.g.y = b.baseY + Math.sin(b.flap)*7;
    b.g.setScale(0.9 + i*0.15, (0.9 + i*0.15) * (0.6 + 0.4*Math.abs(Math.sin(b.flap))));
    var sx = (b.g.x - cam.scrollX*0.2) * cam.zoom;
    if(sx > cam.width + 80) b.g.x = cam.scrollX*0.2 - 90/cam.zoom;
  });
  /* tiếng chim hót ngẫu nhiên ban ngày */
  LW.birdT -= dt;
  if(day && LW.birdT<=0){
    LW.birdT = 14 + Math.random()*18;
    lwSound('bird');
  }
}
/* --- chó mèo hoang: chạm vào -> vuốt ve (vui) hoặc bỏ chạy --- */
function buildStrays(scene){
  /* SINGLE-TOWN (đợt #6): bỏ chó hoang + mèo hoang — chỉ giữ Mimi (NPC giao quest,
     đứng ở nhà phố). lwStrayTick/lwPetStray còn đó nhưng LW.strays rỗng nên không chạy. */
}
function lwStrayTick(scene, dt){
  LW.strays.forEach(function(s){
    s.stateT -= dt;
    if(s.state==='run'){
      s.x += s.dir * 260 * dt;
      if(s.stateT<=0){ s.state='wander'; s.stateT = 3+Math.random()*4; }
    } else if(s.state==='pet'){
      if(s.stateT<=0){ s.state='wander'; s.stateT = 2+Math.random()*3; }
    } else {
      /* đi lang thang quanh nhà, thỉnh thoảng dừng */
      if(s.stateT<=0){
        if(Math.random()<0.45){ s.state='idle'; s.stateT = 2+Math.random()*3; }
        else { s.dir = Math.random()<0.5 ? -1 : 1; s.stateT = 2+Math.random()*3; }
      }
      if(s.state==='wander'){
        s.x += s.dir * s.speed * dt;
        if(s.x < s.home-260) { s.x = s.home-260; s.dir = 1; }
        if(s.x > s.home+260) { s.x = s.home+260; s.dir = -1; }
      }
      if(s.state==='idle' && s.stateT<=0){ s.state='wander'; s.stateT = 2+Math.random()*3; }
    }
    /* kẹp vào vùng đi được */
    s.x = Math.min(WALK.x1, Math.max(WALK.x0, s.x));
    s.y = Math.min(WALK.y1, Math.max(walkMinY(s.x), s.y));
    s.cont.setPosition(s.x, s.y);
    if(s.zone){ s.zone.setPosition(s.x, s.y); s.zone.setDepth(Math.round(s.y)+1); }
    s.cont.setDepth(Math.round(s.y));
    /* ĐỢT SỬA #2 (A22): chỉ lật ẢNH, không lật container — trước đây lật cả container
       nên nhãn 'Mèo hoang'/'Chó hoang' bị lật ngược khi thú đi sang trái. */
    if(s.img) s.img.setFlipX(s.dir<0);
    /* chân mèo hoang: đổi frame đi bộ */
    if(s.kind==='cat'){
      s.frameT += dt;
      if(s.state==='wander' || s.state==='run'){
        if(s.frameT>0.14){ s.frameT=0; s.frame=(s.frame+1)%RIGS.mimi.walkFrames; s.img.setFrame(s.frame); }
      } else { s.img.setFrame(RIGS.mimi.idleFrame); }
    }
    /* bóng theo hướng nắng */
    var sh = lwSunShadow();
    s.shadow.setPosition(sh.dx, 4);
    s.shadow.setScale(sh.len, 1);
    s.shadow.setAlpha(sh.alpha);
  });
}
function lwPetStray(id){
  var s = LW.strays.find(function(v){ return v.id===id; });
  if(!s || s.state==='run' || s.state==='pet') return;
  if(Math.random()<0.6){
    s.state='pet'; s.stateT=2.5;
    lwSound('purr');
    var hearts = s.cont.scene.add.text(s.x, s.y-110, '💕', {fontSize:'26px'});
    hearts.setDepth(2200);
    s.cont.scene.tweens.add({targets:hearts, y: s.y-160, alpha:0, duration:1400, onComplete:function(){ hearts.destroy(); }});
    toast(state.lang==='vi' ? (s.kind==='cat' ? '🐱 Mèo hoang để bạn vuốt ve! Nó kêu meo meo vui vẻ.' : '🐶 Chó hoang vẫy đuôi mừng! Bạn vuốt ve nó.') : (s.kind==='cat' ? '🐱 The stray cat lets you pet it! It meows happily.' : '🐶 The stray dog wags its tail! You pet it.'));
  } else {
    s.state='run'; s.stateT=1.6; s.dir = s.x < beca.x ? -1 : 1;
    lwSound('run');
    toast(state.lang==='vi' ? '💨 Nó giật mình bỏ chạy!' : '💨 It got startled and ran away!');
  }
}
/* --- giao thông: ô tô + xe máy chạy trên đường (có làn, có hướng, đèn pha đêm) --- */
function buildTraffic(scene){
  /* SINGLE-TOWN (đợt #6): bỏ xe hơi + xe đạp (cả 2) — thị trấn không có xe cộ.
     lwTrafficTick thành no-op ở dưới; LW.vehicles rỗng. */
}
function lwTrafficTick(scene, dt){
  /* SINGLE-TOWN (đợt #6): no-op — không còn xe nên không di chuyển xe, không tiếng xe. */
}
/* --- âm thanh môi trường: tổng hợp bằng WebAudio trong code ($0, không file) ---
   Chim hót, tiền ting, vuốt ve (purr), xe cộ, sông nước, nhạc nền ngày/đêm. */
function lwSound(name){
  if(!state.sound) return;
  try{
    var ac = window._ac || (window._ac = new (window.AudioContext||window.webkitAudioContext)());
    if(ac.state==='suspended') ac.resume();
    var t0 = ac.currentTime;
    function tone(f0, f1, dur, type, vol, delay){
      var o=ac.createOscillator(), g=ac.createGain();
      var s = t0 + (delay||0);
      o.type=type; o.frequency.setValueAtTime(f0, s);
      if(f1 && f1!==f0) o.frequency.exponentialRampToValueAtTime(f1, s+dur);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s+0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s+dur);
      o.connect(g).connect(ac.destination);
      o.start(s); o.stop(s+dur+0.05);
    }
    function noise(dur, vol, freq, delay){
      var len = Math.floor(ac.sampleRate*dur);
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var d = buf.getChannelData(0);
      for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
      var src=ac.createBufferSource(); src.buffer=buf;
      var fl=ac.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=freq||800;
      var g=ac.createGain(); g.gain.value=vol;
      src.connect(fl).connect(g).connect(ac.destination);
      src.start(t0+(delay||0));
    }
    if(name==='bird'){
      /* chim hót: 3 nốt cao líu lo */
      tone(2800, 3400, 0.09, 'sine', 0.06);
      tone(3200, 2600, 0.08, 'sine', 0.05, 0.12);
      tone(2900, 3600, 0.1, 'sine', 0.06, 0.24);
    } else if(name==='coin'){
      tone(1320, 1320, 0.07, 'sine', 0.1);
      tone(1760, 1760, 0.12, 'sine', 0.1, 0.07);
    } else if(name==='purr'){
      /* mèo kêu: rung trầm */
      for(var i=0;i<6;i++) tone(55, 48, 0.12, 'sawtooth', 0.035, i*0.13);
    } else if(name==='run'){
      for(var j=0;j<4;j++) noise(0.05, 0.05, 500, j*0.09);
    } else if(name==='traffic'){
      tone(75, 60, 0.5, 'sawtooth', 0.025);
      noise(0.4, 0.02, 400);
    } else if(name==='water'){
      noise(0.8, 0.03, 1200);
    } else if(name==='splash'){
      noise(0.3, 0.06, 900);
    }
  }catch(e){ /* âm thanh lỗi thì bỏ qua, không phá game */ }
}
/* nhạc nền chiptune ngày/đêm (vòng lặp giai điệu đơn giản, WebAudio) */
var LW_MUSIC = {
  day:   [[523,0.22],[659,0.22],[784,0.22],[659,0.22],[880,0.34],[784,0.22],[659,0.22],[523,0.34],[587,0.22],[659,0.22],[784,0.44],[0,0.22]],
  night: [[392,0.34],[330,0.34],[392,0.34],[523,0.5],[440,0.34],[392,0.34],[330,0.68],[0,0.34]],
};
function lwMusicTick(dt){
  if(!state.sound){ LW.musicOn=false; return; }
  LW.musicT -= dt;
  if(LW.musicT>0) return;
  var mel = LW.phase===2 ? LW_MUSIC.night : LW_MUSIC.day;
  var idx = LW._mi || 0;
  var n = mel[idx % mel.length];
  LW._mi = idx+1;
  LW.musicT = n[1];
  if(n[0]>0){
    try{
      var ac = window._ac || (window._ac = new (window.AudioContext||window.webkitAudioContext)());
      if(ac.state==='suspended') ac.resume();
      var t0=ac.currentTime;
      var o=ac.createOscillator(), g=ac.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(n[0], t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(LW.phase===2?0.035:0.05, t0+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+n[1]);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0+n[1]+0.05);
      /* bass nhẹ theo nhịp */
      var b=ac.createOscillator(), bg=ac.createGain();
      b.type='sine'; b.frequency.setValueAtTime(n[0]/2, t0);
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(0.03, t0+0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0+n[1]);
      b.connect(bg).connect(ac.destination);
      b.start(t0); b.stop(t0+n[1]+0.05);
    }catch(e){}
  }
}
/* --- panel tương tác (DOM, tạo động — không sửa file gốc) --- */
function lwInteractPanel(){
  var p = document.getElementById('lwInteractPanel');
  if(p) return p;
  p = document.createElement('div');
  p.id = 'lwInteractPanel';
  p.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:70; width:min(430px,88vw); background:rgba(255,253,245,.97); border:3px solid #8B5E2E; border-radius:14px; padding:14px 16px; box-shadow:0 8px 24px rgba(90,50,10,.35); display:none; font-family:system-ui,sans-serif; color:#5C3D1E;';
  p.innerHTML = '<div id="lwIntTitle" style="font-weight:800; font-size:17px; margin-bottom:6px;"></div><div id="lwIntText" style="font-size:14px; line-height:1.5; margin-bottom:12px;"></div><div id="lwIntBtns" style="display:flex; gap:8px; flex-wrap:wrap;"></div><div style="text-align:right; margin-top:10px;"><button id="lwIntClose" style="padding:6px 14px; border-radius:8px; border:2px solid #8B5E2E; background:#FFF3D6; font-weight:700; cursor:pointer;">Đóng</button></div>';
  document.body.appendChild(p);
  document.getElementById('lwIntClose').onclick = function(){ p.style.display='none'; };
  return p;
}
function lwShowInteract(title, text, buttons){
  var p = lwInteractPanel();
  document.getElementById('lwIntTitle').textContent = title;
  document.getElementById('lwIntText').textContent = text;
  var box = document.getElementById('lwIntBtns');
  box.innerHTML = '';
  (buttons||[]).forEach(function(b){
    var btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText = 'padding:7px 13px; border-radius:8px; border:2px solid #8B5E2E; background:#FFE9A8; font-weight:700; cursor:pointer;';
    btn.onclick = function(){ p.style.display='none'; b.onClick(); };
    box.appendChild(btn);
  });
  p.style.display = 'block';
}
function lwGiveCoins(n, why){
  state.coins = (state.coins||0) + n;
  try{ save(); }catch(e){}
  try{ updateCoinsUI(); }catch(e){}
  lwSound('coin');
  toast((state.lang==='vi' ? '🪙 +' + n + 'đ · ' : '🪙 +' + n + ' coins · ') + why);
}
/* --- vật tương tác: xe trái cây / bàn cà phê / đài phun nước / sạp chợ / biển hiệu --- */
function buildInteractables(scene){
  lwInteractPanel();
  var defs = []; /* SINGLE-TOWN (đợt #6): bỏ hết điểm chạm cũ — xe trái cây/đài/sạp/bàn đã xóa theo brief 23:22. */
  defs.forEach(function(d){
    var zn = scene.add.zone(d.x, d.y, d.r*2, d.r*1.1);
    zn.setInteractive({useHandCursor:true});
    zn.setData('interactId', d.id);
    LW.interactZones.push(zn);
    d._def = d;
  });
  LW.interactDefs = {};
  defs.forEach(function(d){ LW.interactDefs[d.id]=d; });
  LW.claimed = {};
  /* biển hiệu: chạm vào để đọc rõ */
  PH.signs.forEach(function(t, i){
    t.setInteractive({useHandCursor:true});
    t.on('pointerdown', function(){
      var b = (CONFIG.BUILDINGS||[])[i];
      lwShowInteract('🪧 ' + (b && b.sign ? b.sign.text : 'Biển hiệu'),
        state.lang==='vi'
          ? 'Biển hiệu treo trước tiệm, chữ rõ ràng, màu sắc rực rỡ — ai đi ngang cũng đọc được. Đây là một trong những tiệm lâu đời của khu phố.'
          : 'A bright, readable shop sign — everyone passing by can read it. One of the oldest shops in the area.',
        []);
    });
  });
}
function lwTapInteract(id){
  var d = LW.interactDefs[id];
  if(!d) return false;
  var dayKey = (state.day||1) + ':' + id;
  var used = LW.claimed[dayKey];
  var btns = [];
  if(!used && d.act && (state.coins||0) >= d.act.cost){
    btns.push({label: d.act.label, onClick: function(){
      state.coins -= d.act.cost;
      LW.claimed[dayKey] = true;
      try{ save(); }catch(e){}
      lwGiveCoins(d.act.reward, d.act.why);
    }});
  } else if(!used && d.act){
    btns.push({label: (state.lang==='vi' ? 'Không đủ tiền (' : 'Not enough coins (') + d.act.cost + 'đ)', onClick: function(){ toast(state.lang==='vi' ? 'Chưa đủ tiền, để dành thêm nhé!' : 'Not enough coins yet!'); }});
  } else if(used){
    btns.push({label: state.lang==='vi' ? 'Đã ghé hôm nay rồi 😊' : 'Already visited today 😊', onClick: function(){}});
  }
  lwShowInteract(d.title, d.text, btns);
  return true;
}
/* --- cốt truyện dệt vào thế giới: nhiệm vụ có chuyện, NPC có tính cách, lịch sử thật --- */
function lwExtendContent(){
  /* NPC: thêm câu thoại tính cách (giữ câu cũ, thêm câu mới) */
  /* SINGLE-TOWN (đợt #6): câu thoại mới không còn quán/tiệm (đã xóa) — chỉ nói về thị trấn/tranh vẽ. */
  var extra = {
    lan: {vi:['Tranh đẹp ghê, treo lên tháp đồng hồ đi em!','Mẹ tôi thích trăng rằm lắm!','Thị trấn mình đẹp nhất lúc nắng sớm!'], en:['Such a beautiful painting — hang it at the clock tower!','My mother loves the full moon!','Our town is prettiest in the early sun!']},
    nam: {vi:['Bé cá vẽ biển hiệu cho chùa, khách nào cũng khen!','Phở ngon phải có chanh, ớt, rau thơm!'], en:['Beca painted the pagoda sign — everyone loves it!','Good pho needs lime, chili and herbs!']},
    hoa: {vi:['Thị trấn mình hoa nở quanh năm!','Bé cá vẽ hoa đẹp ghê!'], en:['Flowers bloom all year in our town!','Beca paints flowers so beautifully!']},
    bay: {vi:['Tháp đồng hồ là biểu tượng của Sài Gòn hơn 100 năm!','Đi dạo quanh thị trấn thôi!'], en:['The clock tower has symbolised Saigon for over 100 years!','Let\'s stroll around town!']},
    ba: {vi:['Bà nhìn bé cá lớn lên ở thị trấn này!','Tranh bé cá vẽ đẹp lắm!'], en:['I watched Beca grow up in this town!','Beca paints so beautifully!']},
    mimi: {vi:['Meo meo! 🐱','Mimi thích nằm phơi nắng ở thị trấn!'], en:['Meow! 🐱','Mimi loves sunbathing in town!']},
  };
  Object.keys(extra).forEach(function(id){
    if(CONFIG.CHAT_LINES[id]){
      CONFIG.CHAT_LINES[id].vi = CONFIG.CHAT_LINES[id].vi.concat(extra[id].vi);
      CONFIG.CHAT_LINES[id].en = CONFIG.CHAT_LINES[id].en.concat(extra[id].en);
    }
  });
  /* nhiệm vụ: thêm câu chuyện (gắn vào desc để openQuest hiện) */
  var qD = CONFIG.QUESTS.find(function(q){ return q.id==='qDeliver'; });
  if(qD && !qD._storied){
    qD._storied = true;
    qD.descVi += ' Chị Lan kể: bức tranh mặt trăng này là để tặng mẹ chị — mẹ chị thích trăng rằm lắm.';
    qD.descEn += ' Lan says: this moon painting is a gift for her mother, who loves the full moon.';
  }
  var qS = CONFIG.QUESTS.find(function(q){ return q.id==='qSign'; });
  if(qS && !qS._storied){
    qS._storied = true;
    qS.descVi += ' Cô Năm mơ ước: biển hiệu thật đẹp để chùa được nhiều người biết tới hơn.';
    qS.descEn += ' Ms. Nam dreams: a beautiful sign so the pagoda becomes known to more people.';
  }
  /* lịch sử thật (hiện khi chạm skyline/điểm mốc) */
  LW.history = [
    {x:280, name:'Nhà thờ Đức Bà', vi:'Nhà thờ Đức Bà xây 1877–1880 bằng gạch nhập từ Pháp, 2 tháp chuông cao 58m.', en:'Notre-Dame Cathedral, built 1877–1880 with bricks from France, its twin spires 58m tall.'},
    {x:830, name:'Tháp đồng hồ Bến Thành', vi:'Chợ Bến Thành xây 1912–1914, tháp đồng hồ là biểu tượng của Sài Gòn hơn 100 năm.', en:'Ben Thanh Market was built 1912–1914; its clock tower has symbolised Saigon for over 100 years.'},
    {x:1062, name:'Bitexco', vi:'Tòa tháp Bitexco hoàn thành 2010, cao 262m — từng là tòa nhà cao nhất Sài Gòn.', en:'Bitexco Tower, completed 2010, 262m tall — once Saigon\'s tallest building.'},
    {x:356, name:'Dinh Độc Lập', vi:'Dinh Độc Lập xây dựng thập niên 1960, nơi ghi dấu ngày 30/4/1975.', en:'Independence Palace, built in the 1960s, marks 30 April 1975.'},
    {x:1423, name:'Chùa', vi:'Chùa xanh nhiều tầng mái cong — góc yên tĩnh của thị trấn.', en:'The green pagoda with curved tiered roofs — the quiet corner of town.'},
    {x:795, name:'Landmark 81', vi:'Tháp cao nhất Việt Nam, cao 461,2m với 81 tầng, lấy cảm hứng từ lũy tre, khởi công năm 2015 và hoàn thành năm 2018 bên bờ sông Sài Gòn.', en:'Vietnam\'s tallest tower, 461.2m with 81 floors, inspired by bamboo hedges, built 2015–2018 on the Saigon River.'},
    {x:1695, name:'Cầu Ba Son', vi:'Cầu dây văng qua sông Sài Gòn nối Quận 1 với Thủ Thiêm, thông xe ngày 28/4/2022, với trụ vòm trắng cao 113m nghiêng về phía Thủ Thiêm và 56 bó cáp.', en:'A cable-stayed bridge over the Saigon River linking District 1 and Thu Thiem, opened 28/4/2022, with a white arch tower 113m tall leaning toward Thu Thiem and 56 cable bundles.'},
    {x:1265, name:'Marina Central Tower', vi:'Tháp kính 55 tầng cao 240m ở số 2 Tôn Đức Thắng, hoàn thành năm 2025, nối thẳng với ga Metro Ba Son.', en:'A 55-storey glass tower, 240m tall at 2 Ton Duc Thang, completed 2025, linked directly to Ba Son Metro station.'},
    {x:565, name:'Vincom Đồng Khởi', vi:'Khối thương mại và văn phòng lớn 29 tầng ở 70–72 Lê Thánh Tôn, mỗi tầng rộng 4.600m², ngay trung tâm Quận 1.', en:'A large 29-storey retail and office block at 70–72 Le Thanh Ton, each floor 4,600m2, right in the heart of District 1.'},
    {x:1738, name:'Khu đô thị Sala', vi:'Khu đô thị mới ven sông ở Thủ Thiêm, hiện đại và nhiều cây xanh, với tháp Thisofic uốn lượn như hình rồng.', en:'A new riverside urban area in Thu Thiem, modern and green, with the winding Thisofic tower shaped like a dragon.'},
    {x:1556, name:'Bưu điện Trung tâm', vi:'Tòa nhà Pháp xây năm 1886–1891 ở số 2 Công xã Paris, đối diện Nhà thờ Đức Bà, nổi tiếng với mái vòm sắt và mặt tiền vàng.', en:'A French building from 1886–1891 at 2 Cong Xa Paris, opposite Notre-Dame Cathedral, famous for its iron dome and yellow facade.'},
    {x:1281, name:'Nhà hát Lớn', vi:'Nhà hát Thành phố khánh thành ngày 1/1/1900, mặt tiền lộng lẫy theo phong cách Flamboyant của Pháp, ở Công trường Lam Sơn.', en:'The City Theatre, opened 1/1/1900, with a splendid facade in the French Flamboyant style, at Lam Son Square.'},
    {x:1525, name:'Nhà thờ Tân Định', vi:'Nhà thờ khánh thành ngày 16/12/1876, được sơn màu hồng từ năm 1957 nên ai cũng gọi là \'nhà thờ màu hồng\', tháp chính cao 52,6m.', en:'The church, consecrated 16/12/1876, painted pink since 1957 — everyone calls it the pink church — its main tower 52.6m tall.'},
    {x:1742, name:'Bến Nhà Rồng', vi:'Ngày 5/6/1911, người thanh niên Nguyễn Tất Thành rời bến cảng này trên tàu Latouche-Tréville ra đi tìm đường cứu nước.', en:'On 5/6/1911, the young Nguyen Tat Thanh left this port aboard the Latouche-Treville to seek a way to save the country.'},
    {x:1056, name:'UBND TP', vi:'Tòa thị chính xây năm 1898–1908, khánh thành năm 1909, đứng đầu phố đi bộ Nguyễn Huệ với tháp chuông nhọn giữa.', en:'The city hall, built 1898–1908 and opened in 1909, stands at the head of Nguyen Hue walking street with a pointed bell tower in the middle.'},
    {x:1142, name:'Phố đi bộ Nguyễn Huệ', vi:'Quảng trường đi bộ đầu tiên của Việt Nam, khánh thành ngày 29/4/2015, dài 670m từ UBND ra bến Bạch Đằng, với tượng Bác Hồ và đài phun sen.', en:'Vietnam\'s first walking square, opened 29/4/2015, 670m long from the city hall to Bach Dang wharf, with the Ho Chi Minh statue and lotus fountain.'},
    {x:796, name:'Chùa Ngọc Hoàng', vi:'Chùa do ông Lưu Minh, người Quảng Đông, xây từ năm 1892 để thờ Ngọc Hoàng Thượng Đế, nổi tiếng với hàng trăm tượng và kiến trúc Trung Hoa màu đỏ.', en:'A temple built from 1892 by Luu Minh from Guangdong to worship the Jade Emperor, famous for its hundreds of statues and red Chinese architecture.'},
    {x:1491, name:'Chợ Bình Tây', vi:'Chợ do thương nhân Quách Đàm bỏ tiền xây năm 1928–1930 ở Quận 6, với tháp đồng hồ bốn mặt và mái ngói âm dương mang đậm nét Á Đông.', en:'A market built 1928–1930 in District 6 with money from merchant Quach Dam, with a four-faced clock tower and yin-yang tiled roofs in strong Asian style.'},
    {x:1760, name:'Chung cư 42 Nguyễn Huệ', vi:'Chung cư 9 tầng xây đầu thập niên 1960, thành \'chung cư cà phê\' sau khi Nguyễn Huệ thành phố đi bộ năm 2015, nổi tiếng thế giới qua ảnh National Geographic năm 2020.', en:'A 9-storey apartment block from the early 1960s, turned into the coffee apartment building after Nguyen Hue became a walking street in 2015, famous worldwide through a 2020 National Geographic photo.'},
  ];
  /* cột mốc hành trình mua tiệm 5.000đ */
  LW.milestones = [
    {at:1000, done:false, vi:'💰 Đã tiết kiệm 1.000đ! Mới 1/5 chặng đường mua tiệm vẽ — cố lên bé cá!', en:'💰 Saved 1,000 coins! One fifth of the way to your own art shop — keep going!'},
    {at:2500, done:false, vi:'💰 Đã được 2.500đ — nửa đường rồi! Tiệm vẽ đang chờ bé cá!', en:'💰 2,500 coins — halfway there! Your art shop is waiting!'},
    {at:4000, done:false, vi:'💰 4.000đ! Chỉ còn 1.000đ nữa là mua được tiệm vẽ của riêng mình!', en:'💰 4,000 coins! Just 1,000 more and the art shop is yours!'},
  ];
}
function lwMilestoneTick(){
  if(!LW.milestones) return;
  LW.milestones.forEach(function(m){
    if(!m.done && (state.coins||0) >= m.at){
      m.done = true;
      toast(state.lang==='vi' ? m.vi : m.en);
    }
  });
}
/* --- lắp ráp thế giới sống + vòng lặp cập nhật mỗi khung --- */
function buildLivingWorld(scene){
  lwMakeTextures(scene);
  buildSkyline(scene);
  buildSkyBodies(scene);
  buildNightLights(scene);
  /* tint ngày–đêm: hình chữ nhật cố định theo camera, phủ tối cảnh lúc hoàng hôn/đêm
     (depth 1800: trên thế giới + nhân vật, dưới mưa/tiền cảnh; đèn + mặt trăng ở 1850 để nổi lên) */
  LW.tint = scene.add.rectangle(0, 0, 3000, 2000, 0x0A1030, 0);
  LW.tint.setOrigin(0, 0);
  LW.tint.setScrollFactor(0);
  LW.tint.setDepth(1800);
  buildForegroundTufts(scene);
  buildRain(scene);
  buildBirds(scene);
  buildStrays(scene);
  buildTraffic(scene);
  buildInteractables(scene);
  lwExtendContent();
  /* ĐỢT SỬA #4 (A44): vòng lặp bóng cũ ĐÃ XOÁ — nó chạy trước buildNpc nên
     PH.npcObjs còn rỗng (không bóng nào được tạo); bóng giờ tạo trong buildNpc. */
  LW.phase = (typeof state!=='undefined' && state.timePhase!=null) ? state.timePhase : 0;
  lwApplyPhase(scene);
  /* mùa theo ngày (7 ngày/mùa, bắt đầu Xuân) */
  LW.season = Math.floor(((state.day||1)-1)/7) % 4;
}
function livingWorldTick(scene, dt){
  /* pha ngày–đêm đổi thì áp lại mặt trời/mặt trăng/mây/đèn */
  var ph = (typeof state!=='undefined' && state.timePhase!=null) ? state.timePhase : 0;
  if(ph!==LW.phase){ LW.phase = ph; lwApplyPhase(scene); }
  /* R11.1 (20/11): skyline xa chỉ hiện khi camera còn ở vùng trời phía bắc
     (scrollY < 950) — khi camera xuống sâu trong thị trấn, skyline cố định ở
     đỉnh màn hình sẽ đè lên đất/đường, trông như nhà ma lơ lửng (An 08:22). */
  if(LW.skyline){ LW.skyline.setVisible(scene.cameras.main.scrollY < 950); }
  /* mặt trời/mặt trăng bám theo camera (cố định theo màn hình) */
  if(LW.sun && LW.sun.visible || LW.moon && LW.moon.visible) lwApplyPhaseSunOnly(scene);
  lwCloudTick(scene, dt);
  lwBirdTick(scene, dt);
  lwStrayTick(scene, dt);
  lwTrafficTick(scene, dt);
  lwMusicTick(dt);
  lwMilestoneTick();
  /* thuyền trên sông: trôi chậm, gợn sóng sau đuôi */
  if(LW.riverBoat){
    LW.riverBoat.x += 14*dt;
    if(LW.riverBoat.x > 2400) LW.riverBoat.x = -80;
    if(Math.random()<dt*2){
      var r = scene.add.image(LW.riverBoat.x - 50, LW.riverBoat.y + 8, 'lw-ripple');
      r.setDisplaySize(46, 12);
      r.setScrollFactor(0.15, 0);
      r.setDepth(-93);
      r.setAlpha(0.6);
      scene.tweens.add({targets:r, scaleX:1.8, alpha:0, duration:1600, onComplete:function(){ r.destroy(); }});
    }
    if(Math.random()<dt*0.5) lwSound('water');
  }
  /* bóng NPC theo hướng nắng */
  var sh = lwSunShadow();
  Object.keys(LW.npcShadows).forEach(function(id){
    var e = LW.npcShadows[id];
    e.setPosition(sh.dx, 4);
    e.setScale(sh.len, 1);
    e.setAlpha(sh.alpha);
  });
  /* mùa: đổi theo ngày, tint nhẹ theo mùa (áp qua overlay DOM có sẵn) */
  var seas = Math.floor(((state.day||1)-1)/7) % 4;
  if(seas!==LW.season){
    LW.season = seas;
    var names = ['🌸 Xuân', '☀️ Hạ', '🍂 Thu', '❄️ Đông'];
    toast((state.lang==='vi' ? 'Mùa ' : 'Season: ') + (names[seas]||''));
  }
}
function lwApplyPhaseSunOnly(scene){
  /* chỉ cập nhật vị trí mặt trời/mặt trăng (scrollFactor 0 -> screen/zoom) */
  var cam = scene.cameras.main;
  var cw = cam.width, ch = cam.height;
  if(LW.sun && LW.sun.visible){
    var sx = LW.phase===0 ? cw*0.86 : cw*0.14;
    var sy = LW.phase===0 ? ch*0.10 : ch*0.40;
    LW.sun.setPosition(sx/cam.zoom, sy/cam.zoom);
  }
  if(LW.moon && LW.moon.visible){
    LW.moon.setPosition((cw*0.2)/cam.zoom, (ch*0.14)/cam.zoom);
  }
}
function ensureBoneFacing(scene, facing){
  if(!PH.rig.facings) return false; /* rig xương đã bỏ (An 17:17) — hàm này không còn được gọi */
  var cleanKey = 'bone-'+facing+'-clean';
  if(!scene.textures.exists(cleanKey)) return false;
  var built = buildBoneFacing(scene, PH.rig.root, facing, cleanKey);
  PH.rig.facings[facing] = built;
  PH.rig.root.bringToTop(PH.rig.name);
  return true;
}
/* ---- SCENE ---- */
class WorldScene extends Phaser.Scene {
  constructor(){ super('world'); }
  preload(){
    /* SINGLE-TOWN (đợt #6): 1 nền duy nhất bg-town.png 1600x1400 (An duyệt 23:25).
       3 nền cũ plaza/street/market KHÔNG còn tải — giữ file trên đĩa để rollback. */
    this.load.image('bg-town', 'map3d/bg-town.png?v=r11.2');
    /* TIỀN CẢNH 3D: 18 sprite đã crop theo bbox (manifest.json) — vẽ tại
       anchor, depth = foot_y (Y-sort thật). File *-c.png, tổng ~571KB. */
    FG3D.forEach(function(f){ this.load.image(f.key, f.file); }, this);
    /* bé cá KHÔNG còn rig xương (An 17:17, 19/11) — chỉ 3 sprite sheet đi/đứng/nhảy */
    Object.keys(RIGS).forEach(function(id){
      this.load.image('rig-'+id+'-walk', RIGS[id].walk);
      if(RIGS[id].jump && RIGS[id].jump!==RIGS[id].walk) this.load.image('rig-'+id+'-jump', RIGS[id].jump);
      if(RIGS[id].idle) this.load.image('rig-'+id+'-idle', RIGS[id].idle);
    }, this);
    /* ĐỢT SỬA #2 (A21): sheet đi dọc của bé cá (mặt trước = đi xuống, mặt sau = đi lên) */
    if(RIGS.beca.walkFront) this.load.image('rig-beca-walkfront', RIGS.beca.walkFront);
    if(RIGS.beca.walkBack) this.load.image('rig-beca-walkback', RIGS.beca.walkBack);
    this.load.image('becaEmpty', CONFIG.IMAGES.becaEmpty);
    var t = this.add.text(10, 10, 'Đang tải phố Sài Gòn…', {fontSize:'18px', color:'#7A4A21'});
    t.setScrollFactor(0);
    this._loadText = t;
  }
  create(){
    if(this._loadText) this._loadText.destroy();
    var scene = this;
    PH.scene = scene;
    buildZoneImages(scene);
    buildForeground(scene);
    buildClouds(scene);
    buildSignsAndBuildings(scene);
    buildLivingWorld(scene); /* thế giới sống (An 16:09/16:13/16:15) */
    /* quest marker (giao tranh 📍) — ẩn mặc định, renderQuestItems bật/tắt */
    var qm = scene.add.text(0, 0, '📍', {fontSize:'30px'});
    qm.setOrigin(0.5, 1);
    qm.setVisible(false);
    qm.setInteractive({useHandCursor:true});
    qm.setData('questItem', 'deliver');
    scene.add.existing(qm);
    PH.questMarker = qm;
    buildPlayer(scene);
    /* NPC: tất cả CUSTOMERS (Bé Mai đã xoá hẳn, không còn trong CUSTOMERS) + ông chủ nhà */
    Object.keys(npcs).forEach(function(id){ buildNpc(scene, id); });
    /* camera */
    var cam = scene.cameras.main;
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.setZoom(lwCamZoom(scene)); /* ĐỢT SỬA #3 (A28): zoom theo viewport — 1.15 cũ cắt biển hiệu ở nam dải đi (live đợt #2) */
    cam.startFollow(PH.playerBody, true, 0.12, 0.12); /* ĐỢT SỬA #2 (A20): lerp 0.12 (nhanh hơn 0.08) — camera bám sát tay hơn, bớt cảm giác lag */
    cam.setFollowOffset(0, -60);
    cam.setBackgroundColor('#E8C99A');
    /* input: joystick trái / xoay camera phải / tap */
    scene.input.on('pointerdown', function(p){ onWorldDown(scene, p); });
    scene.input.on('pointermove', function(p){ onWorldMove(scene, p); });
    scene.input.on('pointerup', function(p){ onWorldUp(scene, p); });
    scene.input.on('pointerupoutside', function(p){ onWorldUp(scene, p); });
    PH.ready = true;
    syncPhaserWorld();
  }
  update(time, delta){
    if(!PH.ready) return;
    if(!document.body.classList.contains('map-mode')) return;
    var dt = Math.min(0.05, delta/1000 || 0.016);
    var scene = this;
    /* camera yaw/pitch lerp (8/s) + nghiêng ±7° */
    var ck = 1 - Math.exp(-8*dt);
    camYaw += (camTargetYaw - camYaw)*ck;
    camPitch += (camTargetPitch - camPitch)*ck;
    var tilt = -7*Math.sin(camYaw*Math.PI/180);
    scene.cameras.main.setRotation(tilt*Math.PI/180);
    /* ĐỢT SỬA #4 (A41): la bàn theo hướng di chuyển thật (PH.moveHd, cập nhật ở
       khối di chuyển dưới) — cũ chỉ nhận camYaw nên luôn "0° · Bắc" khi không
       xoay camera (live đợt #3). Đứng yên >0,5s thì trở về hướng camera. */
    updateCompass((PH.moveHd!=null && (performance.now()-PH.moveHdT)<500) ? PH.moveHd : ((camYaw%360)+360)%360);
    lwUpdateCamera(scene); /* ĐỢT SỬA #3 (A28): camera động (zoom + offset theo viewport/bé cá) */
    /* ---- di chuyển: đọc body (đã qua bước vật lý khung trước), kẹp, đặt vận tốc ---- */
    var body = PH.playerBody.body;
    beca.x = body.x + 18; /* body 36x36, tâm = vị trí */
    beca.y = body.y + 18;
    /* kẹp cứng vào dải đi (chân tường + tán cây) */
    var cx0 = Math.min(WALK.x1, Math.max(WALK.x0, beca.x));
    var cy0 = Math.min(WALK.y1, Math.max(walkMinY(beca.x), beca.y));
    if(cx0!==beca.x || cy0!==beca.y){ beca.x=cx0; beca.y=cy0; body.reset(beca.x, beca.y); /* reset(x,y) đặt TÂM GameObject tại (x,y) — không trừ 18 */ }
    var vx=0, vy=0, mag=0, moveIsScreen=false;
    if(dragVec){
      mag = dragVec.m || 0;
      vx = dragVec.x*SPEED_MAX; vy = dragVec.y*SPEED_MAX;
      moveIsScreen = true;
    } else if(moveTarget){
      var dx = moveTarget.x-beca.x, dy = moveTarget.y-beca.y, d = Math.hypot(dx,dy);
      if(d<8){ moveTarget=null; }
      else { vx=dx/d*SPEED_MAX; vy=dy/d*SPEED_MAX; mag=1; }
    }
    walking = !!(vx||vy);
    curSpeed = walking ? Math.hypot(vx,vy) : 0;
    animState = !walking ? 'idle' : (mag>0.55 ? 'run' : 'walk');
    if(walking){
      var wx=vx, wy=vy;
      if(moveIsScreen){
        var a = camYaw*Math.PI/180;
        wx = vx*Math.cos(a)-vy*Math.sin(a);
        wy = vx*Math.sin(a)+vy*Math.cos(a);
      }
      if(wx<-5) facing='left'; else if(wx>5) facing='right';
      body.setVelocity(wx, wy);
      /* ĐỢT SỬA #4 (A36): ghi vận tốc Ý ĐỊNH (trước trượt NPC/vật cản) để tickRig
         + la bàn chọn hướng — vận tốc body sau trượt bị triệt tiêu trục chính
         (đi xuống bị chặn -> vy=0, vx=±110) nên tickRig đọc nhầm thành đi ngang
         (live đợt #3: đi xuống hiện sheet nghiêng). */
      PH.moveDir = {x:wx, y:wy};
      /* ĐỢT SỬA #4 (A41): hướng la bàn = hướng di chuyển thế giới (0°=Bắc=-y). */
      PH.moveHd = (Math.atan2(wx, -wy)*180/Math.PI+360)%360; PH.moveHdT = performance.now();
    } else {
      body.setVelocity(0, 0);
      PH.moveDir = {x:0, y:0};
    }
    /* tiếng bước chân */
    if(animState==='walk' || animState==='run') sfx('step', animState==='run'?260:380);
    /* NPC + nhiệm vụ + ngày/đêm + minimap (logic cũ, giữ nguyên) */
    npcTick(dt);
    separateNpcs();
    slideAlongNpcs(dt); /* ĐỢT SỬA #2 (A16): trượt dọc NPC, không kẹt */
    slideAlongObstacles(dt); /* ĐỢT SỬA #3 (A27): trượt dọc vật cản, không kẹt sau gốc cọ/bồn đá */
    /* ĐỢT SỬA #4 (A38): kẹp vận tốc ≤ SPEED_MAX sau trượt — trượt tiếp tuyến
       (+110px/s) cộng vào 380px/s có thể vượt tốc chạy; vận tốc cũ tồn đọng
       + đẩy NPC không bao giờ được vượt tốc chạy (chống nhảy vọt, mục 3). */
    (function(){ var _b = PH.playerBody && PH.playerBody.body; if(!_b) return; var _vx=_b.velocity.x, _vy=_b.velocity.y, _sp=Math.hypot(_vx,_vy); if(_sp>SPEED_MAX){ _b.setVelocity(_vx/_sp*SPEED_MAX, _vy/_sp*SPEED_MAX); } })();
    npcChatTick(dt);
    questTick();
    dayNightTick(dt);
    livingWorldTick(scene, dt); /* thế giới sống: mây, chim, xe, sông, mùa... */
    zoneTick();
    drawMinimap();
    /* rig bé cá (xương thật) */
    tickRig(scene, dt);
    /* cập nhật camX/camY chia sẻ (debug hooks + compass) */
    camX = scene.cameras.main.scrollX;
    camY = scene.cameras.main.scrollY;
  }
}
/* ĐỢT SỬA #3 (A28): camera động — zoom theo viewport + offset nhìn lên bắc.
   Zoom: desktop 1.05 (1.15 cũ cắt biển), màn hẹp 0.9, màn ngắn (ngang) 0.8;
   giới hạn thêm theo chiều cao (camH/880) để cửa sổ lùn vẫn thấy biển.
   Offset: -60 khi bé cá ở bắc dải đi, tới -160 khi ở nam (nhìn lên bắc để
   biển hiệu + landmark trong khung). Chỉ áp khi giá trị đổi (tránh set mỗi khung). */
function lwCamZoom(scene){
  var cam = scene.cameras.main;
  var zw = cam.width < 700 ? 0.9 : 1.05;
  var zh = Math.min(1.05, Math.max(0.7, cam.height / 880));
  return Math.min(zw, zh);
}
function lwUpdateCamera(scene){
  var cam = scene.cameras.main;
  var z = lwCamZoom(scene);
  if(Math.abs(cam.zoom - z) > 0.001) cam.setZoom(z);
  var off = -60 - Math.min(100, Math.max(0, (beca.y - 1050) * 0.35));
  if(Math.abs((cam.followOffset.y || 0) - off) > 1) cam.setFollowOffset(0, off);
}
/* ---- rig tick: bé cá = sprite sheet (không khớp nối — An 17:17, 19/11) ----
   đi: 6 khung side (lật ngang khi đi trái); đứng: mặt trước; nhảy: 3 khung
   (cúi -> trên không -> tiếp đất). Chân luôn chạm đất: ảnh bottom-aligned,
   container ở (beca.x, beca.y - jumpZ). */
function tickRig(scene, dt){
  if(!PH.rig) return;
  var st = becaJump ? 'jump' : animState;
  rigSetStatePhaser(st);
  if(st==='walk' || st==='run'){
    var A = st==='run'?40:25;
    var stride = 2*(BONE_LIMB.upperLeg+BONE_LIMB.lowerLeg)*Math.sin(boneRad(A));
    var speed = Math.min(Math.max(curSpeed||0, 0), SPEED_MAX);
    if(stride>1 && speed>0) rigState.phase += dt*speed/(2*stride);
  } else if(st==='idle'){
    rigState.phase += dt*0.5;
  }
  if(becaJump) phaserJumpTick(dt);
  var sheet, frame;
  if(st==='jump'){
    sheet = 'jump';
    frame = !becaJump ? 2 : becaJump.phase==='crouch' ? 0 : becaJump.phase==='air' ? 1 : 2;
  } else if(st==='idle'){
    sheet = 'idle'; frame = 0;
  } else {
    /* ĐỢT SỬA #2 (A21): đi dọc dùng sheet mặt trước/sau (An 19:41) — đi xuống =
       mặt trước, đi lên = mặt sau; đi ngang = sheet ngang. Dùng vận tốc THẾ GIỚI
       (đã trượt qua NPC) để chọn hướng; fallback walk ngang nếu sheet dọc chưa có. */
    /* ĐỢT SỬA #4 (A36): chọn sheet theo vận tốc Ý ĐỊNH (PH.moveDir, đã xoay theo
       camYaw) — body.velocity sau slideAlongNpcs/slideAlongObstacles bị triệt
       tiêu trục chính khi bị chặn (đi xuống chạm tường nam -> vy=0, vx=±110 trượt
       ngang) nên đọc nhầm thành đi ngang. Chỉ dùng body.velocity khi không có
       ý định di chuyển (bị đẩy bởi NPC). */
    var bv = (PH.moveDir && (PH.moveDir.x || PH.moveDir.y)) ? PH.moveDir : ((PH.playerBody && PH.playerBody.body) ? PH.playerBody.body.velocity : null);
    if(bv && Math.abs(bv.y) > Math.abs(bv.x)){
      sheet = bv.y > 0 ? 'walkfront' : 'walkback';
      if(!PH.scene.textures.exists(sheet==='walkfront' ? 'rig-beca-walkfront' : 'rig-beca-walkback')) sheet = 'walk';
    } else {
      sheet = 'walk';
    }
    frame = Math.floor((rigState.phase%1)*RIGS.beca.walkFrames)%RIGS.beca.walkFrames;
  }
  becaSpriteSet(scene, sheet, frame);
  PH.rig.img.setFlipX(facing==='left' && sheet!=='walkfront' && sheet!=='walkback'); /* sheet mặt trước/sau không lật */
  var sc = depthScale(beca.y);
  var sy = becaJump && becaJump.phase==='land' ? 0.94 : 1;
  PH.rig.root.setPosition(beca.x, beca.y - PH.jumpZ);
  PH.rig.root.setScale(sc, sc*sy);
  PH.rig.root.setDepth(Math.round(beca.y));
  if(PH.rig.nameTop){ PH.rig.nameTop.setPosition(beca.x, beca.y - 148*sc - PH.jumpZ); PH.rig.nameTop.setScale(sc); } /* ĐỢT SỬA #3 (A35): nhãn theo bé cá ở lớp trên cùng */
  var shScale = sc*(1 - Math.abs(PH.jumpZ)/333);
  /* bóng đổ theo hướng nắng (An 16:13): sáng đổ sang tây, hoàng hôn dài sang đông, đêm mờ */
  var shSun = lwSunShadow();
  PH.rig.shadow.setPosition(beca.x + shSun.dx, beca.y+4 + PH.jumpZ*0.3);
  PH.rig.shadow.setScale(shScale*shSun.len, shScale);
  PH.rig.shadow.setAlpha(shSun.alpha);
  PH.rig.shadow.setDepth(Math.round(beca.y)-1);
}
/* ---- input (port pointer handlers DOM, nghe ở window -> canvas Phaser) ---- */
function joyShow(x, y){ var j=document.getElementById('joystick'); if(!j) return; var r=document.getElementById('mapView').getBoundingClientRect(); j.style.left=(x-r.left)+'px'; j.style.top=(y-r.top)+'px'; j.style.display='block'; }
function joyHide(){ var j=document.getElementById('joystick'); if(j) j.style.display='none'; }
function dotShow(x, y){ var d=document.getElementById('dragDot'); if(!d) return; var r=document.getElementById('mapView').getBoundingClientRect(); d.style.left=(x-r.left)+'px'; d.style.top=(y-r.top)+'px'; d.style.display='block'; }
function dotHide(){ var d=document.getElementById('dragDot'); if(d) d.style.display='none'; }
function onWorldDown(scene, p){
  var r = scene.scale.canvas.getBoundingClientRect();
  var leftSide = p.x < r.width*0.55;
  PH.dragStart = {x:p.x, y:p.y, leftSide:leftSide};
  PH.dragMode = 'maybe';
  PH.dragT0 = performance.now();
  moveTarget = null; dragVec = null; PH.camDrag = null; PH.joyBase = null;
  dotShow(p.x + r.left, p.y + r.top);
}
function onWorldMove(scene, p){
  if(!PH.dragStart) return;
  var dx = p.x - PH.dragStart.x, dy = p.y - PH.dragStart.y;
  var d = Math.hypot(dx, dy);
  if(PH.dragMode==='maybe' && d>6){
    PH.dragMode = 'drag';
    if(PH.dragStart.leftSide){
      PH.joyBase = {x: PH.dragStart.x, y: PH.dragStart.y};
      var r = scene.scale.canvas.getBoundingClientRect();
      joyShow(PH.joyBase.x + r.left, PH.joyBase.y + r.top);
    } else {
      PH.camDrag = {x:p.x, y:p.y, yaw:camTargetYaw, pitch:camTargetPitch};
      dotHide();
    }
  }
  if(PH.dragMode==='drag'){
    if(PH.dragStart.leftSide){
      var m = Math.min(1, d/60);
      dragVec = {x: dx/d*m, y: dy/d*m, m:m};
      var r2 = scene.scale.canvas.getBoundingClientRect();
      dotShow(p.x + r2.left, p.y + r2.top);
      var knob = document.getElementById('joyKnob');
      if(knob){
        var kx = Math.max(-34, Math.min(34, dx*0.55)), ky = Math.max(-34, Math.min(34, dy*0.55));
        knob.style.transform = 'translate('+kx+'px,'+ky+'px)';
      }
    } else if(PH.camDrag){
      camTargetYaw = PH.camDrag.yaw - (p.x - PH.camDrag.x)*0.35;
      camTargetPitch = Math.max(-20, Math.min(35, PH.camDrag.pitch + (p.y - PH.camDrag.y)*0.2));
    }
  }
}
function onWorldUp(scene, p){
  if(!PH.dragStart) return;
  if(PH.dragMode==='maybe' && performance.now()-PH.dragT0<600){
    if(!worldTapAt(scene, p)){
      var wp = scene.cameras.main.getWorldPoint(p.x, p.y);
      var now = performance.now();
      if(now - PH.lastTapT < 350 && !becaJump){ doJump(); PH.lastTapT = 0; }
      else {
        PH.lastTapT = now;
        moveTarget = {x: Math.min(WALK.x1, Math.max(WALK.x0, wp.x)), y: Math.min(WALK.y1, Math.max(walkMinY(wp.x), wp.y))};
      }
    }
  }
  PH.dragStart = null; PH.dragMode = null; dragVec = null; PH.camDrag = null; PH.joyBase = null;
  dotHide(); joyHide();
}
/* tap: NPC / ông chủ nhà / tòa nhà / quest marker (ưu tiên vật trên cùng) */
function worldTapAt(scene, p){
  var hits = scene.input.hitTestPointer(p);
  if(hits && hits.length){
    /* hitTestPointer không đảm bảo thứ tự theo depth -> chọn tường minh hit có depth
       CAO NHẤT (vật trên cùng về mặt thị giác). FG không có data thì bỏ qua. */
    var best = null, bestDepth = -1e9;
    for(var i=0; i<hits.length; i++){
      var h = hits[i];
      if(!h.getData) continue;
      var has = h.getData('npcId') || h.getData('strayId') || h.getData('interactId') || h.getData('bldId') || h.getData('questItem');
      if(has && h.depth > bestDepth){ best = h; bestDepth = h.depth; }
    }
    if(best){
      var npcId = best.getData('npcId');
      if(npcId){ if(npcId==='chu'){ openLandlord(); } else { tapCustomer(npcId); } return true; }
      var strayId = best.getData('strayId');
      if(strayId){ lwPetStray(strayId); return true; }
      var interId = best.getData('interactId');
      if(interId){ lwTapInteract(interId); return true; }
      var bldId = best.getData('bldId');
      if(bldId){ mapTapBuilding(bldId); return true; }
      var qi = best.getData('questItem');
      if(qi){ tapQuestItem(qi); return true; }
    }
  }
  /* chạm skyline (đỉnh màn hình): kể lịch sử landmark gần nhất — chỉ khi
     skyline đang hiện (R11.1: skyline ẩn khi camera xuống sâu). */
  if(LW.skyline && LW.skyline.visible && p.y < 260 && LW.history){
    var wp = scene.cameras.main.getWorldPoint(p.x, p.y);
    var best = null, bd = 1e9;
    LW.history.forEach(function(h){
      var d = Math.abs((wp.x||0) - h.x*2);
      if(d<bd){ bd=d; best=h; }
    });
    if(best){
      toast('📖 ' + best.name + ' — ' + (state.lang==='vi' ? best.vi : best.en));
      return true;
    }
  }
  return false;
}
/* ---- hooks cho logic game cũ ---- */
function syncQuestMarker(){
  if(!PH.questMarker) return;
  var qd = questState('qDeliver');
  var q = CONFIG.QUESTS.find(function(x){return x.id==='qDeliver';});
  if(qd.status==='active' && q){
    PH.questMarker.setPosition(q.target.x, q.target.y);
    PH.questMarker.setDepth(Math.round(q.target.y));
    PH.questMarker.setVisible(true);
  } else {
    PH.questMarker.setVisible(false);
  }
}
function syncPhaserWorld(){
  if(!PH.ready) return;
  Object.keys(npcs).forEach(function(id){ if(npcs[id]) syncNpcPhaser(npcs[id]); });
  syncQuestMarker();
}
window.syncQuestMarker = syncQuestMarker;
window.syncPhaserWorld = syncPhaserWorld;
window.syncNpcPhaser = syncNpcPhaser;
window.walkMinY = walkMinY;
window.canopyMinY = canopyMinY;
window.__phaserSetName = function(txt){ if(PH.rig && PH.rig.name) PH.rig.name.setText(txt); };
window.__phaserScreenPoint = function(wx, wy){ var cam = PH.scene.cameras.main; var m = cam.matrixCombined.matrix; var sx = wx*m[0] + wy*m[2] + m[4]; var sy = wx*m[1] + wy*m[3] + m[5]; var cv = document.querySelector('#phaserMap canvas').getBoundingClientRect(); return {x: cv.left + sx, y: cv.top + sy, sx: sx, sy: sy}; };
window.__phaserCamFreeze = function(){ var cam = PH.scene.cameras.main; cam.stopFollow(); return {sx: Math.round(cam.scrollX), sy: Math.round(cam.scrollY)}; };
window.__phaserCamUnfreeze = function(){ var cam = PH.scene.cameras.main; cam.startFollow(PH.playerBody, true, 0.08, 0.08); return 'ok'; };
window.__phaserPetTest = function(id){ var s = LW.strays.find(function(v){ return v.id===id; }); var before = s ? s.state : 'missing'; lwPetStray(id); var t = document.getElementById('toast'); return {before: before, after: s ? s.state : 'missing', toast: t.textContent, shown: t.classList.contains('show')}; };
window.__phaserStrays = function(){ return LW.strays.map(function(t){ return {id:t.id, x:Math.round(t.x), y:Math.round(t.y), state:t.state}; }); };
window.__phaserNpcs = function(){ var o={}; Object.keys(PH.npcObjs).forEach(function(k){ var n=PH.npcObjs[k]; o[k]={x:Math.round(n.cont.x), y:Math.round(n.cont.y)}; }); return o; };
window.__phaserTapAt = function(wx, wy){
  var scene = PH.scene;
  var cam = scene.cameras.main;
  var m = cam.matrixCombined.matrix;
  var px = wx*m[0] + wy*m[2] + m[4];
  var py = wx*m[1] + wy*m[3] + m[5];
  var fake = {x: px, y: py, worldX: wx, worldY: wy};
  var hits = scene.input.hitTestPointer(fake);
  var list = hits.map(function(h){ return {key: h.texture ? h.texture.key : '?', d: h.getData ? JSON.stringify(h.data.values) : 'nodata', depth: h.depth}; });
  var ok = worldTapAt(scene, fake);
  return {hits: list, worldTapAt: ok, n: hits.length};
};
window.__phaserSyncBeca = function(){
  /* ĐỢT SỬA #4 (A39): giữ vận tốc quanh reset — như A26c trong separateNpcs:
     reset() đặt vận tốc về 0, vận tốc cũ tồn đọng/mất đồng bộ gây giật khi
     renderMap/updateWalker gọi sync giữa các khung (mục 3). */
  if(PH.playerBody){ var _v = PH.playerBody.body.velocity; var _x=_v.x, _y=_v.y; PH.playerBody.body.reset(beca.x, beca.y); PH.playerBody.body.setVelocity(_x, _y); /* reset đặt tâm tại (x,y) */ }
};
window.__phaserSyncCamera = function(){
  if(PH.scene){ PH.scene.cameras.main.centerOn(beca.x, beca.y); }
};
window.__phaserRig = function(){ return rigPose(); };
window.__phaserState = function(){
  return {ready: PH.ready, x: beca.x, y: beca.y, jumpZ: PH.jumpZ, jumpMax: Math.round((PH.jumpMax||0)*10)/10,
    facing: rigState.facing, state: rigState.state, phase: +rigState.phase.toFixed(3),
    npcs: Object.keys(PH.npcObjs).length, fgs: PH.fgs.length,
    camX: PH.scene ? Math.round(PH.scene.cameras.main.scrollX) : 0,
    camY: PH.scene ? Math.round(PH.scene.cameras.main.scrollY) : 0};
};
/* khởi tạo Phaser game (gọi từ init của game chính, thay mapLoop) */
window.__phaserInit = function(){
  if(window.__phaserGame) return window.__phaserGame;
  var parent = document.getElementById('phaserMap');
  var game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parent,
    width: parent.clientWidth || 1154,
    height: parent.clientHeight || 933,
    backgroundColor: '#E8C99A',
    /* preserveDrawingBuffer khi ?phaserPreserve=1: giữ frame cuối trong buffer để
       screenshot headless luôn thấy world (WebGL mặc định xoá buffer sau khi
       composite -> screenshot headless có thể chụp trúng lúc buffer trống). */
    render: {preserveDrawingBuffer: /[?&]phaserPreserve=1/.test(location.search)},
    fps: {smoothStep: false}, /* round 5: tắt làm mịn delta — gốc đi chậm ở FPS thấp (delta bị kéo về trung bình) */
    physics: {default:'arcade', arcade:{gravity:{x:0, y:0}, debug:false}},
    scale: {mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER},
    scene: WorldScene,
  });
  window.__phaserGame = game;
  return game;
};
})();
