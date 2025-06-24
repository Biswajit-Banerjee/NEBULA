import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
    Plus, X, Eye, EyeOff, Download, Upload, 
    Loader2, Layers, FlaskConical, Target, Sparkles, ChevronLeft, Palette, X as CloseIcon
} from 'lucide-react';

import AutocompleteInput from './AutocompleteInput';
import compoundDataJson from './compound_map.json';


const textButtonClasses = "px-5 py-2.5 text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed";
const iconButtonClasses = "p-2.5 sm:p-3 rounded-xl transition-all duration-200 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed";


const SearchPairItem = memo(({ index, pair, onChange, onRemove, onToggleVisibility, disabled, compoundData, totalPairs }) => {
  const showRemoveButton = totalPairs > 1;
  const itemColor = pair.color || '#CBD5E1';

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(pair.color || '#22C55E');
  const [tempAlpha, setTempAlpha] = useState(pair.alpha !== undefined ? pair.alpha : 1);
  const PRESET_COLORS = ['#fb7185','#fbbf24','#4ade80','#5eead4','#60a5fa','#a78bfa','#f9a8d4','#fda4af'];

  const commitColor = (color, alpha) => {
    onChange(index, { ...pair, color, alpha });
  };

  const openPicker = () => {
    setTempColor(pair.color || '#22C55E');
    setTempAlpha(pair.alpha !== undefined ? pair.alpha : 1);
    setShowColorPicker(true);
  };

  return (
    <div 
      className="group relative p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-violet-400/70 dark:hover:border-violet-500/70 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-white via-white to-slate-50/30 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-700/30"
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl opacity-90 shadow-inner"
        style={{ backgroundColor: itemColor }}
        title={`Query color: ${itemColor}`}
      ></div>

      <div className="ml-3">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Query {index + 1}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Color picker toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={openPicker}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
                title="Pick highlight colour"
                disabled={disabled}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              {showColorPicker && (
                <div className="absolute right-0 mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg p-3 w-56" onClick={(e)=>e.stopPropagation()}>
                  <button onClick={()=>setShowColorPicker(false)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label="Close color picker"><CloseIcon className="w-4 h-4"/></button>
                  <div className="grid grid-cols-4 gap-2 mb-4 mt-4">
                    {PRESET_COLORS.map(c=> (
                      <button key={c} className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform" style={{backgroundColor:c}} onClick={()=>setTempColor(c)} aria-label={`Select ${c}`}></button>
                    ))}
                  </div>

                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Custom Color</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tempColor}
                      onChange={(e) => setTempColor(e.target.value)}
                      className="sr-only"
                      id={`color-picker-${index}`}
                    />

                    {/* Trigger button shows current colour */}
                    <label htmlFor={`color-picker-${index}`} className="cursor-pointer flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm" title="Pick custom colour">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `${tempColor}${Math.round(tempAlpha*255).toString(16).padStart(2,'0')}` }}></div>
                    </label>

                    {/* Hex textbox */}
                    <input
                      type="text"
                      value={tempColor || ''}
                      onChange={(e) => setTempColor(e.target.value)}
                      placeholder="#f97316"
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    />
                    <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white" onClick={()=>{commitColor(tempColor, tempAlpha); setShowColorPicker(false);}}>OK</button>
                  </div>

                  {/* Transparency slider */}
                  <div className="mb-4 w-full space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Transparency</span>
                      <span>{Math.round(tempAlpha*100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(tempAlpha*100)}
                      onChange={e=>setTempAlpha(parseInt(e.target.value)/100)}
                      className="w-full h-2 rounded-lg appearance-none accent-violet-600"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${tempColor}00 0%, ${tempColor}${Math.round(tempAlpha*255).toString(16).padStart(2,'0')} 100%)`,
                        backgroundColor: '#cbd5e1'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {pair.hasResults !== undefined ? (
               <button
                onClick={() => onToggleVisibility(index)}
                className={`p-1.5 rounded-lg text-xs transition-all duration-200 ${ 
                  pair.visible 
                    ? 'bg-emerald-100 dark:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-600/40' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
                title={pair.visible ? 'Hide results for this query' : 'Show results for this query'}
                disabled={disabled}
                aria-pressed={pair.visible}
              >
                {pair.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            ) : null}

            {showRemoveButton && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-600/30 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-600/40 transition-all duration-200"
                disabled={disabled}
                aria-label="Remove this search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inputs stacked vertically */}
        <div className="space-y-3">
          {/* Source Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              Source <span className="text-slate-400 dark:text-slate-500 text-xs">(Optional)</span>
            </label>
            <AutocompleteInput
              idPrefix={`source-${index}`}
              placeholder="KEGG ID or Name"
              value={pair.source}
              onValueChange={(value) => onChange(index, { ...pair, source: value, sourceDisplay: '' })}
              onValueSelect={(compoundId, compoundName) => onChange(index, { ...pair, source: compoundId, sourceDisplay: compoundName })}
              compoundData={compoundData}
              disabled={disabled}
              inputClassName="w-full px-3 py-2 rounded-lg border border-slate-300/80 dark:border-slate-600/80 bg-white/70 dark:bg-slate-700/50 backdrop-blur-sm text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 transition-all duration-200"
            />
          </div>

          {/* Target Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              Target <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <AutocompleteInput
              idPrefix={`target-${index}`}
              placeholder="KEGG ID or Name"
              value={pair.target}
              onValueChange={(value) => onChange(index, { ...pair, target: value, targetDisplay: '' })}
              onValueSelect={(compoundId, compoundName) => onChange(index, { ...pair, target: compoundId, targetDisplay: compoundName })}
              compoundData={compoundData}
              disabled={disabled}
              inputClassName="w-full px-3 py-2 rounded-lg border-2 border-slate-300/80 dark:border-slate-600/80 bg-white/70 dark:bg-slate-700/50 backdrop-blur-sm text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-red-500 dark:focus:border-red-400 focus:ring-2 focus:ring-red-500/20 dark:focus:ring-red-400/20 transition-all duration-200"
            />
          </div>
        </div>

        {/* Results indicator */}
        {pair.hasResults !== undefined && typeof pair.resultCount === 'number' && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${pair.resultCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${pair.resultCount > 0 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`}></div>
            {pair.resultCount > 0 ? `${pair.resultCount} results found` : (pair.hasResults ? 'No results for this query' : 'Not searched / No target')}
          </div>
        )}
      </div>
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
  results,
  onCollapseSidebar,
  onExportSession,
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
          onSearch(restoredPairsWithDisplay, sessionData); 
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
    <div className="w-full">
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]">
          <div className="absolute inset-0 text-slate-400 dark:text-slate-600" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6 gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Search Configuration</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Configure your pathway search parameters below.</p>
            </div>
            {onCollapseSidebar && (
              <button
                onClick={onCollapseSidebar}
                className="p-2.5 w-10 h-10 flex-shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
                title="Collapse Search Panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-4 mb-6">
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

          <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-slate-700/50">
            <button
              onClick={addSearchPair}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-600 dark:hover:to-slate-500 ${textButtonClasses}`}
            >
              <Plus className="w-4 h-4" />
              Add Another Query
            </button>

            {searchPairs.some(p => p.hasResults !== undefined) && (
              <button
                  onClick={toggleCombinedMode}
                  disabled={isLoading}
                  className={`w-full ${textButtonClasses} flex items-center justify-center gap-2 
                  ${ combinedMode 
                      ? `bg-gradient-to-r ${combineButtonActiveGradient} text-white` 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
              >
                  <Layers className="w-4 h-4" />
                  {combinedMode ? 'Separate View' : 'Combined View'}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-700/40 dark:to-blue-700/40 text-sky-700 dark:text-sky-300 hover:from-sky-200 hover:to-blue-200 dark:hover:from-sky-600/50 dark:hover:to-blue-600/50 cursor-pointer ${textButtonClasses} text-xs ${isLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                htmlFor="upload-session-input-panel"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
                <input id="upload-session-input-panel" type="file" accept=".json" onChange={handleUploadSessionInternal} className="hidden" disabled={isLoading}/>
              </label>
              
              {canExport && (
                <button 
                    onClick={onExportSession ? onExportSession : handleExportSessionInternal}
                    disabled={isLoading}
                    className={`flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-700/40 dark:to-teal-700/40 text-emerald-700 dark:text-emerald-300 hover:from-emerald-200 hover:to-teal-200 dark:hover:from-emerald-600/50 dark:hover:to-teal-600/50 ${textButtonClasses} text-xs`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            <button
              onClick={handleSearchInternal}
              disabled={isExploreDisabled}
              className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:scale-105 transform ${textButtonClasses} shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 font-semibold`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Explore
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SearchPanel;