import path from 'path';

export function getUploadsPath(): string {
  return path.resolve(process.env.UPLOAD_DIR || 'uploads');
}

/** `uploads/<file>` for DB and URLs; must match `express.static` mount, not a filesystem path. */
export function toPublicUploadPath(absoluteFilePath: string): string {
  return path.join('uploads', path.basename(absoluteFilePath)).replace(/\\/g, '/');
}
