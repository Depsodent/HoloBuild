import {openingDefinitions} from "../generation/openings";
import {Box3,Quaternion,Euler,Vector3} from "three";
import type {SceneObject,Vec3} from "../scene/objectTypes";
import {objectSize} from "../scene/objectFactory";
import {bounds} from "../interaction/placement";
export const BODY_RADIUS=.22,STEP_HEIGHT=.28;
export interface Collider {id:string;box:Box3;cx:number;cz:number;hx:number;hz:number;yaw:number;stair:boolean;approximate:boolean}
export interface NavigationWorld {colliders:Collider[];bounds:Box3;approximate:number;passableDoors:number}
export interface Body {position:Vec3;velocity:number;grounded:boolean}
export function navigationWorld(objects:SceneObject[]):NavigationWorld{
 const colliders:Collider[]=[],whole=new Box3();let passableDoors=0;
 for(const o of objects){const b=bounds(o);whole.union(b);const c=o.construction,r=c?.structure?.template??c?.structure?.architectureTemplate;
 // Static native door panels represent open portals during walkthrough only.
 if(c?.role==="door"&&c.opening&&(r&&openingDefinitions(r,c.structure?.floorLayouts).some(d=>d.id===c.opening&&d.kind==="door")||c.structure?.nativeWall?.openings.some(d=>d.id===c.opening&&d.kind==="door"))){passableDoors++;continue;}
 const q=new Quaternion().setFromEuler(new Euler(...o.rotation)),up=new Vector3(0,1,0).applyQuaternion(q),axis=new Vector3(1,0,0).applyQuaternion(q),upright=Math.abs(Math.abs(up.y)-1)<1e-5;
 const approximate=o.type==="model"||!["cube","wall","floor"].includes(o.type)||!upright;
 const size=objectSize(o).map((n,i)=>n*o.scale[i]);
 colliders.push({id:o.id,box:b,cx:approximate?(b.min.x+b.max.x)/2:o.position[0],cz:approximate?(b.min.z+b.max.z)/2:o.position[2],hx:approximate?(b.max.x-b.min.x)/2:size[0]/2,hz:approximate?(b.max.z-b.min.z)/2:size[2]/2,yaw:approximate?0:Math.atan2(-axis.z,axis.x),stair:c?.role==="stair"&&!!(c.structure?.standaloneStairs||r?.stairs?.some(s=>s.id===c.assembly)),approximate});
 }
 return {colliders,bounds:whole,approximate:colliders.filter(c=>c.approximate).length,passableDoors};
}
function horizontal(c:Collider,x:number,z:number,radius=BODY_RADIUS){const dx=x-c.cx,dz=z-c.cz,a=Math.cos(c.yaw),b=Math.sin(c.yaw),lx=a*dx-b*dz,lz=b*dx+a*dz;return Math.hypot(Math.max(Math.abs(lx)-c.hx,0),Math.max(Math.abs(lz)-c.hz,0))<radius-1e-6;}
export function bodyClear(world:NavigationWorld,p:Vec3,height=1.75){if(Math.abs(p[0])>49.5||Math.abs(p[2])>49.5||p[1]<-.01||p[1]+height>100)return false;return !world.colliders.some(c=>horizontal(c,p[0],p[2])&&c.box.max.y>p[1]+.015&&c.box.min.y<p[1]+height-.015&&!(c.stair&&c.box.max.y<=p[1]+STEP_HEIGHT+BODY_RADIUS));}
function support(world:NavigationWorld,x:number,z:number,max:number){let top=0;for(const c of world.colliders)if(c.box.max.y<=max+1e-6&&c.box.max.y>=top&&horizontal(c,x,z,BODY_RADIUS-.005))top=c.box.max.y;return top;}
/** Bounded swept horizontal steps, wall sliding, gravity and real tread/slab support. */
export function moveBody(world:NavigationWorld,body:Body,dx:number,dz:number,dt:number,height=1.75):Body{
 if(![...body.position,body.velocity,dx,dz,dt,height].every(Number.isFinite)||height<1.2||height>2.2)throw Error("Invalid walkthrough body state.");
 const p=[...body.position] as Vec3,n=Math.min(96,Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06)));
 for(let i=0;i<n;i++)for(const axis of [0,2] as const){const next=[...p] as Vec3;next[axis]+=(axis===0?dx:dz)/n;const top=support(world,next[0],next[2],p[1]+STEP_HEIGHT);next[1]=Math.max(p[1],top);if(bodyClear(world,next,height)){p[0]=next[0];p[1]=next[1];p[2]=next[2];}}
 const top=support(world,p[0],p[2],p[1]+.001),t=Math.max(0,Math.min(dt,.1));let v=body.velocity;
 if(p[1]<=top+.015){p[1]=top;v=0;}else{v=Math.max(-15,v-9.8*t);p[1]=Math.max(top,p[1]+v*t);if(p[1]===top)v=0;}
 return {position:p,velocity:v,grounded:Math.abs(p[1]-top)<.015};
}
export function safeSpawn(world:NavigationWorld,anchor:Vec3=[0,0,0],height=1.75):Body|null{
 const candidates:Vec3[]=[];for(let ring=0;ring<=14;ring++)for(let x=-ring;x<=ring;x++)for(let z=-ring;z<=ring;z++)if(Math.max(Math.abs(x),Math.abs(z))===ring)candidates.push([anchor[0]+x*.5,0,anchor[2]+z*.5]);
 for(const p of candidates){const tops=[0,...world.colliders.filter(c=>horizontal(c,p[0],p[2],.035)).map(c=>c.box.max.y)].filter(n=>n>=0&&n<=Math.max(anchor[1]+.5,1)).sort((a,b)=>a-b);for(const y of tops){const feet:[number,number,number]=[p[0],y,p[2]];if(bodyClear(world,feet,height))return {position:feet,velocity:0,grounded:true};}}
 return null;
}
