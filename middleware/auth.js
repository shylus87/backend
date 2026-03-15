import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  // Disable JWT requirement in development
  if (process.env.NODE_ENV === 'development') {
    req.user = { userId: 1, role: 'dev' };
    return next();
  }
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(auth, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
