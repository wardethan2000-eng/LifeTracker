"use client";

import type { JSX, ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export type SlideOverData = {
  assetId: string;
  assetName: string;
  scheduleId: string;
  scheduleName: string;
};

type SlideOverContextType = {
  slideOverData: SlideOverData | null;
  openSlideOver: (data: SlideOverData) => void;
  closeSlideOver: () => void;
};

const SlideOverContext = createContext<SlideOverContextType>({
  slideOverData: null,
  openSlideOver: () => {},
  closeSlideOver: () => {},
});

export function CompletionSlideOverProvider({ children }: { children: ReactNode }): JSX.Element {
  const [slideOverData, setSlideOverData] = useState<SlideOverData | null>(null);

  return (
    <SlideOverContext.Provider
      value={{
        slideOverData,
        openSlideOver: setSlideOverData,
        closeSlideOver: () => setSlideOverData(null),
      }}
    >
      {children}
    </SlideOverContext.Provider>
  );
}

export function useCompletionSlideOver(): SlideOverContextType {
  return useContext(SlideOverContext);
}
