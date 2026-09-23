import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';
import { InternProfile } from '../models/InternProfile';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { UserRole, UserStatus, ProjectStatus, TaskPriority, TaskStatus } from '../constants';

const seed = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);

  await User.deleteMany({});
  await InternProfile.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});

  const admin = await User.create({
    name: 'Adarsh Gangshettiwar',
    email: 'admin@adtech.local',
    password: 'AdminPass123!',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const intern = await User.create({
    name: 'Adarsh Gangshettiwar',
    email: 'intern@adtech.local',
    password: 'InternPass123!',
    role: UserRole.INTERN,
    status: UserStatus.ACTIVE,
  });

  await InternProfile.create({
    userId: intern._id,
    designation: 'Backend Intern',
    joiningDate: new Date('2026-09-01'),
    internshipDuration: '6 months',
    skills: ['Node.js', 'TypeScript', 'MongoDB', 'REST APIs'],
    department: 'Ad Tech Engineering',
    internshipStatus: 'ACTIVE',
  });

  const projectOne = await Project.create({
    name: 'Official Website Backend Module',
    description: 'Internal backend module for the marketing website.',
    team: [intern._id],
    technologyStack: ['Node.js', 'TypeScript', 'MongoDB'],
    status: ProjectStatus.ACTIVE,
    createdBy: admin._id,
  });

  const projectTwo = await Project.create({
    name: 'Restaurant Management System Full Stack Prototype',
    description: 'Prototype for a restaurant management system.',
    team: [intern._id],
    technologyStack: ['Express', 'MongoDB', 'React'],
    status: ProjectStatus.PLANNING,
    createdBy: admin._id,
  });

  await Task.create({
    title: 'TASK-01: Official Website Backend Module Development',
    description: 'Build and finalize the backend module for the official website',
    assignedTo: intern._id,
    projectId: projectOne._id,
    priority: TaskPriority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    progress: 62,
    createdBy: admin._id,
    requirements: ['REST APIs', 'Authentication', 'Admin endpoints'],
    resources: ['https://example.com/docs'],
  });

  await Task.create({
    title: 'TASK-02: Final Backend Completion, Security & Admin Management',
    description: 'Complete backend finishing touches and admin management modules.',
    assignedTo: intern._id,
    projectId: projectTwo._id,
    priority: TaskPriority.CRITICAL,
    status: TaskStatus.NOT_STARTED,
    progress: 0,
    createdBy: admin._id,
    requirements: ['RBAC', 'Security', 'Admin APIs'],
    resources: ['https://example.com/security-docs'],
  });

  await Task.create({
    title: 'MediFlow Project',
    description: 'Support the Mediflow project through backend APIs and role management.',
    assignedTo: intern._id,
    projectId: projectOne._id,
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.NOT_STARTED,
    progress: 0,
    createdBy: admin._id,
    requirements: ['Project APIs', 'Metrics'],
    resources: ['https://example.com/mediflow'],
  });

  console.log('Seed data created successfully');
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Seeding failed', error);
  process.exit(1);
});
