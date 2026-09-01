import appJson from './app.json';

export default ({ config }) => ({
  ...config,
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://backends-production-3d0b.up.railway.app',
    },
  },
});
