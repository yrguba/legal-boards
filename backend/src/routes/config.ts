import { Router } from 'express';
import { getFeatureTabsConfig } from '../utils/featureTabs';

const router = Router();

router.get('/tabs', (_req, res) => {
  res.json(getFeatureTabsConfig());
});

export default router;
