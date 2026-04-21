import { 
  Code2, Briefcase, User, FolderGit2, Home, Mail, 
  Linkedin, Github, Phone, Send, ExternalLink, MapPin 
} from 'lucide-react';

export const personalDetails = {
  name: "M.Sumanth Reddy",
  role: "Full Stack Developer",
  email: "myakalasumanthreddy@gmail.com",
  phone: "+91 9515174064",
  location: "Karimnagar, Telangana",
  github: "https://github.com/Sumanth-9515",
  linkedin: "https://linkedin.com/in/m-sumanth-reddy-35688928a",
 imgUrl: "/profile.jpg",
  resumeLink: "https://drive.google.com/file/d/1X0ky-rhkQcaNLm9D8PQ0PgdhiS_1XHlg/view?usp=drivesdk", 
  summary: "A passionate and detail-oriented Computer Science graduate with strong full-stack development skills. Proficient in frontend technologies like HTML, CSS, JavaScript, React.js, and backend technologies including Node.js, Express.js, SQL, and Python. Experienced in building real-time web applications with Firebase Authentication and REST APIs.",
};

export const education = [
  {
    degree: "Bachelor of Technology (CSE)",
    institution: "Sree Dattha Group of Institution",
    year: "2024",
    score: "70%",
  },
  {
    degree: "Intermediate (MPC)",
    institution: "SR Junior College",
    year: "2020", // Approx based on B.Tech end
    score: "90%",
  },
  {
    degree: "SSC",
    institution: "Kakatiya High School",
    year: "2018", // Approx
    score: "90%",
  },
];

export const skills = {
  frontend: ["HTML5", "CSS3", "JavaScript (ES6+)", "React.js", "Bootstrap", "Tailwind CSS"],
  backend: ["Node.js", "Express.js", "MongoDB", "SQL", "Python", "Django", "Java", "REST APIs"],
  tools: ["Git", "GitHub", "Firebase", "VS Code", "Postman", "Render", "Netlify"],
  core: ["Data Structures", "Algorithms", "OOPs", "Problem Solving"],
};

export const softSkills = [
  "Leadership & Team Management",
  "Effective Communication",
  "Critical Thinking",
  "Adaptability",
  "Time Management"
];

export const strengths = [
  "Quick Learner",
  "Self-Motivated",
  "Multitasking",
  "Detail-Oriented"
];
export const projects = [
  {
    title: "E-Commerce Dashboard",
    description: "A comprehensive analytics dashboard for online retailers with real-time data visualization.",
    tech: ["React", "Tailwind", "Recharts"],
    link: "#"
  },
  {
    title: "Wellness App",
    description: "Mobile-first application for tracking meditation and emotional well-being stats.",
    tech: ["React Native", "Firebase", "Redux"],
    link: "#"
  },
  {
    title: "Corporate Learning Portal",
    description: "LMS system for corporate training with video progression and certification generation.",
    tech: ["Next.js", "PostgreSQL", "AWS"],
    link: "#"
  },
  {
    title: "AI Career Counselor",
    description: "An AI-driven chat interface that suggests career paths based on user skills and interests.",
    tech: ["OpenAI API", "React", "Node.js"],
    link: "#"
  }
];

export const experience = [
  {
    role: "Full Stack Developer Intern",
    company: "Arah Info Tech",
    duration: "Sep 2025 – Present", 
    points: [
      "Developing web applications using React.js, Node.js, Express.js, and MongoDB.",
      "Built REST APIs and implemented authentication for secure data handling.",
      "Collaborating with the team to deploy projects on Render and Netlify."
    ]
  },
  {
    role: "MERN Stack Developer Trainee",
    company: "10000 Coders Institute",
    duration: "Aug 2024 – Mar 2025",
    points: [
      "Completed training in MongoDB, Express.js, React.js, and Node.js.",
      "Built full-stack projects and earned MERN Stack Certification.",
      "Gained expertise in frontend & backend integration."
    ]
  }
];

export const navLinks = [
  { name: "Home", path: "/", icon: Home },
  { name: "About", path: "/about", icon: User },
  { name: "Skills", path: "/skills", icon: Code2 },
  { name: "Projects", path: "/projects", icon: FolderGit2 },
  { name: "Experience", path: "/experience", icon: Briefcase },
  { name: "Contact", path: "/contact", icon: Send }, // Added Contact
];
