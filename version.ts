
const APP_VERSION = '1.1.3'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-16 13:45';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
