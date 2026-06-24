import { Router } from 'express';
import { getAppPublicConfig } from '../utils/featureTabs';

const router = Router();

router.get('/tabs', (_req, res) => {
  res.json(getAppPublicConfig());
});

export default router;
