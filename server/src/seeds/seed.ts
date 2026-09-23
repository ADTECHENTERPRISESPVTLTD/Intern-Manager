import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';
import { InternProfile } from '../models/InternProfile';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { UserRole, UserStatus, ProjectStatus, TaskPriority, TaskStatus, InternshipStatus } from '../constants';

const seed = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB. Resetting collections...');

  await User.deleteMany({});
  await InternProfile.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});

  // 1. Create Admin
  const admin = await User.create({
    name: 'Adarsh Gangshettiwar',
    email: 'admin@adtech.local',
    password: 'AdminPass123!',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  // 2. Define All Team Members
  const teamMembers = [
    {
      name: 'Adarsh Gangshettiwar',
      email: 'adarsh@adtech.local',
      designation: 'Lead Backend Developer',
      skills: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'REST APIs', 'JWT', 'System Architecture'],
      department: 'Backend Engineering',
      tasks: [
        {
          title: 'TASK-01: Official Website Backend Module Development',
          description: 'Build core modular REST APIs for authentication, profiles, and attendance tracking.',
          priority: TaskPriority.CRITICAL,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-02: Final Backend Completion, Security & Admin Management',
          description: 'Implement audit logging, role-based authorization, rate limiting, and admin management endpoints.',
          priority: TaskPriority.CRITICAL,
          status: TaskStatus.IN_PROGRESS,
          progress: 85,
        },
        {
          title: 'TASK-02 (Project 2): Restaurant Management System Full Stack Prototype',
          description: 'Develop full stack prototype with order processing, menu management, and real-time alerts.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 50,
        },
        {
          title: 'MediFlow Project',
          description: 'Healthcare management API prototype for appointment scheduling and record tracking.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.NOT_STARTED,
          progress: 0,
        },
      ],
    },
    {
      name: 'Akanksha Hajare',
      email: 'akanksha@adtech.local',
      designation: 'DevOps & Deployment Engineer / Frontend Developer',
      skills: ['React', 'AWS', 'DevOps', 'Cloud', 'Linux', 'Deployment', 'Vite', 'Tailwind/CSS'],
      department: 'DevOps & Web Platforms',
      tasks: [
        {
          title: 'TASK-01: DevOps, Deployment & Release Management (Vercel & Render Setup)',
          description: 'Setup Render backend CI/CD pipelines, Vercel frontend automation, environment isolation, and production domain configs.',
          priority: TaskPriority.CRITICAL,
          status: TaskStatus.IN_PROGRESS,
          progress: 75,
        },
      ],
    },
    {
      name: 'Soham Amne',
      email: 'soham@adtech.local',
      designation: 'AI Lead',
      skills: ['Python', 'OpenCV', 'PyTorch', 'Face Verification', 'NLP', 'AI Video', 'Flask'],
      department: 'AI & Machine Learning',
      tasks: [
        {
          title: 'TASK-01: AI Chatbot Integration & Knowledge Assistant',
          description: 'Develop conversational knowledge assistant with retrieval augmented context.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-02: Asha – AI Voice Assistant Integration',
          description: 'Integrate real-time speech synthesis and acoustic voice agent.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 65,
        },
        {
          title: 'TASK-03: Restaurant Food Recommendation Engine',
          description: 'Design collaborative filtering and sentiment-driven recommendation service.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.NOT_STARTED,
          progress: 0,
        },
        {
          title: 'TASK-04: AI Video Advertisement Creation',
          description: 'Generate synthetic marketing assets and promotional video clips.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.IN_PROGRESS,
          progress: 40,
        },
        {
          title: 'TASK-05: Kuchu Puchu × Kakde Restaurant Trending Reel',
          description: 'Produce high engagement multimedia viral reel for partner restaurant.',
          priority: TaskPriority.LOW,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
      ],
    },
    {
      name: 'Prajakta Dixit',
      email: 'prajakta@adtech.local',
      designation: 'Lead Frontend Developer',
      skills: ['React', 'Frontend Architecture', 'Python', 'AI Integration', 'Cyber Security'],
      department: 'Frontend Engineering',
      tasks: [
        {
          title: 'TASK-01: Lead Frontend Development & Website Architecture',
          description: 'Establish enterprise UI design system, navigation hierarchy, and layout consistency.',
          priority: TaskPriority.CRITICAL,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-02: Final Website Completion & Architecture Consolidation',
          description: 'Consolidate shared UI components, responsive audits, and cross-browser stabilization.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 70,
        },
      ],
    },
    {
      name: 'Yuragi Zode',
      email: 'yuragi@adtech.local',
      designation: 'Full Stack Developer',
      skills: ['Full Stack', 'React', 'Node.js', 'AI Integration', 'Python', 'UI/UX'],
      department: 'Full Stack Engineering',
      tasks: [
        {
          title: 'TASK-01: Official Website Backend Foundation Architecture Blueprint',
          description: 'Architect foundational server routes, schemas, and request lifecycles.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-02: Official Website Portal Integration & Frontend Development',
          description: 'Integrate interactive features into user portal and client facing modules.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 80,
        },
        {
          title: 'TASK-03: Hero Section Redesign & Premium UI Enhancement',
          description: 'Elevate landing page hero section with high-tier dark SaaS aesthetics and responsive ergonomics.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
      ],
    },
    {
      name: 'Aadya Dixit',
      email: 'aadya@adtech.local',
      designation: 'Frontend Developer',
      skills: ['HTML', 'CSS', 'JavaScript', 'Python', 'Data Analysis', 'Responsive Design'],
      department: 'Frontend Engineering',
      tasks: [
        {
          title: 'TASK-01: Frontend Components & Career Module',
          description: 'Build modern responsive career portal with dynamic opening filters.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-02: Mobile Voice Assistant Bug Fix & Real Device Testing',
          description: 'Audit mobile device audio capture constraints and resolve Safari/Android webview bugs.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 60,
        },
        {
          title: 'TASK-03: AI-Powered Responsive Chatbot',
          description: 'Create responsive floating chatbot widget with markdown and code block support.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 75,
        },
        {
          title: 'TASK-04: Express.js Learning & Implementation',
          description: 'Implement foundational microservice routes and parameter validation.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
        {
          title: 'TASK-05: Database & MongoDB Learning Task',
          description: 'Study Mongoose indexing, aggregation pipelines, and document schema optimization.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.IN_PROGRESS,
          progress: 50,
        },
      ],
    },
    {
      name: 'Kalyani Velukar',
      email: 'kalyani@adtech.local',
      designation: 'Backend Developer',
      skills: ['Java', 'Spring Boot', 'REST APIs', 'MySQL', 'Node.js', 'Microservices'],
      department: 'Backend Engineering',
      tasks: [
        {
          title: 'TASK-01: Intern Management System Backend Development',
          description: 'Collaborate on session tracking services, attendance rollups, and reporting models.',
          priority: TaskPriority.HIGH,
          status: TaskStatus.IN_PROGRESS,
          progress: 70,
        },
        {
          title: 'TASK-02: MERN Foundation Learning Program',
          description: 'Complete hands-on enterprise full-stack development coursework.',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.COMPLETED,
          progress: 100,
        },
      ],
    },
  ];

  // 3. Projects
  const projectPlatform = await Project.create({
    name: 'Intern Management Platform',
    description: 'Enterprise internal management platform for AD TECH interns, work sessions, presence verification, and performance evaluation.',
    team: [],
    technologyStack: ['React', 'Vite', 'Node.js', 'Express', 'TypeScript', 'MongoDB', 'Python YuNet/SFace'],
    status: ProjectStatus.ACTIVE,
    createdBy: admin._id,
  });

  const projectWebsite = await Project.create({
    name: 'Official AD TECH Website & Portal',
    description: 'Corporate client-facing portal, services catalog, and dynamic career engine.',
    team: [],
    technologyStack: ['React', 'TypeScript', 'Tailwind', 'Node.js'],
    status: ProjectStatus.ACTIVE,
    createdBy: admin._id,
  });

  const projectAI = await Project.create({
    name: 'AI Voice & Multimedia Suite',
    description: 'AI-driven voice assistant, conversational agents, and multimedia generation suite.',
    team: [],
    technologyStack: ['Python', 'PyTorch', 'OpenCV', 'FastAPI/Flask'],
    status: ProjectStatus.ACTIVE,
    createdBy: admin._id,
  });

  const allProjects = [projectPlatform, projectWebsite, projectAI];

  for (const m of teamMembers) {
    const user = await User.create({
      name: m.name,
      email: m.email,
      password: 'Password123!',
      role: UserRole.INTERN,
      status: UserStatus.ACTIVE,
    });

    const internProfile = await InternProfile.create({
      userId: user._id,
      designation: m.designation,
      joiningDate: new Date('2026-09-01'),
      internshipDuration: '6 months',
      skills: m.skills,
      department: m.department,
      assignedProjects: [projectPlatform._id],
      internshipStatus: InternshipStatus.ACTIVE,
      bio: `${m.name} is working as ${m.designation} at AD TECH Enterprises.`,
    });

    // Seed tasks
    let taskIdx = 0;
    for (const t of m.tasks) {
      const assignedProj = allProjects[taskIdx % allProjects.length];
      await Task.create({
        title: t.title,
        description: t.description,
        assignedTo: user._id,
        projectId: assignedProj._id,
        priority: t.priority,
        status: t.status,
        progress: t.progress,
        createdBy: admin._id,
        requirements: ['Code quality review', 'Clean commits on dedicated feature branch', 'Documentation update'],
        resources: ['https://drive.google.com/drive/folders/adtech-intern-resources'],
        deadline: new Date('2026-09-24T19:00:00.000Z'),
      });
      taskIdx++;
    }
  }

  console.log(`Successfully seeded ${teamMembers.length} intern profiles with complete initial tasks and projects.`);
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
