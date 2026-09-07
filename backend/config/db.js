const { Pool } = require("pg");
require("dotenv").config();

let realPool = null;
const hasDbConfig = Boolean(process.env.DATABASE_URL || process.env.DB_HOST);

if (hasDbConfig) {
    try {
        realPool = new Pool(
            process.env.DATABASE_URL
                ? { connectionString: process.env.DATABASE_URL }
                : {
                      host: process.env.DB_HOST,
                      port: process.env.DB_PORT || 5432,
                      database: process.env.DB_NAME,
                      user: process.env.DB_USER,
                      password: process.env.DB_PASSWORD,
                  }
        );
    } catch (err) {
        console.warn("[Learnova DB] Could not initialize real PostgreSQL Pool:", err.message);
        realPool = null;
    }
}

// In-memory store used when PostgreSQL is offline or unconfigured
const memoryStore = {
    students: [],
    instructors: [
        {
            i_id: 1,
            first_name: "Dr. Sarah",
            last_name: "Connor",
            email: "sarah@learnova.edu",
            password: "$2a$10$abcdefghijklmnopqrstuu",
            institution: "Learnova Academy",
            qualification: "Ph.D. Computer Science"
        }
    ],
    categories: [
        { id: 1, name: "Computer Science", availability: true },
        { id: 2, name: "Web Development", availability: true },
        { id: 3, name: "Data Science", availability: true }
    ],
    courses: [
        {
            courseid: 1,
            title: "Modern Web Development",
            description: "Master full-stack web applications with modern architecture and RESTful APIs.",
            price: "49.99",
            instructor_id: 1,
            category_id: 2,
            instructor_name: "Dr. Sarah Connor",
            category_name: "Web Development",
            enrolled_count: "12",
            created_at: new Date().toISOString()
        },
        {
            courseid: 2,
            title: "Relational Database Design & SQL",
            description: "Learn schema normalization, relational algebra, and optimized SQL querying.",
            price: "29.99",
            instructor_id: 1,
            category_id: 1,
            instructor_name: "Dr. Sarah Connor",
            category_name: "Computer Science",
            enrolled_count: "8",
            created_at: new Date().toISOString()
        }
    ],
    modules: [
        { id: 1, courseid: 1, title: "Introduction & Architecture", order_number: 1 },
        { id: 2, courseid: 1, title: "Building REST Services", order_number: 2 }
    ],
    lessons: [
        { id: 1, module_id: 1, title: "Course Overview & Setup", video_url: "", is_preview: true, order_number: 1, resources: [] },
        { id: 2, module_id: 1, title: "Routing and Request Pipeline", video_url: "", is_preview: false, order_number: 2, resources: [] }
    ],
    resources: [],
    exams: [],
    enrollments: [],
    discussions: [
        {
            id: 1,
            courseid: 1,
            lesson_id: 1,
            title: "Question about primary keys in PostgreSQL",
            content: "Can a primary key be composed of multiple columns (composite key)?",
            author_role: "student",
            student_id: 1,
            instructor_id: null,
            author_name: "Zabir Hasan",
            lesson_title: "Course Overview & Setup",
            created_at: new Date().toISOString()
        }
    ],
    discussion_replies: [
        {
            id: 1,
            discussion_id: 1,
            content: "Yes! You can define a composite primary key using PRIMARY KEY (col1, col2).",
            author_role: "instructor",
            student_id: null,
            instructor_id: 1,
            author_name: "Dr. Sarah Connor",
            is_instructor_answer: true,
            created_at: new Date().toISOString()
        }
    ]
};

let autoIds = {
    students: 1,
    instructors: 2,
    courses: 3,
    modules: 3,
    lessons: 3,
    enrollments: 1,
    discussions: 2,
    discussion_replies: 2
};

