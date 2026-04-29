import { create } from 'zustand';

interface MarqueeStore {
  awaitingApprovalCount: number;
}

export const useMarqueeStore = create<MarqueeStore>(() => ({
  awaitingApprovalCount: 0,
}));
