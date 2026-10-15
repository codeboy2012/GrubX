"use client";

import { createContext, useContext } from "react";

/**
 * Id of the visible title rendered by the surrounding `SettingRow`.
 * Controls use it as `aria-labelledby` so every switch, select, slider, and
 * text input has an accessible name without repeating the label at each call site.
 */
export const SettingRowLabelContext = createContext<string | undefined>(undefined);

export const useSettingRowLabel = () => useContext(SettingRowLabelContext);
