/**
 * Run after `expo prebuild` (android/ is generated, not committed).
 * Adds a release signing config that reads from gradle properties or env:
 *   LIFTY_UPLOAD_STORE_FILE / _KEY_ALIAS / _STORE_PASSWORD / _KEY_PASSWORD
 * Falls back to debug signing when unset, so unsigned dev builds still work.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'android/app/build.gradle';
let src = readFileSync(path, 'utf8');

const releaseConfig = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def storeFileProp = System.getenv('LIFTY_UPLOAD_STORE_FILE') ?: findProperty('LIFTY_UPLOAD_STORE_FILE')
            if (storeFileProp) {
                storeFile file(storeFileProp)
                storePassword System.getenv('LIFTY_UPLOAD_STORE_PASSWORD') ?: findProperty('LIFTY_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('LIFTY_UPLOAD_KEY_ALIAS') ?: findProperty('LIFTY_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('LIFTY_UPLOAD_KEY_PASSWORD') ?: findProperty('LIFTY_UPLOAD_KEY_PASSWORD')
            }
        }
    }`;

src = src.replace(/    signingConfigs \{[\s\S]*?\n    \}/, releaseConfig);

src = src.replace(
  /release \{\n(\s*)\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
  (m, indent) => m.replace(
    'signingConfig signingConfigs.debug',
    `def liftyStoreFile = System.getenv('LIFTY_UPLOAD_STORE_FILE') ?: findProperty('LIFTY_UPLOAD_STORE_FILE')
${'            '}signingConfig(liftyStoreFile ? signingConfigs.release : signingConfigs.debug)`,
  ),
);

writeFileSync(path, src);
console.log('android/app/build.gradle: release signing wired');
