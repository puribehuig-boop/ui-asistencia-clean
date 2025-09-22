"use client";
import { useEffect, useState } from "react";

type Term = { id:number; name:string };
type Group = { id:number; code:string; termId:number; term?:Term };

export default function GroupsPage(){
  const [items,setItems]=useState<Group[]>([]);
  const [terms,setTerms]=useState<Term[]>([]);
  const [code,setCode]=useState(""); const [termId,setTermId]=useState<number|("")>("");
  const [loading,setLoading]=useState(false); const [err,setErr]=useState<string|null>(null);

  // edición
  const [editId,setEditId]=useState<number|null>(null);
  const [editCode,setEditCode]=useState("");
  const [editTermId,setEditTermId]=useState<number|("")>("");

  async function load(){
    setErr(null);
    try{
      const [rg,rt]=await Promise.all([
        fetch("/api/admin/groups",{cache:"no-store"}),
        fetch("/api/admin/terms",{cache:"no-store"}),
      ]);
      const jg=await rg.json(), jt=await rt.json();
      if(!jg.ok) throw new Error(jg.error);
      if(!jt.ok) throw new Error(jt.error);
      setItems(jg.groups??[]); setTerms(jt.terms??[]);
    }catch(e:any){ setErr(e.message||String(e)); }
  }
  useEffect(()=>{load();},[]);

  async function create(e:React.FormEvent){ e.preventDefault();
    if(!code.trim()||!termId) return;
    const selectedTermId=Number(termId);
    const term=terms.find(t=>t.id===selectedTermId); const termName=term?.name??String(selectedTermId);
    if(!confirm(`Estás a punto de agregar el grupo "${code}" en el periodo "${termName}". ¿Continuar?`)) return;
    setLoading(true); setErr(null);
    try{
      const r=await fetch("/api/admin/groups",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,termId:selectedTermId})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      setCode(""); setTermId(""); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  async function remove(id:number){ if(!confirm(`¿Borrar grupo #${id}?`))return;
    setLoading(true); setErr(null);
    try{ const r=await fetch(`/api/admin/groups/${id}`,{method:"DELETE"}); const j=await r.json();
      if(!j.ok) throw new Error(j.error); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  function startEdit(g:Group){
    setEditId(g.id);
    setEditCode(g.code);
    setEditTermId(g.termId);
  }
  function cancelEdit(){ setEditId(null); setEditCode(""); setEditTermId(""); }

  async function saveEdit(id:number){
    if(!editCode.trim()||!editTermId) return;
    const selectedTermId=Number(editTermId);
    const term=terms.find(t=>t.id===selectedTermId); const termName=term?.name??String(selectedTermId);
    if(!confirm(`Vas a actualizar el grupo #${id} a código "${editCode}" en periodo "${termName}". ¿Continuar?`)) return;

    setLoading(true); setErr(null);
    try{
      const r=await fetch(`/api/admin/groups/${id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({code:editCode,termId:selectedTermId})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      cancelEdit(); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  return (<div>
    <h2 className="text-lg font-semibold mb-3">Grupos</h2>
    <form onSubmit={create} className="flex flex-wrap gap-2 mb-4">
      <input className="border rounded px-2 py-1 text-black" value={code} onChange={e=>setCode(e.target.value)} placeholder="Código del grupo (p.ej. ADM-1A)"/>
      <select className="border rounded px-2 py-1 text-black" value={termId as any} onChange={e=>setTermId(e.target.value?Number(e.target.value):"")}>
        <option value="">Selecciona periodo</option>
        {terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className="border rounded px-3 py-1" disabled={loading}>Guardar</button>
    </form>

    {err && <p className="text-red-600 mb-2">Error: {err}</p>}

    <table className="w-full text-sm">
      <thead className="text-left opacity-70 border-b"><tr><th className="py-2">ID</th><th>Código</th><th>Periodo</th><th className="w-[340px]"/></tr></thead>
      <tbody>
        {items.map(g=>(
          <tr key={g.id} className="border-b">
            <td className="py-2">{g.id}</td>
            <td>
              {editId===g.id ? (
                <input className="border rounded px-2 py-1 text-black w-full" value={editCode} onChange={e=>setEditCode(e.target.value)} />
              ) : g.code}
            </td>
            <td>
              {editId===g.id ? (
                <select className="border rounded px-2 py-1 text-black" value={editTermId as any} onChange={e=>setEditTermId(e.target.value?Number(e.target.value):"")}>
                  <option value="">Selecciona periodo</option>
                  {terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : (g.term?.name ?? g.termId)}
            </td>
            <td className="flex gap-2 py-2">
              {editId===g.id ? (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>saveEdit(g.id)} disabled={loading} type="button">Guardar</button>
                  <button className="border rounded px-2 py-1" onClick={cancelEdit} type="button">Cancelar</button>
                </>
              ) : (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>startEdit(g)} type="button">Editar</button>
                  <button className="text-red-600" onClick={()=>remove(g.id)} disabled={loading} type="button">Borrar</button>
                </>
              )}
            </td>
          </tr>
        ))}
        {items.length===0 && <tr><td colSpan={4} className="py-3 text-neutral-500">Sin registros.</td></tr>}
      </tbody>
    </table>
  </div>);
}
