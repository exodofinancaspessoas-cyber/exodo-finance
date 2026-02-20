
const APP_VERSION = '1.1.4'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-20 10:00';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
