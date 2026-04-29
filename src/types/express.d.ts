// Extend Express Request type to include user property
declare namespace Express {
  interface User {
    accessToken: string;
    refreshToken: string;
  }
}
