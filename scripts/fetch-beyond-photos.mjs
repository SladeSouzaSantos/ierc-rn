import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const manifest = JSON.parse(await readFile(new URL("../data/beyond-photos.json",import.meta.url),"utf8"));
const directory=fileURLToPath(new URL("../public/experiment-photos/",import.meta.url));
await mkdir(directory,{recursive:true});
const max=8*1024*1024;
let failures=0;
for(const photo of manifest){
  const destination=join(directory,photo.file);
  const temporary=destination+".tmp";
  try{
    if(!/^[a-z]+\.jpg$/.test(photo.file))throw new Error("Nome inválido");
    const url=new URL(photo.url);
    if(url.protocol!=="https:"||!["thumb.wikimedia.org","upload.wikimedia.org"].includes(url.hostname))throw new Error("Origem inválida");
    const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(45000),headers:{"User-Agent":"IERC-RN-UIUX-Experiment/1.0 (https://github.com/SladeSouzaSantos/ierc-rn)","Accept":"image/jpeg"}});
    if(!response.ok||!response.body||!response.headers.get("content-type")?.startsWith("image/jpeg"))throw new Error("HTTP "+response.status+" ou MIME inválido");
    const chunks=[];let total=0;
    for await(const chunk of response.body){total+=chunk.length;if(total>max)throw new Error("Imagem acima de 8 MiB");chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);
    if(bytes.length<1000||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9)throw new Error("JPEG inválido");
    await writeFile(temporary,bytes);
    await rename(temporary,destination);
    console.log(photo.file+": "+bytes.length+" bytes | sha256 "+createHash("sha256").update(bytes).digest("hex"));
  }catch(error){failures++;await rm(temporary,{force:true});console.error(photo.file+": "+error.message);}
}
console.log("Fotografias obtidas nesta execução: "+(manifest.length-failures)+"/"+manifest.length);
if(failures)process.exitCode=1;
