export default function Heatmap() {
  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Issue Heatmap</h1>
      </div>
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 h-[600px] flex items-center justify-center shadow-lg">
        <div className="text-center">
          <div className="relative w-full max-w-2xl aspect-[4/3] mx-auto bg-dark-900 rounded-xl border border-dark-700 p-8 flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Interactive Map Loading</h3>
            <p className="text-gray-400">Map rendering requires mapping library setup</p>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full text-left">
              <div className="bg-dark-800 p-3 rounded-lg border border-dark-700">
                <div className="text-brand-500 text-xs font-bold uppercase tracking-wider mb-1">Most Active</div>
                <div className="text-white">Maharashtra</div>
              </div>
              <div className="bg-dark-800 p-3 rounded-lg border border-dark-700">
                <div className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-1">Trending</div>
                <div className="text-white">Delhi</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
