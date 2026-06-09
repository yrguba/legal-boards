export const JITSI_DOMAIN = 'video.vibecall.space';

export const CONFERENCE_CONFIG_OVERWRITE = {
  startWithAudioMuted: true,
  startWithVideoMuted: true,
  prejoinPageEnabled: false,
  disableModeratorIndicator: true,
  startScreenSharing: false,
  enableEmailInStats: false,
  toolbarButtons: ['camera', 'microphone', 'hangup', 'tileview'],
};

export const INTERFACE_CONFIG_OVERWRITE = {
  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
};

export type JitsiMeetApi = {
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

type JitsiMeetExternalAPIConstructor = new (
  domain: string,
  options: {
    roomName: string;
    parentNode: HTMLElement;
    width?: string | number;
    height?: string | number;
    userInfo?: { displayName?: string; email?: string };
    configOverwrite?: Record<string, unknown>;
    interfaceConfigOverwrite?: Record<string, unknown>;
  },
) => JitsiMeetApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPIConstructor;
  }
}

const scriptPromises = new Map<string, Promise<void>>();

export function loadJitsiExternalApi(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();

  const existing = scriptPromises.get(domain);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiDomain = domain;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить Jitsi API (${domain})`));
    document.head.appendChild(script);
  });

  scriptPromises.set(domain, promise);
  return promise;
}

export function createJitsiMeeting(
  domain: string,
  args: {
    roomName: string;
    subject: string;
    displayName: string;
    parentNode: HTMLElement;
    micOn: boolean;
    cameraOn: boolean;
    onMeetingLeft?: () => void;
  },
): JitsiMeetApi {
  const Api = window.JitsiMeetExternalAPI;
  if (!Api) {
    throw new Error('Jitsi External API не загружен');
  }

  const api = new Api(domain, {
    roomName: args.roomName,
    parentNode: args.parentNode,
    width: '100%',
    height: '100%',
    userInfo: { displayName: args.displayName },
    configOverwrite: {
      ...CONFERENCE_CONFIG_OVERWRITE,
      startWithAudioMuted: !args.micOn,
      startWithVideoMuted: !args.cameraOn,
      subject: args.subject,
    },
    interfaceConfigOverwrite: INTERFACE_CONFIG_OVERWRITE,
  });

  api.executeCommand('subject', args.subject);
  api.on('videoConferenceJoined', () => {
    api.executeCommand('subject', args.subject);
  });

  if (args.onMeetingLeft) {
    let left = false;
    const handleLeft = () => {
      if (left) return;
      left = true;
      args.onMeetingLeft?.();
    };
    api.on('videoConferenceLeft', handleLeft);
    api.on('readyToClose', handleLeft);
  }

  return api;
}

/** @deprecated Используйте createJitsiMeeting — URL-hash не задаёт subject надёжно */
export function buildJitsiEmbedUrl(
  roomName: string,
  displayName: string,
  opts: { micOn: boolean; cameraOn: boolean; subject?: string },
  domain = JITSI_DOMAIN,
): string {
  const params = [
    `config.startWithAudioMuted=${!opts.micOn}`,
    `config.startWithVideoMuted=${!opts.cameraOn}`,
    'config.prejoinPageEnabled=false',
    'config.disableModeratorIndicator=true',
    'config.enableEmailInStats=false',
    `config.toolbarButtons=${JSON.stringify(CONFERENCE_CONFIG_OVERWRITE.toolbarButtons)}`,
    'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
    `userInfo.displayName=${encodeURIComponent(displayName)}`,
  ];
  if (opts.subject) {
    params.push(`config.subject=${encodeURIComponent(opts.subject)}`);
  }
  return `https://${domain}/${encodeURIComponent(roomName)}#${params.join('&')}`;
}

export function applyIframeContainerStyles(parentNode: HTMLDivElement) {
  parentNode.style.width = '100%';
  parentNode.style.height = '100%';
}
