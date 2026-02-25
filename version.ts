
const APP_VERSION = '1.4.3'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-25 09:38';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
