import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// Layout & Pages
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ChatDashboard from './pages/dashboard/ChatDashboard';
import ProfilePage from './pages/profile/ProfilePage';
import HelpPage from './pages/others/HelpPage';
import ContactsPage from './pages/contacts/ContactsPage';
import NotificationsPage from './pages/others/NotificationsPage';

// Component bảo vệ Route
const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { token } = useAuth();
  return !token ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Nhóm Public (Không có Menu) */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Nhóm Private (Có Menu bên trái) */}
          <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
             <Route path="/" element={<ChatDashboard />} />
             <Route path="/profile" element={<ProfilePage />} />
             <Route path="/notifications" element={<NotificationsPage />} />
             <Route path="/help" element={<HelpPage />} />
             <Route path="/contacts" element={<ContactsPage />} />
          </Route>

          

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;