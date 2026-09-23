import jwt from 'jsonwebtoken';

const revokedTokenIds = new Set<string>();

export const revokeToken = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token);
    const jti = typeof decoded === 'object' && decoded && 'jti' in decoded ? String((decoded as any).jti) : null;
    if (!jti) {
      return false;
    }

    revokedTokenIds.add(jti);
    return true;
  } catch {
    return false;
  }
};

export const isTokenRevoked = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token);
    const jti = typeof decoded === 'object' && decoded && 'jti' in decoded ? String((decoded as any).jti) : null;
    return !!jti && revokedTokenIds.has(jti);
  } catch {
    return false;
  }
};

export const revokeTokenFromRequest = (authorizationHeader?: string): boolean => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return false;
  }

  return revokeToken(authorizationHeader.replace('Bearer ', '').trim());
};
