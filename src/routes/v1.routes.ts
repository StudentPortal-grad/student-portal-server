import { Router } from "express";
import communityRoutes from "./community/v1/community.routes";
import discussionRoutes from "./discussion/v1/discussion.routes";
import conversationRoutes from "./conversation/v1/conversation.route";
import messageRoutes from "./message/v1/message.route";
import authRoutes from "./user/v1/auth/auth.routes";
import userRoutes from "./user/v1/user.routes";
import searchRoutes from "./search/v1/search.routes";
import eventRoutes from "./event/v1/event.routes";
import resourceRoutes from "./resource/v1/resource.routes";
import dashboardRoutes from "./dashboard/v1/dashboard.routes";
import roleRoutes from "./role/v1/role.routes";
import fcmRoutes from "./fcm/v1/fcm.routes";
import { AppError, ErrorCodes } from "@utils/appError";
import notificationRoutes from "./user/v1/notification.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/search", searchRoutes);
router.use("/communities", communityRoutes);
router.use("/discussions", discussionRoutes);
router.use("/conversations", conversationRoutes);
router.use("/messages", messageRoutes);
router.use("/events", eventRoutes);
router.use("/resources", resourceRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/roles", roleRoutes);
router.use("/notifications", notificationRoutes);
router.use("/fcm", fcmRoutes);

router.get("/", (req, res, next) => {
    res.success({}, "This is Version 1 of the API", 200)
});

router.use("*", (req, res, next) => {
    next(
        new AppError(
            "Invalid routing path: " + req.originalUrl,
            404,
            ErrorCodes.NOT_FOUND
        )
    );
});

export default router;
