// Navigation/contact regression fixture only. This never represents live
// Armando contact details, availability, modifiers or ordering state.
import { readFileSync } from 'node:fs';
const source=JSON.parse(readFileSync(new URL('../../data/armandos.json',import.meta.url),'utf8'));
const id=n=>`d1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const armandoQaId=id(1);
const menu=id(2);
const restaurant={id:armandoQaId,name:'Armandos Mexican Food',slug:'armandos',is_active:true,is_indexable:false,currency:'USD',timezone:'America/Los_Angeles',theme_preset:null,theme_overrides:null,primary_domain:null,logo_url:null,description:null,pickup_url:null,google_maps_url:null,phone:'2025550111',address_line1:'1 QA Fixture Street',city:'Test City',state:'CA',postal_code:'90000'};
const sections=source.sections.slice(0,2).map((section,n)=>({id:id(10+n),restaurant_id:armandoQaId,menu_id:menu,name:section.name,description:section.description,sort_order:n,is_active:true,menu_section_items:section.items.slice(0,6).map((item,i)=>({sort_order:i,menu_items:{id:id(100+n*10+i),restaurant_id:armandoQaId,name:item.name,description:item.description,price_cents:item.priceCents,is_active:true,is_orderable:false,source_image_url:item.imageUrl,image_path:null}}))}));
export function armandoQaTable(name,url){
  const matches=url.searchParams.get('slug')==='eq.armandos'||url.searchParams.get('restaurant_id')===`eq.${armandoQaId}`||url.searchParams.get('menu_id')===`eq.${menu}`;
  if(!matches)return null;
  switch(name){
    case 'restaurants':return[restaurant];
    case 'menus':return[{id:menu,restaurant_id:armandoQaId,name:'Main Menu',is_published:true}];
    case 'menu_sections':return sections;
    case 'restaurant_business_hours':return Array.from({length:7},(_,day)=>({restaurant_id:armandoQaId,day_of_week:day,open_time:'09:00:00',close_time:'22:00:00',is_closed:false,sort_order:0}));
    default:return[];
  }
}
