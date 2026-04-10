import { Router } from 'express';

import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { authProtectedRouter } from '../modules/auth/auth.routes.js';
import { loginSchema } from '../modules/auth/auth.schemas.js';
import { budgetItemRouter } from '../modules/budget-item/budget-item.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { missingItemReportRouter } from '../modules/missing-item-report/missing-item-report.routes.js';
import { notificationRouter } from '../modules/notification/notification.routes.js';
import { documentRouter } from '../modules/document/document.routes.js';
import { extractionApplyRouter } from '../modules/extraction-apply/extraction-apply.routes.js';
import { ocrRouter } from '../modules/ocr/ocr.routes.js';
import { projectRouter } from '../modules/project/project.routes.js';
import { purchaseRouter } from '../modules/purchase/purchase.routes.js';
import { quoteRouter } from '../modules/quote/quote.routes.js';
import { replenishmentRouter } from '../modules/replenishment/replenishment.routes.js';
import { roleRouter } from '../modules/role/role.routes.js';
import { supplierRouter } from '../modules/supplier/supplier.routes.js';
import { userAdminRouter } from '../modules/user/user-admin.routes.js';
import { sendHealthHead, sendHealthJson } from '../utils/health-response.js';

export const apiRouter = Router();

/**
 * Rotas **sem** `authenticate`. No Express 5, `apiRouter.use(authenticate)` aplicava-se a
 * tudo o que vinha a seguir e podia ser despachado antes dos `get('/health')` no mesmo router.
 * Aqui o router protegido é um sub-router separado.
 */
const publicApiRoutes = Router();

publicApiRoutes.post(
  '/auth/login',
  validateRequest({ body: loginSchema }),
  asyncHandler((request, response) => authController.login(request, response)),
);

publicApiRoutes.get('/health', (_request, response) => sendHealthJson(response));
publicApiRoutes.head('/health', (_request, response) => sendHealthHead(response));
publicApiRoutes.get('/', (_request, response) => sendHealthJson(response));
publicApiRoutes.head('/', (_request, response) => sendHealthHead(response));

const protectedApiRoutes = Router();

protectedApiRoutes.use(asyncHandler(authenticate));

protectedApiRoutes.use(notificationRouter);
protectedApiRoutes.use(authProtectedRouter);
protectedApiRoutes.use(userAdminRouter);
protectedApiRoutes.use(ocrRouter);
protectedApiRoutes.use(projectRouter);
protectedApiRoutes.use(quoteRouter);
protectedApiRoutes.use(extractionApplyRouter);
protectedApiRoutes.use(documentRouter);
protectedApiRoutes.use(roleRouter);
protectedApiRoutes.use(budgetItemRouter);
protectedApiRoutes.use(supplierRouter);
protectedApiRoutes.use(purchaseRouter);
protectedApiRoutes.use(replenishmentRouter);
protectedApiRoutes.use(missingItemReportRouter);
protectedApiRoutes.use(dashboardRouter);

apiRouter.use(publicApiRoutes);
apiRouter.use(protectedApiRoutes);
