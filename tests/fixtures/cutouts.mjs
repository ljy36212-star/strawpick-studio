// Synthetic alpha masks inspired by production failure modes, NOT customer art.
// Fixed coordinates and dimensions make every failure independently reproducible.
const polygon = (ctx, points) => {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath(); ctx.fill();
};
export const cutouts = {
  concave: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#446d81';
    polygon(c, [[30,35],[120,35],[120,175],[160,175],[160,35],[265,35],
      [265,150],[230,190],[265,225],[265,365],[30,365],[30,250],[70,215],[30,180]]);
  }},
  narrowBridge: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#70957a';
    c.fillRect(40,30,220,135); c.fillRect(147,160,6,80); c.fillRect(40,235,220,135);
  }},
  asymmetric: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#b67d52';
    polygon(c, [[50,35],[175,55],[255,125],[220,200],[270,300],[185,365],
      [55,340],[90,260],[25,210],[80,150]]);
  }},
  residue: {width: 300, height: 400, draw(c) {
    c.fillStyle = 'white'; c.fillRect(65,45,170,310);
    c.fillRect(15,20,2,2); c.fillRect(275,375,3,3);
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(250,120,30,70);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(235,200,25,65);
  }},
  enclosedVoid: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#70957a'; c.fillRect(40,35,220,330); c.clearRect(95,110,110,160);
  }},
  detachedDetail: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#b67d52'; c.fillRect(120,35,150,330); c.fillRect(5,175,15,45);
  }},
  needle: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#b67d52'; c.fillRect(149,30,2,340);
  }},
  sharpTip: {width: 300, height: 400, draw(c) {
    c.fillStyle = '#446d81'; polygon(c, [[150,25],[265,365],[35,365]]);
  }},
};
