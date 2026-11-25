import { supabase } from "./supabase";
export async function getRows<T>(table:string, order="created_at") {
  if (!supabase) return [] as T[];
  const {data,error}=await supabase.from(table).select("*").order(order,{ascending:false});
  if(error) throw error; return (data||[]) as T[];
}
export async function addRow(table:string, values:Record<string,unknown>) {
  if(!supabase) throw new Error("Supabase not configured. Copy .env.example to .env and add your project URL and anon key.");
  const {data,error}=await supabase.from(table).insert(values).select().single();
  if(error) throw error; return data;
}
export async function updateRow(table:string,id:string,values:Record<string,unknown>) {
  if(!supabase) throw new Error("Supabase not configured.");
  const {data,error}=await supabase.from(table).update(values).eq("id",id).select().single();
  if(error) throw error; return data;
}
export async function removeRow(table:string,id:string) {
  if(!supabase) throw new Error("Supabase not configured.");
  const {error}=await supabase.from(table).delete().eq("id",id); if(error) throw error;
}
