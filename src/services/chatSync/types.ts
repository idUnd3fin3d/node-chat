import type { ChatSubscribeActions, ManagerSubscribeActions } from '@/services/chat';

export type SyncPayload =
  | {
      source: 'manager';
      action: ManagerSubscribeActions;
    }
  | {
      source: 'chat';
      action: ChatSubscribeActions;
    };

export type SyncData = SyncPayload & {
  instanceId: string;
};
