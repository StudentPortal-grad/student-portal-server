import express from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { validate } from '../../../middleware/validate';
import { createRoleSchema } from '../../../validators/roleValidator';
import { createRole, getAllRoles } from '../../../controllers/role.controller';

const router = express.Router();

router.post('/',
    validate(createRoleSchema), 
    asyncHandler(createRole)
);
router.get('/',
    asyncHandler(getAllRoles)
);

export default router;