import type { Request, Response, NextFunction } from 'express';
import { rpcClient } from '../msf/rpcClient.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health' || req.path === '/api/connect' || req.path === '/api/status') {
    next();
    return;
  }

  if (!rpcClient.connected) {
    res.status(401).json({ error: 'Not connected to Metasploit RPC. Use Connect first.' });
    return;
  }

  next();
}
