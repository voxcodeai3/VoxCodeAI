import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { VoiceProvider } from './context/VoiceContext'
import { ConversationProvider } from './context/ConversationContext'
import { LearnerProfileProvider } from './context/LearnerProfileContext'
import { CodingWorkspaceProvider } from './context/CodingWorkspaceContext'
import { LearningProvider } from './context/LearningContext'
import { InterviewProvider } from './context/InterviewContext'
import { AIProvider } from './context/AIContext'
import Signup from './pages/Signup'
import Login from './pages/Login'
import VoxCode from './pages/VoxCode'
import OAuthCallback from './pages/OAuthCallback'
import AuthLoading from './components/AuthLoading'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (user) return <Navigate to="/voxcode" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  return <Navigate to={user ? '/voxcode' : '/login'} replace />
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
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<HomeRedirect />} />
              </Routes>
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