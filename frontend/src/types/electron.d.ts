export {};

declare global {
  interface Window {
    mikrotikApi?: {
      // WinBox — password optional: passed from UI so WinBox auto-logins without typing
      checkWinBoxInstalled: () => Promise<boolean>;
      launchWinBox: (ip: string, user: string, password?: string) => Promise<{ success: boolean; error?: string }>;

      // MNDP Device Discovery
      startDiscovery: () => Promise<boolean>;
      stopDiscovery: () => Promise<boolean>;
      onRouterDiscovered: (callback: (router: any) => void) => void;

      // WinBox Installer Download
      downloadWinBox: (arch: string) => Promise<{ success: boolean; error?: string }>;
      onDownloadProgress: (callback: (progress: number) => void) => void;
    };
  }
}
