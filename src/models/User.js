"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var bcrypt_1 = require("bcrypt");
var jsonwebtoken_1 = require("jsonwebtoken");
var crypto_1 = require("crypto");
var helpers_1 = require("../utils/helpers");
var UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 255,
    },
    username: {
        type: String,
        required: false,
        trim: true,
        minlength: [3, "Username must be at least 3 characters long"],
        maxlength: [30, "Username cannot exceed 30 characters"],
    },
    gender: {
        type: String,
        required: false,
        enum: ["male", "female"],
    },
    phoneNumber: {
        type: String,
        required: false,
        validate: {
            validator: function (v) {
                return /^\+\d{1,4}[\s-]?(\d[\s-]?){6,14}\d$/.test(v);
            },
            message: function (props) {
                return "".concat(props.value, " is not a valid international phone number!");
            },
        },
    },
    dateOfBirth: {
        type: Date,
    },
    university: {
        type: String,
        required: function () {
            return this.signupStep === "completed" && !this.isChatbot;
        },
    },
    college: {
        type: String,
        required: function () {
            return this.signupStep === "completed" && !this.isChatbot;
        },
    },
    email: {
        type: String,
        required: true,
        unique: true,
        maxlength: 320,
    },
    password: {
        type: String,
        required: function () {
            return !this.isChatbot;
        },
        maxlength: 60,
        minlength: 8,
        select: false,
    },
    signupStep: {
        type: String,
        required: true,
        enum: ["initial", "verified", "completed"],
        default: "initial",
    },
    role: {
        type: String,
        required: function () {
            return this.signupStep === "completed";
        },
        enum: ["student", "faculty", "admin", "superadmin"],
    },
    profilePicture: {
        type: String,
        default: "https://via.placeholder.com/150",
    },
    profile: {
        bio: String,
        interests: [String],
    },
    addresses: [
        {
            _id: false,
            street: String,
            city: String,
            country: String,
        },
    ],
    level: {
        type: Number,
        min: 1,
        max: 5,
    },
    gpa: {
        type: Number,
    },
    universityEmail: {
        type: String,
        maxlength: 320,
    },
    universityEmailVerified: {
        type: Boolean,
        default: false,
    },
    tempEmail: {
        type: String,
        select: false,
    },
    tempUniversityEmail: {
        type: String,
        select: false,
    },
    mfa_settings: {
        enabled: {
            type: Boolean,
            default: false,
        },
        methods: [String],
    },
    dashboards: {
        academic_progress: Number,
        event_stats: {
            attended: Number,
        },
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    otp: {
        code: String,
        expiresAt: Date,
    },
    roles: [
        {
            _id: false,
            communityId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Community",
            },
            role: String,
        },
    ],
    status: {
        type: String,
        enum: ["online", "offline", "idle", "dnd"],
        default: "offline",
    },
    isSuspended: {
        type: Boolean,
        default: false,
    },
    suspensionReason: {
        type: String,
    },
    suspendedUntil: {
        type: Date,
    },
    socketId: {
        type: String,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
    isGraduated: {
        type: Boolean,
        default: false,
    },
    graduationYear: {
        type: Number,
        validate: {
            validator: function (v) {
                return v >= 1900 && v <= new Date().getFullYear();
            },
            message: "Graduation year must be between 1900 and current year",
        },
    },
    // Add to the friends array schema to include conversationId
    friends: [
        {
            _id: false,
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Users" },
            status: {
                type: String,
                enum: ["pending", "accepted", "blocked"],
                default: "pending",
            },
            blockedBy: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Users",
            },
            conversationId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Conversation",
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    friendRequests: [
        {
            _id: false,
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Users" },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    followers: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Users",
        },
    ],
    following: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Users",
        },
    ],
    blockedUsers: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Users",
        },
    ],
    recentConversations: [
        {
            _id: false,
            conversationId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Conversation",
            },
            unreadCount: { type: Number, default: 0 },
            lastReadMessageId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Message",
            },
            isPinned: { type: Boolean, default: false },
            isMuted: { type: Boolean, default: false },
            mutedUntil: Date,
        },
    ],
    chatPreferences: {
        notifications: {
            type: String,
            enum: ["all", "mentions", "none"],
            default: "all",
        },
        soundEnabled: {
            type: Boolean,
            default: true,
        },
        desktopNotifications: {
            type: Boolean,
            default: true,
        },
        showTypingIndicators: {
            type: Boolean,
            default: true,
        },
        markReadOnView: {
            type: Boolean,
            default: true,
        },
        theme: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system",
        },
    },
    mutedConversations: [
        {
            _id: false,
            conversationId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Conversation",
            },
            mutedUntil: Date,
        },
    ],
    pinnedConversations: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Conversation",
        },
    ],
    bookmarkedMessages: [
        {
            _id: false,
            messageId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Message" },
            conversationId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Conversation",
            },
            bookmarkedAt: { type: Date, default: Date.now },
            note: String,
        },
    ],
    fcmToken: {
        type: String,
        default: null,
    },
    // Chatbot specific fields
    isChatbot: {
        type: Boolean,
        default: false,
    },
    botSettings: {
        type: {
            isActive: { type: Boolean, default: true },
            language: { type: String, enum: ['ar', 'en'], default: 'ar' },
            personalityType: { type: String, enum: ['formal', 'friendly', 'academic'], default: 'academic' },
            contextLimit: { type: Number, default: 10 }
        },
        default: null
    },
    hasChatbotConversation: {
        type: Boolean,
        default: false,
    },
    chatbotConversationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Conversation",
        default: null
    }
}, {
    timestamps: true,
});
// Indexes
UserSchema.index({ universityEmail: 1 }, { sparse: true, unique: true });
UserSchema.index({ username: 1 }, {
    unique: true,
    sparse: true,
    collation: { locale: "en", strength: 2 }, // Case-insensitive unique index
});
// Add index for friends and muted conversations
UserSchema.index({ "friends.userId": 1 });
UserSchema.index({ "mutedConversations.conversationId": 1 });
// Add text index for searching
UserSchema.index({ name: 'text', username: 'text', universityEmail: 'text' });
// Virtuals for followers and following counts
UserSchema.virtual("followersCount").get(function () {
    var _a;
    return ((_a = this.followers) === null || _a === void 0 ? void 0 : _a.length) || 0;
});
UserSchema.virtual("followingCount").get(function () {
    var _a;
    return ((_a = this.following) === null || _a === void 0 ? void 0 : _a.length) || 0;
});
// Ensure virtuals are included when converting to JSON/object
UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });
// Pre-save middleware for generating username if not provided
UserSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function () {
        var username, isUnique, UserModel, existingUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(this.isNew && !this.username)) return [3 /*break*/, 4];
                    username = void 0;
                    isUnique = false;
                    UserModel = this.constructor;
                    _a.label = 1;
                case 1:
                    if (!!isUnique) return [3 /*break*/, 3];
                    username = (0, helpers_1.generateUsernameFromEmail)(this.email);
                    return [4 /*yield*/, UserModel.findOne({ username: username })];
                case 2:
                    existingUser = _a.sent();
                    if (!existingUser) {
                        isUnique = true;
                    }
                    return [3 /*break*/, 1];
                case 3:
                    this.username = username;
                    _a.label = 4;
                case 4:
                    next();
                    return [2 /*return*/];
            }
        });
    });
});
// Pre-save middleware for password validation and hashing
UserSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function () {
        var passwordRegex, salt, _a, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!this.isModified("password"))
                        return [2 /*return*/, next()];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
                    if (!passwordRegex.test(this.password)) {
                        throw new Error("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)");
                    }
                    return [4 /*yield*/, bcrypt_1.default.genSalt(10)];
                case 2:
                    salt = _b.sent();
                    _a = this;
                    return [4 /*yield*/, bcrypt_1.default.hash(this.password, salt)];
                case 3:
                    _a.password = _b.sent();
                    next();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    next(error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
// Methods
UserSchema.methods = {
    // Generate JWT token
    generateAuthToken: function () {
        return jsonwebtoken_1.default.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET || "li11kgF62d9SyoW8AV72f3ltzKv/WSk8wVIE5xxvSRg=", { expiresIn: "24h" });
    },
    // Compare password
    comparePassword: function (candidatePassword) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, bcrypt_1.default.compare(candidatePassword, this.password)];
            });
        });
    },
    // Generate password reset token
    generateResetToken: function () {
        return __awaiter(this, void 0, void 0, function () {
            var resetToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resetToken = crypto_1.default.randomBytes(32).toString("hex");
                        this.otp = {
                            code: crypto_1.default.createHash("sha256").update(resetToken).digest("hex"),
                            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                        };
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, resetToken];
                }
            });
        });
    },
    // Update online status
    updateStatus: function (status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.status = status;
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Friend management
    addFriend: function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!((_a = this.friends) === null || _a === void 0 ? void 0 : _a.some(function (f) { return f.userId.equals(userId); }))) return [3 /*break*/, 2];
                        this.friends.push({
                            userId: userId,
                            status: "pending",
                            createdAt: new Date(),
                        });
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    // Update the acceptFriend method to include conversationId
    acceptFriend: function (userId, conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var friendship;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        friendship = (_a = this.friends) === null || _a === void 0 ? void 0 : _a.find(function (f) {
                            return f.userId.equals(userId);
                        });
                        if (!(friendship && friendship.status === "pending")) return [3 /*break*/, 2];
                        friendship.status = "accepted";
                        if (conversationId) {
                            friendship.conversationId = conversationId;
                        }
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    // Add a method to set conversation for a friend
    setFriendConversation: function (userId, conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var friendship;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        friendship = (_a = this.friends) === null || _a === void 0 ? void 0 : _a.find(function (f) {
                            return f.userId.equals(userId);
                        });
                        if (!friendship) return [3 /*break*/, 2];
                        friendship.conversationId = conversationId;
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    // Add a method to get a friend's conversation
    getFriendConversation: function (userId) {
        var _a;
        var friendship = (_a = this.friends) === null || _a === void 0 ? void 0 : _a.find(function (f) {
            return f.userId.equals(userId);
        });
        return (friendship === null || friendship === void 0 ? void 0 : friendship.conversationId) || null;
    },
    blockUser: function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var friendship;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        friendship = (_a = this.friends) === null || _a === void 0 ? void 0 : _a.find(function (f) {
                            return f.userId.equals(userId);
                        });
                        if (!friendship) {
                            this.friends.push({
                                userId: userId,
                                status: "blocked",
                                blockedBy: this._id,
                                createdAt: new Date(),
                            });
                        }
                        else {
                            friendship.status = "blocked";
                            friendship.blockedBy = this._id;
                        }
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Conversation management
    updateConversationStatus: function (conversationId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        conversation = (_a = this.recentConversations) === null || _a === void 0 ? void 0 : _a.find(function (c) {
                            return c.conversationId.equals(conversationId);
                        });
                        if (!conversation) {
                            this.recentConversations.push({
                                conversationId: conversationId,
                                unreadCount: 0,
                                isPinned: false,
                                isMuted: false,
                            });
                        }
                        else {
                            Object.assign(conversation, updates);
                        }
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Chat settings
    updateChatSettings: function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.chatSettings = __assign(__assign({}, this.chatSettings), settings);
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Mute conversation
    muteConversation: function (conversationId, duration) {
        return __awaiter(this, void 0, void 0, function () {
            var mutedUntil, existingMute;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mutedUntil = duration ? new Date(Date.now() + duration) : undefined;
                        if (!this.mutedConversations) {
                            this.mutedConversations = [];
                        }
                        existingMute = this.mutedConversations.find(function (mute) {
                            return mute.conversationId.equals(conversationId);
                        });
                        if (existingMute) {
                            existingMute.mutedUntil = mutedUntil;
                        }
                        else {
                            this.mutedConversations.push({ conversationId: conversationId, mutedUntil: mutedUntil });
                        }
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Pin/Unpin conversation
    togglePinConversation: function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var isPinned;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.pinnedConversations) {
                            this.pinnedConversations = [];
                        }
                        isPinned = this.pinnedConversations.some(function (id) {
                            return id.equals(conversationId);
                        });
                        if (isPinned) {
                            this.pinnedConversations = this.pinnedConversations.filter(function (id) { return !id.equals(conversationId); });
                        }
                        else {
                            this.pinnedConversations.push(conversationId);
                        }
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
    // Check if conversation is muted
    isConversationMuted: function (conversationId) {
        var _a;
        var mute = (_a = this.mutedConversations) === null || _a === void 0 ? void 0 : _a.find(function (m) {
            return m.conversationId.equals(conversationId);
        });
        if (!mute)
            return false;
        if (!mute.mutedUntil)
            return true;
        return mute.mutedUntil > new Date();
    },
    // Get friend status
    getFriendStatus: function (userId) {
        var _a;
        var friend = (_a = this.friends) === null || _a === void 0 ? void 0 : _a.find(function (f) {
            return f.userId.equals(userId);
        });
        return (friend === null || friend === void 0 ? void 0 : friend.status) || null;
    },
    // Bookmark management
    bookmarkMessage: function (messageId, conversationId, note) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!((_a = this.bookmarkedMessages) === null || _a === void 0 ? void 0 : _a.some(function (b) {
                            return b.messageId.equals(messageId);
                        }))) return [3 /*break*/, 2];
                        if (!this.bookmarkedMessages)
                            this.bookmarkedMessages = [];
                        this.bookmarkedMessages.push({
                            messageId: messageId,
                            conversationId: conversationId,
                            bookmarkedAt: new Date(),
                            note: note,
                        });
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    removeBookmark: function (messageId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.bookmarkedMessages) return [3 /*break*/, 2];
                        this.bookmarkedMessages = this.bookmarkedMessages.filter(function (b) {
                            return !b.messageId.equals(messageId);
                        });
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    updateBookmarkNote: function (messageId, note) {
        return __awaiter(this, void 0, void 0, function () {
            var bookmark;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        bookmark = (_a = this.bookmarkedMessages) === null || _a === void 0 ? void 0 : _a.find(function (b) { return b.messageId.equals(messageId); });
                        if (!bookmark) return [3 /*break*/, 2];
                        bookmark.note = note;
                        return [4 /*yield*/, this.save({ validateBeforeSave: false })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
};
// Statics
UserSchema.statics = {
    // Find by email (either regular or university)
    findByEmail: function (email) {
        return this.findOne({
            $or: [{ email: email }, { universityEmail: email }],
        });
    },
    // Find online users
    findOnlineUsers: function () {
        return this.find({ status: "online" }).select("name status");
    },
    // Find users with active chat status
    findActiveUsers: function () {
        return this.find({
            status: { $in: ["online", "idle"] },
        }).select("name status lastSeen");
    },
    // Find user's friends
    findFriends: function (userId) {
        return this.findOne({ _id: userId })
            .populate({
            path: "friends.userId",
            match: { "friends.status": "accepted" },
            select: "name profilePicture status",
        })
            .select("friends");
    },
    findRecentConversations: function (userId) {
        return this.findOne({ _id: userId })
            .populate({
            path: "recentConversations.conversationId",
            populate: {
                path: "lastMessage",
                select: "content createdAt",
            },
        })
            .select("recentConversations")
            .sort({ "recentConversations.lastMessage.createdAt": -1 });
    },
    findBookmarkedMessages: function (userId) {
        return this.findOne({ _id: userId })
            .populate({
            path: "bookmarkedMessages.messageId",
            select: "content attachments senderId createdAt",
        })
            .populate({
            path: "bookmarkedMessages.conversationId",
            select: "name type",
        })
            .select("bookmarkedMessages")
            .sort({ "bookmarkedMessages.bookmarkedAt": -1 });
    },
};
exports.default = (0, mongoose_1.model)("Users", UserSchema);
