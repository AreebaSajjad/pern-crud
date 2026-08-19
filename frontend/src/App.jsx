import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import ProductDetail from './pages/ProductDetail';
import Users from './pages/Users';
import Meetings from './pages/Meetings';
import ScheduleMeeting from './pages/ScheduleMeeting';
import EditMeeting from './pages/EditMeeting';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import Chatbot from './pages/Chatbot';
import OkfQuery from './pages/OkfQuery';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import UserDetail from './pages/UserDetail';
import ProductOrders from './pages/ProductOrders';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/add" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
        <Route path="/products/edit/:id" element={<ProtectedRoute adminOnly={true}><EditProduct /></ProtectedRoute>} />
        <Route path="/products/view/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute adminOnly={true}><Users /></ProtectedRoute>} />
         <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />        <Route path="/meetings/schedule" element={<ProtectedRoute adminOnly={true}><ScheduleMeeting /></ProtectedRoute>} />
        <Route path="/meetings/edit/:id" element={<ProtectedRoute adminOnly={true}><EditMeeting /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
         <Route path="/chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
        <Route path="/okf-query" element={<ProtectedRoute><OkfQuery /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/users/:id" element={<ProtectedRoute adminOnly={true}><UserDetail /></ProtectedRoute>} />
        <Route path="/products/:id/orders" element={<ProtectedRoute adminOnly={true}><ProductOrders /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
} 

export default App;