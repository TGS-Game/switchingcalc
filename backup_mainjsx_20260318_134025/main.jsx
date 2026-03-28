import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ReconciliationPage from './pages/ReconciliationPage';
import TransactionsPage from './pages/TransactionsPage';
import CalculatorPage from './pages/CalculatorPage';
import AlertsPage from './pages/AlertsPage';
import './styles.css';

function Shell() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <h1>Metals Tracker</h1>
          <nav>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/upload">Upload</NavLink>
            <NavLink to="/reconciliation">Reconciliation</NavLink>
            <NavLink to="/transactions">Transactions</NavLink>
            <NavLink to="/calculator">Calculator</NavLink>
            <NavLink to="/alerts">Alerts</NavLink>
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Shell />);
