// Data-driven catalog for Phase 1 — reusable, no duplicate technology definitions
// Technologies are atomic; stacks compose them.

export const TECHNOLOGIES = {
  javascript: { id: 'javascript', name: 'JavaScript', type: 'language', color: 'amber' },
  python: { id: 'python', name: 'Python', type: 'language', color: 'cyan' },
  java: { id: 'java', name: 'Java', type: 'language', color: 'red' },
  c: { id: 'c', name: 'C', type: 'language', color: 'slate' },
  cpp: { id: 'cpp', name: 'C++', type: 'language', color: 'violet' },
  csharp: { id: 'csharp', name: 'C#', type: 'language', color: 'violet' },
  go: { id: 'go', name: 'Go', type: 'language', color: 'cyan' },
  rust: { id: 'rust', name: 'Rust', type: 'language', color: 'orange' },
  php: { id: 'php', name: 'PHP', type: 'language', color: 'violet' },
  kotlin: { id: 'kotlin', name: 'Kotlin', type: 'language', color: 'purple' },
  swift: { id: 'swift', name: 'Swift', type: 'language', color: 'red' },
  dart: { id: 'dart', name: 'Dart', type: 'language', color: 'cyan' },
  typescript: { id: 'typescript', name: 'TypeScript', type: 'language', color: 'blue' },
  html: { id: 'html', name: 'HTML', type: 'markup', color: 'orange' },
  css: { id: 'css', name: 'CSS', type: 'style', color: 'blue' },
  react: { id: 'react', name: 'React', type: 'framework', color: 'cyan' },
  angular: { id: 'angular', name: 'Angular', type: 'framework', color: 'red' },
  vue: { id: 'vue', name: 'Vue', type: 'framework', color: 'emerald' },
  nextjs: { id: 'nextjs', name: 'Next.js', type: 'framework', color: 'slate' },
  nodejs: { id: 'nodejs', name: 'Node.js', type: 'runtime', color: 'emerald' },
  express: { id: 'express', name: 'Express', type: 'framework', color: 'slate' },
  flask: { id: 'flask', name: 'Flask', type: 'framework', color: 'slate' },
  django: { id: 'django', name: 'Django', type: 'framework', color: 'emerald' },
  fastapi: { id: 'fastapi', name: 'FastAPI', type: 'framework', color: 'cyan' },
  spring: { id: 'spring', name: 'Spring Boot', type: 'framework', color: 'emerald' },
  aspnet: { id: 'aspnet', name: 'ASP.NET Core', type: 'framework', color: 'violet' },
  gin: { id: 'gin', name: 'Gin', type: 'framework', color: 'cyan' },
  laravel: { id: 'laravel', name: 'Laravel', type: 'framework', color: 'red' },
  mongodb: { id: 'mongodb', name: 'MongoDB', type: 'database', color: 'emerald' },
  postgres: { id: 'postgres', name: 'PostgreSQL', type: 'database', color: 'blue' },
  mysql: { id: 'mysql', name: 'MySQL', type: 'database', color: 'amber' },
  redis: { id: 'redis', name: 'Redis', type: 'database', color: 'red' },
  sql: { id: 'sql', name: 'SQL', type: 'database', color: 'blue' },
  flutter: { id: 'flutter', name: 'Flutter', type: 'framework', color: 'cyan' },
  reactnative: { id: 'reactnative', name: 'React Native', type: 'framework', color: 'cyan' },
  git: { id: 'git', name: 'Git', type: 'tool', color: 'orange' },
  docker: { id: 'docker', name: 'Docker', type: 'tool', color: 'blue' },
};

export const PROGRAMMING_LANGUAGES = [
  { id: 'javascript', techId: 'javascript', stages: 8, level: 'Beginner → Advanced', minutes: 480, courseSlug: 'javascript-fundamentals' },
  { id: 'python', techId: 'python', stages: 7, level: 'Beginner → Advanced', minutes: 480, courseSlug: 'python-fundamentals' },
  { id: 'java', techId: 'java', stages: 9, level: 'Beginner → Advanced', minutes: 600, courseSlug: null },
  { id: 'c', techId: 'c', stages: 6, level: 'Beginner → Advanced', minutes: 400, courseSlug: null },
  { id: 'cpp', techId: 'cpp', stages: 8, level: 'Beginner → Advanced', minutes: 520, courseSlug: null },
  { id: 'csharp', techId: 'csharp', stages: 7, level: 'Beginner → Advanced', minutes: 500, courseSlug: null },
  { id: 'go', techId: 'go', stages: 6, level: 'Beginner → Advanced', minutes: 420, courseSlug: null },
  { id: 'rust', techId: 'rust', stages: 7, level: 'Intermediate → Advanced', minutes: 560, courseSlug: null },
  { id: 'php', techId: 'php', stages: 6, level: 'Beginner → Intermediate', minutes: 380, courseSlug: null },
  { id: 'kotlin', techId: 'kotlin', stages: 7, level: 'Beginner → Advanced', minutes: 480, courseSlug: null },
  { id: 'swift', techId: 'swift', stages: 7, level: 'Beginner → Advanced', minutes: 500, courseSlug: null },
  { id: 'dart', techId: 'dart', stages: 6, level: 'Beginner → Intermediate', minutes: 360, courseSlug: null },
  { id: 'typescript', techId: 'typescript', stages: 6, level: 'Intermediate → Advanced', minutes: 400, courseSlug: null },
];

