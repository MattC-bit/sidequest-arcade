// Rebuild the release images from SideQuest's game renderers and icon geometry.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas} = require('@napi-rs/canvas');

const extension = path.resolve(__dirname, '../SideQuest');
const games = new Map();
const context = vm.createContext({SQ:{register:game=>games.set(game.id, game)}});
vm.runInContext('let seed=884; Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)',context);
for (const group of ['velocity','flux','signal','drift']) {
  vm.runInContext(fs.readFileSync(path.join(extension,group+'.js'),'utf8'),context);
}
function playfield(id) {
  const canvas = createCanvas(960,540);
  const ctx = canvas.getContext('2d');
  ctx.scale(1.5,1.5);
  const scene = games.get(id).create({score(){},end(){},sound(){},reduced:true});
  for (let i=0;i<85;i++) scene.update(1/60,new Set());
  scene.draw(ctx);
  return canvas;
}
const scenes = {};
for (const [collection,id] of Object.entries({velocity:'night-run',flux:'split-orbit',signal:'night-switch',drift:'koi-current'})) {
  scenes[collection]=playfield(id);
  fs.writeFileSync(path.join(extension,'art',collection+'.webp'),scenes[collection].toBuffer('image/webp',92));
}
const banner = createCanvas(1100,370);
const cover = banner.getContext('2d');
cover.fillStyle='#101120';cover.fillRect(0,0,banner.width,banner.height);
cover.drawImage(scenes.velocity,0,0,660,370);
cover.drawImage(scenes.flux,664,0,436,245);
cover.drawImage(scenes.drift,0,135,960,270,664,249,436,121);
fs.writeFileSync(path.join(extension,'art','hero.webp'),banner.toBuffer('image/webp',92));
for (const size of [16,32,48,128]) {
  const icon=createCanvas(size,size);
  const g=icon.getContext('2d');g.scale(size/64,size/64);
  g.fillStyle='#201932';g.beginPath();g.roundRect(1,1,62,62,13);g.fill();
  g.strokeStyle='#9e7ac2';g.lineWidth=2;g.stroke();
  g.fillStyle='#c7f583';g.beginPath();g.moveTo(37,8);g.lineTo(14,35);g.lineTo(29,35);g.lineTo(24,56);g.lineTo(52,25);g.lineTo(36,25);g.closePath();g.fill();
  fs.writeFileSync(path.join(extension,'icons',size+'.png'),icon.toBuffer('image/png'));
}
