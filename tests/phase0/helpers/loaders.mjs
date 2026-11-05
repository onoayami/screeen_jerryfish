import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createDomStub, createWindowEventTarget } from './dom-stub.mjs';

const hostRequire = createRequire(import.meta.url);

function runScript(source, context, filename) {
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename });
  return context.__phase0;
}

export function loadMainForTest({
  projectRoot,
  userDataRoot,
  fsOverrides = {},
  appOverrides = {},
  screenOverrides = {},
  dialogOverrides = {},
  nativeImageOverrides = {},
} = {}) {
  const handlers = new Map();
  const ipcListeners = new Map();
  const projectRequire = createRequire(path.join(projectRoot, 'main.js'));
  const wrappedFs = new Proxy(fs, {
    get(target, property) {
      if (Object.prototype.hasOwnProperty.call(fsOverrides, property)) return fsOverrides[property];
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  const app = {
    isPackaged: false,
    requestSingleInstanceLock: () => true,
    quit() {},
    getPath: () => userDataRoot,
    whenReady: () => new Promise(() => {}),
    on() {},
    ...appOverrides,
  };

  const browserWindows = [];
  let nextWebContentsId = 1000;

  class FakeWebContents {
    constructor(owner) {
      this.owner = owner;
      this.id = nextWebContentsId;
      nextWebContentsId += 1;
      this.mainFrame = { url: 'about:blank' };
      this.listeners = new Map();
      this.sent = [];
      this.windowOpenHandler = null;
    }

    on(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ listener, once: false });
    }

    once(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ listener, once: true });
    }

    emit(type, ...args) {
      const current = [...(this.listeners.get(type) || [])];
      this.listeners.set(type, current.filter((entry) => !entry.once));
      current.forEach((entry) => entry.listener(...args));
    }

    removeListener(type, listener) {
      const current = this.listeners.get(type) || [];
      this.listeners.set(type, current.filter((entry) => entry.listener !== listener));
    }

    send(channel, payload) { this.sent.push({ channel, payload }); }
    isDestroyed() { return this.owner.isDestroyed(); }
    isLoading() { return false; }
    setWindowOpenHandler(handler) { this.windowOpenHandler = handler; }
  }

  class FakeBrowserWindow {
    constructor(options = {}) {
      this.options = options;
      this.destroyed = false;
      this.visible = true;
      this.listeners = new Map();
      this.ignoreMouseCalls = [];
      this.bounds = {
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 800,
        height: options.height || 600,
      };
      this.webContents = new FakeWebContents(this);
      browserWindows.push(this);
    }

    static fromWebContents(webContents) {
      return browserWindows.find((window) => window.webContents === webContents) || null;
    }

    loadFile(fileName) {
      this.loadedFile = fileName;
      this.webContents.mainFrame = {
        url: pathToFileURL(path.join(projectRoot, fileName)).href,
      };
      return Promise.resolve();
    }

    on(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }

    emit(type, ...args) {
      for (const listener of this.listeners.get(type) || []) listener(...args);
    }

    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    show() { this.visible = true; this.emit('show'); }
    showInactive() { this.visible = true; this.emit('show'); }
    hide() { this.visible = false; this.emit('hide'); }
    focus() {}
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents(ignore, options) { this.ignoreMouseCalls.push({ ignore, options }); }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds) { this.bounds = { ...bounds }; }
    close() {
      let prevented = false;
      this.emit('close', { preventDefault() { prevented = true; } });
      if (prevented) return false;
      this.destroyed = true;
      this.visible = false;
      this.emit('closed');
      return true;
    }
  }

  const electron = {
    app,
    BrowserWindow: FakeBrowserWindow,
    Menu: { setApplicationMenu() {}, buildFromTemplate() { return {}; } },
    Tray: class {},
    nativeImage: {
      createEmpty() { return {}; },
      createFromPath() { return { isEmpty() { return false; } }; },
      ...nativeImageOverrides,
    },
    ipcMain: {
      handle(name, callback) { handlers.set(name, callback); },
      on(name, callback) { ipcListeners.set(name, callback); },
    },
    dialog: {
      async showOpenDialog() { return { canceled: true, filePaths: [] }; },
      async showMessageBox() { return { response: 0 }; },
      showErrorBox() {},
      ...dialogOverrides,
    },
    shell: { openPath() {} },
    screen: {
      getAllDisplays: () => [],
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 800, height: 600 } }),
      on() {},
      ...screenOverrides,
    },
  };

  const context = {
    console,
    process,
    Buffer,
    URL,
    Promise,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    require(id) {
      if (id === 'electron') return electron;
      if (id === 'fs') return wrappedFs;
      if (id.startsWith('./') || id.startsWith('../')) return projectRequire(id);
      return hostRequire(id);
    },
    __dirname: projectRoot,
    __filename: path.join(projectRoot, 'main.js'),
    module: { exports: {} },
    exports: {},
  };

  const source = `${fs.readFileSync(path.join(projectRoot, 'main.js'), 'utf8')}\n;globalThis.__phase0 = {
    getCharacterDirectory,
    getBundledCharacterDirectory,
    ensureCharacterDirectory,
    recoverDevelopmentDistributionDefaults,
    prepareDistributionDefaultsForDevelopment,
    loadWindowFileWithRecovery,
    reportStartupFailure,
    resolveCharacterPath,
    resolveCharacterAsset,
    validateAndNormalizeConfig,
    writeConfigAtomic,
    loadNormalizedConfig,
    loadEditableConfig: typeof loadEditableConfig === 'function' ? loadEditableConfig : undefined,
    recoverEditableConfig: typeof recoverEditableConfig === 'function' ? recoverEditableConfig : undefined,
    hashNormalizedConfig: typeof hashNormalizedConfig === 'function' ? hashNormalizedConfig : undefined,
    getCharacterAssetMetadata: typeof getCharacterAssetMetadata === 'function' ? getCharacterAssetMetadata : undefined,
    importImageFromPath,
    saveTransparentPng,
    openSettingsWindow,
    createMascotWindow,
    applyConfigToMascot,
    ensureMascotWindowOnScreen,
    selectDisplayForMascot: typeof selectDisplayForMascot === 'function' ? selectDisplayForMascot : undefined,
    recallMascotToCenter: typeof recallMascotToCenter === 'function' ? recallMascotToCenter : undefined,
    synchronizeMascotPassthrough: typeof synchronizeMascotPassthrough === 'function' ? synchronizeMascotPassthrough : undefined,
    setMascotWindow(value) { mascotWindow = value; },
    setSettingsWindow(value) { settingsWindow = value; },
    getSettingsDirty() { return typeof settingsDirty === 'undefined' ? undefined : settingsDirty; },
    getPaused() { return paused; },
    setPaused,
  };`;

  const api = runScript(source, context, 'main.js');
  return { api, handlers, ipcListeners, app, electron, context, browserWindows };
}

