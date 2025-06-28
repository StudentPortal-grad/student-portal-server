import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "../models/Event";
import Discussion from "../models/Discussion";

// Load environment variables
dotenv.config({ path: "./.env" });

const CREATOR_ID = "67fc0dabf765eebf6b441b55";

const insertSampleData = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.DB_URI;
        if (!mongoUri) {
            console.error("DB_URI not found in environment variables.");
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully.");

        // Sample Event Data
        const sampleEvents = [
            {
                title: "Tech Innovation Workshop",
                description: "Join us for an exciting workshop on the latest tech innovations, featuring hands-on coding sessions and industry insights.",
                startDate: new Date("2025-07-15T10:00:00Z"),
                endDate: new Date("2025-07-15T16:00:00Z"),
                location: "University Tech Hub, Building A",
                eventImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
                capacity: 50,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Study Group - Advanced Mathematics",
                description: "Weekly study sessions for calculus and linear algebra. Bring your questions and let's solve problems together!",
                startDate: new Date("2025-07-20T14:00:00Z"),
                endDate: new Date("2025-07-20T17:00:00Z"),
                location: "Library Study Room 201",
                eventImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=600&fit=crop",
                capacity: 15,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Campus Food Festival",
                description: "Experience diverse cuisines from around the world! Local vendors, student food trucks, and cooking demonstrations.",
                startDate: new Date("2025-08-05T11:00:00Z"),
                endDate: new Date("2025-08-05T19:00:00Z"),
                location: "Central Campus Quad",
                eventImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop",
                capacity: 200,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Photography Workshop: Nature & Wildlife",
                description: "Learn professional photography techniques with a focus on capturing nature and wildlife. Equipment provided.",
                startDate: new Date("2025-07-25T08:00:00Z"),
                endDate: new Date("2025-07-25T18:00:00Z"),
                location: "Botanical Gardens & Nature Reserve",
                eventImage: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800&h=600&fit=crop",
                capacity: 25,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Entrepreneurship Networking Night",
                description: "Connect with fellow entrepreneurs, investors, and industry leaders. Pitch your ideas and build valuable connections.",
                startDate: new Date("2025-08-10T18:00:00Z"),
                endDate: new Date("2025-08-10T22:00:00Z"),
                location: "Business School Auditorium",
                eventImage: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=600&fit=crop",
                capacity: 100,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Gaming Tournament: Esports Championship",
                description: "Competitive gaming tournament featuring popular titles. Prizes for winners and fun for all skill levels!",
                startDate: new Date("2025-08-15T13:00:00Z"),
                endDate: new Date("2025-08-15T21:00:00Z"),
                location: "Student Center Gaming Lounge",
                eventImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop",
                capacity: 80,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Art Exhibition: Student Showcase",
                description: "Showcasing incredible artwork from talented students across various mediums including painting, sculpture, and digital art.",
                startDate: new Date("2025-09-01T10:00:00Z"),
                endDate: new Date("2025-09-01T20:00:00Z"),
                location: "Art Gallery, Fine Arts Building",
                eventImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop",
                capacity: 150,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Fitness Bootcamp Challenge",
                description: "High-intensity workout session designed to challenge your limits. All fitness levels welcome with modifications available.",
                startDate: new Date("2025-07-30T06:00:00Z"),
                endDate: new Date("2025-07-30T08:00:00Z"),
                location: "Campus Recreation Center",
                eventImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
                capacity: 30,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Environmental Awareness Seminar",
                description: "Learn about sustainability practices, climate change solutions, and how students can make a positive environmental impact.",
                startDate: new Date("2025-08-20T15:00:00Z"),
                endDate: new Date("2025-08-20T18:00:00Z"),
                location: "Environmental Science Building, Lecture Hall 1",
                eventImage: "https://images.unsplash.com/photo-1569163139394-de4e4f43e4e5?w=800&h=600&fit=crop",
                capacity: 75,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            },
            {
                title: "Music Concert: Acoustic Night",
                description: "Intimate acoustic performances by local musicians and student artists. Great atmosphere for music lovers.",
                startDate: new Date("2025-09-05T19:00:00Z"),
                endDate: new Date("2025-09-05T23:00:00Z"),
                location: "Campus Coffee House",
                eventImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
                capacity: 60,
                visibility: "public",
                creatorId: CREATOR_ID,
                status: "upcoming"
            }
        ];

        // Sample Discussion Data
        const sampleDiscussions = [
            {
                title: "Best Study Techniques for Finals Week",
                content: "Finals are approaching and I'm looking for effective study methods that have worked for others. What are your go-to strategies for retaining information and managing stress during exam period? I've tried the Pomodoro technique but looking for more ideas!",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "study_tips.jpg",
                    fileSize: 245000,
                    checksum: "abc123def456"
                }],
                status: "open"
            },
            {
                title: "Looking for Project Partners - Web Development",
                content: "I'm working on a full-stack web application using React and Node.js for my capstone project. Looking for 2-3 motivated partners who are interested in building something amazing together. Experience with JavaScript, databases, and version control preferred but not required if you're eager to learn!",
                creator: CREATOR_ID,
                attachments: [{
                    type: "document",
                    resource: "https://images.unsplash.com/photo-1555066931-4439ae84a86c?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "web_dev_mockup.jpg",
                    fileSize: 189000,
                    checksum: "def789ghi012"
                }],
                status: "open"
            },
            {
                title: "Campus Food Recommendations",
                content: "New student here! What are the best places to eat on and around campus? I'm particularly interested in vegetarian options and places that are budget-friendly. Also, which dining halls have the best variety?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "campus_food.jpg",
                    fileSize: 320000,
                    checksum: "ghi345jkl678"
                }],
                status: "open"
            },
            {
                title: "Anyone Interested in Starting a Book Club?",
                content: "I love reading and would like to start a book club where we can discuss fiction, non-fiction, and maybe some academic texts related to our studies. We could meet bi-weekly and choose books democratically. Who's interested? What genres would you like to explore?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "book_club.jpg",
                    fileSize: 278000,
                    checksum: "jkl901mno234"
                }],
                status: "open"
            },
            {
                title: "Git and GitHub Best Practices",
                content: "For those working on coding projects, what are your best practices for using Git and GitHub? I keep running into merge conflicts and my commit history is a mess. Any tips for maintaining clean repositories and effective collaboration workflows?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "document",
                    resource: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "git_workflow.jpg",
                    fileSize: 156000,
                    checksum: "mno567pqr890"
                }],
                status: "open"
            },
            {
                title: "Internship Application Tips",
                content: "I'm applying for summer internships and feeling overwhelmed by the process. What should I include in my resume? How do I prepare for technical interviews? Any advice on following up after applications? Would love to hear about your experiences and what worked for you!",
                creator: CREATOR_ID,
                attachments: [{
                    type: "document",
                    resource: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "internship_prep.jpg",
                    fileSize: 234000,
                    checksum: "pqr123stu456"
                }],
                status: "open"
            },
            {
                title: "Campus Gym Equipment and Schedule",
                content: "What's the current situation with the campus gym? Are all equipment areas fully operational? I'm particularly interested in the weight room and cardio machines. Also, what are the peak hours I should avoid if I want to have access to equipment?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "gym_equipment.jpg",
                    fileSize: 367000,
                    checksum: "stu789vwx012"
                }],
                status: "open"
            },
            {
                title: "Mental Health Resources and Support",
                content: "Mental health is important, especially during stressful academic periods. What resources are available on campus for students who need support? Are there counseling services, support groups, or wellness programs that you'd recommend?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "mental_health.jpg",
                    fileSize: 198000,
                    checksum: "vwx345yza678"
                }],
                status: "open"
            },
            {
                title: "Programming Language Learning Path",
                content: "I'm trying to decide which programming language to focus on next. I have experience with Python and some JavaScript. Should I go deeper into web development with React/Node, explore mobile development, or try something completely different like Rust or Go? What's your learning journey been like?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "programming_languages.jpg",
                    fileSize: 289000,
                    checksum: "yza901bcd234"
                }],
                status: "open"
            },
            {
                title: "Campus Events Worth Attending",
                content: "There are so many events happening on campus! Which ones do you think are actually worth attending? I'm interested in networking opportunities, skill-building workshops, and fun social events. What events have you found most valuable or enjoyable?",
                creator: CREATOR_ID,
                attachments: [{
                    type: "image",
                    resource: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop",
                    mimeType: "image/jpeg",
                    originalFileName: "campus_events.jpg",
                    fileSize: 412000,
                    checksum: "bcd567efg890"
                }],
                status: "open"
            }
        ];

        // Insert Events
        console.log("Inserting sample events...");
        const insertedEvents = await Event.insertMany(sampleEvents);
        console.log(`Successfully inserted ${insertedEvents.length} events.`);

        // Insert Discussions
        console.log("Inserting sample discussions...");
        const insertedDiscussions = await Discussion.insertMany(sampleDiscussions);
        console.log(`Successfully inserted ${insertedDiscussions.length} discussions.`);

        console.log("Sample data insertion completed successfully!");
        console.log(`Total documents inserted: ${insertedEvents.length + insertedDiscussions.length}`);

    } catch (error) {
        console.error("An error occurred during sample data insertion:", error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
};

// Run the script
insertSampleData();
