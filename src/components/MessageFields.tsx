"use client";
import { type OutboundPayload } from "@/lib/messaging-contracts";

const labels: Record<string,string> = { text:"Text", image:"Image", video:"Video", document:"Document", audio:"Voice/audio", sticker:"Sticker", poll:"Poll", buttons:"Buttons", list:"List", location:"Location", contacts:"Contact" };
function fresh(type: string): OutboundPayload {
 const id=()=>crypto.randomUUID();
 switch(type){
  case "image":case "video":case "document":return {type:"media",mediatype:type,media:"",caption:""};
  case "audio":return {type:"audio",audio:"",encoding:true};
  case "sticker":return {type:"sticker",sticker:""};
  case "poll":return {type:"poll",name:"",values:["",""],selectableCount:1};
  case "buttons":return {type:"buttons",title:"",buttons:[{type:"reply",id:id(),displayText:""}]};
  case "list":return {type:"list",title:"",footerText:"",buttonText:"View options",sections:[{title:"Options",rows:[{title:"",rowId:id()}]}]};
  case "location":return {type:"location",name:"",address:"",latitude:0,longitude:0};
  case "contacts":return {type:"contacts",contact:[{fullName:"",phoneNumber:""}]};
  default:return {type:"text",text:""};
 }
}
export default function MessageFields({value,onChange,compact=false}:{value:OutboundPayload;onChange:(value:OutboundPayload)=>void;compact?:boolean}) {
 const type=value.type==="media"?value.mediatype:value.type;
 const update=(patch:Record<string,unknown>)=>onChange({...value,...patch} as OutboundPayload);
 const field=(label:string,key:string,textarea=false)=> <label className="profile-field"><span>{label}</span>{textarea?<textarea aria-label={label} className="min-h-24 rounded-lg border border-border p-3" value={(value as any)[key]||""} onChange={event=>update({[key]:event.target.value})}/>:<input aria-label={label} value={(value as any)[key]||""} onChange={event=>update({[key]:event.target.value})}/>}</label>;
 return <div className="space-y-3">
  <label className="profile-field"><span>Message type</span><select aria-label="Message type" className="min-h-11 rounded-lg border border-border px-3" value={type} onChange={event=>onChange(fresh(event.target.value))}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {value.type==="text"&&field(compact?"Message":"Campaign message","text",true)}
  {value.type==="media"&&<>{field("Media HTTPS URL or base64 file","media")}{field("Caption","caption",true)}{value.mediatype==="document"&&field("File name","fileName")}</>}
  {value.type==="audio"&&field("Audio HTTPS URL or base64 file","audio")}
  {value.type==="sticker"&&field("Sticker HTTPS URL or base64 file","sticker")}
  {["media","audio","sticker"].includes(value.type)&&<label className="profile-field"><span>Or attach a file (up to 8 MB)</span><input type="file" aria-label="Attach message file" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>8*1024*1024){event.target.setCustomValidity("Choose a file up to 8 MB.");event.target.reportValidity();return;}event.target.setCustomValidity("");const reader=new FileReader();reader.onload=()=>update(value.type==="media"?{media:String(reader.result),fileName:file.name,mimetype:file.type}:value.type==="audio"?{audio:String(reader.result)}:{sticker:String(reader.result)});reader.readAsDataURL(file);}}/></label>}
  {value.type==="poll"&&<>{field("Poll question","name")}<label className="profile-field"><span>Options (one per line)</span><textarea aria-label="Poll options" className="min-h-24 border border-border rounded-lg p-3" value={value.values.join("\n")} onChange={event=>update({values:event.target.value.split("\n")})}/></label><label className="profile-field"><span>Choices allowed</span><input type="number" min={1} max={10} value={value.selectableCount} onChange={event=>update({selectableCount:Number(event.target.value)})}/></label></>}
  {value.type==="buttons"&&<>{field("Title","title")}{field("Description","description",true)}{field("Footer","footer")}<label className="profile-field"><span>Reply buttons (one per line, up to 3)</span><textarea aria-label="Reply buttons" className="min-h-24 border border-border rounded-lg p-3" value={value.buttons.map(button=>button.displayText).join("\n")} onChange={event=>update({buttons:event.target.value.split("\n").map((displayText,index)=>({type:"reply",displayText,id:`option-${index+1}`}))})}/></label></>}
  {value.type==="list"&&<>{field("Title","title")}{field("Description","description",true)}{field("Footer","footerText")}{field("Button label","buttonText")}<label className="profile-field"><span>List options (one per line)</span><textarea aria-label="List options" className="min-h-24 border border-border rounded-lg p-3" value={value.sections[0]?.rows.map(row=>row.title).join("\n")||""} onChange={event=>update({sections:[{title:"Options",rows:event.target.value.split("\n").map((title,index)=>({title,rowId:`option-${index+1}`}))}]})}/></label></>}
  {value.type==="location"&&<>{field("Location name","name")}{field("Address","address")}<div className="profile-fields">{(["latitude","longitude"] as const).map(key=><label key={key} className="profile-field"><span>{key==="latitude"?"Latitude":"Longitude"}</span><input type="number" step="any" value={value[key]} onChange={event=>update({[key]:Number(event.target.value)})}/></label>)}</div></>}
  {value.type==="contacts"&&<><label className="profile-field"><span>Contact name</span><input value={value.contact[0]?.fullName||""} onChange={event=>update({contact:[{...value.contact[0],fullName:event.target.value}]})}/></label><label className="profile-field"><span>Contact phone with country code</span><input type="tel" value={value.contact[0]?.phoneNumber||""} onChange={event=>update({contact:[{...value.contact[0],phoneNumber:event.target.value}]})}/></label></>}
 </div>;
}
