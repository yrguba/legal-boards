import crypto from 'crypto';

export function isConferencesEnabled(): boolean {
  const raw = process.env.CONFERENCES_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getJitsiDomain(): string {
  return (process.env.JITSI_DOMAIN?.trim() || 'video.vibecall.space').replace(/^https?:\/\//, '');
}

export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
  return url.replace(/\/$/, '');
}

export function generateRoomName(): string {
  return `lb-${crypto.randomBytes(12).toString('hex')}`;
}

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function buildJitsiRoomUrl(
  roomName: string,
  displayName: string,
  opts?: { startWithAudioMuted?: boolean; startWithVideoMuted?: boolean; subject?: string },
): string {
  const domain = getJitsiDomain();
  const audioMuted = opts?.startWithAudioMuted ?? true;
  const videoMuted = opts?.startWithVideoMuted ?? true;
  const params = [
    `config.startWithAudioMuted=${audioMuted}`,
    `config.startWithVideoMuted=${videoMuted}`,
    'config.prejoinPageEnabled=false',
    'config.disableModeratorIndicator=true',
    'config.enableEmailInStats=false',
    'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
    `userInfo.displayName=${encodeURIComponent(displayName)}`,
  ];
  if (opts?.subject) {
    params.push(`config.subject=${encodeURIComponent(opts.subject)}`);
  }
  return `https://${domain}/${encodeURIComponent(roomName)}#${params.join('&')}`;
}

export function buildPublicJoinUrl(shareToken: string): string {
  return `${getFrontendUrl()}/conferences/join/${shareToken}`;
}
