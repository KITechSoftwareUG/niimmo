import { create } from 'zustand';

interface CsvUploadProgressState {
  isProcessing: boolean;
  fileName: string | null;
  startTime: number | null;
  estimatedDurationSeconds: number; // 10 minutes = 600 seconds
  setProcessing: (isProcessing: boolean, fileName?: string | null) => void;
  reset: () => void;
}

export const useCsvUploadProgress = create<CsvUploadProgressState>((set) => ({
  isProcessing: false,
  fileName: null,
  startTime: null,
  estimatedDurationSeconds: 600, // 10 Minuten
  setProcessing: (isProcessing, fileName = null) => set({
    isProcessing,
    fileName,
    startTime: isProcessing ? Date.now() : null,
  }),
  reset: () => set({
    isProcessing: false,
    fileName: null,
    startTime: null,
  }),
}));
