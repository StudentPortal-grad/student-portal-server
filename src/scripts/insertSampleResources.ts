import mongoose from "mongoose";
import dotenv from "dotenv";
import Resource from "../models/Resource";

// Load environment variables
dotenv.config({ path: "./.env" });

const CREATOR_ID = "67fc0dabf765eebf6b441b55";

const insertSampleResources = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.DB_URI;
        if (!mongoUri) {
            console.error("DB_URI not found in environment variables.");
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully.");

        // Sample Resource Data
        const sampleResources = [
            {
                title: "Complete Python Programming Guide",
                description: "Comprehensive guide covering Python fundamentals, data structures, OOP, and advanced topics. Perfect for beginners and intermediate programmers.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/pdf",
                originalFileName: "python_programming_guide.pdf",
                checksum: "a1b2c3d4e5f6",
                fileSize: 2500000,
                tags: ["python", "programming", "tutorial", "beginner"],
                visibility: "public",
                category: "Programming",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 45,
                    views: 123
                }
            },
            {
                title: "Data Structures and Algorithms Cheat Sheet",
                description: "Quick reference for common data structures and algorithms with time complexity analysis and implementation examples.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/pdf",
                originalFileName: "dsa_cheat_sheet.pdf",
                checksum: "b2c3d4e5f6g7",
                fileSize: 1800000,
                tags: ["algorithms", "data-structures", "computer-science", "reference"],
                visibility: "public",
                category: "Computer Science",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 67,
                    views: 189
                }
            },
            {
                title: "Calculus Formula Reference",
                description: "Essential calculus formulas including derivatives, integrals, and series. Organized by topic for easy reference during exams.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/pdf",
                originalFileName: "calculus_formulas.pdf",
                checksum: "c3d4e5f6g7h8",
                fileSize: 1200000,
                tags: ["calculus", "mathematics", "formulas", "reference"],
                visibility: "public",
                category: "Mathematics",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 89,
                    views: 234
                }
            },
            {
                title: "Web Development Project Template",
                description: "Starter template for full-stack web applications using React, Node.js, and MongoDB. Includes authentication and basic CRUD operations.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "other",
                mimeType: "application/zip",
                originalFileName: "web_dev_template.zip",
                checksum: "d4e5f6g7h8i9",
                fileSize: 5600000,
                tags: ["web-development", "react", "nodejs", "template"],
                visibility: "public",
                category: "Web Development",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 34,
                    views: 98
                }
            },
            {
                title: "Research Paper Writing Guide",
                description: "Step-by-step guide for writing academic research papers including structure, citation styles, and common mistakes to avoid.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/pdf",
                originalFileName: "research_paper_guide.pdf",
                checksum: "e5f6g7h8i9j0",
                fileSize: 3200000,
                tags: ["research", "academic-writing", "papers", "guide"],
                visibility: "public",
                category: "Academic Writing",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 76,
                    views: 167
                }
            },
            {
                title: "Digital Marketing Strategy Presentation",
                description: "Comprehensive presentation covering social media marketing, SEO, content marketing, and analytics. Includes case studies and practical examples.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/vnd.ms-powerpoint",
                originalFileName: "digital_marketing_strategy.pptx",
                checksum: "f6g7h8i9j0k1",
                fileSize: 8900000,
                tags: ["marketing", "digital-marketing", "seo", "social-media"],
                visibility: "public",
                category: "Marketing",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 52,
                    views: 145
                }
            },
            {
                title: "Machine Learning Algorithms Overview",
                description: "Visual guide to popular machine learning algorithms with use cases, pros/cons, and implementation notes. Great for ML beginners.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "image",
                mimeType: "image/png",
                originalFileName: "ml_algorithms_infographic.png",
                checksum: "g7h8i9j0k1l2",
                fileSize: 4300000,
                tags: ["machine-learning", "ai", "algorithms", "infographic"],
                visibility: "public",
                category: "Machine Learning",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 91,
                    views: 276
                }
            },
            {
                title: "Financial Planning Spreadsheet Template",
                description: "Excel template for personal financial planning including budget tracking, expense categories, and investment planning tools.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/vnd.ms-excel",
                originalFileName: "financial_planning_template.xlsx",
                checksum: "h8i9j0k1l2m3",
                fileSize: 1500000,
                tags: ["finance", "budgeting", "planning", "excel"],
                visibility: "public",
                category: "Finance",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 28,
                    views: 87
                }
            },
            {
                title: "Psychology Study Notes - Cognitive Behavior",
                description: "Detailed study notes covering cognitive behavioral theories, key researchers, and experimental findings. Includes diagrams and summaries.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "document",
                mimeType: "application/pdf",
                originalFileName: "psychology_cognitive_behavior.pdf",
                checksum: "i9j0k1l2m3n4",
                fileSize: 2800000,
                tags: ["psychology", "cognitive-behavior", "study-notes", "theory"],
                visibility: "public",
                category: "Psychology",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 63,
                    views: 154
                }
            },
            {
                title: "Photography Techniques Video Tutorial",
                description: "Video tutorial covering composition, lighting, and post-processing techniques for digital photography. Suitable for beginners to intermediate level.",
                fileUrl: "https://collection.cloudinary.com/dkmo7c9hr/b28aa2a5b6c37f47d60fee8a5abc5ffd",
                fileType: "video",
                mimeType: "video/mp4",
                originalFileName: "photography_techniques_tutorial.mp4",
                checksum: "j0k1l2m3n4o5",
                fileSize: 45000000,
                tags: ["photography", "tutorial", "composition", "lighting"],
                visibility: "public",
                category: "Photography",
                uploader: CREATOR_ID,
                interactionStats: {
                    downloads: 19,
                    views: 78
                }
            }
        ];

        // Insert Resources
        console.log("Inserting sample resources...");
        const insertedResources = await Resource.insertMany(sampleResources);
        console.log(`Successfully inserted ${insertedResources.length} resources.`);

        console.log("Sample resource insertion completed successfully!");

    } catch (error) {
        console.error("An error occurred during sample data insertion:", error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
};

// Run the script
insertSampleResources();
