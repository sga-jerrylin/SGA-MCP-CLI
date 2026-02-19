import { ref, onUnmounted } from 'vue';
import type { SseEvent } from '@sga/shared';

export function useSse(url: string, onMessage: (data: SseEvent) => void) {
  const status = ref<'connecting' | 'open' | 'closed'>('closed');
  let eventSource: EventSource | null = null;

  const connect = () => {
    eventSource = new EventSource(url);
    status.value = 'connecting';

    eventSource.onopen = () => {
      status.value = 'open';
    };

    // Listen for specific named events defined in the API contract
    const eventTypes = ['log', 'progress', 'step_change', 'done', 'error'];
    eventTypes.forEach((type) => {
      eventSource?.addEventListener(type, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SseEvent;
          onMessage(data);
        } catch (e) {
          console.error(`Failed to parse SSE ${type} event`, e);
        }
      });
    });

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
