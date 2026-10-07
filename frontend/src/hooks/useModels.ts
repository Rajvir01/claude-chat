"use client";

import { useEffect, useState } from "react";
import { listModels } from "@/lib/api";
import type { ModelsResponse } from "@/lib/types";

/** The models the backend offers. Loaded once; null until it arrives. */
export function useModels() {
  const [models, setModels] = useState<ModelsResponse | null>(null);

  useEffect(() => {
    listModels().then(setModels, () => {
      // The settings panel just shows "Loading models…"; the chat itself still works.
    });
  }, []);

  return models;
}
