// Minimal ambient declaration for hls.js.
// The full types ship with the hls.js package; this stub covers the
// API surface used by GalleryLightboxMediaComponent so that `tsc` does not
// fail when the package has not yet been installed (e.g., during the initial
// container tsc pass before npm install completes).
declare module 'hls.js' {
  interface HlsConfig {
    maxBufferLength?: number;
    maxMaxBufferLength?: number;
    /** Force playback to start at this position in seconds. Use 0 to start at the beginning. Default -1. */
    startPosition?: number;
    /**
     * Timeout for fragment loading in milliseconds. Default 20000.
     * Must be greater than the backend's segment-wait timeout (30 000 ms) so
     * hls.js does not abort requests that the server is still holding open while
     * waiting for FFmpeg to finish writing a segment.
     */
    fragLoadingTimeOut?: number;
  }

  interface ErrorData {
    fatal: boolean;
    type: string;
    details: string;
  }

  class Hls {
    static isSupported(): boolean;
    static readonly Events: {
      readonly MANIFEST_PARSED: string;
      readonly ERROR: string;
      [event: string]: string;
    };

    constructor(config?: HlsConfig);
    loadSource(src: string): void;
    attachMedia(el: HTMLMediaElement): void;
    on(event: string, callback: (...args: any[]) => void): void;
    destroy(): void;
  }

  export default Hls;
}
