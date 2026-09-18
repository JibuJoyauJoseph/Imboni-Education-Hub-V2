import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import RegisterStudent from './pages/RegisterStudent.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

import StudentDashboard from './pages/student/StudentDashboard.jsx';
import AvailableCourses from './pages/student/AvailableCourses.jsx';
import CourseView from './pages/student/CourseView.jsx';
import Kanban from './pages/student/Kanban.jsx';
import AiTutor from './pages/student/AiTutor.jsx';
import TeamDashboard from './pages/student/TeamDashboard.jsx';
import FreeCourses from './pages/FreeCourses.jsx';

import LecturerDashboard from './pages/lecturer/LecturerDashboard.jsx';
import CourseManage from './pages/lecturer/CourseManage.jsx';

import SchoolAdminDashboard from './pages/admin/SchoolAdminDashboard.jsx';
import PlatformAdminDashboard from './pages/platform/PlatformAdminDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterStudent />} />
      <Route path="/free-courses" element={<FreeCourses />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/courses/available" element={<ProtectedRoute roles={['student']}><AvailableCourses /></ProtectedRoute>} />
      <Route path="/student/courses/:id" element={<ProtectedRoute roles={['student']}><CourseView /></ProtectedRoute>} />
      <Route path="/student/kanban" element={<ProtectedRoute roles={['student']}><Kanban /></ProtectedRoute>} />
      <Route path="/student/ai-tutor" element={<ProtectedRoute roles={['student']}><AiTutor /></ProtectedRoute>} />
      <Route path="/student/teams/:id" element={<ProtectedRoute roles={['student']}><TeamDashboard /></ProtectedRoute>} />

      <Route path="/lecturer" element={<ProtectedRoute roles={['lecturer']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/lecturer/courses/:id" element={<ProtectedRoute roles={['lecturer']}><CourseManage /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute roles={['school_admin']}><SchoolAdminDashboard /></ProtectedRoute>} />
      <Route path="/platform" element={<ProtectedRoute roles={['platform_admin']}><PlatformAdminDashboard /></ProtectedRoute>} />

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
