declare module 'archiver' {
  import type { Writable } from 'node:stream';

  interface ArchiveInstance {
    on(event: 'error', handler: (error: Error) => void): void;
    pipe(destination: Writable): void;
    directory(source: string, destination: false | string): void;
    finalize(): Promise<void>;
  }

  type ArchiverFactory = (format: 'tar', options: { gzip: boolean }) => ArchiveInstance;

  const archiver: ArchiverFactory;
  export default archiver;
}
