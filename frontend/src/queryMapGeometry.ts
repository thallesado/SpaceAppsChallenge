import { polarMeters } from './polar'
import type { Point } from './plannerApi'
export type QueryRegion = {center:Point;radius_km:number;count?:number}
export function regionBoundary(region:QueryRegion){
  const lat=region.center.latitude_deg*Math.PI/180,lon=region.center.longitude_deg*Math.PI/180,a=region.radius_km*1000/1737400
  return Array.from({length:73},(_,i)=>{const b=i*2*Math.PI/72,y=Math.asin(Math.sin(lat)*Math.cos(a)+Math.cos(lat)*Math.sin(a)*Math.cos(b)),x=lon+Math.atan2(Math.sin(b)*Math.sin(a)*Math.cos(lat),Math.cos(a)-Math.sin(lat)*Math.sin(y));return polarMeters(y*180/Math.PI,x*180/Math.PI)})
}
export function queryBounds(points:Point[],region?:QueryRegion|null){
  const positions=points.map(p=>polarMeters(p.latitude_deg,p.longitude_deg));if(region)positions.push(...regionBoundary(region))
  const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
  return{x:(minX+maxX)/2,y:(minY+maxY)/2,span:Math.max(2000,Math.max(maxX-minX,maxY-minY)*1.35)}
}
