import type { TourStep } from './tour-engine';

export const TOURS: Record<string, { title: string; description: string; steps: TourStep[] }> = {
  dashboard_overview: {
    title: 'Dashboard Overview',
    description: 'Learn how to navigate the Pulse control plane.',
    steps: [
      { title: 'Welcome to Pulse', content: 'This is your school content delivery control plane. From here you manage content, nodes, classrooms, curriculum, and monitoring — all in one place.', position: 'center' },
      { target: 'nav a[href="/dashboard/content"]', title: 'Content Management', content: 'Upload video lessons, documents, and create packages here. Packages bundle assets together for syncing to school nodes.', position: 'right' },
      { target: 'nav a[href="/dashboard/school/curriculum"]', title: 'Curriculum Builder', content: 'Set up grades, subjects, and learning sequences. Sequences define the order: video → quiz → video. Students follow this flow automatically.', position: 'right' },
      { target: 'nav a[href="/dashboard/school/classrooms"]', title: 'Classroom Management', content: 'Create classrooms, assign them to nodes, and generate enrollment QR codes for student devices.', position: 'right' },
      { target: 'nav a[href="/dashboard/monitoring"]', title: 'Monitoring', content: 'Monitor node health, sync progress, session activity, and quiz results across all your schools in real-time.', position: 'right' },
      { target: 'nav a[href="/dashboard/search"]', title: 'Global Search', content: 'Search across all your data — nodes, packages, assets, users, classrooms, sequences, and quizzes — from one place.', position: 'right' },
      { title: 'You\'re Ready!', content: 'Start by uploading content, creating a package, and pushing it to a school node. The onboarding wizard in the bottom-right will guide you step by step.', position: 'center' },
    ],
  },

  content_management: {
    title: 'Content Management',
    description: 'Learn how to upload, package, and sync content.',
    steps: [
      { title: 'Content Hub', content: 'This is where all your educational content lives. You\'ll see three tabs: Assets (files), Packages (bundles), and Sync Jobs (delivery status).', position: 'center' },
      { title: 'Upload Assets', content: 'Click "Upload" to add video lessons, documents, PDFs, or images. Files are stored securely in the cloud with SHA-256 checksums.', position: 'center' },
      { title: 'Create Packages', content: 'A Package bundles multiple assets together. Select the assets you want, choose target school sites, and create the package.', position: 'center' },
      { title: 'Publish & Sync', content: 'After creating a package, click "Publish" to make it ready. Then hit "Push Sync" to deliver it to all target school nodes automatically.', position: 'center' },
      { title: 'Monitor Sync', content: 'The Sync Jobs tab shows real-time progress of content delivery to each node. Jobs show percentage, bytes transferred, and status.', position: 'center' },
    ],
  },

  curriculum_builder: {
    title: 'Curriculum Builder',
    description: 'Learn how to create grades, subjects, and learning sequences.',
    steps: [
      { title: 'Curriculum Setup', content: 'Start by setting up your school structure: Grades (Grade 1-12), Subjects (Math, Science, etc.), and Terms (Term 1 2026).', position: 'center' },
      { title: 'Class Groups', content: 'A Class Group is a set of students for a specific grade + subject. Example: "Grade 10A Science". This controls who sees what content.', position: 'center' },
      { title: 'Learning Sequences', content: 'A Sequence is an ordered lesson plan: Video → Quiz → Video → Activity. Students follow this flow step by step.', position: 'center' },
      { title: 'Quiz Builder', content: 'Create quizzes with multiple-choice questions, set time limits, and define pass percentages. Quizzes auto-trigger after videos finish.', position: 'center' },
      { title: 'Publish & Assign', content: 'Publish your sequence to make it available. Assign it to class groups so only the right students see the right content.', position: 'center' },
    ],
  },

  classroom_setup: {
    title: 'Classroom Setup',
    description: 'Learn how to enroll devices and manage classrooms.',
    steps: [
      { title: 'Create a Classroom', content: 'Click "Create Classroom" and give it a name, room code, and assign it to a node (the school appliance).', position: 'center' },
      { title: 'Generate Enrollment Code', content: 'Inside the classroom, click "Generate Enrollment Code". This creates a QR code and URL that devices use to join.', position: 'center' },
      { title: 'Enroll Devices', content: 'On the student device, open a browser and scan the QR code or visit the URL. The device is now enrolled in that classroom.', position: 'center' },
      { title: 'Student Login', content: 'After enrollment, students see a login screen. They enter their student number to identify themselves. Quiz results are tied to their identity.', position: 'center' },
      { title: 'Teacher Conductor', content: 'Teachers can go to /conductor on the node to control the class. When the teacher advances, all student devices follow automatically.', position: 'center' },
    ],
  },

  monitoring_guide: {
    title: 'Monitoring Guide',
    description: 'Learn how to monitor your school nodes and students.',
    steps: [
      { title: 'Node Health', content: 'See CPU, memory, storage, and connectivity status for each school node. Heartbeats arrive every 60 seconds.', position: 'center' },
      { title: 'Sync Activity', content: 'Track active sync jobs, completed today, and failed jobs. Each sync shows progress percentage and bytes transferred.', position: 'center' },
      { title: 'Sessions & Devices', content: 'See how many students are active, how many devices are enrolled, and what content they\'re accessing right now.', position: 'center' },
      { title: 'Alerts', content: 'Pulse automatically detects issues: storage running low, CPU overload, Jellyfin unreachable, or nodes going offline. Alerts appear here.', position: 'center' },
      { title: 'Quiz Results', content: 'Go to Results to see quiz scores, pass rates, and score distributions. Export to CSV for reporting.', position: 'center' },
    ],
  },
};
