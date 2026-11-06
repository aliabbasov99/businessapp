import { apiResponse } from '@/server/http';
import { readSnapshot } from '@/server/snapshot';

export function GET() {
  return apiResponse(readSnapshot);
}
