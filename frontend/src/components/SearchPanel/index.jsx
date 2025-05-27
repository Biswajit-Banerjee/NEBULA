import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
    Plus, X, Search as SearchIconLucide, ArrowRight, Eye, EyeOff, Download, Upload, 
    Combine, Loader2, Layers, FlaskConical, Target, Sparkles 
} from 'lucide-react';

import AutocompleteInput from './AutocompleteInput';
import compoundDataJson from './compound_map.json';


const textButtonClasses = "px-5 py-2.5 text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed";
const iconButtonClasses = "p-2.5 sm:p-3 rounded-xl transition-all duration-200 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed";


const SearchPairItem = memo(({ index, pair, onChange, onRemove, onToggleVisibility, disabled, compoundData, totalPairs }) => {
  const showRemoveButton = totalPairs > 1;
  const itemColor = pair.color || '#CBD5E1'; 

  return (
    <div 
      className="group relative p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-violet-400/70 dark:hover:border-violet-500/70 transition-all duration-300 hover:shadow-xl bg-gradient-to-br from-white via-white to-slate-50/30 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-700/30"
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl opacity-90 shadow-inner"
        style={{ backgroundColor: itemColor }}
        title={`Query color: ${itemColor}`}
      ></div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 ml-2 sm:ml-3">
        {/* Inputs container - give it more room */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 w-full min-w-0"> {/* Added min-w-0 for flex children */}
          {/* Source Input - increased min-w and flex-1 */}
          <div className="space-y-1.5 flex-1 min-w-[200px] sm:min-w-[240px]"> {/* Increased min-width */}
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              Source Compound <span className="text-slate-400 dark:text-slate-500 text-xs">(Optional)</span>
            </label>
            <AutocompleteInput
              idPrefix={`source-${index}`}
              placeholder="KEGG ID or Name"
              value={pair.source}
              onValueChange={(value) => onChange(index, { ...pair, source: value, sourceDisplay: '' })}
              onValueSelect={(compoundId, compoundName) => onChange(index, { ...pair, source: compoundId, sourceDisplay: compoundName })}
              compoundData={compoundData}
              disabled={disabled}
              inputClassName="w-full px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-300/80 dark:border-slate-600/80 bg-white/70 dark:bg-slate-700/50 backdrop-blur-sm text-sm sm:text-base text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 transition-all duration-200"
            />
          </div>
          {/* Target Input - increased min-w and flex-1 */}
          <div className="space-y-1.5 flex-1 min-w-[200px] sm:min-w-[240px]"> {/* Increased min-width */}
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-red-500 dark:text-red-400" />
              Target Compound <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <AutocompleteInput
              idPrefix={`target-${index}`}
              placeholder="KEGG ID or Name"
              value={pair.target}
              onValueChange={(value) => onChange(index, { ...pair, target: value, targetDisplay: '' })}
              onValueSelect={(compoundId, compoundName) => onChange(index, { ...pair, target: compoundId, targetDisplay: compoundName })}
              compoundData={compoundData}
              disabled={disabled}
              inputClassName="w-full px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-300/80 dark:border-slate-600/80 bg-white/70 dark:bg-slate-700/50 backdrop-blur-sm text-sm sm:text-base text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-red-500 dark:focus:border-red-400 focus:ring-4 focus:ring-red-500/20 dark:focus:ring-red-400/20 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 sm:mt-0 self-start sm:self-center pt-0 sm:pt-[26px]">
          {pair.hasResults !== undefined ? (
             <button
              onClick={() => onToggleVisibility(index)}
              className={`${iconButtonClasses} ${ // Using iconButtonClasses
                pair.visible 
                  ? 'bg-emerald-100 dark:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-600/40' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
              title={pair.visible ? 'Hide results for this query' : 'Show results for this query'}
              disabled={disabled}
              aria-pressed={pair.visible}
            >
              {pair.visible ? <Eye className="w-4 h-4 sm:w-5 sm:h-5" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          ) : ( <div className="w-10 h-10 sm:w-11 sm:h-11 p-2.5 sm:p-3" aria-hidden="true" /> )}

          <button
            type="button"
            onClick={() => { if (showRemoveButton) onRemove(index); }}
            className={`${iconButtonClasses} ${ // Using iconButtonClasses
              showRemoveButton
                ? 'bg-rose-100 dark:bg-rose-600/30 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-600/40'
                : 'invisible pointer-events-none' // This also handles disabled look implicitly with opacity from iconButtonClasses
            }`}
            disabled={disabled || !showRemoveButton}
            aria-label={showRemoveButton ? "Remove this search query" : undefined}
            tabIndex={!showRemoveButton ? -1 : undefined}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
      {pair.hasResults !== undefined && typeof pair.resultCount === 'number' && (
          <div className={`mt-3 flex items-center gap-2 text-xs sm:text-sm ${pair.resultCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} ml-2 sm:ml-3 pl-1.5`}>
          <div className={`w-2 h-2 rounded-full ${pair.resultCount > 0 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`}></div>
          {pair.resultCount > 0 ? `${pair.resultCount} results found` : (pair.hasResults ? 'No results for this query' : 'Not searched / No target')}
          </div>
      )}
    </div>
  );
});
SearchPairItem.displayName = 'SearchPairItem';


const SearchPanel = ({
  onSearch,
  isLoading,
  onToggleVisibility,
  searchPairs: externalPairs, 
  setSearchPairs: setExternalPairs, 
  combinedMode,
  toggleCombinedMode,
  results 
}) => {
  const [compoundData, setCompoundData] = useState([]);

  useEffect(() => {
    if (compoundDataJson) {
      setCompoundData(compoundDataJson);
    }
  }, []);

  const searchPairs = externalPairs; 
  const setSearchPairsInApp = setExternalPairs; 

  const addSearchPair = useCallback(() => {
    setSearchPairsInApp(prev => [...prev, { 
      id: `new-${Date.now()}-${prev.length}`, 
      source: '', target: '', 
      visible: true, sourceDisplay: '', targetDisplay: '',
      hasResults: undefined, resultCount: undefined
    }]);
  }, [setSearchPairsInApp]);

  const updateSearchPair = useCallback((index, updatedPairData) => {
    setSearchPairsInApp(prev => prev.map((pair, i) =>
      i === index ? { ...pair, ...updatedPairData } : pair
    ));
  }, [setSearchPairsInApp]);

  const removeSearchPair = useCallback((index) => {
    if (searchPairs.length > 1) {
        setSearchPairsInApp(prev => prev.filter((_, i) => i !== index));
    } else {
        console.warn("Cannot remove the last search pair.");
    }
  }, [searchPairs, setSearchPairsInApp]);

  const handleSearchInternal = () => {
    onSearch(searchPairs); 
  };

  const handleExportSessionInternal = () => {
    if (!results || results.length === 0) {
        if(!searchPairs.some(p => (p.source && p.source.trim()) || (p.target && p.target.trim()))) {
            console.warn("No data to export."); return;
        }
    }
    try {
      const sessionData = {
        searchPairs: searchPairs.map(({ sourceDisplay, targetDisplay, ...rest }) => rest),
        results: results || [], 
        combinedMode: combinedMode,
      };
      const sessionBlob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
      const sessionUrl = URL.createObjectURL(sessionBlob);
      const link = document.createElement('a');
      link.href = sessionUrl;
      link.download = `nebula-session-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(sessionUrl);
    } catch (error) {
      console.error('Error exporting session data:', error);
      alert('Failed to export session data.');
    }
  };

  const handleUploadSessionInternal = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const sessionData = JSON.parse(content);
        if (sessionData && sessionData.searchPairs) {
          const restoredPairsWithDisplay = sessionData.searchPairs.map(p => {
            const sourceEntry = compoundData.find(c => c.id === p.source);
            const targetEntry = compoundData.find(c => c.id === p.target);
            return {
              ...p, 
              sourceDisplay: sourceEntry ? sourceEntry.name : (p.source || ''),
              targetDisplay: targetEntry ? targetEntry.name : (p.target || ''),
            };
          });
          onSearch(restoredPairsWithDisplay, sessionData.results || null); 
        } else {
          throw new Error('Invalid session file.');
        }
      } catch (error) {
        console.error('Error parsing uploaded session file:', error);
        alert(`Failed to parse session file: ${error.message}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const isExploreDisabled = isLoading || !searchPairs.some(pair => pair.target && pair.target.trim() !== '');
  const canExport = (results && results.length > 0) || searchPairs.some(p => (p.source && p.source.trim()) || (p.target && p.target.trim()));
  
  const INSPIRATION_GRADIENTS = ['from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-600'];
  const getRandomGradientForButton = () => INSPIRATION_GRADIENTS[Math.floor(Math.random() * INSPIRATION_GRADIENTS.length)];
  const combineButtonActiveGradient = getRandomGradientForButton();


  return (
    <div className="w-full max-w-5xl mx-auto"> {/* Increased max-width for SearchPanel */}
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]">
          <div className="absolute inset-0 text-slate-400 dark:text-slate-600" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="space-y-4 mb-6 sm:mb-8">
            {searchPairs.map((pair, index) => (
              <SearchPairItem
                key={pair.id || index} 
                index={index}
                pair={pair}
                onChange={updateSearchPair}
                onRemove={removeSearchPair}
                onToggleVisibility={onToggleVisibility}
                disabled={isLoading}
                compoundData={compoundData}
                totalPairs={searchPairs.length}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-700/50">
            <button
              onClick={addSearchPair}
              disabled={isLoading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-600 dark:hover:to-slate-500 ${textButtonClasses}`}
            >
              <Plus className="w-4 h-4" />
              Add Query
            </button>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
              {searchPairs.some(p => p.hasResults !== undefined) && (
                <button
                    onClick={toggleCombinedMode}
                    disabled={isLoading}
                    className={`${textButtonClasses} flex items-centrer gap-2 
                    ${ combinedMode 
                        ? `bg-gradient-to-r ${combineButtonActiveGradient} text-white` 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    {combinedMode ? 'Separate View' : 'Combined View'}
                </button>
              )}
              <label // Consistent size with textButtonClasses (approx)
                className={`flex items-center justify-center gap-2 bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-700/40 dark:to-blue-700/40 text-sky-700 dark:text-sky-300 hover:from-sky-200 hover:to-blue-200 dark:hover:from-sky-600/50 dark:hover:to-blue-600/50 cursor-pointer ${textButtonClasses} ${isLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                htmlFor="upload-session-input-panel"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
                <input id="upload-session-input-panel" type="file" accept=".json" onChange={handleUploadSessionInternal} className="hidden" disabled={isLoading}/>
              </label>
              
              {canExport && (
                <button 
                    onClick={handleExportSessionInternal}
                    disabled={isLoading}
                    className={`flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-700/40 dark:to-teal-700/40 text-emerald-700 dark:text-emerald-300 hover:from-emerald-200 hover:to-teal-200 dark:hover:from-emerald-600/50 dark:hover:to-teal-600/50 ${textButtonClasses}`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}

              <button
                onClick={handleSearchInternal}
                disabled={isExploreDisabled}
                className={`flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:scale-105 transform ${textButtonClasses} shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30`} // Explore button has more padding from original design
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SearchPanel;