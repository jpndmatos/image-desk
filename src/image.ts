export type Format='image/webp'|'image/jpeg'|'image/png';
export function fitSize(width:number,height:number,maxWidth:number,maxHeight:number){
 if([width,height,maxWidth,maxHeight].some(n=>!Number.isFinite(n)||n<1))throw new Error('Dimensions must be positive.');
 const scale=Math.min(1,maxWidth/width,maxHeight/height);
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function bytes(n:number){if(n<1000)return n+' B';if(n<1000000)return (n/1000).toFixed(n<10000?1:0)+' KB';return (n/1000000).toFixed(1)+' MB';}
export function outputName(name:string,mime:string){const extension:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};return name.replace(/\.[^.]+$/,'')+'-web.'+(extension[mime]||'png');}
export async function readImage(url:string):Promise<HTMLImageElement>{const img=new Image();img.src=url;await img.decode();return img;}
export async function processImage(url:string,format:Format,quality:number,maxWidth:number,maxHeight:number,background:string){
 const img=await readImage(url);const size=fitSize(img.naturalWidth,img.naturalHeight,maxWidth,maxHeight);
 const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not create an image canvas.');
 if(format==='image/jpeg'){ctx.fillStyle=background;ctx.fillRect(0,0,size.width,size.height);}
 ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,size.width,size.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('This image could not be exported.')),format,quality));
 return {blob,...size};
}
export async function sampleFile(){
 const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1600;const ctx=canvas.getContext('2d')!;
 const sky=ctx.createLinearGradient(0,0,0,1600);sky.addColorStop(0,'#c6d9da');sky.addColorStop(.6,'#f1dec6');sky.addColorStop(1,'#baad8d');ctx.fillStyle=sky;ctx.fillRect(0,0,2400,1600);
 ctx.fillStyle='#f7e9c4';ctx.beginPath();ctx.arc(1720,480,155,0,Math.PI*2);ctx.fill();
 for(const [color,base,peak] of [['#9eafa3',950,520],['#6c887e',1180,650],['#3c6258',1500,850]] as const){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,base);ctx.bezierCurveTo(480,peak,800,base+160,1300,peak+100);ctx.bezierCurveTo(1750,peak-200,1900,base+50,2400,peak+140);ctx.lineTo(2400,1600);ctx.lineTo(0,1600);ctx.fill();}
 ctx.fillStyle='#fff8e9';ctx.font='500 35px sans-serif';ctx.fillText('A LITTLE ROOM TO BREATHE',120,1380);ctx.font='90px Georgia';ctx.fillText('Somewhere, slowly.',115,1500);
 const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
 return new File([blob],'somewhere-slowly.png',{type:'image/png'});
}