export function loadPreloadForTest({ projectRoot, fileName = 'preload.js' } = {}) {
  const invoked = [];
  const sent = [];
  const listeners = new Map();
  let exposedName = null;
  let exposedApi = null;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposedName = name;
        exposedApi = api;
      },
    },
    ipcRenderer: {
      invoke(channel, ...args) {
        invoked.push({ channel, args });
        return Promise.resolve(null);
      },
      send(channel, ...args) { sent.push({ channel, args }); },
      on(channel, listener) { listeners.set(channel, listener); },
      removeListener(channel, listener) {
        if (listeners.get(channel) === listener) listeners.delete(channel);
      },
    },
    webUtils: { getPathForFile: () => '/tmp/example.png' },
  };
  const context = {
    console,
    require(id) {
      if (id === 'electron') return electron;
      return hostRequire(id);
    },
  };
  context.globalThis = context;
  const source = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  vm.runInNewContext(source, context, { filename: fileName });
  return {
    exposedName,
    api: exposedApi,
    invoked,
    sent,
    listeners,
    context,
  };
}

export function loadRendererForTest({
  projectRoot,
  width = 800,
  height = 600,
  random = Math.random,
  localStorage: localStorageOverride,
  mascotAPI: mascotAPIOverride = {},
  ImageClass = class {},
} = {}) {
  const { document, nodes } = createDomStub();
  const passthroughCalls = [];
  const storage = localStorageOverride || { getItem: () => null, setItem() {} };
  const windowObject = createWindowEventTarget({
    innerWidth: width,
    innerHeight: height,
    requestAnimationFrame() {},
    setTimeout,
    clearTimeout,
    mascotAPI: {
      setMousePassthrough(value) { passthroughCalls.push(value); },
      onCommand() {},
      loadConfig: async () => ({ config: { mascot: {}, actions: [] } }),
      resolveAsset: async () => null,
      reportApplyResult() {},
      ...mascotAPIOverride,
    },
  });
  const vmMath = Object.create(Math);
  vmMath.random = random;
  const context = {
    console,
    document,
    window: windowObject,
    localStorage: storage,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    setTimeout,
    clearTimeout,
    Image: ImageClass,
    Math: vmMath,
  };

  let source = fs.readFileSync(path.join(projectRoot, 'renderer.js'), 'utf8');
  const bootPattern = /\nreloadConfig\(\{ keepPosition: false \}\)\.then\(\(\) => \{[\s\S]*?\n\}\);\s*$/;
  if (!bootPattern.test(source)) throw new Error('renderer.js の自動起動箇所を特定できません。');
  source = source.replace(bootPattern, '\n');
  source += `\n;globalThis.__phase0 = {
    state,
    chooseWeightedAction,
    getMascotWidth,
    getMascotHeight,
    axisMovementBounds,
    movementBounds,
    clampPosition,
    renderPosition: typeof renderPosition === 'function' ? renderPosition : undefined,
    configuredStartPosition,
    setMousePassthrough,
    pointIsInsideMascot,
    savePosition,
    setPosition,
    setAction,
    displayAction: typeof displayAction === 'function' ? displayAction : undefined,
    mapWithConcurrency: typeof mapWithConcurrency === 'function' ? mapWithConcurrency : undefined,
    createEffect: typeof createEffect === 'function' ? createEffect : undefined,
    clearEffects: typeof clearEffects === 'function' ? clearEffects : undefined,
    reloadConfig,
    updateMotion,
  };`;

  const api = runScript(source, context, 'renderer.js');
  const mascotNode = nodes.get('mascot');
  mascotNode.getBoundingClientRect = () => {
    const mascotWidth = api.getMascotWidth();
    const mascotHeight = api.getMascotHeight();
    const { x, y } = api.state.position;
    return { left: x, top: y, width: mascotWidth, height: mascotHeight, right: x + mascotWidth, bottom: y + mascotHeight };
  };
  return { api, nodes, window: windowObject, passthroughCalls, localStorage: storage, context };
}