export const FRONTEND_STACKS = [
  { id: 'fe-html-css', title: 'HTML + CSS', techs: ['html','css'], difficulty: 'beginner', stages: 4, duration: '12h', pathSlug: null },
  { id: 'fe-html-css-js', title: 'HTML + CSS + JavaScript', techs: ['html','css','javascript'], difficulty: 'beginner', stages: 8, duration: '24h', pathSlug: 'frontend-developer' },
  { id: 'fe-react', title: 'HTML + CSS + JavaScript + React', techs: ['html','css','javascript','react'], difficulty: 'intermediate', stages: 12, duration: '30h', pathSlug: 'frontend-developer' },
  { id: 'fe-angular', title: 'HTML + CSS + JavaScript + Angular', techs: ['html','css','javascript','angular'], difficulty: 'intermediate', stages: 12, duration: '32h', pathSlug: null },
  { id: 'fe-vue', title: 'HTML + CSS + JavaScript + Vue', techs: ['html','css','javascript','vue'], difficulty: 'intermediate', stages: 11, duration: '28h', pathSlug: null },
  { id: 'fe-next', title: 'HTML + CSS + JavaScript + Next.js', techs: ['html','css','javascript','nextjs'], difficulty: 'intermediate', stages: 12, duration: '32h', pathSlug: null },
  { id: 'fe-ts-react', title: 'HTML + CSS + TypeScript + React', techs: ['html','css','typescript','react'], difficulty: 'intermediate', stages: 13, duration: '34h', pathSlug: null },
  { id: 'fe-ts-angular', title: 'HTML + CSS + TypeScript + Angular', techs: ['html','css','typescript','angular'], difficulty: 'advanced', stages: 13, duration: '36h', pathSlug: null },
];

export const BACKEND_STACKS = [
  { id: 'be-node-express', title: 'Node.js + Express', techs: ['nodejs','express'], difficulty: 'beginner', stages: 6, duration: '14h', pathSlug: 'backend-developer' },
  { id: 'be-node-mongo', title: 'Node.js + Express + MongoDB', techs: ['nodejs','express','mongodb'], difficulty: 'intermediate', stages: 8, duration: '20h', pathSlug: 'backend-developer' },
  { id: 'be-node-postgres', title: 'Node.js + Express + PostgreSQL', techs: ['nodejs','express','postgres'], difficulty: 'intermediate', stages: 8, duration: '22h', pathSlug: null },
  { id: 'be-py-flask', title: 'Python + Flask', techs: ['python','flask'], difficulty: 'beginner', stages: 6, duration: '14h', pathSlug: null },
  { id: 'be-py-django', title: 'Python + Django', techs: ['python','django'], difficulty: 'intermediate', stages: 8, duration: '20h', pathSlug: null },
  { id: 'be-py-fastapi', title: 'Python + FastAPI', techs: ['python','fastapi'], difficulty: 'intermediate', stages: 7, duration: '18h', pathSlug: null },
  { id: 'be-java-spring', title: 'Java + Spring Boot', techs: ['java','spring'], difficulty: 'intermediate', stages: 9, duration: '28h', pathSlug: null },
  { id: 'be-csharp-asp', title: 'C# + ASP.NET Core', techs: ['csharp','aspnet'], difficulty: 'intermediate', stages: 8, duration: '24h', pathSlug: null },
  { id: 'be-go-gin', title: 'Go + Gin', techs: ['go','gin'], difficulty: 'intermediate', stages: 6, duration: '16h', pathSlug: null },
  { id: 'be-php-laravel', title: 'PHP + Laravel', techs: ['php','laravel'], difficulty: 'beginner', stages: 7, duration: '18h', pathSlug: null },
];

