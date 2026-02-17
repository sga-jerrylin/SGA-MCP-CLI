import { ref, onUnmounted } from 'vue';
import type { SseEvent } from '@mcp-claw/shared';

export function useSse(url: string, onMessage: (data: SseEvent) => void) {
  const status = ref<'connecting' | 'open' | 'closed'>('closed');
  let eventSource: EventSource | null = null;

  const connect = () => {
    eventSource = new EventSource(url);
    status.value = 'connecting';

    eventSource.onopen = () => {
      status.value = 'open';
    };
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as SseEvent;
      onMessage(data);
    };
    eventSource.onerror = () => {
      status.value = 'closed';
      eventSource?.close();
    };
  };

  const disconnect = () => {
    eventSource?.close();
    status.value = 'closed';
  };

  onUnmounted(disconnect);

  return { status, connect, disconnect };
}
