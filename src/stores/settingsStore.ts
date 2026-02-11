import { create } from 'zustand';
import { getAppSetting, setAppSetting } from '../db/queries';

type UnitPreference = 'kg' | 'lb';

interface SettingsStoreState {
  theme: 'dark';
  defaultRestSeconds: number;
  units: UnitPreference;
  isLoaded: boolean;
  initializeSettings: () => Promise<void>;
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
  setUnits: (units: UnitPreference) => Promise<void>;
}

const SETTINGS_KEYS = {
  theme: 'theme',
  defaultRestSeconds: 'default_rest_seconds',
  units: 'units',
};

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  theme: 'dark',
  defaultRestSeconds: 90,
  units: 'kg',
  isLoaded: false,
  initializeSettings: async () => {
    const [storedTheme, storedRest, storedUnits] = await Promise.all([
      getAppSetting(SETTINGS_KEYS.theme),
      getAppSetting(SETTINGS_KEYS.defaultRestSeconds),
      getAppSetting(SETTINGS_KEYS.units),
    ]);

    set({
      theme: 'dark',
      defaultRestSeconds: storedRest ? Number(storedRest) : 90,
      units: storedUnits === 'lb' ? 'lb' : 'kg',
      isLoaded: true,
    });

    if (!storedTheme) {
      await setAppSetting(SETTINGS_KEYS.theme, 'dark');
    }
  },
  setDefaultRestSeconds: async (seconds) => {
    set({ defaultRestSeconds: seconds });
    await setAppSetting(SETTINGS_KEYS.defaultRestSeconds, String(seconds));
  },
  setUnits: async (units) => {
    set({ units });
    await setAppSetting(SETTINGS_KEYS.units, units);
  },
}));
