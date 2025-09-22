"use client";
import { useEffect, useState } from "react";
type Term = { id:number; name:string; startDate:string; endDate:string };

export default function TermsPage(){
  const [items,setItems]=useState<Term[]>([]);
  const [name,setName]=useState(""); const [startDate,setStart]=useState(""); const [endDate,setEnd]=useState("");
  const [loading,setLoading]=useState(false); const [err,setErr]=useState<string|null>(null);

  // edición
  const [editId,setEditId]=useState<number|null>(null);
  const [editName,setEditName]=useState("");
  const [editStart,setEditStart]=useState("");
  const [editEnd,setEditEnd]=useState("");

  async function load(){ setErr(null);
    try{ const r=await fetch("/api/admin/terms",{cache:"no-store"}); const j=await r.json();
      if(!j.ok) throw new Error(j.error); setItems(j.terms??[]);
    }catch(e:any){ setErr(e.message||String(e)); }
  }
  useEffect(()=>{load();},[]);

  async function create(e:React.FormEvent){ e.preventDefault();
    if(!name.trim()||!startDate||!endDate) return;
    if(!confirm(`Estás a punto de agregar el periodo "${name}" del ${startDate} al ${endDate}. ¿Continuar?`)) return;
    setLoading(true); setErr(null);
    try{
      const r=await fetch("/api/admin/terms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,startDate,endDate})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      setName(""); setStart(""); setEnd(""); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  async function remove(id:number){ if(!confirm(`¿Borrar periodo #${id}?`))return;
    setLoading(true); setErr(null);
    try{ const r=await fetch(`/api/admin/terms/${id}`,{method:"DELETE"}); const j=await r.json();
      if(!j.ok) throw new Error(j.error); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  function startEdit(t:Term){
    setEditId(t.id);
    setEditName(t.name);
    setEditStart(t.startDate.slice(0,10));
    setEditEnd(t.endDate.slice(0,10));
  }
  function cancelEdit(){ setEditId(null); setEditName(""); setEditStart(""); setEditEnd(""); }

  async function saveEdit(id:number){
    if(!editName.trim()||!editStart||!editEnd) return;
    if(!confirm(`Vas a actualizar el periodo #${id} a "${editName}" (${editStart} → ${editEnd}). ¿Continuar?`)) return;
    setLoading(true); setErr(null);
    try{
      const r=await fetch(`/api/admin/terms/${id}`,{method:"PUT",headers:{"content-type":"application/json"},
        body:JSON.stringify({ name:editName, startDate:editStart, endDate:editEnd })});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      cancelEdit(); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  return (<div>
    <h2 className="text-lg font-semibold mb-3">Periodos</h2>
    <form onSubmit={create} className="flex flex-wrap gap-2 mb-4">
      <input className="border rounded px-2 py-1 grow text-black" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del periodo"/>
      <input className="border rounded px-2 py-1 text-black" type="date" value={startDate} onChange={e=>setStart(e.target.value)}/>
      <input className="border rounded px-2 py-1 text-black" type="date" value={endDate} onChange={e=>setEnd(e.target.value)}/>
      <button className="border rounded px-3 py-1" disabled={loading}>Guardar</button>
    </form>
    {err && <p className="text-red-600 mb-2">Error: {err}</p>}
    <table className="w-full text-sm">
      <thead className="text-left opacity-70 border-b"><tr><th className="py-2">ID</th><th>Nombre</th><th>Inicio</th><th>Fin</th><th className="w-[320px]"/></tr></thead>
      <tbody>
        {items.map(t=>(
          <tr key={t.id} className="border-b">
            <td className="py-2">{t.id}</td>
            <td>{editId===t.id ? <input className="border rounded px-2 py-1 text-black w-full" value={editName} onChange={e=>setEditName(e.target.value)} /> : t.name}</td>
            <td>{editId===t.id ? <input className="border rounded px-2 py-1 text-black" type="date" value={editStart} onChange={e=>setEditStart(e.target.value)} /> : new Date(t.startDate).toLocaleDateString()}</td>
            <td>{editId===t.id ? <input className="border rounded px-2 py-1 text-black" type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)} /> : new Date(t.endDate).toLocaleDateString()}</td>
            <td className="flex gap-2 py-2">
              {editId===t.id ? (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>saveEdit(t.id)} disabled={loading} type="button">Guardar</button>
                  <button className="border rounded px-2 py-1" onClick={cancelEdit} type="button">Cancelar</button>
                </>
              ) : (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>startEdit(t)} type="button">Editar</button>
                  <button className="text-red-600" onClick={()=>remove(t.id)} disabled={loading} type="button">Borrar</button>
                </>
              )}
            </td>
          </tr>
        ))}
        {items.length===0 && <tr><td colSpan={5} className="py-3 text-neutral-500">Sin registros.</td></tr>}
      </tbody>
    </table>
  </div>);
}
