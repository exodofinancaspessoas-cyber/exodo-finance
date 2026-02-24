
const APP_VERSION = '1.3.1'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-24 17:35';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
