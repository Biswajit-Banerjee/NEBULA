import React, { useState } from "react";
import CompoundTooltip from "./components/CompoundTooltip";
import ReactionTooltip from "./components/ReactionTooltip";
import Logo from "./components/Logo";
import ECDetails from "./components/ECDetails";

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const handleBacktrace = async (target) => {
    if (!target) {
      setError("Please enter a compound ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-16 animate__animated animate__fadeInDown">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center">
            <Logo />
          </div>
          <h1 className="text-6xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              NEBULA
            </span>
          </h1>
        </div>
        <p className="text-xl text-gray-600 font-medium">
          Explore the Universe of Metabolic Networks
        </p>
      </div>

      {/* Search Container */}
      <div className="mb-12 animate__animated animate__fadeInUp">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label
                htmlFor="backtraceInput"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Compound ID
              </label>
              <input
                type="text"
                id="backtraceInput"
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-blue-200 focus:border-transparent transition-all duration-200"
                placeholder="Enter compound ID to explore metabolic network..."
                onKeyPress={(e) =>
                  e.key === "Enter" && handleBacktrace(e.target.value)
                }
              />
            </div>

            <div className="flex items-end gap-4">
              <button
                onClick={() =>
                  handleBacktrace(
                    document.getElementById("backtraceInput").value
                  )
                }
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition duration-200 flex items-center gap-2"
              >
                <i className="fas fa-project-diagram"></i>
                Explore
              </button>
              <button
                onClick={handleDownload}
                disabled={!results}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <i className="fas fa-download"></i>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-bounce w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <i className="fas fa-dna text-2xl text-white animate-pulse"></i>
          </div>
          <p className="text-gray-600 font-medium animate-pulse">
            Processing your request...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-2xl text-red-700 flex items-center gap-4">
          <i className="fas fa-exclamation-triangle text-xl"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Results Table */}
      {results && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Reaction
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Source
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Coenzyme
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Equation
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Transition
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Target
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-blue-800">
                    EC
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((row, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {row.reaction}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {row.source}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {row.coenzyme}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <ReactionTooltip equation={row.equation} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {row.transition}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <CompoundTooltip compoundId={row.target} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="space-y-2">
                          {row.ec_list.map((ec, i) => (
                            <ECDetails key={i} ec={ec} />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <a
                          href={row.reaction_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-500 transition duration-150 flex items-center gap-2"
                        >
                          <i className="fas fa-external-link-alt"></i>
                          View
                        </a>
                      </td>
                    </tr>
                    {/* EC details will be rendered here by the ECDetails component */}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
