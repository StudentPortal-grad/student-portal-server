import { Socket } from "socket.io";
import { Types } from "mongoose";
import User from "@models/User";
import { SocketUtils } from "@utils/socketUtils";

/**
 * Handles all socket events related to search functionality
 */
export const handleSearchEvents = (socket: Socket) => {
    // Basic peer search
    socket.on("searchPeers", async (data, _callback) => {
        try {
            // Use projection to get only needed fields
            const currentUser = await User.findById(socket.data.userId)
                .select("level")
                .lean();
                
            if (!currentUser) {
                socket.emit("peerSearchResults", { peers: [] });
                return;
            }

            // Create optimized query with index-friendly conditions
            const query: any = {
                _id: { $ne: socket.data.userId },
                role: "student",
                $or: [
                    { signupStep: "completed" },
                    { signupStep: "verified" },
                ],
                isGraduated: false,
                level: currentUser.level,
            };
            
            // Add text search if query provided
            if (data.query) {
                // Use text index if available, otherwise use regex
                if (data.query.length > 2) {
                    query.$or = [
                        ...query.$or,
                        { name: { $regex: data.query, $options: "i" } },
                        { username: { $regex: data.query, $options: "i" } },
                        { universityEmail: { $regex: data.query, $options: "i" } },
                    ];
                }
            }

            // Use projection and lean for better performance
            const peers = await User.find(query)
                .select("name username profilePicture level status lastSeen college gpa profile.bio profile.interests")
                .limit(20)
                .lean();

            SocketUtils.emitSuccess(socket, "peerSearchResults", { peers });
        } catch (error) {
            console.error("Error searching peers:", error);
            SocketUtils.emitError(socket, "peerSearchResults", "Failed to search peers");
        }
    });

    // Advanced peer search with filters
    socket.on("searchPeersByFilter", async (data, _callback) => {
        try {
            // Create base query with index-friendly conditions
            const baseQuery = {
                _id: { $ne: socket.data.userId },
                role: "student",
                signupStep: "completed",
                isGraduated: false,
            };

            // Add filters conditionally to optimize query
            const filterQuery: any = { ...baseQuery };
            
            // Add university filter (high selectivity)
            if (data.university) {
                filterQuery.university = data.university;
            }
            
            // Add level filter (medium selectivity)
            if (data.level) {
                filterQuery.level = data.level;
            }
            
            // Add gender filter (low selectivity)
            if (data.gender) {
                filterQuery.gender = data.gender;
            }
            
            // Add GPA range filter
            if (data.gpaRange && data.gpaRange.min !== undefined && data.gpaRange.max !== undefined) {
                filterQuery.gpa = {
                    $gte: data.gpaRange.min,
                    $lte: data.gpaRange.max,
                };
            }
            
            // Add interests filter
            if (data.interests && Array.isArray(data.interests) && data.interests.length > 0) {
                filterQuery["profile.interests"] = { $in: data.interests };
            }
            
            // Add graduation year filter
            if (data.graduationYear) {
                filterQuery.graduationYear = data.graduationYear;
            }
            
            // Add text search if query provided
            if (data.query && data.query.length > 2) {
                filterQuery.$or = [
                    { name: { $regex: data.query, $options: "i" } },
                    { username: { $regex: data.query, $options: "i" } },
                    { universityEmail: { $regex: data.query, $options: "i" } },
                ];
            }

            // Use projection, sorting and lean for better performance
            const peers = await User.find(filterQuery)
                .select("name username profilePicture gender level status lastSeen college university gpa graduationYear profile.bio profile.interests")
                .sort({ level: 1, gpa: -1, name: 1 })
                .limit(20)
                .lean();

            SocketUtils.emitSuccess(socket, "peerSearchResults", { peers });
        } catch (error) {
            console.error("Error searching peers by filter:", error);
            SocketUtils.emitError(socket, "peerSearchResults", "Failed to search peers with filters");
        }
    });

    // Recommended peers based on profile similarity
    socket.on("searchRecommendedPeers", async (_data, _callback) => {
        try {
            // Get only needed user fields
            const currentUser = await User.findById(socket.data.userId)
                .select("university college level profile.interests")
                .lean();
                
            if (!currentUser) {
                SocketUtils.emitError(socket, "peerSearchResults", "User not found");
                return;
            }

            // Use caching hint for better performance
            const aggregationPipeline = [
                {
                    $match: {
                        _id: { $ne: new Types.ObjectId(socket.data.userId) },
                        role: "student",
                        signupStep: "completed",
                        isGraduated: false,
                        university: currentUser.university,
                        college: currentUser.college,
                        // Use $in for better index usage
                        level: {
                            $in: [
                                currentUser.level,
                                currentUser.level + 1,
                                currentUser.level - 1,
                            ],
                        },
                    },
                },
                {
                    // Use efficient $addFields to calculate similarity metrics
                    $addFields: {
                        commonInterests: {
                            $size: {
                                $setIntersection: [
                                    "$profile.interests",
                                    currentUser.profile?.interests || [],
                                ],
                            },
                        },
                        levelDiff: {
                            $abs: { $subtract: ["$level", currentUser.level] },
                        },
                    },
                },
                {
                    // Sort by calculated fields
                    $sort: {
                        commonInterests: -1,
                        levelDiff: 1,
                        gpa: -1,
                    },
                } as const,
                {
                    // Project only needed fields
                    $project: {
                        name: 1,
                        username: 1,
                        profilePicture: 1,
                        gender: 1,
                        level: 1,
                        status: 1,
                        lastSeen: 1,
                        college: 1,
                        gpa: 1,
                        "profile.bio": 1,
                        "profile.interests": 1,
                        commonInterests: 1,
                    },
                } as const,
                { $limit: 20 } as const,
            ];

            const recommendations = await User.aggregate(aggregationPipeline);

            SocketUtils.emitSuccess(socket, "peerSearchResults", { peers: recommendations });
        } catch (error) {
            console.error("Error searching recommended peers:", error);
            SocketUtils.emitError(socket, "peerSearchResults", "Failed to get recommendations");
        }
    });
};
