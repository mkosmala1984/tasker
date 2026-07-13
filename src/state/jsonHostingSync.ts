import type { AppState } from "../domain/types";
import {
  getRemoteEnvelope,
  patchRemoteEnvelope,
  type JsonHostingCredentials
} from "../storage/jsonHostingStorage";
import {
  createRemoteSyncController,
  isRemoteNewer,
  type RemoteEnvelope,
  type RemoteSyncController,
  type RemoteSyncStatus
} from "./remoteSync";

export { isRemoteNewer };

export type JsonHostingSyncStatus = RemoteSyncStatus;
export type LocalSnapshot = {
  state: AppState;
  observedRevision: number;
  updatedAt: string;
};
export type JsonHostingSyncController = RemoteSyncController<JsonHostingCredentials>;

export type JsonHostingSyncOptions = {
  credentials?: JsonHostingCredentials;
  getLocalSnapshot(): LocalSnapshot;
  replaceLocal(envelope: RemoteEnvelope): void;
  confirmLocalSave(envelope: RemoteEnvelope): void;
  setStatus(status: JsonHostingSyncStatus): void;
  getRemoteEnvelope?(credentials: JsonHostingCredentials): Promise<RemoteEnvelope>;
  patchRemoteEnvelope?(credentials: JsonHostingCredentials, envelope: RemoteEnvelope): Promise<void>;
};

export function createJsonHostingSyncController(options: JsonHostingSyncOptions): JsonHostingSyncController {
  return createRemoteSyncController({
    ...options,
    storage: {
      getRemoteEnvelope: options.getRemoteEnvelope ?? getRemoteEnvelope,
      putRemoteEnvelope: options.patchRemoteEnvelope ?? patchRemoteEnvelope
    }
  });
}
