function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitHealthy(
  urls: string[],
  retries: number,
  fetcher: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = [];

  for (const url of urls) {
    let ok = false;

    for (let i = 0; i < retries; i += 1) {
      const response = await fetcher(url).catch(() => null);
      if (response?.ok) {
        ok = true;
        break;
      }

      if (i < retries - 1) {
        await sleep(1000);
      }
    }

    if (!ok) {
      failed.push(url);
    }
  }

  return {
    ok: failed.length === 0,
    failed
  };
}
