import React, { useState } from "react";
import { Filter } from "lucide-react";
import Logo from "./components/Logo";
import FilterMenu from "./components/FilterMenu";
import TabView from "./components/TabView";

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());

  const handleBacktrace = async (target) => {
    if (!target) {
      setError("Please enter a compound ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSelectedRows(new Set()); // Clear selections when new search starts
      const response = await fetch(
        `/api/backtrace?target=${encodeURIComponent(target)}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResults(data.data);
    } catch (error) {
      setError(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch("/api/download/csv");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nebula-results.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError("Failed to download results");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800">
      {/* Header */}
      <header className="pt-8 pb-10 px-6 sm:px-10 md:px-16 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  NEBULA
                </h1>
                <p className="text-slate-600 font-medium mt-1">
                  Metabolic Network Explorer
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 md:items-end">
              <div className="relative flex-grow">
                <input
                  type="text"
                  id="backtraceInput"
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow shadow-sm hover:shadow"
                  placeholder="Enter compound ID to explore..."
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleBacktrace(e.target.value)
                  }
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    handleBacktrace(
                      document.getElementById("backtraceInput").value
                    )
                  }
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  Explore
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!results}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-pulse">
          <div className="animate-bounce w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
          <p className="text-lg text-slate-600 font-medium">
            Processing your request...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-4xl mx-auto mb-8 p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-4 animate-fade-in">
          <svg
            className="w-6 h-6 mt-1 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 relative animate-fade-in mb-12">
          {/* Filter Menu */}
          {isFilterOpen && (
            <div className="absolute right-6 top-0 mt-2 z-50">
              <FilterMenu
                results={results}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                onClose={() => setIsFilterOpen(false)}
              />
            </div>
          )}

          {/* Results Header */}
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">
              Results
              <span className="ml-3 text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {results.length} items
              </span>
            </h2>
            
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isFilterOpen
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter</span>
            </button>
          </div>

          {/* Tab View with Table and Network visualization */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <TabView
              results={results}
              setResults={setResults}
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;