async function executeMockQuery(sql, params = []) {
    const cleanSql = sql.replace(/\s+/g, " ").trim();
    const upper = cleanSql.toUpperCase();

    // 1. Check existing student by email
    if (upper.includes("FROM STUDENTS") && upper.includes("WHERE EMAIL = $1")) {
        const found = memoryStore.students.filter(s => s.email.toLowerCase() === (params[0] || "").toLowerCase());
        return { rows: found, rowCount: found.length };
    }

    // 2. Insert student
    if (upper.startsWith("INSERT INTO STUDENTS")) {
        const s_id = autoIds.students++;
        const newStudent = {
            s_id,
            first_name: params[0],
            last_name: params[1],
            email: params[2],
            password: params[3],
            institution: params[4] || null,
            dob: params[5] || null,
            status: "active",
            created_at: new Date().toISOString()
        };
        memoryStore.students.push(newStudent);
        return { rows: [{ s_id }], rowCount: 1 };
    }

    // 3. Check existing instructor by email
    if (upper.includes("FROM INSTRUCTORS") && upper.includes("WHERE EMAIL = $1")) {
        const found = memoryStore.instructors.filter(i => i.email.toLowerCase() === (params[0] || "").toLowerCase());
        return { rows: found, rowCount: found.length };
    }

    // 4. Insert instructor
    if (upper.startsWith("INSERT INTO INSTRUCTORS")) {
        const i_id = autoIds.instructors++;
        const newInstructor = {
            i_id,
            first_name: params[0],
            last_name: params[1],
            email: params[2],
            password: params[3],
            institution: params[4] || null,
            qualification: params[5] || null,
            created_at: new Date().toISOString()
        };
        memoryStore.instructors.push(newInstructor);
        return { rows: [{ i_id }], rowCount: 1 };
    }

    // 5. Get all courses
    if (upper.includes("FROM COURSES") && upper.includes("JOIN INSTRUCTORS")) {
        let list = memoryStore.courses;
        if (params.length > 0 && params[0]) {
            list = list.filter(c => String(c.category_id) === String(params[0]));
        }
        return { rows: list, rowCount: list.length };
    }

    // 6. Get course by ID
    if (upper.includes("FROM COURSES") && upper.includes("WHERE C.COURSEID = $1")) {
        const course = memoryStore.courses.find(c => String(c.courseid) === String(params[0]));
        return { rows: course ? [course] : [], rowCount: course ? 1 : 0 };
    }

    // 7. Get modules by courseid
    if (upper.includes("FROM MODULES") && upper.includes("WHERE COURSEID = $1")) {
        const modules = memoryStore.modules.filter(m => String(m.courseid) === String(params[0]));
        return { rows: modules, rowCount: modules.length };
    }

    // 8. Get lessons by module_id
    if (upper.includes("FROM LESSONS") && upper.includes("WHERE MODULE_ID = $1")) {
        const lessons = memoryStore.lessons.filter(l => String(l.module_id) === String(params[0]));
        return { rows: lessons, rowCount: lessons.length };
    }

    // 9. Categories
    if (upper.includes("FROM CATEGORIES")) {
        return { rows: memoryStore.categories, rowCount: memoryStore.categories.length };
    }

    // 10. Get discussions by course
    if (upper.includes("FROM DISCUSSIONS D") && upper.includes("WHERE D.COURSEID = $1")) {
        let list = memoryStore.discussions.filter(d => String(d.courseid) === String(params[0]));
        if (params.length > 1 && params[1]) {
            list = list.filter(d => String(d.lesson_id) === String(params[1]));
        }
        const enriched = list.map(d => {
            const replies = memoryStore.discussion_replies.filter(r => r.discussion_id === d.id);
            return { ...d, reply_count: replies.length };
        });
        return { rows: enriched, rowCount: enriched.length };
    }

    // 11. Get discussion by ID
    if (upper.includes("FROM DISCUSSIONS") && upper.includes("WHERE D.ID = $1")) {
        const found = memoryStore.discussions.find(d => String(d.id) === String(params[0]));
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    if (upper.includes("FROM DISCUSSIONS") && upper.includes("WHERE ID = $1")) {
        const found = memoryStore.discussions.find(d => String(d.id) === String(params[0]));
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    // 12. Insert discussion
    if (upper.startsWith("INSERT INTO DISCUSSIONS")) {
        const id = autoIds.discussions++;
        const newThread = {
            id,
            courseid: params[0],
            lesson_id: params[1] || null,
            title: params[2],
            content: params[3],
            author_role: params[4],
            student_id: params[5] || null,
            instructor_id: params[6] || null,
            author_name: params[4] === "student" ? "Enrolled Student" : "Course Instructor",
            created_at: new Date().toISOString()
        };
        memoryStore.discussions.push(newThread);
        return { rows: [newThread], rowCount: 1 };
    }

    // 13. Get replies for discussion
    if (upper.includes("FROM DISCUSSION_REPLIES") && upper.includes("WHERE R.DISCUSSION_ID = $1")) {
        const list = memoryStore.discussion_replies.filter(r => String(r.discussion_id) === String(params[0]));
        return { rows: list, rowCount: list.length };
    }

    // 14. Insert reply
    if (upper.startsWith("INSERT INTO DISCUSSION_REPLIES")) {
        const id = autoIds.discussion_replies++;
        const newReply = {
            id,
            discussion_id: Number(params[0]),
            content: params[1],
            author_role: params[2],
            student_id: params[3] || null,
            instructor_id: params[4] || null,
            is_instructor_answer: Boolean(params[5]),
            author_name: params[2] === "student" ? "Enrolled Student" : "Course Instructor",
            created_at: new Date().toISOString()
        };
        memoryStore.discussion_replies.push(newReply);
        return { rows: [newReply], rowCount: 1 };
    }

    // 15. Delete discussion
    if (upper.startsWith("DELETE FROM DISCUSSIONS WHERE ID = $1")) {
        memoryStore.discussions = memoryStore.discussions.filter(d => String(d.id) !== String(params[0]));
        memoryStore.discussion_replies = memoryStore.discussion_replies.filter(r => String(r.discussion_id) !== String(params[0]));
        return { rows: [], rowCount: 1 };
    }

    // 16. Delete reply
    if (upper.startsWith("DELETE FROM DISCUSSION_REPLIES WHERE ID = $1")) {
        memoryStore.discussion_replies = memoryStore.discussion_replies.filter(r => String(r.id) !== String(params[0]));
        return { rows: [], rowCount: 1 };
    }

    // 17. Default fallback
    return { rows: [], rowCount: 0 };
}

const pool = {
    query: async (text, params) => {
        if (realPool) {
            try {
                return await realPool.query(text, params);
            } catch (err) {
                console.warn("[Learnova DB] PostgreSQL query failed, using in-memory mock:", err.message);
            }
        }
        return executeMockQuery(text, params);
    },
    connect: async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {}
    }),
    on: (event, handler) => {
        if (realPool) realPool.on(event, handler);
    }
};

module.exports = pool;
