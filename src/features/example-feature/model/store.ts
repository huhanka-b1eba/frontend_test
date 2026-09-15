import { create } from 'zustand';

type ExampleFeatureState = {
  isEnabled: boolean;
  toggle: () => void;
};

export const useExampleFeatureStore = create<ExampleFeatureState>((set) => ({
  isEnabled: false,
  toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
}));
