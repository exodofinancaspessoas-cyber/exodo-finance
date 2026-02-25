
const APP_VERSION = '1.4.2'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-25 09:12';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
