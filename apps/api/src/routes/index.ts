import { Router } from 'express';

import { authenticate } from '../middlewares/auth.js';
import { authProtectedRouter, authPublicRouter } from '../modules/auth/auth.routes.js';
import { budgetItemRouter } from '../modules/budget-item/budget-item.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { missingItemReportRouter } from '../modules/missing-item-report/missing-item-report.routes.js';
import { documentRouter } from '../modules/document/document.routes.js';
import { extractionApplyRouter } from '../modules/extraction-apply/extraction-apply.routes.js';
import { ocrRouter } from '../modules/ocr/ocr.routes.js';
import { projectRouter } from '../modules/project/project.routes.js';
import { purchaseRouter } from '../modules/purchase/purchase.routes.js';
import { replenishmentRouter } from '../modules/replenishment/replenishment.routes.js';
import { roleRouter } from '../modules/role/role.routes.js';
import { supplierRouter } from '../modules/supplier/supplier.routes.js';
import { userAdminRouter } from '../modules/user/user-admin.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use(authPublicRouter);

apiRouter.use(authenticate);

apiRouter.use(authProtectedRouter);
apiRouter.use(userAdminRouter);
apiRouter.use(ocrRouter);
apiRouter.use(projectRouter);
apiRouter.use(extractionApplyRouter);
apiRouter.use(documentRouter);
apiRouter.use(roleRouter);
apiRouter.use(budgetItemRouter);
apiRouter.use(supplierRouter);
apiRouter.use(purchaseRouter);
apiRouter.use(replenishmentRouter);
apiRouter.use(missingItemReportRouter);
apiRouter.use(dashboardRouter);