export function loadSettingsForTest({
  projectRoot,
  mascotAPI: mascotAPIOverride = {},
  ImageClass = class {},
  provideMascotAPI = true,
  runBoot = false,
  now = () => Date.now(),
} = {}) {
  const { document, nodes } = createDomStub();
  const defaultConfig = {
    name: 'Phase 0',
    mascot: { size: 180, startPosition: 'bottom-right', margin: 40, rememberPosition: true },
    actions: [{
      name: '休む',
      file: 'actions/rest.svg',
      weight: 1,
      durationMs: [6000, 10000],
      movement: { type: 'still', speed: 0 },
    }],
  };
  const mascotAPI = {
    loadConfig: async () => ({ config: structuredClone(defaultConfig) }),
    resolveAsset: async (relativePath) => `file://${relativePath}`,
    chooseImage: async () => null,
    importImage: async () => null,
    saveTransparentPng: async () => null,
    getPathForFile: () => '',
    getAppInfo: async () => ({ isPackaged: false }),
    prepareDistributionDefaults: async () => ({ ok: true }),
    saveConfig: async (config) => ({ ok: true, applied: true, config }),
    recoverConfig: async () => ({ ok: true }),
    reportDirtyState() {},
    getAssetMetadata: async () => null,
    ...mascotAPIOverride,
  };
  const windowBase = {
    location: { href: 'file:///settings.html' },
    clearTimeout,
    setTimeout,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    confirm: () => true,
  };
  if (provideMascotAPI) windowBase.mascotAPI = mascotAPI;
  const windowObject = createWindowEventTarget(windowBase);
  const context = {
    console,
    document,
    window: windowObject,
    URL,
    Blob,
    structuredClone,
    crypto: { randomUUID },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: windowObject.requestAnimationFrame,
    cancelAnimationFrame: clearTimeout,
    Image: ImageClass,
    ImageData: class {
      constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    },
    Uint8ClampedArray,
    Math,
    Date: class TestDate extends Date { static now() { return now(); } },
  };

  let source = fs.readFileSync(path.join(projectRoot, 'settings.js'), 'utf8');
  const bootPattern = /\n(?:loadConfiguration|initializeSettings)\(\);\s*$/;
  if (!bootPattern.test(source)) throw new Error('settings.js の自動起動箇所を特定できません。');
  if (!runBoot) source = source.replace(bootPattern, '\n');
  source += `\n;globalThis.__phase0 = {
    state,
    elements,
    loadConfiguration,
    setBusy,
    markDirty,
    markSaved,
    markLoaded: typeof markLoaded === 'function' ? markLoaded : undefined,
    serializeConfig,
    saveConfiguration,
    prepareDistributionDefaults,
    beginOperation: typeof beginOperation === 'function' ? beginOperation : undefined,
    endOperation: typeof endOperation === 'function' ? endOperation : undefined,
    addAction: typeof addAction === 'function' ? addAction : undefined,
    renderActionList: typeof renderActionList === 'function' ? renderActionList : undefined,
    updateActionName: typeof updateActionName === 'function' ? updateActionName : undefined,
    mapWithConcurrency: typeof mapWithConcurrency === 'function' ? mapWithConcurrency : undefined,
    measureVisibleContent,
    sizeMeasurementCache,
    beginSizeManagerGeneration: typeof beginSizeManagerGeneration === 'function' ? beginSizeManagerGeneration : undefined,
    isSizeManagerGenerationCurrent: typeof isSizeManagerGenerationCurrent === 'function' ? isSizeManagerGenerationCurrent : undefined,
    beginJpegGeneration: typeof beginJpegGeneration === 'function' ? beginJpegGeneration : undefined,
    isJpegGenerationCurrent: typeof isJpegGenerationCurrent === 'function' ? isJpegGenerationCurrent : undefined,
    invalidateJpegGeneration: typeof invalidateJpegGeneration === 'function' ? invalidateJpegGeneration : undefined,
  };`;

  const api = runScript(source, context, 'settings.js');
  return { api, nodes, window: windowObject, mascotAPI, context };
}
