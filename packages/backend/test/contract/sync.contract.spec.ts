import type { ApiResponse, SyncPushResponse } from '../../../shared/types/api.ts';
import { createSyncPushFixture, createSyncPullMetaFixture } from './contract-fixtures.ts';

const pushBody = createSyncPushFixture();
const typedPush: ApiResponse<SyncPushResponse> = pushBody;

if (typedPush.code !== 0 || !typedPush.data.packageId) {
  throw new Error('sync push response must include packageId');
}
if (typedPush.data.servers.length === 0) {
  throw new Error('sync push response should include server mapping');
}

const pullMeta = createSyncPullMetaFixture(typedPush.data.packageId);
if (!pullMeta.downloadPath.endsWith('.tar.gz')) {
  throw new Error('sync pull fixture must point to .tar.gz artifact');
}
