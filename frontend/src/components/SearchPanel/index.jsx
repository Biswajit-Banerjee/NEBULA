import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
    Plus, X, Eye, EyeOff, Download, Upload, 
    Loader2, Layers, FlaskConical, Target, Sparkles, ChevronLeft, Palette, X as CloseIcon
} from 'lucide-react';

import AutocompleteInput from './AutocompleteInput';
import compoundDataJson from './compound_map.json';
import reactionDataJson from './reaction_map.json';
import ecDataJson from './ec_map.json';

const SEARCH_MODES = [
  { value: 'compound', label: 'Compound' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'ec', label: 'EC' },
];


const textButtonClasses = "px-5 py-2.5 text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed";
const iconButtonClasses = "p-2.5 sm:p-3 rounded-xl transition-all duration-200 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed";


const SearchPairItem = memo(({ index, pair, onChange, onRemove, onToggleVisibility, disabled, compoundData, reactionData, ecData, totalPairs }) => {
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
      className="group relative p-4 rounded-xl border-2 border-brd/70 hover:border-brand/40 transition-all duration-300 hover:shadow-lg bg-surface-overlay/80"
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl opacity-90 shadow-inner"
        style={{ backgroundColor: itemColor }}
        title={`Query color: ${itemColor}`}
      ></div>

      <div className="ml-3">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-content-secondary">
              Query {index + 1}
            </span>
            <select
              value={pair.mode || 'compound'}
              onChange={(e) => {
                const newMode = e.target.value;
                const cleared = { source: '', target: '', reaction: '', ec: '', sourceDisplay: '', targetDisplay: '', hasResults: undefined, resultCount: undefined };
                onChange(index, { ...pair, ...cleared, mode: newMode });
              }}
              disabled={disabled}
              className="text-xs font-medium rounded-md border border-brd/70 bg-surface/80 text-content px-1.5 py-0.5 focus:ring-1 focus:ring-brand/30 focus:border-brand outline-none transition-all"
            >
              {SEARCH_MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Color picker toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={openPicker}
                className="p-1.5 rounded-lg bg-surface-inset/70 text-content-secondary hover:bg-surface-inset transition-all duration-200"
                title="Pick highlight colour"
                disabled={disabled}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              {showColorPicker && (
                <div className="absolute right-0 mt-2 z-50 bg-surface-overlay/95 border border-brd/70 rounded-xl shadow-lg p-3 w-56" onClick={(e)=>e.stopPropagation()}>
                  <button onClick={()=>setShowColorPicker(false)} className="absolute top-2 right-2 text-content-muted hover:text-content" aria-label="Close color picker"><CloseIcon className="w-4 h-4"/></button>
                  <div className="grid grid-cols-4 gap-2 mb-4 mt-4">
                    {PRESET_COLORS.map(c=> (
                      <button key={c} className="w-7 h-7 rounded-full border border-brd shadow-sm hover:scale-110 transition-transform" style={{backgroundColor:c}} onClick={()=>setTempColor(c)} aria-label={`Select ${c}`}></button>
                    ))}
                  </div>

                  <p className="text-xs font-medium text-content-secondary mb-1">Custom Color</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tempColor}
                      onChange={(e) => setTempColor(e.target.value)}
                      className="sr-only"
                      id={`color-picker-${index}`}
                    />

                    {/* Trigger button shows current colour */}
                    <label htmlFor={`color-picker-${index}`} className="cursor-pointer flex items-center justify-center w-9 h-9 rounded-full border border-brd shadow-sm" title="Pick custom colour">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `${tempColor}${Math.round(tempAlpha*255).toString(16).padStart(2,'0')}` }}></div>
                    </label>

                    {/* Hex textbox */}
                    <input
                      type="text"
                      value={tempColor || ''}
                      onChange={(e) => setTempColor(e.target.value)}
                      placeholder="#f97316"
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded-lg border border-brd/70 bg-surface/80 text-content"
                    />
                    <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand hover:bg-brand-hover text-content-inverse" onClick={()=>{commitColor(tempColor, tempAlpha); setShowColorPicker(false);}}>OK</button>
                  </div>

                  {/* Transparency slider */}
                  <div className="mb-4 w-full space-y-1">
                    <div className="flex items-center justify-between text-xs text-content-secondary">
                      <span>Transparency</span>
                      <span>{Math.round(tempAlpha*100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(tempAlpha*100)}
                      onChange={e=>setTempAlpha(parseInt(e.target.value)/100)}
                      className="w-full h-2 rounded-lg appearance-none accent-brand"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${tempColor}00 0%, ${tempColor}${Math.round(tempAlpha*255).toString(16).padStart(2,'0')} 100%)`,
                        backgroundColor: 'rgb(var(--border-primary))'
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
                    ? 'bg-ok-subtle text-ok hover:bg-ok-subtle/80' 
                    : 'bg-surface-inset/70 text-content-secondary hover:bg-surface-inset'
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
                className="p-1.5 rounded-lg bg-err-subtle text-err hover:bg-err-subtle/80 transition-all duration-200"
                disabled={disabled}
                aria-label="Remove this search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inputs — conditional on mode */}
        <div className="space-y-3">
          {(!pair.mode || pair.mode === 'compound') && (
            <>
              {/* Source Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-2">
                  <FlaskConical className="w-3.5 h-3.5 text-brand" />
                  Source <span className="text-content-muted text-xs">(Optional)</span>
                </label>
                <AutocompleteInput
                  idPrefix={`source-${index}`}
                  placeholder="KEGG ID or Name"
                  value={pair.source}
                  onValueSelect={(compoundId) => onChange(index, { ...pair, source: compoundId, sourceDisplay: '' })}
                  compoundData={compoundData}
                  disabled={disabled}
                />
              </div>

              {/* Target Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-err" />
                  Target <span className="text-err">*</span>
                </label>
                <AutocompleteInput
                  idPrefix={`target-${index}`}
                  placeholder="KEGG ID or Name"
                  value={pair.target}
                  onValueSelect={(compoundId) => onChange(index, { ...pair, target: compoundId, targetDisplay: '' })}
                  compoundData={compoundData}
                  disabled={disabled}
                />
              </div>
            </>
          )}

          {pair.mode === 'reaction' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5 text-info" />
                Reaction ID <span className="text-err">*</span>
              </label>
              <AutocompleteInput
                idPrefix={`reaction-${index}`}
                placeholder="e.g. R00217"
                value={pair.reaction || ''}
                onValueSelect={(id) => onChange(index, { ...pair, reaction: id })}
                compoundData={reactionData}
                itemIdKey="reaction_id"
                itemLabelKey="equation"
                idPattern={/^R\d{5}$/i}
                disabled={disabled}
              />
            </div>
          )}

          {pair.mode === 'ec' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5 text-ok" />
                EC Number <span className="text-err">*</span>
              </label>
              <AutocompleteInput
                idPrefix={`ec-${index}`}
                placeholder="e.g. 1.1.1.1"
                value={pair.ec || ''}
                onValueSelect={(id) => onChange(index, { ...pair, ec: id })}
                compoundData={ecData}
                itemIdKey="ec_number"
                itemLabelKey="ec_number"
                idPattern={/^\d+(\.\d+){3}$/}
                disabled={disabled}
              />
            </div>
          )}
        </div>

        {/* Results indicator */}
        {pair.hasResults !== undefined && typeof pair.resultCount === 'number' && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${pair.resultCount > 0 ? 'text-ok' : 'text-warn'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${pair.resultCount > 0 ? 'bg-ok' : 'bg-warn'}`}></div>
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
  const [reactionData, setReactionData] = useState([]);
  const [ecData, setEcData] = useState([]);

  useEffect(() => {
    if (compoundDataJson) setCompoundData(compoundDataJson);
    if (reactionDataJson) setReactionData(reactionDataJson);
    if (ecDataJson) setEcData(ecDataJson);
  }, []);

  const searchPairs = externalPairs; 
  const setSearchPairsInApp = setExternalPairs; 

  const addSearchPair = useCallback(() => {
    setSearchPairsInApp(prev => [...prev, { 
      id: `new-${Date.now()}-${prev.length}`, 
      mode: 'compound',
      source: '', target: '', reaction: '', ec: '',
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

  const isExploreDisabled = isLoading || !searchPairs.some(pair => {
    const mode = pair.mode || 'compound';
    if (mode === 'compound') return pair.target && pair.target.trim() !== '';
    if (mode === 'reaction') return pair.reaction && pair.reaction.trim() !== '';
    if (mode === 'ec') return pair.ec && pair.ec.trim() !== '';
    return false;
  });
  const canExport = (results && results.length > 0) || searchPairs.some(p => (p.source && p.source.trim()) || (p.target && p.target.trim()));
  
  const INSPIRATION_GRADIENTS = ['from-brand to-brand-hover', 'from-info to-info', 'from-ok to-ok'];
  const getRandomGradientForButton = () => INSPIRATION_GRADIENTS[Math.floor(Math.random() * INSPIRATION_GRADIENTS.length)];
  const combineButtonActiveGradient = getRandomGradientForButton();


  return (
    <div className="w-full">
      <div className="bg-surface-overlay/55 backdrop-blur-xl rounded-2xl shadow-xl border border-brd/35 p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 text-content-muted" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6 gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-content mb-1">Search Configuration</h2>
              <p className="text-sm text-content-secondary">Configure your search parameters below.</p>
            </div>
            {onCollapseSidebar && (
              <button
                onClick={onCollapseSidebar}
                className="p-2.5 w-10 h-10 flex-shrink-0 rounded-xl bg-surface-inset/70 text-content-secondary hover:bg-surface-inset transition-all duration-200"
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
                reactionData={reactionData}
                ecData={ecData}
                totalPairs={searchPairs.length}
              />
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-brd">
            <button
              onClick={addSearchPair}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 bg-surface-inset/80 text-content hover:bg-surface-inset ${textButtonClasses}`}
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
                      ? `bg-gradient-to-r ${combineButtonActiveGradient} text-content-inverse` 
                      : 'bg-surface-inset/70 text-content hover:bg-surface-inset'
                  }`}
              >
                  <Layers className="w-4 h-4" />
                  {combinedMode ? 'Separate View' : 'Combined View'}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center justify-center gap-1.5 bg-info-subtle text-info hover:bg-info-subtle/80 cursor-pointer ${textButtonClasses} text-xs ${isLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
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
                    className={`flex items-center justify-center gap-1.5 bg-ok-subtle text-ok hover:bg-ok-subtle/80 ${textButtonClasses} text-xs`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            <button
              onClick={handleSearchInternal}
              disabled={isExploreDisabled}
              className={`w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-content-inverse hover:scale-105 transform ${textButtonClasses} shadow-brand/20 hover:shadow-xl hover:shadow-brand/25 font-semibold`}
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