import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { VoiceProvider } from './context/VoiceContext'
import { ConversationProvider } from './context/ConversationContext'
import { LearnerProfileProvider } from './context/LearnerProfileContext'
import { CodingWorkspaceProvider } from './context/CodingWorkspaceContext'
import { LearningProvider } from './context/LearningContext'
import { InterviewProvider } from './context/InterviewContext'
import { AIProvider } from './context/AIContext'
import { ProjectProvider } from './context/ProjectContext'
import { VersionProvider } from './context/VersionContext'
import { CourseProvider } from './context/CourseContext'
import { AssessmentProvider } from './context/AssessmentContext'
import Signup from './pages/Signup'
import Login from './pages/Login'
import VoxCode from './pages/VoxCode'
import LearningDashboard from './pages/LearningDashboard'
import Projects from './pages/Projects'
import OAuthCallback from './pages/OAuthCallback'
import AuthLoading from './components/AuthLoading'
import LearnDashboard from './pages/LearnDashboard'
import CourseListing from './pages/CourseListing'
import CourseDetail from './pages/CourseDetail'
import LessonViewer from './pages/LessonViewer'
import LearningPaths from './pages/LearningPaths'
import LearningPathDetail from './pages/LearningPathDetail'
import Onboarding from './pages/Onboarding'
import OnboardingSetup from './pages/OnboardingSetup'
import AssessmentList from './pages/AssessmentList'
import AssessmentPlayer from './pages/AssessmentPlayer'
import AssessmentResults from './pages/AssessmentResults'
import HomePage from './pages/HomePage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (user) return <Navigate to="/home" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  return <Navigate to={user ? '/home' : '/login'} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <VoiceProvider>
          <ConversationProvider>
            <LearnerProfileProvider>
              <CodingWorkspaceProvider>
              <LearningProvider>
                <AIProvider>
                  <InterviewProvider>
              <ProjectProvider>
              <VersionProvider>
              <CourseProvider>
              <AssessmentProvider>
              <Routes>
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/voxcode"
            element={
              <ProtectedRoute>
                <VoxCode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <OnboardingSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learning"
            element={
              <ProtectedRoute>
                <LearningDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn"
            element={
              <ProtectedRoute>
                <LearnDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/courses"
            element={
              <ProtectedRoute>
                <CourseListing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/course/:id"
            element={
              <ProtectedRoute>
                <CourseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/lesson/:lessonId"
            element={
              <ProtectedRoute>
                <LessonViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/paths"
            element={
              <ProtectedRoute>
                <LearningPaths />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learn/path/:id"
            element={
              <ProtectedRoute>
                <LearningPathDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments"
            element={
              <ProtectedRoute>
                <AssessmentList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/play/:attemptId"
            element={
              <ProtectedRoute>
                <AssessmentPlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/result/:attemptId"
            element={
              <ProtectedRoute>
                <AssessmentResults />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<HomeRedirect />} />
              </Routes>
              </AssessmentProvider>
              </CourseProvider>
              </VersionProvider>
              </ProjectProvider>
                  </InterviewProvider>
                </AIProvider>
              </LearningProvider>
              </CodingWorkspaceProvider>
            </LearnerProfileProvider>
          </ConversationProvider>
        </VoiceProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App