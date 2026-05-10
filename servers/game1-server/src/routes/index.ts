import { Router } from 'express';
import authRouter from './auth';
import playersRouter from './players';
import pvpRouter from './pvp';
import adminRouter from './admin';
import achievementsRouter from './achievements';
import saveRouter from './save';
import configRouter from './config';
import socialRouter from './social';

const router = Router();

router.use(authRouter);
router.use(playersRouter);
router.use(pvpRouter);
router.use(adminRouter);
router.use(saveRouter);
router.use(achievementsRouter);
router.use(configRouter);
router.use(socialRouter);

export default router;
