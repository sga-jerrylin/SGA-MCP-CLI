export function nextDeployStatus(status: string, ok: boolean): string {
  if (!ok) {
    return 'failed';
  }

  if (status === 'pending') {
    return 'pulling';
  }
  if (status === 'pulling') {
    return 'starting';
  }
  if (status === 'starting') {
    return 'verifying';
  }
  if (status === 'verifying') {
    return 'done';
  }

  return status;
}
