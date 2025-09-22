export default function Home() {
  return (
    <main className="space-y-6">
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-medium mb-2">Bienvenido</h2>
        <p className="opacity-80">
          Este es el prototipo inicial. Aquí podrás probar el flujo como docente y ver el panel de administración básico.
        </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/session-demo?sessionId=demo-123"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Abrir sesión demo (QR)
            </a>
          
            <a
              href="/admin"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Panel admin
            </a>
          
            <a
              href="/qr?roomId=A-101"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Imprimir QR del salón A-101
            </a>

            <a href="/admin/sessions" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10">
                Sesiones de hoy (admin)
            </a>

            <a
              href="/admin/settings"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Ajustes (admin)
            </a>
          </div>
      </section>
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-base font-medium mb-2">¿Cómo funcionará el QR?</h3>
        <ol className="list-decimal ml-5 space-y-1 opacity-80">
          <li>Colocamos un QR en la puerta del salón.</li>
          <li>El docente lo escanea y abre una URL con los datos de la sesión.</li>
          <li>Ve 3 acciones: Iniciar clase → Tomar asistencia → Terminar clase.</li>
        </ol>
      </section>
    </main>
  );
}
