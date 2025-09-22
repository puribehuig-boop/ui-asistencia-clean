'use client';

export default function ExportCsvButton() {
  const exportCsv = () => {
    alert('Exportar CSV (demo)');
  };

  return (
    <button
      onClick={exportCsv}
      className="inline-block mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
      type="button"
    >
      Exportar CSV
    </button>
  );
}

