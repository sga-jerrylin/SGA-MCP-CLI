import type { ApiResponse, GenerateRun, StartGenerateRequest } from '../../../shared/types/api.ts';
import { createStartGenerateAcceptedFixture } from './contract-fixtures.ts';

const req: StartGenerateRequest = {
  parserModel: 'claude-3-haiku',
  coderModel: 'claude-3-5-sonnet',
  maxFixRounds: 3,
};

const body = createStartGenerateAcceptedFixture(req);
const typed: ApiResponse<GenerateRun> = body;

if (typed.code !== 0) {
  throw new Error('generator start response code must be 0');
}
if (typed.data.status !== 'queued') {
  throw new Error('generator run should start in queued status');
}
