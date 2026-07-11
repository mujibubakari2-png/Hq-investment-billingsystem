export {};

declare global {
  interface Window {
    mikrotikApi?: {
      checkWinBoxInstalled: () => Promise<boolean>;
      launchWinBox: (ip: string, user: string) => Promise<{ success: boolean; error?: string }>;
      startDiscovery: () => Promise<boolean>;
      stopDiscovery: () => Promise<boolean>;
      onRouterDiscovered: (callback: (router: any) => void) => void;
      downloadWinBox: (arch: string) => Promise<{ success: boolean; error?: string }>;
      onDownloadProgress: (callback: (progress: number) => void) => void;
    };
  }
}