export const PYTHON_FULLSTACK = [
  { id: 'py-html-flask', title: 'Python + HTML + CSS + JavaScript + Flask', techs: ['python','html','css','javascript','flask'], difficulty: 'intermediate', stages: 10, duration: '30h', pathSlug: null },
  { id: 'py-html-django', title: 'Python + HTML + CSS + JavaScript + Django', techs: ['python','html','css','javascript','django'], difficulty: 'intermediate', stages: 12, duration: '36h', pathSlug: null },
  { id: 'py-react-django', title: 'Python + React + Django', techs: ['python','react','django'], difficulty: 'intermediate', stages: 11, duration: '32h', pathSlug: null },
  { id: 'py-react-fastapi', title: 'Python + React + FastAPI', techs: ['python','react','fastapi'], difficulty: 'intermediate', stages: 10, duration: '28h', pathSlug: null },
];

export const JAVA_FULLSTACK = [
  { id: 'java-html-spring', title: 'Java + HTML + CSS + JavaScript + Spring Boot', techs: ['java','html','css','javascript','spring'], difficulty: 'intermediate', stages: 12, duration: '38h', pathSlug: null },
  { id: 'java-react-spring', title: 'Java + React + Spring Boot', techs: ['java','react','spring'], difficulty: 'intermediate', stages: 11, duration: '34h', pathSlug: null },
  { id: 'java-angular-spring', title: 'Java + Angular + Spring Boot', techs: ['java','angular','spring'], difficulty: 'advanced', stages: 12, duration: '40h', pathSlug: null },
  { id: 'java-react-pg', title: 'Java + React + Spring Boot + PostgreSQL', techs: ['java','react','spring','postgres'], difficulty: 'advanced', stages: 13, duration: '44h', pathSlug: null },
];

export const MOBILE_STACKS = [
  { id: 'mob-flutter', title: 'Flutter + Dart', techs: ['flutter','dart'], difficulty: 'beginner', stages: 8, duration: '24h', pathSlug: null },
  { id: 'mob-rn-js', title: 'React Native + JavaScript', techs: ['reactnative','javascript'], difficulty: 'intermediate', stages: 8, duration: '22h', pathSlug: null },
  { id: 'mob-rn-ts', title: 'React Native + TypeScript', techs: ['reactnative','typescript'], difficulty: 'intermediate', stages: 9, duration: '24h', pathSlug: null },
  { id: 'mob-kotlin', title: 'Kotlin + Android', techs: ['kotlin'], difficulty: 'intermediate', stages: 8, duration: '26h', pathSlug: null },
  { id: 'mob-swift', title: 'Swift + iOS', techs: ['swift'], difficulty: 'intermediate', stages: 8, duration: '26h', pathSlug: null },
];

export const DATABASES = [
  { id: 'sql', techId: 'sql', stages: 6, level: 'Beginner → Advanced', courseSlug: null },
  { id: 'postgres', techId: 'postgres', stages: 7, level: 'Beginner → Advanced', courseSlug: null },
  { id: 'mysql', techId: 'mysql', stages: 6, level: 'Beginner → Advanced', courseSlug: null },
  { id: 'mongodb', techId: 'mongodb', stages: 6, level: 'Beginner → Advanced', courseSlug: null },
  { id: 'redis', techId: 'redis', stages: 5, level: 'Intermediate → Advanced', courseSlug: null },
];

export const TOOLS = [
  { id: 'git', name: 'Git', desc: 'Version control' },
  { id: 'github', name: 'GitHub', desc: 'Collaboration & hosting' },
  { id: 'docker', name: 'Docker', desc: 'Containers' },
  { id: 'rest', name: 'REST APIs', desc: 'HTTP & API design' },
  { id: 'graphql', name: 'GraphQL', desc: 'Query language' },
  { id: 'linux', name: 'Linux basics', desc: 'Command line' },
  { id: 'testing', name: 'Testing', desc: 'Unit & integration' },
  { id: 'cicd', name: 'CI/CD', desc: 'Automation & deploy' },
];

export const CATEGORIES = [
  { id: 'languages', label: 'Programming Languages', anchor: 'programming-languages' },
  { id: 'frontend', label: 'Frontend Development', anchor: 'frontend-development' },
  { id: 'backend', label: 'Backend Development', anchor: 'backend-development' },
  { id: 'python-stack', label: 'Python Full Stack', anchor: 'python-full-stack' },
  { id: 'java-stack', label: 'Java Full Stack', anchor: 'java-full-stack' },
  { id: 'mobile', label: 'Mobile Development', anchor: 'mobile-development' },
  { id: 'databases', label: 'Databases', anchor: 'databases' },
  { id: 'tools', label: 'Tools & Other Technologies', anchor: 'tools' },
];
