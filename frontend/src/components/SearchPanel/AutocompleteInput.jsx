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
  className
}) => {
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const componentRef = useRef(null);

  useEffect(() => {
    if (value && Array.isArray(compoundData) && compoundData.length > 0) {
      const selectedCompound = compoundData.find(c => c && c.compound_id === value);
      setInputText(selectedCompound && selectedCompound.name ? selectedCompound.name : value);
    } else if (!value) { // Explicitly clear if value is cleared
      setInputText('');
    }
    // If compoundData is not yet ready, inputText will be initialized based on value or empty
    // When compoundData arrives, this effect will re-run if value is present.
  }, [value, compoundData]);


  const filterAndShowSuggestions = useCallback((text) => {
    if (text.trim() === '' || !Array.isArray(compoundData)) { // Ensure compoundData is an array
      setSuggestions([]);
      setIsDropdownVisible(false);
      return;
    }

    const lowerText = text.toLowerCase();
    const filtered = compoundData
      .filter(compound => {
        // Defensive checks: Ensure compound and its properties exist
        if (!compound) return false; // Skip null/undefined entries in compoundData
        const nameMatch = compound.name && typeof compound.name === 'string' &&
                          compound.name.toLowerCase().includes(lowerText);
        const idMatch = compound.compound_id && typeof compound.compound_id === 'string' &&
                        compound.compound_id.toLowerCase().startsWith(lowerText);
        return nameMatch || idMatch;
      })
      .slice(0, 5);

    setSuggestions(filtered);
    setIsDropdownVisible(filtered.length > 0);
  }, [compoundData]);

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);
    filterAndShowSuggestions(newText);
  };

  const handleSuggestionClick = (suggestion) => {
    setInputText(suggestion.name || suggestion.compound_id); // Fallback to ID if name is missing
    onValueSelect(suggestion.compound_id);
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

        const idPattern = /^[CZ]\d{5}$/i;
        if (idPattern.test(inputText) && Array.isArray(compoundData)) {
          const matchedCompound = compoundData.find(c => c && c.compound_id && c.compound_id.toUpperCase() === inputText.toUpperCase());
          if (matchedCompound) {
            setInputText(matchedCompound.name || matchedCompound.compound_id);
            if (value !== matchedCompound.compound_id) {
                onValueSelect(matchedCompound.compound_id);
            }
          } else {
            onValueSelect(inputText.toUpperCase());
          }
        } else if (value && Array.isArray(compoundData)) {
          const selectedCompound = compoundData.find(c => c && c.compound_id === value);
          if (selectedCompound && inputText !== (selectedCompound.name || selectedCompound.compound_id)) {
            setInputText(selectedCompound.name || selectedCompound.compound_id);
          } else if (!selectedCompound) {
            setInputText(value);
          }
        } else if (!value && !idPattern.test(inputText)) { // No selection, and not an ID
            // Check if current input text is a name of a compound
            const compoundByName = Array.isArray(compoundData) ? compoundData.find(c => c && c.name && c.name.toLowerCase() === inputText.toLowerCase()) : null;
            if (compoundByName) {
                setInputText(compoundByName.name);
                onValueSelect(compoundByName.compound_id);
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
          "w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-400 dark:focus:ring-purple-500 focus:border-transparent transition-shadow text-sm"
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
        <ul className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1 text-left">
          {suggestions.map(suggestion => (
            // Ensure suggestion itself and its properties are valid before rendering
            suggestion && suggestion.compound_id && suggestion.name ? (
              <li
                key={suggestion.compound_id}
                onMouseDown={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-700 dark:text-slate-100"
              >
                {suggestion.name} ({suggestion.compound_id})
              </li>
            ) : null
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;