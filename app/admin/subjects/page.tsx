"use client";
import { useEffect, useState } from "react";
type Subject = { id:number; code:string; name:string; createdAt:string };

export default function SubjectsPage(){
  const [items,setItems]=useState<Subject[]>([]);
  const [code,setCode]=useState(""); const [name,setName]=useState("");
  const [loading,setLoading]=useState(false); const [err,setErr]=useState<string|null>(null);

  // edición
  const [editId,setEditId]=useState<number|null>(null);
  const [editCode,setEditCode]=useState(""); const [editName,setEditName]=useState("");

  async function load(){ setErr(null);
    try{ const r=await fetch("/api/admin/subjects",{cache:"no-store"}); const j=await r.json();
      if(!j.ok) throw new Error(j.error); setItems(j.subjects??[]);
    }catch(e:any){ setErr(e.message||String(e)); }
  }
  useEffect(()=>{load();},[]);

  async function create(e:React.FormEvent){ e.preventDefault();
    if(!code.trim()||!name.trim()) return;
    if(!confirm(`Estás a punto de agregar la materia "${name}" (código ${code}). ¿Continuar?`)) return;
    setLoading(true); setErr(null);
    try{
      const r=await fetch("/api/admin/subjects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,name})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      setCode(""); setName(""); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  async function remove(id:number){ if(!confirm(`¿Borrar materia #${id}?`))return;
    setLoading(true); setErr(null);
    try{ const r=await fetch(`/api/admin/subjects/${id}`,{method:"DELETE"}); const j=await r.json();
      if(!j.ok) throw new Error(j.error); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  function startEdit(s:Subject){ setEditId(s.id); setEditCode(s.code); setEditName(s.name); }
  function cancelEdit(){ setEditId(null); setEditCode(""); setEditName(""); }

  async function saveEdit(id:number){
    const c=editCode.trim(), n=editName.trim(); if(!c||!n) return;
    if(!confirm(`Vas a actualizar la materia #${id} a código "${c}" y nombre "${n}". ¿Continuar?`))return;
    setLoading(true); setErr(null);
    try{
      const r=await fetch(`/api/admin/subjects/${id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({code:c,name:n})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error);
      cancelEdit(); await load();
    }catch(e:any){ setErr(e.message||String(e)); } finally{ setLoading(false); }
  }

  return (<div>
    <h2 className="text-lg font-semibold mb-3">Materias</h2>
    <form onSubmit={create} className="flex gap-2 mb-4">
      <input className="border rounded px-2 py-1 text-black" value={code} onChange={e=>setCode(e.target.value)} placeholder="Código (único)"/>
      <input className="border rounded px-2 py-1 flex-1 text-black" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre"/>
      <button className="border rounded px-3 py-1" disabled={loading}>Guardar</button>
    </form>
    {err && <p className="text-red-600">Error: {err}</p>}
    <table className="w-full text-sm">
      <thead className="text-left opacity-70 border-b"><tr><th className="py-2">ID</th><th>Código</th><th>Nombre</th><th>Creado</th><th className="w-[260px]"/></tr></thead>
      <tbody>
        {items.map(s=>(
          <tr key={s.id} className="border-b">
            <td className="py-2">{s.id}</td>
            <td>
              {editId===s.id ? (
                <input className="border rounded px-2 py-1 text-black w-full" value={editCode} onChange={e=>setEditCode(e.target.value)} />
              ) : s.code}
            </td>
            <td>
              {editId===s.id ? (
                <input className="border rounded px-2 py-1 text-black w-full" value={editName} onChange={e=>setEditName(e.target.value)} />
              ) : s.name}
            </td>
            <td>{new Date(s.createdAt).toLocaleString()}</td>
            <td className="flex gap-2 py-2">
              {editId===s.id ? (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>saveEdit(s.id)} disabled={loading} type="button">Guardar</button>
                  <button className="border rounded px-2 py-1" onClick={cancelEdit} type="button">Cancelar</button>
                </>
              ) : (
                <>
                  <button className="border rounded px-2 py-1" onClick={()=>startEdit(s)} type="button">Editar</button>
                  <button className="text-red-600" onClick={()=>remove(s.id)} disabled={loading} type="button">Borrar</button>
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
