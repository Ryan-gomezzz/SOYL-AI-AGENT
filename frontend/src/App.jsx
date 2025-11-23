/**
 * Main App Component
 * 
 * Sets up routing and provides the main layout for the CRM application
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EnquiryForm from './pages/EnquiryForm';
import './App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/enquiry" element={<EnquiryForm />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
