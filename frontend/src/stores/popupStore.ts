import { create } from 'zustand';

export type PopupType = 'loading' | 'success' | 'error' | 'warning' | 'info';

export interface PopupAction {
  text: string;
  onAction: () => void;
}

export interface PopupState {
  isOpen: boolean;
  type: PopupType;
  title: string;
  message: string | React.ReactNode;
  action?: PopupAction;
  onClose?: () => void;
  isClosable: boolean;
  // Core actions
  show: (params: Partial<Omit<PopupState, 'show' | 'close'>>) => void;
  close: () => void;
}

export const usePopupStore = create<PopupState>((set) => ({
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
  isClosable: true,
  show: (params) => set((state) => ({ ...state, isOpen: true, ...params })),
  close: () => set({ isOpen: false, action: undefined, onClose: undefined }),
}));

// Export a handy utility to trigger popups without hooks (great for interceptors or outside React)
export const Popup = {
  loading: (message: string = 'Processing your request...') => {
    usePopupStore.getState().show({
      type: 'loading',
      title: 'Processing...',
      message,
      isClosable: false,
      action: undefined,
    });
  },
  success: (title: string, message: string | React.ReactNode, action?: PopupAction, onClose?: () => void) => {
    usePopupStore.getState().show({
      type: 'success',
      title,
      message,
      isClosable: true,
      action,
      onClose,
    });
  },
  error: (title: string, message: string | React.ReactNode, action?: PopupAction, onClose?: () => void) => {
    usePopupStore.getState().show({
      type: 'error',
      title,
      message,
      isClosable: true,
      action,
      onClose,
    });
  },
  warning: (title: string, message: string | React.ReactNode, action?: PopupAction, onClose?: () => void) => {
    usePopupStore.getState().show({
      type: 'warning',
      title,
      message,
      isClosable: true,
      action,
      onClose,
    });
  },
  info: (title: string, message: string | React.ReactNode, action?: PopupAction, onClose?: () => void) => {
    usePopupStore.getState().show({
      type: 'info',
      title,
      message,
      isClosable: true,
      action,
      onClose,
    });
  },
  close: () => {
    usePopupStore.getState().close();
  },
};
