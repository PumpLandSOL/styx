// local dev only: faucet on, vigil open now
process.env.DEV_FAUCET = '1'; process.env.VIGIL_START = '1'; require('../server/index.js');
