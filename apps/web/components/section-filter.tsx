"use client";

import type { JSX, ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";

type SearchableRecord = Record<string, unknown>;

type SectionFilterContextValue = {
  filteredItems: SearchableRecord[];
  totalCount: number;
  filteredCount: number;
  isOpen: boolean;
  query: string;
  placeholder: string;
  shouldRenderToggle: boolean;
  hasActiveFilter: boolean;
  inputId: string;
  toggleOpen: () => void;
  setQuery: (value: string) => void;
  clearAndClose: () => void;
};

type SectionFilterProviderProps<T extends SearchableRecord> = {
  items: T[];
  keys: Array<keyof T>;
  threshold?: number;
  placeholder?: string;
  children: ReactNode;
};

type SectionFilterChildrenProps<T extends SearchableRecord> = {
  children: (items: T[]) => ReactNode;
};

const DEFAULT_PLACEHOLDER = "Filter...";

const SectionFilterContext = createContext<SectionFilterContextValue | null>(null);

const normalizeSearchValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  return String(value).toLowerCase();
};

const SearchIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

function useSectionFilterContext(): SectionFilterContextValue {
  const context = useContext(SectionFilterContext);

  if (!context) {
    throw new Error("SectionFilter components must be used within SectionFilterProvider.");
  }

  return context;
}

export function SectionFilterProvider<T extends SearchableRecord>({
  items,
  keys,
  threshold = 5,
  placeholder = DEFAULT_PLACEHOLDER,
  children
}: SectionFilterProviderProps<T>): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputId = useId();
  const shouldRenderToggle = items.length >= threshold;
  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => keys.some((key) => normalizeSearchValue(item[key]).includes(normalizedQuery)));
  }, [items, keys, normalizedQuery]);

  useEffect(() => {
    if (!shouldRenderToggle && (isOpen || query)) {
      setIsOpen(false);
      setQuery("");
    }
  }, [isOpen, query, shouldRenderToggle]);

  const clearAndClose = (): void => {
    setQuery("");
    setIsOpen(false);
  };

  const toggleOpen = (): void => {
    setIsOpen((current) => {
      if (current) {
        setQuery("");
        return false;
      }

      return true;
    });
  };

  const value: SectionFilterContextValue = {
    filteredItems,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    isOpen,
    query,
    placeholder,
    shouldRenderToggle,
    hasActiveFilter: isOpen && normalizedQuery.length > 0,
    inputId,
    toggleOpen,
    setQuery,
    clearAndClose
  };

  return (
    <SectionFilterContext.Provider value={value}>
      {children}
    </SectionFilterContext.Provider>
  );
}

export function SectionFilterToggle(): JSX.Element | null {
  const { hasActiveFilter, isOpen, shouldRenderToggle, toggleOpen } = useSectionFilterContext();

  if (!shouldRenderToggle) {
    return null;
  }

  return (
    <button
      type="button"
      className={`section-filter__toggle${hasActiveFilter ? " section-filter__toggle--active" : ""}`}
      onClick={toggleOpen}
      aria-label={isOpen ? "Close section filter" : "Open section filter"}
      aria-expanded={isOpen}
    >
      <span className="section-filter__toggle-icon" aria-hidden="true">
        <SearchIcon />
      </span>
    </button>
  );
}

export function SectionFilterBar(): JSX.Element | null {
  const { clearAndClose, inputId, isOpen, placeholder, query, setQuery } = useSectionFilterContext();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="section-filter__bar">
      <label className="section-filter__bar-inner" htmlFor={inputId}>
        <span className="section-filter__bar-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          id={inputId}
          ref={inputRef}
          className="section-filter__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              clearAndClose();
            }
          }}
          placeholder={placeholder}
        />
      </label>
      <button type="button" className="section-filter__clear" onClick={clearAndClose} aria-label="Clear and close section filter">
        Close
      </button>
    </div>
  );
}

export function SectionFilterChildren<T extends SearchableRecord>({ children }: SectionFilterChildrenProps<T>): JSX.Element {
  const { filteredCount, filteredItems, hasActiveFilter, totalCount } = useSectionFilterContext();

  return (
    <>
      {hasActiveFilter ? (
        <div className="section-filter__count">Showing {filteredCount} of {totalCount}</div>
      ) : null}
      {children(filteredItems as T[])}
    </>
  );
}