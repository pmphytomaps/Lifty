/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * File helpers that work with both the legacy expo-file-system API and the
 * new File/Paths API, so an SDK bump does not strand exports.
 */
let legacy: any = null;
let modern: any = null;
try {
  legacy = require('expo-file-system/legacy');
} catch {
  legacy = null;
}
try {
  modern = require('expo-file-system');
} catch {
  modern = null;
}
if (!legacy && modern?.writeAsStringAsync) legacy = modern;

/** Write text into the app cache and return a shareable file URI. */
export async function writeCacheFile(filename: string, contents: string): Promise<string> {
  if (legacy?.writeAsStringAsync && legacy?.cacheDirectory) {
    const uri = `${legacy.cacheDirectory}${filename}`;
    await legacy.writeAsStringAsync(uri, contents, { encoding: 'utf8' });
    return uri;
  }
  if (modern?.File && modern?.Paths) {
    const file = new modern.File(modern.Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(contents);
    return file.uri;
  }
  throw new Error('No file system API available');
}

export async function readTextFile(uri: string): Promise<string> {
  if (legacy?.readAsStringAsync) {
    return legacy.readAsStringAsync(uri, { encoding: 'utf8' });
  }
  if (modern?.File) {
    return new modern.File(uri).text();
  }
  throw new Error('No file system API available');
}

export class FolderSaveUnsupported extends Error {
  constructor() {
    super('Saving straight to a folder is not available on this device');
    this.name = 'FolderSaveUnsupported';
  }
}

/**
 * Let the user pick a folder and drop the file there (Android SAF).
 * Returns false when the user backs out; throws when the platform can't do it.
 */
export async function saveToFolder(filename: string, contents: string, mimeType: string): Promise<boolean> {
  const saf = legacy?.StorageAccessFramework;
  if (!saf?.requestDirectoryPermissionsAsync) throw new FolderSaveUnsupported();
  const perm = await saf.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false;
  const uri = await saf.createFileAsync(perm.directoryUri, filename, mimeType);
  await legacy.writeAsStringAsync(uri, contents, { encoding: 'utf8' });
  return true;
}
