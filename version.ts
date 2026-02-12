
const APP_VERSION = '1.0.2'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-12';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
