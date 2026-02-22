import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X as Close } from 'lucide-react';

const AutocompleteInput = ({
  value,
  onValueSelect,
  placeholder,
  compoundData,
  label,
  idPrefix,
  disabled,
  className,
  itemIdKey = 'compound_id',
  itemLabelKey = 'name',
  idPattern: idPatternProp,
}) => {
  const defaultIdPattern = /^[CZ]\d{5}$/i;
  const idPattern = idPatternProp || defaultIdPattern;
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const componentRef = useRef(null);

  useEffect(() => {
    if (value && Array.isArray(compoundData) && compoundData.length > 0) {
      const selectedItem = compoundData.find(c => c && c[itemIdKey] === value);
      setInputText(selectedItem && selectedItem[itemLabelKey] ? selectedItem[itemLabelKey] : value);
    } else if (!value) {
      setInputText('');
    }
  }, [value, compoundData, itemIdKey, itemLabelKey]);

  const filterAndShowSuggestions = useCallback((text) => {
    if (text.trim() === '' || !Array.isArray(compoundData)) {
      setSuggestions([]);
      setIsDropdownVisible(false);
      return;
    }

    const lowerText = text.toLowerCase();
    const filtered = compoundData
      .filter(item => {
        if (!item) return false;
        const labelVal = item[itemLabelKey];
        const idVal = item[itemIdKey];
        const labelMatch = labelVal && typeof labelVal === 'string' &&
                          labelVal.toLowerCase().includes(lowerText);
        const idMatch = idVal && typeof idVal === 'string' &&
                        idVal.toLowerCase().startsWith(lowerText);
        return labelMatch || idMatch;
      })
      .slice(0, 8);

    setSuggestions(filtered);
    setIsDropdownVisible(filtered.length > 0);
  }, [compoundData, itemIdKey, itemLabelKey]);

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);
    filterAndShowSuggestions(newText);
  };

  const handleSuggestionClick = (suggestion) => {
    setInputText(suggestion[itemLabelKey] || suggestion[itemIdKey]);
    onValueSelect(suggestion[itemIdKey]);
    setIsDropdownVisible(false);
    setSuggestions([]);
  };

  const handleInputFocus = () => {
    // Only try to show suggestions if compoundData is available
    if (Array.isArray(compoundData) && compoundData.length > 0) {
        filterAndShowSuggestions(inputText);
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      if (componentRef.current && !componentRef.current.contains(document.activeElement)) {
        setIsDropdownVisible(false);

        if (idPattern.test(inputText) && Array.isArray(compoundData)) {
          const matchedItem = compoundData.find(c => c && c[itemIdKey] && c[itemIdKey].toUpperCase() === inputText.toUpperCase());
          if (matchedItem) {
            setInputText(matchedItem[itemLabelKey] || matchedItem[itemIdKey]);
            if (value !== matchedItem[itemIdKey]) {
                onValueSelect(matchedItem[itemIdKey]);
            }
          } else {
            onValueSelect(inputText.toUpperCase());
          }
        } else if (value && Array.isArray(compoundData)) {
          const selectedItem = compoundData.find(c => c && c[itemIdKey] === value);
          if (selectedItem && inputText !== (selectedItem[itemLabelKey] || selectedItem[itemIdKey])) {
            setInputText(selectedItem[itemLabelKey] || selectedItem[itemIdKey]);
          } else if (!selectedItem) {
            setInputText(value);
          }
        } else if (!value && !idPattern.test(inputText)) {
            const itemByLabel = Array.isArray(compoundData) ? compoundData.find(c => c && c[itemLabelKey] && c[itemLabelKey].toLowerCase() === inputText.toLowerCase()) : null;
            if (itemByLabel) {
                setInputText(itemByLabel[itemLabelKey]);
                onValueSelect(itemByLabel[itemIdKey]);
            } else {
                setInputText('');
                onValueSelect('');
            }
        }
      }
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (componentRef.current && !componentRef.current.contains(event.target)) {
        setIsDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1" ref={componentRef}>
      {label && (
        <label htmlFor={`${idPrefix}-input`} className="block text-xs font-medium text-slate-500 mb-1">
          {label}
        </label>
      )}
      <input
        id={`${idPrefix}-input`}
        type="text"
        placeholder={placeholder}
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        disabled={disabled || !Array.isArray(compoundData)} // Disable if no data
        className={
          className ||
          "w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/40 rounded-lg text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-violet-300/30 dark:focus:ring-violet-400/20 focus:border-violet-300 dark:focus:border-violet-400/40 transition-shadow text-sm"
        }
        autoComplete="off"
      />
      {inputText && (
        <button
          type="button"
          onClick={() => { setInputText(''); onValueSelect(''); setSuggestions([]); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none"
          aria-label="Clear input"
        >
          <Close className="w-4 h-4" />
        </button>
      )}
      {isDropdownVisible && suggestions.length > 0 && (
        <ul className="absolute z-20 w-full bg-white/95 dark:bg-slate-800/95 border border-slate-200/70 dark:border-slate-600/40 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1 text-left">
          {suggestions.map(suggestion => {
            const id = suggestion?.[itemIdKey];
            const label = suggestion?.[itemLabelKey];
            if (!id) return null;
            return (
              <li
                key={id}
                onMouseDown={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 hover:bg-slate-100/70 dark:hover:bg-slate-700/50 cursor-pointer text-sm text-slate-600 dark:text-slate-300"
              >
                {label ? `${label} (${id})` : id}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;