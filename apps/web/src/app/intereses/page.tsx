export default function InteresesPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl bg-white border border-gray-200 rounded-3xl p-10 shadow-sm animate-in fade-in zoom-in duration-300">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Mis Intereses y Aprendizaje Continuo 🚀
        </h1>
        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
          Actualmente estoy enfocando mi aprendizaje en <strong>Python orientado a la Inteligencia Artificial</strong>,
          buscando expandir mis horizontes técnicos más allá del frontend y explorar la automatización y el tooling inteligente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl">
            <h2 className="font-bold text-blue-900 mb-2">🐍 Python & IA</h2>
            <p className="text-sm text-blue-800">
              Explorando el desarrollo de scripts de automatización, web scraping avanzado con librerías nativas y bases de Machine Learning aplicado.
            </p>
          </div>
          <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl">
            <h2 className="font-bold text-purple-900 mb-2">⚡ Próximos pasos</h2>
            <p className="text-sm text-purple-800">
              Me interesa llenar esta sección con proyectos relacionados, notas sobre mis lecturas y experimentos de IA integrados al stack moderno.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-400">
          Esta sección está en construcción. ¡Pronto agregaré más recursos y documentaré mi progreso!
        </div>
      </div>
    </div>
  )
}
