
const APP_VERSION = '1.5.5'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-25 15:40';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
