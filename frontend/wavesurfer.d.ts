declare module "wavesurfer.js" {
  import { AudioContext, ScriptProcessorNode } from "web-audio-api";

  type WavesurferBackend = "WebAudio" | "MediaElement" | "MediaElementWebAudio";

  interface Drawer {
    height: number;
    width: number;
    params: any;
    container: HTMLElement;
    pixelRatio: number;
    wrapper: HTMLElement;
    waveContainer: HTMLElement;
    scrollHandler: () => void;
    scrollbar: ScrollbarPlugin | null;
    setScrollParent: (element: HTMLElement) => void;
    createWrapper: () => void;
    createWave: () => void;
    handleEvent: (e: Event) => void;
    progress: (progress: number) => void;
    destroy: () => void;
  }

  interface WavesurferParams {
    audioContext?: AudioContext | null;
    audioRate?: number;
    audioScriptProcessor?: ScriptProcessorNode | null;
    autoCenter?: boolean;
    autoCenterRate?: number;
    autoCenterImmediately?: boolean;
    backend?: WavesurferBackend;
    backgroundColor?: string | null;
    barHeight?: number;
    barRadius?: number;
    barGap?: number | null;
    barWidth?: number | null;
    barMinHeight?: number | null;
    closeAudioContext?: boolean;
    container: string | HTMLElement;
    cursorColor?: string;
    cursorWidth?: number;
    drawingContextAttributes?: { [key: string]: any };
    duration?: number | null;
    fillParent?: boolean;
    forceDecode?: boolean;
    height?: number;
    hideScrollbar?: boolean;
    hideCursor?: boolean;
    ignoreSilenceMode?: boolean;
    interact?: boolean;
    loopSelection?: boolean;
    maxCanvasWidth?: number;
    mediaControls?: boolean;
    mediaType?: "audio" | "video";
    minPxPerSec?: number;
    normalize?: boolean;
    partialRender?: boolean;
    pixelRatio?: number;
    plugins?: PluginDefinition[];
    progressColor?: string;
    removeMediaElementOnDestroy?: boolean;
    responsive?: boolean;
    scrollParent?: boolean;
    skipLength?: number;
    splitChannels?: boolean;
    waveColor?: string;
    xhr?: { [key: string]: any };
    fftSize?: number;
    smoothingTimeConstant?: number;
  }

  export default class WaveSurfer {
    static create(params: WaveSurferParams): WaveSurfer;
    static minimap(MinimapPluginParams): MinimapPlugin;
    constructor(params: WaveSurferParams);
    params: WavesurferParams;
    drawer: Drawer;
    backend: WebAudio | MediaElement | MediaElementWebAudio;
    container: HTMLElement;
    init(): WaveSurfer;
    destroy(): void;
    isDestroyed(): boolean;
    on(event: string, fn: function);
    load(
      url: string | HTMLMediaElement,
      peaks?: number[] | number[][]
    ): Promise<void>;
    loadBlob(blob: Blob, peaks?: number[] | number[][]): Promise<void>;
    loadDecodedBuffer(buffer: AudioBuffer): Promise<void>;
    play(start?: number, end?: number): Promise<void>;
    pause(): Promise<void>;
    playPause(): Promise<void>;
    skip(offset: number): Promise<void>;
    skipBackward(seconds?: number): Promise<void>;
    skipForward(seconds?: number): Promise<void>;
    seekAndCenter(progress: number): Promise<void>;
    stop(): Promise<void>;
    setPlaybackRate(rate: number): void;
    setVolume(newVolume: number): void;
    setSinkId(deviceId: string): Promise<void>;
    getDuration(): number;
    getCurrentTime(): number;
    getPlaybackRate(): number;
    getVolume(): number;
    getMute(): boolean;
    setMute(mute: boolean): void;
    toggleMute(): void;
    getSolo(): boolean;
    setSolo(solo: boolean): void;
    toggleSolo(): void;
    getFilters(): AudioNode[];
    setFilters(filters: AudioNode[]): void;
    toggleScroll(): void;
    enableDragSelection(options?: { loop?: boolean; shift: boolean }): void;
    disableDragSelection(): void;
    enableWaveformSelection(color?: string, opacity?: number): void;
    disableWaveformSelection(): void;
    clearSelection(): void;
    mark(
      start: number,
      end?: number,
      options?: { color?: string; opacity?: number }
    ): string;
    removeMark(id: string): void;
    redrawMarks(): void;
    addRegion(options: {
      id: string;
      start: number;
      end: number;
      color?: string;
      drag?: boolean;
      resize?: boolean;
      loop?: boolean;
    }): void;
    clearRegions(): void;
    enableSticker(options?: { scale?: number }): void;
    disableSticker(): void;
    toggleSticker(): void;
    addPlugin(plugin: {
      staticProps: Record<string, any>;
      instanceProps: Record<string, any>;
    }): WaveSurfer;
    getWrapper(): HTMLElement;
    getWaveform(): HTMLElement;
    getProgressWave(): HTMLElement;
    getBackend(): any;
    exportPCM(
      length?: number,
      accuracy?: number,
      noWindow?: boolean,
      start?: number,
      end?: number
    ): Promise<{ [key: number]: number }[]>;
    exportImage(
      format?: "image/png" | "image/jpeg",
      quality?: number,
      type?: "dataURL" | "blob",
      backgroundColor?: string
    ): Promise<string | Blob>;
    exportRenderedWave(
      format?: "image/png" | "image/jpeg",
      quality?: number,
      type?: "dataURL" | "blob",
      backgroundColor?: string
    ): Promise<string | Blob>;
    static isSupported(): boolean;
    static canPlayType(url: string | HTMLMediaElement): boolean;
  }
}

// PLUGINS

interface PluginDefinition {}

// MINIMAP

declare module "wavesurfer.js/dist/plugin/wavesurfer.minimap.js" {
  import { WaveSurferPlugin } from "wavesurfer.js";

  export interface MinimapPluginParams {
    container: string | HTMLElement | null;
    waveColor?: string;
    progressColor?: string;
    height?: number;
    width?: number;
    pixelsPerSecond?: number;
    showRegions?: boolean;
    regionsMinWidth?: number;
    regionsMaxWidth?: number;
    regions?: Array<{
      start: number;
      end: number;
      color: string;
      data?: any;
    }>;
  }

  export default class MinimapPlugin {
    static create(params: MinimapPluginParams): WaveSurferPlugin;
  }
}
