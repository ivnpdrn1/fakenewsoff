import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { DemoModeProvider } from './context/DemoModeContext';
import Home from './pages/Home';
import Results from './pages/Results';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <DemoModeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </BrowserRouter>
      </DemoModeProvider>
    </ErrorBoundary>
  );
}

export default App;
