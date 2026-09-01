// // Toggle this to false before building for production

const IS_DEV = false;

const DEV_URL = 'ws://localhost:8080';

// This is the production URL on Render

const PROD_URL = 'wss://sender-2-nygg.onrender.com';

export const SERVER_URL = IS_DEV ? DEV_URL : PROD_URL;