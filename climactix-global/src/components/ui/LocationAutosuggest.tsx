'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LocationSuggestion {
  placeName: string;
  longitude: number;
  latitude: number;
  country?: string;
  region?: string;
}

interface LocationAutosuggestProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: LocationSuggestion) => void;
  placeholder?: string;
  /** Mapbox place types to restrict results to, e.g. "country,region,place" */
  types?: string;
  style?: React.CSSProperties;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const baseInputStyle: React.CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2C2C2C',
  color: '#e0e0e0', padding: '12px 14px', fontSize: 13, borderRadius: 3,
  fontFamily: 'IBM Plex Mono, monospace', outline: 'none',
  transition: '0.12s ease',
};

export default function LocationAutosuggest({
  value, onChange, onSelect, placeholder, types, style,
}: LocationAutosuggestProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback((query: string) => {
    if (!MAPBOX_TOKEN || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: '6' });
    if (types) params.set('types', types);
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const features = (data.features ?? []).map((f: any): LocationSuggestion => ({
          placeName: f.place_name,
          longitude: f.center[0],
          latitude: f.center[1],
          country: f.context?.find((c: any) => c.id.startsWith('country'))?.text,
          region: f.context?.find((c: any) => c.id.startsWith('region'))?.text,
        }));
        setSuggestions(features);
        setActiveIndex(-1);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [types]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectSuggestion(s: LocationSuggestion) {
    onChange(s.placeName);
    onSelect(s);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' as const }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ ...baseInputStyle, ...style }}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={(e) => { setOpen(true); e.target.style.borderColor = '#FF6600'; }}
        onBlur={(e) => { e.target.style.borderColor = '#2C2C2C'; }}
        onKeyDown={handleKeyDown}
      />
      {!MAPBOX_TOKEN && open && value.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#0a0a0a', border: '1px solid #2C2C2C', borderRadius: 3,
          padding: '10px 14px', fontSize: 10, color: '#666',
          fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em', zIndex: 20,
        }}>
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable location search.
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#0a0a0a', border: '1px solid #2C2C2C', borderRadius: 3,
          maxHeight: 240, overflowY: 'auto' as const, listStyle: 'none', padding: 0, margin: '4px 0 0',
          zIndex: 20,
        }}>
          {suggestions.map((s, i) => (
            <li
              key={`${s.placeName}-${i}`}
              onMouseDown={() => selectSuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 14px', fontSize: 12, cursor: 'pointer',
                color: i === activeIndex ? '#FF6600' : '#ccc',
                background: i === activeIndex ? '#1a0d00' : 'transparent',
                fontFamily: 'IBM Plex Mono, monospace',
                borderBottom: i < suggestions.length - 1 ? '1px solid #1a1a1a' : 'none',
              }}
            >
              {s.placeName}
            </li>
          ))}
        </ul>
      )}
      {loading && open && (
        <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 9, color: '#444' }}>···</div>
      )}
    </div>
  );
}
