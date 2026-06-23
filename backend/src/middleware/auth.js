const jwt = require('jsonwebtoken');
const db = require('../db/knex');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretthreadtracktoken';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Token can be: Bearer <token>
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    try {
      const user = await db('users').where({ id: decodedUser.id }).first();
      if (!user) {
        return res.status(401).json({ error: 'User session has expired or account has been deleted' });
      }
      if (!user.active) {
        return res.status(403).json({ error: 'User account has been suspended' });
      }
      
      req.user = user;
      
      const isSystemRoute = 
        req.originalUrl.startsWith('/api/users') || 
        req.originalUrl.startsWith('/api/admin') || 
        req.originalUrl.startsWith('/api/auth');
      
      if (!isSystemRoute) {
        const { getTenantDb, getTenantDbName, storage, createTenantDatabase } = require('../db/manager');
        const dbName = user.db_name || getTenantDbName(user.mobile);
        
        try {
          await createTenantDatabase(dbName);
        } catch (dbError) {
          console.error('Failed to initialize tenant database on-demand:', dbError);
          return res.status(500).json({ error: 'Tenant database initialization failed' });
        }

        const tenantDb = getTenantDb(dbName);
        storage.run(tenantDb, next);
      } else {
        next();
      }
    } catch (dbErr) {
      console.error('Auth middleware database error:', dbErr);
      return res.status(500).json({ error: 'Authentication database error' });
    }
  });
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin role required for this action' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
