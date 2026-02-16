
const APP_VERSION = '1.0.9'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-16';

export const VersionInfo = {
    version: APP_VERSION,
    date: DEPLOY_DATE,
    environment: import.meta.env.MODE,
};
